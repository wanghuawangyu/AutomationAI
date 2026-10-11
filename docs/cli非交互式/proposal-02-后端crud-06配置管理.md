# 后端 CRUD —— 系统与配置

> 来源：`proposal-02-后端设计.md` 第 3.6 节、第八章（独立拆分，按配置管理 v2 重构）
> 配套文档：`proposal-01-界面设计.md`、`proposal-02-后端设计.md`
> 建表脚本：`schema.sql`（settings 表已废弃）
> 界面原型：`原型图/settings.html`（左下角「设置」入口）

---

## 〇、配置存储模型（v2 变更）

**settings 表已废弃**。配置改为存储在**运行目录下的 `ai-automation.json`**，作为配置的**唯一事实来源**。

- 配置界面展示的配置 = `ai-automation.json` 的内容。
- 界面修改 → `PUT /api/settings` → 后端更新内存配置 → **实时写回 JSON 文件**。
- `schema.sql` 中的 `settings` 表定义及默认 INSERT 已移除。

### 运行目录 `-c`

CLI 入口通过 `-c` 指定运行目录；未指定时默认 `~/.ai-automation`。配置 JSON、DB、日志均存储于该目录：

| 项 | 默认（未指定 `-c`） | 指定 `-c /path` | 说明 |
|-|-|-|-|
| 运行目录 | `~/.ai-automation`（行为等价于 `$HOME/.ai-automation`） | `/path` | CLI 入口 `-c` 参数。**`~` 仅为输入简写**：后端启动时展开为**当前用户家目录的绝对路径**（Unix `/home/<user>`；Windows `C:\Users\<user>`），**接口一律返回展开后的绝对路径**，且分隔符按当前平台（Windows `\`）。前端不做任何展开 / 拼接。 |
| 配置文件 | `{run}/ai-automation.json` | `{run}/ai-automation.json` | 全部配置唯一来源 |
| DB 文件 | `{run}/data/data.db` | `{run}/data/data.db` | SQLite（`data/` 子目录） |
| 应用日志 | `{run}/logs/app-{date}.log` | 同左 | 随运行目录平移 |
| Run 日志 | `{run}/logs/runs/{runId}.log` | 同左 | 随运行目录平移 |
| 工作区根 | `{run}/workspaces` | 同左 | 默认值，只读展示 |

> `db_path`、`workspace_root` 由运行目录推导，**只读**，不作为可修改配置项。

### 配置读写机制

```text
启动: 读 {run}/ai-automation.json ──► 内存 Config (Arc<RwLock<Config>>)
                                          │
PUT /api/settings ──► 校验 ──► 更新内存 ──┤──► 原子写回 ai-automation.json
                                          │      （写临时文件 + rename，防崩溃损坏）
                                          ▼
                              动态配置 ──► 即时通知对应模块
                              （如 log_level → 切换 logger）
