# proposal-01-界面设计.md 修复报告（组 A / 修复者）

- 唯一可改文件：`proposal-01-界面设计.md`（本报告为新增交付物 `_fix_v2_A_ui.md`，未改任何其它文件）。
- 口径依据：`_fix_v2_decisions.md`（唯一权威拍板）。发现来源：`_val2_01_ui.md`（全部）、`_val2_04_global.md` 与 `_val2_05_new.md` 中涉及本文件的部分。
- 行号基准：`proposal-01-界面设计.md` 改后物理行号。
- 行尾：改后 `CRLF=0 / LF=3104`（与该文件改前一致，未做任何换行符转换）。文件末尾仍无换行（改前后一致）。

---

## 已修项表

| 项号 | 文件:行 | 改法 |
|-|-|-|
| D2 / S1（UC 表述） | proposal-01:2492, 2494 | UC-W1「可先点 [校验]（不通过不影响保存）」；UC-W3 删「校验通过后才能保存」，改为「**保存不要求校验通过**（允许保存草稿；执行时后端再校验，见 §10.9）」 |
| D2 / S1（硬口径） | proposal-01:1154-1157 | §10.9 新增「**校验与保存的关系（D2 定稿）**」：`[校验]` 与 `[保存]` 独立；保存前不调 `validate`；未保存对象点 [校验] 提示「请先保存后再校验」；`[执行]` / Job 触发创建 Run 前后端校验，失败 400 `VALIDATION_ERROR` → 前端提示「拓扑不合法，无法执行」 |
| D3 / S2（字段） | proposal-01:866 | `WorkflowNode.clientId` 注释改为「kind === "op" 时**必填**（缺失 → 400 VALIDATION_ERROR；D3）」 |
| D3 / S2（约束表+注） | proposal-01:914, 917 | §10.3 节点字段约束表 `op.clientId` 由「✅ 可选」改「✅ 必填（缺失 → 400 VALIDATION_ERROR；D3）」；表下新增「OP 节点必须指定 Client（D3）」注（含拖拽创建时默认选中该 OP 类型下 `createdAtMs` 最早的匹配 Client，过滤见 §8.3） |
| D4 / S3（数据结构） | proposal-01:873-877 | `ParamBinding` 新增 `| { kind: "unbound" };`（拖拽创建节点时全部入参初始态；无来源） |
| D4 / S3（绑定来源） | proposal-01:958 | §10.4「任意前置节点的出参」改为「**仅限从 Start 可达且位于当前节点之前**的节点（DAG 拓扑序），下拉只列这些节点的出参」 |
| D4 / S3（拖拽） | proposal-01:1191 | §10.10「释放到画布空白处」改为「自动带出全部入参，**绑定类型置为 `unbound`**（未绑定，无来源）」 |
| D4 / S3（校验规则） | proposal-01:1348-1349 | §10.14 新增规则「参数绑定必须指向前置节点」；「所有 required 入参必须有来源」补判据：`bindings[name]` 不存在 **或** `kind="unbound"` **或** `kind="literal"` 且 `value=""` → 视为无来源 |
| D4 / D3（校验规则） | proposal-01:1347 | §10.14 新增规则「所有 OP 节点的 clientId 非空」 |
| D5 / S4（§8.3） | proposal-01:376 | §8.3 表下新增「类型匹配为硬契约（前后端双保险，D5）」：前端 4 处下拉按映射过滤、空下拉提示文案；后端 `POST/PUT /api/jobs`(target.kind=op) 与 `/api/workflows`（OP 节点 clientId）校验类型一致，不一致 400（message 格式按 D5） |
| D5 / S4（§10.11） | proposal-01:1238 | 节点详情面板 Client 行改为「仅列出与该节点 `OP.type` 匹配的 Client（§8.3）；默认选中该 OP 类型下 `createdAtMs` 最早的匹配 Client」 |
| D5 / S4（§11.4） | proposal-01:1479 | §11.4「选择目标类型后的行为」新增行：选择具体 OP 后 Client 下拉只列匹配类型，空则提示「请先在 Client 管理中创建 {type} 类型的 Client」 |
| D6（续跑语义） | proposal-01:2032 | §12.8.5 表下新增「续跑语义（D6）」：「从失败/超时 step 对应节点为起点新建 Run，**全部前置节点视为已完成、不重复执行**；上下文取源 Run 完成节点出参快照；与 rerun 区别（rerun 从头且不写 `retry_from_*`）」 |
| D6（文案统一） | proposal-01:28, 1775, 1979, 3088, 3105 | 「从失败 OP 重试」统一为「从失败 step 重试/续跑」；§12.4 [重试] 说明改「从失败 step 开始重试（已完成节点不重复执行）」 |
| D8 / S-1（§10.14 删环条） | proposal-01:1351 | 删「DAG 无环（除循环回跳）」条，新增注「**不校验「环」（D8）**：允许环路（含回跳边）；回跳由**运行时计数约束**（见 crud-03 4.3）推导，上限 `min(max×3, max_loop_multiplier)` 兜底；校验端不做环判定」 |
| D15 / G1 | proposal-01:1749-1750, 1775, 1898-1899 | §12.4 新增「cancelled 结束且终止前存在失败/超时 step 时 [重试] 可点（D15）」；[重试] 展示条件补 cancelled；§12.6 头部按钮表拆「成功 → [重跑]」「取消 → [重试] + [重跑]」 |
| D16 / G7 | proposal-01:1742, 2705 | §12.4「触发」筛选改为 5 值一一对应（手动/定时/单次执行·OP/单次执行·Workflow/重试），注明「不做多值合并」；§18.1.3 新增「触发筛选粒度（D16）」同口径说明 |
| D16 / G7（展示映射） | proposal-01:1763 | §12.4 触发方式列说明改为显式映射（manual/schedule/single_op/single_workflow/retry），retry 不叠加 Job 形态前缀 |
| D16 / G7（详情文案） | proposal-01:1791 | §12.5 详情「触发: 虚拟 Job / 单次执行」改为「单次执行 · OP」 |
| 低成本1 / G6 / G-11 | proposal-01:600, 725, 2822 | §9.2 `timeoutSeconds` 改「整数，1 ≤ x ≤ 86400，默认 60，**必填**，0/负/非整数 400」；§9.4 新建说明改为「超时预填 60（范围 1..86400，必填）」；§19.8「超时空」改「超时 = 60（默认值预填，必填，范围 1..86400）」 |
| G-11（§19.8 Client） | proposal-01:2821 | §19.8 Client（Prompt）「输入方式 arg / 输出解析 mode json」标注「**前端预填建议值，非后端默认**」 |
| D17 / G-5 | proposal-01:1656-1657 | §12.3 JobRun `retryFromStepId` 改名 `retryFromRecordId`（语义 = 源失败/超时 StepRecord 主键 `step_records.record_id`；仅 retry 写、rerun 不写） |
| M1 / D11 / L9（§8.9） | proposal-01:536 | 重写 §8.9「导入校验约定」：删除「校验通过后才提交」自相矛盾表述，统一为「[导入] 提交 → 后端包完整性校验 → 400」；「不一致位置」载体固定为 `message` 文本、前端原样展示，格式 `名称锚不一致：manifest.<锚字段>=<值>，<包内路径> 内 name=<值>`；示例换中性（deploy_prod） |
| M2 / D10（§8.9） | proposal-01:536 | 名称锚显式枚举四项：① `manifest.workflow.name` ② `manifest.target.name` ③ `manifest.job.name` ④ `manifest.ops[].name`（各 ↔ 包内对应文件 `name`） |
| M3 / D10（§8.9） | proposal-01:536 | 注明「`file` / `target.file` 仅作包内定位，**不校验文件名与 `name` 一致**（只校验文件内容 `name`）」 |
| M8（编号） | proposal-01:536, 2923, 2950 | §8.9 标签 `#8` 改为具名「决策-导入名称锚一致性」；§20.1 把 `#1..#8` 登记为「各 crud 内局部审查条目号，不可跨文件引用」；新增「同文件引用可省略出处」句 |
| G16 / 低成本2 | proposal-01:144-145, 536 | §4.2 Client/OP 导入项明确「文件大小阈值（字节），默认 1 MiB，范围 1024..104857600」；§8.9 补前端体积校验行（`file.size ≤ settings.<client\|op>_import_max_bytes`，超限提示并保持 [导入] 禁用） |
| G15 | proposal-01:147 | §4.2 运行历史行重写：区分 waiting 深度上限（20/1000）、running 深度上限（10/10）、单 Job 保留条数（10）、整体保留条数（1000）、单条保存时长（180 天硬上限） |
| L9 | proposal-01:154 | §4.2 标识规则改为：🔄 不作独立徽标，但**可在该项 desc 末尾附「（🔄）」标记说明** |
| G17 | proposal-01:388-391, 458 | §8.4 新增「变量注入约定」：脚本类以环境变量注入（`AI_<入参大写>` / `AI_WORKSPACE`，出参 `AI_OUT_<name>`）；prompt 类 `OP.content` 支持 `{{name}}`/`{{workspace}}`，仅限 OP.content 不适用于 Client `argsTemplate`；§8.6 禁令括注补「OP.content 的 {{workspace}} 不受此限，见 §8.4」 |
| L7 | proposal-01:506 | §8.8 新增「测试对话框「参数」取值」：= `argsTemplate` 占位符替换示例值的结果，`stdin` 追加固定测试提示词 |
| G8 | proposal-01:2463, 2468 | §16.1 UC-C1 改为「[保存] → 列表点 [编辑] → [测试命令] 验证」；UC-C6 删「可先点」，注明 [测试命令] 仅对已保存 Client 可用 |
| G3 | proposal-01:1046-1047, 1071, 1857-1858, 2740 | Workflow 出参去类型括号：§10.8 示例 `deploy_url` / `status`；§12.6 出参表 `deploy_url` / `status`；§10.8 注与 §19.3 改为「入参=参数名(类型)，出参=参数名（Workflow 出参无 type，见 §12.6）」 |
| G4 | proposal-01:1828 | §12.6 数据来源「按 opId 匹配」改为「**按 `stepId`（= workflowNodeId）匹配**，同一节点多次执行取 `(activationSeq, retrySeq)` 最大；**不得按 opId 匹配**」 |
| G5 | proposal-01:1818 | §12.5 删「以 check_tests 为静态示例内容，不随 OP 变化」，改为「入参/出参/输出/正文一律取自所查看的那一条 StepRecord（正文取 bodySnapshot），随所选 Run 与执行记录变化」 |
| G9 | proposal-01:1920 | §12.6 节点状态表下新增说明：状态文案以本表为准，**不得复用「等待中」**；未执行/跳过 = Run 结束时无 StepRecord 或 cancelled 之前的 waiting 记录 |
| G10 / L6 | proposal-01:2070-2071, 2075, 1822, 1905, 2616 | §12.10 轮询接口改 `/api/runs/{runId}/status`（首次/手动用完整接口），补「无 running step 自动停止轮询」；§12.5/§12.6 补 [刷新][自动刷新] 说明；§17.5 补两接口差异说明 |
| G11 | proposal-01:1451 | §11.3 表下新增「示例为示意」注（权威夹具见 mock-data.js 的 JOBS/RUNS），避免与 §12.4 同事实自相矛盾（择报告建议 3） |
| G12 | proposal-01:1443 | §11.3 工作区列明确为「**Job.workspace（Job 定义的工作目录）**，非 Run 实际 workspace」 |
| G13 | proposal-01:1141, 1093-1094 | §10.9 出参 `from` 改下拉语义（节点 × 出参，展示「{节点画布名} · {OP 名} · {outputName}」，存 `workflowNodeId.outputName`，不要求手输 UUID）；示例 `node_deploy.url` → `[node_deploy · deploy · url ▾]` |
| G14 | proposal-01:1350（删除） | §10.14 删不可判定的「有多条入边的节点必须有明确汇聚」条（汇聚语义保留在 §10.5） |
| G18 | proposal-01:1365-1368 | §10.14 提示表补 4 条：多个 Start / 多个 End / 连线引用不存在节点 / 节点引用 OP 不存在 |
| G20 | proposal-01:1711, 1795 | §12.3 补「attempt 一律指 retrySeq」；§12.5 执行历史下拉改按 `(activationSeq, retrySeq)` 降序 |
| G2 | proposal-01:1765 | §12.4 操作列说明补「成功 / 等待中 / 运行中 / 终止中 不展示 [重试]」 |
| L3 | proposal-01:2026 | §12.8.5 重跑前提补「且 **target 仍存在（OP / Workflow 未被删除）**」，与 §12.4 注一致 |
| L4 | proposal-01:1408 | §11.2 说明补：`nextRunAtMs` 为计算字段（不落库），仅供接口消费，**界面不展示** |
| L5 | proposal-01:1745 | §12.4 版本筛选改「按现有 Job 修订号动态生成（纯数字）」 |
| L8 | proposal-01:2839 | §19 新增「### 19.10 设置界面（settings.html）」（左侧 10 组分组导航 + 右侧表单；只读项不可编辑；[保存] `PUT /api/settings`、[恢复默认] `POST /api/settings/reset`） |
| L10 | proposal-01:1313-1315 | §10.13 ZIP 树成员序改为 `workflow.yaml` → `manifest.json` → `ops/`，与声明一致 |
| L11 | proposal-01:1763 | §12.4 触发方式映射中 `retry` 展示为「重试」（不叠加 Job 形态前缀，避免 virtual Run 误标） |
| L12 | proposal-01:402, 431 | Client 列表 ASCII 表头「输出解析」→「输出解析方式」；§8.5 注同步 |
| L-7（global） | proposal-01:2991 | §21 硬约束 8 改为「**重试要求版本一致（快照版本 = 当前版本）且满足五条件；重跑才固定使用最新版本**」 |
| L-2 / G-10（global） | proposal-01:2923, 2950 | §20.1 增补 `#1..#8` 说明与「同文件引用可省略出处」句 |
| L-1 / T1（global，附带） | proposal-01:1678 | StepRecord `source` 注释钩子名统一为大写 `JOB_COMPLETE` / `STEP_COMPLETE` |

