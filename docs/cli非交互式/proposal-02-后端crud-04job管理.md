# 后端 CRUD —— Job 管理

> 来源：`proposal-02-后端设计.md` 第 3.4 节、第 4.5 节（独立拆分，内容原样迁移）
> 配套文档: `proposal-01-界面设计.md`、`proposal-02-后端设计.md`
> 配套建表脚本: `schema.sql`

---

### 3.4 Job 管理

| 方法   | 路径                             | 请求 Body            | 响应                 | 说明           |
| ------ | -------------------------------- | -------------------- | -------------------- | -------------- |
| GET    | `/api/jobs`                      | —                    | 分页列表             | 含最近运行结果 |
| GET    | `/api/jobs/{jobId}`              | —                    | Job                  | 详情           |
| POST   | `/api/jobs`                      | Job                  | Job                  | 创建           |
| PUT    | `/api/jobs/{jobId}`              | `{job, bumpVersion}` | Job                  | 更新           |
| DELETE | `/api/jobs/{jobId}`              | —                    | `{ok:true}`          | 删除           |
| POST   | `/api/jobs/{jobId}/run`          | —                    | `{runId}`            | 手动触发一次   |
| POST   | `/api/jobs/{jobId}/enable`       | —                    | Job                  | 启用           |
| POST   | `/api/jobs/{jobId}/disable`      | —                    | Job                  | 禁用           |
| POST   | `/api/jobs/{jobId}/export`       | —                    | `{zip: base64}`      | 导出           |
| POST   | `/api/jobs/import`               | `{zip: base64}`      | Job                  | 导入           |
| GET    | `/api/jobs/{jobId}/last-run`     | —                    | JobRun\|null         | 最近一次执行   |
| GET    | `/api/jobs/{jobId}/needs-update` | —                    | `{needsUpdate:bool}` | 动态计算       |

**Job 对象**：
```json
{
  "jobId": "...",
  "name": "hourly_check",
  "description": "每小时健康检查",
  "kind": "persistent",
  "version": 1,
  "target": {"kind":"workflow","workflowId":"...","workflowVersion":1},
  "workspace": "/path/ws-003",
  "inputs": {"env": "prod"},
  "trigger": {"kind":"schedule","cron":"0 * * * *"},
  "concurrency": "skip",
  "enabled": true,
  "nextRunAtMs": "1728003600000",
  "createdAtMs": "...",
  "updatedAtMs": "..."
}
```

> target 的 op 形态（`kind=op` 时 `clientId` 必填在 target 内）：
> ```json
> "target": {"kind":"op","opId":"...","opVersion":2,"clientId":"a1b2c3d4e5f67890abcdef1234567890"}
> ```

**业务规则**：
- **Job 顶层不设 `clientId`**（Client 为 OP 专有）：`target.kind=op` 时，`clientId` 必填在 `target` 内（`target.clientId`，引用 `clients.client_id`）。
- `trigger.kind=manual` 或 `schedule` 二选一。
- `needsUpdate` 动态计算：
  - target=op: `target.opVersion != ops.version`
  - target=workflow: `target.workflowVersion != workflows.version` OR workflow.needsUpdate=true
- needsUpdate=true 的 Job 禁止运行。

**Job 对象字段说明**：

