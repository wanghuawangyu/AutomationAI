# 后端 CRUD —— Job 管理

> 来源：`proposal-02-后端设计.md` 第 3.4 节、第 4.5 节（独立拆分，内容原样迁移）
> 配套文档: `proposal-01-界面设计.md`、`proposal-02-后端设计.md`
> 配套建表脚本: `schema.sql`

---

### 3.4 Job 管理

| 方法 | 路径 | 请求 Body | 响应 | 说明 |
|-|-|-|-|-|
| GET | `/api/jobs` | — | 分页列表 | 含最近运行结果 |
| GET | `/api/jobs/{jobId}` | — | Job | 详情 |
| POST | `/api/jobs` | Job | Job | 创建 |
| PUT | `/api/jobs/{jobId}` | `{job, bumpVersion}` | Job | 更新 |
| DELETE | `/api/jobs/{jobId}` | — | `{ok:true}` | 删除 |
| POST | `/api/jobs/{jobId}/run` | — | `{runId}` | 手动触发一次 |
| POST | `/api/jobs/{jobId}/enable` | — | Job | 启用 |
| POST | `/api/jobs/{jobId}/disable` | — | Job | 禁用 |
| POST | `/api/jobs/{jobId}/export` | — | `{zip: base64}` | 导出 |
| POST | `/api/jobs/import` | `{zip: base64}` | Job | 导入 |
| GET | `/api/jobs/{jobId}/last-run` | — | JobRun\|null | 最近一次执行 |
| GET | `/api/jobs/{jobId}/needs-update` | — | `{needsUpdate:bool}` | 动态计算 |

**Job 对象**：
```json
{
  "jobId": "...",
  "name": "hourly_check",
  "description": "每小时健康检查",
  "kind": "persistent",
  "version": 1,
  "target": {"kind":"workflow","workflowId":"...","workflowVersion":1},
  "clientId": null,
  "workspace": "/path/ws-003",
  "inputs": {"env": "prod"},
  "trigger": {"kind":"schedule","cron":"0 * * * *","enabled":true},
  "concurrency": "skip",
  "enabled": true,
  "createdAtMs": "...",
  "updatedAtMs": "..."
}
```

**业务规则**：
- `target.kind=op` 时 `clientId` 必填。
- `trigger.kind=manual` 或 `schedule` 二选一。
- `needsUpdate` 动态计算：
  - target=op: `target.opVersion != ops.version`
  - target=workflow: `target.workflowVersion != workflows.version` OR workflow.needsUpdate=true
- needsUpdate=true 的 Job 禁止运行。

**Job 对象字段说明**：

| 字段 | 类型 | 说明 |
|-|-|-|
| jobId | string(32 位 UUID) | 系统生成 |
| name | string | 全局唯一 |
| description | string \| null | 描述 |
| kind | enum | 恒为 `persistent` |
| version | integer | 版本号，默认 1 |
| target | object | `{kind:"op", opId, opVersion}` 或 `{kind:"workflow", workflowId, workflowVersion}` |
| clientId | string(32 位 UUID) \| null | target=op 时必填 |
| workspace | string | 工作区路径 |
| inputs | object | 入参名值对，name 来源于 OP/Workflow 参数定义 |
| trigger | object | `{kind:"manual"}` 或 `{kind:"schedule", cron, enabled}` |
| concurrency | enum | `skip` / `queue` / `parallel` |
| enabled | boolean | 是否启用（定时是否触发） |
| createdAtMs | string | 创建时间 |
| updatedAtMs | string | 更新时间 |

---

### 3.4.0 通用约定

> 以下为 Job 管理全部 API 的完整 HTTP 定义。通用约定：
> - 基础路径 `/api`；路径参数中的 `jobId` 为 32 位无连字符 UUID。
> - 时间字段 JSON 中统一为 string（毫秒时间戳）。
> - 列表分页 `page` / `page_size`（`page_size` ∈ 10 / 50 / 100 / 1000，默认 10）。
> - 错误响应统一格式 `{"error":{"code":"...","message":"..."}}`。

**字段命名 ↔ 数据库列映射**（API 字段 camelCase ↔ `schema.sql` 列 snake_case）：

| API 字段 | 数据库列 | 说明 |
|-|-|-|
| `Job.jobId` | `jobs.job_id` | 主键，32 位 UUID |
| `Job.clientId` | `jobs.client_id` | 引用 clients.client_id |
| `JobRun.runId` | `job_runs.run_id` | 主键，32 位 UUID |
| `StepRecord.recordId` | `step_records.record_id` | 主键，32 位 UUID |
| `JobRun.jobId` | `job_runs.job_id` | 引用 jobs.job_id |

