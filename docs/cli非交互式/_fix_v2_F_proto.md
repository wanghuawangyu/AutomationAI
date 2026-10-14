# 原型图修复报告（组 F · 原型）

- 角色：修复者（组 F）。**仅修改** `docs/cli非交互式/原型图/` 下的 `*.html` / `*.js` / `*.css`；未改任何其它文件。
- 权威口径：`_fix_v2_decisions.md`（严格遵守；按其自述本应追加「## 落地情况」，但本轮用户指令明确**不得写入该文件**，故落地表并入本报告）。
- 依据报告：`_val2_01_ui.md`（S2/S3/S4、G1/G2/G5/G6/G8/G11/G12/G14/G16/G17/G18/G19/G20、L1–L12）、`_val2_04_global.md`（L-9/L-10）、`_val2_05_new.md`。
- 日期：2026-10-14。

## 行尾说明（重要）

各文件**原有行尾**实测（非提示词所述）：`mock-data.js` / `workflow-canvas.js` / `workflow.html` / `settings.html` / `workflow-canvas.css` 为 **LF**；`index.html` / `job.html` / `op.html` / `client.html` 为 **CRLF**。本轮**逐文件保持其原有行尾**（新增行沿用该文件既有风格，编辑后统一校正无混杂；未做整文件换行符转换）。新增 `xlsx-lite.js` 用 LF。

## 已修项表

