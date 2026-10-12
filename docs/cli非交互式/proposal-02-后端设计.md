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
| Windows 服务 | windows-service | Windows 下可注册为系统服务（§9.8） |

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
| **WorkerPool**（执行层） | 同步执行单个 OP（调 Executor 启动子进程），**数据库排队 + Worker 池**：`worker.run_job(req)` / `worker.run_step(req, inst)`（实例方法 &self）**总是**在 step_records 插 waiting 记录（含 activation_seq / retry_seq，定位同一 step 的重试 / 循环回跳）即返回（**池满不报错、无内存滞留**）；WorkerPool 调度线程轮询 waiting → 指派空闲 Worker（**池大小 = `ceil(job_queue_running_max × 1.5)`，与 Runner 并发阈值无关**）执行 Executor → 更新 step_records 终态；完成回调为**全局实现**（JobComplete 更新终态 / StepComplete 写事件后调全局 ENGINE 推进），Worker 执行完同步调用，WorkerPool 不感知业务 | 与 Engine 并行；job_complete 写 job_runs 终态 |

**执行数据流**：

1. **触发**：接口触发（HTTP 手动 / Scheduler cron 定时 / 单次 OP / Workflow 执行）统一调用 `TaskRunner.add_op / add_job / add_workflow`；
2. **创建运行历史**：Task Runner 写入一条 JobRun（status=waiting）到 `job_runs` 并返回 runId，接口即结束；
3. **调度**：Task Runner 后台调度线程按入库顺序调度——并发配额内取出任务，状态 waiting → running；**单次 OP 直接派发 WorkerPool**；**Job / Workflow 调 `engine.notify(EngineStart{run_id, workflow_id})` 通知 Engine——EngineStart 作为 `engine_start` 事件写入 engine_events（落库，重启不丢）**；
4. **执行**：Engine 按 DAG 顺序派发各 OP 给 WorkerPool；WorkerPool 同步执行（调 Executor）；
5. **完成回调**：WorkerPool 完成后**同步调用全局完成实现**（入参 ExecuteResult：run_id 在结果内、step_id / activation_seq / retry_seq 随结果携带，无需回查 step_records）——全局 `JobComplete` 更新 job_runs 终态（落库）并供运行历史界面展示；全局 `StepComplete` 回报 Engine 推进 DAG（写 step_completed 事件后立即调全局 ENGINE.process_event）；Engine 整体完成时在处理 `workflow_done` / `terminate` 事件时调用全局 `JobComplete` 更新 job_runs 终态（事件持久化 + 单例重启重建，重放幂等） → **不依赖内存回调传递业务**：Task Runner 常驻轮询线程按固定间隔扫描 DB → 统计并发、调度下一个 waiting 任务 → 刷新界面状态。

