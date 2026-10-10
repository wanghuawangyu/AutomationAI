# 后端 CRUD —— OP 管理

> 来源：`proposal-02-后端设计.md` 第 3.2 节、第 4.1 节（独立拆分，内容原样迁移）
> 配套文档: `proposal-01-界面设计.md`、`proposal-02-后端设计.md`
> 配套建表脚本: `schema.sql`

---

### 3.2 OP 管理

| 方法 | 路径 | 请求 Body | 响应 | 说明 |
|-|-|-|-|-|
| GET | `/api/ops` | — | 分页列表 | 支持 keyword/type |
| GET | `/api/ops/{opId}` | — | OP | 详情 |
| POST | `/api/ops` | OP | OP | 创建, 默认 version=1 |
| PUT | `/api/ops/{opId}` | `{op, bumpVersion:bool}` | OP | 更新, bumpVersion=true 时 version+1 |
| DELETE | `/api/ops/{opId}` | — | `{ok:true}` | 删除, 被 Workflow 引用时 409 |
| POST | `/api/ops/{opId}/execute` | `{clientId, inputs, workspace}` | `{runId}` | 单次执行 (virtual Job) |
| POST | `/api/ops/{opId}/export` | — | `{yaml: "..."}` | 返回 YAML 内容, 前端写文件 |
| POST | `/api/ops/import` | `{yaml: "..."}` | OP | 从 YAML 创建 |

**OP 对象**：
```json
{
  "opId": "...",
  "name": "check_tests",
  "type": "prompt",
  "description": "运行测试并报告结果",
  "content": "在当前工作区运行测试...",
  "timeoutMs": 300000,
  "interactive": false,
  "version": 2,
  "inputs": [{"name":"cmd","type":"string","required":true,"default":null,"description":"测试命令"}],
  "outputs": [{"name":"passed","type":"string","description":"是否通过"}],
  "createdAtMs": "...",
  "updatedAtMs": "..."
}
```

**业务规则**：
- `name` 全局唯一。
- 保存时 `bumpVersion=false`（默认覆盖当前版本）；`bumpVersion=true` 时 version+1。
- 版本升级后，引用该 OP 的 Workflow 节点自动标记 needsUpdate（动态计算，不持久化）。

**OP 对象字段说明**：

| 字段 | 类型 | 说明 |
|-|-|-|
| opId | string(32 位 UUID) | 系统生成，界面不感知 |
| name | string | 全局唯一，界面展示 |
| type | enum | `prompt` / `bash` / `python` / `powershell` |
| description | string \| null | 描述 |
| content | string | OP 正文（脚本 / prompt 内容） |
| timeoutMs | integer | 超时毫秒，只属于 OP，默认 60000 |
| interactive | boolean | 占位，恒为 false，界面不暴露 |
| version | integer | 版本号，默认 1 |
| inputs | OpInput[] | 入参定义：`[{name, type:"string", required, default, description}]` |
| outputs | OpOutput[] | 出参定义：`[{name, type:"string", description}]` |
| createdAtMs | string | 创建时间（毫秒时间戳字符串） |
| updatedAtMs | string | 更新时间 |

---

### 3.2.0 通用约定

> 以下为 OP 管理全部 API 的完整 HTTP 定义。通用约定：
> - 基础路径 `/api`；路径参数中的 `opId` 为 32 位无连字符 UUID。
> - 时间字段 JSON 中统一为 string（毫秒时间戳）。
> - 列表分页 `page` / `page_size`（`page_size` ∈ 10 / 50 / 100 / 1000，默认 10）。
> - 错误响应统一格式 `{"error":{"code":"...","message":"..."}}`。

**字段命名 ↔ 数据库列映射**（API 字段 camelCase ↔ `schema.sql` 列 snake_case）：

| API 字段 | 数据库列 | 说明 |
|-|-|-|
| `Op.opId` | `ops.op_id` | 主键，32 位 UUID |
| `Op.createdAtMs` | `ops.created_at_ms` | 毫秒时间戳 |
| `Op.updatedAtMs` | `ops.updated_at_ms` | 毫秒时间戳 |

---

### 3.2.1 GET /api/ops —— OP 列表

**功能说明**：支撑 OP 列表页的展示与过滤。支持 `keyword` 模糊匹配（name / type / description）、`type` 类型过滤、分页与排序；列表项用于选择要执行或编辑的 OP。

**路径参数**：无

**查询参数**：

| 参数 | 位置 | 类型 | 必填 | 默认 | 说明 |
|-|-|-|-|-|-|
| page | query | integer | 否 | 1 | 页码 |
| page_size | query | integer | 否 | 10 | 每页条数，∈ {10,50,100,1000} |
| keyword | query | string | 否 | — | 模糊匹配 name / type / description |
| type | query | string | 否 | — | 按类型过滤：prompt/bash/python/powershell |
| sort | query | string | 否 | `-createdAtMs` | 排序字段：name/type/createdAtMs/updatedAtMs，`-` 前缀降序 |

