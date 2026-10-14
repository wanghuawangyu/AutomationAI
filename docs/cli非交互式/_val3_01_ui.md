# 独立校验报告（第 3 轮 / 第 2 位校验员）—— proposal-01-界面设计.md × 原型图

**审查对象**：`docs/cli非交互式/proposal-01-界面设计.md`（3104 行，权威规格）+ `docs/cli非交互式/原型图/*`（9 个文件 + 新增 `xlsx-lite.js`）
**审查性质**：**只读**。未修改任何被审文件；本报告为新增交付物（`_val3_01_ui.md`）。全部核对脚本与产物放在 `%TEMP%\jcv3_ui_only\`（不在项目目录内）。
**本轮双重目标**：① 逐条核对第 1 轮修复（`_val2_01_ui.md` S1–S4 / G1–G20 / L1–L12 + `_fix_v2_decisions.md` 含末尾「补充拍板」）是否真的落地、是否与其它处一致、是否有漏改点、是否引入新矛盾；② 找出尚未被发现的问题（尤其修复引入的新问题与跨文件不一致）。
**行号基准**：文档行号 = `proposal-01-界面设计.md` 物理行号；`原型图/xxx` 行号 = 该文件物理行号（改动后现状）。跨文件引用（crud-0x）行号亦为现状。
**日期**：2026-10-14　**环境**：Windows / node v24.18.0 / jsdom 30.1.2（临时目录内，未进项目）

---

## 统计

| 档位 | 数量 | 说明 |
|-|-|-|
| 严重 | 2 | 均与第 1 轮修复直接相关：1 项跨文件新矛盾（D2 未闭环）、1 项修复引入的功能回归 |
| 一般 | 7 | 未落地项 2、跨文件/跨节不一致 4、原型保真缺口 1 |
| 轻微 | 8 | 文案/注释/图例/术语，不影响结构 |
| 需拍板 | 4 | 必须在二次修复前定口径 |

分类维度分布（A 前后矛盾 / B 不易理解 / C 方案待完善）：A 类 11 条、B 类 3 条、C 类 3 条（同一条按主导维度归类）。

### 必验项机械核对（方法与结果，全部在本环境实跑）

> 工具：`%TEMP%\jcv3_ui_only\{mech.py, smoke.js, probe*.js}`；jsdom 经 `%TEMP%\node_modules` 联接到已存在的本地副本（未联网安装）。
> **注意**：`%TEMP%\jc_val3` 与另一位并发校验员冲突（我的 `smoke.js` 被其覆盖），故已迁到独立目录 `%TEMP%\jcv3_ui_only\` 重跑；下述结论均来自隔离目录的产物。

**① D2（保存/校验关系）**
- 文档：`proposal-01:1154-1157`（§10.9「校验与保存的关系（D2 定稿）」）、`2492`（UC-W1）、`2494`（UC-W3）三处均已改为「保存不要求校验通过（允许保存草稿）」；旧措辞 `校验通过后才能保存` 全档 **0 残留**。
- 原型：`workflow.html:1938-1941` `doSave` 只做字段级校验（`firstNodeClientError`），**不再调用** `runWorkflowValidate`（探针：`doSave` 源码含 `runWorkflowValidate` = **false**）；`doExecute`（`workflow.html:1876-1881`）仍在执行前调用（= **true**）；`workflow.html:1800` 未保存对象点 [校验] → `请先保存后再校验`。→ **前端一致**。
- **但后端侧未闭环**：`crud-03:108`「（创建 3.3.3 / 更新 3.3.4 / 校验 3.3.6 **共用同一套**）」+ `crud-03:256`/`280` 的错误表把「拓扑非法、required 入参无来源（规则 14/15）」列为 400。探针实测原型 mock 侧相反：仅 Start+End 的草稿 `POST /api/workflows` 成功（返回 workflowId）；`crud-03` 同节又写「未提供 nodes/edges 时默认创建仅含 Start + End 的骨架」（`crud-03:226`）。→ **见 严重 S1**。
- 附带：mock 的 `POST /api/workflows/{id}/execute` 对「校验不通过」的 Workflow 仍返回 runId（探针实测），与 §10.9 例外句「后端在创建 Run 前做拓扑校验」不符 → **一般 G8**。

**② D3（节点 clientId 必填 + 默认最早匹配 Client + 去回退文案）**
- 文档：`proposal-01:866`（字段注释「kind === "op" 时必填（缺失 → 400 VALIDATION_ERROR；D3）」）、`914`（约束表「✅ 必填」）、`917`（表下注：默认选中该 OP 类型下 `createdAtMs` 最早的匹配 Client）、`1238`（§10.11 Client 行）**全部落地**。
- 原型：`workflow.html:1457` 文案已无「回退 Job.target.clientId」（全量 grep：`回退 Job.target.clientId` = **0**）；`workflow.html:655-661` `defaultClientIdForOp` 按 `createdAtMs` 升序取首个；`workflow.html:1313` 拖拽创建即写入。
- 探针实测（jsdom 驱动真实函数）：选用 `clean_logs`(powershell) → 新节点 `clientId = e5f60718293a4b5c6d7e8f90a1b2c3d4`（= 该类型下 `createdAtMs` 最早的「本地 PowerShell」）；`firstNodeClientError()` 对缺 client 节点返回「OP 节点必须指定 Client」；mock `POST /api/workflows` 缺 client → `{"code":"VALIDATION_ERROR","message":"OP 节点必须指定 Client（节点 node_x）"}`。→ **落地**。

**③ D4（`{kind:"unbound"}` 入模型 + 校验判据 + 下拉仅列前置节点）**
- 文档：`proposal-01:877`（`| { kind: "unbound" };`）、`958`（§10.4「仅限从 Start 可达且位于当前节点之前…下拉只列出这些节点的出参（D4）」）、`1191`（§10.10 拖拽置 `unbound`）、`1348-1349`（§10.14 新增「参数绑定必须指向前置节点」+ required 无来源三判据）→ **全部落地**。
- 原型：`workflow.html:1304`（新建节点 binding = `{kind:'unbound'}`）、`1562-1582`（`buildNodeOutputOptions` 只列 `wfPredecessorIds`）、`1585-1601`（反向可达 = 前置集）；`mock-data.js:1510-1515`（`__bindingHasSource`）、`1604-1619`（required + 前置判定）。
- 探针实测：新节点 `bindings = {"endpoint":{"kind":"unbound"}}`；`node_deploy` 前置集 = `["node_review","node_check","node_start"]`，下拉 **不含** 下游 `node_notify`；校验内核：`unbound` 与空 `literal` → 「节点 X 的 required 入参 Y 没有来源」；A 绑下游 B → 「节点 node_a 的入参 test_cmd 绑定了非前置节点 node_b 的出参」；B 绑前置 A + 无环 → `valid=true`。→ **落地**。

**④ D5（前端过滤 + 后端口径；错误码必须是 `CLIENT_TYPE_MISMATCH`）**
- 前端过滤：`op.html:441`（原有）、`job.html:902-920`（新增 `clientsForOpType` / `refreshClientOptions`，`job.html:894-895` 不再预填全量）、`workflow.html:651-653` + `1458-1465`（节点面板按类型过滤 + 空下拉提示）。探针实测节点面板下拉 = `— 未指定… | 本地 PowerShell`（仅匹配类型）→ **落地**。
- 文档：`proposal-01:376` 使用 `400 CLIENT_TYPE_MISMATCH`（符合「补充拍板」#1），未再出现 `VALIDATION_ERROR`。
- **原型 mock 未按仲裁**：`mock-data.js:1735`（POST workflows）、`1759`（POST jobs）、`1973`（PUT workflows）、`2020`（PUT jobs）4 处类型不匹配场景返回 `__err('VALIDATION_ERROR', …)`；`原型图/` 全目录 `CLIENT_TYPE_MISMATCH` = **0 命中**。探针实测：`POST /api/jobs` 类型不匹配 → `{"code":"VALIDATION_ERROR","message":"Client 类型与 OP 类型不匹配：OP clean_logs 为 powershell，Client Claude Code 为 prompt"}`（message 正确、**code 不符**）→ **见 一般 G1**。

**⑤ D6 / D15 / D16 / D8**
- D6（续跑）：`proposal-01:2032`（§12.8.5「续跑语义（D6）」）、`1775`（§12.4 [重试] 说明「从失败 step 开始重试（已完成节点不重复执行，见 §12.8）」）、`28`/`3088`/`3105` 已统一；旧措辞 `从失败 OP 开始重试` = 0。原型 `index.html:454` 重试对话框仍为「从失败节点开始重试」且**未说明「已完成节点不重复执行」** → **轻微 L5**。
- D15（cancelled 可重试）：`proposal-01:1749-1750`、`1899`（§12.6 头部按钮表拆「成功」「取消」）、`1980`、`2030` 均落地；原型 `index.html:881`（列表 `failed || timeout || cancelled`）、`index.html:1296-1305`（详情：`success` 不渲染 [重试]）落地；`mock-data.js:1190-1202` 的 `canRetryOf` 五条件含 cancelled。探针实测：成功行 `重试:false 重跑:true`；mock 内**无** `status='cancelled'` 的静态 Run（需先终止一条 running 才可演示）→ 代码路径正确但无现成夹具（不影响判定）。
- D16（触发 5 值）：原型 `index.html:243` = `manual | schedule | single_op | single_workflow | retry`（探针实测 6 个 option 含「全部触发」）；`proposal-01:1742` + `2705`（§18.1.3 同口径说明）落地 → **值域落地**，但**筛选项文案与原型不一致** → **一般 G4**。
- D8（拓扑不校验环）：`proposal-01:1351` 已删「DAG 无环」并加「不校验「环」（D8）」注；原型 `mock-data.js:1490-1491` 删除 `WF_LOOP_EDGE_CONDITION` / `__findWfCycle`（全量 grep 二者 = 0 命中，仅注释里保留「无环」二字作为删除说明）；探针实测含环图（`b→a always`）→ 环相关错误 = `[]` → **落地**。

**⑥ 低成本项**
- `timeoutSeconds`：`proposal-01:600`（整数 1..86400、默认 60、必填、越界 400）、`725`、`2822` 落地；`op.html:249`（默认模板 60）、`698`（新建预填 60）、`880-883`（显式校验 1..86400，替换 `|| 60` 静默兜底）落地 → **落地**。
- 导出组件本地内置：`index.html:7` 已改为 `<script src="xlsx-lite.js">`；全原型目录 `cdn.jsdelivr` / `SheetJS CDN` / `xlsx.full.min.js` = **0 残留**；`xlsx-lite.js` 独立验证见下。
- **`.xlsx` 合法性独立验证（新增证据）**：jsdom 驱动 `index.html` → `mockFetch('/api/runs/export', {filters:{}})` → base64 落盘 33793 字节；
  - ZIP 头 `504b0304`；EOCD `CD偏移(33376)+CD大小(395)=33771=EOCD offset`（结构自洽）；
  - `tar -tf` 列出 6 个成员（`[Content_Types].xml` / `_rels/.rels` / `xl/workbook.xml` / `xl/_rels/workbook.xml.rels` / `xl/worksheets/sheet1.xml` / `sheet2.xml`），`tar -xf` **解包成功**（bsdtar 会校验 CRC32 → CRC 正确）；
  - XML 全部 well-formed；`workbook.xml` 两张表名为 `运行历史` / `运行明细`；
  - 结论：**本地内置组件确实能生成合法 .xlsx**（ZIP method=store 未压缩；未在真实 Excel 中打开验证 → 该项标注「待确认」）。

**⑦ 全量 grep（§ 交叉引用 / 旧措辞 / 转义）**
- § 引用（`mech.py`）：`proposal-01` 标题 116 个、引用 30 个，悬空仅 `1.1`（指向 proposal-02）与 `15`（中文序号章节）——**均为改前既有**，非本轮缺陷。原型侧 § 引用悬空 **2 处**：`原型图/index.html:573` 的 `§18.2`（文档无 18.2，应为 §12.10 → **未落地，见 轻微 L1**）；`原型图/mock-data.js:1490` 的 `§3.3`（前缀是 `crud-03`，**非悬空**）。
- 旧措辞残留（期望 0）：`校验通过后才能保存` / `retryFromStepId` / `retry_from_step_id` / `按 opId 匹配` / `成功 / 取消` / `持久 Job·定时` / `可先点 [测试]` / `超时空` / `校验通过后才提交` / `回退 Job.target.clientId` / `单次执行 / 重试` / `deploy_url (string)` / `虚拟 Job / 单次执行` / `从失败 OP 开始重试` / `任意前置节点` / `有多条入边的节点必须有明确汇聚`（原型侧）/ `WF_LOOP_EDGE_CONDITION` / `__findWfCycle` / `cdn.jsdelivr` **全部 0**。命中 3 处但均有解释：`DAG 无环`（`mock-data.js:1491` 仅存于「删除原『DAG 无环』规则」的说明注释）、`node.client、`（`proposal-01:1249`，见 轻微 L4）、`§18.2`（见 轻微 L1）。
- 转义未被新代码破坏：逐条 review 本轮 `git diff` 的新增/修改拼接 —— `workflow.html`（新单选按钮用 `escText(pname)` 作属性、`escJsStr(pname)` 作内联处理器字面量；下拉 value/label 均 `escText`）、`job.html`（`escText(c.clientId/c.name)`；空下拉提示走 `textContent`）、`index.html`（`renderVersionOptions` 全部 `escText(v)`）、`client.html`（`escText`）→ **未发现新的未转义插值**。`escText`（`mock-data.js:63-70`，`& < > " '` 全转义）与 `escJsStr`（`74-77`，先 `\`/`'` 再实体化）定义未被改动。

