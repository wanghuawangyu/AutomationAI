# 修复报告（第 5 轮 · 原型组 F）—— `原型图/**`

- 口径来源：`_fix_v5_decisions.md`（唯一权威，未改动）+ 只读参照 `_val5_04_proto.md`（A1、m1–m3、P1/P2）、`_val5_03_global.md`（S-2、N-4、L-2/L-3）。
- 范围：**仅** `docs/cli非交互式/原型图/**`（10 文件）；未触碰其它目录/文件（含 4 个 `.out` 残件属目录卫生，不在本组可改范围）。
- 环境：node v24.18.0；jsdom（复用 `%TEMP%\jcval4\node_modules`，探针自建于 `%TEMP%\jcval5F\`）；pre 基线 = `%TEMP%\jcval4\fix4pre\`（R2 快照）。

## 已修项（含证据）

### 1. 二.3 / global S-2（严重）：删除内核里「Workflow 级 required 入参须被消费」

- 位点：`原型图/mock-data.js` — 删除 `:1707 var wfInputUsed = {}`、`:1719 if (b.kind === 'workflow_input') wfInputUsed[...]`、原 `:1730-1732` 的 `(wf.inputs||[]).forEach(... 'Workflow 的 required 入参 … 没有来源')`；并在规则 15 注补「（S-2）该判定已删除」说明（现 `:1693-1695`）。
- 证据（`p_kernel.js`，pre/post 负向对照）：
```
S-2 pre  = {"valid":false,"errors":["Workflow 的 required 入参 never_used 没有来源"]}
S-2 post = {"valid":true,"errors":[]}
OK  S-2 post 不再报该 error
OK  S-2 负向对照：pre.valid=false → post.valid=true
OK  负向对照：节点级 required 无来源仍报错（内核未整体失效） ["节点 node_check 的 required 入参 test_cmd 没有来源"]
```
- 残留扫描：全 10 文件 `Workflow 的 required 入参` / `wfInputUsed` = **0**；4 个内置 Workflow 仍 `valid=true`（不误伤）。

### 2. 三 proto A1（一般）：`index.html` OP 详情执行历史徽标补 `cancelled` / `terminating`

- 位点：`原型图/index.html:1144-1145`（`renderOpDetail` 徽标链），与 Run 级映射（`:946`）、同 Run 画布（`:1496`）及 `p01 §12.6` 同口径：终态 `cancelled → ⊘ 已取消`（`badge-off`）；`terminating → ⏹ 终止中`（`badge-terminating`）；`running` 仍 `● 运行中`。
- 证据（`p_ui.js`，jsdom 真渲染）：
```
post cancelled  = <span class="badge badge-off">⊘ 已取消</span>
post terminating= <span class="badge badge-terminating">⏹ 终止中</span>
post running    = <span class="badge badge-running">● 运行中</span>
pre  cancelled  = <span class="badge badge-running">● 运行中</span>     ← 负向对照 pre≠post
```

### 3. 四.4 / proto P2·m2：mock **创建侧语义校验**缺项（与 `crud-04 3.4.3 ②` 一致）

- 位点：`原型图/mock-data.js`
  - 新增 `__cronToken` / `__cronValid`（`:1573-1598`，标准 5 字段，支持 `* \d a-b /s ,` 与范围校验）；
  - `POST /api/jobs`（`:1914-1938`）按 ② 顺序补：`schedule` 且 cron 非法 → 400 `CRON_INVALID`；target=op 时 OP / Client 不存在 → 404 `OP_NOT_FOUND` / `CLIENT_NOT_FOUND`；target=workflow 时 → 404 `WORKFLOW_NOT_FOUND`；`inputs` 键名不匹配 target 参数定义 → 400 `VALIDATION_ERROR`。全部码在 `proposal-02 §10.1` 总表内（未新增编外码）。
- 证据（`p_kernel.js`，pre/post 负向对照）：
```
OK m2 合法创建仍成功（不误伤）
OK m2 cron 非法 → CRON_INVALID（post）
   m2 负向对照：pre 接受非法 cron（创建成功 jobId=…）
