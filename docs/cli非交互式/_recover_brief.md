# 重建任务书（3 个文档被外部进程删除后重建）

## 事故与现状

- 2026-10-14 修复过程中，**外部进程删除了 4 个文档**：`proposal-01-界面设计.md`（已还原并补做了 R5 编辑）、`proposal-02-后端crud-03workflow管理.md`、`proposal-02-后端crud-06配置管理.md`、`proposal-02-后端设计.md`。前两者中 `proposal-01` 已恢复到「git HEAD + R5 编辑」，**其余 3 个目前 = git HEAD 版本**。
- **git HEAD（`3c5e8e8`）是「第一轮 7 轮循环收尾」的状态**：它**不含**新周期（R1–R4）的全部改动，也不含另一会话在 4 月早前加入的「导入名称锚一致性校验」内容。
- 已完成：`git checkout HEAD -- <3 文件>` 还原 + `commit 54d51b3` 保存现状（此后所有工作都在 git 里可回溯）。
- **你的任务**：把你负责的那个文件**重建到「等于新周期 R1–R4 修复完成后的应有状态」**。

## 权威来源（按序阅读，冲突以决策文件为准）

1. `_fix_v2_decisions.md`、`_fix_v3_decisions.md`、`_fix_v4_decisions.md`、`_fix_v5_decisions.md` —— **唯一权威口径**（D1–D18、各轮拍板、编号/计数唯一口径、`不可达闭包`、`run_edge_state` 删除等）。
2. 各轮校验报告（**含精确行号与原文引用**）：`_val2_02_backend.md`、`_val3_02_be.md`、`_val4_02_contract.md`、`_val5_01_docs.md`、`_val5_02_tests.md`、`_val5_03_global.md`。
3. **未被删除的同族文件**是最可靠的模板与交叉校验源（它们已含新周期改动）：
   - `proposal-02-后端crud-04job管理.md`（含 3.4.10 名称锚、3.4.6.1/.2/.3/.4、CLIENT_TYPE_MISMATCH、D7 cron 单事务）
   - `proposal-02-后端crud-05运行历史.md`（含 3.5.8 重试种子/不可达闭包、4.8 五条件、`retry_from_record_id`）
   - `proposal-01-界面设计.md`（含 §8.9 名称锚通用约定、§10.14 规则表 17 条计数、§20.1）
   - `schema.sql`（现 9 表、无 `run_edge_state`）、`tests/集成测试用例.md`、`原型图/**`、`tasks.md`
4. **凡其它文件引用到你文件里的章节**（如 `crud-03 3.3「校验规则」`、`crud-03 4.3.4`、`crud-03 4.4`、`proposal-02 §10.1`、`crud-06 §一/3.4`），你文件里**必须存在该章节且语义一致**。请用 grep 反向枚举这些引用并逐条核对。

## 各文件的必含内容（要点，不是全文清单；以决策文件为准）

### A. `proposal-02-后端crud-03workflow管理.md`
- 3.3 校验规则表：**A 组 `9/10/11/16`（4）+ B 组 `1–7/13–15/18`（11）+ C 组 `12/17`（2）= 17 条**；**规则 8（汇聚）已删、编号留空不补**；**不得出现 `1–8` 或「共 16 条」**。
  - **保存（POST/PUT）只做字段级校验**（规则 9/10/11/16 + position 类）；**拓扑/连通/绑定类（1–7、13–15、18）不在保存时执行**，只在 `[校验]`（3.3.6）与**创建 Run 前**执行。
  - 规则 10：OP 节点 `clientId` **必填**；规则 11：Client.type 与 OP.type 一致 → 400 `CLIENT_TYPE_MISMATCH` + 固定 message；规则 18「出参来源必须有效」；规则 17「允许回跳环」（C 组，说明性）。
  - **D1**：`retry.max` = **每轮尝试次数**（首次执行计入，序列 3/3/3）；回跳总上限 `min(max × 3, max_loop_multiplier)`；`max_loop_multiplier=0` = 不施加绝对上限（仍受 `max×3`）。
  - **D2**：保存不要求校验通过（允许草稿）；执行前后端校验引用版本，不通过 → 400。
  - **D6**：`4.3.4 重试种子（resume seed）` 小节：`resumeFromRecordId`、前置节点视为已完成且**不写入新 Run 的 `step_records`**、以源 Run 完成节点出参快照为初始上下文、缺失快照 → 400、幂等、与 `rerun` 的区别；**新 Run 边状态初值 = 五步**（全边 `pending` → 前缀出边按源 Run 终态复制 → 种子入边 `activated` → **「不可达闭包」判据**：既不在前缀集合、也不从种子/已决边可达的节点 → 出边置 `dropped` 并递归至不动点 → dispatch），并保留「否则多入边节点永久 pending、Run 卡死」的风险说明与最小反例。
  - **D7**：cron 触发路径全部校验与 JobRun 插入都在 `add_job` 单事务（`BEGIN IMMEDIATE`）；**Scheduler 不自查不自插**；命中上限跳过、不报 409。
  - **D10/D11/D12**：名称锚四项（`manifest.workflow.name`/`manifest.target.name`/`manifest.job.name`/`manifest.ops[].name`）；message 固定格式 `名称锚不一致：manifest.<锚字段>=<值>，<包内路径> 内 name=<值>`；导入校验顺序 ① ZIP 解析 → ② 名称锚 400 → ③ kind 400 → ④ 同名 409 → ⑤ Client 缺失 409/类型不符 400。
  - **3.3.9 导入**：四项锚逐一对应（**不得要求 `job.name` = `target.name`**）；`manifest.clients[].clientId` **不校验**唯一/存在；包体积上限**沿用 `op_import_max_bytes`**；缺 `timeoutSeconds` → 400。
  - **4.4「执行前校验」**：作为「创建 Run 前」完整性校验的落点（其它文件引用它）；补完成钩子双名映射（`STEP_COMPLETE`/`JOB_COMPLETE` ↔ `StepComplete`/`JobComplete`）。
  - 其它：`run_edge_state` **不得出现**（现 9 表）；时序图字段名用 `step_completed{step_id, activation_seq, retry_seq, result}`；事件保留措辞「软删 = `engine.engine_event_retention_days` 天后，再 1 天后物理删除」；`.out`/旧术语清理；跨文件 `#n` 引用一律具名。

