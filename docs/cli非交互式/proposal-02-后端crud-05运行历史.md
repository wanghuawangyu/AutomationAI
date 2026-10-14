# 后端 CRUD —— 运行历史

> 来源：`proposal-02-后端设计.md` 第 3.5 节、第 4.6–4.7 节（独立拆分，内容原样迁移）
> 配套文档: `proposal-01-界面设计.md`、`proposal-02-后端设计.md`
> 配套建表脚本: `schema.sql`

---

### 3.5 运行历史

| 方法 | 路径 | 请求 Body | 响应 | 说明 |
|-|-|-|-|-|
| GET | `/api/runs` | — | 分页列表 | 支持筛选: status/triggeredBy/workspace/timeRange |
| GET | `/api/runs/{runId}` | — | JobRun | 完整详情 (含 steps) |
| GET | `/api/runs/{runId}/status` | — | `{status, updatedAtMs}` | 轻量轮询 |
| GET | `/api/runs/{runId}/steps` | — | StepRecord[] | 步骤列表 |
| GET | `/api/runs/{runId}/steps/{stepId}` | — | StepRecord[] | 单步骤多次执行记录 (按 activation/attempt 降序) |
| POST | `/api/runs/{runId}/terminate` | — | `{ok:true}` | 终止运行中 Run |
| POST | `/api/runs/{runId}/rerun` | — | `{runId}` | 重跑 (用最新版本) |
| POST | `/api/runs/{runId}/retry` | — | `{runId}` | 从失败 step 续跑重试（以失败/超时 step 为续跑种子，已完成节点不重复执行） |
| GET | `/api/runs/{runId}/can-retry` | — | `{canRetry:bool, reason:string}` | 检查前提条件 |
| POST | `/api/runs/export` | `{filters}` | `{xlsx: base64, count}` | 生成运行历史 Excel（前端解码后落盘；count=本次导出运行历史条数） |

**JobRun 对象**：
```json
{
  "runId": "...",
  "name": "hourly_check",
  "jobId": "...",
  "jobKind": "persistent",
  "jobVersion": 1,
  "triggeredBy": "schedule",
  "target": {"kind":"workflow","opId":null,"opVersion":null,"workflowId":"...","workflowVersion":1,"name":"deploy_workflow"},
  "inputs": {"env":"prod"},
  "workspace": "/path/ws-003",
  "status": "failed",
  "terminatedBy": null,
  "timeoutStepId": null,
  "timeoutOpName": null,
  "steps": [StepRecord...],
  "result": null,  // 计算字段：不落库，详情接口按 steps 聚合（见字段说明）
  "retryFromRunId": null,
  "retryFromRecordId": null,
  "startedAtMs": "...",
  "finishedAtMs": "...",
  "durationMs": 8200,
  "createdAtMs": "...",
  "updatedAtMs": "..."
}
```

**StepRecord 对象**：
```json
{
  "recordId": "a1b2c3d4e5f67890abcdef1234567890",
  "stepId": "1b2c3d4e5f60718293a4b5c6d7e8f9a1",  // workflow_node.workflow_node_id (32 位 UUID)
  "runId": "...",  // 引用 job_runs.run_id
  "activationSeq": 1,   // 第几次激活（首次=1；循环回跳重入 +1）
  "retrySeq": 1,   // activation 内第几次尝试（含首次；首次=1，apply_retry +1）
  "opId": "...",
  "opVersion": 2,
  "opName": "check_tests",
  "clientId": "...",
  "source": "step",  // job=单次 OP/Job / step=workflow 步骤（完成钩子分流）
  "status": "failed",
  "inputs": {"env":"prod"},
  "bodySnapshot": "在当前工作区运行测试...",
  "workspace": "/path/ws-003",
  "outputs": null,
  "rawOutput": "...",
  "exitCode": 1,
  "error": "test failed",
  "timeoutMs": 300000,
  "timedOut": false,
  "notBeforeMs": null,  // 最早可执行时间（重试退避/延迟调度）
  "createdAtMs": "...",  // 入队时间（waiting 队列按此顺序调度）
  "startedAtMs": "...",
  "finishedAtMs": "...",
  "durationMs": 5200
}
```

**时间筛选**：`?timeRange=last_1h|last_24h|last_2d|last_3d|last_5d|last_7d|last_30d`（固定枚举，无自定义区间）

**导出 Excel（`POST /api/runs/export` 生成，前端落盘）**：
- Sheet1 "运行历史"：runId, name, jobId, jobKind, jobVersion, triggeredBy, workspace, status, terminatedBy, startedAtMs, finishedAtMs, durationMs（name 为 JobRun 名称快照，见字段说明）
- Sheet2 "运行明细"：recordId, jobId, stepId, activationSeq, retrySeq, opId, opVersion, opName, clientId, status, exitCode, inputs(JSON), bodySnapshot, outputs(JSON), rawOutput, timedOut, startedAtMs, finishedAtMs, durationMs
- 文件名：`job_result-{yyyyMMddHHmmssSSS}-{jobResultCount}.xlsx`；时间戳在前（便于按导出时序排序）、`jobResultCount` = 接口返回的 `count`（本次导出的运行历史条数 = Sheet1 行数，见 3.5.10）
- **`POST /api/runs/export` 由后端按上述两 Sheet 生成 `.xlsx`，以 base64 二进制返回（`{xlsx, count}`），不落盘**；前端解码后写入用户所选目录（详见 3.5.10）。

**JobRun 对象字段说明**：

| 字段 | 类型 | 说明 |
|-|-|-|
| runId | string(32 位 UUID) | Run 标识 |
| name | string | 运行名称快照：persistent = jobs.name；virtual（single_op / single_workflow）= op.name / workflow.name（= target.name） |
| jobId | string(32 位 UUID) | 所属 Job。**virtual Run（`single_op` / `single_workflow`）无对应 `jobs` 行**：`job_id` 写后端生成的一次性**占位 UUID**（32 位，仅作快照/关联键，与 `jobs.job_id` 无对应关系；不加强外键，与 3.4.5 的「快照引用」口径一致） |
| jobKind | enum | `persistent` / `virtual` |
| jobVersion | integer \| null | Job 版本（Job 修订号）；**virtual Run 无 Job 修订号 → `null`**（见 3.5.1 `version` 过滤语义） |
| triggeredBy | enum | `manual` / `schedule` / `single_op` / `single_workflow` / `retry` |
| target | object | 目标快照：`{kind, opId, opVersion, workflowId, workflowVersion, name}`（拆列存储于 target_kind / target_id / target_version / target_name；Client 信息在步骤层 step_records.client_id 记录） |
| inputs | object | 本次执行入参 |
| workspace | string | 工作区 |
| status | enum | `waiting` / `running` / `terminating`（等待终止：已提交终止、停止派发、等在跑 OP 收敛）/ `success` / `failed` / `cancelled` / `timeout` |
| terminatedBy | enum \| null | `timeout` / `cancelled` / `error` |
| timeoutStepId | string \| null | 超时节点 stepId（写入约定见 3.5.6） |
| timeoutOpName | string \| null | 超时节点引用 OP 名称（写入约定见 3.5.6） |
| steps | StepRecord[] | 步骤列表 |
| result | object \| null | 运行结果（**不落库、详情接口按 steps 聚合**）：→ `RunResult`（**结构见 proposal-01 §12.3**；op 填 outputs + 摘要字段，workflow 填 outputs + durationMs） |
| retryFromRunId / retryFromRecordId | string \| null | 重试溯源：**仅 `retry`（3.5.8）写入**（rerun / manual / schedule / single_op / single_workflow 一律 null）——`retryFromRunId` = 源 Run，`retryFromRecordId` = 源**失败或超时 StepRecord 主键**（`step_records.record_id`）；写入约定见 3.5.7 / 3.5.8 |
| startedAtMs / finishedAtMs | string \| null | 起止时间（waiting 时均 null；running 时 finishedAtMs 为 null） |
| durationMs | integer \| null | 耗时（毫秒；终态才有值） |
| createdAtMs | string | 创建时间（job_runs.created_at_ms） |
| updatedAtMs | string | 最后状态更新时间（job_runs.updated_at_ms；每次状态写入刷新，供 3.5.3 轮询） |

> **已删除 Job 的 Run 展示（约定-已删 Job 的 Run 展示）**：以名称快照 `name` 展示 Job 名称（不 join `jobs`）；**可查看详情**（基于 Run 数据），**不可跳转到 Job 定义**；[重跑] 需 target（op/workflow）仍存在（否则 404 `TARGET_NOT_FOUND`）；[重试] 依赖 target=workflow（**target Workflow 已删除 → 404 `TARGET_NOT_FOUND`，与 [重跑] 对称**）及 can-retry 五条件（Job 已删 → Job.needsUpdate 视为 false）。

---

### 3.5.0 通用约定

