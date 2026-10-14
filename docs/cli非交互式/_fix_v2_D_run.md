# 修复报告 —— 组 D（`proposal-02-后端crud-05运行历史.md` + `schema.sql`）

> 口径依据：`_fix_v2_decisions.md`（**唯一权威**）之 D6 / D12 / D15 / D16 / D17 / D18，以及 `_val2_02_backend.md`（S1、G5→实为 `_val2_04_global` G-5、G8、N2、N3、N4、N5、N6、N7）、`_val2_04_global.md`（G-5 / G-7 / L-*）、`_val2_03_tests.md`。
> 按要求**未写入** `_fix_v2_decisions.md`；**未修改**任何其它文件。
> 两文件改后均为 **UTF-8 + LF**（实测 `CRLF=0`），未做任何换行符转换（`crud-05` 原文件本就是 LF）。

---

## 已修项表

| 项号 | 文件:行（改后） | 改法 | 证据 |
|-|-|-|-|
| **D17**（=`_val2_04_global` G-5 / 拍板 P6=A） | `schema.sql:182-184` | 列 `retry_from_step_id` → **`retry_from_record_id`**；注释改为「上游 `step_records.record_id`（StepRecord 主键；= 源 Run 的失败/超时 step 记录）」；段注改「重试溯源（**仅 retry 写入**；rerun 不写、两列均为 NULL，见 crud-05 3.5.7 / 3.5.8）」 | sqlite3 建库后 `pragma_table_info('job_runs')` 含 `retry_from_record_id`；全库残留 0 |
| **D17** | `crud-05:20, 43, 110, 143, 366, 390, 414, 426, 707` | 样例字段 `retryFromStepId` → **`retryFromRecordId`**；字段表/映射表改名并写「**仅 `retry` 写入**（= 源 Run / 源失败或超时 **StepRecord 主键**，**不是** `workflow_node_id`）」；3.5.7 补「重跑**不写** `retry_from_*`」、3.5.8 补「写入方约定（D17）」；4.8 增「溯源字段」行 | 改后 `retryFromStepId` / `retry_from_step_id` 在 crud-05、schema.sql 各 **0** 命中 |
| **D6**（保留续跑；=`_val2_02_backend` S1 的 crud-05 侧 / 「严重 2 的另一端」） | `crud-05:385, 387-393` | 3.5.8 重写功能说明（**从失败 step 处续跑重试**、以失败/超时 step 为**续跑种子**、**已完成节点不重复执行**）+ 新增「重试新建 Run 的动作序列（D6 定稿）」5 步：① 前置校验 → ② 新建 Run 写 `retry_from_run_id` / `retry_from_record_id` → ③ `engine.notify(EngineStart{ run_id, workflow_id, inputs, workspace, resumeFromRecordId })`（**EngineStart 携带续跑种子，不是「让 Engine 从头启动」**）→ ④ Engine 侧机制（前置节点视为已完成、**不写入新 Run 的 `step_records`**、`run_context` 取源 Run 出参快照、`retrySeq` 从 1 重计、缺失快照 → 400）→ ⑤ 幂等 | 与 `crud-03 4.3.4`（另一修复者已落地）逐条对齐 |
| **D6** 接口契约指向 | `crud-05:392, 676, 704` | 指向 **`crud-03 4.3.4`「重试种子（resume seed）」**（该节已存在，字段名 `resumeFromRecordId` 一致） | `crud-03:1221` 节存在；`crud-03:1235/1242-1248` 口径一致 |
| **严重 2 的另一端**（crud-05 不再隐含「Engine 从头启动」） | `crud-05:391, 661, 663, 676` | 4.6 执行流程两处 `engine.notify(EngineStart{...})` 注「由 [重试] 创建的 Run 另带 `resumeFromRecordId`（续跑种子）」；4.6「同步 vs 异步」明确「**不是从头启动**」；保留 3.5.8「从失败 step 开始」 | `grep '不是「让 Engine 从头启动」'` = 1；`grep resumeFromRecordId` = 4 |
| **D15**（cancelled Run 可 [重试]） | `crud-05:385, 470, 704` | 3.5.8 写明「**中止前已落到 `failed`/`timeout` 的 step 即为续跑种子**，该 step 与后继按 DAG 继续；**cancelled 但终止前无任何失败/超时 step 不可重试**」；3.5.9 reason 表、4.8 前提行保持同口径（D15：与其它终态同一判定，不额外设限） | 3.5.8 / 3.5.9 / 4.8 三处措辞一致 |
| **D16**（触发筛选 5 值单值枚举） | `crud-05:189`（3.5.1）、`crud-05:448`（3.5.10 filters） | `triggeredBy` 改为「触发来源（**单值枚举，5 值互不合并**）：`manual` / `schedule` / `single_op` / `single_workflow` / `retry`（与 API 单值枚举一一对应，不做多值合并）」；导出 filters 加同注 | `grep '单值枚举，5 值互不合并'` = 1；与 `tests/集成测试用例.md:1068-1072`（逐值筛选）一致 |
| **D18**（事件保留换算；本文件侧） | `schema.sql:267, 269-270, 293` | 表头注释加「**软删 = `engine_event_retention_days` 天（默认 1）；硬删 = 软删 + 1 天，不随配置缩放**（见 crud-06 一）」；正文改「`engine_event_retention_days` 天后软删除 → 再 1 天后物理删除（默认 1 → 2 天）」；列注释同步 | `crud-06:83/362` 措辞为「软删 = 该值 / 硬删 = 软删 + 1 天」——**逐字一致**。crud-05 本身无该表述（`grep engine_event_retention_days` = 0），无需改 |
| **D12**（校验顺序列表） | `crud-05:361-364`（3.5.7）、`409-412`（3.5.8） | 两节各补「校验顺序（D12，返回首个命中）」：① 全局 waiting 上限 → 409 `CONCURRENCY_CONFLICT`；② 重跑/重试前置（`RERUN_NOT_ALLOWED` / `TARGET_NOT_FOUND` / `RETRY_NOT_ALLOWED`）；③ `concurrency=skip` 已在途 → 409 `CONCURRENCY_CONFLICT` | `grep '校验顺序（D12'` = 2 |
| **G8**（新建 Run 快照来源定稿） | `crud-05:368-379`（重跑）、`416-426`（重试） | 各增「新建 Run 的快照来源」表：rerun = `job_id` 原 Run / `job_kind` 继承 / `job_version` 当前或 NULL / `name`·`target_name`·`target_version` **取当前**（最新版本语义）/ `inputs`·`workspace` 原 Run 快照 / `triggered_by=manual`；retry = 全部**原 Run 快照** + `triggered_by=retry` + `retry_from_*` | 与 `crud-03 4.3.4①`（retry 侧）完全一致（已互指） |
| **N3**（样例 `target.name` 语义冲突） | `crud-05:28, 33` | 顶层 `name` = `hourly_check`（= `crud-04` 的 `jobs.name`）、`target.name` = `deploy_workflow`（目标 Workflow 名） | 与 `crud-04:30` 样例一致；字段表（`:95/:100/:101`）语义自洽 |
| **N4**（`terminated_by='cancelled'` 写入方） | `crud-05:326-330` | 3.5.6 后补「`terminated_by` 的写入约定」：用户终止（`reason=user_terminate`）→ `status='cancelled'` **且** `terminated_by='cancelled'`（有在跑 OP 经 `terminating` 收敛 / 直接落终态**两条路径同**）；超时 → `'timeout'`；`run_failed`/`loop_limit`/`workflow_done(failed)` → `'error'`；其余终态 NULL | 与 `crud-03:666`（reason 枚举）、`crud-03:790`（terminate 收敛落 cancelled/timeout/failed）、`crud-03:664` 一致 |
| **N5 / G-7**（保留天数换算未定义） | `schema.sql:267/269/293` | 见上 D18（schema 侧唯一表述处）；crud-06 已由他人修复，措辞对齐 | 见 D18 证据 |
| **附带 N2**（样例缺 `result`） | `crud-05:41` | 样例补 `"result": null,  // 计算字段：不落库，详情接口按 steps 聚合`（字段表 `:108` 已定义） | 样例字段集 = 字段表字段集 |
| **附带 N6 / `_val2_04_global` G-1**（错误表缺 400 行） | `crud-05:244-249`（3.5.3）、`263-268`（3.5.4）、`428-435`（3.5.8）、`474-479`（3.5.9） | 四处「错误响应」由单行改为表格并补 `400 VALIDATION_ERROR（runId 格式非法）`；3.5.8 另补**续跑种子缺失 → 400**（D6 口径，`crud-03 4.3.4③` 要求在重试入口预检） | 与 3.5.0 通用约定（`:122`）、`proposal-02 §10.1` 一致 |

