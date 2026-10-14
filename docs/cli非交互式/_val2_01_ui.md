# 独立校验报告 —— proposal-01-界面设计.md × 原型图

**审查对象**：`docs/cli非交互式/proposal-01-界面设计.md`（权威规格）+ `docs/cli非交互式/原型图/*`（原型实现）
**审查性质**：只读审查（未修改任何被审文件；本次仅新增本报告 + 3 个核对脚本（`_mech.py` / `_mech2.py` / `_line.py`）与 3 个核对输出（`_val2_mech.txt` / `_val2_mech2.txt` / `_val2_lines.txt`））
**审查日期**：2026-10-14
**行号基准**：文档行号 = `proposal-01-界面设计.md` 物理行号；`原型图/xxx` 行号 = 该文件物理行号

---

## 统计

| 档位 | 数量 | 说明 |
|-|-|-|
| 严重 | 4 | 会导致核心流程无法落地 / 保存出运行期必失败的配置 |
| 一般 | 20 | 文档内部或文档↔原型不一致、无法判定口径、样例与规则冲突 |
| 轻微 | 12 | 交叉引用错误、术语/标题不一致、示例数值漂移 |
| 需拍板 | 8 | 必须在动代码前定口径 |

分类维度分布（A 前后矛盾 / B 不易理解 / C 方案待完善）：
A 类 19 条、B 类 7 条、C 类 10 条（同一条可能跨类，按主导维度归一类）。

### 机械核对方法与证据

本次共执行 3 个脚本（产物：`_val2_mech.txt`、`_val2_mech2.txt`、`_val2_lines.txt`）：

1. **章节号交叉引用全量核对**（`_mech.py`）
   - 方法：从文档 markdown 标题抽取全部数字章节 ID（得到 `2.1 … 20.1` 共 115 个），再用 `§\s*([0-9]+(\.[0-9]+)*)` 扫描原型 9 个文件与文档自身。
   - 结果：原型引用 18 个章节号，其中 **`§18.2` 不存在**（index.html:573）；文档内部引用 18 个章节号，全部命中（`§1.1`/`§15` 分别指向 proposal-02 / 中文序号章节，非本档缺陷）。
   - 附带结果：`§10.3` 被 mock-data.js:500 用于描述 Job 定义（该节实为「Start / End 固定节点」），属误引。
2. **枚举集合比对**（`_mech.py`）
   - 方法：对 RunStatus(7)、StepStatus(6)、triggeredBy(5)、ClientType(4)、concurrency(3)、EdgeCondition(3)、inputMode(3)、outputMode(3)、backoff(3)、timeRange(7)、jobKind(2) 逐个取值，统计其在文档与各原型文件中的出现次数，**0 次即视为「文档宣称但原型未实现」**。
   - 结果：**全部取值在文档与原型两侧均出现**（无「文档有原型无」的枚举值），说明枚举层无漏项；不一致集中在**展示文案与筛选项粒度**（见 一般 G7）；`parallel` 在原型仅 1 处（job.html:369 下拉选项），未在渲染/校验分支出现。
3. **字段名全量对照 + 数值上限逐处比对**（`_mech2.py`）
   - 方法：解析文档全部 `typescript` 代码块，抽取 76 个字段名，逐文件 `count()` 比对；再对 11 处数值约束（512 / 20 / 1000 / 180 / 1.5 / 2000 / 130 / 46 / 7-17-27 / 1100×400 / 10-50-100-1000）做正则命中核对。
   - 结果：76 个字段中 **仅 1 个在原型中 0 次出现 —— `nextRunAtMs`**（见 轻微 L4）；数值约束文档侧全部命中 1 次以上，与 `mock-data.js` 的 `SETTINGS`/`SETTING_LIMITS`、`settings.html` 的 `max:` 逐项一致（waiting 20/1000、age 180、running_max 10 上限、`ceil(run_max×1.5)`），**未发现数值上限冲突**；唯一口径问题在「导入上限」用哪一份数值（见 一般 G16）。
4. 辅助定位脚本 `_line.py` 用于把报告中的每条引用锚定到精确行号。

> 结论：字段名、枚举、数值上限三类「机械可核对」项基本干净；问题集中在**行为/交互口径**与**样例数据**两处。

---

## 严重

### S1. Workflow「保存/执行是否强制校验」文档自相矛盾，且按 UC-W3 实现会直接阻断「新建 Workflow」

**证据（文档内部矛盾）**
- `proposal-01-界面设计.md:2452`：「`| UC-W1 | 新建 Workflow | Workflow 管理 → [新建] → 拖拽 OP 到画布 → 连线 → 配置参数绑定 → **可先点 [校验] 检查拓扑** → [保存] | 列表新增一行 |`」——「可先点」= 可选。
- `proposal-01-界面设计.md:2454`：「`| UC-W3 | 编辑 Workflow | … → 可先点 [校验] 检查拓扑 → [保存] | 可添加节点、连线、配置重试策略；**校验通过后才能保存** |`」——「才能保存」= 强制。
- `proposal-01-界面设计.md:924`：「**新建 Workflow 时，画布仅包含 Start 和 End 两个节点。**」
- `proposal-01-界面设计.md:1324`：「`| Start 至少一条出边 | 否则校验不通过 |`」
- `proposal-01-界面设计.md:1325`：「`| End 至少一条入边 | 否则校验不通过 |`」

**原型行为**
- `原型图/workflow.html:1749`、`原型图/workflow.html:1765`：新建（未保存）时点 [校验] 只提示「请先保存后再校验」。
- `原型图/workflow.html:1888`—`原型图/workflow.html:1892`：`if (existing) { runWorkflowValidate(...) } return; submit()` —— **只有已存在的 Workflow 保存前才校验**，新建直接提交。

**为什么是问题**
「新建时只有 Start + End」与「校验规则要求 Start 至少一条出边、End 至少一条入边」互斥：只要严格实现 UC-W3 的「校验通过后才能保存」，`POST /api/workflows` 将**永远无法成功**（新建对象必然校验失败），整个 Workflow 管理界面不可用。若按原型实现（新建不校验、且新建不能校验），则 UC-W3 的「校验通过后才能保存」与 §19.3「Workflow 校验结果面板」的定位全部失效，并且无法回答「用户中途保存草稿」这类必然场景。

**建议改法**（可直接落地）
1. 在 `§10.9 编辑器视图` 增补一段硬口径：

> **校验与保存的关系**：`[校验]` 与 `[保存]` 相互独立。**保存不要求校验通过**（允许保存草稿）；`[保存]` 与 `[执行]` 前**不调用** `POST /api/workflows/{workflowId}/validate`。`[校验]` 仅在用户主动点击时调用，用于提示拓扑问题。
> 例外：`[执行]`(单次执行) 与 Job 触发执行前，后端在创建 Run 时对**引用该 Workflow 的版本**做校验；校验不通过 → 400 `VALIDATION_ERROR`，前端提示「拓扑不合法，无法执行」。

2. 删除 `proposal-01-界面设计.md:2454` 中的「校验通过后才能保存」，改为「可先点 [校验] 检查拓扑；校验不通过不影响保存（草稿）」。
3. 删除 `proposal-01-界面设计.md:2452` 的「可先点」，统一改为新口径措辞，避免两处措辞不同被读成不同规则。
4. 若产品确实要求「必须合法才能保存」，则必须在 `§10.3` 增加一条：**新建 Workflow 的首次保存不校验**，并在原型 workflow.html:1747 保留「请先保存后再校验」——两条只能二选一（见 需拍板 D1）。

---

### S2. WorkflowNode.clientId 缺省时的「回退 Job.target.clientId」在数据模型中不存在可回退对象

**证据**
- `原型图/workflow.html:1444`：`'<option value="">— 未指定（执行时回退 Job.target.clientId） —</option>'`
- `proposal-01-界面设计.md:857`：`  clientId?: string;`（WorkflowNode 字段，可选）
- `proposal-01-界面设计.md:904`：`| op | ✅ 必填 | ✅ 必填 | ✅ 可选 | …`（clientId = 可选）
- `proposal-01-界面设计.md:1380`：`> - **Job 顶层不设 `clientId`（Client 为 OP 专有）**：`clientId` 仅当 `target.kind === "op"` 时需要，存放在 `target.clientId`，创建 Job 时选择。`
- `proposal-01-界面设计.md:1363`：`    | { kind: "op"; opId: string; opVersion: number; clientId: string }   // kind=op 时 clientId 必填`
- 文档全档检索 `回退`/`未指定`：**无任何 clientId 缺省回退规则**（`findstr 回退 proposal-01-界面设计.md` 仅命中 §8.10/§9.7 的「不回退到浏览器下载」）。

**为什么是问题**
文档把节点的 clientId 定义为可选，但**没有定义缺省时用哪个 Client**；原型自作主张写成「回退 `Job.target.clientId`」，而该字段在两种关键场景下不存在：
- Job `target.kind="workflow"` 时 target 形如 `{workflowId, workflowVersion}`，**没有 clientId**；
- Workflow 单次执行（virtual Run）**根本没有 Job**。
结果就是「Prompt 类型 OP 节点没配 Client → 执行时抛错」或「执行时静默用了错误 Client（Client 类型与 OP 类型不匹配）」，两者都属于执行契约缺失。