> 以下为运行历史全部 API 的完整 HTTP 定义。通用约定：
> - 基础路径 `/api`；路径参数中的 `runId` 为 32 位无连字符 UUID；**路径参数格式非法**（非 32 位无连字符 UUID）→ 400 `VALIDATION_ERROR`。
> - 时间字段 JSON 中统一为 string（毫秒时间戳）。
> - 列表分页 `page` / `page_size`（`page_size` ∈ 10 / 50 / 100 / 1000，默认 10）。
> - 错误响应统一格式 `{"error":{"code":"...","message":"..."}}`。
>
> **行内编号对照表（本文件用例）**：行内编号**不构成全局唯一 id**（同一字母在不同章节 / 文件可指不同决策，见 `proposal-01 §20.1`），本文件出现者及出处如下——`D1`② = DB 排队（入队 = 写 `step_records` waiting，池满不报错）+ 超时自子进程 spawn 起算（出处 crud-03 4.4 / 本文件 4.6）；`D3`① = 同一 step 多次执行一律以最后一条 StepRecord 为准（出处本文件 3.5.5）；`D3`② = 导出 `count` 单一来源在后端（出处本文件 3.5.10）；`D5` = 导出文件名校验范围 = 全部导出（出处本文件 3.5.10）；`D6` = 重试保留**续跑**语义（出处 crud-03 4.3.4 / 本文件 3.5.8）；`D7` = 导出文件名允许自定义（出处本文件 3.5.10）；`D12` = 运行入口校验顺序（**全局 waiting 上限最先**，出处本文件 3.5.7 / 3.5.8）；`D15` = `cancelled` 且含失败 / 超时 step 的 Run 可重试（出处本文件 3.5.8 / 3.5.9）；`D16` = `triggeredBy` 五值单值枚举（出处本文件 3.5.1）；`D17` = `retry_from_run_id` / `retry_from_record_id` 仅 `retry` 写入（出处本文件 3.5.7 / 3.5.8）；`G8` = 新建 Run 的快照来源（出处本文件 3.5.7 / 3.5.8）。**跨文件引用一律具名**（如 crud-04 3.4.6.2「`job_queue_waiting_max` 的语义」），不使用别文件的小节内编号。本文件另出现 `U13`（StepComplete 写事件失败的兜底）、`T26`（运行中 `process_event` 失败兜底）、`N4`（`terminated_by` 写入约定）、`M17`（terminate 去重口径）——均为**内部条目号 / 独立校验报告条目号**（非决策类），释义见 `proposal-01 §20.1` 及其所在章节，引用时同样以具名小节为准。

**字段命名 ↔ 数据库列映射**（API 字段 camelCase ↔ `schema.sql` 列 snake_case）：

| API 字段 | 数据库列 | 说明 |
|-|-|-|
| `JobRun.runId` | `job_runs.run_id` | 主键，32 位 UUID |
| `JobRun.jobId` | `job_runs.job_id` | 引用 jobs.job_id；**virtual Run 为一次性占位 UUID**（无对应 `jobs` 行） |
| `JobRun.jobKind` | `job_runs.job_kind` | persistent / virtual |
| `JobRun.jobVersion` | `job_runs.job_version` | Job 修订号；virtual Run 为 NULL |
| `JobRun.triggeredBy` | `job_runs.triggered_by` | manual / schedule / single_op / single_workflow / retry |
| `JobRun.name` | `job_runs.name` | 运行名称快照（persistent = jobs.name；virtual = op.name / workflow.name） |
| `JobRun.target` | `job_runs.target_kind / target_id / target_version / target_name` | 拆列存储（快照） |
| `JobRun.inputs` | `job_runs.inputs` | 入参名值对，JSON object |
| `JobRun.workspace` | `job_runs.workspace` | 工作区路径 |
| `JobRun.status` | `job_runs.status` | 含 `terminating` 中间态 |
| `JobRun.terminatedBy` / `timeoutStepId` / `timeoutOpName` | `job_runs.terminated_by` / `timeout_step_id` / `timeout_op_name` | 终止 / 超时快照 |
| `JobRun.retryFromRunId` / `retryFromRecordId` | `job_runs.retry_from_run_id` / `job_runs.retry_from_record_id` | 重试溯源（**仅 retry 写入**）= 源 Run / 源失败或超时 **StepRecord 主键**（= `step_records.record_id`；见 3.5.7 / 3.5.8） |
| `JobRun.startedAtMs` / `finishedAtMs` / `durationMs` | `job_runs.started_at_ms` / `finished_at_ms` / `duration_ms` | 时间与耗时 |
| `JobRun.createdAtMs` / `updatedAtMs` | `job_runs.created_at_ms` / `job_runs.updated_at_ms` | 创建时间 / 最后状态更新时间 |
| `JobRun.result` | —（**不落库**） | 详情接口由 `step_records` 聚合得出 |
| `StepRecord.recordId` | `step_records.record_id` | 主键，32 位 UUID |
| `StepRecord.stepId` | `step_records.step_id` | 等于 workflow_nodes.workflow_node_id；单次 OP/Job 执行时为 run_id |
| `StepRecord.runId` | `step_records.run_id` | 引用 job_runs.run_id |
| `StepRecord.activationSeq` | `step_records.activation_seq` | 第几次激活（循环回跳重入 +1；重试不递增） |
| `StepRecord.retrySeq` | `step_records.retry_seq` | activation 内第几次尝试（含首次；apply_retry +1） |
| `StepRecord.opId` | `step_records.op_id` | 引用 ops.op_id |
| `StepRecord.opVersion` | `step_records.op_version` | 快照 |
| `StepRecord.opName` | `step_records.op_name` | 快照：OP 名称 |
| `StepRecord.clientId` | `step_records.client_id` | 执行时加载 Client |
| `StepRecord.source` | `step_records.source` | job=单次 OP/Job / step=workflow 步骤（完成钩子分流） |
| `StepRecord.status` | `step_records.status` | waiting/running/success/failed/timeout/cancelled |
| `StepRecord.inputs` | `step_records.inputs` | JSON object |
| `StepRecord.bodySnapshot` | `step_records.body_snapshot` | OP 正文快照 |
| `StepRecord.workspace` | `step_records.workspace` | 执行工作目录（**可空**：入队时写入，历史记录允许为空） |
| `StepRecord.outputs` | `step_records.outputs` | 出参，JSON object |
| `StepRecord.rawOutput` | `step_records.raw_output` | main 原始输出 |
| `StepRecord.exitCode` | `step_records.exit_code` | 退出码 |
| `StepRecord.error` | `step_records.error` | 错误信息 |
| `StepRecord.timeoutMs` | `step_records.timeout_ms` | 执行超时毫秒快照（OP.timeoutSeconds × 1000） |
| `StepRecord.timedOut` | `step_records.timed_out` | 是否超时 |
| `StepRecord.notBeforeMs` | `step_records.not_before_ms` | 最早可执行时间（重试退避/延迟调度） |
| `StepRecord.createdAtMs` | `step_records.created_at_ms` | 入队时间（waiting 队列按此顺序调度） |
| `StepRecord.startedAtMs` | `step_records.started_at_ms` | 开始时间（**可空**：waiting 记录为 NULL，见 3.5.1「JobRun 对象」同口径） |
| `StepRecord.finishedAtMs` | `step_records.finished_at_ms` | 结束时间 |
| `StepRecord.durationMs` | `step_records.duration_ms` | 耗时（毫秒） |

---

### 3.5.1 GET /api/runs —— Run 列表

**功能说明**：运行历史首页的列表接口，支撑多种筛选（status / triggeredBy / workspace / jobKind / timeRange 等）与分页排序。

**路径参数**：无

**查询参数**：

| 参数 | 位置 | 类型 | 必填 | 默认 | 说明 |
|-|-|-|-|-|-|
| page | query | integer | 否 | 1 | 页码 |
| page_size | query | integer | 否 | 10 | 每页条数，∈ {10,50,100,1000} |
| keyword | query | string | 否 | — | 模糊匹配 **name / target 名称**（文本字段 LIKE）；**状态与版本请用 `status` / `version` 参数**（精确等值，keyword 不参与） |
| targetKind | query | string | 否 | — | 类型：`op` / `workflow` |
| triggeredBy | query | string | 否 | — | 触发来源（**单值枚举，5 值互不合并**）：`manual` / `schedule` / `single_op` / `single_workflow` / `retry`（与 API 单值枚举一一对应，不做多值合并） |
| status | query | string | 否 | — | 状态：waiting/running/terminating/success/failed/cancelled/timeout |
| workspace | query | string | 否 | — | 工作区 |
| jobKind | query | string | 否 | — | 来源：persistent/virtual |
| version | query | string | 否 | — | **纯数字**（如 `2`），按 **`job_version`**（Job 修订号）精确等值过滤——非 target 快照版本（OP / Workflow 的 target_version）；**virtual Run 的 `job_version` 为 NULL，任何版本值都不匹配**。若需按快照版本过滤暂不支持（可用 `keyword` 检索目标名称辅助定位） |
| timeRange | query | string | 否 | — | `last_1h` / `last_24h` / `last_2d` / `last_3d` / `last_5d` / `last_7d` / `last_30d`（固定枚举，无自定义区间）。**过滤列（定稿）= `job_runs.started_at_ms`**（即以「开始执行时刻」为基准，非 `created_at_ms`）；`waiting` 记录 `started_at_ms` 为 NULL，故**不匹配任何 timeRange 档**（清空时间筛选才可见） |
| sort | query | string | 否 | `-startedAtMs` | 排序字段：startedAtMs/durationMs/createdAtMs，`-` 前缀降序。**NULL 排序语义**：`started_at_ms` 为 NULL 的 `waiting` 记录在降序中排在**最后**（SQLite：NULL 视为最小值，故 `DESC` 时居末；同序时以 `created_at_ms` 为次序参考） |