---

## 未修项与原因

### A. 属于「原型图/*」的改动（本任务禁止修改原型，故未落地）
- S2 / D3：`workflow.html:1444` 删「回退 Job.target.clientId」→ 改「未指定（创建时默认选中类型匹配的 Client）」并加必填。
- D2 / S1：`workflow.html` 新建/保存不再要求校验（原型现为 `existing` 才校验，方向已对，但提示语与 [校验] 门控未按 D2 复核）。
- D4 / S3：`workflow.html:1291`（未绑定写法）、`1537-1552`（下拉只需列前置节点出参）、`mock-data.js:1611-1623`（校验判据）。
- D5 / S4：`job.html:893`、`workflow.html:1445`（下拉未按类型过滤）、`job.html:1031`（无类型校验）。
- D6：原型 `mock-data.js` 续跑种子相关。
- D8 / S-1：`mock-data.js:1494/1511-1535`（删 `WF_LOOP_EDGE_CONDITION='on_failure'` 硬编码环判定）。
- D15 / G1：`index.html:868`、`1280`（cancelled 渲染 [重试] 分支与置灰逻辑）。
- D16 / G7：`index.html:243` 文案（现与文档新口径一致，无需改，但口径确认归原型侧）。
- G2：`index.html:868-871`（成功态仍渲染置灰 [重试]）。
- G9：`index.html:1344-1360` 的 `STATUS_MAP` 补齐 `cancelled` / `skipped` 并改未匹配节点为 `skipped`。
- G10 / L6：`index.html` 详情视图加 [自动刷新] 开关与轮询、切视图启停。
- G11：`mock-data.js:503` 等 fixture 数值（文档侧已改「示意」注）。
- G13：`workflow.html:1093-1116` 出参 `<input>` 换 `<select>`。
- G16 / 低成本2：`op.html:1107` 改读配置值、`client.html` 补体积校验。
- G19：`client.html:519/523` 展开行「类型+格式+描述」同行的实现（见 D 项）。
- L1：`index.html:573` `§18.2` 改 `§12.10`。
- L2：`mock-data.js:500` `§10.3` 改 `§11.2/§13.2`。
- L5：`index.html:248` 版本选项动态生成。
- L9：`settings.html:179` desc 的「（🔄）」（文档侧已允许该标记）。
- L10：`tc_x3_multi.zip` 重打包等（属 fixtures）。
- L11：`mock-data.js:52` `retry` 文案。
- 低成本3：SheetJS 打包进 `ui/`、原型改本地库缺失提示。

