# 第 4 轮修复报告（D 组：`proposal-02-后端crud-05运行历史.md` + `schema.sql`）

> 口径基准：`_fix_v4_decisions.md`（唯一权威，未写入）。只改上述两文件；UTF-8 + LF。

## 已修项（含证据）

| 项 | 落地点（改后行号） | 证据（机械核对） |
|-|-|-|
| 一.2 五步初值总则 + 死枝闭包（与 crud-03 4.3.4② 同口径） | `crud-05:395-402`（3.5.8④） | 新措辞：`死枝闭包`×2、`全边先置`×1、`递归传播至不动点`×1、五步 `①…⑤` 齐备 + `⑥ 风险说明`（含死枝例 `A →{on_failure} Z`→`Z → End`）；旧措辞 `终态时的边状态`=0 |
| 二.2 顺序列表注明「创建 Run 前完整性校验」 | `crud-05:365`（3.5.7）、`crud-05:421`（3.5.8） | `创建 Run 前定义完整性校验`×2；落点指 `crud-03 4.4「执行前校验」`（引用目标存在），3.5.7 注明「仅 target=workflow 时适用」并重编号 3.5.7→4 条、3.5.8→6 条 |
| 二.5 / G4 can-retry 补齐 5 条 | `crud-05:720`（4.8 前提行）、`crud-05:724-728`（列表） | `can-retry 五条件`；5 条逐条 = ①target=Workflow ②目标仍存在 ③已结束且有失败/超时 step ④版本一致 ⑤Workflow.needsUpdate=false 且 Job.needsUpdate=false（Job 已删→false），与 `3.5.9` / `proposal-01 §12.8.2` 逐条对齐；旧 `**can-retry 检查**：`=0、旧 4 条摘要串=0 |
| 二.9 / N-7 `schema.sql:221` 旧口径 | `schema.sql` 删除原 221 行 | 删除「重试次数（派生展示量, 非判定基准）= 记录数 - 1」；去空格正则 `记录数\s*[-−]\s*1` = **0**；`:219`「本轮尝试计数 = … = 每轮尝试次数（首次执行计入）」保留 |
| 三 / `_val4_01_docs` L6 导出库错误 | `crud-05:540`（3.5.10 说明） | 补「前端内置 xlsx 生成库未就绪属前端本地错误（不入后端错误码表）」——与决策「不新增错误码」一致 |
| L-2 完成钩子双名映射（涉 `schema.sql`） | `schema.sql:238-239` | 既有映射句（`JobComplete`↔`JOB_COMPLETE`；`StepComplete`↔`STEP_COMPLETE`）在位；映射句正式落点按决策二.14 在 crud-03 4.4，本文件无需改 |

## 机械自检（证据，脚本 `C:\Users\Public\_fix4_D_check.py`，仓库外）

- 编码 / 行尾：crud-05 与 schema.sql 均 `CRLF=0 / BOM=False / 末行有换行`，UTF-8。
- 旧措辞 0：`记录数 - 1`=0、`记录数-1`=0、`重试次数（派生展示量`=0、`can-retry: 版本一致 + 无需更新 + 存在失败/超时 step`=0、`终态时的边状态`=0、`作为初值参与就绪 / 汇聚判定**，但仍`=0、`**can-retry 检查**：`=0。
- 新措辞到位：见上表（`死枝闭包` / `全边先置` / `创建 Run 前定义完整性校验` / `can-retry 五条件` / `① target=Workflow` / `递归传播至不动点` 均 ≥1）。
- 表列一致：crud-05 全部 Markdown 表按 `|`（不计转义）分组，无同行混列（3/4/5/6 列各表自洽）。
- 引用存在：`crud-03` 的 `### 3.3` / `#### 4.3.4` / `### 4.4`（`执行前校验` 4 处）、`proposal-01` 的 `#### 12.8.2` 标题均在。
- `**` 奇偶：crud-05 奇数行 = 0。
- `sqlite3 3.50.6` 实跑：`.read schema.sql` 退出 0；**10 表 / user_version=1 / journal_mode=wal**；23 条显式 `CREATE INDEX`（含 `step_records` 四元组唯一索引）；`step_records` 列 `record_id,run_id,step_id,activation_seq,retry_seq` 齐备。

## 未落地与原因

- `_val4_02_contract` N1（crud-04:599）、N2（crud-03:276/300）、N3（crud-03:300）、N4（crud-02:282）、N5（tests 新用例）、`_val4_05_global` L-4（crud-03:1093）——均**不在本组文件范围**（属 crud-02/03/04、tests 归属），未改。
- L-2 的映射句正式落点按决策二.14 在 crud-03 4.4；`schema.sql` 既有映射句保持不动。
- 受审目录内未落任何临时产物（脚本与临时 `_fix4_D.db` / `_fix4_schema.sql` 均在 `C:\Users\Public`，已清理）。
