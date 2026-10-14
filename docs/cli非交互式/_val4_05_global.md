# 跨文档全局一致性独立校验报告（第 4 轮 · `_val4_05_global.md`）

- 角色：**独立校验员（第 3 轮 / 全集交叉核对）**。**只读**——仅新增本报告，未改动任何被审文件；全部校验脚本落在 `C:\Users\Public\val4\`（仓库外），未在被审目录落任何临时文件（`sqlite3` 工作库 `t.db` 亦在仓库外）。
- 范围：`proposal-01-界面设计.md`(3124)、`proposal-02-后端设计.md`(435)、`proposal-02-后端crud-01..06`(1100/409/1465/687/719/395)、`schema.sql`(356)、`tasks.md`(321)、`tests/集成测试用例.md`(2003)、`tests/fixtures/**`、`validation.md`(67)、`_fix_v2_*` / `_fix_v3_*`（作为「声明」比对物，非重审对象）、`原型图/**`（10 文件）。
- 行号基准：**改后物理行号**（按 `\n` 归一后计数；原型 `.html` 含 BOM 亦按行计）。
- 双重目标：①核实第 2 轮（`_fix_v3_*`）全局类修复；②找新问题，重点为「文档 / 测试 / 原型」**三向一致**。

**结论摘要**：R2 的**编号与引用类**修复（跨文件 `#n` 具名化、`tasks.md` 口径、`crud-0x` 错误表 400 行、`schema.sql` 尝试计数、错误码总表计数）**经机械核对完整落地**；但 R2 声明的「**全部已修**」**与实测不符**：**7 项**（含原型侧 5 项）未落地（S-3）。并新发现 **1 处真正的四方分叉**（`Workflow.outputs[].from` 校验规则只有 `proposal-01` 一户落地，S-1）、**1 处新引入夹具的非法枚举**（S-2）、以及 **6 处**文档/测试/原型三向不一致（N-1～N-6）。共报 **22 项** —— 严重 3 / 一般 7 / 轻微 8 / 需拍板 4。

---

## 统计

| 分档 | 数量 | 编号 |
|-|-|-|
| 严重 | 3 | S-1 … S-3 |
| 一般 | 7 | N-1 … N-7 |
| 轻微 | 8 | L-1 … L-8 |
| 需拍板 | 4 | P-1 … P-4 |
| **合计** | **22** | — |

| 类别 | 项数 | 明细 |
|-|-|-|
| R2 声明「已修」但**未落地** | 7 | 触发列表列文案、原型 `slugName`、`settings.html` D14/D18 文案、原型「配置目录」、`EXPORT_UNAVAILABLE`、`crud-03` 保留天数参数化、`crud-03:1093 attempt`；另 `crud-04 4.5.x` 未提级（同属 N-2）→ 汇总为 **S-3** |
| 本轮**新发现**的四方/三向不一致 | 6 | S-1（`from` 校验）、S-2（夹具枚举）、N-1（触发列文案）、N-4（运行上限下限）、N-6（`4.5.x` 引用可解析性/计数句）、L-4/L-5（记号与字段名） |
| 仅**一处**存在的自相矛盾/计数失实 | 4 | N-2、N-3、N-5、N-7 |
| 术语与措辞 | 6 | L-1、L-2、L-3、L-6、L-7、L-8 |

### 机械核对结论（脚本可复现，全部落 `C:\Users\Public\val4\`）

| # | 检查 | 方法 | 结果 |
|-|-|-|-|
| 1 | 交叉引用 `crud-0X N.N` | `refs.py`（标题级/加粗级双判定） | **387 处全部命中**（0 悬空）；但其中 `crud-04 4.5.1–4.5.6`（`c04:611/631/655/664/674/680`）仍是**行内加粗**而非标题级，故 `p02:361` / `tasks:298` / `tests:1804` 三处章节级引用**只能靠加粗解析**（见 N-6） |
| 2 | 交叉引用 `§x.y` | 同上 | **163 处全部命中**（按「本文件 → proposal-01 → proposal-02」归因） |
| 3 | 交叉引用 `proposal-0X §N` | 同上 | **24 处全部命中**（中文章号，如 `tasks:42` `§2（二、模块划分）`） |
| 4 | `schema.sql 第 N 节` | 同上 | **8 处全部命中**（`crud-01:77`/`crud-02:74` 已改「第 1/2 节」） |
| 5 | 路径参数端点错误表 `400` 覆盖 | `eps.py`（按 `#{2,6}` 分节，标题含 `{...}` 者） | **c01 5/5、c02 5/5、c03 8/8、c04 9/9、c05 8/8 全部含 400**（原 6 处缺失均已补） |
| 6 | 行内 `#n` 编号 | `hash.py` | 全库 `#n` 仅 **7 处**，全部为「规范/对照/报告」性质（`p01:2936`、`p01:2968`、`c03:547`、`val:53`）；**跨文件 `#n` 实际引用 = 0** |
| 7 | 错误码唯一性 | `codes.py`（解析 `proposal-02 §10.1` 表 + 全库反引号大写 token 双向比对） | 总表 **27 行 / 26 个 code**（与表头 `p02:336` 自述一致）；**总表内 26 个 code 全部出现、0 未使用**；**唯一编外 code = `EXPORT_UNAVAILABLE`**（`原型图/mock-data.js:2249`，未登记 §10.1 → 见 S-3e） |
| 8 | 枚举比对 | `enumchk.py` + ZIP/夹具扫描 | `retry.on` = `failure`/`success` ✓；`triggeredBy` 5 值 ✓；`EdgeCondition` = `on_success`/`on_failure`/`always` ✓（**唯一例外见 S-2**）；`job_runs.status` 7 态 ✓；`run_node_state.status` = `pending`/`running`/`done`/`skipped` ✓；`terminated_by` = `timeout`/`cancelled`/`error` ✓ |
| 9 | 默认值/上限 | 逐处比对 | `job_queue_waiting_max` 20/1000 ✓；`job_queue_running_max` 10、上限 10 ✓（**下限 1 缺原型，见 N-4**）；`poll_interval_ms` 2000 / `runner_poll_interval_ms` 1000 ✓；`timeoutSeconds` 1..86400/60 ✓；`max_loop_multiplier` 0 或 1..10000 ✓；`engine_event_retention_days` 软删=该值/硬删=+1 ✓（**唯一硬编码处见 S-3f**）；`page_size` 10/50/100/1000 默认 10 ✓；两件导入上限键 `client_/op_import_max_bytes` 1048576 ✓ |
| 10 | `schema.sql` 实跑 | `sqlite3` 3.50.6：`.read schema.sql` → `.read seed.sql` → `.read seed_terminal_states.sql` | 三脚本均 **0 错误**；`pragma_table_info` 抽查一致（见 S-2 取证） |
| 11 | ZIP 夹具成员序/内容 | `zipfile` 逐成员读取 | 6 个 ZIP 成员序与 `tests:22`/`:26` 声明**逐项一致**（`workflow.yaml|job.yaml → manifest.json → workflows/ → ops/`） |
| 12 | 术语漂移 | `terms.py`/`settings.py` | `settings \`X\`` 全库 **0**；`配置目录` 残留 **1**（`mock-data.js:1265`）；`0=不限制` **0**；`每轮重试次数` **0** |

---

## R2 修复核对表

> 判定口径：**✓ 完整落地** = 机械检索旧措辞 0 残留且新措辞出现在全部应出现处；**◐ 部分**；**✗ 未落地**。证据为改后实测行号。

| R2 项（提示词点名） | 判定 | 证据 |
|-|-|-|
| **跨文件 `#n` 具名化（原 9 处跨文件引用）** | **✓** | 跨文件 `#n` 实测 **0**（`hash.py`）；9 处原引用处现均为具名，例：`c03:397`「crud-04 3.4.6『全局 waiting 队列上限的适用范围』」、`c03:1356` 同、`c05:356/364/440/648`「crud-04 3.4.6『`job_queue_waiting_max` 的语义』」、`tasks:263` 同、`c03:547` 为**对照说明**（有意保留，已声明） |
| **`validation.md` 权威关系（不再与拍板相反）** | **◐** | 关系已修：`val:6` 声明 `_fix_v2_decisions.md` + `_fix_v3_decisions.md` 为唯一权威、并说明 D6 差异；旧版「D6 建议 B（从头跑）」整表已移除 → **不再与拍板相反** ✓。但 **`val:9`「处置：全部已修」与实测不符**（见 S-3） |
| **`tasks.md` 与文档口径一致（16 条校验集 / 无 `ConfigRepo` / 无 `settings \`X\``）** | **✓** | `tasks:230`「**crud-03 3.3「校验规则」全部 16 条**」；`tasks:157`「**不引入 `ConfigRepo` trait**」；全文 `settings \`X\`` = 0（仅存 `/api/settings`、`settings.rs`、`settings.html` 等路径/文件名）；`tasks:29/48/95/122/123/125/140/143/156/163/227/228/233/240/275` 与 `crud-03/06` 同口径 |
| **`crud-0x` 错误表 400 行齐全** | **✓** | 机械核对 #5：**35 个含路径参数端点 100% 含 400**；原缺 6 处（`c03:355/504/626/651`、`c04:474–479/586–591`）均已补 |
| **术语统一（运行目录 / 配置项 / 汇聚）** | **◐** | 「运行目录」✓（`p01:139` 已由「配置目录」改「当前运行目录」）；「配置项 `X`（`ai-automation.json`）」✓（10 处正例，`settings \`X\`` = 0）；「汇聚」✓（`c03:148` 仅说明性文字，规则总数 16 条、「17 条」0 残留）。**残留 1 处**：`原型图/mock-data.js:1265`「runDir：当前**配置目录**」（S-3d）；另 `tests` 3 处用 `settings.<键>` 点号写法（L-1） |
| **触发与来源文案两套措辞与原型一致** | **✗** | 筛选下拉 ✓（`index.html:245` 六项含 `单次执行 · OP`/`单次执行 · Workflow`，分隔符 ` · `）；**列表列 ✗**：`原型图/mock-data.js:54-55` 仍 `'持久 Job / 手动'` / `'持久 Job / 定时'`，而 `p01:1771` 展示映射为 `持久 Job · 手动` / `持久 Job · 定时`（决策二.3「分隔符统一 ` · `」）→ 见 **S-3a / N-1** |
| R2 其余声明项（逐组报告） | **◐** | 见 **S-3** 表（7 项未落地）；其余已核：`crud-04` 四项锚（`c04:509-514`）、`crud-03` D6 边状态初值（`c03:1289-1298` ①–⑤，与 `c05:394` 同口径）、`crud-03` D2 闭环（`c03:110-115/246/284/329/393`）、导入体积沿用 `op_import_max_bytes`（`c03:558`/`c04:543`/`c06:74`/`mock-data.js:1916/1941`）、`job_queue_running_max` 下限 1（`c06:287/297`）、`schema.sql:219-221` 尝试计数（空格式 `记录数 - 1` 残留 → 见 N-7）、`tests` 用例 91（末表逐格自洽）、`tests:1788` 数据集行口径（`（数据集行 9：\`running\`）`）、`c03:1278`+`c05:392` 多失败取最后一条 ✓、`c04:313-318`+`:599` 顺序 waiting 上限最先 ✓ |

---

## 严重

### S-1【严重】`Workflow.outputs[].from` 校验规则**只有 `proposal-01` 一户落地**——契约基准（`crud-03`）、原型（内核 + 校验面板）、测试三处全缺，形成四方分叉

**位置与原文**：

- `proposal-01:1352`（§10.14 校验表新增行）：
  > `| 出参来源必须有效 | 每个 \`Workflow.outputs[].from\` 的 \`workflowNodeId\` 必须**存在且为 op 节点**，\`outputName\` 必须在该节点 OP 定义的 \`outputs[].name\` 中；任一不满足 → 校验不通过（决策-出参来源校验） |`
- `proposal-01:1375-1376`（§10.14 失败提示表，两行）：
  > `| 出参的来源节点不存在 | "出参 X 的来源节点不存在" |` / `| 出参的来源出参不存在 | "出参 X 的来源出参不存在" |`
- `proposal-01:2966`（§20.1 登记）：
  > `| \`决策-出参来源校验\` | 每个 \`Workflow.outputs[].from\` 必须指向**存在的 op 节点**且 \`outputName\` 在该 OP 出参中；否则校验不通过 | proposal-01 §10.14；**crud-03 3.3「校验规则」** |`

**对照（三处均无此规则）**：

1. `crud-03:108-148`（§3.3 校验规则，**契约基准**）：A 组 9/10/11/16、B 组 1–7/13–15、C 组 12/17 → **共 16 条，无任何 `outputs[].from` 条**；`crud-03:329`（3.3.6 功能说明）列举为「Start/End 存在与入出边、连通性、可达性、Required 有来源、绑定指向前置节点、`clientId` 非空与类型匹配等」——亦无。
2. `crud-03:108` 反而声明：
   > `…**与 \`proposal-01 §10.14\` 逐条并列，唯一差异 = 第 17 行「允许环」**…`
   而 `proposal-01 §10.14`（`:1338-1352`）**共 13 行、无「第 17 行」**，且 `p01:1356` 自述「本表**未逐条列出**的绑定与出边类约束（如 op 节点必须绑定 `opId` + `opVersion`、Start 不允许 `on_failure` 出边）以 crud-03 为准」——**两文件对「是否逐条并列」自相矛盾**（另见 N-2）。
3. 原型：`原型图/mock-data.js:1623-1719`（`validateWorkflowOf` 校验内核）只做 Start/End、入出边、可达、clientId+类型、required 有来源、绑定指向前置 6 类，**无 `outputs[].from` 判定**；`原型图/workflow.html:1776-1789`（`WF_CHECK_RULES`）**12 项**中亦无此项。
4. 测试：`tests/集成测试用例.md` 全文无「出参来源」断言（仅 `tests:780` 的字段映射行 `| 出参 | outputs[] | name / from(workflowNodeId.outputName) / description |`）。

**冲突依据**：R1 已定「**以 `crud-03` 为契约基准**（D8）」；`_fix_v3_decisions.md` 二.1 明确要求「**`proposal-01 §10.14` + `crud-03 §3.3` 同步**」，**只落了 `proposal-01` 一侧**（`_fix_v3_A_ui.md` 第 15 行自述为 A 组新增，C 组报告 `_fix_v3_C_wf.md` 未提及此项）。

**后果**：实现者按 `crud-03 §3.3`（契约基准）实现 → 后端 `[校验]` / 创建 Run 前**不会**拦 `outputs[].from` 悬空；而界面 `§10.14` 与原型校验面板都把它当「校验不通过」→ 同一张图「前端 ✗ / 后端 ✓」；`p01:2966` 指向 `crud-03 3.3` 的出处是**悬空主张**。属「会写错实现」。

**建议改法**（二选一并三处同步）：
- **A（推荐，与 §10.14 一致）**：`crud-03 §3.3` 增规则 **18「出参来源必须有效」**（归 A 组「字段与结构类」，保存时执行 + `[校验]`/导入/创建 Run 前），并把 `crud-03:108/115/148/329/393` 的「共 16 条」→「共 17 条」、「编号 8 留空」措辞同步；`crud-03:108` 的「逐条并列」句改为「与 `proposal-01 §10.14`（界面可见项 13 行）**按语义对应**，本表为完整集（17 条）」；原型 `mock-data.js` 内核补该判定、`workflow.html:1776` 清单补 1 项；`tests` 在 TC-W1 增一步负向断言。
- **B（低成本）**：把该条从 `proposal-01 §10.14` 的「校验不通过」降为**前端录入期提示**（双下拉已从结构上消除大部分非法值），并删 `p01:2966` 的 `crud-03 3.3` 出处；`crud-03` 保持 16 条。

---

### S-2【严重】R2 新增夹具 `seed_terminal_states.sql` 的 `edges[].condition` 用了**非法枚举值 `success`**（应为 `on_success`）——新增用例 TC-R4 的前置数据不合契约

**位置与原文**：`tests/fixtures/tc_r1/seed_terminal_states.sql:37-39`
```
 '[{"from":"wnode-tc-r4-start","to":"wnode-tc-r4-a","condition":"success"},' ||
 '{"from":"wnode-tc-r4-a","to":"wnode-tc-r4-b","condition":"success"},' ||
 '{"from":"wnode-tc-r4-b","to":"wnode-tc-r4-end","condition":"success"}]',
```

**实测取证**（`sqlite3` 3.50.6，`.read schema.sql` → `.read seed.sql` → `.read seed_terminal_states.sql`，三脚本 0 错误）：
```
sqlite> select edges from workflows where workflow_id='wfid-tc-r4-01';
[{"from":"wnode-tc-r4-start","to":"wnode-tc-r4-a","condition":"success"}, …]
```
（即 DB 层**照单全收**：`workflows.edges` 是 JSON TEXT，**无 CHECK、无枚举约束** —— 见 `.schema workflows`：`edges TEXT NOT NULL DEFAULT '[]'`。）

**对照（三处均定义 `on_success`）**：
- `crud-03:104`：`| condition | enum | 是 | \`on_success\` / \`on_failure\` / \`always\` |`
- `crud-03:746`：`…condition: "on_success"|"on_failure"|"always"…`
- `proposal-01:887`：`type EdgeCondition = "on_success" | "on_failure" | "always";`
- `原型图/workflow-canvas.js:32-34`：`ANCHOR_Y = { on_failure: 11.5, on_success: 21.5, always: 31.5 }` / `EDGE_COLOR = { on_success: … }`
- **其余全部夹具**均为 `on_success`（`tc_w3_01..11`、`tc_x3/workflow.yaml`、`tc_x4/*/wf_deploy_prod.yaml`、`tc_e2/workflow.yaml`）——本夹具是**唯一**例外。

**后果**：① 后端若按 `serde` 枚举反序列化 `workflows.edges`（Rust 实现正常写法），读取该 Workflow 会**解析失败**（500 / Run 卡住），TC-R4 将因「前置数据非法」而非断言失败；② 若像原型那样做 `EDGE_COLOR[cond] || '#16a34a'` 兜底（`workflow-canvas.js:104`），则**静默按 `on_success` 渲染** —— 用例「断言通过但数据口径已错」，属**假绿**；③ 与 `crud-03:104` 的字段表冲突，且该夹具是 R2 新增物（`_fix_v3_E_tests.md` 第 34 行），属**本轮新引入**。

**建议改法**：三处 `"condition":"success"` → `"condition":"on_success"`，并在文件头注「`edges[].condition` 取值域 = `on_success`/`on_failure`/`always`（crud-03:104）」；同时在 `seed.sql`（`tc_r1`）复查同字段（实测该文件不写 `edges`，✓ 无需改）。**并建议把「夹具内枚举值 ∈ 契约枚举」纳入下一轮机械判据**（当前无任何门禁覆盖）。

---

### S-3【严重】R2「处置：全部已修」声明**失实**：7 项未落地（原型 5 + `crud-03` 2），且 `validation.md` 与各组报告均记为已完成

**位置与原文（声明侧）**：
- `validation.md:9`：`> **处置：全部已修**（第 2 轮修复，见 §三；其中 6/7 组因 API 端点故障中断，经「审计 + 续作」补齐）。`
- `validation.md:52`（原型组行）：`| \`原型图\` | 4 项回归修复 + \`op.html\` 超时拒 1.5 + 导出树序 + cancelled 终态夹具 + **Run 详情 [自动刷新] 开关与独立轮询**（G10/G3/L6）；探针 25/25、jsdom 6/6 |`
- `_fix_v3_F_proto.md`「未落地与原因」只列 G3/G10 与文档侧同步，**未列下列 5 项原型残留**；`_fix_v3_C_wf.md`「未落地与原因」把 N-4 归为「`schema.sql` 注释（另路由 D 组）」，D 组报告则声明 `schema.sql` 本轮无改动 → **N-4 无人认领**。

