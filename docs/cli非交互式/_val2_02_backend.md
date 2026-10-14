# 独立校验报告 —— 后端设计文档（第 2 路：proposal-02 主文档 + crud-01..06 + schema.sql）

> 校验员：独立只读审查（未修改任何被审文件）
> 范围：`proposal-02-后端设计.md`(419 行)、`crud-01`(1091)、`crud-02`(400)、`crud-03`(1328)、`crud-04`(639)、`crud-05`(642)、`crud-06`(374)、`schema.sql`(347)
> 旁证（出范围，仅作交叉证据）：`proposal-01-界面设计.md`、`validation.md`、`tasks.md`
> 工具：sqlite3 3.50.6（实跑 schema.sql）、python 只读抽取脚本（临时文件置于 `%TEMP%`，未写入被审目录）

---

## 统计

| 档位 | 数量 | 编号 |
|-|-|-|
| 严重 | 2 | S1–S2 |
| 一般 | 13 | G1–G13 |
| 轻微 | 16 | N1–N16 |
| 需拍板 | 6 | D1–D6 |
| **合计** | **37** | |
| 其中标「待确认」 | 4 | S1、G7、G11、N5 |

### 机械核对方法与结果（全部可复现）

| 核对项 | 方法 | 结果 |
|-|-|-|
| 建表脚本可执行性 | `sqlite3 <tmp>.db ".read schema.sql"`（ASCII 路径副本，避免 CJK 路径） | **通过**；10 表 + 20 命名索引 + 1 唯一索引（`uq_steps_execution`）+ 5 自动索引；无报错 |
| PRAGMA 生效性 | 另起连接查 `PRAGMA user_version / journal_mode / foreign_keys` | `user_version=1`（与 crud-06 `db_version=1` 一致）、`journal_mode=wal`（持久）、**`foreign_keys=0`（不持久，见 G9）** |
| seed / 实例 | `findstr /i insert schema.sql` + `SELECT count(*)` | 无任何 seed/INSERT（`settings` 废弃后默认 INSERT 已移除）；实跑后各表 0 行 |
| 文档引用列是否存在 | 抽取文档中全部 `表.列` 引用（104 处）与 schema `PRAGMA table_info` 比对 | **仅 1 处不命中**：`ops.find(...)`（crud-03:517 伪代码，非真列）→ 实际 0 缺陷 |
| 字段映射表逐列核对 | 各 crud「字段命名 ↔ 数据库列映射」逐列比对 schema | clients 13/13、ops 12/12、workflows 9/9、workflow_nodes 11/11、jobs 12/12、job_runs 16/16、step_records 24/24、engine_events 9/9、run_edge_state 5/5、run_node_state 7/7 **全一致** |
| 路由集合 | 抽取全部 `\| METHOD \| \`/api/...\` \|` 表格行 | 55 条唯一路由，**无重复定义、无缺失**；除 proposal-02:372 的分页模板 `/api/xxx` 外，正文出现的 `/api/*` 路径均有定义 |
| 错误码集合 | 抽取全文 `[A-Z][A-Z_]{4,}` 与 §10.1 总表比对 | §10.1 **27 行 / 26 个 code**（`CLIENT_NOT_FOUND` 占 404/409 两行）与 "约 26 个" 自述一致；各 crud 内联表中 `码↔HTTP` 配对 **60 处全部与 §10.1 一致**；**无未登记 code**；但「定义位置」列有 4 处遗漏（G5） |
| 枚举集合 | schema 各 `CHECK(...IN...)` 与文档枚举字面量逐组比对（共 16 组） | `type`/`input_mode`/`output_mode`/`node kind`/`concurrency`/`job_kind`/`triggered_by`/`target_kind`/`job_runs.status`(含 `terminating`)/`terminated_by`/`source`/`step_records.status`/`event_type`(7)/`step_status`/`run_edge_state.state`/`run_node_state.status` **逐组一致** |
| 易混字段名 | 全文检索 `timeoutMs`、`nodeId`(非 workflowNodeId)、`succeeded` | `timeoutMs` 仅 2 处且均为 step 快照（crud-05:72/164，= `OP.timeoutSeconds × 1000`），与 `ops.timeout_seconds` 分层、**不构成冲突**；**全文无裸 `nodeId`、无 `succeeded`** |
| 唯一索引行为 | 重复 `(run_id, step_id, activation_seq, retry_seq)` INSERT | 被拒：`UNIQUE constraint failed`（S8 防重放查重与 DB 约束同向） |
| 外键/级联行为 | (a) 默认连接插入孤儿 `workflow_nodes`；(b) `PRAGMA foreign_keys=ON` 后同操作 | (a) **插入成功**（孤儿行）；(b) 拒绝 `FOREIGN KEY constraint failed (19)`，且删除 `workflows` 行触发级联删除节点 → 见 G9 |
| crud-06 工作区 SQL | 实跑 `SELECT DISTINCT workspace FROM job_runs ORDER BY MAX(created_at_ms) DESC LIMIT 10` | **报错**：`misuse of aggregate: MAX()`（见 G10） |
| 行内编号（D1/Q5/BB4…） | 抽取 39 个候选编号 × 全文出现位置；对照 proposal-01 §20.1 释义表 | 释义表覆盖 9 个（`U1/U13/T26/S1/V11-B/C7/C1/C4/D1–D7`）；其余 20+ 编号仅有使用、无定义（见 G13） |
| 粗体配对 | 逐行统计 `**` 计数奇偶 | 无奇偶失配；但存在**配对成功但交叠嵌套**的渲染缺陷（见 N16） |

---

## 严重

### S1. 「重试 = 从失败 step 开始」与 Engine「engine_start 一律从 Start 起步」互斥

