# 第 5 轮修复报告 · G_tasks（`tasks.md`）

> 口径源：`_fix_v5_decisions.md`（唯一权威）；涉本文件项：`_val5_03_global.md`（N-2 / N-6 / L-7 / S-2 的 tasks 侧）、`_val5_01_docs.md`（L7 章号体例、G3）。
> 范围：**只改 `tasks.md`**。UTF-8（无 BOM）+ LF。

## 已修项（含证据）

### 1. `:230` 枚举补全规则 13 + 计数自证（N-2）
- 原文只列 **14** 条却称「A + B 共 15 条」（漏 `crud-03` 规则 13）。
- 改为分组自证：
  - **A 组（字段与结构类，4 条）**：`opId`+`opVersion` 绑定（9）、`clientId` 非空（10）、Client 类型匹配（11）、Start 无 `on_failure` 出边（16）→ 4 条；
  - **B 组（拓扑/连通/绑定类，11 条）**：Start/End 唯一与各自入出边（1–5）、start→end 可达（6）、op 节点从 Start 可达且能到达 End（7）、**`bindings` 引用的前置节点出参必须存在（13）[补]**、绑定必须指向前置节点（14）、required 有来源（15）、出参来源必须有效（18）→ 11 条；
  - 验收列改为「**A + B 分组（共 15 条校验项 = A 组 4 条 + B 组 11 条）**」。
- 算式：A 4 + B 11 = **15**（自证）。

### 2. 章号体例统一（`_val5_01_docs` L7、`_val5_03_global` N-3）
- `:44` / `:138`：`proposal-02 §九（CLI 命令行入口设计）` → `proposal-02 §九（CLI（命令行入口）设计）`（逐字对齐实标题 `## 九、CLI（命令行入口）设计`）。
- `:122` / `:123`：`proposal-02 §六（DB 操作层 Repository）` → `proposal-02 §六（DB 操作层 (Repository)）`（逐字对齐 `## 六、DB 操作层 (Repository)`）。
- `:157`：`proposal-02 §六：DB 操作层 Repository`（无括注，同文件异例）→ `proposal-02 §六（DB 操作层 (Repository)）`。

### 3. `:160` 去掉未登记标签 `（P6）`（N-6）
- `crud-06 3.4（P6）` → `crud-06 3.4（config_version 迁移失败回退）`。

### 4. `:94` T2.1 补「原型校验实现不搬运」声明 + 机械判据（`_val5_03_global` L-7 / S-2 选项 B 的 tasks 侧）
- 新增：「**原型校验实现不搬运**：`原型图/*` 的校验内核（`mock-data.js` 的 `validateWorkflowOf(` / `WF_CHECK_RULES`）**不作为校验基线**，`ui/` 的校验一律以 `crud-03 §3.3` 为准」。
- 机械判据追加：`ui/` 内不存在 `validateWorkflowOf(` 或等价校验实现（`validateWorkflowOf(` 经 grep 确认存在于 `原型图/mock-data.js`）。

## 机械自检（证据）

命令（PowerShell，UTF-8 读入；证据为脚本输出）：

| 检查 | 结果 |
|-|-|
| 旧措辞残留（`tasks.md`） | `1–8`=**0**、`1-8`=**0**、`16 条`=**0**、`run_edge_state`=**0**、`runEdgeState`=**0**、`（P6）`=**0** |
| 编码/行尾 | `CRLF=0 bareLF=321 BOM=False`（UTF-8 无 BOM + LF） |
| 表格完整 | `tables=12 inconsistent=0`（按 `\|` 不计，逐表列数一致） |
| 章号引用目标存在 | `proposal-0X §中文数字（章名）` **22/22 命中**（含修正后的 `§九（CLI（命令行入口）设计）`×2、`§六（DB 操作层 (Repository)）`×3）；逐条 `title.StartsWith(括注)=true` |
| 计数自证 | `:230` A(4)+B(11)=**15**，与验收列「= A 组 4 条 + B 组 11 条」一致 |

样例行（改后）：`| T8.6 | ...全部 17 条...A 组（字段与结构类，4 条）...B 组（拓扑/连通/绑定类，11 条）...`（`tasks.md:230`）。

## 未落地与原因

- **无未落地项**（本文件范围内）。
- **旁证/风险提示（非本文件、未处理）**：自检期间观察到工作区中 4 个兄弟文档在被并发改写/删除（`git status` 报 ` D`）：`proposal-01-界面设计.md`、`proposal-02-后端crud-03workflow管理.md`、`proposal-02-后端crud-06配置管理.md`、`proposal-02-后端设计.md`。本轮章号引用校验（22/22）在文件可读时通过；若此 4 文件最终缺失，将连带影响 `tasks.md` 的跨文件引用目标 —— 请协调者核实并恢复。
