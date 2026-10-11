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
| POST | `/api/runs/{runId}/retry` | — | `{runId}` | 从失败 step 重试 |
| GET | `/api/runs/{runId}/can-retry` | — | `{canRetry:bool, reason:string}` | 检查前提条件 |
| POST | `/api/runs/export` | `{filters, filePath}` | `{filePath}` | 导出 Excel |

**JobRun 对象**：
```json
{
  "runId": "...",
  "name": "hourly_job",
  "jobId": "...",
  "jobKind": "persistent",
  "jobVersion": 1,
  "triggeredBy": "schedule",
  "target": {"kind":"workflow","opId":null,"opVersion":null,"workflowId":"...","workflowVersion":1,"name":"hourly_check"},
  "inputs": {"env":"prod"},
  "workspace": "/path/ws-003",
  "status": "failed",
  "terminatedBy": null,
  "timeoutStepId": null,
  "timeoutOpName": null,
  "steps": [StepRecord...],
  "retryFromRunId": null,
  "retryFromStepId": null,
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
  "stepId": "1b2c3d4e5f60718293a4b5c6d7e8f9a1",  // workflow_node.node_id (32 位 UUID)
  "activationSeq": 1,   // 第几次激活（首次=1；循环回跳重入 +1）
  "retrySeq": 1,   // activation 内第几次尝试（含首次；首次=1，apply_retry +1）
  "opId": "...",
  "opVersion": 2,
  "opName": "check_tests",
  "clientId": "...",
  "status": "failed",
  "inputs": {"env":"prod"},
  "bodySnapshot": "在当前工作区运行测试...",
  "outputs": null,
  "rawOutput": "...",
  "exitCode": 1,
  "error": "test failed",
  "timeoutMs": 300000,
  "timedOut": false,
  "startedAtMs": "...",
  "finishedAtMs": "...",
  "durationMs": 5200
}
```

**时间筛选**：`?timeRange=last_2d|last_3d|last_5d|custom&startMs=&endMs=`

**导出 Excel**：
- Sheet1 "运行历史"：runId, name, jobId, jobKind, jobVersion, triggeredBy, workspace, status, terminatedBy, startedAtMs, finishedAtMs, durationMs（name 为 JobRun 名称快照，见字段说明）
- Sheet2 "运行明细"：recordId, jobId, stepId, activationSeq, retrySeq, opId, opVersion, opName, clientId, status, exitCode, inputs(JSON), bodySnapshot, outputs(JSON), rawOutput, timedOut, startedAtMs, finishedAtMs, durationMs
- 文件名：`job_result-{yyyyMMddHHmmssSSS}-{jobResultCount}.xlsx`；时间戳在前（便于按导出时序排序）、`jobResultCount` = 本次导出的运行历史条数（Sheet1 行数）
- 由后端生成文件写入用户指定目录（前端传目录路径）。

**JobRun 对象字段说明**：

| 字段 | 类型 | 说明 |
|-|-|-|
| runId | string(32 位 UUID) | Run 标识 |
| name | string | 运行名称快照：persistent = jobs.name；virtual（single_op / single_workflow）= op.name / workflow.name（= target.name） |
| jobId | string(32 位 UUID) | 所属 Job |
| jobKind | enum | `persistent` / `virtual` |
| jobVersion | integer | Job 版本 |
| triggeredBy | enum | `manual` / `schedule` / `single_op` / `single_workflow` / `retry` |
| target | object | 目标快照：`{kind, opId, opVersion, workflowId, workflowVersion, name}`（拆列存储于 target_kind / target_id / target_version / target_name；Client 信息在步骤层 step_records.client_id 记录） |
| inputs | object | 本次执行入参 |
| workspace | string | 工作区 |
| status | enum | `waiting` / `running` / `terminating`（等待终止：已提交终止、停止派发、等在跑 OP 收敛）/ `success` / `failed` / `cancelled` / `timeout` |
| terminatedBy | enum \| null | `timeout` / `cancelled` / `error` |
| timeoutStepId | string \| null | 超时节点 stepId |
| timeoutOpName | string \| null | 超时节点引用 OP 名称 |
| steps | StepRecord[] | 步骤列表 |
| result | object \| null | 运行结果（**不落库、详情接口按 steps 聚合**）：target.kind=op → OpRunResult；=workflow → WorkflowRunResult |
| retryFromRunId / retryFromStepId | string \| null | 重试溯源 |
| startedAtMs / finishedAtMs | string \| null | 起止时间（waiting 时均 null；running 时 finishedAtMs 为 null） |
| durationMs | integer \| null | 耗时（毫秒；终态才有值） |
| createdAtMs | string | 创建时间（job_runs.created_at_ms） |
| updatedAtMs | string | 最后状态更新时间（job_runs.updated_at_ms；每次状态写入刷新，供 3.5.3 轮询） |

