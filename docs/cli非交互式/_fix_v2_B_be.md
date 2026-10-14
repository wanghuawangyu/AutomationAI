# 修复报告（B 组 · 后端设计 + crud-01/02/06）

- 修复者：修复者 B（后端文档）
- 允许修改文件（仅这 4 个，均已改）：`proposal-02-后端设计.md`、`proposal-02-后端crud-01client管理.md`、`proposal-02-后端crud-02op管理.md`、`proposal-02-后端crud-06配置管理.md`
- 未触碰：`crud-03/04/05`、`schema.sql`、`tests/`、`原型图/`、`tasks.md`、`proposal-01`、`validation.md`、`_fix_v2_decisions.md`
- 口径依据：`_fix_v2_decisions.md`（唯一权威）+ `_val2_02_backend.md` / `_val2_04_global.md` / `_val2_05_new.md`
- 编码 / 行尾：全部 UTF-8 + **LF**（改前 4 文件即纯 LF，改后仍纯 LF、无 CRLF 混入）

---

## 已修项表

| 项 | 来源 | 文件:节 | 改法 |
|-|-|-|-|
| **D9** PUT 审计字段 | decisions | crud-01 3.1.4（原 :271/:289 与 3.1.4 功能说明） | 统一为「实体审计字段（`clientId`/`createdAtMs`/`updatedAtMs`）**一律忽略、不报错**」；错误表 400 行删除「携带审计字段按约定拒绝」，改为「携带审计字段不属于错误」；并写明**与 crud-06 配置只读项（明确拒绝、400）的区别** |
| **D11** 名称锚 message 格式 | decisions | proposal-02 §10.1「说明」 | 固化：``名称锚不一致：manifest.<锚字段>=<值>，<包内路径> 内 name=<值>``，含示例与「前端原样展示、不解析」，并引 crud-03 3.3.9 / crud-04 3.4.10 |
| **D14** `max_loop_multiplier=0` | decisions | crud-06 一（:80 行）、3.4 数值项上限、§四 联动表 | 统一为「`0`/未设置 = **不施加绝对上限、仍受 `max×3` 约束——不是无限**」，删除「0=不限制」措辞；并补「下次 Run 读取时生效」 |
| **D18 / G-7 / N5** 事件保留换算 | decisions + val2_02 | crud-06 一（:81 行）、§四 联动表 | 明确 **软删 = `engine_event_retention_days` 天（默认 1）**、**硬删 = 软删 + 1 天（默认 2）**；保留默认 1 时「1 天软删 / 2 天硬删」表述 |
| **低成本 1** `OP.timeoutSeconds` | decisions | crud-02 3.2 对象字段 / 字段映射 / 3.2.3 / 3.2.7 YAML | 统一为**范围 1..86400、默认 60（新建时预填 60）、必填**；3.2.3/3.2.8 错误表补「缺失或超范围」 |
| **低成本 2** 导入体积上限取现有键 | decisions | crud-01 3.1.8、crud-02 3.2.8 | 沿用现有键 `client_import_max_bytes` / `op_import_max_bytes`（不新造）；措辞由 `settings X` 改为**配置项 X（`ai-automation.json`，见 crud-06 一）** |
| **G5** §10.1 定义位置列 | val2_02 | proposal-02 §10.1 | `CLIENT_TYPE_MISMATCH` 补 crud-03 3.3.9 / crud-04 3.4.10；`OP_NOT_FOUND`、`WORKFLOW_NOT_FOUND` 补 crud-04；`CONCURRENCY_CONFLICT` 补 crud-04 4.5.2 / crud-05 4.6 |
| **G6** engine.notify 分流 | val2_02 / val2_04 | proposal-02 §1.2 执行数据流 3 | 改为「单次 OP / Job(target=op) 直接派发 WorkerPool；Job(target=workflow) / 单次 Workflow 调 `engine.notify`（仅限 workflow 类；Job target=op 不得走 Engine）」 |
| **G7** Client 删除引用检查不对称 | val2_02 | crud-01 3.1 业务规则 / 3.1.5 / 错误表，proposal-02 :348 | 删除检查与 `CLIENT_REFERENCED` 语义由「正被 Job 引用」扩为「**Job.target.clientId（kind=op）或 Workflow 节点级 `client_id`**」 |
| **G8** 导出默认名 slug | val2_04 | crud-01 3.1.7 | 删除「slug 形式」，改为「name **原样**、与 OP/Workflow/Job 同口径、不做字符替换 / 名称改写」 |
| **G9**（FK PRAGMA 不持久） | val2_02 | — | **不在本组文件范围**（`schema.sql`）；已在 未修项 说明 |
| **G10** workspaces SQL 不可执行 | val2_02 | crud-06 3.6 | `SELECT DISTINCT … ORDER BY MAX()` 改为可执行的 `SELECT workspace, MAX(created_at_ms) AS last_used … GROUP BY workspace ORDER BY last_used DESC LIMIT ?1`；`limit` 补 **∈ 1..1000**，并入 3.4 数值项上限表 |
| **G11** 配置值 JSON 类型 | val2_02 | crud-06 §一（总则）、§二 通用约定、3.4 PUT 请求体 | 「配置值一律为 string（数值/布尔/枚举），后端解析为强类型」；PUT 请求体 value **必须为 string、非 string → 400**；表「默认」列注明为逻辑类型 |
| **G13 / L-2** 行内编号无定义 | val2_02 / val2_04 | crud-01:533 `（M20）`、crud-06 `（P6）`、crud-02 `crud-04 3.4.6 #3` | 无释义的编号改为**文字/真实小节引用**：M20→「见 5.1 运行目录约定」；P6→去掉标签；`#3`→「crud-04 3.4.6『`job_queue_waiting_max` 的语义』」。已在 `proposal-01 §20.1` 释义表内的 `D5/D6/C4/T26` 保留 |
| **N10** `settings X` 术语陈旧 | val2_02 | crud-01:429、crud-02:280/:370 | 改为「配置项 `X`（`ai-automation.json`，见 crud-06 一）」 |
| **N11 / L-4** Repo 清单重复 / ConfigRepo 悬空 | val2_02 / val2_04 | proposal-02 §六 | 176 行去掉重复的 `ClientRepo`；177 行删除 `ConfigRepo`，改为「不定义 trait」 |
| **N12 / L-1** on_complete 图注指向错误 | val2_02 / val2_04 | proposal-02 §1.2 图 | 图注改为「on_complete 钩子（全局 JOB_COMPLETE / STEP_COMPLETE）」；§1.2 表 `job_complete` → `JobComplete` |
| **N13** 状态机漏 terminating | val2_02 | proposal-02 §1.2 表 | `waiting → running → terminating → 终态` |
| **N15** `opId` 名称锚措辞 | val2_02 | crud-02 3.2.7 | 改为「`opId` 由后端重新生成；引用方按**名称**重映射」 |
| **G-1** 端点错误表缺 400 | val2_04 | crud-01 3.1.7、crud-02 3.2.7 | 各补 `400 VALIDATION_ERROR`（id 格式非法） |
| **G-4** 「配置目录」误用 | val2_04 | crud-06 3.3 / 响应注 | 2 处「配置目录」→「运行目录」 |
| **G-6** test `success` 定义矛盾 | val2_04 | crud-01 3.1.6 响应字段表 | 改为「`ExecuteResult.status == success`（rc_file 退出码 ∈ `exitCodeSuccess`；超时亦 `false`）」 |
| **G-11** 前端默认 vs 后端默认 | val2_04 | crud-01 3.1.3 | 补「`inputMode`/`outputMode`/`outputJsonPath`/`argsTemplate` 缺省 `null`（脚本类恒 `null`，不参与校验）；前端 arg/json 仅预填建议值」 |
| **L-3** `uptimeMs` 类型说明 | val2_04 | crud-06 3.1 | 「毫秒时间戳」→「进程已运行**时长**（毫秒数，string，非时间戳）」 |
| **L-5** §12 对应关系表缺章 | val2_04 | proposal-02 §十二 | 补 十六 / 十八 / 十九 / 二十 / 二十一 五行映射 |
| **L-6** JSON 分组键无对照 | val2_04 | crud-06 一 | 分组列补 JSON 键（`通用（general）`…`日志（log）`，`运行历史（history，含并发上限）`、`Task Runner（runner）`） |

