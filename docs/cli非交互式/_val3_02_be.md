# 独立校验报告（第 3 轮 · 第 2 路：后端）—— proposal-02 主文档 + crud-01..06 + schema.sql

> 校验员：独立只读审查（**未修改**任何被审文件；本轮仅新建本报告）
> 范围（硬性）：`proposal-02-后端设计.md`(429)、`crud-01`(1098)、`crud-02`(405)、`crud-03`(1413)、`crud-04`(672)、`crud-05`(716)、`crud-06`(388)、`schema.sql`(352)
> 旁证（出范围，仅作交叉证据）：`proposal-01-界面设计.md`、`tasks.md`、`tests/集成测试用例.md`、`validation.md`、`_val2_*.md`、`_fix_v2_*.md`
> 工具：sqlite3（实跑 `schema.sql` 建库 + 行为验证）、Python 3.12 只读抽取脚本（临时脚本置于 `C:\Users\Public\_jcode_v3_*.py`，**未写入被审目录**）
> 双重目标：① 逐条核对 R1（`_val2_02_backend.md`）修复是否落地/漏改/引入新矛盾；② 找新问题

---

## 统计

| 档位 | 数量 | 编号 |
|-|-|-|
| 严重 | 2 | S1–S2 |
| 一般 | 5 | G1–G5 |
| 轻微 | 15 | N1–N15 |
| 需拍板 | 5 | 拍-1 – 拍-5 |
| **合计** | **27** | |

其中：**R1 / 拍板共 56 行核对 —— ✅ 已改到位 45 行、🟡 部分落地（有漏改或引出新矛盾）9 行、— 范围外 2 行**（见「R1 修复核对表」）；本轮新问题 27 项，其中 **S2、G1、N11 属「修复引入」**，**G4、N1–N5 属「修复未同步的旧口径/术语」**。

### 机械核对（方法 / 命令 / 结果，全部可复现）

| # | 核对项 | 方法 | 结果 |
|-|-|-|-|
| M1 | 旧措辞 0 残留 | 脚本逐行 `in` 匹配 18 个旧串（`记录数 − 1`/`记录数-1`/`最大重试次数`/`retry_from_step_id`/`retryFromStepId`/`resume_from_record_id`/`步骤 2-3 在同一事务`/`DAG 无环`/`（或返回 400`/`按约定拒绝`/`配置目录`/`slug` …） | 17 项 = 0；**1 项残留**：`schema.sql:218` `记录数 - 1`（见 G4）；`retry_from_step_id` 仅剩 1 处**说明性**文字（`crud-03:1232`「原名 … 已改名」）；`DAG 无环` 仅剩 1 处**否定式**引用（`crud-03:128`「替代 … 的『DAG 无环』条」） |
| M2 | 字段名全局唯一口径 | 全库（76 文件，含 `.md/.sql/.js/.html/.yaml/.json`）计数 `retry_from_record_id` / `retryFromRecordId` / `retry_from_step_id` / `retryFromStepId` / `resumeFromRecordId` / `resume_from_record_id` | `retry_from_record_id` x11（crud-03 x4 / crud-05 x7 / schema x1；其余为报告文本）；`retryFromStepId` **0**、`resume_from_record_id` **0**；口径一致（列 `retry_from_run_id`/`retry_from_record_id` ↔ JSON `retryFromRunId`/`retryFromRecordId` ↔ 事件 `resumeFromRecordId`） |
| M3 | `schema.sql` 实跑建库 | `sqlite3 <tmp>.db ".read schema.sql"`（先复制到 ASCII 路径） | **通过**：10 表 / **23 个命名索引**（含 `uq_steps_execution` 唯一索引）/ 无报错；`user_version=1`、`journal_mode=wal`（持久）；另起连接 `foreign_keys=0`（与 `schema.sql:15-19` 头注所述一致） |
| M4 | 列 / 约束行为验证 | 实跑 INSERT / UPDATE（python sqlite3） | `job_runs` 含 `retry_from_run_id` + `retry_from_record_id`；`workflow_nodes.client_id` 可空（`notnull=0`，与补充拍板 4 一致）；孤儿 `workflow_nodes` 在 **FK 关闭**连接下**插入成功**、`pragma foreign_keys=ON` 后**被拒**（`FOREIGN KEY constraint failed`）；删 `workflows` 行级联删节点（FK ON：剩 0）；`(run_id,step_id,activation_seq,retry_seq)` 重复插入**被唯一索引拒绝**；`triggered_by='nope'` 被 CHECK 拒绝、`'retry'` 通过 |
| M5 | 错误码：总表 ↔ 内联逐条比对 | 抽取 §10.1 表（`proposal-02:333-361`）与 crud-01..06 全部 `| 状态码 | `CODE` |` 行 | 总表 **27 行 / 26 个 code**；内联 **104 行**，**逐条 (code, HTTP) 与总表一致，0 冲突、0 未登记 code**（4 处「多码同格」行 `RUN_NOT_FOUND / TARGET_NOT_FOUND` 等经人工展开后亦一致） |
| M6 | 枚举集合比对 | `schema.sql` 各 `CHECK(...IN(...))`（16 组）+ 文档枚举字面量逐组比对 | **16/16 全一致、0 漏项**（`type`/`input_mode`/`output_mode`/`concurrency`/`job_kind`/`triggered_by`(5)/`target_kind`/`status`(7 含 `terminating`)/`terminated_by`/`source`/`step status`/`event_type`(7)/`step_status`/`edge state`(3)/`node status`(4)/`kind`)；另 `bindings.kind` 文档 4 值（含 `unbound`）与 `schema.sql:113` 注释 3 值不一致（见 N3） |
| M7 | 交叉引用目标存在性 | 抽取全部 `crud-0X <num>` / `proposal-0X §<num>` 引用（含 schema/tasks/p01 中的引用）与目标文件标题集合比对 | **95 个目标全部命中，0 悬空**（含新增的 `crud-03 4.3.4`、`crud-06 3.4`、`crud-04 3.4.10`） |
| M8 | 行内编号普查 | 抽取 proposal-02 + crud-01..06 全部 `（X##…）` 形标签 × 全文位置，对照 `proposal-01 §20.1` 释义表 | 在用标签 **46 个 / 82 处**；§20.1 仅覆盖其中 9 个（`U1/U13/T26/S1/V11-B/C7/C1/C4/D1–D7`）；**D8–D18 与 G2/G3/G8/G9/G11/N1/N4/N7/S8/Q1/Q2/Q4/R3/S2/T13/U8/V4/W6/Z3/M17/P4/AA7/AA8/BB5 无释义表条目**；并发现 **D1/D4/D5/D6/D7 一符多义**（见 G5） |
| M9 | 表格 / 粗体 / 行尾 | 逐表列数一致性（转义 `\|` 后计数）、逐行 `**` 奇偶、CRLF/BOM 统计 | 表格：**仅 `crud-03:1194` 1 处列数错乱**（单元内含未转义 `\|`，原样存在）；`**` 奇偶**全部偶数**，但 `crud-05:542` 存在**配对成功而交叠嵌套**（见 N2）；8 个文件均 **UTF-8 / CRLF=0 / 无 BOM / 末行有换行**（与各组自述一致，未做整文件换行转换） |
| M10 | 权威文档可执行 SQL 复核 | 把 `crud-06 3.6` 的 SQL 原样对实跑库执行（造 3 条 `job_runs`） | **可执行且语义正确**：`GROUP BY workspace ORDER BY last_used DESC` 返回 `/ws/b\|3000`、`/ws/a\|2000`（去重 + 组内最大）；附 `HAVING` 变体亦可执行 |
| M11 | 「重试=max 次尝试」序列核验 | 语义追踪：`crud-03:735`（本轮尝试计数 = 记录数）→ `:1124`（记录数 >= max 不重试）→ `:1112`（`max=3` → retry_seq 1/2/3）→ schema 对照 | crud-03 三处**自洽**（3/3/3）；**schema.sql:218 与 `:735` 冲突**（见 G4） |

