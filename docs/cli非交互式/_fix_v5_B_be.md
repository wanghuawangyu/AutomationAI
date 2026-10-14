# 修复报告（第 5 轮 · B 组 / 后端设计 + crud-01/02/06）

> 口径：`_fix_v5_decisions.md`（唯一权威）。范围：`proposal-02-后端设计.md`、`proposal-02-后端crud-01client管理.md`、`proposal-02-后端crud-02op管理.md`、`proposal-02-后端crud-06配置管理.md`。
> 行尾：四文件均 **LF**（改后 CRLF=0）；编码 UTF-8。

## 已修项（含证据）

### 1. 四.6 清除 `run_edge_state` 引用 → 改「节点状态 + Run 终态」口径
- `proposal-02-后端设计.md:434`（§十三 表结构引用总览）：删整行 `| run_edge_state | Engine (可选 checkpoint: 边状态快照) |`。
- `proposal-02-后端crud-06配置管理.md:369`：
  - 改前：`…（可选 checkpoint 表 \`run_edge_state\` / \`run_node_state\` 同生命周期），不影响 \`step_records\` 明细`
  - 改后：`…（可选 checkpoint 表 \`run_node_state\` 同生命周期；边状态为内存态、不落库，重启 / 恢复后按「节点状态 + Run 终态」口径重建），不影响 \`step_records\` 明细`
  - 与 `crud-03:922`（「若启用可选 checkpoint 表 `run_node_state`，一并删除」）同口径。
- **证据**：
  - 四文件逐文件计数：`proposal-02-后端设计.md run_edge_state=0`、`crud-01client=0`、`crud-02op=0`、`crud-06=0`。
  - 全目录扫描（非 `_` 前缀 md + `validation.md` 除外）：`run_edge_state` 残留 **0**。（`schema.sql` 由 D 组删表，正文无残留。）

### 2. 一.3 计数口径（本组）
- 本组四文件 grep `1–8` / `1-8` / `共 16 条` / `16 条` / `17 条` / `15 条` / `编号 8` 均 = **0**（规则编号计数承载于 `crud-03 §3.3` / `tasks.md` / `proposal-01 §10.14`，不在本组）。本组无需改。

### 3. 三.docs + N-3/L1 具名引用同步（`crud-04 3.4.6` → `3.4.6.2`，引号统一）
- 5 处（体例示例 + 引用侧）改为 `crud-04 3.4.6.2「\`job_queue_waiting_max\` 的语义」`，引号 `『』`→`「」`：
  - `proposal-02-后端设计.md:9`（引用体例示例；原 `『…』`）
  - `proposal-02-后端crud-01client管理.md:75`（原 `『…』`）
  - `proposal-02-后端crud-02op管理.md:72`（原 `『…』`）、`:284`（原 `「…」` 缺 `.2`）
  - `proposal-02-后端crud-06配置管理.md:133`（原 `『…』`）
- **目标存在**：`crud-04job管理.md:335` = `#### 3.4.6.2 \`job_queue_waiting_max\` 的语义`；`3.4.6`、`3.4.6.1` 亦均存在（`:331/:335`）。
- **证据**：四文件 `crud-04 3.4.6「` = 0、`crud-04 3.4.6『` = 0、`『` = 0（逐文件）。

### 4. 章号体例（三.docs）
- 本组四文件无「裸阿拉伯章号」（`§2`/`§7`/`§11`）与「`crud-0X §`」。唯一命中为 `proposal-02-后端设计.md:7` **体例条文自身**举例 `不写 \`§2\` / \`§7\` / \`§11\``（属规则正文，非引用，保留）。

### 5. 错误码 ⊆ `proposal-02 §10.1`
- `§10.1` 主表实测 **26 个 code**。本组内联错误行去重 code：`crud-01`(5)、`crud-02`(6)、`crud-06`(2)，逐个比对主表，**EXTRA=[]**（0 编外）。
  - 证据（脚本输出）：`crud-01client rows[5]=[CLIENT_NAME_EXISTS,CLIENT_NOT_FOUND,CLIENT_REFERENCED,INTERNAL_ERROR,VALIDATION_ERROR] EXTRA=[]`；`crud-02op rows[6]=[CLIENT_TYPE_MISMATCH,CONCURRENCY_CONFLICT,OP_NAME_EXISTS,OP_NOT_FOUND,OP_REFERENCED,VALIDATION_ERROR] EXTRA=[]`；`crud-06 rows[2]=[VALIDATION_ERROR,WRITE_FAILED] EXTRA=[]`。
- `§10.1` 声明「27 行 / 26 个 code」未改动，保持自洽。

### 6. 表格列数一致
- `proposal-02-后端设计.md` §十三：12 行 pipe=3 → **2 列**（表头 + 分隔 + 10 数据行）。
- `proposal-02-后端crud-06配置管理.md` §四：12 行 pipe=4 → **3 列**。
- 证据：node 统计 `proposal-02 sec13 pipe dist: {"3":12}`、`crud-06 lines 363-374 pipes=4 ×12`。

### 7. 行尾 / 编码
- 四文件 CRLF=0、LF：`设计=435`、`crud-01=1100`、`crud-02=411`、`crud-06=397`（设计减 1 行 = 删 run_edge_state 行）。

### 8. 四.4 创建侧校验顺序（仅确认，未改）
- `crud-04 3.4.3`（`:234` 校验顺序）/`3.4.4` 均载明「**字段级缺失 / 非法优先 → 语义 / 一致性**」，与原型已实现一致（D 组范畴）。
- 本组文件**未引用该校验顺序**：`crud-02:282` 仅引 `crud-04 3.4.3` 的固定 `message` 口径，无需同步；`proposal-02 §10.1` 行仅列定义位置。

## 未落地与原因
- **无**。本组所辖项（四.6、三.docs/N-3/L1、章号体例、错误码、表格列数、行尾）全部落地。
- 一.3 计数项在本组无对应落点（相关旧措辞仅存在于 `crud-03`/`tasks.md`/`proposal-01`，属 C/G/A 组）。

## 自检证据汇总
- `run_edge_state`：本组 0 / 全目录非 `_` md 0。
- `『`：本组 0；`crud-04 3.4.6「` / `crud-04 3.4.6『`：本组 0。
- 计数旧措辞（`1–8`/`共 16 条`/`16 条`）：本组 0。
- 错误码：主表 26；本组 EXTRA=[]。
- 表格：§十三 2 列、crud-06 §四 3 列，列数一致。
- 行尾：四文件 LF。
