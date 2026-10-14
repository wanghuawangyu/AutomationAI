# 修复报告（组 D · 续作）—— `proposal-02-后端crud-05运行历史.md` + `schema.sql`

> 口径依据（**唯一权威**）：`_fix_v3_decisions.md` 一.2 / 一.8 / 一.9 / 二.5 / 二.13 / 二.14 / 三；`_val3_02_be.md`（S1 / 拍-1、G1 / G2 / G4 / G5、N1–N5 / N9 / N11）；`_val3_05_global.md`（N-8、N-7、M-2、M-10、M-1 等）。
> 本组**只改** `proposal-02-后端crud-05运行历史.md` 与 `schema.sql`；未写入 `_fix_v3_decisions.md`，未改其它文件。
> 两文件改后均为 **UTF-8 + LF**（实测 `CRLF=0`、无 BOM、末行有换行），未做整文件换行转换。
> R1/上一批已落地内容**一律保留回查**，本轮仅做「审计 → 补齐缺口 → 自检 → 重写报告」。

---

## 审计结果

对上一批（中断前）已落地改动逐条回查；结论：**上一批的全部落点仍在位且正确**，本轮**仅发现 1 处需要补齐**（行内编号对照表枚举不全，见「本次补齐」），另**修正上一批报告中 1 条已过时的「未落地」结论**（crud-03 侧已被其归属组补齐）。

| 必验项（提示词清单） | 落地点（改后行号） | 实测证据 | 判定 |
|-|-|-|-|
| **一.2 D6 边状态初值**（3.5.8④ 与 crud-03 4.3.4 同口径） | `crud-05:394`（3.5.8 动作序列步骤 4） | `grep -c 边状态初值`=1、`completedOnce`=1；三句齐备：①种子节点入边置 `activated` ②前缀节点集出边按源 Run 终态复制 ③前缀节点集以「已执行过」（`completedOnce=true`）作初值参与就绪/汇聚判定，且不写 `step_records`；并含「否则多入边节点（如 End）永久 `pending` → Run 卡死」说明 | ✅ |
| **一.2 对端同口径**（crud-03 4.3.4②） | `crud-03:1288-1298` | 回查确认该节现有 ①–⑤ 五条（含边状态初值三句 + 风险说明 + 幂等重放），与 crud-05:394 **逐项同口径**；上一批报告「crud-03 侧尚缺」的结论**已过时**（见「未落地与原因」附注） | ✅ |
| **一.8 `schema.sql` 尝试计数口径** | `schema.sql:219-222` | `grep '每轮尝试次数（首次执行计入）'`=1；旧串 `记录数-1`=0、`重试计数`=0、`attempt`=0；现文「本轮尝试计数 = 同 (run_id, step_id, activation_seq) 记录数 = 每轮尝试次数（首次执行计入）, 即 retry.max 的判定基准（retry.max=3 -> 每轮 3 次尝试…）; 重试次数（派生展示量, 非判定基准）= 记录数 - 1」 | ✅ |
| **一.9 `settings \`X\`` 术语** | `crud-05:356 / 364 / 440 / 537 / 550 / 642 / 648`（共 7 处） | `grep -c settings`（crud-05）=**0**；`配置项`=7、`ai-automation.json`=6；键名 `job_queue_waiting_max`（356/364/412/440/648）、`job_queue_running_max`（550）、`runner_poll_interval_ms`（537/550/642/655） | ✅ |
| **二.13 多失败 step 续跑种子** | `crud-05:392`（3.5.8 步骤 2） | `grep '最晚的那一条'`=1；现文「源 Run 存在多条失败 / 超时 step 时，取失败 / 超时记录 `created_at_ms` 最晚的那一条…与 3.5.5『以最后一条记录为准』同向，同口径见 crud-03 4.3.4①」；对端 `crud-03:1278` 已同口径 | ✅ |
| **二.14 运行入口校验顺序（waiting 上限最先）** | `crud-05:363-366`（3.5.7）、`411-416`（3.5.8） | 两条列表第 1 项均为「全局 waiting 上限」；第 ① 条 `D12` 标注在位；对端 `crud-04:313-318` 与 `:599` 已对齐（waiting 最先） | ✅ |
| **多失败 step 描述** | `crud-05:392` | 同二.13，描述完整（源 Run / 记录主键 / 最晚者 / 同向 3.5.5 / 同口径 crud-03 4.3.4①） | ✅ |
| **行内编号一符多义** | `crud-05:128`（对照表）、`389`（`D6 定稿：重试保留续跑语义`） | `（#`=**0**、`3.4.6 #`=**0**；`D6 定稿` 消歧句=1；对照表列举 D1②/D3①/D3②/D5/D6/D7/D12/D15/D16/D17/G8 并注明出处，且声明「跨文件引用一律具名」 | ✅（本轮补齐：见下） |
| **400/404 行** | `crud-05:351-357 / 432-440 / 474-479 / 483-484 / 528-530` 等 | 3.5.7/3.5.8/3.5.9 错误表均含 `400 VALIDATION_ERROR`；3.5.8 含 `404 RUN_NOT_FOUND` + `404 TARGET_NOT_FOUND`（:437/:438）且与 3.5.9 reason 枚举（:474+）一致；3.5.3/3.5.4/3.5.10 亦含 400 | ✅ |
| **恢复路径丢失续跑种子（G1）** | 归属 **crud-03**（本组不改） | 回查 `crud-03:965 (恢复闭环 0) / :966 (Q2)`：现文已写明「补写 `engine_start` 时必须同时从 `job_runs.retry_from_record_id` 反查续跑种子…仅当该列为 NULL 时才从头启动」「起点仍由 `resumeFromRecordId` 决定」——其归属组**已落地** | ✅（跨文件） |

