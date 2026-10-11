# 开发任务拆解 —— AI 自动化（Rust 单体二进制 + 内嵌前端）

> 依据：`proposal-01-界面设计.md`、`proposal-02-后端设计.md`、`proposal-02-后端crud-01..06`、`schema.sql`
> 形态：**普通 Rust 单体二进制**（非 Tauri）。HTTP 服务（axum）与 Task Runner / Engine / WorkerPool / Scheduler 同进程；**前端全部静态文件（HTML/JS/CSS）在构建时嵌入二进制**，运行时由二进制**释放到自身所在目录**（如 `<exe_dir>/ui/`）并由 HTTP 服务对外提供——浏览器访问首页与接口时读取的就是这份磁盘前端资源 + `/api` 接口。
> 说明：每个主干步骤下的子任务均带 **ID、参考章节、产出、验收要点**。ID 形如 `T{步骤号}.{序号}`，便于引用与排期。

---

## 〇、总体依赖与实施顺序

```text
T1 项目骨架
 └─ T2 前端界面（可与 T3+ 并行推进）
 └─ T3 Repository DB 操作层
      └─ T4 启动参数 + 日志管理
           └─ T5 配置管理 API（crud-06）
                └─ T6 Client API + Executor（crud-01）
                     └─ T7 OP API（crud-02）
                          └─ T8 Workflow API + Engine + Worker（crud-03）
                               └─ T9 运行历史 API + TaskRunner（crud-05）
                                    └─ T10 Job API + Scheduler（crud-04）
```

并列约束（实现时注意，非严格串行）：

- **T3 是全模块底座**，必须先于 T5–T10 的接口落库部分。
- **T4 的日志模块**被 T5–T10 全程使用，且 `tracing` 初始化需早于 HTTP server。
- **TaskRunner（T9）与 Engine（T8）互相引用**：Engine 由 `notify` 触发，WorkerPool 经全局 `StepComplete` 回报；`JobComplete` 由 T9 落地，故 T8 完成前需先冻结回调签名（见 T8.12）。
- **Executor（T6）是 T7/T8/T9/T10 执行链的共同出口**，必须先冻结 `ExecuteRequest` / `ExecuteResult`。
- **配置项**（`job_queue_waiting_max`、`job_queue_running_max`、`max_loop_multiplier` 等）在 T5 定稿，T8/T9/T10 消费。

---

## T1 项目骨架（Rust 单体二进制）与目录规划

**目标**：可编译、可启动、HTTP 可探测、目录与分层冻结。
**依赖**：无。

| ID | 子任务 | 参考 | 产出 / 验收 |
|-|-|-|-|
| T1.1 | 初始化普通 Rust 二进制工程（bin crate，含 HTTP 服务与静态资源目录） | proposal-02 §1.1 | `cargo run -- start` 可启动 HTTP 服务 |
| T1.2 | 规划并冻结项目目录结构 | proposal-02 §2 | 目录树落盘并在 README 固化（见下方"目录约定"） |
| T1.3 | 选定依赖并锁定版本 | proposal-02 §1.1 | `Cargo.toml`：`axum`、`tokio`、`sqlx`(或 rusqlite)、`serde`/`serde_json`、`serde_yaml`、`clap`、`tokio-cron-scheduler`、`tracing`/`tracing-subscriber`、`zip`、`rust_xlsxwriter`、`uuid`、**`rust-embed`（或 include_dir，内嵌前端静态资源）** |
| T1.4 | CLI 入口骨架（clap）：`start/run/export/import/version/-c` | proposal-02 §9 | `ai-automation --help` 输出全部子命令 |
| T1.5 | 运行目录初始化（`{run}/ai-automation.json`、`data/`、`logs/`、`logs/runs/`、`workspaces/`、`scripts/`） | crud-06 〇 | 首次启动自动建目录；`-c` 生效 |
| T1.6 | axum HTTP 骨架：`/api` 前缀、统一 JSON、CORS、健康探测；**静态资源路由**（`/` → 释放出的 `ui/`） | proposal-02 §3/§10 | `curl /api/system/version` 返回 `{version}`；浏览器可打开首页 |
| T1.7 | 统一错误响应与错误码基座（`{error:{code,message}}`） | proposal-02 §10 | 400/404/409/500 结构一致 |
| T1.8 | 统一分页/筛选/排序基座（`page/page_size/keyword/sort`） | proposal-02 §11 | 所有列表接口复用 |
| T1.9 | 全局单例骨架：`store / Executor / WORKER_POOL / ENGINE / RUNNER / SCHEDULER`（`OnceLock<Arc>`） + `init()` 顺序 | proposal-02 §1.2 | 启动按序初始化、`recover()` 挂点预留 |
| T1.10 | UUID(32 位无连字符) / 毫秒时间戳工具 | proposal-01 §2/§3 | 工具函数 + 单测 |

