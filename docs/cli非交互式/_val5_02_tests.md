# 第 4 轮独立校验报告 —— 测试面（tests/集成测试用例.md + tests/fixtures/**）

校验员：独立校验（第 5 轮编号 `_val5_02`）｜范围：只读，仅写本报告｜工作目录 `F:\project\workflow\docs\cli非交互式\`
口径：**只认机械核对结果**，不采信任何修复者自述。

---

## 统计

| 项 | 机械结果 |
|-|-|
| `#### TC-` 标题数 | **93** |
| 汇总列表行数 | **93**（`^| TC-` 行，行 71–163） |
| 标题 ID 序 vs 汇总 ID 序 | **完全一致**（`summary == headings (order): True`；集合差 A-B / B-A 均为空） |
| 标题名称 vs 汇总名称 | 91/93 一致；**2 处名称截断**（TC-W4、TC-X5e5，见 L-1）。ID/优先级/条数不受影响 |
| 重复 ID | **0**（`DUP HEADINGS: []`，汇总侧同） |
| 悬空 ID | **0**（全库仅 `TC-X2`、`TC-E3` 为族引用，非 ID，见 L-2） |
| 区块结构 | **93/93** 含 `优先级`/`用例目标`/`前置条件`/`执行步骤与预期结果` |
| 顶层步骤编号 1..N 连续 | **93/93**（`SEQ_OK` 全 True；`前置条件` 内另有独立 1..n 列表，不参与步骤判定） |
| 文末统计表逐格复算 | **逐格一致**（见下） |
| 夹具文件数 / 被引用路径 | 67 个文件；**27 处引用路径全部存在**；**无孤儿文件** |

**统计表复算（按 `###` 模块分组 + 汇总优先级独立重算）**

| 模块 | 用例数 | P0 | P1 | P2 | P3 | 表值 | 判定 |
|-|-|-|-|-|-|-|-|
| Client 管理 | 5 | 1 | 4 | 0 | 0 | 同 | ✓ |
| OP 管理 | 5 | 1 | 4 | 0 | 0 | 同 | ✓ |
| Workflow 管理 | 4 | 1 | 2 | 0 | 1 | 同 | ✓ |
| Job 管理 | 3 | 1 | 2 | 0 | 0 | 同 | ✓ |
| 运行历史 | 5 | 0 | 4 | 0 | 1 | 同 | ✓ |
| 跨页面联动 | 53 | 0 | 1 | 11 | 41 | 同 | ✓ |
| 配置 / 系统 | 1 | 0 | 1 | 0 | 0 | 同 | ✓ |
| 错误族矩阵 | 13 | 0 | 0 | 0 | 13 | 同 | ✓ |
| 导入校验 | 4 | 0 | 0 | 0 | 4 | 同 | ✓ |
| **合计** | **93** | **4** | **18** | **11** | **60** | **93 / 4 / 18 / 11 / 60** | ✓ |

横向与纵向合计均自洽（5+5+4+3+5+53+1+13+4=93；4+18+11+60=93）。

---

## 逐项实证结果

### 1. 用例数 / ID / 汇总表 / 统计表 / 结构（指令项①）

```
python tc.py      -> TC HEADING COUNT: 93 ; DUP HEADINGS: []
python cross.py   -> summary rows: 93
                     summary dup: []
                     summary == headings (order): True
                     set diff A-B: []  B-A: []
                     NAME DIFF TC-W4   (摘要名缺「→ 校验不通过 / 创建 Run 前 400」)
                     NAME DIFF TC-X5e5 (摘要名缺「，D6」)
                     优先级比对：0 处不一致（区块 `优先级` 与汇总表逐例相同）
python struct2.py -> total blocks: 93 ; ISSUE 行 0 条（缺项 0、步骤号不连续 0）
python stats.py   -> 各模块 total / P0..P3 与文末统计表逐格相同；TOTAL 93 {'P0':4,'P1':18,'P2':11,'P3':60}
```

结论：**用例总数、ID 集合与顺序、优先级分布、合计、模块分列全部逐格一致**；无重复、无悬空 ID；93 个区块结构齐全、步骤编号连续。唯一偏差是 2 处**名称**文本截断（L-1）。

### 2. `TC-W4` 与 `TC-X5e5`（指令项②）

存在性：`TC-W4` 标题在 `:894`（汇总 `:84`）；`TC-X5e5` 标题在 `:1765`（汇总 `:145`）。二者均在统计表的「Workflow 管理（P3=1）」「跨页面联动（P3=41）」内计数，未见统计口径冲突。

