# 跨文档全局一致性独立校验报告（`_val2_04_global.md`）

- 校验角色：**独立校验员（只读）**。被审文件一律未改动；本文件为唯一新增交付物（过程脚本 `_x_*.py` / `_x_*.txt` 已于完成后删除）。
- 范围：`docs/cli非交互式/` 下 `proposal-01-界面设计.md`(3054 行)、`proposal-02-后端设计.md`(420)、`proposal-02-后端crud-01..06`(1092/401/1329/640/643/375)、`schema.sql`(348)、`tasks.md`(320)、`tests/集成测试用例.md`(1904)、`validation.md`(52)、`原型图/*`(7 个文件)。
- 关注点：A 前后矛盾 / B 不易理解 / C 方案待完善 / D 需拍板。
- 结论：**共报 31 项** —— 严重 2 / 一般 11 / 轻微 12 / 需拍板 6。**交叉引用机械核对 0 悬空**（详见下节），主要问题集中在**校验契约分叉、测试环境口径、术语同义异名、错误表缺 400、行内编号体系**五类。

---

## 统计

| 分档 | 数量 | 编号 |
|-|-|-|
| 严重 | 2 | S-1、S-2 |
| 一般 | 11 | G-1 … G-11 |
| 轻微 | 12 | L-1 … L-12 |
| 需拍板 | 6 | P1 … P6 |
| **合计** | **31** | — |

| 关注点 | 项数 | 明细 |
|-|-|-|
| A 前后矛盾 / 不一致 | 14 | S-1、S-2、G-1、G-3、G-4、G-5、G-6、G-8、G-9、G-10、G-11、L-1、L-9、L-10 |
| B 不易理解（术语未定义 / 编号悬空 / 表述含糊） | 8 | G-7、L-2、L-3、L-5、L-6、L-7、L-11、L-12 |
| C 方案待完善（缺章节 / 接口 / 落地步骤） | 3 | G-2、L-4、L-8 |
| D 需拍板 | 6 | P1 … P6 |

被审文件交叉引用（机械核对，0 悬空）：`§x.y` 127 处 / `crud-0x N.N` 约 260 条 / `schema.sql 第 N 节` 9 处 / `proposal-0X 章节` 58 处 / `/api` 端点 55 个（双向 55/55 一致）/ 错误码 26 个（总表与内联表完全一致）。

---

## 一、校验方法（机械核对）与结果

### 1.1 方法

| # | 脚本 | 做什么 | 结果 |
|-|-|-|-|
| 1 | `_x_scan.py` / `_x_headings.txt` | 解析全部 `.md` 标题，建立「文件 → 章节号集合」 | 提取 138+173+… 共 **约 300 个编号章节**；`schema.sql` 无 md 标题（按 `-- N.` 注释另建） |
| 2 | `_x_refs.py` / `_x_refs.txt`（1029 行） | 提取全部交叉引用并逐条验证目标存在：① `§x.y` ② `crud-0x` ③ `crud-0X N.N`（含 `A/B`、`A/B/C`） ④ `crud-0X 第 N 章` ⑤ `schema.sql 第 N 节` ⑥ `proposal-0X §N` ⑦ 反引号大写错误码 ⑧ `/api...` 路由 | 见 1.2 |
| 3 | `_x_tags.py` / `_x_tags2.py` | 提取全部行内编号（`` `D1` `` 形式 + `（D1 定稿）`/`（#3）` 括号形式），并检测同行是否带出处（`crud-0x N.N` / `§` / `第N章`） | 见 1.3 |
| 4 | `_x_err400.py` / `_x_err400b.py` | 逐端点抽取「错误响应」块的状态码集合 | 见 1.4 |
| 5 | `_x_final.py` | ① crud 接口一览端点 ↔ `proposal-01 §17` 双向比对 ② 配置键出现位置盘点（含 4 个已废弃键） ③ `tasks.md` 子任务参考列非空抽查 | 见 1.5 |
| 6 | `_x_proto.py` + `findstr`/`find` | 原型调用面盘点：`mockFetch(` 计数、`mock-data.js` 装载点、mock 路由判定片段 | 见 1.6 |
| 7 | `_x_terms` 系列（人工筛读） | 同义异名清单 | 见第二节 |

### 1.2 交叉引用核对结果：**0 悬空**

- `§x.y`（`_x_refs.txt` 第 1 节，全库共 **127 处**：p01 30 / p02 21 / crud-01 1 / crud-02 1 / crud-04 1 / crud-05 1 / crud-06 2 / `tasks.md` 50 / `tests` 16 / `validation.md` 4）：**targets 全部命中，无一悬空**。
  - 唯一「own=False」是**编号体系混用**（非悬空，见 轻微-12）：`proposal-02` 用 `§7`/`§9`/`§10`/`§11`/`§2` 引用自身章节，而该文件标题用中文数字（`七、日志管理`、`九、CLI`）；`crud-01:75`/`crud-02:72` 用 `§1`/`§2` 引用 `schema.sql` 的 `-- 1.` / `-- 2.` 注释节。
- `crud-0x N.N`（第 3 节，共 **约 260 条子引用**）：**全部 `ok=True`**，含 `crud-03 4.3.0/4.3.1/4.3.2/4.3.3`、`crud-05 3.5.10`、`crud-06 3.4（P6）` 等深编号。
  - 唯一 `ok=False`：`tasks.md:296` → `crud-04 4.5.2`。这是**检查脚本的假阴性**：crud-04 的 4.5.1–4.5.6 是**行内加粗**（`**4.5.1 注册与热更新（生命周期）**`，crud-04:565 起），不是 `###` 标题，故未进章节集；目标**实际存在**。副产物发现：同一文档内 `4.5.x`（加粗）与 `4.6/4.7/4.8`（`###` 标题，见 crud-05）**层级样式不统一**（轻微-12 附带）。
- `schema.sql 第 N 节`（第 5 节，9 处）：全部 `ok=True`（第 4/7/8/9/10 节均存在；schema 实际有 10 节）。
- `proposal-0X §N / 第 N 章`（第 6 节，58 处）：52 处 `ok=True`；6 处 `ok=False` 全部为 `proposal-02 §2/§6/§7/§11`（中文数字章节），同上属编号体系混用。
- `crud-0X 第 N 章`（第 4 节，3 处）：`crud-05:467/469/470` 的「crud-01 第 5.1 节」「crud-03 第 4.3/4.4 节」**均存在** ✓。

### 1.3 行内编号核对（`_x_tags2.txt`）

- 反引号形式：`C1/C4/C7/D1..D7/S1/U1/T26/U13/V11-B` **全部在 `proposal-01 §20.1` 释义表内**（p01:2875-2897）✓。
- 括号形式（未在释义表内、且**全集无任何释义表**）：
  - `#1`(4) `#2`(4) `#3`(5) `#4`(4) `#5`(3) `#6`(3) `#7`(1) `#8`(1) —— 仅出现在 `crud-04`/`crud-05`（**通用-10**）。
  - `N1/P4/P6/Q1/Q2/Q4/R3/S1②/S2/S8/T13/T26/U1/U8/V4/W6/Z3/AA7/AA8/BB5/M17/M20/U13/V11-B` —— 见 **轻微-2**（出处缺失）。