```

- 原子写：先写 `ai-automation.json.tmp`，成功后 `rename` 覆盖，避免写一半损坏。
- 动态配置改动即时生效；静态配置改动落盘但需重启，界面标注「重启后生效」。

---

## 一、配置分组与配置项

按后端业务分组。字段说明：**动/静态** —— `动态`=修改即时生效无需重启；`静态`=修改后需重启；`只读`=由运行目录推导或派生值。

| 分组 | 配置项 | 默认 | 动/静态 | 说明 |
|-|-|-|-|-|
| **通用** | `poll_interval_ms` | 2000 | 动态 | 前端轮询建议间隔（ms） |
| | `db_path` | `{run}/data/data.db` | 只读 | 由 `runDir`（`-c`）推导，接口返回拼接后的具体路径 |
| | `workspace_root` | `{run}/workspaces` | 只读 | 由 `runDir`（`-c`）推导，接口返回拼接后的具体路径 |
| | `config_version` / `db_version` | 1 | 只读 | 结构版本 |
| **Client** | `client_import_max_bytes` | 1048576 | 动态 | YAML 导入大小上限（B） |
| **OP** | `op_import_max_bytes` | 1048576 | 动态 | YAML 导入大小上限（B） |
| **Workflow** | `workflow_max_nodes` | 200 | 动态 | 单流程最大节点数 |
| | `workflow_auto_layout` | true | 动态 | 导入缺坐标时自动排布 |
| **Job** | （暂无独立配置项） | — | — | 见「运行历史」；无 Job 自动重试 |
| **运行历史** | `job_queue_waiting_max` | 20 | 动态 | 等待中队列深度上限（**最大 20**） |
| | `job_queue_running_max` | 10 | 动态* | **运行中队列深度上限（最大 10）；Task Runner 并发阈值（同时 running 的 JobRun 数上限）即取此值** |
| | `history_max_per_job` | 10 | 动态 | **单 Job 最大保留历史条数** |
| | `history_max_total` | 1000 | 动态 | **整体最大保留历史条数** |
| | `history_max_age_days` | 183 | 动态 | **单条记录最大保存天数（半年）** |
| **Engine** | `max_loop_multiplier` | 0 | 动态 | 循环总次数上限（0=不限制） |
| | `engine_event_retention_days` | 1 | 动态 | 失败事件保留（1天软删/2天硬删） |
| **Worker** | `worker_pool_size` | =1.5×running | 只读派生 | Worker 池大小 = `ceil(job_queue_running_max × 1.5)`，只读展示；**与 Task Runner 并发阈值无关** |
| | `worker_max_concurrency` | =pool_size | 只读派生 | = `worker_pool_size`（单 Worker 单工作线程） |
| **Task Runner** | `runner_poll_interval_ms` | 1000 | 动态 | 调度轮询间隔（ms） |
| | `runner_batch_size` | 10 | 动态 | 单轮调度批数 |
| **Scheduler** | `scheduler_max_jobs` | 100 | 动态 | 可加载定时任务上限（时区固定 Local） |
| **日志** | `log_level` | info | 动态 | 应用日志级别 |
| | `log_max_files` | 10 | 动态 | 最大绕接 zip 文件数（无保留天数） |

\* `job_queue_running_max`：运行中队列深度限制**即时生效**；其派生的 Worker 池大小在下次启动按新值初始化（界面标注「🔄 池大小重启后生效」）。

**三者的关系（P3，避免混淆）**：

| 概念 | 取值 | 作用 |
|-|-|-|
| Task Runner 并发阈值（`running_count` 上限） | **`job_queue_running_max`**（默认 10） | Runner 调度：`running_count < 阈值` 才把 waiting 的 JobRun 取出并置 running |
| Worker 池大小 `worker_pool_size` | `ceil(job_queue_running_max × 1.5)`（派生，只读） | WorkerPool 内部常驻执行体数量，**与 Runner 阈值无直接关系**（一个 JobRun 可同时跑多个 step） |
| Worker 串行上限 `worker_max_concurrency` | = `worker_pool_size`（派生） | 同时执行的 OP 数上限（单 Worker 单线程） |

### 运行历史保存策略（v2 重新设计）

原 `history_retention_days` / `run_log_retention_days` 已废弃，改为三独立维度：

1. **单 Job 保留上限**：`history_max_per_job`（默认 10）——每个 Job 最多保留的历史运行条数。
2. **整体保留上限**：`history_max_total`（默认 1000）——全部 Job 累计历史总条数。
3. **单条保存时长**：`history_max_age_days`（默认 183）——单条记录最长保存天数。

> **口径（P12）**：“半年”按 365/2 ≈ 182.6 向上取整取 **183 天**（非自然年一半）。

> 三条件任一触发即清理（按 `finished_at_ms` / `created_at_ms` 由旧到新）。

### 日志绕接（v2）

应用日志**不设保留天数**，绕接为 zip 后按**最大文件数**（`log_max_files`）保留，超限删最旧。
绕接文件名规则：`{日志名}-{YYYYMMDDHHMMSS}{三位毫秒}.zip`（如 `app-20261011103012345.zip`）。

---

## 二、通用约定

> 以下为系统与配置全部 API 的完整 HTTP 定义。通用约定：
> - 基础路径 `/api`。
> - 时间字段 JSON 中统一为 string（毫秒时间戳）。
> - 错误响应统一格式 `{"error":{"code":"...","message":"..."}}`。
> - 配置项 key 为业务键（非 UUID），API 不暴露 id；配置来源为 `ai-automation.json`。

---

## 三、接口定义

### 3.1 GET /api/system/status —— 系统状态

**功能说明**：返回后端进程运行状态，前端用于首页 / 设置页显示守护进程是否运行及运行时长。

**路径参数**：无　**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
{
  "status": "running",
  "uptimeMs": "3600000",
  "activeRuns": 2
}
```

| 字段 | 类型 | 说明 |
|-|-|-|
| status | enum | `running` / `stopped` |
| uptimeMs | string | 进程已运行时长（毫秒时间戳） |
| activeRuns | integer | 当前运行中的 Run 数 |

**错误响应**：无（恒 200）。