**未落地清单（逐项实测）**：

| # | 项 | R2 依据 | 实测现状（行号 + 原文） |
|-|-|-|-|
| a | 触发**列表列**文案分隔符 | 决策二.3「分隔符统一 ` · `」；`p01:1771` 已改 | `mock-data.js:54-55`：`manual: '持久 Job / 手动',` / `schedule: '持久 Job / 定时',`；`index.html:340/373` 占位亦为 `持久 Job / 手动`（`/`，非 ` · `） |
| b | 原型删 `slugName`（上轮 N-6） | `_val3_05_global.md` N-6 建议「`mock-data.js:90-98` 删除 `slugName`（或改恒等）；`client.html:928` 改 `'client-' + name + '.yaml'`」 | `mock-data.js:96-98` 仍在且实现小写化（`… .toLowerCase()` 语义）；`client.html:927-928`：`// G4：默认文件名用**真实 name 的 slug**` + `'client-' + slugName(name) + '.yaml'`；`client.html:421` 静态占位 `value="client-claude_code.yaml"` |
| c | `settings.html` D14/D18 文案（M-4） | `_val3_05_global.md` M-4「`0=不限制（按 max×3）` 正是 D14 明令废止的措辞」 | `settings.html:186`：`desc:'循环节点执行总次数上限；0=不限制（按 max×3），否则与 max×3 取较小值。'`；`:187`：`desc:'失败调度事件保留 1 天后软删除、2 天后物理删除。'`（硬编码 1/2） |
| d | 原型「配置目录」（M-3 / T3） | M-3 建议改「当前运行目录」 | `mock-data.js:1265`：`// runDir：当前配置目录（由 CLI 入口 -c 指定；未指定默认 ~/.ai-automation）；` |
| e | `EXPORT_UNAVAILABLE` 处置（M-5） | M-5：二选一（改 `INTERNAL_ERROR` 或登记 §10.1） | `mock-data.js:2249` 仍 `__err('EXPORT_UNAVAILABLE', …)`；`proposal-02 §10.1`（`:340-366`）**无此行** → 全库唯一编外 code |
| f | `crud-03` 保留天数参数化（N-4） | N-4 建议改「`engine_event_retention_days` 天后软删 → 再 1 天后物理删除」 | `crud-03:920`：`| **执行失败**（某 step 失败导致整体 failed/timeout/cancelled） | **保留**（可能重试）；最终不重试 → **1 天后软删除**（置 \`soft_deleted_at_ms\`）→ **2 天后物理删除**；… |`（`crud-03` 是 Engine 机制契约出处） |
| g | `crud-03:1093` 时序图字段名（M-1 / L-11） | M-1 建议改 `step_completed{step_id, activation_seq, retry_seq, result}` | `crud-03:1093`：`│ ←── step_completed{step, act, attempt, result} ──│`；同文件 `:843` 已是 `step_completed{run, step, activation_seq, retry_seq, result}` |
| h | `crud-04 4.5.x` 提为标题级（N-2） | N-2 建议 `**4.5.x**` → `#### 4.5.x`（否则 3 处章节级引用无法被标题级工具解析） | `c04:611/631/655/664/674/680` 仍为 `**4.5.1 …**`…`**4.5.6 …**`；而 `c05:535/687/705` 为 `### 4.6/4.7/4.8`；引用方 `p02:361`、`tasks:298`、`tests:1804` |