**⑧ 原型语法与冒烟**
- `node --check`：`mock-data.js` / `xlsx-lite.js` / `workflow-canvas.js` 三文件 **CHECK_OK**。
- jsdom 冒烟 6 页（独立脚本，采集 `window.error` / `unhandledrejection` / `jsdomError`，等待 900ms）：`PASS index.html / client.html / op.html / workflow.html / job.html / settings.html` → **SUMMARY: 6/6 pages clean**。

---

## R1 修复核对表

> 判据：`_val2_01_ui.md`（S/G/L）+ `_fix_v2_decisions.md`（D 项与「补充拍板」）。「新矛盾」列只记**由本轮修复引入或未闭环**者。

| 项 | 结论 | 证据（现状行号） | 备注 / 新矛盾 |
|-|-|-|-|
| **S1 / D2** 保存不要求校验通过 | **部分落地** | doc `1154-1157/2492/2494` ✓；原型 `workflow.html:1938-1941` ✓ | **新矛盾（严重 S1）**：`crud-03:108/226/256/280` 仍要求保存时全量拓扑校验 |
| **S2 / D3** clientId 必填 + 默认最早 Client | **已落地** | doc `866/914/917/1238`；原型 `workflow.html:655-661/1313/1457/1951`；探针 3 项全绿 | 无 |
| **S3 / D4** `unbound` + 判据 + 仅前置下拉 | **已落地** | doc `877/958/1191/1348-1349`；原型 `workflow.html:1304/1562-1601`、`mock-data.js:1510-1515/1604-1619`；探针 5 项全绿 | 无 |
| **S4 / D5** 前端过滤 + 后端校验 | **前端已落地 / 原型 mock 未按仲裁** | 过滤：`op.html:441`、`job.html:902-920`、`workflow.html:651-653/1458-1465` ✓；错误码：`mock-data.js:1735/1759/1973/2020` 仍 `VALIDATION_ERROR` | **新矛盾（一般 G1）**：仲裁要求 `CLIENT_TYPE_MISMATCH` |
| **G1 / D15** cancelled 可 [重试] | **已落地** | doc `1749-1750/1899/1980/2030`；原型 `index.html:881/1296-1305`；`mock-data.js:1190-1202` | mock 无 cancelled 静态夹具（可经终止演示） |
| **G2** 成功 Run 不渲染 [重试] | **已落地** | doc `1765`（操作列限定句）；原型 `index.html:881-891`；探针：成功行 `重试:false` | 无 |
| **G3** Workflow 出参去 `(type)` | **已落地** | doc `1046-1047/1071/1857-1858/2740`；原型 `index.html:1327`、`workflow.html:903` | 无 |
| **G4** 执行状态按 `stepId` 匹配 | **已落地** | doc `1832`（原「按 opId 匹配」0 残留） | 无 |
| **G5** OP 详情页动态 | **已落地** | doc `1821`（原「静态示例」句已删） | 无 |
| **G6 / 低成本1** timeoutSeconds | **已落地** | doc `600/725/2822`；原型 `op.html:249/698/880-883` | 无 |
| **G7 / D16** 触发筛选粒度 | **值域已落地 / 文案未收敛** | doc `1742/2705`；原型 `index.html:243` | **新矛盾（一般 G5/G6）**：筛选项文案互不相同；§12.4 示例行仍写「单次执行」 |
| **G8** 未保存 Client 不可测试 | **已落地** | doc `2463`（UC-C1）、`2468`（UC-C6） | 无 |
| **G9 / D7** 画布三态分离 | **已落地（图例漏改）** | doc `1920`；原型 `index.html:1201/1212/1368-1369`、`workflow-canvas.css:53-54/64-65`；探针 6 页冒烟 0 异常 | **新问题（轻微 L1）**：`index.html:417-422` 图例未同步 |
| **G10 / L6** 详情页刷新 + 轮询接口 | **文档已落地 / 原型未落地** | doc `1822/1905/2070-2075/2616/2806` ✓；原型：`自动刷新` 仅 `index.html:232`（列表），`view-op-detail`/`view-wf-detail` **无** 控件 | **未落地（一般 G3）**：A 组列入「原型侧」、F 组清单**未含**→ 两组间漏项 |
| **G11** §11.3 示例自相矛盾 | **已落地（取「加示意注」）** | doc `1451` | 无 |
| **G12** §11.3 工作区列口径 | **已落地** | doc `1443` | 无 |
| **G13** 出参 `from` 改下拉 | **文档已落地 / 原型未落地** | doc `1141`、`1093-1094` ✓；原型 `workflow.html:1093/1126/1155` **仍是 `<input placeholder="workflowNodeId.outputName">`** | **未落地（一般 G4）**；附带发现：全档无 `from` 有效性校验规则 |
| **G14** 删不可判定的「汇聚」条 | **已落地（一侧）** | doc §10.14 无该条；原型 `mock-data.js` 无该规则 | **新矛盾（一般 G7）**：`crud-03:119` 规则 8 仍在（C 组按 D8 保留） |
| **G15** §4.2 运行历史口径 | **已落地** | doc `147` | 无 |
| **G16 / 低成本2** 导入上限取配置项 | **已落地** | doc `144-145/536`；原型 `op.html:1111`、`client.html:883`（均读 `SETTINGS.<group>.<key>`，默认 1 MiB） | `SETTING_LIMITS` 仅余 PUT 上限校验用途 ✓ |
| **G17** 变量注入约定 | **已落地** | doc `388-391/458`；原型 `mock-data.js:293`（`$AI_ENDPOINT`）、`op.html:280/823` | 无 |
| **G18** 校验提示文案补 4 条 | **已落地** | doc `1365-1368`；原型文案一致（`mock-data.js:1550-1567`） | 无 |
| **G19** Client 展开首行=类型+格式+描述 | **已落地** | 原型 `client.html:519`（删 `outputMode` 独立行，改 `jsonPath` 行） | 新小问题见 轻微 L4 |
| **G20** `attempt` → `retrySeq` | **已落地** | doc `1711`（本文中 attempt 一律指 retrySeq）、`1795` | 无 |
| **L1** `index.html §18.2` 引用 | **未落地（F 报告声称已改）** | `原型图/index.html:573` 仍为 `proposal-01 §18.2 D1 定稿` | **轻微 L1** |
| **L2** `mock-data.js §10.3` 误引 | **已落地** | `mock-data.js:500` → `§11.2 / §13.2` | 无 |
| **L3** 重跑「target 仍存在」 | **已落地** | doc `2026` | 无 |
| **L4** `nextRunAtMs` 界面落点 | **已落地（取「注明不展示」）** | doc `1408` | 无 |
| **L5** 版本筛选硬编码 | **已落地** | 原型 `index.html:248`（动态）+ `renderVersionOptions()`（`index.html:793-800`）；`jobVersion` 在夹具中存在，筛选可用 | 无 |
| **L6** 轮询接口口径 | **文档已落地** | doc `2070/2075/2616` | 原型侧见 G10 |
| **L7** 测试对话框「参数」取值 | **已落地** | doc `506` | 无 |
| **L8** §19 缺设置界面 | **已落地（新增 §19.10）** | doc `2839` 起 | 无 |
| **L9** `🔄` 徽标 | **已落地（doc 允许 desc 附标记；decisions 已把 settings.html 列为暂缓）** | doc `154` | 无 |
| **L10** ZIP 成员顺序 | **已落地** | doc `1313-1315`（树序）；原型 `workflow.html:2019-2021`、`job.html:1114-1116` | 无 |
| **L11** `retry` 展示文案 | **已落地** | `mock-data.js:52` `retry: '重试'`；doc `1763` 显式说明 | 无 |
| **L12** 「输出解析方式」统一 | **已落地** | doc `402/431`；原型 `client.html:509` | 无 |
| **D17** `retry_from_record_id` | **已落地** | doc `1656-1657`；原型 14 处（含 `__spawnRun` 取 `failedStep.recordId`） | 无 |
| **D8** 环校验 | **已落地** | doc `1351`；原型探针含环不报错 | 附带 `crud-03:108` 表述失效 → 一般 G7 |
| **低成本3** SheetJS 本地内置 | **已落地且独立验证通过** | `index.html:7/12-18`、新增 `xlsx-lite.js`；无 CDN 残留；.xlsx 经 ZIP+CRC+OOXML 三层校验 | 无 |
| **低成本1/2** | **已落地** | 见上 | — |