> **已删除 Job 的 Run 展示（#3/#6）**：以名称快照 `name` 展示 Job 名称（不 join `jobs`）；**可查看详情**（基于 Run 数据），**不可跳转到 Job 定义**；[重跑] 需 target（op/workflow）仍存在（否则 404 `TARGET_NOT_FOUND`）；[重试] 仅依赖 target=workflow 及五条件（Job 已删 → Job.needsUpdate 视为 false）。

---

### 3.5.0 通用约定

> 以下为运行历史全部 API 的完整 HTTP 定义。通用约定：
> - 基础路径 `/api`；路径参数中的 `runId` 为 32 位无连字符 UUID。
> - 时间字段 JSON 中统一为 string（毫秒时间戳）。
> - 列表分页 `page` / `page_size`（`page_size` ∈ 10 / 50 / 100 / 1000，默认 10）。
> - 错误响应统一格式 `{"error":{"code":"...","message":"..."}}`。

**字段命名 ↔ 数据库列映射**（API 字段 camelCase ↔ `schema.sql` 列 snake_case）：

| API 字段 | 数据库列 | 说明 |
|-|-|-|
| `JobRun.runId` | `job_runs.run_id` | 主键，32 位 UUID |
| `JobRun.jobId` | `job_runs.job_id` | 引用 jobs.job_id |
| `JobRun.name` | `job_runs.name` | 运行名称快照（persistent = jobs.name；virtual = op.name / workflow.name） |
| `JobRun.target` | `job_runs.target_kind / target_id / target_version / target_name` | 拆列存储（快照） |
| `JobRun.status` | `job_runs.status` | 含 `terminating` 中间态 |
| `JobRun.terminatedBy` / `timeoutStepId` / `timeoutOpName` | `job_runs.terminated_by` / `timeout_step_id` / `timeout_op_name` | 终止 / 超时快照 |
| `JobRun.startedAtMs` / `finishedAtMs` / `durationMs` | `job_runs.started_at_ms` / `finished_at_ms` / `duration_ms` | 时间与耗时 |
| `JobRun.createdAtMs` / `updatedAtMs` | `job_runs.created_at_ms` / `job_runs.updated_at_ms` | 创建时间 / 最后状态更新时间 |
| `JobRun.result` | —（**不落库**） | 详情接口由 `step_records` 聚合得出 |
| `StepRecord.recordId` | `step_records.record_id` | 主键，32 位 UUID |
| `StepRecord.stepId` | `step_records.step_id` | 等于 workflow_nodes.node_id |
| `StepRecord.runId` | `step_records.run_id` | 引用 job_runs.run_id |
| `StepRecord.activationSeq` | `step_records.activation_seq` | 第几次激活（循环回跳重入 +1；重试不递增） |
| `StepRecord.retrySeq` | `step_records.retry_seq` | activation 内第几次尝试（含首次；apply_retry +1） |

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
| triggeredBy | query | string | 否 | — | 触发来源：manual/schedule/single_op/single_workflow/retry |
| status | query | string | 否 | — | 状态：waiting/running/terminating/success/failed/cancelled/timeout |
| workspace | query | string | 否 | — | 工作区 |
| jobKind | query | string | 否 | — | 来源：persistent/virtual |
| version | query | string | 否 | — | 版本号，按 **`job_version`**（Job 修订号）精确等值过滤——非 target 快照版本（OP / Workflow 的 target_version）；若需按快照版本过滤暂不支持（可用 `keyword` 检索目标名称辅助定位） |
| timeRange | query | string | 否 | — | `last_2d` / `last_3d` / `last_5d` / `custom` |
| startMs | query | string | 条件 | — | timeRange=custom 时必填（毫秒时间戳） |
| endMs | query | string | 条件 | — | timeRange=custom 时必填 |
| sort | query | string | 否 | `-startedAtMs` | 排序字段：startedAtMs/durationMs/createdAtMs，`-` 前缀降序 |

