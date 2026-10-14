# 独立校验报告（第 3 轮 · 测试面 03）—— `tests/集成测试用例.md` + `tests/fixtures/**`

- 范围：`docs/cli非交互式/tests/集成测试用例.md`（90 用例）、`docs/cli非交互式/tests/fixtures/**`（6 个 ZIP + 全部源目录，含新增 `tc_e2/`、`tc_e3/`）
- 只读参照：`_val2_03_tests.md`、`_val2_05_new.md`、`_fix_v2_decisions.md`、`_fix_v2_E_tests.md`、`proposal-01-界面设计.md`、`proposal-02-*.md`、`schema.sql`
- 本轮方式：**只读审查**，仅写入本报告；未修改任何被审文件（脚本全部落在 `%TEMP%`，未在被审目录落盘）
- 报出：**严重 0 / 一般 2 / 轻微 8 / 需拍板 4**

---

## 统计

### 机械核对（方法与结果）

**方法**：Python 3.12（`utf-8`/`utf-8-sig` 读取、统一换行为 `\n`）+ PowerShell 5.1；ZIP 用 `zipfile` + 自解析 local file header（逐成员 SHA256 与源目录同路径文件比对，正反向各查一次）。

| # | 核对项 | 方法 | 结果 |
|-|-|-|-|
| 1 | 用例条数 / ID 唯一性 / 两处一致性 | 正则 `^####\s+(TC-\S+)` 取详细用例；汇总列表（`:70-160`）取 `^\| TC-` 行；集合与顺序比对 | 详细 **90** / 汇总 **90** / 唯一 **90**；`only in detail` 空、`only in summary` 空、**无重复 ID**、**顺序完全一致**（`order identical = True`） |
| 2 | 文末统计表逐格 | 按 ID 前缀归模块 + 按各详细用例 `- **优先级**` 实测分布，与 `:1979-1988` 逐格比对（含合计） | **逐格一致**：Client 5(1/4/0/0)、OP 5(1/4/0/0)、Workflow 3(1/2/0/0)、Job 3(1/2/0/0)、运行历史 4(0/4/0/0)、跨页面联动 52(0/1/11/40)、配置/系统 1(0/1/0/0)、错误族矩阵 13(P3 13)、导入校验 4(P3 4)；**合计 90 / 4 / 18 / 11 / 57**（4+18+11+57=90 ✔）。汇总列表优先级与详细用例**逐例 0 处不符** |
| 3 | 区块结构完整性 | 每 `#### TC-` 区块检查 标题 / `- **优先级**` / `- **用例目标**` / `- **前置条件…` / `- **执行步骤与预期结果**` | **90/90 五项齐全**，无缺标题、无缺优先级、无缺步骤区 |
| 4 | 步骤编号连续性 | 区块内取最小缩进为顶层基线，核 `1..n` 连续；再按父步骤核 `x.1/x.2` 连续 | **顶层 90/90 无跳号、无重号；子步骤全部连续**；缩进无混用 |
| 5 | 悬空 / 重复引用 | 全文 `TC-<id>` 集合 vs 详细用例 ID 集合；夹具路径存在性 | 非用例 ID 引用仅 **`TC-X2`**、**`TC-E3`**（均为族引用，可接受）；**零悬空单例引用**；文中出现的 **26 个 `fixtures/...` 路径全部存在**；无重复用例 ID |
| 6 | ZIP 逐成员 SHA256 vs 源目录 | 6 个 ZIP、**22 个成员**，逐成员 SHA256 ↔ 源目录同路径文件；反向查源文件遗漏 | **22/22 字节一致**；无缺成员、无多余成员、无源文件遗漏（`tc_x4/*.zip` 的源在各自子目录，已按子目录映射核对） |
| 7 | ZIP 成员序 vs 声明序 | local file header 序 + 中央目录序双查 | **6/6 符合声明序**：Workflow 包 = `workflow.yaml → manifest.json → ops/<manifest.ops 序>`（crud-03 `:432`）；Job 包 = `job.yaml → manifest.json → [workflows/<name>.yaml] → ops/<name>.yaml`（crud-04 `:415`）。local 序 == 中央目录序（`True`） |
| 8 | manifest 名称锚一致性 | `manifest.workflow.name` / `manifest.job.name` / `manifest.target.name` / `manifest.ops[].name` ↔ 包内文件实际 `name` | 6 个包（`tc_e2` / `tc_j3` / `tc_x3` / `tc_x4`×3）共 **18 项锚全部一致，0 不符** |
| 9 | 节点 `opName`/`clientName` 集合 | `workflow.yaml` 节点集合 vs `manifest.ops` / `manifest.clients` | `tc_x3`：opName 集合 **= ** `manifest.ops` 集合 ✔；`tc_e2`：opName 集合 **=** `manifest.ops` 集合 ✔、clientName `{bash-build}` **=** clients ✔（满足 crud-03 `:516` G2 ② 与 `:517` 按名解析前提） |
| 10 | 编码 / 行尾 | 字节级统计 | `集成测试用例.md`：`bytes=163657`、**BOM 保留**、`CRLF=1988`、**`LF_only=0`**；新增夹具 `tc_e2/**`、`tc_e3/**` 与既有夹具同为 **LF**（一致） |
| 11 | 旧措辞残留 | 逐串 grep | 全部 **0**：`retry.on=failed`、`on_failed`、`on:failed`、`retry_from_step_id`、`前端原型：`、`TC-R1 / R2 / R3`、`max+1`、`min(3×3`、`0`=不限制（超时兜底）`、`timeoutSeconds=1, sleep 5`、`**前置条件（` 变体、`不限制（按 max×3=9 触顶失败）`、`记 error 日志、不创建 Run` |
| 12 | 手写重复行扫描 | 区块内相邻/非相邻完全相同且 ≥8 字符的行 | 仅 `TC-C2` 两段**示例 YAML** 出现同形行（`:434≡:445`、`:443≡:450`），属刻意并列，非误粘贴 |
| 13 | 「包内自包含」声明 | 包内 `ops/*.yaml` / `workflows/*.yaml` ↔ `tc_o2` / `tc_w3` 源文件 SHA256 | **8/8 完全相同** → `:32` 的声明成立 |

### 夹具专项证据（本轮新增/重打包件）

```
tc_e2_loop.zip   order: workflow.yaml -> manifest.json -> ops/op_tc_e2_fail.yaml -> ops/op_tc_e2_ok.yaml   ALL MATCH: True
                 workflow.yaml=faf62316…  manifest.json=d17a570b…  op_tc_e2_fail=88f7df1f…  op_tc_e2_ok=8f96983d…
tc_x3_multi.zip  order: workflow.yaml -> manifest.json -> ops/op_prompt_review.yaml -> ops/op_bash_build.yaml  ALL MATCH: True
                 workflow.yaml=29f58af6…  manifest.json=cfec955c…  op_prompt_review=80242920…  op_bash_build=f52e1f26…
anchor tc_e2 : manifest.workflow.name=wf_tc_e2_loop == workflow.yaml name ✔ ; ops[0/1].name == 文件 name ✔ ; clients[bash-build]=f6a7b8c9… ✔
anchor tc_x3 : manifest.workflow.name=wf_tc_x3_multi == workflow.yaml name ✔ ; ops[0/1].name == 文件 name ✔
anchor tc_j3 : manifest.job.name=tc_j3_schedule == job.yaml name ✔ ; manifest.target.name=op_prompt_review == ops/op_prompt_review.yaml name ✔ ; ops[0].name ✔
anchor tc_x4 ×3 : job.name == job.yaml name ✔ ; target.name == 目标文件 name（op_prompt_review / wf_deploy_prod）✔ ; ops[0].name ✔
```

- `tc_e2/workflow.yaml` 实际拓扑 = 用例声明拓扑：`Start→A(node_loop,op_tc_e2_fail)→End` + `A🔴on_failure→C(node_marker,op_tc_e2_ok)` + `C🔵always→A`；A 节点 `retry: {on: failure, max: 3, backoff: constant, interval: 1000}` ✔ 与 `:26`、`:1831` 完全吻合。
- `tc_e3/op_tc_e3_timeout.yaml`（`type: bash`、`timeoutSeconds: 1`、content `sleep 5`）、`op_tc_e3_longrun.yaml`（`timeoutSeconds: 600`、content `sleep 60`）字段体例与 `tc_o2/*.yaml` 同构 ✔，与 `:27`、`:1783`、`:1873` 吻合。
- 负向用例引用值与实物逐一对齐（见「一般/轻微」中的反例）：`tc_x3` 包内 `workflow.yaml` 的 `name` 确为 `wf_tc_x3_multi`、`tc_j3` 包内 `job.yaml` 的 `name` 确为 `tc_j3_schedule`、`manifest.target.file=ops/op_prompt_review.yaml` ✔ → TC-E4a/E4b/E4c/E4d 的 message 示例值**可直接判真**。

### 抽检为「无问题」的重点项（仅备案）

TC-C2 / TC-O2 / TC-W3 / TC-J2 / TC-R1 / TC-R2a·R2b / TC-S1 的数据集与关键字计数（本轮复算 `TC-S1` 的 `/api/workspaces` 顺序：`ws-005(1m) → ws-004(5m) → ws-001(10m) → ws-002(30m) → ws-003(2h)`，与 `tc_r1/seed.sql` 的 `MAX(created_at_ms)` 逐行相符；`limit=1/2`、`keyword=ws-004`、`keyword=ws-00`、`ws-001` 去重 3→1 全部可判定）；`TC-E3a/E3b/E3d` 的字段名（`timedOut` / `timeoutMs` / `timeoutStepId`）与 crud-05 `:165-166`/`:106` 一致。

---

## R1 修复核对表

### A. `_val2_03_tests.md` 的 严重 / 一般 项

| 原项 | 位置 | 核对方法 | 结论 |
|-|-|-|-|
| **S1** TC-E2a 序列 | `集成测试用例.md:1830-1837` | 读原文 + 与 crud-03 `:735`/`:738`、proposal-01 §15.3 场景 4 比对；grep 旧措辞 | **已落地 ✔**。`:1834`：「`max` = 每轮**尝试次数**（首次执行计入，见 D1）→ 每轮 3 次尝试；执行总次数上限 = `max×3 = 9`…序列为 **activation1 retry1..retry3 → activation2 retry1..retry3 → activation3 retry1..retry3**」；`:1835`「第 9 次执行后**不再产生第 10 条 A 记录**」；`:1836` 第 4 步已改为聚合字段+排序校验。grep `min(3×3`=0、`max+1`=0。与 crud-03 `:735`「本轮尝试计数 = 同 `(run_id, step_id, activation_seq)` 下的记录数（首次执行计入）」、`:738`「`0`/未设置 = 不施加绝对上限、仍受 `max × 3` 约束」逐句一致 |
| **S2** TC-E2c 可构造性 | `:1848-1857` | 读原文 + 与 `tc_e2_loop.zip` 实物拓扑比对 + §15.4 `:2372` 语义 | **已落地 ✔**。前置 = 同夹具 + `{on:success, max:3}` + A **恒失败**（`op_tc_e2_fail` content `exit 1`）；回跳环在实物中存在（`A🔴on_failure→C`、`C🔵always→A`），故「失败即回跳、每轮仅 1 次尝试、永不满足连续成功」可构造；断言（A 共 9 条、`activationSeq 1..9`、`retrySeq` 均 1、Run `failed`）**可判定**；`:1856` 第 3 步对照（恒成功 → 连续 3 次 → `success`）与 §15.4 场景 1 一致。grep `恒成功、`retry.max=3``=0 |
| **S3** TC-X5b3~b8 断言 | `:1417-1481` | 逐例读前置与断言 | **已落地 ✔**。6 例第 2 步统一为「**修复目标后** 为 `status=success`，**未修复** → 仍 `failed`」（`:1426/1437/1448/1459/1470/1481`），并在通用口径 `:1310` 补「失败重跑取值口径（b1–b8 统一）」。grep `运行历史新增记录，status=success`=0 |
| **G1** §7 夹具 / 映射表 | `:1769-1775`、`:26-28` | 读映射表 + 新夹具实物核对 | **已落地 ✔**。映射表按 E1/E2/E3 三行给出数据来源与构造步骤；夹具表新增 `tc_e2`（`:26`）、`tc_e3`（`:27`）与「无独立 fixture」行（`:28`）；新夹具实物与用例前置逐条吻合（见「统计·夹具专项证据」） |
| **G2** TC-E1a waiting 计数 | `:1782`、`:1786` | 读原文 + crud-06 `:78`/`:92`、crud-04 `:328` 比对 | **部分落地**：构造侧已改为可复现配置（「**同时**调低 `job_queue_running_max=1` 与 `job_queue_waiting_max=2`」并写明只调 waiting 会失败的机理），但**第 1 步的提交节奏仍不可靠** → 见「一般 G-2」 |
| **G3** `retry.on=failed`→`failure` | `:154`、`:156`、`:1897`、`:1907`、`:1909`、`:1912`、`:1917` | 全文 grep | **已落地 ✔**。`retry.on=failed`=0、`on_failed`=0、`on:failed`=0；`retry.on=failure`=8 处，均在位 |
| **G4** 节点级 `timeoutSeconds` | `:1883`、`:1913`、`:1893`、`:1867` | grep 全部 13 处 `timeoutSeconds` 出现点 | **已落地 ✔**。无「节点级」写法残留；`:1883`/`:1913` 均改为「A 节点**引用的 OP**：`timeoutSeconds=1`…」并显式注「**`timeoutSeconds` 是 OP 字段，WorkflowNode 无此字段**（proposal-01 §14.1）」 |
| **G5** `0`=不限制文案 | `:151`、`:1862`、`:1863`、`:1867` | grep | **已落地 ✔**。「不施加绝对上限」7 处；`:1867` 补「`0` **不参与 `min` 取小**（否则 `min(9, 0) = 0` 与结论矛盾）」；旧串 `0`=不限制（超时兜底）`=0 |
| **G6** X5e1a/e1b 映射 | `:1308`、`:1656` | 读原文 | **已落地 ✔**。改为「**新建 3 个 op 节点（A→B→C）的 Workflow**…」，并显式警告 `tc_x3_multi.zip` 只有 2 个节点、**不可**当骨架复用 |
| **G7** 名称锚 400 负向用例 | `:1921-1971`、`:157-160`、`:804`、`:942` | 读 4 例 + 与 D10/D11/D12、crud-03 `:503-508`、crud-04 `:504-508` 比对 + 与实物值比对 | **已落地 ✔**。四类锚齐全（A=`manifest.workflow.name`、B=`manifest.target.name`、C=`manifest.job.name`、D=`manifest.ops[].name`），message 均为 D11 格式且**取值与实物一致**；`:1927` 的 D12 顺序（①解析 ②名称锚 ③kind ④同名 ⑤Client）与 crud-03 `:493-499` 逐序一致；`:1940`/`:1949` 覆盖「名称锚优先于同名 409」「名称锚先于 kind」 |
| **G8** TC-S1 夹具与写实 | `:1745`、`:1757-1760` | 与 `tc_r1/seed.sql` 逐行复算 | **已落地 ✔**。前置改为 DB 注入 `tc_r1/seed.sql`（5 个工作区、`ws-001` 3 条）；顺序、`limit`、`keyword`、去重四项**全部可判定且与 seed 相符** |

### B. `_val2_03_tests.md` 的 轻微 1–11

| 原项 | 核对结果 |
|-|-|
| 轻微 1 夹具表 ID 写法 | **✔** `:21` 已是 `TC-R1 / R2a / R2b / R3`（grep `TC-R1 / R2 / R3`=0） |
| 轻微 2 章节标题 | **✔** 新增 `### 6.1 重跑 / 重试 / 终止（X5 系列）`（`:1293`）、`### 6.2 配置与系统（TC-S1）`（`:1739`）、`### 8.`（`:1921`），与统计表模块一一对应 |
| 轻微 3 统计表行序 | **✔** `:1984-1987` 已按正文序（跨页面联动 → 配置/系统 → 错误族矩阵 → 导入校验） |
| 轻微 4 opId 占位口径 | **✔** `:34` 新增「占位 id 口径（夹具说明）」 |
| 轻微 5 汇总/详细标题对齐 | **部分**：E1a/E2a/E2d/E3c/E3e 已对齐；**新增 4 例（E4a–E4d）不一致** → 见「轻微 M-2」 |
| 轻微 6 `uptimeMs` | **✔** `:1747` 改为「进程已运行**毫秒数**（字符串），**单调不减**（间隔 N 秒两次调用差值 ≈ N×1000）」，并写实 `activeRuns = 1` |
| 轻微 7 E1a 前置 OP 数 | **✔** `:1783`「导入 `op_tc_e3_longrun.yaml`；[新建] **2 个**引用该 OP 的 Job（Job-A queue / Job-B parallel）」 |
| 轻微 8 E1a 第 3 步可执行 | **✔** `:1784` 补「预置 1 条**终态** Run（供第 3 步的 [重跑]/[重试] 入口）」 |
| 轻微 9 终止术语 | **✔** `:1610`/`:1630`/`:1650` 统一为「Run 状态变为 `cancelled`（存在在跑 OP → 先 `terminating`，收敛后 `cancelled`）」；grep `Job 状态变为 cancelled`/`Workflow 状态变为 cancelled`=0 |
| 轻微 10 E3e `max+1` | **✔** `:1916`「共 **max = 3** 次尝试（D1）→ … → 按 V11-B **整个 Run `failed`**」 |
| 轻微 11 步骤区尾部注 | **✔** `:1578` 已改为块引用 `> **注**：单 OP 的唯一 kill 来自其自身 `timeoutSeconds` 到期。` |

### C. `_fix_v2_decisions.md` 中与测试面相关的拍板

| 拍板 | 核对结果 |
|-|-|
| **D1**（`max`=每轮尝试次数） | **✔** 测试面唯一受影响处（`:1834`、`:1916`）已按 3/3/3 与「共 max=3 次」写实 |
| **D3/D4/D5**（节点 `clientId` 必填 / `unbound` / Client 类型匹配） | **✔** 新夹具满足前提：`tc_e2/workflow.yaml:8-9` 两 op 节点均带 `clientName: bash-build`，`manifest.clients` 同名单一；两节点 `bindings: {}` 而其所引 OP 均无 required 入参（`inputs: []`），不触发「无来源」判据 |
| **D11/D12**（message 格式 / 校验顺序） | **✔** 见 G7 行（格式与顺序均一致） |
| **D13**（被测前端 = `ui/`） | **✔** `:9`「**被测前端 = T2 产出的 `ui/`**（真实 `fetch('/api/…')`…）…`原型图/` 下的 6 个 HTML **仅作原型演示，不作验证依据**」；`:10` Mock 数据「**不作为验证依据**」；`:60` P0 定义已删「前端 mock 数据」改为「一次性导入 fixtures，或 DB 注入 seed.sql；**不得以 mock / 原型数据代偿**」 |
| **D14**（`max_loop_multiplier=0`） | **✔** `:151`、`:1845`、`:1862`、`:1867`、`:1754` 口径统一 |
| 低成本 4（`bash-build` 保留） | **✔** `:1220` 已改「**保留该名**（用户已拍板），后续不得改名」 |
| 低成本 5（`tc_x3_multi.zip` 按声明序重打包） | **✔** 成员序与 4 个成员 SHA256 已复核（见「统计·夹具专项证据」） |
| D6（重试续跑） / D15 / D16 / D17 | 无需测试面改动（重试种子为后端契约）；用例只断言可观测行为（`:1660`「从失败节点 B 开始，已成功节点 A **不重复执行**」、`:1671`）**✔** |

### D. `_val2_05_new.md` 中涉测试部分的落地

| 原项 | 核对结果 |
|-|-|
| S1/E2c、S2/E2a（与 `_val2_03` 的 S2/S1 同源） | **✔** 见 A 表 |
| S3/E1a·E1d 前提 | **部分** → 见「一般 G-2」 |
| M5/ZIP 成员序 | **✔** 已按声明序重打包 |
| M6/被测前端口径 | **✔** 见 D13 行 |
| L1「记 error 日志」 | **✔** `:1790`「**不报错、无前端提示**，本轮跳过、**不创建 Run**（是否记日志不作断言）」+ 补「**该 Job 自身无在途实例**」 |
| L2 `min(3×3, 0 不限制)` | **✔** 已删，改为「`max×3 = 9`；`max_loop_multiplier=0` 不参与取小」 |
| L3 E2a 第 4 步重复断言 | **✔** `:1836` 改为聚合字段+排序校验 |
| L4 E3b「B 无执行记录（或不存在）」二义 | **✔** `:1887` 固定为「steps **仅含 A**（B 无 step_record…）」 |
| L5 E3d 改 OP 破坏重试条件 | **✔** `:1906` 补注「修改 OP 时须选「不更新版本」…否则…会误报 `RETRY_NOT_ALLOWED`」 |
| L6 E3e「Workflow 单节点 A」 | **✔** `:1913` 改为「`Start → A → End`（A 为**单个 op 节点**…）」 |
| L7 §7 节首依据不全 | **✔** `:1767` 已补 `crud-03 4.3.0/4.3.1/4.3.2`、`crud-05 4.6`、`crud-06 3.4/四` |
| L8 统计表行序 | **✔** 见 轻微 3 |
| L11 E2d 生效时机 | **✔** `:1865` 补「**改动在下次 Run 读取配置时生效**；若当次未生效，重试或重启后重跑」 |

> 结论：`_val2_03_tests.md` 的 S1–S3、G1–G8、轻微 1–11、与 `_val2_05_new.md` 涉测试项**除 G2/E1a 第 1 步的提交节奏外全部落地**，且未发现旧措辞残留（第 11 行 grep 全 0）。

---

## 严重

**无。** 本轮未发现新增的严重问题；`_val2_03_tests.md` 的 3 项严重问题均已修复且修复后与规格自洽（见 R1 表 S1/S2/S3）。第 1 轮由校验方报出的「ZIP 与源目录不一致」「统计表数字不符」「步骤跳号」「悬空引用」等亦**全部复核通过**。

---

## 一般

### G-1 `E 系列数据来源映射` 的 E1 行把 Job 的 `target` 一律写成 `OP`，与 TC-E1b 的前置/步骤直接冲突（且未给 E1b 的 Workflow 构造步骤）

- 原文 A（映射表 E1 行）`tests/集成测试用例.md:1773`：
  > `| E1a / E1b / E1c / E1d | 并发（waiting 深度 / skip / 在途删除） | 无 ZIP：按各例前置的确定性构造。long-run OP 用 `tc_e3/op_tc_e3_longrun.yaml`，Job 用界面 [新建]（target=OP，`concurrency` 按例取 queue / parallel / skip）；**E1a / E1d 必须同时调低 `job_queue_running_max=1` 与 `job_queue_waiting_max=2`**…`
- 原文 B（TC-E1b 前置）`:1797`：
  > `- **前置条件**：`concurrency=skip` 的 Job（target=workflow，long-run 节点）；运行历史可用。`
- 原文 C（TC-E1b 第 3 步）`:1801`：
  > `3. 对在途 Run 提交 [终止]（target=workflow）→ Run 进入 `terminating`（等待在跑 OP 收敛）。`
- 问题：映射表说 E1 的 Job 一律 `target=OP`；而 TC-E1b **必须** `target=workflow`——否则第 3 步的 [终止] 会按 `target=OP 且 running` 落 **409 `RUN_NOT_TERMINABLE`**（该口径由同文档 `:1813` 自己给出：`3. 提交 [终止]（target=op 且已 running → 预期 **409 `RUN_NOT_TERMINABLE`**…）`），TC-E1b 第 4 步的「terminating 仍占在途名额」断言随之不可构造。同时 E1b 需要「含 long-run OP 节点、且节点已绑 Client」的 Workflow，映射表与 `:28`（「E1 复用 `tc_e3` 长运行 OP + 按需 [新建] Job」）都未给该 Workflow 的构造步骤（其余 E1 例均为直接 [新建] OP Job）。
- 建议改法：映射表 E1 行的 Job 描述按例分列——`E1a / E1c / E1d：Job [新建]（target=OP，`concurrency` 取 queue / parallel）`；`E1b：Job [新建]（target=Workflow，`concurrency=skip`），其 Workflow 在编辑器中新建 `Start → L（引用 `tc_e3/op_tc_e3_longrun.yaml`，绑 bash-build）→ End` 并 [保存]`；并在 `:1797` 前置把该构造写成 ①②③ 子项。

### G-2 TC-E1a 第 1 步「连续提交 3 个」与全局 waiting 上限的判定时点冲突，`各返回 {runId}` 与最终 `running=1 / waiting=2` 不可稳定复现

- 原文 `tests/集成测试用例.md:1786`：
  > `1. 连续提交 **3 个** long-run 任务（Job-A [运行] + Job-B [运行] + 单次执行该 OP）→ 预期：各返回 `{runId}`；**等待 ≥1 个轮询周期后复核** `job_runs` → `running` 计 **1**、`waiting` 计 **2** = `job_queue_waiting_max`。`
- 规格依据（判定式为 **≥**、且检查发生在**插入之前**）：`proposal-02-后端crud-04job管理.md:328`
  > `它是 **全局 waiting 队列深度上限**（非 Job 级）——判定为 `SELECT count(*) FROM job_runs WHERE status='waiting'`（**全局、跨 Job**）≥ 配置项 `job_queue_waiting_max`…→ 409 `CONCURRENCY_CONFLICT``
- 问题：本次前置已把 `job_queue_waiting_max=2` 调低。若三次提交落在同一 `runner_poll_interval_ms`（默认 1000ms）周期内（第一次尚未被提升为 `running`），则第 3 次提交时 `waiting` 已计 **2 ≥ 2** → 直接 **409**，与「**各返回 `{runId}`**」矛盾；此时也不可能复核出 `running=1 / waiting=2`。本项正是 R1 判定「G2/S3 前提不可复现」后所改的步骤，属**同一问题的残余形态**（由「阈值太高」变为「提交节奏未限定」）。
- 建议改法（二选一，前者零依赖）：① 把第 1 步改为分批提交——「先提交 **1 个** → 等 ≥1 轮询周期（或轮询 `GET /api/system/status` 确认 `activeRuns=1`、再查 `job_runs` 确认 `waiting=0`）→ 再连续提交 **2 个** → 复核 `running=1 / waiting=2`」，并保留「各返回 `{runId}`」；② 或把 `job_queue_waiting_max` 提到 3、提交 4 个任务（`running=1 / waiting=3`），断言随之改为 `= job_queue_waiting_max`。TC-E1d 第 2 步（`:1823`）已自带「等待 ≥1 轮询周期后复核」且只提交 2 个，**不受本项影响**。

---

## 轻微

### M-1 `§8` 的 message 示例把 **Client 名** 当 `manifest.target.name` 用，与同节 4 例的自证值不一致

- 原文 `tests/集成测试用例.md:1925`：
  > `…`message` 形如 `名称锚不一致：manifest.<锚字段>=<值>，<包内路径> 内 name=<值>`（例：`名称锚不一致：manifest.target.name=bash-build，ops/op_bash_build.yaml 内 name=op_bash_build`）；前端**原样展示 message**（不解析）。`
- 问题：`bash-build` 是 **Client 名**（`tests/fixtures/tc_c2/tc_c2_05.yaml`、`:417`/`:425`），而 `manifest.target.name` 只能是 OP / Workflow 名（crud-04 `:460`）。同节 TC-E4b（`:1948`）用的才是正确形态（`manifest.target.name=op_renamed，ops/op_prompt_review.yaml 内 name=op_prompt_review`）。该示例系照抄 D11 原文（`proposal-02-后端设计.md:367`），与本文件自身取值口径冲突。
- 建议改法：把 `:1925` 的示例改为与实物一致的值，例如
  `名称锚不一致：manifest.target.name=op_renamed，ops/op_prompt_review.yaml 内 name=op_prompt_review`
  （与 TC-E4b 第 1 步同值），并在 `_fix_v2_decisions.md` 的 D11 行与 `proposal-02 §10.1`/`crud-03:507`/`crud-04:508` 同步替换（跨文件项，见「需拍板 D-3」）。

### M-2 新增 4 例的汇总名称与详细标题前缀不一致（`导入校验-` vs `导入-`）

- 原文：`tests/集成测试用例.md:157`「`| TC-E4a | 导入校验-manifest.workflow.name 名称锚不一致 → 400 |…`」vs `:1931`「`#### TC-E4a 导入-manifest.workflow.name 名称锚不一致 → 400`」（E4b/E4c/E4d 同形：`:158`↔`:1942`、`:159`↔`:1952`、`:160`↔`:1962`）。
- 问题：机械比对 90 例「汇总名称 ↔ 详细标题」仅这 4 例不符（`total mismatches: 4 / 90`），属 R1 轻微 5「标题对齐」未覆盖新增行。
- 建议改法：统一为 `导入校验-manifest.<锚> 名称锚不一致 → 400`（四处详细标题加「校验」二字），或反向删去汇总里的「校验」。

### M-3 TC-E1a 的前置标签仍是变体，与其他 89 例写法不统一

- 原文 `tests/集成测试用例.md:1781`：「`- **前置条件**（可复现配置；数据来源见本节「E 系列数据来源映射」）：`」
- 问题：全篇其余 89 例均为 `- **前置条件**：`（机械核对：`前置条件` 标签形态集合仅 `''` 与 `'（可复现配置；数据来源见本节「E 系列数据来源映射」）` 两种，后者仅 1 处）；R1 曾把 7 处同类变体统一，本处为新增行。
- 建议改法：改为 `- **前置条件**（数据来源见本节「E 系列数据来源映射」）：` 或 `- **前置条件**：` 并把说明移入正文。

### M-4 E3 映射行未给「立即失败 OP」的数据来源，而 TC-E3e 第 2 步要求用它

- 原文 A `tests/集成测试用例.md:1775`（E3 行）：`…导入 `tc_e3/op_tc_e3_timeout.yaml`…与 `tc_e3/op_tc_e3_longrun.yaml`；E3b / E3c / E3e 在 Workflow 编辑器新建…`
- 原文 B `:1916`：`2. 与失败场景对照：若 A 引用的 OP 改为**立即失败**（content `exit 1`）→ 触发自动重试…`
- 问题：`tc_e3/` 只有超时与长运行两个 OP，无「立即失败」OP；映射表 E3 行也未指向现成的 `tc_j2/op_always_fail.yaml`（或 `tc_e2/op_tc_e2_fail.yaml`），读者需自造。
- 建议改法：` :1916` 括号内补「（现成夹具：`tc_j2/op_always_fail.yaml`（`timeoutSeconds=30`、content `exit 1`），或在编辑器把 A 的引用指向 `tc_e2/op_tc_e2_fail`）」；并在 E3 映射行补「失败对照 OP 复用 `tc_j2/op_always_fail.yaml`」。

### M-5 TC-E1c 第 1 步的 `waiting` 态在缺省并发阈值下难以稳定观察

- 原文 `tests/集成测试用例.md:1809-1811`：
  > `- **前置条件**：Job（target=op，long-run）；先 [运行] 创建在途 Run。` / `1. Run 处于 `waiting` → [删除] Job → 预期：**409 `JOB_HAS_ACTIVE_RUNS`**。`
- 问题：本例未调低 `job_queue_running_max`（默认 10，crud-06 `:78`），新 Run 在 **1 个轮询周期（1000ms）内**即被提升为 `running`，第 1 步的 `waiting` 前置多为竞态观测（第 2 步的 `running` 断言不受影响）。
- 建议改法：仿 TC-E1a/E1d，在前置补「先调 `job_queue_running_max=1` 并让另一个 long-run 任务占住 running 名额（或直接沿用 TC-E1a 环境），使新 Run 稳定停留 `waiting`」，并在末步恢复配置。

### M-6 TC-E1d 前置引用「TC-E1a 前置 1–3」，其中第 3 项与本例无关

- 原文 `tests/集成测试用例.md:1820`：`- **前置条件**：同 TC-E1a 环境（`job_queue_running_max=1`、`job_queue_waiting_max=2`；构造步骤见 TC-E1a 前置 1–3）。`
- 问题：TC-E1a 前置 3（`:1784`「预置 1 条**终态** Run（供第 3 步的 [重跑]/[重试] 入口）」）只为 E1a 第 3 步服务；E1d 无 [重跑]/[重试] 断言，多造一条终态 Run 反而会干扰第 1 步的 `activeRuns` 读数解释（终态 Run 不计入，但读者需自行排除）。
- 建议改法：改为「构造步骤见 TC-E1a 前置 1–2」，并在第 1 步补「本例环境无在途 Run → `activeRuns=0`」。

### M-7 TC-E4a 前置给出两个可选包，但第 1 步只断言 `tc_x3` 包的值

- 原文 A `tests/集成测试用例.md:1935`：`- **前置条件**：Workflow 包 = `tc_x3_multi.zip`（或 `tc_e2_loop.zip`）；按「负向包构造」把 `manifest.json` 的 `workflow.name` 改为 `wf_mismatch`（包内 `workflow.yaml` 的 `name` 仍为 `wf_tc_x3_multi`）。`
- 原文 B `:1937`：`1. `POST /api/workflows/import`（`{zip}`）→ 预期：**400 `VALIDATION_ERROR`**；`message` = `名称锚不一致：manifest.workflow.name=wf_mismatch，workflow.yaml 内 name=wf_tc_x3_multi`。`
- 问题：若测试者按「或 `tc_e2_loop.zip`」执行，实际 message 中包内 `name` 应为 `wf_tc_e2_loop`（实物已核：`tc_e2/workflow.yaml:1`），与 B 的断言不符。
- 建议改法：前置固定为 `tc_x3_multi.zip`（另一路径移入「可选补充」并写明对应期望 message），或把 B 写成两种包各自的期望值。

### M-8 ZIP 容器体例不一致：重打包的两个包与其余 4 个包的容器元数据不同

- 事实（`zipfile` + local header 解析）：
  - `tc_e2/tc_e2_loop.zip`、`tc_x3/tc_x3_multi.zip`：`ExternalAttributes=0`、`flag_bits=0`、条目时间统一 `2026-10-14 12:02:16`；
  - `tc_j3/tc_j3_schedule.zip`、`tc_x4/*.zip`（3 个）：`ExternalAttributes=0x81A40000`（Unix `-rw-r--r--`）、`flag_bits=8`（UTF-8 名标志）、条目时间各异。
- 问题：成员内容/顺序/数量均已一致（统计第 6、7 行），**不影响解包与导入**；但 `:22`/`:26` 声明「端到端可逐字节比对」的校验脚本若比对 ZIP 容器元数据（时间戳/属性/标志位），跨这两个谱系会**假失败**（R1 报告称「与既有 fixture 体例一致」，与该 4 个包并不一致）。
- 建议改法（低优先）：统一用一种方式生成 6 个 ZIP（建议 Python `zipfile`，与多数包同谱系），或在 `:22`/`:26` 注明「逐字节比对仅针对**成员内容与成员顺序**，不含容器元数据」。

---

## 需拍板

| # | 待定问题 | 影响面 | 建议 |
|-|-|-|-|
| D-1 | `job_queue_running_max` 的**下限**未在规格中定义（crud-06 `:286` 仅给上限 10），而 `tests:1782`/`:1820` 依赖可设为 **1**（`_val2_05_new.md` 的 Q2 遗留） | TC-E1a / TC-E1d 能否按书写构造 | 在 crud-06「数值项上限」表补一行下限（`job_queue_running_max`：**1..10**）或在字段表注「整数值 ≥1」；随后 `tests:1782`「（下限定为 1，上限 10）」即为有据表述 |
| D-2 | `proposal-01:2309`（§15.2 字段表）仍写 `max` = **每轮重试次数**，与 D1 拍板的「每轮**尝试次数**」及本文件 `:1834`、§15.3 场景 4（`A[1~3]` 每轮）措辞相反 | 读者/实现者可能反推「4 次/轮」，与 TC-E2a 的 3/3/3 冲突（文件归属 proposal-01，测试面不能自改） | 由 proposal-01 修复者把该格改为「每轮**尝试次数**（首次执行计入）」，与 crud-03 `:735` 同步 |
| D-3 | D11 的**固化示例** `manifest.target.name=bash-build`（`proposal-02-后端设计.md:367`、`crud-03:507`/`crud-04:508`、`tests:1925`）语义有误（`bash-build` 是 Client 名） | 4 份文件的示例一致性、以及是否影响 T2 的展示预期 | 采纳本报告 M-1 的替换值（`op_renamed`/`op_prompt_review`），一次性同步 4 处（`_val3_05_global.md` 的 N-11 同源） |
| D-4 | `manifest.clients[].clientId` 在导入时**是否需要校验唯一/存在**（`_val2_05_new.md` Q4 遗留）：`tests:1220` 称「仍应唯一」，而 crud-03 `:456`/crud-04 `:451` 无任何校验规则 | 是否需补用例与夹具校验脚本（当前 `tests:34` 仅以「占位 id 口径」规避） | 若维持「只记录名称↔id 对应关系、不校验」则无需补；若要求唯一，须先在 crud-03/04 增规则，再补 TC-E4 系列用例 |

---

## 修复顺序建议

1. **G-1（E1b 的 target 与构造步骤）**——映射表与前置的直接矛盾，且决定 TC-E1b 第 3/4 步能否执行；改动集中在 `:1773`、`:1797`、`:28` 三处。
2. **G-2（TC-E1a 第 1 步提交节奏）**——一句节奏说明即可闭合 R1 的 G2 残余，避免 P3 用例首步假失败。
3. **M-1 / M-2**（示例值错、标题前缀不一致）——纯文本、零依赖，可立即改；M-1 需与 D-3 的跨文件替换同批执行。
4. **M-4 / M-5 / M-6 / M-7**（数据来源补指、E1c waiting 前提、E1d 前置收敛、E4a 二选一）——逐条小改，均为「让断言可判定」。
5. **M-3**（E1a 前置标签统一）与 **M-8**（ZIP 容器体例注明）——文案/注释级收尾。
6. **移交项**：D-1（crud-06 补下限）、D-2（proposal-01 §15.2 措辞）、D-3（D11 示例同步）、D-4（clientId 唯一性）——按归属方执行，测试面等待结论后再决定是否补用例。

> 备注：本轮**未发现**用例 ID 重复、条数/优先级与统计表不符、步骤跳号、缺标题、ZIP 与源目录字节不一致、成员序偏离声明序、manifest 名称锚不符、悬空引用等问题——这些项经机械核对全部通过（见「统计」第 1–13 行）。旧措辞（`retry.on=failed`/`on_failed`/`max+1`/`min(3×3,0)`/节点级 `timeoutSeconds`/`前置条件（…` 变体等）经 grep 确认 **0 残留**。