---

## R1 修复核对表

判据：`_val2_02_backend.md`（S1/S2、G1–G13、N1–N16）+ `_fix_v2_decisions.md`（D1–D18、低成本项、补充拍板 1–8）。图例：✅ 已改到位｜🟡 部分落地（有漏改/新矛盾）｜❌ 未落地。

| R1 项 | 判 | 核对证据（改后位置） | 漏改 / 新矛盾 |
|-|-|-|-|
| **S1** 重试起点语义 | ✅ | `crud-05:385-393`（3.5.8 重写为「从失败 step 续跑」+ 动作序列 5 步）、`crud-05:707`（4.8 起点行）、`crud-05:20`（接口一览）、`crud-03:1221-1257`（新增 4.3.4 重试种子）、`crud-03:790/794`（process_event 起点判定）、`crud-03:688`（payload 字段） | 机制已定，但**未定义新 Run 的边状态初值** → **S1（严重）**；多条失败 step 取哪条种子未定义 → **G2** |
| **S2** cron 路径事务/归属 | ✅ | `crud-04:616-638`（4.5.2 步骤 2–4 全量重写：② 前置校验 ③ 调 `add_job`（内部同事务）④ 投递即返回）、`crud-04:635`（Scheduler 不自查不自插（D7））、`crud-04:333`（3.4.6 #4 唯一口径）、`crud-05:646-649`（4.6 创建+校验同事务） | 旧句 `步骤 2-3 在同一事务`/`并发占用检查` 0 残留；与 3.4.6 #4 已一致 |
| **G1** `manifest.job.name` 纳入名称锚 | ✅ | `crud-04:458`（字段表）、`:504②`、`:508` 示例、`:511`（同名判重名称） | 新增 `crud-04:511`「三处 `name` 必相等」与自身样例/`file` 仅定位冲突 → **S2（严重）** |
| **G2** `manifest.ops[].name` + `opName` 集合一致性 | ✅ | `crud-03:516`（一致性约束 G2 ①②③）、`crud-04:519`、`:504③` | 无 |
| **G3** 名称锚与 version 拆开 | ✅ | `crud-03:501-509`（独立「名称锚一致性校验」块 + **name 一律拒绝 / 仅 version 为声明参考**）、`crud-04:502-509`、`proposal-01:536`（已改为「后端先做校验 + 前端不做内容校验」）、`validation.md` 旧「待追认」原文已消失 | 无 |
| **G4** p01 §8.9 前后端分工 | ✅ | `proposal-01:536`：「[导入] 提交 `{zip}` → **后端先做**包完整性校验…任一不一致 → 400…用户可手动修改后**重新 [选择文件] 重新提交**」（无「前端校验通过后才提交」） | 无 |
| **G5** §10.1「定义位置」列 | ✅ | `proposal-02:337`（补 crud-03 3.3.9 / crud-04 3.4.10）、`:338/:341`（补 crud-04）、`:356`（补 crud-04 4.5.2 / crud-05 4.6） | `:345` TARGET_NOT_FOUND 语义未覆盖「重试」→ **N7** |
| **G6** `engine.notify` 分流 | ✅ | `proposal-02:84`：「单次 OP / Job(target=op) 直接派发 WorkerPool；Job(target=workflow) / 单次 Workflow 调 `engine.notify`…**Job target.kind=op 时不得走 Engine**」 | 无 |
| **G7** Client 引用检查不对称 | ✅ | `crud-01:44/299/323`（均含「Job.target.clientId（kind=op）**或 Workflow 节点级 clientId**」）、`proposal-02:350`、G7②：`crud-03:123`（悬挂 `clientId` → 运行期 `failed` + `CLIENT_NOT_FOUND`、不启动子进程） | 无 |
| **G8** 重跑/重试快照来源 | ✅ | `crud-05:368-380`（重跑表）、`:417-427`（重试表）、`crud-03:1236`（重试侧同口径） | 无 |
| **G9** FK PRAGMA 连接级 | ✅ | `schema.sql:14-19`（头注：连接级 + 每连接置 ON + Repository 显式 SQL 兜底）、`proposal-02:29`（§1.1 连接初始化约定）；实跑确认 FK 不持久（M3/M4） | 无 |
| **G10** workspaces SQL | ✅ | `crud-06:321-329`（`SELECT workspace, MAX(created_at_ms) AS last_used … GROUP BY … ORDER BY last_used DESC LIMIT ?1` + `HAVING` 变体）、`:339`（`limit ∈ 1..1000`）、`:292`（并入数值项上限表）；实跑通过（M10） | 「最近使用」时间基准与 crud-05 不一致 → **N12** |
| **G11** 配置值 JSON 类型 | ✅ | `crud-06:64`（§一 总则「JSON 线格式（G11 定稿）…一律为字符串」）、`:130`（§二 通用约定 + 非 string → 400）、`:240`（GET「值为 string」）、`:262`（PUT「value 必须为 string」） | 无 |
| **G12** PUT 审计字段 | ✅ | `crud-01:233/273/291`（采纳「一律忽略、不报错」+「携带审计字段不属于错误」+ 与只读项区分）、`crud-03:272`、`crud-04:245`；旧串 `一律忽略（或返回 400`/`按约定拒绝` 0 残留 | `crud-02` 3.2.4 未写该总则 → **N6** |
| **G13** 行内编号无定义 | 🟡 | 已清 `crud-01` `（M20）`、`crud-06` `（P6）`、`crud-02` `3.4.6 #3`；`crud-03`/`crud-04` 导入锚改用具名「决策-导入名称锚一致性」 | 在用标签仍 46 个，D8–D18/G/N 多无释义且未带出处，**D1/D4/D6/D7 一符多义** → **G5（一般）** |
| **N1** 样例悬空节点 id | ✅ | `4e5f60718293a4b5c6d7e8f9a1b2c3d4` 全库 **0 命中**；`crud-03:33/237` 已改为真实 op 节点 id | 无 |
| **N2** 样例缺字段 | ✅ | `crud-04:35`（`"targetName": "deploy_workflow"`）、`crud-05:41`（`"result": null` + 注释） | 无 |
| **N3** 样例 `target.name` 语义 | ✅ | `crud-05:28` 顶层 `"name": "hourly_check"`；`:33` `target.name = "deploy_workflow"`（与 `crud-04:30` 一致） | 无 |
| **N4** `terminated_by` 写入约定 | ✅ | `crud-05:326-330`（用户终止 → `cancelled`；超时 → `timeout`；`run_failed`/`loop_limit` → `error`；success 为 NULL），与 `crud-03:710` reason 枚举对齐 | 无 |
| **N5** 保留天数换算 | ✅ | `crud-06:83`（软删 = 配置值 / 硬删 = 软删 + 1 天）、`crud-06:362`、`schema.sql:272/275/298` | 无 |
| **N6** 错误表 400 行不齐 | ✅ | `crud-05:244-249`（3.5.3）、`:263-268`（3.5.4）、`:428-437`（3.5.8，含 400 续跑种子缺失 + **404 TARGET_NOT_FOUND**，按补充拍板 2）、`:477-`（3.5.9） | 3.5.8 顺序列表未含 400 位次 → **N9** |
| **N7** 导入体积/解包安全 | 🟡 | `crud-03:522`、`crud-04:533`（成员路径/成员数/解压总量 + 超限 400）、`crud-03:528`/`crud-04:539` 错误表补「包体积超限/成员路径非法」 | **未指明用哪个现有配置键**（crud-06 只有 `client_import_max_bytes`/`op_import_max_bytes`）→ **拍-2** |
| **N8** 两导入节对称与顺序 | ✅ | `crud-03:491-499` / `crud-04:492-500`（同一体例的 5 步显式列表）；`crud-03:528`（成员缺失）、`crud-04:539` | 顺序列表未覆盖全部 400 场景 → **N10** |
| **N9** 导入并发/幂等 | ✅ | `crud-03:519`、`crud-04:531`（`BEGIN IMMEDIATE` 单写事务 + `UNIQUE` 冲突映射 409 + 不做去重幂等） | 无 |
| **N10** `settings X` 术语 | 🟡 | crud-01（0）/crud-02（0）/crud-03（0）/crud-04（0）已清 | **`crud-05` 仍 6 处**（`:354/:362/:437/:534/:547/:645`）→ **N1（轻微）** |
| **N11** Repo 清单/ConfigRepo | ✅ | `proposal-02:178`（去掉重复 `ClientRepo`）、`:179`（删 `ConfigRepo` + 「不定义 trait」） | 无 |
| **N12** on_complete 图注 | ✅ | `proposal-02:60`（「on_complete 钩子（全局 JOB_COMPLETE / STEP_COMPLETE）」） | 无 |
| **N13** 状态机漏 `terminating` | ✅ | `proposal-02:76`（waiting → running → terminating → 终态） | `crud-03:1256` 括注仍缺 → **N14** |
| **N14** 完成钩子命名混用 | 🟡 | `proposal-02:86`、`crud-03` 正文（`JobComplete`/`StepComplete`）已统一 | **`crud-05:324`（`JobComplete` / `step_complete` 混写）、`:661`（`job_complete`）、`:667`（`step_complete`）、`schema.sql:235-236`** 未改 → **N2（轻微）** |
| **N15** `opId` 「名称锚」措辞 | ✅ | `crud-02:318`：「`opId` 由后端重新生成；引用它的一方（Workflow / ZIP 包）按其**名称**重映射」 | 无 |
| **N16** 粗体交叠 | 🟡 | `crud-03:1303` 已拆为「**注意**：…」 | **`crud-05:542`** 仍交叠嵌套 → **N2（轻微）** |
| **D1** `retry.max` = 每轮尝试次数 | 🟡 | `crud-03:94`（每轮最大尝试次数）、`:735`（本轮尝试计数 = 记录数）、`:1112`（D1 注）、`:1124`（记录数 >= max）；`max+1`/`记录数−1` 类措辞在 crud-03 **0 残留**（tests 侧亦 0） | **`schema.sql:218`** 仍写「重试计数 = …记录数 - 1」→ **G4（一般）** |
| **D2** 校验与保存解耦 | ✅ | `crud-03:309`（[校验] 仅用户主动点击；[保存] 不要求校验通过；[执行] 由后端创建 Run 前校验）；`proposal-01` 旧串「校验通过后才能保存」**0 命中** | 无 |
| **D3** 节点 `clientId` 必填 | ✅ | `crud-03:73`（op 节点必填）、`:121`（规则 10）、`:130`（兼容路径注）、`crud-04:224/254`；**补充拍板 4** 允许历史空值走兼容路径，schema 可空保持 | schema 注释未同步 → **N4** |
| **D4** `unbound` / 无来源判据 | ✅ | `crud-03:77/84/86`（`unbound` + 判据）、`:124-126`（规则 14/15）、`:87`（下拉候选范围） | schema 注释未同步 → **N3** |
| **D5** Client 类型匹配 + 固定 message | ✅ | `crud-03:122`（规则 11，码取总表 `CLIENT_TYPE_MISMATCH`）、`:257/281/365/529`、`crud-04:224/254/305/516/540`（固定 message 逐字一致）；按**补充拍板 1** 采用 `400 CLIENT_TYPE_MISMATCH`，`proposal-01:376` 已同步 | 无 |
| **D6** 重试保留续跑 | 🟡 | 两端契约核对：字段名 `resumeFromRecordId`（`crud-03:688/794/1235` ↔ `crud-05:391/664/666`）、写入方（`crud-03:1233` ↔ `crud-05:366/415/427`）、前置节点不入 `step_records`（`crud-03:1243` ↔ `crud-05:392/707`）、缺失快照 400（`crud-03:1252` ↔ `crud-05:433`）、幂等（`crud-03:1246/1256` ↔ `crud-05:393`）、rerun 不写（两端一致）——**六项全部一致** | 边状态初值缺失 → **S1**；恢复路径未适配 → **G1**；种子选择未定义 → **G2**；字段名 `runId` 不一致 → **N11** |
| **D7** cron JobRun 归属 | ✅ | `crud-04:627-635`（`add_job` 内单事务 + 不自查不自插）、`:582`（职责）、`:584`（同一校验顺序）；与 `crud-04:333`（3.4.6 #4）一致 | 4.5 与 3.4.6 的校验顺序均把 `needsUpdate` 排在 waiting 上限之前 → **G3** |
| **D8** 拓扑校验基准（允许环） | ✅ | `crud-03:108-128`（17 条，含第 17 条「允许环路」显式替代「DAG 无环」）、`crud-03:309`（校验接口同步 17 条）、`proposal-01:1351`（p01 §10.14「不校验环（D8）」+ 回跳计数） | 未含「边引用不存在节点」规则 → **N8**；p01 §10.14 未标导入例外 → **N15** |
| **D9** PUT 审计字段一律忽略 | ✅ | `crud-01:233/273/291`（三处同一措辞）、`crud-03:272`、`crud-04:245`（均写明与 crud-06 只读项「显式拒绝 400」的区别）；`crud-06:270` 只读项明确拒绝 | crud-02 未写 → **N6** |
| **D10** 名称锚覆盖范围 | ✅ | `crud-03:503`（workflow.name / ops[].name）、`crud-04:504`（target.name / job.name / ops[].name）、`crud-04:505`（`file` 仅定位、不校验文件名）、`proposal-01:536`（四项一致） | 无 |
| **D11** message 格式固化 | ✅ | `proposal-02:365-367`（含示例 + 「前端原样展示、不解析」）、`crud-03:505-507`、`crud-04:506-508`（格式串逐字相同） | p01 示例用 `bash-build`（D11 原文），与 crud-03/04 的中性示例风格不同（非缺陷，建议统一） |
| **D12** 校验顺序显式化 | 🟡 | 导入侧 ✅（`crud-03:491-499` / `crud-04:492-500`）；运行侧：`crud-05:361-364`（waiting → RERUN → skip）、`crud-05:409-413`（waiting → TARGET_NOT_FOUND → RETRY → skip，按补充拍板 2） | `crud-04:313-317` 顺序（needsUpdate → 类型 → waiting → skip）与 crud-05/D12 不同 → **G3**；导入侧列表未覆盖全部 400 场景 → **N10** |
| **D13** 被测前端口径 | — | 落点在 `tests/` 与 `tasks.md`（**不在本轮范围**，另路由其它校验员核对） | — |
| **D14** `max_loop_multiplier=0` | ✅ | `crud-06:82/289/295/358`、`crud-03:738`（「不施加绝对上限、仍受 `max × 3` 约束」） | 无 |
| **D15** cancelled 可重试 | ✅ | `crud-05:385`（中止前已落 failed/timeout 的 step 即种子；无失败 step 不可重试）、`:472`（reason 枚举同口径）、`:714`（4.8 can-retry） | 无 |
| **D16** 触发筛选 5 值单值枚举 | ✅ | `crud-05:189`（列表）、`:448`（导出 filters）、`crud-03:1233`（`triggered_by=retry` 为五值之一） | 无 |
| **D17** `retry_from_record_id` 改名 | ✅ | `schema.sql:187-189`（列改名 + 段注「仅 retry 写入」）、`crud-05:20/43/110/143/366/390/415/427/710`、`crud-03:1231-1233/1243`；`retry_from_step_id`/`retryFromStepId` 在 scope 内 **0 命中**（仅 `crud-03:1232` 说明性提及旧名） | 无 |
| **D18** 事件保留换算 | ✅ | `crud-06:83/362`（软删 = 配置值、硬删 = 软删 + 1 天）、`schema.sql:272/275/298`（「不随配置缩放」） | 无 |
| **低成本 1** `timeoutSeconds` | ✅ | `crud-02` 3.2 对象字段/字段映射/3.2.3/3.2.7（必填、默认 60、1..86400）；schema `DEFAULT 60` 保留（与补充拍板 3 一致） | 无 |
| **低成本 2** 导入体积上限取现有键 | 🟡 | 未新造配置键（符合要求） | 未指明具体键 → **拍-2** |
| **低成本 3/4/5** | — | 落点在 `ui/`、`tasks.md`、`tests/fixtures`（不在本轮范围） | — |
| **补充拍板 1** D5 错误码 | ✅ | `crud-03:122/365`、`crud-04:254/308/540` 用 `CLIENT_TYPE_MISMATCH`；`proposal-02:337` 定义位置已含 3.3.9/3.4.10 | 无 |
| **补充拍板 2** 3.5.8 补 404 | ✅ | `crud-05:411`（顺序第 2 步）、`:435`（错误表）、`:474`（3.5.9 reason 枚举「目标（Workflow）已删除…」）、`:443`（判断条件含目标仍存在）、`:116` | 总表语义列未改 → **N7** |
| **补充拍板 3/4/5/6/7** | ✅ | timeoutSeconds 必填+DB 默认（N/A 冲突）；`crud-03:130` 兼容路径 + schema 可空；E2 断言属 tests；`crud-03:1236` + `crud-05:368/417`「一律取原 Run 快照」；G9 双处落地 | 无 |
| **补充拍板 8**（暂缓 L-12 / UI L9） | ✅ | 未改动（`proposal-02` 章号混用仍在，属已记录暂缓项） | 无 |