**问题**：`validation.md` 是「唯一留存报告」（其 `:6` 自述），却对 7 项给出「已修」的**反向结论** —— 与上一轮 F-1 是**同一系统性来源**（自述未经验证）。后果：下一轮校验者/实现者会认为「原型即规格已合规」，`mock 视为可执行规格`（决策二.2）下的 5 处原型残留会被 T2.1 直接搬运进 `ui/`。

**建议改法**：① 由协调者把上表 a–h 逐项**改派并回填**（a/d/c/e 属原型、f/g 属 `crud-03`、h 属 `crud-04`）；② `validation.md` 的「处置：全部已修」改为**分档**表述（如「已修 88 项 / 未落地 7 项，见本轮 `_val4_05_global.md` S-3」），并把「各组报告的『已修』声明必须附机械判据」写入流程要求；③ 下一轮强制判据：`grep "持久 Job /" = 0`、`grep slugName = 0`、`grep "0=不限制" = 0`、`grep "配置目录" = 0`、`grep EXPORT_UNAVAILABLE = 0 或 §10.1 含该行`、`crud-03 保留天数句含 engine_event_retention_days`、`grep "attempt, result" = 0`、`crud-04 4.5.x 为 ### 级`。

---

## 一般

### N-1【一般】触发**列表列**文案（原型 vs 文档）两套措辞不一致——R2 只改了筛选下拉，列展示未改