### B. 属于其它文件（由他组负责；本任务不得改）
- D1：crud-03 4.3.2、`:691`/`:1077`、tests 的 `max+1` 写法。
- D7：crud-04 3.4.6 / 4.5.2。
- D9：crud-01:271/289、tasks.md:180（T6.4）。
- D12：crud-03 3.3.9 / crud-04 3.4.10 / crud-04 3.4.6 / crud-05 3.5.7 / 3.5.8 的校验顺序列表。
- D13：tests 测试环境 / P0 定义、tasks.md 数据源约定。
- D14：crud-06:80、tests 的 `max_loop_multiplier=0` 加注。
- D17：schema.sql 列改名、crud-05 3.5.7/3.5.8 与字段表/样例、`mock-data.js:1317`（proposal-01 侧已改）。
- D18：crud-06:81/348、crud-03:829、tasks.md T9.15。
- 低成本2：crud-06 导入上限键（文档仅引用现有键，未新造）。
- 低成本4：tests「命名说明（拍板）」；低成本5：`tc_x3_multi.zip` 重打包。
- _val2_01_ui：L1/L2（原型）、S/G/L 中原型侧项（见 A）。
- _val2_04_global：S-2、G-1..G-9、L-3/L-4/L-5/L-6/L-8/L-9/L-10/L-11/L-12、P1..P6 中非本文件项。
- _val2_05_new：M4（校验顺序在 crud 各节落地；p01 为界面侧不重复）、M5、M6、M7。

