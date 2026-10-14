# 修复报告（C 组：Workflow / Job 后端）—— `crud-03` + `crud-04`

> 修复者：C 组（唯一可改文件 = `proposal-02-后端crud-03workflow管理.md`、`proposal-02-后端crud-04job管理.md`）
> 权威口径：`_fix_v2_decisions.md`（D1/D3/D4/D5/D6/D7/D8/D10/D11/D12 + 低成本项 2；**未写入该文件**，按本次任务书要求）
> 输入：`_val2_02_backend.md`（S1/S2/G1–G8/N1/N2/N7–N9…）、`_val2_05_new.md`（M1–M8）、`_val2_03_tests.md`（S1/S2/D1–D2 相关）
> 编码/行尾：UTF-8、**LF**（与原文件一致，未做换行符转换；crud-03 由 1328 → **1414** 行、crud-04 由 639 → **673** 行）

---

## 已修项表

| 项号 | 位置（改后行号） | 改法 | 证据（机械检索） |
|-|-|-|-|
| **D1** | crud-03:94 / 735 / 1112 / 1124 | `retry.max` 语义改为「**每轮总尝试次数（首次执行计入）**」：字段表 `max` 行重写；4.3.0 ①「重试计数 = 记录数 − 1」→「**本轮尝试计数** = 记录数（首次执行计入）」（:735）；4.3.2 新增「`max` 语义（D1 拍板）」注（:1112）；判定式「记录数-1 >= max」→「**记录数 >= max**」（:1124） | `记录数 − 1`=0、`记录数-1`=0、`最大重试次数`=0；`每轮最大尝试次数`=1、`本轮尝试计数`=1、`记录数 >= max，**首次执行计入**`=1 |
| **D1 附** | crud-03:738 | `max_loop_multiplier` 的 `0` 语义按 **D14** 加注：「`0`/未设置 = **不施加绝对上限、仍受 `max × 3` 约束**，不是无限」 | `不施加绝对上限、仍受 `max × 3` 约束`=1 |
| **D3** | crud-03:73 / 121 / 256 / 280 | OP 节点 `clientId` **必填**：字段表「必填」列改为「op 节点**必填**」；校验规则新增第 10 条「所有 op 节点的 `clientId` 非空」；3.3.3/3.3.4 400 行补「op 节点 `clientId` 缺失」 | `所有 op 节点的 `clientId` 非空`=1；`clientId` 缺失 命中 2 处（3.3.3/3.3.4 错误表） |
| **D3 附（G7②）** | crud-03:110 区（校验规则 12 行）/ 兼容路径注 | 补「`clientId` **非空但 Client 不存在** → 运行期该 step 落 `failed`、`error=CLIENT_NOT_FOUND`、**不启动子进程**」；原「为空则回退 `Job.target.clientId`」改写为**兼容路径注**（历史/导入遗留空值节点，定义层不拦），与 D3 不冲突 | `CLIENT_NOT_FOUND`，**不启动子进程**=1；`兼容路径（历史 / 导入遗留`=1（规则注） |
| **D4** | crud-03:77–87（bindings 表 + 两条注） | `ParamBinding` 新增 `{kind:"unbound"}`（拖拽创建时全部入参初始态）；新增「**无来源判据**」（绑定缺失 / `unbound` / `literal` 且 `value=""`）；新增「参数绑定下拉只列**从 Start 可达且位于当前节点之前**的节点出参」 | `| `unbound` |`=1；`无来源判据（D4）`=1；`参数绑定必须指向前置节点`=2 |
| **D4 校验规则** | crud-03:124（规则 13）/ 125（规则 14）/ 126（规则 15） | 新增规则 14「参数绑定必须指向前置节点」；规则 15「所有 required 入参必须有来源」；保留原「bindings 引用的前置节点出参必须存在」为规则 13 | 同上 |
| **D5** | crud-03:122（规则 11）/ 257 / 281 / 365 / 528；crud-04:224 / 254 / 305 / 516 / 540 | 定义层类型校验统一补固定 message：`Client 类型与 OP 类型不匹配：OP <opName> 为 <opType>，Client <clientName> 为 <clientType>`（覆盖 POST/PUT /api/workflows、/api/workflows/{id}/execute、/api/workflows/import、POST/PUT /api/jobs、/api/jobs/import）；错误码**沿用总表 `CLIENT_TYPE_MISMATCH`**（见「未修项 1」） | crud-03 该 message=3 处；crud-04=3 处 |
| **D6**（核心） | crud-03:**1221–1257**（新增 `#### 4.3.4 重试种子（resume seed）`） | 按拍板 6 条要点逐条落地：① 入口 → 新建 Run + 写 `retry_from_run_id`/`retry_from_record_id` + `triggered_by=retry`，随后 `notify(EngineStart{…, resumeFromRecordId})`；② Engine 以该 StepRecord 对应节点为起点、前置节点视为已完成且**不写入新 Run `step_records`**、初始上下文 = 源 Run 完成节点出参快照、`retrySeq` 从 1 重计、后继按常规推进；③ 缺失快照 → 400 `VALIDATION_ERROR`（指明缺失绑定）；④ 幂等（同源 Run 可重复重试、各自独立 Run、生命周期同普通 Run）；⑤ 前端文案保持 + 「已完成节点不重复执行」；⑥ 与 `rerun` 区别（从头、不写 `retry_from_*`）；另补「新 Run 快照来源（重试）」（G8 的重试半边） | `#### 4.3.4 重试种子（resume seed）`=1；`resumeFromRecordId`=11（含 4.3 事件表新行 :688） |
| **D6 engine_start 分支** | crud-03:789（分支签名）/ **794**（新增「起点判定（D6）」） | 签名改为 `engine_start{run, workflow_id[, resumeFromRecordId]}`；补「含 `resumeFromRecordId` → 跳过『一律从 Start 起步』；**仅当不含** 时才从 Start 起步」 | `起点判定（D6）`=1；`engine_start{run, workflow_id[, resumeFromRecordId]}`=1 |
| **D6 payload 字段** | crud-03:688 | 4.3 `engine_events.payload` 字段表新增 `engine_start.resumeFromRecordId`（string\|null，否，仅重试路径携带） | `resumeFromRecordId` | string=1 |
| **D7** | crud-04:**582** / **622–636** | 4.5 职责改为「触发一次运行（由 `add_job` 创建 JobRun，Scheduler 不自行创建）」；**4.5.2 步骤 2–4 全量重写**：② 前置校验（needsUpdate 已在①；此处 CLIENT_TYPE_MISMATCH）命中即跳过（记日志）→ ③ 调 `add_job`，由其在**同一 `BEGIN IMMEDIATE`** 内完成「同 Job 在途计数（cron 固定 skip）」+「全局 waiting 上限」+ JobRun 插入，**命中即跳过、不报 409** → ④ 投递即返回；新增「Scheduler 不自查不自插（D7）」条；「Scheduler 不直接执行」条改为「`add_job` 内建 JobRun」 | 旧句 `步骤 2-3 在同一事务`=0、`并发占用检查`=0、`只负责创建一次运行（JobRun）并投递给 Task Runner`=0；`Scheduler 不自查不自插（D7）`=1 |
| **D7 附** | crud-04:584 | 4.5 引言「到点创建 JobRun 前」→「到点触发前」；「记 error 日志」→「**记日志**」+ 指向 4.5.2（与 4.5.2 的 warning/error 分层一致） | — |
| **D8** | crud-03:**108–130**（校验规则表，17 条） | 以 `crud-03 §3.3` 为契约基准：把 `proposal-01 §10.14` 除「DAG 无环」外全部规则**逐条并列补入**（Start 无入边 / End 无出边 / Start ≥1 出边 / End ≥1 入边 / 可达 End / OP 从 Start 可达且可达 End / 多入边明确汇聚 / required 有来源），并新增「**允许环路**」为第 17 条**显式替代 §10.14 的「DAG 无环」**（注明以 4.3.0 运行时计数终止、回跳边由运行期推导）；crud-03:309 校验接口功能说明同步为该 17 条 | `允许环路`（规则 17）+ 规则 1–16 齐备；`唯一差异 = 第 17 行「允许环」`=1 |
| **D10** | crud-03:455/457（3.3.8 字段表）、crud-03:501–509（3.3.9 名称锚块）；crud-04:458/460/461（3.4.9 字段表）、crud-04:502–511（3.4.10 名称锚块） | 名称锚范围扩为 `manifest.workflow.name`、`manifest.ops[].name`（crud-03）/ `manifest.target.name`、`manifest.job.name`、`manifest.ops[].name`（crud-04）；`file`/`target.file`/`ops[].file` **仅作定位**（成员须存在），**不校验文件名**、只校验文件**内容**的 `name` | crud-04 `manifest.job.name`=4；两文件字段表均已去掉「`file` 恒为 `ops/<name>.yaml`」（该串=0） |
| **D11** | crud-03:506–507；crud-04:507–508 | message 载体仅用 `message`，格式固化为 `名称锚不一致：manifest.<锚字段>=<值>，<包内路径> 内 name=<值>`，并给出示例 + 「前端**原样展示** message，不做解析」 | 两文件该格式串各=1 |
| **D12（导入侧）** | crud-03:491–499；crud-04:492–500 | 显式列表：① ZIP 解析失败（含体积超限/成员路径非法/成员缺失）→400；② 名称锚不一致 →400；③ kind 不一致 →400；④ 同名实体已存在 →409；⑤ Client 缺失 →409 / 类型不符 →400（两文件同一体例） | 两文件 `导入校验顺序（D12，显式列表，返回首个命中）` 各=1 |
| **D12（运行入口侧）** | crud-04:**313–318**（3.4.6 校验顺序重写为显式列表） | ① `needsUpdate`→409；② `CLIENT_TYPE_MISMATCH`→400；③ **全局 waiting 上限**→409；④ `concurrency=skip` 已有在途→409（**③ 先于 ④**），并注明与 crud-05 3.5.7/3.5.8 顺序一致 | 旧串 `校验顺序（返回首个命中）**：`needsUpdate``=0；新列表=1 |
| **D9（后端侧）** | crud-03:272（3.3.4）；crud-04:245（3.4.4） | 两处 PUT 增同一总则：「请求体携带 `workflowId`/`createdAtMs`/`updatedAtMs`（Job 侧 `jobId`…）**一律忽略（不报错）**，语义 = 整体替换可编辑字段」，并写明与 crud-06 配置**只读项显式拒绝（400）**的区别 | 两文件 `审计字段规则（D9）` 各=1 |
| **G1** | crud-04:458（字段表）/ 502–503（名称锚块） | `manifest.job.name` ↔ 包内 `job.yaml` 的 `name` 纳入严格校验（不一致 → 400），并明确「同名判重以校验通过后的同一名称（三处必相等）为准」 | 见 D10 行 |
| **G2** | crud-03:457 / 516；crud-04:461 / 519 | `manifest.ops[].name` ↔ 其 `file` 指向文件的 `name` 逐条比对；并补两条不变式：① 节点 `opName` 必须命中 `manifest.ops`；② `manifest.ops` name 集合与全部节点 `opName` 集合**必须相等**（多出/缺少 → 400） | 两文件 `一致性约束（G2）` 各=1 |
| **G3** | crud-03:455（字段表去校验细节）/ 508；crud-04:460 / 509 | 把「name 一致性」与「version 以文件为准」**拆开**：新增独立「名称锚一致性校验」块（含 `file` 仅定位），并加粗写「**`name` 不一致一律拒绝**；**仅 `version` 为声明参考**」；同时按 **L10** 把导入校验细节从 3.3.8 导出字段表移出（字段表只留定位 + 指向 3.3.9） | `name` 与 `version` 分开对待（G3）=2（两文件各 1） |
| **G7②** | crud-03:123（规则 12） | 「节点 `clientId` 非空但 Client 不存在」→ 运行期 step 落 `failed`、`error=CLIENT_NOT_FOUND`、不启动子进程 | 见 D3 附 |
| **G8（重试半边）** | crud-03:1236 | 3.4.4（新 4.3.4）补「新 Run 快照来源（重试）」：`job_id`/`name`/`target_*`/`inputs`/`workspace` 取源 Run 快照，`job_kind` 继承（重跑半边属 crud-05，见未修项 4） | — |
| **N1** | crud-03:33 / 237 | 两处样例 `outputs.from.workflowNodeId` 由悬空 `4e5f…c3d4` 改为真实 op 节点 `1b2c3d4e5f60718293a4b5c6d7e8f9a1` | 悬空 id 出现次数=0 |
| **N2（crud-04 半边）** | crud-04:35 | Job 对象样例补计算字段 `"targetName": "deploy_workflow"` | `"targetName": "deploy_workflow"`=1 |
| **N7** | crud-03:522；crud-04:533 | 新增「导入边界与解包安全」：包体积上限取**现有导入上限配置项**（**不新造配置键**，遵低成本项 2）、成员名须为包内相对路径（拒 `..`/绝对/盘符逃逸）、成员数与解压后总量有界，违规 → 400；错误表补「包体积超限 / 成员路径非法」 | 两文件 `导入边界与解包安全（N7）` 各=1 |
| **N8** | crud-03:528；crud-04:539（错误表）；两处 400 行 | 3.3.9 补「成员缺失（根级 `workflow.yaml` / `manifest.ops[].file` 指向成员）→ 400」；3.4.10 扩为「`manifest.target.file` / `manifest.ops[].file` 指向成员缺失 → 400」；两处校验顺序按 D12 统一为显式列表 | 见 D12 行 |
| **N9** | crud-03:519；crud-04:531 | 导入原子性统一为「**单一 `BEGIN IMMEDIATE` 单写事务** + 名称 `UNIQUE` 兜底；唯一冲突映射 409（不映射 500）；**不做去重幂等**，重复导入同名 → 409」 | `BEGIN IMMEDIATE` 单写事务=2 |
| **N10（本文件范围）** | crud-03:738/1304；crud-04:328/646 | 「settings `X`」→「配置项 `X`（见 crud-06 一）」；crud-04:646「（settings）」→「（配置项，见 crud-06 一）」 | 两文件 `settings` 出现次数=**0** |
| **N16（crud-03 半边）** | crud-03:1303 | 拆开交叠粗体：`**注意 `job_queue_running_max` 默认 10 即为其**上限**（…），无法调大**` → `**注意**：… 即为其**上限**（…），**无法调大**` | 旧串=0；两文件 `**` 奇偶失配行=**无** |
| **M8（本文件范围）** | crud-03:501 / crud-04:502 | 同一决策统一为具名标签「**决策-导入名称锚一致性**」（含 D10/D11 口径），替换 crud-03 的 `#6` 与 crud-04 的 `#8`（proposal-01 §8.9 的 `#8` 属他人文件，见未修项 5） | 两文件 `决策-导入名称锚一致性` 各=1 |
| **D2（校验/保存关系，后端侧可见处）** | crud-03:309 | 3.3.6 功能说明明确「[校验] 仅用户主动点击时调用；[保存] 不要求校验通过；[执行] 由后端在创建 Run 前做同一套拓扑校验」 | — |