**建议改法**（可直接落地，任选其一并写进 §10.3 节点字段约束表）
- 方案 A（推荐，改动最小）：把 `clientId` 由「✅ 可选」改为 **`✅ 必填`**，并在 `§10.3` 表格下加注：

> **OP 节点必须指定 Client**：`clientId` 必填（`POST/PUT /api/workflows` 缺失 → 400 `VALIDATION_ERROR`；工作流校验规则增加「所有 OP 节点的 clientId 非空」）。拖拽创建节点时，节点详情面板的 Client 下拉默认选中「与该 OP 类型匹配的第一个 Client」。

- 方案 B：保留可选，但显式定义回退链并在原型去掉 Job 相关措辞：

> **OP 节点 clientId 缺省 = 该 OP 类型匹配的 Client 中按 `createdAtMs` 升序的第一个**（不依赖 Job，因为 Job.target=workflow 无 clientId、单次执行无 Job）。

原型的 `workflow.html:1444` 文案相应改为「— 未指定（执行时按 OP 类型取默认 Client） —」。

---

### S3. 参数绑定允许指向任意节点（含下游），且「未绑定」在数据模型中无表示 → 可保存依赖倒置 / 空绑定的 Workflow

**证据**
- `proposal-01-界面设计.md:946`：`| 任意前置节点的出参 | 只要该节点在当前节点之前已可执行 |`
- `proposal-01-界面设计.md:1172`：`| 释放到画布空白处 | 创建一个新的节点，引用该 OP 的最新版本，**并自动带出该 OP 的全部入参（未绑定状态）** |`
- `proposal-01-界面设计.md:864`—`proposal-01-界面设计.md:867`：
  ```typescript
  type ParamBinding =
    | { kind: "node_output"; workflowNodeId: string; outputName: string }
    | { kind: "workflow_input"; inputName: string }
    | { kind: "literal"; value: string };
  ```
- `proposal-01-界面设计.md:1329`：`| 所有 required 入参必须有来源 | 否则校验不通过 |`
- `原型图/workflow.html:1291`：`bindings[inp.name] = { kind: 'literal', value: '' };`（未绑定被写成「空字面量」）
- `原型图/workflow.html:1537`—`原型图/workflow.html:1552`：`buildNodeOutputOptions(currentId, binding)` 遍历 `Object.keys(nodes)`，**仅排除自身**（`if (nid === currentId) return;`），不判断是否前置/可达。
- `原型图/mock-data.js:1611`—`原型图/mock-data.js:1623`（校验规则 11）只检查 `!b || !b.kind`，因此 `{kind:'literal', value:''}` 被判定为「有来源」。

**为什么是问题**
三处口径互斥：数据结构只有三种「已绑定」形态，**没有「未绑定」这种状态**；于是「自动带出全部入参（未绑定状态）」只能退化成空字面量，而空字面量又正好满足「required 入参必须有来源」。结果是：
1. 必填入参实际为空也能通过校验并保存；
2. 参数绑定下拉里能选**下游节点**的出参（原型不限制），可保存出 `A 依赖 B 的输出、B 依赖 A` 的依赖倒置图，运行时行为未定义（§10.14 也没有任何一条规则拦截）。

**建议改法**（可直接落地）
1. `§10.2` 增补「未绑定」表示，并让校验可判定：

```typescript
type ParamBinding =
  | { kind: "node_output"; workflowNodeId: string; outputName: string }
  | { kind: "workflow_input"; inputName: string }
  | { kind: "literal"; value: string }
  | { kind: "unbound" };            // 新增：拖拽创建节点时的初始态（无来源）
```
2. `§10.10` 拖动行为一行改为：「释放到画布空白处 → 创建新节点，引用该 OP 的最新版本，**并自动带出该 OP 的全部入参，绑定类型置为 `unbound`**」。
3. `§10.4` 参数绑定来源表首行改为：`| 任意前置节点的出参 | 仅限**从 Start 可达且位于当前节点之前**的节点（按 DAG 拓扑序判定）；下拉只列出这些节点的出参 |`。
4. `§10.14` 校验规则「所有 required 入参必须有来源」补判定条件：「`bindings[name]` 不存在，或 `kind="unbound"`，或 `kind="literal"` 且 `value` 为空字符串 → 视为无来源」。
5. 建议同步补一条规则文案：`| 参数绑定必须指向前置节点 | 否则校验不通过 |` → 「节点 X 的入参 Y 绑定了下游节点 Z 的出参」。

---

### S4. OP↔Client 类型匹配是唯一契约，但 Job 编辑器 / 节点详情面板的 Client 下拉不过滤、且全流程无类型校验

**证据**
- `proposal-01-界面设计.md:369`—`proposal-01-界面设计.md:374`（§8.3 类型与执行器匹配）：
  ```
  | OP 类型 | 可选 Client 类型 |
  | Prompt | prompt |
  | Bash | bash |
  | Python | python |
  | PowerShell | powershell |
  ```
- `proposal-01-界面设计.md:209`：`| OP 管理 | Client 管理 | 执行时下拉选择 | 按 OP 类型过滤 Client |`
- `proposal-01-界面设计.md:744`：`│  │ Claude Code              ▾     │  │  ← 按 OP 类型动态过滤`（OP 单次执行）
- 原型 **OP 单次执行**做了过滤：`原型图/op.html:441` `function clientsForType(type)`，`原型图/op.html:989` `var clients = clientsForType(data.type);`
- 原型 **Job 编辑器不过滤**：`原型图/job.html:893`—`原型图/job.html:894` `document.getElementById('clientSelect').innerHTML = '<option value="">— 请选择 Client —</option>' + CLIENTS.map(...)`（全量 5 个 Client）
- 原型 **节点详情面板不过滤**：`原型图/workflow.html:1445`—`原型图/workflow.html:1447` `CLIENTS.forEach(function (c) { … })`
- 原型 **无任何类型匹配校验**：`原型图/job.html:1031` 只校验「非空」：`if (!document.getElementById('clientSelect').value) return '请选择 Client（target=OP 时必选）';`

**为什么是问题**
§8.3 是全局硬契约（「Prompt | prompt」一一对应）。当前实现下可以保存「`clean_logs`(powershell) + `Claude Code`(prompt)」这种 Job：列表/详情看起来正常，一到执行就必然失败（用 prompt 的调用方式去跑 powershell 脚本）。同样的问题存在于 Workflow 节点详情面板。文档也没规定「后端是否拒绝不匹配的 clientId」，因此前后端都无法确定该不该拦。

**建议改法**（可直接落地）
1. `§11.4` 「选择目标类型后的行为」表内补一行：

> | 选择具体 OP 后 | **Client 下拉只列出与 `OP.type` 匹配的 Client（映射见 §8.3）**；若该类型下无 Client，下拉置空并提示「请先在 Client 管理中创建 {type} 类型的 Client」 |

2. `§10.11` 节点详情面板字段表「Client | 下拉列表选择」改为：「Client | 下拉列表选择，**仅列出与该节点 `OP.type` 匹配的 Client（§8.3）**」。
3. `§8.3` 表下补一句后端口径：

> 后端在 `POST/PUT /api/jobs`（`target.kind="op"`）与 `POST/PUT /api/workflows`（OP 节点的 `clientId`）**校验 Client.type 与 OP.type 一致，不一致返回 400 `VALIDATION_ERROR`**（message：`Client 类型与 OP 类型不匹配：OP clean_logs 为 powershell，Client Claude Code 为 prompt`）。

---

## 一般

### G1. cancelled（用户终止）Run 能否 [重试]：文档三处口径互相冲突，原型按宽松口径实现

**证据（文档）**
- `proposal-01-界面设计.md:1745`（§12.4 操作按钮表）：「`| [重试] | 从失败 OP 开始重试 | **仅 target=Workflow** + 失败（含超时）+ 版本一致 + Workflow.needsUpdate=false + Job.needsUpdate=false |`」——**未含 cancelled**。
- `proposal-01-界面设计.md:1867`（§12.6 头部按钮表）：「`| 成功 / 取消 | [重跑] |`」——取消态只给重跑。
- `proposal-01-界面设计.md:1944`（§12.8.2 条件二）：「`| Run 已结束且存在失败/超时 step | failed / timeout / **cancelled（终止前有失败/超时 step）** 均可；… |`」
- `proposal-01-界面设计.md:1994`（§12.8.5）：「`| 用户终止 Run（cancelled） | ✅ 支持（需存在失败/超时 step） | ✅ 支持 |`」

**证据（原型）**
- `原型图/index.html:868`：`if (r.status === 'success' || r.status === 'failed' || r.status === 'timeout' || r.status === 'cancelled')` → 取消态会渲染 [重试]，且 `原型图/index.html:869` 按 `canRetryInfo(r).ok` 决定可点。
- `原型图/index.html:1280`：Workflow 详情同样把 cancelled 纳入渲染 [重试] 的分支。