| 字段        | 类型                       | 说明                                                                               |
| ----------- | -------------------------- | ---------------------------------------------------------------------------------- |
| jobId       | string(32 位 UUID)         | 系统生成                                                                           |
| name        | string                     | 全局唯一                                                                           |
| description | string \| null             | 描述                                                                               |
| kind        | enum                       | 恒为 `persistent`                                                                  |
| version     | integer                    | 版本号，默认 1                                                                     |
| target      | object                     | `{kind:"op", opId, opVersion, clientId}` 或 `{kind:"workflow", workflowId, workflowVersion}`；**kind=op 时 target 内必含 `clientId`**（Client 为 OP 专有，引用 clients.client_id） |
| targetName  | string                     | **计算字段**：target 引用的 OP / Workflow 名称（join `ops` / `workflows` 按 `target_id` 得到；`jobs.target` JSON 不含名称） |
| workspace   | string                     | 工作区路径                                                                         |
| inputs      | object                     | 入参名值对，name 来源于 OP/Workflow 参数定义                                       |
| trigger     | object                     | `{kind:"manual"}` 或 `{kind:"schedule", cron}`（**不含 enabled**：Job 是否启用唯一由顶层 `enabled` 控制）       |
| concurrency | enum                       | `skip` / `queue` / `parallel`                                                      |
| enabled     | boolean                    | 是否启用：**schedule = 是否注册定时触发；manual = 恒 `true`（无效果）**；不传时默认 `true` |
| nextRunAtMs | string \| null             | **计算字段**：schedule 类型、已启用且非 needsUpdate 时的下次触发时间（毫秒时间戳）；manual / 禁用 / needsUpdate=true 时为 null（由 Scheduler 计算，见 4.5） |
| createdAtMs | string                     | 创建时间                                                                           |
| updatedAtMs | string                     | 更新时间                                                                           |

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
| `Job.name` | `jobs.name` | 全局唯一 |
| `Job.kind` | `jobs.kind` | 恒为 persistent |
| `Job.version` | `jobs.version` | 版本号 |
| `Job.target` | `jobs.target` | JSON 字段整体存储；kind=op 时内含 `clientId`（引用 clients.client_id），Job 顶层不设 clientId |
| `Job.workspace` | `jobs.workspace` | 工作区路径 |
| `Job.inputs` | `jobs.inputs` | JSON 字段整体存储（入参名值对） |
| `Job.trigger` | `jobs.trigger` | JSON 字段整体存储（manual / schedule） |
| `Job.concurrency` | `jobs.concurrency` | skip / queue / parallel |
| `Job.enabled` | `jobs.enabled` | 0/1 |
| `Job.createdAtMs` | `jobs.created_at_ms` | 毫秒时间戳 |
| `Job.updatedAtMs` | `jobs.updated_at_ms` | 毫秒时间戳 |
| `JobRun.runId` | `job_runs.run_id` | 主键，32 位 UUID |
| `JobRun.jobId` | `job_runs.job_id` | 引用 jobs.job_id（**快照引用**；Job 删除后历史保留，见 3.4.5） |
| `JobRun.jobVersion` | `job_runs.job_version` | Job 版本快照 |
| `JobRun.name` | `job_runs.name` | 运行名称快照（persistent = 时任 jobs.name；virtual = op/workflow 名）；Job 删除后仍可展示 |
| `JobRun.jobKind` | `job_runs.job_kind` | persistent / virtual |
| `JobRun.triggeredBy` | `job_runs.triggered_by` | manual / schedule / single_op / single_workflow / retry |
| `JobRun.target` | `job_runs.target_kind + target_id + target_version + target_name` | 运行快照**拆列存储**；Client 在**定义层有三处**（`Job.target.clientId`（kind=op）/ workflow 节点级 `clientId`（kind=workflow，见 crud-03）/ 执行层 `step_records.client_id` 记录每次实际执行所用的 Client，见 crud-05），三者中前两者为定义、后者为执行快照 |
| `JobRun.inputs` | `job_runs.inputs` | JSON 字段整体存储（运行入参快照） |
| `JobRun.workspace` | `job_runs.workspace` | 运行工作区快照 |
| `JobRun.status` | `job_runs.status` | RunStatus |
| `JobRun.startedAtMs` | `job_runs.started_at_ms` | 毫秒时间戳 |
| `JobRun.finishedAtMs` | `job_runs.finished_at_ms` | 毫秒时间戳 |
| `JobRun.durationMs` | `job_runs.duration_ms` | 耗时（毫秒） |
| `JobRun.createdAtMs` / `updatedAtMs` | `job_runs.created_at_ms` / `job_runs.updated_at_ms` | 创建时间 / 最后状态更新时间（详见 crud-05 3.5.0） |
| `StepRecord.recordId` | `step_records.record_id` | 主键，32 位 UUID |
| `StepRecord.activationSeq` | `step_records.activation_seq` | 第几次激活（循环回跳重入 +1） |
| `StepRecord.retrySeq` | `step_records.retry_seq` | activation 内第几次尝试（含首次；apply_retry +1） |

