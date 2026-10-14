# 第 4 轮修复报告 · E 组（tests 面）

范围（**仅改**）：`docs/cli非交互式/tests/集成测试用例.md`、`docs/cli非交互式/tests/fixtures/**`。
唯一口径：`_fix_v4_decisions.md`（未写入）；另读 `_val4_03_tests.md`（G-1/G-2、M-1~M-9、D-1~D-4）、`_val4_05_global.md`（S-2、L-1）、`_val4_01_docs.md`（G4）、`_val4_02_contract.md`（S1/N5）。
编码：UTF-8；`集成测试用例.md` 保留 BOM + **全 CRLF**（2028 行，LF-only=0）；夹具 SQL/YAML/JSON 全 **LF**（原样）。

---

## 已修项（含证据）

### 一.1 新增负向用例：`outputs[].from` 无效（crud-03 §3.3 规则 18）
- 新增 **TC-W4**（`集成测试用例.md:892-903`，P3），落在 3. Workflow 管理：负向① `from.workflowNodeId` 不存在、负向② `outputName` 不在该节点 OP `outputs[].name`；断言 `[校验]`→**200 `{valid:false}`**（3.3.6 口径）、**创建 Run 前 → 400 `VALIDATION_ERROR`**、正向对照 200；前置用 `tc_o2/tc_o2_01.yaml`（`op_prompt_review`，出参 `approved`，实测）。
- 同步：汇总列表新增行（`:84`）；统计表 **Workflow 管理 3→4**（P3 0→1）。
- 规则 18 实物已存在：`crud-03:108`（共 17 条）/`:112`（B 组合 18）/`:140`（规则 18）。

### 一.2 新增用例：菱形 + 旁支 + 重试（死枝闭包）
- 新增 **TC-X5e5**（`:1763-1772`，P3，X5 重试族），拓扑 `Start→A`、`A→{on_success}B`、`A→{on_failure}Z`、`B→End`、`Z→End`；断言 B 失败→重试→修复后 Run **`success`（不永久 running）**、`Z→End=dropped`、重试 Run 不含 Z。
- 同步：X5 变体映射表新增 `e5` 行（`:1332`）；汇总列表新增行（`:145`）；统计表 **跨页面联动 52→53**（P3 40→41）。
- **优先级说明**：N5 括注建议 P2；本例归入 X5 重试族（全族 P3，且 P3 定义含「构造失败/版本变更场景」），采 **P3** 与族内一致。

### 一.5 夹具 `tests/fixtures/tc_r1/seed_terminal_states.sql`
- `edges[].condition` 三处 `success` → **`on_success`**（S-2）。
- 补被引用的 **1 行 `ops`**（`op_id='10000001'`、`name='op_prompt_review'`、`outputs` 含 `passed`）与 **1 行 `clients`**（`client_id='f6a7b8c9…'`、`type='prompt'`），并加对应 `DELETE`（幂等）（M-9）。
- 文件头加注取值域：`workflows.edges[].condition ∈ {on_success, on_failure, always}`（crud-03 3.3）。
- 同步文档：夹具表 `:21` 与 TC-R4 前置 `:1171` 注明「另补 1 行 OP/1 行 Client」。

### 二.10/13 `settings.<键>` → 配置项全路径；夹具注释旧 `#n`
- `settings.` 全库残留 **0**（见自检）。改为全路径：`history.job_queue_running_max`、`history.job_queue_waiting_max`（`:1785/:1794/:1823`）、`engine.max_loop_multiplier`（`:1786/:1846/:1880`），并以「配置项 …（`ai-automation.json`）」形给出（D-1/L-1）。
- `tc_j2/seed.sql:23` 的 `#4/#8/#10` → **「数据集行 4/8/10」**（M-3/D-4）；`tests` 内 `#\d` = 0。

### 三 逐项
| 项 | 要求 | 落地位点 | 证据 |
|-|-|-|-|
| **G-1** | E1a 第 1 步计数与前 3 冲突 | `:1796` 前置 3 | 删「或按 `tc_r1/seed.sql` 注入」，写明其含 `running`/`waiting` 各 1 会污染全局计数 |
| **G-2** | cron 边界保持手段 | `:1804` 第 5 步 | 补「到点前 ≤1 cron 周期先保持 waiting 满额」及补足手段 |
| **M-1** | crud-06 章节指向 | `:1785/:1794/:1823` | 「crud-06 一『数值项上限』」→「crud-06 3.4『数值项上限』」（旧串残留 0） |
| **M-2** | `:34` 残留「仍应唯一」 | `:34` | 改为「宜不重复——属夹具数据质量要求，导入不校验其存在/唯一」 |
| **M-3** | 夹具 `#n` | `tc_j2/seed.sql:23` | →「数据集行 n」 |
| **M-4** | E3b 数据来源 | `:1898` | `op_tc_e2_ok` 补来源（`tc_e3/op_tc_e3_longrun.yaml`；或按 E2 导入后可用） |
| **M-5** | E1a [重试] 前提不可执行 | `:1796` 前置 3 | 加「② 执行含失败 step 的 Workflow 至终态供 [重试]」 |
| **M-6** | E4b 断言可区分 | `:1964` | 断言落到 message（名称锚格式），并给出隔离 ③ 的替代构造 |
| **M-7/D-1** | `settings.<键>` 术语 | 6 处 | 见二.10 |
| **M-8** | ZIP data descriptor 说明 | `:22` | 维持注解（D-3 拍板：不统一容器） |
| **M-9** | 夹具缺 OP/Client | `seed_terminal_states.sql` | 见一.5 |
| **D-3** | ZIP 容器不统一 | `:22` | 维持注解 |
| **D-4** | 夹具注释 `#n` | `tc_j2/seed.sql:23` | 见二.13 |
| **G4** | `tests:763` 删「DAG 无环」 | `:763` | 改为「**允许回跳环（不做环判定）**」；旧串残留 0 |