**请求体**：无

**成功响应 `200 OK`**：

```json
{ "items": [ JobRun, ... ], "total": 6, "page": 1, "page_size": 10 }
```

**错误响应**：400 `VALIDATION_ERROR`（page_size/status/triggeredBy/timeRange/sort 取值非法，或 timeRange=custom 缺 startMs/endMs）。

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

**错误响应**：404 `RUN_NOT_FOUND`。

---

### 3.5.4 GET /api/runs/{runId}/steps —— 步骤列表

**功能说明**：查询 Run 的全部步骤记录（含因重试 / 循环回跳产生的多条），按执行先后排序（`(activation_seq, retry_seq)` 升序），用于详情页逐步展示。

**路径参数**：`runId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：`StepRecord[]`（含重试 / 循环回跳产生的多条记录，按 `(activation_seq, retry_seq)` 升序）。

**错误响应**：404 `RUN_NOT_FOUND`。

---

### 3.5.5 GET /api/runs/{runId}/steps/{stepId} —— 单步骤多次执行记录

**功能说明**：查询某 step 因**重试 / 循环回跳**产生的全部执行记录，按执行降序（最新在上，即 `(activation_seq, retry_seq)` 降序），用于对比每次尝试的结果。**判断该 step 的最终结果（成败 / 是否需重试 / 是否已达上限）一律以「最后一条记录」（即 `(activation_seq, retry_seq)` 最大者）为准**（D3 拍板）。

**路径参数**：

| 参数 | 类型 | 必填 | 说明 |
|-|-|-|-|
| runId | string(32 位 UUID) | 是 | Run 标识 |
| stepId | string | 是 | 步骤 ID（等于 workflow_node.node_id） |

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：`StepRecord[]`，该 step 因重试 / 循环回跳产生的全部记录，按 `(activation_seq, retry_seq)` 降序（最新的在最上面）。

**错误响应**：400 `VALIDATION_ERROR`；404 `RUN_NOT_FOUND` / `STEP_NOT_FOUND`。

---

### 3.5.6 POST /api/runs/{runId}/terminate —— 终止 Run

**功能说明**：终止 Run。**按 target 类型分两类语义**：

- **target=OP（单次 OP run）**：
  - `waiting`（未开始）→ 可直接终止，落 `cancelled`（无在跑 OP）；
  - **`running`（运行中）→ 不支持终止**——OP 是最小原子执行单元，运行中不可外部终止（返回 409 `RUN_NOT_TERMINABLE`）；**界面表现：终止按钮置灰 / 点击提示「终止失败：OP 正在运行，不可终止」**。
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
| 400 | `VALIDATION_ERROR` | runId 格式非法，或 Run 已处于终态（不可终止） |
| 409 | `RUN_NOT_TERMINABLE` | target=OP 且该 OP 已开始运行（OP 运行中不可终止） |
| 404 | `RUN_NOT_FOUND` | runId 不存在 |

> Run 处于 `terminating`（等待终止）时重复提交 terminate → **幂等返回 200 ok**（已有终止意图，无需重复处理）。

---

### 3.5.7 POST /api/runs/{runId}/rerun —— 重跑 Run

**功能说明**：使用最新版本从头重跑（新建 JobRun，从头执行），适用于原 Run 失败或需按新版本重新执行的场景。**前置约束：仅已结束（终态）的 Run 可重跑——`success` / `failed` / `timeout` / `cancelled`；`waiting`（等待中）/ `running`（运行中）不可重跑**。

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
| 409 | `CONCURRENCY_CONFLICT` | 全局 waiting 队列达 settings `job_queue_waiting_max`（默认 20、可调、上限 1000）上限（新建 JobRun 前统一检查，见 crud-04 3.4.6 #3） |
| 404 | `RUN_NOT_FOUND` / `TARGET_NOT_FOUND` | runId 不存在 / 目标（op / workflow）已删除 |

> **原子性（#4）**：检查（终态 + 全局 waiting 上限）与创建 JobRun 在**同一事务（`BEGIN IMMEDIATE`）**内先查后插，语义同 crud-04 3.4.6。

---

### 3.5.8 POST /api/runs/{runId}/retry —— 从失败 step 重试

**功能说明**：从失败 step 处重试（前提：版本一致、无 needsUpdate、存在失败/超时 step），复用上下文继续后续节点。**超时导致的 Run 结束也可手动重试超时的 step**（自动重试语义：**Workflow 节点**的 `retry.on` 不含 timeout，超时不触发自动重试，见 crud-03 节点 retry 配置及 4.3.2）。**用户终止（cancelled）且含失败/超时 step 的 Run 也可手动重试**（该 step 之后的节点按 DAG 继续）。**terminating（未收敛）不可重试**。

**路径参数**：`runId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
{ "runId": "a1b2c3d4e5f67890abcdef1234567890" }
```

> 前提见 4.8：仅 target=Workflow、失败（含超时）、版本一致、无 needsUpdate、存在失败/超时 step。重试前建议先调用 can-retry 校验。
>
> **原子性（#4）**：与 3.4.6 同语义——全局 waiting 计数检查与创建 JobRun 在**同一事务（`BEGIN IMMEDIATE`）**内先查后插，防与 cron / 手动运行并发时击穿。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 404 | `RUN_NOT_FOUND` | runId 不存在 |
| 409 | `RETRY_NOT_ALLOWED` | 不满足前提（如版本不一致/needsUpdate/无失败或超时 step） |
| 409 | `CONCURRENCY_CONFLICT` | 全局 waiting 队列达 settings `job_queue_waiting_max`（默认 20、可调、上限 1000）上限（统一检查，见 crud-04 3.4.6 #3） |

---

### 3.5.9 GET /api/runs/{runId}/can-retry —— 检查是否可重试

**功能说明**：预检查是否满足重试前提，返回 `canRetry` 与不可重试原因。前端据此决定展示「重试」还是「重跑」操作。**判断条件与 3.5.8 / 4.8 一致**：target=Workflow、**Run 已结束（failed / timeout / cancelled，且存在失败或超时 step）**、版本一致、无 needsUpdate、存在失败或超时的 step——**超时结束、以及用户终止（cancelled）且含失败/超时 step 的 Run 均可手动重试**；waiting / running / terminating 不可。

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
| Run 未结束，无法重试。 | Run 处于 waiting / running / **terminating**（三者均非终态） |

**错误响应**：404 `RUN_NOT_FOUND`。

---

### 3.5.10 POST /api/runs/export —— 导出 Excel

**功能说明**：按筛选条件将运行历史导出为 Excel（Sheet1 运行历史 + Sheet2 运行明细），由后端生成文件写入前端指定的目录。

**路径参数**：无

**查询参数**：无

**请求体**：

```json
{
  "filters": {"status":"failed","timeRange":"last_5d"},
  "filePath": "/path/to/export_dir",
  "fileName": "job_result-20261007120000000-6.xlsx"
}
```

| 字段 | 类型 | 必填 | 说明 |
|-|-|-|-|
| filters | object | 否 | 与 GET /api/runs 一致的筛选条件 |
| filePath | string | 是 | 导出目标目录路径（后端生成文件写入） |
| fileName | string | 否 | **自定义文件名（D7）**：不传时后端生成默认名 `job_result-{yyyyMMddHHmmssSSS}-{jobResultCount}.xlsx`（时间戳在前、便于按导出时序排序；`jobResultCount` = 本次导出条数 = Sheet1 行数）；**所有导出 UI 的输入框默认预填该默认名且允许用户修改**，修改后的值作为本字段提交 |

**成功响应 `200 OK`**：

```json
{ "filePath": "/path/to/export_dir/job_result-20261007120000000-6.xlsx" }
```

**文件名与边界（C5/D7 定稿）**：

- **同名文件已存在**：**覆盖写入**（导出即最新快照，同路径旧文件被替换；默认名含毫秒时间戳 + 计数，天然规避重名；用户自定义重名时覆盖并在响应 filePath 中体现实际路径）。
- **并发导出**：多次导出互相独立；后端**单进程内按请求顺序串行写文件**，写入采用**原子落盘**（先写 `*.tmp` 临时文件再 rename，避免半成品文件）；同目录并发导出各自独立完成。
- **失败与重试**：写失败返回 500 `INTERNAL_ERROR`，**不自动重试**（错误码含原因：目录不存在 / 权限 / 磁盘满）；前端可在失败提示后由用户重新点击导出。

**错误响应**：400 `VALIDATION_ERROR`（filePath 缺失/非法、fileName 含非法字符（`\ / : * ? " < > |` 或空）、**或 filters 取值非法——与 GET /api/runs 同一校验：status / triggeredBy / timeRange / sort 等枚举、page_size、timeRange=custom 缺 startMs/endMs**）；500 `INTERNAL_ERROR`（写文件失败）。

