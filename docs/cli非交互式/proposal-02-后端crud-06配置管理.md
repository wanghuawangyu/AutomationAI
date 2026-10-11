# 后端 CRUD —— 系统与配置

> 来源：`proposal-02-后端设计.md` 第 3.6 节、第八章（独立拆分，按配置管理 v2 重构）
> 配套文档：`proposal-01-界面设计.md`、`proposal-02-后端设计.md`
> 建表脚本：`schema.sql`（settings 表已废弃）
> 界面原型：`原型图/settings.html`（左下角「设置」入口）

---

## 〇、配置存储模型（v2 变更）

**settings 表已废弃**。配置改为存储在**运行目录下的 `ai-automation.json`**，作为**可配置项**的唯一事实来源。

- 配置界面展示的**可配置项** = `ai-automation.json` 的内容（唯一事实来源）；**派生只读项**（`worker_pool_size` / `worker_max_concurrency`）与 **DB 结构版本 `db_version`** 不由 JSON 存储，由接口**附加返回**（不参与写入，见 3.3/3.4）。
- 界面修改 → `PUT /api/settings` → 后端更新内存配置 → **实时写回 JSON 文件**。
- `schema.sql` 中的 `settings` 表定义及默认 INSERT 已移除。

### 运行目录 `-c`

CLI 入口通过 `-c` 指定运行目录；未指定时默认 `~/.ai-automation`。配置 JSON、DB、日志均存储于该目录：