**为什么是问题**
同一件事（cancelled 可否重试）在 §12.4、§12.6 说「不可 / 无此按钮」，在 §12.8.2、§12.8.5 说「可」。实现方无论选哪一边都能被指为「违反文档」，且 UI 上会直接出现「文档示例里不该存在的按钮」。

**建议改法**
1. 统一为「可重试」（与 §12.8.2/§12.8.5 一致，也与原型一致），改 `proposal-01-界面设计.md:1745` 为：
   `| [重试] | 从失败 OP 开始重试 | **仅 target=Workflow** + Run 已结束（failed / timeout / cancelled）且存在失败或超时 step + 版本一致 + Workflow.needsUpdate=false + Job.needsUpdate=false |`
2. 改 `proposal-01-界面设计.md:1866`—`proposal-01-界面设计.md:1867`：
   `| 超时 | [重试]（can-retry 为真）+ [重跑] |` / `| 成功 | [重跑] |` / `| 取消 | [重试]（can-retry 为真时，即终止前存在失败/超时 step）+ [重跑] |`

---

### G2. 运行历史列表在「成功」Run 上仍渲染 [重试]（应「按状态显示」）

**证据**
- `proposal-01-界面设计.md:1735`：「`| 操作 | 重跑 / 终止 / 重试（按状态显示） |`」
- `proposal-01-界面设计.md:1695`（§12.4 列表示例首行）：「`│ check_tests       OP check_tests v2    -             /path/ws-001    单次执行         ✓ 成功 12.3s [重跑] │`」——成功行**只有 [重跑]**。
- `proposal-01-界面设计.md:1745`：重试展示条件 = 「仅 target=Workflow + 失败（含超时）+ …」。
- `原型图/index.html:868`—`原型图/index.html:871`：`if (r.status === 'success' || …)` → `'<button class="btn btn-sm" disabled title="…">重试</button>'`。即**成功态也会渲染一个置灰的 [重试]**。

**为什么是问题**
文档规定「按状态显示」，示例行也明确成功只有 [重跑]；原型渲染了多余按钮，属于文档↔原型交互不一致（也让「操作列有几个按钮」不可预期）。

**建议改法**
1. 原型侧：把成功态从渲染分支剔除 → `if (r.status === 'failed' || r.status === 'timeout' || r.status === 'cancelled')`（列表与 `index.html:1280` 的详情同步）。
2. 文档侧：在 `proposal-01-界面设计.md:1735` 补一句限定：「成功 / 等待中 / 运行中 / 终止中 不展示 [重试]（失败、超时、取消 才展示，可否点击由 `can-retry` 决定）」。

---

### G3. Workflow 出参「是否显示 (type)」：文档三处结论不同，示例与规则冲突

**证据**
- 规则（禁止）：`proposal-01-界面设计.md:1857`：「**Workflow 出参无类型**：按 crud-03，Workflow 的 `outputs` 为 `{name, from, description}`，**无 `type` 字段**——界面出参列只显示 `name`（不得渲染类型括号）」
- 示例（有类型）：`proposal-01-界面设计.md:1826`：「`│ deploy_url (string)          │ https://prod.example.com/app          │`」
- 示例（有类型）：`proposal-01-界面设计.md:1034`：「`│ 出参: deploy_url (string)   部署后的访问地址                             │`」
- 规则（要求有类型）：`proposal-01-界面设计.md:2696`：「顶部参数定义区用子表格展示入参/出参（**左列=参数名(类型)**，右列=描述）」
- 数据结构：`proposal-01-界面设计.md:838`—`proposal-01-界面设计.md:842` `interface WorkflowOutput { name: string; from: {...}; description?: string; }` —— 确实无 type。
- 原型按「禁止」实现：`原型图/index.html:1327` `((o.type == null || o.type === '') ? '' : ' <span…>(' + escText(o.type) + ')</span>')`；`原型图/workflow.html:903` 同。

**为什么是问题**
样例是最好被复制的部分：开发者照 §12.6 示例截图做，就会渲染 `deploy_url (string)`，与同页 1857 的硬规则直接冲突；§19.3 的「参数名(类型)」又要求显示。三方口径必须收敛。

**建议改法**
1. 改 `proposal-01-界面设计.md:1826`：`│ deploy_url                    │ https://prod.example.com/app          │`
2. 改 `proposal-01-界面设计.md:1034`：`│ 出参: deploy_url            部署后的访问地址                             │`
3. 改 `proposal-01-界面设计.md:2696`：把「入参/出参（左列=参数名(类型)，右列=描述）」改为「**入参（左列=参数名(类型)）** 与 **出参（左列=参数名，Workflow 出参无 type，见 §12.6）**，右列=描述」。

---

### G4. §12.6「执行状态从 run 的 steps 中按 opId 匹配」与节点维度冲突

**证据**
- `proposal-01-界面设计.md:1797`：「…画布节点和连线均从 Workflow 定义渲染…**执行状态从 run 的 steps 中按 opId 匹配**。节点上展示 OP 名称（不展示 workflowNodeId）…」
- `proposal-01-界面设计.md:1640`—`proposal-01-界面设计.md:1646`：StepRecord 同时有 `opId` 与 `stepId`，且 `stepId = 对应 workflowNodeId`（`proposal-01-界面设计.md:63`：「`| StepRecord | recordId（主键）；stepId = 对应 workflowNodeId |`」）
- 同一 Workflow 可多次引用同一 OP：`原型图/mock-data.js:359`—`原型图/mock-data.js:363`（`code_review` 的 `node_review` 与 `deploy_workflow` 同 opId；`log_analysis` 亦复用 `process_data`）
- 原型按 stepId 匹配：`原型图/index.html:1188` `var matched = lastRecordOf(run, workflowNodeId);`（`mock-data.js:1135` 过滤 `s.stepId === stepId`）

**为什么是问题**
按 `opId` 匹配会在「同一 Workflow 内两次引用同一 OP」时把两个节点的状态、出参、错误串在一起（例如两个 `check_tests` 节点都显示同一条 step 的结果）。文档写错了匹配键，实现方若照做会得到错误画布。

**建议改法**
把 `proposal-01-界面设计.md:1797` 的「执行状态从 run 的 steps 中按 opId 匹配」改为：
「**执行状态按 `stepId`（= `workflowNodeId`）匹配 run 的 steps**；同一节点多次执行（重试/回跳）时取 `(activationSeq, retrySeq)` 最大的一条（见 §12.3 D3）。**不得按 `opId` 匹配**——同一 Workflow 可多次引用同一 OP。」

---

### G5. §12.5「OP 执行详情页以 check_tests 为静态示例，不随 OP 变化」与同节动态要求冲突

**证据**
- `proposal-01-界面设计.md:1788`：「`> - OP 执行详情页以 `check_tests` 为静态示例内容，不随 OP 变化。`」
- 同节紧接着要求动态：`proposal-01-界面设计.md:1790`：「每次执行（重试 / 循环回跳，执行历史下拉切换）的入参、出参、输出一一对应，**切换时同步更新**。」
- `proposal-01-界面设计.md:1791`：「版本对比提示条…**正文取该次执行的 `step.bodySnapshot` 快照**」
- `proposal-01-界面设计.md:1919`—`proposal-01-界面设计.md:1920`（§12.7）：「入参 | … | Workflow 对该 node 设置的入参值（已解析变量）」「出参 | … | 该 node 实际执行的出参值」
- `proposal-01-界面设计.md:2486`（UC-R1）：「进入 OP 执行详情页，展示正文快照、入参、出参、执行历史下拉」
- 原型为动态：`原型图/index.html:956` `function openOpDetail(name, execVer, curVer, from, nodeData, runId)`，`原型图/index.html:994`—`原型图/index.html:996` 用 `stepData.bodySnapshot`，`原型图/index.html:1118` `renderOpParamTables(h)`。

**为什么是问题**
同一节里「不随 OP 变化」与「切换时同步更新 / 取 bodySnapshot」互相否定。若照 1788 实现，§12.7 与 UC-R1 全部失效，运行历史第二/三层界面也就没有存在意义。

**建议改法**
删除 `proposal-01-界面设计.md:1788` 整行，替换为：
「OP 执行详情页的入参 / 出参 / 输出 / 正文**一律取自所查看的那一条 StepRecord**（正文取 `bodySnapshot`），**随所选 Run 与执行记录变化**；页面为单条 step 的视图，不做跨 step 聚合。」

---

### G6. OP.timeoutSeconds：默认 60 vs 新建为空，且取值范围/必填性未定义

