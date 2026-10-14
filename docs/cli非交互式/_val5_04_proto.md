# 原型图独立校验报告（第 4 轮校验员 · 原型 04）—— `原型图/**`

- 范围：`docs/cli非交互式/原型图/**`（含 `xlsx-lite.js`）；只读参照 `proposal-01-界面设计.md`、`_fix_v4_decisions.md`（另按需只读 `crud-03` / `crud-04` / `crud-06` / `proposal-02-后端设计.md` 做编号与错误码对齐）。
- 角色：**独立校验员（只读）**。审计目录内**未落任何文件**（仅本报告）；探针/快照/输出全部在 `%TEMP%\jcval5\`。
- **不接受修复者自述**：全部结论由本人生成的探针实测得出；修复者的 `p_fix4` 等脚本**一行未用**（仅把 `%TEMP%\jcval4\fix4pre\` 当**数据快照**当"pre"，并用 R2 期已知特征（`slugName`/`EXPORT_UNAVAILABLE`/面板 12 项/BOM=true/`detailPollCount`…）先验证该快照确实是 R2 状态，见 `snapcheck`）。
- 探针（**自建 10 个**，与修复者脚本零交集）：`p1_kernel`(37) / `p2_docs`(56) / `p3_ui`(34) / `p4_regress` / `p4b_escape` / `p4c_newlines` / `p5_inject`(25) / `p6_state`(6) / `p7_list`(4) / `p8_pre_post`(25)；原始输出 `%TEMP%\jcval5\out_*.txt`。
- 环境：node v24.18.0；jsdom 30.1.2（复用已安装依赖包，探针代码自建）。

## 统计

| 档位 | 数量 | 摘要 |
|-|-|-|
| 严重 | **0** | 本轮 5 组必验项**逐项自建探针实测通过**；无打穿可用性/契约的缺陷 |
| 一般 | **1** | A1 OP 详情「执行历史徽标」**缺 `cancelled`（与 `terminating`）分支** → 终态已取消记录渲染「● 运行中」，与同 Run 画布「✕ 已取消」及 `proposal-01 §12.6` 冲突（`run-012` 实数据可复现） |
| 轻微 | **3** | m1 新增的节点级「等待中」图标 `◌` 不在 `p01 §12.5` 限定图标集内 · m2 mock 创建侧 ② 语义校验缺项（cron 非法不报 `CRON_INVALID`、target 引用不存在不报 404），与 `crud-04 3.4.3 ②` 顺序语义无法对齐（pre 已存在、UI 不可达） · m3 面板 13 项**顺序**与 `p01 §10.14` 行序不一致（`required`/`binding_pred` 互换） |
| 需拍板 | **2** | P1 节点级「等待中」图标口径（`◌` / `⏳` / 扩 `p01 §12.6` 图标表） · P2 mock 是否补 ② 语义校验（与 `crud-04 3.4.3` 一致化） |

一句话结论：**本轮 5 组必验项全部真实落地且可用**——规则 18/9/16 在 `[校验]`、创建 Run 前、导入落库前判定链上均生效（构造非法 `outputs[].from` → `VALIDATION_ERROR`），内核注释编号与本轮 `crud-03 §3.3` 的 **A 9/10/11/16 + B 1–7/13–15/18 + C 12/17 = 17 条**体系逐号对齐，面板 13 项且末项 `output_from` 能被接口文案点亮（末行 ✗）；一.4a–e、二.15–18、m1–m3 均实测通过（25 项 pre≠post 证明承重）；回归底线全绿（`node --check` ×3、6 页冒烟 0 异常、无新增未转义插值、js=LF / html·css=CRLF 无 BOM）。本轮**唯一新发现的一般问题**是 OP 详情徽标映射只补了 `waiting`、漏了 `cancelled`（同一 Run 同节点在画布与详情页结论相反）。

---

## 逐项实证结果（含探针输出）

### 项 1 校验内核规则 18 + 规则 9/16 + 编号体系 + 面板 13 项（`p1_kernel` 37 pass / 0 BAD；`p3_ui` F17–F19c）

**① 规则 18「出参来源必须有效」在 `[校验]` 与「创建 Run 前」两条判定链上都生效**（`p1_kernel` B/C/D 组，直接改 mock 数据 + 走真实路由）：

```
OK  A 内置 deploy_workflow valid [valid=true errors=[]]（4 个内置 Workflow 全通过 = 不误伤）
OK  B1 来源节点不存在 → 不通过 [["出参 deploy_url 的来源节点不存在"]]
OK  B2 来源=start 节点 → 不通过 [["出参 deploy_url 的来源节点不存在"]]
OK  B2b 来源=end 节点 → 不通过 [["出参 status 的来源节点不存在"]]
OK  B3 来源出参不存在 → 不通过 [["出参 deploy_url 的来源出参不存在"]]
OK  B4 from 缺失 → 不通过 [["出参 deploy_url 的来源节点不存在"]]
OK  B5 未改动副本仍通过（负向对照） [[]]
OK  C1 [校验] 接口 valid=false [{"valid":false,"errors":["出参 deploy_url 的来源出参不存在"]}]   ← POST /api/workflows/{id}/validate
OK  C2 创建 Run 前拦截 400 VALIDATION_ERROR [拓扑不合法，无法执行：出参 deploy_url 的来源出参不存在]   ← POST /api/workflows/{id}/execute
OK  C3 还原后 valid=true（归零）
OK  D1 规则 9 缺 opVersion → 不通过 [["节点 node_check 未绑定 opVersion"]]
OK  D2 规则 9 缺 opId → 不通过 [["节点 node_check 未绑定 opId", …]]
OK  D3 规则 16 Start on_failure 出边 → 不通过 [["Start 节点不允许 on_failure 出边（Start 无失败语义）"]]
OK  D4 Start always 出边仍通过（负向对照） [[]]
OK  D5 [校验] 接口报规则 16
```

**② 内核注释编号与本轮 `crud-03 §3.3` 体系逐号一致**（`p1_kernel` E 组）：

```
OK  E1 内核注释含规则 18 [1 | 2 / 3 / 4 / 5 | 16 | 7 | 9 | 10 / 11 | 15 | 18]
OK  E4 无「规则 8」残留（编号 8 留空） [规则 8 absent]
OK  E5 内核引用的规则号均在 crud-03 表内 [kernelNums=1,2,6,7,9,10,12,13,14,15,16,18 missing=[]]
OK  E6 crud-03 声明共 17 条        OK  E7 分区 A 9/10/11/16 + B 1–7/13–15/18 + C 12/17
OK  E8 crud-03 表中 A/B/C 行数 = 4/11/2 [4/11/2]
OK  E9 内核注释声明「编号与 crud-03 §3.3 体系一致」
```
> 说明：E5 里内核提到的 `6` 出现在「规则 6 由规则 7 蕴含、故不重复判定」的注释中（该推理成立：规则 4/5 保证 Start 有出边、End 有入边，规则 7 保证沿途 op 节点可回 End ⇒ start→end 可达），非编号错挂。

**③ 面板 13 项自洽**（`p1_kernel` F 组 + `p3_ui` F17–F19c）：

```
OK  F1 面板规则条数 = 13；F2 末项 = output_from
    keys = start,end,start_in,end_out,start_out,end_in,reach,toward,client,client_type,required,binding_pred,output_from
