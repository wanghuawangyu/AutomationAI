# 独立校验报告（第 2 轮 · 测试面 03）—— `tests/集成测试用例.md` + `tests/fixtures/**`

- 范围：`docs/cli非交互式/tests/集成测试用例.md`（86 用例）、`docs/cli非交互式/tests/fixtures/**`（5 个 ZIP + 源目录）
- 只读参照：`proposal-01-界面设计.md`、`proposal-02-*.md`、`schema.sql`、`原型图/mock-data.js`
- 本轮方式：只读审查，只写入本报告；未修改任何被审文件
- 报出：**严重 3 / 一般 8 / 轻微 11 / 需拍板 6**

---

## 统计

### 机械核对（方法与结果）

**方法**：Python 3.12（`utf-8-sig` 读取、统一换行为 `\n`）逐项静态核对；ZIP 用 `zipfile` 枚举成员并逐成员 SHA256 与源目录文件比对。脚本置于审计目录之外（`%TEMP%`），未在审计范围内落盘。

| # | 核对项 | 方法 | 结果 |
|-|-|-|-|
| 1 | 用例条数 / ID 唯一性 | 正则 `^####\s+(TC-\S+)` 取详细用例；`^\| TC-` 且第 3 列 ∈ P0..P3 取汇总列表行；集合比对 | 详细用例 **86**、汇总列表 **86**、唯一 ID **86**；两处集合与顺序**完全一致**；**无重复 ID**、**无 ID 只在一处出现** |
| 2 | 文末统计表逐格 | 按 ID 前缀归模块、按详细用例的 `**优先级**` 实测分布，与 1895-1903 行逐格比对（含合计） | **逐格一致**：Client 5/1/4/0/0；OP 5/1/4/0/0；Workflow 3/1/2/0/0；Job 3/1/2/0/0；运行历史 4/0/4/0/0；配置系统 1/0/1/0/0；错误族矩阵 13/0/0/0/13；跨页面联动 52/0/1/11/40；**合计 86/4/18/11/53**（4+18+11+53=86 ✔）。汇总列表优先级与详细用例优先级**无一处不符** |
| 3 | 结构完整性 | 每段落区块检查 标题 / `**优先级**` / `**用例目标**` / `**前置条件` / `**执行步骤与预期结果**` | 86/86 四项齐全；**无缺标题**；7 处前置标签为变体（394/637/712/800/937/1001/1031 写作「前置条件（准备步骤…）」等，语义等价、标签不统一） |
| 4 | 步骤编号 | 区块内最小缩进为顶层基线，核对顶层 1..n 连续；再按父步骤核对子编号 x.1/x.2 连续 | **顶层 86/86 无跳号、无重号**；**子步骤无跳号**；缩进全篇一致（无混用） |
| 5 | 悬空引用 | 全文 `TC-<id>` 与详细用例 ID 集合比对 | 唯一非用例 ID 引用为 `TC-X2`（5 处族引用，可接受）与夹具表 `TC-R2`（见轻微 1） |
| 6 | ZIP 夹具逐字节 | 5 个 ZIP 共 **18** 个成员，逐成员 SHA256 vs 源目录同名文件；反向检查源文件是否漏装 | **18/18 字节一致（SHA256 相同）**；无缺成员、无多余成员、无源文件遗漏 |
| 7 | 「包内自包含」声明（29 行） | SHA256 比对 `ops/op_prompt_review.yaml`↔`tc_o2/tc_o2_01.yaml`（5 个包）、`ops/op_bash_build.yaml`↔`tc_o2/tc_o2_05.yaml`、`workflows/wf_deploy_prod.yaml`↔`tc_w3/tc_w3_01.yaml`（2 个包） | 8/8 **完全相同** → 声明成立，非冗余属事实 |
| 8 | manifest 名称锚（新约定） | 比对 `manifest.job.name`/`manifest.workflow.name` ↔ `job.yaml`/`workflow.yaml` 实际 `name`；`manifest.target.name` ↔ `target.file` 指向文件的实际 `name`；`manifest.ops[].name` ↔ file 实际 `name` | 3 个包共 **11 个名称锚全部一致**，0 不符 → 满足 crud-04 3.4.10 #8 / crud-03 3.3.9 #6 的 400 校验前提 |
| 9 | clientId 冲突 | 全夹具 + `mock-data.js` | 仅 2 值：`a1b2c3d4e5f60718293a4b5c6d7e8f90`=Claude Code、`f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1`=bash-build；无一值多名 / 一名多值；与 mock 的 5 个 clientId 无冲突（`a1b2…` 同值同义，属预期） |
| 10 | opId / workflowId / nodeId 冲突 | 同上 | `workflowId f0e1d2c3…d2c3` 在 tc_x4 两个 Job 中同值（同一 `wf_deploy_prod`）✔；`tc_w3_01` 与 tc_x4 包内 `wf_deploy_prod.yaml` 同用 `0101…` 节点序 ✔；`tc_x3` 用 `d0d0…` ✔。**opId 见轻微 4** |
| 11 | §7 断言对规格 | 错误码总表（`proposal-02-后端设计.md` 327-356）、crud-04 3.4.5/3.4.6/4.5、crud-05 3.5.6/3.5.7/3.5.9、crud-06、proposal-01 §14/§15 | 错误码 / 状态码 / 状态枚举 / 默认值 / 上限**全部一致**（详见下） |