- **未带出处比例**：`_x_tags2.txt` 统计 46 个编号中 **29 个存在「无出处」行**（例：`Z3` 唯一出现处 crud-03:725 无出处；`Q1/Q2/Q4/R3/N1/P4/W6/AA7/AA8/BB5/S2/S8/T13/U1/U8/V4/M20` 均如此），与 `proposal-01 §20.1` 自定的「**引用必须带出处**」（p01:2899）不符。

### 1.4 错误响应块状态码核对（`_x_err400b.txt`，61 个「错误响应」块）

- 完全无错误表的端点：`crud-06 3.1/3.2/3.3/3.5`（恒 200 或无输入，合理）。
- **有路径参数但错误表缺 `400 VALIDATION_ERROR`：10 处**（**一般-1**）。
- 反向核对：`§10.1` 总表 27 行 / 26 个 code，与全部 crud 内联错误表所用 code **完全一致，无编外 code、无表内未用 code** ✓（`TaskError::QueueFull`、`EXPORT_UNAVAILABLE` 除外，见 轻微-9）。

### 1.5 端点与配置键（`_x_final.txt`）

- **端点双向比对：55 个端点，`proposal-01 §17` 覆盖 55/55，crud 侧无多余、p01 侧无遗漏** ✓（无任何 `p01=N` 或「p01 有但 crud 无」）。
- 配置键：`_x_final.txt:61` 为出现位置矩阵，23 个在用键**无第二种拼写** ✓；4 个废弃键（`history_retention_days` / `run_log_retention_days` / `worker_queue_depth` / `scheduler_timezone`）**仅出现在各自的「已废弃」声明句中**（crud-06:102、crud-06:356、crud-04:562）✓。
- `tasks.md` 子任务：**参考列 0 空值** ✓（唯一非章节型参考是 T2.2 的「需求（构建打包进二进制、运行写到二进制目录）」，见 轻微-8）。

### 1.6 原型调用面（`_x_proto.txt` + 计数）

- 6 个页面**全部**在 `<script src="mock-data.js">` 之后直接调用 `mockFetch(...)`：`index.html` 12 处、`client.html` 8、`op.html` 9、`workflow.html` 12、`job.html` 10、`settings.html` 9 = **60 处**；`mock-data.js` 内 `mockFetch` 路由表覆盖 3.1–3.6 全部端点（1628–2130）。
- `index.html:7` 引入 **CDN SheetJS**（`https://cdn.jsdelivr.net/npm/xlsx@0.18.5/...`）。

---

## 二、同义异名清单（证据，供统一用词）

| # | 概念 | 出现的多种写法 | 出处（文件:行号） | 建议统一为 |
|-|-|-|-|-|
| T1 | 完成回调钩子 | `JOB_COMPLETE`/`STEP_COMPLETE`、`JobComplete`/`StepComplete`、`job_complete`/`step_complete`、`on_complete 钩子` | p02:58、p02:68、crud-03:884、crud-03:956/965/978/1199-1206、schema:230-231、crud-05:497、p01:1649 | 全局 static 名 `JOB_COMPLETE`/`STEP_COMPLETE`；trait 实现类型名 `JobComplete`/`StepComplete`；脚本注释不再用 `job_complete` |
| T2 | 节点重试条件 | `failure`/`success`（契约枚举）、`on=failure`/`on=success`（正文）、`on_failed`/`retry.on=failed`（测试）、`failed`（作为「结果」值） | p01:1007/1016-1017、p01:2239/2275/2324、crud-03:89/654/1067、tests:150/152/1867/1877/1879/1882/1887 | 枚举恒 `failure`/`success`；正文可写 `retry.on=failure`；**结果是 `failed`（区别于 retry 条件）**，需在 crud-03 加一行辨析 |
| T3 | 单次执行形态 | `virtual`、`virtual Job`、`virtual Run`、`临时 Job`、`临时运行`、`虚拟` | p01:1607（`jobKind: "persistent" \| "virtual"`）、p01:2058、p01:2924（`Job（持久 / 虚拟）`）、crud-04:96、crud-05:96、crud-05:474 | JobRun 层恒 `virtual Run`；Job 定义层恒 `virtual Job`；界面文案统一「临时运行」并只出现一次定义 |
| T4 | 步骤尝试序号 | `retry_seq`（契约）、`attempt` | crud-03:1002（`step_completed{step, act, attempt, result}`） | 统一 `retry_seq` |
| T5 | 运行目录 | `runDir`、运行目录、**配置目录**、`-c`、`--config-dir` | p02:245（明令勿混）、crud-06:24、**crud-06:188**、crud-06:239 | 统一「运行目录（`runDir`）」；`--config-dir` 仅作长选项名保留并加注 |
| T6 | 调度执行器 | `Task Runner`、`TaskRunner`、`Runner`、`任务执行器` | p02:44/74、crud-05:459、crud-05:487(`TaskRunner`)、crud-03:897(`${...}Runner`) | 正文 `Task Runner`，代码 `TaskRunner`，首次出现标注「任务执行器（Task Runner）」 |
| T7 | 定时模块 | `Scheduler`、`定时任务管理`、`定时调度` | p02:105（模块 7）、crud-04:549、p02:110 | 统一 `Scheduler` |
| T8 | 入队 / 派发 | 「派发=入 DB 排队」（crud-03:1191）、「入队」、「投递」、「投递即结束」 | crud-03:1191、crud-05:572-584、crud-02:243/396、crud-03:600 | `入队`=写 `step_records(waiting)`；`投递`=API→TaskRunner 的动作；`派发`保留但首次出现处引 crud-03 4.4 术语澄清 |

> 已确认**已统一**的正例（不报问题）：`poll_interval_ms`(front) vs `runner_poll_interval_ms`(backend)（p01:2026 明确区分）；`page_size` ∈ {10,50,100,1000}（p02 §11 + 6 处一致）；`timeRange` 7 档（p02:82、crud-05:82、tasks:319）；错误码 26 个（§10.1 与全部 crud 内联表一致）。

---

## 严重

### S-1【严重】Workflow 拓扑校验规则集与「是否拒绝环」在四处口径不一致

- 证据 1 · 后端契约 `proposal-02-后端crud-03workflow管理.md:104-111`：
  > `104| **校验规则**：`
  > `107| - **允许环路**：回跳边形成的环由 Engine 在运行时以计数终止（循环回跳上限 min(max × 3, max_loop_multiplier)，见 4.3.0），拓扑校验不拒绝环。`
  > `108| - **Start 出边约束**：Start 无失败语义，不允许 on_failure 出边 …`
  > 规则集共 **7 条**（start/end 唯一、start→end 可达、允许环、Start 无 on_failure、op 绑定 opId+opVersion、clientId 类型匹配、bindings 引用存在）。