### C. 吸收说明（按报告建议但非拍板项）
- G11：报告给「改示例」或「加示意注」二选一，本组取**加注**（避免破坏 §11.3 ASCII 列对齐、且不与 §12.4 权威夹具对撞）。
- G19：报告给「改原型」或「改文档」二选一。本组判断文档自身自洽（§8.5 ASCII、§16.1 UC-C2、§19.1 均为「类型+格式+描述」同行），冲突仅在原型侧，故**未改文档**，归入 A 项。
- L8：报告建议「新增 19.5.x」，但 §19.6-19.9 已被外部引用（tasks.md 引 §19.6/§19.9 等），重编号会破坏引用，故新增为**下一可用编号 §19.10**（保持既有编号稳定，交叉引用仍指向真实章节）。
- L4：报告给「加列」或「注明不展示」二选一，取**注明不展示**（改动最小）。

---

## 机械自检（命令与结果）

> 说明：本机 `agentgrep` 对含中文文件名的单文件路径不命中，故改用 `python -X utf8` 直接读文件计数（命令内已 `chcp 65001`）。

1) 旧措辞残留（期望全 0）：
```
python -X utf8 -c "s=open('proposal-01-界面设计.md',encoding='utf-8').read();...
  '校验通过后才能保存'=0 | 'DAG 无环'=0 | 'retryFromStepId'=0 | '按 opId 匹配'=0 |
  '成功 / 取消'=0 | '持久 Job·定时'=0 | '可先点 [测试]'=0 | '超时空'=0 | '校验通过后才提交'=0 |
  'manifest 声明'=0 | '未指定（执行时回退'=0 | '单次执行 / 重试'=0 | '输出解析  操作'=0 |
  'from (workflowNodeId'=0 | 'deploy_url (string)'=0 | '虚拟 Job / 单次执行'=0 | '从失败 OP 开始重试'=0"
结果：全部 = 0（0 残留）。
```