**跨文档落地核对（逐条命中）**
- `TC-W4` 引用的 crud-03 §3.3 规则 18：`proposal-02-后端crud-03workflow管理.md:140` 存在且文字与用例一致（「出参来源必须有效…400 `VALIDATION_ERROR`」）；`proposal-01-界面设计.md:1352` 同名条一致。
- `tc_o2/tc_o2_01.yaml` 确有 `outputs: [{name: approved, ...}]`，用例前置「提供 `approved`」成立。
- `TC-W4` 的 `{valid:false}` 断言与 crud-03 3.3.6（`:339-353`）响应契约一致（**校验不通过属 200 成功响应**）。
- `TC-X5e5` 引用的 `crud-03 4.3.4`（死枝闭包，`:1294-1300` 第 ④ 步）与 `crud-05 3.5.8④`（`:400`）**均存在且同口径**。
- `TC-X5e5` 前置拓扑合法（Start→A、A→B(on_success)、A→Z(on_failure)、B→End、Z→End：规则 1/2/3/4/5/6/7/16 全部满足）。
- `TC-X5e5` 步骤 3「选『不更新版本』」有据：crud-03 3.3.4 `bumpVersion=false`（`:285/:291`）+ proposal-01「是否更新版本？」对话框（`:2220-2222`，默认不升版），故重试的「版本一致」前提成立。

**断言可判定性**
- 可判定 ✓：`TC-W4` 全部 4 步（`{valid:true/false}`、400 `VALIDATION_ERROR`、不落 `job_runs`、200 `{runId}`）。
- 可判定 ✓：`TC-X5e5` 的「Run 最终 `success`（不得永久 `running`）」「重试 Run 的 `step_records` 不含 Z」。
- **不可判定 ✗**：`TC-X5e5` 步骤 3 的「`run_edge_state` 中 `Z→End` 为 `dropped`、`B→End` 为 `activated`」→ 见 **S-1**。

**前置可构造性**
- `TC-X5e5` ✓（编辑器可建该拓扑，`tc_j2/op_always_fail.yaml` 可直接导入；唯一提醒缺失见 L-6）。
- `TC-W4` 步骤 1、步骤 2 **按字面不可构造** → 见 **G-1**。

### 3. `tc_r1/seed_terminal_states.sql`（指令项③）

**枚举合法性**
```
findstr /s /r /c:"condition: success" ...（全目录）-> 仅命中 _val4_05_global.md（上一轮报告正文），
   夹具与用例：0 处非法值
python anchors/enum 检查（sqlite）-> 三边 condition 全为 "on_success"；NOT IN ('on_success','on_failure','always') 命中 0
```
`edges[].condition` 非法枚举（`success`）**0 残留**；文件头亦注明取值域（`:15`）。

**引用行确实存在**（由同文件插入，实测可查）
```
ops    : 10000001 | op_prompt_review | prompt                     <- 存在
clients: f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1 | Claude Code | prompt   <- 存在
workflows: wfid-tc-r4-01 | wf_tc_r4_terminal | 3 edges
workflow_nodes: wnode-tc-r4-{start,op:a,op:b,end}（a/b 指向 10000001 + 该 client）
```

**sqlite3 实跑（schema + seed + 该文件）**
```
cd tests\fixtures\tc_r1
sqlite3 %TEMP%\val5\r7.db ".read schema.sql"               -> rc=0, stderr 空
sqlite3 %TEMP%\val5\r7.db ".read seed.sql"                 -> rc=0, stderr 空
sqlite3 %TEMP%\val5\r7.db ".read seed_terminal_states.sql" -> rc=0, stderr 空
行数：13 runs, 15 steps, 8 nodestate, 1 wf
        （= seed.sql 11/11 + 本文件 2 runs / 4 steps / 8 run_node_state / 1 workflow）
PRAGMA foreign_key_check -> 0 行（无违规）
重复执行本文件 -> rc=0，计数不变（2/4/8/1/4/1/1），幂等 ✓
```
**输出语句逐条可查**：`run-tc-r4-01`（`cancelled`/`terminated_by=cancelled`）、`run-tc-r4-02`（`running`/`terminated_by=NULL`）、steps（01a `cancelled`、01b `waiting`、02a `running`、02b `waiting`）、`run_node_state`（01 B/End=`skipped`，02 B/End=`pending`）均按用例文本返回。

