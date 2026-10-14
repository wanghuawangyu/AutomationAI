# 原型图独立校验报告（第 3 轮 · 原型 04）

- 角色：独立校验员（第 2 轮 / 组 04）。**只读**：未修改 `原型图/**` 任何文件；本轮仅新增本报告 `_val3_04_proto.md`；探针脚本全部放在 `%TEMP%\jcv3_proto\`（含修复前快照 `pre/`）。
- 校验范围：`docs/cli非交互式/原型图/**`（`client.html` / `index.html` / `job.html` / `mock-data.js` / `op.html` / `settings.html` / `workflow.html` / `workflow-canvas.css` / `workflow-canvas.js` / 新增 `xlsx-lite.js`）。
- 口径参照：`_fix_v2_decisions.md`（含「补充拍板」）、`proposal-01-界面设计.md`；对错误码/字段契约的引用另外核对了 `proposal-02-后端crud-0x`（因 decisions 与 F 报告本身即以 crud-0x 条款号为准）。
- 被校验对象：`_fix_v2_F_proto.md`（组 F 声称的 D3/D4/D5/D15/D7+G9/D16/D8/G6/G14/G16/G17/G18/G19/G20/L1/L2/L5/L10/L11/L-9 与 D17）。
- 方法：**不看 F 的结论，全部自建探针重跑**（jsdom 真实加载 6 页 + 直接调用页面/`mock-data.js` 内部函数），并对每一项做**正向 + 负向对照**（负向 = `git show HEAD:` 导出的修复前整目录 `pre/`，同一探针复现原症状）。
- 行号口径：除特别标注外，均为**当前工作区**（修复后）行号。

## 统计

| 分档 | 数量 | 编号 |
|-|-|-|
| 严重 | 3 | S1 D5 错误码未落地 · S2 Job 编辑器回填 Client 回归 · S3 画布节点三态口径未收敛 |
| 一般 | 6 | M1 D4 缺「从 Start 可达」过滤 · M2 D4 环路下游被当「前置」 · M3 未执行边不再虚线 · M4 D16 标签偏离文档 · M5 L1 未落地 · M6 超时「非整数」被静默截断 |
| 轻微 | 9 | m1–m9 |
| 需拍板 | 6 | P1–P6 |
| R1 声称项核验 | 31 行 | ✅ 落地 21 · ⚠️ 部分落地 8（D4 下拉、D4 绑定前置、D5 错误码、D7/G9、D16、G6、G16、L10） · **❌ 声称已修但未落地 1（L1）** · ➖ 无实义/不在范围 1（G20） |

一句话结论：**F 组本轮大部分修复真实存在且可用（D3/D4 主体、D8、D15/G2、D17、L5、L10、L-9 等经复现确认），但 3 项直接影响可用性/契约：D5 的错误码与拍板冲突、Job 编辑器编辑既有 OP 目标 Job 时 Client 丢失导致无法保存、画布「未执行/等待中」在非终态 Run 上判定错误。另 L1 在报告中声称已修，实际未改。**

---

## R1 修复核对表

结论标记：✅ 落地（自测复现通过） · ⚠️ 部分落地 · ❌ 声称已修但未落地 · ➖ 无实义/不在范围。

| 项 | F 声称 | 核验结论 | 我的复现证据（探针键值） |
|-|-|-|-|
| D3 拖拽默认 Client | `workflow.html:1457` 删除回退措辞；`createNode` 默认选中该 OP 类型 `createdAtMs` 最早 Client | ✅ | `D3_createNode_check_tests=a1b2…(Claude Code/prompt)`、`health_check=c3d4…(本地 Bash)`、`process_data=d4e5…(本地 Python)`、`clean_logs=e5f6…(本地 PowerShell)`；负向（pre）`clientId=null` |
| D3 clientId 必填 | 前端保存拦截 + `POST/PUT /api/workflows` 校验 | ✅ | `D3_doSave_alert="OP 节点必须指定 Client"`；`D3_POST_wf_missing_client=VALIDATION_ERROR :: OP 节点必须指定 Client（节点 node_n1）`、`D3_PUT_wf_missing_client` 同；负向 `undefined`（无此校验） |
| D3 删「回退 Job.target.clientId」 | 0 残留 | ✅ | 全目录 grep `回退 Job` = 0；`workflow.html:1457` 现为「— 未指定（创建时默认选中类型匹配的 Client）—」 |
| D4 未绑定初值 | 拖拽创建入参置 `unbound` | ✅ | `D4_createNode_binding_kind={"endpoint":{"kind":"unbound"}}`、面板 `D4_panel_radio_state="[*]未绑定,…"`；负向 `kind="literal"` |
| D4 出参下拉只列前置 | 反向可达集 | ⚠️ | 内置图正确（`D4_opts_node_check=""`、`notify` 只含 check/review/deploy 出参）；**但环路/孤岛两例越界**（见 M1/M2） |
| D4 空必填被拦截 | required 无来源判据 | ✅ | `D4_missing_binding`/`D4_unbound`/`D4_empty_literal` 三种均报「没有来源」；负向只报第一种 |
| D4 绑定必须指向前置 | 新增规则 | ⚠️ | `D4_bind_downstream_B_to_C="节点 node_B 的入参 target_env 绑定了非前置节点 node_C 的出参"`；但 `D4_loop_back_B_binds_C=[]`（环路下放行，见 M2） |
| D5 下拉按类型过滤 | 节点面板 / Job 编辑器 | ✅ | `D5_panel_client_options="— 未指定（创建时默认选中类型匹配的 Client）— \| 本地 PowerShell"`（clean_logs/powershell）；`D5_job_options_health="…本地 Bash"`；空下拉提示 `请先在 Client 管理中创建 probe_type 类型的 Client` |
| D5 类型不符 → 400 | 声称 `400 VALIDATION_ERROR` | ⚠️/口径错 | 四处均 `VALIDATION_ERROR`：`D5_POST_jobs_mismatch`/`D5_PUT_jobs_mismatch`/`D5_POST_wf_mismatch`/`D5_PUT_wf_mismatch`；拍板要求 `CLIENT_TYPE_MISMATCH`（**S1**） |
| D5 夹具类型自洽 | 4 个 Workflow 全 valid | ✅ | `VALIDATE_deploy_workflow/log_analysis/code_review/hourly_check = true []`（负向也 true，属数据修正而非规则修正） |
| D15 cancelled 可重试 | 列表 + 详情 | ✅ | 注入 cancelled Run：`D15_cancelled_row_buttons="重试+重跑"`、`D15_cancelled_head_buttons="重试+重跑"`；负向 `D15_success_row_has_retry=true`（G2 症状） |
| G2 成功 Run 无 [重试] | 仅 [重跑] | ✅ | `D15_row_success_run008="重跑"` |
| D7/G9 三态 | waiting/skipped/cancelled 分离 | ⚠️ | `STATUS_MAP` 新增两项存在；**但非终态 Run 被误标未执行**（S3）、End 分支被覆盖（m1）、虚线边未同步（M3）；夹具无 cancelled Run/step（m4） |
| D16 触发筛选 5 值 | 值 5 个 + 标签统一 | ⚠️ | `D16_trigger_values=",manual,schedule,single_op,single_workflow,retry"` ✅；但标签改成了 §12.4「展示映射」写法，与 §12.4 筛选表 `proposal-01:1742` 不符（M4）。**注**：修复前 `index.html:243` 的值本来已是 5 个（`git show HEAD` 同值），F 报告中的「merge 变体」负向是自造的，未复现真实症状 |
| D8 允许环路 | 删除环判定 | ✅ | `D8_cycle_valid=true` / `D8_cycle_errors=[]`；负向 `false` + `DAG 存在环 node_A → node_B → node_C → node_A（回跳请用 on_failure 条件边 + 重试）`；`WF_LOOP_EDGE_CONDITION`/`__findWfCycle` 0 残留 |
| D8 回跳示例用 always | 注释对齐 | ✅ | `mock-data.js:387` 注明「失败分支（普通条件边，非回跳边）；回跳边示例统一用 always（proposal-01 §15.3）」 |
| G14 删除「汇聚」规则 | 规则表已无 | ✅ | 校验清单 12 项无 converge（`D8_WF_CHECK_RULES`）；仅 `mock-data.js:1493` 说明注释保留该词 |
| G6 timeout | 预填 60 + 1..86400 校验 | ⚠️ | `OP_new_timeout_prefill="60"`、`OP_timeout_empty/zero/negative/too_big/trailing_junk` 全部拦截、`OP_edit_timeout_value="300"` ✅；**但 `1.5` 被接受并截断为 1**（M6） |
| G16 导入上限取配置项 | OP + Client | ⚠️ | 前端：`OP_import_over_limit_alert=…超过上限 op_import_max_bytes（2048 字节）`（改配置为 2048 后生效）、Client 同；边界 `OP_import_at_limit_*` 放行 ✅；**但 mock 服务端未实现该 400**（m9） |
| G17 占位符提示 | 脚本示例 + 提示 | ✅ | `mock-data.js:293` `curl -sf "$AI_ENDPOINT/health"`；`OP_hint_default_prompt="prompt 模板：支持 {{name}} 引用本 OP 入参、{{workspace}} 引用工作区（见 proposal-01 §8.4）"` |
| G18 校验文案对齐 | 移除环文案 | ✅ | `wfErrRuleKey('DAG 存在环…')=""`；`client/client_type/binding_pred` 映射齐全 |
| G19 行内展开首行 | 类型+格式+描述 | ✅ | `G19_detail_cells="类型\|prompt\|格式\|json\|描述\|Claude Code CLI"`；列数一致（`G19_detail_colspans="6:1/1/1/1/1/1 , 2:1/5 …"`，6 列自洽，无错列） |
| G20 | 保持 | ➖ | 原型本已 `(a{n}/r{n})`；文档侧项 |
| L1 §18.2→§12.10 | 声称「scan 无 §18.2」 | ❌ | `index.html:573` 仍为 `…proposal-01 §18.2 D1 定稿`；`proposal-01` 无 §18.2（只有 18.0.x/18.1），**悬空引用**（M5） |
| L2 注释 §10.3 | 改 §11.2/§13.2 | ✅ | `mock-data.js:500` 现引 `§11.2 / §13.2`，两节均存在（p01:1378/2144） |
| L5 版本筛选动态 | 由 Run 集合生成 | ✅ | 篡改 run-009 `jobVersion=7` 后：`L5_version_after_mutate=",1,2,3,7"`（修复前硬编码 1/2/3） |
| L10 导出树顺序 | workflow.yaml→manifest→ops / job.yaml→manifest | ⚠️ | JS 已对：`workflow.html:2019-2027`、`job.html:1115-1128`；**静态占位 HTML 未同步**（`workflow.html:559-566`、`job.html:484-491` 仍 manifest 在前，m5） |
| L11 retry 文案 | 「持久 Job / 重试」→「重试」 | ✅ | `L11_triggerTextOf_retry="重试"`；负向 `"持久 Job / 重试"` |
| L-9 去 CDN | 本地 `xlsx-lite.js` | ✅ | 全目录 `https://`/`cdn` 0 命中（仅 OOXML 命名空间 `http://schemas…`）；6 页 `script[src]` = 本地；导出 33793 字节 .xlsx：6 个 ZIP 条目 CRC 全对、EOCD/中央目录偏移正确、6 个 OOXML 部件齐全、`[Content_Types]` 2 个 worksheet override、两张表名正确、XML 经真解析器 0 错误、JSON 单元格转义后往返一致；负向 `jsdomError: Could not load script: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"` |
| D17 `retry_from_record_id` | 改名 + 取值 = recordId | ✅ | `retryFromStepId` 0 残留；`D17_runs_have_recordid=true`；`D17_spawnRun_retryFromRecordId="step-004"` = `D17_source_failed_recordId`；`rerun` 不写（`null/null`）；负向 `undefined` |
| （顺带）D2 草稿可保存 | 保存不再要求拓扑校验 | ✅ | 未绑定 required 的图保存成功（`D2_save_draft_created=true`，`D2_saved_workflow_validate={valid:false,…没有来源}`）；类型不符仍拦截（`D5_save_mismatch_created=false`） |

---

## 严重

### S1【严重】D5 错误码未按拍板落地：四处返回 `VALIDATION_ERROR`，应为 `400 CLIENT_TYPE_MISMATCH`

**原文引用**

- `mock-data.js:1734-1735`（POST /api/workflows）
  ```js
  wCreateErrs = wCreateErrs.concat(__wfNodeClientErrs(body));   // D3/D5：OP 节点 clientId 必填 + 类型匹配
  if (wCreateErrs.length) return resolve(__err('VALIDATION_ERROR', wCreateErrs.join('；')));
  ```
- `mock-data.js:1972-1973`（PUT /api/workflows）：`if (wfUpdClientErrs.length) return resolve(__err('VALIDATION_ERROR', wfUpdClientErrs.join('；')));`
- `mock-data.js:1756-1759`（POST /api/jobs）
  ```js
  var newJobMm = __clientTypeMismatch(OP_BY_ID[body.target.opId], CLIENT_BY_ID[body.target.clientId]);
  if (newJobMm) newJobErrs.push(newJobMm);
  ...
  if (newJobErrs.length) return resolve(__err('VALIDATION_ERROR', newJobErrs.join('；')));
  ```
- `mock-data.js:2018-2020`（PUT /api/jobs）：`if (jobUpdMm) return resolve(__err('VALIDATION_ERROR', jobUpdMm));`
- 全文件 `CLIENT_TYPE_MISMATCH` 命中 **0** 次。

**权威口径**
- `_fix_v2_decisions.md:73`：「**D5 错误码**：…**裁定采用 `400 CLIENT_TYPE_MISMATCH`**（而非 VALIDATION_ERROR），message 固定串不变。已同步 `proposal-01:376`」。
- `proposal-01:376`：「不一致 → 400 `CLIENT_TYPE_MISMATCH`」；`crud-03:122`（规则 11）/`:257`/`:281`/`:365`/`:529`；`crud-04:224`/`:254`/`:308`/`:540` 均为 `CLIENT_TYPE_MISMATCH`。
- 另：`crud-03:122` 要求 `message` **固定为** `Client 类型与 OP 类型不匹配：OP <opName> 为 <opType>，Client <clientName> 为 <clientType>`；而 `mock-data.js:1619`（`__wfNodeClientErrs` 内 `if (mm) errs.push('节点 ' + lbl + '：' + mm);`）**加了「节点 X：」前缀**，Workflow 路径下 message 也不再等于固定串（本项与错误码一并修）。

**复现证据（自测）**
```
D5_POST_jobs_mismatch = "VALIDATION_ERROR :: Client 类型与 OP 类型不匹配：OP health_check 为 bash，Client Claude Code 为 prompt"
D5_PUT_jobs_mismatch  = {"code":"VALIDATION_ERROR","message":"Client 类型与 OP 类型不匹配：…"}
D5_POST_wf_mismatch   = "VALIDATION_ERROR :: 节点 node_n1：Client 类型与 OP 类型不匹配：…"
D5_PUT_wf_mismatch    = {"code":"VALIDATION_ERROR","message":"节点 node_n1：Client 类型与 OP 类型不匹配：…"}
（负向 pre：`undefined :: undefined`，即修复前根本不报错 → 本轮确实加了校验，只是错误码错了）
```

**建议改法**
1. `__wfNodeClientErrs` 返回**结构化**结果（`{code, message}` 数组或 `{missing:[], mismatch:[]}`），调用方分流：
   - clientId 缺失（crud-03 规则 10）→ `VALIDATION_ERROR`（含节点标识，可保留）；
   - 类型不匹配（规则 11）→ `CLIENT_TYPE_MISMATCH`，`message` **严格等于** `'Client 类型与 OP 类型不匹配：OP ' + op.name + ' 为 ' + op.type + '，Client ' + client.name + ' 为 ' + client.type`（去掉「节点 X：」前缀）。
2. `POST/PUT /api/jobs`、`POST/PUT /api/workflows` 四处：命中 mismatch 时**先于**其它校验直接 `return resolve(__err('CLIENT_TYPE_MISMATCH', mm))`，不要与 `name/trigger/workspace` 错误用「；」合并（否则 message 又不是固定串）。
3. 修完把 `proposal-02 §10.1` 总表口径在原型注释里写明（`mock-data.js` 内 error code 注释）。

---

### S2【严重】Job 编辑器：编辑既有「target=OP」的 Job 时，Client 选择丢失 → 无法保存（修复引入的回归）

**原文引用**

- `job.html:894-895`（`initSelects`，D5 改动）
  ```js
  document.getElementById('clientSelect').innerHTML = '<option value="">— 请选择 Client —</option>' +
    '';   // D5：Client 下拉按所选 OP 类型过滤（在 onOpSelected 中重建），此处不预填全部 Client
  ```
- `job.html:837-841`（编辑回填）
  ```js
  document.getElementById('opSelect').value = (jobDef.target.opId) || '';
  document.getElementById('clientSelect').value = (jobDef.target.clientId) || '';   // ← 此刻下拉里只有占位项，赋值无效
  onOpSelected();
  ```
- `job.html:906-913`（`refreshClientOptions`）：`var keep = (keepValue != null) ? keepValue : sel.value;` —— `onOpSelected()` 未传 `keepValue`，于是 `keep` 取到的已是上一步失败赋值后的空串，保存的 clientId 被丢弃。

**复现证据（自测，同一探针跑两遍）**
```
当前：JOB_edit_daily_cleanup = selected=""  expected="e5f6…"  match=false  options=— 请选择 Client —/本地 PowerShell
当前：JOB_edit_weekly_report = selected=""  expected="d4e5…"  match=false
当前：JOB_edit_validate       = "请选择 Client（target=OP 时必选）"     ← 保存被拦
修复前：JOB_edit_daily_cleanup = selected="e5f6…"  match=true   options=…/Claude Code/Codex CLI/本地 Bash/本地 Python/本地 PowerShell
修复前：JOB_edit_validate      = ""
```
副作用：`data_sync` 恰好 `match=true`，只是因为上一次打开（`weekly_report`，同为 python）残留的选项还在 —— **顺序/状态相关的幽灵行为**，更危险。

**为什么是问题**：`proposal-01:33`「Job target 为单个 OP 时，创建 Job 时必须选择一个 Client」；`crud-04:254` 更新入口同样校验。编辑既有 OP 目标 Job 是**唯一**修改其 Client 的入口，现在打开即「未选择」，用户必须每次重选（且界面不回显原值，易误配成另一个同类 Client）。复制（`openEditor(name, kind, copyFromName)`）走同一分支，同样丢失。

**建议改法**（任选，推荐 1）
```js
// 1) 先把保存值取出，重建选项后再回填
document.getElementById('opSelect').value = (jobDef.target.opId) || '';
var srcClientId = (jobDef.target.clientId) || '';
refreshClientOptions(OP_BY_ID[jobDef.target.opId] || null, srcClientId);   // 按类型重建 + 保留原值
onOpSelected();                                                            // 仍负责带出入参
// 2) 或最小改动：把 onOpSelected() 提到赋值之前
onOpSelected();
document.getElementById('clientSelect').value = (jobDef.target.clientId) || '';
```
修后补断言：`openEditor('daily_cleanup')` → `clientSelect.value === JOB_BY_NAME['daily_cleanup'].target.clientId` 且 `validateJobForm() === ''`。
（顺带清理 `job.html:894-895` 末尾 `+ ''` 空拼接。）

---

### S3【严重】画布节点「未执行 / 等待中」判定与 `proposal-01:1920` 不符（非终态 Run 误标「未执行」；终态 cancelled 的 waiting 记录未归「未执行」）

**原文引用**

- `index.html:1199-1213`（`openWfDetail` 构建节点状态，**未判 Run 是否终态**）
  ```js
  } else if (n.kind === 'end') {
    if (run.status === 'success') currentWfNodes[workflowNodeId].status = 'success';
    else currentWfNodes[workflowNodeId].status = 'skipped';   // D7/G9：未到达的 End = 未执行（不再显示「等待中」）
  } else {
    var matched = lastRecordOf(run, workflowNodeId);
    if (matched) {
      currentWfNodes[workflowNodeId].status = matched.status;   // ← matched.status='waiting' 时原样透传
      ...
    } else {
      currentWfNodes[workflowNodeId].status = 'skipped';   // D7/G9：Run 结束时无 StepRecord 的 OP 节点 = 未执行
    }
  }
  ```
- 口径：`proposal-01:1918`「| 未执行 / 跳过 | ⚪ 灰框 | ⊘ |」＋ `proposal-01:1920`「说明：节点状态文案以本表为准，**不得复用「等待中」**（「等待中」仅用于 Run 自身非终态时的 running step）；**未执行 / 跳过** = **Run 结束时**该节点无 StepRecord，**或最终记录为 cancelled 之前的 waiting 记录**」。
- 注释自称「Run 结束时」，代码却对任何 `run.status` 生效 → 注释与实现不一致。

**复现证据（自测，真实夹具）**
```
run-010（status=running）  : check_tests:✓ 成功  review:● 运行中  deploy:◌ 等待中  notify:⊘ 未执行[st-skip]  notify_fail:⊘ 未执行[st-skip]  End:未到达
run-011（status=terminating）: deploy:⊘ 未执行[st-skip]  notify:⊘ 未执行  notify_fail:⊘ 未执行
run-002（status=failed，终态）: notify:⊘ 未执行  → 正确
注入 cancelled Run（steps: …deploy=waiting）: deploy:◌ 等待中[st-wait]   ← 应为「⊘ 未执行」（p01:1920 后半句）
修复前（pre）run-010: notify:◌ 等待中  notify_fail:◌ 等待中  → 说明「非终态显示等待中」是修复前既有正确行为，本轮被改坏
```

**建议改法**
```js
var RUN_TERMINAL = { success:1, failed:1, timeout:1, cancelled:1 };
var terminal = !!RUN_TERMINAL[run.status];
...
if (n.kind === 'end') {
  currentWfNodes[workflowNodeId].status = (run.status === 'success') ? 'success'
    : (terminal ? 'skipped' : 'waiting');     // 非终态仍「未到达/等待」
} else {
  var matched = lastRecordOf(run, workflowNodeId);
  if (matched) {
    var st = matched.status;
    if (terminal && st === 'waiting') st = 'skipped';   // p01:1920：cancelled 之前的 waiting 记录 → 未执行
    currentWfNodes[workflowNodeId].status = st;
    ...
  } else {
    currentWfNodes[workflowNodeId].status = terminal ? 'skipped' : 'waiting';
  }
}
```
（`EdgeDashed` 同步，见 M3。）

---

## 一般

### M1【一般】D4「出参下拉/绑定校验」缺「从 Start 可达」条件（孤立节点出参可选、校验放行）

**原文引用**
- `workflow.html:1565-1569`：`/* D4：只列「从 Start 可达且位于当前节点之前」的节点出参（前置节点 = 反向可达集） */` + `if (!predIds[nid]) return;   // 仅前置节点`
- `workflow.html:1584-1601`：`wfPredecessorIds` 只做**沿入边反向可达**，没有 Start 可达性过滤。
- `mock-data.js:1595-1596`：`predOf[n.workflowNodeId] = __reachableSet(n.workflowNodeId, rev);` 同样只做反向可达。
- 口径：`proposal-01:1348`「来源仅限**从 Start 可达**且位于当前节点之前的节点（D4）」；`crud-03:125`（规则 14）同。