OK  F4 proposal-01 §10.14 数据行数 = 13；F4b 末行 = 「出参来源必须有效」
OK  F5 「11 条」旧计数 0 残留（workflow.html）
OK  F6/F7 头注（workflow.html 面板 + mock-data.js）含「仅作演示」+ 引 crud-03 §3.3
OK  F17 面板条数 = 13   OK F18 内置 Workflow 校验通过
OK  F19 面板渲染 13 行   OK F19c 其余 12 行 ✓
OK  F19b 末行 = 出参来源必须有效 且标 ✗ 附接口文案 [✗出参来源必须有效 —— 出参 deploy_url 的来源出参不存在]
```

### 项 2 一.4a–e（`p2_docs` 56 pass / 0 BAD；`p7_list` 4 pass / 0 BAD）

```
a1 TRIGGER_TEXT.manual = "持久 Job · 手动"    a2 schedule = "持久 Job · 定时"    a3 共 5 值
a6/a7 mock 与 index/job 「持久 Job·」「单次执行·」旧式 0 残留；a9 index.html 两处占位（:340/:373）均为「持久 Job · 手动」
L1–L4 列表渲染实测：持久 Job · 手动 ×5、持久 Job · 定时 ×2、单次执行 · OP ×5、单次执行 · Workflow ×3；
      「·」共 33 处，两侧均带空格，无旧式