**目录约定（T1.2 产出，示例）**

```text
# Rust 单体二进制工程（cargo bin crate）
src/
  main.rs                  # CLI 入口（clap）
  app.rs                   # 启动编排（config → log → db → 全局单例 → HTTP）
  api/                     # 各模块 HTTP 路由（controller + dto）
    client.rs op.rs workflow.rs job.rs run.rs settings.rs static_ui.rs
  core/                    # 领域模型（Client/Op/Workflow/Job/JobRun/StepRecord）
  db/                      # Repository（repo_*.rs + migrate.rs + pool.rs）
  config/                  # ai-automation.json 读写、Config、默认值、迁移
  exec/                    # Executor、包装脚本、进程管理
  engine/                  # Engine、RunContext、事件、WalkEdge
  worker/                  # WorkerPool、Worker、完成回调
  runner/                  # TaskRunner + 队列
  scheduler/               # cron 调度
  logmgr/                  # 日志 + 绕接
  webui/                   # 内嵌/释放前端静态资源（rust-embed + 释放到 <exe_dir>/ui）
  errors.rs util.rs
ui/                        # 前端静态资源（HTML/JS/CSS，构建时嵌入）
scripts-tpl/               # 包装脚本模板（run.bash/run.py/run.ps1/run.prompt.*）
docs/cli非交互式/           # 本设计文档与 tasks.md
```

---

## T2 前端界面（构建内嵌 + 运行时释放到二进制目录）

**目标**：浏览器打开二进制提供的首页即渲染完整界面，默认首页为运行历史，全部列表/编辑器/弹窗按设计稿落地。
**依赖**：T1（骨架与静态资源机制）；接口数据面依赖 T5–T10（可先按 mock-data.js 联调，后接真接口）。

| ID | 子任务 | 参考 | 产出 / 验收 |
|-|-|-|-|
| T2.1 | 前端资源组织与构建：以 `原型图/*` 为基线，整理为可嵌入的静态资源目录 | proposal-01 §4 | 产出 `ui/`（HTML/JS/CSS），无外部依赖 |
| T2.2 | **构建内嵌 + 运行时释放**：`build.rs`/`rust-embed` 将 `ui/` 编入二进制；启动时在**二进制所在目录**把静态文件重写到磁盘（目录名待定，如 `<exe_dir>/ui/`） | 需求（构建打包进二进制、运行写到二进制目录） | 双击二进制即得完整前端，无需外部文件 |
| T2.3 | 两栏布局 + 左侧固定菜单（五一级项 + 左下角设置）+ 路由 | proposal-01 §4.1 | 启动默认进入运行历史 |
| T2.4 | 通用组件：分页条、搜索框、筛选 chip、二次确认、版本确认对话框、自动刷新开关 | proposal-01 §17 | 组件复用 |
| T2.5 | 前端 API 客户端层（base `/api`、分页/筛选参数、错误提示） | proposal-01 §17.1.3 | 统一 fetch 封装 |
| T2.6 | Client 列表 + 行内展开 + 编辑器(prompt/脚本) + 测试/导入/导出对话框 | proposal-01 §8 | 对齐 T6 接口 |
| T2.7 | OP 列表 + 行内展开 + 编辑器 + 单次执行对话框 + 导入/导出 | proposal-01 §9 | 对齐 T7 接口 |
| T2.8 | 共享画布模块 `workflow-canvas.css/js`（只读 + 编辑模式，三色锚点/箭头/状态色） | proposal-01 §10.6/§17.9 | 三处画布复用同一实现 |
| T2.9 | Workflow 列表 + 行内展开（只读画布） + 三栏编辑器（OP 库/画布/节点详情常驻）+ 校验面板 | proposal-01 §10 | 对齐 T8 接口 |
| T2.10 | Job 列表 + 行内展开 + 编辑器 + 手动运行确认弹窗 + 导入/导出 | proposal-01 §11 | 对齐 T10 接口 |
| T2.11 | 运行历史（首页）：列表 + 筛选（类型/来源/触发/状态/工作区/版本/时间）+ OP 详情 + Workflow 详情（只读画布）+ 终止/重跑/重试 + 全部导出 | proposal-01 §12 | Job 列表不给终止入口（终止仅在运行历史） |
| T2.12 | 设置界面 `settings.html`（分组导航 + 表单 + 只读项 + 恢复默认） | proposal-01 §4.2 / crud-06 | 对齐 T5 接口；`db_version` 不展示 |
| T2.13 | 轮询与自动刷新（读 `general.poll_interval_ms`，默认 2000） | proposal-01 §7.8/§12.10 | 不误读 `runner.poll_interval_ms` |
| T2.14 | 导入/导出前端交互（YAML/ZIP 选文件、选目录；运行历史导出走后端接口） | proposal-01 §8.9/§8.10/§16.7 | 与后端 T6/T7/T8/T10/T9 口径一致 |
| T2.15 | 工作区选择器（`GET /api/workspaces`） | crud-06 3.6 | 数据源 = `job_runs.workspace` 去重倒序 |

