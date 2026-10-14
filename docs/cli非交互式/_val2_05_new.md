# 独立校验报告（第 2 轮 · 专项 05：未经校验的新增内容）

> 校验员：独立校验员（只读；仅写本报告）
> 范围（本轮新增、此前未被任何校验覆盖）：
> 1. `proposal-01` §8.9 新增「导入校验约定（#8）」+ §11.7 新增导入校验注
> 2. `crud-03` 3.3.8 字段表 / 3.3.9 策略表+错误表（`manifest.workflow.name` 严格一致）
> 3. `crud-04` 3.4.10 策略表+错误表（`manifest.target.name` 严格一致）
> 4. `tests/集成测试用例.md` 新增 `### 7. 错误族矩阵`（TC-E1a..TC-E3e，13 例）+ 统计表 + TC-X3「命名说明」
> 5. `tasks.md` 「数据源约定」新增段
> 6. `tests/fixtures/tc_x3/manifest.json` clientId 变更 + `tc_x3_multi.zip` 重打包
> 基准提交：工作区当前 HEAD（改动 7 文件，`git diff --stat` = 176 insertions / 9 deletions）

---

## 统计

| 分档 | 条数 | 编号 |
|-|-|-|
| 严重 | 3 | S1–S3 |
| 一般 | 8 | M1–M8 |
| 轻微 | 11 | L1–L11 |
| 待确认 | 5 | Q1–Q5 |
| 需拍板 | 6 | 见文末 |

**结论摘要**：新增「名称锚必须一致否则 400」本身与库内其它表述基本自洽（库内已无「name 不一致以文件内容为准」的现役表述）；本轮实质问题集中在 **新增测试节的断言与规格矛盾**（S1/S2）、**并发用例前提在当前并发阈值下不可达成**（S3）、**名称锚范围/校验顺序/位置载体未定义**（M1–M4）、**fixture ZIP 重打包顺序退化**（M5）、**tasks.md 数据源约定过宽且与 tests 文档冲突**（M6）。

### 核对方法（可复现）