- `crud-05:348`（3.5.8 功能说明）原文：**「从失败 step 处重试（前提：版本一致、无 needsUpdate、存在失败/超时 step），复用上下文继续后续节点。」**
- `crud-05:634`（4.8 表）原文：`| 起点 | 从头开始 | 从失败 step 开始 |`
- 但 `crud-03:750`（engine_start 处理）原文：**「→ 直接推进第一步：对 Start 的出边置 activated → 走就绪规则 dispatch 后继节点」**；`crud-03:875` 亦明确「（该 run 尚无 step 执行，**等于从头启动**）」；`crud-03:747` 定义快照/校验逻辑同样按"从头启动"叙事。

**问题**：重试新建 Run（3.5.8 返回新 `{runId}`）后，触发路径是 `add_*` → `engine.notify(EngineStart)` → `process_event`，而 Engine 的唯一启动语义是"从 Start 出边开始 dispatch"。全范围内**没有任何"跳过已成功节点 / 以失败 step 为种子重建 RunContext"的机制**：`job_runs.retry_from_run_id / retry_from_step_id` 仅被定义为「重跑 / 重试**溯源**」（`crud-05:109`、`crud-05:142`），不含执行语义。按现有文字实现，`/retry` 将等价于 `/rerun`（从头跑一遍），与 3.5.8/4.8/§12.4 的对外承诺不一致；这是**契约级**不一致而非措辞问题。

**建议改法**（二选一，并同步全链路）：
1. **保留"从失败 step 续跑"**：在 crud-03 4.3 增补「重试种子（resume seed）」小节，明确：`engine_start` payload 增 `resume_from_step_id` / `skip_completed_steps`（或"已完成节点集合 + 出参快照"）；`process_event(engine_start)` 首处理时若含种子 → 直接以失败 step 为起点激活（其入边视为已决定），并说明跳过的节点是否写入 `step_records`（建议不写，仅以 `retry_from_*` 溯源）；同时说明 replay 幂等性。
2. **放弃"续跑"**：把 `crud-05:348` 改为「从失败 step 起重新执行（等价于以最新版本重跑）」或直接改为"从头重跑并复用原 target/inputs/workspace"，并同步 `crud-05:634`、`crud-06`（如涉及）、`proposal-01 §12.8.2`。

> 待确认：本次范围外是否另有实现说明（`tasks.md` 未检到"续跑/断点/跳过已成功节点"表述）。若无，按上面第 1 或第 2 项拍板。

### S2. cron 触发路径的「谁创建 JobRun / 校验在哪个事务内」自相矛盾（并可能导致重复落库）

- `crud-04:599-600`（4.5.2 cron 触发流程）原文：
  **「├─ 3. 创建 JobRun: triggered_by=schedule、status=waiting、快照 target/target_version/inputs/workspace（含名称快照 name/target_name）」**
  **「└─ 4. TaskRunner.add_job(req) → 投递即返回（不阻塞调度线程）」**
  且 `crud-04:598` 原文：**「**步骤 2-3 在同一事务（`BEGIN IMMEDIATE`）内**：先查后插，保证与手动运行 / 并发 cron 的『检查-创建』原子（#1）」**（即 Scheduler 自己查、自己插）
- 但 `crud-04:325`（3.4.6 #4 原子性）原文：**「全部并发相关校验与创建 JobRun 都在 `add_job` 内、同一事务（`BEGIN IMMEDIATE`）内**执行……**API / Scheduler 只做参数校验与入口分发，不自查不自插**（否则「先查后调 add_*」会使同事务保证失效）」**
- 且 `crud-05:573`（4.6 执行流程）原文：**「├─ 2. 创建运行历史（JobRun）：job_kind（persistent/virtual）与 triggered_by 按入口确定，状态 waiting……检查与插入在同一事务（`BEGIN IMMEDIATE`）内」**

**问题**：三处对同一动作给出互斥定义——(a) 4.5.2 说 Scheduler 在自有事务内建 JobRun，随后再调 `add_job`；而 `add_job` 自身按 crud-05 4.6 又会"创建 JobRun"，**同一次 cron 触发将插入两条运行记录（或第二条因唯一/校验失败而报错）**；(b) 4.5.2 的"先查后插在同一事务"直接违反 3.4.6 #4「Scheduler 不自查不自插」。这是事务边界 + 唯一性 + 并发闸门的三重冲突。

**建议改法**：以 **crud-04:325（add_job 内建、单事务、调用方不自查不自插）** 为准，改写 4.5.2 为：
```
├─ 2. 前置校验（needsUpdate / CLIENT_TYPE_MISMATCH）→ 命中即跳过（记日志）
├─ 3. 调 TaskRunner.add_job(schedule 入口)：由 add_job 在同一 BEGIN IMMEDIATE 内完成
│     「同 Job 在途实例计数（cron 固定 skip 语义）」+「全局 waiting 上限」检查与 JobRun 插入
│     命中 → 本次触发跳过（不报 409）
└─ 4. 投递即返回
```
并同步删除 4.5.2 中"步骤 2-3 在同一事务内"这句（或改为"由 add_job 内部保证"），在 crud-04:605/611 保留"cron 固定 skip、跳过不报 409"的口径。

---

## 一般

### G1. Job 包的 `manifest.job.name` 未纳入名称锚一致性校验（与 Workflow 包不对称）

- `crud-04:450` 原文：`| job | object | Job 名称与版本（锚定 `job.yaml`） |`（**无任何一致性校验条款**）
- 对照 `crud-03:434`：`manifest.workflow.name` 必须与根级 `workflow.yaml` 一致，不一致 → 400。
- `crud-04:488` 只规定"同名已存在 → 409 `JOB_NAME_EXISTS`"，**未说明判重用的是 `manifest.job.name` 还是 `job.yaml` 的 `name`**。