b1 9 个文件均无 slugName；b2 client.html = 'client-' + name + '.yaml'；b3 占位 client-<name>.yaml
b4 运行期实测 openExport("weird'name<b>", …) → exportFileName = client-weird'name<b>.yaml（name 原样，无 slug 化）
c1 settings.html「0 = 不施加绝对上限」+ c2「max×3」+ c3「0=不限制」0 残留 + c4「范围 1..10」
c5 PUT job_queue_running_max=0 → 400「（下限 1）」；c6 =1 通过；c7 =11 → 400「（上限 10）」；c8 非法值未落库
d1 mock-data.js「当前运行目录」+ d2 runDir 键；d3「当前配置目录」全局 0 残留；d4 settings.html 走 runDir（-c 运行目录）口径
e1 9 个文件 EXPORT_UNAVAILABLE 0 残留
e2 运行期（未注入 XLSX）POST /api/runs/export → 500 INTERNAL_ERROR「导出组件未加载（请确认已随页面部署 xlsx-lite.js）…」
e4 负向对照：注入最小 XLSX 后导出成功 {"xlsx":"UEsDBAo=","count":12}（证明 e2 分支承重，非硬编码）
e5 INTERNAL_ERROR 在 proposal-02 §10.1 总表内（未新增错误码）
```

### 项 3 二.15 / 二.16 / 二.17 / 二.18 + 导入超时 + 下限 1

**二.15 OP 详情三态（`p3_ui` F1–F6，真跑 jsdom）**

```
OK F1  run-010(running 非终态)+无记录节点 → 提示条 display=none、无文案
OK F2  非终态+无记录：徽标 = <span class="badge badge-waiting">◌ 等待中</span>
OK F3  非终态+waiting 记录(node_deploy)：提示条仍 none；历史徽标 = ◌ 等待中
OK F4  run-012(cancelled 终态)+waiting 记录：徽标 = <span class="badge badge-off">⊘ 未执行</span>
OK F5  run-002(failed 终态)+无记录：提示条 display=inline-flex，文案「⊘ 该节点未执行（本次 Run 无该节点的执行记录）」
OK F5c 提示条不再用 ◌（✓ 图标落在 ✓ ✗ ⏱ ● ✕ ⊘ 内）
```

**二.16 OP 详情 [刷新] / 轮询重取完整详情（与 wf 对称，`p3_ui` F7–F10，spy 包装 `mockFetch` 计数）**

```
OK F7  [刷新] → GET /api/runs/run-010 ×1（pre 为 0）
OK F8  wf 详情 [刷新] 同样重取（对照 n=1）
OK F9  轮询发现问题（改 status）→ 重取完整详情 ×1
OK F10/F10b 开关关：detailAutoOn.op=false、detailPollTimer=null（且轮询走轻量 /status，仅变化时才取详情）
```

**二.17 导入上限走 `GET /api/settings`（`p3_ui` F14–F16）**

```
OK F14 op.html / client.html 均无 `typeof SETTINGS`（不直读 mock 全局）
OK F15 op.html → OP_IMPORT_MAX_BYTES=1048576；client.html → CLIENT_IMPORT_MAX_BYTES=1048576（= 接口值，与 crud-06 一 默认 1 MiB 一致）
OK F16 两页均含 mockFetch('/api/settings')
```

**二.18 创建侧校验顺序（字段级优先）+ 二.1 导入 OP 缺 timeoutSeconds + 二.8 下限 1（`p2_docs`；**用真实类型不符组合**）**

```
g0 组合校验：__clientTypeMismatch(OP health_check/bash, Client Claude Code/prompt) = 非空（确认是真不符，避免探针自欺）
g1 name 空 + 类型不符 → VALIDATION_ERROR「name 不可为空」（字段级优先）
g2 字段齐全 + 类型不符 → CLIENT_TYPE_MISMATCH（固定串逐字）
f1 导入 OP 缺 timeoutSeconds → 400「导入的 YAML 缺少 timeoutSeconds 字段（必填，范围 1..86400 的整数）」
f2 带 timeoutSeconds:45 → 通过
c5 PUT job_queue_running_max=0 → 400（下限 1）；c8 非法值未落库
```
> 证据卫生提示：若用**非**不符组合（如 prompt OP + prompt Client），pre 与 post 都会返回 `VALIDATION_ERROR`，该断点**无区分力**；本轮我用 `1000…0008(bash)` + `a1b2…(prompt)` 真不符组合，并先用 `__clientTypeMismatch()` 断言组合成立。

### 项 4 m1 / m2 / m3

**m1 详情头部 runId 转义（`p5_inject` 25 pass / 0 BAD）** —— 不只看转义字符，而是**把生成的内联处理器放进独立文档真点击**，验证「注不进去 + 值无损往返」：

```
载荷① x')-window.__INJ=1-('   载荷② a" <b> x')-window.__INJ=1-('
载荷③ z" onerror="window.__INJ=3" x="   载荷④ q\')-window.__INJ=4-('
P0 html = … openRetry('x\')-window.__INJ=1-(\'') …
P0/P1/P2/P3 a 属性内无注入串裸值（htmlHasRaw=false）
P0/P1/P2/P3 b 点击后 __INJ/__Q 均未置位（无脚本注入）
P0/P1/P2/P3 c 无 ReferenceError/SyntaxError（内联处理器可解析）
P0/P1/P2/P3 d 点击实参 === 原始 runId（无损往返，含 " < > \ 四类字符）
T1 非终态 Run 头部 [终止]：<button … onclick="openTerminate('t\')-window.__INJ=9-(\'')">（同为 escJsStr）
源码侧：K1 pre 有 `+ run.runId +` 裸拼接 / K2 现 escJsStr(run.runId) ×3 且无裸拼接
```

**m2 BOM（`p4_regress` 第 3 节）**：`job.html` / `op.html` 现 `BOM=false`，与其余 8 个文件一致（pre 两者为 true；I 组 pre≠post 已证）。

**m3 不可达分支（`p3_ui` F22/F23 + 源码）**：`job.html:1065-1066`「UI 已按 OP 类型过滤 clientSelect 选项、不匹配值会被丢弃，故该分支在现实现下**不可达**；保留为**双保险**（后端仍以 400 CLIENT_TYPE_MISMATCH 为准，见 crud-04 3.4.3），勿误判为活路径。」✓

### 项 5 回归底线（`p4_regress` ALL OK）

```
1) 6 页 jsdom 冒烟（jsdomError / window.error / unhandledrejection / console.error 全采集）
   index.html / client.html / op.html / workflow.html / job.html / settings.html → 全部 clean（0 未捕获异常）