**§7 专项核对结论（对应任务书点名的疑点）**

- **错误码**：`CONCURRENCY_CONFLICT`(409)、`JOB_HAS_ACTIVE_RUNS`(409)、`RUN_NOT_TERMINABLE`(409)、`RERUN_NOT_ALLOWED`(409)、`TARGET_NOT_FOUND`(404)、`VALIDATION_ERROR`(400) 与错误码总表 + 各 crud 章节**逐条一致**，无错码、无错状态码。
- **默认值 / 上限**：`job_queue_waiting_max` 默认 20 / 上限 1000（1757、1764、1798）、`max_loop_multiplier` 0 或 1..10000（1836）、worker 派生 `ceil(running_max×1.5)=15`（1733）与 crud-06 一致。
- **`min(max×3, max_loop_multiplier)` 语义**：公式、截断取小、`0`=不限制与 proposal-01 §15.2 / crud-03 4.3.0 ① 一致；**但「每轮几次」与 crud-03 4.3.2 冲突（严重 1）**。
- **「超时是否属可重试 step」**：`can-retry=true`（E3d）与「超时非 `on_failed`」（E3c/E3e）**不矛盾**——crud-03 4.3.2 明确 timeout 不走自动重试判定，crud-05 3.5.9/4.8 明确 timeout 属**手动**重试前提；E3d 第 3 步已把两者区分开。结论：口径正确，仅自动重试的枚举名写错（一般 3）。
- **`bash-build` 命名说明（1210）**：**属实**——原值 `b2c3d4e5f60718293a4b5c6d7e8f90a1` 确为 `原型图/mock-data.js:118` 中 **Codex CLI** 的 clientId；新值 `f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1` 为合法 32 位 hex，且在全部夹具 + mock 中唯一。
- **`tc_x3/manifest.json` clientId 变更**：文件内确为 `f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1` ✔，与 `tc_c2_05.yaml` 的 `bash-build`（bash 类型）类型自洽 ✔。

### 抽检为「无问题」的重点项（不做修改建议，仅备案）

TC-C2（各关键字/ chip 计数逐个复算 7 项命中正确）、TC-O2（8 关键字 + 数据集逐行核对）、TC-W3（11 条数据集 vs 实际 YAML 的 `opVersion`、`clientName` 只有 `tc_w3_01` 带；需更新 3 = 02/05/07 ✔）、TC-J2（11 条数据集 + 6 关键字 + 4.1 组合全部复算正确）、TC-R1（11 条 seed 与数据集逐行一致；21 项单维筛选、7 档 timeRange、3 项组合全部复算正确）、TC-R2a/R2b（文件名与两 Sheet 列与 crud-05 3.5.10 逐字一致）、TC-S1（JSON 分组键 general/client/op/workflow/history/engine/worker/runner/scheduler/log 与 crud-06 3.3 完全一致）。

---

## 严重

### S1 `TC-E2a` 的 step_records 序列与 crud-03 4.3.2、与本轮同节 `TC-E3e` 三方冲突

