# 修复口径（第 2 轮，R2 校验后拍板，**唯一权威**）

> 依据：R2 五路校验报告 `_val3_01_ui.md` / `_val3_02_be.md` / `_val3_03_tests.md` / `_val3_04_proto.md` / `_val3_05_global.md`；本轮**全部按下列结论执行**（用户已授权「按推荐执行」，其中 D6 为保留续跑）。
> 修复后：各自写 `_fix_v3_<组号>.md`（## 已修项表 / ## 未修项与原因 / ## 自检证据）。**不要写入本文件**。
> 规则：只改自己负责的文件；按本口径改会冲突则**报告并暂停该项**，不要自创第三种口径。

## 一、必须修的实现缺陷（`_val3_*` 报告的严重项）

1. **D2 闭环（UI S1 / UI-P1 → 采纳 A）**：`crud-03` 3.3.3/3.3.4 **只做字段级校验**（规则 9/10/11/16 + position 等字段类），**拓扑/连通/绑定类规则（1–8、13–15）不在保存时执行**，仅在 `[校验]` 与「创建 Run 前」执行。须同步 `crud-03` 3.3 规则表分区、3.3.3/3.3.4 错误表、4.4 执行前校验；与 `proposal-01 §10.9`（允许保存草稿）一致。
2. **D6 续跑边状态初值（BE S1 / 拍-1 → 采纳「复制源 Run 终态边状态」）**：在 `crud-03 4.3.4②` 与 `crud-05 3.5.8④` 明确：新 Run 初始化时 ①**种子节点的入边置 `activated`**；②**前缀节点集的出边按其源 Run 终态边状态复制**（已满足的保持 `activated`/已决定态），使菱形汇聚节点的 join 判定不因缺边永久 `pending`；③前缀节点集合以「已执行过」（`completedOnce=true`）作初值参与就绪/汇聚判定，但仍不写入新 Run 的 `step_records`。补一句「否则多入边节点（如 End）会永久 pending 导致 Run 卡死」的说明。
3. **crud-04 导入规则「三处 name 必相等」自相矛盾（BE S2）**：改为按 D10 的**四项锚逐一对应**（`manifest.job.name` ↔ 包内 `job.yaml.name`；`manifest.target.name` ↔ `manifest.target.file` 指向文件内 `name`；`manifest.workflow.name` ↔ `workflows/<name>.yaml` 内 `name`；`manifest.ops[].name` ↔ `ops/<file>` 内 `name`），**不得要求 `job.name` 与 `target.name` 相等**；并用与样例一致的示例。
4. **原型 `job.html` 回归（UI S2 / proto S2）**：编辑既有 Job（target=op）时 Client 被清空、[保存] 必报错 → 修复为「按 OP 类型过滤后仍能正确回填当前 `target.clientId`；若该 Client 类型匹配则保留，不匹配才给错误提示」。必须做 pre/post 对照。
5. **原型 D5 错误码（UI/proto S1）**：`mock-data.js` 等处 Client 类型不匹配一律返回 `400 CLIENT_TYPE_MISMATCH`（4 处），`message` **逐字**为 `Client 类型与 OP 类型不匹配：OP <opName> 为 <opType>，Client <clientName> 为 <clientType>`（**不得加「节点 X：」等前缀**）。
6. **原型未执行节点标记（proto S3）**：仅**终态** Run 的未执行节点标「⊘ 未执行」；非终态 Run 的未执行节点保持「等待中」；终态 `cancelled` 的 waiting 记录归「未执行」（与 `proposal-01:1920` 一致）。
7. **缺 400 行（global G-1）**：补齐 `crud-03` 4 个端点 + `crud-04` 2 个端点（含 3.3.8/3.4.9）的 `400 VALIDATION_ERROR` 内联错误行。
8. **D1 旧口径残留**：`schema.sql:218` 的「记录数-1」注释改为「每轮尝试次数（首次执行计入）」（与 crud-03 一致）。
9. **陈旧术语**：`crud-05` + `tasks.md` 共 8 处 `settings \`X\`` 改为「配置项 `X`（`ai-automation.json`）」类表述。
10. **`tasks.md` 残留**：`:230` 的旧「7 条校验集」改按 crud-03 现行规则条数（**改后为 16 条**，见二.4）；`:157` 不再要求建 `ConfigRepo`（改为读取 `ai-automation.json` 的 Config 服务模块）。
11. **原型 L1**：`index.html:573` 的 `§18.2` 改为真实章节（`§12.10`）。
12. **`index.html:1301` 未转义 title**：改用既有 `escText`/`escJsStr` 工具。

## 二、拍板结论（R2 需拍板项）

