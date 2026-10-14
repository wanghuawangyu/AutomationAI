# 重建报告 —— `proposal-02-后端设计.md`

> 任务：外部进程删除该文件后从 git HEAD 还原，**丢失新周期 R1–R4 改动**；须重建到「R1–R4 修复完成后的应有状态」。
> 结果：**已重建为 435 行（LF / UTF-8 无 BOM / 35605 字节）**，与删除前的真实状态**逐字节一致**（见 §0 取证方法）。
> 只改本文件；未动其它文件、未动 `_*.md` 报告、未动 `validation.md`，**未提交 git**。

---

## 0. 取证方法（为什么这份重建是「恢复」而不是「重写」）

删除前该文件不是 git 版本，但**修复者会话记录仍在**（`%USERPROFILE%\.jcode\sessions\session_*.json`）。按时间轴枚举全部触碰本文件的会话后，R1–R4 四轮链条完整：

| 轮 | 会话 | 时间 | 落盘的编辑 |
|-|-|-|-|
| R1（`_fix_v2_B_be.md`） | `session_lizard_*` | 10-14 07:11 | `edit` 13 处（1 处失败后重跑） |
| R2（`_fix_v3_B_be.md` 续作） | `session_boar_*` | 10-14 07:44 | `edit` 1 处（§2→§二） |
| R3（`_fix_v4_B_be.md`） | `session_hog_*` | 10-14 10:12 | `edit` 3 处（示例值 / 不新增导出码） |
| R4（`_fix_v5_B_be.md`） | `session_tigress_*` | 10-14 10:39 | `edit` 2 处（`3.4.6.2` 引用、**删 `run_edge_state` 行**） |

**关键取证**：R1 修复者 `boar` 在 **07:40 对整文件做过一次完整 `read`（共 435 行，含行号，无截断）**——即 R1 完成态原文。以它为基线，按上述 R2→R3→R4 的 `old_string/new_string` 逐条重放（6 次替换，每次命中数均为 1），得到目标态。

**交叉验证（与校验报告的行号机械对齐，全部命中）**：

| 校验报告锚点 | 报告所述 | 重建文件实测 |
|-|-|-|
| `_val5_01_docs` §7 | `proposal-02:6–9`「引用与编号约定」 | 6–9 ✓ |
| `_val5_01_docs` §7 | `proposal-02:27` = `proposal-01 §二` | 27 ✓ |
| `_val4_05_global` | `p02:65/75` 用 `JOB_COMPLETE/STEP_COMPLETE`；`p02:91` 用 `JobComplete/StepComplete`；`p02:361` 引 `crud-04 4.5.2` | 65/75/91/361 ✓ |
| `_val5_01_docs` §8 | `proposal-02:336`「共 27 行 / 26 个 code」；表体 `:340–366` 27 行 | 336；340–366 ✓ |
| `_fix_v3_B_be` | `proposal-02:373` 名称锚中性示例 | 373 ✓ |
| `_fix_v5_B_be` | 删 `:434` 行；改后 **LF=435** | 435 行、LF=435 ✓ |
| R4 会话（tigress）`read` 420–436 | `420 --- / 422 ## 十三 / 426–436 11 行（含 `run_edge_state`）` | 420/422/426–435（删后 10 行，行号逐行对齐）✓ |

---

## 重建项清单（项 → 落地位点 → 证据）