**问题**：Job 包存在"名称双写"（manifest.job.name 与 job.yaml 的 name）却只校验 target 侧（3.4.10 #8），与 proposal-01 §8.9（527）"Job：`manifest.target.name` vs `manifest.target.file` 指向文件"口径一起，形成**校验缺口**：可构造由"manifest 与 job.yaml 名称不一致"导致的同名判定歧义/静默以文件为准。
**建议改法**：`manifest.job` 行增补与 `crud-03:434` 同构的一句——「导入名称锚一致性校验：`manifest.job.name` 必须与包内 `job.yaml` 的 `name` 一致，不一致 → 400 `VALIDATION_ERROR`（message 指明位置），不静默以文件内容为准」；并在 3.4.10 错误表 400 行补该场景；同时明确"同名判重以校验通过后的同一名称（两处必相等）"。

### G2. 包内 `ops/*.yaml` 的名称锚未校验 + 节点 `opName` 与 `manifest.ops` 集合的一致性无定义

- `crud-03:436` / `crud-04:453` 原文（Job 侧示例）：`| ops | object[] | 包内 OP 依赖：`{name, version, file}`（`file` 恒为 `ops/<name>.yaml`）。`kind=workflow` 时 = 该 Workflow 节点引用的全部 OP（与 Workflow 导出 `manifest.ops` 一致） |`
- `crud-04:490` 原文：`目标 Workflow 引用的全部 OP（或目标 OP 本身）**按 name 匹配**：不存在 → 按包内定义创建`。

**问题**：(a) `manifest.ops[].name` 与 `ops/<name>.yaml` 文件内实际 `name` 是否必须一致**未定义**——与本次新增"包完整性校验"（"manifest 名称锚与包内文件实际 name 必须一致"）的精神不符：Workflow/Job 目标实体校验了、OP 依赖这一层漏了；(b) 节点 `opName` 不在 `manifest.ops` 中（或 manifest.ops 多出未被引用的条目）时的行为未定义（应 400 还是忽略）；(c) `crud-04:453` 声明的"manifest.ops = 节点引用全集"这一不变式无校验步骤。
**建议改法**：在两个导入章节各加一条：「① `manifest.ops[].name` 必须等于其 `file` 指向文件的实际 `name`（不一致 → 400 `VALIDATION_ERROR`）；② 节点 `opName` 必须能在 `manifest.ops` 中命中（未命中 → 400）；③ `manifest.ops` 与全部节点 `opName` 集合必须相等（多出/缺少 → 400）」。

### G3. 名称锚校验与同一单元格内「version 不一致以文件内容为准」相邻，易误读；且与 validation.md 的旧口径直接冲突

- `crud-03:434` 原文（同一条表格单元格内）：**「…`manifest.workflow.name` 必须与根级 `workflow.yaml` 的实际 `name` 一致——不一致 → 400 `VALIDATION_ERROR`…；`version` 为声明参考，与文件不一致时以文件内容为准（沿用包内值，保真还原）」**
- `crud-03:474`、`crud-04:489` 同样把"名称不一致 → 400"与"version 不一致 → 以文件为准"写在**同一句/同一行**。
- `validation.md:26`（遗留备注）原文：**「3. `manifest.target.name` 与包内文件内容不一致时以文件内容为准。」**；`validation.md:51` 原文：**「…`manifest.target.name` 与包内文件内容不一致时以**文件内容**为准（待追认）。」**

**问题**：(a) 措辞相邻导致"name 也以文件为准"的误读风险（新口径恰恰相反）；(b) `validation.md:26/51` 仍以"旧口径 + 待追认"形式留档，与新口径（crud-03 3.3.9 / crud-04 3.4.10 / proposal-01 §8.9 #8）**正面冲突**，第三方读到 validation.md 会得到相反结论。(validation.md 不在本次被审范围，但它是同一项目内的口径冲突点。)
**建议改法**：① 把"name 一致性"与"version 以文件为准"**拆成两条表格行**，并加粗一句「`name` 不一致**一律拒绝**；仅 `version` 为声明参考」；② 在 validation.md 遗留项 3 处改为「**已追认**：新口径 = 名称锚不一致 → 400 `VALIDATION_ERROR`（不静默以文件内容为准）；仅 version 以文件为准」，或删除该条。

### G4. proposal-01 §8.9 同时表述"后端先校验"和"前端校验通过后才提交"，与"不重复实现校验"原则冲突（跨文档）

- `proposal-01:527` 原文：**「提交导入后，**后端先做**包完整性校验——`manifest` 名称锚与包内文件实际 `name` 必须一致……**不一致 → 导入校验不通过**，前端弹窗提示失败原因并**指明不一致位置**……用户可**手动修改包内文件 / manifest 后重新选择文件导入**；**修改成功且校验通过后，[导入] 才提交后端完成导入**。」**

**问题**：同一句先"后端先做校验"，后又要求"前端校验通过后 [导入] 才提交后端"——若前端也做一致性校验，即为**第二套实现**（与 `crud-05:415`「文件落盘始终在前端完成」的职责划分、`proposal-02:276` CLI 不另开旁路校验的口径同源的原则相冲突）；若前端不做，则该句纯属误导。
**建议改法**：统一为「前端**不做**内容校验，直接提交 ZIP；后端校验失败返回 400 `VALIDATION_ERROR` + 指明不一致位置的 message；前端展示 message，用户修改包内文件/manifest 后重新选择并**重新提交**」。

### G5. §10.1「定义位置」列与实际内联错误表不符（4 处遗漏）