**请求体**：无

**成功响应 `200 OK`**：

```json
{ "items": [ OP, ... ], "total": 23, "page": 1, "page_size": 10 }
```

**错误响应**：400 `VALIDATION_ERROR`（page_size/type/sort 取值非法）。

---

### 3.2.2 GET /api/ops/{opId} —— OP 详情

**功能说明**：查询单个 OP 的完整定义（含 content / inputs / outputs / version）。用于编辑界面加载现有 OP 回填表单，以及执行前查看配置。

**路径参数**：`opId`（string，32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：单个 OP 对象（结构见 3.2 节）。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | opId 格式非法 |
| 404 | `OP_NOT_FOUND` | opId 不存在 |

---

### 3.2.3 POST /api/ops —— 创建 OP

**功能说明**：新建 OP，`name` 全局唯一，`version` 初始为 1，时间戳由后端生成。创建成功后即可被 Workflow 节点引用或单次执行。

**路径参数**：无　**查询参数**：无

**请求体** `OpCreateRequest`（不含 `opId` / `version` / `createdAtMs` / `updatedAtMs`，后端生成 version=1）：

```json
{
  "name": "check_tests",
  "type": "prompt",
  "description": "运行测试并报告结果",
  "content": "在当前工作区运行测试...",
  "timeoutMs": 300000,
  "inputs": [{"name":"cmd","type":"string","required":true,"default":null,"description":"测试命令"}],
  "outputs": [{"name":"passed","type":"string","description":"是否通过"}]
}
```

| 字段 | 类型 | 必填 | 说明 |
|-|-|-|-|
| name | string | 是 | 全局唯一 |
| type | enum | 是 | prompt/bash/python/powershell |
| content | string | 是 | OP 正文 |
| description | string \| null | 否 | 描述 |
| timeoutMs | integer | 否 | 默认 60000 |
| inputs | OpInput[] | 否 | 默认 `[]` |
| outputs | OpOutput[] | 否 | 默认 `[]` |

**成功响应 `200 OK`**：返回已创建的 OP（含后端生成的 id、version=1、时间戳）。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | name/content 为空、type 非法、inputs/outputs 结构非法 |
| 409 | `OP_NAME_EXISTS` | name 已存在 |

---

### 3.2.4 PUT /api/ops/{opId} —— 更新 OP

**功能说明**：更新 OP 内容。`bumpVersion=false` 覆盖当前版本、`bumpVersion=true` 升版本；升版本后引用该 OP 的 Workflow 节点自动标记 needsUpdate（动态计算，不持久化）。

**路径参数**：`opId`（32 位 UUID，必填）

**查询参数**：无

**请求体** `{ op, bumpVersion }`：

```json
{
  "bumpVersion": false,
  "op": {
    "name": "check_tests",
    "type": "prompt",
    "description": "运行测试并报告结果",
    "content": "修改后的正文...",
    "timeoutMs": 300000,
    "inputs": [{"name":"cmd","type":"string","required":true,"default":null,"description":"测试命令"}],
    "outputs": [{"name":"passed","type":"string","description":"是否通过"}]
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|-|-|-|-|
| bumpVersion | boolean | 是 | `false`=覆盖当前版本；`true`=version+1 |
| op | OpCreateRequest | 是 | 更新的内容（不含 id/version/时间戳） |

**成功响应 `200 OK`**：返回更新后的 OP 对象。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | 请求体字段非法 |
| 404 | `OP_NOT_FOUND` | opId 不存在 |
| 409 | `OP_NAME_EXISTS` | 修改后的 name 与其他 OP 冲突 |

---

### 3.2.5 DELETE /api/ops/{opId} —— 删除 OP

**功能说明**：删除 OP。若该 OP 正被 Workflow 节点引用则返回 409 拒绝删除，避免产生悬挂引用。

**路径参数**：`opId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：`{ "ok": true }`

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | opId 格式非法 |
| 404 | `OP_NOT_FOUND` | opId 不存在 |
| 409 | `OP_REFERENCED` | 该 OP 正被 Workflow 节点引用，删除被拒绝 |

---

### 3.2.6 POST /api/ops/{opId}/execute —— 单次执行 OP

**功能说明**：对单个 OP 发起一次独立执行（virtual Job）——**异步触发即返回**：创建 JobRun 返回 `{runId}` 后接口即结束，Run 在后台跑完，完成后用 runId 自动更新运行历史。用于 OP 的独立调试与试运行。

**路径参数**：`opId`（32 位 UUID，必填）

