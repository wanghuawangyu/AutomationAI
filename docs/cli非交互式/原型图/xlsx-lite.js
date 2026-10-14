/**
 * xlsx-lite.js —— 原型图本地内置的最小 .xlsx 写入器（L-9：导出组件不依赖 CDN）
 *
 * 背景：原型的「全部导出」需要生成 .xlsx。此前依赖 CDN 的 SheetJS（离线/内网不可用，且与「无外部依赖 /
 * 双击即用」冲突）。本文件以**本地内置**方式提供 mock-data.js 导出路径所需的最小 API 子集：
 *   XLSX.utils.book_new()                     -> 新建工作簿
 *   XLSX.utils.aoa_to_sheet(rows)             -> 二维数组（array of arrays）转工作表
 *   XLSX.utils.book_append_sheet(wb, ws, name)-> 追加工作表
 *   XLSX.write(wb, { bookType:'xlsx', type:'base64' }) -> 返回 base64 的 .xlsx
 *
 * 说明：仅实现「写出」所需能力，生成 OOXML（.xlsx = ZIP）时使用 **store（不压缩）** 方式，
 * 单元格一律以 inlineStr / number / boolean 写出，足够原型演示；不实现读取、样式、公式等。
 * 本文件在浏览器中定义全局 `XLSX`（mock-data.js 的导出分支按 `typeof XLSX === 'undefined'` 探测）。
 */
(function (global) {
  'use strict';

  /* ---------- CRC32（ZIP 条目校验） ---------- */
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /* ---------- UTF-8 编码 ---------- */
  function utf8Bytes(str) {
    var s = String(str == null ? '' : str);
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var cp = s.charCodeAt(i);
      if (cp < 0x80) out.push(cp);
      else if (cp < 0x800) { out.push(0xC0 | (cp >> 6), 0x80 | (cp & 0x3F)); }
      else if (cp >= 0xD800 && cp <= 0xDBFF && i + 1 < s.length) {
        var cp2 = s.charCodeAt(i + 1);
        if (cp2 >= 0xDC00 && cp2 <= 0xDFFF) {
          var full = 0x10000 + ((cp - 0xD800) << 10) + (cp2 - 0xDC00);
          out.push(0xF0 | (full >> 18), 0x80 | ((full >> 12) & 0x3F), 0x80 | ((full >> 6) & 0x3F), 0x80 | (full & 0x3F));
          i++;
          continue;
        }
        out.push(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
      } else { out.push(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F)); }
    }
    return new Uint8Array(out);
  }

  /* ---------- 最小 ZIP（store，无压缩） ---------- */
  function zipStore(entries) {
    var chunks = [], central = [], offset = 0;
    var dosTime = 0, dosDate = 0x21;   // 固定 1980-01-01 00:00:00（原型固定值即可）
    entries.forEach(function (e) {
      var nameBytes = utf8Bytes(e.name);
      var data = e.data;
      var crc = crc32(data);
      var local = new Uint8Array(30 + nameBytes.length);
      var lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);          // version needed
      lv.setUint16(6, 0, true);           // flags
      lv.setUint16(8, 0, true);           // method = store
      lv.setUint16(10, dosTime, true);
      lv.setUint16(12, dosDate, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);
      chunks.push(local, data);

      var cd = new Uint8Array(46 + nameBytes.length);
      var cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);          // version made by
      cv.setUint16(6, 20, true);          // version needed
      cv.setUint16(8, 0, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dosTime, true);
      cv.setUint16(14, dosDate, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      cd.set(nameBytes, 46);
      central.push(cd);
      offset += local.length + data.length;
    });
    var cdSize = central.reduce(function (s, c) { return s + c.length; }, 0);
    var end = new Uint8Array(22);
    var ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);
    var all = chunks.concat(central, [end]);
    var total = all.reduce(function (s, c) { return s + c.length; }, 0);
    var out = new Uint8Array(total), pos = 0;
    all.forEach(function (c) { out.set(c, pos); pos += c.length; });
    return out;
  }

  /* ---------- 工具 ---------- */
  function xmlEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  function colLetter(idx) {   // 0 -> A, 25 -> Z, 26 -> AA
    var s = '';
    idx = idx + 1;
    while (idx > 0) {
      var r = (idx - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      idx = Math.floor((idx - 1) / 26);
    }
    return s;
  }
  function sheetName(name, fallbackIdx) {
    var n = String(name == null ? '' : name).replace(/[\[\]:*?\/\\]/g, '_');
    if (!n) n = 'Sheet' + (fallbackIdx + 1);
    return n.length > 31 ? n.slice(0, 31) : n;
  }

  function sheetXml(rows) {
    var body = '';
    (rows || []).forEach(function (row, r) {
      if (!row) return;
      var cells = '';
      for (var c = 0; c < row.length; c++) {
        var v = row[c];
        if (v == null || v === '') continue;   // 空值不写单元格
        var ref = colLetter(c) + (r + 1);
        if (typeof v === 'number' && isFinite(v)) {
          cells += '<c r="' + ref + '"><v>' + v + '</v></c>';
        } else if (typeof v === 'boolean') {
          cells += '<c r="' + ref + '" t="b"><v>' + (v ? 1 : 0) + '</v></c>';
        } else {
          cells += '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(v) + '</t></is></c>';
        }
      }
      body += '<row r="' + (r + 1) + '">' + cells + '</row>';
    });
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + body + '</sheetData></worksheet>';
  }

  function buildXlsx(wb) {
    var names = wb.SheetNames || [];
    var rels = '', sheets = '', overrides = '';
    names.forEach(function (name, i) {
      var rid = 'rId' + (i + 1);
      rels += '<Relationship Id="' + rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
      sheets += '<sheet name="' + xmlEsc(name) + '" sheetId="' + (i + 1) + '" r:id="' + rid + '"/>';
      overrides += '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    });
    var files = [];
    files.push(['[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      overrides + '</Types>']);
    files.push(['_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>']);
    files.push(['xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets>' + sheets + '</sheets></workbook>']);
    files.push(['xl/_rels/workbook.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + '</Relationships>']);
    names.forEach(function (name, i) {
      files.push(['xl/worksheets/sheet' + (i + 1) + '.xml', sheetXml((wb.Sheets || [])[i] && (wb.Sheets || [])[i].rows)]);
    });
    return zipStore(files.map(function (f) { return { name: f[0], data: utf8Bytes(f[1]) }; }));
  }

  function bytesToBase64(bytes) {
    var bin = '', step = 0x8000;
    for (var i = 0; i < bytes.length; i += step) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
    return btoa(bin);
  }

  /* ---------- 对外 API（SheetJS 最小子集） ---------- */
  var XLSX = {
    utils: {
      book_new: function () { return { SheetNames: [], Sheets: [] }; },
      aoa_to_sheet: function (rows) { return { rows: rows || [] }; },
      book_append_sheet: function (wb, ws, name) {
        wb.SheetNames.push(sheetName(name, wb.SheetNames.length));
        wb.Sheets.push(ws);
      }
    },
    write: function (wb, opts) {
      var bytes = buildXlsx(wb);
      if (opts && opts.type === 'base64') return bytesToBase64(bytes);
      return bytes;
    }
  };

  global.XLSX = XLSX;
  if (typeof module !== 'undefined' && module.exports) module.exports = XLSX;
})(typeof window !== 'undefined' ? window : this);