---

## 机械自检（命令与结果）

> 环境：`cd docs\cli非交互式`，Python 3.12（`PYTHONIOENCODING=utf-8`）。命令为单行 `python -c`（多行 `-c`/heredoc 在本机 cmd 不可用）。

1. **旧措辞 0 残留**（`count(...)` 全部为 0）：
   - proposal-02：`on_complete 钩子（WorkerPool`、`Job / Workflow 调`、`waiting → running → 终态`、`ClientRepo, OpRepo`、`ConfigRepo`、`job_complete 写`
   - crud-01：`slug`、`（M20）`、`settings \`client_import_max_bytes\``、`一律忽略（或返回 400`、`含请求携带审计字段时按约定拒绝`、`正被 Job 引用`
   - crud-02：`settings \`job_queue_waiting_max\``、`settings \`op_import_max_bytes\``、`3.4.6 #3`、`opId\` 由名称锚重映射`、`缺省 60`
   - crud-06：`配置目录`、`（P6）`、`0=不限制`、`SELECT DISTINCT workspace`、`ORDER BY MAX(created_at_ms) DESC`
   → 结果：**全部 ok（=0）**。
2. **新措辞到位**（`count(...) >= 1`）：D9 措辞、D11 message 格式、D14「不施加绝对上限」、D18「软删 = … / 硬删 = 软删 + 1 天」、timeoutSeconds「范围 1..86400」、`opId` 由后端重新生成、G10 `GROUP BY workspace` 与 `∈ 1..1000`、G11「JSON 线格式」「value 必须为 string」、G6 分流句、G5 定义位置、L-5 五章行 等 → 结果：**全部 OK**。
3. **引用章节存在**（目标标题在对应文件内可检索）：`crud-03 3.3.9` / `4.3`、`crud-04 3.4.3/3.4.4/3.4.10`、`crud-05 4.6 / 3.5.10`、`crud-06 3.4`、`crud-01 3.1.8`、`crud-02 3.2.8` → 结果：**全部 OK**。
4. **行尾 / 编码**：4 文件改后 `crlf=0`（纯 LF），字节数与改前同量级，无整文件换行转换。
5. **git 范围**：`git status --porcelain` 显示仅这 4 个受管文件被我改动（其余 M/?? 为同组他人改动与既有临时文件）。