---

## 未修项与原因

1. **N6 之「3.5.8 补 404 `TARGET_NOT_FOUND`」——暂停（冲突，按要求上报）**
   - N6 建议 3.5.8 与 3.5.7 对称补 404 `TARGET_NOT_FOUND`。但 **3.5.9 `can-retry` 的 reason 枚举无「目标已删除」项**，且该节明写「**判断条件与 3.5.8 / 4.8 一致**」；若 3.5.8 直接 404，则「can-retry=false」与「retry → 404」互斥（`can-retry=false` 的前置语义是「可返回 409 的已知原因」）。`crud-05:116` 也只对 **[重跑]** 规定 target 存在性检查，[重试] 明写「**仅依赖 target=workflow 及五条件**」。
   - 故 3.5.8 **只补 400 行**，404 未加；如需要，请先在 3.5.9 增 reason 项（如「目标已删除，无法重试」）再回填 3.5.8，二处须同时改。
2. **N7（ZIP 导入体积上限 / 解包安全边界）——不属本文件**：crud-05 不涉及导入；落点在 `crud-03 3.3.9` / `crud-04 3.4.10` / `crud-06` 配置表（他人文件），未改。
3. **G8 中「重跑的 `inputs` / `workspace` 取当前 Job 配置」为备选口径**（`_val2_02_backend` G8 原文「重跑，需明确」）：决策文档未拍。本报告按 **「原 Run 快照」** 定稿（3.5.7 表），理由：本接口**无请求体**、且 Job 已删时原 Run 快照为唯一可用来源，与「运行历史按快照展示、不 join 定义」口径同源。若产品要求重跑读当前 Job 配置，请复核该两行。
4. **`_val2_03_tests.md` 中不存在 "super" 相关条目**（全库 `grep -i super` = 0 命中）：已改按该文件中**涉及本文件的断言**核对——`TC-R1/R2`（列表筛选、导出两 Sheet 列）、`X5` 系列通用口径（`tests:1283`：重跑=最新版本从头、重试=从失败 step 开始）、`tests:1646`（重试从失败节点 B 开始、**已成功节点 A 不重复执行**）、`tests:1307`（原记录保留版本快照）。改后 crud-05 与上述断言**一致**（未发现需回填 tests 的新分歧）。
5. **`_val2_04_global` L-1~L-12**：逐条比对后，无一项落在本文件（L-7/L-10/L-11 分别属 proposal-01 / 原型 / crud-03），未改。
6. **`_fix_v2_decisions.md` 末尾「## 落地情况」表**：按本组提示词要求**未写入该文件**；落地明细即本报告。

