# 后端设计 —— AI 自动化 CLI 工作流编排器

> 配套前端文档: `proposal-01-界面设计.md`
> 配套建表脚本: `schema.sql`（独立文件，本文件不重复 DDL，仅说明引用关系）

---

## 一、总体架构

### 1.1 技术栈

| 层 | 选型 | 说明 |
|-|-|-|
| 语言 | Rust | 高性能、内存安全、适合长驻服务 |
| Web 框架 | axum | 异步 HTTP，适合轮询模型 |
| 数据库 | SQLite (WAL) | 单文件、嵌入式、无需独立服务 |
| 定时调度 | tokio-cron-scheduler | 基于 cron 表达式 |
| 进程执行 | tokio::process::Command | 子进程管理 + 超时 kill |
| 序列化 | serde / serde_json | JSON |
| CLI 入口 | clap | 命令行参数解析 |

### 1.2 进程模型

```text
┌─────────────────────────────────────────────────────────────┐
│                    AI Automation Daemon                      │
│                                                             │
│  ┌──────────┐   ┌──────────┐                                │
│  │  HTTP     │   │ Scheduler│                                │
│  │  Server   │   │ (cron)   │                                │
│  │ (axum)    │   │          │                                │
│  └────┬─────┘   └────┬─────┘                                │
│       │ 执行入口      │ 定时触发                              │
│       └───────┬───────┘                                      │
│               ▼  add_op / add_job / add_workflow             │
│  ┌────────────────────┐      ┌──────────────────┐           │
│  │  Task Runner       │      │ Engine           │ ← 编排控制  │
│  │  (后台任务① 调度层)  │      │ (后台任务② 并行)   │           │
│  │  队列 / 并发 / 状态机│      │ DAG 调度          │           │
│  └───┬────────┬───────┘      └────────┬─────────┘           │
│      │        │  EngineStart 通知      │ 派发 OP             │
│      │        └───────────────────────┘│                     │
│      │            ▼                    ▼                     │
│      │   ┌──────────────────────────────────────┐           │
│      │   │  WorkerPool (N 个并发槽)             │           │
│      │   │  ┌──────┐ ┌──────┐ ┌──────┐          │           │
│      │   │  │W-1   │ │W-2   │ │W-3   │  ...      │           │
│      │   │  │执行OP │ │执行OP │ │执行OP │→ Executor│          │
│      │   │  └──────┘ └──────┘ └──────┘          │           │
│      │   └──────────────────────────────────────┘           │
│      │   on_complete 钩子（WorkerPool / Engine → Task Runner）    │
│      └───────────────────────┬──────────────────┘           │
│                              ▼ 更新运行历史终态              │
│              ┌─────────────────┐                            │
│              │  Repository     │  ← DB 操作层                │
│              │  (SQLite)        │  job_runs / step_records   │
│              └─────────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

**三者均为全局静态单例**：`Task Runner / Engine / WorkerPool` 以 `static RUNNER / ENGINE / WORKER_POOL: OnceLock<Arc<…>>` 挂载为 App 进程级单例（App 启动 `init()` 时按「基础组件 store/executor → WorkerPool → Engine → Runner → 各自 recover → Runner 常驻轮询 start」初始化，重启后重建）。**互引不经构造注入**——Engine 经全局 `WORKER_POOL` 派发 OP、WorkerPool 完成后按 source 经全局 `JOB_COMPLETE` / `STEP_COMPLETE` 回调、Engine 终态经全局 `JOB_COMPLETE` 落库；完成回调（OnComplete 实现）为**全局实现**而非实例属性，无 Weak / 无回填 / 无组装顺序问题（机制见 crud-03 4.3 / 4.4、crud-05 4.6）。

**后台任务关系**（三个后台任务，互不嵌套、相互并行）：

| 后台任务 | 职责 | 与其它任务的关系 |
|-|-|-|
| **Task Runner**（调度层，后台任务①） | 运行历史（JobRun）状态机（waiting → running → 终态）、并发控制、按序调度分派（**常驻轮询**，固定间隔扫描 DB） | 与 Engine 并行；WorkerPool / Engine 完成时同步写终态，轮询自动感知 |
| **Engine**（编排控制，后台任务②） | 收到 `EngineStart` 通知后（**notify 消息即事件：EngineStart / Terminate 先写 engine_events 落库，写后立即 `process_event` 同步处理**——无事件循环 / 无信号），按 DAG 顺序决定下一步执行哪个 OP 并派发给 WorkerPool；整体完成时在处理 `workflow_done` / `terminate` 事件时调用**全局 JobComplete** 更新 job_runs 终态（事件持久化 + 单例重启重建，重放幂等） | 与 Task Runner、WorkerPool 并行（互不嵌套） |
| **WorkerPool**（执行层） | 同步执行单个 OP（调 Executor 启动子进程），**数据库排队 + Worker 池**：`worker.run_job(req)` / `worker.run_step(req)`（实例方法 &self）只在 step_records 插 waiting 记录即返回；WorkerPool 调度线程轮询 waiting → 指派空闲 Worker（池大小 = 1.5 × 并发上限）执行 Executor → 更新 step_records 终态；完成回调为**全局实现**（JobComplete 更新终态 / StepComplete 写事件后调全局 ENGINE 推进），Worker 执行完同步调用，WorkerPool 不感知业务 | 与 Engine 并行；job_complete 写 job_runs 终态 |

**执行数据流**：

1. **触发**：接口触发（HTTP 手动 / Scheduler cron 定时 / 单次 OP / Workflow 执行）统一调用 `TaskRunner.add_op / add_job / add_workflow`；
2. **创建运行历史**：Task Runner 写入一条 JobRun（status=waiting）到 `job_runs` 并返回 runId，接口即结束；
3. **调度**：Task Runner 后台调度线程按入库顺序调度——并发配额内取出任务，状态 waiting → running；**单次 OP 直接派发 WorkerPool**；**Job / Workflow 调 `engine.notify(EngineStart{run_id, workflow_id})` 通知 Engine——EngineStart 作为 `engine_start` 事件写入 engine_events（落库，重启不丢）**；
4. **执行**：Engine 按 DAG 顺序派发各 OP 给 WorkerPool；WorkerPool 同步执行（调 Executor）；
5. **完成回调**：WorkerPool 完成后**同步调用全局完成实现**（入参 ExecuteResult：run_id 在结果内、stepId 从 run_id 拆出，结果直接可用、无需回查 step_records）——全局 `JobComplete` 更新 job_runs 终态（落库）并供运行历史界面展示；全局 `StepComplete` 回报 Engine 推进 DAG（写 step_completed 事件后立即调全局 ENGINE.process_event）；Engine 整体完成时在处理 `workflow_done` / `terminate` 事件时调用全局 `JobComplete` 更新 job_runs 终态（事件持久化 + 单例重启重建，重放幂等） → **不依赖内存回调传递业务**：Task Runner 常驻轮询线程按固定间隔扫描 DB → 统计并发、调度下一个 waiting 任务 → 刷新界面状态。

> 注：Task Runner 与 Engine 是两个并行的后台任务（同见 crud-05 4.6、crud-03 4.3 / 4.4）；WorkerPool 是执行资源池，与 Engine 并行接收派发。
```