- `proposal-02:335` 原文：`| CLIENT_TYPE_MISMATCH | 400 | … | crud-02 3.2.6（口径基准）；crud-03 3.3/3.3.3/3.3.4/3.3.7/4.4；crud-04 3.4.3/3.4.4/3.4.6/4.5 |` —— **漏 `crud-03 3.3.9`（`crud-03:486`）与 `crud-04 3.4.10`（`crud-04:509`）**（机械抽取确认：`400 CLIENT_TYPE_MISMATCH` 共 9 处内联，其中 2 处为新导入口径）
- `proposal-02:336` 原文：`| OP_NOT_FOUND | 404 | OP 不存在 | crud-02 |` —— 漏 `crud-04:225`（Job 创建/更新时 target 引用 OP 不存在）
- `proposal-02:339` 原文：`| WORKFLOW_NOT_FOUND | 404 | … | crud-03 |` —— 漏 `crud-04:225`
- `proposal-02:354` 原文：`…| crud-02 3.2.6 / crud-03 3.3.7 / crud-04 3.4.6 / crud-05 3.5.7/3.5.8 |` —— 漏 `crud-05 4.6`（`TaskError::QueueFull` 映射点，见 `proposal-02:362`）与 `crud-04 4.5.2`

**建议改法**：按机械核对结果逐行补齐「定义位置」；同时把 3.3.9/3.4.10 的 `CLIENT_TYPE_MISMATCH` 归并到 `crud-03 3.3.9`、`crud-04 3.4.10` 字样，保持"总表 = 唯一口径"（`proposal-02:329`）成立。

### G6. proposal-02 说「Job / Workflow 调 engine.notify」，crud-05 说「Job target=op 不得走 Engine」

- `proposal-02:82`（§1.2 执行数据流 3）原文：**「**单次 OP 直接派发 WorkerPool**；**Job / Workflow 调 `engine.notify(EngineStart{run_id, workflow_id})` 通知 Engine**——」**
- `crud-05:606`（4.6 同步 vs 异步）原文：**「单次 OP / Job(target=op) 直接调 `worker.run_job(req)`；Job(target=workflow) / 单次 Workflow 调 `engine.notify(...)`——engine.notify 仅限 workflow 类执行，**Job target=op 时不得走 Engine**」**；`crud-05:591` 亦按 `target_kind` 分流。

**问题**：主文档把 `Job` 整体划入 Engine 路径，与 crud-05 的分流规则冲突（target=op 的 Job 必须直连 WorkerPool，否则 `job_runs.target_kind=op` 的 Run 会被按 workflow 处理）。
**建议改法**：`proposal-02:82` 改为「**单次 OP / Job(target=op) 直接派发 WorkerPool；Job(target=workflow) / 单次 Workflow 调 `engine.notify(EngineStart)`**（engine.notify 仅限 workflow 类执行）」，与 crud-04 4.5.2 / crud-05 4.6 对齐。

### G7. Client 删除引用检查不对称：未覆盖 `workflow_nodes.client_id`，且悬空 Client 的运行期行为未定义

- `crud-01:44` 原文：**「删除 Client 前检查是否被 Job 引用，被引用时返回 409。」**；`crud-01:297/321` 同口径（`CLIENT_REFERENCED` 语义亦仅"正被 Job 引用"，`proposal-02:348`）。
- 但 `crud-04:112` 原文：**「Client 在**定义层有三处**（`Job.target.clientId`（kind=op）/ workflow 节点级 `clientId`（kind=workflow，见 crud-03）/ 执行层 `step_records.client_id`…）」**
- `schema.sql:107`：`client_id       TEXT,   -- 可为空, 执行时再选`（`workflow_nodes` 仅对 `workflows` 建外键 `schema.sql:116`，**未对 `clients` 建 FK**）

**问题**：(a) 删除检查只查 Job 引用，漏 `workflow_nodes.client_id` → 可产生悬挂 Client 引用（对照：OP 删除查"Workflow 节点 + Job.target"两项，`crud-02:223/237`；Workflow 删除查 Job，`crud-03:268`）；(b) `crud-03:110` 只定义「`clientId` 为空 → 回退 `Job.target.clientId`，仍空 → `run_failed`」，**未定义"`clientId` 非空但 Client 已不存在"**的处理（应 400/运行期 step 落 failed+error 码？）。
**建议改法**：① `crud-01:44/297/321` 与 `proposal-02:348` 改为「正被 **Job.target.clientId** 或 **Workflow 节点 client_id** 引用时 409 `CLIENT_REFERENCED`」（或明确选择"允许删除并降级为运行期失败"）；② `crud-03:110` 补一句「节点 `clientId` 非空但 Client 不存在 → 与类型不匹配同路径：该 step 落 `failed`，`error=CLIENT_NOT_FOUND`，不启动子进程」。
> 待确认：是否**有意**允许节点级 Client 悬挂（若有意，也需在 crud-01 明确写出，避免两处口径不一致）。

### G8. 重跑 / 重试新建 Run 的快照来源未定义（job_id / name / target_name / inputs / workspace）

- `crud-05:342` 原文：**「重跑新建的 Run 一律 `triggered_by=manual`，`job_kind` 继承原 Run……重跑**不复制**原 Run 的 `job_version`（virtual 恒为 NULL；persistent 取当前 `Job.version`）。」**
- `crud-05:319` 原文：**「使用最新版本从头重跑（新建 JobRun，从头执行）」**