- `tests/集成测试用例.md:1807`：「step_records 中 A 共 9 条记录（`(activationSeq, retrySeq)` 序列：**activation1 retry1..retry3 → activation2 retry1..retry3 → activation3 retry1..retry3**，按 §15.2 每次失败走 C→A 回跳 + activation、retry 重试 + retrySeq）」
- `tests/集成测试用例.md:1886`：「若 A 改为立即失败（exit 1）→ 触发自动重试（**retrySeq 1→2→3→4，共 max+1 次尝试**后走失败边/终止）」
- 问题：crud-03 4.3.2（`proposal-02-后端crud-03workflow管理.md:1070`）的判定式为「**本 activation 的尝试已达 max（同 `(run,step,activation_seq)` 记录数−1 >= max）→ 不重试, 走边**」，配合 4.3.0 ①（`:691`「重试计数 = 记录数 − 1」）与 §15.2「max = **每轮重试次数**」⇒ `max=3` 时**每 activation 4 次尝试**。故 E2a 的 3+3+3 序列与 crud-03 矛盾，也与同一新章节 E3e 的 `max+1` 自相矛盾；总数 9 虽对，但序列错，第 2/4 步的「记录数与序列」断言不可判定。
- 建议改法：把 1807 改为「activation1 retry1..retry4 → activation2 retry1..retry4 → **activation3 retry1**（第 9 次达总上限）」并补 C 的执行次数（=1 或 2，取决于上限判定时机，需与 D1 的定案一致）；同时把 1803 的用例目标、1806 的预期改为「**执行总次数上限** 9（≠ 3 轮等分）」。

### S2 `TC-E2c` 前置与预期不可兼得，场景构造不出来

- `tests/集成测试用例.md:1824`：「构造 §15.4 拓扑：`Start → A(on=success 回跳) → End`；**A 恒成功**、`retry.max=3`」
- `tests/集成测试用例.md:1826`：「1. [运行] → 预期：**A 成功执行 9 次**（上限 3×3=9）后 Run `failed`」
- 问题：proposal-01 §15.4/§15.5（`:2305-2325`）明确 on=success 语义为「A 必须**连续成功 N 次**才走 🟢 到 End」「提前停止 = **失败即停止**」。A 恒成功 ⇒ 满足连续成功后**直接走成功边、Run success**，既不会累计到 9 次也不会 failed。同时前置把 §15.4 的「A→C(on_failure)→C→A(always) 回跳环」写成了单节点 `Start → A → End`，**回跳环缺失**，无法制造循环。
- 建议改法：前置改为「按 §15.4 完整拓扑（A 节点 `retry.on=success`、A→C 为 `on_failure`、C→A 为 `always`）；A 交替成功/失败（如前 2 次成功、第 3 次失败）」；预期改为「A 执行总次数达上限 9 后 Run `failed`」，删去「成功执行 9 次」的说法。

### S3 `TC-X5b3`~`TC-X5b8` 六例断言无条件 `status=success`，与同例前置「构造…执行失败」矛盾

- 断言原文（同形 6 处）：`tests/集成测试用例.md:1412`、`:1423`、`:1434`、`:1445`、`:1456`、`:1467`：「→ 预期：运行历史新增记录，**status=success**」
- 对应前置（同形 6 处）：`tests/集成测试用例.md:1407`、`:1418`、`:1429`、`:1440`、`:1451`、`:1462`：「参考 TC-X4a1 **构造 Target=OP 的 Cron Job，执行失败**」（及「定时 OP Job 自动执行失败」「手动 OP Job，执行失败」等）
- 问题：目标恒失败时 [重跑] 仍会失败，断言 `status=success` 无法满足；同族 `TC-X5b1:1392`（「修复后 `status=success`，未修复仍 `failed`」）与 `TC-X5b2:1401`（「最终 status 与修复情况一致」）已给出正确条件式口径，六例与之不一致。
- 建议改法：统一改为「**修复目标后** [重跑] → `success`；**未修复** → 仍 `failed`」，或在前置中明确写入「先修复目标（如替换成功 OP / 更新 Workflow 引用）」。

---

## 一般

### G1 §7 整节（13 例）无夹具、无数据来源映射，多数前置依赖手工构造

