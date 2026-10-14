# 原型组修复报告（第 3 轮 · 续作 F）

- 角色：修复者（**续作**，接手因 API 错误中断的上一批修复员）。工作目录 `docs/cli非交互式/`，**只改 `原型图/**`**。
- 口径：`_fix_v3_decisions.md`（唯一权威）+ `_val3_04_proto.md`（S1–S3 / M1–M6 / m1–m9 / P1–P6）+ `_val3_01_ui.md`（原型侧 S2、G1–G4、L1/L2 等）。
- 方法：先 grep + jsdom 探针审计现状（判定「前序续跑已落地 / 未落地」），再补齐未落地项，全部以**正/负对照**复现。
- 探针与脚本：`%TEMP%\jcv3_f\`（`smoke.js` / `probe.js` / `escan.js` / `eol.js`；负向快照 `pre2/` = `git show HEAD` 导出的修复前整目录）。

## 审计结果

接手时前序续跑**已完成绝大多数项**（mock-data.js 已见 `CLIENT_TYPE_MISMATCH`、结构化 `__wfNodeClientErrs`、execute 前拓扑校验、导入上限 400、`predOf` 正向可达剔除；index.html 已见 `RUN_TERMINAL`、`edgeDashed`、图例 8 项、`§12.10`、`escText`；workflow.html 已见 `wfPredecessorIds` 正向剔除、出参双下拉）。逐项审计后**仅 4 项未落地**，均已由本轮补齐。

| 项目 | 审计结论 | 位置 |
|-|-|-|
| 一.4 job.html 回归 | ✅ 已落地（前序续跑） | `job.html:842` `onOpSelected((jobDef.target.clientId)||'')` |
| 一.5 CLIENT_TYPE_MISMATCH ×4 + 逐字 message | ✅ 已落地 | `mock-data.js:1784/1855/2030/2060/2138/2164`（`__clientTypeMismatch` 无前缀，`missing`/`mismatch` 分流） |
| 一.6 未执行仅终态 + cancelled waiting 归未执行 | ✅ 已落地 | `index.html:1197-1222` |
| 一.11 §18.2→§12.10 | ✅ 已落地 | `index.html:577` |
| 一.12 未转义 title | ✅ 已落地 | `index.html:1310` `escText(retryInfo.reason…)` |
| 二.1 出参 `from` 双下拉 | ✅ 已落地 | `workflow.html:1155`/`2019-2022` |
| 二.2 mock 同构（execute 拓扑 400、导入上限 400） | ✅ 已落地 | `mock-data.js:2077/2140`（execute）、`1834-1897`（导入） |
| 二.3 index.html 筛选措辞（` · `） | ✅ 已落地 | `index.html:245` |
| 二.6 绑定下拉剔除自身+正向可达 | ✅ 已落地 | `workflow.html:1617-1645`、`mock-data.js:1683-1689` |
| M1 孤岛出参过滤 | ✅ 已落地 | `wfPredecessorIds` ∩ 从 Start 可达 |
| M2 环路下游非前置 | ✅ 已落地 | `wfPredecessorIds` − 正向可达 |
| M3 未执行边虚线 | ✅ 已落地 | `index.html:1403-1406` |
| M4 D16 标签 | ✅ 已落地 | `index.html:245` |
| M5 L1 §18.2 | ✅ 已落地（=一.11） | `index.html:577` |
| **M6 超时 1.5 静默截断** | ❌ **未落地 → 本轮修** | `op.html:882` |
| m1 End 死代码 | ✅ 已落地 | `index.html:1386-1390` |
| m2 title 转义 | ✅ 已落地 | `index.html:1310` |
| m3 client_type 注 | ✅ 已落地 | `workflow.html:1786` |
| **m4 cancelled 夹具** | ❌ **未落地 → 本轮修**（决策二.16 / P6） | `mock-data.js` RUNS |
| **m5 job.html 静态导出树顺序** | ❌ **未落地 → 本轮修** | `job.html:484-491` |
| **m6 Client `createdAtMs` 判别力** | ❌ **未落地 → 本轮修** | `mock-data.js:135` |
| m7 前端节点标识 | ✅ 已落地 | `workflow.html:1996` |
| m8 ops 树硬编码 | ✅ 已落地 | `workflow.html:2064-2081` |
| m9 导入服务端上限/超范围 | ✅ 已落地 | `mock-data.js:1834-1897` |
| L1/L2 画布图例（8 项含未执行/已取消） | ✅ 已落地 | `index.html:419-426` |

## 已修项（本轮本人改动）

| # | 文件:位置 | 改动 | 依据 |
|-|-|-|-|
| F1 | `op.html:882-883` | 超时校验由 `parseInt` 改为 `Number` + `Number.isInteger` + 空串判定；`1.5`/`2.9` 不再被截断为整数 | _val3_04 M6（`proposal-01:600`：0/负数/**非整数** → 400） |
| F2 | `job.html:484-491` | 静态导出树占位由 `manifest.json → job.yaml` 改为 `job.yaml → manifest.json`（与 `job.html:1122` JS 生成序、L10 一致） | _val3_04 m5 / L10 |
| F3 | `mock-data.js:135-136` | Codex CLI `createdAtMs/updatedAtMs` 由与其他 Client 相同的 `1728000000` 改为更晚的 `1728106000000`，使 D3「取匹配类型中 `createdAtMs` 最早者」在夹具上可判定（prompt 类型：Claude Code 更早 → 仍默认选中，行为不变） | _val3_04 m6 |
| F4 | `mock-data.js` RUNS 新增 `run-012` | 补终态 `cancelled` 最小夹具（`deploy_workflow`：check=success / review=cancelled / deploy=waiting / notify 无记录），使 一.6 与 D15/G9 三态自动化可演示；`RUN_START_AGO_MS` 增 `run-012:5h`（早于 run-011，**不改各 Job 最新 Run 关系**） | _val3_04 m4 / P6 / 决策二.16 |
| F5 | 全 `原型图/**` 行尾 | 归一：`mock-data.js`/`workflow-canvas.js`/`xlsx-lite.js`=**LF**；`*.html`/`*.css`=**CRLF**（修正 `workflow.html`/`settings.html`/`workflow-canvas.css` 的 LF 与 `job.html` 的 3 处游离 LF；未改 BOM：`job.html`/`op.html` 原即有 BOM，维持） | 任务步骤 5 |

> 说明：F1–F4 为唯一「内容新增」；F5 为机械行尾归一（不产生内容 diff，`git diff --stat` 前后一致）。

## 未落地与原因

| 项目 | 来源 | 原因 |
|-|-|-|
| G3 / G10：Run 详情页 `[刷新]/[自动刷新]` + 独立轮询 `/api/runs/{runId}/status` | `_val3_01_ui.md` 一般 G3 | 属 `_val3_01_ui` 的「一般」项，**未进入 `_fix_v3_decisions.md` 一/二任何条款**，且明确标注为「A 组列为原型侧、F 组清单未含」的两组间漏项。按 decisions 规则 5（自创口径需暂停），本轮**未自创实现**；现仅列表页有刷新控件（`index.html:233-234`）。**建议协调者补拍板后再做**。 |
| 其余 `_val3_04_proto.md` P2–P6 的**文档侧**同步（p01 §10.14 补 `from` 校验行、crud-03 规则 8 删除等） | _val3_04 P2/P3 | 出界：只改 `原型图/**`，文档由 A/C/global 组负责；原型侧对应物（m3 注释、from 双下拉、mock 同构）已落地。 |

## 自检证据

**1) 语法检查**（全部 OK）
```
node --check mock-data.js && node --check workflow-canvas.js && node --check xlsx-lite.js   → JS_CHECK_OK
```

**2) 6 页 jsdom 冒烟（0 未捕获异常；忽略 scrollTo 噪声）**
```
PASS index.html / client.html / op.html / workflow.html / job.html / settings.html
SUMMARY: 6/6 pages clean
```

**3) 正/负对照探针 `probe.js`（工作区=修复后，pre2=HEAD 修复前），25 项断言**
```
工作区 : RESULT: pass=25 fail=0
pre2   : RESULT: pass=8  fail=14
```
关键负向对照（pre2 复现原症状，工作区已消解）：
- **一.4 Job 编辑回填**：`A6 负向：旧调用顺序会清空 Client`（复现「占位下拉下赋值无效 + onOpSelected 无 keepValue」）→ 工作区 A1–A5 全部回填成功且 `validateJobForm()===''`；pre2 该场景为原始症状。
- **一.5 CLIENT_TYPE_MISMATCH**：工作区 B1–B8 全绿（4 端点 `code==='CLIENT_TYPE_MISMATCH'`，message 逐字 `Client 类型与 OP 类型不匹配：OP health_check 为 bash，Client Claude Code 为 prompt`、**无「节点 X：」前缀**）；pre2 B1–B8 全 BAD（HEAD 不校验，`undefined`）。
- **一.6 未执行标记**：工作区 `C1 run-010(running) 无 skipped` / `C2 run-002(failed) 含 skipped` / `C4 run-012(cancelled) deploy 终态 waiting→skipped` / `C5 review=cancelled→已取消` / `C6 notify 无记录→skipped`；pre2 C2/C4/C5/C6 BAD（非终态误判、无 cancelled 态）。
- **D4 前置过滤**：工作区 `D1 孤岛 X 不在 B 前置集` / `D2 环路下游 C 不在 B 前置集` / `D3 无环图 A 在 B 前置集`；pre2 `D1/D2/D3` BAD（`wfPredecessorIds is not a function`，HEAD 无该函数）。
- **M6 超时**：工作区 `E1 1.5→拒绝`（alert「超时必须为 1..86400 之间的整数」）/ `E2 60→不报错`；pre2 E1 BAD（`1.5` 被接受）。
- **m4 夹具**：工作区 `C3 run-012 cancelled 存在`；pre2 无 run-012。

**4) 转义机械扫描**（`escan.js`，扫本轮 `git diff` 新增 300 行中的字符串拼接）
```
interp-ish lines: 19  → 全部为「escText 包裹的 innerHTML option」「textContent」「alert/error 消息串」「静态导出树常量」
结论：新增拼接无未转义插值（无未转义 title/value/innerHTML 插值）
```

**5) 行尾/编码核验**（`eol.js` 归一后复测）
```
mock-data.js LF=2286 CRLF=0 | workflow-canvas.js LF=339 | xlsx-lite.js LF=222
index.html CRLF=1530 | job.html CRLF=1247 | op.html CRLF=1146 | workflow.html CRLF=2188
client.html CRLF=968 | settings.html CRLF=321 | workflow-canvas.css CRLF=65
BOM：job.html/op.html 原即 true（HEAD 同），其余 false
```

**6) 审计 grep 证据**：`CLIENT_TYPE_MISMATCH` 命中 11 处（`mock-data.js`）；`index.html` 无 `18.2`；`retryInfo.reason` 两处均 `escText`；`RUN_TERMINAL`/`edgeDashed` 逻辑在位；`wfPredecessorIds` 去除正向可达与自身。

（脚本与产物均在 `%TEMP%\jcv3_f\`，未在仓库内落任何临时文件；本报告新增于 `docs/cli非交互式/`。）