- 证据 2 · 界面契约 `proposal-01-界面设计.md:1318-1330`：`### 10.14 校验规则` 共 **11 条**，含 `1328| | DAG 无环（除循环回跳） | 循环回跳由重试 + 条件边实现，不算环 |`、`1329| | 所有 required 入参必须有来源 |`、Start 无入边 / End 无出边 / Start≥1 出边 / End≥1 入边 / 所有 OP 从 Start 可达 / 能到 End。
- 证据 3 · 原型实现 `原型图/mock-data.js:1494`：`var WF_LOOP_EDGE_CONDITION = 'on_failure';`，并在 `1511-1535` 的 `__findWfCycle` 里**只把 `on_failure` 边当回跳**、对其余边做 DFS 找环并报错。
- 证据 4 · 同一份 p01 的循环场景示例 `proposal-01-界面设计.md:2281`：回跳边标注为 **🔵 always**（`│  (🔵 always 回跳)        │`，另见 `2289`）。
- **问题**：① crud-03「拓扑校验不拒绝环」与 p01 §10.14「DAG 无环（除循环回跳）」**直接矛盾**；② 「循环回跳如何识别」在 crud-03 是**运行期推导**（「由目标节点是否已执行过推导」），而原型**硬编码 `on_failure`**，且该硬编码会把自己的 §15.3/§15.4 示例（回跳用 `always`）判为非法环；③ crud-03 规则集缺 p01 的 6 条（Start 无入边 / End 无出边 / Start≥1 出边 / End≥1 入边 / required 入参来源 / 无环），而 `POST /validate`（crud-03 3.3.6）声称校验「连通性、Start/End 存在、节点字段合法」——**前后端校验集合与创建/更新（3.3.3/3.3.4 的 400）是否复用同一集合亦未定义**。T2.1 以 `原型图/*` 为基线（tasks:92），前端会**继承 mock 的校验内核** → 与后端契约分叉。
- **建议改法**：① 在 crud-03 §3.3 校验规则表**补全至与 p01 §10.14 同集**（逐条对齐、逐条标注是否用于 create/update/validate 三入口）；② 明确「环」的处置为**唯一口径**——建议采纳 crud-03 现状（校验端不拒绝任意环，回跳由运行期「目标节点已执行过」推导、由 `min(max×3, max_loop_multiplier)` 兜底终止），并同步把 p01 `1328` 改为「**允许环路**（含回跳边）；回跳不计入拓扑错误」；③ 同步删除原型 `mock-data.js:1494/1511` 的 `on_failure` 回跳假设，改为「**不做环判定**」（与 ② 一致）或按 ② 的新口径实现；④ 在 crud-03 3.3.6 补一句「validate 的 `errors[]` 文案与 p01 §10.14「校验失败时的提示」表逐条对应（8 条 + 补充 3 条）」。
- **待确认**：以 p01 §10.14（11 条、拒绝非回跳环）为准，还是以 crud-03（7 条、不拒绝环）为准？见「需拍板 P4」。

### S-2【严重】测试环境口径写「前端原型 + mock 数据」，与 `tasks.md` T2 数据源约定（禁 mock、禁静态兜底）冲突，使后端验证失去依据

- 证据 1 · `tests/集成测试用例.md:9-10`：
  > `9| - 前端原型：docs/cli非交互式/原型图/ 目录下 6 个 HTML 文件`
  > `10| - Mock 数据：mock-data.js（CLIENTS / OPS / WORKFLOWS / JOBS / RUNS / SETTINGS）`
- 证据 2 · `tests/集成测试用例.md:56`（P0 定义）：
  > `| P0 | 依赖静态数据测试 | 用**预置静态数据**即可验证（前端 mock 数据，或一次性导入 fixtures / DB 注入 seed.sql）…`
- 证据 3 · `tasks.md:84`（数据源约定，拍板）：
  > `正式前端代码自 T2.5 起不经过任何 mock 联调阶段：T2 生成的界面所有请求一律走后端 HTTP API（fetch('/api/...') 直连真实后端、返回真实 DB 数据），前端不内置任何静态业务数据兜底；…不得静默回退到 mock 数据。`
- 证据 4 · `tasks.md:88`（验证路径，拍板）：
  > `…一律通过 T2 生成的正式前端端到端验证…不得以 mock 数据代偿，若前端仍走 mock，后续后端功能验证即被阻塞、失去验证依据。`
- 证据 5 · 原型实证：6 页 **60 处 `mockFetch(...)`**（§1.6），且测试用例的「前置条件」普遍是「进入 XX 管理页」＋通过界面 [导入]（如 `tests:402-405` 的 TC-C2 前置），在原型页面上这些动作**全部命中 mock**。
- **问题**：① 同一验证体系内，任务书**禁止**以 mock 作为数据源/代偿，测试方案却把 mock 声明为环境与 P0 数据源；② 该文件的用例体自身已偏向真实后端（`tests:21` 要求 `sqlite3 "{run}/data/data.db" ".read seed.sql"`、TC-J3 需真实 cron、TC-E1 需真实并发计数、`tests:139` 直接打 `/api/settings`…），说明 §测试环境 是**未同步的陈旧段落**；③ 未指明用例运行的**被测前端**是「发布二进制的 `ui/`（T2 产物）」还是「原型页」，导致「后端功能验证依据」表述与任务书冲突。
- **建议改法**：① 将 `tests:9-10` 改为「**被测前端**：`ai-automation start` 释放到 `<exe_dir>/ui/` 的正式前端（T2 产物）；**原型 `原型图/` 仅供界面评审，不作为测试运行环境**」；② 删除 `tests:56` 中「前端 mock 数据」这一数据源选项，只保留「一次性导入 fixtures / DB 注入 seed.sql」（与 tasks.md:84/88 对齐）；③ 在 §测试通用规则 增一条「**所有用例禁止依赖 mock 数据**；观测手段 = 真实 HTTP 响应 + DB 查询」；④ 全篇替换「前端原型」措辞为「被测前端（T2 产物）」。

---

## 一般

### G-1【一般】10 个端点错误表缺 `400 VALIDATION_ERROR`，与各 crud「通用约定」与 `§10.1` 总表冲突

- 各 crud 通用约定均声明「路径参数格式非法 → 400 `VALIDATION_ERROR`」：`crud-01:70`、`crud-02:67`、`crud-03:118`、`crud-04:84`、`crud-05:122`；`p02:333` 总表亦标 `VALIDATION_ERROR | 400 | … | 全部 crud（通用）`。
- 缺失清单（文件:行号 → 现文本）：
  | 端点 | 行号 | 现错误表 |
  |-|-|-|
  | crud-01 3.1.7 export | `403` | `**错误响应**：404 CLIENT_NOT_FOUND（clientId 不存在）。` |
  | crud-02 3.2.7 export | `344` | `**错误响应**：404 OP_NOT_FOUND。` |
  | crud-03 3.3.6 validate | `308` | `**错误响应**：404 WORKFLOW_NOT_FOUND。` |
  | crud-03 3.3.10 needs-update | `545` | `**错误响应**：404 WORKFLOW_NOT_FOUND。` |
  | crud-03 3.3.11 outdated-nodes | `565` | `**错误响应**：404 WORKFLOW_NOT_FOUND。` |
  | crud-04 3.4.12 needs-update | `545` | `**错误响应**：404 JOB_NOT_FOUND。` |
  | crud-05 3.5.3 status | `243` | `**错误响应**：404 RUN_NOT_FOUND。` |
  | crud-05 3.5.4 steps | `257` | `**错误响应**：404 RUN_NOT_FOUND。` |
  | crud-05 3.5.8 retry | `364-370` | 仅 404 / 409 / 409 |
  | crud-05 3.5.9 can-retry | `409` | `**错误响应**：404 RUN_NOT_FOUND。` |
