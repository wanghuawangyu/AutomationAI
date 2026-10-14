# 修复口径（新周期 R1 拍板结论，**唯一权威**）

> 用户指令：`D6 重试保留续跑；其他先按推荐`。以下结论为**已拍板**，各修复者必须严格按此改，不得自行另立口径；若发现按此改会与其它处冲突，**报告冲突并暂停该项**，不要擅自改成第三种口径。
> 修复后：在本文件末尾追加「## 落地情况」表格（项号 / 文件:行 / 改法 / 证据），并另写 `_fix_v2_<你的组号>.md` 详版。

## 拍板结论

**D1 `retry.max` 语义**：`max` = **每轮总尝试次数**（首次执行计入，故 `retry.max=3` → 每轮最多 3 次尝试，序列 3/3/3）。据此修 `crud-03` 4.3.2 与 `:691`/`:1077` 中「记录数−1 ≥ max」类措辞为「尝试次数 ≥ max」，并修 `tests` 中「max+1=4 次尝试」的写法。回跳总上限 `min(max × 3, max_loop_multiplier)` 不变。

**D2 Workflow 校验与保存的关系**：`[保存]` **不要求**校验通过（允许保存草稿）；`[校验]` 仅用户主动点击时调用；`[执行]`（单次执行）与 Job 触发执行时，后端在创建 Run 前对**所引用版本**做拓扑校验，不通过 → 400 `VALIDATION_ERROR`。删除 `proposal-01:2454`（UC-W3）「校验通过后才能保存」，统一 UC-W1/UC-W3 措辞；原型 `workflow.html` 新建/保存不再要求校验（保留「请先保存后再校验」仅针对未保存对象的 [校验]）。

**D3 节点 `clientId`**：Workflow 的 OP 节点 `clientId` **必填**。缺失 → 400 `VALIDATION_ERROR`；工作流校验规则增加「所有 OP 节点的 clientId 非空」。前端拖拽创建节点时**默认选中该 OP 类型下 `createdAtMs` 最早的匹配 Client**（§8.3 映射）。原型 `workflow.html:1444` 删除「回退 Job.target.clientId」措辞，改为「— 未指定（创建时默认选中类型匹配的 Client）—」，并加「必填」校验。

**D4 「未绑定」**：`ParamBinding` 新增 `{ kind: "unbound" }`（拖拽创建节点时全部入参初始态）。校验判据：`bindings[name]` 不存在 **或** `kind==="unbound"` **或** `kind==="literal"` 且 `value===""` → 视为**无来源**（required 缺失 → 校验不通过）。参数绑定下拉**只列**「从 Start 可达且位于当前节点之前」的节点出参；新增校验规则「参数绑定必须指向前置节点」。

**D5 Client 类型匹配**：前端所有 Client 下拉（OP 单次执行 / Job 编辑器 / Workflow 节点详情面板）**按 §8.3 映射过滤**；下拉为空时提示「请先在 Client 管理中创建 {type} 类型的 Client」。后端 `POST/PUT /api/jobs`（`target.kind="op"`）与 `POST/PUT /api/workflows`（OP 节点 `clientId`）**校验 Client.type 与 OP.type 一致**，不一致 → 400 `VALIDATION_ERROR`，message：`Client 类型与 OP 类型不匹配：OP <opName> 为 <opType>，Client <clientName> 为 <clientType>`。

**D6 重试保留「续跑」**（与 D17 配套）：`crud-03` 增补 **重试种子（resume seed）** 小节，定稿如下：
- 入口：`POST /api/runs/{runId}/retry` 校验通过后新建 Run，写入 `job_runs.retry_from_run_id` = 源 Run、`retry_from_record_id` = 源 **失败/超时 StepRecord 主键**；随后 `engine.notify(EngineStart{ runId: 新 Run, resumeFromRecordId })`。
- Engine：`engine_start` 处理时若含 `resumeFromRecordId` → **以该 StepRecord 对应的节点为起点**：该节点的**全部前置节点视为已完成**（不写入新 Run 的 `step_records`，仅由 `retry_from_*` 溯源），新 Run 的 `run_context` 以**源 Run 完成节点的出参快照**为初始上下文；从该节点重新执行（`retrySeq` 从 1 重新计），其后继节点按常规则推进。
- 缺失快照：若绑定的 `node_output`/`workflow_input` 在源 Run 快照中找不到对应值 → 400 `VALIDATION_ERROR`（message 指明缺失的绑定）。
- 幂等：同一源 Run 可重复发起重试，各自独立 Run；重试 Run 的 `status` 生命周期与普通 Run 相同。
- 前端：`proposal-01 §12.8` 的「从失败 step 开始重试」文案保持；说明「已完成节点不重复执行」。
- 与 `rerun` 区别保持：`rerun` **从头**执行且不写 `retry_from_*`。