**复现证据**：造 `s→A→B→C→e` 并加孤立节点 `X`（`X→B`，X 不可从 Start 到达）
```
D4_island_predOf_B    = "check_tests,node_start,process_data"     → 含 X（X 不可达）
D4_island_opts_B      = "A.passed | A.count | A.result | X.count"  → 下拉可选孤立节点 X 的出参
D4_island_bind_rejected = []                                       → 校验只报「节点 node_X 从 Start 不可达」(规则 7)，绑定本身放行
```

**建议改法**：两处都在反向可达集上再交一次「从 Start 可达」集合：
```js
// workflow.html wfPredecessorIds
var reachFromStart = /* 沿出边从 start 正向可达集 */;
... 返回 seen 时过滤 if (!reachFromStart[p]) skip
// mock-data.js
var predOf = __reachableSet(nodeId, rev); 交集 reach（reach 已在 1580 行算好）
Object.keys(predOf).forEach(k => { if (!reach[k]) delete predOf[k]; });
```

### M2【一般】D4 有回跳边时「下游节点」被当成前置节点（下拉可选中、校验放行）

**原文引用**：同 M1 的两处（反向可达集）。`proposal-01:1348` / `crud-03:125` 要求「位于当前位置**之前**」。

**复现证据**：`s→A→B→C→e` 外加回跳边 `C→A`（`condition:'on_success'`，即 D8 允许的环）
```
D4_loop_predOf_B   = "check_tests,node_start,process_data"    ← C（B 的下游）被判为前置
D4_loop_opts_B     = "A.passed | A.count | A.result | C.count"  ← 面板里可把 B 的参数绑到 C 的出参
D4_loop_back_edge_valid = true ; D4_loop_back_B_binds_C = []    ← 校验也放行
```
这直接打穿了 F 报告的自证断言「下拉不出现在下游 fail 节点」（其夹具无真环，故未暴露）。运行期后果：首次迭代 C 尚未执行，B 的参数没有可用值（Engine 行为未定义）。
**建议改法**：把判据从「反向可达」改成「**沿非回跳边的拓扑序**」——可行做法：先按 `rev` 求可达集，再剔除「从当前节点正向可达」的节点（环上互相可达即被剔除）：
```js
var fwd = __reachableSet(nodeId, adj);         // mock 已有 adj；UI 同理用正向邻接
Object.keys(pred).forEach(k => { if (fwd[k]) delete pred[k]; });   // 环内互达者不算前置
```
**待拍板 P1**：若产品认为「环内回跳源允许引用上一轮结果」，则要显式写进 `proposal-01 §10.4/§15.3`，否则按本建议修。