- 位置：`tests/集成测试用例.md:1753-1887` 全部 13 例的 `**前置条件**`
- 原文举例：`:1804`「构造 proposal-01 §15.3 拓扑：`Start → A(on=failure 回跳 C → always → A) → End`」；`:1843`「OP `timeoutSeconds=1`，content 为 `sleep 5`（bash 类型）」；`:1770`「`concurrency=skip` 的 Job（target=workflow，long-run 节点）」
- 问题：文首夹具表（`:14-25`）**无任何 TC-E\* 条目**，§7 也没有 X5 那样的「变体 → 数据来源映射」表（`:1285-1296`）；E2a-E2d 需回跳拓扑（含 C 节点）、E3a-E3e 需专用超时 OP、E1a-E1c 需 long-run OP + queue/parallel/skip 三种 Job——全部无现成夹具，且未给出构造步骤，与「可直接执行」的口径断裂。
- 建议改法：新增 `tc_e2_loop.zip`（§15.3/§15.4 回跳拓扑，带 `ops/`）、`tc_e3_timeout.yaml`（`timeoutSeconds=1` + `sleep 5`）、`tc_e1_concurrency.sql`（含 long-run 场景）三件夹具；在 `### 7.` 前补一张「E 系列数据来源映射」表，并把夹具表补上 TC-E\* 行。

### G2 `TC-E1a` 第 1 步的 `waiting` 计数不可判定

- `tests/集成测试用例.md:1759`：「1. 先后 [运行] 2 个 long-run 任务（如 Job-A queue、单次执行 OP-B）→ 预期：各返回 `{runId}`，**`job_runs` 中 `status='waiting'` 计 2 = waiting_max**」
- 问题：crud-04 4.6 / crud-06（`:92-97`）规定 `waiting → running` 由 Task Runner 轮询推进，闸门为 `job_queue_running_max`（默认 10）；默认下第 1 个任务在第 2 个提交前极可能已转 `running`，`waiting` 计数不保证为 2；前置也未固定该闸门。
- 建议改法：前置补「`job_queue_running_max=1`」（并写入第 6 步的恢复清单），或把断言改为「`waiting` + `running` 合计 = 2」，或改成「先占满 running 闸门 → 再验证 waiting 触顶」的确定性写法。

### G3 `retry.on` 枚举值写成 `failed`（规格枚举为 `failure`）

- 原文：`tests/集成测试用例.md:152`「超时 ≠ `on_failed`：配置 `retry.on=failed` 的节点超时不自动重试」（汇总行）；`:1867`「`retry.on=failed` 配置**不**对超时生效」；`:1877`「对照：`retry.on=failed` 的自动重试对超时**不触发**」；`:1882`「验证「超时不属于 `on_failed`」——配置 `retry.on=failed`」；`:1883`「节点 `retry={on:failed, max:3}`」
- 问题：crud-03 `:88-90` 与 `schema.sql:110` 的枚举为 **`failure` / `success`**（`on_failure` 是**边** condition）；`failed` 是不存在的取值。同文档 `TC-W1:751` 已正确写作 `on=failure`。
- 建议改法：五处统一改为 `retry.on=failure`；标题与描述里的「`on_failed`」改为「`retry.on=failure`（节点自动重试）」，与 crud-03 枚举、TC-W1 写法对齐。

### G4 把 `timeoutSeconds` 写成 WorkflowNode 级字段（规格明确 WorkflowNode 无此字段）

- 原文：`tests/集成测试用例.md:1853`「Workflow `Start → A(timeoutSeconds=1, sleep 5) → B → End`（A 超时后 B 不应执行）」；`:1863`「A `timeoutSeconds=1`、content 长运行（超时而非失败）」；`:1883`「Workflow 单节点 A（`timeoutSeconds=1`、长运行）」
- 问题：proposal-01 §14.1（`:2190-2197`）明确「超时只属于 OP」并列出 `Workflow ❌ / WorkflowNode ❌`；按现文构造会误导实现者新增节点级字段。
- 建议改法：三处改写为「A 节点**引用的 OP**：`timeoutSeconds=1`、content=`sleep 5`」，并说明该 OP 为新建 OP（与 G1 的夹具缺口一并解决）。

### G5 `TC-E2d` 的「0=不限制」与自身第 3 步、及 crud-03 4.3.0 冲突