---

### 4.6 统一任务执行器（Task Runner）

**职责**：所有异步执行（单次 OP、Job 运行、Workflow 运行）统一投递到后端**任务执行器（Task Runner）**。它负责**运行历史（JobRun）的创建与状态机管理、并发控制、按序调度分派**（**常驻轮询后台线程**，按固定间隔扫描 DB，间隔可经 settings 配置）——本章归属运行历史领域：Task Runner 的一切动作都以 `job_runs` / `step_records` 为落点，运行历史界面的状态（等待中 / 运行中 / 终止中 / 终态）完全由它驱动。**Task Runner 不亲自执行 OP**：单次 OP 任务直接调用 WorkerPool 执行；Job / Workflow 任务先通知 Engine 启动，由 Engine 顺序调度各 OP、再交给 WorkerPool 执行。**任务控制不在 Job 业务层，而在本执行器**；Job 管理与单次 OP 只是「创建 JobRun 并提交任务」的入口。

**与 Executor / Engine / WorkerPool 的分工**：

| 层 | 归属文档 | 职责 | 并行关系 |
| - | - | - | - |
| **Executor** | crud-01 第 5.1 节 | 最小原子执行单元，执行**一个 OP**，返回 `ExecuteResult`（归属 Client 层：client 提供执行能力） | — |
| **Task Runner** | 本章 4.6 | 调度层：创建并管理 **JobRun 生命周期**（waiting / running / terminating / 终态）、并发控制、按序调度分派 | — |
| **Engine** | crud-03 第 4.3 节 | workflow DAG 调度（并行后台任务）：**异步入口 `engine.notify(EngineStart)`（实例方法 &self）——消息即事件：EngineStart / Terminate 先写 engine_events 落库，**写后立即 `process_event` 同步处理**（无事件循环 / 无信号）**，按 DAG 顺序决定下一步执行哪个 OP 并派发给 WorkerPool；整体完成时在处理 `workflow_done` / `terminate` 事件时调用**全局 JobComplete** 更新 job_runs 终态（事件持久化 + 单例重启重建，重放幂等） | 与 WorkerPool 并行（互不嵌套） |
| **WorkerPool** | crud-03 第 4.4 节 | 单个 OP 的实际执行（**数据库排队 + Worker 池**：`worker.run_job(req)` / `worker.run_step(req, inst)`（实例方法 &self）**总是**在 step_records 插入 waiting 记录（含 activation_seq / retry_seq）即返回（**池满不报错**）；WorkerPool 调度线程常驻轮询 waiting → 指派空闲 Worker（**池大小 = `ceil(job_queue_running_max × 1.5)`，与 Runner 并发阈值无关**）→ 执行 Executor → 更新 step_records 终态+结果）；完成回调为**全局实现**（`JobComplete` 更新终态、`StepComplete` 写事件后调全局 ENGINE 推进），Worker 执行完**同步调用**；WorkerPool 不感知业务 | 与 Engine 并行（互不嵌套） |