---

### 3.4.1 GET /api/jobs —— Job 列表

**功能说明**：支撑 Job 列表页的展示与过滤，列表项含 `lastRun`（最近一次执行摘要，可为 null）。支持 `keyword` / `needsUpdate` / `enabled` / `failed` 过滤与分页排序。

> - **仅列 persistent Job**：本列表只展示 `jobs` 表（持久 Job）；**virtual Job 仅存在于 `job_runs`（单次执行），不在本列表出现**（原型 mock 中出现的 virtual 行仅为示意图，非本列表语义）。
> - **target 名称来源**：`jobs.target` JSON **不含名称**（仅 id/version）；列表/详情的 **target 名称由接口 join `ops` / `workflows` 按 `target_id` 取 `name`**（作为计算字段 `targetName` 返回），`keyword` 对 target 名称的模糊匹配亦基于此。

**路径参数**：无

**查询参数**：

| 参数 | 位置 | 类型 | 必填 | 默认 | 说明 |
|-|-|-|-|-|-|
| page | query | integer | 否 | 1 | 页码 |
| page_size | query | integer | 否 | 10 | 每页条数，∈ {10,50,100,1000} |
| keyword | query | string | 否 | — | 模糊匹配 name / target 名称 / description |
| needsUpdate | query | boolean | 否 | — | 按需更新状态过滤 |
| enabled | query | boolean | 否 | — | 按启用状态过滤 |
| failed | query | boolean | 否 | — | **true = 最近一次 Run 为 failed / timeout / cancelled（即非 success）** |
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