---

## 严重

### S1. 「重试续跑」未定义**新 Run 的边状态初值** → 多入边汇聚节点（含 End）永远不就绪，Run 永久卡在 `running`

- `crud-03:1243`（4.3.4② 1）原文：**「以该 StepRecord 对应的**节点**为起点：该节点的**全部前置节点视为已完成**——**不写入新 Run 的 `step_records`**，仅由 `retry_from_run_id` / `retry_from_record_id` **溯源**；」**
- `crud-03:1245`（4.3.4② 3）原文：**「…起点节点的就绪判定**不要求**其入边被激活（视为已就绪）」**
- `crud-05:392`（3.5.8 步骤 4）同口径：**「…其**全部前置节点视为已完成**（**不写入新 Run 的 `step_records`**…）」**
- 而就绪/收敛判定是**按边**做的：`crud-03:755` 原文 **「该节点**所有入边** ∈ {activated, dropped}，且**至少一条 activated**」**；`crud-03:757`（End）原文 **「**所有入边均已决定**（activated / dropped）且**至少一条 activated**」**；`crud-03:1093` 原文 **「无可就绪节点且无挂起候选但 End 未 activated → 写 workflow_done(failed)（…**挂起候选：正常推进下 = pending_reentry + 已评估未就绪**…）」**。
- 全库检索「seed/种子/边状态」交叉处（M8 命令）**无任何一句规定新 Run 的 edge_state 初值**：既没说「种子节点的入边置 activated」，也没说「被跳过的前缀节点出边按源 Run 终态置 activated/dropped」。