> Engine 与 WorkerPool 是两个**互相并行**的后台组件（分别在 crud-03 4.3 / 4.4 描述），不是「Engine 套 WorkerPool」的嵌套关系；Task Runner 与它们也并行——Runner 只管队列与状态，不参与任何实际执行。

**并发控制**：Task Runner 控制**同时运行的任务数量**（**并发阈值 = settings `job_queue_running_max`（默认 10、上限 10）**；与 Worker 池大小 `worker_pool_size`（= `ceil(job_queue_running_max × 1.5)`，默认 10 阈值 → 15 个 Worker，只读派生；**一个 JobRun 可并行多个 step，故池大小需大于并发阈值**，见 crud-03 4.4 / crud-06 一）**是两个独立概念**）。运行中的任务数由 **TaskRunner 内存计数 `running_count: AtomicU32`** 维护——**启动时（new/init）从 `job_runs` 统计一次 `status=running` 或 `terminating` 的记录数作为初始值**（terminating 等待终止、在跑 OP 未释放，仍占并发名额；**临时 Job（单次 OP / Workflow 运行的 virtual JobRun）也是 Job，同样计入并发**）；此后**每次轮询只读内存计数（`load`），不再每次从 DB 统计，减少 DB I/O**。调度规则：`running_count.load() < job_queue_running_max` 时扫描 DB 中 `waiting` 任务并触发运行、计数自增（`fetch_add(1)`）；达到上限则暂停调度，后续任务保持 `waiting(等待中)`；任务完成触发 **OnComplete（JobComplete 落库终态）时计数自减（`saturating_sub(1)`，最终不小于 0）**，无需显式释放名额，轮询即获得调度机会。

