# 原型图独立校验报告（第 3 轮校验员 · 原型 04）—— `原型图/**`

- 范围：`docs/cli非交互式/原型图/**`（含 `xlsx-lite.js`）；只读参照 `proposal-01-界面设计.md`、`_fix_v3_decisions.md`、`_fix_v3_F_proto.md`/`_fix_v3_F2_proto.md`。
- 角色：**独立校验员**（只读）。审计目录内**未落任何文件**；探针与脚本全部在 `%TEMP%\jcval4\`。
- 修复前基线：`git show HEAD:docs/cli非交互式/原型图/*` → `%TEMP%\jcval4\pre\`（HEAD 版本 + `xlsx-lite.js` 未跟踪文件复制，其余逐字来自 HEAD）；另建**故障注入副本** `%TEMP%\jcval4\injected\`（在当前 `job.html` 上还原 pre 语义的 `onOpSelected()` 调用，用于证明 keepValue 修复是承重的）。
- 探针：`smoke.js`（6 页冒烟）、`p_contract.js`（mock 契约 15 项）、`p_jobedit.js`（Job 编辑回填 19 项）、`p_index.js`（详情轮询/未执行 28 项）、`p_wf.js`（出参双下拉/绑定剔除 13 项）、`p_misc.js`（筛选 5 值 + 超时 16 项）、`p_new.js`（新问题取证）、`p_validate.js`（夹具自洽 15 项）、`p_dom.js`（DOM 机械 18 项）、`p_scan.js`（行尾/BOM/转义）、`p_cdn.js`（外部引用）。**全部由本人生成，未复用修复者脚本**。

## 统计

| 档位 | 数量 | 摘要 |
|-|-|-|
| 严重 | **0** | 9 项必验修复**逐项自建探针复验通过**，未发现打穿可用性/契约的缺陷 |
| 一般 | **3** | A1 OP 详情「未执行」提示条未随 Run 终态收口（非终态误标＋图标不在图标集）· A2 OP 详情状态徽标把 `waiting` 记录一律渲染「● 运行中」（非终态应为等待中、终态应为未执行）· A3 OP 详情 `[刷新]`/轮询发现变化后**不重取完整详情**（wf 详情路径会重取，行为不对称，与 §12.10 及 F2 自述不符） |
| 轻微 | **7** | m1 详情头部内联处理器 runId 未转义（含注入演示）· m2 `job.html`/`op.html` 带 UTF-8 BOM · m3 `job.html` 类型不匹配校验分支在现实现下不可达 · m4 `workflow-canvas.js` opts 契约注释漏 `nodeTitle` · m5 `index.html` 保留仅服务探针的 `detailPollCount` · m6 `op.html`/`client.html` 导入上限读 mock 全局 `SETTINGS`（与 `index.html:582` 口径相反）· m7 创建侧校验优先级未定义（类型不符先于字段缺失） |
| 需拍板 | **4** | P1 OP 详情三态口径（A1/A2）是否本轮落地 · P2 OP 详情刷新是否必须重取接口（A3 修法）· P3 导入上限取值来源统一 · P4 创建侧校验顺序 |

一句话结论：**R2（`_fix_v3_F/F2`）声明的 9 项修复全部真实存在且可用**（Job 编辑回填、CLIENT_TYPE_MISMATCH 逐字 message、终态未执行、出参双下拉、绑定剔除正向可达、筛选 5 值、详情轮询六条语义、转义、超时 1.5、无 CDN），pre/post 对照与故障注入均能复现症状；本轮**新发现 3 项一般问题**集中在「OP 执行详情页」——它是 D15/G9 三态口径与「刷新重取」口径的**唯一未覆盖面**（画布已收口，详情页未收口）。

---

## R2 修复核对表（自建探针复验，不采信对方报告）

| # | 必验项 | 结论 | 本人证据（工作区 vs 基线） |
|-|-|-|-|
| 1 | `job.html` 编辑既有 `target=op` 的 Job → Client 回填 | ✅ 落地 | `p_jobedit`：WS **19/19**；故障注入副本 **12/7 BAD**（`A2 (空)`/`A6 请选择 Client`/`B1 无 PUT`，正是 R1 报告 S2 症状）；pre(HEAD) **15/4 BAD**（无类型过滤、类型不符的既有 clientId 被保留）。代码位点 `job.html:840-842`（`onOpSelected(jobDef.target.clientId)`）+ `:908-927`（`refreshClientOptions` 的 `keepValue`/`keepValid`） |
| 2 | 类型不匹配一律 `400 CLIENT_TYPE_MISMATCH` + 通知逐字固定串（无前缀） | ✅ 落地 | `p_contract`：WS **15/15**；pre **3/12 BAD**。四端点全覆盖：`mock-data.js:1853-1855`(POST jobs)、`:2162-2164`(PUT jobs)、`:1830`(POST workflows)、`:2106`(PUT workflows)，另 `:2076`(wf execute)、`:2138`(job run)。实测 message = `Client 类型与 OP 类型不匹配：OP clean_logs 为 powershell，Client Claude Code 为 prompt`，**无「节点 X：」前缀、无「；」合并**（B3/B4 断言）；缺 clientId 仍走 `VALIDATION_ERROR`（B12） |
| 3 | 未执行标记只在终态 | ✅ 画布层落地 / ⚠️ 详情页未覆盖 | `p_index`：WS **28/28**，pre **12/16 BAD**。run-010(running)/run-011(terminating) 全节点无 `skipped`（H1/H4）；run-012(cancelled) `node_deploy`（终态 waiting）→`skipped`、无记录节点→`skipped`（H3）；run-002(failed) `node_notify`/`node_end`→`skipped`（H5）。代码位点 `index.html:1280-1305`。**但** OP 执行详情页仍误标 → 见【一般 A1/A2】 |
| 4 | 出参 `from` 双下拉 | ✅ 落地 | `p_wf`：WS **13/13**，pre **2/11 BAD**（pre 无该函数，`selects=0`）。`workflow.html:1150-1168`：行内两个 `<select>`（节点 + 出参），节点下拉文案「node_process · process_data」，`onchange="onWfOutputNodeChange"` 按所选节点重建出参下拉（A1-A5） |
| 5 | 绑定下拉剔除自身与正向可达 | ✅ 落地 | `p_wf`：构造 `S→A→B→C→E` + `C→B` 回跳环。WS：`wfPredecessorIds(B)={A,S}`（不含自身 B、不含正向可达 C，B1-B3）、`buildNodeOutputOptions(B)` 不含 `B.*`/`C.*`、含 `A.*`（B4-B6）；pre：`B5 含 ccccc….approved`、`B8 A 的下拉列出下游 B/C 出参`（旧实现仅排自身）。代码位点 `workflow.html:1619-1646`；`mock-data.js:1691-1700`（`predOf` 同判据，execute 前校验） |
| 6 | 筛选下拉 5 值措辞（分隔符 ` · `） | ✅ 落地 | `p_misc`：WS **16/16**，pre **7/9 BAD**（pre 为 `单次执行·OP`，**无两侧空格**）。WS `#triggerFilter` = `manual=>手动 / schedule=>定时 / single_op=>单次执行 · OP / single_workflow=>单次执行 · Workflow / retry=>重试`（`index.html:245`）；列表文案映射 `mock-data.js:53-59`（`retry` 已独立为「重试」） |
| 7 | Run 详情 [自动刷新] 开关与独立轮询（5 条语义） | ✅ 落地（1 处语义落差见 A3） | `p_index` 逐条实测：开关关→不轮询（B1-B3，`status 3→3`）；再开→恢复（C1/C2，`3→5`）；切走即停（D1/D2，`timer=null view=null`，`5→5`）；无 running step 不轮询/不建定时器（E1/E2，`status=0`）；与列表开关互不影响（G1/G2）；轮询仅打轻量接口且无变化不重取完整详情（A4 `status≥2`、A5 `detail=0`）。pre 无该模块（16 BAD）。代码位点 `index.html:617-690`、`:569-571`、`:269-271`、`:1383-1401` |
| 8 | `index.html:1301` 转义 | ✅ 落地 | pre 同行（当时行号 1301＝现 `:1394` 语义位）为 `title="' + (retryInfo.reason \|\| '不满足重试条件') + '"`（pre 实际在 `pre/index.html:1284`，机械定位），现 `index.html:1394` 为 `escText(retryInfo.reason \|\| '不满足重试条件')`；同新增块 `:1398` 一致。**残留同类点见 m1** |
| 9 | `op.html` 超时拒 `1.5` | ✅ 落地 | `p_misc`：WS **16/16**，pre **7/9 BAD**（pre 用 `parseInt(...)‖60` 无校验：`1.5`→1、`0`→60、`''`→60、`60abc`→60、`86401` 直接放行）。WS：`1.5`/`2.9`/`0`/`-1`/`86401`/`''`/`60abc` 全部 alert 拦截且**不发请求**（B1-B8），`60` 通过且 `payload.timeoutSeconds===60`（数字类型，B9）。代码位点 `op.html:882-883` |
| 10 | 无 CDN 引用残留 | ✅ 落地 | `p_cdn`：**外部引用命中=0**（`<script src>`/`<link href>` 全为本地文件，`p_dom` 校验磁盘存在；仅 OpenXML 命名空间 URL 与 mock 数据 `http://svc:8080` 白名单）。**pre 反证**：`pre/index.html:7` = `<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js">`，冒烟 pre = `5/6 pages clean`（该 CDN 加载失败）vs WS `6/6 pages clean` |

---

## 严重

无。

判定依据：上述 10 项必验点全部通过本人探针复验（含 5 组以上的 pre/post、故障注入对照）；6 页冒烟 0 未捕获异常；`node --check` 3 个 JS 全绿；18 项 DOM 机械检查（重复 id / 本地资源存在 / 内联处理器可解析）全绿；15 项夹具自洽（4 条 Workflow `validate.valid===true` 且 `execute` 不再被 R2 加严的拓扑校验误伤，5 个 Job 运行入口无校验错误）全绿。

---

## 一般

### A1【一般】OP 执行详情「未执行」提示条未随 Run 终态收口：非终态误标「未执行」，且图标 `◌` 不在文档图标集

- 原文（`原型图/index.html:298-300`）：
  ```
  <div class="run-note note-failed" id="opUnexecutedBar" style="display:none;margin-bottom:14px">
    ◌ 该节点未执行（本次 Run 无该节点的执行记录）
  </div>
  ```
  显示条件（`原型图/index.html:1138-1139`）：`unexecBar.style.display = opHistoryData.length ? 'none' : 'inline-flex';` —— **只看「该 step 有没有执行记录」，不看 Run 是否终态**。
- 口径：`proposal-01:1928`「**未执行 / 跳过** = **Run 结束时**该节点无 StepRecord…」＋`_fix_v3_decisions.md:14`「仅**终态** Run 的未执行节点标「⊘ 未执行」；**非终态** Run 的未执行节点保持「等待中」」；图标集见 `proposal-01:1921-1926`（`✓ ✗ ⏱ ● ✕ ⊘`，`◌` 不在其中）。
- 复现（`p_new.js` N1b/N1c/N1d，run-010=**running** 非终态，节点 `node_notify` 无记录）：
  ```
  BAD N1b … [display="inline-flex" text="◌ 该节点未执行（本次 Run 无该节点的执行记录）"]
  BAD N1d 图标在文档图标集（✓ ✗ ⏱ ● ✕ ⊘）内  [icon="◌"]
  ```
  同一断言在 pre 亦 BAD → **属历史遗留漏点，非本轮回归**，但 R2 的 D15/G9 决定只覆盖了画布，故仍应补齐。
- 建议改法：`openOpDetail` 内改用终态判定后再决定提示条文案（终态 → `⊘ 未执行`；非终态 → `◌ 等待中` 或不显示），并把图标改为文档图标集内字符：
  ```js
  var RUN_TERMINAL = { success: true, failed: true, timeout: true, cancelled: true };
  var runTerminal = !!(runData && RUN_TERMINAL[runData.status]);
  if (unexecBar) {
    unexecBar.style.display = opHistoryData.length ? 'none' : 'inline-flex';
    unexecBar.textContent = runTerminal ? '⊘ 该节点未执行（本次 Run 无该节点的执行记录）'
                                        : '◌ 该节点等待执行（Run 运行中）';
  }
  ```
  并把 `RUN_TERMINAL` 从 `openWfDetail` 内的局部常量提为模块级（现 `index.html:1280` 为函数内局部定义，详情页无法复用）。

### A2【一般】OP 执行详情状态徽标把 `waiting` 记录一律渲染「● 运行中」：非终态应为「等待中」、终态应为「未执行」

- 原文（`原型图/index.html:1115-1120`，历史记录徽标映射）：
  ```js
  var badge = h.status === 'success' ? '<span class="badge badge-success">✓ 成功</span>'
    : h.status === 'failed' ? '<span class="badge badge-failed">✗ 失败</span>'
    : h.status === 'timeout' ? '<span class="badge badge-timeout">⏱ 超时</span>'
    : '<span class="badge badge-running">● 运行中</span>';
  ```
  该 `badge` 经 `switchOpHistory` 写入 `#opInfoStatus`（`index.html:1207`）。映射缺 `waiting` 分支，且未按 Run 是否终态区分。
- 口径：`proposal-01:1926-1928`（节点状态三态；`⊘ 未执行` 用于终态无记录或 cancelled 之前的 waiting 记录）；同页画布已按此渲染（`index.html:1298/1462/1473`），**同一 Run、同一节点在画布显示 `⊘ 未执行`、在详情页显示 `● 运行中`**。
- 复现（`p_new.js` N1e / N1f）：
  ```
  BAD N1e run-012(cancelled 终态) node_deploy → status="<span class=\"badge badge-running\">● 运行中</span>"   ← 应为 ⊘ 未执行
  BAD N1f run-010(running 非终态) node_deploy → status="<span class=\"badge badge-running\">● 运行中</span>"   ← 应为 ◌ 等待中
  ```
  两断言在 pre 同样 BAD → 历史遗留，非本轮回归。
- 建议改法：在 `openOpDetail` 计算徽标时先归一化状态（与画布同口径）：
  ```js
  var st = h.status;
  var runTerminal2 = !!(runData && RUN_TERMINAL[runData.status]);
  if (st === 'waiting') st = runTerminal2 ? 'skipped' : 'waiting';
  // badge 增加：waiting → '<span class="badge badge-waiting">◌ 等待中</span>'；skipped → '<span class="badge badge-off">⊘ 未执行</span>'
  ```
  （`proposal-01` 未给 `skipped` 的徽标 CSS 类；可复用 `badge-off` 或新增 `badge-skip`，需与 A 组/UI 口径对齐 —— 见 P1。）

### A3【一般】OP 详情 `[刷新]` 与「轮询发现变化」都不重取完整详情；wf 详情路径会重取（行为不对称，与 §12.10 / F2 自述不符）

- 原文（`原型图/index.html:687-690`）：
  ```js
  function refreshDetailView(view) {
    if (view === 'op' && currentOpDetailArgs) openOpDetail.apply(null, currentOpDetailArgs);
    else if (view === 'wf' && currentWfRunId) openWfDetail(currentWfRunId);
  }
  ```
  `openWfDetail` 走 `mockFetch('/api/runs/' + runId)`（`index.html:1260`）→ 真重取；而 `openOpDetail` **完全不发请求**，直接读 mock 全局 `RUN_BY_ID`（`index.html:1068-1095`）。
- 与口径/自述冲突：`proposal-01:1913`「自动刷新打开且该 Run 有运行中 step 时按 §12.10 轮询轻量接口 `GET /api/runs/{runId}/status`」；`proposal-01` §12.10/§17.5 与 `_fix_v3_F2_proto.md:21/23`（「仅当 `status`/`updatedAtMs` 变化时才**重取完整详情** `GET /api/runs/{runId}`」「手动 `[刷新]`……同链路重取完整详情」）。
- 复现（`p_new.js` N2a/N2b；`p_index.js` F1/H2b）：
  ```
  BAD N2a 轮询发现变化后重取完整详情（OP 详情路径）  [detail GET=0]      ← 变化已注入（updatedAtMs +5000）
  OK  N2b 同一变化在 wf 详情路径会重取（对照）        [detail GET=4]
  OK  F1  OP 详情 [刷新] 不发任何数据请求（读内存快照） [detail=0]
  OK  H2b wf 详情 [刷新] 重取完整详情                  [detail=1]
  ```
- 影响：原型作为「可执行规格」，此处在真实后端下表现为**详情页看到陈旧数据**（画布节点状态与历史记录不刷新），与文档要求的刷新链路不符；也让「详情页轮询只打轻量接口」的示例失去意义（轻量接口的返回值只被用来判断「要不要刷新」，而刷新本身不取数）。
- 建议改法（二选一，见 P2）：① `openOpDetail` 改为先 `mockFetch('/api/runs/' + runId)` 取 Run 详情再渲染（与 `openWfDetail` 对称，注意保留 G8 的 `runId` 定位与 stepData 选择逻辑，并让 `showView('opDetail')` 在数据就绪后触发）；② 至少在 `refreshDetailView('op')` 前插入一次 `mockFetch('/api/runs/' + currentOpRunId)`（读到新数据刷新 `RUN_BY_ID` 缓存后再重绘），使「重取完整详情」的语义在原型中可见。

---

## 轻微

| # | 文件:行号 | 原文引用 | 问题 | 建议改法 |
|-|-|-|-|-|
| m1 | `原型图/index.html:1388 / :1393 / :1397` | `headActions.innerHTML = refreshHtml + '<button class="btn btn-danger" onclick="openTerminate(\'' + run.runId + '\')">终止</button>';` / `onclick="openRetry(\'' + run.runId + '\')"` / `onclick="openRerun(\'' + run.runId + '\')"` | 内联处理器中的字符串字面量**未转义**；同文件列表行 `:962/:967/:973` 用 `escText(r.runId)`，`mock-data.js:67` 约定「确需写成内联处理器的字符串字面量用 `escJsStr()`」（定义 `mock-data.js:80`），自相矛盾。注入演示（`p_new` N3a）：把 Run 的 `runId` 换成 `x')-window.__INJ=1-('` 后实际产出 `onclick="openRetry('x')-window.__INJ=1-('')"`，字符串被截断 | 与列表行一致：`escJsStr(run.runId)`（runId 由后端生成，当前无注入面，属防御性一致性） |
| m2 | `原型图/job.html:1`、`原型图/op.html:1` | 文件首字节 `EF BB BF` | 两者带 UTF-8 BOM；其余 6 文件无 BOM（pre 同状态 → 非本轮引入）。BOM 位于 `<!DOCTYPE html>` 之前，虽现代浏览器容忍，但页面间不一致，易在 diff/工具链产生噪声 | 统一去掉 BOM（`git diff` 会显示为整文件改写，建议单独一个提交） |
| m3 | `原型图/job.html:1062-1067` | `if (selOp && selCl && selOp.type !== selCl.type) { return 'Client 类型与 OP 类型不匹配：…'; }` | 该分支在现实现下**不可达**：`clientSelect` 选项已按 OP 类型过滤（`:908-917`），且不匹配值会被丢弃（`:913-914`），实测（`p_jobedit` C1）不匹配的 clientId 无法留在下拉里 | 保留亦无害，但建议加注释说明「UI 已过滤，此处为双保险」，避免后续维护者误判为活路径 |
| m4 | `原型图/workflow-canvas.js:13-26` | `opts: { width, height, editable, onNodeClick, nodeMeta, nodeStatus, edgeDashed, selectedId, beforeAddEdge, onEdgesChanged, onEdgeContextMenu, connectingNow, setConnecting }` | 新增并被实际消费的 `nodeTitle`（`:166` `var title = opts.nodeTitle ? opts.nodeTitle(id, n) : null;`，调用方 `index.html:1482-1486`）未登记进契约注释 | 在 opts 列表中补一行 `nodeTitle(id, node) -> string \| null,  // 节点标题覆盖（运行态展示 OP 名称）` |
| m5 | `原型图/index.html:627` | `var detailPollCount = 0;      // 已发起的轮询次数（供冒烟探针观测；真实前端无需该计数）` | 生产页面保留仅服务探针的计数器（自述「真实前端无需」） | 删除，或改为 `if (window.__PROTO_PROBE__) detailPollCount++;` 形式 |
| m6 | `原型图/op.html:1111`、`原型图/client.html:883` 对 `原型图/index.html:582-583` | `var opCfgMax = (typeof SETTINGS !== 'undefined' && SETTINGS.op && SETTINGS.op.op_import_max_bytes) \|\| '1048576';`；`index.html:583`：`// 页面不持有也不读取 mock 全局 SETTINGS（真实后端下该全局不存在，原兜底分支会成为 ReferenceError 隐患）` | 三个页面口径相反：`index.html` 明确禁止读 mock 全局，`op.html`/`client.html` 仍读它取导入上限 → 真实后端下恒退化为常量 1 MiB，与 `crud-06` 配置项脱钩（本轮把默认值由 100 MiB 改为 1 MiB，是改善，但取值来源仍不一致） | 与 index 对齐：页面启动时 `mockFetch('/api/settings')` 缓存到页面局部变量（如 `CFG_IMPORT_MAX`），导入上限从该缓存取（见 P3） |
| m7 | `原型图/mock-data.js:1853-1857`（POST jobs）、`:2162-2165`（PUT jobs） | `if (body && body.target && body.target.kind === 'op') { … if (newJobMm) return resolve(__err('CLIENT_TYPE_MISMATCH', newJobMm)); } if (newJobErrs.length) return resolve(__err('VALIDATION_ERROR', …));` | 类型不符**先于** name/target/trigger/workspace 缺失返回：`POST` 一个 name 为空且类型不符的请求会得到 `CLIENT_TYPE_MISMATCH` 而非 `VALIDATION_ERROR`。`crud-04` 3.4.3/3.4.4 未定义创建侧校验顺序（D12 只覆盖 3.4.6 运行入口与导入侧） | 二选一后同步文档：把顺序写成显式列表（如「字段缺失 → 名称冲突 → 类型不符」），或在 `crud-04 3.4.3/3.4.4` 补一句「类型不符优先返回」（见 P4）。前端 `job.html:1054-1076` 已先校验字段，故当前 UI 不可观测 |

---

## 需拍板

1. **P1（对应 A1/A2）OP 执行详情的三态口径是否本轮落地？** 画布已按 D15/G9 收口（`index.html:1280-1305/1462/1473`），但 OP 详情页（提示条 `:298-300`、历史徽标 `:1115-1120`）仍是旧口径，同一节点同屏两种结论。若本轮不落地，应至少在 `proposal-01 §12.5` 或 `_fix_v3_decisions.md` 记一条**已知偏差**，否则「未执行只在终态」的验收会被详情页证伪。附带口径问题：`skipped` 在详情的徽标样式用哪个（`badge-off` / 新增 `badge-skip`）需 A 组确认。
2. **P2（对应 A3）OP 详情的 `[刷新]` 是否必须重取完整详情？** 若必须，`openOpDetail` 需改为异步取数（与 `openWfDetail` 对称），会牵动 G8 的 `runId` 定位、执行历史默认选中项、`currentOpDetailArgs` 重绘入参；若接受读内存快照，则应把 `proposal-01 §12.10`/`§17.5` 与 `_fix_v3_F2_proto` 的「重取完整详情」表述限定为「wf 详情路径」。
3. **P3（对应 m6）导入体积上限的取值来源统一。** 建议全站统一走 `GET /api/settings`（`index.html` 口径），并把 `crud-06 3.3` 的键名/默认值在 §10 附录里点明「页面不得直读 mock 全局」。
4. **P4（对应 m7）创建侧校验顺序。** 是否把「类型不符优先」写成 `crud-04 3.4.3/3.4.4` 的显式列表（与 3.4.6/导入侧同体例）；若要改实现为「字段缺失优先」，需同步改 `mock-data.js` 两处并重跑 `p_contract`。

---

## 修复顺序建议（含证据）

1. **A2 + A1（同一处改造，小改动、用户可见）**：`openOpDetail` 内引入终态判定与状态归一化；改动点 `index.html:1115-1120`、`:1138-1139`，并把 `RUN_TERMINAL` 提为模块级。验证：`p_new` N1b/N1c/N1d/N1e/N1f 六项由 BAD 转 OK，且 `p_index` H1/H3/H4/H5（画布三态）保持全绿。
2. **A3（待 P2 拍板）**：按拍板结果把 `openOpDetail` 改为取数（或补一次 `mockFetch`）。验证：`p_new` N2a 转 OK，`p_index` F1/H2b 语义一致（op/wf 对称）。
3. **m1 + m4 + m5（纯文本/一行改动，零风险，可随手带）**：`escJsStr(run.runId)` ×3、`workflow-canvas.js` opts 补 `nodeTitle`、删 `detailPollCount`。验证：`p_dom` 18 项保持全绿 + `p_scan` 的「SUSPECT」由 2 降到 0（现 2 处中 1 处为 false positive：`retryBtn` 为已转义预构造字符串）。
4. **m2（BOM）**：单独提交去 BOM，避免与逻辑改动混在同一 diff。
5. **m6 / m7 / P3 / P4（口径类）**：文档先行（`crud-04 3.4.3/3.4.4`、`crud-06 3.3`、`proposal-01 §12.5/§12.10`），再改 `op.html:1111`、`client.html:883` 与 `mock-data.js` 两处顺序，最后重跑 `p_contract`（15 项）与 `p_validate`（15 项）防回归。
6. **回归门禁（建议固化为本项目原型侧的验收脚本）**：`node --check` ×3 + 6 页 jsdom 冒烟 0 异常 + `p_contract`/`p_index`/`p_wf`/`p_misc`/`p_jobedit` 五个探针全绿 + `p_validate` 夹具自洽 + `p_cdn` 命中 0。当前工作区状态：**全部满足**。

### 附：本轮自测证据（原始输出）

**1) 语法检查**（工作区）
```
node --check mock-data.js   → OK
node --check workflow-canvas.js → OK
node --check xlsx-lite.js   → OK
```

**2) 6 页 jsdom 冒烟（采集 window.error + unhandledrejection + jsdomError，忽略 window.scrollTo 噪声）**
```
WS : SUMMARY: 6/6 pages clean (errors=0)
PRE: FAIL index.html [jsdomError] Could not load script: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"
     SUMMARY: 5/6 pages clean (errors=1)
```

**3) 探针总表（工作区 / 修复前 HEAD / 故障注入副本）**
```
p_contract (mock 契约 15)      WS 15/0   PRE 3/12
p_jobedit  (Job 编辑回填 19)   WS 19/0   INJECTED 12/7   PRE 15/4
p_index    (详情轮询/未执行 28) WS 28/0   PRE 12/16
p_wf       (出参双下拉/绑定 13) WS 13/0   PRE 2/11
p_misc     (筛选 5 值/超时 16)  WS 16/0   PRE 7/9
p_new      (新问题取证 10)      WS 4/6    PRE 1/5（N1 系列同 BAD → 历史遗留；PRE 无轮询 API，N2 处 THROW）
p_validate (夹具自洽 15)        WS 15/0
p_dom      (DOM 机械 18)        WS 18/0
p_cdn      (外部引用)           WS 命中 0（PRE index.html:7 为 jsdelivr SheetJS）
```
负向对照共 **6 组**（≥5 要求）：`p_contract`、`p_jobedit`、`p_index`、`p_wf`、`p_misc` 的 pre/post 对照 + `p_jobedit` 的**故障注入**对照（证明 `keepValue` 修复是承重的：注入后 A2/A3/A6/A7/B1/B2/C2 七项复现 R1 的 S2 症状）。

**4) 转义扫描（机械）**：`git diff` 新增行中「含 HTML 拼接」者 **22 行**逐行核对 → 21 行数据均经 `escText`/`escapeAttr` 包装（`sel.innerHTML` 的 option、`title=`、`value="` 等），**1 类例外** = m1（`index.html:1388/1393/1397` 的 `run.runId`）。另 `p_scan.js` 报 SUSPECT 2 条：其中 `retryBtn` 一条为误报（预构造已转义字符串）。pre/post 转义点对照：`pre/index.html:1284`（未转义 `retryInfo.reason`）→ 现 `index.html:1394`（`escText`）。

**5) 行尾 / BOM（工作区）**
```
client.html          CRLF=968  bare_LF=0  BOM=false
index.html           CRLF=1614 bare_LF=0  BOM=false
job.html             CRLF=1247 bare_LF=0  BOM=true    ← m2（pre 亦 true）
mock-data.js         CRLF=0    bare_LF=2288 BOM=false   （js=LF，符合要求）
op.html              CRLF=1146 bare_LF=0  BOM=true    ← m2（pre 亦 true）
settings.html        CRLF=321  bare_LF=0  BOM=false
workflow-canvas.css  CRLF=65   bare_LF=0  BOM=false
workflow-canvas.js   CRLF=0    bare_LF=339 BOM=false    （js=LF）
workflow.html        CRLF=2188 bare_LF=0  BOM=false
xlsx-lite.js         CRLF=0    bare_LF=222 BOM=false    （js=LF）
```
结论：**html/css 全 CRLF、js 全 LF，符合约定**；唯 `job.html`/`op.html` 带 BOM（pre 已有，非本轮引入）。

**6) 其他机械核对**：DOM 18 项（6 页 ID 唯一、`<script src>`/`<link href>` 本地文件均存在、静态内联处理器 100% 有对应函数，含新增 `manualRefreshDetail`/`toggleDetailAutoRefresh` 已定义）；`WF_LOOP_EDGE_CONDITION`/`__findWfCycle` 删除后**无残留引用**（扫描 0 命中）；`retryFromStepId` → `retryFromRecordId`（D17）在全部 12 条 Run 中已改净。
