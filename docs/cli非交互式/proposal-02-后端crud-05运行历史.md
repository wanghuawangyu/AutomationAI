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
- Sheet1 "运行历史"：id, jobId, jobKind, jobVersion, triggeredBy, workspace, status, terminatedBy, startedAtMs, finishedAtMs, duration
- Sheet2 "运行明细"：recordId, jobId, stepId, activationSeq, retrySeq, opId, opVersion, clientId, status, exitCode, inputs(JSON), outputs(JSON), rawOutput, timedOut, startedAtMs, finishedAtMs, duration
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
| status | enum | `waiting` / `running` / `success` / `failed` / `cancelled` / `timeout` |
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
| keyword | query | string | 否 | — | 模糊匹配 name / target 名称 / 状态 / 版本号 |
| targetKind | query | string | 否 | — | 类型：`op` / `workflow` |
| triggeredBy | query | string | 否 | — | 触发来源：manual/schedule/single_op/single_workflow/retry |
| status | query | string | 否 | — | 状态：waiting/running/success/failed/cancelled/timeout |
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

**功能说明**：查询 Run 的全部步骤记录（含因重试 / 循环回跳产生的多条），按执行先后排序（`(activation_seq, retry_seq)` 升序），用于详情页逐步展示。

**路径参数**：`runId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：`StepRecord[]`（含重试 / 循环回跳产生的多条记录，按 `(activation_seq, retry_seq)` 升序）。

**错误响应**：404 `RUN_NOT_FOUND`。

---

### 3.5.5 GET /api/runs/{runId}/steps/{stepId} —— 单步骤多次执行记录

**功能说明**：查询某 step 因**重试 / 循环回跳**产生的全部执行记录，按执行降序（最新在上，即 `(activation_seq, retry_seq)` 降序），用于对比每次尝试的结果。

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

**功能说明**：终止运行中的 Run（标记 cancelled → kill 正在运行的 Worker 子进程 → 取消待调度节点 → 写终态），用于用户手动停止任务。

**路径参数**：`runId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
{ "ok": true }
```

> 终止逻辑见 4.7（标记 cancelled → kill 子进程 → 取消待调度节点 → 写终态）。

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

> 前提见 4.8：仅 target=Workflow、失败（非超时）、版本一致、无 needsUpdate、存在失败 step。重试前建议先调用 can-retry 校验。

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

### 4.6 统一任务执行器（Task Runner）

**职责**：所有异步执行（单次 OP、Job 运行、Workflow 运行）统一投递到后端**任务执行器（Task Runner）**。它负责**运行历史（JobRun）的创建与状态机管理、并发控制、按序调度分派**（**常驻轮询后台线程**，按固定间隔扫描 DB，间隔可经 settings 配置）——本章归属运行历史领域：Task Runner 的一切动作都以 `job_runs` / `step_records` 为落点，运行历史界面的状态（等待中 / 运行中 / 终态）完全由它驱动。**Task Runner 不亲自执行 OP**：单次 OP 任务直接调用 WorkerPool 执行；Job / Workflow 任务先通知 Engine 启动，由 Engine 顺序调度各 OP、再交给 WorkerPool 执行。**任务控制不在 Job 业务层，而在本执行器**；Job 管理与单次 OP 只是「创建 JobRun 并提交任务」的入口。

**与 Executor / Engine / WorkerPool 的分工**：

| 层 | 归属文档 | 职责 | 并行关系 |
| - | - | - | - |
| **Executor** | crud-01 第 5.1 节 | 最小原子执行单元，执行**一个 OP**，返回 `ExecuteResult`（归属 Client 层：client 提供执行能力） | — |
| **Task Runner** | 本章 4.6 | 调度层：创建并管理 **JobRun 生命周期**（waiting / running / 终态）、并发控制、按序调度分派 | — |
| **Engine** | crud-03 第 4.3 节 | workflow DAG 调度（并行后台任务）：**异步入口 `engine.notify(EngineStart)`（实例方法 &self）——消息即事件：EngineStart / Terminate 先写 engine_events 落库，**写后立即 `process_event` 同步处理**（无事件循环 / 无信号）**，按 DAG 顺序决定下一步执行哪个 OP 并派发给 WorkerPool；整体完成时在处理 `workflow_done` / `terminate` 事件时调用**全局 JobComplete** 更新 job_runs 终态（事件持久化 + 单例重启重建，重放幂等） | 与 WorkerPool 并行（互不嵌套） |
| **WorkerPool** | crud-03 第 4.4 节 | 单个 OP 的实际执行（**数据库排队 + Worker 池**：`worker.run_job(req)` / `worker.run_step(req, inst)`（实例方法 &self）只在 step_records 插入 waiting 记录（含 activation_seq / retry_seq）即返回；WorkerPool 调度线程常驻轮询 waiting → 指派空闲 Worker（池大小 = 1.5 × 并发上限）→ 执行 Executor → 更新 step_records 终态+结果）；完成回调为**全局实现**（`JobComplete` 更新终态、`StepComplete` 写事件后调全局 ENGINE 推进），Worker 执行完**同步调用**；WorkerPool 不感知业务 | 与 Engine 并行（互不嵌套） |

> Engine 与 WorkerPool 是两个**互相并行**的后台组件（分别在 crud-03 4.3 / 4.4 描述），不是「Engine 套 WorkerPool」的嵌套关系；Task Runner 与它们也并行——Runner 只管队列与状态，不参与任何实际执行。

**并发控制**：Task Runner 控制**同时运行的任务数量**（最大并发数，可通过 settings 配置）。运行中的任务数从**运行历史表**实时统计：`job_runs` 中 `status=running` 的记录数——**临时 Job（单次 OP / Workflow 运行的 virtual JobRun）也是 Job，同样计入并发**。调度规则：Runner 每次轮询时检查运行中数量，达到上限则暂停调度，后续任务保持 `waiting(等待中)`；任务完成（终态落库）后 running 计数自然下降，无需显式释放名额，轮询即获得调度机会。

**入口接口（Task Runner API）**：

```rust
static RUNNER: OnceLock<Arc<TaskRunner>> = OnceLock::new();