> **waiting → running 的前提（D1 定稿）**：需**入队成功**（单次 OP 入 step_records waiting；Job / Workflow 完成 engine_start 处理并成功写入首个 dispatch_step）后才置 running；**池满不影响入队**（无空闲 Worker 时任务就留在 step_records waiting，由调度线程稍后指派），**不存在“派发失败由上游重试”**。

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

    /// 单次 OP 执行：创建 virtual JobRun（kind=single_op，status=waiting），投递后台执行，返回 runId
    pub fn add_op(req: OpRunRequest) -> Result<String, TaskError>;
    /// Job 运行：创建 JobRun（kind=job，status=waiting），投递后台执行，返回 runId
    pub fn add_job(req: JobRunRequest) -> Result<String, TaskError>;
    /// Workflow 运行：创建 JobRun（kind=workflow，status=waiting），投递后台执行，返回 runId
    pub fn add_workflow(req: WorkflowRunRequest) -> Result<String, TaskError>;
    /// 查询任务状态（对应内部 JobRun 状态）
    pub fn status(run_id: &str) -> TaskStatus;
    /// 常驻轮询线程（App 启动 init() 时 start）：基于内存计数 running_count 判断并发配额
    /// （running_count.load() < job_queue_running_max → 扫描 DB waiting → 调度 waiting → running → fetch_add(1)）→ 刷新界面状态；
    /// 并**顺带扫描 engine_events WHERE processed=0 且 run 仍 running，按序逐个 process_event（幂等）**（运行中处理失败兜底，见 crud-03 T26）；
    /// 以及**运行中事件补齐**：扫描 running run 中“step_records 有终态但缺 step_completed 事件”的记录，补写并 process_event（见 crud-03 U13）
    pub fn start(&self);
}
```

**请求结构体（上游只传 ID，实例查询统一收敛到 Task Runner 内部）**：

```rust
/// 单次 OP 运行请求（kind=single_op，virtual JobRun）
/// 上游只需传 clientId / opId，Client / Op 实例由 add_op 内部查询后组装 ExecuteRequest
pub struct OpRunRequest {
    pub run_id:    String,                  // 运行实例 id（后端生成）
    pub client_id: String,                  // Client id（Task Runner 内部查 Client 实例）
    pub op_id:     String,                  // OP id（Task Runner 内部查 Op 实例，取当前最新版本）
    pub inputs:    HashMap<String, String>, // 本次运行入参
    pub workspace: PathBuf,                 // 工作区
}