### 1.3 Engine / WorkerPool 模式（参考 mistral）

> 已迁移至 `proposal-02-后端crud-03workflow管理.md`。

---

## 二、模块划分

| # | 模块 | 职责 | 引用表 |
|-|-|-|-|
| 1 | Client 管理 | Client CRUD、测试连通性 | clients |
| 2 | OP 管理 | OP CRUD、单次执行、导入导出 YAML | ops |
| 3 | Workflow 管理 | Workflow CRUD、校验、单次执行、导入导出 ZIP | workflows, workflow_nodes, ops |
| 4 | Job 管理 | Job CRUD、手动运行、启用/禁用、导入导出 ZIP | jobs, job_runs |
| 5 | 运行历史管理 | Run 列表/详情/终止/重跑/重试/导出 Excel | job_runs, step_records |
| 6 | 单次执行器 (Executor) | 通过 Client 执行单个 OP，封装进程调用 | step_records, ops, clients |
| 7 | 定时任务管理 (Scheduler) | 加载 cron Job，到点触发 | jobs, job_runs |
| 8 | 编排控制 (Engine/WorkerPool) | DAG 调度、边路由、重试、循环 | workflows, workflow_nodes, job_runs, step_records |
| 9 | DB 操作层 (Repository) | 所有 SQL 操作，统一连接池 | 全部表 |
| 10 | 日志管理 | 结构化日志、Run 级日志文件 | （文件系统） |
| 11 | 配置管理 | settings 表读写、启动参数 | settings |
| 12 | CLI 入口 | 命令行：start / run / export / import / version | — |

---

## 三、接口设计

> 基础路径 `/api`，全部 JSON 请求/响应。
> 列表接口统一支持 `?page=1&page_size=10&keyword=&sort=` 等查询参数。
> 时间字段 JSON 中为 string（毫秒时间戳）。

### 3.1 Client 管理

> 已迁移至独立文档：`proposal-02-后端crud-01client管理.md`（内容见该文件，此处不再重复）。

### 3.2 OP 管理

> 已迁移至独立文档：`proposal-02-后端crud-02op管理.md`（内容见该文件，此处不再重复）。

### 3.3 Workflow 管理

> 已迁移至独立文档：`proposal-02-后端crud-03workflow管理.md`（内容见该文件，此处不再重复）。

