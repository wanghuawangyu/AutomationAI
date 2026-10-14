# 修复报告（第 2 轮修复者 · B 组续作：`proposal-02-后端设计.md` + `crud-01` + `crud-02` + `crud-06`）

> 口径：`_fix_v3_decisions.md`（唯一权威）；依据 `_val3_02_be.md`（本组项）、`_val3_05_global.md`（本组项）。
> 只改：`proposal-02-后端设计.md`、`proposal-02-后端crud-01client管理.md`、`proposal-02-后端crud-02op管理.md`、`proposal-02-后端crud-06配置管理.md`。
> 背景：上一批修复员中途挂掉，已落下大部分改动；本续作**逐项审计已落地/未落地 → 只补齐缺口**，不重改已完成项。
> 编码 / 行尾：4 文件均 **UTF-8 / CRLF=0（保持 LF）/ 无 BOM / 末行有换行**（改动前后一致，未做整文件换行转换）。

---

## 一、审计结果（逐项；grep 判定）

### 已落地（上批已改，本轮确认，**未重改**）

| 口径项 | 落点（改后行号） | 证据 |
|-|-|-|
| 二.9 D11 示例改**中性锚** | `proposal-02-后端设计.md:373` | 示例为 `名称锚不一致：manifest.target.name=deploy_workflow，workflows/wf_deploy_prod.yaml 内 name=wf_deploy_prod`；`bash-build` 仅作否定说明（「属 Client 名，不作名称锚示例」） |
| 二.11 `job_queue_running_max` 补**下限 1**（范围 1..10） | `crud-06:78`（配置项表）、`:287`（数值项上限表）、`:297`（取值说明）、`:394`（变更记录 v2.4） | grep「范围 1..10」「下限 1」均在位；`>=1 且 <=10` 表述一致 |
| 二.12 ZIP 包体积上限**沿用 `op_import_max_bytes`**（不新造键） | `crud-06:73`（client 键注「不用于 ZIP 包」）、`:74`（op 键「同一键亦为 ZIP 包体积上限／沿用现有键、不新造键」）、`:298`、`:369/:370`（§四 联动表）、`:394` | grep「沿用 `op_import_max_bytes`」「不新造键」均在位；无新键 |
| 一.9 本组内 `settings \`X\`` 术语 | 4 文件 | `settings \`` = **0 残留**（crud-06 内 `settings` 仅「settings 表已废弃」说明、`/api/settings` 端点名、`settings.html` 原型引用） |
| N7（BE）`TARGET_NOT_FOUND` 语义覆盖「重试」 | `proposal-02:350` | 「**重跑**时目标…已删除；**重试**时目标 Workflow 已删除（与重跑对称，见 crud-05 3.5.8 / 3.5.9）」 |
| N12（BE）crud-06「最近使用」口径 | `crud-06:324`（SQL 前措辞）、`:336`（时间基准说明） | 「最近一次提交（入队）时间 `created_at_ms` 倒序，非 `started_at_ms`」；SQL `GROUP BY workspace … ORDER BY last_used DESC` |
| N-11（global）§10.1 固化的名称锚示例 | `proposal-02:373` | 中性示例 + 其它示例指向 crud-03 3.3.9 / crud-04 3.4.10 |
| N-12（global）§10.1 表头计数与一码两态说明 | `proposal-02:336`（共 27 行 / 26 个 code）、`:370`（同一 code 允许随上下文取不同 HTTP 状态，当前仅 `CLIENT_NOT_FOUND`） | 机械计数 27 行 / 26 code，与表头一致 |
| N6（BE）crud-02 3.2.4 补 D9 审计字段规则 | `crud-02:209`（请求体表）、`:211`（审计字段规则块）、`:219`（400 行注） | 「一律忽略、不报错」+ 与 crud-06 只读项「明确拒绝 400」的区别 |
| M-6（global）schema.sql 节号体例 | `crud-01:77`（`schema.sql 第 1 节`）、`crud-02:74`（`schema.sql 第 2 节`） | 均无 `§1`/`§2` 残留 |
| 二.5 行内编号对照表 | `proposal-02:6–9`（引用与编号约定 + `G9` 释义）、`crud-01:75`（`D5`/`D9`）、`crud-02:72`（`D5`/`D9`）、`crud-06:131`（`G11`/`D6`/`C4`） | 各文件在用行内标签均带释义与出处；跨文件引用一律具名 |
| 章号混用（本组） | `proposal-02:6–9` | 顶部约定：章用中文数字、节用 `§N.M`、`crud-0X` 不带 `§`、`schema.sql` 用「第 N 节」 |
| decisions 一.7「400 行」在本组的覆盖 | crud-01 3.1.1–3.1.8、crud-02 3.2.1–3.2.8、crud-06 3.4/3.6 | 本组**全部路径参数端点错误表均含 `400 VALIDATION_ERROR`**，0 缺（crud-06 3.1/3.2/3.3 恒 200、3.5 无入参故无 400） |

### 未落地 / 半落地（→ 本轮补齐）

| # | 口径项 | 原文 | 判定 |
|-|-|-|-|
| 1 | 章号混用（本组最少修正遗漏处） | `proposal-02:125` 仍写「见 **§2** 模块 13 / §9.3」（阿拉伯章号，违反本文件 `:7` 自定规则「不写 `§2`」） | 未落地 |
| 2 | 错误码一致性（本组通用约定） | `crud-01:70` 通用约定仅「格式非法返回 400」，未写 code，与 `crud-02:67`「→ 400 `VALIDATION_ERROR`」及本文件各错误表不一致 | 半落地 |