1. **P2（UI）`Workflow.outputs[].from`**：**采纳 A** —— 新增可判定校验规则（`from` 必须指向存在节点且出参名存在，否则校验不通过），`proposal-01 §10.14` + `crud-03 §3.3` 同步；原型改为**双下拉**（节点 + 出参），不再手输 UUID。
2. **P4（UI）原型 mock 与后端契约同构**：**采纳 A** —— mock 视为可执行规格：类型不匹配返回 `CLIENT_TYPE_MISMATCH`、`execute` 前做拓扑校验返回 400 `VALIDATION_ERROR`、提示统一为文档文案；导入体积上限 mock 也返回 400。
3. **触发/来源文案统一（UI-P3 + proto-P4）**：筛选下拉与列表列**各用一套固定措辞，分隔符统一 ` · `（前后各一空格）**：
   - 筛选（`triggeredBy`）：`全部触发` / `手动` / `定时` / `单次执行 · OP` / `单次执行 · Workflow` / `重试`；
   - 列表列展示：`持久 Job · 手动` / `持久 Job · 定时` / `单次执行 · OP` / `单次执行 · Workflow` / `重试`。
   `proposal-01:1742` 的 `单次执行·OP` 规范为 `单次执行 · OP`；原型 `index.html:243` 的筛选下拉改为筛选措辞（现误用列措辞）。
4. **「汇聚」规则（global P-2 / proto P2）**：**采纳 A —— 删除该校验项**。`crud-03:119` 规则 8 改为说明性文字（不构成校验失败），规则总数 **17 → 16**（`:309` 同步）；`proposal-01 §10.5` 口径不变。
5. **`#n` 行内编号（global P-3 / BE 拍-4）**：**采纳 A** —— 跨文件引用一律改**具名**（如 `crud-04 3.4.6「job_queue_waiting_max 语义」`）；各文件在小节内加编号对照表（若保留 `#n`）；`tests` 中的 `#n` 改为「数据集行 n」。`proposal-01 §20.1` 补登新增编号并与正文对应。
6. **环内「前置」定义（proto P1）**：**采纳 (a)** —— 参数绑定下拉**剔除自身及从当前节点正向可达的节点**（即在允许环的图里，回跳环下游不得被当作前置）；写入 `proposal-01 §10.4/§10.14` 与原型实现。
7. **`client_type` 校验条目（proto P3）**：`proposal-01 §10.14` 补一行「OP 节点 `clientId` 的 Client.type 须与 OP.type 一致」（与 D5 一致）。
8. **`proposal-01:2309`（§15.2）`max` 语义（tests D-2）**：改为「每轮**尝试次数**（首次执行计入）」，与 crud-03 同步。
9. **D11 示例值（tests D-3）**：示例中的 `bash-build`（实为 Client 名）**替换为中性锚示例**（如 `manifest.target.name=deploy_workflow`），4 处（`proposal-02`、`crud-03`、`crud-04`、`tests`）一次性同步。
10. **`manifest.clients[].clientId`（tests D-4）**：**不校验**存在/唯一（仅记录名称↔导出时 id 的对应关系）；在 `crud-03`/`crud-04` 明确「不校验」，并把 `tests:1220` 的「仍应唯一」改为「夹具数据质量要求（各包内不重复），导入不校验」。
11. **`job_queue_running_max` 下限（tests D-1）**：`crud-06` 补下限 **1**（范围 `1..10`），使 `tests` 的临时调低构造有据。
12. **导入包体积上限键（BE 拍-2）**：**沿用现有 `op_import_max_bytes`** 作为 ZIP 包（Workflow/Job）体积上限（包内主体为 OP YAML），在 `crud-03`/`crud-04`/`crud-06` 写明该沿用关系；**不新造键**。
13. **多失败 step 的续跑种子（BE 拍-3）**：取**最后失败/超时**的那条 StepRecord（与 3.5.5「以最后一条记录为准」同向）；`crud-03 4.3.4` 与 `crud-05 3.5.8` 同步。
14. **运行入口校验顺序（BE 拍-5）**：统一为 **D12**（`job_queue_waiting_max` 上限最先）；`crud-04 3.4.6` 与 `:584` 对齐（`crud-05 3.5.7/3.5.8` 已合规）。
15. **`validation.md` 权威关系（global P-1）**：`_fix_v2_decisions.md` + 本文件为唯一权威；`validation.md` 由**协调者**在每轮末尾重写（含处置状态），修复者**不得修改**。
16. **`cancelled`/`waiting` 夹具（proto P6）**：补最小夹具（使 D15/G9 分支可自动验证）。

## 三、其余（按各自 `_val3_*` 报告逐条修）

各组按自己范围报告的**一般/轻微**项逐条修（含：`crud-04 3.4.6` 顺序、`crud-03` 恢复路径丢失续跑种子、`crud-05`/`tests` 的 `settings` 术语、tests 的 E1 映射表 `target=OP` 与 `TC-E1b` 冲突、E1a 第 1 步构造风险、E4a~d 标题前缀、ZIP 容器两谱系说明、原型超时 1.5 被截断、未执行边虚线、D4 可达过滤、tests `#n` 等）。修完在报告逐条列明。

## 通用要求

1. 只改自己负责的文件（见各自提示词）；UTF-8，**保持各文件原行尾**，不整文件换行转换。
2. 交叉引用必须指向真实存在章节；新增章节用下一可用编号。
3. 改完必须**机械自检**（旧措辞 0 残留、新措辞到位、引用存在、`node --check`/jsdom/`sqlite3`/ZIP SHA256 视文件类型），命令与结果写入报告。
4. 完成后回复 ≤200 字：改了哪些文件、各项落地位点、未落地项与原因。