列名与 `schema.sql` 一致（`job_runs`/`step_records`/`run_node_state`/`workflows`/`workflow_nodes`/`ops`/`clients` 全字段核对通过）；CHECK 域内（`triggered_by='single_workflow'`、`job_kind='virtual'`、`status` 枚举、`source='step'`、`run_node_state.status` 枚举）全部合法。

> 环境提示（L-8）：`.read` 传**含中文的绝对路径**在本机报 `cannot open`，且经 cmd 重定向时 `%errorlevel%` 仍为 0（假绿）。按文档写法（cwd=夹具目录 + 相对文件名）实测通过。

### 4. 全部 ZIP（指令项④）

```
python zips.py / anchors.py
tc_e2/tc_e2_loop.zip              4 成员  order=workflow.yaml,manifest.json,ops/<2>   MATCH 4/4
tc_j3/tc_j3_schedule.zip          3 成员  order=job.yaml,manifest.json,ops/<1>         MATCH 3/3
tc_x3/tc_x3_multi.zip             4 成员  order=workflow.yaml,manifest.json,ops/<2>   MATCH 4/4
tc_x4/tc_x4_manual_op.zip         3 成员  order=job.yaml,manifest.json,ops/<1>         MATCH 3/3
tc_x4/tc_x4_manual_workflow.zip   4 成员  order=job.yaml,manifest.json,workflows/<1>,ops/<1> MATCH 4/4
tc_x4/tc_x4_schedule_workflow.zip 4 成员  同上                                    MATCH 4/4
```
- 逐成员 **SHA256 与源目录 100% 相等**（22 个成员全 MATCH，0 DIFF）；**无源目录独有文件**（`src-only` 0 条）。
- **成员序与声明一致**：6/6 `member order declared==actual: True`（Workflow 包 = `workflow.yaml → manifest.json → ops/<manifest.ops 序>`；Job 包 = `job.yaml → manifest.json → [workflows/<target.file>] → ops/*`，与 tests `:22/:26/:30` 声明相同）。
- **manifest 名称锚逐项一致**：`manifest.workflow.name`。`manifest.job.name`。`manifest.target.name`（= `target.file` 内 `name`）。`manifest.ops[].name`（= 其 `file` 内 `name`）**全部 OK**；`target.file` / `ops[].file` 所指成员均存在。
- `manifest.clients[].clientId` 包内**不重复**（tc_e2 1 个、tc_x3 2 个互异、其余各 1 个）。
- container 元数据跨谱系差异属实且已在 tests `:22` 声明（`tc_e2`/`tc_x3` 为 `create_system=0 / external_attr=0` 的 Python zipfile 谱系，`tc_j3`/`tc_x4/*` 为 `create_system=3 / external_attr=2176188416`），与文档口径不矛盾。

### 5. `settings.<键>` 与夹具旧 `#n`（指令项⑤）

```
python scan_terms.py
  夹具内 `#\d+` 命中：0
  夹具内 `settings \`X\`` （旧反引号空格形）：0
  tests md 内 `settings\.[A-Za-z_]` ：0
  tests md 内 `settings \`X\`` ：0
```
- `settings.<键>` **0 残留**；现存写法全部为 crud-06 §一 的分组全路径：`general.poll_interval_ms`、`history.job_queue_running_max`、`history.job_queue_waiting_max`、`engine.max_loop_multiplier`、`runner.runner_poll_interval_ms`，与 crud-06 分组前缀（general/client/op/workflow/history/engine/worker/runner/scheduler/log）**逐个对得上**。
- tests 内 `settings` 仅余端点名 `/api/settings`、`/api/settings/reset`（6 处），符合预期。
- 夹具注释旧 `#n` **0 处**。

### 6. 用例 ↔ 夹具/规格一致性（抽查，指令项外补充）