**问题**：只有「线性链」能正常收敛；**任何菱形/并行汇聚结构**都会卡死——例如 `Start → A`、`A →{on_success} B`、`A →{on_success} End`、`B →{on_success} End`（源 Run 中 A 成功、B 失败）：重试从 B 起跑，新 Run 中 `A→End` 这条入边**永远停在 `pending`**（A 被视为已完成但它的出边从未被决定），于是 End 既不就绪（不满足「所有入边均已决定」）也不是 `skipped`（不是「全部入边 dropped」），按 `crud-03:1093` 它始终是**挂起候选** → 收敛永不成立 → `job_runs.status` 永久 `running`（`crud-05:496`/`crud-03:924` 承诺的「job_run 不会卡在 running」被打破）。同时 `最终 status` 无法落库，`3.5.3` 轮询/界面无限「运行中」。

**建议改法**（二选一，写入 `crud-03 4.3.4②` 与 `crud-05 3.5.8④`，两端同句）：
1. **（推荐）以源 Run 的边状态终值为初值**：「新 Run 的 `RunContext` 以**源 Run 终态时的边状态快照**初始化——前缀节点（种子节点及其全部前置节点）的出边按源 Run 记录置 `activated` / `dropped`，且前缀节点集合一并作为『已执行过』集合初值（供回跳判定复用）；不写入 `run_edge_state`（该表仍是可选快照）、仅作内存初值，重放时由 `retry_from_record_id` + 源 Run 事件/记录重建（幂等）。」
2. **（备选）把前缀边从 join 中剔除**：「种子节点的全部入边、以及**源节点属于前缀节点集**的边，在新 Run 中一律视为 `activated`（不参与就绪判定）」，并说明此时若前缀节点在源 Run 中为 `dropped` 的分支不参与判定（会轻微改变边界语义，需一并确认）。

> 本条是 D6 落地后**新暴露**的契约空洞（R1 的 S1 只要求「定义种子机制」，未覆盖边状态）；与 R1 S1 同属「重试起点语义」，建议优先处置。

### S2. `crud-04:511`「三处 `name` 必相等」与同节样例/`file` 仅定位口径**直接冲突**，按此实现会拒绝正常 Job 包