- 原文：`tests/集成测试用例.md:147`（汇总行）「`0`=不限制（超时兜底）」；`:1837`（第 3 步）「设 `max_loop_multiplier=0`（默认）→ [运行] → 预期：不限制（**按 `max×3=9` 触顶失败**）；若配超时则由超时兜底终止」
- 问题：crud-03 `:694` 定为「未配置（0）时上限即 `max × 3`」；crud-06 `:80`/`:291` 的「0=不限制」只针对**数值上限规则**（0 不受 10000 约束）。汇总行省略「仍受 `max×3` 约束」，与同例第 3 步自相矛盾，且「不限制」易被读成无限循环。
- 建议改法：两处统一为「`0` = **不施加绝对上限，仍受 `max×3` 约束（=9）**；若 OP 配 `timeoutSeconds` 则超时先行终止」，并在 crud-06 该行加同注。

### G6 `TC-X5e1a`/`TC-X5e1b` 的数据来源映射不成立

- 原文：`tests/集成测试用例.md:1296`「| e1a/e1b | Workflow 失败重试 | 复用 `tc_x3/workflow.yaml` 骨架（`wf_tc_x3_multi`），按 **TC-X5e1a 前置条件** 将节点 B 的 op 改为必定失败（`tc_j2/op_always_fail`）后打包导入 |」
- 对照：`tests/集成测试用例.md:1642`「参考 TC-X3 构造 Workflow：`A(成功)→B(必定失败)→C`」；`:1657`「从失败节点 B 开始、使用最新版本；**B 成功后 C 继续**」
- 问题：`tc_x3/workflow.yaml` 骨架只有 `node_review` / `node_build` **两个** op 节点，既无 A/B/C 命名，**也没有 C 节点**；用该骨架构造不出 `A→B→C` 及「C 未执行 / B 成功后 C 继续」的断言。
- 建议改法：把 1296 改为「新建 3 个 op 节点的 Workflow（A→B→C），B 引用 `tc_j2/op_always_fail.yaml`，随包内带 `ops/` 打包导入」，或直接提供 `tc_x5e1` 夹具 ZIP 并在夹具表登记。

### G7 缺必要用例：新约定「名称锚不一致 → 400」无任何覆盖

- 规格：crud-03 `:474`「**名称锚一致性校验（#6）**：`manifest.workflow.name` 与根级 `workflow.yaml` 实际 `name` 不一致 → **400 `VALIDATION_ERROR`**（`message` 指明位置），**不静默以文件内容为准**」；crud-04 `:489`/`:508` 对 `manifest.target.name` ↔ 包内文件 `name` 同口径
- 现状：`TC-W2`（`:759-798`）与 `TC-J1`（`:884-935`）只校验正向保真（`TC-J1:920-921` 仅「名称/版本齐全」），无负向用例；而 `validation.md` 遗留 #3 记载旧口径为「以文件内容为准（待追认）」，现已改为 400，属口径反转，必须有回归用例。
- 建议改法：在 `TC-W2` 第 5 步与 `TC-J1` 第 7 步各补一条子步骤：「把 `manifest.workflow.name` / `manifest.target.name` 改为与包内文件 `name` 不一致后 [导入] → 预期 **400 `VALIDATION_ERROR`**（message 指明不一致位置）、**整体回滚**（不产生半成品）」；并在夹具表注明该负向包可临时改写生成。

### G8 `TC-S1` 前置无夹具可依，且第 6 步排序断言不可判定

- `tests/集成测试用例.md:1729`：「**前置条件**：全新运行目录（`-c {run}`）；**已创建 ≥3 条 `job_runs`，覆盖 ≥2 个不同工作区（其中两条 workspace 相同，且该工作区最近使用）**；无需界面造数。」
- `tests/集成测试用例.md:1741`：「…按各工作区**最近一次运行时间倒序**（`ORDER BY MAX(created_at_ms) DESC`）」
- 问题：`job_runs` 是执行产物（前端无法新建），但该例未指向任何注入脚本（夹具表 `:14-25` 也无 TC-S1 行）；且「≥2 个工作区」无具体值，第 6/6.1 步的倒序与 `limit` 断言无法判定。
- 建议改法：前置直接引用 `docs/cli非交互式/tests/fixtures/tc_r1/seed.sql`（其中 ws-001 有 3 条且含最近使用），并把期望写实——按该 seed 的相对时刻，`ORDER BY MAX(created_at_ms) DESC` 为 **ws-005(1m) → ws-004(5m) → ws-001(10m) → ws-002(30m) → ws-003(2h)**，故 `?limit=1` 应返回 `["/path/ws-005"]`、`?limit=2` 返回 `ws-005, ws-004`；同时把 `limit` 默认 10 的断言改为「≥5 条 seed 工作区全量返回」。