**位置与原文**：
- 契约/界面：`p01:1771`（§12.4 列表列说明）：
  > `| 触发方式 | 展示映射（由 \`triggeredBy\` 生成）：manual → \`持久 Job · 手动\`；schedule → \`持久 Job · 定时\`；single_op → \`单次执行 · OP\`；… |`
- `_fix_v3_decisions.md` 二.3：筛选与列展示「各用一套固定措辞，**分隔符统一 ` · `（前后各一空格）**」。
- 原型：`原型图/mock-data.js:53-58`
  > `var TRIGGER_TEXT = { manual: '持久 Job / 手动', schedule: '持久 Job / 定时', single_op: '单次执行 · OP', single_workflow: '单次执行 · Workflow', retry: '重试' … };`
- 静态占位：`原型图/index.html:340` `<p class="sub" id="wfDetailTrigger">触发: 持久 Job / 手动</p>`、`:373`（`wfInfoTrigger`）。

**问题**：同一「列表列展示文案」在文档（` · `）与原型（` / `）并存；`index.html` 的动态渲染走 `TRIGGER_TEXT`（`mock-data.js:60 triggerTextOf`），静态占位与之同源，故**5 个值中有 2 个**不符；而 `single_op`/`single_workflow` 已是 ` · ` → **同一对象内两种分隔符**。属三向（`p01` / 原型 / `tests`）中「文档↔原型」两向冲突；`tests` 未断言该列文案（无第三方仲裁）。