- `crud-04:511` 原文：**「- **同名判重用的名称**：以校验通过后的同一名称（三处 `name` 必相等）为准。」**
- 同一节的**样例**（`crud-04:445`、`:447`）：`"job": { "name": "hourly_check", "version": 1 }` 与 `"target": { "kind": "workflow", "name": "deploy_workflow", … }`——**Job 名 ≠ 目标名**（正常且必然）。
- `crud-04:460` 原文：`file` **仅作包内定位**…导入端**不校验文件名**，只校验 `file` 指向成员**存在**及其**内容**的 `name`；`crud-04:504` 明确纳入校验的三对是 `target.name↔target.file 内 name`、`job.name↔job.yaml 内 name`、`ops[].name↔其 file 内 name`——**两对互不相等且不应相等**。
- 参照 `crud-03:515/516` 的同位句（Workflow 包）只要求「workflow.name 与 workflow.yaml 的 name」，未出现「三处」类表述。

**问题**：两种读法都是错的——①「三处」= `manifest.job.name` / `job.yaml.name` / `manifest.target.name` ⇒ 与样例直接矛盾，会 400 拒绝**任何** Job 名与目标名不同的包（即绝大多数）；②「三处」含包内文件名 ⇒ 违反 D10「`file` 仅作定位、不校验文件名」。且该句出现在判定「同名判重」这种会落到 409/400 的路径上，实现者照抄即产生错误拒绝。

**建议改法**：把该行改为（与 R1 G1 原文建议一致）：**「- **同名判重的名称**：判重与入库统一使用**校验通过后的 `manifest.job.name`（= 包内 `job.yaml` 的 `name`，两处必相等）**；`manifest.target.name` 与被跳过的 `file` 名**不参与** Job 判重（`target` 只按 `target.name` 与包内文件 `name` 一致性校验）。」** 并顺带在 3.4.10 的 400 行中区分「Job 名锚」与「目标名锚」两类不一致。

---

## 一般

### G1. 崩溃恢复路径未适配「续跑」：`recover` 补写 `engine_start` 时**丢失 `resumeFromRecordId`** → 重试 Run 从头执行（重复执行已完成节点）

- `crud-03:920`（4.3.0 恢复闭环 0b，Q2）原文：**「若某 running run 在 `engine_events` 中**无 engine_start 事件**（崩溃落在「Runner 置 running」与「notify 写 engine_start」之间）→ recover **用当前定义补写 engine_start（含定义快照）并处理**（该 run 尚无 step 执行，**等于从头启动**）」**
- `crud-03:919` 原文（S1 窗口）：**「…若不含（S1 窗口）则回退首次处理路径（加载定义 + 校验 + UPDATE payload，**等价从头启动**）」**
- 但重试 Run 的续跑种子**已持久化在 DB 行**（`crud-05:390` 步骤 2 先写 `job_runs.retry_from_record_id`，步骤 3 才 `notify`），本可无损恢复。

**问题**：Q2 场景下（补写事件不带 payload 种子）Engine 会走「不含 `resumeFromRecordId` → 一律从 Start 起步」（`crud-03:1247`），**把已成功的前缀节点重新执行一遍**（OP 有副作用：部署、构建、prompt 调用…），与 D6「已完成节点不重复执行」的对外承诺矛盾；`crud-03:919` 的「等价从头启动」措辞对「payload 含种子但不含定义快照」的情形同样不成立（该情形下起点判定仍按种子续跑）。

**建议改法**：① `crud-03:920` 补一句「补写 `engine_start` 时**必须同时从 `job_runs.retry_from_record_id` 反查续跑种子**（该列在 `notify` 之前已落库），payload 一并写入 `resumeFromRecordId`；仅当该列为 NULL 时才视为普通 Run 从头启动」；② `crud-03:919` 改为「**若不含定义快照** → 回退首次处理路径（加载定义 + 校验 + UPDATE payload）；**起点仍由 payload 内 `resumeFromRecordId` 决定**（若 payload 亦不含该字段但 `job_runs.retry_from_record_id` 非空 → 按 G1 从该列重建）」——即「等价从头启动」只在**两者皆无**时成立。

### G2. 源 Run 存在**多条失败/超时 step** 时，「续跑种子」取哪一条未定义

- `crud-05:390`（3.5.8 步骤 2）原文：**「…写 `retry_from_run_id` = 源 Run、`retry_from_record_id` = 源**失败 / 超时 StepRecord 主键**（`step_records.record_id`；**同一 step 有多条记录时**取 `(activation_seq, retry_seq)` 最大者，同 3.5.5）」**
- `crud-03:1232` 同义（只定义「源**失败 / 超时** step 记录」，未定义跨 step 的选择）。
- 触发条件（`crud-05:385`/`4.8`）只要求「存在失败/超时 step」。

**问题**：并行分支下**两个不同 step 同时失败**是常态（如 A 失败置 `run_failed`、B 也在飞随后失败）；此时选 A 还是 B 直接决定新 Run 的起点与后续可达集合，文档未给规则，两个实现者会得到不同行为（且 `tests` 中的断言只覆盖单一失败节点场景）。

**建议改法**：在 `crud-05:390` 与 `crud-03:1231-1232` 各补一句选择规则，二选一并全链路统一：① 「取**源 Run 中失败/超时记录 `created_at_ms` 最晚**的那条（= 最后失败的 step，等价于“从最早可续跑点之后的最后一次失败处继续”）」；② 「按画布拓扑序（start→end）**最早**的失败/超时 step」。建议取 ①（与 `3.5.5`「以最后一条记录为准」同向），并补一条 tests 用例。

### G3. 运行入口「首个命中」顺序：`crud-04 3.4.6` 与 `crud-05 3.5.7/3.5.8` 不一致，且与拍板 D12 规定的顺序不同

- D12 原文（`_fix_v2_decisions.md:40`）：**「运行入口侧（crud-04 3.4.6 / crud-05 3.5.7 / 3.5.8）：① **全局 waiting 上限 → 409 `CONCURRENCY_CONFLICT`**；② 重跑/重试前置（`RERUN_NOT_ALLOWED` / `RETRY_NOT_ALLOWED`）→ 409；③ `concurrency=skip` 已有在途 → 409 `CONCURRENCY_CONFLICT`。」**
- `crud-04:313-317` 原文：**「① `needsUpdate` → 409 `JOB_NEEDS_UPDATE`；② `CLIENT_TYPE_MISMATCH` → 400…；③ **全局 waiting 上限**…→ 409；④ `concurrency=skip` 且同 Job 已有 waiting/running/terminating → 409…（③ 先于 ④，与 crud-05 3.5.7/3.5.8 的运行入口顺序一致，见 D12）」**；`crud-04:584`（4.5 引言）复述同一顺序（`needsUpdate` → `CLIENT_TYPE_MISMATCH` → `concurrency`）。
- `crud-05:361-364` / `:409-413` 则是 waiting 上限**第一条**。