### B. `proposal-02-后端crud-06配置管理.md`
- 配置项需**分组全路径**命名（`history.job_queue_running_max`、`engine.engine_event_retention_days`、`history.job_queue_waiting_max` 等），并有「分组路径」列或说明。
- `job_queue_running_max`：默认 10、**下限 1、上限 10**（`1..10`）。
- `job_queue_waiting_max`：默认 20、上限 1000。
- `max_loop_multiplier`：`0` = **不施加绝对上限、仍受 `max×3` 约束**（不是无限）；范围 0 或 1..10000。
- **D18**：软删 = `engine.engine_event_retention_days`；硬删 = 软删 **+ 1 天**（默认 1 时即「1 天软删 / 2 天硬删」）。
- 导入体积上限沿用 `op_import_max_bytes` / `client_import_max_bytes`（写明关系，**不新造键**）。
- 配置**只读项明确拒绝（400）**，与「实体审计字段一律忽略」区分写明。
- `run_edge_state` 不得出现；`GET /api/workspaces` 的 SQL 需可执行、`limit` 有上限；术语「配置项（`ai-automation.json`）」而非旧 `settings` 表措辞。

### C. `proposal-02-后端设计.md`
- `§10.1 错误码总表`：**不新增 `EXPORT_UNAVAILABLE`**（导出库缺失属内部错误，用 `INTERNAL_ERROR`）；名称锚不一致的 `message` 固定格式（见上，与 crud-03/04 逐字一致）；总表行/码数与内联表一致。
- `§1.1` 增「数据库连接初始化约定（G9）」：`foreign_keys`/`busy_timeout`/`journal_mode` 为**连接级**、必须每连接显式设置，否则 FK 与 `ON DELETE CASCADE` 静默失效；依赖级联的删除在 Repository 层另有显式 SQL 兜底。
- **删除 `run_edge_state` 行**（表格清单里那一行；现交付件 9 表）。
- 模块/接口清单与实际一致（`§2`/`§3`/`§12` 对应表补缺章）；trait 清单去重（`ClientRepo` 等）；Task Runner 状态集合含 `terminating`；完成钩子命名映射一句；`uptimeMs` 类型说明；`engine.notify` 分流（Job/Workflow 走 Engine，`target=op` 不走）。
- 章号体例与 `proposal-01`/`tasks.md` 统一（`§中文数字（章名）` 用于章、`§N.M` 用于节）；引用目标存在。

## 硬性要求

1. **只改你负责的那一个文件**（不要动其它文件、不要动 `_*.md` 报告、不要动 `validation.md`）。
2. 保持 UTF-8、**LF 行尾**（原文件为 LF）。
3. 必须做**反向引用核对**：grep 全集里对本文件的章节引用（如 `crud-03 3.x`、`crud-03 4.x`、`proposal-02 §x.y`、`crud-06 §x`），逐条确认你文件里存在且语义一致；把命令与结果写进报告。
4. 必须做**正向核对**：本文件内所有 `见 §x.y` / `见 crud-0x N.N` 引用，目标必须存在（其它文件现在也是新状态）。
5. 自检并贴证据：旧措辞残留 0（`1–8`、`共 16 条`、`run_edge_state`、`settings \`X\``、`记录数-1`、`EXPORT_UNAVAILABLE`）、新措辞到位、计数自洽、表格列数一致（`\|` 不计）、`**` 成对。
6. 报告写 `_recover_<文件简称>.md`：## 重建项清单（项 → 落地位点 → 证据） / ## 反向引用核对结果 / ## 未落地与原因。
7. 完成后回复 ≤200 字。**不要提交 git**（由协调者统一提交）。