---

## 轻微

1. **夹具表用例 ID 写法与详细用例不符**：`tests/集成测试用例.md:21`「| **TC-R1 / R2 / R3** | `tests/fixtures/tc_r1/` |」——`TC-R2` 不是用例 ID（实际为 `TC-R2a`/`TC-R2b`，29 行自己写作「TC-R1/R2a/R2b/R3」）。建议改为四 ID 全列。
2. **缺章节标题 / 章节与统计表模块不对应**：`tests/集成测试用例.md:1283-1296` 是 X5 系列（40 例）的通用口径 + 映射表（块引用），但 `:1274`（TC-X4c2）与 `:1298`（TC-X5a1）之间**没有任何标题**；`:1725` 的 `TC-S1` 挂在 `### 6. 跨页面联动` 末尾（`---` 之后），而统计表 `:1900` 却给它单列「配置 / 系统」。建议补 `### 6.x 重跑 / 重试 / 终止（X5 系列）` 与 `### 6.y 配置与系统（TC-S1）`（或把 TC-S1 提为 `### 8.`），使章节与统计表模块一一对应。
3. **统计表行序与正文顺序不一致**：`:1901` 错误族矩阵排在 `:1902` 跨页面联动之前，正文却是第 6 章在前、第 7 章在后。建议按正文顺序排列行序。
4. **opId 快照唯一性口径未贯彻**（对照 `:1210` 已对 clientId 定案「仍应唯一」）：`tc_j3/job.yaml` 的 `target.opId: 10000000000000000000000000000001` 与 `原型图/mock-data.js:187` 中 **check_tests** 的 opId 同值，而该包引用的是 `op_prompt_review`；`tc_x4/manual_op/job.yaml` 的 `target.opId: a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4` 又对同一 OP 名取不同值。建议统一为「每个 OP 名固定一个占位 opId」，或明确声明 opId 快照不要求唯一/一致（并写入夹具说明）。
5. **汇总列表与详细用例标题文本不一致**：`:140` vs `:1753`（TC-E1a 缺「（queue/parallel 入口）」）、`:144` vs `:1800`（`max=3` vs `retry.max=3`）、`:147` vs `:1829`（缺「与 0=不限制」）。无实质影响，建议对齐。
6. **`uptimeMs` 断言不可判定**：`tests/集成测试用例.md:1731`「`uptimeMs` 为**毫秒时间戳字符串**」——crud-06 3.1 字段表同句自相矛盾（「进程已运行**时长**（毫秒时间戳）」）。建议写实为「`uptimeMs` = 进程已运行毫秒数，两次调用差值 ≈ 间隔（单调不减）」。
7. **`TC-E1a` 前置准备 3 个 OP 但步骤只用 2 个**：`:1757`「准备 3 个可 long-run 的 OP（如 sleep 60）」vs `:1759` 只用「Job-A queue、单次执行 OP-B」。建议改为 2 个或说明第 3 个用途。
8. **`TC-E1a` 第 3 步在同一流程中不完全可执行**：`:1761`「再单次执行 OP / Workflow / **[重跑] / [重试]** 任一入口」——前两步只产生 `waiting`，无终态 Run 就没有 [重跑]/[重试] 入口。建议前置补「预置一个终态 Run（可用 `tc_r1/seed.sql`）」，或把该步拆为独立子用例。
9. **终止语义术语不统一**：`:1596`「Job 状态变为 cancelled」、`:1616`「Workflow 状态变为 cancelled」、`:1636`「Job 状态变为 cancelled」与 X5d1/X5d2 的「Run 状态 / `cancelled`」不一致；且 X5d4/X5d6/X5d8 未按 crud-05 3.5.6 说明「有在跑 OP → 先落 `terminating`、等收敛后 `cancelled`」。建议统一为「Run 状态 …（有在跑 OP → 先 `terminating`）」。
10. **`TC-E3e` 第 2 步两种终局并列未定**：`:1886`「共 max+1 次尝试后**走失败边/终止**」——按 proposal-01 §14.3（V11-B），节点无 activated 失败边时是「整个 Run failed」。建议二选一写实。
11. **步骤区尾部混入非步骤项**：`:1564`「- 单 OP 的唯一 kill 来自其自身 `timeoutSeconds` 到期。」与步骤同缩进且为 `-` 列表项，易被当作第 4 步。建议移入「用例目标」或改用 `> **注**：`。