---

## 严重

### S1. D2 只改了 proposal-01 与 crud-03 的「校验接口」小节，`crud-03` 的创建/更新仍要求保存前全量拓扑合法 → 草稿无法保存（D2 未闭环）

**证据（跨文件矛盾）**
- `proposal-01-界面设计.md:1156`：「**保存不要求校验通过**（允许保存草稿）；`[保存]` 前**不调用** `POST /api/workflows/{workflowId}/validate`。」
- `proposal-01-界面设计.md:2494`（UC-W3）：「**保存不要求校验通过**（允许保存草稿；执行时后端再校验，见 §10.9）」
- `proposal-01-界面设计.md:936`（§10.3）：「**新建 Workflow 时，画布仅包含 Start 和 End 两个节点。**」
- `proposal-02-后端crud-03workflow管理.md:108`：「**校验规则**（创建 3.3.3 / 更新 3.3.4 / 校验 3.3.6 **共用同一套**；…）」
- `proposal-02-后端crud-03workflow管理.md:226`：「未提供 nodes/edges 时**默认创建仅含 Start + End 的骨架**」
- `proposal-02-后端crud-03workflow管理.md:256`（3.3.3 错误表）：「400 `VALIDATION_ERROR` | name 为空或超 512 字符、position 缺失、**拓扑非法**、节点字段约束不满足、…**参数绑定未指向前置节点 / required 入参无来源（校验规则 14/15）**」
- `proposal-02-后端crud-03workflow管理.md:280`（3.3.4 同）：同样含「拓扑非法」。
- 规则 4/5（`crud-03:115-116`）「Start 至少一条出边 / End 至少一条入边」恰恰违反「仅 Start+End 的骨架」。