**请求体**：无

**成功响应 `200 OK`**：

```json
{ "items": [ JobRun, ... ], "total": 6, "page": 1, "page_size": 10 }
```

**错误响应**：400 `VALIDATION_ERROR`（page_size/status/triggeredBy/timeRange/sort 取值非法）。

---

### 3.5.2 GET /api/runs/{runId} —— Run 详情

**功能说明**：查询完整 JobRun（含 steps），用于运行详情页展示整体状态与各步骤记录。

**路径参数**：`runId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：完整 JobRun 对象（含 steps）。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | runId 格式非法 |
| 404 | `RUN_NOT_FOUND` | runId 不存在 |

---

### 3.5.3 GET /api/runs/{runId}/status —— 轻量状态轮询

**功能说明**：轻量轮询接口，前端定时调用以获取 Run 最新状态与更新时间，避免频繁拉取完整详情。

**路径参数**：`runId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
{ "status": "terminating", "updatedAtMs": "1728000000000" }
```

> `updatedAtMs` = `job_runs.updated_at_ms`，每次状态/结果写入刷新（如 running → terminating → cancelled 逐次变化）；前端据此判断是否需要拉取新数据，而非每次重拉完整详情。典型递进：`running → terminating（提交终止、等在跑 OP 收敛）→ cancelled`。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | runId 格式非法 |
| 404 | `RUN_NOT_FOUND` | runId 不存在 |

---

### 3.5.4 GET /api/runs/{runId}/steps —— 步骤列表

**功能说明**：查询 Run 的全部步骤记录（含因重试 / 循环回跳产生的多条），按执行先后排序（`(activation_seq, retry_seq)` 升序），用于详情页逐步展示。

**路径参数**：`runId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：`StepRecord[]`（含重试 / 循环回跳产生的多条记录，按 `(activation_seq, retry_seq)` 升序）。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | runId 格式非法 |
| 404 | `RUN_NOT_FOUND` | runId 不存在 |

---

### 3.5.5 GET /api/runs/{runId}/steps/{stepId} —— 单步骤多次执行记录

**功能说明**：查询某 step 因**重试 / 循环回跳**产生的全部执行记录，按执行降序（最新在上，即 `(activation_seq, retry_seq)` 降序），用于对比每次尝试的结果。**判断该 step 的最终结果（成败 / 是否需重试 / 是否已达上限）一律以「最后一条记录」（即 `(activation_seq, retry_seq)` 最大者）为准**（D3 拍板）。

**路径参数**：

| 参数 | 类型 | 必填 | 说明 |
|-|-|-|-|
| runId | string(32 位 UUID) | 是 | Run 标识 |
| stepId | string | 是 | 步骤 ID（等于 workflow_node.workflow_node_id） |

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：`StepRecord[]`，该 step 因重试 / 循环回跳产生的全部记录，按 `(activation_seq, retry_seq)` 降序（最新的在最上面）。

**错误响应**：400 `VALIDATION_ERROR`；404 `RUN_NOT_FOUND` / `STEP_NOT_FOUND`。

---

### 3.5.6 POST /api/runs/{runId}/terminate —— 终止 Run

**功能说明**：终止 Run。**按 target 类型分两类语义**：

- **target=OP（单次 OP run）**（**判定依据 = 该 Run 的 OP 步骤（`step_records.source=job`）状态，不看 job_runs.status**——因存在「job_run 已 running 但 step 仍在 waiting 排队」的常态窗口，见 crud-03 4.4）：
  - 步骤 `waiting`（未开始，含排队中）→ 可直接终止，落 `cancelled`（无在跑 OP）；
  - **步骤 `running`（已开始执行）→ 不支持终止**——OP 是最小原子执行单元，运行中不可外部终止（返回 409 `RUN_NOT_TERMINABLE`）；**界面表现：终止按钮置灰 / 点击提示「终止失败：OP 正在运行，不可终止」**。
- **target=Workflow（Workflow run）**：支持终止，但**只能终止未运行的 OP**——停止派发新步骤、仍在 `waiting` 的步骤置 `cancelled`；**运行中的 OP 不 kill**，等其自然运行结束后，整个 Workflow 才落 `cancelled` 终态：
  - **提交终止时若存在运行中的 OP** → Run 先置 `terminating`（终止中）中间态（界面显示"终止中"），等在跑 OP 全部收敛后再落 `cancelled`；
  - **提交终止时无运行中的 OP**（仅 waiting 步骤）→ 直接落 `cancelled`，不经过中间态。

**路径参数**：`runId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
{ "ok": true }
```

> 终止逻辑见 4.7（置终止意图 → 等待中步骤置 cancelled → 在跑 OP 不 kill、等自然收敛 → 整体落 cancelled 终态）。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | runId 格式非法（**仅参数非法**；Run 已处于终态时见下一行 409 `RUN_NOT_TERMINABLE`） |
| 409 | `RUN_NOT_TERMINABLE` | ① target=OP 且该 OP 步骤**已开始执行**（`step_records.status=running`）——判定依据为 step 状态（非 `job_runs.status`，故 job_run 已 running 但 step 仍 waiting 排队时**允许**取消，见 4.7 / crud-03 4.4）；② Run 已处于终态（`success` / `failed` / `timeout` / `cancelled`）。**口径：Run 当前状态不允许该操作统一落 409 专用码（同 3.5.7 `RERUN_NOT_ALLOWED` / 3.5.8 `RETRY_NOT_ALLOWED`），400 仅表示参数非法** |
| 404 | `RUN_NOT_FOUND` | runId 不存在 |

> Run 处于 `terminating`（等待终止）时重复提交 terminate → **幂等返回 200 ok**（已有终止意图，无需重复处理）。

> **`timeout_step_id` / `timeout_op_name` 的写入约定**：**写入方**：Executor 侦测到 `op.timeoutSeconds` 到期时，`JobComplete` / `StepComplete` 路径把该 step 的 `step_id` 与 `op_name` 写入 `job_runs.timeout_step_id` / `timeout_op_name`（与 `terminated_by='timeout'` **同一写入点**）；**仅当 `terminated_by='timeout'` 时非空**（其余终态两列均为 NULL；超时计时起点与 OP 终止见 crud-03 4.4、crud-01 5.1）。

> **`terminated_by` 的写入约定（N4）**：本字段是终态写入点的快照，与 `job_runs.status` 同时落库，写入方 = 收敛后的 `JobComplete`（见 4.7 / crud-03 4.3）：
> - **用户终止**（`terminate` 事件 `reason=user_terminate`）→ `status='cancelled'` **且** `terminated_by='cancelled'`（**有在跑 OP 经 `terminating` 收敛落终态、无在跑 OP 直接落终态，两条路径相同**）；
> - **超时**（`reason=timeout`）→ `status='timeout'` 且 `terminated_by='timeout'`（同上一注）；
> - **失败收敛**（`reason=run_failed` / `loop_limit`，或 `workflow_done(failed)`）→ `status='failed'` 且 `terminated_by='error'`（见 crud-03 4.3 / 4.3.1）；
> - 其余终态（`success`，以及非上述终止路径的普通执行失败）本字段为 `NULL`。

---

### 3.5.7 POST /api/runs/{runId}/rerun —— 重跑 Run

**功能说明**：使用最新版本从头重跑（新建 JobRun，从头执行），适用于原 Run 失败或需按新版本重新执行的场景。**前置约束：仅已结束（终态）的 Run 可重跑——`success` / `failed` / `timeout` / `cancelled`；`waiting`（等待中）/ `running`（运行中）/ `terminating`（等待终止）不可重跑**。

