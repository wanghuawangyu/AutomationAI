# 第 5 轮修复报告 —— 测试面（`_fix_v5_E_tests.md`）

- 修复者：测试面（第 5 轮）｜范围：**只改** `tests/集成测试用例.md`、`tests/fixtures/**`｜口径来源：`_fix_v5_decisions.md`（唯一权威）+ `_val5_02_tests.md` + `_val5_03_global.md`。
- 行尾/编码：`tests/集成测试用例.md` = **UTF-8 + CRLF**（改后 2031 CRLF / 0 bareLF）；`tests/fixtures/**` = **UTF-8 + LF**（`tc_j2/seed.sql` 94 LF、`tc_r1/seed_terminal_states.sql` 136 LF，均 0 CRLF）。

## 已修项（含证据）

### 1. 【严重 S-1】`TC-X5e5` 断言改「可观测口径」，去除不可判定字段
- 落地位点：`tests/集成测试用例.md:1773`（步骤 3）。
- 改法：删去 `run_edge_state` 子断言，改为 `GET /api/runs/{runId}` 的 `status` 在**有限时间内落终态 `success`**（不得永久 `running`/`waiting`）、详情 `steps` **完整**、**无节点永久 `waiting`**，并保留「重试 Run `step_records` 不含 Z」；`status`/`steps` 字段已核实存在（`proposal-02-后端crud-05运行历史.md:14/40-41/108`：`GET /api/runs/{runId}` → JobRun「完整详情（含 steps）」）。
- 同步：步骤 2 死枝判据由旧「入边已全部决定且无 activated」改为「**不可达闭包**」（与 `crud-05 3.5.8④:399` 口径一致；`crud-03 4.3.4②` 由文档组本轮同口径收口）。
- 证据：`grep -c run_edge_state` = **0**（md 全文）/夹具 **0**；断言改后含 `status`「落到终态 `success`」「steps **完整**」「无任何节点永久停留在 `waiting`」。

### 2. 【一般 G-1】`TC-W4` 步骤改「经 API 构造非法 `outputs[].from`」
- 落地位点：`tests/集成测试用例.md:898,900,901,902,903`（前置 + 步骤 1/2/3/4）。
- 改法：前置改为 `POST /api/workflows` 经 API 建 `Start→A→End`（含 `position`、required 入参 `code` 绑字面量、合法出参 `from=A.approved`）+ `POST /api/workflows/{id}/validate` 正向基线；步骤 1/2 改为 `PUT /api/workflows/{workflowId}` 直接构造非法 `from.workflowNodeId` / `outputName`，再 `POST /api/workflows/{id}/validate` 断言 `{valid:false}`。**避开界面「出参」双下拉不可构造**（`proposal-01 §10.9` G13）。
- 口径说明（对决策字面的偏差，已在文内写明）：`crud-03 3.3.3/3.3.4:247/285/301` 明定规则 18 属 **B 组、保存时不执行**，故 `PUT /api/workflows` 对非法 `from` 返回 **200**（允许草稿）；**400 `VALIDATION_ERROR`** 由「创建 Run 前」路径产生（步骤 3：`POST /api/workflows/{id}/execute` / 运行 Job）。断言仍含 **400**，构造已全部改经 API。
- L-5（文案口径）：`errors[]` 文案 `crud-03 3.3.6:350` 未固定 → 文内明确「**仅断言 `valid=false`，不作逐字断言**」。

### 3. 【一般 G-2】夹具映射 / 复用清单补 5 处漏项
- 落地位点：`tests/集成测试用例.md:21,32`。
- `:21` 映射表行 → `TC-R1 / R2a / R2b / R3 / R4 / S1`（补 `TC-S1`，硬依赖 `tc_r1/seed.sql`）。
- `:32` 复用清单 → `tc_o2` 复用方补 **TC-W4**；`tc_j2/op_always_fail.yaml` 复用方补 **TC-X5e 族（e1a/e1b/e5）**；`tc_r1/seed.sql` 复用方补 **TC-S1**；`tc_j3/tc_j3_schedule.zip` 复用方补 **TC-X5a3/b3/c3/d3**（与 `:1327/:1333` 映射表一致）。

### 4. 轻微项 M1–M8 / 全局涉测试项
- **L-1**（名称截断）：`:85` TC-W4、`:146` TC-X5e5 汇总名与 `####` 标题**逐字对齐**（改后 93/93 名称一致、0 diff）。
- **L-2**（族引用未写区间）：`TC-X2` → `TC-X2a~X2d`（`:106,1343,1430,1514,1600`）；`TC-E3 系列` → `TC-E3a~E3e 系列`（`:1908`）。
- **L-3**（五条件枚举不一致）：`:1321` 通用口径补全为 5 项（target=Workflow、版本一致、Job 无 needsUpdate、所引 Workflow 无 needsUpdate、存在失败/超时 step），与 `TC-X5e1a` 步骤 3 的 5 项一致。
- **L-4**（统计口径）：统计表后加「口径说明」注（`### 6.1 X5 系列 41 例` 计入「跨页面联动」行 53；`### 7`/`### 8` 单列；两向合计均为 93）。
- **L-6**（required 入参绑定提示）：`TC-X5e5` 前置（`:1769`）与 `TC-X5e1a` 前置（`:1683`）补「required 入参须绑定来源（否则规则 15 不通过）」。
- **L-7**（夹具静默失败）：`tc_j2/seed.sql` 末尾补行数自检 `SELECT tc_j2_seed_check`（期望 3/3）；`tc_r1/seed_terminal_states.sql` 末尾补 `SELECT tc_r1_terminal_check`（期望 2/4/8/1）。
- **L-8**（`.read` 假绿）：`:34` 新增「DB 注入与 `.read` 写法（Windows 实测口径）」说明项。
- **全局 N-3**：`tests:1828` 的拼接标题 `crud-04 3.4.6「…语义（全入口生效）」` → `crud-04 3.4.6.1「适用范围（全入口生效）」/ 3.4.6.2「\`job_queue_waiting_max\` 的语义」`（目标小节口号已核实存在）。
- **全局 N-2（测试侧）**：`TC-W1` 步骤 8 校验枚举补 `\`bindings\` 引用的前置节点出参存在（规则 13）`，使该规则在 tests 有文案。