| 项 | 方法 | 结果 |
|-|-|-|
| 口径全量检索 | `Select-String -Pattern '以文件内容为准\|为准\|声明参考\|名称锚\|一致性校验'`（proposal-01 / crud-03 / crud-04 / tests / tasks / validation） | 「以文件内容为准」共 5 处：crud-03:434、crud-03:474、crud-04:489、validation.md:26、validation.md:51（仅前 3 处为现役规格，且**均只针对 `version`**） |
| 名称锚一致性（fixtures 是否过新规则） | 逐个比对 `manifest` 与包内文件首行 `name`（tc_j3 / tc_x4×3 / tc_x3） | **5 个包全部一致**（workflow.name、target.name、ops[].name 均与文件 `name` 相同）→ 新规则不破坏既有 fixture |
| clientId 唯一性 | `findstr /s /i "f6a7b8c9 b2c3d4e5"`（*.md/*.js/*.yaml/*.json/*.sql） | 新值 `f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1` 全集**仅 2 处命中**（fixture manifest + tests 说明），无重复；旧值 `b2c3d4e5f60718293a4b5c6d7e8f90a1` 仅存于 `原型图/mock-data.js:118`（**Codex CLI**，与 `bash-build` 不同名）→ 无残留 |
| ZIP 成员内容一致性 | 解包取 SHA256 与源目录文件 SHA256 比对（old/new 两版） | 4 个成员**全部字节一致**（new manifest sha=CFEC…，src manifest sha=CFEC…）；仅**成员顺序**变化，见 M5 |
| ZIP 成员顺序 | 解析本地文件头（PK\x03\x04）顺序 | 旧：`workflow.yaml → manifest.json → ops/op_prompt_review → ops/op_bash_build`；新：`manifest.json → workflow.yaml → ops/op_bash_build → ops/op_prompt_review` |
| 其余 4 个 fixture zip 顺序 | 同上 | 全部符合 crud-03 3.3.8 / crud-04 3.4.9 声明序（`job.yaml → manifest.json → workflows/… → ops/…`）→ 仅 tc_x3 偏离 |
| 用例计数/编号 | 统计表合计与用例 ID 去重 | 13 例（E1×4 + E2×4 + E3×5）✓；13 个 ID **无重复、无跳号**；合计 73+13=86 ✓（4+18+11+53=86 ✓） |
| 节结构 | h2/h3 列表 | `1 Client / 2 OP / 3 Workflow / 4 Job / 5 运行历史 / 6 跨页面联动 / 7 错误族矩阵`，**无重号**；13 例均含「优先级 / 用例目标 / 前置条件 / 执行步骤与预期结果」四要素 ✓ |
| 断言对规格 | 逐条对 §10.7/§14/§15、crud-03 4.3.x、crud-04 3.4.5/3.4.6/4.5.2、crud-05 3.5.6/3.5.7/3.5.9/4.6、crud-06 一/3.4 | 见 S1/S2/S3、L1–L11 |

---

## 严重

### S1（严重）TC-E2c 的前置与预期自相矛盾：A「恒成功」永远不会触顶，断言不可判定

**位置**：`tests/集成测试用例.md:1824`、`tests/集成测试用例.md:1826`

原文：
- `1824`：`- **前置条件**：构造 §15.4 拓扑：`Start → A(on=success 回跳) → End`；A 恒成功、`retry.max=3`。`
- `1826`：`1. [运行] → 预期：A 成功执行 **9 次**（上限 3×3=9）后 Run `failed`（达到上限整个 Run 失败，见 §15.2）。`

**问题**：`on=success` 循环的语义是「A 必须**连续成功 N 次**才走成功边到 End」（proposal-01:2332「A 必须连续成功 3 次才走 🟢 边到 End。任意一次失败，立即走 🔴 边到 C」；proposal-01:2360「走向成功边 \| 连续成功 N 次」）。A **恒成功** → A[1]、A[2]、A[3] 连续成功即走成功边、Run **success**，根本不会执行到第 9 次，更不会 `failed`。要触顶必须「每轮在连续成功 3 次之前失败一次」（如 成功→失败 交替）。当前写法按字面执行必然与预期相反，属**不可判定/反规格**断言。

**建议改法**：前置改为「A 每轮在累计连续成功达 3 次前失败一次（例：`成功→失败` 每轮交替，共 2 轮各消耗 2 次激活，第 3 轮第 3 次激活时达到总次数上限 9）」；或直接给定确定性序列（A 第 2、4、6、8 次失败，其余成功）。同时把标题「A 恒成功 → 回跳」改为「A 不能连续成功 3 次 → 回跳」。并补一条对照：`A 连续成功 3 次 → Run success（不触顶）`。

### S2（严重）`retry.max` 语义双读：同节内 TC-E2a 与 TC-E3e 互斥，且底层文档亦相互矛盾

**位置**：
- `tests/集成测试用例.md:1807`（TC-E2a 步骤 2）：`… `(activationSeq, retrySeq)` 序列：activation1 retry1..retry3 → activation2 retry1..retry3 → activation3 retry1..retry3，…`（即每轮 **3** 次尝试）
- `tests/集成测试用例.md:1886`（TC-E3e 步骤 2）：`… 触发自动重试（retrySeq 1→2→3→4，共 max+1 次尝试后走失败边/终止）。`（即每轮 **4** 次尝试）

**问题**：同一节内两处对 `retry.max=3` 给出的尝试次数互相排斥（3 vs 4）。这不是笔误级问题，因为底层文档本身就是两种读法：
- 「max = 每轮**尝试次数**」：proposal-01:2269「`max` 每轮重试次数（来自 NodeRetry）；节点未配置 retry 时取 1（无重试配置即按单次执行计）」；proposal-01:1016「连续失败 N 次后走失败边」；proposal-01:2321「A 连续失败 3 次才走 C」；§15.3 场景 4「A[1~3] 都失败 → C → 回跳」→ 3/3/3。
- 「max = **额外重试次数**（尝试 = max+1）」：`crud-03:691`「**重试计数** = 同一 `(run_id, step_id, activation_seq)` 下的记录数 − 1（用于 `apply_retry` 的 `max` 判定）」；`crud-03:1077`「本 activation 的尝试已达 max（同 (run,step,activation_seq) 记录数-1 >= max）→ 不重试, 走边」→ 4 次尝试，激活序列 4/4/1。

即：**总数上限 9 不变，但「每轮几次」两读不一致**；TC-E2a 采第一读、TC-E3e 采第二读，实现方无法同时满足。TC-E2b（未配置 retry → 3 次、`retrySeq` 恒 1、`activationSeq` 1/2/3）在两读下都成立，故不能用于区分。

**建议改法**：拍板一种（见「需拍板」P1），然后**三处同步**：
- 若取「尝试次数 = max」：改 `crud-03:691` 为「记录数 ≤ max」、`crud-03:1077` 为「记录数 ≥ max → 走边」，TC-E3e:1886 改为「retrySeq 1→2→3，共 max 次尝试」；
- 若取「尝试 = max+1」：改 `proposal-01:1016/2269/2321` 与 §15.3 场景 4 的次数（3/3/3 → 4/4/1），TC-E2a:1807 改为「activation1 retry1..retry4 → activation2 retry1..retry4 → activation3 retry1」。

### S3（严重）TC-E1a / TC-E1d 的「waiting 累积」前提在默认并发阈值下不可达成，409 断言无法稳定复现

**位置**：`tests/集成测试用例.md:1757`、`1759`、`1796`、`1797`

原文：
- `1757`：`… 准备 3 个可 long-run 的 OP（如 sleep 60）；构造 concurrency=parallel 的 Job 与 concurrency=queue 的 Job 各 1 个 …`
- `1759`：`1. 先后 [运行] 2 个 long-run 任务（如 Job-A queue、单次执行 OP-B）→ 预期：各返回 {runId}，job_runs 中 status='waiting' 计 2 = waiting_max。`
- `1796`：`2. waiting 计数 = job_queue_waiting_max - 1 时运行 → 预期：200（临界未触顶）。`

**问题**：该用例的「waiting 会累积」前提不成立。缺省 `job_queue_running_max = 10`（`crud-06:76`「**运行中队列深度上限（最大 10）**；Task Runner 并发阈值 …即取此值」），而 Task Runner 每个 `runner_poll_interval_ms=1000ms` 就把 waiting 提升为 running（`crud-05:474`「每轮轮询先 `running_count.load() < job_queue_running_max` 判断 … waiting → running」；`crud-05:584` 先入队成功再置 running）。因此 2–3 个 long-run 任务在 **1 个轮询周期内**即全部转 running，`status='waiting'` 计数回到 0：步骤 1 的「计 2 = waiting_max」不可能稳定观测，步骤 2 的 409 也不会触发（检查的是**全局 waiting 计数**，见 `crud-05:572`）；TC-E1d 步骤 2/3 同理退化为「永远 200」，边界未被真正验证。

**建议改法**：二选一（建议前者，确定性更好）：
1. 先占满运行名额再测：投入 `job_queue_running_max + job_queue_waiting_max`（缺省 10+2=12）个 long-run 任务，待 `running` 稳定为 10、`waiting` 稳定为 2 后再执行步骤 2 的 409 断言；
2. 或先把 `job_queue_running_max` 调到允许的最小值、投 3 个 long-run 任务（1 running + 2 waiting）——**该最小值 crud-06 未定义，需确认（Q2）**。
并在步骤 1 补「等待一个轮询周期后复核计数」的构造说明。

---

## 一般

### M1（一般）§8.9 的校验时机自相矛盾；「前端如何指明不一致位置」未固化载体

**位置**：`proposal-01-界面设计.md:527`

原文（同一条内前后两半）：`**导入校验约定（#8…）**：提交导入后，后端先做**包完整性校验**…… **不一致 → 导入校验不通过**，前端弹窗提示失败原因并**指明不一致位置**（如「manifest 声明 name=bash-build，包内 ops/op_bash_build.yaml 实际 name=op_bash_build」）。用户可**手动修改包内文件 / manifest 后重新选择文件导入**；**修改成功且校验通过后，[导入] 才提交后端完成导入**。`

**问题**：
1. 前段是「提交 → 后端校验」（与 crud-03 3.3.9 / crud-04 3.4.10 的 400 口径一致），后段却是「校验通过后才提交后端」，读起来像**前端先校验**或在提交前预检一次——与「后端首次做包完整性校验」互斥；实现方会分叉（在前端解 ZIP / 在提交前预检）。
2. 「指明不一致位置」只给了示例文案，**未定义载体**：全后端错误体仅 `{"error":{"code","message"}}`（`proposal-02-后端设计.md:322-325`、`crud-03:121`、`crud-04:87` 同口径），没有结构化字段。而同类需求（`CLIENT_NOT_FOUND`「响应体列出缺失名称」，`proposal-02-后端设计.md:338`）同样只靠 message。前端要「指明位置」就必须**依赖 message 文本格式**，但该格式（`字段=值` 拼接）未被任何规格固化，T2 无法据此写解析/展示。

**建议改法**：① 统一为一句话流程：「[导入] → 提交 `{zip}` → 后端包完整性校验（含名称锚）→ 不通过则 400 `VALIDATION_ERROR`，`message` 已含不一致位置（前端**原样展示**该 message，不做解析）→ 用户手动改包 → 重新 [选择文件] 并重新提交」；删除「校验通过后才提交」的表述。② 在 `proposal-02-后端设计.md` §10.1「说明」补一条：「**导入校验的位置信息以 `message` 文本承载**（与 `CLIENT_NOT_FOUND` 列出缺失名称同口径），格式为 `manifest.<锚>=<值> 与 <包内文件> 的 name=<值> 不一致`；如需结构化，须同步改统一错误体并新增字段（见需拍板 P3）」，并让 T2.14 的验收显式引用该口径。

### M2（一般）名称锚只校验了 2 项，另 2 项未纳入，且 §8.9 的泛化表述与 crud-03/04 的枚举不一致

**位置**：`proposal-01:527`（泛化：「`manifest` 名称锚与包内文件实际 `name` 必须一致」）；`crud-04:444`/`450`（`job` 字段）；`crud-04:453`、`crud-03:436`（`ops[].name`）

原文：
- `crud-04:450`：`| job | object | Job 名称与版本（锚定 job.yaml） |`
- `crud-04:453`：`| ops | object[] | 包内 OP 依赖：{name, version, file}（file 恒为 ops/<name>.yaml） … |`
- `crud-03:436`：`| ops | object[] | 包内 OP 依赖：{name, version, file}（file 恒为 ops/<name>.yaml） |`

**问题**：新规则只覆盖 `manifest.workflow.name`（crud-03:474/434）与 `manifest.target.name`（crud-04:489），**未覆盖**：
- `manifest.job.name` ↔ 包内 `job.yaml` 的 `name`（Job 包；`crud-04:450` 明确称其为「锚定 job.yaml」）；
- `manifest.ops[].name` ↔ `ops/<name>.yaml` 的 `name`（Workflow 包与 Job 包**都有**）。
后者有实际后果：`crud-03:475` 的 `节点 opName → opId` 是「按 name 匹配 ops：不存在 → **按包内 ops/*.yaml 创建**」——若 `ops[].name=A` 而 `ops/A.yaml` 内部 `name=B`，则创建出的是 `B`，节点 `opName=A` 匹配失败，落「创建/报错」未定义路径（既不 400 也不 409，or 触发 run_failed）。而 §8.9 的泛化句（`manifest` 名称锚**与包内文件实际 name** 必须一致）会让实现方以为这三项都要校验，两处口径不一致。

**建议改法**：在 `crud-03:474` 与 `crud-04:489` 的校验条目里补齐第三/第四锚，并统一列举：「严格校验：① Workflow 包 `manifest.workflow.name` ↔ 根级 `workflow.yaml`；② Job 包 `manifest.target.name` ↔ `manifest.target.file` 指向文件；③（新增）`manifest.job.name` ↔ 包内 `job.yaml`；④（新增）`manifest.ops[].name` ↔ `manifest.ops[].file` 指向文件。四项任一不一致 → 400 `VALIDATION_ERROR`（message 指明位置）」。若决定不校验 ③④，则把 §8.9:527 的泛化句改为**显式枚举两项**，避免两读。

### M3（一般）`file` 路径与 `name` 的关系未定义：内部 `name` 一致但文件名不一致时是否通过？

**位置**：`crud-04:452`、`crud-04:453`、`crud-03:436`、`crud-03:474`

原文：`crud-04:452`：`file 为包内相对路径——workflows/<name>.yaml（kind=workflow）或 ops/<name>.yaml（kind=op）`；`crud-03:436`：`file 恒为 ops/<name>.yaml`；`crud-03:474`：`manifest.workflow.name 与根级 workflow.yaml 实际 name 不一致 → 400`。

**问题**：字段表把 `file` 写成由 `<name>` 派生（`ops/<name>.yaml`），但校验规则只比对**文件内容的 `name`**。于是出现未定义分支：`target.name=X`、`file=ops/Y.yaml`、`Y.yaml` 内部 `name=X` —— 按校验规则**通过**，按字段表**应命名为 ops/X.yaml**。两种读法结论相反，且 §8.9 的示例（`manifest.target.name=bash-build` vs `ops/op_bash_build.yaml`）恰好落在这个灰区（target.name 与文件名不同、文件名与内部 name 相同）。同时 `ops[].file` 同理。

**建议改法**：拍板并写一句（见需拍板 P2）：建议采用「**只校验文件内容 `name`，不校验文件名/目录名**；`file` 仅作包内定位（必须真实存在，缺失 → 400，同 `crud-04:508` 已有条目）」，并把字段表的 `ops/<name>.yaml` 改为 `ops/<文件内 name>.yaml（导出端约定；导入端以 file 为准、不校验文件名）` 的措辞。

### M4（一般）校验顺序未定义：名称锚 400 与同名 409 / CLIENT_NOT_FOUND 409；waiting 上限 409 与 RERUN/RETRY_NOT_ALLOWED 409

**位置**：`crud-03:474`（行序：`同名已存在 → 409 WORKFLOW_NAME_EXISTS` 在前，名称锚校验在后）、`crud-04:489`（`job.yaml.target.kind 与 manifest.target.kind 不一致 → 400` 与名称锚校验同段）、`crud-05:340`；对应新用例 `tests:1761`

原文：
- `crud-03:474`：`| Workflow 本身 | 同名已存在 → 409 WORKFLOW_NAME_EXISTS；否则新建 … **名称锚一致性校验（#6）**：… 不一致 → **400 VALIDATION_ERROR** … |`
- `crud-05:340`：`> **原子性（#4）**：检查（终态 + 全局 waiting 上限）与创建 JobRun 在同一事务（BEGIN IMMEDIATE）内先查后插，语义同 crud-04 3.4.6。`
- `tests:1761`：`3. 再单次执行 OP / Workflow / [重跑] / [重试] 任一入口 → 预期：同样 **409 CONCURRENCY_CONFLICT**（统一检查，见 crud-04 3.4.6 #3）。`

**问题**：两处顺序都未定义：
1. 导入侧：包**同时**名称锚不一致 + 同名已存在时返回哪个？表格行序暗示 409 优先，但 3.3.9 表内新 400 条目在「ZIP 解析失败…等字段非法」语境下更像「先校验」；`crud-04:489` 还把 `target.kind` 不符（400）与名称锚（400）混排但**未说明与 409 `JOB_NAME_EXISTS` 的先后**。
2. 运行侧：waiting 上限触发时，若 rerun/retry 的 Run 本身不满足前提（未终态 / 版本不一致），返回 `CONCURRENCY_CONFLICT` 还是 `RERUN_NOT_ALLOWED`/`RETRY_NOT_ALLOWED`？新用例 1761 直接断言前者，但未给「被重跑/重试的 Run 必为终态且前提满足」的前置，断言在多错误并存时不可判定。

**建议改法**：比照 `crud-04:310` 已有的体例（`> **校验顺序（返回首个命中）**：needsUpdate → CLIENT_TYPE_MISMATCH → concurrency`）补两处：
- 导入：`> **校验顺序（返回首个命中）**：ZIP 可解析 → 包完整性/名称锚/kind 校验（400 VALIDATION_ERROR）→ 名称冲突（409 *_NAME_EXISTS）→ Client 匹配（409 CLIENT_NOT_FOUND）`；
- rerun/retry：`> **校验顺序**：全局 waiting 上限（409 CONCURRENCY_CONFLICT）先于终态/前提校验（RERUN_/RETRY_NOT_ALLOWED）`（或反之，二选一后同步 use case）。TC-E1a 步骤 3 同时补前置「被重跑/重试的 Run 为终态且满足五条件/版本一致」。

### M5（一般）`tc_x3_multi.zip` 重打包后成员顺序**退化**，偏离 crud-03 3.3.8 声明序与其余 4 个 fixture 体例

**位置**：`tests/fixtures/tc_x3/tc_x3_multi.zip`（二进制变更，1920 → 1620 字节）；规格依据 `crud-03:410-411`、`proposal-01:1305`

原文（`crud-03:411`）：`> **ZIP 成员顺序（导出端固定，端到端可逐字节比对）**：workflow.yaml → manifest.json → ops/<opName>.yaml（按 manifest.ops 顺序）。导入端**不依赖成员顺序**，按 manifest.ops[].file 定位。`

**问题**：解析两个版本的本地文件头顺序得到：
| 版本 | 成员顺序 |
|-|-|
| 旧（HEAD） | `workflow.yaml → manifest.json → ops/op_prompt_review.yaml → ops/op_bash_build.yaml`（**完全符合** 3.3.8 声明序与 `manifest.ops` 顺序） |
| 新（工作区） | `manifest.json → workflow.yaml → ops/op_bash_build.yaml → ops/op_prompt_review.yaml`（**三处不符**） |
其余 4 个 fixture zip（tc_j3、tc_x4×3）均符合各自声明序。功能上导入不依赖顺序（3.3.8 已声明），但本轮是**唯一一次触碰该 ZIP 的改动**（同一提交内），却把一条既有属性改坏：① 与「导出端固定顺序、端到端可逐字节比对」的校验口径不再可比（任何按声明序重打包再比对的脚本会假失败）；② 与其它 fixture 体例不一致。成员**内容**已核对为字节一致（SHA256 相同），故非数据损坏。

**建议改法**：按 `workflow.yaml → manifest.json → ops/op_prompt_review.yaml → ops/op_bash_build.yaml`（= `manifest.ops` 顺序）重打包 `tc_x3_multi.zip`；并在测试文档的 fixture 表（`tests:22`）补一句「`tc_x3_multi.zip` 成员序同 crud-03 3.3.8 导出序」，避免下次重打包再退化。

### M6（一般）`tasks.md` 数据源约定过宽：与 T3.9 单测、T4 全组（文件/CLI 行为）及 tests 文档的「原型图 + mock」定位冲突

**位置**：`tasks.md:84-88`、`tasks.md:92`、`tasks.md:96`

原文：
- `tasks.md:88`：`> **验证路径（阻塞后续功能验证）**：T3、T4 及后续 T5–T10 后端任务的功能验证，**一律通过 T2 生成的正式前端端到端验证** … **不得以 mock 数据代偿** …`
- `tasks.md:92`：`| T2.1 | 前端资源组织与构建：以 原型图/* 为基线，整理为可嵌入的静态资源目录 … |`
- `tasks.md:125`：`| T3.9 | Repository 单元测试（含唯一约束、快照引用、级联删除） | schema.sql | cargo test 通过 |`
- `tests/集成测试用例.md:9-10`：`- 前端原型：docs/cli非交互式/原型图/ 目录下 6 个 HTML 文件` / `- Mock 数据：mock-data.js（CLIENTS / OPS / …）`
- `tests/集成测试用例.md:56`：`| P0 | 依赖静态数据测试 | 用**预置静态数据**即可验证（**前端 mock 数据**，或一次性导入 fixtures / DB 注入 seed.sql）… |`

**问题**：三处冲突/缺口：
1. 「一律通过前端 E2E 验证」对以下子任务**物理不可行**：`T3.9`（`cargo test` 单测）、`T4.1–T4.2`（`-c` 运行目录解析/路径展开）、`T4.5`（日志绕接 zip 与文件名规则）、`T4.6–T4.7`（Run 日志文件、随历史清理删除）、`T4.8`（审计日志落库）——均为文件系统/日志行为，前端不可观测；`T4.3/T4.4` 亦仅部分可观测。
2. `tests` 文档仍以「`原型图/` 6 个 HTML + `mock-data.js`」为**被测前端**，且 P0 档把「前端 mock 数据」列为合法验证依据——与本约定的「正式前端不经过任何 mock」「不得静默回退 mock」直接冲突（同一批用例会被两种口径同时解释）。
3. `T2.1` 要求「以 `原型图/*` 为基线」整理 `ui/`，而 6 个原型页均含 `<script src="mock-data.js">` 与 `mockFetch(...)` 调用（如 `原型图/client.html:7,460`、`原型图/workflow.html:7,595,619`），与 `tasks.md:84`「**前端不内置任何静态业务数据兜底**」潜在矛盾——若按「搬过来」理解，会把 mock 一起带进正式前端。

**建议改法**：① 把 `tasks.md:88` 收窄为「**接口/界面可观测行为**的验收证据 = T2 正式前端 E2E；`cargo test`/单测与文件/日志类验收（T3.9、T4.1–T4.8）仍按各自列出的手段验证，**但不得用 mock 数据作为功能证据**」；② `tasks.md:92` 补「**复用原型图的 DOM/CSS/交互结构；必须移除 `mock-data.js` 与 `mockFetch`，改为真实 `fetch('/api/…')`**」；③ 同步改 `tests/集成测试用例.md:9-10`（明确「被测前端 = T2 产出的 `ui/`；`原型图/` 仅原型演示、不作为验证依据」）与 `P0` 定义（把「前端 mock 数据」换成「一次性导入 fixtures / `seed.sql` 注入」）。

### M7（一般）`validation.md` 遗留项与新规则**直接冲突**且未同步（旧结论仍是「以文件内容为准」）

**位置**：`validation.md:26`、`validation.md:51`、`validation.md:24`

原文：
- `validation.md:26`（三、备注·遗留 3）：`3. manifest.target.name 与包内文件内容不一致时以文件内容为准。`
- `validation.md:51`（五、收尾·遗留 3）：`3. manifest.target.name 与包内文件内容不一致时以**文件内容**为准（待追认）。`
- `validation.md:24`（遗留 1）：`1. D3 仅做最小版：其余错误族（400/404/409 矩阵、并发 queue/parallel、循环回跳/自动重试、超时收敛）用例未补。`

**问题**：`validation.md` 是「唯一留存报告」，其遗留 3 的结论（**以文件内容为准**）已被本轮 `crud-04:489` 的「**不静默以文件内容为准** / 400」推翻，两份文档对同一行为给出相反结论，后来者可能按旧遗留实现。同时遗留 1（错误族用例未补）已被本轮新增 §7 部分覆盖（并发/循环/超时已补；400/404/409 通用矩阵仍缺），遗留 2（`bash-build` 命名）已由 `tests:1210` 的命名说明处理——三项目前均处于「已处置但报告未更新」状态。

**建议改法**：在 `validation.md` 三/五处把遗留 3 改为「**已由本轮变更处置**：`manifest.target.name`（及 `manifest.workflow.name`）与包内文件 `name` 不一致 → 400 `VALIDATION_ERROR`，不静默以文件内容为准（见 crud-04 3.4.10 / crud-03 3.3.9）」；遗留 1 注明「并发/循环/超时已补（tests §7），400/404/409 通用矩阵仍缺」；遗留 2 注明「已定名 `bash-build`（暂定名，见 tests:1210）」。

### M8（一般）同一决策两套行内编号（crud-03 `#6` vs crud-04/§8.9 `#8`），且 `#N` 系列未收录进 §20.1 释义表

**位置**：`crud-03:474`（`**名称锚一致性校验（#6）**`）、`crud-04:489`（`**名称锚一致性校验（#8）**`）、`proposal-01:527`（`**导入校验约定（#8，…）**`）、`proposal-01:2871-2899`（§20.1 决策编号释义）

**问题**：同一决策（导入名称锚一致性校验）在 crud-03 标 `#6`、在 crud-04/§8.9 标 `#8`；而 §20.1 明确要求「引用必须带出处」、且给出了行内编号释义表的维护规则（`proposal-01:2899-2900`），但表中**没有 `#1..#8` 系列**（表中为 D/C/U/T/S/V 系列）。结果：`#8` 在 crud-04 内既指名称锚（489），又与 crud-04 自身的 `#7/#5/#4/#3/#2/#1` 并列成一套**文档局部**编号，跨文件引用时会指向别处（例如 `crud-04:496` 的 `#7` 指 `enabled`），可追溯性受损。

**建议改法**：统一为一个 id（建议按 §20.1 的「后续建议」改用具名标签「**决策-导入名称锚一致性**」），三处同步；或在 §20.1 表下补一行「`#N`：各 crud 内**局部**审查条目号，**不可跨文件引用**」，并在 crud-03/04/§8.9 引用处改为「见 crud-03 3.3.9 / crud-04 3.4.10」的带出处写法。

---

## 轻微

- **L1** `tests:1763`（TC-E1a 步骤 5）：`预期：**不报错**，本轮跳过（记 error 日志、不创建 Run）` —— 「记 error 日志」无规格依据：`crud-04:597` 只写「本次 cron **跳过不触发**（不报 409、不排队；下个 cron 周期重试）」，error 日志在 `crud-04:593` 仅用于「cron 非法/注册失败」，needsUpdate 才是 warning（`crud-04:592`）。且该步骤无法与「同 Job 有在途实例即跳过」（`crud-04:595`）区分。**建议**：改为「不报错、无前端提示，不创建 Run（是否记日志不作断言）」，并补前置「其它 Job/单次执行占满全局 waiting，**被测 schedule Job 自身无在途实例**」。
- **L2** `tests:1807`：`A 的实际执行次数 = min(3×3, 0 不限制) = **9 次**` —— 数学上 `min(9, 0) = 0`，与结论 9 冲突。**建议**写为「`max×3 = 9`；`max_loop_multiplier=0` 不参与取小（`0`=不限制，见 §15.2）」。
- **L3** `tests:1807` 与 `tests:1809`（TC-E2a 步骤 2 与 4）重复断言同一事实（A 的记录数与序列），步骤 4 未引入新信息。**建议**步骤 4 改为校验 `GET /api/runs/{runId}` 的**聚合字段**（status=failed、`durationMs`、steps 排序按 `(activationSeq, retrySeq)` 升序）以复用接口校验。
- **L4** `tests:1857`：`steps 中 B 无执行记录（或不存在）` —— 二义（"或不存在"）。规格只有一种：未执行节点不落 step_record（`crud-03:712`「（所有入边均 dropped）视为 skipped，不产生执行 / 不落 step_record」）。**建议**固定为「B 无 step_record；steps 仅含 A」。
- **L5** `tests:1876`（TC-E3d 步骤 2）：`若修复 A（缩短执行）→ 最终 success` 与前置 `OP/Workflow 未更新（版本一致、needsUpdate=false）` 张力：改 OP 若升版即破坏重试五条件（`crud-05:376`、`crud-04:265`④）。**建议**注明「**保存时选择不升版本**（§13.5 默认不更新），或改为缩短 `sleep` 时长以外的手段（如换 workspace）」，否则该步会误报 `RETRY_NOT_ALLOWED`。
- **L6** `tests:1883`：`Workflow 单节点 A（timeoutSeconds=1、长运行）` —— Workflow 必有 Start/End（`proposal-01:1320-1321`），措辞应为「**单个 op 节点 A**（Start→A→End）」。
- **L7** `tests:1751`（节首依据）：只列 `crud-04 3.4.5/3.4.6/4.5、crud-05 3.5.6/3.5.8/3.5.9`，但 E2（回跳上限/试次口径）实际依据是 **crud-03 4.3.0/4.3.1/4.3.2**、上限校验依据 **crud-06 3.4/四**，E1（waiting 上限行为）依据还包括 **crud-05 4.6**。**建议**补齐，便于实现者定位。
- **L8** `tests:1901`（统计表新行）：`| 错误族矩阵（并发/循环/超时） | 13 | … |` 插在「配置 / 系统」与「跨页面联动」之间，而详细用例里它是**最后一节（§7）**，与既有「统计行序 ≈ 详细用例序」的体例不一致（`tests:158/481/710/882/1029/1143/1749`）。**建议**移至「跨页面联动」行之后。
- **L9** `proposal-01:527` 与 `crud-04:489` 的示例把 **Client 名**当 `target.name` 用：`如「manifest 声明 name=bash-build，包内 ops/op_bash_build.yaml 实际 name=op_bash_build」` —— `bash-build` 在 fixtures 中是 **Client 名**（`tests/fixtures/tc_c2/tc_c2_05.yaml`、`tests:417`），而 `manifest.target.name` 只能是 OP/Workflow 名。**建议**换中性示例：「`manifest.target.name=deploy_prod` 与 `workflows/wf_deploy_prod.yaml` 的 `name=wf_deploy_prod` 不一致」。
- **L10** `crud-03:434`：把**导入校验**写进 3.3.8（**导出**接口）的 `manifest` 字段表，与 3.3.9（导入）的策略表重复且口径混排（导出语义 vs 导入校验）。**建议**字段表只留「`workflow`：包内 Workflow 的名称与版本（锚定根级 `workflow.yaml`）；导入校验见 3.3.9」，校验细节唯一落在 3.3.9。
- **L11** `tests:1835`（TC-E2d 步骤 1）：「设 `settings.max_loop_multiplier=2` → [运行] → 预期：A 执行 2 次后 Run `failed`」隐含「改动对**下一次 Run** 生效」，但 `crud-06` 未把 `max_loop_multiplier` 归入「即时生效 / 下次使用生效」任一档（`crud-06:56` 列举中未含该项）。**建议**步骤 1 补「（改动在下次 Run 读取时生效；若当次未生效，重启或重试）」，或在 crud-06 一 表的 `max_loop_multiplier` 行补「动态（下次 Run 生效）」。

---

## 待确认

- **Q1** 审查提示称 `crud-03 3.3.10` 仍写 `version`「与文件不一致时以文件内容为准」——**全文检索未发现**：`proposal-02-后端crud-03workflow管理.md` 中「以文件内容为准」仅 2 处命中（`:434`、`:474`），3.3.10（`:492-545`）为 needs-update 判定，无该表述。请确认所指位置（若指 `crud-03:434` 的 `version` 半句，则属「同一行内 name 严格 / version 宽松」的分工，非冲突）。
- **Q2** `job_queue_running_max` 是否允许调到 **1**（S3 的推荐构造之一依赖下调；`crud-06:283` 只给「上限 10」，未给下限）。
- **Q3** `min(max×3, max_loop_multiplier)` 在 `max_loop_multiplier=0` 时的**公式写法**：`proposal-01:2270` 为「`0`=不限制，否则与 max×3 取较小值」，但公式本体 `min(max × 3, max_loop_multiplier)`（`proposal-01:2265/2271`、`crud-03:694`）代入 0 得 0 —— 是否统一改写为「`max×3`（当 `max_loop_multiplier=0` 或未设置时）」以消除歧义？
- **Q4** `manifest.clients[].clientId` 在导入时**是否需要校验唯一/存在**：`tests:1210` 新说明称「clientId 仅作导出快照，但仍应唯一」，但 `crud-03:435`/`crud-04:451` 只说「仅记录名称↔导出时 id 对应关系」，无任何校验规则。是否需在导入时校验重复（或忽略）？
- **Q5** `manifest.job.name`（Job 包）是否纳入严格校验（M2 的 ③）——影响 `tests` 是否需要新增用例与 fixture 校验脚本。

---

## 需拍板

1. **`retry.max` 语义**（S2）：`max` = 每轮**尝试次数**（尝试 = max，序列 3/3/3），还是 = **额外重试次数**（尝试 = max+1，序列 4/4/1）？决定改 `crud-03:691/1077` 还是改 `proposal-01:1016/2269/2321`+§15.3 场景 4 与 `tests:1807/1886`。
2. **名称锚范围与 `file` 关系**（M2/M3）：是否把 `manifest.job.name`、`manifest.ops[].name` 一并纳入严格校验？是否校验 `target.file` / `ops[].file` 的**文件名**（还是仅校验文件内容 `name`、`file` 只作定位）？
3. **「不一致位置」的载体**（M1）：仅用 `message` 文本（免改错误体，但格式需在 §10.1 固化），还是新增结构化字段（如 `error.details[]`，需同步改统一错误体、§10.1、前端展示与各用例）？
4. **校验顺序**（M4）：导入侧「包完整性/名称锚（400）优先于同名/Client 冲突（409）」；运行侧「waiting 上限（409 CONCURRENCY_CONFLICT）优先于 RERUN_/RETRY_NOT_ALLOWED」——两处是否照此固定并写入对应 3.3.9 / 3.4.10 / 3.5.7 / 3.5.8。
5. **被测前端口径**（M6）：是否把 `tests/集成测试用例.md` 的「测试环境」与「P0 定义」正式改写为「被测前端 = T2 产出的 `ui/`（真实 HTTP API）；`原型图/` 仅原型演示，**不作为验证依据**」。
6. **`tc_x3_multi.zip` 是否按声明序重打包**（M5）：按 `workflow.yaml → manifest.json → ops/<按 manifest.ops 顺序>` 重打包（与其余 4 个 fixture 一致），或明确「导入用 fixture 不要求导出序」并在 `crud-03:411` 注明例外。

---

## 修复顺序建议

| 序 | 动作 | 涉及条目 | 理由 |
|-|-|-|-|
| 1 | 拍板 `retry.max` 语义并三处同步（含新用例） | S2 / 拍板 1 | 阻塞 E2/E3 全部循环类用例与 Engine 实现（T8.15/T8.16） |
| 2 | 修 TC-E2c 前置与预期（A 不能连续成功 3 次）或补对照用例 | S1 | 断言反规格，直接产生假失败 |
| 3 | 修 TC-E1a / TC-E1d 的构造（先占满 running 或 ≥ running_max+waiting_max 个 long-run 任务） | S3 / Q2 | 4 处断言当前不可复现 |
| 4 | 一次改齐导入校验口径：名称锚范围、`file` 关系、校验顺序、位置载体、§8.9 时机表述 | M1–M4 / 拍板 2–4 | 同段文本，一次改完避免再起冲突；阻塞 T8.9 / T10.10 实现 |
| 5 | 重打包 `tc_x3_multi.zip`（声明序）+ fixture 表补注 | M5 / 拍板 6 | 低风险、可立即执行；防止后续校验脚本假失败 |
| 6 | 收窄 `tasks.md` 数据源约定（T3/T4 例外）+ 改 `tests` 测试环境/P0 + T2.1 加「移除 mock」约束 | M6 / 拍板 5 | 阻塞 T2/T3/T4 的验收口径 |
| 7 | 同步 `validation.md` 三项遗留状态 | M7 | 消除与新规则的相反结论 |
| 8 | 统一/说明 `#6`/`#8` 编号 | M8 | 可追溯性，低风险 |
| 9 | 批量修轻微项（L1–L11） | 轻微 | 措辞与冗余断言，可合并为一次编辑 |