**为什么是问题**
「保存草稿」是 UC-W1/W3、§10.9、§10.3 与原型 `workflow.html:1938-1941` 的共同承诺；而 `crud-03:226` 自己承认会创建只有 Start+End 的骨架，`crud-03:256` 又宣称这种拓扑（含用户新增 OP 节点但入参 `unbound`）返回 400。**同一节内部自相矛盾**，且与 §10.9 相反。按字面实现后端，则：① 用户点 [保存] 只要是草稿必 400；② 原型 `doSave` 已按 D2 不再本地校验，会直接把草稿提交给一个必然拒绝它的后端 → 新建/编辑 Workflow 的主流程再次不可用（即第 1 轮 S1 的症状，从 p01 位移到了 crud-03）。

**建议改法（三选一，需拍板 → P1）**
1. **（推荐）** 在 `crud-03:108` 把三入口拆开表述，并给 3.3.3/3.3.4 明确豁免：
   > **校验规则使用范围**：3.3.6 `[校验]` 使用**全部规则**；3.3.3 / 3.3.4 仅校验**字段级规则**（9/10/11/16：opId+opVersion、clientId 非空、类型匹配、Start 出边约束）+ `position` 完整性；**拓扑/连通/绑定类规则（1–8、13–15）不在保存时校验，改由**：① 3.3.6 `[校验]`（用户主动）与 ② 创建 Run 前（3.3.6/4.4）执行。
   同时把 `crud-03:256`/`280` 的「拓扑非法」「参数绑定未指向前置节点 / required 入参无来源（14/15）」从保存错误表移至「**仅校验接口 / 运行前**」注。
2. 保留保存即全量校验，但规定「**首次保存（POST）豁免拓扑类规则**」——此时必须同步 `proposal-01 §10.9` 并说明「第二次保存起必 400」，且 §10.9 的「允许保存草稿」需删除（改动面更大）。
3. 若确实要求「保存即合法」，则 §10.3「新建仅 Start+End」必须改为「新建即需在画布一次编排出合法拓扑」，原型 `workflow.html:1938-1941` 亦须回退为保存前校验（与 D2 相反）。

> 与 D13「被测前端 = `ui/`」冲突提示：无论选哪条，`tests/集成测试用例.md` 里「保存草稿」类断言都需同步。

---

### S2. `job.html` 的 D5 修复引入功能回归：编辑既有 Job（`target=op`）时 Client 选择被清空，导致 [保存] 必然报错

**证据**
- 修复后 `原型图/job.html:891-899`（`initSelects`）：Client 下拉**只预填占位项**
  ```js
  document.getElementById('clientSelect').innerHTML = '<option value="">— 请选择 Client —</option>' + '';   // D5：此处不预填全部 Client
  ```
- `原型图/job.html:837-841`（`openEditor` 编辑分支）：
  ```js
  document.getElementById('opSelect').value = (jobDef.target.opId) || '';
  document.getElementById('clientSelect').value = (jobDef.target.clientId) || '';   // ← 此时下拉里没有该 option
  onOpSelected();                                                                  // ← 才重建选项，keep = sel.value = ''
  ```
- `原型图/job.html:906-913`（`refreshClientOptions`）：
  ```js
  var keep = (keepValue != null) ? keepValue : sel.value;      // 调用处未传 keepValue
  …
  '<option value="…"' + (c.clientId === keep ? ' selected' : '') + '>…'   // keep='' → 无一项 selected
  ```
- 结果链路：`job.html:1054` `if (!document.getElementById('clientSelect').value) return '请选择 Client（target=OP 时必选）';` → 直接点 [保存] 必报错；`job.html:1078` 提交的 `target.clientId` 为空。

**实测（jsdom，正向 / 负向对照；负向 = `git archive HEAD` 导出的修复前目录）**
```
=== PRE-FIX  ===   job.target.clientId = e5f60718293a4b5c6d7e8f90a1b2c3d4
                   clientSelect.value  = "e5f60718293a4b5c6d7e8f90a1b2c3d4"   selectedIndex = 5
                   options = [— 请选择 Client —, Claude Code, Codex CLI, 本地 Bash, 本地 Python, 本地 PowerShell]
=== POST-FIX ===   job.target.clientId = e5f60718293a4b5c6d7e8f90a1b2c3d4
                   clientSelect.value  = ""                                  selectedIndex = 0
                   options = [— 请选择 Client —, 本地 PowerShell]
```