---

## 未修项与原因

| # | 项 | 原因 / 处置 |
|-|-|-|
| 1 | **D5 的错误码写作 `400 VALIDATION_ERROR`** | **冲突，未按字面落地（保留总表码）**。D5 要求「不一致 → 400 `VALIDATION_ERROR`」，但同一场景在 `proposal-02 §10.1` 总表（**唯一口径**，G5）与 `crud-02 3.2.6`（D5 自身引用的「口径基准」）定义为 `400 CLIENT_TYPE_MISMATCH`；若改码会产生第三种口径并波及 crud-02 / proposal-02 / crud-05 与 60 处内联表。按「冲突则报告并暂停」的规则：**已落地 D5 的实质性要求（400 + 固定 message 逐字）**，错误码沿用 `CLIENT_TYPE_MISMATCH` 并显式标注「错误码见 `proposal-02 §10.1` 总表」（crud-03:122）。**请拍板**：若确要改码，需同步 §10.1 / crud-02 3.2.6 / crud-05 与全部内联表。 |
| 2 | crud-03/crud-04 的 `clientId` 必填（D3）与既有「回退 `Job.target.clientId` / 运行期 `run_failed`」路径 | **未删除，改写为「兼容路径（历史 / 导入遗留的空 `clientId` 节点）」注**（crud-03:127/365 等）。理由：该回退在 crud-03 4.3.3/4.4、crud-04 3.4.6 与 schema.sql（`workflow_nodes.client_id` 可为空）多处交叉引用，属他人文件；擅自删除会造成跨文件口径断裂。现文已明确「规则 10 对新建/更新强制、导入由 `clientName` 解析、遗留空值走兼容路径」。 |
| 3 | G7①（Client 删除引用检查纳入 `workflow_nodes.client_id`）、G6（proposal-02 §1.2 `engine.notify` 分流）、G4（proposal-01 §8.9 前后端分工）、G5（§10.1 定义位置）、G9（schema PRAGMA）、G10/G11（crud-06）、G13（编号索引）、N12–N15、M5/M6/M7、S1/S2（crud-05/§15.x）、N4/N6（crud-05）、L1–L11（tests） | **不在本组可改文件范围**（属 crud-01/02/05/06、proposal-01/02、schema.sql、tests、tasks.md），按任务书「不得修改任何其它文件」未动；已在对应报告（`_val2_02_backend.md` / `_val2_05_new.md` / `_val2_03_tests.md`）留档，请其归属修复者处置。其中与本次直接冲突的两条须注意：**proposal-01 §10.14 的「DAG 无环」条**应由其归属方改为「回跳由运行时计数约束（见 crud-03 4.3）」；**crud-05 3.5.8** 应补写 `retry_from_run_id`/`retry_from_record_id`（D17 改名）与 `resumeFromRecordId` 的写入约定，并引用 crud-03 4.3.4。 |
| 4 | G8 的「重跑（rerun）」半边快照来源 | 位于 crud-05 3.5.7/3.5.8，非本组文件；本组只在 crud-03 4.3.4 落了**重试**半边。 |
| 5 | M8 的三处统一（proposal-01 §8.9 仍标 `#8`） | proposal-01 属他人文件；本组已把 crud-03/crud-04 统一为「决策-导入名称锚一致性」。 |
| 6 | D11 示例中的 `bash-build`（Client 名被当作名称锚示例） | 未采用该示例（属 L9 指出的错误）；改用中性示例（`manifest.workflow.name` / `manifest.ops[0].name` / `manifest.target.name=deploy_workflow` / `manifest.job.name=hourly_check`），**格式串仍逐字遵循 D11**。 |
| 7 | `_fix_v2_decisions.md` 末尾「## 落地情况」表 | **按本次任务书要求未写入该文件**，改由本报告承载落地情况。 |
| 8 | D12 运行入口侧顺序在 **crud-05 3.5.7/3.5.8** 的落地 | 非本组文件（本组只落了 crud-04 3.4.6）；crud-05 需按「① waiting 上限 →② RERUN_/RETRY_NOT_ALLOWED →③ skip 在途」写成显式列表。 |