---

## 本次补齐

| # | 文件:行 | 改动 | 依据 | 说明 |
|-|-|-|-|-|
| 1 | `crud-05:128`（3.5.0「行内编号对照表」段末） | 在「跨文件引用一律具名」句后**追加**：「本文件另出现 `U13`（StepComplete 写事件失败的兜底）、`T26`（运行中 `process_event` 失败兜底）、`N4`（`terminated_by` 写入约定）、`M17`（terminate 去重口径）——均为**内部条目号 / 独立校验报告条目号**（非决策类），释义见 `proposal-01 §20.1` 及其所在章节，引用时同样以具名小节为准。」 | `_fix_v3_decisions.md` 二.5（A：保留编号须配「小节内编号对照表」）、`_val3_05_global.md` N-5（编号须可追溯） | 审计发现对照表自称「本文件出现者及出处如下」，但正文实际还出现 `U13`（:586）、`T26`（:660）、`N4`（:328）、`M17`（:697）四个标签未登记 → 补齐后「本文件在用的行内编号」全部可追溯。`U13/T26` 释义已核 `proposal-01:2956/2957`，`N4/M17` 属 `p01:2936` 声明的「各文档内部条目号」。 |

> **除上表 1 处外，本轮未新增/修改任何内容**：上一批落点经逐条回查全部正确在位，按「不要重改已完成项」原则**保持原样**。

---

## 未落地与原因

1. **`tasks.md` 的 `settings \`X\``（8 处中 tasks 侧 3 处）与 `#n`/「数据集行 n」——tasks 归属**，本组不改。`crud-05` 侧 `settings` 已 0（见自检 ②）。
2. **`tests/集成测试用例.md` 的 `#n` → 「数据集行 n」——tests 归属**，本组不改。
3. **`proposal-01 §20.1` 补登 D8–D18 / G、N 标签——p01 归属**，本组不改；本组在 `crud-05:128` 内以「对照表 + 具名引用」自足解决本文件侧可追溯性。
4. **`crud-03 4.3.4③ / 4.3.0 恢复闭环`、`crud-04 3.4.6` 顺序** —— 均为他人文件；本轮**回查确认其归属组已落地**（`crud-03:965-966/1288-1298`、`crud-04:313-318/599`），故 `crud-05` 内「与 crud-03 4.3.4② 同口径」「D12」「crud-03 4.3.4①」等标注**现已真实成立**。
5. **`schema.sql:238-239` 钩子命名**：采用 `JobComplete` / `StepComplete` + 「对应 static `JOB_COMPLETE` / `STEP_COMPLETE`」（而非 `_val3_05_global.md` M-2 建议的全大写）。理由：`JOB_COMPLETE`/`STEP_COMPLETE` 在 `crud-03 4.4` 是 **static 常量 / 全局单例钩子名**，`JobComplete`/`StepComplete` 是**实现类型名**，二者同物两名，用「对应」连接；如需统一为单一名，须在 `crud-03`/`p01`/`p02` 三处一并定稿（本组仅两文件，无法收口）。**保持现状**。
6. **N9 位次（3.5.8 ⑤ 置末位）**：决策未拍明，按 `_val3_02_be.md` N9 的默认建议**置末位**，并已在正文写明理由（`crud-05:416`）。
7. **上一批报告「未落地项 1（crud-03 4.3.4② 尚缺三句）」的结论已过时**：本轮回查 `crud-03:1288-1298` 现有 ①–⑤ 完整条目，与 `crud-05:394` 逐项同口径。此系**他组补齐**，非本组改动；特此更正，避免汇总时误判为悬空。

---

## 自检证据

