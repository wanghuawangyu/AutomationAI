# 修复报告（第 2 轮 · 测试面 E）—— `tests/集成测试用例.md` + `tests/fixtures/**`

> 修复者：修复者-E（测试面）。口径依据：`_fix_v2_decisions.md`（唯一权威，未写入该文件）。
> 校验发现来源：`_val2_03_tests.md`（S1–S3 / G1–G8 / 轻微 1–11 / D1–D6）、`_val2_05_new.md`（S1–S3 / M5 / M6 涉测试部分）。
> 改动文件（`git status --porcelain -- docs/cli非交互式/tests`）：
> `tests/集成测试用例.md`（M）、`tests/fixtures/tc_x3/tc_x3_multi.zip`（M，重打包）、`tests/fixtures/tc_e2/**`（?? 新增）、`tests/fixtures/tc_e3/**`（?? 新增）。
> 未触碰其它任何文件（`tc_x3/manifest.json` 的 M 状态为本轮之前已有改动）。

## 已修项表

| 项号 | 位置（文件:行） | 改法 | 证据 |
|-|-|-|-|
| D13 测试环境 | `集成测试用例.md:9-10` | 「前端原型」改为「**被测前端 = T2 产出的 `ui/`**（真实 `fetch('/api/…')`）」；明确 `原型图/` **仅原型演示、不作验证依据**；Mock 数据行改为「不作为验证依据，数据来源只有 fixtures 导入 / `seed.sql` 注入」 | grep：`前端原型：`=0；`mock`/`原型` 仅余 4 处且均为「不作依据 / 演示说明」语义（9/10/60/1220） |
| D13 P0 定义 | `:60` | 「前端 mock 数据，或一次性导入 fixtures…」→「一次性导入 fixtures，或 DB 注入 seed.sql；**不得以 mock / 原型数据代偿**」 | grep：`用**预置静态数据**即可验证（一次性导入 fixtures` =1 |
| 夹具表 | `:21`, `:22`, `:26-28`, `:34` | ①ID 写法 `TC-R1 / R2 / R3` → `TC-R1 / R2a / R2b / R3`（清悬空引用）；②`tc_x3_multi.zip` 补「成员序同 crud-03 3.3.8 导出序」；③新增 `tc_e2`/`tc_e3` 两行 + E1/E4「无独立 fixture」行；④新增「占位 id 口径（夹具说明）」bullet（opId 等占位值不要求跨夹具唯一） | grep：`TC-R1 / R2 / R3`=0；`TC-R1 / R2a / R2b / R3`=1；`占位 id 口径`=1 |
| 汇总列表 | `:143`（E1a）、`:147`（E2a）、`:149`（E2c）、`:151`（E2d）、`:154`（E3c）、`:156`（E3e）+ 新增 `:157-160`（E4a~E4d） | E1a 标题补「（queue/parallel 入口）」；E2a `（max=3）`→`（retry.max=3）`+ 补「每轮 3 次尝试：3/3/3，见 D1」；E2c/E2d 描述写实；E2d 标题对齐详细用例；`on_failed`/`retry.on=failed` → `retry.on=failure`；新增 4 条 E4 行 | grep：`（max=3）`=0；`on_failed`=0 |
| **S1** TC-E2a | `:1831-1837` | 按 D1（`max`=每轮**尝试次数**，首次计入）重写：序列 **activation1 retry1..3 → activation2 retry1..3 → activation3 retry1..3（3/3/3，共 9 条）**；删 `min(3×3, 0 不限制)` 数学错误，改为「上限 = `max×3 = 9`，`max_loop_multiplier=0` 不参与取小」；第 3 步改「不再产生第 10 条 A 记录」；第 4 步改为校验聚合字段（status/`durationMs`/排序），不再重复第 2 步断言；新增 `> **注**` 说明 C 的次数取决于上限判定时机、不作断言 | 见「机械自检」第 3/4 节；`min(3×3, 0 不限制)`=0 |
| **S2** TC-E2c | `:1850-1858` | 前置改为**可判定构造**：同 E2a 夹具（`tc_e2_loop.zip`，拓扑同 §15.4）+ A 节点 `retry={on:success, max:3}` + **A 恒失败**（任意失败立即回跳、每轮仅 1 次尝试、永不满足「连续成功 N 次」）→ 累计 9 次后 Run `failed`；新增第 3 步「累积语义对照：A 连续成功 3 次 → Run `success`（不触顶）」 | grep：`恒成功、`retry.max=3``=0；`{on:success, max:3}`=1 |
| **S3** TC-E1a | `:1780-1791` | 前置改为可复现配置：**同时**调低 `job_queue_running_max=1` 与 `job_queue_waiting_max=2`（并写明「只调 waiting 会因缺省 running_max=10 在一个轮询周期内全部转 running、waiting 回落 0」的失败原因）；改用 1 个 long-run OP（`tc_e3/op_tc_e3_longrun.yaml`）+ 2 个 [新建] Job（修「3 个 OP 只用 2 个」）；第 1 步改「提交 3 个任务 → 等 ≥1 轮询周期复核 → running=1 / waiting=2」；第 3 步补终态 Run 前置 + 校验顺序（waiting 409 优先于 `RERUN_/RETRY_NOT_ALLOWED`）；第 5 步去掉「记 error 日志」并补「该 Job 自身无在途实例」；第 4/6 步恢复清单含 `job_queue_running_max` | grep：`（waiting_max=2）`=0、`记 error 日志、不创建 Run`=0、`job_queue_running_max=1`=7 |
| **S3** TC-E1d | `:1819-1825` | 同步环境（running_max=1 / waiting_max=2）；第 2 步改为「只提交 2 个任务（running=1 + waiting=1 = max-1）→ 再运行 200」；第 3 步写明触顶后 409 与恢复路径；第 4 步恢复两项配置 | 同上 |
| **S3** TC-X5b3~b8 | `:1411-1478` | 6 例断言由无条件 `status=success` 改为条件式：「**修复目标后** 为 `status=success`，**未修复** → 仍 `failed`」；并在 X5 通用口径补「失败重跑取值口径（b1–b8 统一）」说明 | grep：`运行历史新增记录，status=success`=0 |
| **D14** | `:147`（汇总）、`:151`（汇总）、`:1818`（E2b）、`:1846-1862`（E2d）、`:1750`（TC-S1 4.3） | `0` = **不施加绝对上限、仍受 `max×3` 约束（=9）**，并写明「`0` 不参与 `min` 取小（否则 `min(9,0)=0` 与结论矛盾）」；E2d 第 3 步与标题同步（标题 `…与 0=不施加绝对上限`）；E2d 第 1 步补「改动在下次 Run 读取时生效」 | grep：`0`=不限制（超时兜底）`=0、`不限制（按 `max×3=9` 触顶失败）`=0、`不施加绝对上限`=6 |
| **G3** | `:154`, `:156`, `:1897`, `:1907`, `:1909`, `:1912`, `:1917` | 全文枚举值改为真实值 `retry.on=failure`；标题/描述里的 `on_failed` 改为「`retry.on=failure`（节点自动重试）」 | grep：`retry.on=failed`=0、`on_failed`=0、`on:failed`=0；`retry.on=failure`=8 |
| **G4** | `:1888`, `:1893`, `:1911` | 把节点级 `timeoutSeconds` 改为「A 节点**引用的 OP**：`timeoutSeconds=1`、content `sleep 5`」，并显式注明「`timeoutSeconds` 是 OP 字段，WorkflowNode 无此字段（proposal-01 §14.1）」 | grep：`timeoutSeconds=1, sleep 5`=0；`WorkflowNode 无**此字段`=2 + `无此字段`=1 |
| **G1** | `:1765-1776`（§7 节首 + 映射表） | 新增「E 系列数据来源映射与构造步骤」表（E1 / E2 / E3 三行，逐例给数据来源与构造步骤）；节首依据补齐 `crud-03 4.3.0/4.3.1/4.3.2`、`crud-05 4.6`、`crud-06 3.4/四`（L7） | grep：`E 系列数据来源映射`=1；L7 依据字符串在位 |
| **G1 夹具** | `fixtures/tc_e2/**`、`fixtures/tc_e3/**`（新增） | 新建回跳拓扑 Workflow 包 `tc_e2_loop.zip`（A=`op_tc_e2_fail` 恒失败 + C=`op_tc_e2_ok` 恒成功 + `retry={on:failure,max:3}`）与超时/长运行 OP（`op_tc_e3_timeout.yaml` / `op_tc_e3_longrun.yaml`），使 §7 可真正执行 | 见「ZIP 校验证据」 |
| **G2** | `:1782-1791`（见 S3 TC-E1a） | waiting 计数断言改为轮询周期后复核 + 双阈值构造 | 见 S3 行 |
| **G5** | `:151`（汇总）、`:1846-1862`（E2d 第 3 步） | `0`=不限制（超时兜底）→ 不施加绝对上限、仍受 `max×3` 约束；E2d 与自身第 3 步不再冲突 | grep：`不限制（按 `max×3=9` 触顶失败）`=0 |
| **G6** | `:1303`（X5 映射表 e1a/e1b 行） | 改为「**新建 3 个 op 节点（A→B→C）的 Workflow**，B 引用 `tc_j2/op_always_fail.yaml` 并在包内带 `ops/`，A/C 引用可成功 OP，按 Workflow 包体例打包导入」，并警示 `tc_x3_multi.zip` 只有 2 节点、**不可**当 A→B→C 骨架；`:1652` TC-X5e1a 前置同步 | grep：`不可**当作 A→B→C 骨架复用`=1 |
| **G7** | 新增 `:1921-1968`（`### 8. 导入校验错误族（名称锚一致性 → 400）`）+ 汇总 `:157-160` + TC-W2 `:804` / TC-J1 `:942` 负向回归指针 | 4 例负向用例：`TC-E4a`（`manifest.workflow.name`）、`TC-E4b`（`manifest.target.name`）、`TC-E4c`（`manifest.job.name`）、`TC-E4d`（`manifest.ops[].name`），各断言 **400 `VALIDATION_ERROR`** + message 符合 D11 格式 + 整体回滚（D12 顺序：名称锚 400 优先于同名 409）；附「负向包构造」统一做法；E4d 另含「不校验文件名、只校验文件内容 name」反例（200） | grep：4 个 message 样例各在位；`### 8. 导入校验错误族`=1；`TC-E4a..d` 各 ≥3（汇总+详细+指针） |
| **G8** | `:1743`（前置）、`:1755`（第 6 步）、`:1756-1758`（6.1/6.2/6.3） | 前置改为直接引用 `tc_r1/seed.sql`（DB 注入，5 个工作区、ws-001 有 3 条用于去重）；第 6 步写实顺序 `ws-005(1m) → ws-004(5m) → ws-001(10m) → ws-002(30m) → ws-003(2h)`；6.1 写实 `?limit=1/2` 结果与「不带 limit 全量 5 条」；6.2 写实 `keyword=ws-004` / `ws-00`；6.3 写实去重 | 已按 `tc_r1/seed.sql` 的 `created_at_ms` 逐条复算（ws-005 = now-60s、ws-004 = now-300s、ws-001 = now-600s、ws-002 = now-1800s、ws-003 = now-7200s） |
| 轻微 1 | `:21` | 夹具表 ID 写作 `TC-R1 / R2a / R2b / R3`（清 `TC-R2` 悬空引用） | 见上 |
| 轻微 2 | `:1293`, `:1739` | 新增 `### 6.1 重跑 / 重试 / 终止（X5 系列）` 与 `### 6.2 配置与系统（TC-S1）`，使章节与统计表模块一一对应 | grep：`### 6.1`/`### 6.2` 各 1 |
| 轻微 3 | `:1984-1987` | 统计表行序改为正文顺序：跨页面联动 → 配置/系统 → 错误族矩阵 → 导入校验 | 见「机械自检」第 5 节 |
| 轻微 4 | `:34` | 新增「占位 id 口径（夹具说明）」：`opId`/`workflowId`/`clientId`/`run_id`/`record_id` 均为占位值、不要求跨夹具唯一一致（同包内 `clientId` 仍唯一） | grep：`占位 id 口径`=1 |
| 轻微 5 | `:143`, `:147`, `:151` | 汇总列表与详细用例标题对齐（E1a 补「（queue/parallel 入口）」、E2a `retry.max=3`、E2d 补「与 0=不施加绝对上限」） | 人工比对 |
| 轻微 6 | `:1745` | `uptimeMs` 改为「进程已运行**毫秒数**（字符串），单调不减（间隔 N 秒两次调用差值 ≈ N×1000）」，并写实 `activeRuns = 1`（seed #9 running） | grep 在位 |
| 轻微 7 | `:1783` | E1a 前置由「3 个 OP」改为「1 个 long-run OP + 2 个 [新建] Job」，与步骤用数一致 | 见 S3 行 |
| 轻微 8 | `:1785`（E1a 前置 3） | 补「预置 1 条**终态** Run（供 [重跑]/[重试] 入口）」，使第 3 步在同流程内可执行 | grep 在位 |
| 轻微 9 | `:1598`, `:1616`, `:1626`, `:1646` | X5d4/d6/d8 的「Job/Workflow 状态变为 cancelled」统一为「**Run 状态**变为 `cancelled`（存在在跑 OP → 先 `terminating`，收敛后 `cancelled`）」 | grep：`Job 状态变为 cancelled`=0、`Workflow 状态变为 cancelled`=0 |
| 轻微 10 | `:1913-1916`（E3e 第 2 步） | 「走失败边/终止」二选一写实：「共 **max = 3** 次尝试（D1）→ A 无失败出边（仅 🟢 到 End）→ 按 V11-B 整个 Run `failed`」 | grep：`max+1`=0 |
| 轻微 11 | `:1574` | TC-X5d1 步骤区尾部的 `- 单 OP 的唯一 kill…` 改为块引用 `> **注**：…`，不再被误读为第 4 步 | grep 在位 |
| 前置标签 | `:410`, `:653`, `:724`, `:817`, `:955`, `:1015`, `:1048` | 7 处变体（`（准备步骤…）` / `（确定性 Job，直接导入）` / `（DB 直接注入）`）统一为 `- **前置条件**：` | grep：`前置条件（准备步骤`=0、`前置条件（DB 直接注入）`=0、`前置条件（确定性 Job`=0 |
| 低成本 4 | `:1220` | `bash-build` 命名说明由「暂定名，最终由用户决定」改为「**保留该名**（用户已拍板），后续不得改名」 | grep 在位 |
| 低成本 5 | `fixtures/tc_x3/tc_x3_multi.zip` | 按声明序重打包 `workflow.yaml → manifest.json → ops/op_prompt_review.yaml → ops/op_bash_build.yaml` | 见「ZIP 校验证据」 |
| 统计表 | `:1979-1988` | 新增 `导入校验（名称锚 400） 4/0/0/0/4` 行；合计 `86/4/18/11/53` → **`90/4/18/11/57`** | 实测：详细用例 90、P0 4 / P1 18 / P2 11 / P3 57，与表逐格一致 |

## 未修项与原因

| 项 | 状态 | 原因 |
|-|-|-|
| **S2/S1 的底层口径**（`crud-03:691/1077` 原「记录数−1 ≥ max」） | 未改（非本组文件） | 属 `crud-03` 归属；本轮它处已被同步为 D1 口径（`crud-03:735`「本轮尝试计数 = 记录数（首次执行计入）」、`:738` `0`=不施加绝对上限），测试文档按 D1 写 3/3/3 |
| **C 节点的执行次数**（E2a/E2c 中 C 恰好 2 次还是 3 次） | 不写断言 | proposal-01 §15.3 场景 4（末轮回跳前即失败）与 crud-03 4.3.0 判定时机（仅在即将再次执行同一节点时判定）对该细节给出不同读法，两者均不影响 A 的 9 次与 Run `failed`；故按「可判定优先」只断言 A 与 Run 状态，并在用例内以 `> **注**` 标注该不确定性，避免制造假失败 |
| **D17 `retry_from_step_id` 改名** | 无需修改（本文件无该字段） | grep `retry_from_step_id` = 0；`retry_from_record_id` 亦未出现在测试文档（重试种子为后端契约，测试面只断言 `triggeredBy=retry`、从失败 step 开始等可观测行为） |
| **D13 对 `tasks.md` 的部分**（数据源约定收紧、T2.1 移除 mock） | 未改（非本组文件） | `tasks.md` 属他人负责；测试文档侧已按 D13 改口径，并在测试环境/P0 显式写明「`ui/` 为被测前端、mock 不作依据」，与 `tasks.md` 的收窄口径不冲突 |
| **M6 中 `validation.md` 遗留项同步** | 未改 | `validation.md` 明确禁止修改（本组文件范围外） |
| **Q4（`manifest.clients[].clientId` 导入是否校验唯一）** | 未新增用例 | 该点尚无规格校验规则（crud-03 3.3.9 / crud-04 3.4.10 均未定义），按「不代替规格拍板」只在夹具说明中声明占位 id 口径；如后续拍板需校验，应在 `crud-03/04` 增规则后再补用例 |
| **M5 之外其余 fixture 的成员序** | 已核对、无需改动 | `tc_j3_schedule.zip`（`job.yaml → manifest.json → ops/…`）与 `tc_x4/*.zip` 均符合各自声明序，仅 `tc_x3` 偏离，已修 |

## ZIP 校验证据

### 命令（可复现）

```bat
:: 1) 源码快照到 ASCII 路径（避免 PS 5.1 读取中文路径脚本的问题）
xcopy /y /q /i "…\tests\fixtures\tc_x3\workflow.yaml"      "%TEMP%\jzbuild\x3\"
xcopy /y /q /i "…\tests\fixtures\tc_x3\manifest.json"     "%TEMP%\jzbuild\x3\"
xcopy /y /q   "…\tests\fixtures\tc_x3\ops\*.yaml"         "%TEMP%\jzbuild\x3\ops\"
xcopy /y /q /i "…\tests\fixtures\tc_e2\workflow.yaml"      "%TEMP%\jzbuild\e2\"
xcopy /y /q /i "…\tests\fixtures\tc_e2\manifest.json"     "%TEMP%\jzbuild\e2\"
xcopy /y /q   "…\tests\fixtures\tc_e2\ops\*.yaml"         "%TEMP%\jzbuild\e2\ops\"

:: 2) 按声明序重打包（成员序 = workflow.yaml → manifest.json → ops/<按 manifest.ops 顺序>）
powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\jcode_zipbuild3.ps1"
::   built %TEMP%\jzbuild\x3\tc_x3_multi.zip : workflow.yaml -> manifest.json -> ops/op_prompt_review.yaml -> ops/op_bash_build.yaml
::   built %TEMP%\jzbuild\e2\tc_e2_loop.zip   : workflow.yaml -> manifest.json -> ops/op_tc_e2_fail.yaml -> ops/op_tc_e2_ok.yaml

:: 3) 回写 fixture 目录
copy /y "%TEMP%\jzbuild\x3\tc_x3_multi.zip" "…\tests\fixtures\tc_x3\tc_x3_multi.zip"
copy /y "%TEMP%\jzbuild\e2\tc_e2_loop.zip"  "…\tests\fixtures\tc_e2\tc_e2_loop.zip"

:: 4) 全量校验（本地文件头顺序 + 逐成员 SHA256 vs 源目录 + 反向缺件 + manifest 名称锚）
set JZSRC=…\tests\fixtures
powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\jcode_zipverify2.ps1"
```

### 结果（原样摘录）

```
### A. temp copies vs fixture source files (proves built zips used the fixture bytes)
  workflow.yaml                      temp=29f58af61146360c392a81b81746eadb541d5625334705f5b036ce5fc0f82715 fixture=29f58af61146360c392a81b81746eadb541d5625334705f5b036ce5fc0f82715 MATCH
  manifest.json                      temp=cfec955c70e2e3142372d614d203312aa2c96a1add626d49f557403ab63ea35a fixture=cfec955c70e2e3142372d614d203312aa2c96a1add626d49f557403ab63ea35a MATCH
  ops/op_prompt_review.yaml          temp=80242920d9d8ae5e86571d3972461895a42a6f065f654bca0337575f49a8ba11 fixture=80242920d9d8ae5e86571d3972461895a42a6f065f654bca0337575f49a8ba11 MATCH
  ops/op_bash_build.yaml             temp=f52e1f2684a5b5c6a60b34d1b397963f4b606a1af8b5c656faa12ff359f4dbeb fixture=f52e1f2684a5b5c6a60b34d1b397963f4b606a1af8b5c656faa12ff359f4dbeb MATCH
  workflow.yaml                      temp=faf62316c0569a16022495e975716345a8811b336e85ca0e94436b4e75951cea fixture=faf62316c0569a16022495e975716345a8811b336e85ca0e94436b4e75951cea MATCH
  manifest.json                      temp=d17a570bed94ddbcbb78127793792d1bd8ef1f0f6e09229113b063350f12e963 fixture=d17a570bed94ddbcbb78127793792d1bd8ef1f0f6e09229113b063350f12e963 MATCH
  ops/op_tc_e2_fail.yaml             temp=88f7df1fbab68305bb69246a78805867b8fbe428843931ef90a7cd53f0a3e37f fixture=88f7df1fbab68305bb69246a78805867b8fbe428843931ef90a7cd53f0a3e37f MATCH
  ops/op_tc_e2_ok.yaml               temp=8f96983d2d71e009e63685ffc81fcb8a95298551a75585c3ae27a728139b5254 fixture=8f96983d2d71e009e63685ffc81fcb8a95298551a75585c3ae27a728139b5254 MATCH

### B. installed zips in the fixture dir
==== TC-X3 Workflow package  (…\tests\fixtures\tc_x3\tc_x3_multi.zip)
local-header order : workflow.yaml -> manifest.json -> ops/op_prompt_review.yaml -> ops/op_bash_build.yaml
  workflow.yaml              entry=29f58af6…c0f82715 src-file=29f58af6…c0f82715 MATCH
  manifest.json              entry=cfec955c…63ea35a src-file=cfec955c…63ea35a MATCH
  ops/op_prompt_review.yaml  entry=80242920…49a8ba11 src-file=80242920…49a8ba11 MATCH
  ops/op_bash_build.yaml     entry=f52e1f26…59f4dbeb src-file=f52e1f26…59f4dbeb MATCH
member-count order : workflow.yaml -> manifest.json -> ops/op_prompt_review.yaml -> ops/op_bash_build.yaml
ALL MEMBERS MATCH SOURCE DIR : True
  anchor manifest.workflow.name=wf_tc_x3_multi vs workflow.yaml name=wf_tc_x3_multi -> OK
  anchor manifest.ops[].name=op_prompt_review vs ops/op_prompt_review.yaml name=op_prompt_review -> OK
  anchor manifest.ops[].name=op_bash_build vs ops/op_bash_build.yaml name=op_bash_build -> OK
  client anchor: Claude Code = a1b2c3d4e5f60718293a4b5c6d7e8f90
  client anchor: bash-build  = f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1
==== TC-E2 Workflow package  (…\tests\fixtures\tc_e2\tc_e2_loop.zip)
local-header order : workflow.yaml -> manifest.json -> ops/op_tc_e2_fail.yaml -> ops/op_tc_e2_ok.yaml
  workflow.yaml              entry=faf62316…7951cea src-file=faf62316…7951cea MATCH
  manifest.json              entry=d17a570b…0f12e963 src-file=d17a570b…0f12e963 MATCH
  ops/op_tc_e2_fail.yaml     entry=88f7df1f…f0a3e37f src-file=88f7df1f…f0a3e37f MATCH
  ops/op_tc_e2_ok.yaml       entry=8f96983d…139b5254 src-file=8f96983d…139b5254 MATCH
member-count order : workflow.yaml -> manifest.json -> ops/op_tc_e2_fail.yaml -> ops/op_tc_e2_ok.yaml
ALL MEMBERS MATCH SOURCE DIR : True
  anchor manifest.workflow.name=wf_tc_e2_loop vs workflow.yaml name=wf_tc_e2_loop -> OK
  anchor manifest.ops[].name=op_tc_e2_fail vs ops/op_tc_e2_fail.yaml name=op_tc_e2_fail -> OK
  anchor manifest.ops[].name=op_tc_e2_ok vs ops/op_tc_e2_ok.yaml name=op_tc_e2_ok -> OK
  client anchor: bash-build = f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1
VERIFY-ALL DONE
```

### 结论

- `tc_x3_multi.zip`：成员序已恢复为 crud-03 3.3.8 声明序（`workflow.yaml → manifest.json → ops/op_prompt_review.yaml → ops/op_bash_build.yaml`，与 `manifest.ops` 顺序一致，且与其余 4 个 fixture 体例一致）；**4/4 成员 SHA256 与源目录文件一致**（`29f58af6…` / `cfec955c…` / `80242920…` / `f52e1f26…`）；无缺件、无多余成员；`manifest.workflow.name` 与 `manifest.ops[].name` 名称锚全部一致。
- `tc_e2_loop.zip`（新增）：成员序同为声明序；**4/4 成员 SHA256 与源目录一致**；名称锚全部一致；`clients[]` 仅含 `bash-build`（与 `tc_c2_05.yaml` 同 type=bash，满足 D3 的 clientId 必填 + D5 类型匹配前提）。
- 两个 ZIP 的条目时间戳统一为 `2026-10-14T12:02:16+08:00`（沿用 `tc_x3` 原条目的固定时间戳），`ExternalAttributes = 0`，压缩方式 Deflate，无目录条目——与既有 fixture 体例一致。

## 机械自检（命令与结果）

```bat
set JZSRC=F:\project\workflow\docs\cli非交互式\tests
powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\jcode_check.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\jcode_check2.ps1"
```

1. **用例计数与一致性**
   - 详细用例 **90**、汇总列表 **90**、详细唯一 **90**、汇总唯一 **90**；`only in detail` 空、`only in summary` 空；**无重复 ID**；汇总列表与详细用例**顺序完全一致**（`order identical = True`）。
   - 逐模块实测：Client 5 / OP 5 / Workflow 3 / Job 3 / 运行历史 4 / §6（跨页面联动 12 + 6.1 X5 系列 40 = 52）/ 6.2 配置与系统 1 / §7 错误族矩阵 13 / §8 导入校验 4 = **90**。
   - 优先级实测：**P0 4 / P1 18 / P2 11 / P3 57**，与统计表合计 `**90** / **4** / **18** / **11** / **57**` 逐格一致（4+18+11+57=90）。
2. **旧措辞残留（全部应为 0，实测全部 0）**：`retry.on=failed`、`on_failed`、`on:failed`、`retry_from_step_id`、`前端原型：`、`mock 数据（`CLIENTS``、`前置条件（准备步骤`、`前置条件（DB 直接注入）`、`前置条件（确定性 Job`、`` 0`=不限制（超时兜底） ``、`min(3×3, 0 不限制)`、`max+1`、`TC-R1 / R2 / R3`、`timeoutSeconds=1, sleep 5`、`` 恒成功、`retry.max=3` ``、`记 error 日志、不创建 Run`、`` 不限制（按 `max×3=9` 触顶失败） ``、`（waiting_max=2）` → **18/18 = 0**。
3. **新措辞到位（实测）**：`retry.on=failure` 8、`{on:failure, max:3}` 2、`job_queue_running_max=1` 7、`tc_e2_loop.zip` 9、`op_tc_e3_timeout.yaml` 5、`op_tc_e3_longrun.yaml` 4、4 个名称锚 message 样例（workflow/target/job/ops）各 ≥1、`D10`/`D11`/`D12` 各 ≥4、`不施加绝对上限` 6、`TC-E4a..E4d` 各 ≥3、`### 6.1`/`### 6.2`/`### 8.` 各 1、`TC-R1 / R2a / R2b / R3` 1、`tc_r1/seed.sql` 9、`ws-005` 9。
4. **悬空引用**：全篇 `TC-*` 引用仅 `TC-X2`（族引用，原有）与 `TC-E3`（「见 TC-E3 系列」，族引用）两处**非用例 ID** 的族引用，**无悬空单例引用**（原 `TC-R2` 已改为 `TC-R2a`/`TC-R2b`）。
5. **编码与行尾**：`集成测试用例.md` → `bytes=163657 CRLF=1988 LF_only=0`，**BOM 保留**（`EF BB BF`），文中无字面 `\r\n` 转义残留；新增 fixture（`tc_e2/**`、`tc_e3/**`）沿用既有 fixture 的 **LF** 行尾。

## 备注（工具链）

- 本仓库文档为 CRLF，而编辑工具写入的换行默认为 LF。所有插入行已统一用「逐字节归一化脚本」（`%TEMP%\jcode_crlf_fix.ps1`：仅把孤立 `LF` 补成 `CRLF`，并把工具误写入的**字面** `\r\n` 四字符序列还原为真 CRLF）收口，最终 `LF_only=0`。
- 该脚本与 ZIP 构建/校验脚本均落在 `%TEMP%`（审计范围之外），未在仓库内落盘。