- **问题**：同一份文档内，`3.5.5`（crud-05:276）写了 `400 VALIDATION_ERROR`、`3.5.6/3.5.7` 也有，而上述 10 处没有 → 实现者无法判断「路径参数非法」在这些端点是否 400。
- **建议改法**：对上述 10 张错误表各补一行 `| 400 | VALIDATION_ERROR | 路径参数格式非法 |`；或（更省）在每份 crud 的「通用约定」末尾加一句「**未单独列出的 `400 VALIDATION_ERROR`（路径参数/查询参数非法）对所有端点一致生效，不再逐节重复**」。

### G-2【一般】`tasks.md` 内部矛盾：T2「不经过任何 mock」vs「自 T2.5 起不经过 mock」；T2.1 以原型为基线却未给 mock 处置步骤

- `tasks.md:82`：`**依赖**：T1…（**正式前端不经过 mock 联调阶段**——T2 生成的界面直接请求后端接口，见下方数据源约定）。`
- `tasks.md:84`：`**正式前端代码自 T2.5 起不经过任何 mock 联调阶段**`
- `tasks.md:92`（T2.1）：`前端资源组织与构建：以 原型图/* 为基线，整理为可嵌入的静态资源目录 | proposal-01 §4 | 产出 ui/（HTML/JS/CSS），无外部依赖`
- `tasks.md:96`（T2.5）：`统一 fetch 封装；**全部请求走后端 HTTP API、不引入 mock 联调（数据源约定）**`
- **问题**：① 「T2 全程」与「自 T2.5 起」两种边界并存；T2.1–T2.4（均在 T2.5 之前）按字面**可以保留 mock**，但同日 line 86 又断言「T2 完成后界面会出现一批请求异常 / 空数据」（隐含 T2 完成时已在走真实 API）；② T2.1 的产出是「以 `原型图/*` 为基线」的 `ui/`，而原型 6 页共 **60 处 `mockFetch(...)`** + `mock-data.js`（§1.6）——**未规定这 60 处与 `mock-data.js` 在哪个子任务、以什么口径处置**，也未规定 `mock-data.js` 是否随 `ui/` 内嵌发布。
- **建议改法**：把 `tasks.md:82/84` 的口径统一为「**T2 全程不经过 mock 联调；`原型图/*` 仅作视觉基线，T2.1 搬运时必须同时把 `mockFetch(` 改写为 `fetch(`、并禁止把 `mock-data.js` 纳入 `ui/`**」；并在 T2.1 的「产出/验收」列补「`grep -c mockFetch ui/*` = 0、`ui/` 内无 `mock-data.js`」这类**可机械验收**的判据。

### G-3【一般】测试用例把 retry 条件写成 `retry.on=failed` / `on_failed`，与枚举 `failure` / `success` 不符

- 契约：`proposal-01:1007` `on: "failure" | "success";        // 互斥`；`crud-03:89` `| on | enum | 是 | failure / success（判定见 4.3.2…）|`；原型下拉值 `原型图/workflow.html:1510-1511` `value="failure"` / `value="success"`。
- 测试：`tests:152` `超时 ≠ on_failed：配置 retry.on=failed 的节点超时不自动重试…`；另见 `tests:150`、`tests:1867`、`tests:1877`、`tests:1879`、`tests:1882`、`tests:1887`（共 7 处）。
- **问题**：按字面使用 `retry.on=failed` 会命中 `400 VALIDATION_ERROR`（枚举非法），用例无法执行；`crud-03:1067`「下文以 `failed` 为例」进一步加剧混淆（`failed` 是**节点结果**值、不是 retry 条件值）。
- **建议改法**：`tests` 内 7 处统一改为 `retry.on=failure` / `on_failure`（保留「超时 ≠ failure/on_failure」的语义）；并在 `crud-03:1067` 补括号「（此处 `failed` 指**节点结果**；retry 条件值为 `failure`/`success`，注意区分）」——同步登记进第二节 T2 行。

### G-4【一般】`crud-06` 用「配置目录」指代 `runDir`，与 `proposal-02 §9.2` 的明文警告直接冲突

- `crud-06:188`：`**响应含 runDir（当前配置目录，由 CLI 入口 -c 指定；未指定默认 ~/.ai-automation）**…`
- 同一文件正确用词：`crud-06:24` `CLI 入口通过 -c 指定运行目录；未指定时默认 ~/.ai-automation`
- 被违反的警告：`p02:245` `**长选项名 --config-dir 的语义即 crud-06 的 runDir（运行目录），勿与「配置文件所在目录」混淆**`
- **问题**：`crud-06:188` 正是该警告所防的混淆写法（`-c` 指定的目录内**同时**存 `ai-automation.json`，把它叫「配置目录」会让读者以为 `runDir` 等于 `ai-automation.json` 所在目录——虽然本例恰好同一目录，但接口契约名必须唯一）。
- **建议改法**：`crud-06:188` 改为「**响应含 `runDir`（当前**运行目录**，由 CLI 入口 `-c` 指定；未指定默认 `~/.ai-automation`；配置文件 `ai-automation.json` 位于该目录内）**」；并全库检索「配置目录」一词（当前仅此 1 处）确保不再出现。

### G-5【一般】`job_runs.retry_from_step_id` 的取值口径矛盾（`record_id` vs `stepId`），且 `rerun` 是否写入未定义

- `schema.sql:183-184`：`retry_from_run_id  TEXT,  -- 上游 job_runs.run_id` / `retry_from_step_id TEXT,  -- 上游 step_records.record_id`
- `crud-05:109` / `crud-05:142`：`| retryFromRunId / retryFromStepId | string \| null | 重试溯源 |` / `| … | job_runs.retry_from_run_id / retry_from_step_id | 重跑 / 重试溯源 |`
- 全库 `stepId` 的定义：`crud-05:147` `StepRecord.stepId … 等于 workflow_nodes.workflow_node_id；单次 OP/Job 执行时为 run_id`
- 原型实证：`原型图/mock-data.js:1316-1317`
  > `1316| newRun.retryFromRunId = (triggeredBy === 'retry') ? src.runId : null;`
  > `1317| newRun.retryFromStepId = (triggeredBy === 'retry') ? (failedStepOf(src) || {}).stepId || null : null;`
- **问题**：① schema 注释说存 `record_id`（StepRecord 主键），而字段名与原型都按 `stepId`（= `workflow_node_id`）理解——同一列两种语义，取值必然分叉；② 字段说明写「**重跑** / 重试溯源」，但原型只在 `triggeredBy==='retry'` 时写入，`rerun` 写 `null`；crud-05 3.5.7（重跑）与 3.5.8（重试）**都未规定**该列的写入，`proposal-01:1627-1628` 也只列字段不释义。
- **建议改法**：三选一并写死：① 改列名/注释为 `retry_from_record_id`（存 `step_records.record_id`）；② 保留 `retry_from_step_id` 但改 schema 注释为「上游 workflow_node_id（= `step_records.step_id`）」，并让原型与之一致；③ 二者都存（增列）。同时在 crud-05 3.5.7/3.5.8 各补一行「写入 `retry_from_run_id` / `retry_from_step_id` = …；rerun 场景为 `NULL`」，并同步 `proposal-01:1627` 注释。**待确认**：口径由谁定义（见 P6）。