**① 编码 / 行尾**（Python 逐字节统计，改后）

```
crud-05    : bytes=62081 CRLF=0 LF=719  BOM=False endsNL=True
schema.sql : bytes=23019 CRLF=0 LF=356  BOM=False endsNL=True
```

**② 旧措辞 0 残留 / 新措辞到位**

```
[crud-05 残留 0]  settings / job_complete / step_complete(?!d) / 3.4.6 # / （#n / 完成调
[crud-05 到位]    边状态初值=1  completedOnce=1  最晚的那一条=1  续跑种子=12
                  配置项=7  ai-automation.json=6  行内编号对照表=1  D6 定稿=1
[schema 残留 0]   记录数-1 / 重试计数 / attempt / job_complete / step_complete(?!d)（仅剩事件名 step_completed）
[schema 到位]     每轮尝试次数（首次执行计入）=1  接口层必填=1  unbound=2
                  JobComplete=1  StepComplete=1  resumeFromRecordId=2
```

（`step_complete(?!d)` 负向前查：两文件均 **0**，即无蛇形钩子旧名残留；`step_completed` 为事件名，不计。）

**③ `schema.sql` 实跑（硬性要求；sqlite3 3.50.6）**

```
copy schema.sql -> C:\Users\Public\_jd_schema.sql
sqlite3 _jd.db ".read _jd_schema.sql"                                  -> 退出 0（无错误输出）
sqlite3 _jd.db "select count(*) from sqlite_master where type='table';"                     -> 10
sqlite3 _jd.db "select count(*) from sqlite_master where type='index' and name not like 'sqlite_%';" -> 23
sqlite3 _jd.db "pragma user_version;"   -> 1
sqlite3 _jd.db "pragma journal_mode;"   -> wal
sqlite3 _jd.db "pragma foreign_keys;"   -> 0   （新连接；与 :14-19 头注「连接级、须每连接置 ON」一致）
pragma_table_info('step_records') 命中 record_id / activation_seq / retry_seq -> 3
```

**④ 建库后行为验证（改写口径的语义证据）**

```
INSERT job_runs(triggered_by='retry') 1 条 + step_records 3 条（同 (run,step,activation_seq)，retry_seq=1..3）
SELECT count(*) WHERE run_id=? AND step_id=? AND activation_seq=1   -> 3
  => 「本轮尝试计数 = 记录数（首次执行计入）」成立：retry.max=3 时 记录数(3) >= max(3) → 不再重试（与 crud-03 4.3.0/4.3.2 一致）
重复插 (run,step,activation_seq,retry_seq) -> UNIQUE constraint failed: step_records.run_id, ...（uq_steps_execution 生效）
UPDATE source='nope'                       -> CHECK constraint failed: source IN ('job','step')
PRAGMA foreign_keys=ON 后 DELETE job_runs 行 -> step_records 剩余 0（级联生效）
```

**⑤ Markdown 结构门禁（crud-05）**

```
逐表列数一致性（转义 \| 后计数）：tables_inconsistent = 0
逐行 ** 奇偶：odd_lines = 0（交叠粗体已消除，4.6 分工表 Engine 行拆段在位）
```

**⑥ 交叉引用存在性（目标标题实测命中）**

```
crud-03 4.3.0 / 4.3.2 / 4.3.4（含 ② 内 ①–⑤）     -> 命中（行 760 / 1154 / 1267；4.3.4② 于 1284-1298）
crud-04 3.4.6「job_queue_waiting_max 的语义」      -> 命中（3.4.6 校验顺序于 313-318）
proposal-01 §20.1（U13/T26 释义 2956/2957）        -> 命中
crud-06 一 / 本文件 3.5.1 / 3.5.5 / 3.5.7 / 3.5.8 / 3.5.9 / 3.5.10 / 4.6 / 4.7 / 4.8 -> 命中
```

**⑦ 临时产物清理**：`C:\Users\Public\_jd_*.py / _jd.db / _jd_schema.sql / *.out` 全部删除，仓库内未落任何临时文件。

---

## 变更摘要（供汇总）

- `proposal-02-后端crud-05运行历史.md`（719 行）：本轮**仅 1 处补齐**——`:128` 行内编号对照表补登 `U13/T26/N4/M17` 四个内部标签（其余项均为上一批已落地、经回查保留）。
- `schema.sql`（356 行）：本轮**无改动**（上一批落点 `:112/:113-114/:219-222/:238-239/:283/:298` 经回查全部在位）。
- **更正**：上一批报告「crud-03 4.3.4② 尚缺 D6 三句」的结论**已过时**，该节现由归属组补齐（`crud-03:1288-1298`），`crud-05` 侧「同口径」标注现已真实成立。