**路径参数**：`runId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无（使用最新版本，从头执行）

**成功响应 `200 OK`**：

```json
{ "runId": "a1b2c3d4e5f67890abcdef1234567890" }
```

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | runId 格式非法 |
| 409 | `RERUN_NOT_ALLOWED` | Run **未结束**：处于 waiting / running / **terminating**（三者均非终态，不可重跑） |
| 409 | `CONCURRENCY_CONFLICT` | 全局 waiting 队列达配置项 `job_queue_waiting_max`（`ai-automation.json`，默认 20、可调、上限 1000）上限（新建 JobRun 前统一检查，见 crud-04 3.4.6.2「`job_queue_waiting_max` 的语义」） |
| 404 | `RUN_NOT_FOUND` / `TARGET_NOT_FOUND` | runId 不存在 / 目标（op / workflow）已删除 |

> **原子性（约定-排队检查与创建同事务）**：检查（终态 + 全局 waiting 上限）与创建 JobRun 在**同一事务（`BEGIN IMMEDIATE`）**内先查后插，语义同 crud-04 3.4.6。

> **新建 Run 的 `triggered_by` / `job_kind`（口径澄清）**：重跑新建的 Run 一律 `triggered_by=manual`，`job_kind` 继承原 Run（原 Run 为 virtual 则仍为 virtual）；**`triggered_by` 与 `job_kind` 是两个独立维度**——`single_op` / `single_workflow` 仅由「单次执行入口」（`POST /api/ops/{opId}/execute`、`POST /api/workflows/{workflowId}/execute`）产生，`retry` 仅由本文件 3.5.8 重试产生，重跑/手动/定时均为 `manual` / `schedule`。重跑**不复制**原 Run 的 `job_version`（virtual 恒为 NULL；persistent 取当前 `Job.version`）。

> **校验顺序（D12，返回首个命中）**：
> 1. **全局 waiting 上限**：`SELECT count(*) FROM job_runs WHERE status='waiting'` ≥ 配置项 `job_queue_waiting_max`（`ai-automation.json`，默认 20、可调、上限 1000）→ 409 `CONCURRENCY_CONFLICT`（见 crud-04 3.4.6.2「`job_queue_waiting_max` 的语义」）；
> 2. **创建 Run 前定义完整性校验**（**仅 target=workflow 时适用**；target=op 无 Workflow 定义）：所引用 Workflow 定义按 **crud-03 3.3 分组 A + B** 校验，落点见 **crud-03 4.4「创建 Run 前校验」**（与 crud-03 的「创建 Run 前」声明同口径）→ 400 `VALIDATION_ERROR`；
> 3. **重跑前置**：Run 未结束（waiting / running / terminating）→ 409 `RERUN_NOT_ALLOWED`；目标（op / workflow）已删除 → 404 `TARGET_NOT_FOUND`；
> 4. **`concurrency=skip` 且同 Job 已有在途实例** → 409 `CONCURRENCY_CONFLICT`（persistent Run 且原 Job 并发策略为 `skip` 时适用；virtual Run 无 Job 配置、不适用；判定口径见 crud-04 3.4.6）。

> **重跑不写 `retry_from_*`（D17 写入方约定）**：`job_runs.retry_from_run_id` / `retry_from_record_id` **仅 `retry`（3.5.8）写入**；重跑新建的 Run 这两列**均为 `NULL`**——重跑只做「最新版本从头执行」，不溯源失败 step。

> **新建 Run 的快照来源（G8 定稿）**：重跑 = 「用**最新版本**从头执行」（本接口**无请求体**），故新建 Run 各字段取值如下（「原 Run」= 被重跑的 Run）：

| 字段 | 重跑取值 | 说明 |
|-|-|-|
| `job_id` | 原 Run 的 `job_id` | persistent = 原 `jobs.job_id`；virtual（单次 OP / 单次 Workflow）= 沿用原 Run 的一次性占位 UUID。重跑只校验 target 是否存在（`TARGET_NOT_FOUND`），**不校验 Job 是否存在** |
| `job_kind` | 继承原 Run | 口径同上方「`triggered_by` / `job_kind`」注 |
| `job_version` | persistent = 当前 `jobs.version`；virtual = `null` | **不复制**原 Run 的 `job_version`（口径同上方注） |
| `name` / `target_name` | 取**当前**名称（与 `target_version` 同一次读取） | persistent：当前 `jobs.name`（Job 已删则沿用原 Run 快照）；virtual：当前 `op.name` / `workflow.name`（此时 `name` = `target_name`） |
| `target_kind` / `target_id` | 原 Run 的 `target_kind` / `target_id` | target 必须仍存在（否则 404 `TARGET_NOT_FOUND`） |
| `target_version` | **当前**目标版本（`ops.version` / `workflows.version`） | 重跑语义 = 用最新版本 |
| `inputs` / `workspace` | 原 Run 的快照 | 请求体为空，故按原 Run 快照原样复制（不重新读取 Job 配置；Job 已删时亦为唯一可用来源） |
| `triggered_by` | `manual` | 口径同上方「`triggered_by` / `job_kind`」注 |

---

### 3.5.8 POST /api/runs/{runId}/retry —— 从失败 step 续跑重试

**功能说明**：**从失败 step 处续跑重试**——以源 Run 的**失败 / 超时 step** 为**续跑种子（resume seed）**新建 Run：从该 step 起重新执行，**已完成节点不重复执行**（前提：target=Workflow、版本一致、无 needsUpdate、存在失败/超时 step）。**超时导致的 Run 结束也可手动重试超时的 step**（自动重试语义：**Workflow 节点**的 `retry.on` 不含 timeout，超时不触发自动重试，见 crud-03 节点 retry 配置及 4.3.2）。**用户终止（cancelled）且含失败/超时 step 的 Run 也可手动重试**（判定口径与其它终态相同，**D15**：中止前已落到 `failed` / `timeout` 的 step 即为续跑种子，该 step 与其后继节点按 DAG 继续；**cancelled 但终止前无任何失败/超时 step 的 Run 不可重试**，见 3.5.9 reason 枚举）。**terminating（未收敛）不可重试**。

**重试新建 Run 的动作序列（D6 定稿：重试保留续跑语义）**：

1. **前置校验**：按下方「校验顺序」逐项判定（can-retry 五条件）；
2. **新建 JobRun**：`triggered_by=retry`、`status=waiting`，写 `retry_from_run_id` = 源 Run、`retry_from_record_id` = 源**失败 / 超时 StepRecord 主键**（`step_records.record_id`；同一 step 有多条记录时取 `(activation_seq, retry_seq)` 最大者，同 3.5.5）；**源 Run 存在多条失败 / 超时 step 时，取失败 / 超时记录 `created_at_ms` 最晚的那一条（即最后失败 / 超时的 step；与 3.5.5「以最后一条记录为准」同向，同口径见 crud-03 4.3.4①）**；其余字段的快照来源见下方「新建 Run 的快照来源」；
3. **投递 Engine（带续跑种子）**：`engine.notify(EngineStart{ run_id: 新 Run, workflow_id, inputs, workspace, resumeFromRecordId: 源 StepRecord 主键 })`——**EngineStart 携带续跑种子，不是「让 Engine 从头启动」**；
4. **Engine 侧机制**（契约细节见 **crud-03 4.3.4「重试种子（resume seed）」**）：以该 StepRecord 对应节点为起点——其**全部前置节点视为已完成**（**不写入新 Run 的 `step_records`**，仅由 `retry_from_*` 溯源），新 Run 的 `run_context` 以**源 Run 已完成节点的出参快照**为初始上下文；从该节点重新执行（`retrySeq` 从 1 重新计），后继节点按常规则推进；源 Run 快照中缺少该节点绑定所需的 `node_output` / `workflow_input` 值 → 400 `VALIDATION_ERROR`（message 指明缺失的绑定）；**新 Run 的边状态初值（D6，必做；与 crud-03 4.3.4② 逐条同口径）**：
   - ① **全边先置 `pending`**（重置基线）；
   - ② **前缀节点集（种子节点及其全部前置节点）的出边按其源 Run 终态边状态复制**（源 Run 中已 `activated` 的保持 `activated`、已 `dropped` 的保持 `dropped`，**不得全量重置为 `pending`**）；
   - ③ **种子节点的入边一律置 `activated`**（起点就绪不要求其入边被激活）；
   - ④ **不可达闭包（必做）**：对新 Run 中「**既不属于前缀节点集、也不从种子节点（或任一已决边）正向可达**」的节点（即**不可达闭包**），其**出边一律置 `dropped`**，并**递归传播至不动点**后再 dispatch（等价于：凡前缀集外且种子不可达的节点，其未决出边统按 `dropped` 决定，直至无新变化）；
   - ⑤ **dispatch 种子与已就绪节点**：前缀节点集以「已执行过」（`completedOnce=true`）参与就绪 / 汇聚 / 回跳判定，但仍**不写入新 Run 的 `step_records`**（仅由 `retry_from_*` 溯源）；
   - ⑥ **风险说明（为何必须做 ② / ④）**：不复制前缀边状态（②）→ 菱形 / 并行汇聚结构卡死（如 `Start → A`、`A →{on_success} B`、`A →{on_success} End`、`B →{on_success} End`，源 Run 中 A 成功、B 失败，重试从 B 起跑时 `A→End` 这条入边**永远停在 `pending`**）；不做不可达闭包（④）→ 旁支入边永久 `pending`。**注（最小反例，`activated` 型旁支）**：图 `Start →(always) A`、`Start →(always) X`、`A →(on_success) B`、`B →(on_success) End`、`X →(always) Y`、`Y →(always) End`；源 Run 中 A 成功 → B 失败、`X→Y` 已 `activated` 但 Y 未 dispatch，随后 Run 落 `failed`。重试（种子 = B 失败记录）前缀集 = {Start, A, B}：旧判据「入边已全部决定且无 `activated`」会把 `activated` 的 X / Y 排除在闭包外，而 ② 只复制前缀集出边 → `X→Y` 在新 Run 中**永久 `pending`** → Y / End 永不就绪 → **收敛永不成立、`job_runs.status` 永久 `running`**；按本 ④「不可达闭包」判据，X / Y 既不在前缀集、也不从种子 B 可达 → 其出边（`X→Y`、`Y→End`）一律置 `dropped` → End 就绪、Run 正常收敛；
   - 该初值**仅作内存 `RunContext` 初值**（不落库；边状态为内存态，重启 / 恢复后按「**节点状态 + Run 终态**」口径重建）；重放 / 恢复时由 `retry_from_record_id` + 源 Run 事件 / 记录按同规则重建（幂等）；
5. **幂等**：同一源 Run 可重复发起重试，各自独立 Run，生命周期与普通 Run 相同。

**路径参数**：`runId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
{ "runId": "a1b2c3d4e5f67890abcdef1234567890" }
```

> 前提见 4.8：仅 target=Workflow、失败（含超时）、版本一致、无 needsUpdate、存在失败/超时 step。重试前建议先调用 can-retry 校验。
>
> **原子性（约定-排队检查与创建同事务）**：与 3.4.6 同语义——全局 waiting 计数检查与创建 JobRun 在**同一事务（`BEGIN IMMEDIATE`）**内先查后插，防与 cron / 手动运行并发时击穿。

> **校验顺序（D12，返回首个命中）**：
> 1. **全局 waiting 上限** → 409 `CONCURRENCY_CONFLICT`（同 3.5.7 第 1 条；见 crud-04 3.4.6.2「`job_queue_waiting_max` 的语义」）；
> 2. **创建 Run 前定义完整性校验**：所引用 Workflow 定义按 **crud-03 3.3 分组 A + B** 校验，落点见 **crud-03 4.4「创建 Run 前校验」**（与 crud-03 的「创建 Run 前」声明同口径）→ 400 `VALIDATION_ERROR`；
> 3. **目标（Workflow）已删除** → 404 `TARGET_NOT_FOUND`（**与 3.5.7 对称**；见下错误表与 3.5.9 reason 枚举）；
> 4. **重试前置（3.5.9 的 can-retry 条件）**不满足 → 409 `RETRY_NOT_ALLOWED`（Run 未结束（waiting / running / terminating）/ 版本不一致 / needsUpdate / 无失败或超时 step / target 非 Workflow）；
> 5. **`concurrency=skip` 且同 Job 已有在途实例** → 409 `CONCURRENCY_CONFLICT`（persistent Run 且原 Job 并发策略为 `skip` 时适用；virtual Run 不适用；判定口径见 crud-04 3.4.6）；
> 6. **续跑种子快照缺失** → 400 `VALIDATION_ERROR`（预检在**重试入口**执行，见 crud-03 4.3.4③）——**置末位**：前 5 项均为状态 / 并发 / 定义类判定（不改动任何数据），本项为续跑种子内容判定，且不影响 `can-retry` 结果（3.5.9 五条件不含快照完整性，快照缺失时仍返回 `canRetry=true`），故在可重试判定之后返回；

> **写入方约定（D17）**：`retry_from_run_id` / `retry_from_record_id` **仅本接口写入**（即 `triggered_by=retry` 的 Run）；`rerun`（3.5.7）与 manual / schedule / single_op / single_workflow 产生的 Run 一律 `NULL`。取值 = 源 Run / 源**失败或超时 StepRecord 主键**（`step_records.record_id`，**不是** `workflow_node_id`）。

> **新建 Run 的快照来源（G8 定稿）**：「原 Run」= 被重试的 Run（同一口径见 crud-03 4.3.4①）：

| 字段 | 重试取值 | 说明 |
|-|-|-|
| `job_id` / `job_kind` | 原 Run 快照 | 重试只按 target=Workflow + 版本一致性判定，不重读 Job / 目标定义 |
| `job_version` | 原 Run 快照 | 版本一致是重试前提；persistent 沿用原 `job_version`，virtual 恒为 `null` |
| `name` / `target_name` / `target_version` | 原 Run 快照 | 不刷新（版本一致即当前版本 = 快照版本，与运行历史「名称快照」口径一致） |
| `target_kind` / `target_id` | 原 Run 的 `target_kind` / `target_id` | 恒为 `workflow`（前提 target=Workflow） |
| `inputs` / `workspace` | 原 Run 快照 | 重试 = 复用上下文续跑 |
| `triggered_by` | `retry` | 全系统唯一写入 `retry` 的入口 |
| `retry_from_run_id` / `retry_from_record_id` | 源 Run / 源失败或超时 **StepRecord 主键** | 见上方「写入方约定」 |

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | runId 格式非法；或**续跑种子缺失**（该 step 绑定所需的 `node_output` / `workflow_input` 值在源 Run 快照中不存在，message 指明缺失的绑定） |
| 404 | `RUN_NOT_FOUND` | runId 不存在 |
| 404 | `TARGET_NOT_FOUND` | **目标 Workflow 已删除**（与 3.5.7 对称；不由 `RETRY_NOT_ALLOWED` 承担，`can-retry` 对应 reason 见 3.5.9） |
| 409 | `RETRY_NOT_ALLOWED` | 不满足前提（如版本不一致/needsUpdate/无失败或超时 step） |
| 409 | `CONCURRENCY_CONFLICT` | 全局 waiting 队列达配置项 `job_queue_waiting_max`（`ai-automation.json`，默认 20、可调、上限 1000）上限（统一检查，见 crud-04 3.4.6.2「`job_queue_waiting_max` 的语义」） |

---

### 3.5.9 GET /api/runs/{runId}/can-retry —— 检查是否可重试

**功能说明**：预检查是否满足重试前提，返回 `canRetry` 与不可重试原因。前端据此决定展示「重试」还是「重跑」操作。**判断条件与 3.5.8 / 4.8 一致**：target=Workflow **且目标 Workflow 仍存在（已删除 → `canRetry=false`，reason 见下表）**、**Run 已结束（failed / timeout / cancelled，且存在失败或超时 step）**、版本一致、无 needsUpdate、存在失败或超时的 step——**超时结束、以及用户终止（cancelled）且含失败/超时 step 的 Run 均可手动重试**；waiting / running / terminating 不可。

**路径参数**：`runId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
{ "canRetry": false, "reason": "版本已更新，无法重试。请使用 [重跑]。" }
```

超时导致的结束（存在超时 step、其余条件满足）返回可重试：

```json
{ "canRetry": true, "reason": null }
```

| 响应字段 | 类型 | 说明 |
|-|-|-|
| canRetry | boolean | 是否满足重试前提 |
| reason | string | 不可重试的原因（可为空；可重试时为 null） |

**reason 原因枚举**：

| reason | 场景 |
|-|-|
| 版本已更新，无法重试。请使用 [重跑]。 | 目标（Workflow / Job）版本与 Run 快照不一致 |
| Workflow 或 Job 需要更新，无法重试。 | needsUpdate = true |
| 不存在失败或超时的 step。 | 无失败/超时 step（如 success；或 cancelled 但终止前无任何失败/超时 step） |
| 仅 Workflow 支持重试。 | target 非 Workflow（如单次 OP） |
| 目标（Workflow）已删除，无法重试。 | 目标 Workflow 已删除（对应 3.5.8 的 404 `TARGET_NOT_FOUND`；与 [重跑] 的 target 存在性检查对称） |
| Run 未结束，无法重试。 | Run 处于 waiting / running / **terminating**（三者均非终态） |

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | runId 格式非法 |
| 404 | `RUN_NOT_FOUND` | runId 不存在 |

---

### 3.5.10 POST /api/runs/export —— 生成运行历史 Excel

**功能说明**：按筛选条件由**后端生成** Excel（Sheet1 运行历史 + Sheet2 运行明细），以 **base64 二进制**形式返回。接口**只生成文件内容、不落盘**；前端拿到 base64 后解码为字节流，由用户在浏览器中选择目录写入磁盘。程序形态为非 Tauri 的普通 Rust 服务端 + HTTP + 浏览器前端，因此**文件落盘始终在前端完成**（与 OP / Workflow / Job 实体导出同一口径：后端供内容、前端写文件）。

**路径参数**：无

**查询参数**：无

**请求体**：

```json
{
  "filters": {"status":"failed","timeRange":"last_5d"}
}
```

| 字段 | 类型 | 必填 | 说明 |
|-|-|-|-|
| filters | object | 否 | 与 GET /api/runs 一致的筛选条件（status / targetKind / jobKind / triggeredBy / workspace / version / timeRange），仅用于确定导出范围（`triggeredBy` 为**单值枚举**，同 3.5.1，不做多值合并） |

**成功响应 `200 OK`**：

```json
{ "xlsx": "UEsDBBQACAgI...", "count": 128 }
```

| 字段 | 类型 | 说明 |
|-|-|-|
| xlsx | string (base64) | 生成的 `.xlsx` 文件二进制内容（base64 编码）。两个 Sheet：运行历史（每个 Run 一行）+ 运行明细（每个 step 一行），列定义见 3.5「导出 Excel」。前端解码后原样写入用户所选目录 |
| count | integer | 本次导出的**运行历史条数**（= Sheet1 行数），**由后端按本次实际导出范围计算**并返回；前端默认文件名 `-{jobResultCount}` 段取此值（**D3 定稿**：计数单一来源在后端，避免前后端筛选口径不一致导致文件名与内容不符） |

**文件名与落盘规则（D5/D7，前端侧）**：

| 项目 | 规则 |
|-|-|
| 文件名 | UI 前端预填默认名 `job_result-{yyyyMMddHHmmssSSS}-{jobResultCount}.xlsx`（时间戳在前、便于按导出时序排序；`jobResultCount` = 接口返回的 `count`，即本次导出条数 = Sheet1 行数），**允许用户自定义（D7）**；文件名**不经过本接口**，由前端落盘时使用 |
| 校验 | 前端落盘前**仅拒绝含路径分隔符（`/`、`\`）或 `..` 的文件名**（D5）；**除此外不校验任何字符或扩展名**，其余非法字符交由写入时浏览器的 OS/IO 决定成败 |
| 写入 | 前端以 `showDirectoryPicker()` 选择目录 → `getFileHandle(name, {create:true})` → `createWritable()` 写字节流（**同名覆盖**） |
| 并发与失败 | 多次导出互相独立；写失败由浏览器抛出、前端提示，用户可重新导出 |

**错误响应**：400 `VALIDATION_ERROR`（filters 取值非法——与 GET /api/runs 同一校验：status / targetKind / jobKind / triggeredBy / timeRange 枚举、version 须为数字）。

> **说明**：本接口**不接收** `filePath` / `fileName`，返回的是**文件内容（base64）**而非 `{filePath}`。文件名的校验与文件写入均在前端进行（D5 规则在前端执行）；接口职责 = 「按筛选生成 xlsx 内容」。前端内置 xlsx 生成库未就绪属**前端本地错误**（**不入后端错误码表**，由前端本地提示；与决策「不新增错误码」一致）。

---

### 4.6 统一任务执行器（Task Runner）

**职责**：所有异步执行（单次 OP、Job 运行、Workflow 运行）统一投递到后端**任务执行器（Task Runner）**。它负责**运行历史（JobRun）的创建与状态机管理、并发控制、按序调度分派**（**常驻轮询后台线程**，按固定间隔扫描 DB，间隔可经配置项 `runner_poll_interval_ms`（`ai-automation.json`，见 crud-06 一）配置）——本章归属运行历史领域：Task Runner 的一切动作都以 `job_runs` / `step_records` 为落点，运行历史界面的状态（等待中 / 运行中 / 终止中 / 终态）完全由它驱动。**Task Runner 不亲自执行 OP**：单次 OP / **Job(target=op)** 任务直接调用 WorkerPool 执行；**Job(target=workflow) / 单次 Workflow** 任务先通知 Engine 启动，由 Engine 顺序调度各 OP、再交给 WorkerPool 执行。**任务控制不在 Job 业务层，而在本执行器**；Job 管理与单次 OP 只是「创建 JobRun 并提交任务」的入口。

**与 Executor / Engine / WorkerPool 的分工**：

| 层 | 归属文档 | 职责 | 并行关系 |
| - | - | - | - |
| **Executor** | crud-01 第 5.1 节 | 最小原子执行单元，执行**一个 OP**，返回 `ExecuteResult`（归属 Client 层：client 提供执行能力） | — |
| **Task Runner** | 本章 4.6 | 调度层：创建并管理 **JobRun 生命周期**（waiting / running / terminating / 终态）、并发控制、按序调度分派 | — |
| **Engine** | crud-03 第 4.3 节 | workflow DAG 调度（并行后台任务）：**异步入口 `engine.notify(EngineStart)`（实例方法 &self）——消息即事件：EngineStart / Terminate 先写 engine_events 落库，写后立即 `process_event` 同步处理（无事件循环 / 无信号）**，按 DAG 顺序决定下一步执行哪个 OP 并派发给 WorkerPool；整体完成时在处理 `workflow_done` / `terminate` 事件时调用**全局 JobComplete** 更新 job_runs 终态（事件持久化 + 单例重启重建，重放幂等） | 与 WorkerPool 并行（互不嵌套） |
| **WorkerPool** | crud-03 第 4.4 节 | 单个 OP 的实际执行（**数据库排队 + Worker 池**：`worker.run_job(req)` / `worker.run_step(req, inst)`（实例方法 &self）**总是**在 step_records 插入 waiting 记录（含 activation_seq / retry_seq）即返回（**池满不报错**）；WorkerPool 调度线程常驻轮询 waiting → 指派空闲 Worker（**池大小 = `ceil(job_queue_running_max × 1.5)`，数值派生自同一配置、语义不同**）→ 执行 Executor → 更新 step_records 终态+结果）；完成回调为**全局实现**（`JobComplete` 更新终态、`StepComplete` 写事件后调全局 ENGINE 推进），Worker 执行完**同步调用**；WorkerPool 不感知业务 | 与 Engine 并行（互不嵌套） |

> Engine 与 WorkerPool 是两个**互相并行**的后台组件（分别在 crud-03 4.3 / 4.4 描述），不是「Engine 套 WorkerPool」的嵌套关系；Task Runner 与它们也并行——Runner 只管队列与状态，不参与任何实际执行。

**并发控制**：Task Runner 控制**同时运行的任务数量**（**并发阈值 = 配置项 `job_queue_running_max`（`ai-automation.json`，默认 10、上限 10）**；与 Worker 池大小 `worker_pool_size`（= `ceil(job_queue_running_max × 1.5)`，默认 10 阈值 → 15 个 Worker，只读派生；**一个 JobRun 可并行多个 step，故池大小需大于并发阈值**，见 crud-03 4.4 / crud-06 一）**数值派生自同一配置、语义不同**）。运行中的任务数由 **TaskRunner 内存计数 `running_count: AtomicU32`** 维护——**启动时（new/init）从 `job_runs` 统计一次 `status=running` 或 `terminating` 的记录数作为初始值**（terminating 等待终止、在跑 OP 未释放，仍占并发名额；**临时 Job（单次 OP / Workflow 运行的 virtual JobRun）也是 Job，同样计入并发**）；此后**每次轮询只读内存计数（`load`），不再每次从 DB 统计，减少 DB I/O**。调度规则：每轮轮询先 `running_count.load() < job_queue_running_max` 判断是否还有并发空位；有则执行 `SELECT run_id, target_kind FROM job_runs WHERE status='waiting' ORDER BY created_at_ms ASC LIMIT runner_batch_size`（**FIFO 按入队时间，每轮最多取 `runner_batch_size` 条候选**），逐条尝试调度——每条在派发前再读一次 `running_count.load() < job_queue_running_max`，仍有空位则 waiting → running 并 `running_count.fetch_add(1)`；一旦计数达到阈值即**中断本批剩余候选**（留待下轮轮询），未取完的候选不发额外信号，靠下轮 `runner_poll_interval_ms` 自然重扫。达到阈值则整轮不调度，后续任务保持 `waiting(等待中)`；任务完成触发 **OnComplete（JobComplete 落库终态）时计数自减（`saturating_sub(1)`，最终不小于 0）**，无需显式释放名额，下轮轮询即获得调度机会。

> **`runner_batch_size` 与 `job_queue_running_max` 的关系（消费定义）**：`job_queue_running_max` 是**总量闸门**（running 总数上限），`runner_batch_size` 是**单轮扫描的候选上限**。二者共同决定每轮实际启动数 = `min(runner_batch_size, job_queue_running_max - running_count, 当前 waiting 总数)`。batch_size 不参与并发总量约束，只限制单轮 SELECT 的行数与循环次数，避免队列积压时一轮把全表 waiting 捞进内存逐条判断；调大只加快空队列吞吐，不突破 running 上限；调小则每轮只取更少候选，靠多轮轮询消化（默认 10，与 running_max 默认值一致，常规场景一轮即满）。

> **waiting → running 的前提（D1 定稿）**：需**入队成功**（单次 OP / Job(target=op) 入 step_records waiting；Job(target=workflow) / 单次 Workflow 完成 engine_start 处理并成功写入首个 dispatch_step）后才置 running；**池满不影响入队**（无空闲 Worker 时任务就留在 step_records waiting，由调度线程稍后指派），**不存在“派发失败由上游重试”**。

**入口接口（Task Runner API）**：

```rust
static RUNNER: OnceLock<Arc<TaskRunner>> = OnceLock::new();

