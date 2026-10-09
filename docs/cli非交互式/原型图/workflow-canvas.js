/* ============================================================
 * workflow-canvas.js — Workflow 画布共享渲染
 * 统一 编辑界面 / 查看界面 / 运行历史 的画布视觉与交互
 * （以 workflow.html 编辑界面样式为主）
 *
 * 用法：
 *   WFCanvas.render(canvasEl, nodes, edges, opts)
 *
 *   nodes: { nodeId: { kind:'start'|'op'|'end', x, y, op?, opVersion?, timeout?, outdated?, ... } }
 *   edges: [{from,to,condition}] 或 [[from,to,condition]] 均可
 *   opts: {
 *     width, height,                 // 画布尺寸，默认 1100 x 400
 *     editable: bool,                // 编辑模式：锚点/拖动/右键删除
 *     onNodeClick(id, node),         // 节点点击回调（只读模式必传）
 *     nodeMeta(id, node) -> string,  // OP 节点 meta 行文本，默认 'v<version>'
 *     nodeStatus(id, node) -> {cls,text}|null,  // 状态样式与文本（运行历史）
 *     edgeDashed(edge, toNode) -> bool,        // 边是否灰色虚线（未执行）
 *     selectedId,                    // 编辑模式：当前选中节点
 *     beforeAddEdge(from,to,condition) -> bool,// 编辑模式：连线校验（允许才 true）
 *     onEdgesChanged(),              // 编辑模式：边增删后回调
 *     onEdgeContextMenu(x, y, edge), // 编辑模式：连线右键菜单
 *     connectingNow() -> bool,       // 编辑模式：是否正在连线（用于禁用拖动）
 *     setConnecting(state|null)      // 编辑模式：连线状态通知宿主
 *   }
 * ============================================================ */
