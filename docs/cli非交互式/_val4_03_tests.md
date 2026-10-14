# 独立校验报告（第 3 轮校验 · R2 修复复验 + 新问题挖掘 · 测试面 03）

范围：`docs/cli非交互式/tests/集成测试用例.md`（91 用例）、`docs/cli非交互式/tests/fixtures/**`（6 个 ZIP + 全部源目录，含新增 `tc_e2/`、`tc_e3/`、`tc_r1/seed_terminal_states.sql`）
只读参照：`_fix_v3_decisions.md`（唯一权威）、`_fix_v3_E_tests.md`、`_val3_03_tests.md`、`proposal-01/02`、`proposal-02-后端crud-01..06`、`schema.sql`
本轮方式：**只读审查**，仅写入本报告；所有脚本与 DB 落在 `%TEMP%\val4\`，未在被审目录落盘
报出：**严重 0 / 一般 2 / 轻微 9 / 需拍板 4**

---

## 统计

### 机械核对（方法与结果）

**工具**：Python 3.12.14（`utf-8-sig` 读取、统一 `\n`）、PyYAML 6.0.3、`sqlite3` 3.50.6（`C:\develop\MSYS64\mingw64\bin\sqlite3.exe`，实测该 CLI 无法打开含中文的路径，已把脚本复制到 `%TEMP%\val4\` 后 `.read`）。

| # | 核对项 | 方法 | 结果 |
|-|-|-|-|
| 1 | 用例条数 / ID 唯一 / 汇总↔详细 | `^####\s+(TC-\S+)` 取详细；`## 用例汇总列表`→`## 详细用例` 区间取 `^\|\s*TC-` 行；集合与顺序比对 | 详细 **91** / 汇总 **91** / 唯一 **91**；`only_in_detail=[]`、`only_in_summary=[]`、**无重复 ID**、**顺序完全一致**（`order_identical=True`） |
| 2 | 文末统计表逐格 | 按 ID 前缀归模块 + 逐用例实测 `- **优先级**`，与 `:1992-2003` 逐格比对 | **逐格一致**：Client 5(1/4/0/0)、OP 5(1/4/0/0)、Workflow 3(1/2/0/0)、Job 3(1/2/0/0)、运行历史 5(0/4/0/**1**)、跨页面联动 52(0/1/11/40)、配置/系统 1(0/1/0/0)、错误族矩阵 13(P3 13)、导入校验 4(P3 4)；**合计 91(4/18/11/58)**（4+18+11+58=91 ✔）。汇总列表优先级与详细用例**逐例 0 处不符** |
| 3 | 区块结构完整性 | 每 `#### TC-` 区块检查 `- **优先级**` / `- **用例目标**` / `- **前置条件**` / `- **执行步骤与预期结果**` | **91/91 齐全**；`TC-E1a` 前置标签的括注变体已收敛为 `- **前置条件**：`（`:1793`，见 R2 表 A · G-10） |
| 4 | 步骤编号连续性 | 区块内取最小缩进为顶层基线核 `1..n`，再按父步骤核 `x.1/x.2` | **顶层 91/91 无跳号无重号；子步骤全部 1..n 连续**（`STEP_NUMBER_BAD=0`） |
| 5 | 悬空 / 重复引用 | 全文 `TC-<id>` 集合 vs 详细 ID 集合；夹具路径存在性 | 非用例 ID 引用仅 `TC-X2`、`TC-E3`（族引用，可接受）；**零悬空单例引用**；无重复用例 ID |
| 6 | ZIP 逐成员 SHA256 vs 源目录 | 6 个 ZIP、**22 个成员**逐成员 SHA256 ↔ 源目录同路径文件（`tc_x4/*.zip` 按各自子目录映射），并反向查源文件遗漏 | **22/22 字节一致**；无缺成员、无多余成员、无源文件遗漏（`ALLMATCH=True` ×6） |
| 7 | ZIP 成员序 vs 声明序 | local file header 签名扫描序 + 中央目录序双查 | **6/6 与声明序一致**（见「夹具专项证据」）；两序**完全相等**（`EQUAL=True` ×6）。声明序：Workflow 包 `workflow.yaml → manifest.json → ops/<manifest.ops 序>`（crud-03 `:432`）；Job 包 `job.yaml → manifest.json → [workflows/<name>.yaml] → ops/<name>.yaml`（crud-04 `:415`） |
| 8 | manifest 名称锚一致性 | `manifest.workflow.name` / `manifest.job.name` / `manifest.target.name` / `manifest.ops[].name` ↔ 包内文件实际 `name` | **18 项锚全部一致，0 不符**（tc_e2、tc_x3、tc_j3、tc_x4×3） |
| 9 | 夹具可解析性 | PyYAML `safe_load` 全部 `*.yaml`；`json.loads` 全部 `*.json` | **YAML 52 个、JSON 6 个：解析失败 0** |
| 10 | 夹具可执行性（sqlite3 实跑） | `schema.sql` → `tc_r1/seed.sql` → `tc_r1/seed_terminal_states.sql`（`.read`，rc 与 `pragma foreign_key_check`）；重复执行幂等；TC-R4 第 4 步 UPDATE | 三脚本 **rc=0**、FK 检查**无违规**、**二次执行幂等**（计数不变 13/15/8/1/4）、`UPDATE ... status='cancelled', terminated_by='cancelled'` **rc=0** |
| 11 | 编码 / 行尾 | 逐文件字节统计 | `集成测试用例.md`：`bytes=169593`、**BOM 保留**、`CRLF=2003`、**`LF_only=0`**；**全部夹具（含新增 `tc_e2/**`、`tc_e3/**`、`seed_terminal_states.sql`）均为 LF**（一致，0 行 CRLF） |
| 12 | 交叉引用可解析 | 抽取 tests 内 `crud-0X <节号>` / `proposal-0X §节号`，逐一到目标文件核标题（含粗体小节标题） | 全部命中：crud-03 3.3.8/3.3.9/3.3/4.3.0、crud-04 3.4.5/3.4.6/3.4.9/3.4.10/4.5.2、crud-05 3.5.1/3.5/3.5.6/3.5.8/3.5.9/3.5.10/4.6、crud-06 一/3.4、crud-01 3.1.1/3.1.7、crud-02 3.2.1、proposal-01 §13.5/§14/§14.1/§14.2/§14.5/§15.3/§15.4/§15.7/§18.1.1、proposal-02 §10.1。**唯 1 处指向与实物不符**（`crud-06 一「数值项上限」`，见 M-1） |
| 13 | 旧措辞残留 | 逐串 grep | **tests 正文内 `#<数字>`=0**、`仍应唯一`=1（`:34`，见 M-2）、`manifest.target.name=bash-build`=0、`（或 tc_e2_loop.zip）`=0、`retry.on=failed`/`on_failed`/`max+1`/`min(3×3`=0。夹具侧残留 `#<数字>` **1 处**（`tc_j2/seed.sql:23`，见 M-3） |
| 14 | 新夹具与用例前置一致性 | 逐条读前置/断言 ↔ 夹具字段（含 sqlite 实查值） | `tc_e2/tc_e2_loop.zip` 拓扑 = TC-E2a/E2b/E2c/E2d 声明拓扑；`tc_e3/*` 与 E3 系列声明一致；`seed_terminal_states.sql` 实查值与 TC-R4 断言逐项一致（见下） |

### 夹具专项证据

```
ZIP（成员序：签名扫描序 == 中央目录序 == 声明序；逐成员 SHA256 ↔ 源目录）
tc_e2/tc_e2_loop.zip          4 workflow.yaml > manifest.json > ops/op_tc_e2_fail.yaml > ops/op_tc_e2_ok.yaml      ALLMATCH=True
    workflow.yaml=faf62316c056  manifest.json=d17a570bed94  op_tc_e2_fail=88f7df1fbab6  op_tc_e2_ok=8f96983d2d71
tc_x3/tc_x3_multi.zip         4 workflow.yaml > manifest.json > ops/op_prompt_review.yaml > ops/op_bash_build.yaml ALLMATCH=True
    workflow.yaml=29f58af61146  manifest.json=cfec955c70e2  op_prompt_review=80242920d9d8  op_bash_build=f52e1f2684a5
tc_j3/tc_j3_schedule.zip      3 job.yaml > manifest.json > ops/op_prompt_review.yaml                               ALLMATCH=True
tc_x4/tc_x4_schedule_workflow.zip 4 job.yaml > manifest.json > workflows/wf_deploy_prod.yaml > ops/op_prompt_review.yaml ALLMATCH=True
tc_x4/tc_x4_manual_op.zip     3 job.yaml > manifest.json > ops/op_prompt_review.yaml                               ALLMATCH=True
tc_x4/tc_x4_manual_workflow.zip 4 job.yaml > manifest.json > workflows/wf_deploy_prod.yaml > ops/op_prompt_review.yaml ALLMATCH=True
名称锚：tc_e2 workflow.name=wf_tc_e2_loop ✔ / ops 各 ✔；tc_x3 wf=wf_tc_x3_multi ✔ / ops 各 ✔；
        tc_j3 job=tc_j3_schedule ✔ target=op_prompt_review（file=ops/op_prompt_review.yaml）✔ ops[0] ✔；
        tc_x4×3 job ✔ / target=wf_deploy_prod|op_prompt_review ✔ / ops[0] ✔
容器元数据：tc_e2、tc_x3 → flag_bits=0、ExternalAttributes=0；tc_j3、tc_x4×3 → flag_bits=8、ExternalAttributes=0x81b60000（两谱系，见 :22 注解）
```

```
sqlite3 实跑（schema → seed.sql → seed_terminal_states.sql）
schema rc=0 ; seed.sql rc=0 ; seed_terminal_states.sql rc=0 ; pragma foreign_key_check 无输出（无违规）
seed.sql 后 job_runs 状态：cancelled,failed,failed,running,success,success,success,success,success,timeout,waiting（11 条）
TC-R4 实查（与 :1158-1163 断言逐项对齐）：
  run-tc-r4-01 | cancelled | terminated_by=cancelled | virtual | single_workflow | target=wf_tc_r4_terminal ✔
  run-tc-r4-02 | running   | terminated_by=NULL      | virtual | single_workflow | target=wf_tc_r4_terminal ✔
  run-tc-r4-01 steps：wnode-tc-r4-a=cancelled、wnode-tc-r4-b=waiting → 第 3 步「/steps 仍返回 2 条」可判 ✔
  run-tc-r4-02 steps：wnode-tc-r4-a=running、wnode-tc-r4-b=waiting ✔
  run_node_state：01 b/end=skipped、02 b/end=pending ✔（与「终态归未执行 / 非终态等待中」口径一致）
  workflows=1（wf_tc_r4_terminal v1）、workflow_nodes=4（start/op/op/end，edges 3 条）✔
  重跑脚本幂等：13/15/8/1/4 不变 ✔；第 4 步 UPDATE 后 run-tc-r4-02=cancelled ✔
tc_j2/seed.sql（补齐前置 jobs+ops 后）：3 条 failed job_runs + 3 条 step_records，重跑幂等 ✔
```

### 抽检「无问题」项（备案）

TC-R1/R2a/R2b 的 11 条数据集与筛选计数（与 `tc_r1/seed.sql` 逐行复算一致）；TC-S1 的 workspaces 顺序与 `limit`/`keyword` 取值（`:1757-1762`，与 seed 的 `MAX(created_at_ms)` 逐行相符，`ws-001` 去重 3→1）；TC-E2a/E2b/E2c/E2d 的 `max`/`max_loop_multiplier` 语义与 proposal-01 §15.2/§15.3/§15.4、crud-03 4.3.0 一致；TC-E3a/E3b/E3d 字段（`timedOut`/`timeoutMs`/`timeoutStepId`）与 schema.sql（`timed_out`/`timeout_ms`/`timeout_step_id`）与 crud-05 `:326` 一致；TC-E4a~E4d 的 message 取值与实物（`wf_tc_x3_multi`、`wf_tc_e2_loop`、`op_prompt_review`、`tc_j3_schedule`）逐一对齐，可直接判真；TC-R4 的节点文案（⚫ 已取消 / ⊘ 未执行 / 等待中 / 未到达🟡）与 proposal-01 `:1919-1939`、原型 `原型图/index.html:1473/1292/1304` 三态实现一致。

---

## R2 修复核对表

### A. 第 2 轮校验（`_val3_03_tests.md`）与 `_fix_v3_decisions.md` 所要求的测试面修复

| 项 | 要求 | 核对方法 | 结论 |
|-|-|-|-|
| **G-1** E1 映射表 `target=OP` 与 TC-E1b 冲突 | 按例分列 + 补 E1b 的 Workflow 构造 | 读 `:1785`、`:1811`、`:28` | **已解 ✔**。`:1785` 已分列：`E1a / E1c / E1d = Job [新建]（target=OP…）`；`E1b = Job [新建]（**target=Workflow**、concurrency=skip）`，并给 `Start → L → End`（L 引用 `tc_e3/op_tc_e3_longrun.yaml`、绑 `bash-build`）的构造与 `[保存]` 步骤；`:1811` 前置 ①②③ 与之逐字对齐；`:1815` 并补「只有 target=Workflow 的 Run 可终止」的反向说明。映射表与前置**不再矛盾** |
| **G-2** TC-E1a 第 1 步提交节奏 | 分批提交或提高上限 | 读 `:1798-1800` | **主体已修 ✔（但引入新缺口，见 G-1/G-2 本轮）**。`:1798` 改为「**分批提交 3 个**（避免 3 次提交落在同一轮询周期…）」；`:1799` 先提 1 个 → 等 ≥1 轮询周期 → 复核 `running=1 / waiting=0`；`:1800` 再连提 2 个（提交时 waiting=0、1 < 2）→ 复核 `running=1 / waiting=2`。提交节奏风险已闭合 |
| **G-3** E4a~d 汇总名 vs 详细标题 | 统一前缀 | 机械比对（第 1、2 行核对） | **已修 ✔**。`:1946/1957/1967/1977` 均为 `#### TC-Ex 导入校验-manifest.<锚> 名称锚不一致 → 400`，与 `:158-161` 逐字一致（`TITLE_MISMATCH=0`，91/91） |
| **G-4** §8 示例 `target.name` 用 Client 名 | 改中性锚 | 读 `:1940`、`:1963` + 跨文件 grep | **已修 ✔**。`:1940` 示例 = `名称锚不一致：manifest.target.name=op_renamed，ops/op_prompt_review.yaml 内 name=op_prompt_review`；`tests` 内 `manifest.target.name=bash-build`=0。**D11 四处已同步**：proposal-02 `:373`（`deploy_workflow`/`wf_deploy_prod` + 显式注「`bash-build` 属 Client 名，不作名称锚示例」）、crud-03 `:541`、crud-04 `:518`、tests `:1940` |
| **G-5** `#n` → 「数据集行 n」 | tests 内清除 | 全文 `#\d` grep | **已修（文档侧）✔ / 夹具侧残留 1 处**。`集成测试用例.md` 内 `#<数字>`=**0**（`:960/992/1007/1049/1051/1069/1073/1099/1100/1103/1110/1111/1114/1138/1139/1759` 均为「数据集行 n」）；**残留** `tc_j2/seed.sql:23`（见 M-3） |
| **G-6** D-1 `job_queue_running_max` 下限 | crud-06 补 1..10（他组）+ tests 引用 | 读 crud-06 `:78`/`:282-297` 与 tests 3 处 | **已修 ✔（引用指向有误，见 M-1）**。crud-06 `:78`「取值范围 **1..10**，默认 10」、`:297`「整数，**范围 `1..10`**（**下限 1**、上限 10…）」；tests `:1785/:1794/:1823`「**下限 1、上限 10**」，与规格一致 |
| **G-7** M-4 E3「立即失败 OP」来源 | 补现成夹具指引 | 读 `:1787`、`:1931` | **已修 ✔**。E3 映射行补「**E3e 第 2 步的「立即失败」对照 OP 复用现成夹具 `tc_j2/op_always_fail.yaml`**（bash，content `exit 1`；亦可用 `tc_e2/op_tc_e2_fail`）」；`:1931` 同步指路（夹具实物核：`type: bash`、content `exit 1`、`timeoutSeconds: 30` ✔） |
| **G-8** M-5 E1c `waiting` 竞态 | 调低 running 闸门 + 占位 | 读 `:1823` | **已修 ✔**。前置 ③ 写「调 `settings.job_queue_running_max=1`…并**先占住那唯一 running 名额**——另提交 1 个 long-run 任务，等 ≥1 轮询周期确认其已转 `running`；再 [运行] 本例 Job → 新 Run 因闸门已满**稳定停留 `waiting`**」并注明缺省值下会退化；④ 末步恢复 |
| **G-9** M-6 E1d 前置误引 | 收敛为「前置 1–2」 | 读 `:1835` | **已修 ✔**。「同 TC-E1a 环境…；构造步骤见 TC-E1a 前置 1–2，**不含** TC-E1a 前置 3 的终态 Run」；第 1 步并补「此时尚未提交任何任务且无终态 Run 干扰 → `activeRuns = 0`」 |
| **G-10** M-2/M-3/M-7/M-8、D-3、D-4、二.5、二.16 | 逐项落地 | 读 `:1781`、`:22`、`:1232`、`:1158-1163`、`:21`、`:91`、`:1998/2003` | **已修 ✔**：E1a 前置标签已收敛为 `- **前置条件**：`（`:1793`，说明移入正文 `:1794`）；`:22` 补「**容器元数据**」注（含两谱系）；`:1950` E4a 固定 `tc_x3_multi.zip` 并把 `tc_e2_loop.zip` 移入注（写明对应 message、注「勿混用」）；`:1232` D-4 改写为「**包内 `clientId` 不重复属夹具数据质量要求，导入不校验其存在/唯一**」（与 crud-03 `:485`、crud-04 `:459` 一致）；`:1158` TC-R4 + `seed_terminal_states.sql`；统计表 `:1998/2003` 与夹具表 `:21`、汇总 `:91` 已同步 |

### B. `_fix_v3_E_tests.md` 自检证据复核（★=与现状不符）

| 自检声明 | 复核结果 |
|-|-|
| 91/91 条、汇总↔详细 `mismatches: 0`、优先级逐格一致 | **成立 ✔**（第 1、2 行） |
| OLD 全部 = 0（含 `仍应唯一`、`（#9 running）`、`manifest.target.name=bash-build`、`（或 tc_e2_loop.zip）`、`导入-manifest`） | **★ 部分不成立**：`仍应唯一` 全文仍有 **1 处**（`:34`），见 M-2（该报告称「已随改写移除」，实际只改了 `:1232` 一处） |
| ZIP 6 包 / 22 成员 `ALLMATCH=True` ×6、成员序 6/6 | **成立 ✔**（第 6、7 行；成员序已用「签名扫描序 == 中央目录序」双向复核） |
| 名称锚逐项 ✔ | **成立 ✔**（第 8 行，18 项 0 不符） |
| sqlite3 实跑三脚本 OK、断言值与实查一致 | **成立 ✔**（第 10 行；本轮独立复跑，含幂等与 FK 检查） |
| NEW 到位（`job_queue_running_max=1`×11、`⊘ 未执行`×5、`TC-R4`×3、`seed_terminal_states.sql`×3、`容器元数据`×1 等） | **成立 ✔**（按出现次数口径复核：`⊘ 未执行` 出现 5 次 / 4 行；`job_queue_running_max=1` 9 行） |
| 行尾：文档 CRLF=2003 `LF-only=0`；新夹具 LF | **成立 ✔**（第 11 行） |
| 「`tests` 内 `settings.<键>` 保留」的未落地说明 | 见 M-7（v3 decisions 三 曾列该项，未落地需拍板确认） |

> 结论：第 2 轮报告的 G-1、G-3、G-4、G-6~G-10 与 D-1/D-3/D-4/二.5/二.16 **已真实落地**；G-2 主体落地但留下两处新的时序/构造缺口（本轮 G-1、G-2）；G-5 在夹具注释侧残留 1 处（M-3）；自检证据有 1 处与现状不符（M-2）。

---

## 严重

**无。** 未发现条数/优先级与统计表不符、步骤跳号、缺标题、ZIP 与源目录字节不一致、成员序偏离声明序、名称锚不符、悬空 `TC-` 引用、夹具不可解析/不可执行等硬缺陷——上述项经第 1–14 行机械核对全部通过。

---

## 一般

### G-1【新增】`TC-E1a` 前置 3 的「或按 `tc_r1/seed.sql` 注入」会使第 1 步的计数断言必失败（夹具与前置不可对应）

- 原文 `tests/集成测试用例.md:1796`：
  > `3. 预置 1 条**终态** Run（供第 3 步的 [重跑]/[重试] 入口）：执行一次短 OP 至终态即可（或按 `tc_r1/seed.sql` 注入）。`
- 同例断言（`tests/集成测试用例.md:1799`、`:1800`）：
  > `1.1 …→ 复核 `job_runs`：`running` 计 **1**、`waiting` 计 **0**…`
  > `1.2 …**再等待 ≥1 个轮询周期后复核** `job_runs` → `running` 计 **1**、`waiting` 计 **2** = `job_queue_waiting_max`…`
- 夹具实物（本轮 sqlite3 实查，`tc_r1/seed.sql` 注入后 `group_concat(status)`）：
  > `cancelled,failed,failed,running,success,success,success,success,success,timeout,waiting`
  → 其中 `run-tc-r1-09 = running`、`run-tc-r1-10 = waiting` **均为非终态**，且判定是**全局**计数（`SELECT count(*) FROM job_runs WHERE status='waiting'`，crud-04 `:328`/`:330`「全局、跨 Job」）。
- 问题：`seed.sql` 自带 **1 running + 1 waiting**，若按此备选执行，第 1.1 步会读到 `running=2 / waiting=1`、第 1.2 步会读到 `waiting=3`（提交时 `waiting` 已计 1→2，第 3 次提交直接 **409**），两条断言**必然失败**；且第 3 步的 [重跑]/[重试] 入口意义被 409 覆盖。该备选是同一轮新加的字样（`git diff` 该行为 `+`），与「夹具与前置必须一一对应」的口径冲突。
- 建议改法：删去括注，或改为显式排除：
  `3. 预置 1 条**终态** Run（供第 3 步的 [重跑] 入口）：执行一次短 OP 至终态即可。**勿用 `tc_r1/seed.sql` 充数**——其 11 条中含 `running`/`waiting` 各 1（非终态），会污染第 1 步的全局 `running`/`waiting` 计数。`

### G-2【新增】`TC-E1a` 第 5 步（cron 边界）要求在 cron 到点瞬间「waiting 已达上限」，但用例未给保持手段，断言不可稳定复现

- 原文 `tests/集成测试用例.md:1803`（第 4 步）与 `:1804`（第 5 步）：
  > `4. 等 `running` 的那个 long-run 自然结束（或把该 OP 的 `sleep` 临时改短后重跑本用例）→ 一个 `waiting` 被提升为 `running`（waiting 计数降至 1）→ 再运行 → 预期：200（未触顶）。`
  > `5. cron 边界：配置 schedule Job（**该 Job 自身无在途实例**）且当前 waiting 已达上限，等到点 → 预期：**不报错、无前端提示**，本轮跳过、**不创建 Run**…`
- 夹具/配置前提（`:1795`）：被测 OP 为 `op_tc_e3_longrun.yaml`（`timeoutSeconds=600`、content `sleep 60`）、并发闸门 `job_queue_running_max=1`。
- 问题：第 4 步结束后状态为 `running=1（某个 sleep 60 的 long-run）+ waiting=2`。此后 **≤60s 内该 running 必然结束**，`waiting` 会被提升一条 → `waiting=1 < job_queue_waiting_max=2`；而 cron 周期（`tc_j3`/`* * * * *`）是 60s 一次，等到点时 `waiting` 很可能已回落，cron 会**正常创建 Run**（200），与第 5 步「跳过、不创建 Run」相反。用例未要求「到点前重新补足 waiting=2」，属第 1 步同类时序缺口的**残余形态**。
- 建议改法（补一句即可）：第 5 步开头补
  `**到点前（≤1 个 cron 周期）先保持 waiting 满额**：再提交 long-run 任务把 waiting 补回 2（或先把该 OP 的 `sleep` 临时改为 300s 并重跑本用例），确认 `job_runs` 中 `waiting=2` 后等到点 → 预期…`

---

## 轻微

### M-1 `crud-06 一「数值项上限」` 的章节指向与实物不符（该表在 crud-06 **3.4**，不在「一」）

- 原文 `tests/集成测试用例.md:1785`（同形 `:1794`、`:1823`）：
  > `…`job_queue_running_max=1`（下限 1、上限 10，见 crud-06 一「数值项上限」）…`
- 实物：`「数值项上限」` 标签位于 `proposal-02-后端crud-06配置管理.md:282`，其所属批为 `:249 ### 3.4 PUT /api/settings —— 更新配置`；`crud-06 一`（`:60`）是配置项表（`:78` 已含 `1..10`，但无该标签）。tests 自身 `:1779` 引用的是 `crud-06 3.4 / 四`，与这三处不一致。
- 建议改法：三处统一改为 `见 crud-06 3.4「数值项上限」`（或 `见 crud-06 一（配置项表）与 3.4「数值项上限」`）。

### M-2 `:34` 残留「仍应唯一」，与改名后的 TC-X3 命名说明及 crud-03/04 的现行口径冲突（且 `_fix_v3_E_tests.md` 自检称该串已移除）

- 原文 `tests/集成测试用例.md:34`：
  > `…**不要求跨夹具唯一或一致**（同一包内 `manifest.clients[].clientId` 仍应唯一，见 TC-X3 命名说明）；导入/导出按 **name** 匹配，`id` 仅作导出快照。`
- 对端（本轮现状）`tests/集成测试用例.md:1232`：
  > `…**包内 `clientId` 不重复属夹具数据质量要求，导入不校验其存在/唯一**`
  `proposal-02-后端crud-03workflow管理.md:485`、`proposal-02-后端crud-04job管理.md:459`：
  > `**导入不校验本字段**：`clientId` 的**存在性与唯一性均不校验**`
- 问题：`:34` 的「仍应唯一」＋「见 TC-X3 命名说明」形成**反向引用**（被引处已改为「不校验」），读者会误以为导入侧校验唯一性（与该轮 D-4 拍板相反）。另 `_fix_v3_E_tests.md` 第 32/71 行称旧串 `仍应唯一` 已随改写移除，与现状不符（仅改了 `:1232` 一处）。
- 建议改法：`:34` 改为
  `（同一包内 `manifest.clients[].clientId` **宜不重复**——属**夹具数据质量要求，导入不校验其存在/唯一**，见 TC-X3 命名说明）`

### M-3 夹具注释仍用旧 `#n` 口径（`#4 / #8 / #10`），与 tests 正文已统一的「数据集行 n」不一致

- 原文 `tests/fixtures/tc_j2/seed.sql:23`：
  > `--   #4 job_log_scan (6m前) / #8 job_cleanup (12m前) / #10 job_report (24m前)`
- 对端（正文已改）`tests/集成测试用例.md:960`：
  > `确认数据集行 4 `job_log_scan`、数据集行 8 `job_cleanup`、数据集行 10 `job_report` 已创建后…`
- 问题：`_fix_v3_decisions.md` 二.5「`tests` 中的 `#n` 改为「数据集行 n」」；本轮只改了正文（正文 `#<数字>`=0），夹具注释残留 1 处，是**同一仓库内两种写法并存**。
- 建议改法：`:23` 改为 `--   数据集行 4 job_log_scan (6m前) / 数据集行 8 job_cleanup (12m前) / 数据集行 10 job_report (24m前)`。

### M-4 `TC-E3b` 前置举例的 `op_tc_e2_ok` 不在 E3 的数据来源映射内（按映射执行时该 OP 不存在）

- 原文 A（E3 映射行）`tests/集成测试用例.md:1787`：
  > `…导入 `tc_e3/op_tc_e3_timeout.yaml`（`timeoutSeconds=1`，content `sleep 5`）与 `tc_e3/op_tc_e3_longrun.yaml`；**E3e 第 2 步的「立即失败」对照 OP 复用现成夹具 `tc_j2/op_always_fail.yaml`**…`
- 原文 B（TC-E3b 前置）`:1898`：
  > `…B 节点引用任意可成功 OP（如 `op_tc_e2_ok`）。…`
- 问题：`op_tc_e2_ok` 只存在于 `tc_e2/tc_e2_loop.zip`（`:26`，由 E2 系列导入）；E3 映射行未要求导入该包，故仅按 E3 映射执行的测试者拿不到该 OP（可选的成功 OP 只有 `tc_e3/op_tc_e3_longrun.yaml`，或 `tc_o2/*`）。
- 建议改法：把示例改为映射内可得者，或注明来源，例如
  `B 节点引用任意可成功 OP（如 `tc_e3/op_tc_e3_longrun.yaml`；若已按 E2 导入 `tc_e2_loop.zip`，亦可用 `op_tc_e2_ok`）`

### M-5 `TC-E1a` 前置 3 只造「短 OP 终态 Run」，而第 3 步把 [重试] 列为待验入口——该 Run 不满足 [重试] 前提

- 原文 A `tests/集成测试用例.md:1796`：`3. 预置 1 条**终态** Run（供第 3 步的 [重跑]/[重试] 入口）：执行一次短 OP 至终态即可…`
- 原文 B `tests/集成测试用例.md:1802`：
  > `3. 再走单次执行 OP / 单次执行 Workflow / [重跑] / [重试] 任一入口 → 预期：同样 **409 `CONCURRENCY_CONFLICT`**…`
- 规格依据：`proposal-02-后端crud-05运行历史.md:387`（3.5.8）「**前提：target=Workflow**、版本一致、无 needsUpdate、存在失败/超时 step」。
- 问题：单 OP 的终态 Run（`target=op`）**不可能**满足 [重试] 前提，第 3 步的 `[重试]` 分支按前置无法执行（虽因「任一入口」措辞不致命，但「各入口统一 409」的覆盖度下降）。
- 建议改法：前置 3 改为 `…：**执行一次含失败 step 的 Workflow 至终态**（或执行一次短 OP 至终态），供第 3 步的 [重跑]；若要覆盖 [重试]，另用 `tc_r1/seed.sql` 的**终态 Workflow Run**（数据集行 2/8）作反例——**注意其含 `running`/`waiting` 记录会污染第 1 步计数，须在确认计数后单独用例执行**。`

### M-6 `TC-E4b` 第 2 步「只断言首个错误」无法区分 ① 与 ②（两者同为 400）

- 原文 `tests/集成测试用例.md:1964`：
  > `2. 与 `kind` 组合：同时把 `manifest.target.kind` 改为 `workflow`（而目标是 OP 定义）→ 预期仍为**首个命中的 400**（名称锚先于 `kind` 校验，D12；两处都改时只断言首个错误）。`
- 规格依据：crud-03 `:529`/crud-04 `:502` 的 D12 顺序为 ①「包解析与结构校验（ZIP 解析失败、**成员缺失**、…）」→ ② 名称锚 → ③ `kind`；① 与 ② 均返回 400。
- 问题：`target.kind=workflow` 后，实现若按 kind 解析成员路径，可能先命中 ①「成员缺失」（400），断言「仍为 400」成立但**不能证明**「名称锚先于 kind」。
- 建议改法：把断言落到 message，例如
  `→ 预期：**400 `VALIDATION_ERROR`**，且 `message` 为名称锚格式（`名称锚不一致：manifest.target.name=op_renamed，ops/op_prompt_review.yaml 内 name=op_prompt_review`），即②先于③命中；若返回成员缺失类 message，则改用「只改 `manifest.target.kind`、保持 target.name 与文件一致」的构造以隔离③。`

### M-7 `settings.<键>` 点号写法与现行术语口径不一致（同文档内另有 2 种写法）

- 原文（5 处，例）`tests/集成测试用例.md:1794`：
  > `**同时**调低并发闸门与 waiting 名额：`settings.job_queue_running_max=1`（…）与 `settings.job_queue_waiting_max=2`（上限 1000）。`
  （另见 `:1823`、`:1880`、`:1846`E2d 映射行列、`:1785` 映射行）
- 同文档其他写法：`:1147`「可修改 `general.poll_interval_ms`（默认 2000）」、`:1152`「**勿与后端 `runner.runner_poll_interval_ms` 混淆**」（`分组.键` 形态）。
- 现行口径：`proposal-02-后端crud-06配置管理.md:12`「**settings 表已废弃**…配置改为存储在**运行目录下的 `ai-automation.json`**」；`crud-05` 已把旧 `settings \`X\`` 全量改为「配置项 `X`（`ai-automation.json`）」（本轮 grep：crud-05 内 `settings`=**0**）。
- 说明：`_fix_v3_E_tests.md` 已把该项列为**未落地**并给出理由（「非 `_val3` 报告测试面项」）；但 `_fix_v3_decisions.md` 三 明确把「`crud-05`/`tests` 的 `settings` 术语」列入待修。
- 建议改法（择一，需拍板 D-1）：统一为 `配置项 `job_queue_running_max`（`ai-automation.json`）`，或全库统一采用 `分组.键` 形态。

### M-8 4 个 ZIP 使用 data descriptor（通用位 `0x08`），local header 内尺寸为 0——按 local header 顺序解析的校验脚本会假失败

- 实测（本轮）：`tc_j3/tc_j3_schedule.zip`、`tc_x4/*.zip`（3 个）`flag_bits={8}`、`ExternalAttributes=0x81b60000`；`tc_e2/tc_e2_loop.zip`、`tc_x3/tc_x3_multi.zip` `flag_bits={0}`、`ExternalAttributes=0`（`:22` 已注明两谱系，但只提「条目时间戳 / ExternalAttributes / 通用位标志」不要求跨谱系一致，未提「尺寸字段为 0」这一解析影响）。
- 影响：**成员内容/顺序均已复核一致**（第 6、7 行），不影响解包与导入；仅影响「按 local header 逐条流式解析」的自研校验脚本（我用签名扫描法复核，6/6 与中央目录序相等）。
- 建议改法：在 `:22` 的注中补半句「另：`tc_j3`/`tc_x4/*` 的成员尺寸写在 data descriptor（通用位 `0x08`），local header 尺寸字段为 0——校验脚本请用中央目录或签名扫描取成员序」；或统一用 Python `zipfile` 重打包为单一谱系。

### M-9 `seed_terminal_states.sql` 未建被引用的 OP / Client 行，详情页任何「节点→OP」解析路径会失败

- 原文（夹具实测）：`workflow_nodes` 两 op 节点 `op_id='10000001'`、`client_id='f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1'`；`step_records.op_name='op_prompt_review'`、`body_snapshot` 为空；库内 **无** `ops` 行与 `clients` 行。
- 影响：TC-R4 只断言画布着色与 `/steps` 返回条数（`:1160-1163`），**不影响其可判性**；但若测试者顺手点节点下钻（proposal-01 §12.6「点 OP 节点直接跳转 OP 执行详情」）或界面按 `op_id` 反查 OP，会出现「OP 不存在」的空态，易被误记为缺陷。
- 建议改法（低优先）：夹具补 2 行最小 `ops`（`op_id='10000001'`、`name='op_prompt_review'`、`body_snapshot` 非空）与 `clients`（`client_id='f6a7b8c9…'`、`type='prompt'`），或在 TC-R4 前置注明「本夹具仅用于画布着色与步骤条数校验，**不下钻节点**」（与既有 `tc_r1/seed.sql` 同问题，同一句话可覆盖两处）。

---

## 需拍板

| # | 待定问题 | 影响面 | 建议 |
|-|-|-|-|
| D-1 | tests 的 `settings.<键>` 点号写法是否统一为「配置项 `X`（`ai-automation.json`）」（M-7）：`_fix_v3_decisions.md` 三 列该项，`_fix_v3_E_tests.md` 以「非 `_val3` 报告项」保留 | 3~5 处文案与跨文件术语一致性（crud-05 已 0 残留） | 采纳统一（改 5 处）；若维持现状，请在 `_fix_v3_decisions.md` 三 回注「tests 例外的理由」以免下轮重复报出 |
| D-2 | 终态 Run 的 **End** 节点标签应为「⊘ 未执行」（`proposal-01:1926`）还是「未到达」（`:1939`）；TC-R4 `:1160/:1161` 采用「终态=⊘ 未执行 / 非终态=未到达」，与原型 `原型图/index.html:1292/1473` 一致 | 该判据是否会成为固化口径（后续 UI 回归） | 在 `proposal-01 §12.6` 补一句适用边界：「`未执行/跳过` 仅用于**终态** Run；非终态 Run 中无 StepRecord 的节点（含 End）显示 `未到达`」 |
| D-3 | `tc_e2`/`tc_x3`（Python `zipfile` 谱系）与 `tc_j3`/`tc_x4/*`（既有谱系）的容器元数据是否要求统一（M-8） | 校验脚本可移植性（现仅靠 `:22` 注规避） | 维持注解（成本最低）；若要求统一，须同时改 `crud-03:432`/`crud-04:415` 的「端到端可逐字节比对」措辞 |
| D-4 | 夹具**注释**内的旧 `#n`（`tc_j2/seed.sql:23`）是否属二.5 的清理范围（M-3） | 1 行注释 | 建议纳入（改为「数据集行 n」），并在该轮报告的自检 grep 中把 `tests/fixtures/**` 一并纳入 |

---

## 修复顺序建议

1. **G-1（`:1796` 的 seed 备选）**——一行改动即可消除「首步必失败」的构造陷阱，是本轮唯一会导致用例按书写直接失败的缺陷。
2. **G-2（`:1804` cron 边界保持 waiting 满额）**——补一句保持手段，闭合第 1 步同类缺口的残余形态。
3. **M-2 / M-3 / M-1**（措辞与引用：`仍应唯一` 反向引用、夹具注释 `#n`、`crud-06 一「数值项上限」` 指向）——纯文本、零依赖，可立即改。
4. **M-4 / M-5 / M-6**（数据来源补指与断言可判定性：`op_tc_e2_ok` 来源、[重试] 前提、E4b 首个错误可区分）——逐条小改。
5. **M-7 / M-8 / M-9**（术语统一、ZIP 解析说明、夹具最小 ops/clients 行）与 **D-1~D-4**——按归属方（BE / 协调者 / 本轮修复者）执行；D-1 若选择维持现状，须在权威文档回注理由。

> 备注：本轮**未发现**用例 ID 重复、条数/优先级与统计表不符（91/91 逐格一致）、区块结构缺失、步骤跳号、ZIP 与源目录字节不一致、成员序偏离声明序、manifest 名称锚不符、悬空 `TC-` 引用、夹具 YAML/JSON 不可解析或 SQL 不可执行等问题；新增 `tc_e2`/`tc_e3`/`seed_terminal_states.sql` 与 TC-E2*/E3*/R4 的前置、断言**逐项可对应**（除 G-1、M-4 两处来源指引）。所有命令与结果见「统计」与「夹具专项证据」。