---

### 3.4.1 GET /api/jobs —— Job 列表

**功能说明**：支撑 Job 列表页的展示与过滤，列表项含 `lastRun`（最近一次执行摘要，可为 null）。支持 `keyword` / `needsUpdate` / `enabled` / `failed` 过滤与分页排序。

**路径参数**：无

**查询参数**：

| 参数 | 位置 | 类型 | 必填 | 默认 | 说明 |
|-|-|-|-|-|-|
| page | query | integer | 否 | 1 | 页码 |
| page_size | query | integer | 否 | 10 | 每页条数，∈ {10,50,100,1000} |
| keyword | query | string | 否 | — | 模糊匹配 name / target 名称 / description |
| needsUpdate | query | boolean | 否 | — | 按需更新状态过滤 |
| enabled | query | boolean | 否 | — | 按启用状态过滤 |
| failed | query | boolean | 否 | — | true=仅最近执行失败的 Job |
| sort | query | string | 否 | `-createdAtMs` | 排序字段：name/createdAtMs/updatedAtMs，`-` 前缀降序 |

**请求体**：无

**成功响应 `200 OK`**：

```json
{
  "items": [ { "...": "Job 字段", "lastRun": {"status":"success","durationMs":3200,"finishedAtMs":"..."} } ],
  "total": 4,
  "page": 1,
  "page_size": 10
}
```

> 列表项额外含 `lastRun`（最近一次执行摘要，可为 null），其余字段同 Job 对象。

**错误响应**：400 `VALIDATION_ERROR`（page_size/needsUpdate/enabled/failed/sort 取值非法）。

---

### 3.4.2 GET /api/jobs/{jobId} —— Job 详情

**功能说明**：查询单个 Job 的完整配置（target、trigger、inputs、concurrency 等），用于编辑界面加载现有 Job 回填表单。

**路径参数**：`jobId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：单个 Job 对象（结构见 3.4 节）。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | jobId 格式非法 |
| 404 | `JOB_NOT_FOUND` | jobId 不存在 |

---

### 3.4.3 POST /api/jobs —— 创建 Job

**功能说明**：新建 Job（`kind=persistent`），绑定执行目标（op 或 workflow）与触发方式（manual / schedule），`version` 初始为 1。创建后按 trigger 配置生效。

**路径参数**：无　**查询参数**：无

**请求体** `JobCreateRequest`（不含 id/version/时间戳；kind 恒为 persistent，version 默认 1）：

```json
{
  "name": "hourly_check",
  "description": "每小时健康检查",
  "target": {"kind":"workflow","workflowId":"...","workflowVersion":1},
  "clientId": null,
  "workspace": "/path/ws-003",
  "inputs": {"env": "prod"},
  "trigger": {"kind":"schedule","cron":"0 * * * *","enabled":true},
  "concurrency": "skip",
  "enabled": true
}
```

**成功响应 `200 OK`**：返回已创建的 Job 对象。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | name 为空、target 非法、target=op 缺 clientId、trigger 缺失/非法 |
| 404 | `OP_NOT_FOUND` / `WORKFLOW_NOT_FOUND` | target 引用的 OP / Workflow 不存在 |
| 409 | `JOB_NAME_EXISTS` | name 已存在 |

---

### 3.4.4 PUT /api/jobs/{jobId} —— 更新 Job

**功能说明**：更新 Job 配置（target、trigger、inputs 等）。`bumpVersion=false` 覆盖当前版本、`bumpVersion=true` 升版本；schedule 类修改后重新注册定时触发。

**路径参数**：`jobId`（32 位 UUID，必填）

**查询参数**：无

**请求体** `{ job, bumpVersion }`：`job` 为完整 JobCreateRequest；`bumpVersion` 为 boolean（`false`=覆盖 / `true`=version+1）。

**成功响应 `200 OK`**：返回更新后的 Job 对象。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | 请求体字段非法 |
| 404 | `JOB_NOT_FOUND` | jobId 不存在 |
| 409 | `JOB_NAME_EXISTS` | name 与其他 Job 冲突 |

---

### 3.4.5 DELETE /api/jobs/{jobId} —— 删除 Job

**功能说明**：删除 Job，同时取消其已注册的定时触发。

**路径参数**：`jobId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：`{ "ok": true }`

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | jobId 格式非法 |
| 404 | `JOB_NOT_FOUND` | jobId 不存在 |