### G-6【一般】`POST /api/clients/{clientId}/test` 的 `success` 字段定义与本接口「测试判定标准」互相矛盾

- `crud-01:351`：`**测试判定标准**：test 成败 = ExecuteResult.status == success（Executor 调用流程正常跑完）。测试用例正常应 exit_code=0…`
- `crud-01:367`（响应字段表）：`| success | boolean | Executor 调用流程是否正常跑完（run.xxx 退出码 0 且 rc_file 可读） |`
- 同一文档对「run.xxx 退出码」的定义：`crud-01:679` `run.xxx 脚本自身的退出码只代表"Executor 调用流程是否正常跑完"…用户脚本（脚本类）或外部 CLI（prompt 类）的成功/失败由主进程读 rc_file 中的退出码判定`；`crud-01:577` `组装 ExecuteResult {status, outputs, rawOutput, exitCode, error, durationMs}`
- **问题**：`ExecuteResult.status` 由 **rc_file 退出码 ∈ `exitCodeSuccess`** 决定（crud-01:574/677），而 `crud-01:367` 把 `success` 定义为 **run.xxx 退出码 0**（= 流程跑完）。二者在「CLI 返回非 0」时结论相反：按 367 应为 `success=true`，按 351/ExecuteResult 应为 `false`。前端「测试」按钮的成败显示直接取决于该字段。
- **建议改法**：`crud-01:367` 改为 `| success | boolean | 本次测试是否成功：ExecuteResult.status == success（rc_file 退出码 ∈ exitCodeSuccess；超时亦为 false） |`，并补一行「`status=failed/timeout` 时 `success=false`，`error` 为 stderr/原因」；保留 `crud-01:351` 为唯一判定口径。

### G-7【一般】`engine_event_retention_days` 与「1 天软删 / 2 天硬删」的换算关系未定义

- `crud-06:81`：`| | engine_event_retention_days | 1 | 动态 | Engine 事件清理…成功 run 完成即物理删本 run 事件；失败 run 最终不重试 → 1 天软删 / 2 天硬删。…|`
- `crud-06:348`（联动表）同上复述；`crud-03:829`：`**执行失败**…最终不重试 → **1 天后软删除**（置 soft_deleted_at_ms）→ **2 天后物理删除**`
- `crud-06:287`（上限表）：`| history_max_per_job | 1000 | engine_event_retention_days | 30 |`
- **问题**：默认值 1 恰好等于「软删天数 1」而硬删为 2（≠ 2×1 之外的规律？），当用户把该项改为 `5` / `30` 时，软删与硬删分别是 `5 / 10`？`5 / 6`？还是只有软删跟着变？**三处均未定义**，而该项可被 PUT 修改（上限 30）。
- **建议改法**：在 `crud-06:81` 与 `crud-03:829` 各补一句确定性公式，例如「软删 = `engine_event_retention_days` 天；硬删 = **软删 + 1 天**（默认 1/2，符合现文表述）」，并把该换算写入 `crud-06:348` 与 `tasks.md:273`（T9.15）的验收口径。

### G-8【一般】Client 导出默认名的「slug 形式」未定义，且与 OP/Workflow/Job 用原始 `name` 的口径不一

- `crud-01:401`：`**默认文件名（前端预填，允许用户自定义）**：client-<name>.yaml（name 为 Client 名称的 slug 形式；Client 无版本字段，文件名不含版本号）。`
- 对照：`crud-02:302` `op-<name>-v<version>.yaml（name 为 OP 名称、version 为当前版本号；如 op-check_tests-v2.yaml）`（**保留原始下划线**）；`p02:275` 四处默认名一律写 `<name>`。
- 测试也按原始名断言：`tests:202` `导出弹窗默认文件名 = client-{B.name}.yaml`（B.name 为 `tc_c1a_prompt`）。
- **问题**：① 「slug 形式」是**全库唯一的未定义术语**（无任何 slug 规则：大小写？非 ASCII 如何处理？`Claude Code` 这种带空格的 Client 名 → `claude-code` 还是 `Claude Code`？）；② 与 `tests:202` 的「= B.name」断言直接冲突（`tc_c1a_prompt` 若 slug 化会变 `tc_c1a_prompt` 或 `tc-c1a-prompt`，结果不确定）。
- **建议改法**：`crud-01:401` 删去「slug 形式」，改为「`client-<name>.yaml`（name 为 Client 名称**原样**；与 OP/Workflow/Job 默认名同口径，不做字符替换）」，并在 `crud-05:448` 的「文件名与落盘规则」表加一行「默认名中的 `<name>` / `<version>` **原样拼接，不做 slug/转义**（D5 只约束 `/`、`\`、`..`）」。

### G-9【一般】T2.2 写「目录名待定」，但释放目录 `ui/` 已在 4 处定稿

- `tasks.md:93`（T2.2）：`…启动时在**二进制所在目录**把静态文件重写到磁盘（目录名待定，如 <exe_dir>/ui/）`
- 定稿处：`p02:251` `**释放内嵌前端**（把构建时嵌入的 ui/ 写到**二进制所在目录**的 ui/，同名文件覆盖…）`；`p02:111`（模块 13）`启动时释放到二进制所在目录的 ui/`；`tasks.md:46`（T1.6）`静态资源路由（/ → 释放出的 ui/）`；`tasks.md:70`（T1.2 目录约定）`webui/  # 内嵌/释放前端静态资源（rust-embed + 释放到 <exe_dir>/ui）`
- **问题**：「待定」与 4 处「`ui/`」冲突；T2.2 的实现者按字面可以自选目录名，导致与 T1.6 的静态路由及 `p02 §9.3` 不一致。
- **建议改法**：`tasks.md:93` 改为「…启动时在**二进制所在目录**把静态文件重写到磁盘（**目录名定稿为 `ui/`**，同名文件覆盖；失败不阻断启动、记 WARN 并回退用内嵌资源响应，见 proposal-02 §9.3）」——删除「目录名待定」三字，使 T2.2 与 T1.2/T1.6/§2 模块 13/§9.3 同口径。

### G-10【一般】行内编号 `#1`–`#8` 全集无释义表，且与测试文档中同形编号**同符异义**