**为什么是问题**
「打开已有 Job 原样再保存」是最常见操作，现在会被无辜拦截（提示「请选择 Client」），且界面把已配置的 Client 显示为空（用户会以为自己没配）。**这是修复本身引入的回归**（修复前能正确回填），属 D5 落地质量缺陷。

**建议改法（任一）**
1. 推荐：`openEditor` 编辑分支显式传值并调整顺序 ——
   ```js
   var keepClient = (jobDef.target.clientId) || '';
   document.getElementById('clientSelect').value = keepClient;   // 仅为语义
   onOpSelected(keepClient);
   ```
   并令 `onOpSelected(keepValue)` → `refreshClientOptions(op || null, keepValue)`。
2. 或最小改动：把 `refreshClientOptions` 的 keep 优先级改为**先看数据源**（`keep = (keepValue != null) ? keepValue : (sel.value || (editingJobId ? currentJobClientId : ''))`）。
3. 复制路径（`job.html:783` → `openEditor(name+'_copy', …, copyFromName)`）走同一分支，修一处即同时修复；修后请补一条「编辑 → 不改 Client → [保存] 成功」的冒烟。

---

## 一般

### G1. D5 的仲裁错误码未在原型落地：类型不匹配仍抛 `VALIDATION_ERROR`（应为 `CLIENT_TYPE_MISMATCH`）

**证据**
- 仲裁口径：`_fix_v2_decisions.md:73`「**裁定采用 `400 CLIENT_TYPE_MISMATCH`**（而非 VALIDATION_ERROR），message 固定串不变。已同步 `proposal-01:376`」；`proposal-01:376` 现状确为 `400 CLIENT_TYPE_MISMATCH`（文档侧已合规）。
- 原型现状（4 处，全部用 `VALIDATION_ERROR`）：
  - `原型图/mock-data.js:1735`（`POST /api/workflows`）：`return resolve(__err('VALIDATION_ERROR', wCreateErrs.join('；')));`（`wCreateErrs` 含 `__wfNodeClientErrs` 的类型不匹配文案）
  - `原型图/mock-data.js:1759`（`POST /api/jobs`）：同形（`newJobMm` 文案并入 `VALIDATION_ERROR`）
  - `原型图/mock-data.js:1972-1973`（`PUT /api/workflows`）、`原型图/mock-data.js:2019-2020`（`PUT /api/jobs`）：同形
  - 机械核对：`原型图/` 全目录 `CLIENT_TYPE_MISMATCH` = **0 命中**
- `_fix_v2_F_proto.md:22` 自述「后端口径：类型不一致 → 400 `VALIDATION_ERROR`」——即修复者**知悉并要求回退到 VALIDATION_ERROR**，属对仲裁的偏离。

**实测**
```
[D5] POST /api/jobs 类型不匹配 → {"error":{"code":"VALIDATION_ERROR","message":"Client 类型与 OP 类型不匹配：OP clean_logs 为 powershell，Client Claude Code 为 prompt"}}
[D5] POST /api/workflows 类型不匹配 → {"error":{"code":"VALIDATION_ERROR","message":"节点 node_y：Client 类型与 OP 类型不匹配：…"}}
```

**为什么是问题**：错误码是前端/测试的判定依据（`tests/集成测试用例.md:1178/1191/1202/1212` 明确断言 `400 CLIENT_TYPE_MISMATCH`）；原型作为评审对照与（可能的）`ui/` 搬运基线，携带错码会让「按原型实现」得到与文档/测试相反的码。且该偏离已被修复者记录为「有意为之」，若不纠正会被下一轮当作既定口径。

**建议改法**：把上述 4 处类型不匹配分支的码改为 `CLIENT_TYPE_MISMATCH`（message 不变）。若 `__err` 只接受单一 code，则把类型不匹配从 `*Errs` 数组里拆出、单独 `resolve(__err('CLIENT_TYPE_MISMATCH', mm))`（注意 `POST /api/workflows` 里 `__wfNodeClientErrs` 同时承载「clientId 缺失（VALIDATION_ERROR）」与「类型不匹配（CLIENT_TYPE_MISMATCH）」，需**按错误来源分别定码**，不能让前者被后者吞掉）。

### G2. 原型 `index.html:573` 的 `§18.2` 引用未修改（F 组报告声称已改，实际未落地）

**证据**
- `原型图/index.html:573`：「`// M3/N6：前端轮询间隔经 GET /api/settings 读取（crud-06 3.3 / proposal-01 §18.2 D1 定稿）——`」（机械核对：proposal-01 章节集合中 **无 18.2**，§18 只有 `18.0.1/18.0.2/18.0.3/18.1/18.1.1/18.1.2/18.1.3`）。
- `_fix_v2_F_proto.md:36` 声称：「| **L1** | `index.html:573` | 注释 `§18.2` → `§12.10` | scan 无 `§18.2` |」——与现状不符。

**为什么是问题**：不仅引用悬空，还说明「扫描脚本未真正覆盖该文件/该串」，同批其它「scan 无 X」结论的可信度需要复核（本报告已对旧措辞做全量独立复扫，结论见上：其余确实为 0）。

**建议改法**：改 `原型图/index.html:573` 为 `proposal-01 §12.10（D1 定稿）`；F 组复扫脚本改为**读文件内容正则扫描**（而非按文件名匹配）以免漏检。

### G3. G10 的原型侧未落地：Run 详情页仍无 [刷新] / [自动刷新] 开关与独立轮询（两组之间的漏项）

**证据**
- 文档已要求：`proposal-01:1822`（§12.5）、`1905`（§12.6）、`2075`（§12.10「Run 详情刷新（G10）」）、`2616`（§17.5）、`2806`（§19.6「自动刷新开关 | 运行历史 / **Run 详情顶部**」）。
- 原型：`自动刷新` 仅出现在 `index.html:232`（**列表头**）与 `index.html:571-604`（列表轮询）；`view-op-detail` / `view-wf-detail` 区块内无任何刷新控件（全量 grep `刷新` 在详情视图 0 命中）。
- 责任归属：`_fix_v2_A_ui.md:84` 把该项列入「A. 属于原型图的改动（本任务禁止修改原型）」；而 `_fix_v2_F_proto.md` 的已修项表**不含 G10** → **无人认领**。

**为什么是问题**：文档三处已把它写成硬要求，`ui/` 会照做，但原型（视觉基线）没有该控件，实现者/评审者无法对照；且运行中 Run 的详情刷新是核心场景（§7.8 轮询原则）。

**建议改法**
1. 原型：`index.html` 的 `#view-op-detail` / `#view-wf-detail` 头部各加 `[刷新] [自动刷新: 开]`，复用 `pollIntervalMs()`；自动刷新时轮询 `/api/runs/{runId}/status`，无 running step 自动停止；切视图启停定时器（避免详情页仍在刷列表）。
2. 或（若本轮不再改原型）在 `proposal-01:1822/1905` 注明「**本轮原型未实现，以实现 `ui/` 为准**」，避免「文档要求 vs 原型缺失」被当作实现错误。

