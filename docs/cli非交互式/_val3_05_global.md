# 跨文档全局一致性独立校验报告（第 3 轮 · `_val3_05_global.md`）

- 角色：**独立校验员（第 2 轮 / 全集交叉核对）**。**只读**——仅新增本报告，未改动任何被审文件（校验脚本全部落在 `%TEMP%` / `C:\Users\Public\`，未在仓库落盘）。
- 范围：`proposal-01-界面设计.md`(3105 行)、`proposal-02-后端设计.md`(430)、`proposal-02-后端crud-01..06`(1099/406/1414/673/717/389)、`schema.sql`(353)、`tasks.md`(322)、`tests/集成测试用例.md`(1989)、`tests/fixtures/**`、`validation.md`(123)、`原型图/**`(10 文件)。
- 参照（不重审）：`_fix_v2_decisions.md`（唯一权威拍板）、`_fix_v2_A..G_*.md`（各组落地声明）、`_val2_01..05_*.md`（第 2 轮原始发现）。
- 行号基准：**改后物理行号**（脚本按 `\n` 归一后计数）。
- 关注点：A 前后矛盾 / B 不易理解 / C 方案待完善 / D 需拍板。

**结论摘要**：R1 修复**大面落地**——`S-2`、`G-2`、`G-5`、`G-9`、`G-11`、`L-3`~`L-10`、`M1`~`M6` 均**完整落地**且经机械核对复核；交叉引用**基本 0 悬空**（仅 1 类 3 处因标题层级导致解析失败）。但**有 6 项声明「已修」实为部分/未落地**（`G-1`、`G-4`、`G-8`、`G-10`、`L-1`、`L-11`），并通过**跨文档比对**发现 **5 处新引入的不一致**（`validation.md` 新版、`schema.sql` 计数口径、`crud-05`/`tasks` 术语、`tasks` T8.6/T5.2、`#n` 新规则被自违反）。共报 **27 项** —— 严重 1 / 一般 12 / 轻微 11 / 需拍板 3。

---

## 统计

| 分档 | 数量 | 编号 |
|-|-|-|
| 严重 | 1 | F-1 |
| 一般 | 12 | N-1 … N-12 |
| 轻微 | 11 | M-1 … M-11 |
| 需拍板 | 3 | P-1 … P-3 |
| **合计** | **27** | — |

| 类别 | 项数 | 明细 |
|-|-|-|
| R1 声明「已修」但**未落地/部分落地** | 6 | `G-1`(N-1)、`G-4`(M-3)、`G-8`(N-6)、`G-10`(N-5)、`L-1`(M-2)、`L-11`(M-1) |
| R1 未列入清单但同源的**残余** | 5 | `D1`→schema(N-8)、`G-7/D18`→crud-03(N-4)、`N10`→crud-05/tasks(N-7)、`L-4/N11`→tasks(N-10)、`L-12`(M-6) |
| 本轮**新引入**的不一致 | 5 | `validation.md` 新版(F-1)、`S-1` 残留的汇聚规则(N-3)、`#n` 新规则被违反(N-5)、`tasks` T8.6(N-9)、`tasks` T5.2/N10(N-7/N-10) |
| 其他遗留 | 11 | N-2、N-11、N-12、M-1…M-11 |

---

## 一、机械核对（全部可复现；过程脚本 `_v3_refs2.py` / `_v3_codes.py` / `_v3_400.py` / `_v3_tokens.py` / `_v3_ep.py` / `_v3_err.py` / `_v3_cite.py` 等，落在仓库外临时目录、**已用完删除**，未在被审目录落盘）

### 1.1 交叉引用核对 → **1 类 3 处解析失败（非真悬空）**

| 引用类型 | 抽取总数 | 结果 |
|-|-|-|
| `crud-0x N.N` / `N.N.N` | **324** | 321 ok；3 处 `crud-04 4.5.2`（`p02:356`、`tasks:298`、`tests:1790`）解析失败——因 `crud-04:625` 起 `**4.5.1 …**`~`**4.5.6 …**` 是**行内加粗**而非 `###` 标题（目标**实际存在**，见 N-2） |
| `§x.y` | **210** | 全部命中（按「本文件 → proposal-01 → proposal-02」三文件归因后 0 悬空；`tasks.md`/`validation.md` 内无自有编号，均为跨文件引用） |
| `proposal-0X §N` | **76** | 全部命中（`proposal-02` 的中文数字章节由引用处的括注消歧，见 `tasks:42/95/122/123/125/140/143`） |
| `schema.sql 第 N 节` | **2** | 均命中 |
| 端点 `/api/...` | crud 声明路径 **43**（含 `crud-06` §三 6 个） | `proposal-01 §17` 全覆盖；p01 侧仅多 `/api/workspaces/browse`（p01:486/771/2803 **四处明确标注「已移除」**）→ 0 悬空 |

`schema.sql` 第 1 节 = `-- 1. clients`、第 2 节 = `-- 2. ops` 等 10 节齐备；`crud-06` 有 `## 〇、配置存储模型`（`proposal-02:179` 引用的「crud-06 〇」有效）。

### 1.2 错误码唯一性 → **总表 27 行 / 26 code，内联表 0 编外 code**

- `proposal-02 §10.1`（:333-361）共 **27 行 / 26 个 code**（`CLIENT_NOT_FOUND` 出现两次：404 引用型 :339、409 导入型 :340）。
- 全库反引号大写 code 与总表**完全一致**，无编外 code、无未使用 code（`VALIDATION_ERROR`/`CLIENT_TYPE_MISMATCH` 等 26 个双向均在位）。
- 各 crud 内联错误表状态码与总表逐行比对：**唯一差异**为 `CLIENT_NOT_FOUND` 内联全用 404（`crud-01:176/292/322/380/410`）——因总表本身定义了两种状态，**非缺陷**（但实现方式未说明，见 N-12）。
- **唯一编外 code**：`EXPORT_UNAVAILABLE`（`原型图/mock-data.js:2105`，原型 mock 专用）→ 见 M-5。

### 1.3 路径参数端点错误表 `400` 覆盖 → **6 处缺失（G-1 未闭合）**

`crud-03 3.3.6(:329)` / `3.3.8(:473)` / `3.3.10(:588)` / `3.3.11(:608)`、`crud-04 3.4.9(:474)` / `3.4.12(:576)` —— 错误块仅 `404`（详见 N-1）。已修的 6 处：`crud-01 3.1.7`、`crud-02 3.2.7`、`crud-05 3.5.3/3.5.4/3.5.8/3.5.9`（均含 400，✓）。

### 1.4 枚举 / 字段名 / 默认值 / 上限逐处比对（多值冲突清单）

| 事实 | 各处取值 | 冲突 |
|-|-|-|
| `retry.max` 语义 | `crud-03:94/735/1112/1124`「每轮**最大尝试次数**（首次执行计入）3/3/3」、`tests:148/1834/1916` 3 次 | **`p01:284`「每轮重试次数」、`p01:2309`「每轮重试次数」** = 额外重试读法（4 次）→ **冲突（N-8 同源，F-1 之外的最高优先项）** |
| `NodeRetry.on` | `p01:283/1019`、`crud-03:93`、`tests` 全文 = `failure` / `success` | 无冲突（`retry.on=failed`/`on_failed` **0 残留** ✓） |
| `EdgeCondition` | `p01:887`、`crud-03:104`、全部 fixture = `on_success` / `on_failure` / `always` | 无冲突 |
| `triggeredBy` 5 值 | `crud-05:189/448`、`p01:1742/2705`、`原型 index.html:243` = manual/schedule/single_op/single_workflow/retry | 无冲突 |
| 重试溯源列名 | `schema.sql:189` `retry_from_record_id`、`crud-05:20/43/110/143/366/390/414/426/707`、`p01:1657`、`原型 mock-data.js`×14 = `retryFromRecordId` | 无冲突；`retry_from_step_id`/`retryFromStepId` 仅存 1 处**说明性**「原名」引用（`crud-03:1232`）+ 报告档案 ✓ |
| `resumeFromRecordId` | `crud-03:688/790/794/1235/1240/1242/1246/1247/1248`、`crud-05:391/664/666` | 命名一致；仅 `run` vs `runId` 写法不同（M-10） |
| `max_loop_multiplier=0` | `crud-06:82/221/289/295/358`、`p01:2305/2310/2311/2990/3082`、`crud-03:738`、`tests:151/1754/1862/1865-1867` = 「不施加绝对上限、仍受 `max×3` 约束」 | **`原型 settings.html:186`「0=不限制（按 max×3）」** 仍用被 D14 废止的措辞（M-4） |
| `engine_event_retention_days` 换算 | `crud-06:83/362`「软删 = 该值 / 硬删 = 软删 + 1 天」、`schema.sql:272/298`、`tasks:275` | **`crud-03:874`「1 天后软删除 → 2 天后物理删除」未参数化**（N-4）；`原型 settings.html:187` 同样硬写 1/2（M-4） |
| `timeoutSeconds` | `crud-02:54/81/164/174/312/375` = 范围 1..86400、默认 60、必填；`p01:600/725/2822`；`schema.sql:54` `DEFAULT 60` | 无冲突（示例值 `300` 属既有 OP 样例，非默认值） |
| 导入体积上限键 | `client_import_max_bytes` / `op_import_max_bytes`（`crud-01:429`、`crud-02:280/375`、`p01:144-145/536`、`原型 op.html/client.html` 读 `SETTINGS.*`） | 无冲突（未新造键 ✓） |
| `page_size` | 10/50/100/1000 默认 10（6 处 crud 通用约定 + `crud-06:292`） | 无冲突 |
| `job_queue_waiting_max` 默认/上限 | 默认 20 / 上限 1000（`crud-03:368/1304`、`crud-04:328`、`crud-05:354/547/645`、`crud-06:283`） | 数值一致；术语见 N-7 |

### 1.5 术语同义异名清单（现役，供统一用词）

| # | 概念 | 多写法（文件:行） | 建议 |
|-|-|-|-|
| T1 | 配置项引用 | **「配置项 `X`（`ai-automation.json`，见 crud-06 一）」**（crud-01/02/03/04/06 已统一） vs **「settings `X`」**（`crud-05:354/362/437/547/645`、`tasks:227/228/233`） | 前者（N-7） |
| T2 | 完成钩子 | `JOB_COMPLETE`/`STEP_COMPLETE`（`p01:1678`、`p02:60`）、`JobComplete`/`StepComplete`（`crud-03:965`…） vs **`job_complete`/`step_complete` 钩子**（`schema.sql:235-236`） | 前两者（M-2） |
| T3 | 运行目录 | 「运行目录 `runDir`」（`crud-06:24`、`p02:245`） vs **「当前配置目录」**（`原型 mock-data.js:1213`） | 前者（M-3） |
| T4 | 拓扑校验条数 | crud-03「**17 条**」（`crud-03:309`）vs p01 §10.14「**11 行**」（`p01:1339-1349`）vs 原型 13 项检查（`mock-data.js:1549-1606`）vs `tasks:230`（旧 7 条） | 以 crud-03 为契约基准，界面/任务书引用同一编号体系（N-3/N-9） |
| T5 | 超时字段 | `timeoutSeconds`（统一） | ✓ 无分歧 |
| T6 | 并发阈值 | 「配置项 `job_queue_running_max`」（`crud-06`） vs 「settings `job_queue_running_max`」（`crud-05:547`） | 前者（N-7） |
| T7 | `attempt` / `retry_seq` | `retry_seq`（`crud-03:690/1124`、`p01:1711`） vs `attempt`（`crud-03:1047` 时序图、`schema.sql:219` 公式注释） | `retry_seq`（M-1） |

> 已确认**已统一**的正例（不报问题）：`retry.on` 枚举、`EdgeCondition`、`triggeredBy` 5 值、`retry_from_record_id`、`resumeFromRecordId`、`timeoutSeconds` 范围/默认、导入上限键、`poll_interval_ms` vs `runner_poll_interval_ms`、`page_size` 档位、名称锚 message 格式串（三处逐字一致）。

---

## 二、R1 修复核对表

> 判定口径：**✓ 完整落地** = 机械检索旧措辞 0 残留且新措辞出现在全部应出现处；**◐ 部分** = 主要落点已改但仍有 1+ 处残留/未同步；**✗ 未落地**。

| 项 | 判定 | 证据（改后行号） | 残留 |
|-|-|-|-|
| **S-1** 拓扑校验四处口径 | ◐ | `crud-03:112-128` 补至 **17 条**（含 :128「允许环路」显式替代 §10.14 的「DAG 无环」）；`p01:1351` 删「无环」并加「不校验『环』（D8）」注；`原型 mock-data.js` `WF_LOOP_EDGE_CONDITION`/`__findWfCycle` **0 残留** | **N-3**：`crud-03:119` 规则 8「多入边必须有明确汇聚」仍为硬 400，而 `p01 §10.14` 已删该条、`mock-data.js:1493` 明确删除该规则；`p01 §10.14` 仍缺 crud-03 的规则 9/11/13/16；`crud-03 §3.3` 未按建议标注 create/update/validate 三入口 |
| **S-2** 测试环境 vs 禁 mock | ✓ | `tests:9`「被测前端 = T2 产出的 `ui/`…`原型图/` 仅作原型演示，不作验证依据」；`tests:60` P0 删除「前端 mock 数据」；`前端原型：` 全库 0 残留 | — |
| **G-1** 10 端点缺 400 | ◐ | 已补 6：`crud-01:409`、`crud-02:348`、`crud-05:244-249/263-268/428-435/474-479` | **N-1**：`crud-03:329/473/588/608`、`crud-04:474/576` 仍缺（另新发现 2 个 export 端点） |
| **G-2** tasks 内部矛盾 | ✓ | `tasks:82/84/98` 统一「自 T2.1 起」；`:94` T2.1 补机械判据（`grep -c "mockFetch(" ui/*`=0、无 `mock-data.js`、无外链）；`:95` 删「目录名待定」 | — |
| **G-3** retry 枚举 | ✓ | `retry.on=failed`/`on_failed`/`on:failed` **0 残留**；`retry.on=failure` 8 处 | M-7：`crud-03:1114`「下文以 `failed` 为例」未补「`failed` 指节点结果」辨析 |
| **G-4** 「配置目录」 | ◐ | `crud-06` 2 处已改「运行目录」 | **M-3**：`原型 mock-data.js:1213` 仍写「当前配置目录」 |
| **G-5** `retry_from_step_id` 口径 | ✓ | `schema.sql:182-189` 改名 `retry_from_record_id` + 注释；`crud-05:110/143/366/415/427/710` 写入方约定；`p01:1657`；`原型 mock-data.js:1317` | — |
| **G-6** test `success` 定义 | ✓ | `crud-01:369`「本次测试是否成功：`ExecuteResult.status == success`（`rc_file` 退出码 ∈ `exitCodeSuccess`，默认 `[0]`；超时亦 `false`）」 | — |
| **G-7/D18** 保留天数换算 | ◐ | `crud-06:83/362`「软删 = 该值（默认 1）／硬删 = 软删 + 1 天（默认 2）」；`schema.sql:272/298`；`tasks:275` T9.15 验收 | **N-4**：`crud-03:874` 未参数化（仍「1 天软删 / 2 天硬删」） |
| **G-8** slug 默认名 | ◐ | `crud-01:403`「name **原样**、不做字符替换 / 名称改写」 | **N-6**：`原型 client.html:928` 仍 `'client-'+slugName(name)+'.yaml'`、`mock-data.js:90-98` 定义 slug |
| **G-9** 目录名待定 | ✓ | `tasks:95`「目录名**定稿为 `ui/`**…失败不阻断启动、记 WARN 并回退内嵌资源，见 proposal-02 §9.3」 | — |
| **G-10** `#1..#8` 编号 | ◐ | `p01:2923` 登记「`#1..#8`（各 crud 内**局部**审查条目号，**不可跨文件引用**）」；`p01:2950` 加「同文件引用可省略出处」 | **N-5**：9 处跨文件 `crud-04 3.4.6 #3` 违反新规则；`crud-04`/`crud-05`/`crud-03` 内 `#n` 仍一符多义且多数无出处 |
| **G-11** 前端默认 vs 后端默认 | ✓ | `p01:2822`「超时 = 60（默认值预填，必填，范围 1..86400）」；`p01:2820`「前端预填建议值，非后端默认」；`crud-02:54/164/174` 范围+默认+必填+错误表 | （`p01:284/2309` 的「每轮重试次数」属 D1，另计 N-8） |
| **L-1** 完成钩子四种写法 | ◐ | `p01:1678` `JOB_COMPLETE`/`STEP_COMPLETE`；`p02:60` 图注「on_complete 钩子（全局 JOB_COMPLETE / STEP_COMPLETE）」；`crud-03` 统一 `StepComplete`/`step_completed` | **M-2**：`schema.sql:235-236` 仍 `job_complete` / `step_complete` 钩子 |
| **L-2** 行内编号无出处 | ◐ | `p01:2949-2951` 三条规范齐备；`（M20）`/`（P6）` 已清 | 同 N-5 |
| **L-3** `uptimeMs` 类型 | ✓ | `crud-06:166`「进程已运行**时长**（毫秒数，string；**非时间戳**）」；`tests:1747` 加单调性断言 | — |
| **L-4** Repo 清单重复 | ✓ | `p02:178`「同理: OpRepo, WorkflowRepo, JobRepo, RunRepo, StepRepo, EngineEventRepo」（ClientRepo 已去）；`p02:179`「配置不再走 Repository…（不定义 trait）」；`p02:182` 命名对照 7 trait | **N-10**：`tasks:157` T5.2 仍要求建 `ConfigRepo` |
| **L-5** §12 对应表缺章 | ✓ | `p02:406-411` 补 十六/十八/十九/二十/二十一 五行 | — |
| **L-6** settings 分组键对照 | ✓ | `crud-06:60-100` 分组列带 JSON 键（`通用（general）`…`运行历史（history，含并发上限）`/`Task Runner（runner）`/`日志（log）`）；`tasks:156` 同步 | — |
| **L-7** 硬约束 8 | ✓ | `p01:2991`「重试要求版本一致（快照版本 = 当前版本）且满足五条件；重跑才固定使用最新版本」 | — |
| **L-8** T5.5/T2.2 列 | ✓ | `tasks:160` 改为可验收判据（`.bak` 生成、`config_version` 不递增、`migrate_error` 只读返回）；`tasks:95` 参考列改「proposal-02 §2（模块 13）/§9.3；tasks T1.2/T1.6」 | — |
| **L-9** CDN SheetJS + 专属码 | ◐ | `cdn.jsdelivr`/`xlsx.full.min.js` **0 残留**；新增本地 `原型图/xlsx-lite.js`；`tasks:104/107` 验收「不走 CDN」 | **M-5**：`EXPORT_UNAVAILABLE`（`mock-data.js:2105`）仍在，未「消除」也未登记 §10.1（P2 裁定未达成） |
| **L-10** `on_failure` 回跳硬编码 | ✓ | `WF_LOOP_EDGE_CONDITION`/`__findWfCycle` 0 残留；`mock-data.js:1491` 注释「本内核不做环判定」 | — |
| **L-11** 时序图 `attempt` | ✗ | — | **M-1**：`crud-03:1047` 仍 `step_completed{step, act, attempt, result}` |
| **L-12** 编号体系混用 | ◐ | `tasks:42/95/122/123/125/140/143` 在引用处补中文章节括注 | **M-6**：`tasks:48` `proposal-02 §11` 无括注；`tasks:235/238` 用 `crud-03 §4.3`/`§4.3.1`；`crud-01:75`/`crud-02:72` 仍 `schema.sql §1/§2`（schema 正文用「第 N 节」）；`crud-04 4.5.x` 未提为标题（N-2） |
| **M1** §8.9 校验时机 + 载体 | ✓ | `p01:536` 重写为「[导入] 提交 `{zip}` → 后端包完整性校验 → 400」；载体固定 `message` + 格式串 + 中性示例；`p02:365-367` 固化格式并引 crud-03 3.3.9 / crud-04 3.4.10 | N-11：`p02:367` 示例仍用 `bash-build`，与 crud/tests 中性示例不一致 |
| **M2** 名称锚范围 4 项 | ✓ | `p01:536` 枚举①②③④；`crud-03:501-509`、`crud-04:502-511` 同口径 | — |
| **M3** `file` 与 `name` 关系 | ✓ | 三处「`file`/`target.file` 仅作定位，不校验文件名，只校验文件内容 `name`」 | — |
| **M4** 校验顺序 D12 | ✓ | 导入侧：`crud-03:491`、`crud-04:492` 显式列表（①ZIP→400 ②名称锚→400 ③kind→400 ④同名→409 ⑤Client→409/400）；运行侧：`crud-04:313-318`、`crud-05:361-364/409-412` | — |
| **M5** `tc_x3_multi.zip` 成员序 | ✓ | 成员序恢复为 `workflow.yaml→manifest.json→ops/op_prompt_review.yaml→ops/op_bash_build.yaml`；`tests:22` 补「成员序同 crud-03 3.3.8 导出序」 | — |
| **M6** tasks 数据源约定收窄 | ✓ | `tasks:88` 收窄为「T5–T10 接口/界面可观测行为」；`:90` 新增适用范围例外段（T3.9 单测、T4 全组不涉前端） | — |
| **M7** validation.md 旧口径 | ◐ | 「以文件内容为准」在 `validation.md` **0 残留**（旧遗留 3 已随整文件替换消失） | **F-1**（严重）：新版 `validation.md` 的 D6 建议与拍板相反 + 全部行号锚失效 + 无处置状态 |
| **M8** `#6`/`#8` 统一 | ◐ | `crud-03:501`、`crud-04:502` 均改具名「**决策-导入名称锚一致性**」；`p01:536` 同 | **N-5**：`crud-04:529` 仍 `（#6）`、`crud-03:511` `（#2/#5）`、`crud-05:116` `（#3/#6）` 等未统一 |

---

## 严重

### F-1【严重】`validation.md` 新版与已拍板口径**相反**，且全部行号锚失效、无处置状态——作为「唯一留存报告」会直接把实现带向反面

**位置**：`validation.md:1`、`:6`、`:8`、`:96`、全文行号锚（例：`:18`、`:23`、`:27`、`:31`、`:51`）

**原文（冲突核心）**：
- `validation.md:96`：
  > `| **D6** | 重试起点语义（严重 2） | A 保留续跑（补 resume seed）／B 改「从头跑、仅溯源」 | **B**（改动可控、无需新增 Engine 机制；若产品确需续跑再另立需求） |`
- `validation.md:87`（表头）：
  > `## 四、需拍板（18 项，去重后；每项给建议，**默认按建议执行**，可回退）`
- 而 `_fix_v2_decisions.md:18`（**明示「唯一权威」**）：
  > **D6 重试保留「续跑」**（与 D17 配套）：`crud-03` 增补 **重试种子（resume seed）** 小节…随后 `engine.notify(EngineStart{ runId: 新 Run, resumeFromRecordId })`

**问题**：
1. **两份「权威」文档对同一决策给出相反结论**（A 保留续跑 vs B 改从头跑）。实际落地按 A（`crud-03:1221` `#### 4.3.4 重试种子（resume seed）`、`crud-05:385-393`、`crud-03:790/1235`）。`validation.md` 自称「默认按建议执行」且未标注已被取代 → 后来者按它实现会**删掉续跑机制**，与 `crud-03 4.3.4`/`crud-05 3.5.8` 及 `tests:1660`（「[重试] → 从失败节点 **B** 开始，已成功节点 A **不重复执行**」）全线冲突。属「**会写错实现**」。
2. **全部 `文件:行号` 锚已失效**（本轮 21 文件大改后行号整体位移）。逐处实测：`proposal-01:1328` 现为 §10.13 表格行「| 步骤 | 行为 |」、`:2452`/`:2454` 现为**空行**、`:2281` 现为「**on=success 时**：超时不视为失败…」；`crud-03:107` 现为**空行**、`:691` 现为 `step_completed.result` payload 行、`:1077` 现为「第二步：按目标节点就绪规则…」；`crud-04:325` 现为 `queue` 策略表行、`:598-600` 现为 Scheduler 引言 + 代码围栏；`crud-05:348` 现为 `**错误响应**：`、`:573` 现为 `pub fn add_job(...)` 签名、`:634` 现为状态机行；`tests:1807`/`:1829` 现均为「- **优先级**：P3」、`:1886` 现为「2. 执行详情：A 节点橙框…」；`原型图/workflow.html:1444` 现为注释「// N11：…」、`:1888`/`:1749` 现为版本号渲染/校验规则映射；`原型图/job.html:893` 现为 `OPS.map(...)`。
3. **缺处置状态**：文件标题为「验证报告（新周期 · 第 1 轮）」，`## 一、严重（12 项，去重后）` 仍以**未决清单**呈现 12 项，而 12 项已全部由本轮 `_fix_v2_*` 修复（旧版文件原有的一行「处置：15 项已全部修复」+ 遗留节被删去，本轮 diff = +109 / −39）。
4. 连带：`validation.md:9`「用例 **86 例**…文末统计表逐格相符（86/4/18/11/53）」已被本轮 `tests` 改为 **90 例 / 90/4/18/11/57**（`tests:1988`），该「独立证据」句同样过期。

**建议改法**：① 在 `validation.md` 顶部加一段「**本报告结论的处置状态**」：声明 `_fix_v2_decisions.md` 为本轮**唯一权威**、本报告的 D1–D18 已按下述差异生效，并逐条列出与本报告建议不一致的两处（**D6 取 A 保留续跑**，非本报告建议的 B；低成本项亦按 decisions 增补）；② 把 `## 一、严重` 的 12 项各加「**已修**（`crud-03:1221` / `p01:1351` / `tests:1831` …）」标注，或整篇改标题为「第 1 轮历史留档（**已处置，勿按此实现**）」；③ 行号锚统一改为**语义引用**（章节号 + 关键词），如 `crud-03 4.3.4 重试种子`、`tests TC-E2a`，避免下一轮再次失效；④ `:9` 的 86/4/18/11/53 同步为 90/4/18/11/57。

---

## 一般

### N-1【一般】`G-1` 未闭合：`crud-03` 4 个 + `crud-04` 2 个端点错误表仍缺 `400 VALIDATION_ERROR`（含 2 个本轮新发现的 export 端点）

**位置与原文**：
| 端点 | 行号 | 现文 |
|-|-|-|
| `crud-03 3.3.6` validate | `crud-03:329` | `**错误响应**：404 \`WORKFLOW_NOT_FOUND\`。` |
| `crud-03 3.3.8` export | `crud-03:473` | `**错误响应**：404 \`WORKFLOW_NOT_FOUND\`。` |
| `crud-03 3.3.10` needs-update | `crud-03:588` | `**错误响应**：404 \`WORKFLOW_NOT_FOUND\`。` |
| `crud-03 3.3.11` outdated-nodes | `crud-03:608` | `**错误响应**：404 \`WORKFLOW_NOT_FOUND\`。` |
| `crud-04 3.4.9` export | `crud-04:474` | `**错误响应**：404 \`JOB_NOT_FOUND\`。` |
| `crud-04 3.4.12` needs-update | `crud-04:576` | `**错误响应**：404 \`JOB_NOT_FOUND\`。` |

**冲突依据**：同文件通用约定已声明 `crud-03:137` / `crud-04:85`「**路径参数格式非法**（非 32 位无连字符 UUID）→ 400 `VALIDATION_ERROR`」；`p02:335` 总表标 `VALIDATION_ERROR | 400 | … | 全部 crud（通用）`；同批端点 `3.3.1(:201)`/`3.3.2(:215)`/`3.4.7(:348)`/`3.4.8(:362)`/`3.4.11(:558)` 均有 400 → 同一文件内不一致。

**建议改法**：6 张错误表各补一行 `| 400 | \`VALIDATION_ERROR\` | 路径参数（workflowId / jobId）格式非法 |`；或按第 2 轮 G-1 的替代方案，在 `crud-03:136`/`crud-04:84` 通用约定末尾加一句「**未单独列出的 `400 VALIDATION_ERROR`（路径/查询参数非法）对所有端点一致生效，不再逐节重复**」（该句目前不存在）。改完须重跑 1.3 的覆盖脚本至 **0 缺失**。

### N-2【一般】`crud-04 4.5.2` 仍是行内加粗，3 处章节级引用无法解析；`crud-04 4.5.x` 与 `crud-05 4.6–4.8` 标题层级不统一（L-12 附带项未处置）

**位置**：`crud-04:625`（`**4.5.1 注册与热更新（生命周期）**`）… `crud-04:645`（`**4.5.6 错误与日志**`） vs `crud-05:661`（`### 4.6 统一任务执行器（Task Runner）`）、`:699`（`### 4.7 终止`）、`:706`（`### 4.8 重跑 vs 重试`）

**受影响引用**：`p02:356`「**crud-04 4.5.2（cron 入口）**」、`tasks:298`（T10.12 参考列「crud-04 4.5.2」）、`tests:1790`（「见 crud-04 4.5.2」）。

**问题**：目标实际存在（人类可读），但任何按 `#{2,6}` 解析章节的机械核对/工具都会判为悬空（本轮脚本即 `ok=False`）；同一份文档内 `4.5.x`（加粗）与 `4.6/4.7/4.8`（`###`）样式不一，层级语义不明。第 2 轮 L-12 的「`crud-04 4.5.x` 提升为 `### 4.5.x`」建议未落地，`_fix_v2_decisions.md` 的暂缓清单亦未收录该项。

**建议改法**：把 `crud-04:625/631/637/641/645` 五处 `**4.5.x …**` 提升为 `#### 4.5.x …`（与 `crud-05 4.6/4.7/4.8` 拉开一级或统一为 `###`），或（最小改动）在 `crud-04 4.5` 引言处加一句「本节 4.5.1–4.5.6 为行内条目，章节级引用请写「crud-04 4.5」」。

### N-3【一般】`S-1` 残余：`crud-03:119` 规则 8「多入边必须有明确汇聚」仍是硬 400，而界面与原型**都已删除**该规则，界面提示表也无对应文案

**位置与原文**：
- `crud-03:119`：`| 8 | 有多条入边的节点必须有**明确汇聚**（由 DAG 边决定；op 节点为 AND-join，见 4.3.0 ②） | 400 \`VALIDATION_ERROR\` |`
- `crud-03:309`（3.3.6）：`…校验项见 3.3「校验规则」共 17 条：Start/End 存在与入出边、连通性、可达性、汇聚、Required 有来源…`
- 对照 `p01:1339-1349`（§10.14，11 行）**无「汇聚」行**；`p01:1355-1368`（校验失败提示表，12 行）**无汇聚提示**；`原型图/mock-data.js:1493`：`G14：删除原第 11 条「多入边节点必须有明确汇聚」（与「required 入参必须有来源」同一判据，合并为一条）。`
- 另 `p01:962-968`（§10.5）：「**不单独配置汇聚策略**，由 DAG 边决定」→ 该「校验」在数据模型上近乎恒真。

**问题**：D8 以 `crud-03 §3.3` 为契约基准，故 `POST /validate` 与 create/update 必须能对被判「无明确汇聚」的图报 400；但界面规则集与原型校验内核**都不产生**该错误 → 同一张图「后端 400 / 前端校验通过」；且 `tasks:92` 规定 T2.1 以 `原型图/*` 为基线，前端会继承缺失该规则的内核。这是一处 **S-1 未收敛的第四方分叉**。

**建议改法**：二选一并三处同步——① 若保留：把该条补进 `p01 §10.14` 与提示表（新增「节点 X 的多条入边未形成明确汇聚」），并在 `mock-data.js` 恢复该判定；② 若删除（推荐，与 §10.5「由 DAG 边决定」一致）：改 `crud-03:119` 为「汇聚由 DAG 边决定，**不作为校验项**（见 4.3.0 ②）」，`crud-03:309` 的「共 17 条」改 16 条并删「汇聚」字样。

### N-4【一般】`G-7/D18` 未在 `crud-03` 落地：保留天数仍是「1 天软删 / 2 天硬删」的硬编码表述

**位置**：`crud-03:874`
> `| **执行失败**（某 step 失败导致整体 failed/timeout/cancelled） | **保留**（可能重试）；最终不重试 → **1 天后软删除**（置 \`soft_deleted_at_ms\`）→ **2 天后物理删除**；可选 checkpoint 表同生命周期一并清理 |`

**冲突依据**：D18/`_fix_v2_decisions.md:53`「软删 = `engine_event_retention_days`（天）；硬删 = 软删 **+ 1 天**」；已落地处 `crud-06:83`/`:362`、`schema.sql:272`/`:298`、`tasks:275` 均为参数化表述；第 2 轮 G-7 的**建议改法明确点名**「在 `crud-06:81` 与 `crud-03:829` 各补一句确定性公式」（`:829` 即现 `:874`）。

**问题**：`engine_event_retention_days` 可被 PUT 改（上限 30，`crud-06:289`）。当用户改为 5 时，`crud-03:874` 仍只描述默认值情形 → 与第 2 轮 G-7 完全相同的不确定性仍在 `crud-03` 侧存活（该文件是 Engine 机制的契约出处）。

**建议改法**：`crud-03:874` 改为「…最终不重试 → **`engine_event_retention_days` 天后软删除**（置 `soft_deleted_at_ms`）→ **再 1 天后物理删除**（默认 1 → 2 天，见 crud-06 一）」；并在 `crud-03:829` 区域（`schema.sql:267` 已正确）保持逐字一致。

### N-5【一般】`#n` 编号：`p01:2923` 新立「不可跨文件引用」后，全库仍有 **9 处跨文件 `crud-04 3.4.6 #3`** 直接违反；且 `crud-04` 内一符多义未消除

**位置与原文**：
- 新规则 `p01:2923`：`…\`#1..#8\`（各 crud 内**局部**审查条目号，**不可跨文件引用**）…`
- 违反处（跨文件引用局部编号）：`crud-03:368`、`crud-05:354`、`crud-05:362`、`crud-05:410`、`crud-05:437`、`crud-05:645`、`tasks:263`、`tests:1788`（均「见 crud-04 3.4.6 #3」）；`crud-03:1304`（同源表述）。
- 一符多义（`crud-04` 内部）：`#3` = `:330`「适用范围（#3，全入口生效）」/ `:524`「旧 id → 新 id 重映射（#3）」；`#5` = `:267`「删除的原子性（#5）」/ `:522`「版本差异告警（#5）」/ `:531`「导入的原子性（#5）」；`#4` = `:328`「`job_queue_waiting_max` 的语义（#4）」/ `:521`「Job.inputs 键名（#4）」。
- 无出处者：`crud-03:511`（`**导入重映射与原子性（#2/#5）**`）、`crud-04:472`（`双表达约定（#1）`）、`crud-04:517`（`理由（#2）`）、`crud-04:525`（`#7`）、`crud-04:529`（`#6`）、`crud-05:116`（`（#3/#6）`）、`crud-05:357`/`:407`（`（#4）`）。
- 同形不同义：`tests:1068` `\`deploy\`→2（#2、#6）`、`tests:1113` `→ 4（#1、#4、#7、#11）` —— 此处 `#n` 是**数据集行号**。

**问题**：① 刚新增的「不可跨文件引用」被 9 处现役引用违反，属**本轮新引入的自相矛盾**；② `crud-04` 内 `#3/#4/#5` 各指 2–3 件事，正是 §20.1:2951「避免一符多义」要消除的状态；③ `tests` 的 `#n`（数据行号）与 crud 的 `#n`（审查条目号）同形异义，且 §20.1 的新措辞未把 tests 用法排除。局部编号没有编号表，读者无法自查「#5 到底指哪条」。

**建议改法**：① 把 9 处跨文件 `crud-04 3.4.6 #3` 改为具名引用（`B 组已在 crud-02 做过同样处理`）：`crud-04 3.4.6「job_queue_waiting_max 的语义」`；② `crud-04`/`crud-05`/`crud-03` 的 `（#n）` 全部改语义化标签（`（约定-删除原子性）`、`（约定-旧 id 重映射）`…）并在小节内加一行编号表；③ `tests` 的 `（#n）` 改 `（数据集行 n）`；④ 在 `p01:2923` 的括注补「`tests` 中的 `#n` 指数据集行号，非本条所述」以免再被误读为同类。

### N-6【一般】`G-8` 未闭合：`crud-01` 已定「name 原样」，原型仍做 slug 化

**位置与原文**：
- 契约 `crud-01:403`：`**默认文件名（前端预填，允许用户自定义）**：\`client-<name>.yaml\`（name 为 Client 名称**原样**；…**与 OP/Workflow/Job 默认名同口径，不做字符替换 / 不做名称改写**）。前端落盘前仅拒绝含 \`/\`、\`\\\`、\`..\` 的文件名…`
- 原型 `client.html:928`：`document.getElementById('exportFileName').value = 'client-' + slugName(name) + '.yaml';`
- 原型 `mock-data.js:90-98`：`/** 名称 → 文件名 slug（crud-01 3.1.7 \`client-<name>.yaml\`；D5：不可含路径分隔符 / \`..\`） */ function slugName(name) { return String(...).trim().replace(/\s+/g,'_').replace(/[\\/:*?"<>|]+/g,'_')...toLowerCase() || 'client'; }`

**问题**：同一默认名两口径——后端契约「原样」（`Claude Code` → `client-Claude Code.yaml`）、原型「slug 化」（→ `client-claude_code.yaml`）。`tasks:94`（T2.1）要求「以 `原型图/*` 为**视觉基线**（复用 DOM/CSS/交互结构）」，实现者会连同 `slugName` 一起搬走，导致前端落盘名与 `tests:210`（「导出弹窗**默认文件名 = `client-{B.name}.yaml`**」）、以及 `crud-02/03/04` 的同口径声明全线不符。第 2 轮 G-8 的旧措辞（「slug 形式」）在**文档侧已清除**，但**实现侧未同步**，属「A 处改了、B 处未改」的典型。

**建议改法**：`原型图/mock-data.js:90-98` 删除 `slugName`（或改为恒等函数并加注「按 crud-01 3.1.7：name 原样；仅拒绝 `/`、`\`、`..`」）；`client.html:928` 改为 `'client-' + name + '.yaml'`；`tasks:94` 的验收列补「导出默认名 = `client-<name>.yaml`（原样），与 crud-01 3.1.7 / crud-02 3.2.7 / crud-03 3.3.8 / crud-04 3.4.9 同口径」的可机械判据。

### N-7【一般】`N10` 术语未同步到 `crud-05` 与 `tasks`：8 处仍写 `settings \`X\``

**位置与原文**（应统一为「配置项 `X`（`ai-automation.json`，见 crud-06 一）」）：
- `crud-05:354`：`…全局 waiting 队列达 settings \`job_queue_waiting_max\`（默认 20、可调、上限 1000）上限…`
- `crud-05:362`：`…≥ settings \`job_queue_waiting_max\`…`
- `crud-05:437`：同 `:354` 体例
- `crud-05:547`：`**并发阈值 = settings \`job_queue_running_max\`（默认 10、上限 10）**`
- `crud-05:645`：`…≥ settings \`job_queue_waiting_max\`…`
- `tasks:227` / `tasks:228`：`…节点数 > settings \`workflow_max_nodes\` → 400 \`VALIDATION_ERROR\``
- `tasks:233`：（T8.9 行内同源表述）

**问题**：`settings` 表已在 v2 废弃（`crud-06:385`「settings 表废弃 → `ai-automation.json` 唯一事实来源」），`crud-01`/`crud-02`/`crud-03`/`crud-04`/`crud-06` 已全部改为「配置项 `X`」（三份修复报告均以「两文件 `settings` 出现次数=0」为核验证据），但 `crud-05`（D 组）与 `tasks`（G 组）**未被列入该项范围** → 同一术语在两半文档里并存。

**建议改法**：上述 8 处统一替换为「配置项 `job_queue_waiting_max`（`ai-automation.json`，默认 20、可调、上限 1000，见 crud-06 一）」等；并把「全库 `settings \`<键>\`` = 0」加入下一轮机械复核判据。

### N-8【一般】`schema.sql:218` 仍是 D1 前口径「重试计数 = … 记录数 - 1」，与 `crud-03` 已定稿的「记录数（首次执行计入）」相反

**位置与原文**：`schema.sql:218`
> `--      重试计数 = 同 (run_id, step_id, activation_seq) 记录数 - 1;`

**对照**：
- `crud-03:735`：`- **本轮尝试计数** = 同一 \`(run_id, step_id, activation_seq)\` 下的记录数（**首次执行计入**；用于 \`apply_retry\` 的 \`max\` 判定，见 4.3.2）。`
- `crud-03:1124`：`├─ 本 activation 的尝试次数已达 max（同 (run,step,activation_seq) 记录数 >= max，**首次执行计入**）→ 不重试, 走边`
- `_fix_v2_decisions.md:8`（D1）：`max` = **每轮总尝试次数**（首次执行计入，故 `retry.max=3` → 每轮最多 3 次尝试，序列 3/3/3）

**问题**：C 组已把 `crud-03` 的 `记录数 − 1` / `记录数-1` / `最大重试次数` 全部清零（该报告以此为核验证据），但 `schema.sql`（D 组文件）**未列入 D1 范围** → DB 层唯一事实来源仍写着 `-1` 读法。实现者若以 schema 注释为准，`retry.max=3` 会变成 4 次尝试、回跳总上限变成 12，与 `tests:148/1834/1916`（3/3/3、9 次）全线冲突。这是**本轮新发现的跨文档遗留**（`_fix_v2_decisions.md` D1 明写「据此修 `crud-03` 4.3.2 与 `:691`/`:1077`」，未提 schema）。

**建议改法**：`schema.sql:218` 改为 `--      本轮尝试计数 = 同 (run_id, step_id, activation_seq) 记录数（首次执行计入；见 crud-03 4.3.0 ① / 4.3.2 D1）`；并保留 `:217`「`retry_seq`: 同一 activation 内的第几次尝试(含首次), 首次=1」不变（该行已与 D1 一致）。

### N-9【一般】`tasks.md:230`（T8.6）仍枚举旧的 7 条 validate 规则，与 `crud-03 §3.3` 的 17 条不一致

**位置与原文**：`tasks:230`
> `| T8.6 | \`POST /validate\`：Start/End 唯一、start→end 可达、允许回跳环、Start 无 on_failure、op 节点绑定 opId+opVersion、bindings 引用存在 | crud-03 3.3.6/校验规则 | \`{valid,errors[]}\` |`

**冲突依据**：`crud-03:309`（3.3.6）已改为「校验项见 3.3「校验规则」**共 17 条**：Start/End 存在与入出边、连通性、可达性、汇聚、Required 有来源、绑定指向前置节点等」；`crud-03:112-128` 共 17 条（含 **Start 无入边 / End 无出边 / Start ≥1 出边 / End ≥1 入边 / 所有 op 节点 `clientId` 非空 / Client 类型匹配 / 参数绑定必须指向前置节点 / required 有来源 / op 节点绑定 opId+opVersion** 等）。

**问题**：T8.6 实为**上一轮的 crud-03 7 条规则集**（D8 补全前的原文），缺「clientId 非空」「类型匹配」「绑定指向前置节点」「required 有来源」「Start 无入边/End 无出边/Start≥1 出边/End≥1 入边」等 10 项。实现者按 T8.6 验收 `POST /validate` 会漏测近 60% 的规则。属 D8/C 组改了 `crud-03`、G 组未同步 `tasks` 的典型。

**建议改法**：`tasks:230` 改为「`POST /validate`：**crud-03 §3.3 全部 17 条规则**（Start/End 唯一与入出边、连通性、可达性、汇聚、`clientId` 非空、Client 类型匹配、绑定必须指向前置节点、required 有来源、opId+opVersion 绑定、**允许回跳环**）」，验收列补「逐条规则各构造一个负向用例 → 均返回 `valid=false` + 对应 `errors[]` 文案」。

### N-10【一般】`tasks.md:157`（T5.2）要求建 `ConfigRepo`，与 `proposal-02:179/:182`「配置不走 Repository、不定义 trait」相反

**位置与原文**：
- `tasks:157`：`| T5.2 | \`ConfigRepo\`：读 \`ai-automation.json\` → \`Arc<RwLock<Config>>\` | crud-06 〇 | 唯一事实来源 |`
- 对照 `p02:179`：`// 配置不再走 Repository：由配置模块直接读写 {run}/ai-automation.json（不定义 trait，见 crud-06 〇）`
- `p02:182`：`…**命名对照**：\`ClientRepo / OpRepo / WorkflowRepo / JobRepo / RunRepo / StepRepo / EngineEventRepo\` 为落地 trait（见 tasks.md T3.4）…`（7 个，**不含** `ConfigRepo`）

**问题**：B 组按 N11 删除了 `proposal-02` 的 `ConfigRepo`（并在报告中记为「177 行删除 `ConfigRepo`，改为『不定义 trait』」），但 `tasks.md:157` **未同步**——任务书仍把一个被设计明确否定的抽象列为交付物。属「A 文档改了、B 文档未改」。

**建议改法**：`tasks:157` 改为「配置模块（**不引入 `ConfigRepo` trait**）：读 `ai-automation.json` → `Arc<RwLock<Config>>`；原子写回 + 失败回滚（见 proposal-02 §六 与 crud-06 〇/3.4）」。

### N-11【一般】名称锚 message 的**固化示例**在 `proposal-02 §10.1` 与 `crud-03/04`、`tests` 之间不一致，且 §10.1 的示例语义有误（`bash-build` 是 Client 名）

**位置与原文**：
- `p02:367`：`（示例：\`名称锚不一致：manifest.target.name=bash-build，ops/op_bash_build.yaml 内 name=op_bash_build\`）。前端**原样展示该 \`message\`、不做解析**（口径同 \`CLIENT_NOT_FOUND\`「响应体列出缺失名称」）。`
- 对照（本轮新写入的中性示例）：`crud-03:507`（`manifest.workflow.name=deploy_workflow，workflow.yaml 内 name=deploy_v2`）、`crud-04:508`（`manifest.target.name=deploy_workflow，workflows/wf_deploy_prod.yaml 内 name=wf_deploy_prod` / `manifest.job.name=hourly_check，job.yaml 内 name=hourly_check_v2`）、`tests:1925`。

**问题**：① 固化格式串三处**逐字一致**（✓），但**示例**不统一：`§10.1` 用 `bash-build`，`crud-03/04`/`tests` 用 `deploy_workflow`/`hourly_check`；② `bash-build` 在夹具中确为 **Client 名**（`tests:35`「`bash-build` 可由 `fixtures/tc_c2/tc_c2_05.yaml` 导入」），而 `manifest.target.name` 只能是 OP/Workflow 名 → 第 2 轮 L9 已指出的语义错误在 `§10.1`（B 组按 decisions 的 D11 原样照抄）**仍然存活**，而 C 组已明确「未采用该示例（属 L9 指出的错误）」。同一「固化」格式两个示例、其一语义错误。

**建议改法**：`p02:367` 示例改用中性名（与 `crud-04:508` 取同一例：`名称锚不一致：manifest.target.name=deploy_workflow，workflows/wf_deploy_prod.yaml 内 name=wf_deploy_prod`），并在其后加「（同一格式串的其它示例见 crud-03 3.3.9 / crud-04 3.4.10；示例中的名称仅为占位，`bash-build` 属 Client 名，不作名称锚示例）」。

### N-12【一般】`§10.1` 同一 code 映射两个 HTTP 状态，未说明枚举实现方式；表头「约 26 个」与「27 行」并存

**位置与原文**：
- `p02:331`：`> 全后端**错误码唯一总表**（**约 26 个**）。…code 拼写、HTTP 状态码、语义均以本表为准；实现枚举以此表为基准对齐。`
- `p02:339`：`| \`CLIENT_NOT_FOUND\` | 404 | Client 不存在（按 \`clientId\` 引用时） | crud-01/02/04 |`
- `p02:340`：`| \`CLIENT_NOT_FOUND\` | 409 | Client 不存在（**导入时按名称匹配不到**，Client 不自动创建；响应体列出缺失名称） | crud-03 3.3.9 / crud-04 3.4.10 |`

**问题**：表共 **27 行 / 26 个 code**，其中 `CLIENT_NOT_FOUND` **一码两态**。表头说「实现枚举以此表为基准对齐」——若照 Rust `enum` 一对一映射状态码，实现者无法同时满足 404 与 409；且「约 26 个」的模糊量词与正文计数（第 2 轮报告的「27 行 / 26 个 code」）不对齐，读者无法机械核验。同批 26 个 code 其余均一码一态。

**建议改法**：① 表头改为「共 **27 行 / 26 个 code**（其中 `CLIENT_NOT_FOUND` 依调用上下文取 404 / 409）」；② 在 §10.1「说明」补一条「**同一 code 允许随调用上下文返回不同 HTTP 状态**（当前仅 `CLIENT_NOT_FOUND`）：实现时状态码由抛错点决定，`code` 字符串不变；前端按 `code` 分支、按 `HTTP` 状态区分提示语境」。

---

## 轻微

### M-1【轻微】`L-11` 未落地：`crud-03:1047` 时序图仍用 `attempt` 命名契约字段 `retry_seq`

- 现文：`crud-03:1047` `│ ←── step_completed{step, act, attempt, result} ──│`
- 契约字段：`crud-03:690` `| \`step_completed\` | \`retry_seq\` | integer | 是 | 本次完成的 attempt 序号 | 与 step_records.retry_seq 对齐 |`；`crud-03:797` 同节另一处已正确写 `step_completed{run, step, activation_seq, retry_seq, result}`。
- **建议**：`crud-03:1047` 改为 `step_completed{step_id, activation_seq, retry_seq, result}`（与 `:797` 一致）。

### M-2【轻微】`L-1` 残留：`schema.sql:235-236` 注释仍写 snake_case 钩子名

- 现文：`schema.sql:235` `CHECK (source IN ('job','step')),    -- 任务来源: job=单次 OP/Job (Runner 触发, 完成调 job_complete 钩子)`；`:236` `--            step=workflow 步骤 (Engine 触发, 完成调 step_complete 钩子)`
- 对照：`p01:1678` `…完成调 JOB_COMPLETE）；step=workflow 步骤（Engine 触发，完成调 STEP_COMPLETE）`；`p02:60` 图注「on_complete 钩子（全局 JOB_COMPLETE / STEP_COMPLETE）」；`crud-03:965` `JobComplete`/`StepComplete`。
- **建议**：`schema.sql:235-236` 的 `job_complete` / `step_complete` 改为 `JOB_COMPLETE` / `STEP_COMPLETE`（第 2 轮 L-1 建议原文即此）。

### M-3【轻微】`G-4` 残留：原型注释仍写「配置目录」

- 现文：`原型图/mock-data.js:1213` `// runDir：当前配置目录（由 CLI 入口 -c 指定；未指定默认 ~/.ai-automation）；`
- 对照：`crud-06:24`「运行目录」、`p02:245`「长选项名 `--config-dir` 的语义即 crud-06 的 `runDir`（运行目录），**勿与「配置文件所在目录」混淆**」；`crud-06` 两处已修（该组报告以「配置目录=0」为核验证据，但未覆盖原型）。
- **建议**：改为 `// runDir：当前运行目录（由 CLI 入口 -c 指定；未指定默认 ~/.ai-automation；配置文件 ai-automation.json 位于该目录内）`。

### M-4【轻微】`D14` / `D18` 文案未同步到原型 `settings.html`

- `原型图/settings.html:186`：`{key:'max_loop_multiplier', …, desc:'循环节点执行总次数上限；0=不限制（按 max×3），否则与 max×3 取较小值。'}`
  → 对照 `crud-06:82`「**`0` / 未设置 = 不施加绝对上限，仍受 `max×3` 约束——不是无限**」。`0=不限制` 正是 D14 明令废止的措辞（本轮 `crud-06:80/348` 已改，原型未改）。
- `原型图/settings.html:187`：`desc:'失败调度事件保留 1 天后软删除、2 天后物理删除。'`
  → 对照 `crud-06:83`「软删 = `engine_event_retention_days` 天（默认 1）/ 硬删 = 软删 + 1 天（默认 2）」——硬编码 1/2，改配置后界面文案不再成立。
- **建议**：`settings.html:186` 改「0 或未设置 = 不施加绝对上限（仍受 max×3 约束，非无限）」；`:187` 改「软删 = 该值 天后软删除、再 1 天后物理删除（默认 1 → 2 天）」。

### M-5【轻微】`L-9`/`P2` 残留：`EXPORT_UNAVAILABLE` 仍为原型独有错误码，未登记总表也未复用既有码

- 现文：`原型图/mock-data.js:2105` `return resolve(__err('EXPORT_UNAVAILABLE', '导出组件未加载（请确认已随页面部署 xlsx-lite.js），请检查后重试'));`
- 对照：`p02:331` 声明 §10.1 为「**全后端错误码唯一总表**」；`tasks:84`「错误展示一律按 §10.1 映射」；`_fix_v2_decisions.md` 低成本项 3「SheetJS 打包进 `ui/`（本地内置，不走 CDN），**不新增错误码**」——按此推演该场景应消失；P2 备选是「明确改为复用 `INTERNAL_ERROR`」。现 CDN 已移除（`cdn.jsdelivr` 0 残留 ✓）但该码**保留了**，成为总表外唯一存活 code。
- **建议**：二选一——① 把 `:2105` 的码改为 `INTERNAL_ERROR`（`原型` 与 `§10.1` 对齐，零新增）；② 或在 `p02 §10.1` 增行 `| \`EXPORT_UNAVAILABLE\` | 500 | 导出组件（本地内置库）未加载 | crud-05 3.5.10 |` 并同步 `crud-05 3.5.10`。

### M-6【轻微】`L-12` 残留：编号体系混用的剩余处

- `tasks:48`：`| T1.8 | 统一分页/筛选/排序基座（…） | proposal-02 §11 | 所有列表接口复用 |` —— 同为 `proposal-02 §11`，`tasks:125` 已补括注「（十一、分页规范）」，`:48` 未补。
- `tasks:235` / `:238`：`crud-03 §4.3` / `crud-03 §4.3.1` —— 全表其余行体例为 `crud-03 4.3.4`（无 `§`）。
- `crud-01:75` / `crud-02:72`：`按 \`schema.sql\` §1 clients 全列对齐` / `§2 ops` —— `schema.sql` 正文体例为「第 N 节」（`crud-06:184` 用的是「schema.sql 第 4 节」）。
- **建议**：`tasks:48` 补「（十一、分页规范）」；`tasks:235/238` 去 `§` 改 `crud-03 4.3`/`4.3.1`；`crud-01:75`/`crud-02:72` 改 `schema.sql 第 1 节`/`第 2 节`。

### M-7【轻微】`G-3` 附带的辨析句未补

- 现文：`crud-03:1114` `> 说明：本判定按 \`NodeRetry.on\` 与结果匹配触发；下文以 \`failed\` 为例，\`on=success\` 时对**成功**结果同样判定重试。`
- 第 2 轮 G-3 建议：「在 `crud-03:1067` 补括号『（此处 `failed` 指**节点结果**；retry 条件值为 `failure`/`success`，注意区分）』」。现文 `failed` 出现时**仍未**辨析，而 `EdgeCondition` 恰好用 `on_failure`（`crud-03:104`）→ `failed` / `on_failure` / `failure` 三词同屏，易混。
- **建议**：在 `crud-03:1114` 末尾加「（**辨析**：`failed` 是**节点结果**值；重试条件值为 `failure`/`success`（`crud-03:93`）；**边条件**值为 `on_failure`/`on_success`（`crud-03:104`）——三者取值域不同，勿混用）」。

### M-8【轻微】`D14` 注未覆盖全部 `min(max × 3, max_loop_multiplier)` 出现处

- 已加注：`p01:2305`/`:2310`/`:2311`（§15.2）、`:2990`（§21 硬约束 7）、`:3082`（超时与循环规范）、`crud-03:738`、`crud-06:82`。
- 未加注：`p01:30`（硬约束 16「循环终止由 min(max × 3, max_loop_multiplier) 控制」）、`p01:2436`（对比表「执行次数上限 | 正常失败 → min(max × 3, `max_loop_multiplier`) 后终止」）、`p01:2892`（§20.1 释义表「循环终止 | min(max × 3, max_loop_multiplier)」）、`p01:1351`（§10.14 注，写了公式但未含 `0` 语义）、`crud-03:653`/`:800`/`:803`/`:813`/`:840`/`:1084`/`:1122`。
- **问题**：`0` 语义是 D14 的关键（不施加绝对上限 ≠ 无限），但至少 `p01:2436`/`:2892`/`crud-03:1122` 属**结论性**表述（对比表 / 决策释义表 / 事件链判定式），读者可能据公式字面代入 `0` 得「立即触顶」。第 2 轮 Q3 即针对此。
- **建议**：对 `p01:30`、`p01:2892`、`crud-03:1122` 各补 6–10 字注：「（`max_loop_multiplier=0` 时 = `max×3`，见 §15.2 / crud-03 4.3.0 ①）」。

### M-9【轻微】`crud-03:309` 3.3.6 功能说明内部自相矛盾（D2 措辞未改净）

- 现文：`**功能说明**：…前端在保存或执行前调用（**仅用户主动点击 [校验] 时**；[保存] 不要求校验通过、[执行] 由后端在创建 Run 前做同一套拓扑校验，见 D2）。`
- **问题**：「前端在**保存或执行前调用**」与「**仅**用户主动点击 [校验] 时（调用）」互斥——前者意味着保存/执行会触发 `POST /validate`，后者明确只由点击触发。D2 已在 `p01:1154-1157` 定稿「`[校验]` 与 `[保存]` 独立；保存前不调 `validate`」。
- **建议**：改为「**前端仅在用户主动点击 [校验] 时调用本接口**；[保存] 不要求校验通过（允许草稿）；[执行] / Job 触发时由后端在创建 Run 前做同一套拓扑校验（见 D2 / proposal-01 §10.9），不调用本接口」。

### M-10【轻微】`crud-03` 内部引擎入口命名不一致（`run` vs `runId`）

- `crud-03:790`：`├─ engine_start{run, workflow_id[, resumeFromRecordId]}                 ← notify(EngineStart) 写库后立即调用`
- `crud-03:1235`：`- 随后调 \`engine.notify(EngineStart{ runId: 新 Run, resumeFromRecordId })\`…`
- **问题**：同一 payload 的「新 Run」在 `:790` 写作 `run`、在 `:1235` 写作 `runId`；同节 `:688` 的 payload 字段名是 `resumeFromRecordId`（camelCase）而 `:790` 的其它字段是 snake_case（`workflow_id`）→ 同一事件三种命名风格。
- **建议**：统一为 `engine_start{run_id, workflow_id[, resumeFromRecordId]}`（`:790` 改 `run_id`），并在 `:688` 的 payload 字段表补 `run_id` / `workflow_id` / `inputs` / `workspace` 行（当前只列了 `resumeFromRecordId`）。

### M-11【轻微】`validation.md` 的行号锚全部失效（与 F-1 同源，单列以便逐处修）

- 实测（现内容已与锚不符）：`p01:1328`→§10.13 表格、`p01:2452`/`:2454`→空行、`p01:2281`→「on=success 时超时…」；`crud-03:107`→空行、`:691`→payload 行、`:1077`→判定第二步；`crud-04:325`→`queue` 策略表、`:598-600`→Scheduler 引言+围栏；`crud-05:348`→`**错误响应**：`、`:573`→`add_job` 签名、`:634`→状态机；`tests:1807`/`:1829`→「- **优先级**：P3」、`:1886`→「2. 执行详情…」；`原型图/workflow.html:1444`→注释 N11、`:1291`→坐标钳制、`:1537`→`</select>`、`:1888`→版本号渲染、`:1749`→校验规则映射；`原型图/job.html:893`→`OPS.map`、`:1031`→`validateJobForm()`；`原型图/mock-data.js:1494`→「errors 文案对齐…」注释。
- **建议**：随 F-1 一并处理——把 `validation.md` 的行号锚改为「文件 + 章节号 + 关键词」，或整篇标注为历史留档。

---

## 需拍板

| # | 待决事项 | 现状与冲突 | 建议选项 |
|-|-|-|-|
| **P-1** | `validation.md` 与 `_fix_v2_decisions.md` 的权威关系 | `validation.md:96` D6 建议 **B**（从头跑）vs `_fix_v2_decisions.md:18` D6 拍板 **A**（保留续跑，已落地 `crud-03 4.3.4` / `crud-05 3.5.8`）；`validation.md` 自称「默认按建议执行」（`v:87`）且未标注已被取代 | **A（推荐）**：保留 `_fix_v2_decisions.md` 为唯一权威，在 `validation.md` 顶部加「处置状态 + 与本报告建议的差异（D6 取 A）」段，并把 `## 一、严重` 12 项逐条标「已修」；<br>**B**：回退续跑机制（须同步删 `crud-03 4.3.4`、`crud-05:385-393/415-427`、`crud-03:790/1235`，并改 `tests:1662` 断言）——**代价高、不建议** |
| **P-2** | `crud-03:119` 规则 8「多入边必须有明确汇聚」是否保留为硬 400？ | 契约侧保留（`crud-03:119` + `:309` 计入「17 条」），界面侧（`p01 §10.14`）与原型（`mock-data.js:1493`）已删除；`p01 §10.5` 又说「不单独配置汇聚策略，由 DAG 边决定」 | **A（推荐）**：**删除该校验项**（与 §10.5 一致、与原型/G14 一致）→ 改 `crud-03:119` 为说明性文字、`:309` 的 17 条改 16 条；<br>**B**：保留 → 把该条补回 `p01 §10.14` + 提示表，并恢复 `mock-data.js` 判定 |
| **P-3** | `#n` 局部编号的处置方式 | `p01:2923` 新增「`#1..#8` 不可跨文件引用」，但全库仍有 9 处跨文件 `crud-04 3.4.6 #3`；`crud-04` 内 `#3/#4/#5` 一符多义；`tests` 的 `#n` 是数据行号 | **A（推荐）**：**跨文件引用一律改具名**（`crud-04 3.4.6「job_queue_waiting_max 的语义」`）+ 各文件小节内加编号表 + `tests` 的 `#n` 改「数据集行 n」；<br>**B（低成本）**：保留 `#n`，把 `p01:2923` 的「不可跨文件引用」改为「跨文件引用须同时写出章节名与小节标题」，并补一张 `#1..#8` 的总对照表；<br>**C**：全部改具名标签（`（约定-…）`，彻底消除一符多义，改动面最大） |

---

## 修复顺序建议

**第 0 批（拍板，阻塞后续）**：**P-1 / P-2 / P-3** —— 决定改 `validation.md` 还是回退续跑、改 `crud-03` 还是改 `p01`+原型、以及编号策略。

**第 1 批（契约级，必须先改；改完重跑本报告 §1 全部脚本）**
1. **F-1 + M-11**：`validation.md` 加处置状态段、D6 差异说明、12 项「已修」标注，行号锚改语义引用，`v:9` 的 86/4/18/11/53 → 90/4/18/11/57。
2. **N-8**：`schema.sql:218` 改「本轮尝试计数 = 记录数（首次执行计入）」——它是 DB 层唯一事实来源，优先级等同 `crud-03`。
3. **N-1 + N-2**：`crud-03:329/473/588/608`、`crud-04:474/576` 补 `400 VALIDATION_ERROR`（或用通用约定的「统一生效」句一次收口）；`crud-04` 4.5.1–4.5.6 提为标题级。
4. **N-3 + N-4**（随 P-2）：统一「汇聚」条与「软删/硬删」换算，三/四处逐字一致。
5. **N-9 + N-10**：`tasks:230`（T8.6）改引 crud-03 17 条；`tasks:157`（T5.2）删 `ConfigRepo`。

**第 2 批（术语、编号与默认名一致性，改动小、影响面广）**
6. **N-5**（随 P-3）+ **N-6** + **N-7** + **N-11** + **N-12**：`#n` 具名化；原型删 `slugName`；`settings \`X\`` 统一；`§10.1` 示例改中性名；`§10.1` 表头计数与一码两态说明。
7. **M-2 / M-3 / M-4 / M-6 / M-7 / M-9 / M-10**：`schema.sql` 钩子名、`配置目录` 注释、`settings.html` D14/D18 文案、编号体例、`failed` 辨析、3.3.6 措辞、引擎入口命名。

**第 3 批（完善性）**
8. **M-1**（L-11 时序图 `retry_seq`）、**M-5**（`EXPORT_UNAVAILABLE` 处置）、**M-8**（D14 注补全）。

**复核要求（改完再跑一遍 §1）**
- ① 交叉引用 0 悬空（当前 3 处因层级问题失败 → 目标状态 0，`crud-04 4.5.2` 应可被标题级工具解析）；② 端点覆盖：crud 声明路径与 `p01 §17` 双向 0 差异（当前仅 `/api/workspaces/browse` 的「已移除」标注）；③ **全部路径参数端点错误表含 400**（当前 6 处缺）；④ 错误码：总表行数/唯一 code 数与表头声明一致，编外 code = 0（当前 1 个 `EXPORT_UNAVAILABLE`）；⑤ 枚举：`retry.on` 后接值仅 `failure|success`、`EdgeCondition` 仅三值、触发来源 5 值单值；⑥ 关键字段唯一性：`retry_from_record_id` / `resumeFromRecordId` / `retryFromRecordId` 无旧名残留（当前仅 1 处说明性引用，可接受）；⑦ 默认值/上限：`max_loop_multiplier=0` 措辞全库一致（不得再出现「0=不限制」）、`engine_event_retention_days` 换算表述逐字一致；⑧ `retry.max` 三处来源（`p01 §15.2` / `crud-03 4.3.x` / `schema.sql` 注释）措辞一致；⑨ 全库 `settings \`<键>\`` = 0；⑩ 跨文件 `#n` 引用 = 0。