**证据**
- 默认 60：`proposal-01-界面设计.md:591`：「`  timeoutSeconds?: number; // 超时秒数（只属于 OP，默认 60，字段名与 crud-02 3.2 一致）`」
- 新建为空：`proposal-01-界面设计.md:716`：「`> **OP 新建时无问题**：各字段默认值为空（名称、描述、**超时**、入参、出参、内容均为空），由用户填写。`」
- 新建为空：`proposal-01-界面设计.md:2778`：「`| OP | 名称空、描述空、**超时空**、入参空、出参空、类型 prompt、内容空 |`」
- 原型：`原型图/op.html:698` `document.getElementById('opTimeout').value = '';`（新建置空）→ `原型图/op.html:884` `timeoutSeconds: parseInt(document.getElementById('opTimeout').value, 10) || 60,`（空值兜底 60；**`0` 也被兜底成 60**）
- 原型编辑器默认模板值：`原型图/op.html:249` `value="300"`；mock 的 POST 默认：`原型图/mock-data.js:1724` `timeoutSeconds: 60, …`
- 文档全档无 timeoutSeconds 的取值上下限/是否必填说明。

**为什么是问题**
「新建时超时为空」和「默认 60」是两种不同的实现：前者要求前端必填或后端兜底，后者要求表单预填 60。当前原型是「显示为空、保存变 60」，用户看不到自己提交的值；且因为 `|| 60`，`0`（即「不超时」？文档也未定义）无法表达。这直接影响 §14 超时语义的落地。

**建议改法**
1. 统一为「必填 + 默认 60」：改 `proposal-01-界面设计.md:716` 与 `proposal-01-界面设计.md:2778` 为「超时（默认 60，可改，**必填正整数**）」。
2. 在 `§9.2` 补一行范围：`// 超时秒数（整数，1 ≤ timeoutSeconds ≤ 86400，默认 60；0/负数/非整数 → 400 VALIDATION_ERROR）`
3. 原型 `op.html:884` 的 `|| 60` 改为显式判空：`var t = parseInt(..., 10); timeoutSeconds: Number.isFinite(t) ? t : 60`，避免把 0 静默改成 60。

---

### G7. 触发筛选枚举/文案与 API 单值枚举不匹配（含「单次执行」粒度矛盾）

**证据**
- `proposal-01-界面设计.md:1713`：「`| 触发 | 全部 / 持久 Job·定时 / 持久 Job·手动 / 单次执行 / 重试 | `triggeredBy` 展示映射（「重试」= `retry`，由运行历史 [重试] 产生） |`」——「单次执行」是**一个**筛选项。
- `proposal-01-界面设计.md:1609`：`  triggeredBy: "manual" | "schedule" | "single_op" | "single_workflow" | "retry";`——是**单值**枚举，一个参数值无法同时筛 `single_op` 与 `single_workflow`。
- 原型拆成两个：`原型图/index.html:243` `<option value="single_op">单次执行·OP</option><option value="single_workflow">单次执行·Workflow</option>`
- 原型筛选项文案与文档表不同：`原型图/index.html:243` 用「手动 / 定时」，文档写「持久 Job·手动 / 持久 Job·定时」。
- 展示文案不同：`proposal-01-界面设计.md:1761`「`│  └ 触发: 虚拟 Job / 单次执行`」 vs `原型图/mock-data.js:50` `single_op: '单次执行 · OP'`（原型的静态默认文案在 `原型图/index.html:265`，但被 `原型图/index.html:1067` `triggerTextOf(runData.triggeredBy)` 覆盖）。

**为什么是问题**
文档的筛选项粒度（1 项覆盖 2 个枚举值）**无法用给定的 query 参数实现**；同时「筛选项文案」「列表展示文案」「详情页示例文案」三处措辞各不相同，前端与测试都无法确定期望值。

**建议改法**
1. 改 `proposal-01-界面设计.md:1713` 为 6 项：「`| 触发 | 全部 / 持久 Job·定时（schedule） / 持久 Job·手动（manual） / 单次执行·OP（single_op） / 单次执行·Workflow（single_workflow） / 重试（retry） |`」。
2. 在 `§18.1.3` 增补：筛选项与 query 参数一一对应，**不提供多值合并**。
3. 统一详情页触发文案为 §12.4 的映射表口径，把 `proposal-01-界面设计.md:1761` 的「虚拟 Job / 单次执行」改为「单次执行 · OP」（或反向统一，见 需拍板 D5）。

---

### G8. 「未保存的 Client 不可测试」与 UC-C1/UC-C6 的「可先点 [测试] → [保存]」矛盾

**证据**
- `proposal-01-界面设计.md:2423`：「`| UC-C1 | 新建 Client | Client 管理 → [新建] → 填写名称/类型/二进制路径/输出格式 → **可先点 [测试] 验证命令可执行** → [保存] | …`」
- `proposal-01-界面设计.md:2428`：「`| UC-C6 | 编辑 Client | … → 修改字段 → 可先点 [测试] 验证命令可执行 → [保存] | …`」
- 原型禁止：`原型图/client.html:642` `setTestEnabled(false);`（新建即禁用按钮），`原型图/client.html:650` `btn.title = '未保存的 Client 不可测试，请先保存后再测试';`，`原型图/client.html:826`—`原型图/client.html:829` 返回「✗ 未保存的 Client 不可测试，请先保存后再测试」。
- 文档接口只有一个：`proposal-01-界面设计.md:2514`「`| POST | `/api/clients/{clientId}/test` | 测试 Client 命令或路径 |`」——需要 clientId，确实无法在保存前测。

**为什么是问题**
文档承诺的操作序列（先测再存）在给定接口下**无法实现**；原型的做法（禁用 + 提示）与文档的 UC 描述直接冲突。这是「文档给的可行路径不存在」，会让实现者二选一而无依据。

**建议改法**（二选一，写清即可）
- 改文档（推荐，改动小）：把 UC-C1 改为「→ [保存] → 在列表中对该 Client 点 [编辑] → [测试命令] 验证可执行」；并删掉 UC-C6 的「可先点」前置，改为「[测试命令] 仅对**已保存**的 Client 可用（未保存时按钮置灰，title 提示原因）」。
- 或保留文档语义：在 `§17.1` 新增 `POST /api/clients/test`（body 携带待测配置，不落库），并注明「`/api/clients/{clientId}/test` 仍保留给编辑态复用」。

---

### G9. 运行历史画布节点状态文案/图标与 §12.6 状态表不符（cancelled 被显示成「等待中」）

**证据**
- `proposal-01-界面设计.md:1883`：「`| 已取消（cancelled） | ⚫ 深灰框 | ✕ |`」
- `proposal-01-界面设计.md:1884`：「`| 未执行 / 跳过 | ⚪ 灰框 | ⊘ |`」
- `proposal-01-界面设计.md:1840`（同节示例画布）：「`│                 │ notify_fail  │                    │  notify  │         │` / `│                 │   ⚪ 未执行   │                    │  ⚪ 未执行│`」
- 原型状态映射：`原型图/index.html:1344`—`原型图/index.html:1350`
  ```js
  var STATUS_MAP = { success:…, failed:…, timeout:…, running:…, waiting: { cls: 'st-wait', text: '◌ 等待中' } };
  ```
- `原型图/index.html:1360`：`return STATUS_MAP[n.status] || STATUS_MAP.waiting;` —— **cancelled 无分支，回落到「等待中」**；未执行的 OP 节点（`原型图/index.html:1196` `status = 'waiting'`）也显示「◌ 等待中」。

**为什么是问题**
运行历史的画布是给人看「这次跑到哪、哪里停了」的：把「已取消」显示成「等待中」、把「未执行」显示成「等待中」，用户会误判 Run 卡在排队还是被人为终止；且「◌」不在文档定义的图标集（✓ ✗ ⏱ ● ✕ ⊘）内。

**建议改法**
1. 原型补齐两态：
   ```js
   cancelled: { cls: 'st-cancelled', text: '✕ 已取消' },
   skipped:   { cls: 'st-skip',      text: '⊘ 未执行' }
   ```
   并把「未被匹配到的 OP 节点」状态由 `waiting` 改为 `skipped`（`原型图/index.html:1196`、`原型图/index.html:1185` End 未到达同理）。
2. 文档 `proposal-01-界面设计.md:1884` 明确：「**未执行 / 跳过**（Run 结束时该节点无 StepRecord 或最终记录为 cancelled 之前的 waiting 记录）→ ⚪ 灰框 ⊘ 未执行」；并在 §12.6 表下补一句「节点状态文案以本表为准，不得复用「等待中」（等待中仅用于 Run 自身非终态时的 running step）」。

---

### G10. Run 详情缺「自动刷新开关」与轮询（与 §12.10 / §19.6 不符）

**证据**
- `proposal-01-界面设计.md:2032`：「`| Run 详情（有运行中的 Step，自动刷新开） | 每 `general.poll_interval_ms`（默认 2000ms） | `/api/runs/{runId}` |`」
- `proposal-01-界面设计.md:2762`：「`| 自动刷新开关 | 运行历史 / Run 详情顶部 |`」
- `proposal-01-界面设计.md:2026`：「> **轮询间隔（D1 定稿）**：前端自动刷新**统一读取配置项 `general.poll_interval_ms`（默认 2000ms）**，不再使用下方场景化的固定秒数。」
- 原型只有一个开关且在列表页：`原型图/index.html:232`（列表头），定时器只刷新列表：`原型图/index.html:590` `autoRefreshTimer = setInterval(refreshRuns, pollIntervalMs());`；详情视图（`view-op-detail` / `view-wf-detail`）内无开关、无独立刷新（`grep autoRefresh index.html` 仅命中 232/571-605/1491）。
- 文档自身的详情页 ASCII（§12.5 / §12.6）里也没有自动刷新控件——与 §12.10/§19.6 冲突。