**建议改法**：`mock-data.js:54-55` 改 `'持久 Job · 手动'` / `'持久 Job · 定时'`；`index.html:340/373` 静态占位同步；加判据 `grep "持久 Job /" = 0`。

---

### N-2【一般】`crud-03:108` 的「与 `proposal-01 §10.14` 逐条并列，唯一差异 = 第 17 行」**计数与指称均失实**

**位置与原文**：
- `crud-03:108`：
  > `**校验规则**（**共 16 条**；**导入 3.3.9 同口径**…；**与 \`proposal-01 §10.14\` 逐条并列，唯一差异 = 第 17 行「允许环」**）：`
- `proposal-01 §10.14`（`:1338-1352`）：**13 行**（Start/End 唯一、Start 无入边、End 无出边、Start≥1 出边、End≥1 入边、OP 从 Start 可达、OP 能到达 End、`clientId` 非空、client_type、绑定指向前置、required 有来源、出参来源有效），**没有「第 17 行」**；环的要求写在 `:1354` 的注里。
- `p01:1356` 自述：
  > `> **本表范围**：本表为**界面可见的校验提示项**；完整规则集…见 **crud-03 3.3「校验规则」**——本表**未逐条列出**的绑定与出边类约束（如 op 节点必须绑定 \`opId\` + \`opVersion\`、Start 不允许 \`on_failure\` 出边）以 crud-03 为准。`

**问题**：`crud-03` 说「两边逐条并列、只差一条」，`p01` 说「本表不完整、以 crud-03 为准」→ **契约基准对界面文档的比对声明反了**；且「第 17 行」在 `p01 §10.14` 中不存在（对外引用即悬空）。实际差异至少 4 条（`opId`+`opVersion`、Start 无 `on_failure` 出边、绑定出参存在、出参来源有效，另 `p01` 无「悬挂 clientId」说明性条）。

**建议改法**：`crud-03:108` 改为「与 `proposal-01 §10.14`（界面可见项 **13 行**）**按语义对应**，本表为完整集（**16 条**，编号 8 留空）；二者差异项 = opId+opVersion 绑定、Start 无 on_failure 出边、绑定出参存在、悬挂 clientId 说明、允许环」；若采纳 S-1 的方案 A，则同步为 17 条。

---

### N-3【一般】原型校验内核/校验面板**缺 `crud-03` 规则 9 与 16**，且内核注释的规则编号与 `crud-03` 编号体系不一致

**位置与原文**：
- 契约：`crud-03:121` `| 9 | 每个 op 节点必须绑定 opId + opVersion | 400 \`VALIDATION_ERROR\` |`；`crud-03:124` `| 16 | **Start 出边约束**：Start 无失败语义，不允许 \`on_failure\` 出边… |`
- 原型内核注释（`mock-data.js`）：`:1632` `/* 规则 1 / 2…*/`、`:1653` `/* 规则 3 / 4 / 5 / 6…*/`、`:1663` `/* 规则 7 / 8：所有 OP 节点从 Start 可达 / 能到达 End */`、`:1672` `/* 规则 9（D3/D5）：所有 OP 节点必须指定 Client；Client 类型必须与 OP 类型匹配 */`、`:1676` `/* 规则 10 / 11（D4）：所有 required 入参必须有来源…；参数绑定必须指向前置节点 */`
- 实现体（`:1624-1719`）：无 `opVersion` 校验（仅在 `:1696` 检 `OP_BY_ID[n.opId]` 存在性）；无 Start `on_failure` 出边校验。
- `workflow.html:1776-1789`（`WF_CHECK_RULES`）12 项亦无这两项。

**问题**：① 规则编号体系**逐条错位**：`mock` 的「规则 7 / 8」在 `crud-03` 里是**一条**（规则 7），「规则 8」在 `crud-03` 已**删除留空**；`mock` 的「规则 9」对应 `crud-03` 的 10/11；「规则 10 / 11」对应 `crud-03` 的 15/14 → 读者按 `mock` 注释回查 `crud-03` 会**查到别条**。② `crud-03` 规则 9/16 在原型无实现：`tasks:94`（T2.1）要求以 `原型图/*` 为**视觉基线**「复用 DOM/CSS/交互结构」，`mock` 校验内核是唯一可搬运的校验实现 → `ui/` 会继承缺失（与 `p01:1356`「以 crud-03 为准」的要求冲突）。

**建议改法**：① `mock-data.js` 5 处「规则 N」注释改**具名**（`/* 校验：Start/End 唯一性（crud-03 规则 1）*/` 等），杜绝与 `crud-03` 编号互串；② 内核补 `opVersion` 存在/一致性判定（可复用 `:1166/1167` 的 `needsUpdate` 内核）与「Start 无 `on_failure` 出边」判定，并在 `workflow.html:1776` 清单补 2 项（与 S-1 的清单补项合并做）；③ 若不补，则在 `tasks:94/102` 写明「原型校验内核**不作为**校验基线，`ui/` 校验一律以 `crud-03 §3.3` 为准」（需拍板 P-2）。

---

### N-4【一般】原型配置校验缺 `job_queue_running_max` **下限 1**，与 `crud-06` 及 `tests` 的构造相冲突