- `TC-C2` 数据集 11 个 Client：文件名/名称/类型/描述与 `tc_c2_01..11.yaml` **逐条相同**；类型分布 prompt4/bash3/python2/powershell2 ✓；binaryPath 实测 `/usr/bin/bash`×2、`/bin/bash`、`/usr/bin/python3`×2、`...\pwsh.exe`×2，故用例第 4 步关键字命中数（`claude`2、`review`1、`deploy`2、`bash`3、`python`2、`pwsh`2、`zzz`0、`审查`0）**全部可复现** ✓。
- `TC-O2` 11 个 OP：名称/类型/描述与 `tc_o2_01..11.yaml` 一致，类型 4/3/2/2 ✓。
- `TC-W3`：`tc_w3_01..11.yaml` 逐个核对——**仅 `tc_w3_01` 含 `clientName: Claude Code`，02–11 均不含**，与 tests `:845` 声明完全相同 ✓；`opVersion=2` 者恰为 02/05/07（需更新 3 条），其余 8 条为 1（已同步）✓。
- `TC-J2`：数据集「需要更新 3（行 2/6/11）」「最近执行失败 3（行 4/8/10）」与 `tc_j2/seed.sql` 注入的 3 条 `failed`（`job_log_scan` 6m / `job_cleanup` 12m / `job_report` 24m，按 `jobs.name` 解析 `job_id`）**一致** ✓；关键字命中（`deploy`4、`review`6、`fail`3、`部署`2、`日志`1）按数据集交集复算全部成立 ✓。
- `TC-J3`：`tc_j3_schedule.zip` 内 `job.yaml` 七项字段（name / target OP v1 / workspace / inputs / cron `* * * * *` / concurrency skip / enabled true）与用例表 **逐项一致** ✓。
- `TC-R1`：`tc_r1/seed.sql` 11 行与数据集表 11 行**逐格相同**；由此推出的全部判定数复算通过——targetKind op6/wf5、jobKind virtual3/persistent8、triggeredBy 4/3/2/1/1、status 5/2/1/1/1/1、workspace 3/2/2/2/2、version 4/3/1、timeRange 3/7/8/9/10/10/10、组合 4/4/1 ✓。
- `TC-S1`：`tc_r1/seed.sql` 推出的 `activeRuns=1` ✓、工作区去重倒序 `ws-005(1m)→ws-004(5m)→ws-001(10m)→ws-002(30m)→ws-003(2h)` ✓、`limit=1/2` 期望值 ✓、`keyword=ws-004`/`ws-00` ✓；配置项上限断言（waiting 1000、running 1..10、age 180、workflow_max_nodes 1000、runner_poll 60000、max_loop_multiplier 0/1..10000）与 crud-06 §3.4「数值项上限」**逐项相符** ✓；`uptimeMs` 为 string、`activeRuns` 为 integer 与 crud-06 3.1 契约一致 ✓。
- `TC-R2a` 两个 Sheet 的列清单、文件名模板与 crud-05 §3.5（`:86-88`）**逐字相同** ✓。
- `TC-E4`：D10/D11/D12 在 proposal-01 `:2955-2957` 有定义且语义与用例一致 ✓；E4d 第 3 步「只校验内容 name、不校验文件名」与 `:1964` 声明一致 ✓。

---

## 严重

**S-1｜`TC-X5e5` 步骤 3 的 `run_edge_state` 断言不可判定（成功 Run 的检查点与事件均被物理删除）**

- 断言原文（`:1774`）：「`run_edge_state` 中 `Z→End` 为 `dropped`、`B→End` 为 `activated`」。
- 反证依据：
  - crud-03 §4.3「engine_events 数据生命周期」`:923`：**成功完成（`workflow_done`，job_run=success）→ 完成即物理删除该 run 的全部 `engine_events`；若启用可选 checkpoint 表 `run_edge_state` / `run_node_state`，一并删除**。
  - crud-03 4.3.4② 尾注 `:1302` 与 crud-05 3.5.8④ `:403`：该初值**仅作内存 `RunContext` 初值**，「`run_edge_state` 仍是**可选**快照，**不强制写入**」。
  - 该步骤的新 Run 终态被断言为 `success`，故断言时点该 run 的 `run_edge_state` 行为**空（已删）**，且表本身不保证被写入。
- 影响：用例核心目的（D6 死枝闭包不卡死）其实**已被其余两条断言覆盖**（终态 `success`、重试 Run `step_records` 不含 Z），但这条子断言无论如何执行都会「失败或无法观测」，属**假失败源**。
- 建议改法（二选一）：① **删去**该子断言，保留「终态 `success` + `step_records` 不含 Z」；② 若要留边状态证据，改为**运行中**（Run 尚未收敛时）经 `GET /api/runs/{runId}` 或 DB 读取，并明确「仅在启用可选 checkpoint 表时可断言」。

---

## 一般

**G-1｜`TC-W4` 步骤 1、步骤 2 按字面不可构造（与界面契约 G13 冲突）**