**为什么是问题**
运行中的 Run 详情（waiting→running→终态）是核心使用场景；轮询缺失意味着用户必须手点返回再进入才能看到状态变化，与「所有任务后台运行，前端轮询获取状态」的核心原则（§7.8）不一致。

**建议改法**
1. 文档：在 `§12.5`、`§12.6` 的 ASCII 头部补 `[刷新] [自动刷新: 开]`，并在 §12.10 明确「Run 详情轮询 `/api/runs/{runId}/status`（轻量）而非 `/api/runs/{runId}`；无 running step 时自动停止轮询」。
2. 原型：在 `view-op-detail` / `view-wf-detail` 头部加同一开关，复用 `pollIntervalMs()`，切视图时启停定时器（避免在详情页仍轮询列表）。

---

### G11. §11.3 Job 列表示例的 Target/工作区与 §12.4、§11.4 自相矛盾

**证据**
- `proposal-01-界面设计.md:1403`：「`│  ▶ hourly_check    Workflow deploy_workflow v1 /path/ws-002    Cron: 0 * * * * ✅ 启用   ✗ 失败 8.1s  ...  │`」→ Job `hourly_check` 的 Target 是 **deploy_workflow v1**。
- `proposal-01-界面设计.md:1697`：「`│  hourly_check      Workflow hourly_check v1 health_check /path/ws-003 持久 Job / 定时  ✗ 失败 8.2s   [重试][重跑] │`」→ 同名 Job 的 Target 是 **hourly_check v1**，工作区与耗时也不同。
- `proposal-01-界面设计.md:1395`：「`│  ▶ daily_cleanup   OP clean_logs v2         /path/ws-001 …`」 vs `proposal-01-界面设计.md:1699`：「`│  daily_cleanup     OP clean_logs v2     -             /path/ws-005 …`」。
- `proposal-01-界面设计.md:1404`：`manual_deploy … Workflow deploy_workflow v2 /path/ws-003    手动            ✅ 启用   ✓ 成功 15.3s`，而 `proposal-01-界面设计.md:1429`—`proposal-01-界面设计.md:1442` 说 Job 新建时工作区为空、编辑器示例 `proposal-01-界面设计.md:1487`「`│  工作区: [/path/to/workspace]`」。
- 原型夹具：`原型图/mock-data.js:511`—`原型图/mock-data.js:525` `hourly_check` → `workflowId: 'f0000000000000000000000000000004'`（即 hourly_check），`原型图/mock-data.js:503` 所有 Job 的 `workspace` 均为 `'/path/to/workspace'`。

**为什么是问题**
同一份文档里同名 Job 的目标实体不一致，读者无法判断哪个是权威示例；且 `/path/ws-00x` 这一族值在 §11.3 出现在「Job 工作区」列、在 §12.4 出现在「Run 工作区」列，进一步混淆了字段语义（见 G12）。原型（正确）显示了 Job 自身 workspace，于是文档示例成了「文档 vs 原型」的不一致。

**建议改法**
1. 以原型/`§12.4` 为准，改 `proposal-01-界面设计.md:1403` 为：
   `│  ▶ hourly_check    Workflow hourly_check v1 /path/to/workspace    Cron: 0 * * * * ✅ 启用   ✗ 失败 8.2s  …  │`
2. 改 `proposal-01-界面设计.md:1404`、`proposal-01-界面设计.md:1405` 的工作区列同样为 `/path/to/workspace`（Job 自己的工作区），并同步修正「最近运行结果」为与夹具一致（`manual_deploy` 示例改为 `⏹ 终止中 —`，因为 `原型图/mock-data.js:959` 的最新 Run 即 terminating）。
3. 或在 §11.3 表下加注：「本节示例为**示意**，权威夹具见 `原型图/mock-data.js` 的 `JOBS` / `RUNS`」——二选一即可，但不能两处数值互相打脸。

---

### G12. Job 列表「工作区」列取值来源未定义（Job.workspace 还是最近 Run.workspace）【待确认】

**证据**
- `proposal-01-界面设计.md:1417`：「`| 工作区 | 工作目录路径 |`」——未说明取自哪一层。
- `proposal-01-界面设计.md:1395`—`proposal-01-界面设计.md:1405` 的示例值 `/path/ws-001 … /path/ws-004` 与 §12.4 运行历史的「工作区」列取值族**完全相同**，暗示来自 Run。
- 但 §11.4 编辑器把工作区定义为 **Job 自己的字段**：`proposal-01-界面设计.md:1487`「`│  工作区: [/path/to/workspace]`」，`proposal-01-界面设计.md:1366`：`  workspace: string;`（JobDefinition）。
- 原型取 Job 字段：`原型图/job.html:625` `var workspace = j.workspace || '-';`

**为什么是问题**
两种取值的语义完全不同（Job 配置值 vs 最近一次实际运行目录），文档不给口径就无法写测试与对齐 mock。**标注：待确认**（若产品意图是「Run 实际目录」，则原型与 §11.4 都需改）。

**建议改法**
在 `proposal-01-界面设计.md:1417` 明确为：
「`| 工作区 | **Job.workspace（Job 定义的工作目录）**，不是 Run 的实际 workspace（Run 实际值见 §12.4 运行历史） |`」
并同步把 §11.3 示例值改为 `/path/to/workspace`。

---

### G13. Workflow 出参 `from` 的录入方式与「workflowNodeId 界面不展示」冲突，示例还用 label

**证据**
- 数据结构：`proposal-01-界面设计.md:840` `  from: { workflowNodeId: string; outputName: string };`
- 界面不得展示：`proposal-01-界面设计.md:1217`：「`| 节点 ID | workflowNodeId（32 位 UUID，内部使用，**界面不直接展示**；参数绑定中以 `workflowNodeId.outputName` 形式引用） |`」
- 文档示例使用 label：`proposal-01-界面设计.md:1082`：「`│ deploy_url    node_deploy.url                    部署后的 URL                       │`」——`node_deploy` 是 `label`（`proposal-01-界面设计.md:848`「label | 画布展示名（如 node_start / node_check）」），**不是** workflowNodeId。
- 原型要求手输 UUID：`原型图/workflow.html:1113` `'<input type="text" value="' + escapeAttr(fromVal) + '" placeholder="workflowNodeId.outputName" />'`（`fromVal` 由 `o.from.workflowNodeId + '.' + o.from.outputName` 拼成），无下拉、无合法性校验。

**为什么是问题**
文档一边说「界面不直接展示 workflowNodeId」，一边在示例里用 label 表示引用关系，而数据结构只接受 UUID；原型则要求用户手输一个 32 位十六进制 UUID。三者不可能同时成立，属于「无法落地」的交互缺口。

**建议改法**
1. `§10.9` 把出参表格列头与示例改为下拉语义：
   「`from：下拉选择（节点 × 该节点出参），展示为「{节点画布名} · {OP 名} · {outputName}」，存储为 `workflowNodeId.outputName`；不要求用户输入 UUID`」
   并把示例 `proposal-01-界面设计.md:1082` 改为 `│ deploy_url    [node_deploy · deploy · url ▾]    部署后的 URL │`。
2. 原型对应把 `workflow.html:1093`—`workflow.html:1116` 的 `<input>` 换成两个 `<select>`（节点 / 出参），提交时组装 `workflowNodeId.outputName`。

---

### G14. §10.14 第 11 条校验规则不可判定，原型却把它实现为硬错误

**证据**
- `proposal-01-界面设计.md:1330`：「`| 有多条入边的节点必须有明确汇聚 | 由 DAG 边决定 |`」——「由 DAG 边决定」是解释，不是判定条件，且与 `proposal-01-界面设计.md:952`—`proposal-01-界面设计.md:957`（§10.5「不单独配置汇聚策略，由 DAG 边决定」）重复。
- 原型把它实现成错误：`原型图/mock-data.js:1620`：`errors.push('节点 ' + … + ' 有 ' + inDeg[…] + ' 条入边，required 入参 ' + i.name + ' 没有明确汇聚来源');`

**为什么是问题**
规则不可判定 → 无法写测试，也不知道「不通过」的判据。原型自行发明了判据（入度>1 且 required 入参无绑定），但它与规则 10（`原型图/mock-data.js:1600`「的 required 入参 X 没有来源」）**判据相同、文案不同**，会出现同一条错误被报两次的不同说法。

**建议改法**
1. 把规则 11 改写为可判定项：
   `| 多入边节点的 required 入参必须有绑定 | 入度 > 1 的 OP 节点，其每个 required 入参必须存在非 `unbound` 的绑定（与规则 10 同一判据，合并为一条提示即可） |`