**问题**：同一时刻「waiting 队列已满」+「Job `needsUpdate`」时，`POST /api/jobs/{id}/run` 返回 `409 JOB_NEEDS_UPDATE`，而 `POST /api/runs/{id}/rerun` 返回 `409 CONCURRENCY_CONFLICT`——两处对「首个命中」给出不同答案，且 `crud-04:317` 自称「与 crud-05 一致」只覆盖 ③/④，读者会误以为整表一致。D12 明确要求 waiting 上限最先。
**建议改法**：二选一并写明理由：① 把 `crud-04 3.4.6` 改为「① 全局 waiting 上限 → 409；② `needsUpdate` → 409；③ `CLIENT_TYPE_MISMATCH` → 400；④ skip 在途 → 409」（与 D12/3.5.7/3.5.8 全对齐）；② 或保留 Job 入口顺序，但把 `:317` 改为「**③ 先于 ④**；**`needsUpdate`/类型校验为 Job 入口的定义层前置**，故排在全 waiting 上限之前（与 3.5.7/3.5.8 的差异已知、是否对齐见拍-5）」并同步 4.5 引言。

### G4. `schema.sql:218` 仍是 D1 旧口径（`重试计数 = 记录数 - 1`），与 `crud-03:735`（`本轮尝试计数 = 记录数`）冲突

- `schema.sql:213-219` 原文：**「★ 同一 step 在本次 Run 内可能被执行多次… (run_id, step_id, activation_seq, retry_seq) 唯一标识一次实际执行。**重试计数 = 同 (run_id, step_id, activation_seq) 记录数 - 1**；执行总次数上限 = min(max×3, max_loop_multiplier) = 同 (run_id, step_id) 的 step_records 记录数（含全部 activation × attempt）。」**
- `crud-03:735` 原文：**「**本轮尝试计数** = 同一 `(run_id, step_id, activation_seq)` 下的**记录数**（**首次执行计入**；用于 `apply_retry` 的 `max` 判定，见 4.3.2）」**；`crud-03:1124` 判定式：**「同 (run,step,activation_seq) 记录数 >= max，**首次执行计入**」**。
- `crud-03:1112`（D1 拍板口径）：**「`max` = **每轮总尝试次数**（首次执行计入）——`retry.max=3` → 每轮最多 3 次尝试」**。

**问题**：D1 拍板的落地清单只动了 crud-03（`schema.sql` 由 D 组负责、漏改）。按 schema 注释推导「重试计数 = 记录数 − 1」再与 `max` 比较，得到「首次 + max 次重试 = max+1 次尝试」的**旧语义**（R1 的 D1 缺陷原样复现），而 crud-03 得到 3/3/3。DB 注释是 DDL 的一部分、实现者常直接照抄。

**建议改法**：`schema.sql:218` 改为 **「本轮尝试计数 = 同 (run_id, step_id, activation_seq) 记录数（**含首次**；= `retry.max` 的判定基准，`retry.max=3` → 每轮 3 次尝试，见 crud-03 4.3.0/4.3.2）；重试次数（派生）= 记录数 − 1」**——把「重试次数」明确降级为派生展示量，避免与判定基准混用；同时在 MG（机械自检）清单中加入「`schema.sql` 与 crud-03 的 `max` 口径逐字比对」一项。

### G5. 行内编号治理未闭环：在用标签 46 个、多数无释义且不带出处；**`D1`/`D4`/`D6`/`D7` 等在同一文件内一符多义**

- `proposal-01:2923`（§20.1）原文：**「它们**不是全局唯一 id**：**同一字母在不同章节 / 文件可指不同决策**…因此**引用时必须带出处**」**，同节释义表只到 `D1–D7`（`U1/U13/T26/S1/V11-B/C7/C1/C4`）。
- 机械普查（M8）：proposal-02 + crud-01..06 正文在用标签 **46 个 / 82 处**，其中 **D8–D18** 与 **G2/G3/G8/G9/G11/N1/N4/N7/S8/Q1/Q2/Q4/R3/S2/T13/U8/V4/W6/Z3/M17/P4/AA7/AA8/BB5** 在 §20.1 **无条目**；**没有任何一处引用写出 `_fix_v2_decisions.md` 这个出处**。
- **一符多义的实锤（同一文件内）**：
  - `crud-03:1112`「**`max` 语义（D1 拍板）**」（= R1 D1：`retry.max` 语义） vs `crud-03:1294/1298/1302`「**（D1 拍板）**」（= p01 §20.1 的 D1②：DB 排队 / 超时计时起点）。
  - `crud-03:86/87`「**无来源判据（D4）**」（= R1 D4：`unbound`） vs `crud-03:1304`「**waiting 队列上界的运维结论（D4，定稿）**」（= p01 D4：`job_queue_waiting_max` 触顶即拒）。
  - 跨文件：`crud-06:321`「**数据来源（D6 定稿）**」（= p01 D6：workspaces 数据源） vs `crud-05:387`/`crud-03:1223`「**（D6 定稿）**」（= R1 D6：重试续跑）；`crud-01:403`/`crud-03:390`/`crud-04:384`「（D5 适用范围=全部导出）」（= p01 D5） vs R1 D5（Client 类型匹配）。`crud-05:517`「（D5/D7，前端侧）」与 `crud-04:635`「（D7）」（R1 D7：cron 归属）亦同名异义。

**问题**：这是 R1 G13 的同类项**在修复后扩大**（修复者按拍板文件新增了大量 `（D9）`/`（D10）`/`（D12）`/`（D17）`/`（G2）`/`（G11）` 等行内标签）。评审报告内部的条目号（G/N 系列）被直接写进交付规格，而第三方读者（实现者）**无从解析**：既没有 §20.1 条目，也没有「见 `_fix_v2_decisions.md` D12」式出处；且同文件内同字母指两件事，与 §20.1「引用必须带出处」的规范直接冲突。
**建议改法**（建议 ①+②）：① 在 `proposal-01 §20.1` 释义表补登 **D8–D18** 与本次新增的 **G2/G3/G8/G9/G11/N7/N1/N4/S8** 条目（注明出处 = `_fix_v2_decisions.md` / `_val2_02_backend.md`）；② 按 §20.1「后续建议」把**本次新增**的引用改用具名口径（`决策-导入名称锚一致性` 已是范本），至少给每个 `（D..）` 加「见 `_fix_v2_decisions.md` D…」；③ 顺手删掉 §20.1 中已不存在的 `M20`/`P6`/`#1..#8` 示例（见 N15）。

---

## 轻微

### N1. `crud-05` 仍留 6 处 `settings X` 陈旧术语（R1 N10 漏改）

- 原文：`crud-05:354` **「全局 waiting 队列达 settings `job_queue_waiting_max`（默认 20、可调、上限 1000）上限」**；同 `:362`、`:437`；`:534` **「间隔可经 settings 配置」**；`:547` **「并发阈值 = settings `job_queue_running_max`（默认 10、上限 10）」**；`:645` **「≥ settings `job_queue_waiting_max`」**。
- 对照 `crud-06:12`「**settings 表已废弃**…唯一事实来源 = `ai-automation.json`」与 crud-01/02/03/04 已 0 命中。
**建议**：6 处统一替换为「配置项 `job_queue_waiting_max`（`ai-automation.json`，见 crud-06 一）」；建议把「`settings` 字样 = 0 命中（除 crud-06 §〇 说明与 `settings.html` 原型引用）」写入机械自检清单。

### N2. `crud-05` 完成钩子命名混用（R1 N14 漏改）+ 交叠粗体（R1 N16 漏改）