### G4. G13 的原型侧未落地（出参 `from` 仍要手输 UUID），且全档**没有**「`from` 必须指向存在的节点出参」校验规则

**证据**
- 文档（已改）：`proposal-01:1141`「`from` 为**下拉选择**（节点 × 该节点出参），展示为「{节点画布名} · {OP 名} · {outputName}」，存储为 `workflowNodeId.outputName`；**不要求用户输入 32 位 UUID**」；`1093-1094` 表头 `from（下拉：节点 × 出参）`、示例 `[node_deploy · deploy · url ▾]`。
- 原型（未改）：`workflow.html:1093` 表头 `from (workflowNodeId.outputName)`；`workflow.html:1122-1126`、`1155` 仍是
  ```js
  var fromVal = o.from ? ((o.from.workflowNodeId || '') + '.' + (o.from.outputName || '')) : '';
  '<input type="text" value="' + escapeAttr(fromVal) + '" placeholder="workflowNodeId.outputName" />'
  ```
  即要求用户手输 32 位十六进制 UUID（与 §10.11「节点 ID 界面不直接展示」冲突）。
- 规则缺口：`proposal-01 §10.14`（现 11 条）与 `crud-03 §3.3`（17 条）均**无**关于 `Workflow.outputs[].from.workflowNodeId / outputName` 的校验（`crud-03` 规则 13 只覆盖 `bindings`；`outputs.from` 仅在导入重映射语境出现，`crud-03:467/518`）。原型 `validateWorkflowOf` 亦不检查。

**实测**：`collectWfParams('#wfOutputTable', false)` 直接 `split('.')` 取 `parts[0]/parts[1]`（`workflow.html:1974-1979`），无合法性校验；mock 的 `POST/PUT /api/workflows` 只做 `__nameErrs` + `__wfNodeClientErrs`。

**为什么是问题**：① 文档与原型对同一控件给出不同交互（手输 UUID 是「界面不展示 workflowNodeId」的直接反例）；② 即使按文档改成下拉，**服务端也没有任何规则拦截**指向已删除/不存在节点或不存在出参的 `from`，可保存「出参来源悬空」的 Workflow，运行期才炸。

**建议改法**
1. 原型：把 `workflow.html:1126`、`1155` 的 `<input>` 换成两个 `<select>`（节点 / 该节点出参），展示「{节点画布名} · {OP 名} · {outputName}」，提交时组装 `workflowNodeId.outputName`；表头改与文档一致。
2. 文档：在 `proposal-01 §10.14` 与 `crud-03 §3.3` 各补一条可判定规则（编号接现有最大号）：
   > `| 出参来源必须有效 | 每个 `Workflow.outputs[].from` 的 `workflowNodeId` 必须存在且为 op 节点，`outputName` 必须在该节点 OP 的 outputs 中；否则校验不通过 |`
   并在 `crud-03` 的 3.3.3/3.3.4/3.3.6 与 `proposal-01 §10.14` 的失败提示表补对应文案（如「出参 X 的来源节点不存在」）。

### G5. 「触发」筛选项文案：文档写「手动 / 定时」，原型写「持久 Job · 手动 / 持久 Job · 定时」（G7 的两组修复方向相反，未真正收敛）

**证据**
- 文档 `proposal-01:1742`：「| 触发 | 全部 / **手动（manual）** / **定时（schedule）** / 单次执行·OP（single_op） / 单次执行·Workflow（single_workflow） / 重试（retry） |」
- 原型 `index.html:243`（实测文本）：
  `<option value="manual">持久 Job · 手动</option>…<option value="schedule">持久 Job · 定时</option>…<option value="single_op">单次执行 · OP</option>…`
- 同节 `proposal-01:1763` 的**列表展示映射**确实是「manual → `持久 Job / 手动`；schedule → `持久 Job / 定时`」——即文档刻意区分「筛选项文案（手动/定时）」与「列表展示文案（持久 Job / 手动）」。
- 历史：第 1 轮 G7 指「原型用『手动 / 定时』、文档写『持久 Job·手动』」；本轮 A 组把文档改成「手动 / 定时」，F 组同时把原型改成「持久 Job · 手动」→ **两侧互换，冲突依旧**。

**为什么是问题**：同一份需求里「筛选项标签」这一事实仍有两份互相打脸的文本；测试无法写 UI 断言（按文档实现会与原型不符）。

**建议改法（择一，见需拍板 P3）**
- 方案 A（推荐，与 §12.4 展示映射同源、歧义最小）：把 `proposal-01:1742` 的筛选项文案改为与原型一致（`持久 Job · 手动` / `持久 Job · 定时`）。
- 方案 B：保留文档「手动 / 定时」，把 `原型图/index.html:243` 的两个 option 文本改回「手动」「定时」。

### G6. `§12.4` 列表示例行的「触发方式」列仍写「单次执行」，与同节映射表 / §12.5 详情示例 / 原型不一致

**证据**
- `proposal-01:1724`：「`│ check_tests OP check_tests v2 - /path/ws-001 **单次执行** ✓ 成功 12.3s [重跑] │`」
- `proposal-01:1725`：「`│ deploy_workflow Workflow deploy_workflow v2 - /path/ws-002 **单次执行** ● 运行中 [终止] │`」
- 同节 `proposal-01:1763` 映射：`single_op → 单次执行 · OP`；`single_workflow → 单次执行 · Workflow`。
- 同节示例的 `持久 Job / 定时` 行（`1726-1729`）与映射**一致**（说明只是这两行漏改）。
- 详情页示例已改：`proposal-01:1791`「触发: 单次执行 · OP」；原型 `mock-data.js:50-51` `single_op: '单次执行 · OP'`。

**建议改法**：把 `1724` 改为「单次执行 · OP」（check_tests 是 OP target）、`1725` 改为「单次执行 · Workflow」，与映射表和原型对齐。

### G7. 「明确汇聚」规则只从 `proposal-01` 与原型删除，`crud-03` 仍保留为 400 条件；且 `crud-03:108` 的「与 §10.14 逐条并列」表述已失效

**证据**
- `proposal-01 §10.14`（`1339-1349`）现为 11 条，**无**「有多条入边的节点必须有明确汇聚」；原型 `mock-data.js:1493` 明确「G14：删除原第 11 条」。
- `proposal-02-后端crud-03workflow管理.md:119`：「| 8 | 有多条入边的节点必须有**明确汇聚**（由 DAG 边决定；op 节点为 AND-join，见 4.3.0 ②） | 400 `VALIDATION_ERROR` |」——**仍在**（`_fix_v2_C_wf.md:26` 记为按 D8「逐条并列补入」，即 C 组有意保留）。
- `proposal-02-后端crud-03workflow管理.md:108`：「**与 `proposal-01 §10.14` 逐条并列，唯一差异 = 第 17 行「允许环」**」——现状 p01 11 条 / crud-03 17 条，差异除第 17 行外还有 8（汇聚）、12（悬挂 client 不拦）、13（bindings 引用存在）、16（Start 出边约束）；`crud-03:309` 的功能说明也仍列「汇聚」。