### 3.4 Job 管理

> 已迁移至独立文档：`proposal-02-后端crud-04job管理.md`（内容见该文件，此处不再重复）。

### 3.5 运行历史

> 已迁移至独立文档：`proposal-02-后端crud-05运行历史.md`（内容见该文件，此处不再重复）。

### 3.6 系统与配置

> 已迁移至独立文档：`proposal-02-后端crud-06配置管理.md`（内容见该文件，此处不再重复）。

---

## 四、核心业务流程

> 以下子节已迁移至独立 CRUD 文档，此处不再重复：
> - 4.1 单次 OP 执行 → `proposal-02-后端crud-02op管理.md`
> - 4.2 Workflow 执行接口 / 4.3 Engine 机制（含 walk_edge 边路由、apply_retry 重试判定）/ 4.4 WorkerPool 机制 → `proposal-02-后端crud-03workflow管理.md`
> - 4.5 定时任务 → `proposal-02-后端crud-04job管理.md`
> - 4.6 终止 / 4.7 重跑 vs 重试 → `proposal-02-后端crud-05运行历史.md`

---

## 五、单次执行器 (Executor)

> 5.1 执行流程 / 5.2 包装脚本示例 已迁移至 `proposal-02-后端crud-01client管理.md`。

---

## 六、DB 操作层 (Repository)

统一通过 Repository  trait 访问 SQLite，不允许在业务代码中直接写 SQL。

```rust
trait ClientRepo {
    async fn list(&self, filter: ClientFilter) -> Result<(Vec<Client>, i64)>;
    async fn get(&self, id: &str) -> Result<Option<Client>>;
    async fn create(&self, client: &Client) -> Result<()>;
    async fn update(&self, client: &Client) -> Result<()>;
    async fn delete(&self, id: &str) -> Result<()>;
}
// 同理: OpRepo, WorkflowRepo, JobRepo, RunRepo, StepRepo, SettingRepo
```

所有 JSON 字段（inputs/outputs/target/trigger/bindings/retry/edges/nodes）在 DB 中存储为 TEXT，读写时 serde 序列化/反序列化。

---

## 七、日志管理

| 日志类型 | 存储位置 | 说明 |
|-|-|-|
| 应用日志 | `~/.ai-automation/logs/app-{date}.log` | INFO/WARN/ERROR 结构化 JSON |
| Run 日志 | `~/.ai-automation/runs/{runId}.log` | 每次执行的完整 stdout/stderr |
| 操作审计 | DB 或日志文件 | CRUD 操作记录 |

日志级别通过 settings 表 `log_level` 动态调整。

---

## 八、配置管理

> 已迁移至 `proposal-02-后端crud-06配置管理.md`。

---

## 九、CLI 入口

```text
ai-automation start              # 启动 daemon (HTTP server + scheduler)
ai-automation run <job-name>     # 命令行直接触发一次 Job
ai-automation export <kind> <name> --output <dir>
ai-automation import <kind> <file>
ai-automation version
ai-automation --help
```

---

## 十、错误处理规范

| HTTP 状态码 | 场景 |
|-|-|
| 400 | 参数校验失败 |
| 404 | 资源不存在 |
| 409 | 冲突（被引用、需要更新、并发策略冲突） |
| 500 | 内部错误 |

错误响应统一格式：
```json
{"error": {"code": "OP_NOT_FOUND", "message": "OP xxx not found"}}
```

---

## 十一、分页规范

所有列表接口统一：

```
GET /api/xxx?page=1&page_size=10&keyword=xxx&...
```

响应：
```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "page_size": 10
}
```

page_size 可选值：10 / 50 / 100 / 1000。

---

## 十二、与前端文档的对应关系

| 前端文档章节 | 后端模块 |
|-|-|
| 八、Client 管理 | Client 管理 + Executor (test) |
| 九、OP 管理 | OP 管理 + Executor |
| 十、Workflow 管理 | Workflow 管理 + Engine |
| 十一、Job 管理 | Job 管理 + Scheduler |
| 十二、运行历史 | 运行历史管理 + Engine 回调 |
| 十三、版本管理 | 各管理模块 (动态计算) |
| 十四、超时语义 | Executor + Engine |
| 十五、循环场景 | Engine |
| 十七、接口列表 | 本文第三章 |

---

## 十三、表结构引用总览

| 表 | 主要访问模块 |
|-|-|
| clients | Client 管理, Executor |
| ops | OP 管理, Workflow 管理, Engine, Executor |
| workflows | Workflow 管理, Engine |
| workflow_nodes | Workflow 管理, Engine |
| jobs | Job 管理, Scheduler |
| job_runs | 运行历史管理, Engine, Scheduler |
| step_records | 运行历史管理, Engine, Executor |
| settings | 配置管理, 全部模块 (只读) |