| # | 项（来源口径） | 落地位点 | 证据（实测） |
|-|-|-|-|
| 1 | **§10.1 不新增 `EXPORT_UNAVAILABLE`**（R3 一.4e） | `:375`「**不新增专用错误码**…统一用 `INTERNAL_ERROR`——本表**不为其新增导出类专用错误码**…与 `原型图/mock-data.js` 的 `INTERNAL_ERROR` 一致」；总表 `:366` `INTERNAL_ERROR 500` | 本文件 `EXPORT_UNAVAILABLE` = **0**；`INTERNAL_ERROR` = **3** |
| 2 | **名称锚 message 固定格式**（D11 v2 二.9） | `:371–373`：格式串 ``名称锚不一致：manifest.<锚字段>=<值>，<包内路径> 内 name=<值>`` + 中性示例 `manifest.target.name=deploy_workflow，workflows/deploy_workflow.yaml 内 name=deploy_v2` + 「前端原样展示」+ `bash-build` 仅作否定说明 | 固定格式串在 p01 / crud-03 / crud-04 / 本文件 / tests 各 **1** 处逐字一致；`wf_deploy_prod`=0、`bash-build` 仅否定句 |
| 3 | **总表与内联表计数一致**（v2 N-12 / val2 G5） | `:336` 表头「共 **27 行 / 26 个 code**，其中 `CLIENT_NOT_FOUND` 依调用上下文取 404 / 409」；`:370` 一码两态说明；`:342/:343/:346/:355/:361` 定义位置列补 crud-03 3.3.9 / crud-04 3.4.10 / crud-04 4.5.2 / crud-05 4.6 | 表体 **27 行 / 26 code**（仅 `CLIENT_NOT_FOUND` 两行）；全库内联错误行 **116 行 / 编外 code 0** |
| 4 | **§1.1 补 G9「数据库连接初始化约定」**（v2 补充拍板 7） | `:34`：`foreign_keys`/`busy_timeout` 为**连接级** PRAGMA、**必须对每个连接**显式 `PRAGMA foreign_keys = ON`，否则 FK 与 `ON DELETE CASCADE` 静默失效；「依赖级联的删除在 Repository 层另有**显式 SQL 兜底**（见 `schema.sql` 头注）」 | `:34` 命中（`G9` 全文 3 处：约定块 2 + 本节 1） |
| 5 | **删 `run_edge_state` 行（现 9 表）**（R4 四.6） | `:434` 行整行删除；§十三 剩 10 行 = 9 实表 + 1 行 `~~settings~~（已废弃）`；`run_node_state` 行保留 | 本文件 `run_edge_state`=**0**；`schema.sql` `CREATE TABLE` = **9**（…engine_events、run_node_state，无 run_edge_state） |
| 6 | **§2 / §3 / §12 与实际一致**（v2 L-5 / v1 L12） | §二 模块 13 行；§三 3.1–3.6 迁移指向；§十二 表 **14 行**（含新补 `十六、典型 Use Case` / `十八、通用列表分页规范` / `十九、前端独立界面清单` / `二十、关键设计决策` / `二十一、核心结论`） | §十二 表 12 行（表头+分隔+14 数据行）→ 列数一致；正向引用 `proposal-01 §十六/十八/十九/二十/二十一` 均存在 |
| 7 | **trait 清单去重**（v2 N11 / L-4） | `:183`「同理: OpRepo, WorkflowRepo, JobRepo, RunRepo, StepRepo, EngineEventRepo」（**已去掉重复的 `ClientRepo`**）；`:184` 配置**不定义 trait** | `ConfigRepo` = **0**；`:187` 命名对照 7 个 trait，无重复 |
| 8 | **Task Runner 状态含 `terminating`**（v2 N13） | `:81`「运行历史（JobRun）状态机（waiting → running → **terminating** → 终态）」 | `waiting → running → terminating → 终态` 命中；旧串 `waiting → running → 终态`=0 |
| 9 | **完成钩子命名映射**（R3 二.14，落点 = crud-03 4.4） | 本文件用双名且指向清晰：`:65` 图注「on_complete 钩子（全局 **JOB_COMPLETE / STEP_COMPLETE**）」、`:75`、`:82/:83`（**JobComplete / StepComplete** 实现类型名）、`:91` 完成回调 | 两套名共存与 `_val4_05_global`（`p02:65/75/91`）一致；映射句按拍板落在 `crud-03 4.4`，**已核验存在**（`STEP_COMPLETE` 命中） |
| 10 | **`engine.notify` 分流（`target=op` 不走 Engine）**（v2 G6） | `:89`「**单次 OP / Job(target=op) 直接派发 WorkerPool**；**Job(target=workflow) / 单次 Workflow 调 `engine.notify`**…（`engine.notify` 仅限 **workflow 类执行**；Job `target.kind=op` 时**不得走 Engine**…）」 | `engine.notify` 仅限 / 不得走 Engine 均命中 |
| 11 | **章号体例与 proposal-01 / tasks 统一**（v2 二.5、R2 补、R4 三.docs） | `:6–9` 顶部「**引用与编号约定**」（章=中文数字、节=`§N.M`、`crud-0X` 不带 `§`、`schema.sql` 用「第 N 节」、行内编号带出处、跨文件引用具名）；正文 `§二`/`§七`/`§九`/`§十一` 归一 | `§2 模块`=0、`§7）`=0、`§九（CLI`=0（唯一 `§2/§7/§11` 出现在 `:7` 的**体例条文自身**，属规则正文）；`:125`「见 §二 模块 13」✓ |
| 12 | **`uptimeMs` 类型说明** | 该修复项（v2 L-3）落点在 `crud-06 3.1`（「进程已运行**时长**（毫秒数）」，非时间戳）；**本文件不涉及该字段** | 本文件 `uptimeMs` = **0**；本文件对应字段为 `daemon.json` 的 `startedAtMs`（`:267`），语义为时刻、口径正确 |
| 13 | **表结构引用总览 / 表格与 `**` 机械自检** | §十三 列数 2；§10.1 列数 4 | 12 张表**列数全一致**；`**` 奇数行 = **0** |
| 14 | **行尾 / 编码** | 全文 | 行数 435、LF=435、CRLF=**0**、BOM=**False**、末行有换行=True |