| 项 | 文件:行 | 改法 | 证据 |
|-|-|-|-|
| **D3 / S2** | `workflow.html:1457` | Client 下拉占位删除「回退 Job.target.clientId」→「— 未指定（创建时默认选中类型匹配的 Client）—」；Client 标签加必填 `*` | grep 旧措辞 0 残留；pos 探针 `createNode` 默认 client = Claude Code |
| **D3 必填** | `workflow.html`(createNode/firstNodeClientError)、`mock-data.js` `__wfNodeClientErrs` | 拖拽创建默认选中该 OP 类型 `createdAtMs` 最早的匹配 Client；保存前校验未选 → `OP 节点必须指定 Client`；`POST/PUT /api/workflows` 校验节点 clientId 非空 | pos：`firstNodeClientError_missing="OP 节点必须指定 Client"`；`POST /api/workflows` 缺 client → 400 |
| **D4 / S3** | `workflow.html:1304` | 拖拽创建节点入参绑定置 `{kind:'unbound'}`（不再用空 literal）；面板新增「未绑定」单选 | pos：`createNode_binding_kind="unbound"`；neg(修复前)="literal" |
| **D4 下拉** | `workflow.html` `buildNodeOutputOptions`/`wfPredecessorIds` | 出参下拉**只列**「从 Start 可达且在当前节点之前」的节点出参（按反向可达=前置集计算，非仅排除自身） | pos：`node_check` 下拉 1 项（仅占位）；neg：6 项（含全部下游） |
| **D4 校验** | `mock-data.js` `validateWorkflowOf` | required 来源判据：不存在 / `unbound` / 空 literal → 无来源；新增「绑定必须指向前置节点」规则 | pos：`unbound`/空 literal → `没有来源`；下游绑定 → `绑定了非前置节点 C 的出参`；neg 三项均「无错误」 |
| **D5 / S4** | `workflow.html` `clientsForOpType`；`job.html` `refreshClientOptions`/`clientsForOpType` | 节点面板与 Job 编辑器 Client 下拉**按 OP 类型过滤**；空下拉提示 `请先在 Client 管理中创建 {type} 类型的 Client` | pos：`validate_type_mismatch` 报错；`POST /api/jobs` 类型不符 400；neg 均「无错误」 |
| **D5 mock** | `mock-data.js` `__clientTypeMismatch` + POST/PUT jobs/workflows | 后端口径：类型不一致 → 400 `VALIDATION_ERROR`，message `Client 类型与 OP 类型不匹配：OP x 为 a，Client y 为 b` | pos：jobs/workflows validate 均返回该 message |
| **D5 数据** | `mock-data.js:366/470` 及 Run 快照 662/700/855/935 | 修正示例夹具的 Client↔OP 类型不匹配（deploy→prompt、health_check→bash，快照同步） | 全 4 个 WORKFLOWS `validateWorkflowOf().valid===true` |
| **D15 / G1** | `index.html:881/1296` | cancelled Run 保持 [重试]（与 can-retry 一致）；终止确认弹窗文案由「不支持重试」改为「若终止前有失败/超时 step 则可 [重试]」 | pos：cancelled 行含 [重试] |
| **G2** | `index.html:881-891/1296-1305` | 成功 Run **不再渲染** [重试]，仅 [重跑]（失败/超时/取消 → [重试]+[重跑]） | pos：success `has_retry=false, has_rerun=true`；neg(修复前) `has_retry=true` |
| **D7 / G9** | `index.html:1198/1209/1362`、`workflow-canvas.css:53/64` | 三态分离：新增 `cancelled:{st-cancelled,'✕ 已取消'}`、`skipped:{st-skip,'⊘ 未执行'}`；未匹配 OP 节点与未到达 End 由 `waiting`→`skipped`；补 CSS 类 | 代码点检 + 6 页冒烟 0 异常 |
| **D16 / G7** | `index.html:243` | 触发筛选 5 值（manual/schedule/single_op/single_workflow/retry）并统一标签为 §12.4 映射（持久 Job · 手动 / 定时、单次执行 · OP/Workflow、重试） | pos：`D16_trigger_options=",manual,schedule,single_op,single_workflow,retry"`；single_op 过滤命中 1 |
| **D8 / S-1 / L-10** | `mock-data.js:1487-` | 删除 `WF_LOOP_EDGE_CONDITION`、`__findWfCycle` 与「DAG 无环」规则；校验不拒绝环；回跳示例边注明「失败分支（普通条件边，非回跳边）；回跳边统一用 always（§15.3）」 | scan：`WF_LOOP_EDGE_CONDITION`/`__findWfCycle` 0 残留 |
| **G14** | `mock-data.js`/`workflow.html` | 删除第 11 条「多入边节点必须有明确汇聚」（与 required 来源同判据，避免重复报错） | 规则表已无该条 |
| **G6 / 低成本1** | `op.html:249/698/880-883/887` | `timeoutSeconds` 新建预填 60（编辑器默认模板值 300→60），保存前校验整数 1..86400，`|| 60` 静默兜底改为显式 `toSec` | node --check 通过；保存分支点检 |
| **G16** | `op.html:1101-1103`、`client.html:882-891` | 导入大小上限改读**配置项**（`SETTINGS.op.op_import_max_bytes` / `client.client_import_max_bytes`，默认 1 MiB），不再用 `SETTING_LIMITS` 硬上限；Client 导入补同一校验 | 代码点检；`SETTING_LIMITS` 仅余 PUT 校验用途 |
| **G17** | `mock-data.js:293`、`op.html:280/823` | 脚本类示例改环境变量注入 `curl -sf "$AI_ENDPOINT/health"`；占位符提示改为「支持 `{{name}}` 引用入参、`{{workspace}}` 引用工作区（§8.4）」 | scan 无旧提示残留 |
| **G18** | 同 D8/G14 | 校验文案与规则对齐（多个 Start/End、悬挂边、引用的 OP 不存在均在；移除环文案） | `workflow.html` `wfErrRuleKey` 同步 |
| **G19** | `client.html:519/523` | 行内展开首行 = 类型+格式+描述同一行；删独立 `outputMode` 行（jsonPath 单列） | 代码点检 |
| **G20** | 原型已用 `(a{n}/r{n})` | 保持（文档侧问题） | — |
| **L1** | `index.html:573` | 注释 `§18.2` → `§12.10` | scan 无 `§18.2` |
| **L2** | `mock-data.js:500` | 注释 `§10.3` → `§11.2 / §13.2` | 代码点检 |
| **L5** | `index.html:248` + `renderVersionOptions()` | 版本筛选由硬编码 1/2/3 改为按当前 Run 集合动态生成 | 代码点检 |
| **L10** | `workflow.html:2019`、`job.html:1095` | 导出 ZIP 树顺序改为 `workflow.yaml`→`manifest.json`→`ops/`、`job.yaml`→`manifest.json` | 代码点检 |
| **L11** | `mock-data.js:52` | `TRIGGER_TEXT.retry` 由「持久 Job / 重试」→「重试」（virtual Run 重试不再被错标） | 代码点检 |
| **D17** | `mock-data.js`(14 处 + `__spawnRun`) | 字段 `retryFromStepId` → `retryFromRecordId`，取值改 `failedStep.recordId`（溯源 StepRecord 主键） | scan：`retryFromStepId` 0 残留 |
| **L-9** | `index.html:7/12/15-18/233/701-703` + 新增 `xlsx-lite.js` | 「全部导出」改**本地内置** xlsx 写入器 `xlsx-lite.js`，移除 CDN `<script>`；guard/提示文案改为本地库口径；mock 导出分支注释同步 | 本地生成 .xlsx 经 `tar` 解包校验（见证据） |