**查询参数**：无

**请求体**：

```json
{
  "clientId": "a1b2c3d4e5f67890abcdef1234567890",
  "inputs": {"cmd": "npm run test"},
  "workspace": "/path/to/workspace"
}
```

| 字段 | 类型 | 必填 | 说明 |
|-|-|-|-|
| clientId | string(32 位 UUID) | 是 | 执行所用 Client（按 OP 类型过滤） |
| inputs | object | 否 | 入参名值对，name 须匹配 OP.inputs |
| workspace | string | 是 | 工作区路径 |

**成功响应 `200 OK`**：

```json
{ "runId": "a1b2c3d4e5f67890abcdef1234567890" }
```

> 执行流程见 4.1（按 clientId 查询 Client 实例 → 解析入参 → 组装 OpRunRequest → TaskRunner.add_op 投递即结束）。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | clientId/workspace 缺失、inputs 含未定义参数、id 非法 |
| 404 | `OP_NOT_FOUND` / `CLIENT_NOT_FOUND` | OP 或 Client 不存在 |

---

### 3.2.7 POST /api/ops/{opId}/export —— 导出 OP 为 YAML

**功能说明**：导出 OP 为 YAML 文本并返回，前端将内容写入所选目录，用于 OP 的备份与迁移。

**路径参数**：`opId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
{ "yaml": "name: check_tests\nversion: 2\n..." }
```

| 响应字段 | 类型 | 说明 |
|-|-|-|
| yaml | string | YAML 文本内容（前端写入所选目录） |

**错误响应**：404 `OP_NOT_FOUND`。

---

### 3.2.8 POST /api/ops/import —— 从 YAML 导入 OP

**功能说明**：从 YAML 文本解析并创建 OP，用于 OP 从外部迁移导入；若同名 OP 已存在返回 409（导入冲突）。

**路径参数**：无　**查询参数**：无

**请求体**：

```json
{ "yaml": "name: check_tests\ntype: prompt\n..." }
```

| 字段 | 类型 | 必填 | 说明 |
|-|-|-|-|
| yaml | string | 是 | YAML 文本内容 |

**成功响应 `200 OK`**：返回导入创建的 OP 对象。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | YAML 解析失败或字段非法 |
| 409 | `OP_NAME_EXISTS` | 同名 OP 已存在（导入冲突） |

---

### 4.1 单次 OP 执行

**执行流程**（`POST /api/ops/{opId}/execute`，请求体 `{clientId, inputs, workspace}`）：

```text
POST /api/ops/{opId}/execute {clientId, inputs, workspace}
  │
  ├─ 1. 按 clientId 查询 Client 实例
  │     - 不存在 → 404 CLIENT_NOT_FOUND
  │     - Client.type 与 OP.type 不匹配 → 400 VALIDATION_ERROR
  ├─ 2. 解析 OP 入参: 校验 required, 缺省项应用 default → 最终入参集
  ├─ 3. 组装 OpRunRequest (结构见 crud-05 4.6 Task Runner):
  │     run_id    = 后端生成的 runId (单次 OP 场景, virtual JobRun)
  │     client    = 步骤1查询到的 Client 实例
  │     op        = 当前 OP 定义
  │     inputs    = 步骤2解析后的入参集
  │     workspace = 请求传入的 workspace
  └─ 4. TaskRunner.add_op(req) → 返回 {runId}, 接口即结束
```

**要点**：
- **投递即结束**：本接口在调 `TaskRunner.add_op` 后即返回 `{runId}` 结束，**不等待执行、不返回执行结果**。后续的排队调度、调 `Executor::execute`、写 step_record、更新 job_run 终态、刷新界面状态，**全部由 Task Runner 自动完成**，OP 层不再参与。
- **默认状态等待中**：`add_op` 创建 JobRun 后即置为 `waiting(等待中)`；后台线程调度取出后转 `running(运行中)`，执行完到终态 `success/failed/timeout`。
- **界面状态刷新**：Task Runner 在状态变化时更新 JobRun 记录，前端通过运行历史（crud-05）轮询/刷新即可看到 waiting→running→终态 的实时状态，无需 OP 接口参与。
- **Executor 接收 Client 实例**：步骤 1 先把 `clientId` 解析为完整 Client 实例，随 `OpRunRequest` 传入 Task Runner（最终喂给 Executor）；Executor 据此选 run.xxx、组装命令、解析出参（若只传 id 无从得知 command/binaryPath/inputMode 等配置）。
- **client test 例外（同步、不入历史）**：`POST /api/clients/{clientId}/test` 不走 Task Runner，直接同步调 `Executor::execute` 实时返回，不建 JobRun/step_record、不进运行历史（见 crud-01 3.1.6）。