**位置与原文**：
- 契约：`crud-06:287` `| \`job_queue_running_max\` | 10（**范围 1..10**，默认 10） |`；`:297` `> **\`job_queue_running_max\` 合法取值**：整数，**范围 \`1..10\`**（**下限 1**、上限 10，默认 10）；< 1 或 > 10 → 400 \`VALIDATION_ERROR\`。`
- 原型上限表：`mock-data.js:1309` `'history.job_queue_running_max': 10,`（**仅上限**）；校验逻辑 `:1753-1758` 只判 `v > LIMITS[gk]`（无下限分支）。
- 原型文案：`settings.html:179` `desc:'全局 running 状态 Job Run 数量上限（默认 10，最大 10）…'`（未提下限）。
- 测试：`tests:1794` / `tests:1823` 明确要求「调 `settings.job_queue_running_max=1`（**下限 1、上限 10**，见 crud-06 一）」——这是 E1/E1c 用例的**唯一可行构造**（因上限=默认值，只能调小）。

**实测**：`mockFile` 的 PUT `/api/settings` 传 `{"history":{"job_queue_running_max":"0"}}` 或 `"-3"` → **不报错**（`isNaN` 通过、无下限判定），且 `__deriveWorkerPool`（`:1323`）会因 `parseInt(...)||10` 把 0 当 10 → **静默接受非法值**；而后端按 `crud-06:297` 必须 400。

**建议改法**：`mock-data.js:1303-1319` 的上限表增下限支持（如 `'history.job_queue_running_max': {max:10, min:1}`）并在 `:1753-1758` 判 `v < min`；`settings.html:179` 文案补「范围 1..10」；`settings.html` 控件补 `min:1`。

---

### N-5【一般】原型 `workflow.html` 校验面板的**条数自相矛盾**（12 项数组 vs 注释「11 条」/「8+3 条」），且与 `p01 §10.14`（13 行）数量口径不对齐

**位置与原文**：
- `workflow.html:1776-1789`：`var WF_CHECK_RULES = [ … ]` → 实测 **12 项**（start / end / start_in / end_out / start_out / end_in / reach / toward / client / client_type / required / binding_pred）。
- `workflow.html:1791` 注释：`/* 接口 errors 文案 → 规则 key（§10.14 的 **8 条失败文案** + 其余 **3 条规则**的补充文案） */` → 8+3 = **11**。
- `workflow.html:1809` 注释：`/* 渲染校验结果：逐条渲染 **11 条**规则；… */` → **11**。
- `p01:1379`（失败提示表）：**15 行**（含「出参的来源节点不存在 / 来源出参不存在」等）。

**问题**：同一段代码内三处计数不一致（12 / 11 / 11），且 `§10.14` 引用已由 11 行变 13 行、提示表 15 行 → 注释与引用**全线过期**；`wfErrRuleKey`（`:1792-1807`）也未覆盖 S-1 的两条出参错误文案（会落 `return ''` → 附加条目），与 `:1810` 注释「不在 11 条内的 errors 作为附加条目列出」自相印证其**清单缺失**。

**建议改法**：`WF_CHECK_RULES` 或注释统一为「**14 项**（= `proposal-01 §10.14` 13 行 + Start 无 `on_failure`）」（与 N-3/S-1 同步一次改到位）；`wfErrRuleKey` 补 `出参` → `output_from` 分支；把「11 条」字样全清。

---

### N-6【一般】`crud-04 4.5.1–4.5.6` 未提为标题级，3 处章节级引用只能「靠加粗解析」——跨文件引用规范未收口

**位置与原文**：
- 目标侧：`crud-04:611` `**4.5.1 注册与热更新（生命周期）**`、`:631` `**4.5.2 cron 触发流程（到点）**`、`:655` `**4.5.3 …**`、`:664` `**4.5.4 …**`、`:674` `**4.5.5 …**`、`:680` `**4.5.6 错误与日志**`（均为**行内加粗**）。
- 对照：`crud-05:535` `### 4.6 统一任务执行器（Task Runner）`、`:687` `### 4.7 终止`、`:705` `### 4.8 重跑 vs 重试`（**标题级**）。
- 引用方：`proposal-02:361`（`**crud-04 4.5.2（cron 入口）**`）、`tasks:298`（T10.12 参考列 `crud-04 4.5.2`）、`tests:1804`（`（crud-04 4.5.2：命中上限跳过、不报 409）`）。

**问题**：R2 的 `N-2` 建议（提级或加说明句）**未落地**；本轮 `refs.py` 之所以仍报 0 悬空，是因为脚本额外放宽了「行内加粗」形态 —— 任何**按 `#{2,6}` 取章节**的工具（含本轮基准解析器、文档站生成器、IDE 大纲）都会判**悬空**；同文件内 `4.5.x`（加粗）与 `4.6/4.7/4.8`（`###`）层级语义不一。

**建议改法**：`c04:611/631/655/664/674/680` 六处改 `#### 4.5.x …`（`### 4.5` 为父级）；改后把「按 `###` 解析 crud 章节引用」设为下一轮机械判据（当前 387 处中若有 3 处依赖加粗，应降为 0）。

---

### N-7【一般】`schema.sql:221` 的「重试次数（派生展示量）= 记录数 - 1」**无任何消费方**，是 D1 旧口径的**同形残留**

**位置与原文**：`schema.sql:219-221`
```
--      本轮尝试计数 = 同 (run_id, step_id, activation_seq) 记录数 = 每轮尝试次数（首次执行计入）,
--                     即 retry.max 的判定基准（retry.max=3 -> 每轮 3 次尝试, 见 crud-03 4.3.0 / 4.3.2）;
--                     重试次数（派生展示量, 非判定基准）= 记录数 - 1。
```

**对照**：`validation.md:37` 把 `schema.sql` 的「记录数-1」列为 R2 待修项并声明「→ **已修**」；`_fix_v3_D_run.md` 自检写「旧串 `记录数-1`=**0**」（成因：旧串写的是 `记录数-1`（无空格），现文是 `记录数 - 1`（带空格）→ **机械判据被字形绕过**）。

**问题**：① 全库检索「重试次数」= **0 处**（`p01`/`c03`/`c05`/`tests` 均无该展示量的定义或界面字段）→ 该「派生展示量」**没有任何消费方**，属凭空引入的新概念；② 数值等于「记录数 − 1」正是 D1 拍板**废止**的读法，写在 DB 层唯一事实来源里极易被再次误引（上一轮 N-8 即因此发生）；③ 「已修」的判据不严密（空格变体未纳入），说明 R2 自检口径可被字形规避。

**建议改法**：删除 `schema.sql:221` 该行（若确需展示量，应先在 `crud-05` 定义字段名与界面位置）；下一轮判据改为**去空格正则** `记录数\s*[-−]\s*1` = 0。