> 列表项额外含 `lastRun`（最近一次执行摘要，可为 null；`status` 取完整 `RunStatus`：waiting/running/terminating/success/failed/cancelled/timeout——**可为非终态**（waiting / running / terminating），前端「最近运行结果」按非终态渲染为「运行中/终止中」样式，终态渲染为对应结果徽标）。**非终态 lastRun 仅展示状态、不提供操作**（不给「终止」按钮；**D4=B 定稿**：Job 列表的 lastRun 是加载结果顺带展示，不直接控制运行历史——对在途 Run 的终止/重跑/重试一律只能在**运行历史界面**操作，以收窄入口，见 crud-05 3.5.6 / 3.5.7 / 3.5.8）。

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
  "workspace": "/path/ws-003",
  "inputs": {"env": "prod"},
  "trigger": {"kind":"schedule","cron":"0 * * * *"},
  "concurrency": "skip",
  "enabled": true
}
```

**成功响应 `200 OK`**：返回已创建的 Job 对象。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | name 为空、target 非法、target=op 缺 target.clientId、trigger 缺失/非法 |
| 400 | `CRON_INVALID` | cron 表达式非法（`trigger.kind=schedule` 时） |
| 404 | `OP_NOT_FOUND` / `WORKFLOW_NOT_FOUND` / `CLIENT_NOT_FOUND` | target 引用的 OP / Workflow 不存在，或 target=op 时 target.clientId 引用的 Client 不存在 |
| 409 | `JOB_NAME_EXISTS` | name 已存在 |

> 说明：请求体 `enabled` 可省略，**默认 `true`**（schedule 类 Job 创建即启用）；manual Job 的 `enabled` 恒视为 `true`（不参与运行判断，见 3.4.6）。

---

### 3.4.4 PUT /api/jobs/{jobId} —— 更新 Job

**功能说明**：更新 Job 配置（target、trigger、inputs 等）。`bumpVersion=false` 覆盖当前版本、`bumpVersion=true` 升版本；schedule 类修改后重新注册定时触发。

**路径参数**：`jobId`（32 位 UUID，必填）

**查询参数**：无

**请求体** `{ job, bumpVersion }`：`job` 为完整 JobCreateRequest；`bumpVersion` 为 boolean（`false`=覆盖 / `true`=version+1）。

> **全量替换语义**：PUT 为**全量替换**——`job` 为完整定义，未提供的可选字段按默认值 / 清空处理（不做部分字段合并）；前端部分修改需先取详情再整体提交。

**成功响应 `200 OK`**：返回更新后的 Job 对象。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | 请求体字段非法 |
| 400 | `CRON_INVALID` | cron 表达式非法（`trigger.kind=schedule` 时） |
| 404 | `JOB_NOT_FOUND` / `OP_NOT_FOUND` / `WORKFLOW_NOT_FOUND` / `CLIENT_NOT_FOUND` | jobId 不存在，或更新后 target 引用的 OP / Workflow / Client 不存在 |
| 409 | `JOB_NAME_EXISTS` | name 与其他 Job 冲突 |

---

### 3.4.5 DELETE /api/jobs/{jobId} —— 删除 Job

**功能说明**：删除 Job，同时取消其已注册的定时触发。

- **有在途运行时拒绝删除**：若该 Job 存在 `waiting` / `running` / `terminating` 的 JobRun → **409 `JOB_HAS_ACTIVE_RUNS`**（防悬挂；`terminating` 仍在途——已提交终止、等待在跑 OP 收敛，仍占并发名额，见 crud-05 4.6；需先终止完成/等待终态后删除）。
- **历史保留与展示**：已终态的 `job_runs` 随 Job 删除**保留**（`job_id` 作快照引用，不再是强外键，见 `schema.sql`）；运行历史用 Run 自身的**名称快照 `name`**（persistent = 时任 jobs.name）展示 Job 名称，不依赖 `jobs` 表；已删 Job 的 Run **可查看详情**但**不可跳转到 Job 定义**，[重跑] 需 target（op/workflow）仍存在（否则 404 `TARGET_NOT_FOUND`），[重试] 仅依赖 target=workflow 及五条件（Job 已删则不检查 Job.needsUpdate，视为 false）。
- **删除的原子性（#5）**：并发检查（count waiting/running/terminating）与删除在**同一事务（`BEGIN IMMEDIATE`）**内执行（先查后删）；与创建侧对称，防「检查通过后、Run 才插入」产生悬挂 Run。
- **重试的「五条件」摘要**（详见 proposal-01 §12.8.2 / crud-05 4.8）：① target=Workflow；② Run 已结束且**存在失败/超时 step**（failed / timeout / cancelled 均可）；③ 版本一致（Run 快照版本 = 当前版本）；④ Workflow.needsUpdate=false；⑤ Job.needsUpdate=false（Job 已删 → 视为 false）。**waiting / running / terminating 不可重试**。

**路径参数**：`jobId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：`{ "ok": true }`

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | jobId 格式非法 |
| 404 | `JOB_NOT_FOUND` | jobId 不存在 |
| 409 | `JOB_HAS_ACTIVE_RUNS` | 该 Job 存在 waiting / running / terminating 实例，拒绝删除 |

---

### 3.4.6 POST /api/jobs/{jobId}/run —— 手动运行 Job

**功能说明**：手动触发一次 Job 执行（即时触发，不受定时计划限制），创建 JobRun 并进入运行历史。**enabled=false（禁用）不影响手动运行**（disable 仅停定时，见 4.5.1/4.5.4）；仅受 needsUpdate / concurrency 约束。

> **异步触发，投递即返回**：本接口与 OP / Workflow 单次执行一致——组装 `JobRunRequest` 投递到 `TaskRunner.add_job`，创建 JobRun（`triggeredBy=manual`，`status=waiting`）并返回 `{runId}` 后接口即结束，**不等待执行、不返回执行结果**；后续的排队调度、Engine / WorkerPool 执行、终态落库全部由 Task Runner 后台完成。
> **前端跳转**：点击 [运行] 并二次确认后，前端**自动跳转到运行历史界面**（默认首页），用户可在其中查看该 Run 的状态流转（waiting → running → 终态）。

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
| 409 | `CONCURRENCY_CONFLICT` | 并发策略 skip 且已有 waiting/running/terminating 实例；或队列深度达上限（**queue / parallel 均适用**：全局 waiting 计数 ≥ `job_queue_waiting_max`，见下注 #3） |

> **校验顺序（返回首个命中）**：`needsUpdate` → `concurrency`（即优先 `JOB_NEEDS_UPDATE` > `CONCURRENCY_CONFLICT`）；**enabled 不参与运行校验**（禁用仅停定时，不影响手动运行，见 4.5.1/4.5.4）。

