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
| POST | `/api/workflows/{workflowId}/validate` | — | `{valid:bool, errors:[]}` | DAG 校验: 连通性、Start/End 存在、节点字段合法（允许回跳环，运行时计数终止） |
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
  "outputs": [{"name":"status","from":{"nodeId":"4e5f60718293a4b5c6d7e8f9a1b2c3d4","outputName":"result"},"description":"部署结果"}],
  "nodes": [
    {"nodeId":"0a1b2c3d4e5f60718293a4b5c6d7e8f9","label":"node_start","kind":"start","position":{"x":40,"y":200}},
    {"nodeId":"1b2c3d4e5f60718293a4b5c6d7e8f9a1","label":"node_check","kind":"op","opId":"...","opVersion":2,"clientId":"...","bindings":{},"retry":{"on":"failure","max":2,"backoff":"constant","interval":30000},"position":{"x":320,"y":180}},
    {"nodeId":"2c3d4e5f60718293a4b5c6d7e8f9a1b2","label":"node_end","kind":"end","position":{"x":620,"y":200}}
  ],
  "edges": [
    {"from":"0a1b2c3d4e5f60718293a4b5c6d7e8f9","to":"1b2c3d4e5f60718293a4b5c6d7e8f9a1","condition":"on_success"},
    {"from":"1b2c3d4e5f60718293a4b5c6d7e8f9a1","to":"2c3d4e5f60718293a4b5c6d7e8f9a1b2","condition":"on_success"}
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
| nodes | WorkflowNode[] | 节点：`{nodeId, label, kind(start/op/end), position, opId, opVersion, clientId, bindings, retry}` |
| edges | WorkflowEdge[] | 边：`{from, to, condition(on_success/on_failure/always)}`；存储于 `workflows.edges` JSON 字段，随 Workflow 整体读写 |
| createdAtMs | string | 创建时间 |
| updatedAtMs | string | 更新时间 |

**WorkflowNode（节点）对象字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|-|-|-|-|
| nodeId | string(32 位 UUID) | 是 | 系统生成，Workflow 内唯一。**nodeId 与 opId 是"OP 定义 ↔ OP 实例"的关系：opId 标识 OP 模板，nodeId 标识该 OP 在画布上的一次使用实例；同一 OP 可被多个节点引用（多对一），故不能用 opId 代替 nodeId** |`r`n| label | string | 是 | 画布展示名（如 node_start / node_deploy），由前端生成，仅用于展示与定位，不是唯一标识 |
| kind | enum | 是 | `start` / `op` / `end` |
| position | object \| null | 否 | 画布坐标 `{x, y}`。**创建 API 必填**（前端画布布局后传入，缺失报 400）；**导入 API 可空**（manifest 无坐标时后端生成默认排布并持久化）；更新时随节点整体提交 |
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
| on | enum | 是 | `failure` / `success`（判定见 4.3.2；timeout 一律终止整个 Run、不重试） |
| max | integer | 是 | 最大重试次数 |
| backoff | enum | 是 | `constant` / `linear` / `exponential` |
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
- **允许环路**：回跳边形成的环由 Engine 在运行时以计数终止（循环回跳上限 min(max × 3, max_loop_multiplier)，见 4.3.0），拓扑校验不拒绝环。
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
| `Workflow.updatedAtMs` | `workflows.updated_at_ms` | 毫秒时间戳 |
| `Workflow.name` | `workflows.name` | 名称（全局唯一） |
| `Workflow.version` | `workflows.version` | 版本号 |
| `Workflow.edges[].{from,to,condition}` | `workflows.edges` | JSON 字段整体存储 |
| `WorkflowNode.label` | `workflow_nodes.label` | 画布展示名 |
| `WorkflowNode.opId` | `workflow_nodes.op_id` | 绑定 OP |
| `WorkflowNode.opVersion` | `workflow_nodes.op_version` | 绑定 OP 版本快照 |
| `WorkflowNode.clientId` | `workflow_nodes.client_id` | 执行 Client |
| `WorkflowNode.bindings` | `workflow_nodes.bindings` | JSON object |
| `WorkflowNode.retry` | `workflow_nodes.retry` | JSON object，可空 |

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

**请求体** `WorkflowCreateRequest`（不含 workflowId/version/时间戳；nodes/edges 可选，默认仅 Start + End；**nodes 中每个节点均含 `position:{x,y}`，坐标由前端画布布局后传入并持久化，position 缺失 → 400**）：

```json
{
  "name": "deploy_workflow",
  "description": "部署流水线",
  "inputs": [{"name":"env","type":"string","required":true,"default":"prod","description":"环境"}],
  "outputs": [{"name":"status","from":{"nodeId":"4e5f60718293a4b5c6d7e8f9a1b2c3d4","outputName":"result"},"description":"部署结果"}],
  "nodes": [
    {"nodeId":"0a1b2c3d4e5f60718293a4b5c6d7e8f9","label":"node_start","kind":"start","position":{"x":40,"y":200}},
    {"nodeId":"1b2c3d4e5f60718293a4b5c6d7e8f9a1","label":"node_check","kind":"op","opId":"...","opVersion":2,"clientId":"...","bindings":{},"retry":null,"position":{"x":320,"y":180}},
    {"nodeId":"2c3d4e5f60718293a4b5c6d7e8f9a1b2","label":"node_end","kind":"end","position":{"x":620,"y":200}}
  ],
  "edges": [
    {"from":"0a1b2c3d4e5f60718293a4b5c6d7e8f9","to":"1b2c3d4e5f60718293a4b5c6d7e8f9a1","condition":"on_success"},
    {"from":"1b2c3d4e5f60718293a4b5c6d7e8f9a1","to":"2c3d4e5f60718293a4b5c6d7e8f9a1b2","condition":"on_success"}
  ]
}
```

**成功响应 `200 OK`**：返回已创建的 Workflow（含后端生成的 workflowId、version=1、时间戳）。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | name 为空、position 缺失、拓扑非法、节点字段约束不满足 |
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

**功能说明**：对当前持久化的 Workflow 定义做 DAG 校验（Start/End 存在、连通性、节点字段合法；回跳环允许，由 Engine 计数终止）。前端在保存或执行前调用，以提示拓扑错误。

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

**功能说明**：对单个 Workflow 发起一次独立执行（virtual Job）——**异步投递即返回**：组装 `WorkflowRunRequest` 投递到 `TaskRunner.add_workflow`，创建 workflow 类型运行记录并返回 `{runId}` 后接口即结束，运行记录进入 Task Runner 排队，workflow 实际执行由 Engine / WorkerPool 并行后台完成。`needsUpdate=true` 时禁止执行。

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

**功能说明**：从 ZIP 导入 Workflow，重建其定义及关联的 OP；若同名 Workflow 已存在返回 409（导入冲突）。节点无 `position` 坐标时，后端按默认排布生成并持久化。

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
{ "needsUpdate": true, "outdatedNodes": ["1b2c3d4e5f60718293a4b5c6d7e8f9a1", "3d4e5f60718293a4b5c6d7e8f9a1b2c3"] }
```

| 响应字段 | 类型 | 说明 |
|-|-|-|
| needsUpdate | boolean | 是否存在需更新节点（落后 / 版本超前 / OP 悬挂引用），判定规则见上文 |
| outdatedNodes | string[] | 落后节点的 nodeId 列表 |

**错误响应**：404 `WORKFLOW_NOT_FOUND`。

---

### 3.3.11 GET /api/workflows/{workflowId}/outdated-nodes —— 获取需更新节点

**功能说明**：返回所有需更新节点的 nodeId 列表——节点 `opVersion` 落后于 / 超前于 OP 当前 `version`，或 OP 已删除形成悬挂引用，均计入。供前端在画布上高亮提示需要更新的节点。

**与 3.3.10 的关系**：本接口与 3.3.10 共用同一判定内核（见 3.3.10「判定逻辑」1–6 步），本接口返回 `evaluateWorkflowOutdated` 的直接结果；前端仅需节点列表时调用本接口，需同时判断布尔标记时调用 3.3.10（二者计算结果一致）。

**路径参数**：`workflowId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
["1b2c3d4e5f60718293a4b5c6d7e8f9a1", "3d4e5f60718293a4b5c6d7e8f9a1b2c3"]
```

**错误响应**：404 `WORKFLOW_NOT_FOUND`。

---

### 4.2 Workflow 执行接口实现（异步，投递 Task Runner）

**执行流转总览**（一次执行从触发到完成的完整链路）：

```text
接口触发 (POST /api/workflows/{workflowId}/execute)
  └─ 组装 WorkflowRunRequest → TaskRunner.add_workflow
        └─ 创建 workflow 类型运行记录(waiting)，返回 {runId}，接口即结束
              └─ Task Runner 调度线程: 按入库顺序取 waiting → running
                    ├─ OP 任务: 直接调用 WorkerPool 执行（见 4.4 WorkerPool 机制）
                    └─ Workflow 任务: 通知 Engine 启动该 workflow（写 engine_start 事件）
                          └─ Engine 写事件即处理、链式推进（见 4.3 Engine 机制）
                                └─ Engine 派发 op 给 WorkerPool 执行 → WorkerPool 完成写 step_completed 事件 → 立即处理推进下一步
```

**执行流程**（`POST /api/workflows/{workflowId}/execute`，请求体 `{inputs, workspace}`）：

```text
POST /api/workflows/{workflowId}/execute {inputs, workspace}
  │
  ├─ 1. 校验 workflow: needsUpdate=true → 409 WORKFLOW_NEEDS_UPDATE
  ├─ 2. 解析 workflow 入参: 校验 required, 缺省项应用 default → 最终入参集
  ├─ 3. 组装 WorkflowRunRequest (结构见 crud-05 4.6 Task Runner):
  │     run_id       = 后端生成的 runId (workflow 单次执行, virtual JobRun)
  │     workflow_id  = 当前 workflow id
  │     inputs       = 步骤2解析后的入参集
  │     workspace    = 请求传入的 workspace
  └─ 4. TaskRunner.add_workflow(req) → 创建 workflow 类型运行记录(waiting), 返回 {runId}, 接口即结束
```

**要点**：
- **投递即结束**：本接口在调 `TaskRunner.add_workflow` 后即返回 `{runId}` 结束，**不等待执行、不返回执行结果**。add_workflow 仅在运行历史（crud-05）创建一条 **workflow 类型的运行记录**；workflow 的 DAG 调度与实际执行由 Engine / WorkerPool 并行后台完成，Workflow 层不再参与。
- **默认状态等待中**：`add_workflow` 创建的运行记录即置为 `waiting(等待中)`；Task Runner 调度取出后转 `running(运行中)`，执行完到终态 `success/failed/timeout`。
- **执行引擎与 API 分离**：execute 只负责投递运行记录到 Task Runner，与 Engine 的调度推进无关——Engine 在 workflow 实际开始执行（notify 写 engine_start 事件后立即处理并派发首个 OP，见 4.3）时自行驱动，WorkerPool 负责单个 OP 的实际执行（4.4）。

### 4.3 Engine 机制（编排控制：事件驱动，写即处理，链式推进）

**职责**：
- 以**纯函数事件处理函数 `process_event`** 推进 workflow（engine_start / step_completed / walk_edge / workflow_done / terminate，见下方）
- 加载 workflow definition；执行上下文（节点就绪判定、出参累积）**完全由 `engine_events` + `step_records` 推导**（无内存状态，见 4.3.0）
- 以**边状态机**（每条边的 activated / dropped）与 **activation（执行实例）**模型决定下一批可调度节点（见 4.3.0）
- 处理 Start → End 的汇聚（op 节点 AND-join；End 所有入边均已决定且至少一条 activated、并等在飞步骤收敛）、循环回跳（该 step 执行总次数达上限 min(max × 3, max_loop_multiplier)）、超时终止（step 超时 → 立即终止整个 Run，不走边、不重试）
- 写入 job_run 的状态流转（终态经全局 `JobComplete` 落库）
- **无任何循环、无内存信号、无内存状态**：无常驻事件循环线程、无 Inbox / 唤醒信号——**事件写库后立即同步处理（写即处理）**；多 workflow 并发 = 各触发方（Runner 调度线程 / 各 Worker 线程）交错调用 `process_event`，互不干扰

**链式推进（事件驱动，写即处理）**：

Engine 不维护任何循环 / 执行体——推进 = 事件处理函数 **`process_event`**（同步，谁产生事件谁调用，完整展开见下方）：
- **触发者**：`notify` 写库后立即调用（engine_start / terminate）；`StepComplete` 写 `step_completed` 事件后立即调用（step_completed）；
- 每一步都由上一步的完成事件链式触发（StepComplete 写 step_completed 后立即调 process_event 同步推进）——Engine 不需要任何常驻循环 / 执行体 / 唤醒信号。

**事件驱动与调度事件类型（`engine_events.event_type`）**：

Engine 采用**事件驱动 + 调度事件流**：每次"节点完成 → 决定下一步"都产生一条**调度事件**，持久化到 `engine_events` 表，**写库后立即由 `process_event` 同步处理**（不是等循环扫描）。调度过程全量落库，可审计；Engine 崩溃后可恢复重放（App 启动时 `recover` 一次性处理残留的 `processed=0` 事件）。

| event_type | 含义 | 产生者（写库后立即处理） |
|-|-|-|
| `engine_start` | Runner 通知 Engine 开始执行某 workflow（= notify(EngineStart) 持久化，payload 含 inputs/workspace） | Runner（调度线程）→ notify 写库后立即 process_event |
| `step_completed` | WorkerPool 回报某节点执行完成（payload 含 activation_seq / retry_seq / 结果） | WorkerPool（Worker 完成后经 StepComplete 钩子写，写后立即 process_event） |
| `apply_retry` | 节点失败且配置了 retry，准备重试（payload 含 retry_seq） | Engine（process_event 内部写 + 处理） |
| `walk_edge` | 按结果给各出边置 activated / dropped，推进 DAG（payload 含边状态） | Engine（process_event 内部写 + 处理） |
| `dispatch_step` | 决定调度某节点，派发给 WorkerPool（payload 含 activation_seq / retry_seq / not_before_ms） | Engine（process_event 内部写，随后 worker.run_step） |
| `workflow_done` | workflow 结束（payload 含终态 success / failed）：End 所有入边均已决定且至少一条 activated（并等在飞收敛）→ success；无可就绪/挂起且 End 未 activated → failed | Engine（process_event 内部写 + 处理 → 全局 JobComplete） |
| `terminate` | 异常终止（timeout / user terminate = notify(Terminate) 持久化，payload 含 reason） | Engine / 外部 → notify 写库后立即 process_event |

#### 4.3.0 执行模型：activation、边状态机与纯函数 reducer

> Engine 全程**无内存状态、无常驻循环**。为保证「崩溃重放幂等」与「循环回跳可重入」同时成立，Engine 的状态完全由 **`step_records`（事实）+ `engine_events`（信号）** 推导，`process_event` 本质是一个**纯函数**：
>
> ```text
> advance(state, event) -> (state', [new_events])
> state = derive(engine_events, step_records)   # 可完整重建，不依赖内存
> ```
>
> 由此派生出两个核心概念（贯穿 4.3、4.4 与第 15 章循环场景）：

**① activation（执行实例）与计数**

同一 step 在一次 Run 内可能被执行多次：**重试（retry）** 与循环回跳导致的**重入（activation）**。二者语义不同，必须分开计数（对应列见 `schema.sql` 第 7 节）：

| 概念 | 定义 | 递增时机 |
|-|-|-|
| `activation_seq` | 该 step 在本次 Run 内的第几次「激活」 | 首次 dispatch = 1；**循环回跳**重新激活同一节点时 +1；节点内部重试**不**递增 |
| `retry_seq` | 同一个 activation 内的第几次尝试（**含首次**） | 首次 = 1；每次 `apply_retry` +1 |

- **重试计数** = 同一 `(run_id, step_id, activation_seq)` 下的记录数 − 1（用于 `apply_retry` 的 `max` 判定）。
- **回跳后重试计数重置** = 进入新 activation（`activation_seq+1`），retry_seq 从 1 重新开始（与第 15 章「每轮回跳后重试计数重置」一致）。
- **循环终止**：同一 `(run_id, step_id)` 的**执行总次数**（= 该 step 的 `step_records` 记录数，即所有 activation × attempt 之和；等价于 dispatch_step 事件数）达到**上限**即整个 Run 失败。
  **上限 = `min(max × 3, max_loop_multiplier)`**，其中 `max = retry.max`（节点未配置 retry 时取 1）；`max_loop_multiplier` 为 settings 可配的绝对上限（`0`/未设置 = 不限制，见 crud-06）。未配置（`0`）时上限即 `max × 3`（= 配置的 `retry.max` 的 3 倍，max=3 → 9，与第 15 章「3 × 3 = 9」一致）。
  **判定时机**：仅在**即将再次执行同一节点**（重试 retry 或回跳重入）时判定——正常成功/失败走边不受影响（第 9 次执行成功仍可走成功边完成）。
- 一次实际执行由 `(run_id, step_id, activation_seq, retry_seq)` **唯一标识**（取代原先用 `started_at_ms` 隐式区分）。

**② 边状态机（edge_state，替代「节点级前置完成」判定）**

walk_edge 不为节点判「所有前置是否完成」，而是为**每条边**维护状态：

```text
edge_state ∈ { pending, activated, dropped }
  源节点走边时：condition 命中 → activated；未命中 → dropped
```

节点就绪规则：

| 节点 | 就绪（可 dispatch）条件 | 说明 |
|-|-|-|
| op 节点 / Start 后继 | 该节点**所有入边** ∈ {activated, dropped}，且**至少一条 activated** | AND-join，等所有入边「决定」 |
| （所有入边均 dropped） | 视为 skipped，不产生执行 / 不落 step_record | 条件分流后被排除 |
| End | **所有入边均已决定**（activated / dropped）且**至少一条 activated**；并等所有在飞（running / waiting）步骤收敛后完成 | 与 op 节点同 join；并行多边需全部结束；互斥条件（on_success / on_failure）天然只一条 activated、其余 dropped，故「达到任一条件」即完成 |

- 只有「**实际会激活的边**」参与 join：一个节点同时挂 `on_success` 与 `on_failure` 入边时，只需其中一条 activated，不会死等另一条永远不来的边。
- 边状态（当前 activation）在内存 `RunContext` 中推导（见 4.3.3）；`walk_edge` 事件 payload 同步落库（审计/重放来源），可据此重建，无需依赖运行态表。
- **skipped 传播**：节点被判为 skipped（全部入边 dropped）时，其**所有出边也置为 dropped**，并继续评估其后继节点——否则下游节点会死等一条永远不会被决定的入边，甚至导致提前收敛。
- **边状态生命周期**：边状态在**源节点每次完成**时重新决定（activated/dropped 覆盖旧值）；因此在循环回跳重入后，源节点的出边会重新计算，下游节点的就绪判定始终以各入边**最近一次决定**为准（从未被决定 = pending）。

**③ 回跳边（back edge）**

walk_edge 对被激活边的目标节点判定：若该节点**在本次 Run 内已执行过**，则该边为**回跳边**，目标以 `activation_seq + 1` 重新激活（重试计数随之重置）；否则为普通过边，`activation_seq = 1`。无需在 `edges` 数据里额外标记回跳，由「目标节点是否已执行过」推导。

**Engine 事件处理函数 `process_event`（写即处理，同步）**：

```text
process_event(event)  # 同步；事件已落库（processed=0），处理完成后置 processed=1
 # 纯函数：activation_seq / retry_seq / 重试次数 / 边状态 均从 step_records + engine_events 推导（见 4.3.0），
 # 不读写任何内存状态 —— 因此重放（recover）结果确定且幂等。
  ├─ engine_start{run, workflow_id}                 ← notify(EngineStart) 写库后立即调用
  │     → 加载 workflow definition (nodes, edges)
  │     → 直接推进第一步：对 Start 的出边置 activated → 走就绪规则 dispatch 后继节点
  │       （写 dispatch_step{node, activation_seq=1, retry_seq=1} → worker.run_step，只入队不阻塞）
  ├─ step_completed{run, step, activation_seq, retry_seq, result}   ← StepComplete 钩子写库后立即调用
  │     → 定位并更新 step_records 终态（按 run_id+step_id+activation_seq+retry_seq）
  │     → 进入固定决策链（次序不可换，见下方「step_completed 决策链」）：
  │           ① 超时 / 用户终止 → 写 terminate（不走边、不重试）
  │           ② 若将再次执行同一节点（重试/回跳）且该步执行总次数达上限 min(max×3, max_loop_multiplier) → 写 terminate（整个 Run 失败，循环上限）
  │           ③ 命中重试条件（见 4.3.2）→ 写 apply_retry + dispatch_step（同一 activation，retry_seq+1）
  │           ④ 否则 → 写 walk_edge → 继续处理 walk_edge
  ├─ walk_edge{run, step, result}
  │     → 对**该 step 的每条出边**判定 condition → 置边状态 activated / dropped（见 4.3.1、4.3.0 ②）
  │     → 对每个 activated 边的目标节点 N:
  │           if N 的所有入边均已「决定」(activated|dropped):
  │                 if 存在 activated 入边:
  │                       若 N 已执行过 → 回跳边: activation_seq(N)+1, retry_seq=1（若 N 执行总次数已达上限 min(max×3, max_loop_multiplier) → 不重入, 整个 Run 失败）
  │                       否则          → activation_seq(N)=1, retry_seq=1
  │                       写 dispatch_step{N, activation_seq} → worker.run_step（只入队，不阻塞）
  │                 else: N 无 activated 入边 → 视为 skipped（不产生 step_record）
  │           else:
  │                 挂起: 等 N 其余入边的源节点 step_completed 到达后再判（AND-join 依赖就绪）
  │     → 到达 End（所有入边均已决定且至少一条 activated，且所有 running/waiting 步骤已收敛）→ workflow_done(success); 无就绪节点且无挂起候选但 End 未 activated（含 End 入边全 dropped）→ workflow_done(failed)
  ├─ dispatch_step
  │     → worker.run_step（见 4.4）→ 完成后经 StepComplete 钩子写 step_completed 并立即 process_event
  ├─ workflow_done{run, status}
  │     → 调用全局 JobComplete（更新 job_runs 终态，落库）:
  │           → 更新 job_run 终态 (success / failed) + duration（落库），刷新界面
  │           → Runner 常驻轮询自动感知并调度下一个
  └─ terminate{run, reason}                         ← notify(Terminate) 写库后立即调用
        → 终止调度
        → 调用全局 JobComplete（更新 job_runs 终态，落库）:
              → 更新 job_run 终态 (failed / timeout / cancelled)（落库）
              → Runner 常驻轮询自动感知并调度下一个
**step_completed 决策链（次序不可换）**：
  ① 结果 = timeout / cancelled → terminate（不走边、不重试）
  ② 若本次结果将触发**再次执行同一节点**（重试或回跳重入）且该 step 执行总次数已达上限 min(max×3, max_loop_multiplier) → terminate（Run 失败，循环上限）
  ③ should_retry（on 匹配 + 本 activation 的 attempt 未达 max）→ apply_retry + dispatch_step（同一 activation）
  ④ 否则 → walk_edge
异常路径:
  ├─ timeout: status=timeout
  ├─ user terminate: kill 进程, status=cancelled
  └─ 节点失败且无失败边可达 End: failed
更新 job_run 终态 + duration, 刷新界面状态
※ 处理中产生的后续事件（apply_retry / walk_edge / dispatch_step / workflow_done）在同一调用栈内
     **写一条、处理一条**（同步链式），不回队列、不等待；
     workflow_done / terminate 终态经全局 JobComplete 落库（事件持久化 + 单例重启重建，重放幂等），
     job_run 不会卡在 running。
```

**状态机**：
- 节点级（`step_records.status`）：`waiting → running → success/failed/timeout/cancelled`（cancelled = 被终止/取消）。同一节点**重试**重入 running（同 activation，`retry_seq+1`）；**循环回跳**开启新 activation（`activation_seq+1`，`retry_seq` 重置为 1）。
- workflow 级（`job_runs.status`）：`waiting → running → success/failed/timeout/cancelled`。
- 节点的「执行到第几次」不靠内存：由 `(run_id, step_id, activation_seq, retry_seq)` 唯一定位（见 `schema.sql` 第 7 节）。
- `engine_events` 忠实记录每次状态迁移与调度决策（含 activation_seq / retry_seq / 边状态），是 Engine 调度过程的**唯一事实来源**（表结构见 `schema.sql` 第 9 节）；运行态热路径为内存 `RunContext`，可选 checkpoint 表 `run_edge_state` / `run_node_state` 见第 10/11 节、4.3.3。

**engine_events 数据生命周期**：

Engine 只管理 workflow 从**开始执行到结束执行**这一段：已完成的终态体现在运行历史（crud-05），未开始的"等待中"状态与触发也由运行历史管理——引擎侧都不保留这两类数据。

| 场景 | 处理 |
|-|-|
| **成功完成**（`workflow_done`，job_run=success） | 完成即**物理删除**该 run 的全部 `engine_events`（状态已入运行历史，引擎不再需要）；若启用可选 checkpoint 表 `run_edge_state` / `run_node_state`，一并删除 |
| **执行失败**（某 step 失败导致整体 failed/timeout/cancelled） | **保留**（可能重试）；最终不重试 → **1 天后软删除**（置 `soft_deleted_at_ms`）→ **2 天后物理删除**；可选 checkpoint 表同生命周期一并清理 |

- 软删除保留一段窗口便于诊断 / 恢复；物理删除彻底清理，避免 `engine_events` 无限膨胀。

**Runner → Engine 通知机制（消息即事件，写即处理）**：

Runner 与 Engine 是并行的后台任务。**notify 不投内存 inbox、不发任何信号**——`EngineStart` / `Terminate` 作为事件**先写 `engine_events` 表**，写库成功后**立即同步调用 `process_event` 处理该事件**（engine_start → 派发首个 OP），处理完成才返回：

```text
Task Runner 调度线程（生产者）:
  └─ 取出 workflow 任务 → job_run 置 running
        └─ engine.notify(EngineStart{run_id, workflow_id, inputs, workspace})   # 实例方法 &self
              ├─ 1. INSERT engine_events(event_type=engine_start, run_id, payload={inputs, workspace}, processed=0)   # 先落库
              ├─ 2. 立即 process_event(engine_start)（同步，当前线程）
              │       → 找第一个就绪节点 → 写 dispatch_step → worker.run_step → 触发首个 OP 执行
              │       （若只落库不处理，engine_start 无人消费、调度不起来——所以必须写后立即处理）
              ├─ 3. 处理完成 → 返回（Result::Ok）→ Runner 继续调度下一个任务
              └─ 写库失败（Result::Err）→ Runner 将该 job_run 置 failed（或回滚 waiting），不静默丢失
      ※ Terminate 同理: 终止接口 → engine.notify(Terminate{run_id, reason})
           → INSERT engine_events(event_type=terminate, payload={reason}) → 立即 process_event(terminate) → 返回
```

**Engine 收到通知后怎么跑起来**：
- Engine **没有常驻线程**：不依赖内存 inbox、不靠消息在内存传递、无唤醒信号。`notify` 在**调用方线程内**完成「写事件 + 立即处理」——`engine_start` 被同步处理：找第一个就绪节点、写 dispatch_step、调 `worker.run_step(req, inst)`（只插 step_records waiting 记录、不阻塞），然后返回，Runner 继续调度下一个任务。
- 此后的推进由 **WorkerPool 的完成事件**驱动：Worker 执行完某 OP → 同步调 `StepComplete` 钩子 → 钩子写 `step_completed` 事件 → **立即调 `engine.process_event(step_completed)`** 链式推进下一步（更新终态 / retry / walk_edge / 派发后继）——**没有事件循环、没有 per-run 调度循环**，DAG 推进全在 `process_event` 调用栈内完成（见上方）。
- **并发**：多个 workflow 同时执行时，不同 workflow 的事件由不同触发线程（Runner 调度线程、各 Worker 线程）交错调用 `process_event` 处理，天然并行、互不干扰；无需为任何 workflow 维护执行体。

**事件持久化与恢复**：

| 对象 | 形态 | 持久化方式 | 重启后如何恢复 |
|-|-|-|-|
| **notify 投递的消息**（EngineStart / Terminate） | 事件写库 | `notify(msg)` = **INSERT engine_events**（engine_start / terminate，payload 承载 inputs / workspace / reason，processed=0）→ **立即同步 process_event 处理** → 返回；内存不存消息本体 | 事件在 `engine_events` 中（processed=0），启动时由 `Engine::recover` 一次性处理——**投递不丢** |
| **推进中的事件**（dispatch_step / walk_edge / apply_retry / workflow_done） | 事件写库 | process_event 内**写一条、处理一条**（processed=0 → 处理完置 processed=1）；崩溃窗口 = 事件已写库、尚未处理 | 残留 processed=0 事件由 recover 按序逐个 process_event（dispatch_step 重派、walk_edge 重走，**幂等**——当前 activation 已有终态记录则不重复执行） |
| **事件循环 / 唤醒信号** | **已取消** | 无——推进 = 事件写库后立即同步处理（写即处理），不依赖任何内存状态 | 无需重建——没有需要恢复的线程 / 信号 |
| **per-run 调度循环** | **已取消**（无内存执行体） | 当前推进到哪 = `engine_events` 未消费事件 + `step_records` 已完成节点，天然可重建 | recover 一次性处理残留事件即恢复，之后无任何常驻循环 |

- **恢复闭环（workflow 执行中 App 重启）**：
  1. Runner（常驻轮询）重启后扫 DB：该 job_run 仍 running，且 `engine_events` 中该 run 的事件（engine_start / step_completed 等）一条未丢；
  2. **事件补齐（以 step_records 终态为准）**：`Engine::recover` 启动时扫描该 run 的 step_records，若存在"已有终态（success/failed/timeout）但缺少对应 step_completed 事件"的节点——即崩溃恰好落在"WorkerPool 已写终态、事件尚未写入"的窗口——则**补写该 step_completed 事件**（写前按 run_id + step_id + activation_seq + retry_seq 查重，幂等），确保"事实（step_records）与信号（engine_events）"在任何崩溃窗口下都对齐；
  3. `Engine::recover` **按序逐个调用 process_event 处理残留的 processed=0 事件**（一次性，处理完即结束、不启动任何循环线程；dispatch_step 重派、walk_edge 重走，**幂等**——当前 activation（run_id + step_id + activation_seq）已有终态记录则不重复执行）；
  4. 终态（workflow_done / terminate）事件同样在库里：处理时调全局 `JobComplete` 落库终态（全局单例重启后重建，仍可用）。**job_run 不会卡在 running**。
- **与 WorkerPool 排队的区别**：WorkerPool 侧任务本体在 `step_records`（waiting 队列，由 WorkerPool 调度线程常驻消费，见 4.4）；Engine 侧推进信号在 `engine_events`——**写即处理**（生产线程同步处理），仅崩溃残留由 recover 一次性处理。两边都落库持久化，App 重启后不丢、无需内存队列。

**三者全局静态单例与启动顺序**：

Task Runner / Engine / WorkerPool **三者均为全局静态单例**（`static RUNNER / ENGINE / WORKER_POOL: OnceLock<Arc<…>>`，App 进程生命周期内各仅一个实例）。互引**不经构造注入**——Engine 经全局 `WORKER_POOL` 派发 OP、WorkerPool 完成后按 source 经全局 `JOB_COMPLETE` / `STEP_COMPLETE` 回调、Engine 终态经全局 `JOB_COMPLETE` 落库；**无 Weak、无回填、无组装顺序问题**。全局单例使三个组件可自由互访，钩子不再是实例字段。

```rust
/// App 启动初始化（一次）：先建基础组件（store / executor），再按依赖序初始化三者，
/// 随后各自恢复（WorkerPool 先重跑 running 残留 → Engine 事件补齐 + 续推 → Runner 常驻轮询启动）
fn init() {
    let store    = Arc::new(SqliteStore::open(db_path));
    let executor = Arc::new(Executor::new());
    WORKER_POOL.set(Arc::new(WorkerPool::new(executor, concurrency_limit)));
    ENGINE.set(Arc::new(Engine::new(store.clone())));
    RUNNER.set(Arc::new(TaskRunner::new(store.clone())));
    WORKER_POOL.get().unwrap().recover_running();
    ENGINE.get().unwrap().recover();
    RUNNER.get().unwrap().start();   // 常驻轮询线程
}
```

**Engine 入口**：

```rust
static ENGINE: OnceLock<Arc<Engine>> = OnceLock::new();

/// Engine 实例（全局单例）：**无注入字段**（无 job_complete、无 worker 引用）。
/// workflow 到达终态（success / failed / timeout / cancelled）时，Engine 在处理
/// `workflow_done` / `terminate` 事件时调用**全局 JobComplete**→ 更新 job_runs 终态（落库）。
/// 单例是 App 进程生命周期的一部分（init() 时创建，重启后重建），配合事件持久化
/// （engine_events）重放，终态动作幂等重做——job_run 不会卡在 running。
/// **无循环、无信号**：无常驻事件循环线程、无 Inbox / 唤醒信号——
/// 事件写库后立即由 `process_event` 同步处理（写即处理）。
pub struct Engine {
    /// 存储句柄（DB 连接/仓库）：notify 写事件、process_event 读写事件与内存 RunContext（可选快照至 run_edge_state / run_node_state）、recover 扫 running 记录共用
    store: Arc<dyn EngineStore>,
}

impl Engine {
    /// 构造：仅绑定存储句柄（由主程序在 App 启动 init() 时创建并 set 进全局 ENGINE）；
    /// 不启动任何线程；recover 一次性处理残留事件后即结束
    pub fn new(store: Arc<dyn EngineStore>) -> Self;

    /// 异步通知入口（**实例方法 &self**）：
    /// **消息即事件，写即处理**——EngineStart / Terminate 先 **INSERT engine_events**
    /// （engine_start / terminate，payload 承载 inputs / workspace / reason，processed=0），
    /// 写库成功后**立即同步调用 process_event 处理该事件**（engine_start → 派发首个 OP），
    /// **处理完成才返回（Result::Ok）**——不依赖任何循环 / 信号。
    /// 写库失败返回 Err，由调用方（Runner / 终止接口）决定置 failed / 回滚，不静默丢失。
    pub fn notify(&self, msg: EngineMessage) -> Result<(), EngineError>;

    /// 事件处理函数（同步、无循环、无信号）——Engine 推进的全部逻辑：
    /// engine_start → 找首个就绪节点 → 写 dispatch_step + 全局 WORKER_POOL.run_step；
    /// step_completed → 按决策链（超时终止 / retry / max×3 / walk_edge）→ 派发后继（WORKER_POOL.run_step 只入队不阻塞）；
    /// workflow_done / terminate → 调全局 JOB_COMPLETE 落库终态。
    /// 谁产生事件谁调用：notify 写库后调用；全局 StepComplete 写 step_completed 后调用。
    /// 处理中产生的后续事件**写一条、处理一条**（同步链式）；多 workflow 并发 =
    /// 各触发线程交错调用，无需常驻消费者。
    pub fn process_event(&self, event: EngineEvent) -> Result<(), EngineError>;

    /// 启动恢复（**一次性，无常驻循环**）：扫 job_runs 中 status=running 的 workflow 记录；
    /// 事件补齐（以 step_records 终态为准，幂等）→ 按序逐个 process_event 处理残留
    /// processed=0 事件，处理完即结束（不启动任何循环线程）。
    pub fn recover(&self);
}

/// Engine 控制消息（Runner → Engine / 外部 → Engine）
/// **消息即事件**：notify 时作为 engine_start / terminate 事件持久化到 engine_events，
/// 写库后立即 process_event 处理
pub enum EngineMessage {
    EngineStart { run_id: String, workflow_id: String,
                  inputs: HashMap<String, String>, workspace: PathBuf },  // Runner 调度线程投递（payload 落库）
    Terminate    { run_id: String, reason: String },                      // 终止接口投递（payload 落库）
}
```**完成钩子（OnComplete trait）**：

WorkerPool 与 Engine 的"完成后做什么"由**全局实现**决定（不再作为实例属性注入）：`JobComplete`（更新 job_runs 终态）、`StepComplete`（写 step_completed 事件后直接调全局 ENGINE.process_event 推进）。

```rust
/// 完成回调 trait：入参统一为 ExecuteResult（含 run_id；stepId 由实现方从 run_id 拆出）。
/// 实现为**全局可访问**（static 单例），App 启动 init() 时创建，不再注入实例字段
pub trait OnComplete: Send {
    fn on_complete(&self, result: ExecuteResult);
}

/// 全局实现（static JOB_COMPLETE）：单次 OP / Job 完成（含 workflow 整体完成）→
/// 更新 job_runs 终态（落库），供运行历史界面展示结果；Runner 常驻轮询自动感知并调度下一个。
pub struct JobComplete;
impl OnComplete for JobComplete {
    fn on_complete(&self, result: ExecuteResult) {
        // 更新 job_runs 终态（落库）+ 展示结果（run_id 取自 result.run_id）
    }
}

/// 全局实现（static STEP_COMPLETE）：workflow 步骤完成 → 从 result.run_id 拆出 stepId，
/// 写 engine_events: step_completed{run_id, step_id, result}（processed=0），
/// **写后立即同步调用全局 ENGINE.process_event(step_completed) 推进 DAG**（无事件循环，写即处理）。
/// 全局单例天然可互引，无需 Weak / 回填。
pub struct StepComplete;
impl OnComplete for StepComplete {
    fn on_complete(&self, result: ExecuteResult) {
        let step_id = split_step_id(&result.run_id);   // run_id = <jobRunId>_<stepId>
        // 取该 (run_id, step_id) 最新一条 step_records（Worker 已在同一调用栈写完终态）
        // 得到本次执行的 activation_seq / retry_seq（ExecuteResult 本身不携带步骤轮次）
        let (activation_seq, retry_seq) = latest_step_record(run_id, step_id);
        // 1. 写 step_completed{run_id, step_id, activation_seq, retry_seq, result} 事件（落库，processed=0）
        // 2. ENGINE.get().unwrap().process_event(step_completed{...});
    }
}
```**Engine ↔ WorkerPool 协作时序**：

> **核心思想**：Engine 负责"下一步该执行谁"，WorkerPool 负责"把当前这步跑完，然后告诉 Engine 结果"。两者通过**调度事件流（`engine_events` 表，见 schema.sql 第 9 节）**通信，**事件写库后立即同步处理**（写即处理），事件驱动推进 workflow。

```text
Runner 调度线程 / Engine                             WorkerPool (执行器)
     │                                                   │
     │ 1. notify(EngineStart)                            │
     │    → 写 engine_start 事件 → 立即 process_event    │
     │ 2. 取 DAG, 找就绪节点                            │
     │ ── dispatch_step{node, activation_seq} ─────────→│
     │    (写 engine_events + worker.run_step)          │
     │                                                   │ 3. 绑定 Client, 执行 OP
     │                                                   │ 4. 写 step_record (waiting → running)
     │                                                   │ 5. 进程结束, 写 step_record (success/failed/timeout)
     │                                                   │ 6. 应用 retry 策略
     │ ←── step_completed{step, act, attempt, result} ──│
     │    (StepComplete 钩子写事件)                      │
     │ 7. 写后立即 process_event(step_completed)         │
     │ 8. 写 walk_edge, 根据 result +                    │
     │    edge.condition 决定下一批就绪节点               │
     │ 9. 全部完成 → 写 workflow_done,                   │
     │    处理之 → 调全局 JobComplete 更新 job_run 终态  │
```
#### 4.3.1 walk_edge 边路由判定

节点执行完成时，Engine 按结果与边 condition 决定**每条出边**的状态（timeout 不走任何边、整个 Run 终止）。边状态机与目标节点就绪规则见 4.3.0 ②。

**第一步：按结果给各出边置边状态**

```text
节点执行完成, 结果 = success | failed | timeout
  │
  ├─ timeout: 不走任何边（不置 activated/dropped）, 整个 Run 终止
  │
  ├─ success:
  │     ├─ condition=on_success → activated
  │     ├─ condition=always     → activated
  │     └─ condition=on_failure → dropped
  │
  └─ failed:
        ├─ condition=on_failure → activated
        ├─ condition=always     → activated
        └─ condition=on_success → dropped
```

**第二步：按目标节点就绪规则决定是否 dispatch**（规则表见 4.3.0 ②）

```text
for 每条 activated 边的目标节点 N:
    if N 的所有入边均已决定 (activated|dropped):
        if 存在 activated 入边:
            若 N 已执行过 → 回跳边: activation_seq(N)+1, retry_seq=1（若 N 执行总次数已达上限 min(max×3, max_loop_multiplier) → 不重入, 整个 Run 失败）
            否则          → activation_seq(N)=1, retry_seq=1
            写 dispatch_step{N, activation_seq} → worker.run_step   # 只入队, 不阻塞
        else:
            记 N = skipped, 不产生执行                # 全部入边 dropped
            对 N 的所有出边置 dropped, 递归评估其后继   # skipped 传播, 避免下游死等
    else:
        挂起: 等 N 其余入边的源节点 step_completed 到达后再判   # AND-join 依赖就绪
 到达 End: 所有入边均已决定 (activated|dropped) 且至少一条 activated 且无在飞 (running/waiting) 步骤 → 写 workflow_done(success)
 无可就绪节点且无挂起候选但 End 未 activated → 写 workflow_done(failed)（收敛为失败）
```

#### 4.3.2 apply_retry 重试判定

节点失败且配置了 retry 时，Engine 在走边前先判定是否重试（重试则 `apply_retry` + `dispatch_step` 重新入队**同一 activation**，`retry_seq+1`，不走边）。所有计数均取自 `step_records`（见 4.3.0 ①），不依赖内存：

> 说明：本判定按 `NodeRetry.on` 与结果匹配触发；下文以 `failed` 为例，`on=success` 时对**成功**结果同样判定重试。

```text
节点 op 执行结果 = failed（timeout / 用户终止不走此判定, 直接 terminate）
  │
  ├─ 节点未配置 retry → 走边
  │
  └─ 配置了 retry:
        ├─ 即将重试且该 (run_id, step_id) 的执行总次数 >= 上限 min(max*3, max_loop_multiplier) → 不再重试, 整个 Run 失败（循环上限）
        ├─ on 与结果不匹配（如 on=success）→ 不重试, 走边
        ├─ 本 activation 的尝试已达 max（同 (run,step,activation_seq) 记录数-1 >= max）→ 不重试, 走边
        └─ 按 backoff 计算退避间隔 → 写 apply_retry + dispatch_step（同一 activation, retry_seq+1; not_before_ms = now + interval, 不阻塞）
              ├─ constant: 固定 interval
              ├─ linear:   interval * retry_count        # retry_count = retry_seq - 1
              └─ exponential: interval * 2^retry_count
```

**每次尝试产生一条新的 StepRecord**：同一 activation 内 `retry_seq` 递增（1,2,3…）；**循环回跳**进入新 activation 时 `activation_seq` 递增、`retry_seq` 重置为 1。`(run_id, step_id, activation_seq, retry_seq)` 唯一标识一次执行（取代原先用 `startedAtMs` 隐式区分）。

> **非阻塞退避（与「无循环 / 无阻塞」一致）**：Engine 不 sleep。退避间隔由 Engine 写入 `dispatch_step` / `StepInstance.not_before_ms`（= now + interval，按 backoff 计算），WorkerPool 落库为 `step_records.not_before_ms`，并在到点前不指派（DB 排队天然支持延迟）——因此重试等待不占用任何 Engine 线程。

#### 4.3.3 执行模型实现：内存 RunContext（热路径）+ 事件日志（事实来源）

**目标**：单次 `step_completed` 的推进代价只与该节点邻域有关（与 N 无关），且**热路径不产生 O(度) 次 DB 往返**。

**核心：内存 RunContext**

每个进行中的 run 在 Engine 进程内持有一个 `RunContext`（内存），承载推进所需的全部运行态：

- DAG 邻接表（node→out-edges / node→in-edges），加载 workflow definition 时构建一次；
- 边状态（pending / activated / dropped）；
- 节点就绪计数（`pending_in_edges` / `activated_in_edges`，当前 activation）；
- 已完成节点 / 出参（供 binding 取值）。

`walk_edge` 全程在**内存里查表 / 加减**，O(度)，**不读写运行态 DB 表**。

**事实来源仍是 `engine_events`（+ `step_records`）**

- 事件照旧**先落库**（写即处理），RunContext 只是「已落库事件的函数」；
- 崩溃丢内存 → `Engine::recover` 重放 `engine_events` + `step_records` **重建 RunContext** 继续推进（幂等）；
- 因此内存态**丢失不影响正确性**。

**热路径 DB 写（省不掉的）**

| 必须落库 | 原因 |
|-|-|
| `step_records` 插 waiting | WorkerPool 队列持久化，重启接着跑 |
| `step_records` 终态 + 结果 | 运行历史 / 重跑重试依据 |
| `engine_events` append | 重放、审计（亦是 RunContext 恢复依据） |
| `job_runs` 状态流转 | 运行历史 |

除以上外，`walk_edge` 不再产生任何 DB 读写——单步 DB 操作 ≈ **O(1)**（仅事件 append）。

**并发（必须）**

同一 run 的 `process_event` 会由**多个线程**（Runner 调度线程 + 各 Worker 线程）交错调用，因此：

- 每个 `RunContext` **按 run 加锁**（或把事件投递到该 run 的单一处理队列，actor 化）；
- 不同 run 的 context 相互独立，天然并行；
- 锁粒度 = run，不阻塞其它 run。

**内存上界**

- 并发 run 多 / N 大时，用 **LRU 驱逐空闲 run 的 context**（被驱逐者靠重放恢复，无损）；
- context 只在 run 进行期间存活，终态后释放。

**可选 checkpoint 表（`run_edge_state` / `run_node_state`，schema 第 10/11 节）**

- 定位：**可选**，**不是热路径**。两类用途：
  1. **恢复加速**：把内存 RunContext 周期性 / 结束时快照到这两张表，重启时优先读快照（缺失再回退重放），减少重放量；
  2. **运维 / 诊断**：需 SQL 直接观察某 run 的边状态与就绪计数时使用。
- 若不采用（纯内存 + 全量重放），这两张表可**不建**，功能不受影响。

**复杂度对照**

| 指标 | 内存 RunContext（推荐） | 每步直读运行态表 |
|-|-|-|
| 单步找边 / 找下个节点 | O(度)，纯内存 | O(度)，DB 往返 |
| 单步 DB 操作 | O(1)（仅事件 append） | O(度) 读写（含写锁） |
| 整条执行 DB 操作 | O(K) | O(E) + O(K) |
| 就绪判定 | O(1)（内存计数） | O(1)（DB count） |
| 恢复 | 重放事件（或读 checkpoint） | 直接读表 |
| 内存 | O(N+E) / 活跃 run（可 LRU） | 低 |

**与 engine_events 的关系**：`RunContext`（内存）或 `run_edge_state` / `run_node_state`（可选快照）= 运行态；`engine_events` = **唯一事实来源**。二者都可从事件重建。

### 4.4 WorkerPool 机制（执行层：数据库排队 + Worker 池）

**职责**：
- 接收 Runner / Engine 派发的任务（`worker.run_job(req)` / `worker.run_step(req, inst)` 插 step_records waiting（含 activation_seq / retry_seq），由 Worker 池执行）
- 绑定 Client，生成包装脚本（bash / python / powershell / prompt），以指定 workspace 启动子进程（Executor，机制见 crud-01 5.1）
- 捕获 stdout / stderr / exit_code；超时按进程组 kill
- 把结果写回 step_records（终态 + outputs / raw_output / exit_code / error / duration_ms），按 source 同步调全局完成实现
- **不感知业务**：Op / Step 运行完之后该做什么，由全局实现决定（job → `JobComplete` / step → `StepComplete`）

**执行机制（数据库排队 + Worker 池）**：

WorkerPool 是真正的执行者，**入口只入队、调度在 WorkerPool 线程、执行在 Worker 池、钩子同步**：

- **入口入队（不执行）**：`worker.run_job(req)` / `worker.run_step(req, inst)`（实例方法 &self）只在
  **step_records 插入一条 status=waiting 记录**（run_id / step_id / activation_seq / retry_seq / op 快照 / client_id / inputs /
  workspace / timeout_ms / source=job|step / not_before_ms）后立即返回——**任务本体入 DB，App 重启不丢失**；
  调用方（Runner 调度线程 / Engine.process_event 调用方）不被阻塞；
- **调度（WorkerPool 调度线程，常驻轮询）**：定期扫描 step_records 中 waiting 任务（按 created_at 顺序；**跳过 `not_before_ms` 未到点者**，即重试退避尚未到期），
  查询 Worker 忙闲（busy 标志），发现空闲即**指派**（push 到该 Worker 的小队列）并将任务
  **waiting → running（落库）**；
- **执行（Worker 池）**：池大小 = **ceil(运行历史"运行中任务并发数" × 1.5)**；
  每个 Worker 一个**常驻执行循环 + 小队列**（WorkerPool 经小队列触发执行），**数量固定、运行期不新增**，
  内存有上界；收任务 → `Executor::execute(req).await`（见 crud-01 5.1）→ **更新 step_records 终态 + 结果**
  （outputs / raw_output / exit_code / error / duration_ms）→ 按 source 同步调全局完成实现：
        ├─ source=job  → 全局 JobComplete:
        │     → 更新 job_runs 终态（落库）并供运行历史界面展示结果（run_id 取自 result）
        │     → Runner 常驻轮询自动感知并调度下一个 waiting 任务
        └─ source=step → 全局 StepComplete:
              → 从 result.run_id 拆出 stepId（<jobRunId>_<stepId>）
              → 写 engine_events: step_completed{run_id, step_id, activation_seq, retry_seq, result}
              → 立即调全局 ENGINE.process_event 同步推进（写即处理）: 标记步骤结束 → walk_edge → 派发下一节点 → 直至 End
- **崩溃恢复（启动时）**：WorkerPool 初始化时扫描 step_records 中 **status=running** 的任务（上次中断残留），
  重新指派给空闲 Worker **重新执行**（复用 record_id，完成后覆盖终态与结果）；
- **并发边界**：同时执行任务数 ≤ Worker 池大小（1.5 × 并发上限）；Runner 的并发配额（job_runs
  running 计数 ≤ 上限）保证"Job 级并发"，WorkerPool保证"执行体并发"，DB 排队天然有界（不占内存）。

- **为何数据库排队而非内存队列**：内存有界队列在 **App 重启时队列内容丢失**；step_records 排队把任务
  持久化在 DB，重启后可恢复（waiting 任务继续调度、running 任务重跑），不丢任务；
- **钩子同步调用**：Worker 执行完成后**同步调用**全局完成实现（source=job → `JobComplete` /
  source=step → `StepComplete`）——不转异步投递、不产生事件；实现内操作（更新状态 / 写事件记录）同步完成；
- **为何 trait 即可、不需要事件**：完成后处理（更新终态 / 回报 Engine）是全局实现自己的业务，天然用
  `OnComplete` trait 表达（入参统一为 ExecuteResult）；WorkerPool / Engine 无需知道发给谁、什么类型。
  run_id 已在结果内（回填自请求）；workflow 场景 stepId 由 StepComplete 从 run_id 拆出
  （`<jobRunId>_<stepId>`）。**实现为全局可访问**（static 单例，App 启动 init() 时创建、重启后重建）。
  持久化保障：JobComplete 同步写终态（落库）；StepComplete 写持久化事件（`engine_events`，崩溃可重放）并立即 `process_event` 推进；
  全局 ENGINE + `workflow_done` / `terminate` 事件持久化双保险——重放 processed=0
  事件时全局实现仍可访问，幂等重做终态动作。

**WorkerPool 入口**：

```rust
static WORKER_POOL: OnceLock<Arc<WorkerPool>> = OnceLock::new();

/// WorkerPool 实例（全局单例）：**无注入字段**（无 job_complete / step_complete 属性），
/// 完成后按 source 直接调全局实现（JobComplete / StepComplete）。
///
/// **执行机制 = 数据库排队 + Worker 池**：任务先落库（step_records waiting），
/// 再由固定数量的常驻 Worker 消费——不依赖内存队列 / 每次 spawn，
/// **App 重启不丢任务、长期运行内存有上界**。
pub struct WorkerPool {
    executor: Arc<Executor>,             // 共享执行器（无状态，可并发调用）
    workers: Vec<Worker>,     // 常驻执行体池：数量 = ceil(运行历史并发上限 × 1.5)
}

/// 步骤执行实例标识（由 Engine 的 dispatch_step 决定）：定位 step_records 中的一次实际执行。
pub struct StepInstance {
    pub activation_seq: u32,   // 第几次激活（首次=1；循环回跳重入 +1）
    pub retry_seq: u32,        // activation 内第几次尝试（含首次；首次=1，apply_retry +1）
    pub not_before_ms: Option<String>,  // 最早可执行时间（重试退避；None = 立即可执行）
}

impl WorkerPool {
    /// 构造：按并发上限创建 Worker 池
    /// （worker_count = ceil(运行历史"运行中任务并发数" × 1.5)），由主程序在 App 启动 init() 时调用
    pub fn new(executor: Arc<Executor>, concurrency_limit: usize) -> Self;

    /// 单次 OP / Job 执行（Runner 调用，**实例方法 &self**）：activation_seq=1、retry_seq=1；
    /// **只在 step_records 插入一条 status=waiting 记录（任务入 DB 排队，重启不丢）**，
    /// 立即返回句柄；由调度线程指派 Worker 执行，完成后按 source=job 同步调全局 JobComplete
    pub fn run_job(&self, req: ExecuteRequest) -> WorkerHandle;

    /// workflow 步骤执行（Engine 调用，**实例方法 &self**）：除 req 外携带 `inst`
    /// （activation_seq / retry_seq，由 Engine 的 dispatch_step 决定），据此写入 waiting 记录；source=step；
    /// 完成后由 Worker 按 source=step 同步调全局 StepComplete（从 result.run_id 拆出 stepId 回报 Engine）
    pub fn run_step(&self, req: ExecuteRequest, inst: StepInstance) -> WorkerHandle;

    /// WorkerPool 调度线程（常驻）：定期扫描 step_records 中 waiting 任务（按 created_at 顺序），
    /// 有空闲 Worker 即指派（push 到其小队列）并将任务 waiting → running（落库）
    fn dispatch_loop(&self);

    /// 启动恢复：App 启动时扫描 step_records 中 status=running 的任务（上次中断残留），
    /// 重新指派给空闲 Worker 重新执行（复用 record_id，完成后覆盖终态与结果）
    fn recover_running(&self);
}

/// Worker：WorkerPool内的一个常驻执行体（数量固定，不随任务数增长）。
/// 每个 Worker = 一个小队列（WorkerPool 指派触发）+ 一个常驻执行循环。
pub struct Worker {
    queue: SmallQueue<AssignedTask>,   // 小队列：WorkerPool 指派 → 触发执行（任务本体已在 step_records，仅传 record_id / req）
    busy: AtomicBool,                  // 忙闲标志，WorkerPool 调度线程据此指派
}

impl Worker {
    /// 常驻执行循环（App 启动时创建，运行期不新增）：
    /// 收任务 → Executor::execute(req).await → 更新 step_records 终态+结果 → 按 source 同步调全局实现
    fn spawn_loop(&self, worker: &WorkerPool) {
        loop {
            self.busy.store(false);
            let task = self.queue.recv().await;            // 阻塞等 WorkerPool 指派
            self.busy.store(true);
            // 1. 确认 step_records 为 running（指派时已置位）
            // 2. 注册 task_id → 进程组（AbortRegistry）→ Executor::execute(req).await
            // 3. 更新 step_records 终态 + 结果（outputs/raw_output/exit_code/error/duration_ms）
            // 4. 按 source 同步调全局实现（job → JOB_COMPLETE / step → STEP_COMPLETE）
            // 5. 注销进程组注册, self.busy.store(false)
        }
    }
}

/// WorkerPool 执行句柄：对应 step_records 中一条等待/执行中的记录。
/// **完成通知不依赖句柄**——执行完成后由全局实现（JobComplete / StepComplete）同步回调；
/// 句柄仅用于调用方（Runner / Engine）**主动控制本次执行**。
pub struct WorkerHandle {
    step_record_id: String,                  // step_records.record_id（定位任务）
    run_id: String,                          // 执行实例标识（日志 / 追踪）
    abort_registry: Arc<AbortRegistry>,      // record_id → 子进程进程组
}

impl WorkerHandle {
    /// 终止本次执行：按执行时启动的**进程组**查杀子进程（进程组机制见 crud-01 5.1），
    /// 用于超时取消 / 用户终止等**外部主动终止**场景；
    /// 单次执行的超时（op.timeoutMs）由 Executor 内部处理，无需句柄介入。
    /// 终止后，Worker 仍会更新 step_records 终态并同步调用全局实现一次（携带被终止的 ExecuteResult）。
    pub fn abort(&self);

    /// 本次执行是否已结束：查 step_records 该记录状态（success / failed / timeout / 被终止）
    pub fn is_finished(&self) -> bool;
}
```