2. 直接**删除原规则 11**，因为「所有 required 入参必须有来源」已完整覆盖；`§10.5` 保留「汇聚语义由 DAG 边决定」作为运行语义说明。

---

### G15. §4.2 把「条数上限」写成了「保存时长」

**证据**
- `proposal-01-界面设计.md:147`：「`| 运行历史 | waiting/running 队列深度上限（waiting 默认 20、可调、上限 1000）、**单 Job/整体/单条保存时长（单条硬上限 180 天）**；**Job 无独立配置项、不设自动重试**（失败即失败，人工重跑或 Workflow 节点 retry） |`」
- 原型实际是三个不同维度：`原型图/settings.html:180` 「`单 Job 最大保留历史`」（`history_max_per_job`，**条数**）、`原型图/settings.html:181`「`整体最大保留历史`」（`history_max_total`，**条数**）、`原型图/settings.html:182`「`单条记录最大保存时长`」（`history_max_age_days`，**天数**）；`原型图/mock-data.js:1231`—`原型图/mock-data.js:1233` 值分别为 `'10'` / `'1000'` / `'180'`。

**为什么是问题**
把「单 Job / 整体 条数上限」和「单条 时长上限」并列成同一句话，读者会以为三项都是时长，进而把 `history_max_per_job` 实现成天数；§4.2 也没有给出这两个条数项的默认值（原型为 10 / 1000）。

**建议改法**
改 `proposal-01-界面设计.md:147` 的运行历史一行：
「`| 运行历史 | waiting 队列深度上限（默认 20、可调、上限 1000）、running 队列深度上限（默认 10、上限 10）、**单 Job 保留条数（默认 10）**、**整体保留条数（默认 1000）**、**单条记录保存时长（默认 180 天，硬上限 180 天）**；Job 无独立配置项、不设自动重试 |`」

---

### G16. 导入大小上限：文档只说「上限」，原型用「硬上限常量」而非配置值；Client 导入完全不校验【待确认】

**证据**
- `proposal-01-界面设计.md:144`：「`| Client | client_import_max_bytes（YAML 导入上限） |`」；`proposal-01-界面设计.md:145`：「`| OP | op_import_max_bytes（YAML 导入上限） |`」
- OP 导入读的是**硬上限表**：`原型图/op.html:1107` `var maxBytes = (typeof SETTING_LIMITS !== 'undefined' && SETTING_LIMITS['op.op_import_max_bytes']) || 104857600;` → 取值 `104857600`（`原型图/mock-data.js:1254`），而配置值是 `1048576`（`原型图/mock-data.js:1226`）。
- Client 导入**没有**任何大小校验：`grep import_max_bytes client.html` 无命中（仅 settings.html:165 描述与 mock-data.js:1225/1253 定义）。
- 原型的 `mock-data.js:1659`—`原型图/mock-data.js:1665` 又把 `SETTING_LIMITS` 当「可配置值的上限」用于 PUT 校验——同一份常量承担了两种语义。

**为什么是问题**
「可配置的导入阈值」与「阈值本身的硬上限」是两个数（1 MiB vs 100 MiB），原型的导入拦截用了后者，等于把配置项 `op_import_max_bytes` 在导入路径上**失效**（配 1 MiB 仍能导入 100 MiB 文件）；跨实体也不一致（OP 校验、Client 不校验）。**标注：待确认**（需确认 `*_import_max_bytes` 的语义）。

**建议改法**
1. 文档 `§4.2` 两条改为明确语义：
   「`client_import_max_bytes`：YAML 导入 Client 的**文件大小阈值（字节）**，默认 1 MiB，**取值范围 1024 ≤ x ≤ 104857600**」——并在 `§8.9` 导入校验表补一行：「前端在读取文件后校验 `file.size ≤ client.client_import_max_bytes`，超限 → 提示并保持 [导入] 禁用；OP 导入同口径」。
2. 原型：`op.html:1107` 改为读 `CFG.op.op_import_max_bytes`（经 `GET /api/settings`），并给 `client.html` 的导入流程补同样的校验；`SETTING_LIMITS` 仅保留 PUT 校验用途。

---

### G17. OP.content 的占位符语法全文未定义，三种写法并存，且与「参数模板不支持 {{workspace}}」易混

**证据**
- 原型自行宣称支持：`原型图/op.html:823` `hint: 'prompt 模板，支持 {{workspace}}、入参变量等占位符'`，并写进编辑器：`原型图/op.html:280` `<div class="hint" id="contentHint">prompt 模板，支持 {{workspace}}、入参变量等占位符</div>`
- 文档明确否定了 `{{workspace}}`——但只针对 **Client 参数模板**：`proposal-01-界面设计.md:451`：「…Client **不含工作目录字段**（工作目录只属于 Job 运行时…；参数模板**不支持** `{{workspace}}` 占位符）。」
- mock 里三种注入写法并存：`原型图/mock-data.js:265` `Get-ChildItem -Path $env:WORKSPACE …`（环境变量）、`原型图/mock-data.js:293` `curl -sf "$endpoint/health"`（裸变量）、`原型图/op.html:823` `{{workspace}}`（模板占位符）。
- 文档对 OP.content 的语法**没有任何说明**（`§9.2` 只写 `content: string;`）。

**为什么是问题**
包装脚本（`proposal-01-界面设计.md:376`—`proposal-01-界面设计.md:384` §8.4）到底向脚本注入什么名字的变量、prompt 模板里怎么引用入参，全部没有定义；原型三种写法混用，实现者只能猜，且 `{{workspace}}` 与 §8.6 的禁令字面冲突（虽分属不同字段，读者极易混淆）。

**建议改法**
在 `§8.4` 包装脚本机制下新增「变量注入约定」小节：

> **注入约定（脚本类）**：包装脚本以**环境变量**注入，变量名 = `AI_` + 入参名大写（如 `AI_ENDPOINT`），工作区注入为 `AI_WORKSPACE`；出参以 `echo "AI_OUT_<name>=<value>"` 单行输出，包装脚本解析。示例：`原型图/mock-data.js:293` 改为 `curl -sf "$AI_ENDPOINT/health"`。
> **注入约定（prompt 类）**：`OP.content` 中允许 `{{name}}` 引用本 OP 的入参（`{{workspace}}` 引用工作区）；**该语法仅适用于 OP.content，不适用于 Client.argsTemplate**（后者见 §8.6）。
> 统一后：`§8.6` 的禁令括注补一句「（OP.content 的 `{{workspace}}` 不受此限，见 §8.4）」。

---

### G18. 校验提示文案只定义 8 条，其余规则的文案由原型自造

**证据**
- 文档只给 8 条：`proposal-01-界面设计.md:1334`—`proposal-01-界面设计.md:1343`（缺少 Start / 缺少 End / Start 有入边 / End 有出边 / Start 无出边 / End 无入边 / 从 Start 不可达 / 无法到达 End）。而规则共 11 条（`proposal-01-界面设计.md:1320`—`proposal-01-界面设计.md:1330`）。
- 原型自造文案：`原型图/mock-data.js:1549`「Workflow 只能有一个 Start 节点（当前 N 个）」、`原型图/mock-data.js:1551` 同 End、`原型图/mock-data.js:1566`「有 N 条连线引用了不存在的节点」、`原型图/mock-data.js:1589`「DAG 存在环 …（回跳请用 on_failure 条件边 + 重试）」、`原型图/mock-data.js:1600`「节点 X 的 required 入参 Y 没有来源」、`原型图/mock-data.js:1608`「Workflow 的 required 入参 X 没有来源」、`原型图/mock-data.js:1620`「…没有明确汇聚来源」。
- 原型自己在 `原型图/mock-data.js:1490`—`原型图/mock-data.js:1493` 注明了这一缺口（「其余 3 条规则按同一措辞风格补充」）。

**为什么是问题**
「多 Start / 多 End / 悬挂边 / 引用的 OP 不存在」都是必然出现的失败分支，文案未定义 → 后端与前端会各写一份，测试无法写断言。

**建议改法**
在 `proposal-01-界面设计.md:1343` 后补 4 行：
```
| 多个 Start | "Workflow 只能有一个 Start 节点（当前 N 个）" |
| 多个 End | "Workflow 只能有一个 End 节点（当前 N 个）" |
| 连线引用了不存在的节点 | "有 N 条连线引用了不存在的节点" |
| 节点引用的 OP 不存在 | "节点 X 引用的 OP 不存在" |
```
并把原型 `mock-data.js:1589` 的环文案与 §10.14「DAG 无环（除循环回跳）」对齐，补进同一张表。

---

### G19. Client 行内展开详情首行缺「格式」，与 §16.1 UC-C2 / §19.1 不符

**证据**
- `proposal-01-界面设计.md:2424`：「`| UC-C2 | 展开/折叠 Client | … | 行内展开详情，**描述与类型/输出格式同一行展示** |`」
- `proposal-01-界面设计.md:2672`：「`| Client 行内展开详情 | 点击名称在条目下展开详情表格：**第一行=类型+格式+描述**，第二行=二进制路径；…`」
- 原型第一行只有「类型 / 描述」：`原型图/client.html:519` `detailRows += '<tr><td class="dt-k">类型</td><td class="dt-v">' + escText(c.type) + '</td><td class="dt-k">描述</td>…`；输出格式另起一行：`原型图/client.html:523` `'<tr><td class="dt-k">outputMode</td>…'`

