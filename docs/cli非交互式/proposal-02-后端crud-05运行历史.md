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
| GET | `/api/runs/{runId}/steps/{stepId}` | — | StepRecord[] | 单步骤多次执行记录 (按时间降序) |
| POST | `/api/runs/{runId}/terminate` | — | `{ok:true}` | 终止运行中 Run |
| POST | `/api/runs/{runId}/rerun` | — | `{runId}` | 重跑 (用最新版本) |
| POST | `/api/runs/{runId}/retry` | — | `{runId}` | 从失败 step 重试 |
| GET | `/api/runs/{runId}/can-retry` | — | `{canRetry:bool, reason:string}` | 检查前提条件 |
| POST | `/api/runs/export` | `{filters, filePath}` | `{filePath}` | 导出 Excel |

**JobRun 对象**：
```json
{
  "runId": "...",
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
  "durationMs": 8200
}
```

**StepRecord 对象**：
```json
{
  "recordId": "a1b2c3d4e5f67890abcdef1234567890",
  "stepId": "node_check",
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
- Sheet1 "运行历史"：id, jobId, jobKind, jobVersion, triggeredBy, workspace, status, terminatedBy, startedAtMs, finishedAtMs, duration
- Sheet2 "运行明细"：recordId, jobId, stepId, opId, opVersion, clientId, status, exitCode, inputs(JSON), outputs(JSON), rawOutput, timedOut, startedAtMs, finishedAtMs, duration
- 文件名：`job_result-{yyyyMMddHHmmssSSS}.xlsx`
- 由后端生成文件写入用户指定目录（前端传目录路径）。

**JobRun 对象字段说明**：

| 字段 | 类型 | 说明 |
|-|-|-|
| runId | string(32 位 UUID) | Run 标识 |
| jobId | string(32 位 UUID) | 所属 Job |
| jobKind | enum | `persistent` / `virtual` |
| jobVersion | integer | Job 版本 |
| triggeredBy | enum | `manual` / `schedule` / `single_op` / `single_workflow` / `retry` |
| target | object | 目标快照：`{kind, opId, opVersion, workflowId, workflowVersion, name}` |
| inputs | object | 本次执行入参 |
| workspace | string | 工作区 |
| status | enum | `pending` / `running` / `success` / `failed` / `cancelled` / `timeout` / `interrupted` |
| terminatedBy | enum \| null | `timeout` / `cancelled` / `error` |
| timeoutStepId | string \| null | 超时节点 stepId |
| timeoutOpName | string \| null | 超时节点引用 OP 名称 |
| steps | StepRecord[] | 步骤列表 |
| retryFromRunId / retryFromStepId | string \| null | 重试溯源 |
| startedAtMs / finishedAtMs | string | 起止时间 |
| durationMs | integer | 耗时（毫秒） |

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
| `StepRecord.recordId` | `step_records.record_id` | 主键，32 位 UUID |
| `StepRecord.stepId` | `step_records.step_id` | 等于 workflow_nodes.node_id |
| `StepRecord.runId` | `step_records.run_id` | 引用 job_runs.run_id |

---

### 3.5.1 GET /api/runs —— Run 列表

**功能说明**：运行历史首页的列表接口，支撑多种筛选（status / triggeredBy / workspace / jobKind / timeRange 等）与分页排序。

**路径参数**：无

**查询参数**：

| 参数 | 位置 | 类型 | 必填 | 默认 | 说明 |
|-|-|-|-|-|-|
| page | query | integer | 否 | 1 | 页码 |
| page_size | query | integer | 否 | 10 | 每页条数，∈ {10,50,100,1000} |
| keyword | query | string | 否 | — | 模糊匹配 name / target 名称 / 状态 / 版本号 |
| targetKind | query | string | 否 | — | 类型：`op` / `workflow` |
| triggeredBy | query | string | 否 | — | 触发来源：manual/schedule/single_op/single_workflow/retry |
| status | query | string | 否 | — | 状态：pending/running/success/failed/cancelled/timeout/interrupted |
| workspace | query | string | 否 | — | 工作区 |
| jobKind | query | string | 否 | — | 来源：persistent/virtual |
| version | query | string | 否 | — | 版本号 |
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
{ "status": "running", "updatedAtMs": "1728000000000" }
```

**错误响应**：404 `RUN_NOT_FOUND`。

---

### 3.5.4 GET /api/runs/{runId}/steps —— 步骤列表

**功能说明**：查询 Run 的全部步骤记录（含因重试产生的多条），按 startedAtMs 排序，用于详情页逐步展示。

