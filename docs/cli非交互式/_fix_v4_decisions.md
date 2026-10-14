# 修复口径（第 3 轮校验后，**唯一权威**）

> 依据：`_val4_01_docs.md` / `_val4_02_contract.md` / `_val4_03_tests.md` / `_val4_04_proto.md` / `_val4_05_global.md`。本轮按下列结论执行；与报告冲突以本文件为准。修复者**不要写入本文件**，各自写 `_fix_v4_<组号>.md`。
> ⚠️ 上一轮 `validation.md` 声称「全部已修」**失实**（实测 8 项未落地，见下 §一.4）。本轮所有声明**必须逐项 grep/实跑取证**，不得只凭印象宣布落地。

## 一、严重（5 项，去重后 4 项）

1. **`Workflow.outputs[].from` 校验规则四方分叉**（docs S1 / contract S2 / global S-1）→ **采纳 A**：
   - `crud-03 §3.3` **新增规则 18「出参来源必须有效」**（内容逐字对齐 `proposal-01:1352`），归 **B 组（拓扑/绑定类：保存时不执行，`[校验]` 与创建 Run 前执行）**；
   - 同步计数 **16 → 17 条**：`crud-03:108 / :115 / :148 / :329 / :393`，以及 `tasks.md:230`（现写 16 条）；
   - `proposal-01 §20.1` 的出处指向保留（crud-03 §3.3 现已真有此条）；
   - **`tests` 补 1 条负向用例**（`from.workflowNodeId` 指向不存在节点 / `outputName` 不在该 OP 出参中 → 400 `VALIDATION_ERROR`），并同步统计表；
   - **原型**：`mock-data.js` 校验内核 + `workflow.html` 校验面板同步该条（内核规则编号须与 `crud-03` 编号体系一致）。
2. **D6 续跑「死枝闭包」缺口**（contract S1）→ **采纳 B（更稳妥）**：把 4.3.4② 的初值总则改写为**五步**：
   `① 全边置 pending → ② 前缀节点集出边按源 Run 终态复制 → ③ 种子节点入边置 activated → ④ 对源 Run 中「入边已全部决定且无 activated」且既不在前缀集合、也不从种子正向可达的节点（死枝）**递归**把其出边置 dropped 至不动点 → ⑤ dispatch 种子与已就绪节点`；
   并保留现 ⑥ 条文字（说明不这样做会卡死），**`crud-03 4.3.4②` 与 `crud-05 3.5.8④` 同口径**；`tests` 补「菱形 + 旁支 + 重试」用例（N5）。
3. **R2「全部已修」失实：8 项未落地**（global S-3）→ 逐项落地（见 §一.4 清单 a–h），并在各自报告逐条取证。
4. **未落地清单（照此改）**：
   - a. 原型**列表列**触发文案分隔符 → `mock-data.js:54-55` 改 `持久 Job · 手动` / `持久 Job · 定时`（` · `），`index.html:340/373` 占位同步；
   - b. 删 `mock-data.js` 的 `slugName`（改恒等或直接用 `name`），`client.html` 导出默认名改 `'client-' + name + '.yaml'`；
   - c. `原型图/settings.html:186` 的 `0=不限制（按 max×3）` → 「`0` = 不施加绝对上限，仍受 `max×3` 约束」（D14 口径）；
   - d. `mock-data.js` 的「当前**配置**目录」→「当前**运行**目录」（`runDir`）；
   - e. `mock-data.js` 的 `EXPORT_UNAVAILABLE` → 改用 **`INTERNAL_ERROR`**（本地导出库缺失属内部错误；**不新增错误码**）；
   - f. `crud-03` 事件保留措辞 → 「`engine_event_retention_days` 天后软删 → 再 **1 天**后物理删除」（D18）；
   - g. `crud-03:1093` 时序图字段名 → 与 `:843` 一致（`step_completed{step_id, activation_seq, retry_seq, result}`）；
   - h. `crud-04 4.5.1–4.5.6` 提为 **`#### 4.5.x`** 标题级（否则 3 处章节级引用无法解析）。
5. **新增夹具契约错误**（global S-2）：`tests/fixtures/tc_r1/seed_terminal_states.sql` 的 `edges[].condition` 用非法值 `success` → 全改 **`on_success`**；并补该夹具引用的 **OP / Client 行**（tests M-9），文件头加注取值域。

## 二、拍板结论（R3 需拍板项）