2) 新措辞出现（期望 >0，且落在所有应出现处）：
```
unbound=3 | 'D2 定稿'=1 | '参数绑定必须指向前置节点'=1 | 'clientId 非空'=2 |
retryFromRecordId=1 | '续跑语义'=1 | 'target 仍存在'=2 | '19.10 设置界面'=1 |
'重试要求版本一致'=1 | '输出解析方式'=4 | single_workflow=8 | '决策-导入名称锚一致性'=1 |
JOB_COMPLETE=1 | '类型匹配为硬契约'=1 | '变量注入约定'=1 | '触发筛选粒度（D16）'=1 |
'已保存**的 Client 可用'=1 | '不校验「环」'=1 | '从失败 step 开始重试'=2 | '示例为示意'=1
结果：全部命中。
```

3) 交叉引用存在性（§ 引用全部指向真实章节）：
```
python -X utf8 -c "heads=set(re.findall(r'^#{2,4}\s+([0-9]+(?:\.[0-9]+)*)',s,re.M));
                  refs=sorted(set(re.findall(r'§\s*([0-9]+(?:\.[0-9]+)*)',s)));
                  MISSING=[r for r in refs if r not in heads]"
结果：HEADINGS=116, REFS=28, MISSING=['1.1', '15']。
  '1.1' 指向 proposal-02 §1.1（跨文件），'15' 指向中文序号章节（§十五），二者为改前既有（_val2_01_ui 已判「非本档缺陷」）。
  本组新增引用 §4.2 / §8.3 / §8.5 / §8.9 / §9.6 / §10.4 / §10.9 / §10.11 / §11.4 / §12.3 / §12.4 / §12.6 / §12.8 / §12.10 / §17.5 均命中存在章节，0 悬空。
```