**问题**：只规定了 `triggered_by` / `job_kind` / `job_version`；**未规定** `job_runs.job_id`（persistent 用原 job_id 还是当前 Job？原 Job 已删时用占位 UUID？）、`name` / `target_name` / `inputs` / `workspace`（复制原 Run 快照，还是取当前 Job 定义）——而这些列在 schema 中均 `NOT NULL`（`schema.sql:157/167/171/173/174`）。重试（3.5.8）同样未定义。
**建议改法**：在 3.5.7 / 3.5.8 各增一行「新建 Run 的快照来源」表：`job_id` = 原 Run（Job 已删则沿用原占位/原 job_id）、`name`/`target_name` = 原 Run 快照（与运行历史"名称快照"口径一致）、`inputs`/`workspace` = 原 Run 快照（重试）｜当前 Job 配置（重跑，需明确）。

### G9. `schema.sql` 的 `PRAGMA foreign_keys = ON` 不随连接生效，文档却依赖 `ON DELETE CASCADE`

- `schema.sql:14` 原文：`PRAGMA foreign_keys = ON;`
- 依赖级联的约束：`schema.sql:116`（`workflow_nodes → workflows`）、`schema.sql:252`（`step_records → job_runs`）、`schema.sql:295`（`engine_events → job_runs`）、`schema.sql:320`、`schema.sql:344`
- 文档侧依赖：`crud-03:268`（删除 Workflow"被 Job 引用则 409"，其余靠级联删节点）

**问题**：`foreign_keys` 是**连接级**开关、不随 DB 持久化（实测：`.read schema.sql` 后另起连接 `PRAGMA foreign_keys` = **0**）。若应用连接未逐连接置 `ON`：(a) 所有 FK 约束静默失效（可插入孤儿 `workflow_nodes`，实测成功）；(b) 删除 Workflow 不再级联删节点 → `workflow_nodes` 残留（后续"OP 被节点引用"检查、`needsUpdate` 判定都会受污染）。
**建议改法**：① 在 `schema.sql:14` 旁加注「本 PRAGMA 仅对当前连接有效，**必须**在应用每个连接建立后执行（sqlx `SqliteConnectOptions::foreign_keys(true)` / rusqlite `conn.pragma_update(None,"foreign_keys","ON")`），否则级联失效」；② 在 crud-06 〇 或 proposal-02 §1.1/§6（DB 访问层）补一句连接初始化约定；③ 对"删除 Workflow 必须同步删节点"给出显式 SQL 兜底（不依赖级联）。

### G10. `GET /api/workspaces` 给出的 SQL 不可执行，且 `limit` 无上限约束

- `crud-06:317` 原文：**「取自 `job_runs.workspace` **去重**（`SELECT DISTINCT workspace FROM job_runs`），按**最近使用**排序（`ORDER BY MAX(created_at_ms) DESC`，即该工作区最近一次运行时间倒序），取 `limit` 条。」**
- `crud-06:325` 原文：`| limit | query | integer | 否 | 10 | 返回条数上限（去重后） |`（未列入 3.4「数值项上限」表）

**问题**：`SELECT DISTINCT …` 与聚合 `MAX()` 混用非法（实测：`Error: in prepare, misuse of aggregate: MAX()`）；实现者无法照抄。`limit` 缺上限（其余数值项均有上限），且未说明非法值判定。
**建议改法**：改写为 `SELECT workspace, MAX(created_at_ms) AS last_used FROM job_runs GROUP BY workspace ORDER BY last_used DESC LIMIT ?1`，并在参数表补「limit ∈ 1..1000，默认 10（上限写入 3.4 数值项上限表）」；如需 `keyword` 过滤，补 `HAVING workspace LIKE '%'||?2||'%'`。

### G11. 配置项 JSON 类型口径三处不一致（默认值整数 / 响应全 string / 请求体未规定）

- `crud-06:66` 原文：`| **通用** | `poll_interval_ms` | 2000 | 动态 | … |`（默认值写作**数字**；`:71` `client_import_max_bytes` 写 `1048576`；`:75` `job_queue_waiting_max` 写 `20`）
- `crud-06:237` 原文：**「返回全部配置（**值为 string**），按业务分组组织。」**（`:197-233` 样例 `"poll_interval_ms": "2000"`、`"workflow_auto_layout": "true"` 亦为字符串）
- `crud-06:259` 原文：`| (分组.key) | object | 是 | 需更新的 KV 项；空对象视为不更新 |`（**未规定 value 的类型/字符串化要求**）

**问题**：同一配置项存在"表格=数字、接口=字符串"的表观矛盾，且 PUT 请求体的类型未定义（实现者可能接受数字、也可能因类型校验 400，接口行为不可预测）；布尔 `workflow_auto_layout` 以 `"true"` 传输亦需明示。
**建议改法**：① 在 `crud-06:62` 前补充总则「配置项在 JSON 线格式中**一律为字符串**（数值 `"20"`、布尔 `"true"`、枚举 `"debug"`），后端解析为强类型存储」；② 配置项表"默认"列统一加引号或加脚注「表内为逻辑类型，接口以字符串承载」；③ `:259` 明确「value 必须为 string，非 string → 400 `VALIDATION_ERROR`（或明确接受并转换）」。
> 待确认：是否接受原生 JSON 类型（number/bool）作为输入。

### G12. `crud-01` PUT 审计字段「一律忽略」与错误表「按约定拒绝」互斥

- `crud-01:271` 原文：**「> **审计字段规则**：请求若携带 `clientId` / `createdAtMs` / `updatedAtMs`，后端一律忽略（或返回 400，按实现约定）；」**
- `crud-01:289` 原文：`| 400 | `VALIDATION_ERROR` | 请求体字段非法（含请求携带审计字段时按约定拒绝） |`