- `crud-04:464` `> 双表达约定（#1）：…`；`crud-04:489` `…**名称锚一致性校验（#8）**…`；`crud-04:492` `| Job.inputs 键名（#4） |`；`crud-04:493` `| 版本差异告警（#5） |`；`crud-04:495` `| **旧 id → 新 id 重映射（#3）** |`；`crud-04:496` `| **导入后的 enabled（#7）** |`；`crud-04:500` `> job.yaml.version（#6）：…`；`crud-04:502` `> **导入的原子性（#5）**：…`；另有 `crud-04:264`（#5）、`crud-04:320`（#4）、`crud-04:322`（#3）；`crud-05:115` `> **已删除 Job 的 Run 展示（#3/#6）**：…`
- 同形编号在测试文档表示**数据集行号**：`tests:996` `` `review` + 已同步 → 3（#1、#5、#7） ``；`tests:1058` `` `deploy`→2（#2、#6） ``；`tests:1103` `` → 4（#1、#4、#7、#11） ``
- **问题**：① `#n` 在 crud-04/05 是**评审条目号**（无任何表解释「#1 是什么」），在 tests 是**数据行号**——同一符号两义且都无定义，与 `proposal-01 §20.1` 的释义表机制脱节；② `#5` 在 crud-04 内部就指两件事（`264` 删除原子性、`493/502` 版本差异告警/导入原子性），`#3` 亦两义（`322` 全入口 waiting 上限、`495` 旧 id 重映射）→ 已属「一符多义」，正是 §20.1 试图消除的问题。
- **建议改法**：把 crud-04/05 的 `（#n）` **全部改成语义化标签**（如 `（约定-双表达）`、`（约定-名称锚校验）`、`（约定-旧 id 重映射）`），或将 `#1..#8` 汇成小节内的编号表并加限定词（`（导入约定 #3）`）；`tests` 的 `（#n）` 改为 `（数据集行 n）`。**同时把 `#1..#8` 与 `D1..D7` 一并登记进 `proposal-01 §20.1` 的释义范围说明**（当前 §20.1:2873 只提到 `Z5/U8/V4/Q1/W6/R3/S8/T13/AA7/BB4/Z/N/M17/M20/P4/P6/K`）。

### G-11【一般】前端「新建默认值」与后端字段默认值口径不一致（OP 超时、Client inputMode/outputMode）

- `proposal-01:2778`（§19.8）：`| OP | 名称空、描述空、**超时空**、入参空、出参空、类型 prompt、内容空 |`
- 后端默认：`proposal-01:591` `timeoutSeconds?: number; // 超时秒数（只属于 OP，默认 60，字段名与 crud-02 3.2 一致）`；`crud-02:164` `| timeoutSeconds | integer | 否 | 默认 60（秒） |`；`schema.sql:54` `timeout_seconds INTEGER NOT NULL DEFAULT 60`
- `proposal-01:2776`：`| Client（Prompt） | 名称空、描述空、命令空、参数模板空、**输入方式 arg、输出解析 mode json**、jsonPath 空、退出码语义 0 |`，而 `crud-01:212-214` 中 `inputMode` / `outputMode` / `outputJsonPath` 均为「否（可空）」、`crud-01:31-33` 示例值为 `null`，全库**未给这三项任何默认值**。
- **问题**：① §19.8 说「超时空」，但保存后落库必为 60（NOT NULL DEFAULT 60）——界面「空」与落库「60」之间缺少「空 → 60」的显式约定（是后端补默认、还是前端提交前填 60？）；② Client 的 `arg`/`json` 是**前端预置值**而后端无默认，`crud-01` 3.1.3 的「字段约束同 POST」未提及默认，导入 YAML 缺省时二者行为也不同。
- **建议改法**：§19.8 改为「OP：…**超时 = 60（默认值预填）**…」并在 `crud-02 3.2.3` 补「请求体缺 `timeoutSeconds` → 后端落 60」；`proposal-01:2776` 的「输入方式 arg / 输出解析 mode json」标注为「**前端预填建议值，非后端默认**」，并在 `crud-01 3.1.3/3.1.8` 补一句「`inputMode`/`outputMode` 缺省为 `null`（脚本类恒 `null`），不参与校验」。

---

## 轻微

### L-1【轻微】完成钩子的四种写法（详见第二节 T1）

- `p02:58` `│      │   on_complete 钩子（WorkerPool / Engine → Task Runner）    │`；`p02:68` `…按 source 经全局 JOB_COMPLETE / STEP_COMPLETE 回调…`；`crud-03:884` 同；`crud-03:956` `JobComplete（更新 job_runs 终态）、StepComplete（…）`；`crud-03:1206` `立即调全局 ENGINE.process_event`；`schema.sql:230-231` `-- 任务来源: job=…（Runner 触发, 完成调 job_complete 钩子）` / `-- step=workflow 步骤（Engine 触发, 完成调 step_complete 钩子）`；`crud-05:497` `static RUNNER…`
- **建议改法**：以 `crud-03:965-985` 的代码定义为准统一（static `JOB_COMPLETE`/`STEP_COMPLETE` + trait 实现 `JobComplete`/`StepComplete`），并修正 `schema.sql:230-231` 的注释拼写为 `JOB_COMPLETE` / `STEP_COMPLETE`，`p02:58` 的图注改为 `on_complete（全局 JOB_COMPLETE / STEP_COMPLETE）`。

### L-2【轻微】行内编号大量「无出处」，违反 `proposal-01 §20.1` 自定的引用规范

- 规范：`p01:2899` `> **引用规范**：行内编号**不构成全局唯一 id**…**引用必须带出处**（如「见 crud-03 4.4」）。`
- 违例（`_x_tags2.txt` 逐条）：`crud-03:725`（`（Z3）`，全库唯一出现且无出处）、`crud-03:810`（`（R3）`）、`crud-03:737`（`（Q4）`）、`crud-03:735`（`（N1）`）、`crud-03:1194`（`（P4）`）、`crud-03:1053`（`（W6/BB5）`）、`crud-03:720`（`（AA7/AA8）`）、`crud-03:748`（`（S2）`）、`crud-03:778/878`（`（S8）`）、`crud-03:777`（`（T13）`）、`crud-03:749`（`（V4，同 U8 口径）`）、`crud-03:1191`（`（U1/D2）`）、`crud-03:853`（`（T26）`）、`crud-03:857`（`（U13）`）、`crud-01:533`（`（M20）`）、`crud-03:1209/1217`（`（D1 拍板）`）、`crud-05:444/449/455`（`（D5…）`）、`crud-06:317`（`（D6 定稿）`）、`p01:2026`（`（D1 定稿）`）。
- **建议改法**：不要求逐处加出处（成本高且多为文档内自指），改为**在两处收口**：① `p01 §20.1` 释义表把 `Z3/R3/Q1/Q2/Q4/N1/P4/W6/AA7/AA8/BB5/S2/S8/T13/U8/V4/U1/U13/T26/M17/M20/Z/BB4/K/P6` 各补一行「含义 + 出处」；② 在 §20.1 加一句「**出现在同一文件内的编号视为该文件内部条目号，出处即该小节标题（如 `crud-03 4.4`），同文件引用可省略出处**」，使现状合规。

### L-3【轻微】`uptimeMs` 类型说明把「时长」写成「毫秒时间戳」

- `crud-06:163`：`| uptimeMs | string | 进程已运行时长（毫秒时间戳） |`，而 `crud-06:155` 示例 `"uptimeMs": "3600000"`；全库惯例「毫秒时间戳」指**绝对时刻**（`p02:120` `时间字段 JSON 中为 string（毫秒时间戳）`）。
- **建议改法**：改为「进程已运行**时长**（毫秒数，string；非时间戳）」。

### L-4【轻微】`proposal-02:176` 的「同理」列表重复列出上文刚定义的 `ClientRepo`

- `p02:169-176`：先 `trait ClientRepo { … }`，随后 `176| // 同理: ClientRepo, OpRepo, WorkflowRepo, JobRepo, RunRepo, StepRepo, EngineEventRepo`
- **建议改法**：改为 `// 同理: OpRepo, WorkflowRepo, JobRepo, RunRepo, StepRepo, EngineEventRepo`（并从该行移除 `ClientRepo`）。

### L-5【轻微】`proposal-02 §12` 前端↔后端对应关系表缺章（含测试文档已引用的 §16）