4) 行尾（未做整文件换行符转换）：
```
CRLF=0  LF=3104   （改前 LF=3053；净增 51 行，全部沿用 LF）
文件末尾无换行（与改前一致）。
```

---

## 编码/行尾（改后）

- 编码：UTF-8（无 BOM 变更）。
- 行尾：LF（`CRLF=0`），与改前完全一致，未整文件转换；新增行沿用 LF。

---

## 复核补充（本轮二次核验 / delta 修复）

> 背景：本任务被重复派发；上一实例已产出本报告与文件改动。本轮（同组 A）对成品做了**独立复核**，发现并补齐以下 delta，并重跑机械自检确认整体一致。

### 已修项（delta）

| 项号 | 文件:行 | 改法 |
|-|-|-|
| Q3 / D14（_val2_05） | proposal-01:2305, 2310, 2311 | §15.2 明确 `max_loop_multiplier = 0` 语义：**不施加绝对上限、仍受 `max × 3` 约束**（不是无限）；「执行上限」行改为「`=0` 时 = `max × 3`，否则 `min(max × 3, max_loop_multiplier)`」 |
| D14（收口） | proposal-01:2990, 3082 | §21 硬约束 7 与「超时与循环规范」补注「`max_loop_multiplier = 0` 时不施加绝对上限、仍受 `max × 3` 约束，见 §15.2」 |
| D4（术语收口） | proposal-01:958, 2878, 2882, 2988 | 参数绑定来源术语统一为「**前置节点**」：§10.4 表左列「任意前置节点」→「前置节点的出参」；§20 决策表两行、§21 硬约束 5 的「任意前置节点」改为「前置节点（仅从 Start 可达且位于本节点之前）」，并把「未绑定」标注为 `unbound` |

### 机械自检（本轮，读文件计数）

```
chcp 65001 & python -X utf8 -c "...'任意前置节点' ... "
旧措辞（期望 0）：
  '校验通过后才能保存'=0 'DAG 无环'=0 'retryFromStepId'=0 '按 opId 匹配'=0
  '成功 / 取消'=0 '持久 Job·定时'=0 '可先点 [测试]'=0 '超时空'=0 '校验通过后才提交'=0
  'from (workflowNodeId'=0 'deploy_url (string)'=0 '虚拟 Job / 单次执行'=0
  '从失败 OP 开始重试'=0 '回退 Job.target.clientId'=0 '任意前置节点'=0
新措辞（期望 >0）：
  '不施加绝对上限'=4 'max_loop_multiplier = 0'=4 '前置节点出参'=3 'unbound'=5
  '续跑语义'=1 'D2 定稿'=1 '参数绑定必须指向前置节点'=1 'clientId 非空'=2
  'retryFromRecordId'=1 'target 仍存在'=2 '19.10 设置界面'=1 '重试要求版本一致'=1
  '决策-导入名称锚一致性'=1 '类型匹配为硬契约'=1 '变量注入约定'=1 '触发筛选粒度'=1
交叉引用：HEADINGS=116, REFS=28, MISSING=['1.1','15']（均为改前既有：§1.1 指向 proposal-02、§15 指向中文序号章节）
行尾：CRLF=0 / LF=3104，末尾无换行（与改前一致，未做整文件转换）
```

结论：全部旧措辞 0 残留、新措辞均出现，交叉引用 0 新增悬空，行尾保持不变。

### 未落地项（与上文一致，无新增）
- 原型侧（`原型图/*`）与其它文件（crud-03/04/05/06、schema.sql、tasks.md、tests）项不在本组可改范围，见上文「未修项与原因」A/B 两节。
- G19（Client 行内展开「类型+格式+描述」同行）：文档侧（§8.5 ASCII / §16.1 UC-C2 / §19.1）本身自洽，差异仅在原型 `client.html:519/523`，归 A 项。