**问题**："一律忽略（或返回 400，按实现约定）"把一个**接口行为**交给实现随意选择，且下一节的 400 表又把它列为错误场景——同一文档两处口径不一致，前端无法确定该不该拦截。
**建议改法**：二选一并删除另一种表述。建议「严格拒绝」：「请求体出现 `clientId`/`createdAtMs`/`updatedAtMs` → 400 `VALIDATION_ERROR`（message 指明只读字段）」；并把 `crud-01:271` 括号内容删除。同类问题请一并检查其它实体的 PUT（crud-02/03/04 未写入"忽略/拒绝"字样，建议统一为一句话总则）。

### G13. 大量行内编号（Q1/Q5/W6/W7/AA7/BB4/S8/T13/N1/R3/U8/V4/Z3/P4/M17/M20…）在被引文中无定义

- 使用侧（举例）：`crud-03:747` 原文含 **「（见 Q5/W7）」**（同段又出现 `Q1`、`S1`）；`crud-03:724` 原文含 **「（不再回跳重入，BB4）」**；`crud-03:720` 原文含 **「（否则永远不会收敛，BB4）」** 与 **「（AA7/AA8）」**；`crud-03:762` 含 `（BB5）`；`crud-03:777` 含 `（T13）`；`crud-03:794/795` 含 `Z`；`crud-05:621` 含 `（M17）`；`crud-01:533` 含 `（M20）`。
- 释义侧：`proposal-01:2873`（§20.1）原文：**「下表为**决策类**行内编号释义……其余形如 `Z5/U8/V4/Q1/W6/R3/S8/T13/AA7/BB4/Z/N/M17/M20/P4/P6/K` 等编号为各文档**内部条目号**，见其所在章节」**；而 `crud-03` / `crud-05` / `crud-01` **正文并无任何编号清单或条目表**（机械检索：39 个候选编号中，释义表仅覆盖 `U1/U13/T26/S1/V11-B/C7/C1/C4/D1–D7` 共 9 个）。

**问题**：读者（尤其是新加入的实现者）遇到 `（见 Q5/W7）`、`（BB4）` 这类**纯外部交叉引用**时无从定位——§20.1 声称"见其所在章节"，但所在章节并无该编号的定义。多数语句自带解释（如 `Q2`、`Z3` 标注在同段说明上），损坏限于"一个句子里多出一个无法解析的记号"，但足以为文档的可理解性与可追溯性减分。
**建议改法**（任选，建议 ①②同时做）：① 在 `crud-03` 末尾新增「附：行内编号索引」小节（或把编号清单补入 `proposal-01 §20.1`），逐条列出 `Q1/Q2/Q4/Q5/W6/W7/S8/T13/N1/R3/U8/V4/Z3/Z/P4/M17/M20/AA7/AA8/BB4/BB5` 的含义与定位；② 按 §20.1 的"后续建议"，把**新**决策改为 `决策-<主题>` 命名，并在正文把纯交叉引用（如 `（见 Q5/W7）`）改写为文字引用（如"（见 4.3.0 版本漂移与瞬时/确定性失败口径）"）；建议将 `Q3`（未使用）等死编号一并清理。

---

## 轻微

### N1. `crud-03` 样例 `outputs.from.workflowNodeId` 指向不存在的节点

`crud-03:33` 原文：`"outputs": [{"name":"status","from":{"workflowNodeId":"4e5f60718293a4b5c6d7e8f9a1b2c3d4","outputName":"result"}…`，而 `crud-03:35-37` 的 `nodes` 仅有 `0a1b…f9`(start) / `1b2c…a1`(op) / `2c3d…b2`(end)；同一悬空 id 在 `crud-03:218`（创建样例）再次出现。而 `crud-03:111` 规定「bindings 引用的前置节点出参必须存在」。
**建议**：把两处样例的 `from.workflowNodeId` 改为 `1b2c3d4e5f60718293a4b5c6d7e8f9a1`（与 `crud-03:36` 的 op 节点一致），避免"照抄即 400"。

### N2. 样例对象与字段表不一致（缺字段）

- `crud-04:69` 定义 `targetName`（计算字段），但 `crud-04:27-44` 的 Job 对象样例无 `targetName`。
- `crud-05:108` 定义 `result`（详情接口按 steps 聚合），但 `crud-05:26-48` 的 JobRun 对象样例无 `result`。
**建议**：补进样例（或注明"样例省略计算字段"）。

### N3. crud-05 样例 `target.name` 语义与字段表冲突

`crud-05:33` 原文：`"target": {"kind":"workflow","opId":null,"opVersion":null,"workflowId":"...","workflowVersion":1,"name":"hourly_check"}`，顶层为 `"name": "hourly_job"`；而 `crud-05:95` 规定「`name`：persistent = jobs.name；virtual = op.name/workflow.name（= target.name）」，`crud-05:100` 规定 `target.name` 为目标快照名。样例中 `target.name` 取了 `hourly_check`（= `crud-04` 的 **Job 名**），与语义不符。
**建议**：样例改为顶层 `"name": "hourly_check"`（= jobs.name）、`target.name: "deploy_workflow"`（= 目标 Workflow 名），以体现两者区别。

### N4. `job_runs.terminated_by='cancelled'` 缺写入方约定

`crud-05:313` 只规定 `terminated_by='timeout'` 的写入点与"其余终态两列均为 NULL"；用户终止路径（`crud-05:287-289`、`crud-03:790`）未写"置 `terminated_by='cancelled'`"。
**建议**：在 `crud-05:313` 后补「用户终止收敛 → `status='cancelled'` **且** `terminated_by='cancelled'`；`run_failed` 路径 → `terminated_by='error'`（见 crud-03 4.3.0）」。

### N5. `engine_event_retention_days` 与"1 天软删 / 2 天硬删"的缩放关系未定义