### M3【一般】G9 连带回归：指向「未执行」节点的边不再是灰色虚线

**原文引用**
- `index.html:1391-1393`：`edgeDashed: function (edge, to) { return (to.status === 'waiting'); }`
- `workflow-canvas.js:19`（契约注释）：`*     edgeDashed(edge, toNode) -> bool,        // 边是否灰色虚线（未执行）`；`:119` `if (dashed) path.setAttribute('stroke-dasharray', '5 4');`
- 文档示例：`proposal-01:1867/1874` 未执行的边标注「(未执行)」。

**复现证据**（同探针 pre/后各跑一次，统计 `stroke-dasharray="5 4"` 的边）
```
run-010(running)：修复前 dashed=5 → 修复后 dashed=1
run-002(failed，终态)：修复前 dashed=3 → 修复后 dashed=0     ← 终态 Run 的「未执行」边也丢了虚线
run-008(success)：0 → 0（对照）
```
**建议改法**：`edgeDashed: function (edge, to) { return to.status === 'waiting' || to.status === 'skipped'; }`（`to.status === 'skipped'` 即未执行；与 S3 修好后语义一致）。

### M4【一般】D16 触发筛选「值」正确，但「标签」偏离 §12.4 筛选表口径

**原文引用**：`index.html:243`
```html
<option value="manual">持久 Job · 手动</option><option value="schedule">持久 Job · 定时</option><option value="single_op">单次执行 · OP</option><option value="single_workflow">单次执行 · Workflow</option><option value="retry">重试</option>
```
- 文档筛选表 `proposal-01:1742`：「`| 触发 | 全部 / 手动（manual） / 定时（schedule） / 单次执行·OP（single_op） / 单次执行·Workflow（single_workflow） / 重试（retry） | …`」→ 筛选项标签**不带** Job 形态前缀。
- 文档列展示映射 `proposal-01:1763`：「manual → `持久 Job / 手动`；…」（用于列表列，且分隔符是 `/`）。原型把展示写法（`·`）搬到了筛选下拉，两头都不等。
- 另：`mock-data.js:47-52 TRIGGER_TEXT` 用的是 `持久 Job / 手动`（`/`），与原型的 `持久 Job · 手动`（`·`）也不自洽。