OK m2 OP 不存在 → OP_NOT_FOUND（post）
   m2 负向对照：pre 接受不存在的 OP（创建成功 jobId=…）
OK m2 Workflow 不存在 → WORKFLOW_NOT_FOUND
OK m2 inputs 键名不匹配 → VALIDATION_ERROR
```

### 4. 四.5 / proto m3·L-2：面板项顺序与 `§10.14` 行序对齐

- 位点：`原型图/workflow.html:1791-1792` — 交换为 `binding_pred`（第 11 行）→ `required`（第 12 行），对应 `p01 §10.14:1350/1351`；面板仍 **13 项**且末项 `output_from`。
- 证据（`p_ui.js`）：
```
m3 面板 13 项
m3 面板序 = §10.14 行序 ["start","end","start_in","end_out","start_out","end_in","reach","toward","client","client_type","binding_pred","required","output_from"]
m3 负向对照：pre 顺序为 required(11)/binding_pred(12)（pre≠post）
```

### 5. global 涉原型项（含计数注释）

- **N-4**：`mock-data.js:1541` 原「G14：删除原第 **11** 条…合并为一条」→ 改为「原第 **8** 条「汇聚」已删除（与「required 入参必须有来源」无关）：`crud-03 §3.3` 明确节点汇聚由 DAG 边决定…不作为校验项」（消除未登记编号 `G14` + 与契约相反的编号/理由）。
- **L-3**：`mock-data.js:1543`「errors 文案对齐 proposal-01 §10.14（8 条失败提示 + 上述补充项）」→ 「失败提示表（15 行）与 crud-03 §3.3 各条注」。
- 计数注释核对：内核注释仍为「A 组 9/10/11/16；B 组 1–7/13–15/18；C 组 12/17」（`:1656`）；`workflow.html` 面板头注「界面可见 13 项 + 完整 17 条」（`:1775`）。全 10 文件 `1–8` / `共 16 条` = **0**。

## 机械自检（证据）

```
node --check mock-data.js / workflow-canvas.js / xlsx-lite.js → NODE_CHECK_3_OK（3/3）
jsdom 6 页冒烟（index/client/op/workflow/job/settings）→ 全部 0 未捕获异常
行尾/BOM：index/client/op/workflow/job/settings.html = CRLF；mock-data/workflow-canvas/xlsx-lite.js = LF；
          workflow-canvas.css = CRLF；10 文件 BOM=false
残留扫描（All files）：1–8 / 共 16 条 / run_edge_state / slugName / EXPORT_UNAVAILABLE / wfInputUsed /
          Workflow 的 required 入参 → 全部 0
负向对照（pre≠post）5 项：内核删条(S-2)、A1 徽标、m2 cron、m2 OP 不存在、m3 面板序
探针统计：p_kernel PASS=10 BAD=0；p_ui PASS=15 BAD=0；p_scan 全绿
```

## 未落地与原因

1. **proto m1 / P1（节点级「等待中」图标 `◌` 不在 `p01 §12.5` 图标集）**：`_fix_v5_decisions.md §四.3` 已拍板「补登文档（`p01 §12.5/§12.6` 加 `◌ 等待中`），**不要求原型改回**」→ 属文档组范围，原型侧 `index.html:943/1143/1173` 保持 `◌ 等待中` 不动（内部自洽）。
2. **global L-4（内核 8 条文案未在 `§10.14` 提示表逐行对应）**：修法主路径是**在 `§10.14` 提示表补规则 9/10/14/15/16 的文案行**（文档组）；本组若把规则 16 文案 `wfErrRuleKey` 归入某界面项会与「面板 13 项 = `§10.14` 13 行」口径冲突，故**不单方面改动**，维持「未命中者落附加条目」。
3. **global L-5（`§20.1` 的 `M20`）、N-6（`tasks.md` 的 `P6`）、L-6（4 个 `.out` 残件）、N-1（`D13/D18` 登记）**：均非 `原型图/**` 文件，属 docs/tasks/目录卫生组。