- `p02:391-401` 仅映射 八/九/十/十一/十二/十三/十四/十五/十七，缺 **十六（典型 Use Case）、十八（通用列表分页规范）、十九（前端独立界面清单）、二十（关键设计决策）、二十一（核心结论）**；而 `tests:3` 明确「基于 `proposal-01` **第十六章**「典型 Use Case」生成」，`tasks.md` 又引用 §18.0.1~18.0.3/§18.1/§19.6/§19.9。
- **建议改法**：补 4 行映射（十六→各模块综合 UC；十八→`p02 §11` 分页规范；十九→静态资源与共享画布；二十一→总体架构）。

### L-6【轻微】`GET /api/settings` 的 JSON 分组键与配置分组的中文名之间无对照表

- 中文分组名（`crud-06:64-88`）：通用 / Client / OP / Workflow / 运行历史 / Engine / Worker / Task Runner / Scheduler / 日志；JSON 键（`crud-06:196-234`）：`general` / `client` / `op` / `workflow` / `history` / `engine` / `worker` / `runner` / `scheduler` / `log`；`tasks.md:154`（T5.1）用中文名、`tasks.md:159`（T5.6）用「只读派生项」而不提键名。
- **问题**：`history` 组含 `job_queue_waiting_max` / `job_queue_running_max`（**并发上限**，非「保存策略」），`runner` 组对应中文「Task Runner」；映射只能靠猜。
- **建议改法**：在 `crud-06:64` 表格左侧「分组」列同时给出 JSON 键（如 `通用（general）`、`运行历史（history，含并发上限）`、`Task Runner（runner）`），并在 `tasks.md` T5.1/T5.6 同步。

### L-7【轻微】`proposal-01:2940` 硬约束 8「重试使用最新版本」易与「重跑才固定用最新版本」混淆

- `p01:2940`：`8. **重试使用最新版本，且只在五条件满足时可用**。`
- 对照：`p01:1945` `| 失败 Run 的版本 = 当前最新版本 | 版本一致才允许重试 |`；`p01:1954-1956` `如果 快照版本 != 当前版本: → 不允许重试`；`p01:1989` `| 版本使用 | 最新版本（= 快照版本） | 最新版本（固定） |`；`crud-05:633` `| 版本 | 用最新版本 | 必须版本一致 |`
- **建议改法**：改为 `8. **重试要求版本一致（快照版本 = 当前版本）且满足五条件；重跑才固定使用最新版本**。`（`p01:1989` 的「最新版本（= 快照版本）」亦可加注「二者相等是**前置校验**的结果」）。

### L-8【轻微】`tasks.md` T5.5 的「产出 / 验收」列不是可验收口径；T2.2 的「参考」列不是章节引用

- `tasks.md:158`：`| T5.5 | config_version 迁移 + 失败回退（备份、不递增、migrate_error） | crud-06 3.4（P6） | 见 crud-06 3.4（P6） |`（第 3 列虽有意义，但第 4 列仅为转发）
- `tasks.md:93`：`| T2.2 | … | 需求（构建打包进二进制、运行写到二进制目录） | 双击二进制即得完整前端，无需外部文件 |`（参考列非「文档 §章节」，与全表其余 100+ 行体例不同）
- **建议改法**：T5.5 第 4 列改为可验收判据（如「`migrate_error` 经 `GET /api/settings` 只读返回；`.bak` 生成；`config_version` 不递增」）；T2.2 参考列改为 `proposal-02 §2 模块 13 / §9.3；tasks T1.2 目录约定`。

### L-9【轻微】原型依赖 CDN（SheetJS）与 T2.1「无外部依赖」冲突；其专属错误码不在 `§10.1` 总表

- `原型图/index.html:7`：`<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>`；`原型图/index.html:10` 与 `mock-data.js:2091-2093` 自承依赖 CDN，失败时返回 `__err('EXPORT_UNAVAILABLE', '导出组件未加载（SheetJS CDN 不可达）…')`
- 冲突：`tasks.md:92`（T2.1 验收）`产出 ui/（HTML/JS/CSS），**无外部依赖**`；`tasks.md:93`（T2.2 验收）`双击二进制即得完整前端，**无需外部文件**`
- **问题**：① 「全部导出」在离线/内网环境不可用，与「无外部依赖 / 双击即用」冲突；② `EXPORT_UNAVAILABLE` 是 mock 专属 code，不在 `p02 §10.1`（总表声明为「全后端错误码唯一总表」），正式前端按总表映射时该场景**无码可依**。
- **建议改法**：① 明确 SheetJS 的处置（**打包进 `ui/`（本地 vendor 文件）** 为首选），并在 T2.1 验收补「`ui/` 内不存在 `http(s)://` 外链」的机械判据；② 该场景的错误码列进 `§10.1`（如 `EXPORT_UNAVAILABLE | 500 | 导出组件不可用`）或明确改为复用 `INTERNAL_ERROR`，并同步 `crud-05 3.5.10`。

### L-10【轻微】原型把「回跳边」硬编码为 `on_failure`，与 §15.3（`always` 回跳）及 crud-03（运行期推导）不一致

- `原型图/mock-data.js:1494` `var WF_LOOP_EDGE_CONDITION = 'on_failure';` + `1518` `if (e.condition === WF_LOOP_EDGE_CONDITION) return;   // 回跳边不算环`
- 对照：`p01:2281` `│  (🔵 always 回跳)        │`（§15.3 拓扑的回跳边是 `always`）；`crud-03:731` `walk_edge 对被激活边的目标节点判定：若该节点**在本次 Run 内已执行过**，则该边为**回跳边**…无需在 edges 数据里额外标记回跳，由「目标节点是否已执行过」推导。`
- **问题**：按原型口径，§15.3/§15.4 示例（`always` 回跳）会被判为非法环 → 校验内核与文档/后端三不一致（与 S-1 同源，但因涉及原型实现独立列此）。
- **建议改法**：随 S-1 一并处置；原型内删除该常量或改为「不做环判定」，注释指向 `crud-03 4.3.0 ③`。

### L-11【轻微】`crud-03:1002` 时序图用 `attempt` 命名契约字段 `retry_seq`

- `crud-03:1002`：`│ ←── step_completed{step, act, attempt, result} ──│`
- 契约字段：`crud-03:646` `| step_completed | retry_seq | integer | 是 | 本次完成的 attempt 序号 |`；`crud-03:1000` 同图另处写 `activation_seq`
- **建议改法**：该行改为 `step_completed{step_id, activation_seq, retry_seq, result}`。

### L-12【轻微】编号体系混用：同一引用场合出现「阿拉伯 §N」与「中文数字章节」两套写法