**建议改法**：筛选下拉恢复文档筛选表口径（`手动 / 定时 / 单次执行·OP / 单次执行·Workflow / 重试`），列表列继续用 `TRIGGER_TEXT`（`:1763` 映射）。值是 5 值无异议（`D16_trigger_values` 通过）。

### M5【一般】L1 未落地：`index.html:573` 仍引用不存在的 `§18.2`（F 报告称「scan 无 §18.2」）

**原文引用**
- `index.html:573`：`// M3/N6：前端轮询间隔经 GET /api/settings 读取（crud-06 3.3 / proposal-01 §18.2 D1 定稿）——`
- `proposal-01` 实际章节：`18.0.1 / 18.0.2 / 18.0.3 / 18.1`（无 18.2）；对应内容在 `proposal-01:2062 ### 12.10 轮询与刷新`。

**复现证据**：`node g.js index.html "18\.[0-9]"` → 1 命中（573 行）；`git diff -U0 index.html` 的 hunk 只覆盖 4/230/240/262/287/336/509/698/788/865/1182/1193/1278/1346/1487 起，**不含 573** —— 该行从未被改。
**建议改法**：`§18.2` → `§12.10`（并顺手核对 `mock-data.js:870`/各页 `§18.1.x` 注释是否都指向存在的条目）。