1. **导入 OP 缺 `timeoutSeconds`**（docs G5）→ **按 `crud-02` 判 400 `VALIDATION_ERROR`**（接口层必填）；原型 mock 同步为 400，注释改引正确出处。
2. **「创建 Run 前」完整性校验落点**（contract P2/G3）→ **采纳 B**：写进 `crud-03 4.4「执行前校验」`，把 `crud-03` 三处「见 4.2」改「见 4.4」；`crud-05 3.5.7/3.5.8` 的顺序列表注明该项。
3. **`crud-04 3.4.6` 的 note 具名**（docs P3）→ 升为正式小节：`#### 3.4.6.1 适用范围（全入口生效）`、`#### 3.4.6.2 job_queue_waiting_max 的语义`；全库引用改具名。
4. **`proposal-01 §20.1` 补登**（docs L4 / contract P5）→ 补 `D9/D10/D11/D12/D17`，并把 `D2/D6` 标注「分义项（§20.1 登记 vs 本决策编号）」。
5. **`crud-05 4.8` 的 can-retry 条件**（contract P6/G4）→ **采纳 A**：补齐 **5 条**，与 `3.5.9`/`proposal-01 §12.8.2` 逐条对齐。
6. **`crud-03:108` 并列声明与计数**（contract G1/G2 / global N-2）→ 改为「与 `proposal-01 §10.14` 逐条并列，差异见各条注」**且计数与分区自洽**（现「A 4 + B 10 = 14」与「共 16 条」矛盾；改为 A `9/10/11/16` + B `1–7/13–15/18` + C `12/17` = **17 条**（规则 8 已删、编号留空不补），逐条列出后计数自证）。
7. **原型校验内核定位**（global P-2）→ 明确「**原型校验内核/校验面板仅作演示，规格以 `proposal-01 §10.14` + `crud-03 §3.3` 为准**」，写进 `原型图/README` 或 `mock-data.js` 头注；**同时**补齐内核缺的 `crud-03` 规则 9/16（N-3）与面板条数自洽（N-5：数组 13 项 = p01 §10.14 口径）。
8. **原型配置校验**（global N-4）→ 补 `job_queue_running_max` **下限 1**。
9. **`schema.sql:221` 旧口径残留**（global N-7）→ 「重试次数（派生展示量）= 记录数 − 1」改为「本轮尝试次数 = 记录数（首次执行计入）」或直接删除该派生字段说明。
10. **`tests` 的 `settings.<键>` 写法**（tests D-1 / global P-4 / L-1）→ 统一为配置项全路径：`配置项 history.job_queue_running_max（ai-automation.json）` 形式；`tests` 3 处 + `crud-06` 命名口径一致。
11. **终态「未执行/跳过」适用边界**（tests D-2）→ `proposal-01 §12.6` 补一句「`未执行 / 跳过` 仅用于**终态** Run；非终态显示「等待中」」。
12. **ZIP 容器元数据**（tests D-3）→ **维持注解**（不统一容器），并在 `crud-03:432`/`crud-04:415` 保留「逐字节比对」措辞的现有注。
13. **夹具注释旧 `#n`**（tests D-4 / M-3）→ 改「数据集行 n」，自检 grep 覆盖 `tests/fixtures/**`。
14. **完成钩子命名**（global P-3/L-2）→ 保留双名 + 在 `crud-03 4.4` 补一句映射（`STEP_COMPLETE` 实例 ↔ `StepComplete` 类型；`JOB_COMPLETE` ↔ `JobComplete`）。
15. **OP 详情三态口径**（proto A1/A2/P1）→ **落地**：非终态一律「等待中」、终态未执行才「⊘ 未执行」；图标须在文档图标集内（`p01` 图标表）。
16. **OP 详情刷新/轮询**（proto A3/P2）→ **采纳「与 wf 详情对称」**：`openOpDetail` 改为（或其刷新路径）重取完整详情，`§12.10`/`§17.5` 表述与实现一致。
17. **导入体积上限取值来源**（proto m6/P3）→ 统一走 `GET /api/settings`（与 `index.html` 口径一致），不得直读 mock 全局。
18. **创建侧校验顺序**（proto m7/P4）→ 在 `crud-04 3.4.3/3.4.4` 补**显式顺序列表**（字段级缺失优先 → 语义/一致性），与 `3.4.6`/导入侧同体例；实现与之一致。

## 三、其余（按各自 `_val4_*` 报告逐条修）

`_val4_01_docs`（一般 5 / 轻微 7）、`_val4_02_contract`（一般 6 / 轻微 5，含 N1–N5）、`_val4_03_tests`（一般 2 / 轻微 9，含 M-1/M-2/M-4~M-9）、`_val4_04_proto`（一般 3 / 轻微 7，含 m1 runId 未转义、m2 BOM、m3 不可达分支）、`_val4_05_global`（一般 7 / 轻微 8）逐条修，并在报告中列出「项 → 落地位点 → 证据」。

## 通用要求

1. 只改自己负责的文件；UTF-8；保持各文件原行尾（js=LF，html/css=CRLF，md/sql/yaml=该文件既有）。
2. 交叉引用必须真实存在；新增小节用下一可用编号，并同步全部引用方与计数。
3. 改完必须**机械自检并贴证据**：旧措辞 0 残留、新措辞到位、引用目标存在、计数自洽、表格列数一致（`\|` 不计）；原型 `node --check` + jsdom 6 页；`tests` ZIP 逐成员 SHA256/成员序/名称锚 + 统计表逐格；`schema.sql` sqlite3 实跑。
4. 报告：`## 已修项（含证据）` / `## 未落地与原因`。完成后回复 ≤200 字。