**D7 cron 路径 JobRun 归属**：以 `crud-04:325`（3.4.6 #4）为**唯一口径**——全部并发校验与 JobRun 插入都在 `TaskRunner.add_job` 的同一 `BEGIN IMMEDIATE` 事务内；**Scheduler 不自查不自插**。改写 `crud-04` 4.5.2 步骤 2–4：`② 前置校验（needsUpdate / CLIENT_TYPE_MISMATCH）命中即跳过记日志 → ③ 调 add_job（内部完成 skip 语义在途计数 + 全局 waiting 上限检查 + JobRun 插入）→ ④ 投递即返回`；命中上限**跳过、不报 409**。删除 4.5.2 中「步骤 2-3 在同一事务内（Scheduler 先查后插）」表述。

**D8 拓扑校验基准**：以 `crud-03 §3.3` 为契约基准（**允许环**、回跳边运行期推导、回跳计数兜底）。把 `proposal-01 §10.14` 中**除「DAG 无环」外**的规则补进 `crud-03`；删除 p01 §10.14 的「无环」条并注明「回跳由运行时计数约束（见 crud-03 4.3）」。回跳边统一示例用 `always`（`proposal-01 §15.3`/`mock-data.js` 的 `on_failure` 硬编码需对齐或注明为示例简化）。

**D9 PUT 携带审计字段**：**一律忽略**（不报错），语义「整体替换可编辑字段」。同步 `crud-01:271`、`crud-01:289`、`tasks.md:180`（T6.4）三处为同一措辞；`crud-06` 配置只读项**维持明确拒绝**（两者区别要写明：实体审计字段=忽略；配置只读项=400）。

**D10 名称锚覆盖范围**：纳入 `manifest.workflow.name`、`manifest.target.name`（Job 包）、`manifest.job.name`（Job 包 vs 包内 `job.yaml` 的 `name`）、`manifest.ops[].name`（vs `ops/<file>` 内 `name`）。`file`/`target.file` 仅作**定位**，**不校验文件名**与实际 `name` 的字符串一致（只校验文件**内容**的 `name`）。

**D11 「不一致位置」载体**：仅用 `message`（不新增错误结构）。固化格式（写进 `proposal-02 §10.1` 与 crud-03 3.3.9 / crud-04 3.4.10）：
`名称锚不一致：manifest.<锚字段>=<值>，<包内路径> 内 name=<值>`
（示例：`名称锚不一致：manifest.target.name=bash-build，ops/op_bash_build.yaml 内 name=op_bash_build`）；前端**原样展示 message**。

**D12 校验顺序**：
- 导入侧（crud-03 3.3.9 / crud-04 3.4.10）：① ZIP 解析失败 → 400；② **名称锚不一致 → 400**；③ `kind` 不一致 → 400；④ 同名实体已存在 → 409；⑤ Client 缺失 → 409 / 类型不符 → 400。
- 运行入口侧（crud-04 3.4.6 / crud-05 3.5.7 / 3.5.8）：① **全局 waiting 上限 → 409 `CONCURRENCY_CONFLICT`**；② 重跑/重试前置（`RERUN_NOT_ALLOWED` / `RETRY_NOT_ALLOWED`）→ 409；③ `concurrency=skip` 已有在途 → 409 `CONCURRENCY_CONFLICT`。
以上顺序须在各节显式写成列表。

**D13 被测前端口径**：`tests/集成测试用例.md` 顶部「测试环境」改写为：**被测前端 = T2 产出的 `ui/`（真实 HTTP API 直连后端）；`原型图/` 仅原型演示，不作验证依据**；P0 静态数据用例改为「`ui/` + 后端只读接口」口径。`tasks.md` 数据源约定收紧：**自 T2.1 起即 `fetch('/api/...')`，`mock-data.js` 不进 `ui/`**；并注明 T3.9 单测、T4 文件/CLI 行为不涉前端、不受此约定影响。

**D14 `max_loop_multiplier=0`**：语义 = **不施加绝对上限，仍受 `max×3` 约束**（不是无限）。在 `crud-06:80` 与 `tests` 相关表述加注。

**D15 cancelled Run 可 [重试]**：条件与判定同其它可重试 Run（存在失败/超时 step 且版本一致）；同步 `proposal-01 §12.4/§12.6/§12.8` 与原型 `index.html`。

**D16 触发筛选粒度**：5 值 —— `manual` / `schedule` / `single_op` / `single_workflow` / `retry`（与 API 单值枚举一一对应，不做多值合并）；同步 `proposal-01 §12.4/§18.1.3`、`crud-05 3.5.1`、原型 `index.html:243`。