| 项 | 默认（未指定 `-c`） | 指定 `-c /path` | 说明 |
|-|-|-|-|
| 运行目录 | `~/.ai-automation`（行为等价于 `$HOME/.ai-automation`） | `/path` | CLI 入口 `-c` 参数。**`~` 仅为输入简写**：后端启动时展开为**当前用户家目录的绝对路径**（Unix `/home/<user>`；Windows `C:\Users\<user>`），且分隔符按当前平台（Windows `\`）。**路径拼接一律由后端完成**：接口下发的均为已展开的绝对路径（见 3.3）；**前端不做 `~` 展开、不拼路径**。 |
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
- **首次启动 / 缺失损坏**：启动时若 `{run}/ai-automation.json` **不存在** → 写入一份**默认配置**后加载；若**存在但解析失败**（JSON 损坏）→ **报错并拒绝启动**（或将损坏文件备份为 `.bak` 后按默认重建，由实现选择）——不静默以残缺配置运行。
- **生效语义**：当前版本**所有可配置项均为动态（修改后无需重启）**，无纯「静态（需重启）」可配置项；唯一的重启生效场景 = `job_queue_running_max` 派生的 **Worker 池大小**在下一次启动按新值重新初始化（界面于该项注明「🔄 池大小重启后生效」）。动态项内分两档：**即时生效**（`log_level`、`job_queue_running_max` 阈值等，改动即对运行中模块生效）与**下次使用生效**（`history_max_*`、`workflow_max_nodes` / `workflow_auto_layout`、`runner_batch_size` / `runner_poll_interval_ms`、`scheduler_max_jobs` 等，改动在消费方下次读取 / 下次调度 / 下次导入时生效）。

---

## 一、配置分组与配置项

按后端业务分组。字段说明：**生效方式** —— `动态`=修改即时生效无需重启（当前**全部可配置项均为动态，无纯静态项**）；`动态*`=限制即时生效、但派生的 Worker 池大小重启后生效；`只读`=由运行目录推导或派生值（不可修改）。

| 分组 | 配置项 | 默认 | 动/静态 | 说明 |
|-|-|-|-|-|
| **通用** | `poll_interval_ms` | 2000 | 动态 | **前端**轮询建议间隔（ms；前端经 GET /api/settings 读取） |
| | `db_path` | `{run}/data/data.db` | 只读 | 由 `runDir`（`-c`）推导，接口返回拼接后的具体路径 |
| | `workspace_root` | `{run}/workspaces` | 只读 | 由 `runDir`（`-c`）推导，接口返回拼接后的具体路径 |
| | `config_version` | 1 | 只读 | `ai-automation.json` 结构版本（写入 JSON，见 3.4） |
| | `db_version` | 1 | 只读 | DB 结构版本（`PRAGMA user_version`，**不落 JSON、仅接口附加，界面不展示**） |
| **Client** | `client_import_max_bytes` | 1048576 | 动态 | YAML 导入大小上限（B） |
| **OP** | `op_import_max_bytes` | 1048576 | 动态 | YAML 导入大小上限（B） |
| **Workflow** | `workflow_max_nodes` | 200 | 动态 | 单流程最大节点数 |
| | `workflow_auto_layout` | true | 动态 | 导入缺坐标时自动排布 |
| **运行历史** | `job_queue_waiting_max` | 20 | 动态 | 等待中队列深度上限（**默认 20，用户可调，上限 1000**；超出即拒新建运行任务）。**Job 无独立配置项、不设自动重试**（任务失败即失败，需人工重跑或在 Workflow 节点配置 `retry`） |
| | `job_queue_running_max` | 10 | 动态* | **运行中队列深度上限（最大 10）；Task Runner 并发阈值（同时 running 的 JobRun 数上限）即取此值** |
| | `history_max_per_job` | 10 | 动态 | **单 Job 最大保留历史条数** |
| | `history_max_total` | 1000 | 动态 | **整体最大保留历史条数** |
| | `history_max_age_days` | 180 | 动态 | **单条记录最大保存天数（半年，硬上限 180）** |
| **Engine** | `max_loop_multiplier` | 0 | 动态 | 循环总次数上限（0=不限制） |
| | `engine_event_retention_days` | 1 | 动态 | Engine 事件清理（`engine_events` 表，重放事件）：**成功 run 完成即物理删本 run 事件**；失败 run 最终不重试 → 1 天软删 / 2 天硬删。**不影响 `step_records` 明细**（后者由运行历史 `history_max_*` 保留） |
| **Worker** | `worker_pool_size` | =1.5×running | 只读派生 | Worker 池大小 = `ceil(job_queue_running_max × 1.5)`，只读展示；**数值派生自同一配置，语义与 Task Runner 并发阈值不同**（阈值为 running 的 JobRun 数上限，池大小为常驻执行体数） |
| | `worker_max_concurrency` | =pool_size | 只读派生 | = `worker_pool_size`（单 Worker 单工作线程） |
| **Task Runner** | `runner_poll_interval_ms` | 1000 | 动态 | **后端** Task Runner 调度轮询间隔（ms；区别于前端 `poll_interval_ms`） |
| | `runner_batch_size` | 10 | 动态 | 单轮调度批数 |
| **Scheduler** | `scheduler_max_jobs` | 100 | 动态 | 可加载定时任务上限（时区固定 Local） |
| **日志** | `log_level` | info | 动态 | 应用日志级别 |
| | `log_max_files` | 10 | 动态 | 最大绕接 zip 文件数（无保留天数） |

\* `job_queue_running_max`：运行中队列深度限制**即时生效**；其派生的 Worker 池大小在下次启动按新值初始化（界面标注「🔄 池大小重启后生效」）。**改小上限仅约束新调度**：存量 waiting 自然消化、存量 running 自然收敛（OP 不可 kill、不做强制清理），直到自然降到新阈值以下。

**三者的关系（避免混淆）**：

| 概念 | 取值 | 作用 |
|-|-|-|
| Task Runner 并发阈值（`running_count` 上限） | **`job_queue_running_max`**（默认 10） | Runner 调度：`running_count < 阈值` 才把 waiting 的 JobRun 取出并置 running |
| Worker 池大小 `worker_pool_size` | `ceil(job_queue_running_max × 1.5)`（派生，只读） | WorkerPool 内部常驻执行体数量；**数值派生自同一配置，语义与 Runner 阈值不同**（一个 JobRun 可并行多个 step） |
| Worker 串行上限 `worker_max_concurrency` | = `worker_pool_size`（派生） | 同时执行的 OP 数上限（单 Worker 单线程） |

### 运行历史保存策略（v2 重新设计）

原 `history_retention_days` / `run_log_retention_days` 已废弃，改为三独立维度：

1. **单 Job 保留上限**：`history_max_per_job`（默认 10）——每个 Job 最多保留的历史运行条数。
2. **整体保留上限**：`history_max_total`（默认 1000）——全部 Job 累计历史总条数。
3. **单条保存时长**：`history_max_age_days`（默认 180）——单条记录最长保存天数。

> **口径（拍板）**：“半年”= **180 天**，为**硬上限**（配置不得超过 180；语义：运行历史只按“半年内”保留，不做长期归档）。

> **清理范围**：**仅清理终态记录**（`success` / `failed` / `timeout` / `cancelled`）；`waiting` / `running` / `terminating` 的 JobRun **不参与清理**（waiting 尚未执行、running 无 `finished_at_ms`、terminating 等待收敛）。判定：三条件任一超限即按 `finished_at_ms` 由旧到新清理，清理即止、不复检其它未超限条件。

### 日志绕接（v2）

应用日志**不设保留天数**，绕接为 zip 后按**最大文件数**（`log_max_files`）保留，超限删最旧。
绕接文件名规则：`{日志名}-{YYYYMMDDHHMMSS}{三位毫秒}.zip`（如 `app-20261011103012345.zip`）。

**Run 日志（`logs/runs/{runId}.log`）**：每条 Run 一个、不滚动、**不参与 zip 绕接**（`log_max_files` 仅约束应用日志）。其保留**随运行历史一并清理**——遵循 `history_max_age_days` / `history_max_total` / `history_max_per_job`（见「运行历史保存策略」）：Run 记录被清理时同步删除其日志，不独立设保留配置。

---

## 二、通用约定

> 以下为系统与配置全部 API 的完整 HTTP 定义。通用约定：
> - 基础路径 `/api`。
> - 时间字段 JSON 中统一为 string（毫秒时间戳）。
> - 错误响应统一格式 `{"error":{"code":"...","message":"..."}}`。
> - 配置项 key 为业务键（非 UUID），API 不暴露 id；配置来源为 `ai-automation.json`。

---

## 三、接口定义

**接口一览（C4：配置类接口全集，便于读者总览）**：

| 方法 | 端点 | 功能 | 章节 |
|-|-|-|-|
| GET | `/api/system/status` | 系统状态（进程运行状态 / 运行时长 / 在途 Run 数） | 3.1 |
| GET | `/api/system/version` | 版本信息（返回 `{version}`；config_version / db_version 属 GET /api/settings 附加返回） | 3.2 |
| GET | `/api/settings` | 读取全部配置（只读项由 runDir 推导 / 接口附加） | 3.3 |
| PUT | `/api/settings` | 更新配置（校验 + 内存更新 + 原子写回 ai-automation.json） | 3.4 |
| POST | `/api/settings/reset` | 恢复默认配置（内置默认值，只读项不参与） | 3.5 |
| GET | `/api/workspaces` | 最近使用的工作区列表 | 3.6 |

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

**功能说明**：读取**全部**全局配置（可配置项来源：`ai-automation.json`），前端据此渲染配置界面。**响应含 `runDir`（当前配置目录，由 CLI 入口 `-c` 指定；未指定默认 `~/.ai-automation`）**——只读派生项（`db_path` / `workspace_root`）由后端按 `runDir` **拼接为具体绝对路径**后返回（非 `{run}` 占位符），前端直接展示、无需（也不应）自行拼接。

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
    "history_max_age_days": "180"
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

> 返回全部配置（值为 string），按业务分组组织。**可配置项来自 JSON；派生只读项（`worker_pool_size`、`worker_max_concurrency`）与 `db_version` 由接口附加返回**（不存 JSON）。
>
> `runDir` 为**顶层字段**：当前配置目录（`-c` 指定值，未指定默认 `~/.ai-automation`）；**`~` 仅为输入简写，接口返回的 `runDir` / `db_path` / `workspace_root` 一律为已展开、按平台分隔符的绝对路径**（Unix `/home/<user>/.ai-automation`；Windows `C:\Users\<user>\.ai-automation`）。前端直接展示下发的 `db_path` / `workspace_root`；**不自行拼接路径**（如底部信息条展示配置文件位置，可直接用下发的绝对 `runDir` 拼接固定文件名 `ai-automation.json`，仅展示用途）。

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
| 500 | `WRITE_FAILED` | 校验通过、内存已更新，但**原子写回 `ai-automation.json` 失败**（磁盘满 / 权限 / rename 失败）——**回滚内存配置至写回前状态**并返回 500，保证内存与磁盘一致（不产生「内存已改、磁盘未改」的半更新）；前端提示「保存失败，配置未生效」 |

**只读项与版本维护**：

| 项 | 来源 / 维护方 | 说明 |
|-|-|-|
| `db_path` / `workspace_root` | 由 `runDir` 推导 | 只读，不可 PUT |
| `config_version` | **配置模块**维护 | `ai-automation.json` 的**结构版本**（存于 JSON 内）；启动读取时若缺失或低于程序支持版本 → 自动迁移后写回并递增；用户不可改。**迁移失败回退（P6）**：① 读取/解析/迁移步骤异常 → **不写回**、原文件先备份为 `ai-automation.json.bak`，按「程序支持版本」内置默认结构加载（保证可启动），`config_version` 保持原值**不递增**，错误记录日志并经 `GET /api/settings` 只读附加返回 `migrate_error`，前端提示「配置迁移失败，已按默认结构加载，原配置已备份」；② 迁移后**写回失败**（磁盘满/权限/rename 失败）→ 内存保持迁移后值、磁盘原文件不动，返回 500 `WRITE_FAILED`，`config_version` 不递增（下次启动重新尝试迁移）。**程序支持版本**判定：内置 `SUPPORTED_CONFIG_VERSION` 常量；仅当 JSON 中 `config_version` 缺失或数值小于该常量时才触发迁移 |
| `db_version` | **DB 迁移**维护 | SQLite schema 版本（等价 `PRAGMA user_version`），**不存于 JSON、仅经本接口只读附加返回**；**配置界面不展示**（拍板） |

**数值项上限**：

| 配置项 | 上限 | 配置项 | 上限 |
|-|-|-|-|
| `job_queue_waiting_max` | 1000（默认 20） | `runner_poll_interval_ms` | 60000 |
| `job_queue_running_max` | 10 | `runner_batch_size` | 100 |
| `poll_interval_ms` | 60000 | `scheduler_max_jobs` | 1000 |
| `client_import_max_bytes` / `op_import_max_bytes` | 104857600（100MB） | `log_max_files` | 100 |
| `workflow_max_nodes` | 1000 | `max_loop_multiplier` | 10000（**0 不受此上限约束**：0=不限制） |
| `history_max_per_job` | 1000 | `engine_event_retention_days` | 30 |
| `history_max_total` | 100000 | `history_max_age_days` | **180（硬上限）** |

> 未列出的布尔/枚举/字符串项按类型校验（布尔、枚举白名单、非空等）；上限均为**可配置的最大值**，超过即 400 `VALIDATION_ERROR`。
> **`max_loop_multiplier` 合法取值**：`0` **或** `1..10000`；`0` 语义为“不限制”，**优先于上限**（上限仅约束非零取值）。

**恢复默认（reset）**：见 3.5 节。

---

### 3.5 POST /api/settings/reset —— 恢复默认配置

**功能说明**：将 `ai-automation.json` **重置为程序内置默认值**（校验后更新内存并**原子写回**，语义同 PUT 3.4），返回更新后的全部配置（结构同 GET /api/settings）。只读项（`db_path` / `workspace_root` / `config_version` / `db_version` / worker 派生）**不参与重置**（仍按 runDir 推导 / 接口附加）；失败语义同 PUT（500 `WRITE_FAILED`）。配置界面「恢复默认」按钮调用此接口。

**路径参数**：无　**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：更新后的全部配置（结构同 GET /api/settings）。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 500 | `WRITE_FAILED` | ai-automation.json 原子写回失败（磁盘 / 权限） |

---

### 3.6 GET /api/workspaces —— 最近使用的工作区列表

**功能说明**：返回最近使用的工作区路径列表，前端在新建 / 编辑任务与运行历史筛选时快速选择工作区。

**数据来源（D6 定稿）**：取自 `job_runs.workspace` **去重**（`SELECT DISTINCT workspace FROM job_runs`），按**最近使用**排序（`ORDER BY MAX(created_at_ms) DESC`，即该工作区最近一次运行时间倒序），取 `limit` 条。**不读取配置或独立的工作区表**——工作区是运行历史的自然后果。

**路径参数**：无

**查询参数**：

| 参数 | 位置 | 类型 | 必填 | 默认 | 说明 |
|-|-|-|-|-|-|
| limit | query | integer | 否 | 10 | 返回条数上限（去重后） |
| keyword | query | string | 否 | — | 模糊匹配路径（`workspace LIKE %keyword%`） |

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
| `job_queue_waiting_max` | 运行历史（原 crud-04 3.4.6） | 全局 waiting 队列深度上限（默认 20、可调、上限 1000）：`count(*) FROM job_runs WHERE status='waiting'` 达此值即拒新建 |
| `job_queue_running_max` | 运行历史 / Worker | running 状态队列深度上限；派生 Worker 池 |
| `history_max_*` | 运行历史清理任务（后台周期） | 三条件任一超限即清理；**触发机制**：随 `runner_poll_interval_ms` 复用同一常驻轮询线程，每次轮询顺带检查并清理（与 Engine 事件清理 `engine_event_retention_days` 为**同一清理任务**） |
| `engine_event_retention_days` | Engine 事件清理（同运行历史清理任务） | 成功 run 完成即物理删本 run 事件；失败 run 最终不重试 → 1 天软删 / 2 天硬删。清理对象为 `engine_events` 重放事件，不影响 `step_records` 明细 |
| `log_level` | 日志管理 | 动态切换 logger 级别 |
| `log_max_files` | 日志滚动器 | 绕接 zip 超限删最旧 |

### Worker 队列失败语义（实现约束）

WorkerPool **不设本地滞留队列**（废弃 `worker_queue_depth`）。**任务排队一律入 DB**（`step_records` waiting），因此**无内存滞留、重启不丢**。

**入队 / 调度机制（定稿：DB 排队）**：

- **入队（派发）总是成功**：`worker.run_job(req)` / `worker.run_step(req, inst)` **总是**写 `step_records(waiting)` 后返回；**池满（无空闲 Worker）不报错**，任务就留在 waiting 由 WorkerPool 调度线程稍后指派。对 **Job / Workflow（OP 与 Workflow 执行）一律生效**。
- **术语定义**：「**入队/派发**」= 写 step_records（同步、除 DB 错误必成功）；「**执行失败**」= OP 返回非 0 / 超时（→ `apply_retry` / 走边）；「**DB 错误**」= 写库返回 Err（→ T26 重放）。**不存在“无空闲 Worker 导致的派发失败”**。
- **状态语义**：JobRun 在**入队成功之后**才 `waiting → running`（界面「等待中」→「运行中」）；池满时 OP 已在 step_records 排队，不阻塞 JobRun 转 running。
- **cancel 范围**：`step_records` 中 **waiting（排队中）的 OP 可直接置 `cancelled`**（不再指派）；**仅 running 的 OP 不可外部 cancel**（OP 为最小原子执行单位，唯一 kill = 其自身 `timeoutMs` 到期）。对 Job / Workflow 一致。

---

## 五、变更记录

| 版本 | 变更 |
|-|-|
| v2 | settings 表废弃 → `ai-automation.json` 唯一事实来源；新增 `-c` 运行目录；实时写回；按业务分组；`history_*` 三维度保存策略；日志绕接 zip 按最大文件数；Worker 池派生；Scheduler 时区固定 Local；**GET /api/settings 返回顶层 `runDir`，只读派生项由后端按 runDir 拼接为具体路径下发** |
| v2.1 | 路径拼接职责统一（一律后端拼接绝对路径下发，前端不拼）；可配置项/派生只读项来源说清；`job_queue_waiting_max` 上限放宽到 1000（默认 20，超出即拒新建，用户可调）；`history_max_age_days` 硬上限 180；`max_loop_multiplier` 合法取值 0 或 1..10000；`db_version` 界面不展示 |
| v2.2 | **WorkerPool 定稿为 DB 排队**：入队（派发）总是成功、池满不报错（删除 Err(NoIdleWorker)）；等待中的 step 可直接 cancel、running 的不可 cancel；术语「入队/执行失败/DB 错误」分立 |
| v2.3 | 前端原型（mock / index / workflow / job / client / op）严格对齐 API 结构；bindings 定稿结构化对象（outputName/inputName）、EdgeCondition 定稿字符串枚举；遣词修正：「与并发阈值无关」→「数值派生自同一配置、语义不同」 |