---

## 机械自检（命令与结果）

**① 全库残留扫描**（`_tmp_scan.py`，遍历 `docs/cli非交互式/**` 的 md/sql/js/html/yaml/json/txt）

```
proposal-02-后端crud-05运行历史.md : retry_from_record_id x7   （0 处旧名）
schema.sql                        : retry_from_record_id x1   （0 处旧名）
```
（其余命中为他人负责文件：`crud-03` 1 处旧名（该节「**D17**：原名 `retry_from_step_id` 已改名」说明性引用）、`validation.md` / `_fix_v2_decisions.md` / `_val2_*.md` 属校验报告原文，均**不在本组可改范围**。）

**② 应出现处核对**（`_tmp_check.py`）

```
== 1. line endings / size ==
proposal-02-后端crud-05运行历史.md bytes=57904 CRLF=0 LF=713 endsNL=True
schema.sql                        bytes=21629 CRLF=0 LF=347 endsNL=True
== 2. residue (must be 0) ==
crud-05 retry_from_step_id = 0 ; retryFromStepId = 0
schema.sql retry_from_step_id = 0 ; retryFromStepId = 0
== 3. new wording present ==
retryFromRecordId=4 / retry_from_record_id=7 / resumeFromRecordId=4 / crud-03 4.3.4=4
"仅 `retry`（3.5.8）写入"=2 / 单值枚举，5 值互不合并=1 / terminated_by='cancelled'=1
校验顺序（D12=2 / 不是「让 Engine 从头启动」=1
schema.sql: retry_from_record_id=1 / engine_event_retention_days 天=3
== 4. markdown table column consistency ==
tables=21 inconsistent=0
== 5. referenced section anchors exist in crud-05 ==
3.5.5/3.5.7/3.5.8/3.5.9/3.5.10/4.6/4.7/4.8 -> all True
```

**③ `schema.sql` 实跑建库（硬性要求）**

```
> sqlite3 _tmp_final.db ".read schema.sql"
wal
BUILD_EXIT=0
> sqlite3 _tmp_final.db "select name from pragma_table_info('job_runs') where name like 'retry%';"
retry_from_run_id
retry_from_record_id        ← 改名生效
> sqlite3 _tmp_final.db "select count(*) from sqlite_master where type='table';"
10
```

**④ 交叉引用核对**：`crud-03 4.3.4`（重试种子）已存在，其 `resumeFromRecordId` 字段、写入列、快照来源、幂等、缺失快照 400 与 crud-05 3.5.8 **逐条一致**；`crud-04 3.4.6 #3`（waiting 上限 / 并发判定）存在；`3.5.5`（「最后一条记录」）存在。

**⑤ 临时脚本清理**：本次使用的 `_tmp_*.py` / `_tmp_*.txt` / `_tmp_*.db` 全部删除，未留在仓库内。

---

## 变更摘要（供汇总）

- `schema.sql`：D17 列改名（`retry_from_record_id`）+ 注释；D18 保留天数换算（3 处注释）。
- `proposal-02-后端crud-05运行历史.md`：D17/D6/D12/D15/D16 落地；G8 快照来源表（重跑/重试各一）；N3 样例；N4 `terminated_by` 写入约定；附带 N2 样例 `result`、N6 四处 400 行；3.5.8 新增「校验顺序 / 写入方约定 / 快照来源」三节注并指向 `crud-03 4.3.4`。
- 唯一未落地：N6 的 3.5.8 `404 TARGET_NOT_FOUND`（与 3.5.9 reason 枚举冲突，已上报）；G8 重跑 `inputs`/`workspace` 取「原 Run 快照」为本次定稿（决策文档未定，可复核）。