> 注：Task Runner 与 Engine 是两个并行的后台任务（同见 crud-05 4.6、crud-03 4.3 / 4.4）；WorkerPool 是执行资源池，与 Engine 并行接收派发。


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
| 5 | 运行历史管理 | Run 列表/详情/终止/重跑/重试/导出 Excel（生成 xlsx 以 base64 返回，前端落盘） | job_runs, step_records |
| 6 | 单次执行器 (Executor) | 通过 Client 执行单个 OP，封装进程调用 | step_records, ops, clients |
| 7 | 定时任务管理 (Scheduler) | 加载 cron Job，到点触发 | jobs, job_runs |
| 8 | 编排控制 (Engine/WorkerPool) | DAG 调度、边路由、重试、循环 | workflows, workflow_nodes, job_runs, step_records |
| 9 | DB 操作层 (Repository) | 所有 SQL 操作，统一连接池 | 全部表 |
| 10 | 日志管理 | 结构化日志、Run 级日志文件 | （文件系统） |
| 11 | 配置管理 | `ai-automation.json` 读写、实时写回、启动参数（`-c`） | ai-automation.json |
| 12 | CLI 入口 | 命令行：start / run / export / import / version / install-service / uninstall-service / service（§9） | — |

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
// 同理: OpRepo, WorkflowRepo, JobRepo, RunRepo, StepRepo
// 配置不再走 Repository：由配置模块直接读写 {run}/ai-automation.json（ConfigRepo，见 crud-06 〇）
```

所有 JSON 字段（inputs/outputs/target/trigger/bindings/retry/edges/nodes）在 DB 中存储为 TEXT，读写时 serde 序列化/反序列化。

---

## 七、日志管理

| 日志类型 | 存储位置 | 说明 |
|-|-|-|
| 应用日志 | `{run}/logs/app-{date}.log` | INFO/WARN/ERROR 结构化 JSON |
| Run 日志 | `{run}/logs/runs/{runId}.log` | 每次执行的完整 stdout/stderr |
| 操作审计 | DB 或日志文件 | CRUD 操作记录 |

日志级别通过 `ai-automation.json` 的 `log_level` **动态调整**（无需重启）。
应用日志绕接为 zip 后按**最大文件数**（`log_max_files`）保留，不设保留天数；绕接文件名：`{日志名}-{YYYYMMDDHHMMSS}{三位毫秒}.zip`。

---

## 八、配置管理

> 已迁移至 `proposal-02-后端crud-06配置管理.md`。

---

## 九、CLI（命令行入口）设计

> 形态：**单体二进制**（见 §1.1 / tasks.md 附二 C1）——HTTP 服务、Scheduler、Task Runner / Engine / WorkerPool 与 CLI 解析**同进程**。命令行由 `clap` 解析（§1.1）。
> 入口**无参数**时（如双击二进制）等价于 `start`：起服务，浏览器访问其输出的首页地址即得完整前端，满足 T2.2「双击二进制即得完整前端」。

### 9.1 命令一览

| 命令 | 用途 | 生命周期 |
|-|-|-|
| `start` | 启动 daemon（HTTP 服务 + Scheduler + Runner / Engine / WorkerPool） | **常驻**（前台运行） |
| `run <job-name>` | 触发一次 Job（`kind=persistent`，按 **name** 定位） | 一次性 |
| `export <kind> <name> --output <dir>` | 导出实体到目录 | 一次性 |
| `import <kind> <file>` | 从文件导入实体 | 一次性 |
| `version` | 打印版本号 | 一次性 |
| `install-service` | 注册为 Windows 系统服务（§9.8） | 一次性 |
| `uninstall-service` | 停止并删除 Windows 系统服务（§9.8） | 一次性 |
| `service` | **服务态入口**：由 SCM 启动（§9.8） | 常驻（SCM 管理） |
| `--help` / `-h` | 打印帮助 | — |
| `--version` / `-V` | 打印版本号（等价 `version`） | — |

```text
ai-automation [全局选项] <命令> [命令选项]
ai-automation start [-c <run-dir>] [--host <addr>] [--port <port>] [--open]
ai-automation run <job-name> [-c <run-dir>] [--no-wait]
ai-automation export <kind> <name> --output <dir> [-c <run-dir>]
ai-automation import <kind> <file> [-c <run-dir>]
ai-automation install-service -c <abs-run-dir> [--name <svc>] [--host <addr>] [--port <port>]
ai-automation uninstall-service [--name <svc>]
ai-automation service [-c <abs-run-dir>] [--host <addr>] [--port <port>]
ai-automation version
```

`<kind>` ∈ `client | op | workflow | job`（与 HTTP 接口命名一致：Client→YAML，OP→YAML，Workflow / Job→ZIP）。

### 9.2 全局选项

| 选项 | 说明 |
|-|-|
| `-c, --config-dir <dir>` | **运行目录**（全局选项，可置于子命令前后）。未指定默认 `~/.ai-automation`；`~` 展开为当前用户家目录绝对路径、按平台分隔符（见 crud-06 〇「运行目录 `-c`」）。该目录内存储：`ai-automation.json`（配置，唯一事实来源）、`data/data.db`（SQLite DB）、`logs/`（应用日志与 Run 日志）、`workspaces/`（工作区根）、`scripts/`（包装脚本）、`daemon.json`（运行实例信息，见 9.3）。**长选项名 `--config-dir` 的语义即 crud-06 的 `runDir`（运行目录）**，勿与「配置文件所在目录」混淆——配置文件 `ai-automation.json` 本身就在该目录内。 |
| `-h, --help` | 打印帮助并退出（退出码 0）。 |
| `-V, --version` | 打印版本并退出（退出码 0）。 |

### 9.3 `start` —— 启动 daemon

**启动流程**：初始化运行目录（首次自动创建 `{run}/ai-automation.json`、`data/`、`logs/`、`logs/runs/`、`workspaces/`、`scripts/`，见 tasks.md T1.5）→ 读配置（缺失写默认；损坏拒绝启动，见 crud-06 〇）→ 初始化日志（`tracing`，早于 HTTP）→ 打开 DB → 按序初始化全局单例（`store / Executor / WORKER_POOL / ENGINE / RUNNER / SCHEDULER`，§1.2）→ 绑定端口 → 启动 HTTP 服务与 Scheduler。

| 选项 | 默认 | 说明 |
|-|-|-|
| `--host <addr>` | `127.0.0.1` | 监听地址。默认**仅本机**；跨机访问需显式 `--host 0.0.0.0`——**接口无鉴权**，`0.0.0.0` 会把完整 API 与数据暴露给同网段，仅限可信内网。 |
| `--port <port>` | `7878` | 监听端口；占用则**报错退出**（提示改用 `--port`），不静默换端口。 |
| `--open` | 关闭 | **默认不打开浏览器**；仅在显式传入 `--open` 时用系统默认浏览器打开首页。 |

- **前台运行**：日志同时写 `{run}/logs/app-{date}.log`（结构见 §7）；`Ctrl+C`（SIGINT）/ SIGTERM 触发**优雅退出**——停止接收新任务 → 等在途 Run 收敛 → 关闭服务，退出码 0。**等待上限 30s**：超时则记 WARN、放弃收敛并退出；未收敛的在途 Run 由下次启动的 `recover` 接管（§1.2）。
- **实例发现**：启动成功后把实际监听信息写入 `{run}/daemon.json`（`{pid, host, port, startedAtMs, version}`），退出时删除；`run` 等一次性子命令据此定位当前实例。**同一运行目录只允许一个 daemon**：`daemon.json` 存在**且其中 pid 确为在跑的 ai-automation 进程**（需校验进程身份，防 pid 复用）才判为「已有实例」并拒绝二次启动；文件缺失 / 损坏 / pid 不符一律视为陈旧，直接覆盖。启动成功在 stdout 打印首页地址（`--host 0.0.0.0` 时打印 `http://127.0.0.1:<port>/`，避免输出不可点击的地址）。