---

## T3 Repository DB 操作层

**目标**：`schema.sql` 落地 + 所有 SQL 收口到 Repository trait。
**依赖**：T1。

| ID | 子任务 | 参考 | 产出 / 验收 |
|-|-|-|-|
| T3.1 | 连接池初始化（SQLite WAL、`foreign_keys=ON`） | proposal-02 §1.1 / schema 头 | 单文件 `{run}/data/data.db` |
| T3.2 | 建表脚本集成与迁移（`PRAGMA user_version` = `db_version`） | schema.sql | 空库初始化 + 幂等升级 |
| T3.3 | 实体结构体与列映射（camelCase ↔ snake_case） | 各 crud 的"字段映射"表 | `FromRow`/serde 双向一致 |
| T3.4 | `ClientRepo` / `OpRepo` / `WorkflowRepo` / `JobRepo` / `RunRepo` / `StepRepo` / `EngineEventRepo` trait + 实现 | proposal-02 §6 | 业务代码零裸 SQL |
| T3.5 | JSON 字段序列化/反序列化（inputs/outputs/target/trigger/bindings/retry/edges/position） | proposal-02 §6 | TEXT 存取一致 |
| T3.6 | 事务封装（`BEGIN IMMEDIATE`，先查后写原子性） | crud-04 3.4.5/3.4.6、crud-05 3.5.7/3.5.8 | 并发检查+创建/删除同事务 |
| T3.7 | 通用列表查询构造（keyword LIKE + 多条件 AND + 排序 + 分页） | proposal-02 §11 | 复用于各列表接口 |
| T3.8 | 运行历史清理 SQL（`history_max_per_job/total/age_days`，仅终态） | crud-06「保存策略」 | 三条任一超限即清理 |
| T3.9 | Repository 单元测试（含唯一约束、快照引用、级联删除） | schema.sql | `cargo test` 通过 |

---

## T4 启动参数与日志管理（含日志绕接）

**目标**：`-c` 运行目录、结构化日志、级别动态调整、zip 绕接、Run 日志。
**依赖**：T1、T3（目录与 DB）。

| ID | 子任务 | 参考 | 产出 / 验收 |
|-|-|-|-|
| T4.1 | `-c <run-dir>` 解析 + 默认 `~/.ai-automation` | proposal-02 §9 / crud-06 〇 | 未指定走默认 |
| T4.2 | 路径展开：`~` → 家目录绝对路径，按平台分隔符；**后端统一拼路径** | crud-06 〇/3.3 | 接口下发即绝对路径 |
| T4.3 | `tracing` + `tracing-subscriber` 结构化日志初始化 | proposal-02 §7 | `{run}/logs/app-{date}.log` |
| T4.4 | 日志级别动态调整（消费 `log_level`，即时生效） | crud-06 一 | 改配置即时切换 |
| T4.5 | 日志绕接为 zip，按 `log_max_files` 保留、超限删最旧 | crud-06「日志绕接」 | 文件名 `{日志名}-{YYYYMMDDHHMMSS}{三位毫秒}.zip` |
| T4.6 | Run 日志 `{run}/logs/runs/{runId}.log`（不滚动、不参与 zip） | proposal-02 §7 / crud-06 | 每 Run 一份 |
| T4.7 | Run 日志随运行历史清理（受 `history_max_*` 约束） | crud-06 | 记录删除同步删日志 |
| T4.8 | 操作审计日志（CRUD 写操作，如 `client.update`） | crud-01 3.1.4 | 至少含 action/targetId/before/after/updatedAtMs |

