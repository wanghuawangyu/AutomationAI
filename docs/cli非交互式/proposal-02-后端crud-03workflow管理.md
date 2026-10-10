# 后端 CRUD —— Workflow 管理

> 来源：`proposal-02-后端设计.md` 第 1.3 节、第 3.3 节、第 4.2–4.4 节（独立拆分，内容原样迁移）
> 配套文档: `proposal-01-界面设计.md`、`proposal-02-后端设计.md`
> 配套建表脚本: `schema.sql`

---

### 3.3 Workflow 管理

| 方法 | 路径 | 请求 Body | 响应 | 说明 |
|-|-|-|-|-|
| GET | `/api/workflows` | — | 分页列表 | 含 nodeCount |
| GET | `/api/workflows/{workflowId}` | — | Workflow | 完整定义 (nodes+edges) |
| POST | `/api/workflows` | Workflow | Workflow | 创建 |
| PUT | `/api/workflows/{workflowId}` | `{workflow, bumpVersion}` | Workflow | 更新 |
| DELETE | `/api/workflows/{workflowId}` | — | `{ok:true}` | 删除 |
| POST | `/api/workflows/{workflowId}/validate` | — | `{valid:bool, errors:[]}` | DAG 校验: 连通性、无环、Start/End 存在 |
| POST | `/api/workflows/{workflowId}/execute` | `{inputs, workspace}` | `{runId}` | 单次执行 (virtual Job) |
| POST | `/api/workflows/{workflowId}/export` | — | `{zip: base64}` | 返回 ZIP 内容 |
| POST | `/api/workflows/import` | `{zip: base64}` | Workflow | 导入 |
| GET | `/api/workflows/{workflowId}/needs-update` | — | `{needsUpdate:bool, outdatedNodes:[...]}` | 动态计算 |
| GET | `/api/workflows/{workflowId}/outdated-nodes` | — | `[nodeId,...]` | 节点 opVersion != OP 当前 version |

**Workflow 对象**：
```json
{
  "workflowId": "...",
  "name": "deploy_workflow",
  "description": "部署流水线",
  "version": 2,
  "inputs": [{"name":"env","type":"string","required":true,"default":"prod","description":"环境"}],
  "outputs": [{"name":"status","from":{"nodeId":"node_deploy","outputName":"result"},"description":"部署结果"}],
  "nodes": [
    {"nodeId":"node_start","kind":"start","position":{"x":40,"y":200}},
    {"nodeId":"node_check","kind":"op","opId":"...","opVersion":2,"clientId":"...","bindings":{},"retry":{"on":"failure","max":2,"backoff":"constant","interval":30000},"position":{"x":320,"y":180}},
    {"nodeId":"node_end","kind":"end","position":{"x":620,"y":200}}
  ],
  "edges": [
    {"from":"node_start","to":"node_check","condition":"on_success"},
    {"from":"node_check","to":"node_end","condition":"on_success"}
  ],
  "createdAtMs": "...",
  "updatedAtMs": "..."
}
```

**Workflow 对象字段说明**：

| 字段 | 类型 | 说明 |
|-|-|-|
| workflowId | string(32 位 UUID) | 系统生成 |
| name | string | 全局唯一 |
| description | string \| null | 描述 |
| version | integer | 版本号，默认 1 |
| inputs | WorkflowInput[] | 入参：`[{name, type:"string", required, default, description}]` |
| outputs | WorkflowOutput[] | 出参：`[{name, from:{nodeId, outputName}, description}]` |
| nodes | WorkflowNode[] | 节点：`{nodeId, kind(start/op/end), position, opId, opVersion, clientId, bindings, retry}` |
| edges | WorkflowEdge[] | 边：`{from, to, condition(on_success/on_failure/always)}`；存储于 `workflows.edges` JSON 字段，随 Workflow 整体读写 |
| createdAtMs | string | 创建时间 |
| updatedAtMs | string | 更新时间 |

**WorkflowNode（节点）对象字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|-|-|-|-|
| nodeId | string(32 位 UUID) | 是 | Workflow 内唯一。**nodeId 与 opId 是"OP 定义 ↔ OP 实例"的关系：opId 标识 OP 模板，nodeId 标识该 OP 在画布上的一次使用实例；同一 OP 可被多个节点引用（多对一），故不能用 opId 代替 nodeId** |
| kind | enum | 是 | `start` / `op` / `end` |
| position | object \| null | 否 | 画布坐标 `{x, y}`，由前端画布布局后随创建/更新请求传入并持久化；导入或脚本创建无坐标时可空（后端生成默认排布） |
| opId | string(32 位 UUID) | op 时必填 | 绑定的 OP |
| opVersion | integer | op 时必填 | 绑定的 OP 版本 |
| clientId | string(32 位 UUID) | 否 | 执行所用 Client，可为空（执行时再选） |
| bindings | object | op 时可空 | 入参绑定，见下 |
| retry | object \| null | 否 | 重试策略，见下 |

**bindings（入参绑定）对象字段说明**：`{ "<paramName>": { "kind": "node_output" | "workflow_input" | "literal", ... } }`

| kind | 附加字段 | 说明 |
|-|-|-|
| `node_output` | `nodeId`, `outputName` | 取上游节点出参 |
| `workflow_input` | `inputName` | 取 Workflow 入参 |
| `literal` | `value` | 固定值 |

**retry（重试策略）对象字段说明**：`{ "on", "max", "backoff", "interval" }`

| 字段 | 类型 | 必填 | 说明 |
|-|-|-|-|
| on | enum | 是 | `failure` / `timeout` / `all` |
| max | integer | 是 | 最大重试次数 |
| backoff | enum | 是 | `constant` / `exponential` |
| interval | integer | 是 | 重试间隔（毫秒） |

**WorkflowEdge（边）对象字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|-|-|-|-|
| from | string | 是 | 起始节点 nodeId |
| to | string | 是 | 目标节点 nodeId |
| condition | enum | 是 | `on_success` / `on_failure` / `always` |

> 说明：`edges` **不作为单独表存储**，而是随 Workflow 整体存于 `workflows.edges` JSON 字段（无独立主键/`edge_id`）。边由 `from` / `to` / `condition` 唯一定位，API 层不暴露边 ID；Workflow 的 `edges` 数组本身即完整边列表，无需单独引用某条边。

**校验规则**：
- 必须有且仅有一个 start 节点、一个 end 节点。
- 从 start 出发可达 end。
- 不允许环路（循环靠 retry + 回跳边实现，但拓扑校验时允许有环？—— 见第十五章：循环场景，回跳边是允许的环，但 Engine 用计数终止）。
- 每个 op 节点必须绑定 opId + opVersion。
- bindings 引用的前置节点出参必须存在。

