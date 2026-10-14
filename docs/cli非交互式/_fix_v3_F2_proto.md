# 原型组修复报告（第 3 轮 · F2 续作）—— Run 详情 [刷新] / [自动刷新] + 轻量轮询

- 角色：修复者（续作）。工作目录 `docs/cli非交互式/`，**本轮只改** `原型图/index.html` + `原型图/mock-data.js`（其余文件未触碰）。
- 拍板依据：协调者本轮指令（实现 G10 / G3·L6）；口径依据 `proposal-01` §12.5 / §12.6 / §12.10 / §17.5 / §19.6。
- 探针与脚本：`%TEMP%\jcv3_f2\`（`smoke.js` / `probe.js`；负数对照快照 `pre/` = `git show HEAD` 导出的修复前原型目录，`xlsx-lite.js` 为未跟踪文件故自工作区复制）。

## 已修项

| # | 文件:位置 | 改动 | 依据 |
|-|-|-|-|
| F2-1 | `index.html:269-272`（`#view-op-detail` 头部） | 新增 `[刷新]`（`#opDetailRefreshBtn` → `manualRefreshDetail()`）+ `[自动刷新: 开]`（`#opDetailAutoRefresh`，`onclick="toggleDetailAutoRefresh('op')"`） | §12.5「详情页头部提供 [刷新] [自动刷新: 开]」/ §19.6「自动刷新开关 |
| F2-2 | `index.html:617-690`（新增脚本段） | 新增详情轮询模块：`detailAutoOn{op,wf}`（**与列表页 `autoRefresh` 相互独立**，默认 `开`，与 §12.5/§12.6/§12.10 的控件文案 `[自动刷新: 开]` 一致）、`startDetailPoll/stopDetailPoll/detailPollTick/toggleDetailAutoRefresh/manualRefreshDetail/refreshDetailView/detailRefreshControlsHtml`、`currentOpRunData/currentWfRunData/currentOpDetailArgs` | §12.10「Run 详情刷新（G10）」+ §17.5 轻量接口 |
| F2-3 | `index.html:569-571`（`showView` 内） | 视图切换挂钩：切入 `opDetail`/`wfDetail` → `startDetailPoll(view)`；**切走任意视图 → `stopDetailPoll()`** | §12.10「切走即停」 |
| F2-4 | `index.html:1059-1060 / 1095`（`openOpDetail`） | 记录 `currentOpDetailArgs`（刷新重绘入参）与 `currentOpRunData`（该 Run 快照，判「有 running step」用） | 同上 |
| F2-5 | `index.html:1274-1275 / 1382-1383 / 1388 / 1395 / 1401`（`openWfDetail`） | 记录 `currentWfRunData`；头部三个操作分支（running / 终态 / waiting·terminating）**统一前置** `refreshHtml = detailRefreshControlsHtml('wf')`，使 `[刷新] [自动刷新]` 与 `[终止]/[重试]/[重跑]/—` 并存且随重渲染保持开关状态 | §12.6 头部按钮表 + §12.10 |
| F2-6 | `mock-data.js:2276-2278` | `GET /api/runs/{runId}/status` 补注释，明确其为**轻量轮询接口**（仅 `{status, updatedAtMs}`，不含 steps/inputs），供详情页按 `general.poll_interval_ms` 轮询（接口行为此前已存在，本轮仅补口径说明） | §12.10 / §17.5 / crud-05 3.5 |
| F2-7 | `index.html` 行尾 | 本轮新增行原为 LF，已归一为 **CRLF**（1614 CRLF / 0 LF；`mock-data.js` 2288 行全 LF，未动） | 任务「原行尾不变」 |