- 用例原文（`:901`）：「把该出参 `from.workflowNodeId` 改为一个**不存在的 id**（如 `wnode-not-exist`）」；（`:902`）：「把 `from` 改回 A、`outputName` 改为 `no_such_output`」。
- 反证依据：proposal-01 §10.9「Workflow 出参 `from` 录入（G13）」`:1142`：`from` 为**双下拉**——节点下拉**只列画布上的 op 节点**（Start/End 不候选），出参下拉**只随所选节点列出该 OP 定义的 `outputs[].name`**；并明写「**不要求用户输入 32 位 UUID**」。输出面板行 `:1094` 同述「from（下拉：节点 × 出参）」。
- 影响：负向①（节点不存在）与负向②（出参名不在 OP 出参中）**无法在界面上造出**，用例第 1、2 步不可执行（第 3、4 步可执行）。
- 可行替代构造（建议写入用例，二者均只需 UI 操作）：
  - 负向①：先建**合法**出参（A · `op_prompt_review` · `approved`）→ [保存] → **在画布上删除节点 A** → [保存]（`[保存]` 只跑 A 组规则，**B 组含规则 18 不跑**，见 proposal-01 `:1158` D2）→ [校验] → `{valid:false}`。
  - 负向②：把节点 A 改绑为**无 `approved` 出参**的 OP（如 `op_codex_lint`，其 `outputs` 不含 `approved`）→ [保存] → [校验] → `{valid:false}`。
- 断言本身可判定（`{valid:false}` / 400 / 200 `{runId}`），仅**构造路径**需改写。

**G-2｜夹具映射表与「数据复用」清单遗漏 4 项（跨文档引用不完整）**

- tests `:21`（fixtures 映射表）：「TC-R1 / R2a / R2b / R3 / R4」**未含 `TC-S1`**，而 `TC-S1` 前置第 1 步（`:1783`）与步骤 6（`:1795-1798`）**硬依赖 `tc_r1/seed.sql`**。
- tests `:32`（数据复用清单）漏列：
  - `tc_o2` 的复用方缺 **`TC-W4`**（`:899` 明确「导入 `tests/fixtures/tc_o2/tc_o2_01.yaml`」）；
  - `tc_r1/seed.sql` 的复用方缺 **`TC-S1`**（同上）；
  - `tc_j2/op_always_fail.yaml` 的复用方只写「TC-J2 / TC-X5b1」，缺 **X5e 全族**（`:1334`/`:1335` 映射表明确 e1a/e1b/e5 需「包内带该 OP」）；
  - `tc_j3_schedule.zip` 的复用方只写「TC-X4a1/b1」，缺 **X5a3/b3/c3/d3**（`:1328`/`:1330` 映射表）。
- 影响：不改变任何断言，但读者按 `:32` 清单准备数据会漏导入，尤以 `TC-W4`（需 `tc_o2/tc_o2_01.yaml`）与 `TC-S1`（需 `tc_r1/seed.sql`）为甚。

---

## 轻微

**L-1｜汇总列表名称与 `####` 标题不一致 2 处**（`:84` vs `:894`；`:145` vs `:1766`）。摘要名分别为「Workflow 出参来源校验（outputs[].from 无效）」「重试-菱形旁支死枝闭包（Run 不卡死）」，标题多出「→ 校验不通过 / 创建 Run 前 400」「，D6」。ID/优先级/计数完全一致，仅文本截断。

**L-2｜族引用未写区间**：`TC-X2`（`:105`、`1342`、`1429`、`1513`、`1599`）、`TC-E3`（`:1907`）在全库无此精确 ID。建议写 `TC-X2a~X2d` / `TC-E3a~E3e`。

**L-3｜「五条件」枚举内部不一致**：X5 通用口径 `:1321` 写「仅 `target=Workflow` 且满足五条件（版本一致、无 needsUpdate、存在失败/超时 step）」**只列 3 项**；而 `TC-X5e1a` 步骤 3 `:1687` 列 5 项（target=Workflow、版本一致、Job.needsUpdate=false、所引 Workflow 无 needsUpdate、存在失败/超时 step）。至 crud-05 3.5.9 `:456` 本身亦以「五条件」概括而未逐条编号，建议以 X5e1a 的 5 项统一，并在口径处补齐。

**L-4｜统计口径不齐（不影响合计）**：`### 6.1 重跑 / 重试 / 终止（X5 系列）`（41 例）并入「跨页面联动」行（53），未单列；而 `### 7 错误族矩阵`（13）、`### 8 导入校验`（4）均单列。若按「模块」理解可接受，但表头写「模块」而列名与 `###` 节标题混用，读者易错配。