---

## 需拍板

| # | 待定问题 | 影响面 | 建议 |
|-|-|-|-|
| D1 | `retry.max=3` 时**每轮 A 执行 3 次还是 4 次**？即 `max` 是「重试次数」还是「总尝试次数」。crud-03 4.3.2（记录数−1 >= max）+ §15.2「每轮重试次数」⇒ **4 次/轮**；但 proposal-01 §15.3 示例（「A[1~3] 都失败 → C」）与 §15.6「循环轮数: 3」写成 3 次/轮 | §15.3/§15.6 示例、TC-E2a/E2c 的序列与次数、上限 9 的整除含义 | 定案为「4 次/轮」并修 §15.3/§15.6（含「3 × 3 = 9」的表述改为「总上限 9」），否则反改 crud-03 4.3.2 与 §15.2 |
| D2 | `max_loop_multiplier=0` 的文案口径：是「不限制（无绝对上限）」还是「不施加绝对上限、仍受 `max×3` 约束」 | TC-E2d、TC-S1 第 4.3 步、crud-06 `:80` | 采后者（与 crud-03 `:694` 一致），并给 crud-06 `:80` 加注，避免实现成无限循环 |
| D3 | `bash-build` 是否改名（`:1210` 已标「暂定名，最终由用户决定」） | 若改名需同步 `tc_x3/manifest.json`、`tc_x3/workflow.yaml`、`:22`/`:840`/`:1209`/`:1210`；另 `Client.name` 是否统一加 `tc_` 前缀以区别于业务 Client | 建议保留并加夹具说明；若要改，一次性批量替换 |
| D4 | 导出快照 id 的唯一性口径是否扩大到 `opId`/`workflowId`（clientId 已在 `:1210` 定案「仍应唯一」） | 轻微 4 的 3 个夹具文件 | 建议同口径，并定义占位 id 规范（如 `op_` 名称哈希后 32 位 hex） |
| D5 | `TC-S1` 第 6 步 `/api/workspaces` 是否复用 `tc_r1/seed.sql` 并把顺序写实（ws-005→ws-004→ws-001→ws-002→ws-003） | G8 | 建议复用 + 写实，使断言可判定 |
| D6 | 本轮 G1（§7 夹具）、G7（名称锚 400 负向用例）是否纳入本次修复范围 | §7 的 13 例可用性、新约定的回归覆盖 | 建议都要（G7 属口径反转，必须覆盖；G1 决定 §7 能否真正执行） |

---

## 修复顺序建议

1. **先定案 D1 / D2**（决定 §7 的 4 个 E2 用例与 proposal-01 §15 示例的数字），随即改 **S1（TC-E2a 序列）**、**S2（TC-E2c 前置与预期）**、**G5（0=不限制文案）**。
2. **S3**（TC-X5b3~b8 的 6 处断言改条件式）——纯文本、零依赖、可立即改。
3. **G3**（`retry.on=failed`→`failure`，5 处）、**G4**（节点级 `timeoutSeconds` 表述，3 处）——同类枚举/字段名修正，一次批量完成。
4. **G1 + G2**（补 §7 夹具 + E 系列数据来源映射表；E1a 补 `job_queue_running_max=1` 前置）——决定 §7 能否真正执行。
5. **G7 + G8**（补名称锚 400 负向用例；TC-S1 引用 `tc_r1/seed.sql` 并写实 `/api/workspaces` 期望）。
6. **G6**（X5e1a/e1b 夹具映射改写）与 **D3~D6** 的定案落地。
7. 最后清理**轻微 1-11**（章节标题、ID 写法、统计表行序、标题对齐、术语统一、opId 占位）。

> 备注：本轮**未发现**用例 ID 重复、步骤跳号、缺标题、统计表数字不符、ZIP 与源目录不一致、manifest 名称锚不符等问题——这些项经机械核对全部通过（见「统计」表 1-11）。