**为什么是问题**
文档规定三要素同一行，原型把它拆成两行（且把「格式」的 label 写成 `outputMode` 字段名而非「格式」），属于文档↔原型行内结构不一致。

**建议改法**
- 原型：`client.html:519` 改为
  ```js
  detailRows += '<tr><td class="dt-k">类型</td><td class="dt-v">' + escText(c.type) + '</td><td class="dt-k">格式</td><td class="dt-v">' + escText(c.type === 'prompt' ? (c.outputMode || '-') : '-') + '</td><td class="dt-k">描述</td><td class="dt-v">' + escText(c.description) + '</td></tr>';
  ```
  并删掉 `client.html:523` 的 outputMode 独立行（jsonPath 保留在同一行末尾或并入「格式」列）。
- 或改文档 `proposal-01-界面设计.md:2672` / `proposal-01-界面设计.md:2424` 为「第一行=类型+描述，随后行=输出解析 mode/jsonPath」。二者择一。

---

### G20. 术语不一致：`activation/attempt` vs 字段 `retrySeq`

**证据**
- `proposal-01-界面设计.md:1765`：「`│    └ 下拉选项(按 activation/attempt 降序): 第2次成功 / 第1次失败  │`」
- 字段定义：`proposal-01-界面设计.md:1644`：「`  retrySeq: number;         // activation 内第几次尝试（含首次；首次=1，apply_retry +1）`」；`proposal-01-界面设计.md:1682`：「由 `(activationSeq, retrySeq)` 唯一区分」。
- 原型用 `(a{activationSeq}/r{retrySeq})`：`原型图/index.html:1025` `label: '第 ' + h.retrySeq + ' 次 · (a' + h.activationSeq + '/r' + h.retrySeq + ') · ' + d`

**为什么是问题**
`attempt` 在全文只出现这一次，与 `retrySeq` 指同一概念却不同名；文中还有「第几轮重试」「执行次数」等近义表达（§15.2），容易让实现者以为要多加一个字段。

**建议改法**
改 `proposal-01-界面设计.md:1765`：「`└ 下拉选项（按 (activationSeq, retrySeq) 降序，即「第 {retrySeq} 次 · (a{activationSeq}/r{retrySeq})」）`」，并在 §12.3 的字段注释里补「本文中 attempt 一律指 retrySeq，不再单独使用该词」。

---

## 轻微

### L1. 原型引用了不存在的章节 §18.2
`原型图/index.html:573`：「`// M3/N6：前端轮询间隔经 GET /api/settings 读取（crud-06 3.3 / proposal-01 §18.2 D1 定稿）——`」。
机械核对结果：文档 §18 只有 `18.0.1 / 18.0.2 / 18.0.3 / 18.1 / 18.1.1 / 18.1.2 / 18.1.3`，**无 18.2**；轮询口径实际在 `proposal-01-界面设计.md:2026`（§12.10）。
**建议**：改为「proposal-01 §12.10（D1 定稿）」。

### L2. 原型误引 §10.3 说明 Job 内容
`原型图/mock-data.js:500`：「`target: { … },   // proposal-01 §10.3：daily_cleanup → OP clean_logs v2（落后当前 v3 → needsUpdate）`」。
§10.3 是「Start / End 固定节点」（`proposal-01-界面设计.md:880`）；该断言属 §11.2/§13.2。
**建议**：改为「proposal-01 §11.2 / §13.2」。

### L3. [重跑] 的「target 仍存在」条件指向的章节里没有该条件
`proposal-01-界面设计.md:1723`：「`> - `[重跑]` 仅要求 Run 已结束且 **target 仍存在**（见 12.8.5）。`」
但 `proposal-01-界面设计.md:1990` 的表里「重跑」前提只写「`仅终态可重跑（waiting / running / terminating 不可）；无版本限制`」，**未提 target 存在性**。
**建议**：把「target 仍存在（OP / Workflow 未被删除）」补进 §12.8.5 的重跑前提列。

### L4. `nextRunAtMs` 定义后无任何界面落点（机械核对：唯一 0 命中的字段）
`proposal-01-界面设计.md:1372`：「`  nextRunAtMs?: string | null; // 计算字段（不落库）：schedule 已启用且非 needsUpdate 时的下次触发时间；其余为 null（见 crud-04 4.5）`」。
而 §11.3 的列（`proposal-01-界面设计.md:1413`—`proposal-01-界面设计.md:1421`）与 §11.4 编辑器都没有该字段；机械核对显示它是 76 个文档字段中**唯一在整个原型目录 0 次出现**的字段。
**建议**：在 §11.3 列表或行内详情增加一行「下次触发」（`nextRunAtMs`，null 显示 `-`），或在 §11.2 注明「该字段仅供接口消费，界面不展示」——二选一。

### L5. 版本筛选硬编码 1/2/3
`原型图/index.html:248`：`<option value="1">1</option><option value="2">2</option><option value="3">3</option>`。
文档：`proposal-01-界面设计.md:1716`「`| 版本 | 全部 / `1` / `2` / `3` …（**纯数字**） |`」——省略号意味着不定长。
**建议**：原型改为按当前 Run 集合动态生成选项（或注明「原型仅示例 1–3」），文档把「…」改为「按现有 Job 修订号动态生成」。

### L6. `/api/runs/{runId}/status` 定义与 §12.10 的轮询口径互斥
`proposal-01-界面设计.md:2567`：「`| GET | `/api/runs/{runId}/status` | 轻量接口，仅返回状态和最后更新时间（轮询用） |`」
`proposal-01-界面设计.md:2032`：Run 详情轮询的接口写的是 `/api/runs/{runId}`（完整详情）。原型只用了后者（`原型图/index.html:1158`）。
**建议**：§12.10 表格「接口」列改为 `/api/runs/{runId}/status`（列表用 `/api/runs`），并在 §17.5 注明两者差异（详情首次进入用完整接口，轮询用轻量接口）。

### L7. Client 测试对话框的「参数」是硬编码，与所测 Client 无关
`原型图/client.html:801`：`document.getElementById('testArgs').textContent = '-p hello --output-format json';`（与编辑器里的 `原型图/client.html:276` `value="-p {{prompt}} --output-format json"`、mock 的 `--print --output-format json --model sonnet` 都不同）。
文档 `proposal-01-界面设计.md:491` 只给了示例「`│  参数: -p hello --output-format json                │`」，**未说明取值来源**。
**建议**：§8.8 补一句「『参数』= 该 Client 的 `argsTemplate` 将占位符替换为示例值后的结果；`inputMode=stdin` 时追加固定测试提示词」；原型按此实现。

### L8. §19 前端独立界面清单未收录「设置界面」
`proposal-01-界面设计.md:2665`—`proposal-01-界面设计.md:2762`（§19.1–§19.6）逐界面清点了列表/编辑器/弹窗，**没有 settings.html**，而 §4.2（`proposal-01-界面设计.md:135`—`proposal-01-界面设计.md:154`）把它定义为必需界面，原型也已实现（`原型图/settings.html`）。
**建议**：在 §19.6 通用组件之前补一节「19.5.x 设置界面：左侧分组导航（10 组）+ 右侧表单；只读项不可编辑；[保存] 调 `PUT /api/settings`；[恢复默认] 调 `POST /api/settings/reset`」，并把 §19 后各节顺序说明一并更新。

### L9. §4.2「不作独立徽标」与 settings.html 在 desc 里写「（🔄）」
`proposal-01-界面设计.md:154`：「「🔄 重启后生效」**不作独立徽标**，仅用于 `job_queue_running_max` 派生的 **Worker 池大小**（下次启动重新初始化），在该项 desc 注明。」
`原型图/settings.html:179`：`desc:'全局 running 状态 Job Run 数量上限（默认 10，最大 10）；限制即时生效，仅派生的 Worker 池大小重启后生效（🔄）。'`
**建议**：删掉原型 desc 中的 `（🔄）`，或把文档改为「可在 desc 末尾附 🔄 标记（不作为独立徽标）」。

### L10. ZIP 成员顺序：树与声明矛盾
`proposal-01-界面设计.md:1295`—`proposal-01-界面设计.md:1297`（树）把 `manifest.json` 排在 `workflow.yaml` **之前**，而 `proposal-01-界面设计.md:1305` 声明「成员顺序以…为准：`workflow.yaml` → `manifest.json` → `ops/<opName>.yaml`」；Job ZIP 同理（`proposal-01-界面设计.md:1539`—`proposal-01-界面设计.md:1541`）。
**建议**：把树里两行调换（`workflow.yaml` / `job.yaml` 在前），使树与声明一致；或把声明改为「顺序不作约束」。