**路径参数**：`runId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：`StepRecord[]`（含重试产生的多条记录，按 startedAtMs 排序）。

**错误响应**：404 `RUN_NOT_FOUND`。

---

### 3.5.5 GET /api/runs/{runId}/steps/{stepId} —— 单步骤多次执行记录

**功能说明**：查询某 step 因重试产生的全部执行记录（按时间降序，最新在上），用于对比每次尝试的结果。

**路径参数**：

| 参数 | 类型 | 必填 | 说明 |
|-|-|-|-|
| runId | string(32 位 UUID) | 是 | Run 标识 |
| stepId | string | 是 | 步骤 ID（等于 workflow_node.node_id） |

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：`StepRecord[]`，该 step 因重试产生的全部记录，按时间降序（最新的在最上面）。

**错误响应**：400 `VALIDATION_ERROR`；404 `RUN_NOT_FOUND` / `STEP_NOT_FOUND`。

---

### 3.5.6 POST /api/runs/{runId}/terminate —— 终止 Run

**功能说明**：终止运行中的 Run（标记 cancelled → kill 正在运行的 Worker 子进程 → 取消待调度节点 → 写终态），用于用户手动停止任务。

**路径参数**：`runId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
{ "ok": true }
```

> 终止逻辑见 4.6（标记 cancelled → kill 子进程 → 取消待调度节点 → 写终态）。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | id 非法或 Run 非运行中（不可终止） |
| 404 | `RUN_NOT_FOUND` | runId 不存在 |

---

### 3.5.7 POST /api/runs/{runId}/rerun —— 重跑 Run

**功能说明**：使用最新版本从头重跑（新建 JobRun，从头执行），适用于原 Run 失败或需按新版本重新执行的场景。

**路径参数**：`runId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无（使用最新版本，从头执行）

**成功响应 `200 OK`**：

```json
{ "runId": "a1b2c3d4e5f67890abcdef1234567890" }
```

**错误响应**：400 `VALIDATION_ERROR`；404 `RUN_NOT_FOUND` / `TARGET_NOT_FOUND`（目标已删除）。

---

### 3.5.8 POST /api/runs/{runId}/retry —— 从失败 step 重试

**功能说明**：从失败 step 处重试（前提：版本一致、无 needsUpdate、失败非超时、存在失败 step），复用上下文继续后续节点。

**路径参数**：`runId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
{ "runId": "a1b2c3d4e5f67890abcdef1234567890" }
```

> 前提见 4.7：仅 target=Workflow、失败（非超时）、版本一致、无 needsUpdate、存在失败 step。重试前建议先调用 can-retry 校验。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 404 | `RUN_NOT_FOUND` | runId 不存在 |
| 409 | `RETRY_NOT_ALLOWED` | 不满足五条件（如版本不一致/超时/needsUpdate/无失败 step） |

---

### 3.5.9 GET /api/runs/{runId}/can-retry —— 检查是否可重试

**功能说明**：预检查是否满足重试前提，返回 `canRetry` 与不可重试原因。前端据此决定展示「重试」还是「重跑」操作。

**路径参数**：`runId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
{ "canRetry": false, "reason": "版本已更新，无法重试。请使用 [重跑]。" }
```

| 响应字段 | 类型 | 说明 |
|-|-|-|
| canRetry | boolean | 是否满足重试前提 |
| reason | string | 不可重试的原因（可为空） |

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
  "filePath": "/path/to/export_dir"
}
```

| 字段 | 类型 | 必填 | 说明 |
|-|-|-|-|
| filters | object | 否 | 与 GET /api/runs 一致的筛选条件 |
| filePath | string | 是 | 导出目标目录路径（后端生成文件写入） |

**成功响应 `200 OK`**：

```json
{ "filePath": "/path/to/export_dir/job_result-20261007120000000.xlsx" }
```

**错误响应**：400 `VALIDATION_ERROR`（filePath 缺失/非法）；500 `INTERNAL_ERROR`（写文件失败）。

---

### 4.6 终止

```text
POST /api/runs/{runId}/terminate
  │
  ├─ 标记 job_run.status = cancelled
  ├─ Engine 收到终止信号:
  │     ├─ kill 正在运行的 Worker 子进程
  │     ├─ 取消待调度的节点
  │     └─ 写 job_run.finishedAtMs
  └─ 当前 step_record.status = cancelled (或 timeout 如果是超时)
```

### 4.7 重跑 vs 重试

| 维度 | 重跑 (rerun) | 重试 (retry) |
|-|-|-|
| 版本 | 用最新版本 | 必须版本一致 |
| 起点 | 从头开始 | 从失败 step 开始 |
| 前提 | 无 | can-retry: 版本一致 + 无需更新 |
| triggeredBy | manual | retry |

**can-retry 检查**：
1. 原 Run.status = failed
2. 原 target 的当前版本 == 原 Run 记录的版本
3. 无 needsUpdate
4. 存在失败的 step