---

## 未修项与原因

| 项 | 位置 | 原因 |
|-|-|-|
| **G9** `PRAGMA foreign_keys` 不随连接生效 | `schema.sql:14`（+ crud-06 〇 / proposal-02 §1.1/§6 连接初始化约定） | `schema.sql` **不在本组允许文件**，且改动涉及 DB 访问层约定；按「不碰他人文件」交由 schema/db 组处理。**本组未改，避免冲突。** |
| **G7 ②** 「节点 clientId 非空但 Client 不存在」的运行期处理 | `crud-03:110` | 属 crud-03（他人文件）。本组已完成 G7 ①（删除检查覆盖 Workflow 节点，从源头阻止悬挂），② 的运行期兜底待 crud-03 组补。 |
| **N7** ZIP 导入体积上限 / zip-slip、**N1/N2/N3/N4/N6/N8/N9/N14/N16** | crud-03/04/05、schema、tests | 均不在本组允许文件；且「导入体积上限取现有配置项、不得新造」（decisions 低成本 2）与 N7 的「新增 `package_import_max_bytes`」冲突——**以 decisions 为准**，本组未新造配置项。 |
| **`OP.timeoutSeconds` 必填 vs G-11「缺省落 60」** | crud-02 | decisions 低成本 1 明定「**必填**（新建时预填 60）」，与 `_val2_04` G-11 建议的「请求体缺 → 后端落 60」互斥；**以 decisions 为准**取「必填」，并保留「默认 60」语义（DB `DEFAULT 60` / 前端预填 / 导入缺省）。如后续要以「缺省落 60」为准，需同步回改 crud-02 3.2.3/3.2.7 与错误表。 |
| **`retry_from_record_id` / D1 / D2…等其他 decisions 项** | crud-03/04/05、schema、tests、原型 | 不属本组文件。 |
| **proposal-02 章号混用（`§7`/`§2` vs 中文数字标题，L-12）** | proposal-02 | 未列入本组必做清单；改动面广（跨 tasks/tests 引用），本次未动，避免与他组冲突。 |

> 冲突/暂停项：**无**（decisions 各项在本组文件内均可无冲突落地）。