### 9.4 `run` —— 触发一次 Job

按 **name** 查 Job → 触发一次运行（等价 `POST /api/jobs/{jobId}/run`，含 `needsUpdate` / `concurrency` / 全局 waiting 上限等既有校验）。

- **默认等待**：轮询 `GET /api/runs/{runId}/status` 至终态，按结果设退出码（0=success；4=failed / timeout / cancelled）。
- `--no-wait`：投递成功即返回（退出码 0），不等待结果。
- **依赖 daemon**：`run` 是**客户端**行为，经 `{run}/daemon.json` 发现运行的 daemon，走统一 HTTP 接口（`POST /api/jobs/{jobId}/run`）；未发现 → 报错退出（退出码 3）并提示先 `start`。
- **找不到同名 Job** → 报错退出（退出码 7）。

### 9.5 `export` / `import` —— 导入导出

> `export` / `import` **依赖 daemon、走统一 HTTP 接口**，不在 CLI 内另开离线读写 DB 的旁路（避免校验 / 事务 / 重映射出现第二套实现）。未发现 daemon → 报错退出（退出码 3）。

- `export <kind> <name> --output <dir>`：按 name 定位实体后调用现有导出接口（`POST /api/clients|ops|workflows|jobs/{id}/export`），把返回内容落盘到 `--output` 目录——**默认文件名与 HTTP 导出一致**（`client-<name>.yaml` / `op-<name>-v<version>.yaml` / `workflow-<name>-v<version>.zip` / `job-<name>-v<version>.zip`，见 crud-01/02/03/04）；`<name>` 不存在 → 报错退出（退出码 7）；`--output` 目录不存在时**自动创建**。
- `import <kind> <file>`：读取文件后调用现有导入接口（`POST /api/*/import`），**校验、同名冲突、依赖重映射、事务原子性完全由接口侧保证**（如 OP 同名 409、Workflow 缺 Client 等）；冲突 / 校验失败 → 报错退出（退出码 8）。