---

## T5 配置管理后端 API（crud-06）

**目标**：`ai-automation.json` 为唯一事实来源 + 系统/工作区接口。
**依赖**：T1、T3、T4。

| ID | 子任务 | 参考 | 产出 / 验收 |
|-|-|-|-|
| T5.1 | `Config` 结构 + 分组 + 内置默认值常量 | crud-06 一 | 覆盖通用/Client/OP/Workflow/运行历史/Engine/Worker/Task Runner/Scheduler/日志 |
| T5.2 | `ConfigRepo`：读 `ai-automation.json` → `Arc<RwLock<Config>>` | crud-06 〇 | 唯一事实来源 |
| T5.3 | 原子写回（写 `.tmp` → `rename`） | crud-06 〇/3.4 | 防半写损坏 |
| T5.4 | 首次启动/缺失→写默认；损坏→报错或备份 `.bak` 重建 | crud-06 〇 | 不静默残缺运行 |
| T5.5 | `config_version` 迁移 + 失败回退（备份、不递增、`migrate_error`） | crud-06 3.4（P6） | 见 K 侧规则 |
| T5.6 | `GET /api/settings`：全部配置 + `runDir` + 只读派生项（`db_path`/`workspace_root` 后端拼接） | crud-06 3.3 | 值为 string；`db_version` 附加返回 |
| T5.7 | `PUT /api/settings`：校验（key/value/上限、**只读项拒绝**）→ 更新内存 → 原子写回；写失败回滚内存并 500 | crud-06 3.4 | 只读项 `db_path/workspace_root/config_version/db_version` 明确拒绝 |
| T5.8 | 数值上限校验表落地 | crud-06「数值项上限」 | `max_loop_multiplier` 0 或 1..10000；`history_max_age_days` 硬上限 180 |
| T5.9 | `POST /api/settings/reset`（只读项不参与） | crud-06 3.5 | 语义同 PUT |
| T5.10 | `GET /api/system/status`（status/uptimeMs/activeRuns） | crud-06 3.1 | 恒 200 |
| T5.11 | `GET /api/system/version`（`{version}`） | crud-06 3.2 | config/db 版本不在此 |
| T5.12 | `GET /api/workspaces`（`job_runs.workspace` 去重 + 最近使用倒序，`limit/keyword`） | crud-06 3.6；D6 | — |
| T5.13 | 动态生效分发（`log_level` 即时；`runner_*` 下次调度；`history_max_*` 下次清理等分档） | crud-06 一/四 | 明确即时效 vs 下次生效 |

---

## T6 Client 管理后端 API 与 Executor（crud-01）

**目标**：Client CRUD + 测试 + 统一执行器（四类 Client）。
**依赖**：T3、T4、T5。