---

### 3.4.6 POST /api/jobs/{jobId}/run —— 手动运行 Job

**功能说明**：手动触发一次 Job 执行（即时触发，不受定时计划限制），创建 JobRun 并进入运行历史。受 enabled / needsUpdate / concurrency 约束。

**路径参数**：`jobId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无（使用 Job 已配置的 inputs / workspace）

**成功响应 `200 OK`**：

```json
{ "runId": "a1b2c3d4e5f67890abcdef1234567890" }
```

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | jobId 格式非法 |
| 404 | `JOB_NOT_FOUND` | jobId 不存在 |
| 409 | `JOB_NEEDS_UPDATE` | needsUpdate=true，需更新后才能运行 |
| 409 | `JOB_DISABLED` / `CONCURRENCY_CONFLICT` | Job 已禁用，或并发策略 skip 且已有运行中实例 |

---

### 3.4.7 POST /api/jobs/{jobId}/enable —— 启用 Job

**功能说明**：启用 Job（`enabled=true`）；schedule 类 Job 重新注册定时触发，恢复周期性执行。

**路径参数**：`jobId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：返回启用后的 Job 对象（`enabled=true`；schedule 类 Job 重新注册定时触发）。

**错误响应**：400 `VALIDATION_ERROR`；404 `JOB_NOT_FOUND`。

---

### 3.4.8 POST /api/jobs/{jobId}/disable —— 禁用 Job

**功能说明**：禁用 Job（`enabled=false`）；schedule 类 Job 取消定时触发，暂停周期性执行。

**路径参数**：`jobId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：返回禁用后的 Job 对象（`enabled=false`；schedule 类 Job 取消定时触发）。

**错误响应**：400 `VALIDATION_ERROR`；404 `JOB_NOT_FOUND`。

---

### 3.4.9 POST /api/jobs/{jobId}/export —— 导出 Job 为 ZIP

**功能说明**：导出 Job 为 ZIP（`manifest.json` + `job.yaml` + `workflows/*.yaml` + `ops/*.yaml`），返回 base64 内容供前端写入所选目录，用于 Job 的备份与迁移。

**路径参数**：`jobId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
{ "zip": "UEsDBBQACAgI..." }
```

> ZIP 结构：`manifest.json` + `job.yaml` + `workflows/*.yaml` + `ops/*.yaml`。

**错误响应**：404 `JOB_NOT_FOUND`。

---

### 3.4.10 POST /api/jobs/import —— 从 ZIP 导入 Job

**功能说明**：从 ZIP 导入 Job，重建其定义及关联的 workflow / op；若同名 Job 已存在返回 409（导入冲突）。

**路径参数**：无　**查询参数**：无

**请求体**：

```json
{ "zip": "UEsDBBQACAgI..." }
```

**成功响应 `200 OK`**：返回导入创建的 Job 对象。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | ZIP 解析失败或字段非法 |
| 409 | `JOB_NAME_EXISTS` | 同名 Job 已存在（导入冲突） |

---

### 3.4.11 GET /api/jobs/{jobId}/last-run —— 获取最近一次执行

**功能说明**：查询该 Job 最近一次执行的 JobRun（无历史时为 null），供列表 / 详情展示最近运行状态与结果。

**路径参数**：`jobId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：返回最近一次 JobRun 对象；若无历史执行，返回 `null`。

**错误响应**：400 `VALIDATION_ERROR`；404 `JOB_NOT_FOUND`。

---

### 3.4.12 GET /api/jobs/{jobId}/needs-update —— 检查是否需要更新

**功能说明**：动态计算 Job 是否需要更新（target 版本落后，或所引 workflow.needsUpdate=true）。`needsUpdate=true` 时禁止运行该 Job。

**路径参数**：`jobId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
{ "needsUpdate": true }
```

**错误响应**：404 `JOB_NOT_FOUND`。

---

### 4.5 定时任务

```text
Daemon 启动:
  └─ 加载所有 enabled=true 且 trigger.kind=schedule 的 Job
     注册到 cron scheduler

cron 触发:
  ├─ 检查 Job.concurrency 策略:
  │     ├─ skip:    如果已有运行中实例, 跳过
  │     ├─ queue:   排队等待
  │     └─ parallel: 并行启动新实例
  ├─ 创建 JobRun (triggeredBy=schedule)
  └─ 交给 Engine 执行
```