---

## 轻微

### L-1【轻微】`tests` 用 `settings.<键>` 点号写法（3 处），与 `crud-06` 的分组路径不同名

- 现文：`tests:1794`「`settings.job_queue_running_max=1`（**下限 1、上限 10**…）与 `settings.job_queue_waiting_max=2`」、`tests:1823` 同、`tests:1880`「设 `settings.max_loop_multiplier=2`」。
- 对照：`crud-06:66-90` 的配置路径为 **`history.job_queue_running_max`** / **`engine.max_loop_multiplier`**；`tests:1763` 自身的 PUT 示例用的是 `{"log":{"log_level":"debug"}}`（分组键式）→ **同一文件内两种写法**。
- `_fix_v3_E_tests.md` 第 43 行声明「保留（非旧口径 `settings \`X\``）」。**建议**：统一为「配置项 `history.job_queue_running_max`=1（`ai-automation.json`）」或「设 `history.job_queue_running_max`=1」，避免与 `/api/settings` 的端点名混读（属拍板 P-4）。

### L-2【轻微】完成钩子「同物两名」仍无一处映射说明

- `p01:1686` / `p02:65/75` / `tasks:310` / `c03:1025/1056/1065/1441` 用 `JOB_COMPLETE` / `STEP_COMPLETE`（全局 static）；`p02:91` / `c03:1058/1059/1069/1070` / `tasks:236/246` 用 `JobComplete` / `StepComplete`（实现类型名）。
- 唯一「对应」句在 `schema.sql:238-239`：「…完成调 `JobComplete` 钩子, 对应 static `JOB_COMPLETE`」。`crud-03 4.4` 无该映射句（`_fix_v3_D_run.md` 第 45 行已声明需三处定稿）。
- **建议**：在 `crud-03 4.4` 加一句「实现类型 `JobComplete` / `StepComplete`（`OnComplete`）与全局 static 实例名 `JOB_COMPLETE` / `STEP_COMPLETE` 为**同物的两个名字**」，或统一取一个（P-3）。

### L-3【轻微】原型注释笔误 `cord-05`

- `原型图/mock-data.js:1234`：`* 重试前提（can-retry 五条件，cord-05 3.5.9 / 4.8）：` → 应为 `crud-05`。
- **建议**：改 `crud-05`；并把「文件名/章节名笔误」纳入下一轮扫描（pattern：`c[or]{0,1}ud-\d`）。

### L-4【轻微】`crud-03:1093` 时序图仍用 `attempt`（同文件 `:843` 已用 `retry_seq`）→ 见 S-3g

- 现文 `c03:1093`：`│ ←── step_completed{step, act, attempt, result} ──│`；字段契约 `c03:736` `| \`step_completed\` | \`retry_seq\` | integer | …`。
- **建议**：改 `step_completed{run_id, step_id, activation_seq, retry_seq, result}`（与 `:843` 逐字一致）。

### L-5【轻微】`crud-03:1168` 的 `min(max*3, …)` 记号漂移

- 现文：`├─ 即将重试且该 (run_id, step_id) 的执行总次数 >= 上限 min(max*3, max_loop_multiplier) → 不再重试, 整个 Run 失败（循环上限）`
- 全库其余 45 处均为 `max × 3` / `max×3`（如 `c03:784`、`c03:1158`、`p01:2316`、`schema:222`）→ 唯一 `*` 写法（`*` 在 Markdown 内还有强调语义，易被误渲染）。

### L-6【轻微】`max_loop_multiplier = 0` 语义注未补到「结论性」三处（M-8 未补全处）

- 已补：`p01:2316/2321/2322/2962/3009/3101`、`c03:784`、`c06:82/296/363`、`tests:152/1766/1860/1882`。
- **未补**：`p01:30`（§1 硬约束 16：`16. **循环终止由 min(max × 3, max_loop_multiplier) 控制。**`）、`p01:2905`（§20 决策释义表：`| 循环终止 | min(max × 3, max_loop_multiplier) | 不依赖 Job / Workflow 时间 |`）、`c03:1168`（判定式）。
- **建议**：三处各补 6–10 字「（`max_loop_multiplier=0` 时 = `max×3`，见 §15.2 / crud-03 4.3.0 ①）」；否则读者代入 `0` 会得「立即触顶」。

### L-7【轻微】原型两处文案/占位与文档措辞微差

- `原型图/client.html:421`：`<input type="text" id="exportFileName" value="client-claude_code.yaml" />`（静态占位是 slug 化写法，与 `crud-01:405`「name 原样」冲突；与 S-3b 同源）。
- `原型图/job.html:739`：`var cronText = (job.trigger && job.trigger.kind === 'schedule') ? 'Cron: ' + … : '手动触发';` → 列表列（`:622`）与 `p01:1452` 用「手动」，而详情用「手动触发」；`p01:1434` 详情示例行为「触发方式: 0 2 * * *」。
- **建议**：占位改 `client-<name>.yaml`；`job.html:739` 改 `'手动'`。

### L-8【轻微】`workflow.html:1786` 注释已过期（称 `§10.14 未列`，实际 `p01:1349` 已列）

- 现文：`{ key: 'client_type', text: 'Client 类型必须与 OP 类型匹配' },   // m3：补充项（proposal-01 §10.14 未列，见 crud-03 规则 11；类型不匹配返回 400 CLIENT_TYPE_MISMATCH）`
- 对照：`p01:1349` 已是独立行「OP 节点的 Client 类型须与 OP 类型一致」。
- **建议**：注释改为「见 proposal-01 §10.14 第 10 行 / crud-03 规则 11」。

---

## 需拍板