**手动运行的并发策略（`concurrency`）精确语义**：

| 值 | 已有 waiting/running/terminating 实例时 | 落地 |
|-|-|-|
| `skip` | 拒绝 → 409 `CONCURRENCY_CONFLICT` | 同 Job 同时最多 1 个在途实例（terminating 仍占在途名额，等收敛释放） |
| `queue` | **允许创建 waiting 排队**（同 Job 可多个 waiting）；**全局 waiting 队列深度上限**（下注）达限 → 409 `CONCURRENCY_CONFLICT` | 所有 waiting 均落在 **`job_runs` 全局队列**（非 Job 私有队列），由 Task Runner 按 created_at FIFO 与全局并发配额调度；同 Job 多实例按入库顺序逐个执行 |
| `parallel` | **允许创建 waiting**，**Job 内无上限** | 并行度仅受 Task Runner **全局并发配额**约束；同 Job 可多实例同时运行 |

> **`job_queue_waiting_max` 的语义（#4）**：它是 **全局 waiting 队列深度上限**（非 Job 级）——判定为 `SELECT count(*) FROM job_runs WHERE status='waiting'`（**全局、跨 Job**）≥ settings `job_queue_waiting_max`（**默认 20、用户可调、上限 1000**）→ 409 `CONCURRENCY_CONFLICT`；与 `skip` 的「同 Job 在途数」判定不同（后者为 `... WHERE job_id=? AND status IN ('waiting','running','terminating')`）。
>
> **适用范围（#3，全入口生效）**：该上限在**所有创建 `job_runs`（status=waiting）的入口统一检查**——手动运行（3.4.6 queue/parallel）、cron 到点（4.5.2）、单次执行（3.2.6 / 3.3.7）、重跑/重试（crud-05）均先判全局 waiting 计数，触顶 → 409 `CONCURRENCY_CONFLICT`（cron 入口则本轮**跳过不触发**）。`parallel` 的「Job 内无上限」仅指同 Job 实例数，**仍受全局上限约束**。

- `queue` / `parallel` **真正差别**：**Job 内串行 vs 并行**（`queue` 同 Job 多实例逐个执行、`parallel` 同 Job 多实例同时运行）；**全局 waiting 上限（`job_queue_waiting_max`）对两者及各创建入口一律生效**（全入口，见上注 #3）——它并非 queue/parallel 的区分标志。
- **原子性**：并发检查与创建 JobRun 在**同一事务（`BEGIN IMMEDIATE`）内**执行——先 `SELECT count(*) FROM job_runs WHERE job_id=? AND status IN ('waiting','running','terminating')` 判定，再 INSERT；SQLite 单写者 + 写事务串行化保证「检查-创建」原子，防止 skip 被并发请求 / 手动与 cron 同时击穿。
- **manual Job 的 `enabled`**：`enabled` 仅对 schedule 语义有效（是否注册定时）；**manual Job 的 `enabled` 固定为 true、不参与运行判断**（disable 只停定时，不影响手动运行）。

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
>
> 其中 `workflows/*.yaml` 与 3.3.8 Workflow 导出的 `workflow.yaml` **同一格式**（见 crud-03 3.3.8）。**两种表达方式并存（#1）**：`workflows/*.yaml` **内部引用**（节点 OP/Client）以**名称**表达（`opName`/`clientName`）；`job.yaml` 的 **target** 则以**导出环境 id** 表达（`opId`/`workflowId`/`clientId`），导入时由 `manifest.json` 的**名称锚**解析并重映射为新 uuid（见 3.4.10）。

**`job.yaml`（导出格式，字段与 JobCreateRequest 一致）**：

```yaml
name: hourly_check
version: 1                  # 导出时当前 Job.version
description: 每小时健康检查
target:
  kind: workflow            # op | workflow
  workflowId: 1b2c...       # kind=workflow；kind=op 时为 opId
  workflowVersion: 1        # kind=op 时为 opVersion
  clientId: a1b2...         # 仅 kind=op 时必填
workspace: /path/ws-003
inputs: {env: prod}
trigger:
  kind: schedule            # manual | schedule
  cron: "0 * * * *"         # 仅 schedule
concurrency: skip           # skip | queue | parallel
enabled: true
```

