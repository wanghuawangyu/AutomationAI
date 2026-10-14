# 原型修复报告（第 4 轮 · F 组 / `原型图/**`）

- 依据：`_fix_v4_decisions.md`（唯一口径）+ `_val4_01_docs.md`（G5）+ `_val4_04_proto.md`（A1/A2/A3、m1–m7、P1–P4）+ `_val4_05_global.md`（S-3a–e、N-1、N-3/N-4/N-5、L-3/L-7/L-8）。
- 范围：**仅改 `docs/cli非交互式/原型图/**`**（报告除外）。`workflow-canvas.css` / `xlsx-lite.js` **未改动**（`fc /b` 与修复前快照逐字节一致）。
- 修复前基线：`%TEMP%\jcval4\fix4pre\`（= R2 工作区状态，修复前 10 文件逐字节快照），以下 pre/post 对照均以它为「pre」。
- 自建探针/脚本：`%TEMP%\jcval4\fix4\`（`p_fix4.js` 43 项、`smoke` 复用、`esc_scan.js`、`eol.js`、`grep1.js`）；复用校验员的 `smoke.js`/`p_*.js` 作回归。

## 已修项（含证据）

> 判据：旧措辞机械检索 0 残留 + 新措辞/新行为在 pre/post 两态可复现（见「负向对照」）。

### 一.1 / 二.7 —— 原型校验内核 + 校验面板（S-1 / N-3 / N-5 / P-2）

| 项 | 落地位点 | 证据 |
|-|-|-|
| 内核补 **规则 18「出参来源必须有效」** | `mock-data.js` `validateWorkflowOf()` 尾部（`nodeById` + `outputs[].from` 判定，文案 `出参 X 的来源节点不存在` / `出参 X 的来源出参不存在`） | `p_fix4` A2/A3/A4 三项 pre BAD→post OK（pre 错误集 `[]`，post 命中两条固定文案）；A1/A5 证明 4 个内置 Workflow 不被误伤 |
| 内核补 **规则 9**（opId+opVersion）、**规则 16**（Start 无 `on_failure` 出边） | 同上两处 | `p_fix4` A6（`节点 node_check 未绑定 opVersion`）/A7（`Start 节点不允许 on_failure 出边（Start 无失败语义）`）pre BAD→post OK |
| 内核注释**编号与 `crud-03 §3.3` 一致** | `/* crud-03 规则 1 */`、`规则 2/3/4/5`、`规则 7`、`规则 9`、`规则 10/11`、`规则 15/14/13`、`规则 16`、`规则 18`；并注明 A 组 `9/10/11/16`、B 组 `1–7/13–15/18`、C 组 `12/17` | `p_fix4` A12（`/* 规则 7 / 8` 与 `/* 规则 9（D3/D5）` 均 0 命中，`crud-03 规则 18` 命中）pre BAD→post OK |
| 面板补 **`output_from`**，数组 **13 项**（= `proposal-01 §10.14` 口径） | `workflow.html` `WF_CHECK_RULES` 末项 | `p_fix4` A8 `items=13`（pre=12）、A9（含 `output_from` 且「11 条」0 残留）pre BAD→post OK |
| `wfErrRuleKey` 补 `出参…来源` 分支 | `workflow.html` | 同上（面板可解析该文案，进 13 项内） |
| 头注声明**「内核/面板仅作演示，规格以 `p01 §10.14` + `crud-03 §3.3` 为准」** | `mock-data.js` 文件头注；`workflow.html` 校验块头注 | `p_fix4` A10（workflow.html 含「仅作演示」+`crud-03 §3.3`）、A11（mock-data.js 含「仅作演示」+「编号与 `crud-03 §3.3` 编号体系一致」）pre BAD→post OK |

### 一.4 —— 「全部已修」失实清单 a–e

| 项 | 落地位点 | 证据 |
|-|-|-|
| a 列表列触发文案分隔符 ` · ` | `mock-data.js` `TRIGGER_TEXT.manual/schedule`；`index.html:340/373` 静态占位 | `p_fix4` E1/E2；`grep1 持久 Job /` = 0 |
| b 删 `slugName` + 导出名 | `mock-data.js` 删除 `slugName()`；`client.html` `'client-' + name + '.yaml'` | `p_fix4` E3（7 文件 0 命中 `slugName`）、E4；`node --check mock-data.js` OK |
| c `settings.html` D14 文案 | `settings.html:186` →「`0` = 不施加绝对上限，仍受 `max×3` 约束」 | `p_fix4` B6（含「范围 1..10」且 `0=不限制` 0 命中）、B7（`0 = 不施加绝对上限` 命中）；同步参数化 D18 文案（`engine_event_retention_days 天后软删除`） |
| d 「当前运行目录」 | `mock-data.js:1259` `runDir：当前运行目录` | `p_fix4` E8（`配置目录` 0 命中） |
| e `EXPORT_UNAVAILABLE` → `INTERNAL_ERROR` | `mock-data.js` 导出分支 | `p_fix4` E7（`EXPORT_UNAVAILABLE` 0 命中、`__err('INTERNAL_ERROR'` 命中；`INTERNAL_ERROR` 在 `proposal-02 §10.1` 总表内，**不新增错误码**） |

### 二.1（G5）、二.8（N-4）、二.15/16（A1/A2/A3/P1/P2）、二.17（m6/P3）、二.18（m7/P4）

| 项 | 落地位点 | 证据 |
|-|-|-|
| **二.1** 导入 OP 缺 `timeoutSeconds` → 400 | `mock-data.js` `/api/ops/import`：`isNaN(iopTimeout)` → 400；构建对象改 `timeoutSeconds: iopTimeout`；注释引 `crud-02 3.2.3 / 3.2.7` | `p_fix4` D1（pre 返回对象 `timeoutSeconds:60`，post 400 且 message 含 `timeoutSeconds`）、D2（超范围 400）、D3（合法 45 通过） |
| **二.8** `job_queue_running_max` 下限 1 | `mock-data.js` `SETTING_LIMITS` 该键改 `{max:10,min:1}` + PUT 校验补 `v < min` 分支；`settings.html` 文案「范围 1..10」+ `min:1` | `p_fix4` B1(`=0`→400「下限 1」)、B2(`=-3`→400)、B3(`=11`→400 上限)、B4(`=1`通过)、B5(`=10`通过)；pre 全部静默接受并写入非法值 |
| **二.15** OP 详情三态收口 | `index.html`：`RUN_TERMINAL` 提为**模块级**；`renderOpDetail` 计算 `runTerminal`；记录徽标 `waiting` → 终态 `⊘ 未执行` / 非终态 `◌ 等待中`；`opUnexecutedBar` 仅**终态且无记录**时显示 `⊘ 该节点未执行…`（非终态隐藏，图标落在文档图标集） | `p_fix4` F1（非终态无记录：`display=none`、文本空）、F2（非终态 waiting → `◌ 等待中`）、F3（终态 waiting → `⊘ 未执行`）、F6（终态无记录 → 条显示 `⊘`）；pre 全部 BAD。校验员 `p_new` N1b–N1f 由 BAD 转 OK |
| **二.16** OP 详情刷新/轮询重取完整详情（与 wf 对称） | `index.html` 新增 `refetchOpDetail()`；`refreshDetailView('op')` 走它（`GET /api/runs/{runId}` 后 `renderOpDetail` 重绘）；`openOpDetail` 同步渲染**快照副本**（`Object.assign({}, RUN_BY_ID[id])`）以保证可与接口值比对 | `p_fix4` F4（[刷新] → `detail GET=1`）、F5（轮询发现变化 → `detail GET=1`）；pre 均 0。`p_new` N2a 由 BAD 转 OK |
| **二.17** 导入上限走 `GET /api/settings` | `op.html` / `client.html`：新增 `OP_IMPORT_MAX_BYTES` / `CLIENT_IMPORT_MAX_BYTES`（页面启动 `mockFetch('/api/settings')` 缓存 + 常量兜底），删除 `typeof SETTINGS !== 'undefined'` 直读 | `p_fix4` E5/E6；`grep1 "typeof SETTINGS"` 两文件 0 命中 |
| **二.18** 创建侧校验顺序与 `crud-04` 一致 | `mock-data.js` `/api/jobs` POST：**字段级缺失优先**（`newJobErrs` 命中即返回 `VALIDATION_ERROR`）→ 之后才判 `CLIENT_TYPE_MISMATCH`；加显式顺序注释 | `p_fix4` C1（name 空 + 类型不符 → `VALIDATION_ERROR`「name 不可为空」）、C2（字段齐全 + 类型不符 → `CLIENT_TYPE_MISMATCH`）；pre C1 返回 `CLIENT_TYPE_MISMATCH`（顺序反） |

### 三 —— 其他：m1/m2/m3/m4/m5/m7、L-3/L-7/L-8

| 项 | 落地位点 | 证据 |
|-|-|-|
| m1 `runId` 未转义 | `index.html` wf 详情头部三处按钮 `escJsStr(run.runId)`（终止/重试/重跑） | `p_fix4` F7（注入 `runId` 后 onclick 中无原始未转义串、`__INJ` 未置位）pre BAD→post OK；`esc_scan.js`：`escJsStr(run.runId)` = 3，pre = 0 |
| m2 BOM | `job.html`、`op.html` 去 UTF-8 BOM（行尾保持 CRLF） | `eol.js`/`p_scan`：两文件 `BOM=false`（pre `BOM=true`），`bare_LF=0` |
| m3 不可达分支 | `job.html` 类型不匹配分支加注释「UI 已过滤…**不可达**…保留为双保险」 | `p_fix4` E10 |
| m4 opts 契约注释 | `workflow-canvas.js` opts 补 `nodeTitle(id, node) -> string\|null` | `p_fix4` E11 |
| m5 探针专用计数 | `index.html` 删除 `detailPollCount`（声明 + 自增） | `p_fix4` E12（0 命中） |
| m7 / P4 | 同「二.18」 | 同上 |
| L-3 笔误 | `mock-data.js` `cord-05` → `crud-05` | `p_fix4` E9（0 命中） |
| L-7 措辞/占位 | `client.html` 占位 `client-<name>.yaml`；`job.html` 详情「手动触发」→「手动」 | `p_fix4` E4、E10 |
| L-8 过期注释 | `workflow.html` `client_type` 注释改「见 proposal-01 §10.14 第 10 行 / crud-03 规则 11」 | `p_fix4` E9（`§10.14 未列` 0 命中） |

## 验证（机械自检，全部实跑）

```
node --check mock-data.js | workflow-canvas.js | xlsx-lite.js   →  OK ×3
jsdom 6 页冒烟 smoke.js                                          →  SUMMARY: 6/6 pages clean (errors=0)
行尾 / BOM（eol.js）：client/index/job/op/settings/workflow = 全 CRLF、bare_LF=0、BOM=false；
                      mock-data.js / workflow-canvas.js / xlsx-lite.js = 全 LF；无 BOM
外部引用 p_cdn.js                                                →  命中 0
```

回归探针（复用校验员探针，workspace vs pre）：

| 探针 | WS | PRE |
|-|-|-|
| `p_contract` mock 契约 15 | 15/0 | — |
| `p_index` 详情轮询/未执行 28 | 27/1 ※ | 12/16 |
| `p_wf` 出参双下拉/绑定 13 | 13/0 | 2/11 |
| `p_misc` 筛选/超时 16 | 16/0 | 7/9 |
| `p_jobedit` Job 编辑回填 19 | 19/0 | 15/4 |
| `p_dom` DOM 机械 18 | 18/0 | — |
| `p_validate` 夹具自洽 15 | 15/0 | — |
| `p_new` 新问题取证 10 | 9/1 ※ | 4/6 |
| 自建 `p_fix4`（43 项，本任务全套） | **43/0** | **8/35** |

※ 两处 BAD 为**探针极性反转**（探针断言的是被本轮废止的旧行为，非回归）：
- `p_index` F1「OP 详情 [刷新] **不**发任何数据请求（读内存快照）」→ 现 `detail=1`，正是二.16 要求的行为（改判据见 `p_fix4` F4）。
- `p_new` N3a「onclick 中出现**未转义** runId」→ 现 `openRetry('x\')-window…(\'')`，正是 m1 修复后的转义结果（改判据见 `p_fix4` F7）。

**负向对照（pre/post）**：`p_fix4` 共 **35 项由 BAD 转 OK**（A2–A4/A6–A12、B1/B2/B6/B7、C1、D1、E1–E12、F1–F7），远超 ≥4 项要求；另有 `p_index`/`p_new`/`p_wf`/`p_misc`/`p_jobedit` 五组 pre/post 对照（见上表）。

**转义扫描**：
- `p_scan.js`（git 新增行）→ `flagged=1`：`index.html` `headActions.innerHTML = refreshHtml + retryBtn + …`，`retryBtn` 为**已转义预构造串**（内部 `escJsStr(runId)` + `escText(reason)`）→ **误报**。
- 自建 `esc_scan.js` 全文件扫描 → WS **suspicious=2**（仅 `detailRefreshControlsHtml` 的 `view` 变量，取值恒为字面量 `'op'/'wf'` → 误报）；**PRE=5**（= 同 2 项 + m1 的 3 处真实未转义 `run.runId`）。

## 未落地与原因

1. **`openOpDetail` 未改为「完全异步先取数再渲染」**（`_val4_04` P2 选项①）：`p_new` 的 N1b–N1f 在 `openOpDetail` 后仅 `await 50ms`、`mockFetch` 固有 100ms 延迟 → 完全异步会使 N1 系列读到未渲染 DOM 而误判；故采纳 `_fix_v4_decisions.md` 二.16 明示的「**或其刷新路径**重取完整详情」：首绘同步（快照副本），**[刷新] / 轮询发现变化**统一经 `refetchOpDetail()` 取 `GET /api/runs/{runId}` 后重绘（与 wf 详情的取数路径语义对称，A3/P2 的可观测结论已由 `p_fix4` F4/F5 与 `p_new` N2a 证明）。
2. **m4（`workflow-canvas.js` opts 登记 `nodeTitle`）**：`_fix_v4_decisions.md` 三 未点名要求，但 `_val4_04` m4 已报；因属同一处零风险注释，**一并修复**（见上表）。
3. 其余 `_val4_0x` 报项均属其他文件（`crud-0x` / `tests` / `schema.sql` / `tasks.md` / `validation.md`），不在本组范围。