**轮询语义（与 §12.10 逐条对应）**
1. 开关**开** 且该 Run **有 `running` step** → `setInterval(detailPollTick, pollIntervalMs())`，间隔取 `general.poll_interval_ms`（默认 2000，沿用既有 `pollIntervalMs()`，接口返回后重建定时器）。
2. 每次 tick 只请求 `GET /api/runs/{runId}/status`；仅当 `status`/`updatedAtMs` **变化**时才重取完整详情 `GET /api/runs/{runId}` 并重绘该 Run 的详情与画布节点状态（无变化不整份拉取）。
3. **无 running step → 自动停止**（`stopDetailPoll()`；且不建定时器）。
4. 开关**关** → 不轮询；手动 `[刷新]` 始终可用（同链路重取完整详情）。
5. 切走详情视图即停止；迟到的响应按 `detailPollView` 校验后丢弃。
6. 详情开关状态与列表页 `autoRefresh` 完全独立（互不读改）。

## 未落地

无（本轮拍板的两项 G10 / G3·L6 均已落地）。范围外未做：文档侧文字（§12.10/§17.5 已由 A/C 组落地，本轮未改文档）；`ui/` 目录不在本轮范围。

## 证据

**1) 语法检查**
```
node --check mock-data.js && node --check workflow-canvas.js && node --check xlsx-lite.js → JS_CHECK_OK
```

**2) 6 页 jsdom 冒烟（0 未捕获异常；忽略 `window.scrollTo` 噪声）**
```
SUMMARY: 6/6 pages clean (errors=0)
（index / client / op / workflow / job / settings；采集 window.error + unhandledrejection + jsdomError）
```

**3) 轮询探针 `probe.js`（工作区）—— 22 项断言全绿**
```
OK   T0   mockFetch 可注入代理
OK   T0b  轻量接口仅返回 status/updatedAtMs
OK   A1   详情打开后轮询定时器已建立  [timer=21]
OK   A2   自动刷新开 → 已轮询 /status  [status calls 0→1]
OK   A2b  轮询计数递增  [detailPollCount=1]
OK   A3   轮询未整份拉详情（无变化时不重取 /api/runs/{id}）  [detail calls=1]
OK   B1   关闭后定时器已清除
OK   B2   开关文案为「自动刷新: 关」
OK   B3   未开启（关闭）时不轮询  [status 1→1, count=1]      ← 必需证据①
OK   C1   重新开启后定时器重建
OK   C2   恢复轮询  [status 1→2]                              ← 必需证据②
OK   D1   切走详情视图即停止轮询
OK   D2   切走后不再发 /status  [status 2→2]
OK   D3   列表页开关不受详情开关影响（仍为开）
OK   E1   无 running step → 不轮询（无定时器）  [timer=null]
OK   E2   无 running step → 不发 /status  [status 2→2]
OK   F0   自动刷新已关闭（手动刷新对照前提）
OK   F1   关闭状态下手动 [刷新] 重取完整详情  [detail 2→3]
OK   F2   手动刷新不引入轮询  [status 2→2]
OK   G1   OP 详情头部含 [刷新] + [自动刷新]
OK   G2   OP 详情视图建立独立轮询
OK   G3   OP 详情轮询 /api/runs/run-010/status  [status 2→3]
RESULT: pass=22 fail=0
```

**4) 负数对照（同一探针跑修复前快照 `pre/`）—— 10 项 BAD，症状可复现**
```
RESULT: pass=12 fail=10
BAD  A1 [timer=undefined] / A2 [status 0→0] / A2b [detailPollCount=undefined]
BAD  B2 [(无该控件)] / C1 / C2 [status 0→0]
BAD  F1 [detail 2→2] / G1 [(无控件)] / G2 / G3 [status 0→0]
（pre 中 B1/D1/E1/F0 为「OK」是 trivial（undefined == null），正是「完全没有轮询」的表现）
```

**5) 行尾 / 编码核验**
```
index.html   CRLF=1614 LF=0 BOM=false
mock-data.js CRLF=0    LF=2288 BOM=false
git status --porcelain docs/cli非交互式/原型图 → 本轮仅 index.html / mock-data.js 有我的改动（其余 M 为前序轮次既有）
```

**6) 审计 grep**：`detailPollTimer` / `detailHasRunningStep` / `detailRefreshControlsHtml` 均只出现在新增段；`index.html` 内 `自动刷新` 命中 3 处（列表 `#autoRefresh` + 详情 op/wf 各 1），列表页原有逻辑未改。
