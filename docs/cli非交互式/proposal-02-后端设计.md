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
│  ┌──────────┐   ┌──────────┐   ┌──────────┐               │
│  │  HTTP     │   │ Scheduler│   │ Engine   │  ← 编排控制    │
│  │  Server   │   │ (cron)   │   │ (dispatcher)          │
│  │ (axum)    │   │          │   │          │               │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘               │
│       │               │              │                     │
│       └───────────────┼──────────────┘                     │
│                       ▼                                     │
│              ┌─────────────────┐                            │
│              │  Repository     │  ← DB 操作层                │
│              │  (SQLite)        │                            │
│              └─────────────────┘                            │
│                                                             │
│  ┌──────────────────────────────────────┐                  │
│  │  Worker Pool (N 个并发槽)             │                  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐          │                  │
│  │  │W-1   │ │W-2   │ │W-3   │  ...      │                  │
│  │  │执行OP │ │执行OP │ │执行OP │          │                  │
│  │  └──────┘ └──────┘ └──────┘          │                  │
│  └──────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Engine / Worker 模式（参考 mistral）

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
| 8 | 编排控制 (Engine/Worker) | DAG 调度、边路由、重试、循环 | workflows, workflow_nodes, job_runs, step_records |
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
> - 4.2 Workflow 执行 / 4.3 边路由逻辑 / 4.4 重试策略 → `proposal-02-后端crud-03workflow管理.md`
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