## 未修项与原因

| 项 | 原因 |
|-|-|
| `_fix_v2_decisions.md` 末尾追加「## 落地情况」 | 用户指令明确「不要写入该文件」；内容并入本报告，**未改动**该文件（见上文） |
| `proposal-01` / `crud-0x` / `tasks.md` / `tests` 等文档侧条目（D1/D2 文档、D6/D9–D14、G3/G4/G5/G8/G11/G12/G13/G15、L3/L4/L6/L7/L8/L9/L12、S-1/S-2 文档侧、L-10 文档侧等） | 均**不在**「原型图/」允许修改范围；原型侧对应的可落地部分已修（D2：`workflow.html` 保存不再要求拓扑校验通过，仅做 D3/D5 字段级校验；执行前仍校验，符合后端在创建 Run 前校验的口径） |
| `settings.html` 的 🔄 徽标（UI L9） | 未被本轮指令列出，且属文档口径项；未改 |
| `xlsx-lite.js` 为最小实现 | 仅覆盖导出所需 API 子集（book_new/aoa_to_sheet/book_append_sheet/write）；不实现读取/样式/公式（原型不需要） |

## 自测证据

### 1) 语法检查（改动/新增的 `.js`）

```
> node --check mock-data.js && node --check xlsx-lite.js && node --check workflow-canvas.js
JS_CHECK_OK
```

### 2) jsdom 冒烟 6 页（脚本在 %TEMP%，不在项目目录）

脚本：`%TEMP%\jc_proto_smoke\smoke.js`（jsdom，`runScripts:'dangerously'` + `resources:'usable'`，采集 window.error / unhandledrejection / jsdomError，等待 900ms）。

```
PASS  index.html
PASS  client.html
PASS  op.html
PASS  workflow.html
PASS  job.html
PASS  settings.html
SUMMARY: 6/6 pages clean
```

### 3) D3/D4/D5/D15/D16 正向 + 负向对照

- 探针：`%TEMP%\jc_proto_smoke\probe.js`（同一脚本跑两遍）。
- 负向 = 用 `git archive HEAD` 导出**修复前**整目录到 `%TEMP%\pre\...` 后复现原症状（D16 额外用 merge 变体合成旧「单次执行」合并粒度）。

**正向（修复后 `原型图/`）**