**逐字节验证**：重建产物与落盘文件 `fc /b` → **BYTE-IDENTICAL**（回滚备份见 `%TEMP%\rec\delivered_head_backup.md`，即 HEAD 419 行版本）。
与 HEAD 的差异 = **37 插入 / 21 删除**（R1 13 处 + G9 块 + R2 1 处 + R3 3 处 + R4 2 处）。

---

## 反向引用核对结果

命令：全目录（含 `tests/`，排除 `_*` 与 `validation.md`）正则扫描 `proposal-02[^\n]{0,60}` / `p02[: ]` / `后端设计\.md`，逐条解析其中 `§…` 是否命本文件章/节标签集合
`{1.1 1.2 1.3 3.1–3.6 9.1–9.8 10.1 一 二 三 四 五 六 七 八 九 十 十一 十二 十三}`。

| 引用方 | 引用内容 | 核对 |
|-|-|-|
| `tasks.md`（19 处） | `§1.1`(×4)、`§1.2`(×4)、`§二（模块划分）`(×2)、`§三`/`§十`、`§十一`(×2)、`§六（DB 操作层 (Repository)）`(×3)、`§七（日志管理）`(×2)、`§九（CLI…）`(×2)、`§9.3`(×3)、`§10.1` | 全部命中 ✓（括注名与实标题字面差异见「未落地」栏） |
| `crud-01:3/4/75`、`crud-02:3/4/72`、`crud-03:3/4`、`crud-04:3/4/623`、`crud-05:3/4`、`crud-06:3/4/136` | 迁移出处「第 3.1 节 / 第 5 章 / 第 3.2 节 / 第 4.1 节 / 第 1.3 节 / 第 3.3 节 / 第 4.2–4.4 节 / 第 3.4 节 / 第 4.5 节 / 第 3.5 节 / 第 4.6–4.7 节 / 第 3.6 节 / 第八章」＋「顶部『引用与编号约定』」 | §1.3/§3.1–3.6/§四/§五/§八 与 `:6–9` 约定块均存在 ✓ |
| `crud-06:30/34` | `proposal-02 §9.3`、`proposal-02 §9.8` | 均存在 ✓ |
| `proposal-01:2896/2921` | `proposal-02 §1.1` | 存在 ✓ |
| `tests/集成测试用例.md:1805/1964` | `proposal-02 §10.1`（统一错误体 / 错误码映射） | 存在 ✓ |
| 全库裸写「后端设计」（不带 `.md`） | 0 处 | 反向扫描无遗漏 ✓ |