/// 任务执行器（后端调度层，**全局静态单例**，与 Engine / WorkerPool 互经全局访问：
/// add_workflow → 全局 ENGINE.notify；单次 OP → 全局 WORKER_POOL.run_job）
pub struct TaskRunner {
    store: Arc<dyn RunStore>,   // 运行历史（job_runs / step_records）存取句柄
    running_count: AtomicU32,   // 运行中任务数（内存计数，避免每次从 DB 统计；启动时从 DB 初始化，调度自增、OnComplete 自减，saturating 防下溢）
}

impl TaskRunner {
    /// 构造：绑定运行历史存储句柄（App 启动 init() 时创建并 set 进全局 RUNNER）；
    /// 并从 job_runs 统计一次 status IN ('running','terminating') 的记录数作为 running_count 初始值（terminating 等收敛，仍占并发名额）
    pub fn new(store: Arc<dyn RunStore>) -> Self;

    /// 单次 OP 执行：创建 virtual JobRun（job_kind=virtual、triggered_by=single_op、status=waiting），投递后台执行，返回 runId
    pub fn add_op(req: OpRunRequest) -> Result<String, TaskError>;
    /// Job 运行：创建 JobRun（job_kind=persistent、triggered_by=manual|schedule、status=waiting），投递后台执行，返回 runId
    pub fn add_job(req: JobRunRequest) -> Result<String, TaskError>;
    /// Workflow 运行：创建 JobRun（job_kind=virtual、triggered_by=single_workflow、status=waiting），投递后台执行，返回 runId
    pub fn add_workflow(req: WorkflowRunRequest) -> Result<String, TaskError>;
    /// 查询任务状态（对应内部 JobRun 状态）
    pub fn status(run_id: &str) -> TaskStatus;
    /// 常驻轮询线程（App 启动 init() 时 start）：基于内存计数 running_count 判断并发配额
    /// （每轮：running_count.load() < job_queue_running_max →
    ///   SELECT ... FROM job_runs WHERE status='waiting' ORDER BY created_at_ms ASC LIMIT runner_batch_size →
    ///   逐条派发 waiting → running → fetch_add(1)；计数达阈值即中断本批剩余候选）→ 刷新界面状态；
    /// 并**顺带扫描 engine_events WHERE processed=0 且 run 仍 running，按序逐个 process_event（幂等）**（运行中处理失败兜底，见 crud-03 T26）；
    /// 以及**运行中事件补齐**：扫描 running run 中“step_records 有终态但缺 step_completed 事件”的记录，补写并 process_event（见 crud-03 4.3.0 运行中兜底（U13）/ 恢复闭环）
    pub fn start(&self);
}
```

**请求结构体（上游只传 ID，实例查询统一收敛到 Task Runner 内部）**：

```rust
/// 单次 OP 运行请求（job_kind=virtual、triggered_by=single_op）
/// 上游只需传 clientId / opId，Client / Op 实例由 add_op 内部查询后组装 ExecuteRequest
pub struct OpRunRequest {
    pub run_id:    String,                  // 运行实例 id（后端生成）
    pub client_id: String,                  // Client id（Task Runner 内部查 Client 实例）
    pub op_id:     String,                  // OP id（Task Runner 内部查 Op 实例，取当前最新版本）
    pub inputs:    HashMap<String, String>, // 本次运行入参
    pub workspace: PathBuf,                 // 工作区
}