**L-5｜`TC-W4` 断言缺固定期望子串**：`errors[]` 在 crud-03 3.3.6 `:351` 定义为 `string[]` 且**未规定文案**，用例 `:901`/`:902` 仅写「`errors[]` 指明…」。建议给出可机械比对的期望子串（或明确「仅断言 `valid=false`，不断言文案」）。

**L-6｜`TC-X5e5` 前置未提醒绑定 required 入参**：`op_prompt_review` 的 `inputs[0]`（`code`）为 `required: true`，规则 15「所有 required 入参必须有来源」在 `[校验]`/创建 Run 前执行；用例只说「A 引用可成功 OP（如 `op_prompt_review`）」，未提示需绑定 `code`（`tc_x3/workflow.yaml` 是以 `bindings: {code: {kind: literal, value: sample}}` 处理的）。同理 X5e1a 前置 `:1334`。

**L-7｜夹具注入语句静默失败**：`tc_j2/seed.sql` 三条 `INSERT … SELECT … WHERE j.name='…'`（依赖 `jobs` 行存在），若前置 Job 未建则**静默 0 行、无报错**；`tc_r1/seed_terminal_states.sql` 的 `DELETE … WHERE op_id=… OR name=…` 亦可能误删同名实体（该文件用法注释已提示勿在生产库执行）。建议两脚本末尾各加一条行数自检（如 `SELECT count(*)` 或 `CASE WHEN … THEN RAISE` 式断言），使机械门禁能判「注入是否真的发生」。

**L-8｜Windows 下 `.read` 的假绿陷阱**：实测 `sqlite3 db ".read F:/…/cli非交互式/schema.sql"` 报 `Error: cannot open`（非 ASCII 路径），而经 cmd 重定向链时 `%errorlevel%` 仍返回 0。建议：① 门禁**不只看 rc**，必须断言行数/关键行可查；② 文档统一写法为 `cd tests/fixtures/<夹具>` 后 `.read <相对文件名>`（本机实测 rc=0 且 stderr 为空）。

---

## 需拍板

**Q-1｜校验规则族覆盖缺口**：现全库仅**规则 18** 有对应用例（`TC-W4`）。crud-03 §3.3 的 A/B 组规则 9（op 节点绑 opId+opVersion）、10（`clientId` 非空）、11（`CLIENT_TYPE_MISMATCH`）、13（bindings 引用前置节点出参存在）、14（绑定必须指向前置节点）、15（required 必须有来源）、16（Start 禁 `on_failure` 出边）**无一有用例**。是否按 `TC-W4` 的模式（`[校验]` 200 `{valid:false}` + 创建 Run 前 400 + 回滚/不落库）补一组 P3？建议至少补 15 与 16（最易构造、最易误判）。

**Q-2｜导入「依赖复用 + warnings」无用例**：crud-03 3.3.9 `:524/:552`（同名 OP **复用现有、不覆盖**，包内版本与现有一致性差异回 `warnings`，并可能使导入对象 `needsUpdate=true`）是既有文档行为的可观测面，E4 族只覆盖名称锚 400，无覆盖复用语义。是否补一个 P3（导入前瞻性正向用例 + `warnings` 断言）。

**Q-3｜`TC-X5e5` 的 `run_edge_state` 子断言取舍**：删除（推荐，S-1 已给理由）还是改「运行中抓取」。若选后者，需同时确认其可判定性依赖「可选 checkpoint 表被启用」，且建议在用例中显式声明该前提。

---

## 修复顺序建议

1. **S-1**（`TC-X5e5` 步骤 3 删/改 `run_edge_state` 断言）——唯一「必然假失败」项，改动最小、收益最大。
2. **G-1**（`TC-W4` 步骤 1/2 改写为可构造路径：删节点 / 改绑无该出参的 OP），并把「保存不跑 B 组规则」写成显式前提。
3. **G-2**（补 `:21` 映射表的 `TC-S1`；补 `:32` 复用清单的 `TC-W4`、`TC-S1`、X5e 族、X5a3/b3/c3/d3）。
4. **L-6 + L-7**（前置补「绑定 required 入参」提示；两个 seed 脚本补行数自检），属「防下轮复现同类问题」的加固项。
5. **L-1 + L-2 + L-5**（名称对齐、族引用写区间、`errors[]` 期待子串）——口径与引用一致性。
6. **Q-1 + Q-2**（补规则族与导入复用用例）——需先拍板范围再动手。
7. **L-3 + L-4 + L-8**（五条件逐条对齐、统计口径说明、Windows `.read` 写法与门禁口径）。