### M6【一般】G6 失败分支：超时「非整数」被静默截断为整数，未按口径拒绝

**原文引用**：`op.html:881-883`
```js
var toSec = parseInt(document.getElementById('opTimeout').value, 10);
if (!isFinite(toSec) || toSec < 1 || toSec > 86400) { alert('超时必须为 1..86400 之间的整数'); return; }
```
口径：`proposal-01:600`「`timeoutSeconds: number; // …1 ≤ timeoutSeconds ≤ 86400，默认 60，**必填**…，**0/负数/非整数 → 400 VALIDATION_ERROR**」；`crud-02:164/174` 同。

**复现证据**：`OP_timeout_fraction = "alert=[] opCreated=true"`（输入 `1.5` → 视为 1，创建成功）；`2.9`→2 同理。`<input type="number">` 默认 `step=1` 只是 stepMismatch，`value` 仍返回 `"1.5"`，用户可以直接输入。
**建议改法**
```js
var raw = document.getElementById('opTimeout').value;
var toSec = Number(raw);
if (!raw || !Number.isInteger(toSec) || toSec < 1 || toSec > 86400) { alert('超时必须为 1..86400 之间的整数'); return; }
```

---

## 轻微

| # | 位置 | 原文引用 | 问题 | 建议改法 |
|-|-|-|-|-|
| m1 | `index.html:1201` vs `:1377-1379` | `else currentWfNodes[workflowNodeId].status = 'skipped';` / `if (n.kind === 'end') { return n.status === 'success' ? { cls: 'st-success', text: '已到达' } : { cls: 'st-wait', text: '未到达' }; }` | End 的 `'skipped'` 被 `nodeStatus` 覆盖，**该行是死代码**（F 报告称「未到达 End 由 waiting→skipped」实际不生效）。文档 `proposal-01:1929` 要求 End 未到达 = ⚪ 灰框，现渲染为 `st-wait`（同为灰框，视觉可接受），但注释/实现不一致 | 二选一：删掉 1201 行的 status 赋值并注明「End 状态由 nodeStatus 独占渲染」；或让 `nodeStatus` 读 `n.status`（`skipped`→`{st-skip,'⊘ 未执行'}`，`waiting`→`{st-wait,'未到达'}`） |
| m2 | `index.html:1301` | `: '<button class="btn" disabled title="' + (retryInfo.reason \|\| '不满足重试条件') + '">重试</button>');` | 新改动的语句中 title 属性插入**未转义**（同提交的 `:884` 用了 `escText`，自相矛盾）。当前 `reason` 来自 mock 字面量（`mock-data.js:1192-1207`）无注入面，但属历史复发点 | 与 `:884` 一致：`escText(retryInfo.reason \|\| '不满足重试条件')` |
| m3 | `workflow.html:1740-1743` | `{ key: 'client_type', text: 'Client 类型必须与 OP 类型匹配' },` | 原型校验清单有 12 条，其中 `client_type` 在 `proposal-01 §10.14`（p01:1339-1349 共 11 条）**未列**（仅`crud-03:122` 有） | 文档侧补一行（需拍板 P3）；原型侧可加注「补充项，见 crud-03 规则 11」 |
| m4 | `mock-data.js` RUNS/step_records | 全部 Run 状态：`running,success,failed,terminating,success,failed,timeout,success,failed,success,success`；无 `cancelled` Run、无 `cancelled` StepRecord | D15/G9 新增的 `cancelled`/`skipped` 分支在夹具上**不可演示**（`STATUS_MAP.cancelled` 不可达） | 补 1 条 cancelled Run（含 1 条 cancelled StepRecord）与 1 条 waiting StepRecord，使三态自证 |
| m5 | `workflow.html:559-566`、`job.html:484-491` | `├── manifest.json` 在 `workflow.yaml`/`job.yaml` **之前** | L10 只改了 JS 生成的树（`workflow.html:2021`、`job.html:1116`），**静态占位 HTML 未同步**（打开弹窗前的内容，且与文档 `proposal-01:1324` 相反） | 同步静态占位顺序 |
| m6 | `mock-data.js:114/129/144/159/174`（CLIENTS） | `createdAtMs: '1728000000000'` ×5（全相同） | D3「`createdAtMs` 最早的匹配 Client」在同类型多 Client（Claude Code / Codex CLI 均 prompt）下靠**数组顺序**决胜，夹具无法体现判据 | 给示例 Client 不同 `createdAtMs`（如 Codex CLI 更晚），并在 `proposal-01 §8.3` 注明并列时的次序规则 |
| m7 | `workflow.html:1945-1955` vs `mock-data.js:1614-1620` | `return 'OP 节点必须指定 Client';` / `errs.push('OP 节点必须指定 Client（节点 ' + lbl + '）');` | 同一规则前端/后端文案不一致（后端带节点标识、前端不带），用户看到的口径随路径漂移 | 前端补节点标识（`'OP 节点必须指定 Client（节点 ' + n.label + '）'`） |
| m8 | `workflow.html:2024-2027` | `'    ├── check_tests.yaml\n' + '    ├── review.yaml\n' + '    ├── deploy.yaml\n' + '    └── notify.yaml'` | 导出树 `ops/` 成员**硬编码**，对 `hourly_check` / `code_review` 等任何其它 Workflow 都显示错误的成员名（pre-existing，非本轮引入） | 由 `WORKFLOW_BY_NAME[name]` 的节点引用的 OP 名动态生成 |
| m9 | `mock-data.js:1777-1800`、`:1843-1847` | `var ioYaml = (body && body.yaml) \|\| '';`…`timeoutSeconds: isNaN(iopTimeout) ? 60 : iopTimeout,` | 导入路径**无服务端上限校验**（`crud-02:375`：请求体字节数超 `op_import_max_bytes` → 400）且**不校验超范围**（`timeoutSeconds: 99999999` 会入库），与 G16 前端拦截只落一半 | 导入分支加：`if (utf8Len(body.yaml) > cfgMax) return __err('VALIDATION_ERROR', '…超过 op_import_max_bytes…')`；`timeoutSeconds` 超范围同样 400 |

---

## 需拍板

| # | 议题 | 冲突/证据 | 建议 |
|-|-|-|-|
| P1 | D4「位于当前节点之前」在**允许环**（D8）的图里如何定义 | 反向可达 = 把回跳环内的下游节点也算前置（`D4_loop_opts_B` 含 `C.count`），校验同步放行；严格拓扑序则相反 | 二选一定稿：(a) 剔除「从当前节点正向可达」的节点（我的推荐，见 M2）；(b) 明确「环内回跳源可用上一轮结果」并写进 `proposal-01 §15.3` + `crud-03 4.3.0`，原型保持现行为 |
| P2 | 「汇聚」规则是否算文档残留 | 原型与 `proposal-01 §10.14`（p01:1339-1349）已删该条（G14），但 `crud-03:119` 规则 8 仍写「有多条入边的节点必须有明确汇聚」，且 `crud-03:108` 自称与 §10.14「逐条并列」 | 由文档组删 `crud-03:119` 或改写为可判定项；原型不改（现行已与 p01 一致） |
| P3 | `client_type` 校验条目归谁 | 原型清单有，`proposal-01 §10.14` 无（m3） | 文档侧在 §10.14 补一行（D5 已定「校验 Client.type 与 OP.type 一致」） |
| P4 | D16 筛选下拉标签以哪张表为准 | `proposal-01:1742`（筛选表：手动/定时/…）vs `:1763`（列展示映射：持久 Job / 手动） | 建议：筛选 = `:1742` 口径；列表列 = `:1763` 口径（见 M4） |
| P5 | 导入大小上限是否要求 mock 侧也 400 | `crud-02:375` / `crud-01 3.1.8` 要求服务端 400；原型只做了前端拦截（m9） | 若「mock 模拟后端」口径要求完整，则补（成本极低）；否则在 `mock-data.js` 注明「服务端上限校验未模拟」 |
| P6 | 夹具是否必须覆盖 `cancelled` / `waiting` 终态 | m4：D15/G9 新分支在夹具上不可达 | 建议补夹具（同时可让 S3 的正反用例自动化） |

---

## 与同轮其它报告的重叠（供协调者去重）

（收尾时读到同轮已产出的 `_val3_01_ui.md` / `_val3_02_be.md` / `_val3_05_global.md`，逐项比对结果）

| 本报告 | 同轮其它报告 | 关系 |
|-|-|-|
| **S1** D5 错误码 4 处 `VALIDATION_ERROR` | `_val3_01_ui.md`「一般 G1」（`mock-data.js:1735/1759/1973/2020`，0 命中 `CLIENT_TYPE_MISMATCH`） | **同一缺陷**，独立复现一致；本报告额外给出「message 被加『节点 X：』前缀，不等文档固定串」与「不得与其它校验用『；』合并」两条修法要点 |
| **S2** Job 编辑回填 Client 回归 | `_val3_01_ui.md`「严重 S2」（`job.html:891-899/837-841/906-913`） | **同一缺陷**，独立复现一致（两边 jsdom 证据互证）；本报告额外给出「复制路径同样受影响」「`data_sync` 因上一次打开的残留选项而 `match=true` 的顺序相关幽灵行为」 |
| **M5** L1 `index.html:573` §18.2 未落地 | `_val3_01_ui.md`「轻微 L1」 | **同一缺陷**，结论一致（F 报告声称已修=不实）；分档差异：本报告列为「一般」，理由是该行不只是引用错，还挂着「D1 定稿」结论且是全文件唯一说明轮询来源的注释；协调者可合并为一条 |
| S3 / M1 / M2 / M3 / M4 / M6 / m1–m9 | 未见于上述报告 | 本报告新增（画布三态、D4 前置判据、虚线边、D16 标签、超时整数、以及轻微项） |

---

## 修复顺序建议（含自测证据）

**顺序**（先修「影响可用性/契约」再修文案）

1. **S2**（Job 编辑回填）—— 一行级修复，解锁一条主流程；回归断言：`openEditor('daily_cleanup'|'weekly_report')` → `clientSelect.value === job.target.clientId`、`validateJobForm()===''`。
2. **S1**（D5 错误码 + message 固定串）—— 契约类，改动集中在 `__wfNodeClientErrs` 与 4 个 return；断言：四处 mismatch 均返回 `code==='CLIENT_TYPE_MISMATCH'` 且 `message` 与文档固定串逐字相等（无「节点 X：」前缀）。
3. **S3 + M3**（终态判定 + 虚线边）—— 同处修复；断言：`run-010/run-011`（非终态）无 `st-skip`；`run-002`（failed）`notify` = `st-skip`；注入的 cancelled+waiting 记录 = `st-skip`；`run-002` dashed ≥ 1。
4. **M1 / M2**（D4 前置判据，含 P1 定稿）—— 同处修复；断言：孤岛 `X` 不出现在下拉、`X` 绑定被拒；环路下 `C` 不出现在 `B` 的下拉。
5. **M4 / M5 / M6**（标签、悬空引用、超时整数校验）。
6. **m1–m9** 批量清理（含 P2–P6 的文档侧同步）。

**自测证据（本轮实际执行，脚本在 `%TEMP%\jcv3_proto\`）**

1) 语法检查
```
> node --check mock-data.js && node --check xlsx-lite.js && node --check workflow-canvas.js
  mock-data.js: OK    xlsx-lite.js: OK    workflow-canvas.js: OK