**反向引用总数 = 47 处，未命中 = 0**。

**正向引用核对**：本文件内 `§N.M`、`crud-0X N.N[.N]`、`proposal-01 §…` 共 **32 项**，对目标文件标题（含 `#### 3.4.6.1/.2` 等标题级小节）逐一解析 → **未命中 0**。
其中新引用 `crud-04 3.4.6.2「job_queue_waiting_max 的语义」`、`crud-03 3.3.9`、`crud-04 3.4.10`、`crud-05 4.6`、`crud-03 4.3/4.4`、`crud-06 〇`、`crud-05 3.5.10` 均实测存在。

---

## 未落地与原因

1. **`tasks.md` 的括注章名与 `proposal-02` 实标题字面不符**（`§九（CLI 命令行入口设计）` vs 实标题 `## 九、CLI（命令行入口）设计`；`§六（DB 操作层 Repository）`/`§六（DB 操作层 (Repository)）` 三种写法）——`_val5_01_docs` L7 记录在案；**引用方是 `tasks.md`（G 组文件），本文件无权改**，且目标章节确实存在、语义可懂。
2. **`完成钩子双名映射`只落在 `crud-03 4.4`**（`_fix_v4_decisions` 14 拍板），本文件按真实恢复态**未加**额外映射句；本文件内两套名共存且用法可区分（static 名 vs 实现类型名）。
3. **`uptimeMs` 类型说明**在本文件**无落点**（该字段属 `crud-06 3.1`）；本文件相关字段为 `daemon.json.startedAtMs`（时刻），口径正确，无需改。
4. **`_fix_v5_B_be` 的其它三文件改动**（`crud-01:75`、`crud-02:72/284`、`crud-06:133/369`）不在本次范围；本文件仅落自己那 1 处（`:9`）。
5. **未提交 git**（按任务书由协调者统一提交）。

---

## 自检命令与输出（摘录）

```
# 属性
行数=435  LF=435  CRLF=0  BOM=False  bytes=35605  末行有换行=True

# 旧措辞 0 残留
run_edge_state=0  EXPORT_UNAVAILABLE=0  1–8=0  1-8=0  「共 16 条」=0  settings `=0
记录数-1 / 记录数 - 1 / 记录数 − 1 = 0  ConfigRepo=0  §2 模块=0  §7）=0
job_complete=0  waiting → running → 终态=0  wf_deploy_prod=0  slugName=0  0=不限制=0  配置目录=0
（step_complete = 1，为事件名 `step_completed` 的子串，非钩子旧名）

# 新措辞到位
引用与编号约定=1  不写 §2/§7/§11=1  proposal-01 §二 ID 规范=2  crud-04 3.4.6.2「=1
连接级** PRAGMA=1  必须对每个连接**显式执行=1  另有**显式 SQL 兜底**=1
waiting → running → terminating → 终态=1  全局 JOB_COMPLETE / STEP_COMPLETE=1
engine.notify 仅限=1  不得走 Engine=1  共 **27 行 / 26 个 code**=1
同一 `code` 允许随调用上下文=1  名称锚不一致：manifest.<锚字段>=<值>=1
manifest.target.name=deploy_workflow=1  不为其新增导出类专用错误码=1  INTERNAL_ERROR=3
跨文件引用不使用别文件的小节内编号=1  实现时可用同一 `SqliteStore`=1

# 表格 / 标记
表数=12  列数异常=0（§10.1 4 列×29 行=27 码行；§十二 2 列×16 行=14 数据行；§十三 2 列×12 行=10 数据行）
`**` 奇数行 = 0

# 错误码交叉
§10.1 27 行 / 26 code；内联错误行 116 行、编外 code 0
schema.sql CREATE TABLE = 9（无 run_edge_state）

# 字节级
fc /b 重建产物 落盘文件 → BYTE-IDENTICAL
```
