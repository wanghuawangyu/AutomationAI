# 后端 CRUD —— 系统与配置

> 来源：`proposal-02-后端设计.md` 第 3.6 节、第八章（独立拆分，内容原样迁移）
> 配套文档: `proposal-01-界面设计.md`、`proposal-02-后端设计.md`
> 配套建表脚本: `schema.sql`

---

### 3.6 系统与配置

| 方法 | 路径 | 说明 |
|-|-|-|
| GET | `/api/system/status` | `{status:"running", uptimeMs, activeRuns}` |
| GET | `/api/system/version` | `{version:"0.1.0"}` |
| GET | `/api/settings` | KV 配置 |
| PUT | `/api/settings` | 更新配置 |
| GET | `/api/workspaces` | 最近使用的工作区列表 |

---

### 3.6.0 通用约定

> 以下为系统与配置全部 API 的完整 HTTP 定义。通用约定：
> - 基础路径 `/api`。
> - 时间字段 JSON 中统一为 string（毫秒时间戳）。
> - 错误响应统一格式 `{"error":{"code":"...","message":"..."}}`。

**字段命名 ↔ 数据库列映射**：`settings` 表**无 id 列**，`key` 为业务配置键（非 UUID），API 不暴露 id；其余配置值字段在 `schema.sql` 中对应 `settings.value`。

---

### 3.6.1 GET /api/system/status —— 系统状态

**功能说明**：返回后端进程运行状态，前端用于首页 / 设置页显示守护进程是否在运行及运行时长。

**路径参数**：无　**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
{
  "status": "running",
  "uptimeMs": "3600000",
  "activeRuns": 2
}
```

| 响应字段 | 类型 | 说明 |
|-|-|-|
| status | enum | `running` / `stopped` |
| uptimeMs | string | 进程已运行时长（毫秒时间戳） |
| activeRuns | integer | 当前运行中的 Run 数 |

**错误响应**：无（恒 200）。

---

### 3.6.2 GET /api/system/version —— 版本信息

**功能说明**：返回后端版本号，前端用于展示版本信息及兼容性判断。

**路径参数**：无　**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
{ "version": "0.1.0" }
```

**错误响应**：无。

---

### 3.6.3 GET /api/settings —— 读取配置

**功能说明**：读取全部全局 KV 配置（如轮询间隔、日志级别等），前端据此设定自身行为。

**路径参数**：无　**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
{
  "items": {
    "poll_interval_ms": "2000",
    "log_level": "info",
    "max_loop_multiplier": "0",
    "db_version": "1"
  }
}
```

> 返回 settings 表全部 KV 配置（值为 string）。

**错误响应**：无。

---

### 3.6.4 PUT /api/settings —— 更新配置

**功能说明**：更新全局配置项（如修改日志级别、轮询间隔），返回更新后的全部配置。

**路径参数**：无　**查询参数**：无

**请求体**：

```json
{ "log_level": "debug" }
```

| 字段 | 类型 | 必填 | 说明 |
|-|-|-|-|
| (key) | object | 是 | 需要更新的 KV 项；空对象视为不更新 |

**成功响应 `200 OK`**：返回更新后的全部配置（结构同 GET /api/settings）。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | key 不存在或 value 非法 |

---

### 3.6.5 GET /api/workspaces —— 最近使用的工作区列表

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
{
  "items": ["/path/ws-001", "/path/ws-002"]
}
```

**错误响应**：400 `VALIDATION_ERROR`（limit 非法）。

---

## 八、配置管理

| Key | 默认值 | 说明 |
|-|-|-|
| poll_interval_ms | 2000 | 前端轮询建议间隔 |
| log_level | info | 日志级别 |
| max_loop_multiplier | 0 | 循环执行总次数绝对上限；`0`=不限制（按 `max×3`），否则与 `max×3` 取较小值（见 crud-03 4.3.0） |
| db_path | ~/.ai-automation/data.db | SQLite 文件路径 |
| workspace_root | ~/.ai-automation/workspaces | 默认工作区根目录 |