```
2) 6 页 jsdom 冒烟（`smoke.js`，采集 window.error / unhandledrejection / jsdomError，等待 900ms）
```
PASS index.html / client.html / op.html / workflow.html / job.html / settings.html
SUMMARY: 6/6 pages clean
```
（交互式探针里出现的 `jsdomError: Not implemented: Window's scrollTo()` 由探针自身触发视图切换引起，非页面缺陷；负向 pre 目录另有 `Could not load script: https://cdn.jsdelivr.net/...` —— 正是 L-9 的原症状。）

3) 负向对照（同一探针跑 `原型图/` 与 `pre/`=HEAD 导出）——共 8 组
```
① D3 默认 Client:        post=a1b2…(Claude Code)      pre=null
② D4 绑定初值:           post=unbound                 pre=literal('')
③ D4 required 来源判据:  post=unbound/空literal 均报错 pre= 均不报错
④ D4 下游绑定:           post=「绑定了非前置节点 node_C 的出参」 pre=无错误
⑤ D8 环路:               post=valid:true              pre=false +「DAG 存在环 node_A → node_B → node_C → node_A…」
⑥ D3/D5 mock 校验:       post=缺 client/类型不符均 400  pre=undefined（不校验）
⑦ Job 编辑回填 (S2):     post=match:false + 保存被拦    pre=match:true + 校验通过
⑧ 画布虚线边 (M3):       post run-010 dashed=1/run-002 dashed=0  pre 5/3
   节点三态 (S3):        post run-010 notify=⊘未执行    pre=◌等待中
⑨ CDN (L-9):             post 无外部加载错误           pre=Could not load script https://cdn.jsdelivr.net/…xlsx.full.min.js
⑩ D17/L11 (mock):        post retryFromRecordId=step-004/「重试」 pre=undefined/「持久 Job / 重试」
```
4) 图构造用例（覆盖 A→B→C + 回边 + 孤岛，见 M1/M2 的键值输出）
5) `.xlsx` 可解析性（`p3_xlsx.js`，自写 ZIP 解析 + jsdom DOMParser 验 XML）
```
entries = [Content_Types].xml | _rels/.rels | xl/workbook.xml | xl/_rels/workbook.xml.rels | xl/worksheets/sheet1.xml | xl/worksheets/sheet2.xml
all_crc_ok=true  eocd_ok=true  counts_match=true  central_offset_ok=true  ooxml_parts_present=true
content_types_ws_overrides=2  sheets=<sheet name="运行历史" sheetId="1" r:id="rId1"/> | <sheet name="运行明细" …>
xml_wellformed_errors=[]   sheet1 has runId/run-010   json 单元格往返 = {"test_cmd":"pytest"}
```
6) 转义机械扫描（`p9_escape.js`，扫描本轮 285 行新增中的字符串拼接）：16 处带插值，**15 处已转义/为 textContent/alert**，1 处见 m2（`index.html:1301`）。

**工作区卫生说明**：本会话在 `F:\project\workflow\` 下误留了一个 `jcval3/`（我执行 `npm install jsdom` 时因 `cd "%TEMP%"` 未生效而落在仓库根，内有 `node_modules`），已在收尾时删除；`%T%`/`temp`/`other`/`zipverify1` 非本会话产物，未触碰。`原型图/**` 未被本报告修改。