| ID | 子任务 | 参考 | 产出 / 验收 |
|-|-|-|-|
| T6.1 | `GET /api/clients`（keyword: name/type/binaryPath、type 过滤、分页/排序） | crud-01 3.1.1 | AND 关系、后端过滤 |
| T6.2 | `GET /api/clients/{clientId}` | crud-01 3.1.2 | 400/404 |
| T6.3 | `POST /api/clients`（name 唯一、type 条件校验、id/时间戳后端生成） | crud-01 3.1.3 | 400/409 |
| T6.4 | `PUT /api/clients/{clientId}`（审计字段不可改；忽略或 400） | crud-01 3.1.4 | 刷新 `updatedAtMs` |
| T6.5 | `DELETE /api/clients/{clientId}`（被 Job 引用 → 409 `CLIENT_REFERENCED`） | crud-01 3.1.5 | — |
| T6.6 | `POST /api/clients/{clientId}/test`（同步走 Executor，不入历史） | crud-01 3.1.6 | 返回 success/exitCode/rawOutput/error/durationMs |
| T6.7 | Executor 入口冻结：`ExecuteRequest` / `ExecuteResult`（含 run_id/step_id/activation_seq/retry_seq） | crud-01 5.1 | **上层签名从此冻结** |
| T6.8 | 包装脚本生成（启动时生成 `run.bash/run.py/run.ps1/run.prompt.ps1/run.prompt.bash` 到 `{run}/scripts`） | crud-01 5.1/5.5 | 与前端中间文件同根 |
| T6.9 | main 文件生成 + `.ai_auto_result-<executionId>/` 临时目录；启动清理残留 | crud-01 5.1 | 命名含 executionId+opId |
| T6.10 | 环境变量注入（`W_AI_AUTO_*`）+ stdin 协议（`INPUT_ARGS: k: b64`、`OUTPUT_NAMES:`） | crud-01 5.2 | 与脚本隔离 |
| T6.11 | 入参解析（required/default）与注入 | crud-01 5.3 | 缺必填 400 |
| T6.12 | 出参解析：脚本类（stdout `OUTPUT_ARGS:` / EXIT trap） + prompt 类（outputMode text/json/jsonl + jsonPath） | crud-01 5.4/5.5 | outputs 结构一致 |
| T6.13 | 子进程启动（`current_dir=workspace`、独立进程组 `setsid/process_group=0`） + **spawn 起算超时** + 超时按进程组 kill 整树 | crud-01 5.1；proposal-01 §14.2 | 排队时长不计入 |
| T6.14 | 结果回收（stdout_file/stderr_file/rc_file/outputs.json → `ExecuteResult`） | crud-01 5.1/5.4 | `status=success/failed/timeout` |
| T6.15 | 四类 Client 联调（bash/python/powershell/prompt 各跑通 test） | crud-01 5.0 | 端到端可测 |

---

## T7 OP 管理后端 API（crud-02）

**目标**：OP CRUD + 单次执行（virtual Job）+ YAML 导入导出。
**依赖**：T3、T5、T6（Executor）。

| ID | 子任务 | 参考 | 产出 / 验收 |
|-|-|-|-|
| T7.1 | `GET /api/ops`（keyword、type、分页/排序） | crud-02 3.2.1 | — |
| T7.2 | `GET /api/ops/{opId}` | crud-02 3.2.2 | 400/404 |
| T7.3 | `POST /api/ops`（name 唯一、version=1、时间戳后端生成） | crud-02 3.2.3 | 400/409 |
| T7.4 | `PUT /api/ops/{opId}`（`{op,bumpVersion}`，升版本触发下游 needsUpdate 动态标记） | crud-02 3.2.4 | 400/404/409 |
| T7.5 | `DELETE /api/ops/{opId}`（被 Workflow 节点或 Job.target(kind=op) 引用 → 409 `OP_REFERENCED`） | crud-02 3.2.5 | — |
| T7.6 | `POST /api/ops/{opId}/execute`（组装 `OpRunRequest` → `TaskRunner.add_op`，返回 `{runId}`） | crud-02 3.2.6/§4.1 | 投递即结束；clientId 类型匹配 |
| T7.7 | `POST /api/ops/{opId}/export`（返回 YAML 文本） | crud-02 3.2.7 | — |
| T7.8 | `POST /api/ops/import`（YAML 解析、`op_import_max_bytes` 上限、同名 409） | crud-02 3.2.8 | 400/409 |
| T7.9 | 入参解析/校验（required/default，含未定义参数拒绝） | crud-02 3.2.6 | — |

---

## T8 Workflow 管理后端 API + Engine + Worker（crud-03）

**目标**：Workflow CRUD/校验/导入导出 + 事件驱动 Engine + WorkerPool。
**依赖**：T3、T5、T6、T7、T9（TaskRunner 的 `add_workflow` 与 `StepComplete` 回调——可将 T9.1 提前）。