### 5. 机械自检证据
- **旧措辞 0 残留**：`run_edge_state`=0、`1–8`=0、`共 16 条`=0、`slugName`=0、`EXPORT_UNAVAILABLE`=0、`settings.<键>`=0。
- **`#### TC-` 标题数 = 汇总行数 = 93**；ID 集合与顺序完全一致（`order equal: True`，重复 0）；**标题名 vs 汇总名 0 diff**（含 TC-W4 / TC-X5e5 逐字相等）。
- **区块结构 93/93**（`优先级`/`用例目标`/`前置条件`/`执行步骤与预期结果` 齐全）；顶层步骤编号 1..N **全部连续**（issues = []）。
- **统计表逐格复算**：`1.Client 5 / 2.OP 5 / 3.Workflow 4 / 4.Job 3 / 5.运行历史 5 / 6.跨页面联动 12+6.1 X5 41=53 / 6.2 配置系统 1 / 7.错误族 13 / 8.导入校验 4` = **93**；优先级 P0=4 / P1=18 / P2=11 / P3=60（合计 93）——与文末统计表**逐格相同**。
- **6 个 ZIP 逐成员 SHA256 / 成员序 / 名称锚**：
  - `tc_e2_loop` 4 成员 order=`workflow.yaml,manifest.json,ops/op_tc_e2_fail.yaml,ops/op_tc_e2_ok.yaml` **MATCH 4/4**；
  - `tc_j3_schedule` 3 成员 order=`job.yaml,manifest.json,ops/op_prompt_review.yaml` **MATCH 3/3**；
  - `tc_x3_multi` 4 成员 order=`workflow.yaml,manifest.json,ops/op_prompt_review.yaml,ops/op_bash_build.yaml` **MATCH 4/4**；
  - `tc_x4_manual_op` 3 成员 **MATCH 3/3**；`tc_x4_manual_workflow` 4 成员 order=`job.yaml,manifest.json,workflows/wf_deploy_prod.yaml,ops/op_prompt_review.yaml` **MATCH 4/4**；`tc_x4_schedule_workflow` 同序 **MATCH 4/4**。
  - 合计 **22/22 成员 SHA256 与源目录逐字节相等**；成员序与文档声明 6/6 一致。
- **新 SQL sqlite3 实跑**（`sqlite3 3.50.6`；按 L-8 口径 `cd` 夹具目录 + 相对名 `.read`）：
  - `tc_r1`：`.read schema.sql` → `wal`、rc=0；`.read seed.sql` → 0 输出、rc=0；`.read seed_terminal_states.sql` → 打印 `tc_r1_terminal_check: job_runs=2 step_records=4 run_node_state=8 workflows=1`；总量 `13 runs / 15 steps / 8 nodestate / 1 wf`；`PRAGMA foreign_key_check` = **0 行**；重复执行幂等（计数不变）。
  - `tc_j2`：**无前置** → 自检打印 `tc_j2_seed_check: job_runs=0 step_records=0`（证明门禁可判「注入未发生」）；补齐前置（1 op + 3 job）后重跑 → `tc_j2_seed_check: job_runs=3 step_records=3`（期望值）。

## 未落地与原因

- **Q-1 / Q-2（需拍板，未裁定）**：`_fix_v5_decisions.md` 未裁定补「校验规则族覆盖用例」与「导入复用 + warnings 用例」，故**未新增用例**（保持 93 例、统计表不变）。
- **N-2 的「TC-W1 增规则 13 负向断言」建议**：TC-W1 拓扑为单 op 节点（`Start→OP→End`），**无前置 op 节点可引用**，规则 13 在该拓扑下不可构造（真空通过），故未加断言，仅在步骤 8 枚举补文案以免该规则在 tests 完全无出处；如需真负向覆盖，应在 ≥2 op 节点的用例（如 X5e1a 族）另行补例（属 Q-1 范围）。
- **决策 §三.tests 字面「POST/PUT … 并断言 400 `VALIDATION_ERROR`」**：因 `crud-03 3.3.3/3.3.4` 明定规则 18 属 B 组、**保存时不执行**，保存返回 200；若断言 PUT=400 会与规范冲突。已取「构造经 API（PUT 200）+ 400 落在创建 Run 前（execute）」的契约自洽实现，并在用例文内写明，作为对字面的最小偏离。