### 9.6 `version`

打印单行 `ai-automation <version>`（版本等同 `GET /api/system/version` 的 `version` 字段；`config_version` / `db_version` 不在此输出，见 crud-06 3.2/3.3）。

### 9.7 退出码

| 码 | 含义 |
|-|-|
| 0 | 成功 |
| 1 | 通用失败（配置 / DB / IO） |
| 2 | 用法错误（clap 解析失败、未知子命令 / 选项） |
| 3 | `run` / `export` / `import`：未发现运行中的 daemon（需先 `start`） |
| 4 | `run`：触发的 Run 终态为 failed / timeout / cancelled |
| 5 | 启动失败：运行目录不可用 / `ai-automation.json` 损坏拒绝启动 / 端口被占用 / 已有实例 |
| 6 | 服务操作失败：非管理员权限 / SCM 错误 / 平台不支持（非 Windows） |
| 7 | 目标不存在：`run` 找不到同名 Job、`export` 找不到实体 |
| 8 | 校验 / 冲突：`import` 校验失败、同名 409、`needsUpdate` 拦截等接口 4xx |

> 一次性子命令（`run` / `export` / `import` / `version`）**不启动 HTTP 服务、不启动 Scheduler**，也不初始化 Engine / WorkerPool 等运行态单例；`run` / `export` / `import` 仅作为 daemon 的 CLI 客户端。

### 9.8 注册为 Windows 系统服务

> 该二进制在 Windows 下可注册为**系统服务**，随开机自启、崩溃自动重启，无需用户登录。

| 命令 | 用途 |
|-|-|
| `install-service -c <abs-run-dir> [--name <svc>] [--host <addr>] [--port <port>]` | 注册为系统服务（需管理员） |
| `uninstall-service [--name <svc>]` | 停止并删除服务（需管理员） |
| `service [-c <abs-run-dir>] [--host <addr>] [--port <port>]` | **服务态入口**：由 SCM 启动，一般不手工执行 |

- **注册内容**：`ImagePath` 写为 `"<exe 绝对路径>" service -c <运行目录> [--host <addr>] [--port <port>]`；登录账户默认 `LocalSystem`；启动类型 `自动`；失败恢复策略为“重新启动”。
- **运行目录必须为绝对路径**：服务账户无 `~` 语义（默认 `~` 会落到 `C:\Windows\System32\config\systemprofile`），故 `install-service` 的 `-c` 在注册时展开为绝对路径写入 `ImagePath`；未显式指定时默认 `C:\ProgramData\ai-automation`。
- **服务态行为**：不打开浏览器（`--open` 不适用，§9.3）；stdout / stderr 被丢弃，日志只写 `{run}/logs/app-{date}.log`，另将**启动 / 停止 / 致命错误**写入 Windows 事件日志（Application 源 `ai-automation`）。
- **停止语义**：收到 `SERVICE_CONTROL_STOP` / `SHUTDOWN` 时先报 `StopPending`，复用 §9.3 的优雅退出（停止接收新任务 → 等在途 Run 收敛 → 关闭），完成后报 `Stopped`；受 SCM 停止超时约束。
- 需**管理员权限**执行 `install-service` / `uninstall-service`；服务名默认 `ai-automation`，显示名 `AI Automation`。
- `uninstall-service` **只删除服务注册，不删除运行目录与数据**（`{run}` 下的配置、DB、日志原样保留）。
- `install-service` 的 `--host` / `--port` 会写入服务 `ImagePath`；**修改需重新执行 `install-service`**（端口不存于 `ai-automation.json`，配置界面不可见）。
- 与 `daemon.json` 单实例约束一致（§9.3）：服务运行期间，对**同一运行目录**手工再 `start` 会被拒绝。
- `install-service` / `uninstall-service` 仅在 Windows 可用；其它平台报“不支持”并退出（退出码 6）。

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
| engine_events | Engine (调度事件流/重放, 审计) |
| run_edge_state | Engine (可选 checkpoint: 边状态快照) |
| run_node_state | Engine (可选 checkpoint: 节点就绪快照) |
| ~~settings~~（已废弃） | 配置迁移至 `ai-automation.json`（见 crud-06） |