---

### 3.2 GET /api/system/version —— 版本信息

**功能说明**：返回后端版本号，前端用于展示版本信息及兼容性判断。

**路径参数**：无　**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
{ "version": "0.1.0" }
```

**错误响应**：无。

---

### 3.3 GET /api/settings —— 读取配置

**功能说明**：读取**全部**全局配置（来源：`ai-automation.json`），前端据此渲染配置界面。**响应含 `runDir`（当前配置目录，由 CLI 入口 `-c` 指定；未指定默认 `~/.ai-automation`）**——只读派生项（`db_path` / `workspace_root`）由后端按 `runDir` 拼接为**具体路径**后返回（非 `{run}` 占位符），前端直接展示、无需自行推导。

**路径参数**：无　**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
{
  "runDir": "C:\\Users\\alice\\.ai-automation",
  "general": {
    "poll_interval_ms": "2000",
    "db_path": "C:\\Users\\alice\\.ai-automation\\data\\data.db",
    "workspace_root": "C:\\Users\\alice\\.ai-automation\\workspaces",
    "config_version": "1",
    "db_version": "1"
  },
  "client": { "client_import_max_bytes": "1048576" },
  "op": { "op_import_max_bytes": "1048576" },
  "workflow": {
    "workflow_max_nodes": "200",
    "workflow_auto_layout": "true"
  },
  "history": {
    "job_queue_waiting_max": "20",
    "job_queue_running_max": "10",
    "history_max_per_job": "10",
    "history_max_total": "1000",
    "history_max_age_days": "183"
  },
  "engine": {
    "max_loop_multiplier": "0",
    "engine_event_retention_days": "1"
  },
  "worker": {
    "worker_pool_size": "15",
    "worker_max_concurrency": "15"
  },
  "runner": {
    "runner_poll_interval_ms": "1000",
    "runner_batch_size": "10"
  },
  "scheduler": { "scheduler_max_jobs": "100" },
  "log": {
    "log_level": "info",
    "log_max_files": "10"
  }
}
```

> 返回全部配置（值为 string），按业务分组组织。派生/只读项（`worker_pool_size`、`worker_max_concurrency`）以 **`worker` 分组**一并返回（与原型图、mock 数据一致，见 `原型图/settings.html`）。
>
> `runDir` 为**顶层字段**：当前配置目录（`-c` 指定值，未指定默认 `~/.ai-automation`）；**`~` 仅为输入简写，接口返回的 `runDir` / `db_path` / `workspace_root` 一律为已展开、按平台分隔符的绝对路径**（Unix `/home/<user>/.ai-automation`；Windows `C:\Users\<user>\.ai-automation`）。前端直接将 `runDir` 与相对名拼接即可得到可执行路径（见 `原型图/settings.html`）。

**错误响应**：无。

---

### 3.4 PUT /api/settings —— 更新配置

**功能说明**：更新全局配置项，**校验通过后立即更新内存配置并原子写回 `ai-automation.json`**，返回更新后的全部配置。

**路径参数**：无　**查询参数**：无

**请求体**：

```json
{ "log": { "log_level": "debug" } }
```

| 字段 | 类型 | 必填 | 说明 |
|-|-|-|-|
| (分组.key) | object | 是 | 需更新的 KV 项；空对象视为不更新 |

**成功响应 `200 OK`**：返回更新后的全部配置（结构同 GET /api/settings）。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | key 不存在、value 非法、超出上限（见下「数值项上限」）；**:warning: 只读项不可修改**——`db_path` / `workspace_root` / `config_version` / `db_version` 被提交时**明确拒绝**（返回 message 指明该项只读），不静默忽略 |

**只读项与版本维护（P9/P10）**：

| 项 | 来源 / 维护方 | 说明 |
|-|-|-|
| `db_path` / `workspace_root` | 由 `runDir` 推导 | 只读，不可 PUT |
| `config_version` | **配置模块**维护 | `ai-automation.json` 的**结构版本**（存于 JSON 内）；启动读取时若缺失或低于程序支持版本 → 自动迁移后写回并递增；用户不可改 |
| `db_version` | **DB 迁移**维护 | SQLite schema 版本（等价 `PRAGMA user_version`），**不存于 JSON**，仅经本接口只读展示 |

**数值项上限（P11）**：