---

### 3.3.0 通用约定

> 以下为 Workflow 管理全部 API 的完整 HTTP 定义。通用约定：
> - 基础路径 `/api`；路径参数中的 `workflowId` 为 32 位无连字符 UUID。
> - 时间字段 JSON 中统一为 string（毫秒时间戳）。
> - 列表分页 `page` / `page_size`（`page_size` ∈ 10 / 50 / 100 / 1000，默认 10）。
> - 错误响应统一格式 `{"error":{"code":"...","message":"..."}}`。

**字段命名 ↔ 数据库列映射**（API 字段 camelCase ↔ `schema.sql` 列 snake_case）：

| API 字段 | 数据库列 | 说明 |
|-|-|-|
| `Workflow.workflowId` | `workflows.workflow_id` | 主键，32 位 UUID |
| `WorkflowNode.nodeId` | `workflow_nodes.node_id` | 主键，全局唯一 UUID |
| `WorkflowNode.position.{x,y}` | `workflow_nodes.position_x / position_y` | 画布坐标 |
| `Workflow.createdAtMs` | `workflows.created_at_ms` | 毫秒时间戳 |

---

### 3.3.1 GET /api/workflows —— Workflow 列表

**功能说明**：支撑 Workflow 列表页的展示与过滤，列表项含 `nodeCount`（OP 节点数，不含 Start/End）。支持 `keyword` 模糊匹配（name / description）、`needsUpdate` 状态过滤与分页排序。

**路径参数**：无

**查询参数**：

| 参数 | 位置 | 类型 | 必填 | 默认 | 说明 |
|-|-|-|-|-|-|
| page | query | integer | 否 | 1 | 页码 |
| page_size | query | integer | 否 | 10 | 每页条数，∈ {10,50,100,1000} |
| keyword | query | string | 否 | — | 模糊匹配 name / description |
| needsUpdate | query | boolean | 否 | — | 按状态过滤：true=需要更新 / false=已同步 |
| sort | query | string | 否 | `-createdAtMs` | 排序字段：name/version/createdAtMs/updatedAtMs，`-` 前缀降序 |

**请求体**：无

**成功响应 `200 OK`**：

```json
{
  "items": [
    { "workflowId": "...", "name": "deploy_workflow", "version": 2, "nodeCount": 5, "...": "..." }
  ],
  "total": 3,
  "page": 1,
  "page_size": 10
}
```

> 列表项额外含 `nodeCount`（OP 节点数，不含 Start/End），其余字段同 Workflow 对象。

**错误响应**：400 `VALIDATION_ERROR`（page_size/needsUpdate/sort 取值非法）。

---

### 3.3.2 GET /api/workflows/{workflowId} —— Workflow 详情

**功能说明**：查询完整 Workflow 定义（含 nodes、edges）。用于 Workflow 编辑器（画布）加载现有定义进行查看与修改。

**路径参数**：`workflowId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：完整 Workflow 对象（含 nodes、edges）。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | workflowId 格式非法 |
| 404 | `WORKFLOW_NOT_FOUND` | workflowId 不存在 |

---

### 3.3.3 POST /api/workflows —— 创建 Workflow

**功能说明**：新建 Workflow，`name` 全局唯一，`version` 初始为 1；未提供 nodes/edges 时默认创建仅含 Start + End 的骨架，供画布后续编排。

**路径参数**：无　**查询参数**：无

**请求体** `WorkflowCreateRequest`（不含 workflowId/version/时间戳；nodes/edges 可选，默认仅 Start + End；**nodes 中每个节点均含 `position:{x,y}`，坐标由前端画布布局后传入并持久化**）：

```json
{
  "name": "deploy_workflow",
  "description": "部署流水线",
  "inputs": [{"name":"env","type":"string","required":true,"default":"prod","description":"环境"}],
  "outputs": [{"name":"status","from":{"nodeId":"node_deploy","outputName":"result"},"description":"部署结果"}],
  "nodes": [
    {"nodeId":"node_start","kind":"start","position":{"x":40,"y":200}},
    {"nodeId":"node_check","kind":"op","opId":"...","opVersion":2,"clientId":"...","bindings":{},"retry":null,"position":{"x":320,"y":180}},
    {"nodeId":"node_end","kind":"end","position":{"x":620,"y":200}}
  ],
  "edges": [
    {"from":"node_start","to":"node_check","condition":"on_success"},
    {"from":"node_check","to":"node_end","condition":"on_success"}
  ]
}
```

**成功响应 `200 OK`**：返回已创建的 Workflow（含后端生成的 workflowId、version=1、时间戳）。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | name 为空、拓扑非法、节点字段约束不满足 |
| 409 | `WORKFLOW_NAME_EXISTS` | name 已存在 |

---

### 3.3.4 PUT /api/workflows/{workflowId} —— 更新 Workflow

**功能说明**：更新 Workflow 的完整定义（nodes、edges、inputs、outputs 等）。`bumpVersion=false` 覆盖当前版本、`bumpVersion=true` 升版本。

**路径参数**：`workflowId`（32 位 UUID，必填）

**查询参数**：无

**请求体** `{ workflow, bumpVersion }`：`workflow` 为完整 WorkflowCreateRequest；`bumpVersion` 为 boolean（`false`=覆盖 / `true`=version+1）。

**成功响应 `200 OK`**：返回更新后的 Workflow 对象。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | 请求体字段非法、拓扑非法 |
| 404 | `WORKFLOW_NOT_FOUND` | workflowId 不存在 |
| 409 | `WORKFLOW_NAME_EXISTS` | name 与其他 Workflow 冲突 |

---

### 3.3.5 DELETE /api/workflows/{workflowId} —— 删除 Workflow

**功能说明**：删除 Workflow。若该 Workflow 正被 Job 引用则返回 409 拒绝删除，避免产生悬挂引用。

**路径参数**：`workflowId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：`{ "ok": true }`

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | workflowId 格式非法 |
| 404 | `WORKFLOW_NOT_FOUND` | workflowId 不存在 |
| 409 | `WORKFLOW_REFERENCED` | 该 Workflow 正被 Job 引用，删除被拒绝 |

---

### 3.3.6 POST /api/workflows/{workflowId}/validate —— 校验 Workflow

**功能说明**：对当前持久化的 Workflow 定义做 DAG 校验（Start/End 存在、连通性、无环、节点字段合法）。前端在保存或执行前调用，以提示拓扑错误。