/// Job 运行请求（kind=job）
pub struct JobRunRequest {
    pub run_id:    String,                  // 运行实例 id（JobRun id）
    pub job_id:    String,                  // Job 定义（引用 workflow）
    pub inputs:    HashMap<String, String>, // Job 级输入（下发各 step）
    pub workspace: PathBuf,
}

/// Workflow 运行请求（kind=workflow）
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
- **② running → 终态**：WorkerPool 完成时**同步调用全局完成实现**（入参 ExecuteResult：run_id 在结果内、step_id / activation_seq / retry_seq 随结果携带，无需回查 step_records）——全局 `JobComplete` 更新 job_runs 终态（落库）并供运行历史界面展示；全局 `StepComplete` 回报 Engine 推进 DAG（写 step_completed 事件后立即调全局 ENGINE.process_event），Engine 整体完成时在处理 `workflow_done` / `terminate` 事件时调用全局 `JobComplete` 更新 job_runs 终态（事件持久化 + 单例重启重建，重放幂等）。**不依赖内存回调传递业务**：Task Runner 是**常驻轮询后台线程**，按固定间隔（settings 可配）扫描 DB，读内存计数 `running_count`（计数下降、存在 waiting 任务即调度下一个；任务完成时 OnComplete 已同步自减）。

**执行流程**：