**`manifest.json`**：

```json
{
  "kind": "job",
  "schemaVersion": 1,
  "appVersion": "0.1.0",
  "exportedAtMs": "1728000000000",
  "job": { "name": "hourly_check", "version": 1 },
  "clients": [ { "name": "my-bash", "clientId": "a1b2..." } ],
  "workflows": [ { "name": "deploy_workflow", "version": 1, "file": "workflows/deploy_workflow.yaml" } ],
  "ops": [ { "name": "check_tests", "version": 2, "file": "ops/check_tests.yaml" } ]
}
```

> `manifest.json` 声明包内依赖（`clients`/`workflows`/`ops` 的名称、版本与相对路径）；导入按此解析并按 3.4.10 策略重建 / 复用。`clients` 仅记录**名称↔导出时 id** 对应关系，供导入报错时提示需注册的 Client 名（导入不创建 Client，见 3.4.10）。

**错误响应**：404 `JOB_NOT_FOUND`。

---

### 3.4.10 POST /api/jobs/import —— 从 ZIP 导入 Job

**功能说明**：从 ZIP 导入 Job，重建其定义及关联的 workflow / op；若同名 Job 已存在返回 409（导入冲突）。

**路径参数**：无　**查询参数**：无

**请求体**：

```json
{ "zip": "UEsDBBQACAgI..." }
```

**成功响应 `200 OK`**：返回导入创建的 Job 对象；若依赖被复用且版本与包内声明不一致，响应体附带 `warnings` 列表（如 `["op check_tests: 包内 v2，环境现有 v3（已复用现有）"]`）；相关工作流可能因此 `needsUpdate=true`（见 3.3.10）。

**导入冲突与依赖解析策略**：

| 对象 | 策略 |
|-|-|
| Job 本身 | 同名已存在 → 409 `JOB_NAME_EXISTS`；否则新建，`version` **重置为 1**（**理由（#2）**：导入 Job 等同新建，与 3.4.3 创建语义一致——Job.version 为自增修订号，从 1 起） |
| 包内 OP / Workflow（`ops/*.yaml`、`workflows/*.yaml`） | **按 name 匹配**：不存在 → 按包内定义创建（沿用包内 `version`）；**已存在 → 复用现有（不覆盖、不改版本）**；包内 Workflow 的**节点级 `opName`/`clientName` 按 crud-03 3.3.9 策略重映射**为新 uuid。（**保真理由（#2）**：OP/Workflow 版本是 `needsUpdate` 的快照比对基准且被多处引用，保真才能维持引用一致） |
| Job.target | 解析后指向上述结果；`target.xxxVersion` 取**解析后实际引用的当前版本** |
| Job.inputs 键名（#4） | **复用 3.4.3 同一校验**：inputs 的 name 须匹配 target（OP/Workflow）的参数定义；不匹配 → 400 `VALIDATION_ERROR` |
| 版本差异告警（#5） | 复用的 OP/Workflow 版本与包内/manifest 声明不一致 → 计入响应 `warnings`（导入仍成功，不报错）；相关 Workflow 可能立即 `needsUpdate=true` |
| 包内 Client（`job.yaml` 的 `target.clientId`，仅 `kind=op`） | **按 name 匹配 Client**：存在 → 用其 `clientId`；不存在 → **409 `CLIENT_NOT_FOUND`**（Client 为本机在线注册，**不自动创建**；需先在目标环境注册同名 Client） |
| **旧 id → 新 id 重映射（#3）** | `job.yaml` 中的 target 存的是**导出环境 id**；导入以 `manifest.json` 的**名称**为锚，按上述策略解析出目标环境实体，再把 target 的 id 字段（`opId`/`workflowId`/`clientId`）**重写为新 id**、版本取实际引用版本； 名称在目标环境重名 → 按 name 视为同一实体（复用） |
| **导入后的 `enabled`（#7）** | **沿用包内 `enabled` 值**（不重置）；若为 schedule 且 `enabled=true` → **按 4.5.1 注册定时触发**（与创建一致）；`enabled=false` 则不注册 |