**为什么是问题**：第 1 轮 G14 的结论是「『明确汇聚』不可判定，应删或改写」；现在变成「界面与原型都不报它，后端仍可能用它返回 400」——用户会遇到前端 [校验] 全绿、执行/保存却被后端以一条界面上不存在的规则拒绝。且 `crud-03:108` 的并列声明是给实现者看的对照依据，现在不成立。

**建议改法**
1. 二选一：① 删除 `crud-03:119` 规则 8（与 p01/原型一致，汇聚语义保留在 `crud-03 4.3.0 ②` 的运行语义说明）；② 或把该规则**改写为可判定**并补回 p01 §10.14 + 原型校验 + 失败文案（「入度 > 1 的 op 节点，其每个 required 入参必须有非 `unbound` 的绑定」，与规则 15 同判据则只报一次）。
2. 同步修 `crud-03:108` 的表述：把「与 `proposal-01 §10.14` 逐条并列，唯一差异 = 第 17 行」改为「**取代** `proposal-01 §10.14`，本节为唯一完整规则集（p01 仅列界面可见的校验提示项；差异项：汇聚 8 / 悬挂 client 12 / bindings 引用存在 13 / Start 出边 16）」。

### G8. 原型 mock 的 `POST /api/workflows/{id}/execute` 不做「创建 Run 前拓扑校验」（与 §10.9 例外句不符）

**证据**
- `proposal-01:1157`（§10.9 例外）：「`[执行]`（单次执行）与 Job 触发执行时，后端在创建 Run 前对**所引用版本**做拓扑校验，不通过 → 400 `VALIDATION_ERROR`，前端提示「拓扑不合法，无法执行」。」
- 实测（jsdom）：先创建「仅 Start+End」的草稿（`validate` 返回 `{"valid":false,"errors":["Start 节点至少需要一条出边","End 节点至少需要一条入边"]}`），再
  `mockFetch('/api/workflows/{id}/execute', {inputs:{}, workspace:'/tmp/x'})` → `{"runId":"932b5ce08e2914f0952004b805982939"}`（**建 Run 成功**，无 400）。
- 现状仅靠前端 `workflow.html:1876-1881` 的**前端预校验**拦截（提示语「校验未通过，已取消执行（请先修复上述拓扑错误）」）。

**为什么是问题**：① 原型的 mock 扮演后端，接受非法拓扑执行会让「后端在创建 Run 前校验」这条契约在原型里失去落点（评审时会看到「非法也能跑」）；② 提示语与文档指定的「拓扑不合法，无法执行」不一致（见 轻微 L6）。

**建议改法**
1. 原型：`mock-data.js` 的 `/api/workflows/{workflowId}/execute` 分支在 `__createVirtualRun` 前调用 `validateWorkflowOf(wf)`，`valid === false` → `resolve(__err('VALIDATION_ERROR', '拓扑不合法，无法执行：' + errors.join('；')))`。
2. 文案：把 `workflow.html:1878` 的 `failNotice` 改为文档口径（或反向统一文档，见需拍板 P4）。

---

## 轻微

### L1. 画布图例未随三态分离更新（`index.html:417-422`）

D7/G9 已把画布状态拆成 `st-wait`（◌ 等待中）/ `st-skip`（⊘ 未执行）/ `st-cancelled`（✕ 已取消）并补了 CSS（`workflow-canvas.css:52-54/63-65`），但图例仍为 6 项且把两态合并：
`原型图/index.html:422`：`<span class="legend-item"><i class="legend-box lb-wait"></i>等待中 / 未执行</span>`，**无「已取消」图例项**（也无 `lb-cancelled` 样式）。
**建议**：图例改为 7 项（新增「已取消」用深灰框），或至少把 `lb-wait` 文案拆成两项；同一处 `index.html:295` 的说明文案「◌ 该节点未执行（本次 Run 无该节点的执行记录）」也宜与 `⊘ 未执行` 对齐（现用 ◌）。

### L2. 同一状态 `cancelled` 在文档与原型内部各存在两种图标（⊘ 与 ✕）

- Run 层（列表结果徽标）：`proposal-01:1764`「`⊘ cancelled 已取消`」↔ 原型 `index.html:1232`（步骤列表徽标）`⊘ 已取消`、`index.html:853` 徽标文本同族 —— **两侧一致**。
- 节点层（画布）：`proposal-01:1917`「已取消 | ⚫ 深灰框 | **✕**」↔ `index.html:1368` `✕ 已取消` —— **两侧一致**。
- 但 `⊘` 在节点层被定义给「未执行 / 跳过」（`proposal-01:1918`），于是**同一个 `⊘` 在 Run 层表示「已取消」、在节点层表示「未执行」**。
**建议**：Run 层 cancelled 也统一用 `✕`（或反之统一为 `⊘`），并注明「`⊘` 仅用于未执行/跳过」；否则用户在同一屏（Run 徽标 + 画布）看到 `⊘` 会有歧义。标注：待确认（是否刻意为之）。

### L3. `§10.11` 保存语义写成 `node.client`（字段名应为 `node.clientId`）

`proposal-01:1249`：「| 点击 [保存] | 将编辑草稿写入节点数据（**node.client**、node.bindings、node.retry） |」——`WorkflowNode` 无 `client` 字段（`proposal-01:866` 为 `clientId`）。
**建议**：改为 `node.clientId`。

### L4. 原型 Client 行内展开的 prompt 第二行标签「command」与文档「二进制路径」不一致

- 文档：`proposal-01:407`（§8.5 展开示例）「二进制路径: claude」（Claude Code 是 prompt 类型）；`proposal-01:2672`（§19.1）「第二行=二进制路径」。
- 原型：`client.html:521` prompt 分支 `<td class="dt-k">command</td>`（列表列标题却是「二进制路径」，`client.html:507`）。
**建议**：把该行标签统一为「二进制路径」（或文档改为「命令 / 二进制路径」并说明 prompt 用 command）。

### L5. 重试对话框未说明「已完成节点不重复执行」

`proposal-01:2011`（§12.8.4）「从失败节点开始重试（固定）」、`原型图/index.html:454`「从失败节点开始重试」——均未含 D6 要求的「已完成节点不重复执行」（该说明只在 §12.4 `1775` 与 §12.8.5 `2032` 出现）。
**建议**：对话框内补一行「已完成的前置节点不会重复执行（续跑）」。

### L6. §10.9 例外句的前端提示文案与原型不一致

文档 `proposal-01:1157` 指定前端提示「**拓扑不合法，无法执行**」；原型 `workflow.html:1878` 实际为「**校验未通过，已取消执行（请先修复上述拓扑错误）**」。
**建议**：二选一（改文档或改原型），并在 `tests` 断言中固定该文案。

### L7. 措辞小漂移（2 处）