/// Job 运行请求（job_kind=persistent、triggered_by=manual|schedule）
pub struct JobRunRequest {
    pub run_id:    String,                  // 运行实例 id（JobRun id）
    pub job_id:    String,                  // Job 定义（引用 workflow）
    pub inputs:    HashMap<String, String>, // Job 级输入（下发各 step）
    pub workspace: PathBuf,
}

/// Workflow 运行请求（job_kind=virtual、triggered_by=single_workflow）
pub struct WorkflowRunRequest {
    pub run_id:      String,                // 运行实例 id
    pub workflow_id: String,                // workflow 定义（DAG）
    pub inputs:      HashMap<String, String>,
    pub workspace:   PathBuf,
}


/// 任务状态机
pub enum TaskStatus {
    Waiting,     // 等待中
    Running,     // 运行中
    Terminating, // 等待终止（已提交终止、等在跑 OP 收敛）
    Success,     // 成功
    Failed,      // 失败
    Cancelled,   // 已取消（用户终止收敛后的终态）
    Timeout,     // 超时
}
```

**状态机与两个状态迁移触发点**：

```text
waiting(等待中) ──[① 调度开始]──> running(运行中) ──[② 执行完成]──> 终态(success / failed / timeout)
running(运行中) ──[提交终止且存在在跑 OP]──> terminating(等待终止) ──[在跑 OP 全部收敛]──> cancelled
running(运行中) ──[提交终止且无在跑 OP]──> cancelled（直接）
```

- **① waiting → running**：由 **Task Runner 的后台调度线程**完成——任务开始由当前实例的后台线程控制，调度取出任务时即时改写运行历史状态（并在并发配额内启动执行）。此迁移无需外部参与。
- **② running → 终态**：WorkerPool 完成时**同步调用全局完成实现**（入参 ExecuteResult：run_id 在结果内、step_id / activation_seq / retry_seq 随结果携带，无需回查 step_records）——全局 `JobComplete` 更新 job_runs 终态（落库）并供运行历史界面展示；全局 `StepComplete` 回报 Engine 推进 DAG（写 step_completed 事件后立即调全局 ENGINE.process_event），Engine 整体完成时在处理 `workflow_done` / `terminate` 事件时调用全局 `JobComplete` 更新 job_runs 终态（事件持久化 + 单例重启重建，重放幂等）。**不依赖内存回调传递业务**：Task Runner 是**常驻轮询后台线程**，按固定间隔（配置项 `runner_poll_interval_ms` 可配）扫描 DB，读内存计数 `running_count`（计数下降、存在 waiting 任务即调度下一个；任务完成时 OnComplete 已同步自减）。

**执行流程**：

```text
add_op / add_job / add_workflow(req)
  ├─ 1. **全局 waiting 上限检查（crud-04 3.4.6.2「`job_queue_waiting_max` 的语义」）**：`count(*) FROM job_runs WHERE status='waiting'` ≥ 配置项 `job_queue_waiting_max`（`ai-automation.json`，默认 20、可调、上限 1000）→ 直接返回 `Err(TaskError::QueueFull)`（不插记录）；API 层映射为 409 `CONCURRENCY_CONFLICT`
  ├─ 2. 创建运行历史（JobRun）：job_kind（persistent/virtual）与 triggered_by 按入口确定，状态 waiting(等待中)，
  │      **job_id：persistent 写被运行的 jobs.job_id；virtual（单次 OP / 单次 Workflow）写后端生成的一次性占位 UUID（32 位）**（无对应 `jobs` 行、不加强外键，仅作快照/关联键，见 3.5.1 字段表），
  │      name 按来源写入（add_op → op.name；add_workflow → workflow.name；add_job → jobs.name），
  │      **检查与插入在同一事务（`BEGIN IMMEDIATE`）内**（先查后插，防与 cron / 手动 / rerun / retry 并发击穿）；
  │      写入 job_runs（crud-05 立即可见）；每调用一次入口即插入一条记录
  ├─ 3. 投递后台调度线程，接口即结束，返回 {runId}
  │     后台调度线程（每轮 runner_poll_interval_ms，按入库 FIFO）:
  │       ├─ ① 候选批次：SELECT run_id, target_kind FROM job_runs WHERE status='waiting'
  │       │                 ORDER BY created_at_ms ASC LIMIT runner_batch_size   // 每轮最多取 batch_size 条
  │       ├─ 逐条遍历候选（每条派发前重读并发位）:
  │       │     ├─ running_count.load() < job_queue_running_max？否 → **中断本批剩余候选**（留待下轮，靠 OnComplete 自减后下轮重扫）
  │       │     └─ 是 → ② 取出任务：**先成功入队**（单次 OP / Job(target=op) 写 step_records waiting；Job(target=workflow) / 单次 Workflow 写入首个 dispatch_step 并入队首个 OP）→ 运行历史状态 waiting → running（本线程完成）→ running_count.fetch_add(1)；**入队失败（DB 错误）即使任务重试（T26）；池满不算失败**（OP 在 step_records 排队等 Worker）
  │       ├─ 按任务类型分派（Task Runner 不亲自执行 OP，直接以入口函数调用）:
  │       │     ├─ 单次 OP（add_op）:
  │       │     │     内部按 client_id/op_id 查询实例 → 组装 ExecuteRequest
  │       │     │     → worker.run_job(req)    // 只插 step_records(waiting) 即返回；调度线程指派 Worker 执行，完成后调 JobComplete
  │       │     ├─ Job（add_job）→ **按 target 类型分流**:
  │       │     │     ├─ target_kind=op: 与单次 OP 一致 —— 按 client_id/op_id 查询实例 → 组装 ExecuteRequest → worker.run_job(req)
  │       │     │     └─ target_kind=workflow: engine.notify(EngineStart{run_id, workflow_id})  // **engine.notify 仅限 workflow 类执行**；若该 Run 由 [重试]（3.5.8）创建，则 EngineStart 另带 `resumeFromRecordId`（续跑种子）
  │       │     └─ 单次 Workflow（add_workflow）:
  │       │           engine.notify(EngineStart{run_id, workflow_id})  // 实例方法 &self，异步入口，不阻塞；由 [重试]（3.5.8）创建的 Run 另带 resumeFromRecordId（续跑种子）
  │       │           → Engine 消费 step_completed 事件链式推进：按 DAG 找后继就绪节点 → 写 dispatch_step → worker.run_step(req, inst)    // 只插 step_records(waiting)；Worker 执行完调 StepComplete
  │       │           （Engine / WorkerPool 入口定义见 crud-03 4.3 / 4.4；WorkerPool 任务在 step_records 排队，Worker 执行完同步调 on_complete）
  │       └─ ② WorkerPool 完成同步调全局实现（JobComplete 落库 / StepComplete 写事件后调全局 ENGINE）→ Engine 整体完成（处理 workflow_done / terminate 事件）调全局 JobComplete 落库：
  │             OnComplete（JobComplete 更新 job_runs 终态）→ running_count.saturating_sub(1)（不小于 0）
  │             终止路径：提交终止 → 若存在在跑 OP，job_run running → terminating（计数不增减，仍占并发名额）；
  │             在跑 OP 全部收敛 → 落 cancelled（saturating_sub(1)）
  │             Runner 常驻轮询线程按固定间隔扫描 DB（不依赖回调）：
  │             读 running_count.load() < job_queue_running_max 且 DB 存在 waiting → 调度下一个，刷新界面
  └─ 4. 接口返回 {runId}