```text
add_op / add_job / add_workflow(req)
  ├─ 1. **全局 waiting 上限检查（crud-04 3.4.6 #3）**：`count(*) FROM job_runs WHERE status='waiting'` ≥ settings `job_queue_waiting_max`（默认 20、可调、上限 1000）→ 直接返回 `Err(TaskError::QueueFull)`（不插记录）；API 层映射为 409 `CONCURRENCY_CONFLICT`
  ├─ 2. 创建运行历史（JobRun）：kind/triggeredBy 按入口确定，状态 waiting(等待中)，
  │      name 按来源写入（add_op → op.name；add_workflow → workflow.name；add_job → jobs.name），
  │      **检查与插入在同一事务（`BEGIN IMMEDIATE`）内**（先查后插，防与 cron / 手动 / rerun / retry 并发击穿）；
  │      写入 job_runs（crud-05 立即可见）；每调用一次入口即插入一条记录
  ├─ 3. 投递后台调度线程，接口即结束，返回 {runId}
  │     后台调度线程（按入库顺序）:
  │       ├─ 检查并发：running_count.load() < job_queue_running_max（阈值）？否则保持 waiting 等待
  │       ├─ ① 取出任务：**先成功入队**（单次 OP 写 step_records waiting；Job / Workflow 写入首个 dispatch_step 并入队首个 OP）→ 运行历史状态 waiting → running（本线程完成）→ running_count.fetch_add(1)；**入队失败（DB 错误）即使任务重试（T26）；池满不算失败**（OP 在 step_records 排队等 Worker）
  │       ├─ 按任务类型分派（Task Runner 不亲自执行 OP，直接以入口函数调用）:
  │       │     ├─ 单次 OP（add_op）:
  │       │     │     内部按 client_id/op_id 查询实例 → 组装 ExecuteRequest
  │       │     │     → worker.run_job(req)    // 只插 step_records(waiting) 即返回；调度线程指派 Worker 执行，完成后调 job_complete
  │       │     └─ Job / Workflow（add_job / add_workflow）:
  │       │           engine.notify(EngineStart{run_id, workflow_id})  // 实例方法 &self，异步入口，不阻塞
  │       │           → Engine 消费 step_completed 事件链式推进：按 DAG 找后继就绪节点 → 写 dispatch_step → worker.run_step(req, inst)    // 只插 step_records(waiting)；Worker 执行完调 step_complete
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
- **OP execute / Job run / Workflow run**：**异步**——`add_op` / `add_job` / `add_workflow` 在内部写入一条 `waiting(等待中)` 运行记录后返回 runId 即结束；后台线程按入库顺序调度分派（**单次 OP 直接调 `worker.run_job(req)` / Job·Workflow 调 `engine.notify(EngineStart{run_id, workflow_id})`（均为实例方法 &self、异步入口、不阻塞；EngineStart 作为 engine_start 事件写入 engine_events 落库，重启不丢）**；`run_job` / `run_step` 只插 step_records(waiting) 即返回（任务入 DB 排队，重启不丢），返回 `WorkerHandle`（定义见 crud-03 4.4），**仅**用于该 OP 自身 `timeoutMs` 到期时按进程组终止；**用户终止不使用 `WorkerHandle.abort`**（终止 = 停止派发 + 等待在跑 OP 自然收敛，见 4.7 与 crud-03 4.4）），由 Runner 常驻轮询扫描 DB 驱动调度、自动刷新界面状态。
- **client test**：**同步例外**——不投递 Task Runner、不入队，直接同步调 `Executor::execute` 实时返回，且不建 JobRun/step_record、不进运行历史（见 crud-01 3.1.6）。
- **OP 超时计时起点**：`op.timeoutMs` **自子进程实际启动（spawn）起算**（`waiting → running` 置位仅表示已指派），池满排队时长与 spawn 前准备期**不计入**（详见 crud-01 5.1 步骤 7、crud-03 4.4）。

---
### 4.7 终止

```text
POST /api/runs/{runId}/terminate
  │
  ├─ 前置校验：target=OP 且该 OP 步骤已 running → 409 RUN_NOT_TERMINABLE（OP 开始后不可终止）
  ├─ engine.notify(Terminate{run_id, reason}) → 写 terminate 事件 → process_event(terminate):
  │     ├─ **不 kill 正在运行的 OP**（OP 最小执行单位，运行中不可外部终止）
  │     ├─ 置终止意图：停止派发新步骤；**仍在 waiting（含 DB 排队中待指派）的 step 直接置 cancelled**（条件更新；排队中的 OP 未开始执行，可直接取消）
  │     ├─ **若存在在跑 OP → job_run.status = terminating（等待终止，界面显示"终止中"）**（落库）
  │     └─ **等所有在跑 OP 自然收敛后** → 标记 job_run.status = cancelled + finished_at_ms（落库）
  └─ 之后到达的 step_completed（在跑 OP 完成）→ run 已有终止意图 → 不再派发后继 → 收敛后落终态
```

> **行为确认**：① 不 kill 策略下，终止请求提交后运行历史显示 **terminating（终止中）**（等 OP 自然跑完才落 cancelled），不再与 running（运行中）混淆——为「不中途强杀」的固有代价（接受）；② 单 OP Job 开始运行后终止请求被拒（409 `RUN_NOT_TERMINABLE`，见上）。

### 4.8 重跑 vs 重试

| 维度 | 重跑 (rerun) | 重试 (retry) |
|-|-|-|
| 版本 | 用最新版本 | 必须版本一致 |
| 起点 | 从头开始 | 从失败 step 开始 |
| 前提 | 仅终态（success / failed / timeout / cancelled）；**waiting / running / terminating 不可**（三者均未结束） | can-retry: 版本一致 + 无需更新 + 存在失败/超时 step（超时结束也可手动重试超时 step；**cancelled 且含失败/超时 step 也可重试**） |
| triggeredBy | manual | retry |

**can-retry 检查**：
1. 原 Run 已结束（**waiting / running / terminating 直接 false**）
2. 原 Run.status ∈ failed / timeout / cancelled，**且存在失败或超时的 step**（success 为 false；cancelled 但终止前无任何失败/超时 step 也为 false）
3. 原 target 的当前版本 == 原 Run 记录的版本
4. 无 needsUpdate