> 默认采用「不覆盖已有定义」的保守策略，避免破坏现有 Workflow/Job 引用；如需强制覆盖或严格版本比对，后续可用 manifest 扩展。
>
> `job.yaml.version`（#6）：**仅供参考**（记录导出时版本）；导入一律将 Job.version **重置为 1**（见上表），该字段不参与导入逻辑。
>
> **导入的原子性（#5）**：整个导入（校验 → 创建/复用 OP、Workflow → 创建 Job）在**单一事务**内完成；任一步失败（如 `CLIENT_NOT_FOUND`）→ **整体回滚**，不产生任何半成品。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | ZIP 解析失败或字段非法 |
| 409 | `JOB_NAME_EXISTS` | 同名 Job 已存在（导入冲突） |
| 409 | `CLIENT_NOT_FOUND` | 包内引用的 Client（按 name 匹配）在目标环境不存在；响应体列出缺失的 Client 名称（见上表） |

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

### 4.5 定时调度（Scheduler）

**职责**：Scheduler 是独立的后台模块，负责把 `trigger.kind=schedule` 的 Job 按 cron 表达式**到点唤醒**，到点后**只负责创建一次运行（JobRun）并投递给 Task Runner**——不亲自执行 OP，也不参与 DAG 调度（执行由 Task Runner / Engine / WorkerPool，见 crud-05 4.6、crud-03 4.3/4.4）。

**选型**：`tokio-cron-scheduler`（基于 cron 表达式；与本项目 Rust + tokio 栈一致，见 `proposal-02-后端设计.md` 技术栈）。

**cron 表达式**：

| 项 | 说明 |
|-|-|
| 字段数 | 标准 **5 字段**（`分 时 日 月 周`），如 `0 * * * *`（每小时整点）、`0 2 * * *`（每日 02:00）、`0 9 * * 1`（每周一 09:00） |
| 时区 | **固定本机时区（`Local`）**（配置管理 v2 已删除 `scheduler_timezone`，不提供时区覆盖） |
| 校验 | 创建 / 更新 Job 时解析校验；非法 → 400 `CRON_INVALID` |

**4.5.1 注册与热更新（生命周期）**

Scheduler 与 Job 定义保持同步，分为启动加载与运行时热更新：

```text
Daemon 启动:
  └─ 扫描 jobs: 取 Job.enabled=true 且 trigger.kind=schedule → 逐个注册到 cron scheduler
       （注册的失败 / cron 解析失败 → 记 error 日志、跳过该 Job，不影响其他）

运行时 Job 变更（经 Job 管理接口）:
  ├─ 创建(schedule)  → 若 enabled=true 则注册
  ├─ 更新            → 先取消旧注册，再按新 trigger 重新注册（cron / Job.enabled 变更即生效）
  ├─ enable          → 注册（恢复周期执行）
  ├─ disable         → 取消注册（暂停周期执行；不影响手动运行）
  └─ 删除            → 取消注册
```

- **注册幂等**：同一 jobId 重复注册以最新配置为准（先取消后注册）。
- **与手动运行无关**：disable 仅停定时，`POST /api/jobs/{jobId}/run` 手动触发仍可用（只要未被 needsUpdate 拦截）。

**4.5.2 cron 触发流程（到点）**