### L11. `retry` 的展示文案固定写「持久 Job / 重试」，virtual Run 重试会被错标
`原型图/mock-data.js:52`：`retry: '持久 Job / 重试'`。
但 §12.8.5 认可「virtual Run（单次执行 Workflow）终止/超时后重试」，此时 Run 的 `jobKind` 仍是 `virtual`，界面却显示「持久 Job / 重试」。
**建议**：改为按 `jobKind` 生成（`(r.jobKind === 'persistent' ? '持久 Job' : '单次执行') + ' / 重试'`），或在 §12.4 触发方式说明中把「重试」独立为一档（不含 Job 形态前缀）。

### L12. Client 列表「输出解析」列标题两处不同
`proposal-01-界面设计.md:395`（ASCII 表头）：「`│  Client名称    Client类型   二进制路径              输入方式        输出解析  操作  │`」；`proposal-01-界面设计.md:421`（列说明表）：「`| 输出解析方式 | …`」；原型用「输出解析方式」：`原型图/client.html:509`。
**建议**：统一为「输出解析方式」（同时改 ASCII 表头）。

---

## 需拍板

> 以下 8 项必须在改文档/写代码之前定口径。每项给「选项 + 影响面 + 我的建议」。

**D1（对应 S1）Workflow 的校验是否作为保存/执行的前置条件？新建草稿能否保存？**
- 选项 A：保存不校验（允许草稿），仅「执行」前后端校验 → 需改 `proposal-01-界面设计.md:2454`。
- 选项 B：保存强制校验 → 必须同时规定「新建 Workflow 首次保存豁免校验」，否则新建流程彻底不可用。
- **建议 A**：理由是目前原型已是 A（`workflow.html:1888`），且「草稿可保存」更符合 §13.4 描述的「用户进入编辑器逐步修改后保存」的工作方式。
- 影响面：§10.9 / §10.14 / §16.3 / §19.3 + `workflow.html` / `mock-data.js:validateWorkflowOf`。

**D2（对应 S2）OP 节点的 `clientId` 缺省行为**
- 选项 A：`clientId` 由「可选」改为「必填」。选项 B：保留可选，定义回退为「该 OP 类型下 `createdAtMs` 最早的 Client」。
- **建议 A**（契约最清晰；B 的隐式回退难以审计，且会与 Job 配置产生歧义）。
- 影响面：§10.2 / §10.3 / §10.11 + crud-03 校验 + `workflow.html:1444`。

**D3（对应 S3）是否允许保存「存在 required 入参无来源」的 Workflow？「未绑定」是否进入数据模型？**
- 选项 A：新增 `{kind:"unbound"}`，校验按 G14 的判据拦截保存。选项 B：沿用「空字面量」，允许保存、仅执行前报错。
- **建议 A**（否则 §10.10「自动带出全部入参（未绑定状态）」这句话没有落点）。
- 影响面：§10.2 / §10.4 / §10.10 / §10.14 + crud-03 + `workflow.html:1291`/`1537`。

**D4（对应 S4）Client 下拉是否按 OP 类型过滤？后端是否强制校验类型匹配？**
- 选项 A：前端过滤 + 后端 400 校验（双保险）。选项 B：仅前端过滤。
- **建议 A**（§8.3 已把匹配写成硬契约，后端不校验则配置可绕过）。
- 影响面：§8.3 / §8.5 / §9.6 / §10.11 / §11.4 + `job.html:893` / `workflow.html:1445` / crud-04。

**D5（对应 G7）运行历史「触发」筛选的粒度**
- 选项 A：拆成 5 个值（manual / schedule / single_op / single_workflow / retry）→ 与 API 单值枚举天然对应。选项 B：合并「单次执行」为一项，需给 `triggeredBy` 支持多值（`triggeredBy=single_op,single_workflow`）。
- **建议 A**（不改接口契约；原型已是 A）。
- 影响面：§12.4 / §18.1.3 + crud-05 3.5.1 + `index.html:243`。

**D6（对应 G1）cancelled Run 是否提供 [重试]？**
- 选项 A：提供（与 §12.8.2/§12.8.5 一致）。选项 B：不提供（与 §12.4 展示条件/§12.6 按钮表一致）。
- **建议 A**（终止前若已有失败/超时 step，从该 step 重试是合理需求，且 can-retry 接口已能判定）。
- 影响面：§12.4 / §12.6 / §12.8 + `index.html:868`/`1280`。

**D7（对应 G9）画布「未执行」与「等待中」是否同一状态？cancelled 节点的图标/文案**
- 选项 A：三态分离（waiting 等待中 / skipped 未执行 / cancelled 已取消），按 §12.6 表实现。选项 B：把「未执行」并入「等待中」（原型现状）。
- **建议 A**（运行历史是给人看结果的，必须区分「没轮到」与「被中止」）。
- 影响面：§12.6 + `index.html:1196`/`1344`/`1360` + `workflow-canvas.css`。

**D8（对应 G12）Job 列表「工作区」列的取值来源**
- 选项 A：`Job.workspace`（定义值）。选项 B：最近一次 Run 的 `workspace`（实际值）。
- **建议 A**（与 §11.4 编辑器字段同源，避免「列表显示的和编辑里配的不一样」）；若需展示实际值，另加一列「最近运行工作区」。
- 影响面：§11.3 + `job.html:625`。

（其余可低成本决策的项：G6 timeout 取值范围 / G16 导入上限语义 / G17 OP.content 占位符语法——建议一并在此轮拍板，见对应条目的「建议改法」。）

---

## 修复顺序建议

按「数据模型 → 状态口径 → 示例 → 文案术语」的依赖顺序推进；理由是：前面的决定会改变后面条目的正确写法，倒序修会返工。

**第 1 批（阻塞级，必须最先定）：拍板 D1–D4，再修 S1–S4**
- 理由：D1（校验前置）、D2（clientId 契约）、D3（未绑定语义）、D4（类型匹配校验）决定 `WorkflowNode` / `ParamBinding` / 校验内核的最终形态；S1–S4 是它们的直接后果。这四项同时影响文档 §8.3/§10.2–§10.14/§16.3 与 `workflow.html`/`job.html`/`mock-data.js` 的校验函数，**改动面最大、且其他条目的措辞都引用它们**（例如 G13 出参下拉、G14 汇聚规则、G18 提示文案都要等 D3 定了判据才能写死）。
- 交付物：文档补丁（§8.3 增后端校验句、§10.2 增 `unbound`、§10.3 clientId 必填、§10.9 校验与保存关系）+ 原型校验函数对齐。

**第 2 批：统一运行历史（§12）的状态与操作口径**
- 条目：G1、G2、G5、G9、G10、G4、D5、D6、D7、D8（含 L6 接口口径）。
- 理由：全部集中在同一张状态表与同两个视图（列表 + OP/Workflow 详情），互相引用（例如 G2 的按钮可见性依赖 D6 的结论，G9 的状态文案依赖 D7）。一次改完可避免「改三遍示例表格」。
- 交付物：§12.4/§12.5/§12.6/§12.8/§12.10 的表格与示例 + `index.html` 的 `STATUS_MAP` / 按钮渲染 / 详情页开关。

**第 3 批：统一示例数据与界面结构（纯文本/渲染，无新决策）**
- 条目：G3、G11、G12（若 D8 定为 A）、G19、G13。
- 理由：只依赖第 1、2 批的结论，改的是「同一事实的复述」；先把口径定死再改示例，可避免示例又与新口径冲突。G13 略微特殊（涉及原型控件替换），但依赖 D2 已定。
- 交付物：§10.9/§11.3/§12.6/§19.1/§19.3 示例行 + `client.html` 展开行 + `workflow.html` 出参控件。

**第 4 批：配置项与术语清理（无依赖，可并行批量处理）**
- 条目：G6、G15、G16、G17、G18、G20、L1–L12。
- 理由：这些是「补定义 / 改措辞 / 修引用」，互不影响，也不影响任何代码结构；放最后可一次性把全档的交叉引用与数值复述刷新一遍（含 `L1 §18.2`、`L2 §10.3` 这类会误导实现的错误引用）。
- 交付物：§4.2/§8.4/§8.6/§8.8/§8.9/§9.2/§10.13/§10.14/§11.7/§17.5/§19.8 的局部补丁。

**回归验证建议（每批完成后）**
1. 重跑本次三个脚本（`_mech.py` / `_mech2.py`，`_line.py` 用于定位），确认：§ 引用 0 处不存在、枚举两侧一致、76 个字段 0 个「文档有原型无」。
2. 对第 1、2 批额外做「口径表交叉检查」：把 §12.4 操作按钮表、§12.6 头部按钮表、§12.8.2 五条件三者并排比对同一状态行是否同结论（这是本次问题最密集的区域）。
3. 原型侧加手动走查清单：新建 Workflow 能否保存、成功 Run 操作列按钮数、cancelled Run 画布文案、Job 编辑器 Client 下拉项数与 OP 类型的关系。

---

*（本报告仅审查 `proposal-01-界面设计.md` 与 `原型图/*`；`proposal-02-*`、`schema.sql`、`tasks.md`、`tests/` 仅在文档显式回链时作为佐证引用，未纳入问题判定。）*