var WFCanvas = (function () {
  'use strict';

  var NODE_W = 130, NODE_H = 46;
  var START_ID = '__start__', END_ID = '__end__';
  var ANCHOR_Y = { on_failure: 11.5, on_success: 21.5, always: 31.5 };
  var EDGE_COLOR = { on_success: '#16a34a', on_failure: '#dc2626', always: '#3b6ef6' };
  var EDGE_MARKER = { on_success: 'wf-arr-g', on_failure: 'wf-arr-r', always: 'wf-arr-b' };
  var DEFAULT_W = 1100, DEFAULT_H = 400;
  /* 画布实例计数器：每个画布生成唯一 marker id，避免同页多画布
   * （查看画布 + 编辑画布共存）因 marker id 重名导致箭头引用到
   * 隐藏容器中的 marker 而不渲染 */
  var canvasSeq = 0;

  function isSysNode(n) { return n.kind === 'start' || n.kind === 'end'; }

  /* 边归一化：支持 [{from,to,condition}] 与 [[from,to,cond]] */
  function normalizeEdges(edges) {
    return (edges || []).map(function (e) {
      if (Array.isArray(e)) {
        return { from: e[0], to: e[1], condition: e[2] || 'on_success' };
      }
      return { from: e.from, to: e.to, condition: e.condition || 'on_success' };
    });
  }

  /* 创建 SVG 容器（含箭头 marker，id 带画布实例序号保证唯一） */
  function createSvg(W, H, seq) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'dag-edges');
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('data-seq', seq);

    var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    [
      ['wf-arr-g', '#16a34a'],
      ['wf-arr-r', '#dc2626'],
      ['wf-arr-b', '#3b6ef6'],
      ['wf-arr-gray', '#c3c8d0']
    ].forEach(function (m) {
      var marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', m[0] + '-' + seq);
      marker.setAttribute('markerWidth', '7');
      marker.setAttribute('markerHeight', '7');
      marker.setAttribute('refX', '6.5');
      marker.setAttribute('refY', '3.5');
      marker.setAttribute('orient', 'auto');
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M0,0 L7,3.5 L0,7 Z');
      path.setAttribute('fill', m[1]);
      marker.appendChild(path);
      defs.appendChild(marker);
    });
    svg.appendChild(defs);
    return svg;
  }

  /* 节点出点 / 入点坐标（与编辑界面锚点位置一致）
     X 轴：出点贴锚点中心（节点右边缘外 1.5px，锚点 right:-6px 宽 9px 的中心），
           入点贴节点左边缘内侧 1px，使线头/箭头贴近 OP 块 */
  function getOutPoint(n, condition) {
    if (n.kind === 'start') return { x: n.position.x + NODE_W + 1.5, y: n.position.y + NODE_H / 2 };
    return { x: n.position.x + NODE_W + 1.5, y: n.position.y + (ANCHOR_Y[condition] || ANCHOR_Y.on_success) };
  }
  function getInPoint(n) { return { x: n.position.x + 1, y: n.position.y + NODE_H / 2 }; }

  /* 绘制一条边（贝塞尔曲线，与编辑界面一致） */
  function drawEdge(svg, edge, nodes, opts) {
    var from = nodes[edge.from];
    var to = nodes[edge.to];
    if (!from || !to) return;

    var p1 = getOutPoint(from, edge.condition);
    var p2 = getInPoint(to);
    var x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
    var dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
    var d = 'M' + x1 + ' ' + y1 + ' C' + (x1 + dx) + ' ' + y1 + ' ' + (x2 - dx) + ' ' + y2 + ' ' + x2 + ' ' + y2;

    var color = EDGE_COLOR[edge.condition] || '#16a34a';
    var marker = 'url(#' + (EDGE_MARKER[edge.condition] || 'wf-arr-g') + '-' + svg.getAttribute('data-seq') + ')';
    var dashed = false;
    if (opts.edgeDashed && opts.edgeDashed(edge, to)) {
      color = '#c3c8d0';
      marker = 'url(#wf-arr-gray-' + svg.getAttribute('data-seq') + ')';
      dashed = true;
    }

    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', marker);
    if (dashed) path.setAttribute('stroke-dasharray', '5 4');

    if (opts.editable && opts.onEdgeContextMenu) {
      path.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
        opts.onEdgeContextMenu(e.clientX, e.clientY, edge);
      });
    }
    svg.appendChild(path);
  }

  /* 只重绘边（拖动节点时实时更新连线，不重建节点） */
  function renderEdgesOnly(canvas, nodes, edges, opts) {
    var svg = canvas.querySelector('.dag-edges');
    if (!svg) return;
    var defs = svg.querySelector('defs');
    svg.innerHTML = '';
    if (defs) svg.appendChild(defs);
    normalizeEdges(edges).forEach(function (e) { drawEdge(svg, e, nodes, opts); });
  }

  /* 构建单个节点 DOM */
  function buildNodeEl(id, n, opts) {
    var el = document.createElement('div');
    var cls = 'dag-node' + (isSysNode(n) ? ' node-system' : '');

    var st = null;
    if (opts.nodeStatus) st = opts.nodeStatus(id, n);
    if (st && st.cls) cls += ' ' + st.cls;
    if (n.outdated) cls += ' outdated';
    if (opts.editable && opts.selectedId === id) cls += ' selected';
    el.className = cls;
    el.dataset.node = id;
    el.style.left = n.position.x + 'px';
    el.style.top = n.position.y + 'px';

    var html = '';
    if (n.kind === 'start') {
      html += '<div class="dn-title">▶ Start</div><div class="dn-meta">开始节点</div>';
      if (st && st.text) html += '<div class="dn-state">' + st.text + '</div>';
    } else if (n.kind === 'end') {
      html += '<div class="dn-title">End ◉</div><div class="dn-meta">结束节点</div>';
      if (st && st.text) html += '<div class="dn-state">' + st.text + '</div>';
    } else {
      html += '<div class="dn-title">' + (n.op || id) + '</div>';
      var meta = opts.nodeMeta ? opts.nodeMeta(id, n) : ('v' + (n.opVersion || ''));
      html += '<div class="dn-meta">' + (meta || '') + '</div>';
      if (st && st.text) html += '<div class="dn-state">' + st.text + '</div>';
      if (n.outdated) html += '<span class="dn-warn">⚠</span>';
    }

    /* 编辑模式：渲染锚点 */
    if (opts.editable) {
      if (n.kind === 'start') {
        html += '<span class="anchor anchor-success anchor-center" data-anchor="on_success" data-node="' + id + '"></span>';
      } else if (n.kind === 'op') {
        html +=
          '<span class="anchor anchor-fail" data-anchor="on_failure" data-node="' + id + '"></span>' +
          '<span class="anchor anchor-success" data-anchor="on_success" data-node="' + id + '"></span>' +
          '<span class="anchor anchor-always" data-anchor="always" data-node="' + id + '"></span>';
      }
    }

    el.innerHTML = html;

    el.addEventListener('click', function (e) {
      e.stopPropagation();
      if (opts.suppressClick) { opts.suppressClick = false; return; }
      if (opts.onNodeClick) opts.onNodeClick(id, n);
    });

    return el;
  }

  /* 编辑模式交互：节点拖动 + 锚点连线 */
  function bindEditable(canvas, nodes, edges, opts) {
    /* ---- 节点拖动移动 ---- */
    canvas.querySelectorAll('.dag-node').forEach(function (el) {
      var id = el.dataset.node;
      var dragState = null;

      el.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        if (e.target.closest && e.target.closest('.anchor')) return;  // 锚点交给连线逻辑
        if (opts.connectingNow && opts.connectingNow()) return;        // 连线进行中不拖动
        e.preventDefault();
        var n = nodes[id];
        if (!n) return;
        dragState = { sx: e.clientX, sy: e.clientY, ox: n.position.x, oy: n.position.y, moved: false };
        el.classList.add('node-dragging');

        function onMove(ev) {
          if (!dragState) return;
          var dx = ev.clientX - dragState.sx;
          var dy = ev.clientY - dragState.sy;
          if (!dragState.moved && Math.abs(dx) + Math.abs(dy) > 3) dragState.moved = true;
          if (!dragState.moved) return;
          var n = nodes[id];
          if (!n) return;
          n.position.x = Math.max(0, Math.min(dragState.ox + dx, canvas.offsetWidth - NODE_W));
          n.position.y = Math.max(0, Math.min(dragState.oy + dy, canvas.offsetHeight - NODE_H));
          el.style.left = n.position.x + 'px';
          el.style.top = n.position.y + 'px';
          renderEdgesOnly(canvas, nodes, edges, opts);
        }

        function onUp() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          el.classList.remove('node-dragging');
          if (dragState && dragState.moved) opts.suppressClick = true;  // 拖动结束不触发选中
          dragState = null;
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });

    /* ---- 锚点拖拽连线 ---- */
    canvas.querySelectorAll('.anchor').forEach(function (a) {
      a.addEventListener('mousedown', function (e) {
        e.stopPropagation();
        e.preventDefault();
        startConnect(canvas, nodes, edges, opts, a.dataset.node, a.dataset.anchor, e);
      });
    });
  }

  function startConnect(canvas, nodes, edges, opts, fromNode, condition, e) {
    var connecting = { from: fromNode, condition: condition };
    if (opts.setConnecting) opts.setConnecting(connecting);

    var rect = canvas.getBoundingClientRect();
    var svg = canvas.querySelector('.dag-edges');
    if (!svg) return;

    var tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempPath.setAttribute('stroke', EDGE_COLOR[condition] || '#16a34a');
    tempPath.setAttribute('stroke-width', '2');
    tempPath.setAttribute('stroke-dasharray', '5 4');
    tempPath.setAttribute('fill', 'none');
    svg.appendChild(tempPath);

    var p1 = getOutPoint(nodes[fromNode], condition);
    var x1 = p1.x, y1 = p1.y;

    function onMove(ev) {
      var x2 = ev.clientX - rect.left;
      var y2 = ev.clientY - rect.top;
      var dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
      tempPath.setAttribute('d',
        'M' + x1 + ' ' + y1 + ' C' + (x1 + dx) + ' ' + y1 + ' ' + (x2 - dx) + ' ' + y2 + ' ' + x2 + ' ' + y2);
    }

    function onUp(ev) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (tempPath && tempPath.parentNode) tempPath.parentNode.removeChild(tempPath);
      if (opts.setConnecting) opts.setConnecting(null);

      var el = document.elementFromPoint(ev.clientX, ev.clientY);
      var targetEl = el && el.closest ? el.closest('.dag-node') : null;
      if (!targetEl) return;
      var toId = targetEl.dataset.node;
      if (toId === fromNode) return;

      var ok = true;
      if (opts.beforeAddEdge) ok = opts.beforeAddEdge(fromNode, toId, condition);
      if (!ok) return;

      edges.push({ from: fromNode, to: toId, condition: condition });
      renderEdgesOnly(canvas, nodes, edges, opts);
      if (opts.onEdgesChanged) opts.onEdgesChanged();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  /* ==================== 主入口 ==================== */
  function render(canvas, nodes, edges, opts) {
    opts = opts || {};
    var W = opts.width || DEFAULT_W;
    var H = opts.height || DEFAULT_H;

    canvas.innerHTML = '';
    canvas.classList.add('dag-canvas');
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    var seq = ++canvasSeq;
    var svg = createSvg(W, H, seq);
    canvas.appendChild(svg);

    var norm = normalizeEdges(edges);
    norm.forEach(function (e) { drawEdge(svg, e, nodes, opts); });

    Object.keys(nodes).forEach(function (id) {
      canvas.appendChild(buildNodeEl(id, nodes[id], opts));
    });

    if (opts.editable) bindEditable(canvas, nodes, edges, opts);
  }

  return {
    NODE_W: NODE_W,
    NODE_H: NODE_H,
    START_ID: START_ID,
    END_ID: END_ID,
    ANCHOR_Y: ANCHOR_Y,
    EDGE_COLOR: EDGE_COLOR,
    EDGE_MARKER: EDGE_MARKER,
    normalizeEdges: normalizeEdges,
    render: render
  };
})();