- `p02:21` `结构化日志 + 绕接（§7）`（目标标题是 `## 七、日志管理`）；`p02:22-23/26` `§2`（目标 `## 二、模块划分`）；`p02:110-111/118` `§9`/`§9.3`；`p02:259` `结构见 §7`
- `tasks.md:42` `proposal-02 §2`（目标 `二、模块划分`）；`tasks.md:120-121` `proposal-02 §6`（目标 `六、DB 操作层 (Repository)`）；`tasks.md:123` `§11`（目标 `十一、分页规范`）；`tasks.md:138/141` `proposal-02 §7`
- `crud-01:75` `按 schema.sql §1 clients 全列对齐`、`crud-02:72` `按 schema.sql §2 ops 全列对齐`（`schema.sql` 用 `-- 1. clients —— Client 管理` 注释节，另有正文以「第 4/7/8/9/10 节」书写）
- 附带：`crud-04` 的 `4.5.1–4.5.6` 用**行内加粗**（`crud-04:565` `**4.5.1 注册与热更新（生命周期）**`），而 `crud-05` 的 `4.6/4.7/4.8` 用 `###` 标题 → 同一层级样式不一，且导致 `tasks.md:296` 的 `crud-04 4.5.2` 无法被标题级引用工具解析（本次脚本即误判为 `ok=False`）。
- **建议改法**：`proposal-02` 的标题统一为「`## 七、日志管理`」并在被引用处写 `§7（七、日志管理）` 或统一改为「第七章」；`schema.sql` 引用统一为「`schema.sql` 第 N 节」。`crud-04 4.5.x` 提升为 `### 4.5.x`。

---

## 需拍板

| # | 待决事项 | 现状与冲突 | 建议选项（供拍板） |
|-|-|-|-|
| **P1** | Client 更新时请求携带审计字段（`clientId`/`createdAtMs`/`updatedAtMs`）应 **忽略** 还是 **400**？ | `crud-01:271` `后端一律忽略（或返回 400，按实现约定）`；但同节错误表 `crud-01:289` 写 `400 VALIDATION_ERROR 请求体字段非法（含请求携带审计字段时按约定拒绝）`；`tasks.md:180`（T6.4）亦写「忽略或 400」；对照 `crud-06:267` 只读项是**明确拒绝** | A（推荐）：**一律忽略**（与「整体替换可编辑字段」语义一致，且与 crud-06「只读项明确拒绝」区分开）；B：一律 400。无论选哪个，须同步 `crud-01:271/289` + `tasks.md:180` 三处为同一措辞 |
| **P2** | 正式前端「导出组件不可用」（SheetJS 不可达）时的错误码与提示来源 | 原型用 `EXPORT_UNAVAILABLE`（`mock-data.js:2093`），该码不在 `p02 §10.1` 总表；`tasks.md:84` 要求错误展示一律按 `§10.1` 映射 | A（推荐）：把 SheetJS **打包进 `ui/`**，该场景消除，无需新码；B：登记 `EXPORT_UNAVAILABLE`（500）进总表并同步 `crud-05 3.5.10` |
| **P3** | `原型图/*` 的 60 处 `mockFetch` 与 `mock-data.js` 在哪一步替换？`mock-data.js` 是否随 `ui/` 内嵌发布？ | `tasks.md:84` 说「自 T2.5 起」不走 mock，`tasks.md:82` 说「T2 不经过 mock」，`tasks.md:92` 又以原型为基线；三者未收口（本次 G-2） | A（推荐）：**T2.1 即替换为 `fetch`，`mock-data.js` 不进 `ui/`**（T2.1 验收加机械判据）；B：允许 T2.1–T2.4 保留 mock、T2.5 统一替换（则须改 `tasks.md:82/86` 的措辞与验证路径前提） |
| **P4** | Workflow 拓扑校验以哪份为准：`proposal-01 §10.14`（11 条、拒绝非回跳环）还是 `crud-03 §3.3`（7 条、不拒绝环）？ | S-1 已列四处不一致 | A（推荐）：**以 crud-03 为契约基准**（允许环、运行期推导回跳、计数兜底）+ 把 p01 §10.14 的其余 6 条规则**补进 crud-03**、删去「无环」条；B：以 p01 §10.14 为准（则须定义「回跳边」的静态判定方式，现无） |
| **P5** | `engine_event_retention_days` 与「软删 / 硬删」天数的换算公式 | `crud-06:81/348`、`crud-03:829` 只描述默认 1 时「1 天软删 / 2 天硬删」，改值后 undefined（本次 G-7） | A（推荐）：软删 = 该值，硬删 = 软删 + 1 天；B：硬删 = 2 × 该值；C：拆成两个配置项。选定后同步 `tasks.md:273`（T9.15）验收口径 |
| **P6** | `job_runs.retry_from_step_id` 存 `step_records.record_id` 还是 `step_id`（`workflow_node_id`）；`rerun` 是否写入该对字段 | schema 注释与字段名/原型相反（本次 G-5），且 `crud-05:109/142` 写「重跑 / 重试溯源」而原型只在 retry 写 | A（推荐）：列改名为 `retry_from_record_id`（语义 = StepRecord 主键），`rerun` 不写；B：保留列名、语义 = `step_id`，并改 schema 注释 + 原型 `mock-data.js:1317`；两者均须在 `crud-05 3.5.7/3.5.8` 各补写入约定 |

---

## 修复顺序建议

**第 0 批（拍板，阻塞后续）**：P1 / P3 / P4 / P5 / P6 —— 这 5 项决定后面改哪一侧文本，先定后改可避免返工（P2 可与 L-9 合并处理）。

**第 1 批（契约级，必须先改；改完需重跑本次机械核对）**
1. **S-1 + L-10 + P4**：统一「环/回跳」口径，补齐 crud-03 校验规则集，修 `p01:1328`、`mock-data.js:1494/1511`。
2. **S-2**：改 `tests:9-10/56` 的测试环境与 P0 数据源，补「禁止依赖 mock」规则，全篇「前端原型」→「被测前端（T2 产物）」。
3. **G-2 + G-9**：修 `tasks.md:82/84/92/93/96`，给 T2.1 加可机械验收的 mock 清零判据，删「目录名待定」。
4. **G-6**：修 `crud-01:367`（`success` 定义），这是前端「测试」按钮成败的唯一依据。
5. **G-3**：`tests` 内 7 处 `retry.on=failed`/`on_failed` → `failure`/`on_failure`；`crud-03:1067` 加辨析。
6. **G-1**：10 张错误表补 `400`（或在各 crud 通用约定加"统一生效"句）。

**第 2 批（术语与编号一致性，改动小、影响面广）**
7. **G-4 / G-8 / G-10 / G-11** + 第二节 T1–T8 统一（`JOB_COMPLETE`、`failure`、`virtual/临时`、`retry_seq`、`运行目录`、`Task Runner`、`Scheduler`、`入队/派发`）。
8. **L-2 / L-12**：`§20.1` 释义表补行 + 加「同文件引用可省出处」句；`proposal-02` 章节编号与被引处写法统一；`crud-04 4.5.x` 提为标题。

**第 3 批（完善性与可读性）**
9. **G-5 / G-7**（随 P5/P6 落地）、**L-1 / L-3 / L-4 / L-5 / L-6 / L-7 / L-8 / L-9 / L-11**。

**复核要求（改完再跑一遍）**
- 重跑本报告 §1 的 6 组脚本，验收：① 交叉引用 0 悬空（当前已 0，保持）；② `crud` 端点与 `proposal-01 §17` 双向 55/55（当前满足）；③ 全部端点错误表含 `400`（当前 10 处缺）；④ `grep -c mockFetch ui/` = 0（T2.1 交付时）；⑤ `retry.on=` 后接值仅 `failure|success`；⑥ 行内编号 `#n` 清零或被释义表覆盖。