```

**同步 vs 异步**：
- **OP execute / Job run / Workflow run**：**异步**——`add_op` / `add_job` / `add_workflow` 在内部写入一条 `waiting(等待中)` 运行记录后返回 runId 即结束；后台线程按入库顺序调度分派（**单次 OP / Job(target=op) 直接调 `worker.run_job(req)`；Job(target=workflow) / 单次 Workflow 调 `engine.notify(EngineStart{run_id, workflow_id})`——engine.notify 仅限 workflow 类执行，Job target=op 时不得走 Engine**（均为实例方法 &self、异步入口、不阻塞；EngineStart 作为 engine_start 事件写入 engine_events 落库，重启不丢；**[重试]（3.5.8）创建的 Run 在 EngineStart 内带 `resumeFromRecordId` 续跑种子——Engine 以该失败/超时 step 为起点续跑（已完成节点不重复执行、不写入新 Run 的 `step_records`），**不是从头启动**，机制见 crud-03 4.3.4「重试种子（resume seed）」**）；`run_job` / `run_step` 只插 step_records(waiting) 即返回（任务入 DB 排队，重启不丢），返回 `WorkerHandle`（定义见 crud-03 4.4），**仅**用于该 OP 自身 `timeoutSeconds` 到期时按进程组终止；**用户终止不使用 `WorkerHandle.abort`**（终止 = 停止派发 + 等待在跑 OP 自然收敛，见 4.7 与 crud-03 4.4）），由 Runner 常驻轮询扫描 DB 驱动调度、自动刷新界面状态。
- **client test**：**例外（不入队、不入历史）**——不投递 Task Runner、不入队，在同一 Worker 任务内 `await` `Executor::execute`（对该 Worker 语义上阻塞，不占用额外线程）并实时返回，且不建 JobRun/step_record、不进运行历史（见 crud-01 3.1.6）。
- **OP 超时计时起点**：`op.timeoutSeconds` **自子进程实际启动（spawn）起算**（`waiting → running` 置位仅表示已指派），池满排队时长与 spawn 前准备期**不计入**（详见 crud-01 5.1 步骤 7、crud-03 4.4）。

---
### 4.7 终止

```text
POST /api/runs/{runId}/terminate
  │
  ├─ 前置校验（**判定依据 = step 状态**）：target=OP 且该 OP 步骤已 `running` → 409 RUN_NOT_TERMINABLE（OP 开始后不可终止；step 仍 waiting 排队则允许）
  ├─ **按 target 类型分流**：
  │     ├─ target=op（单次 OP / Job(target=op)）：**无 Engine**——waiting 中 step 直接置 cancelled（条件更新）；无在跑 OP → job_run 落 cancelled 终态
  │     └─ target=workflow（单次 Workflow / Job(target=workflow)）: engine.notify(Terminate{run_id, reason}) → 写 terminate 事件 → process_event(terminate):
  │           ├─ **不 kill 正在运行的 OP**（OP 最小执行单位，运行中不可外部终止）
  │           ├─ 置终止意图：停止派发新步骤；**仍在 waiting（含 DB 排队中待指派）的 step 直接置 cancelled**（条件更新；排队中的 OP 未开始执行，可直接取消）。**去重口径（M17）**：该条件更新（与 `inflight_count` 递减）**唯一实现在 `process_event(terminate)` 内、每个 run 只执行一次**；WorkerPool 的 `abort_run`（crud-03 4.4）只负责停止派发、**不重复执行该 UPDATE**，避免 inflight_count 双次递减
  │           ├─ **若存在在跑 OP → job_run.status = terminating（等待终止，界面显示"终止中"）**（落库）
  │           └─ **等所有在跑 OP 自然收敛后** → 标记 job_run.status = cancelled + finished_at_ms（落库）
  └─ 之后到达的 step_completed（在跑 OP 完成）→ run 已有终止意图 → 不再派发后继 → 收敛后落终态