---

## 自检证据（机械核对）

`集成测试用例.md`：
```
BOM: True   bytes: 176551   CRLF: 2028   LF-only: 0
detail 93  summary 93  unique True
only_detail []  only_summary []  order_identical True
priority mismatch []           # 详细优先级 ↔ 汇总行逐格一致
MOD Client   total 5  P0 1 P1 4 P2 0 P3 0
MOD OP       total 5  P0 1 P1 4 P2 0 P3 0
MOD Workflow total 4  P0 1 P1 2 P2 0 P3 1
MOD Job      total 3  P0 1 P1 2 P2 0 P3 0
MOD Runs     total 5  P0 0 P1 4 P2 0 P3 1
MOD Cross    total 53 P0 0 P1 1 P2 11 P3 41
MOD Cfg      total 1  P0 0 P1 1 P2 0 P3 0
MOD Err      total 13 P0 0 P1 0 P2 0 P3 13
MOD Imp      total 4  P0 0 P1 0 P2 0 P3 4
# 与统计表逐格一致：合计 93 = P0 4 + P1 18 + P2 11 + P3 60
block missing: []
OLD settings.=0  仍应唯一=0  DAG 无环=0  crud-06 一「数值项上限」=0  （或 tc_r1/seed.sql 注入）=0  #<n>=0
NEW TC-W4×2  TC-X5e5×3  规则 18×1  允许回跳环（不做环判定）×1
    history.job_queue_running_max×3  engine.max_loop_multiplier×3
    死枝闭包×7  crud-06 3.4「数值项上限」×3  宜不重复×1
```
区块结构：93/93 含 `优先级/用例目标/前置条件/执行步骤与预期结果`；步骤顶层编号：新用例与全体现有样式同基线（6 处「前置条件有序列表 + 步骤列表」的合并检出为探测器假阳性，非跳号）。

ZIP（6 包 / 22 成员，成员序 + 逐成员 SHA256）：
```
tc_e2/tc_e2_loop.zip 4  sig==central True ALLMATCH True | workflow.yaml > manifest.json > ops/op_tc_e2_fail.yaml > ops/op_tc_e2_ok.yaml
tc_j3/tc_j3_schedule.zip 3 ... ALLMATCH True | job.yaml > manifest.json > ops/op_prompt_review.yaml
tc_x3/tc_x3_multi.zip 4 ... ALLMATCH True | workflow.yaml > manifest.json > ops/op_prompt_review.yaml > ops/op_bash_build.yaml
tc_x4/tc_x4_manual_op.zip 3 ... ALLMATCH True | job.yaml > manifest.json > ops/op_prompt_review.yaml
tc_x4/tc_x4_manual_workflow.zip 4 ... ALLMATCH True | job.yaml > manifest.json > workflows/wf_deploy_prod.yaml > ops/op_prompt_review.yaml
tc_x4/tc_x4_schedule_workflow.zip 4 ... ALLMATCH True | job.yaml > manifest.json > workflows/wf_deploy_prod.yaml > ops/op_prompt_review.yaml
```
名称锚：`tc_e2`/`tc_x3` 的 `manifest.workflow.name`、`tc_j3`/`tc_x4×3` 的 `manifest.job.name`/`target.name`/`ops[].name` 全部与包内文件 `name` 一致（0 不符）。

SQL 实跑（`sqlite3`，路径无中文的 `%TEMP%\fix4\`）：
```
.read schema.sql rc=0 → .read seed.sql rc=0 → .read seed_terminal_states.sql rc=0
pragma foreign_key_check 无输出（无违规）
二次执行幂等：job_runs/step_records/run_node_state/ops/clients = 13/15/8/1/1 不变
edges === [{"from":"wnode-tc-r4-start",...,"condition":"on_success"},…(3 条, 均 on_success)]
ops: 10000001|op_prompt_review|prompt|[{"name":"passed",...}]
clients: f6a7b8c9…|Claude Code|prompt
```

---

## 未落地与原因

- **D-2**（终态「未执行/跳过」适用边界句在 `proposal-01 §12.6`）与 **L-2**（钩子映射句在 `crud-03 4.4`）：归属 `proposal-01`/`crud-03`（A/B 组），非 tests 面，未改。
- **N5 建议的 P2**：采纳为 **P3**（见「一.2 优先级说明」），以与 X5 重试族一致。
- 其余 `_val4_03_tests.md` 的 M-1~M-9、D-1/D-3/D-4 与 G4 均已在 tests 面落地（见上表）。

自检脚本落于 `%TEMP%`（不污染被审目录）；未在 `tests/` 留任何临时文件。