2) 转义扫描（全文件）：SUSPECT 项逐条人工复核 = 全部安全
   - index.html `'…' + view + '…'`（view 恒为字面量 'op'/'wf'）
   - `+ retryBtn`/`refreshHtml`（预构造，内部已 escJsStr/escText）
   - `<option>` 列表 map（插值点均为 escText(...)）；`onWfOutputNodeChange` → wfNodeFromOptions→escText
   - `setBindingKind('<pj>')` → pj = escJsStr(pname)
3) 行尾/BOM：index/client/op/workflow/job/settings .html = CRLF；mock-data/workflow-canvas/xlsx-lite .js = LF；
   workflow-canvas.css = CRLF；10 文件 BOM 全 false
4) 外部引用命中 = 0（无 CDN）
另：node --check mock-data.js / workflow-canvas.js / xlsx-lite.js → 3/3 OK
```

**转义增量核对（`p4c_newlines`）**：对 `git diff` 新增行（778 行）机械扫描 → 「HTML 拼接且未转义」疑似 7 条，**逐条定位后全部为已转义/字面量**（同上表）；未跟踪文件 `xlsx-lite.js` 疑似 0。**无新增未转义插值**。

### 附：负向对照（证明本轮修复承重，`p8_pre_post` = ALL OK，25 项全部 pre≠post）

> "pre" = `%TEMP%\jcval4\fix4pre\`（R2 工作区状态快照；已先验证其 R2 特征：`slugName`/`EXPORT_UNAVAILABLE`/面板 12 项/`typeof SETTINGS`/`detailPollCount`/BOM=true/`◌ 该节点未执行` 均在，且 `workflow-canvas.css`、`xlsx-lite.js` 与本轮逐字节相同 → 证明这两个文件本轮确未改动）。

```
A1 PRE 非法 from 放行 {"valid":true} → A2 CUR 拦截   A3/A4 规则 9   A5/A6 规则 16
B1 PRE 有 slugName → B2 CUR 无        C1 PRE「持久 Job / 手动」→ C2 CUR「持久 Job · 手动」
D1 PRE =0 静默接受 → D2 CUR 400        E1 PRE CLIENT_TYPE_MISMATCH → E2 CUR VALIDATION_ERROR
F1 PRE EXPORT_UNAVAILABLE → F2 CUR INTERNAL_ERROR
G1 PRE 缺 timeoutSeconds 接受(默认60) → G2 CUR 400
H1 PRE 面板 12 项 → H2 CUR 13 项        I job/op PRE BOM=true → CUR false
J1 PRE typeof SETTINGS → J2 CUR /api/settings      K1→K2 runId 转义 3 处
L1 PRE 无 refetchOpDetail → L2 CUR 有   M1 PRE ◌ 该节点未执行 → M2 CUR ⊘ + gate 终态
N1 PRE 0=不限制 → N2 CUR 0 = 不施加绝对上限
```

---

## 严重

无。

判定依据：5 组必验项全部通过本人探针（规则 18/9/16 三态与两条判定链、编号 17 条体系、面板 13 项、一.4a–e、二.15–18、m1–m3）；6 页冒烟 0 未捕获异常；`node --check` ×3 全绿；外部引用 0；行尾/BOM 全符合；25 项 pre/post 对照全部 pre≠post（含 m1 的四类字符注入往返）。

## 一般

### A1【一般】OP 详情「执行历史徽标」缺 `cancelled`（与 `terminating`）分支：终态「已取消」记录渲染「● 运行中」，与同 Run 画布及 `proposal-01 §12.6` 冲突

- 位点：`原型图/index.html:1140-1144`（`renderOpDetail` 内 `stepRecordsOf(...).map` 的 `badge` 映射）：
  ```js
  var badge = h.status === 'success' ? '✓ 成功'
    : h.status === 'failed' ? '✗ 失败'
    : h.status === 'timeout' ? '⏱ 超时'
    : h.status === 'waiting' ? (runTerminal ? '⊘ 未执行' : '◌ 等待中')   // ← 本轮二.15 已收口
    : '<span class="badge badge-running">● 运行中</span>';                // ← cancelled / terminating / 任何未知值都落这里
  ```
- 口径：`proposal-01:1921-1926` 节点状态表 —— 已取消（cancelled）= `✕`；`StepRecord.status` 枚举（`crud-05:104/159`）= `waiting / running / terminating / success / failed / cancelled / timeout`。同一 Run 的画布已正确分离（`index.html:1496` `cancelled: {cls:'st-cancelled', text:'✕ 已取消'}`，注释 D7/G9「cancelled 不再回落」）。
- 复现实测（自建 `p6_state`，用出厂夹具 `run-012`，其 `node_review` 记录 `status=cancelled`）：
  ```
  run-012 / node_review 记录 = ["cancelled"]
  OP 详情徽标 = <span class="badge badge-running">● 运行中</span>        ← 期望 ✕ 已取消
  画布节点状态 = cancelled（workflow 详情路径，同节点）
  BAD C1 cancelled 记录 → 「✕ 已取消」（proposal-01 §12.6 节点状态表）
  OK  C2 画布同节点 = cancelled（与详情页应当一致）
  OK  C3 success/failed/timeout/running 四档映射正确
  ```
- 归因：pre（R2 快照）该映射同样无 `cancelled` 分支（`': \'<span class="badge badge-running">● 运行中</span>\';'`）→ **属历史遗留**，但本轮 `二.15「OP 详情三态口径 → 落地」` 正是为收口该页而做，只补了 `waiting` 一路，**同一页同一 Run 的同节点在画布与详情页结论相反**（详情「● 运行中」vs 画布「✕ 已取消」），验收「未执行只在终态」时会被该页证伪（终态 cancelled 记录被标成运行中）。
- 建议改法（与画布同口径，改动 1 行，零风险）：
  ```js
  : h.status === 'cancelled' ? '<span class="badge badge-off">✕ 已取消</span>'
  : h.status === 'terminating' ? '<span class="badge badge-terminating">⏹ 终止中</span>'
  : h.status === 'waiting' ? (runTerminal ? '⊘ 未执行' : '◌ 等待中')     // 保留本轮收口
  : '<span class="badge badge-running">● 运行中</span>';                 // 仅 running
  ```
  （`badge-off` / `badge-terminating` 均已存在：`index.html:109/945`。）验证：`p6_state` C1 由 BAD 转 OK，`p3_ui` F1–F6 与 `p1_kernel` 全绿不回归。

## 轻微

| # | 位点 | 问题（实测） | 建议改法 |
|-|-|-|-|
| m1 | `index.html:1143`、`:1173`（本轮新增 `◌ 等待中`）；对照 `:1495` 画布同字符 | `proposal-01:1831`（§12.5 OP 执行详情）明确「**状态图标限用 §12.6 节点状态表字符集（`✓ ✗ ⏱ ● ✕ ⊘`）**」，而 `◌` 不在其中（`grep -c ◌ proposal-01/02-*.md` = 0）。本轮把「未执行」条从 `◌` 改成 `⊘`（✓ 合规），但把 `waiting` 徽标从「● 运行中」改成「◌ 等待中」（文案正确、图标越集）。画布的 `◌ 等待中` 为 R2 遗留（不在本轮 diff 的新增行内） | 见 P1 拍板：或把节点级「等待中」图标补进 `p01 §12.6` 图标表（推荐，与画布一致），或改用文档既有字符 `⏳`/`●` 之外的合规方案。**涉及 `proposal-01`，不在本组可改范围** |
| m2 | `mock-data.js` 创建 Job 分支（`/api/jobs` POST） | `crud-04 3.4.3 ②`（语义/一致性）列了 `cron 非法 → 400 CRON_INVALID`、`target 引用不存在 → 404`、`inputs 键名不匹配 → 400`，mock 三项均未实现。实测：`opId=ffff…(不存在)` → **201 创建成功**（应 404）；`cron:'not a cron'` → **201**（应 400）。`grep -c CRON_INVALID` 在 pre 与本轮 mock 均为 0 → **pre 已存在**，且 UI 下拉不给悬挂引用，界面不可达 | 属演示简化，可保留；若要「实现与文档一致」则需补 3 条判定（须同步 `p2`/`p8` 断言）。见 P2 |
| m3 | `workflow.html:1780-1794`（`WF_CHECK_RULES`） | 条数 13 ✓、`output_from` 在末位 ✓，但第 11/12 项顺序与 `p01 §10.14` 行序相反（面板 `required` → `binding_pred`；文档 `参数绑定必须指向前置节点` → `所有 required 入参必须有来源`）。仅影响逐条对照浏览体验 | 与文档对齐调序（纯顺序改动，`p1_kernel` F1/F3 断言按 key 集合断言，不受影响） |

## 需拍板

1. **P1（对应 m1）节点级「等待中」的图标字符**：`proposal-01 §12.5:1831` 限定图标集为 `✓ ✗ ⏱ ● ✕ ⊘`，但 §12.6 节点状态表**没有**「等待中」行（`等待中` 仅以文字出现在注中），故原型无论用 `◌`（现状，画布+详情一致）还是 `⏳`（Run 级 waiting 字符）都无文档授权。请二选一：① 在 `p01 §12.6` 表补一行「等待中 | ⚪/— | `◌`（或 `⏳`）」并同步 §12.5 的图标集；② 保持文档不变，把画布与详情统一改用文档既有字符（需 A 组与文档组协同）。**本轮实现内部自洽，不该由原型组单方面改动**。
2. **P2（对应 m2）mock 是否补 `crud-04 3.4.3 ②` 的三条语义校验**（cron 非法 / 引用不存在 404 / inputs 键名）。补则原型更贴契约（UI 不可达，演示价值有限，且要改 `p2_docs`、`p8_pre_post` 断言语义）；不补则建议在 `mock-data.js` 头注一句话登记「② 语义校验为演示简化」。

## 修复顺序建议

1. **A1（唯一一般项，1 行改动，用户可见）**：`index.html:1140-1144` 补 `cancelled` / `terminating` 分支。验证脚本：`p6_state`（C1 转 OK，C2/C3 保持 OK）+ `p3_ui` F1–F6、`p1_kernel` 全绿。
2. **m3（零风险纯顺序）**：`WF_CHECK_RULES` 第 11/12 项与 `p01 §10.14` 行序对齐；验证：`p1_kernel` F1–F3、`p3_ui` F17–F19c。
3. **m1 / P1、m2 / P2（口径类，先拍板再动）**：P1 需文档组改 `proposal-01 §12.5/§12.6`（或原型统一改字符）；P2 需决定是否补 mock ② 语义校验。两者均**不阻塞**本轮验收。
4. **回归门禁（建议固化为原型侧验收脚本）**：`node --check` ×3 + 6 页 jsdom 冒烟 0 异常 + 外部引用 0 + 行尾/BOM 表 + 本报告 8 个探针（自建，存 `%TEMP%\jcval5\`，可原样复跑）。当前工作区：**全部满足**（唯一例外为 A1 的 `p6_state` C1）。

### 附：本轮自测证据（原始输出文件）

`%TEMP%\jcval5\out_p1_kernel.txt`(37/0)、`out_p2_docs.txt`(56/0)、`out_p3_ui.txt`(34/0)、`out_p4_regress.txt`(ALL OK)、`out_p4b_escape.txt`(7 条疑似逐条复核=安全)、`out_p4c_newlines.txt`(新增 778 行 → 疑似 7 条全部已转义)、`out_p5_inject.txt`(25/0)、`out_p6_state.txt`(5/1 ← A1)、`out_p7_list.txt`(4/0)、`out_p8_pre_post.txt`(25 项全 pre≠post)。