```
D3_POST_workflow_missing_client_error = "name 不可为空；OP 节点必须指定 Client（节点 n1）"
D5_POST_job_type_mismatch_error = "Client 类型与 OP 类型不匹配：OP clean_logs 为 powershell，Client Claude Code 为 prompt"
D5_validate_type_mismatch = "节点 n1：Client 类型与 OP 类型不匹配：OP clean_logs 为 powershell，Client Claude Code 为 prompt"
D4_validate_unbound_required = "节点 n1 的 required 入参 test_cmd 没有来源"
D4_validate_empty_literal = "节点 n1 的 required 入参 test_cmd 没有来源"
D4_validate_non_predecessor = "节点 B 的入参 test_result 绑定了非前置节点 C 的出参"
D3_createNode_default_client = "a1b2c3d4e5f60718293a4b5c6d7e8f90"     # Claude Code（prompt，createdAtMs 最早）
D4_createNode_binding_kind = "unbound"
D3_firstNodeClientError_ok = ""
D3_firstNodeClientError_missing = "OP 节点必须指定 Client"
D4_predOf_notify = "node_check,node_deploy,node_review,node_start"
D4_opts_notify_has_downstream_fail = false
D4_opts_check_has_any_pred = 1                                          # 仅占位（Start 无出参）
D16_trigger_options = ",manual,schedule,single_op,single_workflow,retry"
D15_success_row_has_retry = false
D15_success_row_has_rerun = true
D15_cancelled_row_has_retry = true
D16_single_op_filter_matches = 1
```

**负向（修复前，复现原症状）**

```
D3_POST_workflow_missing_client_error = "name 不可为空"     # 不再有 client 必填错误 → 可保存
D5_POST_job_type_mismatch_error = ""                        # 类型不匹配不报错
D5_validate_type_mismatch = ""                              # 校验不查类型
D4_validate_unbound_required = ""                           # unbound/空 literal 视作有来源
D4_validate_empty_literal = ""
D4_validate_non_predecessor = ""                            # 无「指向前置节点」规则
D3_createNode_default_client = null                         # 不默认选中
D4_createNode_binding_kind = "literal"                      # 用空字面量
D3_firstNodeClientError_* = "<no-such-fn>"
D4_predOf_notify = "<no-such-fn>"
D4_opts_check_has_any_pred = 6                              # 下拉含全部节点出参（不仅前置）
D15_success_row_has_retry = true                            # 成功 Run 也渲染 [重试]（G2 症状）
D16（merge 合成）= D16_trigger_options ",single"；D16_single_op_filter_matches = 0   # 合并粒度筛不出 single_op
```

### 4) 示例夹具自洽（新校验规则下）

```
> 对 mock 的 4 个 WORKFLOWS 调 validateWorkflowOf():
deploy_workflow valid=true
log_analysis    valid=true
code_review     valid=true
hourly_check    valid=true
```

### 5) 本地 xlsx 写入器有效性（L-9）

生成 .xlsx → 写临时文件 → `tar -tf` / `tar -xf` 解包（bsdtar 校验 CRC）→ 检查 XML：

```
[Content_Types].xml  _rels/.rels  xl/workbook.xml  xl/_rels/workbook.xml.rels
xl/worksheets/sheet1.xml  xl/worksheets/sheet2.xml
sheet1.xml: <sheetData>…<c r="A1" t="inlineStr"><is><t xml:space="preserve">runId</t></is></c>…</sheetData>
workbook.xml: <sheets><sheet name="运行历史" sheetId="1" r:id="rId1"/>…</sheets>
```

### 6) 旧措辞/悬空引用机械扫描

脚本 `%TEMP%\jc_proto_smoke\scan.js`，对 `原型图/*.{html,js,css}` 扫描：`回退 Job.target.clientId` / `on_failure 条件边 + 重试` / `SheetJS CDN` / `虚拟 Job / 单次执行` / `有多条入边的节点必须有明确汇聚` / `retryFromStepId` / `retry_from_step_id` / `cdn.jsdelivr` / `WF_LOOP_EDGE_CONDITION` / `__findWfCycle`：

```
HIT mock-data.js L1491 "DAG 无环"     # 仅位于「删除原「DAG 无环」规则」的说明注释中，非现役规则
SCAN_DONE hits=1
```

### 7) 改动范围

```
git status --porcelain -- docs/cli非交互式/原型图
 M client.html  M index.html  M job.html  M mock-data.js  M op.html  M workflow-canvas.css  M workflow.html
 ?? xlsx-lite.js
```

（仅原型目录内文件被改；`settings.html`、`workflow-canvas.js` 未改。）