/// 任务执行器（后端调度层，**全局静态单例**，与 Engine / WorkerPool 互经全局访问：
/// add_workflow → 全局 ENGINE.notify；单次 OP → 全局 WORKER_POOL.run_job）
pub struct TaskRunner {
    store: Arc<dyn RunStore>,   // 运行历史（job_runs / step_records）存取句柄
}

impl TaskRunner {
    /// 构造：绑定运行历史存储句柄（App 启动 init() 时创建并 set 进全局 RUNNER）
    pub fn new(store: Arc<dyn RunStore>) -> Self;

    /// 单次 OP 执行：创建 virtual JobRun（kind=single_op，status=waiting），投递后台执行，返回 runId
    pub fn add_op(req: OpRunRequest) -> Result<String, TaskError>;
    /// Job 运行：创建 JobRun（kind=job，status=waiting），投递后台执行，返回 runId
    pub fn add_job(req: JobRunRequest) -> Result<String, TaskError>;
    /// Workflow 运行：创建 JobRun（kind=workflow，status=waiting），投递后台执行，返回 runId
    pub fn add_workflow(req: WorkflowRunRequest) -> Result<String, TaskError>;
    /// 查询任务状态（对应内部 JobRun 状态）
    pub fn status(run_id: &str) -> TaskStatus;
    /// 常驻轮询线程（App 启动 init() 时 start）：扫描 DB → 调度 waiting → running → 刷新界面状态
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
    Waiting,   // 等待中
    Running,   // 运行中
    Success,   // 成功
    Failed,    // 失败
    Timeout,   // 超时
}
```

**状态机与两个状态迁移触发点**：

```text
waiting(等待中) ──[① 调度开始]──> running(运行中) ──[② 执行完成]──> 终态(success / failed / timeout)
```

- **① waiting → running**：由 **Task Runner 的后台调度线程**完成——任务开始由当前实例的后台线程控制，调度取出任务时即时改写运行历史状态（并在并发配额内启动执行）。此迁移无需外部参与。
- **② running → 终态**：WorkerPool 完成时**同步调用全局完成实现**（入参 ExecuteResult：run_id 在结果内、stepId 从 run_id 拆出，结果直接可用、无需回查 step_records）——全局 `JobComplete` 更新 job_runs 终态（落库）并供运行历史界面展示；全局 `StepComplete` 回报 Engine 推进 DAG（写 step_completed 事件后立即调全局 ENGINE.process_event），Engine 整体完成时在处理 `workflow_done` / `terminate` 事件时调用全局 `JobComplete` 更新 job_runs 终态（事件持久化 + 单例重启重建，重放幂等）。**不依赖内存回调传递业务**：Task Runner 是**常驻轮询后台线程**，按固定间隔（settings 可配）扫描 DB，发现 running 计数下降、存在 waiting 任务即调度下一个。

**执行流程**：

```text
add_op / add_job / add_workflow(req)
  ├─ 1. 创建运行历史（JobRun）：kind/triggeredBy 按入口确定，状态 waiting(等待中)，
  │      写入 job_runs（crud-05 立即可见）；每调用一次入口即插入一条记录
  ├─ 2. 投递后台调度线程，接口即结束，返回 {runId}
  │     后台调度线程（按入库顺序）:
  │       ├─ 检查并发：job_runs 中 status=running 数量 < 最大并发数？否则保持 waiting 等待
  │       ├─ ① 取出任务：运行历史状态 waiting → running（本线程完成）
  │       ├─ 按任务类型分派（Task Runner 不亲自执行 OP，直接以入口函数调用）:
  │       │     ├─ 单次 OP（add_op）:
  │       │     │     内部按 client_id/op_id 查询实例 → 组装 ExecuteRequest
  │       │     │     → worker.run_job(req)    // 只插 step_records(waiting) 即返回；调度线程指派 Worker 执行，完成后调 job_complete
  │       │     └─ Job / Workflow（add_job / add_workflow）:
  │       │           engine.notify(EngineStart{run_id, workflow_id})  // 实例方法 &self，异步入口，不阻塞
  │       │           → Engine 消费 step_completed 事件链式推进：按 DAG 找后继就绪节点 → 写 dispatch_step → worker.run_step(req, inst)    // 只插 step_records(waiting)；Worker 执行完调 step_complete
  │       │           （Engine / WorkerPool 入口定义见 crud-03 4.3 / 4.4；WorkerPool 任务在 step_records 排队，Worker 执行完同步调 on_complete）
  │       └─ ② WorkerPool 完成同步调全局实现（JobComplete 落库 / StepComplete 写事件后调全局 ENGINE）→ Engine 整体完成（处理 workflow_done / terminate 事件）调全局 JobComplete 落库：
  │             Runner 常驻轮询线程按固定间隔扫描 DB（不依赖回调）：
  │             统计 status=running 计数 < 最大并发数 且存在 waiting → 调度下一个，刷新界面
  └─ 3. 接口返回 {runId}
```

**同步 vs 异步**：
- **OP execute / Job run / Workflow run**：**异步**——`add_op` / `add_job` / `add_workflow` 在内部写入一条 `waiting(等待中)` 运行记录后返回 runId 即结束；后台线程按入库顺序调度分派（**单次 OP 直接调 `worker.run_job(req)` / Job·Workflow 调 `engine.notify(EngineStart{run_id, workflow_id})`（均为实例方法 &self、异步入口、不阻塞；EngineStart 作为 engine_start 事件写入 engine_events 落库，重启不丢）**；`run_job` / `run_step` 只插 step_records(waiting) 即返回（任务入 DB 排队，重启不丢），返回 `WorkerHandle` 由 Runner / Engine 持有，用于超时取消、用户终止等场景主动 `abort`（按进程组查杀，定义见 crud-03 4.4）），由 Runner 常驻轮询扫描 DB 驱动调度、自动刷新界面状态。
- **client test**：**同步例外**——不投递 Task Runner、不入队，直接同步调 `Executor::execute` 实时返回，且不建 JobRun/step_record、不进运行历史（见 crud-01 3.1.6）。

---
### 4.7 终止

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

### 4.8 重跑 vs 重试

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