**D17 `retry_from_step_id` 改名**：`schema.sql` 列改名 `retry_from_record_id`，语义 = **`step_records.record_id`（StepRecord 主键）**；**只有 `retry` 写入**该对字段（`rerun` 不写）；同步 `crud-05 3.5.7/3.5.8`（各补写入约定）、`crud-05` 字段表与样例、原型 `mock-data.js:1317`。

**D18 事件保留换算**：软删 = `engine_event_retention_days`（天）；硬删 = 软删 **+ 1 天**。同步 `crud-06:81`/`:348`、`crud-03:829`、`tasks.md` T9.15 验收口径。

## 低成本项（一并按此定）

1. `OP.timeoutSeconds`：默认 **60**，范围 **1..86400**，**必填**（新建时预填 60）；`proposal-01` 与 `crud-02` 口径对齐。
2. 导入体积上限：**取配置项值**（`crud-06` 已有导入上限配置；若名称不同则沿用现有键，不得新造），文档与原型一致；Client 导入同样校验。
3. 导出组件：SheetJS **打包进 `ui/`**（本地内置，不走 CDN），不新增错误码；`tasks.md` 加验收；原型改为本地库缺失时的明确提示（保留现有 guard）。
4. `bash-build`：**保留该名**，在 `tests` 已加的「命名说明（拍板）」中把「最终由用户决定」改为已定案表述。
5. `tc_x3_multi.zip`：**按声明序重打包**：`workflow.yaml` → `manifest.json` → `ops/<按 manifest.ops 顺序>`，与其余 4 个 fixture 体例一致。

## 通用要求（所有修复者）

1. **只改你负责的文件**（见各自提示词），不得改 `validation.md`、`_fix_v2_decisions.md`、他人负责的文件。
2. 交叉引用若必须新增章节，用现有编号体系的下一可用编号，并在被引用处同步。
3. 文件编码 UTF-8；**保持各文件原有行尾**（`.md`/`.html`/`.css`/`.yaml` 多为 CRLF，`mock-data.js`/`workflow-canvas.js` 为 LF；新增行沿用该文件既有风格，禁止整文件换行符转换）。
4. 改完必须做**机械自检**（grep 确认旧措辞 0 残留、新措辞出现在所有应出现处、引用目标存在），并把命令与结果写入报告。
5. 完成后回复 ≤200 字摘要：改了哪些文件、各项落地位点、未落地项与原因。

## 补充拍板（R1 修复后仲裁，协调者裁定）

1. **D5 错误码**：修复者指出 `VALIDATION_ERROR` 与总表唯一口径冲突——**裁定采用 `400 CLIENT_TYPE_MISMATCH`**（而非 VALIDATION_ERROR），message 固定串不变。已同步 `proposal-01:376`（原写 VALIDATION_ERROR）。
2. **重试目标已删除**（crud-05 N6 冲突）：**裁定与 [重跑] 对称** —— `3.5.8` 增 `404 TARGET_NOT_FOUND`（校验顺序插入为第 2 步，can-retry 条件顺延为第 3 步）；`3.5.9` reason 枚举增「目标（Workflow）已删除，无法重试。」并在功能说明补「目标 Workflow 仍存在」条件；`crud-05:116` 同步。
3. **`OP.timeoutSeconds`**：维持 decisions 的「**必填**（新建预填 60、范围 1..86400）」，同时保留 DB `DEFAULT 60` 与导入缺省落 60 的兜底语义（与 G-11 不矛盾：接口层必填、存储层有默认）。
4. **遗留空 `clientId` 节点**：接受 crud-03 的「兼容路径」写法（规则 10 对新建/更新强制；导入按 `clientName` 解析；历史遗留空值走运行期回退/`run_failed`）；schema `workflow_nodes.client_id` 可空保持不变。
5. **tests E2a/E2c 中 C 节点次数**：接受「只断言 A 与 Run 状态、以引用注说明 C 的次数存在两种读法」，不写不可判定断言。
6. **rerun/retry 快照来源**：采纳「一律取原 Run 快照」（`inputs`/`workspace`/`name`/`target_*`/`job_*`），与「运行历史按快照展示、不 join 定义」同源。
7. **G9（`PRAGMA foreign_keys` 连接级）**：已由协调者直接落地（`schema.sql` 头注 + `proposal-02 §1.1` 连接初始化约定）；不新增配置项。
8. **暂缓项（记录，不计缺陷）**：`proposal-02` 章节号「§N / 中文数字」混用（L-12）与 `settings.html` 的 🔄 徽标（UI L9）本次不改。
