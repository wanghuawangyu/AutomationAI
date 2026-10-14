# 修复报告 —— D_run（crud-05 运行历史 + schema.sql）

> 依据：`_fix_v5_decisions.md`（唯一口径）；`_val5_01_docs.md` / `_val5_02_tests.md` / `_val5_03_global.md` 涉本文件项。
> 范围：**只改** `proposal-02-后端crud-05运行历史.md`、`schema.sql`。UTF-8 + LF。

## 已修项（含证据）

### 1. 二.1 —— `crud-05 3.5.8④` 改为「不可达闭包」判据（与 `crud-03 4.3.4②` 同口径）+ 最小反例注

- ④ 原判据「入边已全部决定且无 `activated`」（死枝闭包）→ 改为「**不可达闭包**」：新 Run 中「**既不属于前缀节点集、也不从种子节点（或任一已决边）正向可达**」的节点，其出边一律置 `dropped`，递归传播至不动点后再 dispatch。
- ⑥ 风险说明把 `activated` 型旁支的**最小反例写成注**：`Start→(always)A`、`Start→(always)X`、`A→(on_success)B`、`B→(on_success)End`、`X→(always)Y`、`Y→(always)End`；源 Run 中 A 成功、B 失败、`X→Y` 已 `activated` 但 Y 未 dispatch；重试（种子=B）时旧判据把 X/Y 排除 → `X→Y` 永久 `pending` → Run 永久 `running`；新判据将其出边置 `dropped` → End 就绪。
- 证据：
  - `grep '不可达闭包'` = **4**（④ 标题 1 + ⑥ 说明 3）
  - `grep '死枝闭包'` = **0**

### 2. 四.6 —— 全文与 `schema.sql` 不得引用 `run_edge_state`

- `proposal-02-后端crud-05运行历史.md`：`:402` 删除「`run_edge_state` 仍是可选快照，不强制写入」，改为「**不落库；边状态为内存态，重启 / 恢复后按「节点状态 + Run 终态」口径重建**」。
- `schema.sql`：删除第 9 节 `run_edge_state` 表（含 `PRIMARY KEY(run_id, edge_key)` 自动索引与其 2 个显式索引）；第 10 节 `run_node_state` 提为第 9 节；并删除 `run_node_state` 注释中「，与 run_edge_state 同生命周期」。
- 证据（两文件 `grep 'run_edge_state'`）：
  - crud-05 = **0**；schema.sql = **0**
  - 全库残留（**非本组文件**，属 C_wf / B_be 范围）：`crud-03=8`、`crud-06=1`、`proposal-02-后端设计.md=1`；`tests/集成测试用例.md` 已由 E_tests 清为 **0**。

### 3. `schema.sql` 改后 sqlite3 实跑（UTF-8 路径规避）

```
$env:TEMP\fix5\schema.sql  ← Copy-Item 自工作区（中文路径 .read 静默失败，见 _val5_02 L-8）
sqlite3 f5.db ".read schema.sql"        -> rc=0
.tables                                 -> clients engine_events job_runs jobs ops run_node_state step_records workflows workflow_nodes
                                           （9 表；无 run_edge_state）
PRAGMA integrity_check                  -> ok
count(table 非 sqlite_%)                -> 9（改前 10）
count(index)                            -> 34（改前 37：-2 显式 + -1 自动索引）
SELECT name WHERE name LIKE 'run_%'     -> run_node_state
```
- 与改前对照（`git show HEAD:...schema.sql` 同法实跑）：**10 表 / 37 索引**，含 `run_edge_state`。差值 = 1 表 + 3 索引，与删除内容一致。

### 4. `_val5_01_docs.md` 一般 4 / `_val5_03_global.md` N-3（涉本文件项）

| 项 | 位点 | 处置 | 证据 |
|-|-|-|-|
| G2 锚名 | crud-05 `:365`、`:421` | `crud-03 4.4「执行前校验」` → `「创建 Run 前校验」`（与 crud-04 逐字一致） | `grep '执行前校验'` = **0** |
| L1/N-3 小节号 | crud-05 `:128/:356/:364/:420/:449/:657`（6 处） | `crud-04 3.4.6「…」` → `crud-04 3.4.6.2「…」`；`:128` 的 `『』` 一并改为具名 `「」` | `3.4.6「`=**0**、`3.4.6『`=**0**、`3.4.6.2「`=**6** |
| L6 括注缺项 | crud-05 `:423` | 3.5.8 校验顺序第 4 条括注补「Run 未结束（waiting / running / terminating）」 | 见 diff |
| G1 失实声明 | crud-05 `:724` | 删除 `proposal-01 §12.8.2` 的「逐条对齐」失实声明（p01 五条件不含「目标仍存在」），保留「与 3.5.9 逐条对齐」 | `grep '§12.8.2'` 该行 = 0 |

## 未落地与原因

1. **`run_edge_state` 在其它文件仍被引用**（`crud-03`=8、`crud-06`=1、`proposal-02-后端设计.md §十三`=1）。按「只改本组文件」约束未动；需 C_wf / B_be 各组同步（`crud-03 4.3.3` 的 checkpoint 描述、`proposal-02 §十三` 表总览、`crud-06 四` 生命周期）。
2. **G1 的 p01 侧**（`§12.8.2` 补「目标仍存在」）属 A_ui 文件，本组未动，仅在 crud-05 侧移除失实声明。
3. `schema.sql` 第 10 节→第 9 节的编号变更：若其它文件写「见 `schema.sql` 第 9/10 节」，需由对应组同步（本组不改其文件）。

## 自检命令汇总（可复现）

```powershell
# 旧措辞 0 残留
Select-String -SimpleMatch 'run_edge_state'  proposal-02-后端crud-05运行历史.md  # 0
Select-String -SimpleMatch 'run_edge_state'  schema.sql                          # 0
Select-String -SimpleMatch '死枝闭包'        proposal-02-后端crud-05运行历史.md  # 0
Select-String -SimpleMatch '3.4.6「'         proposal-02-后端crud-05运行历史.md  # 0
Select-String -SimpleMatch '执行前校验'      proposal-02-后端crud-05运行历史.md  # 0
# 行尾 / BOM
schema.sql      : CR=0 LF=331 BOM=False
crud-05.md      : CR=0 LF=729 BOM=False
```