| # | 待决事项 | 现状与冲突 | 建议选项 |
|-|-|-|-|
| **P-1** | `Workflow.outputs[].from` 是否作为**后端硬校验** | `p01:1352`（界面侧）+ `p01:2966`（登记，出处写 `crud-03 3.3`）已落地；`crud-03 §3.3`（契约基准）**无此条**、原型内核/面板无、`tests` 无断言（S-1） | **A（推荐）**：`crud-03` 增规则 18、总数 16→17，原型与 `tests` 同步（改动面：`crud-03` 6 处计数 + 1 条规则 + 原型 2 文件 + 1 个断言）；<br>**B**：降级为前端录入提示（删 `p01:2966` 的 crud-03 出处，保留双下拉）——改动最小、与「双下拉已从结构上消除非法值」自洽 |
| **P-2** | 原型（`mock-data.js` 校验内核 / `workflow.html` 面板）**是否为校验规格的一部分** | `tasks:94` 要求以 `原型图/*` 为视觉基线复用「DOM/CSS/交互结构」；决策二.2 采纳「mock 视为**可执行规格**」；但原型内核缺 `crud-03` 规则 9/16（N-3），面板缺 `from` 校验（S-1）、计数错（N-5） | **A（推荐）**：明确「原型校验内核**不作为**校验基线；`ui/` 的校验一律以 `crud-03 §3.3` 为准」，并在 `tasks:94/102` 写明（可避免 F 组持续追平契约）；<br>**B**：要求原型补齐至 `crud-03` 全 16（或 17）条，并把「原型内核 ≡ crud-03 §3.3」列为门禁 |
| **P-3** | 完成钩子命名是否收口为单一名 | `JOB_COMPLETE`/`STEP_COMPLETE`（static 实例名）与 `JobComplete`/`StepComplete`（类型名）并存；仅 `schema.sql:238-239` 有一句「对应」；D 组声明「须三处定稿」（L-2） | **A（推荐）**：保留双名 + 在 `crud-03 4.4` 补一句映射（零风险、改动 1 行）；<br>**B**：统一为 `JOB_COMPLETE`/`STEP_COMPLETE`（须改 `p02:91`、`c03:1058/1059/1069/1070/1337/1340/1361/1362/1376/1400/1405/1448`、`tasks:236/246`、`schema:238-239`，改动面大） |
| **P-4** | `tests` 的 `settings.<键>` 点号写法是否保留 | `tests:1794/1823/1880` 用 `settings.<键>`；同文件 `:1763` 用分组键 `{"log":{…}}`；`crud-06` 路径为 `history.`/`engine.` 分组（L-1）；E 组已声明「保留、改动无据」 | **A（推荐）**：统一为配置项全路径「配置项 `history.job_queue_running_max`」，与 `crud-06` 一致（3 处）；<br>**B**：保留 `settings.<键>`，但在 `tests` 顶部「通用规则」补一句「本文 `settings.<键>` 指 `PUT /api/settings` 请求体内的对应键，JSON 路径为 `<组>.<键>`」 |

---

## 修复顺序建议

**第 0 批（拍板，阻塞后续）**：**P-1 / P-2 / P-3 / P-4** —— 尤其 P-1（决定 `crud-03` 是 16 条还是 17 条，S-1 与 N-2/N-5 的改法都随之变化）与 P-2（决定原型是否继续追平契约）。

**第 1 批（契约级，先改；改完重跑本报告 §机械核对全部脚本）**
1. **S-1 + N-2 + N-5**（同一事实族，一次改到位）：按 P-1 结论同步 `crud-03 §3.3`（规则条数 + 规则 18）/ `p01:1356` 的「本表范围」/ 原型内核与面板（含 `from` 项）/ `tests` 断言；`crud-03:108` 的计数与「逐条并列」句改为实测值。
2. **S-2**：`tests/fixtures/tc_r1/seed_terminal_states.sql:37-39` 三处 `success` → `on_success`（并重跑 `sqlite3` 三脚本 + 查询复核）。
3. **N-4**：`mock-data.js:1303-1319`（上限表）与 `:1753-1758`（校验逻辑）补 `job_queue_running_max` 下限 1；`settings.html:179` 文案补「范围 1..10」。
4. **N-6**：`crud-04 4.5.1–4.5.6` 提为 `####` 级（改后确认 3 处引用可被 `#{2,6}` 解析）。

**第 2 批（S-3 未落地 7 项 + 原型契约，改动小、影响面广）**
5. **S-3a + N-1**：`mock-data.js:54-55`「持久 Job · 手动/定时」；`index.html:340/373` 同步。
6. **S-3b + L-7**：删 `mock-data.js:96-98 slugName`、`client.html:927-928` 改 `'client-' + name + '.yaml'`、`:421` 占位改 `client-<name>.yaml`。
7. **S-3c + S-3d + S-3e + L-3 + L-8**：`settings.html:186/187`（D14/D18 文案）、`mock-data.js:1265`（配置目录）、`:2249`（`EXPORT_UNAVAILABLE` → 按 M-5 二选一：改 `INTERNAL_ERROR` 或登记 §10.1）、`:1234`（`cord-05`）、`workflow.html:1786`（过期注释）。
8. **S-3f + S-3g + N-7 + L-4 + L-5 + L-6**：`crud-03:920`（保留天数参数化 + 指回 crud-06 一）、`c03:1093`（`retry_seq`）、`schema.sql:221`（删无消费方的「记录数 - 1」）、`c03:1168`（`max*3` → `max×3`）、`p01:30`/`p01:2905`（补 `0` 语义注）。

**第 3 批（措辞/流程）**
9. **L-1 + L-2**（随 P-3/P-4）：`tests` 配置项写法、钩子映射句。
10. **S-3 声明修正**：`validation.md` 的「处置：全部已修」改分档表述并在 `_fix_*` 报告上加机械判据（见 S-3 建议②）。

**复核要求（改完再跑一遍）**
- ① 交叉引用：`crud-0X`（含 `4.5.x` 标题级）/`§x.y`/`proposal-0X §N`/`schema 第 N 节` **0 悬空且 0 依赖加粗**；② 路径参数端点错误表 400 覆盖 **100%**（当前已达标，防回退）；③ 错误码：总表行数/唯一 code 与表头一致、**编外 code = 0**（当前 1 个 `EXPORT_UNAVAILABLE`）；④ 枚举唯一性：`EdgeCondition` 全库（含 fixtures）仅三值（当前 1 处违规 = S-2）；⑤ 关键字段唯一性：`retry_from_record_id`/`resumeFromRecordId` 无旧名残留、`retry_seq` 无 `attempt` 混用（当前 1 处）；⑥ 默认值/上限：`job_queue_running_max` 范围 `1..10` 在 doc/原型/测试三处齐；`max_loop_multiplier=0` 措辞全库一致（含 §1 硬约束与 §20 释义表，当前 2 处缺注）；⑦ 术语：`grep "持久 Job /" = 0`、`grep slugName = 0`、`grep "0=不限制" = 0`、`grep 配置目录 = 0`、`grep settings\s*\`` = 0；⑧ 跨文件 `#n` = 0（当前已达标）。