```text
cron 到点 (jobId):
  ├─ 1. 重读 Job（以 DB 为准，防御注册后配置已变）
  │        - enabled=false               → 跳过（理论上已取消注册，兼作防御）
  │        - trigger.kind != schedule    → 跳过
  │        - needsUpdate=true            → 跳过，记 warning（不静默跑旧定义）
  │        - cron 已解析失败 / 非法      → 跳过，记 error（**防御性检查**：注册时已校验；此处防持久化定义在注册后被人为改坏的异常）
  ├─ 2. 并发占用检查（统计该 Job 的 job_runs 中 status ∈ {waiting, running, terminating} 的实例）:
  │        - **只要存在任一 waiting / running / terminating 实例 → 本次 cron 不触发（跳过），不 queue、不 parallel**
  │        - 仅当无 waiting / running / terminating 实例时，才继续创建 JobRun
  │        - **全局 waiting 上限（job_queue_waiting_max，#3）**：`count(*) FROM job_runs WHERE status='waiting'`（全局）≥ job_queue_waiting_max（默认 20、可调、上限 1000）→ 本次 cron **跳过不触发**（不报 409、不排队；下个 cron 周期重试）
  │        - **步骤 2-3 在同一事务（`BEGIN IMMEDIATE`）内**：先查后插，保证与手动运行 / 并发 cron 的『检查-创建』原子（#1）
  ├─ 3. 创建 JobRun: triggered_by=schedule、status=waiting、快照 target/target_version/inputs/workspace（含名称快照 name/target_name）
  └─ 4. TaskRunner.add_job(req) → 投递即返回（不阻塞调度线程）；执行由后台完成
```

- **Scheduler 不直接执行**：与手动运行（3.4.6）同链路：创建 JobRun → `TaskRunner.add_job` → Engine/WorkerPool。
- **触发源**：`job_runs.triggered_by='schedule'`（区别于 manual / single_op / single_workflow / retry）。
- **cron 固定按 skip 语义**：定时触发**只要该 Job 已有 waiting / running / terminating 实例即跳过本次**（不排队、不并行；terminating 等收敛，仍占在途名额）；`concurrency` 的 `queue` / `parallel` 仅作用于**手动运行**（3.4.6）等其它入口。

**4.5.3 错过触发与重叠（missed / overlap）**

| 场景 | 处理 |
|-|-|
| 上一实例仍在跑 / 已在 waiting，cron 又到点 | **cron 跳过本次**（只要存在 waiting / running / terminating 实例即不触发，terminating 等收敛） |
| Daemon 停机期间错过的 cron 点 | **不补跑**（missed runs 直接跳过）；重启后按**下一个** cron 点触发 |
| 同一时刻多个 Job 到点 | 各自独立创建 JobRun；实际并行度由 Task Runner 全局并发配额（settings）约束 |
| cron 触发的`waiting` 任务堆积 | 由 Task Runner 按配额逐个调度；**不会因堆积而丢任务**（落库排队） |

**4.5.4 与 needsUpdate / enabled / 版本的交互**

| 状态 | cron 到点时 | 手动 [运行] |
|-|-|-|
| `enabled=true` + `needsUpdate=false` | ✅ 创建 JobRun | ✅ |
| `enabled=true` + `needsUpdate=true` | ⛔ 跳过（记 warning） | ⛔ 409 `JOB_NEEDS_UPDATE` |
| `enabled=false` | ⛔ 不注册 / 已取消（兼作防御跳过） | ✅ 仍可手动（受 needsUpdate 约束） |

> schedule 类 Job 修改后（3.4.4）**重新注册**定时触发；`bumpVersion` **只决定 `Job.version` 是否 +1**，与定时注册 / 触发无关；target 引用的版本快照以编辑请求中的 `target.xxxVersion` 为准。

**4.5.5 nextRunAtMs（下次触发时间）**

- 由 Scheduler 依据当前 cron 计算，作为 **Job 的计算字段**（不落库）随 3.4.1 列表 / 3.4.2 详情返回；manual 或 `enabled=false`（或 needsUpdate）时为 `null`。
- 供界面展示“下次触发”提示；重启后自动重算。
- **模块接口**：Scheduler 暴露查询方法 `next_run_at(job_id) -> Option<Ms>`（内存态，注册时缓存；未注册 / 禁用 / needsUpdate → `None`）；Job 响应组装时调用该方法填充 `nextRunAtMs`。

**4.5.6 错误与日志**

| 场景 | 处理 |
|-|-|
| cron 表达式非法（创建 / 更新） | 400 `CRON_INVALID` |
| 启动注册时 cron 非法 | 记 error 日志，跳过该 Job（Daemon 不因单个 Job 崩溃） |
| 到点时 needsUpdate=true | 跳过 + warning 日志 |
| 注册 / 取消注册失败 | 记 error 日志，重试下一轮扫描（下次 Job 变更或重启时重建） |
