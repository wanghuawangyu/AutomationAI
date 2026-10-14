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
| GET | `/api/workflows/{workflowId}/outdated-nodes` | — | `[workflowNodeId,...]` | 节点 opVersion != OP 当前 version |

**Workflow 对象**：
```json
{
  "workflowId": "...",
  "name": "deploy_workflow",
  "description": "部署流水线",
  "version": 2,
  "inputs": [{"name":"env","type":"string","required":true,"default":"prod","description":"环境"}],
  "outputs": [{"name":"status","from":{"workflowNodeId":"1b2c3d4e5f60718293a4b5c6d7e8f9a1","outputName":"result"},"description":"部署结果"}],
  "nodes": [
    {"workflowNodeId":"0a1b2c3d4e5f60718293a4b5c6d7e8f9","label":"node_start","kind":"start","position":{"x":40,"y":200}},
    {"workflowNodeId":"1b2c3d4e5f60718293a4b5c6d7e8f9a1","label":"node_check","kind":"op","opId":"...","opVersion":2,"clientId":"...","bindings":{},"retry":{"on":"failure","max":2,"backoff":"constant","interval":30000},"position":{"x":320,"y":180}},
    {"workflowNodeId":"2c3d4e5f60718293a4b5c6d7e8f9a1b2","label":"node_end","kind":"end","position":{"x":620,"y":200}}
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
| name | string | 全局唯一；**边界：长度 ≤ 512 字符，字符集不限（任意 UTF-8 字符）** |
| description | string \| null | 描述 |
| version | integer | 版本号，默认 1 |
| inputs | WorkflowInput[] | 入参：`[{name, type:"string", required, default, description}]` |
| outputs | WorkflowOutput[] | 出参：`[{name, from:{workflowNodeId, outputName}, description}]` |
| nodes | WorkflowNode[] | 节点：`{workflowNodeId, label, kind(start/op/end), position, opId, opVersion, clientId, bindings, retry}` |
| edges | WorkflowEdge[] | 边：`{from, to, condition(on_success/on_failure/always)}`；存储于 `workflows.edges` JSON 字段，随 Workflow 整体读写 |
| createdAtMs | string | 创建时间 |
| updatedAtMs | string | 更新时间 |

**WorkflowNode（节点）对象字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|-|-|-|-|
| workflowNodeId | string(32 位 UUID) | 是 | 系统生成，**全局唯一 UUID**（主键；同一 Workflow 内自然唯一）。**workflowNodeId 与 opId 是"OP 定义 ↔ OP 实例"的关系：opId 标识 OP 模板，workflowNodeId 标识该 OP 在画布上的一次使用实例；同一 OP 可被多个节点引用（多对一），故不能用 opId 代替 workflowNodeId** |
| label | string | 是 | 画布展示名（如 node_start / node_deploy），由前端生成，仅用于展示与定位，不是唯一标识 |
| kind | enum | 是 | `start` / `op` / `end` |
| position | object \| null | 否 | 画布坐标 `{x, y}`。**创建 API 必填**（前端画布布局后传入，缺失报 400）；**导入 API 可空**（manifest 无坐标时后端生成默认排布并持久化）；更新时随节点整体提交 |
| opId | string(32 位 UUID) | op 时必填 | 绑定的 OP |
| opVersion | integer | op 时必填 | 绑定的 OP 版本 |
| clientId | string(32 位 UUID) | op 节点**必填** | 执行所用 Client（**D3：op 节点 `clientId` 必填**，缺失 → 400 `VALIDATION_ERROR`）；start / end 节点无此字段 |
| bindings | object | op 时可空 | 入参绑定，见下 |
| retry | object \| null | 否 | 重试策略，见下 |

**bindings（入参绑定）对象字段说明**：`{ "<paramName>": { "kind": "node_output" | "workflow_input" | "literal" | "unbound", ... } }`

| kind | 附加字段 | 说明 |
|-|-|-|
| `node_output` | `workflowNodeId`, `outputName` | 取**前置节点**（含义见下「参数绑定必须指向前置节点」）的出参 |
| `workflow_input` | `inputName` | 取 Workflow 入参 |
| `literal` | `value` | 固定值 |
| `unbound` | 无 | **无来源**（**拖拽创建节点时全部入参的初始态**）；视为未绑定 |

> **无来源判据（决策-入参无来源判据）**：满足任一条即视为该入参**无来源**——① `bindings[name]` **不存在**；② `kind="unbound"`；③ `kind="literal"` 且 `value=""`。若该入参为 `required` → 校验不通过（400 `VALIDATION_ERROR`，见下方校验规则 15，属 B 组：保存时不校验）。
> **参数绑定下拉的候选范围（决策-参数绑定指向前置节点）**：仅列「**从 Start 可达且位于当前节点之前**」的节点出参——绑定必须**指向前置节点**（校验规则 14，属 B 组：保存时不校验）。

**retry（重试策略）对象字段说明**：`{ "on", "max", "backoff", "interval" }`

| 字段 | 类型 | 必填 | 说明 |
|-|-|-|-|
| on | enum | 是 | `failure` / `success`（判定见 4.3.2；timeout 一律终止整个 Run、不重试） |
| max | integer | 是 | **每轮最大尝试次数**（**首次执行计入**：`max=3` → 每轮最多 3 次尝试，序列 3/3/3；判定见 4.3.2） |
| backoff | enum | 是 | `constant` / `linear` / `exponential` |
| interval | integer | 是 | 重试间隔（毫秒） |

**WorkflowEdge（边）对象字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|-|-|-|-|
| from | string | 是 | 起始节点 workflowNodeId |
| to | string | 是 | 目标节点 workflowNodeId |
| condition | enum | 是 | `on_success` / `on_failure` / `always` |

> 说明：`edges` **不作为单独表存储**，而是随 Workflow 整体存于 `workflows.edges` JSON 字段（无独立主键/`edge_id`）。边由 `from` / `to` / `condition` 唯一定位，API 层不暴露边 ID；Workflow 的 `edges` 数组本身即完整边列表，无需单独引用某条边。

**校验规则**（**共 17 条**：A 组 `9/10/11/16` + B 组 `1–7/13–15/18` + C 组 `12/17`，编号 8 留空；**导入 3.3.9 同口径**，但节点 `clientId` 由 `clientName` 解析（`clientName` 空 → 走下方「兼容路径」）；**与 `proposal-01 §10.14`（界面可见项 13 行）按语义对应、差异见各条注（允许回跳环见规则 17），本表为完整契约集**）：

> **规则分区与执行时机（D2 闭环：允许保存草稿）**——**保存（3.3.3 创建 / 3.3.4 更新）只做「字段与结构类」校验**；**「拓扑 / 连通 / 绑定类」规则不在保存时执行**（与 `proposal-01 §10.9`「允许保存草稿」一致）：
> - **A. 字段与结构类（保存 / `[校验]` / 导入 / 创建 Run 前 均执行）**：`name` 非空且 ≤ 512 字符、op 节点 `position` 必填、节点总数 ≤ 配置项 `workflow_max_nodes`，以及规则 **9 / 10 / 11 / 16**（见下表 A 组）；
> - **B. 拓扑 / 连通 / 绑定类（保存时**不**执行）**：规则 **1–7 / 13–15 / 18**（见下表 B 组；D2 原文的 B 组区间含本轮已删除的原第 8 条「汇聚」，故 B 组实为 1–7 / 13–15 / 18）；「连线必须指向本 Workflow 内存在的节点」（`edges[].from` / `.to` 命中 `workflowNodeId`；否则即拓扑非法）同属本组。执行时机 = `[校验]`（3.3.6）、导入落库前（3.3.9）与**创建 Run 前**；
> - **C. 说明性条目（非校验项、不构成校验失败）**：规则 **12 / 17**（见下表 C 组）；
> - **「创建 Run 前」** = 任一创建 `job_runs` 的入口（3.3.7 单次执行 / crud-04 3.4.6 手动运行与 cron / crud-05 重跑·重试）在**落库 Run 之前**执行**同一套完整校验（A + B 分组）**，不通过 → 400 `VALIDATION_ERROR`（本文件定义规则集与 3.3.7 的落点，见 4.4）；
> - **编号说明**：**原第 8 条「汇聚」已删除**（见下表后的删除说明），其余编号（1–7、9–18）保持不变，以免破坏既有「校验规则 N」引用——故校验规则共 **17 条**（编号 8 留空）。

**A. 字段与结构类（保存 / `[校验]` / 导入 / 创建 Run 前 均执行）**

| # | 规则 | 不通过时 |
|-|-|-|
| 9 | 每个 op 节点必须绑定 opId + opVersion | 400 `VALIDATION_ERROR` |
| 10 | **所有 op 节点的 `clientId` 非空**（**D3**；值为 32 位 UUID）。**导入 3.3.9**：`clientId` 由 `clientName` 按名重映射，`clientName` 为空的节点走下方兼容路径 | 400 `VALIDATION_ERROR` |
| 11 | op 节点 `clientId` 引用的 Client **类型须与节点 OP 类型匹配**（bash/python/powershell/prompt 须同类对应；Client 可被编辑更换类型，故提交时按定义再校一次）。**与 `proposal-01 §10.14` 的 `client_type` 条目（原型校验清单同名项）为同一条规则，不重复计数** | 400 `CLIENT_TYPE_MISMATCH`，`message` 固定为：`Client 类型与 OP 类型不匹配：OP <opName> 为 <opType>，Client <clientName> 为 <clientType>`（同一校验口径见 crud-02 3.2.6；错误码见 `proposal-02 §10.1` 总表） |
| 16 | **Start 出边约束**：Start 无失败语义，不允许 `on_failure` 出边（恒 `on_success` / `always`；Start 仅 🟢 单出边锚点） | 400 `VALIDATION_ERROR` |

**B. 拓扑 / 连通 / 绑定类（保存时**不**执行；`[校验]` / 导入 / 创建 Run 前执行）**

| # | 规则 | 不通过时 |
|-|-|-|
| 1 | 必须有且仅有一个 start 节点、一个 end 节点 | 400 `VALIDATION_ERROR` |
| 2 | Start **无入边** | 400 `VALIDATION_ERROR` |
| 3 | End **无出边** | 400 `VALIDATION_ERROR` |
| 4 | Start **至少一条出边** | 400 `VALIDATION_ERROR` |
| 5 | End **至少一条入边** | 400 `VALIDATION_ERROR` |
| 6 | 从 start 出发**可达** end | 400 `VALIDATION_ERROR` |
| 7 | 所有 op 节点**从 Start 可达**、且**均能到达 End** | 400 `VALIDATION_ERROR` |
| 13 | bindings 引用的前置节点出参必须存在 | 400 `VALIDATION_ERROR` |
| 14 | **参数绑定必须指向前置节点**（**D4**）：`kind="node_output"` 的 `workflowNodeId` 必须满足「从 Start 可达且位于当前节点之前」 | 400 `VALIDATION_ERROR` |
| 15 | **所有 required 入参必须有来源**（判据见「无来源判据」：绑定缺失 / `unbound` / `literal` 且 `value=""`） | 400 `VALIDATION_ERROR` |
| 18 | **出参来源必须有效**：每个 `Workflow.outputs[].from` 的 `workflowNodeId` 必须**存在且为 op 节点**，`outputName` 必须在该节点 OP 定义的 `outputs[].name` 中；任一不满足 → 校验不通过（决策-出参来源校验；与 `proposal-01 §10.14` 同名条一致） | 400 `VALIDATION_ERROR` |

**C. 说明性条目（非校验项，不产生 400）**

| # | 条目 | 说明 |
|-|-|-|
| 12 | op 节点 `clientId` **非空但 Client 不存在**（悬挂引用） | 定义层不拦；运行期该 step 落 `failed`、`error=CLIENT_NOT_FOUND`，**不启动子进程**（见 4.4） |
| 17 | **允许环路**（**替代 `proposal-01 §10.14` 的「DAG 无环」条**）：回跳边形成的环由 Engine 在运行时以计数终止（回跳总上限 `min(max × 3, max_loop_multiplier)`，见 4.3.0）；拓扑校验**不拒绝环**；回跳边**不在定义中显式标记**，由运行期「目标节点是否已执行过」推导（见 4.3.0 ③） | —（不拒绝；不构成校验失败） |

> **已删除的规则（原第 8 条「多条入边的节点必须有明确汇聚」；决策-删除「汇聚」校验项）**：节点汇聚由 DAG 边决定（op 节点为 AND-join，见 4.3.0 ②），**不作为校验项、不构成校验失败**（与 `proposal-01 §10.5`「不单独配置汇聚策略」一致）。故校验规则总数 = **17 条**（编号 8 留空）。

> **兼容路径（历史 / 导入遗留的空 `clientId` 节点）**：规则 10 对**新建（3.3.3）与更新（3.3.4）**强制；若既有节点 `clientId` 为空（历史数据 / 导入包），不在提交时校验——运行前由 Engine 组装 ExecuteRequest 时回退 `Job.target.clientId`（仅 Job target=op 时存在；单次执行无 Job → 回退为空），仍空则走 `run_failed`；运行期类型不匹配由 Worker 执行前校验拦截（step 落 `failed`，`error=CLIENT_TYPE_MISMATCH`，见 4.4）。

---

### 3.3.0 通用约定

> 以下为 Workflow 管理全部 API 的完整 HTTP 定义。通用约定：
> - 基础路径 `/api`；路径参数中的 `workflowId` 为 32 位无连字符 UUID；**路径参数格式非法**（非 32 位无连字符 UUID）→ 400 `VALIDATION_ERROR`。
> - 时间字段 JSON 中统一为 string（毫秒时间戳）。
> - 列表分页 `page` / `page_size`（`page_size` ∈ 10 / 50 / 100 / 1000，默认 10）。
> - 错误响应统一格式 `{"error":{"code":"...","message":"..."}}`。

**字段命名 ↔ 数据库列映射**（API 字段 camelCase ↔ `schema.sql` 列 snake_case）：

| API 字段 | 数据库列 | 说明 |
|-|-|-|
| `Workflow.workflowId` | `workflows.workflow_id` | 主键，32 位 UUID |
| `WorkflowNode.workflowNodeId` | `workflow_nodes.workflow_node_id` | 主键，全局唯一 UUID |
| `WorkflowNode.position.{x,y}` | `workflow_nodes.position_x / position_y` | 画布坐标 |
| `Workflow.createdAtMs` | `workflows.created_at_ms` | 毫秒时间戳 |
| `Workflow.updatedAtMs` | `workflows.updated_at_ms` | 毫秒时间戳 |
| `Workflow.name` | `workflows.name` | 名称（全局唯一） |
| `Workflow.description` | `workflows.description` | 描述（可空） |
| `Workflow.inputs` | `workflows.inputs` | 入参定义，JSON 数组 |
| `Workflow.outputs` | `workflows.outputs` | 出参定义，JSON 数组 |
| `Workflow.version` | `workflows.version` | 版本号 |
| `Workflow.edges[].{from,to,condition}` | `workflows.edges` | JSON 字段整体存储 |
| `WorkflowNode.label` | `workflow_nodes.label` | 画布展示名 |
| `WorkflowNode.kind` | `workflow_nodes.kind` | start / op / end |
| `WorkflowNode.workflowId` | `workflow_nodes.workflow_id` | 所属 Workflow（列名 `workflow_id`） |
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

**功能说明**：新建 Workflow，`name` 全局唯一，`version` 初始为 1；未提供 nodes/edges 时默认创建仅含 Start + End 的骨架，供画布后续编排。**保存不要求通过拓扑校验**——本接口只做「字段与结构类」校验（3.3 分组 A），**允许保存草稿**（与 `proposal-01 §10.9` 一致）；拓扑 / 连通 / 绑定类问题（分组 B）留待 `[校验]`（3.3.6）或执行前（创建 Run 前）拦截（见 D2）。

**路径参数**：无　**查询参数**：无

**请求体** `WorkflowCreateRequest`（不含 workflowId/version/时间戳；nodes/edges 可选，默认仅 Start + End；**nodes 中每个节点均含 `position:{x,y}`，坐标由前端画布布局后传入并持久化，position 缺失 → 400**）：

```json
{
  "name": "deploy_workflow",
  "description": "部署流水线",
  "inputs": [{"name":"env","type":"string","required":true,"default":"prod","description":"环境"}],
  "outputs": [{"name":"status","from":{"workflowNodeId":"1b2c3d4e5f60718293a4b5c6d7e8f9a1","outputName":"result"},"description":"部署结果"}],
  "nodes": [
    {"workflowNodeId":"0a1b2c3d4e5f60718293a4b5c6d7e8f9","label":"node_start","kind":"start","position":{"x":40,"y":200}},
    {"workflowNodeId":"1b2c3d4e5f60718293a4b5c6d7e8f9a1","label":"node_check","kind":"op","opId":"...","opVersion":2,"clientId":"...","bindings":{},"retry":null,"position":{"x":320,"y":180}},
    {"workflowNodeId":"2c3d4e5f60718293a4b5c6d7e8f9a1b2","label":"node_end","kind":"end","position":{"x":620,"y":200}}
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
| 400 | `VALIDATION_ERROR` | **字段与结构类校验（3.3 分组 A）**：name 为空或超 512 字符、op 节点 `position` 缺失、节点字段约束不满足、**节点未绑 `opId`/`opVersion`（校验规则 9）**、**Start 存在 `on_failure` 出边（校验规则 16）**、**op 节点 `clientId` 缺失（校验规则 10）**、**节点总数超过配置项 `workflow_max_nodes`（默认 200、上限 1000，见 crud-06 一）**。**拓扑 / 连通 / 绑定类（分组 B：校验规则 1–7、13–15、18）不在保存时校验**（允许保存草稿；由 `[校验]` 与创建 Run 前拦截，见 3.3 校验规则分区 / D2） |
| 400 | `CLIENT_TYPE_MISMATCH` | **op 节点绑定的 `clientId` 类型与节点 OP 类型不匹配**（见 3.3 校验规则 11；同一校验口径见 crud-02 3.2.6）；`message` 固定为：`Client 类型与 OP 类型不匹配：OP <opName> 为 <opType>，Client <clientName> 为 <clientType>` |
| 409 | `WORKFLOW_NAME_EXISTS` | name 已存在 |

---

### 3.3.4 PUT /api/workflows/{workflowId} —— 更新 Workflow

**功能说明**：更新 Workflow 的完整定义（nodes、edges、inputs、outputs 等）。`bumpVersion=false` 覆盖当前版本、`bumpVersion=true` 升版本。**与 3.3.3 同口径：保存只做「字段与结构类」校验（3.3 分组 A），不要求拓扑校验通过**（允许保存草稿，见 D2）。

**路径参数**：`workflowId`（32 位 UUID，必填）

**查询参数**：无

**请求体** `{ workflow, bumpVersion }`：`workflow` 为完整 WorkflowCreateRequest；`bumpVersion` 为 boolean（`false`=覆盖 / `true`=version+1）。

> **审计字段规则（D9）**：请求体若携带 `workflowId` / `createdAtMs` / `updatedAtMs`（系统生成字段），后端**一律忽略（不报错）**——PUT 语义为「整体替换可编辑字段」。（与 crud-06 配置接口的**只读项**不同：配置只读项被**显式拒绝**（400）；实体审计字段仅忽略。）

**成功响应 `200 OK`**：返回更新后的 Workflow 对象。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | **字段与结构类校验（3.3 分组 A）**：请求体字段非法、**节点未绑 `opId`/`opVersion`（校验规则 9）**、**Start 存在 `on_failure` 出边（校验规则 16）**、**op 节点 `clientId` 缺失（校验规则 10）**、**节点总数超过配置项 `workflow_max_nodes`（默认 200、上限 1000，见 crud-06 一）**。**拓扑 / 连通 / 绑定类（分组 B）不在保存时校验**（允许保存草稿，见 D2） |
| 400 | `CLIENT_TYPE_MISMATCH` | **op 节点绑定的 `clientId` 类型与节点 OP 类型不匹配**（同一校验口径见 3.3.3）；`message` 固定为：`Client 类型与 OP 类型不匹配：OP <opName> 为 <opType>，Client <clientName> 为 <clientType>` |
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

**功能说明**：对当前持久化的 Workflow 定义做**完整校验（3.3 校验规则分组 A + 分组 B，共 15 条可判定规则；另规则 12 / 17 属说明性条目、不产生 400）**：Start/End 存在与入出边、连通性、可达性、Required 有来源、绑定指向前置节点、出参来源有效、op 节点 `clientId` 非空与类型匹配等；**回跳环允许**，由 Engine 计数终止。

**调用时机（D2）**：**前端仅在用户主动点击 [校验] 时调用本接口**；[保存]（3.3.3 / 3.3.4）**不要求**校验通过、**保存时也不会自动调用本接口**（允许保存草稿）；`[执行]` / Job 触发时由后端在**创建 Run 前**做同一套完整校验（分组 A + B），不通过 → 400 `VALIDATION_ERROR`（见 3.3 校验规则分区与执行时机、4.4「创建 Run 前校验」）。

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

> 校验不通过属**成功响应**（`200 OK` + `valid:false` + `errors[]`），不以错误码返回。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | workflowId 格式非法 |
| 404 | `WORKFLOW_NOT_FOUND` | workflowId 不存在 |

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
| 400 | `VALIDATION_ERROR` | workspace 缺失、inputs 含未定义参数；**创建 Run 前定义完整性校验不通过**（3.3 分组 A + 分组 B 共 15 条可判定规则，另规则 12 / 17 属说明性条目，见 D2 / 4.4「创建 Run 前校验」） |
| 400 | `CLIENT_TYPE_MISMATCH` | **op 节点显式绑定 `clientId`，且该 Client 类型与节点 OP 类型不匹配**（Client 可被编辑更换类型，故提交时按定义再校一次；同一校验口径见 3.3.3）；`message` 固定为：`Client 类型与 OP 类型不匹配：OP <opName> 为 <opType>，Client <clientName> 为 <clientType>`；**兼容路径（历史 / 导入遗留的空 `clientId` 节点）**：节点未绑定 `clientId` 的情形不在提交时校验——运行前由 Engine 组装 ExecuteRequest 时回退 `Job.target.clientId`（仅 Job target=op 时存在；单次执行无 Job），仍空则走 `run_failed`，类型不匹配则执行前校验失败、该 step 落 `failed`（`error=CLIENT_TYPE_MISMATCH`，不启动子进程、不消耗超时，见 4.4） |
| 404 | `WORKFLOW_NOT_FOUND` | workflowId 不存在 |
| 409 | `WORKFLOW_NEEDS_UPDATE` | needsUpdate=true，需更新后才能执行 |
| 409 | `CONCURRENCY_CONFLICT` | 全局 waiting 队列达配置项 `job_queue_waiting_max`（默认 20、可调、上限 1000，见 crud-06 一）上限（单次执行也走创建 job_runs 入口，统一检查；见 crud-04 3.4.6.1「适用范围（全入口生效）」） |

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

**默认文件名（前端预填，允许用户自定义）**：`workflow-<name>-v<version>.zip`（name 为 Workflow 名称、version 为当前版本号；如 `workflow-deploy_workflow-v2.zip`）。前端落盘前仅拒绝含 `/`、`\`、`..` 的文件名——文件名校验规则与运行历史导出一致（D5 适用范围=**全部导出**，见 crud-05 3.5.10）。

> ZIP 结构：`manifest.json` + `workflow.yaml` + `ops/*.yaml`。

**`workflow.yaml`（导出格式；与 3.4.9 Job 包内 `workflows/<name>.yaml` 同一格式）**：

```yaml
name: deploy_workflow
version: 2
description: 部署流水线
inputs:  [{name: env, type: string, required: true, default: prod, description: 环境}]
outputs: [{name: status, from: {workflowNodeId: n2, outputName: result}, description: 部署结果}]
nodes:
  - {workflowNodeId: n1, label: node_start, kind: start, position: {x: 40, y: 200}}
  - workflowNodeId: n2
    label: node_check
    kind: op
    opName: check_tests      # 以【名称】引用 OP（导入重映射锚点；导出时由 opId 反查名称）
    opVersion: 2             # 导出时快照（保真）；导入复用时若落后由 needsUpdate 提示
    clientName: my-bash      # 可选；导出时由 clientId 反查名称
    bindings: {}
    retry: {on: failure, max: 2, backoff: constant, interval: 30000}
    position: {x: 320, y: 180}
  - {workflowNodeId: n3, label: node_end, kind: end, position: {x: 620, y: 200}}
edges:
  - {from: n1, to: n2, condition: on_success}
  - {from: n2, to: n3, condition: on_success}
```

> 关键差异：**依赖引用（OP / Client）在包内以名称表达**（`opName` / `clientName`），不以 uuid 表达，以便导入到新环境时按名称解析并重映射为新 uuid（见 3.3.9）。`workflowNodeId` 在包内以**短别名**（`n1` / `n2` / `n3` …）表达——导出时由后端生成（按节点顺序 n1、n2…），edges / outputs.from 引用同一短别名；**导入时为每个节点重新生成 32 位 UUID**，并按短别名映射重写 `edges.from/to` 与 `outputs.from.workflowNodeId`（不沿用导出环境的 UUID，避免跨环境主键冲突）。

**完整 ZIP 目录结构**（**Workflow 包保持根级 `workflow.yaml`**，不套 `workflows/` 子目录）：

```text
workflow-deploy_workflow-v2.zip
├── manifest.json
├── workflow.yaml
└── ops/
    └── check_tests.yaml
```

> （树仅示意层级，**成员顺序以下条为准**：`workflow.yaml` → `manifest.json` → `ops/<opName>.yaml`）
> **ZIP 成员顺序（导出端固定，端到端可逐字节比对）**：`workflow.yaml` → `manifest.json` → `ops/<opName>.yaml`（按 `manifest.ops` 顺序）。导入端**不依赖成员顺序**，按 `manifest.ops[].file` 定位。
> **与 Job 包的形态差异（拍板：ZIP 目录形态 + `manifest.target`，见 `crud-04` 3.4.9）**：Workflow 包的目标实体就是包根级 `workflow.yaml`（无 `target` 字段）；Job 包因需同时携带 Job + 目标实体，改用 `workflows/` + `ops/` **目录形态**并以 `manifest.target.file` 名称锚定位（见 crud-04 3.4.9）。两者 `manifest` 的 `clients[]` / `ops[]` 字段口径一致。

**`manifest.json`（包描述）**：

```json
{
  "kind": "workflow",
  "schemaVersion": 1,
  "appVersion": "0.1.0",
  "exportedAtMs": "1728000000000",
  "workflow": { "name": "deploy_workflow", "version": 2 },
  "clients": [ { "name": "my-bash", "clientId": "a1b2..." } ],
  "ops": [ { "name": "check_tests", "version": 2, "file": "ops/check_tests.yaml" } ]
}
```

| 字段 | 类型 | 说明 |
|-|-|-|
| kind | string | 固定 `"workflow"` |
| schemaVersion | integer | 包格式版本，当前 1 |
| appVersion | string | 导出 APP 版本（迁移兼容判断用） |
| exportedAtMs | string | 导出时间（毫秒时间戳字符串） |
| workflow | object | 包内 Workflow 的名称与版本（**锚定根级 `workflow.yaml`**，即导入的**名称锚**）——导入一致性校验见 3.3.9（**决策-导入名称锚一致性**） |
| clients | object[] | 包内出现的 Client（`workflow.yaml` 节点 `clientName`）：`{name, clientId}`——仅记录**名称↔导出时 id** 对应关系，供导入报错时提示需注册的 Client 名（导入不创建 Client，见 3.3.9）；无节点绑定时为 `[]`。**导入不校验本字段**：`clientId` 的**存在性与唯一性均不校验**，也不作任何 id 复用依据（以 `name` 匹配为准）——包内多条 `clientId` 重复仅是数据质量问题，不报错 |
| ops | object[] | 包内 OP 依赖：`{name, version, file}`。`name` 为**导入名称锚之一**（与其 `file` 指向文件内的 `name` 逐条比对，见 3.3.9）；`file` **仅作包内定位**（导出端约定为 `ops/<文件内 name>.yaml`；导入端**不校验文件名**，只校验文件**内容**的 `name`） |

**`ops/*.yaml`（包内 OP 定义）**：与 OP 导出 YAML **同一格式**（字段规范与样例见 crud-02 3.2.7）；仅包含 OP 定义字段，不含 `opId` / 时间戳。

**`workflow.yaml` 字段说明（对应 Workflow 对象，见 3.3）**：

| YAML 字段 | 说明 |
|-|-|
| name / version / description | Workflow 定义（version 为导出时快照，导入沿用） |
| inputs | 入参 `[{name, type, required, default, description}]` |
| outputs | 出参 `[{name, from:{workflowNodeId, outputName}, description}]`（`from.workflowNodeId` 引用节点短别名；导入时按节点 UUID 映射重写） |
| nodes | 节点数组：`workflowNodeId`（短别名 n1/n2/…，导出时按节点顺序生成；导入时重新生成 UUID；**导入端只要求包内别名唯一，不校验形如 `n1`；32 位 UUID 值同样合法**）、`label`、`kind`（start/op/end）、`position`；`kind=op` 时含 `opName`（导出时由 `opId` 反查名称）、`opVersion`（快照）、`clientName`（可选，导出时由 `clientId` 反查）、`bindings`、`retry` |
| edges | 边数组 `[{from, to, condition}]`（`from`/`to` 引用节点短别名；导入时按节点 UUID 映射重写） |

> 导入端（3.3.9）以 `manifest.json` 的 ops 名称锚 + `workflow.yaml` 的 `opName` / `clientName` 重映射为新 uuid；`workflowNodeId` 不沿用导出环境值——导入时为每个节点生成新的 32 位 UUID，建立 `短别名 → 新UUID` 映射，并同步重写 `edges.from/to` 与 `outputs.from.workflowNodeId`（避免跨环境主键冲突）。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | workflowId 格式非法 |
| 404 | `WORKFLOW_NOT_FOUND` | workflowId 不存在 |

---

### 3.3.9 POST /api/workflows/import —— 从 ZIP 导入 Workflow

**功能说明**：从 ZIP 导入 Workflow，重建其定义及关联的 OP；若同名 Workflow 已存在返回 409（导入冲突）。节点无 `position` 坐标时，后端按默认排布生成并持久化。

**路径参数**：无　**查询参数**：无

**请求体**：

```json
{ "zip": "UEsDBBQACAgI..." }
```

**成功响应 `200 OK`**：返回导入创建的 Workflow 对象；若依赖被复用且版本与包内声明不一致，响应体附带 `warnings` 列表（如 `["op check_tests: 包内 v2，环境现有 v3（已复用现有）"]`）；导入的 Workflow 可能因此 `needsUpdate=true`（见 3.3.10）。

**导入校验顺序（D12，显式列表，返回首个命中）**：

| 序 | 校验 | 不通过时 |
|-|-|-|
| ① | 包解析与结构校验（ZIP 解析失败、包体积超限、成员路径非法、成员缺失、name 超 512 字符、节点总数超 `workflow_max_nodes`、拓扑 / 可达性非法等） | 400 `VALIDATION_ERROR` |
| ② | **名称锚不一致**（见下「名称锚一致性校验」） | 400 `VALIDATION_ERROR` |
| ③ | `kind` 不一致（`manifest.kind` ≠ `"workflow"`） | 400 `VALIDATION_ERROR` |
| ④ | 同名实体已存在 | 409 `WORKFLOW_NAME_EXISTS` |
| ⑤ | Client 缺失 → 409 `CLIENT_NOT_FOUND`；Client 类型不符 → 400 `CLIENT_TYPE_MISMATCH` | 见左 |

**名称锚一致性校验（决策-导入名称锚一致性；D10/D11）**：

- **纳入校验的名称锚（D10）**：① **`manifest.workflow.name` ↔ 根级 `workflow.yaml` 的 `name`**；② **`manifest.ops[].name` ↔ 其 `file` 指向的 `ops/*.yaml` 内的 `name`**（逐条比对）。
- **`file` 仅作定位**（成员必须**真实存在**，缺失 → 400）；**不校验文件名 / 目录名**与实际 `name` 字符串一致，**只校验文件内容的 `name`**。
- 任一项不一致 → **400 `VALIDATION_ERROR`**，**不静默以文件内容为准**；`message` 固定格式（**D11**；**前端原样展示 message，不做解析**）：
  `名称锚不一致：manifest.<锚字段>=<值>，<包内路径> 内 name=<值>`
  （示例：`名称锚不一致：manifest.workflow.name=deploy_workflow，workflow.yaml 内 name=deploy_v2`；`名称锚不一致：manifest.ops[0].name=check_tests，ops/op_check_tests.yaml 内 name=op_check_tests`）
- **`name` 与 `version` 分开对待（G3）**：**`name` 不一致一律拒绝**（上条）；**仅 `version` 为声明参考**，与文件不一致时以文件内容为准（沿用包内值，保真还原）。
- 用户手动修改包内文件 / manifest 后**重新选择文件并重新提交**（前端**不做**内容校验，直接提交 ZIP；见 proposal-01 §8.9）。

**导入重映射与原子性（约定-旧 id 重映射 / 约定-导入原子性）**：

> **旧行内编号对照（已全部改具名）**：`#2` = 旧 id → 新 id 重映射；`#5` = 导入的原子性（单一事务）；`#3` = 全局 waiting 队列上限的适用范围（现行位置：crud-04 3.4.6.1「适用范围（全入口生效）」）。

| 项 | 策略 |
|-|-|
| Workflow 本身 | 同名已存在 → 409 `WORKFLOW_NAME_EXISTS`；否则新建，`version` 沿用包内值（**保真还原**：版本是 `needsUpdate` 快照比对基准且可能被 Job 引用，保真以维持引用一致；对比 Job 导入的重置为 1，见 crud-04 3.4.10）。**名称锚一致性校验见上「名称锚一致性校验」（D10/D11）**；**`name` 不一致一律拒绝（400）；仅 `version` 为声明参考（以文件为准）** |
| 节点 `opName` → `opId` | **按 name 匹配 ops**：不存在 → 按包内 `ops/*.yaml` 创建；已存在 → 复用现有（不覆盖）；节点 `opId` 重写为匹配到的 id；`opVersion` 保留包内快照（复用时若落后由 3.3.10 `needsUpdate` 提示）。**一致性约束（G2）**：① 节点 `opName` 必须能在 `manifest.ops` 中**命中**（未命中 → 400 `VALIDATION_ERROR`）；② `manifest.ops` 的 name 集合与全部节点 `opName` 集合必须**相等**（多出 / 缺少 → 400 `VALIDATION_ERROR`）；③ 每条 `manifest.ops[].name` 必须等于其 `file` 指向文件的 `name`（名称锚，见上） |
| 节点 `clientName` → `clientId` | **按 name 匹配 Client**：存在 → 重写为新 `clientId`；不存在 → **409 `CLIENT_NOT_FOUND`**（Client 为本机在线注册，**不自动创建**）；`clientName` 为空则不校验 |
| `workflowNodeId` | **不沿用导出环境 UUID**：导入时为每个节点重新生成 32 位 UUID，建立 `短别名（n1/n2/…）→ 新UUID` 映射表；随后按映射同步重写 `edges.from` / `edges.to` / `outputs.from.workflowNodeId`。短别名在包内唯一即可，跨环境不保留——与 opId/clientId 导入时重新生成同口径 |
| 原子性 | 整个导入（解析校验 → 创建/复用 OP → 创建 Workflow）在**单一事务**内完成，且为 **`BEGIN IMMEDIATE` 单写事务**（SQLite 单写者串行化 + 名称 `UNIQUE` 约束兜底，见 N9）；任一失败 → **整体回滚**，不产生半成品。**并发同名导入**：`UNIQUE` 冲突映射为 409 `WORKFLOW_NAME_EXISTS`（不映射 500）；**不做去重幂等**，重复导入同名包 → 409 |
| 版本差异告警 | 复用的 OP 版本与包内声明不一致 → 计入响应 `warnings`（导入仍成功） |

> **导入边界与解包安全**：ZIP **包体积上限沿用现有配置项 `op_import_max_bytes`**（crud-06 一；包内主体为 OP YAML，故沿用该键作「同一把尺」，**不新造配置键**），超限 → 400 `VALIDATION_ERROR`；ZIP 成员名必须为**包内相对路径**（拒绝绝对路径、`..`、盘符与反斜杠逃逸；成员数与解压后总大小须有界），违规 → 400 `VALIDATION_ERROR`。

> **包内 `ops/*.yaml` 的字段校验（引 crud-02）**：导入时对包内 `ops/*.yaml` 的每个**新建 OP**按 **crud-02 3.2.8（OP 导入）同一口径**校验——`type` / `content` 缺失或非法、**`timeoutSeconds` 缺失或超范围（范围 1..86400）** → **400 `VALIDATION_ERROR`**（接口层 `timeoutSeconds` **必填**，缺失**不取默认 60**；见 crud-02 3.2.8 / 3.2.6）；同名 OP 已存在则复用现有（不覆盖），复用的 OP 不重跑该 YAML 校验。

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | ZIP 解析失败或字段非法：**name 超 512 字符**、**节点总数超过配置项 `workflow_max_nodes`（见 crud-06 一）**、**`manifest.workflow.name` / `manifest.ops[].name` 名称锚不一致（`message` 按 D11 格式指明位置，用户修改后重新导入）**、**成员缺失**（根级 `workflow.yaml` 或 `manifest.ops[].file` 指向的成员不存在）、**包体积超限（沿用 `op_import_max_bytes`）**、**成员路径非法**、**节点 `opName` 未命中 `manifest.ops` / 集合不相等**、**`manifest.kind` ≠ `"workflow"`**、**节点未绑 `opId`/`opVersion`（规则 9）**、**Start 存在 `on_failure` 出边（规则 16）**、**出参来源无效（规则 18）**、拓扑非法（含连线引用不存在节点）等 |
| 400 | `CLIENT_TYPE_MISMATCH` | 节点 `clientName` 按名匹配到同名 Client 但**类型与其绑定 OP 的类型不符**（导入不复用类型不符的 Client，按 400 处理；显式类型校验口径见 3.3.3 / 3.3.4）；`message` 固定为：`Client 类型与 OP 类型不匹配：OP <opName> 为 <opType>，Client <clientName> 为 <clientType>` |
| 409 | `WORKFLOW_NAME_EXISTS` | 同名 Workflow 已存在（导入冲突） |
| 409 | `CLIENT_NOT_FOUND` | 节点 `clientName` 在目标环境不存在（响应体列出缺失名称） |

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

4. **聚合规则**：`needsUpdate` = 存在任一需更新节点；`outdatedNodes` = 全部需更新节点的 workflowNodeId，按画布拓扑顺序（start → end 方向，同级按 workflowNodeId 稳定排序）返回，保证前端高亮顺序稳定。
5. **边界情况**：仅含 start / end 的骨架 Workflow 无 op 节点 → `needsUpdate=false`、`outdatedNodes=[]`。
6. **伪代码**：

```
function evaluateWorkflowOutdated(workflow):
    outdated = []
    for node in workflow.nodes where node.kind == 'op':
        op = ops.find(node.opId)
        if op is null:
            outdated.push(node.workflowNodeId)          # 悬挂引用（OP 已删除）
        elif node.opVersion != op.version:
            outdated.push(node.workflowNodeId)          # 落后 或 超前
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
| outdatedNodes | string[] | 落后节点的 workflowNodeId 列表 |

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | workflowId 格式非法 |
| 404 | `WORKFLOW_NOT_FOUND` | workflowId 不存在 |

---

### 3.3.11 GET /api/workflows/{workflowId}/outdated-nodes —— 获取需更新节点

**功能说明**：返回所有需更新节点的 workflowNodeId 列表——节点 `opVersion` 落后于 / 超前于 OP 当前 `version`，或 OP 已删除形成悬挂引用，均计入。供前端在画布上高亮提示需要更新的节点。

**与 3.3.10 的关系**：本接口与 3.3.10 共用同一判定内核（见 3.3.10「判定逻辑」1–6 步），本接口返回 `evaluateWorkflowOutdated` 的直接结果；前端仅需节点列表时调用本接口，需同时判断布尔标记时调用 3.3.10（二者计算结果一致）。

**路径参数**：`workflowId`（32 位 UUID，必填）

**查询参数**：无　**请求体**：无

**成功响应 `200 OK`**：

```json
["1b2c3d4e5f60718293a4b5c6d7e8f9a1", "3d4e5f60718293a4b5c6d7e8f9a1b2c3"]
```

**错误响应**：

| 状态码 | code | 场景 |
|-|-|-|
| 400 | `VALIDATION_ERROR` | workflowId 格式非法 |
| 404 | `WORKFLOW_NOT_FOUND` | workflowId 不存在 |

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
  ├─ 1. 校验 workflow: needsUpdate=true → 409 WORKFLOW_NEEDS_UPDATE；显式绑定 clientId 的 op 节点类型不匹配 → 400 CLIENT_TYPE_MISMATCH（同 3.3.3）
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
- 以**事件处理函数 `process_event`（纯函数式推进）**推进 workflow（engine_start / step_completed / walk_edge / workflow_done / terminate，见下方）
- 加载 workflow definition；执行上下文（节点就绪判定、出参累积）由**内存 `RunContext`** 承载，DB（`engine_events` + `step_records`）为唯一事实来源、缓存可随时重建（见 4.3.0 / 4.3.3）
- 以**边状态机**（每条边的 activated / dropped）与 **activation（执行实例）**模型决定下一批可调度节点（见 4.3.0）
- 处理 Start → End 的汇聚（op 节点 AND-join；End 所有入边均已决定且至少一条 activated、并等在飞步骤收敛）、循环回跳（该 step 执行总次数达上限 min(max × 3, max_loop_multiplier)）、超时终止（该 OP 自身 `timeoutSeconds` 到期 → Executor kill 该 OP；Run 停止后续调度、不走边、不重试，**但等其它在跑 OP 自然结束**）、**未接住的失败置 Run failed（V11-B；不 kill 在跑 OP，等收敛后落 job_run failed、terminated_by=error）**、**OP 运行中不可被外部终止（终止 = 停止派发 + 取消 waiting + 等其在跑 OP 跑完）**
- 写入 job_run 的状态流转（终态经全局 `JobComplete` 落库）
- **无常驻循环、无内存信号**：无常驻事件循环线程、无 Inbox / 唤醒信号——**事件写库后立即同步处理（写即处理）**；运行态为**按 run 的内存缓存**（可重建，见 4.3.3）；多 workflow 并发 = 各触发方交错调用 `process_event`，互不干扰

**链式推进（事件驱动，写即处理）**：

Engine 不维护任何循环 / 执行体——推进 = 事件处理函数 **`process_event`**（同步，谁产生事件谁调用，完整展开见下方）：
- **触发者**：`notify` 写库后立即调用（engine_start / terminate）；`StepComplete` 写 `step_completed` 事件后立即调用（step_completed）；
- 每一步都由上一步的完成事件链式触发（StepComplete 写 step_completed 后立即调 process_event 同步推进）——Engine 不需要任何常驻循环 / 执行体 / 唤醒信号。

**事件驱动与调度事件类型（`engine_events.event_type`）**：

Engine 采用**事件驱动 + 调度事件流**：每次"节点完成 → 决定下一步"都产生一条**调度事件**，持久化到 `engine_events` 表，**写库后立即由 `process_event` 同步处理**（不是等循环扫描）。调度过程全量落库，可审计；Engine 崩溃后可恢复重放（App 启动时 `recover` 一次性处理残留的 `processed=0` 事件）。

| event_type | 含义 | 产生者（写库后立即处理） |
|-|-|-|
| `engine_start` | Runner 通知 Engine 开始执行某 workflow（= notify(EngineStart) 持久化）；payload 基础含 inputs / workspace，**定义快照（workflow nodes/edges + op 定义）由 process_event 处理时 UPDATE 进 payload（与处理同事务）** | Runner（调度线程）→ notify 写库后立即 process_event |
| `step_completed` | WorkerPool 回报某节点执行完成（payload 含 activation_seq / retry_seq / 结果） | WorkerPool（Worker 完成后经 StepComplete 钩子写，写后立即 process_event） |
| `apply_retry` | 节点失败/成功且命中 retry 条件，准备重试（payload 含 retry_seq）；**其处理即写 dispatch_step**（同一 activation，retry_seq+1） | Engine（process_event 内部写 + 处理） |
| `walk_edge` | 按结果给各出边置 activated / dropped，推进 DAG（payload 含边状态） | Engine（process_event 内部写 + 处理） |
| `dispatch_step` | 决定调度某节点，派发给 WorkerPool（pending=false 时 payload 含 activation_seq / retry_seq / not_before_ms；pending=true 时 payload **不含四元组**，仅回跳挂起登记） | Engine（process_event 内部写，随后 worker.run_step） |
| `workflow_done` | workflow 结束（payload 含终态 success / failed）：End 所有入边均已决定且至少一条 activated（并等在飞收敛）→ success；无可就绪/挂起且 End 未 activated → failed | Engine（process_event 内部写 + 处理 → 全局 JobComplete） |
| `terminate` | 异常终止（timeout / user terminate = notify(Terminate) 持久化，payload 含 reason） | Engine / 外部 → notify 写库后立即 process_event |

**engine_events.payload 字段级定义（统一表）**：

> 通用列（非 payload）：`event_id`(PK) / `run_id` / `event_type` / `step_id`（相关节点，多数事件非空）/ `step_status`（节点结果，step_completed 类携带）/ `processed` / `created_at_ms` / `processed_at_ms` / `soft_deleted_at_ms`。下方仅列 `payload` JSON 内字段；`step_id` / `step_status` 列与 payload 内同名字段的关系见"备注"列。

| event_type | payload 字段 | 类型 | 必填 | 含义 / 取值 | 备注 |
|-|-|-|-|-|-|
| `engine_start` | `inputs` | object | 是 | Workflow 入参名值对（= JobRun.inputs 透传） | INSERT 时写入 |
| `engine_start` | `workspace` | string | 是 | 执行工作目录 | INSERT 时写入 |
| `engine_start` | `workflow_id` | string | 是 | 启动的 workflow_id | INSERT 时写入 |
| `engine_start` | `definition_snapshot` | object | 处理时补齐 | 定义快照冻结：`{nodes:[...], edges:[...], ops:{op_id:{op_version, body, ...}}}`；首次 process_event 加载当前 workflow 定义后 **UPDATE 进 payload**（同事务），重放时直接复用、不再重载校验 | 崩溃落在 INSERT 与 UPDATE 之间时，重放走首次处理路径重新加载（S1） |
| `engine_start` | `actual_workflow_version` | integer | 处理时补齐 | 实际加载的 workflow 版本（`workflows.version`）；不静默记录 | 与 job_runs.target_version 的口径差见 S2 |
| `engine_start` | `resumeFromRecordId` | string \| null | 否 | **重试续跑种子**：源 Run 的失败/超时 `step_records.record_id`（= `job_runs.retry_from_record_id`）；以该节点为起点续跑（见 4.3.4） | **仅重试路径携带**（notify 入口写入）；普通 Run 的 engine_start 无此字段 |
| `step_completed` | `activation_seq` | integer | 是 | 本次完成的 activation 序号 | 与 step_records.activation_seq 对齐 |
| `step_completed` | `retry_seq` | integer | 是 | 本次完成的 attempt 序号 | 与 step_records.retry_seq 对齐 |
| `step_completed` | `result` | enum | 是 | `success` / `failed` / `timeout` | 与列 `step_status` 同值（列冗余便于索引查询） |
| `step_completed` | `outputs` | object \| null | 否 | 节点出参名值对（成功时） | 源自 step_records.outputs |
| `step_completed` | `error` | string \| null | 否 | 失败原因（failed/timeout 时） | 源自 step_records.error |
| `step_completed` | `exit_code` | integer \| null | 否 | 子进程退出码 | 源自 step_records.exit_code |
| `apply_retry` | `activation_seq` | integer | 是 | 同 step 的 activation（不变） | |
| `apply_retry` | `retry_seq` | integer | 是 | 即将进入的 attempt 序号（= 当前 +1） | 其处理即写 dispatch_step |
| `apply_retry` | `not_before_ms` | string \| null | 否 | 退避后最早可执行时间（毫秒）；无退避则 null | WorkerPool 据此延迟指派 |
| `apply_retry` | `reason` | enum | 是 | `on_failure` / `on_success`（命中的 retry.on 条件；timeout 不走 retry、直接 terminate，故无 `on_timeout`） | |
| `walk_edge` | `result` | enum | 是 | 节点结果（`success` / `failed` / `timeout`），与列 `step_status` 同值 | |
| `walk_edge` | `edges` | array | 是 | 出边判定结果：`[{to: workflow_node_id, condition: "on_success"\|"on_failure"\|"always", state: "activated"\|"dropped"}]` | 边状态审计/重放依据 |
| `walk_edge` | `reentry_targets` | array | 否 | 本次判定出的回跳目标节点 id 列表（已执行过的目标）；用于推导 pending_reentry | |
| `dispatch_step` | `pending` | boolean | 是 | `false`=正常派发（含四元组，将 run_step）；`true`=回跳挂起登记（不含四元组，仅登记 pending_reentry） | |
| `dispatch_step` | `activation_seq` | integer | pending=false 时必填 | 即将执行的 activation 序号 | |
| `dispatch_step` | `retry_seq` | integer | pending=false 时必填 | 即将执行的 attempt 序号 | |
| `dispatch_step` | `not_before_ms` | string \| null | 否 | 最早可执行时间（重试退避）；null=立即 | 落库为 step_records.not_before_ms |
| `dispatch_step` | `inputs` | object | pending=false 时必填 | 解析 bindings 后组装的 OP 入参快照 | |
| `dispatch_step` | `client_id` | string \| null | 否 | 执行 Client（节点级；空则走 Job.target.clientId 回退） | |
| `workflow_done` | `status` | enum | 是 | `success` / `failed` | 决定 job_runs 终态；failed 时 terminated_by=error |
| `workflow_done` | `reason` | string \| null | 否 | 失败原因简述（如 end_not_activated / run_failed / loop_limit） | 审计用 |
| `terminate` | `reason` | enum | 是 | `user_terminate` / `timeout` / `run_failed` / `loop_limit` | 对应 job_runs.terminated_by 的语义来源 |

> **payload 写即完整约定**：`engine_start` / `terminate` 由 notify 入口写库时即写入基础 payload（定义快照除外）；其余事件（step_completed / apply_retry / walk_edge / dispatch_step / workflow_done）在 process_event 调用栈内 INSERT 时 payload 即完整。任何事件处理失败保持 `processed=0`，重放时按上述字段语义幂等处理。

#### 4.3.0 执行模型：activation、边状态机与 reducer（内存 RunContext）

> Engine 全程**无常驻循环**。为保证「崩溃重放幂等」与「循环回跳可重入」同时成立：**DB（`step_records` 事实 + `engine_events` 信号）为唯一事实来源**；推进在**可重建的内存 `RunContext`** 上进行（读写缓存 + 落库，见 4.3.3），`process_event` 是**纯函数式推进**（相同状态 + 相同事件 → 相同结果）：
>
> ```text
> process_event(event) -> Result<()>   # 按 run 串行；失败时事件保持 processed=0 可重放
> state  = RunContext(run_id)          # 内存缓存，可由 DB(engine_events + step_records) 重放重建
> state' = reduce(state, event); 落库(新事件 + 运行态)
> ```
>
> 由此派生出两个核心概念（贯穿 4.3、4.4 与第 15 章循环场景）：

**① activation（执行实例）与计数**

同一 step 在一次 Run 内可能被执行多次：**重试（retry）** 与循环回跳导致的**重入（activation）**。二者语义不同，必须分开计数（对应列见 `schema.sql` 第 7 节）：

| 概念 | 定义 | 递增时机 |
|-|-|-|
| `activation_seq` | 该 step 在本次 Run 内的第几次「激活」 | 首次 dispatch = 1；**循环回跳**重新激活同一节点时 +1；节点内部重试**不**递增 |
| `retry_seq` | 同一个 activation 内的第几次尝试（**含首次**） | 首次 = 1；每次 `apply_retry` +1 |

- **本轮尝试计数** = 同一 `(run_id, step_id, activation_seq)` 下的记录数（**首次执行计入**；用于 `apply_retry` 的 `max` 判定，见 4.3.2）。
- **回跳后重试计数重置** = 进入新 activation（`activation_seq+1`），retry_seq 从 1 重新开始（与第 15 章「每轮回跳后重试计数重置」一致）。
- **循环终止**：同一 `(run_id, step_id)` 的**执行总次数**（= 该 step 的 `step_records` 记录数，即所有 activation × attempt 之和；等价于 dispatch_step 事件数）达到**上限**即整个 Run 失败。
  **上限 = `min(max × 3, max_loop_multiplier)`**，其中 `max = retry.max`（节点未配置 retry 时取 1）；`max_loop_multiplier` 为配置项可配的绝对上限（见 crud-06 一；**`0`/未设置 = 不施加绝对上限、仍受 `max × 3` 约束**，不是无限）。未配置（`0`）时上限即 `max × 3`（= 配置的 `retry.max` 的 3 倍，max=3 → 9，与第 15 章「3 × 3 = 9」一致）。
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
- **在飞计数**：RunContext 维护 `inflight_count`（running + waiting 步骤数）；**均在 process_event 内（持 run 锁）维护**：处理 `dispatch_step` 时 +1；处理 `step_completed`（读到终态）时 -1；**terminate 将 waiting 置 cancelled 时亦 -1**。**收敛判定以 `step_records` 实际状态为准（无 running / waiting）**；`inflight_count` 仅作 O(1) 快速通道，不一致时回退查询实际状态（AA8）。
- **收敛判定口径（AA7/AA8）**：收敛 = 该 run 在 `step_records` 中**无 running / waiting**（`inflight_count` 仅作 O(1) 快速通道，不一致时回退查询）。「挂起候选」在**正常推进**下 = `pending_reentry` + **已由 walk_edge 评估但入边未全决定**的节点；**一旦置 `run_terminate_requested` / `run_failed`（停止 walk_edge）→ 清空 `pending_reentry` 并不再计入挂起候选，未决定入边也不计入**（否则永远不会收敛，BB4）。
- **Start 的出边**：Start 无失败语义 → 其出边**恒为 `on_success` / `always`**；`on_failure` 出边不允许（校验拒绝，见 3.3 校验规则）。
- **到达语义（失败传播 + End 到达，V11-B）**：
  1. **未接住的失败 → 置 Run 终态意向为 failed（不 abort 在飞）**：任一 op 节点 `failed` 且其**所有出边均未被激活**（无 `on_failure` / `always` 路由）→ 置 `RunContext.run_failed = true`，**不 kill 正在运行的步骤**；**等所有在飞（running/waiting）步骤自然收敛后**，写 `workflow_done(failed)`（job_run 终态 failed、`terminated_by=error`）。
  1b. **终止 / 失败的停派发约束（Z）**：`run_terminate_requested` / `run_failed` 置位后，in-flight 完成的 `step_completed` **一律跳过 `pending_reentry` 消费与决策链 ②③（不重入、不重试、不 dispatch）**，仅做收敛判定；**并清空 `pending_reentry`（不再回跳重入，BB4）**。
  2. **终态优先级（Z3）**：`run_terminate_requested`（cancelled / timeout）**优先于** `run_failed`（failed）；两者均置时落 cancelled / timeout。
  → 因此「并行分支 A 失败且无失败出边、B 成功到 End」→ 整体 **failed**（等其余在飞跑完再落终态）；若 A 的失败被 `on_failure`/`always` 边接住，则不置 failed、按该边继续。
  ※ **OP 是最小执行单位：运行中一律不 kill**——无论失败传播、用户终止还是超时（唯一 kill = 该 OP 自身 `timeoutSeconds` 到期，**自子进程实际启动（spawn）起算，排队与准备时长不计入**；Executor 内部按进程组处理）。终止 / 超时均只「停止派发 + 取消 waiting + 等在跑 OP 收敛」。

**③ 回跳边（back edge）**

walk_edge 对被激活边的目标节点判定：若该节点**在本次 Run 内已执行过**，则该边为**回跳边**，目标以 `activation_seq + 1` 重新激活（重试计数随之重置）；否则为普通过边，`activation_seq = 1`。无需在 `edges` 数据里额外标记回跳，由「目标节点是否已执行过」推导。

**「已执行过」判定与并行约束**：存在该 `(run_id, step_id)` 的**任一 activation 记录**（含 waiting / running / done）即视为已执行过；且**回跳前必须等上一 activation 收敛**（无 running / waiting 记录），否则挂起——同一节点的多个 activation **串行，不并行**。

**回跳挂起的唤醒机制（N1）**：挂起的回跳登记为 RunContext 的 `pending_reentry[N]`（对应一条 `dispatch_step{pending=true}` 事件，可重放重建）；当 **N 自身 step_completed 处理**时，先消费该登记并重入（activation_seq+1）。因此 walk_edge 不仅评估「完成节点的出边」，还需在**目标节点上有 pending_reentry 时由该节点自身的 step_completed 唤醒**——两者共同保证「N 收敛后重入 N 必被触发」，不会卡死。

**多源回跳合并（Q4）**：`pending_reentry[N]` 为**布尔标记（合并）**——N 未收敛期间多条回跳边（A→N、B→N）合并为**一次**重入（一轮即可满足全部回跳边，AND-join 语义）。若需要「每条回跳边各重入一次」需改为计数——当前设计取合并。

**Engine 事件处理函数 `process_event`（写即处理，同步）**：

```text
process_event(event)  # 同步；按 run 串行（见 4.3.3）。
 # 前置写：事件 append（processed=0）已提交；处理阶段（本函数）读写内存 RunContext + 落库，
 # 成功后将本事件置 processed=1（与处理同事务）；失败则保持 processed=0 供 recover 重放。
 # 同一状态 + 同一事件 → 相同结果（幂等），故重放安全。
  ├─ engine_start{run, workflow_id[, resumeFromRecordId]}                 ← notify(EngineStart) 写库后立即调用
  │     → **首次处理时**加载 **当前 workflow 定义**（定义快照在此刻冻结），将定义快照（nodes/edges + 各 op 节点 OP 定义含正文）**UPDATE 进 engine_start 事件 payload**（与处理同事务）冻结进 RunContext（此后定义 / OP 变更不影响本 Run）；若 `node.op_version != 当前 ops.version` → **正常路径置 Run failed**（置 `run_failed=true`，**不 abort 在飞**；等在飞收敛后落 `workflow_done(failed)`，processed=1，不返回 Err，见 Q5/W7）；**重放 engine_start 时直接用 payload 快照，不再重新加载 / 校验**（Q1）；**若 payload 不含定义快照（崩溃落在 INSERT 与 UPDATE 之间，S1）→ 回退首次处理路径（加载定义 + 校验 + UPDATE payload）**——**起点仍由 payload 内 `resumeFromRecordId` 决定**（不含该字段但 `job_runs.retry_from_record_id` 非空 → 从该列重建种子），仅当两者皆无时才等价于从头启动
  │       ※ **target_version 口径（S2）**：`workflows` 表无版本历史，`job_runs.target_version` 仅用于 execute 校验与运行历史展示；定义以 **engine_start 处理时加载的当前定义**为准，并在事件 payload 记录 `actual_workflow_version`（不静默）；触发→engine_start 窗口极小（调度延迟）
  │       ※ **加载定义失败的区分（V4，同 U8 口径）**：瞬时 DB 错误 → 返回 Err（交 T26 重试 / 重放）；**定义损坏 / JSON 解析失败 / workflow 不存在等确定性错误 → 置 Run failed（`run_failed=true`，不 abort 在飞；等收敛后落 `workflow_done(failed)`，processed=1）走正常失败路径**，不返回 Err（避免永久卡 running）
  │     → **起点判定（D6）**：若 payload **含 `resumeFromRecordId`**（重试续跑种子，见 4.3.4）→ 以该 StepRecord 对应节点为起点（其全部前置节点**视为已完成**，**不写入新 Run 的 `step_records`**），**跳过「一律从 Start 起步」**，初始上下文取**源 Run 完成节点的出参快照**，直接对该节点 dispatch（activation_seq=1、retry_seq=1；**并按 4.3.4② 初始化边状态初值**：全边 `pending` → 前缀节点集出边复制源 Run 终态 → 种子节点入边置 `activated` → 不可达闭包递归置 `dropped` → dispatch）；**仅当 payload 不含 `resumeFromRecordId`** 时才从 Start 起步（下条）：
  │     → 直接推进第一步：对 Start 的出边置 activated → 走就绪规则 dispatch 后继节点
  │       （写 dispatch_step{node, activation_seq=1, retry_seq=1} → worker.run_step，只入队不阻塞）
  ├─ step_completed{run, step, activation_seq, retry_seq, result}   ← StepComplete 钩子写库后立即调用
  │     → 读取 step_records 该次执行终态（**终态由 Worker 执行完写入**；此处据此推进；缺失时补写，**纯防御**：正常终态由 Worker 写、recover 补齐的是“终态已有、事件缺失”）
  │     → **若已置 `run_terminate_requested` / `run_failed`（Z）**：**跳过 `pending_reentry` 消费与决策链 ②③（不重入、不重试、不 dispatch 任何新执行）**，仅做收敛判定（见 ②）
  │     → 否则若存在 `pending_reentry[step]`：消费之（**消费前先查执行总次数上限 min(max×3, max_loop_multiplier)：已达则不再重入、整个 Run 失败**）→ activation_seq+1, retry_seq=1 → dispatch 重入 N；**本次完成不再走决策链**（不 retry、不走边；N 的出边留待重入的那次完成时再走，见 4.3.0 ③）
  │     → 否则进入固定决策链（次序不可换，见下方「step_completed 决策链」）：
  │           ① 超时 / 用户终止 → 写 terminate（不走边、不重试）
  │           ② 若将再次执行同一节点（重试/回跳）且该步执行总次数达上限 min(max×3, max_loop_multiplier) → 写 terminate（整个 Run 失败，循环上限）
  │           ③ 命中重试条件（见 4.3.2）→ 写 apply_retry（**其处理即写 dispatch_step**，同一 activation，retry_seq+1）
  │           ④ 否则 → 写 walk_edge → 继续处理 walk_edge
  ├─ walk_edge{run, step, result}
  │     → **若已置 `run_terminate_requested` / `run_failed`（BB5）→ 置边状态仍照常执行（activated / dropped 反映实际结果，审计完整）；仅跳过下方「目标节点循环」中的 dispatch 与 pending_reentry 登记，直接收敛判定**
  │     → 对**该 step 的每条出边**判定 condition → 置边状态 activated / dropped（见 4.3.1、4.3.0 ②）
  │     → 对每个 activated 边的目标节点 N:
  │           if N 的所有入边均已「决定」(activated|dropped):
  │                 if 存在 activated 入边:
  │                       若 N 为 End（kind=end）→ **不 dispatch**（End 不产生执行、不落 step_record），直接进入「到达 End → 收敛判定」
  │                       若 N 已执行过 → 回跳边: 若 N 上一 activation **未收敛**（存在 running/waiting）→ 记 `pending_reentry[N]`（**先查执行总次数上限：已达则不登记、整个 Run 失败**；否则写 dispatch_step{pending=true}，不 run_step，挂起）；否则 activation_seq(N)+1, retry_seq=1 → dispatch（若 N 执行总次数已达上限 min(max×3, max_loop_multiplier) → 不重入, 整个 Run 失败）
  │                       否则          → activation_seq(N)=1, retry_seq=1
  │                       写 dispatch_step{N, activation_seq} → worker.run_step（只入队，不阻塞）
  │                 else: N 无 activated 入边 → 视为 skipped（不产生 step_record）
  │           else:
  │                 挂起: 等 N 其余入边的源节点 step_completed 到达后再判（AND-join 依赖就绪）
  │     → **① 先判未接住的失败（V11-B）**：若本步结果=failed 且无任何 activated 出边（无 on_failure / always 路由）→ 置 `run_failed=true`（**不 abort 在飞**），继续到 ②
  │     → **② 到达 / 收敛**：无在飞（**以 `step_records` 实际状态为准：无 running/waiting**；`inflight_count` 仅 O(1) 快速通道）且无挂起候选（**pending_reentry + 正常推进下已评估未就绪节点；终止/失败置位后不再计未决定入边**，AA7）时判终态——**先看终止意图：若已置 `run_terminate_requested` → 落 cancelled / timeout（终止优先，Z3）**；否则 `run_failed=true` → workflow_done(failed)；否则 End 所有入边决定 + ≥1 activated → workflow_done(success)；End 未 activated → workflow_done(failed)。`run_terminate_requested` 置位后不再 dispatch 后继，仅等在跑 OP 收敛
  ├─ dispatch_step{pending?}
  │     → 若 `pending=true`（回跳挂起登记）：**不参与查重、不 run_step**（payload **不含四元组**，登记时 N 下一 activation 未定）；仅登记 `RunContext.pending_reentry[node]`；**重建时恒登记（布尔标记，重复登记无害）**（T13）
  │     → 否则（pending=false）：**先按 (run_id, step_id, activation_seq, retry_seq) 查重 step_records：已存在任何状态（含 waiting/running）的记录 → 跳过（仅置 processed=1）**——防重放重复入队（S8）；否则 worker.run_step（见 4.4，**总是入 DB 排队、不因池满报错**）→ 完成后经 StepComplete 钩子写 step_completed 并立即 process_event
  ├─ workflow_done{run, status}
  │     → 调用全局 JobComplete（更新 job_runs 终态，落库）:
  │           → 更新 job_run 终态 (success / failed) + duration_ms（落库），刷新界面
  │           → Runner 常驻轮询自动感知并调度下一个
  └─ terminate{run, reason}                         ← notify(Terminate) 写库后立即调用
        → **不 kill 任何正在运行的 OP**（OP 是最小执行单位，运行中不可外部终止；唯一 kill = 该 OP 自身 `timeoutSeconds` 到期，由 Executor 内部处理）
        → 置 `run_terminate_requested=reason`（停调度）：**不再派发新步骤**、取消待调度节点
        → 将该 run 仍在 waiting 的步骤置 cancelled（条件更新 `UPDATE … SET status='cancelled' WHERE run_id=? AND status='waiting'`；**并对每个被置 cancelled 的 waiting 步骤递减 `inflight_count`**，AA8）
        → **清空 `RunContext.pending_reentry`**（不再回跳重入，BB4）
        → **若存在在跑 OP → 先置 job_run.status = terminating（等待终止）落库**（界面显示"终止中"；不再派发新步骤）
        → **等在跑的 OP 自然跑完后**，再调用全局 JobComplete（更新 job_runs 终态，落库）:
              → 更新 job_run 终态 (cancelled / timeout / failed)（落库）
              → Runner 常驻轮询自动感知并调度下一个
        ※ 单 OP 的 Job：OP 一旦开始运行即**不可终止**（无可停止的后续调度）——终止请求被拒（见 crud-05 4.7）
**step_completed 决策链（次序不可换）**：
  ① 结果 = timeout / 用户终止 → terminate（不走边、不重试）
  ② 若本次结果将触发**再次执行同一节点**（重试或回跳重入）且该 step 执行总次数已达上限 min(max×3, max_loop_multiplier) → terminate（Run 失败，循环上限）
  ③ should_retry（on 匹配 + 本 activation 的 attempt 未达 max）→ apply_retry + dispatch_step（同一 activation）
  ④ 否则 → walk_edge
异常路径:
  ├─ timeout: status=timeout
  ├─ user terminate: 置终止意图 + **waiting 中（排队中）的 step 直接置 cancelled** + job_run→terminating，等在跑 OP 收敛 → status=cancelled
  └─ 节点失败且无失败边可达 End: failed（**V11-B：任一 op failed 且无任何 activated 出边 → 立即整体 failed，不等其它分支**）
更新 job_run 终态 + duration_ms, 刷新界面状态
※ 处理中产生的后续事件（apply_retry / walk_edge / dispatch_step / workflow_done）在同一调用栈内
     **写一条、处理一条**（同步链式），不回队列、不等待；
     workflow_done / terminate 终态经全局 JobComplete 落库（事件持久化 + 单例重启重建，重放幂等），
     job_run 不会卡在 running。
```

**process_event 入口规则（幂等）**：
- **无缓存 run（R3）**：process_event 首次接触某 run 且内存 RunContext 不存在时，**按需从 DB（`engine_events` + `step_records`）重建**再做处理——因此 init 顺序（`WorkerPool.recover_running` → `Engine.recover` → `Runner.start`）下，重跑步骤完成触发的 StepComplete 回调也自洽（即便 `Engine.recover` 尚未执行，按需重建即可）。
- 若该 run 的 `job_runs.status` 已是终态（success / failed / cancelled / timeout）→ **直接置本事件 processed=1 返回**，不再进决策链（避免终止后被终止步骤的 `step_completed` 再次触发 terminate / JobComplete）。
- 处理阶段内产生的后续事件（apply_retry / walk_edge / dispatch_step / workflow_done）在本调用栈内继续 process_event；**其中 apply_retry 的处理即写 dispatch_step**（见事件表）。

**派发前组装 ExecuteRequest（Engine）**：`dispatch_step` 前由 Engine 构造 ExecuteRequest：遍历 `node.bindings` 解析 `inputs`（`node_output` → 上游节点出参（RunContext / step_records.outputs）；`workflow_input` → RunContext 入参；`literal` → 值）；`clientId` 取 `node.clientId`（空则回退 `Job.target.clientId`——**Job 顶层不设 clientId（Client 为 OP 专有）**，该回退仅当 Job target=op 时存在；仍空则报错）；`op` **取 RunContext 中该节点已快照的 OP 定义**（engine_start 时按 `node.op_version` 快照，含正文），正文写 `step_records.body_snapshot`；连同 `run_id` / `step_id` / `activation_seq` / `retry_seq` / `workspace` 组成 ExecuteRequest（见 crud-01 5.1）。**Engine 不另建 OP 历史版本表**：op 定义随 workflow 定义在 engine_start 一并快照冻结，运行期 OP 更新 / 删除不影响本 Run。**组装失败属确定性数据错误（clientId 缺失 / op 快照缺失 / 定义非法）→ 正常失败路径：置 `run_failed=true`（不 abort 在飞，等收敛后落 `workflow_done(failed)`，processed=1），不返回 Err**（U8/W7）。

**状态机**：
- 节点级（`step_records.status`）：`waiting → running → success/failed/timeout/cancelled`（cancelled = 被终止/取消）。同一节点**重试**重入 running（同 activation，`retry_seq+1`）；**循环回跳**开启新 activation（`activation_seq+1`，`retry_seq` 重置为 1）。
- workflow 级（`job_runs.status`）：`waiting → running → terminating（已提交终止、等在跑 OP 收敛）→ cancelled`；正常路径 `running → success/failed/timeout`。
- 节点的「执行到第几次」不靠内存：由 `(run_id, step_id, activation_seq, retry_seq)` 唯一定位（见 `schema.sql` 第 7 节）。
- `engine_events` 忠实记录每次状态迁移与调度决策（含 activation_seq / retry_seq / 边状态），是 Engine 调度过程的**唯一事实来源**（表结构见 `schema.sql` 第 8 节）；运行态热路径为内存 `RunContext`，可选 checkpoint 表 `run_node_state` 见第 9 节、4.3.3。

**engine_events 数据生命周期**：

Engine 只管理 workflow 从**开始执行到结束执行**这一段：已完成的终态体现在运行历史（crud-05），未开始的"等待中"状态与触发也由运行历史管理——引擎侧都不保留这两类数据。

| 场景 | 处理 |
|-|-|
| **成功完成**（`workflow_done`，job_run=success） | 完成即**物理删除**该 run 的全部 `engine_events`（状态已入运行历史，引擎不再需要）；若启用可选 checkpoint 表 `run_node_state`，一并删除 |
| **执行失败**（某 step 失败导致整体 failed/timeout/cancelled） | **保留**（可能重试）；最终不重试 → **`engine_event_retention_days` 天后软删除**（置 `soft_deleted_at_ms`）→ **再 1 天后物理删除**（见 crud-06 一）；可选 checkpoint 表同生命周期一并清理 |

- 软删除保留一段窗口便于诊断 / 恢复；物理删除彻底清理，避免 `engine_events` 无限膨胀。

**Runner → Engine 通知机制（消息即事件，写即处理）**：

Runner 与 Engine 是并行的后台任务。**notify 不投内存 inbox、不发任何信号**——`EngineStart` / `Terminate` 作为事件**先写 `engine_events` 表**，写库成功后**立即同步调用 `process_event` 处理该事件**（engine_start → 派发首个 OP），处理完成才返回：

```text
Task Runner 调度线程（生产者）:
  └─ 取出 workflow 任务 → job_run 置 running
        └─ engine.notify(EngineStart{run_id, workflow_id, inputs, workspace})   # 实例方法 &self
              ├─ 1. INSERT engine_events(event_type=engine_start, run_id, payload={inputs, workspace}, processed=0)   # 先落库（基础 payload；定义快照由 process_event 处理时 UPDATE 进 payload，同事务）
              ├─ 2. 立即 process_event(engine_start)（同步，当前线程）
              │       → 找第一个就绪节点 → 写 dispatch_step → worker.run_step（**总是入 DB 排队**）→ 首个 OP 进入 step_records waiting，由 WorkerPool 调度线程指派空闲 Worker
              │       （若只落库不处理，engine_start 无人消费、调度不起来——所以必须写后立即处理）
              ├─ 3. 处理完成 → 返回（Result::Ok）→ Runner 继续调度下一个任务
              └─ 写库失败（Result::Err）→ Runner 将该 job_run 置 failed（或回滚 waiting），不静默丢失
      ※ Terminate 同理: 终止接口 → engine.notify(Terminate{run_id, reason})
           → INSERT engine_events(event_type=terminate, payload={reason}) → 立即 process_event(terminate) → 返回
```

> **处理失败语义（两阶段）**：事件先提交（processed=0）再处理（处理阶段单事务，含后续事件 + 运行态 + 置本事件 processed=1）。处理阶段失败 → 本事件**保持 processed=0**、可被 `recover` 重放（幂等）；调用方据此兜底：`notify` 返回 Err → Runner 置 job_run failed / 回滚；`StepComplete` 失败 → 留 processed=0 待 recover。**内存一致性**：处理失败 → **丢弃该 run 的内存 `RunContext`**（下次从 DB 重建），杜绝脏缓存。
>
> **运行中兜底（T26）**：`recover` 只在 App 启动跑一次；为避免运行中 process_event 失败后卡到重启——**处理失败后调用方立即重试一次**（幂等）；仍失败则事件保持 processed=0，由 **Runner 常驻轮询线程**（已存在，固定间隔）**顺带扫描 `engine_events WHERE processed=0 且所属 run 仍 running`，按序逐个 process_event（幂等）**——不依赖重启 recover，run 不会卡死。
>
> **确定性失败 vs 瞬时失败（U8）**：仅**瞬时 DB 错误**返回 Err（交 T26 重试 / 重放）；**确定性数据错误**（组装 ExecuteRequest 时 clientId 缺失、op 快照缺失、定义非法等）→ **走正常失败路径：写 terminate / failed 事件（processed=1）**，避免被无限重放（与 Q5 版本漂移口径一致）。
>
> **StepComplete 写事件失败的兜底（U13）**：Worker 已写终态但 `StepComplete` **INSERT step_completed 失败**（事件未落库、无 processed=0 可扫）→ **立即重试一次**（幂等）；仍失败则交由 **Runner 常驻轮询的「运行中事件补齐」**：扫描 running run 的 `step_records` 中「已有终态但缺对应 step_completed 事件」的记录，**补写并 process_event**（与 recover 的事件补齐同内核、幂等）。

**Engine 收到通知后怎么跑起来**：
- Engine **没有常驻线程**：不依赖内存 inbox、不靠消息在内存传递、无唤醒信号。`notify` 在**调用方线程内**完成「写事件 + 立即处理」——`engine_start` 被同步处理：找第一个就绪节点、写 dispatch_step、调 `worker.run_step(req, inst)`（只插 step_records waiting 记录、不阻塞），然后返回，Runner 继续调度下一个任务。
- 此后的推进由 **WorkerPool 的完成事件**驱动：Worker 执行完某 OP → 同步调 `StepComplete` 钩子 → 钩子写 `step_completed` 事件 → **立即调 `engine.process_event(step_completed)`** 链式推进下一步（更新终态 / retry / walk_edge / 派发后继）——**没有事件循环、没有 per-run 调度循环**，DAG 推进全在 `process_event` 调用栈内完成（见上方）。
- **并发**：多个 workflow 同时执行时，不同 workflow 的事件由不同触发线程（Runner 调度线程、各 Worker 线程）交错调用 `process_event` 处理，天然并行、互不干扰；无需为任何 workflow 维护执行体。

**事件持久化与恢复**：

| 对象 | 形态 | 持久化方式 | 重启后如何恢复 |
|-|-|-|-|
| **notify 投递的消息**（EngineStart / Terminate） | 事件写库 | `notify(msg)` = **INSERT engine_events**（engine_start / terminate，payload 承载 inputs / workspace / reason，processed=0）→ **立即同步 process_event 处理** → 返回；内存不存消息本体 | 事件在 `engine_events` 中（processed=0），启动时由 `Engine::recover` 一次性处理——**投递不丢** |
| **推进中的事件**（dispatch_step / walk_edge / apply_retry / workflow_done） | 事件写库 | 两阶段：① 事件 append（processed=0）提交；② 处理（单事务：后续事件 + 运行态 + 置本事件 processed=1）。**处理失败 → 本事件保持 processed=0**，可重放；崩溃窗口 = ①已提交、②未完成 | 残留 processed=0 事件由 recover 按序逐个 process_event（dispatch_step 重派、walk_edge 重走，**幂等**——当前 activation 已有终态记录则不重复执行） |
| **事件循环 / 唤醒信号** | **已取消** | 无——推进 = 事件写库后立即同步处理（写即处理），不依赖任何内存状态 | 无需重建——没有需要恢复的线程 / 信号 |
| **per-run 调度循环** | **已取消**（无内存执行体） | 当前推进到哪 = `engine_events` 未消费事件 + `step_records` 已完成节点，天然可重建 | recover 一次性处理残留事件即恢复，之后无任何常驻循环 |

- **恢复闭环（workflow 执行中 App 重启）**：
  0. **重建 RunContext**：`Engine::recover` 对每个 running run，优先读可选 checkpoint 快照（`run_node_state`），缺失则**重放该 run 的全部 `engine_events` + `step_records`** 重建内存 RunContext（可重复、确定）；**engine_start 重放若 payload 已含定义快照则直接用（不再重新加载 / 校验）；若不含（S1 窗口）则回退首次处理路径（加载定义 + 校验 + UPDATE payload）——**起点仍由 payload 内 `resumeFromRecordId` 决定**（若 payload 亦不含该字段但 `job_runs.retry_from_record_id` 非空 → 按 0b 从该列重建种子），仅当两者皆无时才「等价从头启动」**；
  0b. **缺失 engine_start 的处理（Q2）**：若某 running run 在 `engine_events` 中**无 engine_start 事件**（崩溃落在「Runner 置 running」与「notify 写 engine_start」之间）→ recover **用当前定义补写 engine_start（含定义快照）并处理**（该 run 尚无 step 执行，等于从头启动）；**不会永久卡在 running**；**补写 `engine_start` 时必须同时从 `job_runs.retry_from_record_id` 反查续跑种子**（该列在 `notify` 之前已落库）——若该列非空，payload 一并写入 `resumeFromRecordId`（并按 4.3.4② 重建边状态初值），**起点仍由 `resumeFromRecordId` 决定**（不得退化为从头执行）；**仅当该列为 NULL 时**才视为普通 Run 从头启动；
  1. Runner（常驻轮询）重启后扫 DB：该 job_run 仍 running，且 `engine_events` 中该 run 的事件（engine_start / step_completed 等）一条未丢；
  2. **事件补齐（以 step_records 终态为准）**：`Engine::recover` 启动时扫描该 run 的 step_records，若存在"已有终态（success/failed/timeout）但缺少对应 step_completed 事件"的节点——即崩溃恰好落在"WorkerPool 已写终态、事件尚未写入"的窗口——则**补写该 step_completed 事件**（写前按 run_id + step_id + activation_seq + retry_seq 查重，幂等），确保"事实（step_records）与信号（engine_events）"在任何崩溃窗口下都对齐；
  3. `Engine::recover` **按序逐个调用 process_event 处理残留的 processed=0 事件**（一次性，处理完即结束、不启动任何循环线程；dispatch_step 重派、walk_edge 重走，**幂等**——当前 activation（run_id + step_id + activation_seq + retry_seq）**已有任何状态记录（含 waiting/running）则不重复 dispatch**（S8））；
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
    /// 存储句柄（DB 连接/仓库）：notify 写事件、process_event 读写事件与内存 RunContext（可选快照至 run_node_state）、recover 扫 running 记录共用
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
/// 完成回调 trait：入参统一为 ExecuteResult（含 run_id / step_id / activation_seq / retry_seq；无需再查库拆 stepId）。
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

/// 全局实现（static STEP_COMPLETE）：workflow 步骤完成 → 直接用 result 携带的 step_id / activation_seq / retry_seq，
/// 写 engine_events: step_completed{run_id, step_id, result}（processed=0），
/// **写后立即同步调用全局 ENGINE.process_event(step_completed) 推进 DAG**（无事件循环，写即处理）。
/// 全局单例天然可互引，无需 Weak / 回填。
pub struct StepComplete;
impl OnComplete for StepComplete {
    fn on_complete(&self, result: ExecuteResult) {
        // ExecuteResult 直接携带 run_id / step_id / activation_seq / retry_seq（无需再查库）
        // 1. 写 step_completed{run_id, step_id, activation_seq, retry_seq, result} 事件（落库，processed=0）
        // 2. ENGINE.get().unwrap().process_event(step_completed{...});
    }
}
```**Engine ↔ WorkerPool 协作时序**：

> **核心思想**：Engine 负责"下一步该执行谁"，WorkerPool 负责"把当前这步跑完，然后告诉 Engine 结果"。两者通过**调度事件流（`engine_events` 表，见 schema.sql 第 8 节）**通信，**事件写库后立即同步处理**（写即处理），事件驱动推进 workflow。

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
     │ ←── step_completed{run, step, activation_seq, retry_seq, result} ──│
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
            若 N 为 End（kind=end）→ **不 dispatch**（End 不产生执行），进入「到达 End → 收敛判定」
            若 N 已执行过 → 回跳边: 若 N 上一 activation 未收敛（存在 running/waiting）→ 记 `pending_reentry[N]`（**先查执行总次数上限：已达则不登记、整个 Run 失败**；否则写 dispatch_step{pending=true}，不 run_step）；否则 activation_seq(N)+1, retry_seq=1 → dispatch（若执行总次数已达上限 min(max×3, max_loop_multiplier) → 不重入, 整个 Run 失败）
            否则          → activation_seq(N)=1, retry_seq=1
            写 dispatch_step{N, activation_seq} → worker.run_step   # 只入队, 不阻塞
        else:
            记 N = skipped, 不产生执行                # 全部入边 dropped
            对 N 的所有出边置 dropped, 递归评估其后继   # skipped 传播, 避免下游死等
    else:
        挂起: 等 N 其余入边的源节点 step_completed 到达后再判   # AND-join 依赖就绪
 到达 End: 所有入边均已决定 (activated|dropped) 且至少一条 activated 且无在飞 (running/waiting) 步骤 → 写 workflow_done(success)
 无可就绪节点且无挂起候选但 End 未 activated → 写 workflow_done(failed)（收敛为失败；**挂起候选：正常推进下 = pending_reentry + 已评估未就绪；终止/失败置位后仅看 step_records 无 running/waiting，未决定入边不计，AA7/AA8**）
```

**第三步：未接住的失败 → 置 Run failed（等收敛，不 abort）（V11-B）**

> **评估次序（W6/BB5）**：本步在「到达 End / 收敛」前评估，**只置 `run_failed` 标记（不立即落终态、不 abort）**，待无在飞时由 ② 收敛判定统一落 `workflow_done(failed)`；且它属「目标节点循环」中的 dispatch 动作——**若已置 `run_terminate_requested` / `run_failed` → 置边状态仍照常、但跳过 dispatch 与 pending_reentry 登记**。

```text
若 完成节点结果 = failed 且 无任何 activated 出边（无 on_failure / always 路由）：
    → 置 RunContext.run_failed = true（不 kill 在飞步骤）
收敛：无在飞 且 无挂起候选时 → 若 run_failed → workflow_done(failed)（job_run failed、terminated_by=error）
```

> `workflow_done(failed)` 为**真实可达**（非仅防御性）：例如 End 仅经某节点的 `on_success` 边可达，而该节点失败、其失败又无通往 End 的路径 → 该节点所有出边 dropped → skipped 传播至 End 全部入边 dropped → 收敛为 failed。

#### 4.3.2 apply_retry 重试判定

节点失败且配置了 retry 时，Engine 在走边前先判定是否重试（重试则 `apply_retry` + `dispatch_step` 重新入队**同一 activation**，`retry_seq+1`，不走边）。所有计数均取自 `step_records`（见 4.3.0 ①），不依赖内存：

> **`max` 语义（D1 拍板）**：`max` = **每轮尝试次数**（**首次执行计入**）——`retry.max=3` → 每轮最多 3 次尝试（`retry_seq` 1/2/3），回跳后重置再计；回跳总上限 `min(max × 3, max_loop_multiplier)` 不变（见 4.3.0 ①）。
>
> 说明：本判定按 `NodeRetry.on` 与结果匹配触发；下文以 `failed` 为例，`on=success` 时对**成功**结果同样判定重试。

```text
节点 op 执行结果 = failed（timeout / 用户终止不走此判定, 直接 terminate）
  │
  ├─ 节点未配置 retry → 走边
  │
  └─ 配置了 retry:
        ├─ 即将重试且该 (run_id, step_id) 的执行总次数 >= 上限 min(max × 3, max_loop_multiplier)（max_loop_multiplier=0 时 = max × 3, 见 4.3.0 ①） → 不再重试, 整个 Run 失败（循环上限）
        ├─ on 与结果不匹配（如 on=success）→ 不重试, 走边
        ├─ 本 activation 的尝试次数已达 max（同 (run,step,activation_seq) 记录数 >= max，**首次执行计入**）→ 不重试, 走边
        └─ 按 backoff 计算退避间隔 → 写 apply_retry（**处理即写 dispatch_step**）（同一 activation, retry_seq+1; not_before_ms = now + interval, 不阻塞）
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

- 实现：Engine 内 `HashMap<run_id, Arc<Mutex<RunContext>>>`（或 DashMap），每个 run 一把锁；
- **临界区仅「处理阶段」**（读缓存 + 落库，毫米级，不做子进程 / 长 IO）；
- 调用方（`notify` / `StepComplete`）在锁上等待至处理完成（同步返回）；
- 不同 run 的 context 相互独立，天然并行；锁粒度 = run，不阻塞其它 run；
- LRU 驱逐只针对**无锁且空闲**的 context。

**内存上界**

- 并发 run 多 / N 大时，用 **LRU 驱逐空闲 run 的 context**（被驱逐者靠重放恢复，无损）；
- context 只在 run 进行期间存活，终态后释放。

**可选 checkpoint 表（`run_node_state`，schema 第 9 节）**

- 定位：**可选**，**不是热路径**。两类用途：
  1. **恢复加速**：把内存 RunContext 周期性 / 结束时快照到该表，重启时优先读快照（缺失再回退重放），减少重放量；
  2. **运维 / 诊断**：需 SQL 直接观察某 run 的就绪计数与节点状态时使用。
- 若不采用（纯内存 + 全量重放），该表可**不建**，功能不受影响。

**可选 checkpoint 表列定义（与 schema.sql 第 9 节一致）**

| 表 | 列 | 类型 | 说明 |
|-|-|-|-|
| `run_node_state` | `run_id` | TEXT NOT NULL | 所属 run；主键 `(run_id, workflow_node_id)` |
| | `workflow_node_id` | TEXT NOT NULL | = `workflow_nodes.workflow_node_id`（start / op / end） |
| | `activation_seq` | INTEGER NOT NULL DEFAULT 1 | 当前 activation（回跳重入时 +1 并重置计数） |
| | `pending_in_edges` | INTEGER NOT NULL | 尚未决定的入边数（0 = 已全部决定） |
| | `activated_in_edges` | INTEGER NOT NULL DEFAULT 0 | 已 activated 的入边数（≥1 且 pending=0 即就绪） |
| | `status` | TEXT NOT NULL DEFAULT 'pending' | `pending` / `running` / `done` / `skipped` |
| | `updated_at_ms` | TEXT NOT NULL | 毫秒时间戳（快照写入时间） |

> 说明：该表为**可选快照**（恢复加速 / 运维诊断用）；即便建表，**`engine_events` 仍是唯一事实来源**，快照丢失或陈旧时可重放事件重建。

**复杂度对照**

| 指标 | 内存 RunContext（推荐） | 每步直读运行态表 |
|-|-|-|
| 单步找边 / 找下个节点 | O(度)，纯内存 | O(度)，DB 往返 |
| 单步 DB 操作 | O(1)（仅事件 append） | O(度) 读写（含写锁） |
| 整条执行 DB 操作 | O(K) | O(E) + O(K) |
| 就绪判定 | O(1)（内存计数） | O(1)（DB count） |
| 恢复 | 重放事件（或读 checkpoint） | 直接读表 |
| 内存 | O(N+E) / 活跃 run（可 LRU） | 低 |

**与 engine_events 的关系**：`RunContext`（内存）或 `run_node_state`（可选快照）= 运行态；`engine_events` = **唯一事实来源**。二者都可从事件重建。

#### 4.3.4 重试种子（resume seed）

> **拍板依据（D6）**：重试**保留「续跑」语义**——`POST /api/runs/{runId}/retry`（crud-05 3.5.8）不是「从头再跑」，而是**以源 Run 的失败 / 超时 step 为种子**在新 Run 中继续执行；**已完成节点不重复执行**（前端文案「从失败 step 开始重试」保持，见 `proposal-01 §12.8`）。

**① 入口与落库（重试侧契约）**

重试入口（crud-05 3.5.8）校验通过后**新建 Run**，并写入：

| 列 | 值 |
|-|-|
| `job_runs.retry_from_run_id` | **源 Run**（被重试的 Run） |
| `job_runs.retry_from_record_id` | 源 **失败 / 超时 `step_records.record_id`**（**StepRecord 主键**；**D17**：原名 `retry_from_step_id` 已改名）。**同一步骤多条记录**取 `(activation_seq, retry_seq)` 最大者（同 crud-05 3.5.5「以最后一条记录为准」）；**源 Run 存在多条失败 / 超时 step 时，取最后失败 / 超时的那一条**（`created_at_ms` 最晚），与 crud-05 3.5.8④ 同口径 |
| `job_runs.triggered_by` | `retry`（D16 五值之一）；**`rerun` 不写上述两列** |

- 随后调 `engine.notify(EngineStart{ run_id: 新 Run, resumeFromRecordId })`（`run_id` 即新 Run 的 `job_runs.run_id`，为 `engine_start` 事件的**表列**；结构体字段用 snake_case、JSON 面用 camelCase，勿写成 `runId`）——即 `engine_start` 事件的 payload 增字段 **`resumeFromRecordId`**（= `job_runs.retry_from_record_id`；**仅重试路径携带**，普通 Run 的 engine_start 不含该字段，字段表见 4.3「engine_events.payload 字段级定义」）。
- **新 Run 的快照来源（重试）**：`job_id` = 源 Run 的 `job_id`（Job 已删则沿用原快照值）；`name` / `target_kind` / `target_id` / `target_version` / `target_name` / `inputs` / `workspace` = **源 Run 快照**（与运行历史「名称快照」口径一致）；`job_kind` 继承源 Run（virtual 仍为 virtual）。

**② Engine 处理（`engine_start` 分支判定）**

`process_event(engine_start)` 首次处理时，**除了加载定义快照（见 4.3 事件表）外，先按 payload 是否含 `resumeFromRecordId` 决定起点**：

- **含 `resumeFromRecordId`（重试续跑）**：
  1. 以该 StepRecord 对应的**节点**为起点：该节点的**全部前置节点视为已完成**（种子节点及其全部前置节点合称**前缀节点集**）——**不写入新 Run 的 `step_records`**，仅由 `retry_from_run_id` / `retry_from_record_id` **溯源**；
  2. **新 Run 的边状态初值（D6，必做；否则多入边节点永久 `pending` 导致 Run 卡死）**——**初值总则（五步，与 crud-05 3.5.8④ 同口径）**：
     - ① **全边置 `pending`**（初始化）；
     - ② **前缀节点集的出边按其源 Run 终态边状态复制**（源 Run 中已 `activated` 的保持 `activated`、已 `dropped` 的保持 `dropped`，**不得重置为 `pending`**）；
     - ③ **种子节点的入边一律置 `activated`**；
     - ④ **不可达闭包（必做）**：对新 Run 中「**既不属于前缀节点集、也不从种子节点（或任一已决边）正向可达**」的节点（即**不可达闭包**），其**出边一律置 `dropped`**，并**递归传播至不动点**后再 dispatch（等价于：凡前缀集外且种子不可达的节点，其未决出边统按 `dropped` 决定，直至无新变化）；判据只看**可达性**，与源 Run 中该节点入边是否含 `activated` **无关**（`activated` 型旁支同样落入闭包，否则其入边在新 Run 永久 `pending`）；
     - ⑤ **dispatch 种子与已就绪节点**（④ 必须在 dispatch 之前完成）。
     - **⑥ 风险说明（不这样做会卡死）**：若不复制前缀边状态，菱形 / 并行汇聚结构会卡死——如 `Start → A`、`A →{on_success} B`、`A →{on_success} End`、`B →{on_success} End`（源 Run 中 A 成功、B 失败），重试从 B 起跑时 `A→End` 这条入边会**永远停在 `pending`** → End 既不就绪（不满足「所有入边均已决定」）也非 `skipped`，成为永久**挂起候选** → 收敛永不成立、`job_runs.status` 永久 `running`；同理，若不执行 ④ 的不可达闭包，源 Run 中已 `skipped` 的旁支（例：`Start → A`、`A →{on_success} B`、`A →{on_failure} Z`、`B →{on_success} End`、`Z →{on_success} End`，源 Run 中 A 成功、B 失败 → Z 被 `skipped`）的出边 `Z→End` 也会在重试 Run 中永久 `pending` → End 永久挂起候选 → Run 永久 `running`。**注（最小反例，`activated` 型旁支）**：图 `Start →(always) A`、`Start →(always) X`、`A →(on_success) B`、`B →(on_success) End`、`X →(always) Y`、`Y →(always) End`；源 Run 中 A 成功 → B 失败、`X→Y` 已 `activated` 但 Y 未 dispatch，随后 Run 落 `failed`。重试（种子 = B 失败记录）前缀集 = {Start, A, B}：旧判据「入边已全部决定且无 `activated`」会把 `activated` 的 X / Y 排除在闭包外，而 ② 只复制前缀集出边 → `X→Y` 在新 Run 中**永久 `pending`** → Y / End 永不就绪 → **收敛永不成立、`job_runs.status` 永久 `running`**；按 ④「不可达闭包」判据，X / Y 既不在前缀集、也不从种子 B 可达 → 其出边（`X→Y`、`Y→End`）一律置 `dropped` → End 就绪、Run 正常收敛。
     - **就绪 / 汇聚初值**：前缀节点集合以「已执行过」为初值参与就绪 / 汇聚判定（`completedOnce=true`；供回跳判定复用），但仍**不写入新 Run 的 `step_records`**；
     - **内存约定**：该初值**仅作内存 `RunContext` 初值**（`run_node_state` 仍是**可选**快照，不强制写入）；重放 / 恢复时由 `retry_from_record_id` + 源 Run 事件 / 记录**按同规则重建**（幂等）。
  3. 新 Run 的 `run_context` **初始上下文 = 源 Run 完成节点的出参快照**（`node_output` 绑定 → 源 Run `step_records.outputs`；`workflow_input` 绑定 → 源 Run `job_runs.inputs`）；
  4. **从该节点重新执行**（`activation_seq=1`、`retry_seq` **从 1 重新计**，种子记录不参与本轮计数）；其**后继节点按常规则推进**（走边 / 汇聚 / 收敛判定与普通 Run 完全一致）；起点节点的就绪判定**不要求**其入边被激活（因种子入边已按第 2 条置 `activated`，视为已就绪）；
  5. **幂等与重放**：`resumeFromRecordId` 落在 payload 内，**重放 `engine_start` 时按同值重新推导起点**（幂等；dispatch 前仍按 `(run_id, step_id, activation_seq, retry_seq)` 查重，见 4.3 事件表）。
- **不含 `resumeFromRecordId`（普通 Run）**：**一律从 Start 起步**（对 Start 的出边置 activated → 走就绪规则 dispatch 后继节点）。
- **与 `rerun` 的区别**：`rerun`（crud-05 3.5.7）**从头**执行，**不写** `retry_from_*`，engine_start **不含** `resumeFromRecordId`；重试则相反（续跑 + 写溯源 + 携带种子）。

**③ 缺失快照的处理**

若绑定的 `node_output` / `workflow_input` 在**源 Run 快照**（`step_records.outputs` / `job_runs.inputs`）中**找不到对应值**（如源出参缺失或已被清理）→ **400 `VALIDATION_ERROR`**（`message` 指明缺失的绑定），**重试不启动**；该预检在**重试入口**执行（见 crud-05 3.5.8），Engine 侧以同一快照口径取值。

**④ 幂等与生命周期**

- **同一源 Run 可重复发起重试**，各自独立 Run（互不影响）；重试 Run 的 `status` 生命周期与普通 Run **完全相同**（`waiting → running [→ terminating] → 终态 success/failed/timeout/cancelled`）。
- **前端**：`proposal-01 §12.8` 的「从失败 step 开始重试」文案保持；说明「**已完成节点不重复执行**」（该 Run 的 `steps` 仅含本次重新执行及之后的节点；前置节点不落 `step_records`，仅由 `retry_from_*` 溯源）。

### 4.4 WorkerPool 机制（执行层：数据库排队 + Worker 池）

**职责**：
- 接收 Runner / Engine 派发的任务（`worker.run_job(req)` / `worker.run_step(req, inst)` 插 step_records waiting（含 activation_seq / retry_seq），由 Worker 池执行；**总是入队成功，池满不报错**）
- 绑定 Client，生成包装脚本（bash / python / powershell / prompt），以指定 workspace 启动子进程（Executor，机制见 crud-01 5.1）
- 捕获 stdout / stderr / exit_code；超时按进程组 kill
- 把结果写回 step_records（终态 + outputs / raw_output / exit_code / error / duration_ms），按 source 同步调全局完成实现
- **不感知业务**：Op / Step 运行完之后该做什么，由全局实现决定（job → `JobComplete` / step → `StepComplete`）。**命名映射（同物两名）**：实现类型 `JobComplete` / `StepComplete`（`OnComplete` trait）与全局 static 实例名 `JOB_COMPLETE` / `STEP_COMPLETE` 为**同物的两个名字**——`STEP_COMPLETE` 实例 ↔ `StepComplete` 类型（step 完成回报 Engine）、`JOB_COMPLETE` 实例 ↔ `JobComplete` 类型（job_run 终态落库）。

**创建 Run 前校验（入口统一；D2 闭环的第三 leg）**：

> 任一创建 `job_runs` 的入口（单次执行 3.3.7 / Job 手动运行与 cron（crud-04 3.4.6、4.5.2）/ 重跑·重试（crud-05 3.5.7、3.5.8））在**落库 Run 之前**，对**所引用的 Workflow / 目标定义**执行**同一套完整校验（3.3 分组 A + 分组 B，共 15 条可判定规则；另规则 12 / 17 属说明性条目，不产生 400）**，不通过 → **400 `VALIDATION_ERROR`**、**不创建 Run**。此校验与保存草稿互补：**允许保存草稿（3.3.3 / 3.3.4 仅字段与结构类），执行前必拦**（D2）。
> - 与运行期「执行前校验」（step 绑定的 Client 类型与 OP 类型匹配，见下方「执行机制」）是**两件事**——后者由 WorkerPool 在 Worker 实际执行 step 前拦截、属运行期（step 落 `failed`，`error=CLIENT_TYPE_MISMATCH`）。
> - 各入口自身的顺序列表（如 crud-04 3.4.6.3「校验顺序（D12）」、crud-05 3.5.7 / 3.5.8）负责 `needsUpdate` / Client 类型等入口级前置校验；本项为 **A + B 分组定义完整性**，同样在落库 Run 之前执行（同一套完整校验的落点）。

**执行机制（数据库排队 + Worker 池）**：

WorkerPool 是真正的执行者，**入口只入队、调度在 WorkerPool 线程、执行在 Worker 池、钩子同步**：

- **入口入队（不执行，总是入队）**：`worker.run_job(req)` / `worker.run_step(req, inst)`（实例方法 &self）**总是**在
  **step_records 插入一条 status=waiting 记录**（run_id / step_id / activation_seq / retry_seq / op 快照 / client_id / inputs /
  workspace / timeout_ms / source=job|step / not_before_ms）后立即返回——**任务本体入 DB 排队，App 重启不丢失、不占内存**；
  调用方（Runner 调度线程 / Engine.process_event 调用方）不被阻塞。**池满不需上游重试**：无空闲 Worker 时任务就留在 waiting，由调度线程稍后指派。
- **术语澄清（U1/D2）**：本章“**派发**”= **入 DB 排队**（同步写 step_records，除 DB 写错误外必成功，不涉及 Worker 忙闲）；与“**执行失败**”（OP 返回非 0 / 超时 → `apply_retry` / 走边）、“**DB 错误**”（返回 Err → T26 重放）是**三件不同的事**。
- **成功入队的判定**：JobRun 在**入队成功之后**才 `waiting → running`（界面「等待中」→「运行中」）。
- **调度（WorkerPool 调度线程，常驻轮询）**：定期扫描 step_records 中 waiting 任务（按 created_at 顺序；**跳过 `not_before_ms` 未到点者**，即重试退避尚未到期；**并跳过所属 run 已终态的 waiting 任务**），
  查询 Worker 忙闲（busy 标志），发现空闲即**指派**（push 到该 Worker 的小队列）：**置 running 用 CAS —— `UPDATE step_records SET status='running' WHERE record_id=? AND status='waiting'`**；`affected=0` 表示已被 terminate 置 `cancelled`（或已被处理），**跳过不执行**——消除与 terminate 的竞态（P4）；
- **执行（Worker 池）**：池大小 = **`ceil(job_queue_running_max × 1.5)`**（`worker_pool_size`，只读派生；**数值派生自同一配置（`job_queue_running_max`）、语义不同**——阈值为 running 的 JobRun 数上限，池大小为常驻执行体数，见 crud-06 一）；
  自子进程 spawn（waiting → running 之后的实际执行起点）始计 `op.timeoutSeconds`（排队时长与 spawn 前准备期不计入，见 crud-01 5.1）；
  每个 Worker 一个**常驻执行循环 + 小队列**（WorkerPool 经小队列触发执行），**数量固定、运行期不新增**，
  内存有上界；收任务 → **执行前校验：step 绑定的 Client 类型与 OP 类型匹配（Client 可被编辑更换类型，故每次执行前校验；不匹配 → step 直接写 failed 终态，`error=CLIENT_TYPE_MISMATCH`，不启动子进程、不消耗超时）** → `Executor::execute(req).await`（见 crud-01 5.1）→ **更新 step_records 终态 + 结果**
  （outputs / raw_output / exit_code / error / duration_ms）→ 按 source 同步调全局完成实现：
        ├─ source=job  → 全局 JobComplete:
        │     → 更新 job_runs 终态（落库）并供运行历史界面展示结果（run_id 取自 result）
        │     → Runner 常驻轮询自动感知并调度下一个 waiting 任务
        └─ source=step → 全局 StepComplete:
              → 用 result 携带的 step_id / activation_seq / retry_seq（无需拆 run_id）
              → 写 engine_events: step_completed{run_id, step_id, activation_seq, retry_seq, result}
              → 立即调全局 ENGINE.process_event 同步推进（写即处理）: 标记步骤结束 → walk_edge → 派发下一节点 → 直至 End
- **崩溃恢复（启动时）**：WorkerPool 初始化时扫描 step_records 中 **status=running** 的任务（上次中断残留），
  重新指派给空闲 Worker **重新执行**（复用 record_id，完成后覆盖终态与结果）；
- **排队中（waiting）的 OP 可直接 cancel（D1 拍板）**：位于 `step_records` 中 status=waiting 的任务，terminate 时**直接置 `cancelled`**（不再指派执行），无需等它跑；**仅 running 的 OP 不可外部 cancel**（OP 为最小原子执行单位，唯一 kill = 其自身 `timeoutSeconds` 到期，见 4.4）。此规则对 **Job 与 Workflow 执行一致生效**。
- **并发边界**：同时执行任务数 ≤ Worker 池大小（`ceil(job_queue_running_max × 1.5)`）；Runner 的并发配额（job_runs
  running 计数 ≤ `job_queue_running_max`）保证"Job 级并发"，WorkerPool 保证"执行体并发"，DB 排队天然有界（不占内存）。

**入队 / 调度机制（D1 定稿：DB 排队，无内存滞留）**：

- **池满 = 任务留在 DB 排队**：`run_job` / `run_step` **总是**写 waiting 记录并返回，**不因“无空闲 Worker”而报错**；WorkerPool 调度线程扫到 waiting 且发现空闲 Worker 时才指派（`waiting → running` CAS）。重启后 waiting 任务继续调度、running 任务重跑，**不丢任务**。
- **为何“执行体并发”（15）> “Job 级并发”（10）（U1）**：两者是**不同维度**的限制——一个 JobRun 内可**多个 step 并行**（如并行分支），故 Worker 池按 JobRun 上界的 1.5 倍预留；否则池太小会让大量 step 长时间停在 waiting，拖慢调度。
- **超时计时起点（D1 拍板）**：`op.timeoutSeconds` 自**子进程实际启动（spawn）**起算（`waiting → running` 置位仅表示已指派，spawn 前的准备期**不计入**），**排队时长不计入**——step 在 `step_records` waiting（等池空或重试退避 `not_before_ms`）期间**不会超时**（也正是“唯一 kill = 自身 timeoutSeconds”指的是**已开始执行**的 OP）。
- **池满即 waiting 积压的边界（S1，定稿：有界且可接受）**：池满时 step 在 waiting 排队（JobRun 已 running，crud-05 4.6）；**边界** = 同时 running 的 JobRun 数（≤ `job_queue_running_max`）× 单 Run 最大并行 step 数（≤ `workflow_max_nodes`——单 Workflow 节点总数上限，故也是单 Run 并行 step 数的上界），**有界、不占内存、不丢任务**。**不另做兜底控制**（不设 step 级等待上限）；**可观测性**：运行历史界面中 step 显式展示 `waiting（排队中）`，用户可凭此判定"等 Worker"而非"卡住"；**观测指标**：关注 step 在 `waiting` 状态的**停留时长**（waiting → running 的时间差）——正常应远小于 OP 自身执行时长；若普遍持续数分钟以上即触发下方运维动作。**运维提示（C7）**：若界面长期出现大量 step 停在 `waiting（排队中）`（占比高或持续数分钟），说明 Worker 池相对并行度偏小。**注意**：`job_queue_running_max` 默认 10 即为其**上限**（crud-06 一/三），**无法调大**，故扩容手段只有两条：① **调小 `workflow_max_nodes`**（单 Workflow 最大节点数）以压缩单 Run 并行 step 峰值；② 单个 Workflow 内并行分支过多时，**拆分为多个顺序 Workflow** 降低峰值（池大小 = `ceil(running_max × 1.5)` 随配置联动，见 crud-05 4.6 / crud-06 一）。
- **waiting 队列上界的运维结论（D4，定稿：已接受、无需额外运维动作）**：全局 waiting 队列深度达配置项 `job_queue_waiting_max`（**默认 20、用户可调、上限 1000**）时，**触顶即拒新建**——所有创建 `job_runs` 的入口统一校验（手动 / cron / 单次 / 重跑 / 重试）并返回 **409 `CONCURRENCY_CONFLICT`**（cron 路径为「本轮跳过、不报 409、下个周期重试」，见 crud-04 3.4.6.1「适用范围（全入口生效）」 / 4.5.2）。**结论（已接受）**：这是**预期行为**（排队能力显式有界，避免无界积压占内存/DB），不视为故障，**无需额外运维动作**（不需扩容该上限、不需人工清队）。**如需观测（排查用）**：① `job_runs` 中 `status='waiting'` 计数（= 当前队列深度；长期贴近 `job_queue_waiting_max` 说明提交速率 > 消化速率）；② `step_records` 中 `status='waiting'` 记录的**等待时长分布**（`started_at_ms - created_at_ms`，用于区分「等 Worker 池」与「等 Job 级并发配额」）。若 waiting 长期贴近上限，按上方 S1/C7 的运维手段处理（调小 `workflow_max_nodes`、把并行分支过多的工作流拆为多个顺序 Workflow），而非调大 `job_queue_waiting_max`。
- **可 cancel 范围**：waiting（排队中）的 step **可直接置 cancelled**；running 的 step **不可外部 cancel**（仅等其自然结束或自身超时 kill）。

- **为何数据库排队而非内存队列**：内存有界队列在 **App 重启时队列内容丢失**；step_records 排队把任务
  持久化在 DB，重启后可恢复（waiting 任务继续调度、running 任务重跑），不丢任务；
- **钩子同步调用**：Worker 执行完成后**同步调用**全局完成实现（source=job → `JobComplete` /
  source=step → `StepComplete`）——不转异步投递、不产生事件；实现内操作（更新状态 / 写事件记录）同步完成；
- **为何 trait 即可、不需要事件**：完成后处理（更新终态 / 回报 Engine）是全局实现自己的业务，天然用
  `OnComplete` trait 表达（入参统一为 ExecuteResult）；WorkerPool / Engine 无需知道发给谁、什么类型。
  run_id / step_id / activation_seq / retry_seq 均已在结果内（回填自请求）——**无需从 run_id 拆 stepId**。**实现为全局可访问**（static 单例，App 启动 init() 时创建、重启后重建）。
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
    workers: Vec<Worker>,     // 常驻执行体池：数量 = ceil(job_queue_running_max × 1.5)
}

/// 步骤执行实例标识（由 Engine 的 dispatch_step 决定）：定位 step_records 中的一次实际执行。
pub struct StepInstance {
    pub activation_seq: u32,   // 第几次激活（首次=1；循环回跳重入 +1）
    pub retry_seq: u32,        // activation 内第几次尝试（含首次；首次=1，apply_retry +1）
    pub not_before_ms: Option<String>,  // 最早可执行时间（重试退避；None = 立即可执行）
}

impl WorkerPool {
    /// 构造：按 ceil(job_queue_running_max × 1.5) 创建 Worker 池
    /// （worker_count = ceil(job_queue_running_max × 1.5)），由主程序在 App 启动 init() 时调用
    pub fn new(executor: Arc<Executor>, concurrency_limit: usize) -> Self;

    /// 单次 OP / Job 执行（Runner 调用，**实例方法 &self**）：activation_seq=1、retry_seq=1；
    /// **在 step_records 插入一条 status=waiting 记录（任务入 DB 排队，重启不丢；池满不报错）**，
    /// 立即返回句柄；由调度线程指派 Worker 执行，完成后按 source=job 同步调全局 JobComplete
    pub fn run_job(&self, req: ExecuteRequest) -> WorkerHandle;

    /// workflow 步骤执行（Engine 调用，**实例方法 &self**）：除 req 外携带 `inst`
    /// （activation_seq / retry_seq，由 Engine 的 dispatch_step 决定），据此写入 waiting 记录；source=step；
    /// 完成后由 Worker 按 source=step 同步调全局 StepComplete（用 result 携带的 step_id / activation_seq / retry_seq 回报 Engine）
    pub fn run_step(&self, req: ExecuteRequest, inst: StepInstance) -> WorkerHandle;

    /// WorkerPool 调度线程（常驻）：定期扫描 step_records 中 waiting 任务（按 created_at 顺序），
    /// 有空闲 Worker 即指派（push 到其小队列）并将任务 waiting → running（落库）
    fn dispatch_loop(&self);

    /// 启动恢复：App 启动时扫描 step_records 中 status=running 的任务（上次中断残留），
    /// 重新指派给空闲 Worker 重新执行（复用 record_id，完成后覆盖终态与结果）
    fn recover_running(&self);

    /// 终止某 run 的全部在飞步骤（Engine 的 terminate 调用，实例方法 &self）：
    /// **不 kill 在跑 OP**（OP 是最小执行单位，运行中不可外部终止）；停止派发新任务（不再 dispatch，包括清 pending_reentry）。
    /// **唯一实现归属**：将 waiting 步骤置 cancelled 的条件更新只在 `process_event(terminate)` 内执行一次（含 inflight_count 递减，见 4.3），
    /// `abort_run` **不重复执行该 UPDATE**，避免 inflight_count 双次递减；等在跑 OP 自然结束后由 Engine 收尾落终态。
    pub fn abort_run(&self, run_id: &str);
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
    /// **不再提供外部运行时 kill**：OP 运行中不可被外部终止（避免中途强杀产生不可预期结果）。
    /// 唯一按进程组 kill 的时机 = 该 OP 自身 `timeoutSeconds` 到期（**自开始执行起算，排队时长不计入**），由 Executor 内部处理。
    /// 外部「终止 Run」= 置终止意图 + 取消 waiting 步骤 + 等其在跑 OP 自然结束（见 Engine terminate）。
    pub fn abort(&self);

    /// 本次执行是否已结束：查 step_records 该记录状态（success / failed / timeout / 被终止）
    pub fn is_finished(&self) -> bool;
}
```