`crud-06:81` 原文：`| | `engine_event_retention_days` | 1 | 动态 | …失败 run 最终不重试 → 1 天软删 / 2 天硬删。 |`（上限 30，见 `crud-06:287`）；`schema.sql:269-270` 同述。
**建议**：明确「软删 = `engine_event_retention_days` 天；硬删 = 软删 + 1 天（不随配置缩放）」或「硬删 = 2 × 配置值」，二选一写入 crud-06 与 schema 注释。
> 待确认。

### N6. 错误响应表 400 行不齐（同一文档内不一致）

`crud-05:243`（3.5.3）、`crud-05:257`（3.5.4）、`crud-05:368`（3.5.8）、`crud-05:409`（3.5.9）均只列 404；而 `crud-05:122`（3.5.0 通用约定）已声明"路径参数格式非法 → 400"，且 3.5.2/3.5.5/3.5.6/3.5.7 都列了 400。
**建议**：统一补齐「400 `VALIDATION_ERROR`（runId 格式非法）」；3.5.8 另需补「404 `TARGET_NOT_FOUND`」（与 3.5.7 对称，目标已删场景）。

### N7. ZIP 导入缺体积上限与解包安全边界

`crud-03:485` / `crud-04:508` 的 400 场景未包含"包体积超限"；只有 Client/OP 的 YAML 导入有 `client_import_max_bytes` / `op_import_max_bytes`（`crud-01:429`、`crud-02:370`）。同时两处均未规定成员路径校验（zip-slip：`../` 成员名、绝对路径成员、成员数/解压后总大小）。
**建议**：新增两个配置项（如 `package_import_max_bytes` / `package_uncompressed_max_bytes`，默认 100 MiB / 1 GiB）并纳入 crud-06 配置表与上限表；在 3.3.9/3.4.10 增「成员名必须为包内相对路径且不含 `..`，否则 400」。

### N8. `crud-03` 3.3.9 与 `crud-04` 3.4.10 的校验项/顺序不对称

- `crud-04:508` 明列「`manifest.target.file` 指向的成员缺失」；`crud-03:485` 未列「`manifest.ops[].file` / 根级 `workflow.yaml` 成员缺失」。
- 两处均未规定**名称锚 400 与同名 409 的判定顺序**（`crud-03:474` 同行并列 `WORKFLOW_NAME_EXISTS` 与名称锚校验）。
**建议**：3.3.9 补"成员缺失 → 400"；两处统一写明「校验顺序：ZIP 可解析 → manifest/文件名称锚一致 → 结构/拓扑/上限 → 依赖解析（409）→ 同名冲突（409）→ 事务提交」。

### N9. 导入的并发与幂等未覆盖

`crud-03:478` 原文：`| 原子性 | 整个导入（解析校验 → 创建/复用 OP → 创建 Workflow）在**单一事务**内完成 |`（**未写 `BEGIN IMMEDIATE`**，与 crud-04 3.4.6 #4/3.4.5 的写法不一致）；两个导入章节均未规定"并发同名导入"时 `UNIQUE` 约束被触发后如何映射（应 409 还是 500），也未定义重复提交同一包的幂等行为。
**建议**：统一写为「`BEGIN IMMEDIATE` 单写事务；SQLite 单写者 + 名称 `UNIQUE` 约束兜底，唯一冲突映射为 409 `*_NAME_EXISTS`；不做去重幂等，重复导入同名 → 409」。

### N10. 「settings `X`」术语陈旧（`settings` 表已废弃）

出现处：`crud-01:429`、`crud-02:280/370`、`crud-03:237/259/347/485/1219`、`crud-04:320`、`crud-05:337/370/474/572`（共 13 处），而 `crud-06:12` 明确「**settings 表已废弃**……唯一事实来源 = `ai-automation.json`」，`crud-06:127` 亦写「配置来源为 `ai-automation.json`」。
**建议**：全文替换为「配置项 `X`（`ai-automation.json`，见 crud-06 一）」；`proposal-02` 侧无此表述（保持）。

### N11. `proposal-02` §6 的 trait 清单重复，且 `ConfigRepo` 悬空

- `proposal-02:176` 原文：`// 同理: ClientRepo, OpRepo, WorkflowRepo, JobRepo, RunRepo, StepRepo, EngineEventRepo`（上一行示例 trait 已名为 `ClientRepo` → 重复列自己）
- `proposal-02:177` 原文：`// 配置不再走 Repository：由配置模块直接读写 {run}/ai-automation.json（ConfigRepo，见 crud-06 〇）`——**`crud-06` 全文未出现 `ConfigRepo`**（机械检索 1 处命中，仅在本行）。
**建议**：`176` 改为「同理: `OpRepo / WorkflowRepo / JobRepo / RunRepo / StepRepo / EngineEventRepo`」；`177` 删去 `ConfigRepo`，或改为「配置模块直接读写 `{run}/ai-automation.json`（不定义 trait，见 crud-06 〇）」。

### N12. `proposal-02:58` 示意图的 on_complete 钩子指向错误

`proposal-02:58` 原文：`│      │   on_complete 钩子（WorkerPool / Engine → Task Runner）    │`，与 `proposal-02:68`「WorkerPool 完成后按 source 经全局 `JOB_COMPLETE` / `STEP_COMPLETE` 回调」及 crud-03 4.4（`crud-03:1199-1206`：job → JobComplete、step → StepComplete→ENGINE）不一致——回调**不指向 Task Runner**。
**建议**：改为「on_complete 钩子（WorkerPool → 全局 JobComplete / StepComplete；Standalone 终态经 JobComplete）」。

### N13. `proposal-02:74` Task Runner 状态集合漏 `terminating`

`proposal-02:74` 原文：**「运行历史（JobRun）状态机（waiting → running → 终态）、并发控制……」**；而 `crud-05:468/549/560-563` 与 `schema.sql:177` 均为 `waiting/running/terminating/终态`。
**建议**：改为「状态机（waiting → running → terminating → 终态）」。