**路径参数**：`workflowId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无（校验以当前持久化的定义为准）

**成功响应 `200 OK`**：

```json
{
  "valid": true,
  "errors": []
}
```

| 响应字段 | 类型 | 说明 |
|-|-|-|
| valid | boolean | 是否通过校验 |
| errors | string[] | 校验失败信息列表（如"Workflow 缺少 Start 节点"） |

**错误响应**：404 `WORKFLOW_NOT_FOUND`。

---

### 3.3.7 POST /api/workflows/{workflowId}/execute —— 单次执行 Workflow

**功能说明**：对单个 Workflow 发起一次独立执行（virtual Job）——**异步投递即返回**：组装 `WorkflowRunRequest` 投递到 `TaskRunner.add_workflow`，创建 workflow 类型运行记录并返回 `{runId}` 后接口即结束，运行记录进入 Task Runner 排队，workflow 实际执行由 Engine / Worker 并行后台完成。`needsUpdate=true` 时禁止执行。

**路径参数**：`workflowId`（32 位 UUID，必填）

**查询参数**：无

**请求体**：

```json
{ "inputs": {"env": "staging"}, "workspace": "/path/to/workspace" }
```

| 字段 | 类型 | 必填 | 说明 |
|-|-|-|-|
| inputs | object | 否 | Workflow 入参名值对，name 须匹配 Workflow.inputs |
| workspace | string | 是 | 工作区路径 |

**成功响应 `200 OK`**：

```json
{ "runId": "a1b2c3d4e5f67890abcdef1234567890" }
```

> 执行流程见 4.2（投递 TaskRunner.add_workflow，异步）；Workflow.needsUpdate=true 时禁止执行。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | workspace 缺失、inputs 含未定义参数 |
| 404 | `WORKFLOW_NOT_FOUND` | workflowId 不存在 |
| 409 | `WORKFLOW_NEEDS_UPDATE` | needsUpdate=true，需更新后才能执行 |

---

### 3.3.8 POST /api/workflows/{workflowId}/export —— 导出 Workflow 为 ZIP

**功能说明**：导出 Workflow 为 ZIP（`manifest.json` + `workflow.yaml` + `ops/*.yaml`），返回 base64 内容供前端写入所选目录，用于 Workflow 的备份与迁移。

**路径参数**：`workflowId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
{ "zip": "UEsDBBQACAgI..." }
```

| 响应字段 | 类型 | 说明 |
|-|-|-|
| zip | string(base64) | ZIP 文件 base64 内容（前端写入所选目录） |

> ZIP 结构：`manifest.json` + `workflow.yaml` + `ops/*.yaml`。

**错误响应**：404 `WORKFLOW_NOT_FOUND`。

---

### 3.3.9 POST /api/workflows/import —— 从 ZIP 导入 Workflow

**功能说明**：从 ZIP 导入 Workflow，重建其定义及关联的 OP；若同名 Workflow 已存在返回 409（导入冲突）。

**路径参数**：无　**查询参数**：无

**请求体**：

```json
{ "zip": "UEsDBBQACAgI..." }
```

**成功响应 `200 OK`**：返回导入创建的 Workflow 对象。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | ZIP 解析失败或拓扑非法 |
| 409 | `WORKFLOW_NAME_EXISTS` | 同名 Workflow 已存在（导入冲突） |

---

### 3.3.10 GET /api/workflows/{workflowId}/needs-update —— 检查是否需要更新

**功能说明**：动态计算 Workflow 是否需要更新。判定依据：遍历 Workflow 内全部 `kind=op` 的业务节点，逐一比对节点保存的 `opVersion` 快照与节点所绑定 OP 的当前 `version`，只要存在任一节点落后（或处于版本异常 / 悬挂引用状态），即 `needsUpdate=true`，并在 `outdatedNodes` 中列出这些节点。供列表/详情显示「需要更新」标记（列表接口 3.3.1 的 `needsUpdate` 过滤、执行前的 409 拦截均基于同一判定）。

**判定逻辑**（与 3.3.11 共用同一内核，动态计算、不落库存储）：

1. **遍历范围**：仅遍历 `kind=op` 的节点；`start` / `end` 系统节点无 opVersion，不参与判定。
2. **比对对象**：节点字段 `opVersion`（创建 / 上次保存时锁定的 OP 版本快照） vs `ops` 表中 `opId` 对应 OP 的当前 `version`。
3. **逐节点判定**：

| 节点状态 | 条件 | 是否需更新 |
|-|-|-|
| 已同步 | `node.opVersion == op.version` | 否 |
| 落后 | `node.opVersion < op.version`（OP 已发布新版本） | 是 |
| 超前 | `node.opVersion > op.version`（OP 版本被回滚） | 是（版本异常，需重新绑定） |
| 悬挂引用 | `opId` 在 `ops` 中不存在（OP 被删除） | 是（失效节点，需修复绑定） |

4. **聚合规则**：`needsUpdate` = 存在任一需更新节点；`outdatedNodes` = 全部需更新节点的 nodeId，按画布拓扑顺序（start → end 方向，同级按 nodeId 稳定排序）返回，保证前端高亮顺序稳定。
5. **边界情况**：仅含 start / end 的骨架 Workflow 无 op 节点 → `needsUpdate=false`、`outdatedNodes=[]`。
6. **伪代码**：

```
function evaluateWorkflowOutdated(workflow):
    outdated = []
    for node in workflow.nodes where node.kind == 'op':
        op = ops.find(node.opId)
        if op is null:
            outdated.push(node.nodeId)          # 悬挂引用（OP 已删除）
        elif node.opVersion != op.version:
            outdated.push(node.nodeId)          # 落后 或 超前
    return outdated

needsUpdate   = evaluateWorkflowOutdated(workflow).length > 0
outdatedNodes = evaluateWorkflowOutdated(workflow)   # 3.3.11 直接返回此结果
```

**注意**：`opVersion` 是节点侧的版本快照，OP 发布新版本后节点**不会自动跟随**；仅当用户重新保存节点（重新绑定该 OP 并锁定新版本）后，该节点才恢复为「已同步」。

**路径参数**：`workflowId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
{ "needsUpdate": true, "outdatedNodes": ["node_check", "node_review"] }
```

| 响应字段 | 类型 | 说明 |
|-|-|-|
| needsUpdate | boolean | 是否存在需更新节点（落后 / 版本超前 / OP 悬挂引用），判定规则见上文 |
| outdatedNodes | string[] | 落后节点的 nodeId 列表 |

**错误响应**：404 `WORKFLOW_NOT_FOUND`。

---

### 3.3.11 GET /api/workflows/{workflowId}/outdated-nodes —— 获取落后节点

**功能说明**：返回所有需更新节点的 nodeId 列表——节点 `opVersion` 落后于 / 超前于 OP 当前 `version`，或 OP 已删除形成悬挂引用，均计入。供前端在画布上高亮提示需要更新的节点。

**与 3.3.10 的关系**：本接口与 3.3.10 共用同一判定内核（见 3.3.10「判定逻辑」1–6 步），本接口返回 `evaluateWorkflowOutdated` 的直接结果；前端仅需节点列表时调用本接口，需同时判断布尔标记时调用 3.3.10（二者计算结果一致）。

**路径参数**：`workflowId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
["node_check", "node_review"]
```

**错误响应**：404 `WORKFLOW_NOT_FOUND`。

---

### 4.2 Workflow 执行（异步，投递 Task Runner）

**执行流转总览**（一次执行从触发到完成的完整链路）：

```text
接口触发 (POST /api/workflows/{workflowId}/execute)
  └─ 组装 WorkflowRunRequest → TaskRunner.add_workflow
        └─ 创建 workflow 类型运行记录(queued)，返回 {runId}，接口即结束
              └─ Task Runner 调度线程: 按入库顺序取 queued → running
                    ├─ OP 任务: 直接调用 Worker 执行（见 Worker 完成通知）
                    └─ Workflow 任务: 通知 Engine 启动该 workflow
                          └─ Engine 直接调度（顺序调度 workflow 内各 OP）
                                └─ Engine 派发 op 给 Worker 执行 → Worker 完成同步调注入的 OnComplete 实现（StepComplete 回报 Engine）
```

**执行流程**（`POST /api/workflows/{workflowId}/execute`，请求体 `{inputs, workspace}`）：

```text
POST /api/workflows/{workflowId}/execute {inputs, workspace}
  │
  ├─ 1. 校验 workflow: needsUpdate=true → 409 WORKFLOW_NEEDS_UPDATE
  ├─ 2. 解析 workflow 入参: 校验 required, 缺省项应用 default → 最终入参集
  ├─ 3. 组装 WorkflowRunRequest (结构见 crud-04 4.6):
  │     run_id       = 后端生成的 runId (workflow 单次执行, virtual JobRun)
  │     workflow_id  = 当前 workflow id
  │     inputs       = 步骤2解析后的入参集
  │     workspace    = 请求传入的 workspace
  └─ 4. TaskRunner.add_workflow(req) → 创建 workflow 类型运行记录(queued), 返回 {runId}, 接口即结束
```

**要点**：
- **投递即结束**：本接口在调 `TaskRunner.add_workflow` 后即返回 `{runId}` 结束，**不等待执行、不返回执行结果**。add_workflow 仅在运行历史（crud-05）创建一条 **workflow 类型的运行记录**；workflow 的 DAG 调度与实际执行由 Engine / Worker 并行后台完成，Workflow 层不再参与。
- **默认状态等待中**：`add_workflow` 创建的运行记录即置为 `queued(等待中)`；Task Runner 调度取出后转 `running(运行中)`，执行完到终态 `success/failed/timeout`。
- **Engine 调度与 Task Runner 是两个并行的后台任务**：Task Runner 只管任务排队与状态机（queued→running→终态）；workflow 被调度（转到 running）后，交由 **Engine / Worker 后台执行**——Engine 负责 workflow 内部 OP 的 DAG 调度，Worker 负责单个 OP 的实际执行（调 Executor）。二者并行、非嵌套：Engine 调度不在 Task Runner 内部，而是独立的后台任务。

**Engine 直接调度（workflow 运行时的调度驱动）**：
- workflow 开始运行时，**Engine 直接承担调度**，**顺序调度** workflow 内的各 OP：按 DAG 就绪规则逐个派发节点给 Worker，等待执行回报，走 condition 边、累积出参，直至 End。
- Engine 的调度**与 Workflow 的运行 API（execute）没有关系**：execute 只负责把运行记录投递到 Task Runner；Engine 在 workflow 实际开始执行（收到 EngineStart）时自行驱动，不在 API 层。

**Engine / Worker 后台执行逻辑**（workflow 被调度为 running 后的并行后台任务）：

```text
Engine 初始化:
  ├─ 加载 workflow definition (nodes, edges)
  ├─ 节点状态表: 全部 pending; 出参累积表: {}
Engine 调度循环（顺序调度）:
  ├─ a. 找所有"就绪"节点: 入边全部已处理、每条入边的 condition 与上游结果匹配
  ├─ b. 对每个就绪节点: 创建 StepRecord, 派发 dispatch(node) 到 Worker
  ├─ c. 等待 Worker 回报 report(step_result)
  ├─ d. 应用 retry 策略（如配置）; 根据 result 走对应 condition 的边; 累积出参
  ├─ e. 到达 End → 完成
异常路径:
  ├─ timeout: status=timeout; user terminate: kill 进程, status=cancelled; 节点失败且无失败边可达 End: failed
更新 job_run 终态 + duration, 刷新界面状态
```

**Engine 内部调度状态控制（参考 Mistral）**：

Engine 不靠轮询、也不仅靠内存推进 workflow，而是参考 Mistral 采用**事件驱动 + 调度命令队列**：每次"节点完成 → 决定下一步"都产生一条**调度命令**，持久化到新表 `engine_commands`，Engine 事件循环消费这些命令来推进 workflow。调度过程全量落库，可审计；Engine 崩溃后可恢复重放（回放 `processed=0` 的未消费命令）。

**调度命令（`engine_commands.command`）**：

| command | 含义 | 产生者 |
|-|-|-|
| `engine_start` | Runner 通知 Engine 开始执行某 workflow（= notify(EngineStart) 持久化，payload 含 inputs/workspace） | Runner（调度线程） |
| `step_completed` | Worker 回报某节点执行完成（含结果） | Worker（执行完成后） |
| `apply_retry` | 节点失败且配置了 retry，准备重试 | Engine |
| `walk_edge` | 按结果走 condition 边，推进 DAG | Engine |
| `dispatch_step` | 决定调度某节点，派发给 Worker | Engine |
| `workflow_done` | 到达 End，workflow 完成 | Engine |
| `terminate` | 异常终止（timeout / user terminate = notify(Terminate) 持久化，payload 含 reason） | Engine / 外部 |

**Engine 事件循环（消费 `engine_commands`，按 run_id 分组、按 created_at 顺序）**：

```text
└─ 取出 processed=0 的 command
      ├─ engine_start{run, workflow_id}                 ← Runner 的 notify(EngineStart) 已持久化为此命令
      │     → 加载 workflow definition (nodes, edges)
      │     → 启动该 run 的调度循环（内部执行体，无内存业务状态，见「持久化」）
      │     → 立即返回，继续消费下一条命令（不阻塞）
      ├─ step_completed{run, step, result}
      │     → 更新 step_records 终态
      │     → 若配置 retry 且未超次数: 写 apply_retry + dispatch_step（节点重入 running）
      │     → 否则: 写 walk_edge
      ├─ walk_edge{run, step, result}
      │     → 按 edge.condition 选后继边
      │     → 对每个后继节点: 检查其所有入边(前置 step)是否已完成且 condition 满足
      │           → 全部就绪: 写 dispatch_step{node} → 交给 Worker 执行
      │           → 未就绪: 挂起, 等其他前置 step_completed 到达后再判（依赖就绪）
      │     → 到达 End 或无可就绪节点: 写 workflow_done
      ├─ dispatch_step
      │     → 交给 Worker 执行 → 完成后写 step_completed（见 Worker 完成通知）
      ├─ workflow_done
      │     → 调用 self.job_complete（Engine 实例属性，Runner 注入的 JobComplete）:
      │           → 更新 job_run 终态 success + duration（落库），刷新界面
      │           → Runner 常驻轮询自动感知并调度下一个
      └─ terminate{run, reason}
            → 终止调度
            → 调用 self.job_complete（Engine 实例属性，Runner 注入的 JobComplete）:
                  → 更新 job_run 终态 (failed / timeout / cancelled)（落库）
                  → Runner 常驻轮询自动感知并调度下一个
      ※ workflow_done / terminate 命令本身持久化（engine_commands）：
        job_complete 是 Engine **实例属性**（App 启动时绑定、重启后重建重新注入），
        重放 processed=0 命令时属性仍有效——幂等重做终态动作，job_run 不会卡在 running。
```

**状态机**：
- 节点级（Engine 内部维护 + `step_records.status`）：`pending → running → success/failed/timeout`（retry 重入 running）。
- workflow 级（`job_runs.status`）：`pending → running → success/failed/timeout/cancelled`。
- `engine_commands` 忠实记录每次状态迁移与调度决策，是 Engine 调度过程的**唯一事实来源**（表结构见 `schema.sql` 第 10 节）。

**engine_commands 数据生命周期**：

Engine 只管理 workflow 从**开始执行到结束执行**这一段：已完成的终态体现在运行历史（crud-05），未开始的"等待中"状态与触发也由运行历史管理——引擎侧都不保留这两类数据。

| 场景 | 处理 |
|-|-|
| **成功完成**（`workflow_done`，job_run=success） | 完成即**物理删除**该 run 的全部 `engine_commands`（状态已入运行历史，引擎不再需要） |
| **执行失败**（某 step 失败导致整体 failed/timeout/cancelled） | **保留**（可能重试）；最终不重试 → **1 天后软删除**（置 `soft_deleted_at_ms`）→ **2 天后物理删除** |

- 软删除保留一段窗口便于诊断 / 恢复；物理删除彻底清理，避免 `engine_commands` 无限膨胀。

**Runner → Engine 通知机制（消息即命令，持久化）**：

Runner 与 Engine 是并行的后台任务。**notify 不投内存 inbox**——`EngineStart` / `Terminate` 作为命令**先写 `engine_commands` 表**（写库成功即返回，投递不丢），Engine 事件循环从表里消费：

```text
Task Runner 调度线程（生产者）:
  └─ 取出 workflow 任务 → job_run 置 running
        └─ engine.notify(EngineStart{run_id, workflow_id, inputs, workspace})   # 实例方法 &self
              ├─ INSERT engine_commands(command=engine_start, run_id, payload={inputs, workspace}, processed=0)
              ├─ 写库成功即返回（Result::Ok）→ Runner 继续调度下一个任务
              └─ 写库失败（Result::Err）→ Runner 将该 job_run 置 failed（或回滚 queued），不静默丢失
      ※ Terminate 同理: 终止接口 → engine.notify(Terminate{run_id, reason})
           → INSERT engine_commands(command=terminate, payload={reason})

Engine 事件循环（常驻消费者）:
  └─ loop:
        ├─ 扫描 engine_commands 中 processed=0 的命令（按 run_id 分组、按 created_at 顺序）
        │     └─ engine_start{run_id, workflow_id} → 为该 workflow(run_id) 启动独立调度循环
        │          → 消费完置 processed=1 → 继续处理下一条（不阻塞）
        └─ 无新命令时休眠（内存唤醒信号仅提示"有新命令"，见「持久化」）
```

**Engine 收到通知后怎么跑起来**：
- Engine 是常驻后台任务，维护事件循环**从 `engine_commands` 表消费命令**（不依赖内存 inbox、不靠消息内容在内存传递）。
- 事件循环读到 `engine_start` 后，为该 workflow **启动一条独立的调度循环**（引擎内部的调度执行体）；Engine 自身不阻塞、继续消费下一条命令。真正的 DAG 调度就在这条 Engine 调度循环内部（见上方）。

**Engine 的 notify 与后台线程持久化**：

| 对象 | 形态 | 持久化方式 | 重启后如何恢复 |
|-|-|-|-|
| **notify 投递的消息**（EngineStart / Terminate） | 命令写库 | `notify(msg)` = **INSERT engine_commands**（engine_start / terminate，payload 承载 inputs / workspace / reason），**写库成功即返回**；内存不存消息本体 | 命令在 `engine_commands` 中（processed=0），重启后照常被消费——**投递不丢** |
| **内存唤醒信号** | 仅提示 | notify 写库后发一个**内存信号**（oneshot / condvar）唤醒事件循环立即处理；**信号不承载任何消息内容**，仅避免纯轮询 | 丢失无影响：事件循环自身兜底轮询扫描 processed=0，重启后必然重新扫到 |
| **事件循环（常驻主线程）** | 程序实例固定线程 | 无状态消费者：只做「扫 processed=0 → 分发到对应 run 的调度循环 → 置 processed=1」 | App 启动 `Engine::new` 即重建，**线程本身无需持久化** |
| **调度循环（per-run 内部执行体）** | 内存执行体 | **不持有业务状态**：当前推进到哪 = `engine_commands` 未消费命令 + `step_records` 已完成节点，可完全重建 | App 启动 **recover**：扫 `job_runs` 中 status=running 的 workflow 记录 → 为每个重建调度循环 → 从未消费命令继续推进 |

- **恢复闭环（workflow 执行中 App 重启）**：
  1. Runner（常驻轮询）重启后扫 DB：该 job_run 仍 running，且 `engine_commands` 中该 run 的命令（engine_start / step_completed 等）一条未丢；
  2. Engine 启动 recover 重建该 run 的调度循环，从 processed=0 命令续推（dispatch_step 重派、walk_edge 重走，**幂等**——step_records 已有终态的节点不再重复执行）；
  3. 终态（workflow_done / terminate）命令同样在库里：消费时调 `self.job_complete` 属性（重启重绑）落库终态。**job_run 不会卡在 running**。
- **与 Worker 排队的区别**：Worker 侧任务本体在 `step_records`（waiting 队列）；Engine 侧推进信号在 `engine_commands`。两边都是**落库排队 + 常驻线程消费**，App 重启后由各自 recover 重建，无需内存队列。

**Engine / Worker 入口函数**：

```rust
/// Engine 实例：`job_complete` 属性（Runner 注入的 JobComplete），
/// workflow 到达终态（success / failed / timeout / cancelled）时，Engine 在
/// 消费 `workflow_done` / `terminate` 命令时**调用该属性**→ 更新 job_runs 终态（落库）。
/// 属性是程序实例的一部分（App 启动时绑定，重启后重建重新注入），
/// 配合命令持久化（engine_commands）重放，终态动作幂等重做——job_run 不会卡在 running。
pub struct Engine {
    job_complete: Box<dyn OnComplete>,   // 绑定 Runner 注入的 JobComplete：更新 job_runs 终态（落库）
    wake: WakeSignal,                    // 内存唤醒信号（oneshot/condvar）：仅提示"engine_commands 有新命令"，不承载消息内容
    /// 存储句柄（DB 连接/仓库）：notify 写命令、事件循环扫命令、recover 扫 running 记录共用
    store: Arc<dyn EngineStore>,
}

impl Engine {
    /// 构造：绑定 job_complete 属性、创建唤醒信号与存储句柄（由主程序在 App 启动时注入）；
    /// 随后启动事件循环线程 + 执行 recover（扫 job_runs 中 running 的 workflow 记录，重建调度循环）
    pub fn new(job_complete: Box<dyn OnComplete>, store: Arc<dyn EngineStore>) -> Self;

    /// 异步通知入口（**实例方法 &self**）：
    /// **消息即命令，持久化**——EngineStart / Terminate 先 **INSERT engine_commands**
    /// （engine_start / terminate，payload 承载 inputs / workspace / reason，processed=0），
    /// **写库成功即返回**；随后发内存唤醒信号提示事件循环立即处理（信号不承载消息内容）。
    /// 写库失败返回 Err，由调用方（Runner / 终止接口）决定置 failed / 回滚，不静默丢失。
    /// 事件循环线程与实例共享属性（内部 Arc<Self> 或属性 Arc 化），消费命令时经共享引用调 self.job_complete
    pub fn notify(&self, msg: EngineMessage) -> Result<(), EngineError>;

    /// 事件循环（常驻线程，App 启动后一直运行）：
    /// 扫描 engine_commands 中 processed=0 的命令（按 run_id 分组、按 created_at 顺序）→
    /// 分发到对应 run 的调度循环 → 置 processed=1；无新命令时休眠等待唤醒信号 / 兜底轮询。
    fn event_loop(&self);

    /// 启动恢复：扫 job_runs 中 status=running 的 workflow 记录，为每个重建调度循环
    /// （调度循环不持有业务状态，从未消费命令继续推进，幂等）
    fn recover(&self);
}

/// Engine 控制消息（Runner → Engine / 外部 → Engine）
/// **消息即命令**：notify 时作为 engine_start / terminate 命令持久化到 engine_commands
pub enum EngineMessage {
    EngineStart { run_id: String, workflow_id: String,
                  inputs: HashMap<String, String>, workspace: PathBuf },  // Runner 调度线程投递（payload 落库）
    Terminate    { run_id: String, reason: String },                      // 终止接口投递（payload 落库）
}

/// Worker 入口（两个入口，均异步、非阻塞）：
/// 调用方（Runner / Engine）不被阻塞；run_job / run_step 只在 step_records 插入 waiting 记录即返回，
/// 由 Worker 调度线程指派空闲 InnerWorker（常驻池）执行 Executor；
/// 执行完任务后 InnerWorker **同步调用实例属性上的钩子**（钩子定义不同，由绑定方决定完成后的处理）。
/// Worker 不感知业务：Op / Step 运行完之后该做什么，由运行历史（Runner）与 Engine 决定。
/// 完成回调 trait：入参统一为 ExecuteResult（含 run_id；stepId 由实现方从 run_id 拆出）。
/// 由调用方注入实现（作为 Worker / Engine **实例属性**，App 启动时绑定）：Runner 注入 JobComplete，Engine 注入 StepComplete。
pub trait OnComplete: Send {
    fn on_complete(&self, result: ExecuteResult);
}

/// Runner 注入的实现（绑定为 Worker.job_complete / Engine.job_complete）：
/// 单次 OP / Job 完成（含 workflow 整体完成）→ 更新 job_runs 终态（落库），
/// 供运行历史界面展示结果；Runner 常驻轮询自动感知并调度下一个。
pub struct JobComplete;
impl OnComplete for JobComplete {
    fn on_complete(&self, result: ExecuteResult) {
        // 更新 job_runs 终态（落库）+ 展示结果（run_id 取自 result.run_id）
    }
}

/// Engine 注入的实现：workflow 步骤完成 → 从 result.run_id 拆出 stepId，
/// 写 engine_commands: step_completed{run_id, step_id, result}，推进 DAG。
pub struct StepComplete;
impl OnComplete for StepComplete {
    fn on_complete(&self, result: ExecuteResult) {
        let step_id = split_step_id(&result.run_id);   // run_id = <jobRunId>_<stepId>
        // 写 step_completed 命令
    }
}

/// Worker 实例：完成钩子作为**实例属性**（App 启动时一次性绑定、运行期固定使用；
/// 重启后由实例重建重新注入，配合 engine_commands 重放自愈），不再随调用传参。
///
/// **执行机制 = 数据库排队 + Inner Worker 池**：任务先落库（step_records waiting），
/// 再由固定数量的常驻 InnerWorker 消费——不依赖内存队列 / 每次 spawn，
/// **App 重启不丢任务、长期运行内存有上界**。
pub struct Worker {
    job_complete: Arc<dyn OnComplete>,   // 绑定 Runner 注入的 JobComplete：单次 OP / Job 完成 → 更新 job_runs 终态
    step_complete: Arc<dyn OnComplete>,  // 绑定 Engine 注入的 StepComplete：workflow 步骤完成 → 回报 Engine
    executor: Arc<Executor>,             // 共享执行器（无状态，可并发调用）
    inner_workers: Vec<InnerWorker>,     // 常驻执行体池：数量 = ceil(运行历史并发上限 × 1.5)
}

impl Worker {
    /// 构造：绑定两个完成钩子属性，并按并发上限创建 Inner Worker 池
    /// （inner_worker_count = ceil(运行历史"运行中任务并发数" × 1.5)），由主程序在 App 启动时调用
    pub fn new(job_complete: Box<dyn OnComplete>, step_complete: Box<dyn OnComplete>,
               concurrency_limit: usize, executor: Arc<Executor>) -> Self;

    /// 单次 OP / Job 执行（Runner 调用，**实例方法 &self**）：
    /// **只在 step_records 插入一条 status=waiting 记录（任务入 DB 排队，重启不丢）**，
    /// 立即返回句柄；由调度线程指派 InnerWorker 执行，完成后同步调 self.job_complete
    pub fn run_job(&self, req: ExecuteRequest) -> WorkerHandle;

    /// workflow 步骤执行（Engine 调用，**实例方法 &self**）：同上，source=step；
    /// 完成后由 InnerWorker 同步调 self.step_complete（从 result.run_id 拆出 stepId 回报 Engine）
    pub fn run_step(&self, req: ExecuteRequest) -> WorkerHandle;

    /// Worker 调度线程（常驻）：定期扫描 step_records 中 waiting 任务（按 created_at 顺序），
    /// 有空闲 InnerWorker 即指派（push 到其小队列）并将任务 waiting → running（落库）
    fn dispatch_loop(&self);

    /// 启动恢复：App 启动时扫描 step_records 中 status=running 的任务（上次中断残留），
    /// 重新指派给空闲 InnerWorker 重新执行（复用 record_id，完成后覆盖终态与结果）
    fn recover_running(&self);
}

/// Inner Worker：Worker 池内的一个常驻执行体（数量固定，不随任务数增长）。
/// 每个 InnerWorker = 一个小队列（Worker 指派触发）+ 一个常驻执行循环。
pub struct InnerWorker {
    queue: SmallQueue<AssignedTask>,   // 小队列：Worker 指派 → 触发执行（任务本体已在 step_records，仅传 record_id / req）
    busy: AtomicBool,                  // 忙闲标志，Worker 调度线程据此指派
}

impl InnerWorker {
    /// 常驻执行循环（App 启动时创建，运行期不新增）：
    /// 收任务 → Executor::execute(req).await → 更新 step_records 终态+结果 → 同步调属性钩子
    fn spawn_loop(&self, worker: &Worker) {
        loop {
            let task = self.queue.recv().await;            // 阻塞等 Worker 指派
            self.busy.store(true);
            // 1. 确认 step_records 为 running（指派时已置位）
            // 2. 注册 task_id → 进程组（AbortRegistry）→ Executor::execute(req).await
            // 3. 更新 step_records 终态 + 结果（outputs/raw_output/exit_code/error/duration_ms）
            // 4. 按 source 同步调钩子（job → worker.job_complete / step → worker.step_complete）
            // 5. 注销进程组注册, self.busy.store(false)
        }
    }
}

/// Worker 执行句柄：对应 step_records 中一条等待/执行中的记录。
/// **完成通知不依赖句柄**——执行完成后由实例属性钩子（job_complete / step_complete）
/// 同步回调；句柄仅用于调用方（Runner / Engine）**主动控制本次执行**。
pub struct WorkerHandle {
    step_record_id: String,                  // step_records.record_id（定位任务）
    run_id: String,                          // 执行实例标识（日志 / 追踪）
    abort_registry: Arc<AbortRegistry>,      // record_id → 子进程进程组
}

impl WorkerHandle {
    /// 终止本次执行：按执行时启动的**进程组**查杀子进程（进程组机制见 crud-01 5.1），
    /// 用于超时取消 / 用户终止等**外部主动终止**场景；
    /// 单次执行的超时（op.timeoutMs）由 Executor 内部处理，无需句柄介入。
    /// 终止后，InnerWorker 仍会更新 step_records 终态并同步调用属性钩子一次（携带被终止的 ExecuteResult）。
    pub fn abort(&self);

    /// 本次执行是否已结束：查 step_records 该记录状态（success / failed / timeout / 被终止）
    pub fn is_finished(&self) -> bool;
}
```

**Worker 执行机制（数据库排队 + Inner Worker 池）**：

Worker 是真正的执行者，**入口只入队、调度在 Worker 线程、执行在 InnerWorker 池、钩子同步**：

- **入口入队（不执行）**：`worker.run_job(req)` / `worker.run_step(req)`（实例方法 &self）只在
  **step_records 插入一条 status=waiting 记录**（run_id / step_id / op 快照 / client_id / inputs /
  workspace / timeout_ms / source=job|step）后立即返回——**任务本体入 DB，App 重启不丢失**；
  调用方（Runner 调度线程 / Engine 调度循环）不被阻塞；
- **调度（Worker 调度线程，常驻轮询）**：定期扫描 step_records 中 waiting 任务（按 created_at 顺序），
  查询 InnerWorker 忙闲（busy 标志），发现空闲即**指派**（push 到该 InnerWorker 的小队列）并将任务
  **waiting → running（落库）**；
- **执行（InnerWorker 池）**：池大小 = **ceil(运行历史"运行中任务并发数" × 1.5)**；
  每个 InnerWorker 一个**常驻执行循环 + 小队列**（Worker 经小队列触发执行），**数量固定、运行期不新增**，
  内存有上界；收任务 → `Executor::execute(req).await`（见 crud-01 5.1）→ **更新 step_records 终态 + 结果**
  （outputs / raw_output / exit_code / error / duration_ms）→ 按 source 同步调属性钩子：
        ├─ source=job  → self.job_complete（JobComplete，Runner 绑定）:
        │     → 更新 job_runs 终态（落库）并供运行历史界面展示结果（run_id 取自 result）
        │     → Runner 常驻轮询自动感知并调度下一个 queued 任务
        └─ source=step → self.step_complete（StepComplete，Engine 绑定）:
              → 从 result.run_id 拆出 stepId（<jobRunId>_<stepId>）
              → 写 engine_commands: step_completed{run_id, step_id, result}
              → Engine 事件循环消费: 标记步骤结束 → walk_edge → 派发下一节点 → 直至 End
- **崩溃恢复（启动时）**：Worker 初始化时扫描 step_records 中 **status=running** 的任务（上次中断残留），
  重新指派给空闲 InnerWorker **重新执行**（复用 record_id，完成后覆盖终态与结果）；
- **并发边界**：同时执行任务数 ≤ InnerWorker 池大小（1.5 × 并发上限）；Runner 的并发配额（job_runs
  running 计数 ≤ 上限）保证"Job 级并发"，Worker 池保证"执行体并发"，DB 排队天然有界（不占内存）。

- **为何数据库排队而非内存队列**：内存有界队列在 **App 重启时队列内容丢失**；step_records 排队把任务
  持久化在 DB，重启后可恢复（waiting 任务继续调度、running 任务重跑），不丢任务；
- **钩子同步调用**：InnerWorker 执行完成后**同步调用**实例属性钩子（source=job → `job_complete` /
  source=step → `step_complete`）——不转异步投递、不产生事件；钩子内操作（更新状态 / 写命令）同步完成；
- **Worker 不感知**：Op / Step 运行完之后该做什么处理，由绑定方决定——`job_complete` 属性绑定 Runner
  注入的 `JobComplete`（更新 job_runs 终态）、`step_complete` 属性绑定 Engine 注入的 `StepComplete`
  （回报 Engine）。Worker 只执行 + 调实例属性上的 `on_complete`，不区分 JobComplete / StepComplete、
  不产生任何事件；
- **为何 trait 即可、不需要事件**：完成后处理（更新终态 / 回报 Engine）是绑定方自己的业务，天然用
  `OnComplete` trait 表达（入参统一为 ExecuteResult）；Worker / Engine 无需知道发给谁、什么类型。
  run_id 已在结果内（回填自请求）；workflow 场景 stepId 由 StepComplete 从 run_id 拆出
  （`<jobRunId>_<stepId>`）。**钩子作为程序实例属性**（App 启动时绑定、重启后重建重新注入）。
  持久化保障：JobComplete 同步写终态（落库）；StepComplete 写持久化命令（`engine_commands`，崩溃可重放）；
  Engine 的 `job_complete` 属性 + `workflow_done` / `terminate` 命令持久化双保险——重放 processed=0
  命令时属性仍有效，幂等重做终态动作。
- **Engine 事件循环同样不被阻塞**：收到 `EngineStart` 后为该 workflow 启动**独立的调度循环（内部执行体）**，主循环继续接收下一条消息（见上「Runner → Engine 通知机制」）。

### 4.3 边路由逻辑

```text
节点执行完成, 结果 = success | failed | timeout
  │
  ├─ timeout: 不走任何边, 整个 Run 终止
  │
  ├─ success:
  │     ├─ condition=on_success → 激活
  │     ├─ condition=always      → 激活
  │     └─ condition=on_failure   → 跳过
  │
  └─ failed:
        ├─ condition=on_failure → 激活
        ├─ condition=always    → 激活
        └─ condition=on_success → 跳过
```

### 4.4 重试策略

```text
节点 op 执行结果 = failed
  │
  ├─ 节点未配置 retry → 走失败边
  │
  └─ 配置了 retry:
        ├─ on != failure (如 on=success) → 不重试, 走失败边
        ├─ 当前重试次数 >= max → 不重试, 走失败边
        ├─ 当前节点在本次 Run 中已执行次数 >= max*3 → 整个 Run 失败
        └─ 等待 interval (按 backoff 计算) → 重新 dispatch 同一节点
              ├─ constant: 固定 interval
              ├─ linear:   interval * retry_count
              └─ exponential: interval * 2^retry_count
```

**每次重试产生一条新的 StepRecord**（通过 startedAtMs 区分）。

---

### 1.3 Engine / Worker 模式（参考 mistral）

> **核心思想**：一个 Engine 负责"下一步该执行谁"，一个 Worker 负责"把当前这步跑完，然后告诉 Engine 结果"。两者通过**调度命令队列（`engine_commands` 表，见 schema.sql 第 10 节）**通信，事件驱动推进 workflow。

```text
Engine (调度器)                              Worker (执行器)
     │                                           │
     │  1. 事件循环: 取 processed=0 的命令        │
     │  2. 取 DAG, 找就绪节点                    │
     │ ── dispatch_step{node} ─────────────────→│
     │      (写 engine_commands)                 │
     │                                           │ 3. 绑定 Client, 执行 OP
     │                                           │ 4. 写 step_record (running)
     │                                           │ 5. 进程结束, 写 step_record (success/failed/timeout)
     │                                           │ 6. 应用 retry 策略
     │ ←── step_completed{step, result} ────────│
     │      (写 engine_commands)                 │
     │                                           │
     │  7. 写 walk_edge, 根据 result +           │
     │     edge.condition 决定下一批就绪节点      │
     │  8. 全部完成 → 写 workflow_done,          │
     │     调 job_complete 属性更新 job_run 终态  │
```

**Engine 职责**：
- 事件驱动：消费 `engine_commands` 中的命令推进 workflow（engine_start / dispatch_step / walk_edge / workflow_done / terminate，机制见 4.2）
- 维护当前 Run 的执行上下文（节点状态表、出参累积表）
- 根据边的 condition（on_success / on_failure / always）决定下一批可调度节点
- 处理 Start → End 的汇聚（任意入边到达 End 即完成）
- 处理循环回跳（计数 max × 3）
- 超时检测：step 超时 → 立即终止整个 Run（不走边、不重试）
- 写入 job_run 的状态流转
- 消费 `workflow_done` / `terminate` 命令时调用 `self.job_complete`（实例属性）更新 job_runs 终态（落库；命令持久化 + 属性重启重绑，重放幂等），Runner 常驻轮询自动感知并调度下一个

**Worker 职责**：
- 接收 Engine 派发的节点（`worker.run_step(req)` 插 step_records waiting，由 InnerWorker 池执行；机制见 4.2）
- 绑定 Client，生成包装脚本（bash/python/powershell）
- 以指定 workspace 启动子进程
- 捕获 stdout / stderr / exit_code
- 超时 kill 进程
- 把结果写回 step_records，写 `step_completed` 命令回报 Engine
- **入口异步（实例方法）**：`worker.run_job(req)` / `worker.run_step(req)` 通过 `&self` 调用，只在 step_records 插 waiting 记录即返回，调用方不被阻塞；Worker 调度线程指派空闲 InnerWorker 执行 Executor；完成后同步调用实例属性上的 OnComplete 实现（job_complete 更新终态 / step_complete 回报 Engine），Worker 不感知业务