| 配置项 | 上限 | 配置项 | 上限 |
|-|-|-|-|
| `job_queue_waiting_max` | 20 | `runner_poll_interval_ms` | 60000 |
| `job_queue_running_max` | 10 | `runner_batch_size` | 100 |
| `poll_interval_ms` | 60000 | `scheduler_max_jobs` | 1000 |
| `client_import_max_bytes` / `op_import_max_bytes` | 104857600（100MB） | `log_max_files` | 100 |
| `workflow_max_nodes` | 1000 | `max_loop_multiplier` | 10000（0=不限制） |
| `history_max_per_job` | 1000 | `engine_event_retention_days` | 30 |
| `history_max_total` | 100000 | `history_max_age_days` | 3650 |

> 未列出的布尔/枚举/字符串项按类型校验（布尔、枚举白名单、非空等）；上限均为**可配置的最大值**，超过即 400 `VALIDATION_ERROR`。

---

### 3.5 GET /api/workspaces —— 最近使用的工作区列表

**功能说明**：返回最近使用的工作区路径列表，前端在新建 / 编辑任务时快速选择工作区。

**路径参数**：无

**查询参数**：

| 参数 | 位置 | 类型 | 必填 | 默认 | 说明 |
|-|-|-|-|-|-|
| limit | query | integer | 否 | 10 | 返回条数上限 |
| keyword | query | string | 否 | — | 模糊匹配路径 |

**请求体**：无

**成功响应 `200 OK`**：

```json
{ "items": ["/path/ws-001", "/path/ws-002"] }
```

**错误响应**：400 `VALIDATION_ERROR`（limit 非法）。

---

## 四、配置项与其它模块联动

| 配置项 | 消费方 | 生效语义 |
|-|-|-|
| `max_loop_multiplier` | Engine（crud-03 4.3.0） | 执行总次数上限 = `min(max×3, max_loop_multiplier)`，`0`=不限制 |
| `job_queue_waiting_max` | 运行历史（原 crud-04 3.4.6） | 全局 waiting 队列深度上限：`count(*) FROM job_runs WHERE status='waiting'` 达此值即拒新建 |
| `job_queue_running_max` | 运行历史 / Worker | running 状态队列深度上限；派生 Worker 池 |
| `history_max_*` | 运行历史清理任务 | 三条件任一触发即清理 |
| `engine_event_retention_days` | Engine 事件清理 | 失败事件 1 天软删 / 2 天硬删 |
| `log_level` | 日志管理 | 动态切换 logger 级别 |
| `log_max_files` | 日志滚动器 | 绕接 zip 超限删最旧 |

### Worker 队列失败语义（实现约束）

WorkerPool **不设本地滞留队列**（废弃 `worker_queue_depth`）。触发 OP / step 失败时，**必须向上游返回失败信号，由上游重试**——否则上游会不停下发，且任务滞留队列在重启后丢失。

**派发失败与重试（P3，v2 明确）**：

- Worker 池大小固定 = `ceil(job_queue_running_max × 1.5)`；`worker_pool_size` 与 Task Runner 并发阈值（`job_queue_running_max`）**是两回事**。
- 派发入口 `worker.run_job(req)` / `worker.run_step(req, inst)` 在**无空闲 Worker**时返回 `Err(NoIdleWorker)`（**不落 waiting 记录、不滞留**）——即「派发失败」。
- **上游必须重试派发直到成功**：
  - **Task Runner**（单次 OP）：`add_op` 派发失败 → JobRun **保持 `waiting`**（不转 running、不占 `job_queue_running_max` 名额），Runner 常驻轮询按 `runner_poll_interval_ms` 重试派发。
  - **Engine**（workflow 节点）：`worker.run_step` 返回 Err → `dispatch_step` **不置 `processed=1`**（保持可重放），Engine 重试派发，直到成功——否则 DAG 执行链会断。
- **状态语义**：JobRun 仅在**某个 OP 成功派发之后**才 `waiting → running`（界面“等待中” → “运行中”）；派发重试期间仍显示「等待中」。
- **终止 / 取消交互**：重试派发期间 Run 已被终止 / 取消 → **该未派发成功的节点直接置 `cancelled`，不再派发**（Engine 处理 terminate 事件时对 pending 节点执行，并停止其重试）。

---

## 五、变更记录

| 版本 | 变更 |
|-|-|
| v2 | settings 表废弃 → `ai-automation.json` 唯一事实来源；新增 `-c` 运行目录；实时写回；按业务分组；`history_*` 三维度保存策略；日志绕接 zip 按最大文件数；Worker 池派生；Scheduler 时区固定 Local；**GET /api/settings 返回顶层 `runDir`，只读派生项由后端按 runDir 拼接为具体路径下发** |