```

> **行为确认**：① 不 kill 策略下，终止请求提交后运行历史显示 **terminating（终止中）**（等 OP 自然跑完才落 cancelled），不再与 running（运行中）混淆——为「不中途强杀」的固有代价（接受）；② 单 OP Job 开始运行后终止请求被拒（409 `RUN_NOT_TERMINABLE`，见上）。

### 4.8 重跑 vs 重试

| 维度 | 重跑 (rerun) | 重试 (retry) |
|-|-|-|
| 版本 | 用最新版本 | 必须版本一致 |
| 起点 | 从头开始（重新执行全部节点） | 从失败 step 开始（**以该 step 为续跑种子**：已完成节点不重复执行、不写入新 Run 的 `step_records`，见 3.5.8 / crud-03 4.3.4「重试种子」） |
| 前提 | 仅终态（success / failed / timeout / cancelled）；**waiting / running / terminating 不可**（三者均未结束） | **can-retry 五条件**：① target=Workflow；② 目标 Workflow 仍存在；③ Run 已结束（failed / timeout / cancelled）且存在失败/超时 step；④ 版本一致；⑤ Workflow.needsUpdate=false 且 Job.needsUpdate=false（超时结束也可手动重试超时 step；**cancelled 且含失败/超时 step 也可重试**；Job 已删 → Job.needsUpdate 视为 false） |
| triggeredBy | manual | retry |
| 溯源字段 | **不写** `retry_from_run_id` / `retry_from_record_id`（均 `NULL`） | 写 `retry_from_run_id` = 源 Run、`retry_from_record_id` = 源失败/超时 **StepRecord 主键**（D17） |

**can-retry 检查（五条件，与 3.5.9 逐条对齐）**：
1. **target=Workflow**（否则 `false`，reason「仅 Workflow 支持重试。」）
2. **目标 Workflow 仍存在**（已删除 → `false`，reason「目标（Workflow）已删除，无法重试。」）
3. **原 Run 已结束**（**waiting / running / terminating 直接 false**）**且** 原 Run.status ∈ failed / timeout / cancelled，**且存在失败或超时的 step**（success 为 false；cancelled 但终止前无任何失败/超时 step 也为 false）
4. **版本一致**：原 target 的当前版本 == 原 Run 记录的版本
5. **无 needsUpdate**：Workflow.needsUpdate=false **且** Job.needsUpdate=false（**Job 已删 → 视为 false**）
