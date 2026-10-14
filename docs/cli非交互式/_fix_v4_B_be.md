# 第 4 轮修复报告 · B 组（后端 crud-01/02/06 + proposal-02）

> 口径：`_fix_v4_decisions.md`（唯一权威）。只改 `proposal-02-后端设计.md`、`proposal-02-后端crud-01client管理.md`、`proposal-02-后端crud-02op管理.md`、`proposal-02-后端crud-06配置管理.md`（crud-01 本轮无待改项，未改动）。
> 行尾：4 文件均 LF、无 BOM（实测 `CRLF=0 / BOM=false`）。

## 已修项（含证据）

| # | 项（口径来源） | 落地位点 | 证据（实测） |
|-|-|-|-|
| 1 | **二.1** 导入 / 请求体缺 `timeoutSeconds` → 400 | `crud-02 3.2`、`3.2.3`、`3.2.4`、`3.2.7`、`3.2.8` | 3.2 字段表「**接口层必填**（创建 / 更新请求体与导入 YAML 缺失或超范围 → 400 `VALIDATION_ERROR`）」；映射表同步；3.2.3 请求体表「**缺失 / 非整数 / 超范围 → 400 `VALIDATION_ERROR`**」；3.2.4 错误表补「`timeoutSeconds` 缺失或超范围同 3.2.3」；3.2.7 YAML 表「**导入 / 请求体缺失或超范围 → 400 `VALIDATION_ERROR`**」；3.2.7 后新增「`timeoutSeconds` 必填口径（导入 / 请求体统一）」（引 3.2.3 / 3.2.4 / 3.2.8）；3.2.8 功能说明补 `timeoutSeconds` 缺失、错误表「**timeoutSeconds 缺失或超范围（必填，须 1..86400）**」。旧措辞 `默认 60（新建时预填 60）` = **0**；`默认 60` = **0** |
| 2 | **二.2** `crud-02 3.2.6` 补固定 `message` | `crud-02 3.2.6` 错误表 `CLIENT_TYPE_MISMATCH` 行 | `message` 固定为：`Client 类型与 OP 类型不匹配：OP <opName> 为 <opType>，Client <clientName> 为 <clientType>`（**1 处**，与 crud-03:123 / crud-04:260 逐字一致） |
| 3 | **二.10** 配置项命名与 tests 统一（分组全路径） | `crud-06 §一`、`§3.4`、`§四` | 配置项表全列改 `<分组>.<键>`（`history.job_queue_running_max` ≤5、`engine.engine_event_retention_days` ≤7、`general.poll_interval_ms` ≤3 等），表头「分组（JSON 路径前缀）／配置项（全路径 = 分组.键）」；`§3.4` 上限表、`§四` 联动表同步全路径；新增「配置项全路径口径（与 tests / mock 统一）」说明（含 JSON 嵌套 / `mock-data.js` `SETTING_LIMITS` / tests 一致，短名为同义简写） |
| 4 | **一.4e** `proposal-02 §10.1` 不新增导出错误码 | `proposal-02 §10.1` 说明 | 实测全表 **27 行 / 26 code**，**无 `EXPORT_UNAVAILABLE`**（4 文件内 `EXPORT_UNAVAILABLE` = **0**）；新增「不新增专用错误码」说明：导出类执行 / 内部错误统一 `INTERNAL_ERROR`，与 `原型图/mock-data.js` 一致 |
| 5 | **docs L3** 名称锚不一致示例值统一（与 C 组 crud-04 同式） | `proposal-02:373` | 示例改为 `名称锚不一致：manifest.target.name=deploy_workflow，workflows/deploy_workflow.yaml 内 name=deploy_v2`；`wf_deploy_prod` 在 4 文件内 = **0** |

## 未落地与原因

- **docs L4**（`proposal-01 §20.1` 补登 D9/D10/D11/D12/D17）：目标文件为 `proposal-01`（A 组），不在本组只改范围；本组 `crud-01:75` / `crud-02:72` / `crud-06:133` 已有「行内编号对照表」，不受影响。
- **docs L6**（原型 `EXPORT_UNAVAILABLE`）：原型改动属 F 组；本组只作 §10.1 侧确认（见已修项 4），文档侧已不含该码。
- **docs L7**（`max` 措辞微差：`crud-03:1158` / `schema.sql:219` / `p01:2320`）：涉及 `crud-03` / `schema.sql` / `proposal-01`，均非本组文件；本组 4 文件 `每轮总尝试次数` = 0、`max*3` = 0。
- **global L-5**（`crud-03:1168` `min(max*3,…)`）/ **L-6**（`p01:30` / `p01:2905` / `c03:1168` 补 `max_loop_multiplier=0` 注）：目标为 crud-03 / proposal-01，非本组。
- **global L-2**（完成钩子双名映射）：口径定为写进 `crud-03 4.4`（C 组），本组不落。

## 机械自检（证据）

- 旧措辞残留：`默认 60（新建时预填 60）`=0、`默认 60`=0、`wf_deploy_prod`=0、`EXPORT_UNAVAILABLE`=0、`settings.<键>`=0（仅 `原型图/settings.html` 文件名）。
- 新措辞到位：见上表计数（均 ≥1）。
- 错误码集合：本组 4 文件内联错误表所用 code **全部** ∈ `proposal-02 §10.1`（26 code）；未发现编外 code（其余反引号大写 token 均为环境变量 / 标识符，非错误码）。
- 表格列数（未转义 `|` 计）：4 文件 **mismatch = 0**。
- 编码 / 行尾：4 文件 `CRLF=0 / BOM=false / LF`（与既有 LF 一致）。
- 引用存在：新增引用 `crud-03 3.3 规则 11`（crud-03:123）、`crud-04 3.4.3`（crud-04:196）、`crud-04 3.4.6`、`crud-03 3.3.9`、`crud-04 3.4.10`、`crud-05 3.5.10`、`crud-01 3.1.6` 均实测存在。
- 临时脚本 `_chk*.js` 已删除（仅存本报告）。