| ID | 子任务 | 参考 | 产出 / 验收 |
|-|-|-|-|
| T8.1 | `GET /api/workflows`（含 `nodeCount`、needsUpdate 过滤、分页/排序） | crud-03 3.3.1 | — |
| T8.2 | `GET /api/workflows/{workflowId}`（含 nodes/edges） | crud-03 3.3.2 | 400/404 |
| T8.3 | `POST /api/workflows`（默认 Start+End 骨架；position 必填否则 400） | crud-03 3.3.3 | 400/409 |
| T8.4 | `PUT /api/workflows/{workflowId}`（`{workflow,bumpVersion}`） | crud-03 3.3.4 | 400/404/409 |
| T8.5 | `DELETE /api/workflows/{workflowId}`（被 Job 引用 → 409 `WORKFLOW_REFERENCED`） | crud-03 3.3.5 | — |
| T8.6 | `POST /validate`：Start/End 唯一、start→end 可达、允许回跳环、Start 无 on_failure、op 节点绑定 opId+opVersion、bindings 引用存在 | crud-03 3.3.6/校验规则 | `{valid,errors[]}` |
| T8.7 | `POST /execute`（组装 `WorkflowRunRequest` → `add_workflow`，`needsUpdate` 拦截） | crud-03 3.3.7/§4.2 | 投递即结束 |
| T8.8 | `POST /export`（ZIP：manifest + workflow.yaml + ops/*.yaml；依赖以 **名称** 表达） | crud-03 3.3.8 | `{zip:base64}` |
| T8.9 | `POST /import`（按 name 重映射 opName→opId / clientName→clientId；同名 409；单事务原子；`warnings`） | crud-03 3.3.9 | 缺 client → 409 `CLIENT_NOT_FOUND` |
| T8.10 | needs-update 内核 + `GET /needs-update` / `GET /outdated-nodes`（落后/超前/悬挂） | crud-03 3.3.10/3.3.11 | 动态计算不落库 |
| T8.11 | Engine 事件模型：`engine_events` 七类事件 + `process_event` **写即处理**（无循环/无信号） | crud-03 §4.3 | 事件先落库再处理 |
| T8.12 | 全局完成回调冻结：`JobComplete` / `StepComplete`（按 `source=job/step` 分发） | proposal-02 §1.2；crud-03 4.4 | 与 T9 对齐 |
| T8.13 | 内存 `RunContext`（邻接表/边状态/就绪计数/出参），`HashMap<run_id, Arc<Mutex<..>>>` 每 run 一锁 + LRU | crud-03 4.3.3 | 单步 O(1) DB 写 |
| T8.14 | 边状态机 + algorithm：walk_edge（success/failed → activated/dropped）、AND-join、skipped 传播、End 收敛 | crud-03 §4.3.1 | pending_in/activated_in 判定 |
| T8.15 | `apply_retry` 判定（on=success/failure、max、backoff constant/linear/exponential、非阻塞退避 `not_before_ms`） | crud-03 4.3.2 | 计数取自 step_records |
| T8.16 | 循环回跳 + 执行总次数上限 `min(max×3, max_loop_multiplier)`（达上限整个 Run 失败） | crud-03 4.3.1；proposal-01 §15 | 接入 T5 配置 |
| T8.17 | 未接住的失败置 Run failed（等收敛、不 abort）；`workflow_done(failed)` 收敛 | crud-03 4.3.1（V11-B） | `terminated_by=error` |
| T8.18 | 终止处理 `terminate`：停派发 + waiting 置 cancelled + 在跑 OP 不 kill 等收敛 → `cancelled` | crud-03 / crud-05 4.7 | 与 T9.6 合并实现 |
| T8.19 | `Engine::recover` 重放残留 `processed=0` 事件重建 RunContext（幂等） | crud-03 4.3/4.3.3 | 崩溃恢复 |
| T8.20 | WorkerPool：入口 `run_job/run_step` **总是**插 waiting 记录后返回（池满不报错） | crud-03 4.4 | DB 排队 |
| T8.21 | WorkerPool 调度线程：轮询 waiting（跳过未到 `not_before_ms`、跳过所属 run 已终态）、CAS 置 running、指派空闲 Worker（小队列） | crud-03 4.4 | `UPDATE ... WHERE status='waiting'` affected=0 即跳过 |
| T8.22 | Worker 执行循环：`Executor::execute` → 写终态 + 调全局完成实现（job→JobComplete / step→StepComplete） | crud-03 4.4 | 池大小 = `ceil(job_queue_running_max×1.5)` |
| T8.23 | 崩溃恢复：启动扫 `status=running` 残留重新指派（复用 record_id） | crud-03 4.4 | — |
| T8.24 | waiting 任务直接 cancel（terminate 时），running 不可外部 cancel（唯一 kill = 自身 timeoutMs） | crud-03 4.4；proposal-01 §1 约束 22 | Job/Workflow 一致 |
| T8.25 | 失败走边前置（V11-B）：失败且有 activated 出边才走边，否则整 Run failed | crud-03 4.3.1 | — |
| T8.26 | import 缺坐标默认排布（`workflow_auto_layout`） | crud-06 一 | 后端生成并持久化 |

---

## T9 运行历史后端 API + TaskRunner（crud-05）

**目标**：TaskRunner（常驻轮询/队列/并发阈值）+ Run 全套接口 + Excel 导出 + 历史清理。
**依赖**：T3、T5、T6、T7；T8 的 StepComplete/terminate 联动。

| ID | 子任务 | 参考 | 产出 / 验收 |
|-|-|-|-|
| T9.1 | TaskRunner 单例 + `add_op/add_job/add_workflow`：写 `job_runs(status=waiting)` 返回 runId | crud-05 4.6；crud-02/03 接口 | 创建即返回 |
| T9.2 | 常驻轮询调度线程：`runner_poll_interval_ms` 扫描、`job_queue_running_max` 并发阈值、`runner_batch_size` 批数、FIFO；OP 直接派 WorkerPool，Job/Workflow 调 `engine.notify(EngineStart)` | crud-05 4.6；proposal-02 §1.2 | waiting→running |
| T9.3 | 全局 waiting 上限检查（`job_queue_waiting_max`）**全入口统一**（手动/cron/单次/重跑/重试） | crud-04 3.4.6 #3 | 触顶 409 `CONCURRENCY_CONFLICT` |
| T9.4 | `GET /api/runs`：筛选（keyword/targetKind/triggeredBy/status/workspace/jobKind/version/timeRange）+ 分页/排序 | crud-05 3.5.1 | timeRange 固定枚举 6 档（无 custom） |
| T9.5 | `GET /api/runs/{runId}`（含 steps；`result` 由 steps 聚合、不落库） | crud-05 3.5.2 | 400/404 |
| T9.6 | `GET /api/runs/{runId}/status`（`{status,updatedAtMs}`） | crud-05 3.5.3 | 轻量轮询 |
| T9.7 | `GET /api/runs/{runId}/steps`（按 `(activation_seq,retry_seq)` 升序） | crud-05 3.5.4 | — |
| T9.8 | `GET /api/runs/{runId}/steps/{stepId}`（降序；最终结果以最后一条为准） | crud-05 3.5.5 | — |
| T9.9 | `POST /api/runs/{runId}/terminate`（OP run vs Workflow run 两类语义；terminating 幂等） | crud-05 3.5.6/4.7 | 运行中 OP 不可终止 409 |
| T9.10 | `POST /api/runs/{runId}/rerun`（仅终态；同事务查上限+建 Run） | crud-05 3.5.7 | 409 `RERUN_NOT_ALLOWED` |
| T9.11 | `POST /api/runs/{runId}/retry`（target=Workflow + 五条件 + 存在失败/超时 step） | crud-05 3.5.8/4.8 | 409 `RETRY_NOT_ALLOWED` |
| T9.12 | `GET /api/runs/{runId}/can-retry`（reason 枚举） | crud-05 3.5.9 | 前端据此显示重试/重跑 |
| T9.13 | `POST /api/runs/export`：按筛选生成两 sheet `.xlsx`，以 base64 返回 `{xlsx}`，**不落盘** | crud-05 3.5.10 | 前端解码 base64 后写入所选目录；文件名默认 `job_result-{ts}-{count}.xlsx` 可自定义（D7） |
| T9.14 | JobRun/StepRecord 快照落库（name/target 拆列/版本/入参/工作区；Job 删除后历史保留） | crud-04 3.4.5；crud-05 3.5 | 快照引用不强外键 |
| T9.15 | 历史清理任务（复用轮询线程，三条件任一超限清理，仅终态，同步删 Run 日志） | crud-06「保存策略」 | — |
| T9.16 | Runner 常驻 + 启动 `recover`（Engine 事件、WorkerPool running 残留） | proposal-02 §1.2 | 重启重建 |

---

## T10 Job 管理后端 API + Scheduler（crud-04）

**目标**：Job CRUD/运行/启停/导入导出 + cron 调度。
**依赖**：T3、T5、T6、T7、T8、T9。

| ID | 子任务 | 参考 | 产出 / 验收 |
|-|-|-|-|
| T10.1 | `GET /api/jobs`（仅 persistent；含 `lastRun`；keyword: name/targetName/description；needsUpdate/enabled/failed 过滤） | crud-04 3.4.1 | `targetName` 由 join 计算；非终态 lastRun 只展示不提供操作（D4=B） |
| T10.2 | `GET /api/jobs/{jobId}` | crud-04 3.4.2 | 400/404 |
| T10.3 | `POST /api/jobs`（kind=persistent；target=op 需 `target.clientId`；cron 校验；enabled 默认 true） | crud-04 3.4.3 | 400（含 `CRON_INVALID`）/404/409 |
| T10.4 | `PUT /api/jobs/{jobId}`（`{job,bumpVersion}`；**全量替换**；schedule 重注册） | crud-04 3.4.4 | — |
| T10.5 | `DELETE /api/jobs/{jobId}`（有在途 waiting/running/terminating → 409 `JOB_HAS_ACTIVE_RUNS`；同事务） | crud-04 3.4.5 | — |
| T10.6 | `POST /api/jobs/{jobId}/run`（手动；`needsUpdate`→`concurrency` 校验顺序；`concurrency` skip/queue/parallel 精确语义；`enabled` 不参与） | crud-04 3.4.6 | 组装 `JobRunRequest` → `add_job` |
| T10.7 | `POST /api/jobs/{jobId}/enable` / `/disable` | crud-04 | 返回 Job |
| T10.8 | `GET /api/jobs/{jobId}/last-run` | crud-04 | JobRun\|null |
| T10.9 | `GET /api/jobs/{jobId}/needs-update` | crud-04 | 动态计算 |
| T10.10 | `POST /api/jobs/{jobId}/export` / `POST /api/jobs/import`（ZIP：manifest + job.yaml + workflows/*.yaml + ops/*.yaml；导入 version 重置为 1、依赖按名称重映射） | crud-04 3.4.9/3.4.10 | `{zip:base64}` |
| T10.11 | Scheduler 单例（`tokio-cron-scheduler`，时区固定 Local，`scheduler_max_jobs` 上限） | proposal-02 §1.1；crud-04 4.5 | 启动加载 cron Job |
| T10.12 | cron 到点触发：检查 `enabled` / `needsUpdate` / 全局 waiting 上限；跳过不触发 | crud-04 4.5.2 | 触顶本轮跳过 |
| T10.13 | `nextRunAtMs` 计算（schedule+enabled+非 needsUpdate 才有值） | crud-04 3.4 字段说明 | 列表/详情返回 |
| T10.14 | Job 导入重映射 + 引用校验（OP/Workflow/Client 不存在 → 404/409 规则） | crud-04 3.4.10 | — |

---

## 附一、跨切面任务（贯穿 T1–T10）

| ID | 子任务 | 说明 |
|-|-|-|
| X1 | 错误码字典统一（`*_NOT_FOUND` / `*_NAME_EXISTS` / `*_REFERENCED` / `*_NEEDS_UPDATE` / `CONCURRENCY_CONFLICT` / `RUN_NOT_TERMINABLE` / `JOB_HAS_ACTIVE_RUNS` 等） | 与各 crud 错误表逐一对齐 |
| X2 | UUID(32 位) 生成、毫秒时间戳、JSON string 时间字段 | proposal-01 §2/§3 |
| X3 | 全局完成回调接线（`JOB_COMPLETE` / `STEP_COMPLETE`）与单例 `init()` 顺序 | proposal-02 §1.2 |
| X4 | 集成测试打通（对应 `tests/集成测试用例.md`） | 每模块 API E2E |
| X5 | 端到端冒烟：OP 单次执行 / Workflow 单次执行 / Job 手动 / Job 定时 四条链路 | 验证全链路 |

---

## 附二、已确认口径

| # | 事项 | 结论 |
|-|-|-|
| C1 | 应用形态 | **非 Tauri**；普通 Rust 单体二进制。构建时将前端全部静态文件（HTML/JS/CSS）**打包进二进制**；运行时二进制**在自身所在目录把静态文件释放到磁盘**，并由同一进程的 HTTP 服务对外提供；浏览器请求接口时理解为对应的前端 HTML/JS/CSS 资源与 `/api` 接口。 |
| C2 | 时间筛选枚举 | `timeRange` 去掉自定义区间，固定为 `last_1h / last_24h / last_2d / last_3d / last_5d / last_7d / last_30d`；不含 `startMs` / `endMs`。（`last_7d` 为 D2 之后补充的选项） |