---

## 二、本次补齐项

| # | 口径 / 报告项 | 文件:行（改后） | 改法 |
|-|-|-|-|
| 1 | 章号混用最少修正（`§2`→`§二`） | `proposal-02-后端设计.md:125` | 「见 **§二** 模块 13 / §9.3」——阿拉伯章号改中文数字，与 `:7` 约定及全文 `§二` 体例一致 |
| 2 | 错误码一致性（路径参数 400 补 code） | `proposal-02-后端crud-01client管理.md:70` | 「格式非法返回 400 **`VALIDATION_ERROR`**」——与 `crud-02 3.2.0`、本文件各错误表及 `proposal-02 §10.1` 总表一致 |

> 说明：除以上 2 处外，本组口径项经逐项 grep 均为**已落地**，未作任何重改（避免破坏上批成果）。

---

## 三、未落地项与原因（出本组范围）

| 项 | 位置 | 原因 |
|-|-|-|
| S1/D6 边状态初值、二.2 D6 闭环、二.4 汇聚删条、二.13 种子选择、二.14 顺序、G1–G3、N1–N5、N8–N11、N13、N14（BE） | `crud-03`/`crud-04`/`crud-05`/`schema.sql` | **不在本组允许文件**（C/D 组负责） |
| 一.9 剩余 `settings` 术语（crud-05 ×6、tasks ×3）、二.3 触发文案、二.10 `manifest.clients[].clientId` | `crud-05`/`tasks.md`/`crud-03`/`crud-04`/`tests` | 出本组范围 |
| 拍-4 / G5（BE）`proposal-01 §20.1` 补登 D8–D18 及新增 G/N 标签释义 | `proposal-01` | 出本组范围；本组 4 文件已按「具名 + 对照表」落地 |
| N-1（global）`crud-03` 4 端点 + `crud-04` 2 端点 400 行 | `crud-03`/`crud-04` | 出本组范围；**本组端点已 0 缺**（见一、已落地末行） |
| N-2、M-1–M-5、M-7–M-11（global） | `crud-04`/`schema.sql`/原型/`tests`/`tasks`/`validation.md` | 出本组范围 |

> 冲突 / 暂停项：**无**（decisions 各项在本组 4 文件内均可无冲突落地）。

---

## 四、自检证据（命令与结果）

> 环境：`cd docs\cli非交互式`，Python 3.12（`PYTHONIOENCODING=utf-8`，只读脚本置于 `C:\Users\Public\_jcode_*.py`，核查后删除）。

| 检查 | 结果 |
|-|-|
| 旧措辞 0 残留 | `settings \`` / `记录数` / `最大重试` / `0=不限制` / `配置目录` / `slug` / `（或返回 400` / `按约定拒绝` / `ConfigRepo` / `§2 模块` → **4 文件均 0**；`§11` 仅 `:7` 的「不写 `§11`」规范示例；`bash-build` 仅 `:373` 的否定说明 |
| 新措辞到位 | `共 **27 行 / 26 个 code**`、`同一 \`code\` 允许随调用上下文返回不同 HTTP 状态`、`manifest.target.name=deploy_workflow`、`§二 模块 13`（proposal-02）；`一律忽略、不报错`、`配置项 \`client_import_max_bytes\``、`schema.sql 第 1 节`、`400 \`VALIDATION_ERROR\``（crud-01）；`配置项 \`op_import_max_bytes\``、`schema.sql 第 2 节`（crud-02）；`范围 1..10`、`下限 1`、`沿用 \`op_import_max_bytes\``、`不新造键`、`created_at_ms`、`GROUP BY workspace`（crud-06）→ **全部 OK** |
| 引用存在 | 本组 4 文件内全部 `crud-0X N.N(.N)` 引用对目标文件标题集合逐一比对 → **0 悬空**；`proposal-01 §20.1 决策编号释义` 存在；`crud-01:77`/`crud-02:74` 指向的 `schema.sql` 第 1/2 节齐备 |
| 表格列数一致 | 逐表（转义 `\|` 后计数）→ **0 处不一致** |
| `**` 奇偶 | 4 文件逐行 `**` 计数 → **全部偶数（0 ODD）** |
| 错误码集合比对 | 本组在用的 error code（VALIDATION_ERROR / CLIENT_NOT_FOUND / CLIENT_NAME_EXISTS / CLIENT_REFERENCED / CLIENT_TYPE_MISMATCH / OP_NOT_FOUND / OP_NAME_EXISTS / OP_REFERENCED / CONCURRENCY_CONFLICT / INTERNAL_ERROR / WRITE_FAILED 等）**全部命中 `proposal-02 §10.1` 26-code 总表，0 编外** |
| 枚举 / 默认值一致性 | `type`(prompt/bash/python/powershell)、`inputMode`(arg/stdin/file)、`outputMode`(text/json/jsonl)、`page_size`(10/50/100/1000 默认 10)、`timeoutSeconds`(范围 1..86400 默认 60)、`uptimeMs`(string 时长) —— 组内一致 |
| 端点 400 覆盖 | 本组全部路径参数端点错误表含 `400 VALIDATION_ERROR` → **0 缺** |
| 行尾 / 编码 | 4 文件 **CRLF=0 / BOM=False / 末行有换行**（LF 保持） |
| git 范围 | `git status --porcelain` 仅本组 4 文件被本组改动（其余为它组改动） |