- 命名：`crud-05:661` **「…完成后调 job_complete」**、`:667` **「…Worker 执行完调 step_complete」**、`:324` **「`JobComplete` / `step_complete` 路径把该 step 的 …写入」**、`schema.sql:235-236` **「完成调 job_complete 钩子 / 完成调 step_complete 钩子」**。
- 交叠粗体：`crud-05:542` 原文片段 **「…先写 engine_events 落库，**写后立即 `process_event` 同步处理**（无事件循环 / 无信号）**」**（`**` 计数为偶、但 A→B→C 交叠嵌套，渲染会错位；crud-03:1303 半边已修）。
**建议**：① 四处改为 `JobComplete` / `StepComplete`（并在 schema 注释中写明「对应 static `JOB_COMPLETE` / `STEP_COMPLETE`」）；② `crud-05:542` 拆为互不交叠的两段（如「…落库；**写后立即 `process_event` 同步处理**（无事件循环 / 无信号）」），并把「禁止 `**` 交叠」加入 markdown lint 门禁。

### N3. `schema.sql:113` 的 `bindings` kind 注释未同步 D4（缺 `unbound`）

- 原文：`bindings TEXT, -- JSON object` 上方注释 **「-- bindings: {"paramName": {"kind":"node_output"|"workflow_input"|"literal", ...}}」**；而 `crud-03:77` 为 **「`"node_output" | "workflow_input" | "literal" | "unbound"`」**，`:84` 定义了 `unbound`（D4）。
**建议**：注释补 `|"unbound"`，并注明「`unbound` = 拖拽初始态 / 视为无来源（crud-03 3.3 判据）」。

### N4. `schema.sql:112` 的 `client_id` 注释与 D3「op 节点 `clientId` 必填」并存易误读

- 原文：`client_id       TEXT,   -- 可为空, 执行时再选`；而 `crud-03:73`「clientId … op 节点**必填**（缺失 → 400）」；补充拍板 4 已确认「schema 可空保持不变 + 兼容路径」。
**建议**：注释改为 **「-- 接口层必填（crud-03 校验规则 10）；存储层可空以兼容历史 / 导入遗留空值（运行期回退 Job.target.clientId，仍空 → run_failed，见 crud-03 3.3 兼容路径）」**。

### N5. `schema.sql` 事件注释未同步 D6 新增 payload 字段

- `schema.sql:294` 原文：**「payload TEXT, -- JSON: 节点出参 / 下一批就绪节点 / 上下文快照 / EngineStart 的 inputs+workspace / Terminate 的 reason」**；`:277-281` 段注亦只提「payload 承载 inputs/workspace/reason」。而 `crud-03:688` 新增 **`engine_start.resumeFromRecordId`**（重试续跑种子）。
**建议**：两处注释补「`engine_start` 另可含 `resumeFromRecordId`（仅重试路径，= `job_runs.retry_from_record_id`）」。

### N6. `crud-02` 3.2.4（PUT `/api/ops/{opId}`）未写 D9 审计字段规则（覆盖不全）

- `crud-02:207` 原文：**「op | OpCreateRequest | 是 | 更新的内容（不含 id/version/时间戳）」**——只声明「不含」，**未规定携带 `opId`/`createdAtMs`/`updatedAtMs` 时的行为**；错误表 `crud-02:215` 仅「请求体字段非法」。
- 对照 crud-01/03/04 均已有「**一律忽略、不报错**」总则（D9）。
**建议**：在 `crud-02` 3.2.4 补同一句（或按 R1 G12 的建议在 `proposal-02 §3.0` 通用约定写一条总则，各 crud 引用），保持四实体一致。

### N7. `proposal-02:345` `TARGET_NOT_FOUND` 语义未覆盖「重试」场景

- 原文：``| `TARGET_NOT_FOUND` | 404 | 重跑时目标（op / workflow）已删除 | crud-04/05 |``；而补充拍板 2 后 `crud-05:435`/`:411` 明确 **[重试] 目标 Workflow 已删除 → 404 `TARGET_NOT_FOUND`**（与重跑对称）。
**建议**：语义列改为「**重跑**时目标（op / workflow）已删除；**重试**时目标 Workflow 已删除（与重跑对称，见 crud-05 3.5.8/3.5.9）」。

### N8. `crud-03` 校验规则 1–17 未含「`edges.from/to` 必须指向存在的 `workflowNodeId`」

- `proposal-01:1367`（§10.14 提示表）原文：**「连线引用了不存在的节点 | “有 N 条连线引用了不存在的节点”」**（前端校验项）；`crud-03:112-128` 的 17 条规则无对应条（仅 `:528` 兜底写「拓扑非法等」）。D8 要求「把 §10.14 除无环外的规则补进 crud-03」，提示表内的该失败场景因此落空。
**建议**：新增规则 18「`edges[].from` / `.to` 必须命中本 Workflow 内的 `workflowNodeId`（否则 400 `VALIDATION_ERROR`）」，并在 3.3.3/3.3.4/3.3.6 的错误表同步；顺带把 p01 §10.14 提示表与 crud-03 规则编号建立对照。

### N9. `crud-05` 3.5.8「校验顺序」未含「续跑种子缺失 → 400」的位次

- `crud-05:409-413` 只列 ① waiting 上限 → ② TARGET_NOT_FOUND → ③ 重试前置 → ④ skip；而 `:433` 的 400「续跑种子缺失」同样是入口校验、`crud-03:1252` 明确「该预检在**重试入口**执行」。
**建议**：在 3.5.8 顺序列表中显式插入（建议置末位）：「⑤ **续跑种子快照缺失** → 400 `VALIDATION_ERROR`（message 指明缺失绑定，见 crud-03 4.3.4③）」；若需早于 ③ 返回，请一并说明理由。

### N10. `crud-03:491-499` / `crud-04:492-500` 的「导入校验顺序」与同节 400 行列出的场景不完全对齐

- 顺序表 ① 写「ZIP 解析失败（含包体积超限、成员路径非法、成员缺失）」；而 400 行 `crud-03:528` 还列出 **name 超 512 字符 / 节点总数超 `workflow_max_nodes` / 拓扑非法 / `opName` 未命中** 等场景，这些在「返回首个命中」的列表中**没有位次**。
**建议**：在 ① 后插入一步「①b 结构与上限校验（name 长度、节点总数、拓扑/可达性、`opName` 集合）」或把 ① 改写为「① 包解析与结构校验（含体积/成员路径/成员缺失/上限/拓扑）」；`crud-04` 同理（含 `job.yaml` 缺 `workspace`）。

### N11. `crud-03:1235` 字段名 `runId` 与 `crud-05:391` 的 `run_id` 不一致

- `crud-03:1235` 原文：**「随后调 `engine.notify(EngineStart{ runId: 新 Run, resumeFromRecordId })`」**；`crud-05:391` 原文：**「`engine.notify(EngineStart{ run_id: 新 Run, workflow_id, inputs, workspace, resumeFromRecordId: 源 StepRecord 主键 })`」**；`crud-05:664/666` 亦用 `run_id`；事件表（`crud-03:683-688`）不含 `run_id`（`run_id` 为表列）。
**建议**：统一为 `run_id`（与 `runId` API 字段区分：结构体字段用 snake，JSON 用 camel），并在 4.3.4① 指明「`run_id` 即新 Run 的 `job_runs.run_id`（engine_start 事件的列）」。