- `proposal-01:536`（§8.9）用「`file.size ≤ **settings.**<client|op>_import_max_bytes`」，而 `§4.2`（`144-145`）、`crud-06`、原型注释均称「**配置项**」；建议统一为「配置项 `client_import_max_bytes` / `op_import_max_bytes`（默认 1 MiB）」。
- `原型图/workflow.html:1793` 注释仍写「回调校验接口（crud-03 3.3.6）…**（保存 / 执行前调用 → 阻止后续动作）**」——D2 后 `[保存]` 已不调用，注释过时（`doSave` 处 `1938` 另有正确注释）。
**建议**：按上文改；注释同步为「仅 [校验] 按钮与 [执行] 前调用」。

### L8. `§12.4` 与 `§12.6` 的「结果 / 节点状态」两表未给出相互关系（易读性问题）

`§12.4`（Run 级 7 态徽标）与 `§12.6`（节点级 6 态边框/图标）是两套并列的展示口径，但两处都没有一句「Run 级徽标用于列表与详情头部；节点级用于画布」的交叉说明（`§12.6:1920` 只约束了节点级不得复用「等待中」）。
**建议**：在 `§12.6:1920` 后补一句「Run 级状态（`§12.4` 结果列）与节点级状态（本表）是两套口径：前者描述 Run 整体，后者描述单个节点执行情况」。

---

## 需拍板（放最后）

**P1（对应 严重 S1）**：`crud-03` 3.3.3 / 3.3.4 是否豁免拓扑/绑定类规则？
- 选项 A（推荐）：保存仅做字段级（规则 9/10/11/16 + position），拓扑/连通/绑定（1–8、13–15）只在 `[校验]` 与「创建 Run 前」执行 —— 与 D2/§10.9/原型完全对齐，改动集中在 `crud-03:108/256/280`。
- 选项 B：POST 首次保存豁免拓扑（需同步删 §10.9 的「允许保存草稿」并说明 PUT 必 400）—— 仍会让「编辑草稿再保存」失败，不推荐。
- 影响面：`crud-03`（3.3 规则表 + 3.3.3/3.3.4/3.3.6 错误表 + 4.4 执行前校验）、`proposal-01 §10.9`、`tests`（保存草稿类断言）、原型 mock（`POST/PUT /api/workflows` 是否要加/保持）。

**P2（对应 一般 G4）**：`Workflow.outputs[].from` 是否新增可判定校验规则 + 原型控件是否改为下拉（`from` 指向不存在节点/出参目前无人拦截）？
- 选项 A（推荐）：加规则（p01 §10.14 + crud-03 §3.3 + 失败文案）+ 原型改双下拉。
- 选项 B：本轮只改原型控件（视觉对齐），规则留待下一轮 → 需在 §10.14 注明「`from` 不校验」。
- 影响面：`proposal-01 §10.9/§10.14`、`crud-03 §3.3`、原型 `workflow.html`、`tests`。

**P3（对应 一般 G5）**：触发筛选项文案以谁为准？
- 选项 A（推荐）：以原型/展示映射为准 → 文档 `1742` 改为「持久 Job · 手动 / 持久 Job · 定时 / 单次执行 · OP / 单次执行 · Workflow / 重试」。
- 选项 B：以文档为准 → 改原型 `index.html:243` 两处文本为「手动」「定时」。
- 影响面：p01 `1742`（+`1763` 是否保留「/」分隔需一并定）、原型 `index.html:243`、`tests` UI 断言。

**P4（对应 一般 G8 / 轻微 L6）**：原型 mock 是否需要与后端契约「逐条同构」（错误码 + 校验时机）？
- 选项 A（推荐）：**是**——mock 视为可执行规格：类型不匹配返回 `CLIENT_TYPE_MISMATCH`（4 处）、`execute` 前做拓扑校验并返回 400 `VALIDATION_ERROR`、前端提示统一为文档文案。
- 选项 B：**否**——mock 仅演示视觉，需在 `原型图/` 头部或 `_fix_v2_decisions.md` 注明「错误码/校验时机以实现 `ui/` 为准」，并同步放宽 `tests` 对原型的引用（D13 已把原型排除在验证依据外）。
- 影响面：`原型图/mock-data.js`、`workflow.html`、`job.html`、`tests`；若选 B 需补一份「原型保真度豁免清单」。

---

## 修复顺序建议

**第 0 批（阻塞，先拍板）**：**P1 / P4** —— 决定「保存时校验什么」与「原型是否充当契约」。这两项决定 S1、G4、G8 的最终改法，且 P1 会同时改动文档与原型两侧。

**第 1 批（严重）**
1. **S1**：按 P1 结论改 `crud-03:108/226/256/280`（+ 必要时 §10.9），并跑「新建 → 保存草稿 → 再编辑保存」的正反用例。*（另一组负责文件；本组建议已给出可套用的措辞）*
2. **S2**：`job.html` 修复编辑/复制回填（`onOpSelected(keepValue)` 或数据源优先），并补一条「编辑 → 不改 Client → [保存] 成功」的正向 + 「修复前失败」负向对照（本文已给可复现脚本）。

**第 2 批（原型未落地项，可与第 1 批并行）**
3. **G3（G10 原型侧）**：详情页加 [刷新]/[自动刷新] + 轮询 `/api/runs/{runId}/status`，切视图启停。
4. **G4（G13 原型侧 + P2 规则）**：出参 `from` 改双下拉；若 P2 选 A，同步 `§10.14` / `crud-03 §3.3` 规则与文案。
5. **G1 / G8 / 轻微 L6**：mock 类型不匹配改 `CLIENT_TYPE_MISMATCH`（4 处）；mock `execute` 加拓扑校验；统一提示文案。
6. **G2 / 轻微 L1**：`index.html:573` §18.2 → §12.10；图例补「已取消」、拆「等待中 / 未执行」。

**第 3 批（文案与跨节一致性，无依赖）**
7. **G5 / G6**（触发筛选文案、§12.4 示例行）、**L2**（cancelled 图标统一）、**L3/L4/L5/L7/L8**、**G7**（crud-03 规则 8 与 `:108` 表述）。

**回归验证建议（每批完成后）**
1. 重跑本文脚本：`node smoke.js`（6 页 0 异常）+ `probe_wf.js` / `probe_wf2.js` / `probe_exec.js` / `probe_idx.js`（D2–D16 正反断言）+ `probe_job_edit.js`（**PRE-FIX/POST-FIX 对照**，防止 S2 回归再犯）+ `probe_xlsx.js`（导出结构 + `tar -xf` CRC）。
2. `mech.py` 复扫：§ 引用 0 悬空（允许既有 `1.1`/`15`）、旧措辞 0 残留、`CLIENT_TYPE_MISMATCH` 在原型出现次数 > 0。
3. 新增「同一事实多点复述」清单并逐点比对（本轮 G5/G6/L2 都属此类）：触发筛选文案、触发展示映射、cancelled 图标、`from` 控件、保存是否校验。

---

*（本报告仅判定 `proposal-01-界面设计.md` 与 `原型图/*`；`proposal-02-*`、`schema.sql`、`tasks.md`、`tests/` 仅作为「跨文件不一致」的对照证据引用，其自身缺陷不在此报告分档。）*