---

## 机械自检（命令与结果）

脚本：`%TEMP%` 下临时只读脚本（未在受审目录落盘；`C:\Users\Public\_j_verify.py` / `_j_loc.py` / `_j_scan*.py`）。

### A. 旧措辞 0 残留（期望 0，实测 0）

| 检索串 | 命中 |
|-|-|
| `记录数 − 1` | 0 |
| `记录数-1` | 0 |
| `最大重试次数` | 0 |
| `settings` | 0（两文件合计） |
| `步骤 2-3 在同一事务` | 0 |
| `并发占用检查` | 0 |
| `只负责创建一次运行（JobRun）并投递给 Task Runner` | 0 |
| `取上游节点出参` | 0 |
| `` （`file` 恒为 `ops/<name>.yaml`） `` | 0 |
| `注意 `job_queue_running_max` 默认 10 即为其**上限**（crud-06 一/三），无法调大**` | 0 |
| 旧校验顺序串 `` `校验顺序（返回首个命中）**：`needsUpdate` `` | 0 |
| 悬空节点 id `4e5f60718293a4b5c6d7e8f9a1b2c3d4` | 0 |

### B. 新措辞到位（期望 > 0，实测如上「证据」列）

`#### 4.3.4 重试种子（resume seed）`=1；`resumeFromRecordId`=11；`每轮最大尝试次数`=1；`本轮尝试计数`=1；`记录数 >= max，**首次执行计入**`=1；`| `unbound` |`=1；`无来源判据（D4）`=1；`参数绑定必须指向前置节点`=2；`所有 op 节点的 `clientId` 非空`=1；`导入校验顺序（D12，显式列表，返回首个命中）`=2（两文件）；`名称锚一致性校验（决策-导入名称锚一致性；D10/D11）`=2；D11 格式串=2；`审计字段规则（D9）`=2；`导入边界与解包安全（N7）`=2；`BEGIN IMMEDIATE` 单写事务=2；`起点判定（D6）`=1；`Scheduler 不自查不自插（D7）`=1；`一致性约束（G2）`=2；`manifest.job.name`=4；`Client 类型与 OP 类型不匹配：…`=6；`targetName": "deploy_workflow"`=1；`配置项 `job_queue_waiting_max``=3。

### C. 引用目标真实存在（全部 OK）

`proposal-01 §10.14`（`### 10.14 校验规则`）、`proposal-01 §12.8`、`crud-02 3.2.6`、`crud-05 3.5.7`、`### 3.5.7`/`### 3.5.8`、`crud-06 一、配置分组与配置项`、`crud-03 4.3.0`、**新引用目标 `crud-03 4.3.4 重试种子（resume seed）` 存在**、`crud-04 3.4.6 #4` 存在。

### D. 排版与编码

- `**` 奇偶失配行：crud-03 **无**、crud-04 **无**（N16 交叠粗体已消除）。
- 行尾：两文件 `CRLF=0 / LF=n`；末字节 `\n`；无 BOM；**未做换行符转换**（原文件本就是 LF）。
- 仅修改了本组两个文件（`git status --porcelain` 中本组新增改动只涉及这两路径）。

```
$ python C:\Users\Public\_j_verify.py        # A/B/C/D 全绿（见上）
$ python C:\Users\Public\_j_loc.py           # 定位改后行号，用于本报告
```