### N12. `crud-06 3.6` 的「最近使用」用 `MAX(created_at_ms)`，与运行历史的时间基准（`started_at_ms`）口径不一

- `crud-06:321` 原文：**「按**最近使用**排序（即该工作区**最近一次运行时间**倒序）」**，SQL 用 ``MAX(created_at_ms) AS last_used``（`:324`）；而 `crud-05:194` 明确 **「过滤列（定稿）= `job_runs.started_at_ms`（即以「开始执行时刻」为基准，非 `created_at_ms`）」**，且 `waiting` 记录 `started_at_ms` 为 NULL。
**建议**：二选一并写明：① 保持 `created_at_ms` 但把措辞改为「**最近一次提交（入队）时间**倒序」；② 改为 `COALESCE(started_at_ms, created_at_ms)`（更能表达「最近一次运行」）。建议 ①（改动最小、语义可验证）。

### N13. `crud-03:1194` 表格单元内的 `|` 未转义 → 表列数错乱

- 原文：``| | `edge_key` | TEXT NOT NULL | `"<from_workflow_node_id>|<to_workflow_node_id>|<condition>"`（edges 无独立 id） |``（实测该行 7 个分隔符 vs 表头 5 个）。
**建议**：把单元内的 `|` 转义为 `\|`（`schema.sql:314/318` 的同名说明为代码注释、不受影响）；并把「表格单元内 `|` 必须转义」加入 lint。

### N14. `crud-03:1256` 生命周期括注缺 `terminating`（同 R1 N13 一类）

- 原文：**「重试 Run 的 `status` 生命周期与普通 Run **完全相同**（`waiting → running → success/failed/timeout/cancelled`）」**；普通 Run 含 `terminating`（`crud-05:104`、`schema.sql:182`；`proposal-02:76` 已按 N13 修正为四段式）。
**建议**：改为「（`waiting → running [→ terminating] → 终态 success/failed/timeout/cancelled`）」。

### N15. 跨文档残留（`proposal-01` 不在本轮范围，登记备查）

- `proposal-01:1584` 原文：**「`manifest.target.file` 为导入的名称锚（`workflows/<name>.yaml` 或 `ops/<name>.yaml`）」**——与 D10/`crud-04:460`「`target.file` **仅作定位**、名称锚是 `target.name`」冲突（措辞层面）。
- `proposal-01:2923` 仍以 `M20`/`P6`/`#1..#8` 作为「内部条目号」示例，而这些编号已按 M8/G13 从正文移除（释义表举例陈旧）。
- `proposal-01:1347`（§10.14 规则「所有 OP 节点的 clientId 非空」）未标注「**导入路径按 `clientName` 解析、历史空值走兼容路径**」的例外，而 `crud-03:121/130` 已明确该例外（补充拍板 4）。
**建议**：交由 p01 归属修复者做三处小改（① 「`target.file` 仅作定位，名称锚为 `manifest.target.name`」；② 删去已不存在的示例编号；③ 规则行加「导入例外见 crud-03 3.3.9」）。

---

## 需拍板

| # | 事项 | 建议默认口径 | 影响面 |
|-|-|-|-|
| **拍-1** | **续跑 Run 的边状态初值**（S1）：种子入边置 `activated`｜复制源 Run 前缀边状态｜把前缀边从 join 剔除 | 复制源 Run 终态边状态（+ 前缀节点集合作「已执行过」初值）——语义最完整、两处各加 1 句 | `crud-03 4.3.4②` + `crud-05 3.5.8④`（并影响 `tests` 重试用例断言） |
| **拍-2** | **导入包体积上限用哪个现有键**（N7/低成本 2）：`client_import_max_bytes`｜`op_import_max_bytes`｜取两者较大｜新造 `package_import_max_bytes` | 「同一把尺」= 取 `op_import_max_bytes`（包内主要体积为 OP YAML）并写明；若允许新键则另设 100 MiB 默认 | `crud-03:522`、`crud-04:533`、`crud-06 一`、实现与原型提示 |
| **拍-3** | **多失败 step 时的续跑种子选择**（G2）：最后失败者｜拓扑最早者 | 最后失败者（与 3.5.5「以最后一条记录为准」同向） | `crud-05:390`、`crud-03:1232`、tests |
| **拍-4** | **行内编号治理**（G5）：补登 §20.1（D8–D18 + 新 G/N 标签）｜全部改具名 `决策-<主题>`｜维持现状但要求带出处 | 补登 + 新引用一律带出处（成本低、可追溯） | `proposal-01 §20.1`（出范围）+ 本范围 82 处引用（分批） |
| **拍-5** | **运行入口校验顺序**（G3）：统一为「waiting 上限最先」（D12 原意）｜保留 Job 入口的定义层前置优先 | 统一为 D12（waiting 上限最先），减少跨入口行为差异 | `crud-04 3.4.6` + `:584` + `crud-05 3.5.7/3.5.8`（已合规） |

---

## 修复顺序建议

| 序 | 项目 | 理由 / 工作量 |
|-|-|-|
| 1 | **S1 + 拍-1**（续跑边状态初值） | 唯一会**卡死 Run** 的契约空洞，落点集中（crud-03 4.3.4② + crud-05 3.5.8④ 各 1 句 + tests 1 例），先拍口径再动笔 |
| 2 | **S2**（`crud-04:511`「三处 name」） | 一行删改即可消除「会 400 拒绝正常包」的错误规则；与样例/`file` 仅定位口径一并自检 |
| 3 | **G1 + N5/N11**（恢复路径与 schema 注释同步） | 同属 D6 落地收尾：补「从 `retry_from_record_id` 重建种子」1 句 + 统一 `run_id` + schema 注释 3 处 |
| 4 | **G4**（`schema.sql:218` 重试计数口径） | 一行改注释，消除 D1 的唯一残留（实现者照抄风险高） |
| 5 | **N1/N2/N14**（crud-05 术语与命名清扫：`settings`×6、`job_complete`×3、交叠粗体×1、生命周期括注×1） | 一次性 grep 替换 + 1 处拆行，纯文本级 |
| 6 | **G3 + 拍-5**（运行入口校验顺序） | 需先拍板；对齐后 3 处列表改成同序 |
| 7 | **G2 + 拍-3、N9、N10**（种子选择规则与校验顺序补位） | 都是「补一句 + 补一步」；与 tests 联动 |
| 8 | **N3/N4/N6/N7/N8/N12/N13**（schema 注释、crud-02 审计规则、错误码语义、规则 18、workspaces 措辞、表格转义） | 批量小改；建议配 lint（`**` 交叠、表格 `\|` 转义）+ 自检清单（`settings`、旧列名、`max` 口径跨文件比对） |
| 9 | **G5 + 拍-4 + N15**（编号治理与跨文档残留） | 触及 §20.1 与 82 处引用，建议单独立项、分批改（新增引用先用具名 `决策-<主题>`） |

> 备注：本轮**未发现**「错误码拼写 / HTTP 配对 / 枚举集合 / schema 列与索引 / 权威 SQL 可执行性 / 交叉引用悬空」层面的缺陷（M3–M10 全绿）；问题集中在 **D6 续跑的运行期语义闭环**（S1、G1、G2、N5、N9、N11）、**导入名称锚表述**（S2、N7、N10）与**修复未同步的旧口径/术语**（G4、N1–N4）。