### N14. 完成钩子命名混用 snake / Pascal

`crud-05:588`（`…完成后调 job_complete`）、`crud-05:594`（`…Worker 执行完调 step_complete`）、`crud-05:313`（`JobComplete` / `step_complete` 混写）、`schema.sql:230-231`（注释 `job_complete 钩子` / `step_complete 钩子`）与同文件的 `JobComplete` / `StepComplete` / `JOB_COMPLETE` / `STEP_COMPLETE` 并存。
**建议**：统一为「全局实现 `JobComplete` / `StepComplete`（对应 static `JOB_COMPLETE` / `STEP_COMPLETE`）」，schema 与 crud 注释同步。

### N15. `crud-02:318` 的「名称锚」措辞不适用于 OP 单文件 YAML

`crud-02:318` 原文：**「`opId` 由名称锚重映射，见 3.2.8 / crud-03 3.3.9」**；但 `proposal-01:527` 明确「Client / OP 为单文件 YAML（**无 manifest**），不适用该校验」。
**建议**：改为「`opId` 由后端重新生成；引用它的一方（Workflow/ZIP 包）按**名称**重映射，见 crud-03 3.3.9」。

### N16. 粗体交叠导致渲染异常（2 处）

`crud-03:1218` 原文片段：`**注意 \`job_queue_running_max\` 默认 10 即为其**上限**（crud-06 一/三），无法调大**`；`crud-05:469` 原文片段：`…先写 engine_events 落库，**写后立即 \`process_event\` 同步处理**（无事件循环 / 无信号）**`。
**建议**：拆分为互不交叠的两段粗体（`**…即为其上限**（…）**无法调大**` → 建议改写为单层强调）；建议加入 markdown lint（禁止 `**` 交叠）作为文档门禁。

---

## 需拍板

1. **重试起点语义（S1）**：保留「从失败 step 续跑」（需补 Engine 种子机制与 `retry_from_*` 执行语义）｜改为「重试=从头跑，仅溯源」（需改 `crud-05:348/634` 与前端承诺）。**影响面最大，建议优先拍板。**
2. **cron 路径 JobRun 创建责任与事务边界（S2）**：确认以 `crud-04:325`（`add_job` 内建 + `BEGIN IMMEDIATE` + 调用方不自查不自插）为唯一口径，并据此改写 `crud-04:4.5.2` 步骤 2–4。
3. **PUT 审计字段行为（G12）**：`忽略` vs `400` 二选一（建议 400），并作为"各实体 PUT 只读字段"总则写入 §3.0 通用约定。
4. **名称锚校验的前后端分工与错误码（G3/G4）**：明确"仅后端校验、统一 400 `VALIDATION_ERROR`"，proposal-01 §8.9 的"前端校验通过后才提交"措辞是否删除；顺带追认 validation.md 遗留项 3。
5. **名称锚覆盖范围（G1/G2）**：是否把 `manifest.job.name`、`manifest.ops[].name` 纳入一致性校验（建议纳入，与 `manifest.workflow.name` 对称）。
6. **配置值 JSON 类型与 `job_queue_running_max` 上限（G11/N…）**：配置值是否"一律字符串"；`job_queue_running_max`（默认 10 = 上限 10，`crud-06:76`、`crud-03:1218` 已接受"无法调大"）是否放宽上限（否则扩容手段只剩调小 `workflow_max_nodes` / 拆分 Workflow）。

---

## 修复顺序建议

| 序 | 项目 | 理由 |
|-|-|-|
| 1 | **S2**（cron 事务/创建归属） | 直接决定"是否重复落库 / 事务保证是否成立"，改动局部（crud-04 4.5.2 一段 + 3.4.6 #4 对齐） |
| 2 | **S1**（重试起点） | 契约级，但需先拍板方向，再动 crud-03 4.3 + crud-05 3.5.7/3.5.8 + 4.8 |
| 3 | **G3 + G4 + D4**（名称锚口径统一：拆分措辞、proposal-01 §8.9、validation.md 追认） | 本次专项，改动小、收益大；先统一口径再补校验项 |
| 4 | **G1 + G2**（Job 包 / ops 名称锚补校验） | 与第 3 项同一主题，一次改完可避免二次返工 |
| 5 | **G9**（FK PRAGMA 连接初始化） | 数据完整性隐患，一句约定 + 一处实现要求 |
| 6 | **G5 / G6 / G7 / G8**（错误码定义位置、engine.notify 分流、Client 引用检查、快照来源） | 均为"补一句话/补一行"的一致性修复，可批量 |
| 7 | **G10 + N7 + N8 + N9**（SQL 可执行性、导入边界与顺序） | 导入/工作区接口的边界完善，同一轮次处理 |
| 8 | **G11 + G12 + N5 + N6 + N10–N16** | 口径与术语清理、样例补齐、排版；建议配 markdown lint + 术语表（`settings`→配置项、`job_complete`→`JobComplete`）一次性清扫 |
| 9 | **G13 / 行内编号** | 建议按 proposal-01 §20.1「后续建议」执行：新增改用 `决策-<主题>`；对 `Q5/W7/BB4/AA7` 等纯交叉引用，二选一（在 crud-03 末尾加"编号索引"或在正文改为文字引用） |

> 备注：本次未发现"错误码拼写/HTTP 配对/枚举集合/schema 列"层面的实质缺陷（机械核对全通过）；问题集中在**事务与语义边界**（S1/S2）、**导入名称锚的覆盖范围与措辞**（G1–G4）以及**引用检查不对称/边界缺失**（G7/G8/G9/G10）。
