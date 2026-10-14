# 修复报告（第 3 轮 · 测试面 E）—— `tests/集成测试用例.md` + `tests/fixtures/**`

> 修复者：修复者-E（测试面续作）。口径依据：`_fix_v3_decisions.md`（唯一权威，未写入该文件）。
> 校验发现来源：`_val3_03_tests.md`（G-1 / G-2 / 轻微 1–8 / D-1..D-4）。
> 改动文件（`git status --porcelain -- docs/cli非交互式/tests`）：
> `tests/集成测试用例.md`（M）、`tests/fixtures/tc_r1/seed_terminal_states.sql`（新增）。
> 未触碰其它文件（`tc_x3/**`、`tc_e2/**`、`tc_e3/**` 的 M/?? 状态为本轮之前已有改动）。

## 审计结果（开工前 grep 现状）

上一批修复员事实上**已落地本轮 E 面的大部分**（与 `_val3_03_tests.md` 描述不一致，以文件现状为准）：

| 项 | 现状 |
|-|-|
| G-1 E1 映射表 `target=OP` 与 TC-E1b 冲突 | 已修：`:1773` 映射表已按例分列（E1b = `target=Workflow` + 新建 `Start→L→End`）；`:1799` E1b 前置已改为 `target=Workflow` 并指向该 Workflow |
| G-2 TC-E1a 第 1 步提交节奏 | 已修：`:1786-1788` 改为「分批提交：先 1 个 → 等 ≥1 轮询周期复核 `running=1/waiting=0` → 再连提 2 个 → 复核 `running=1/waiting=2`」 |
| M-4 E3 立即失败 OP 来源 | 已修：`:1775` 已补「复用现成夹具 `tc_j2/op_always_fail.yaml`（或 `tc_e2/op_tc_e2_fail`）」 |
| M-5 E1c waiting 竞态 | 已修：`:1811` 已补「调 `job_queue_running_max=1` + 先占住唯一 running 名额」 |
| M-6 E1d 前置误引 | 已修：`:1823` 已改为「构造步骤见 TC-E1a 前置 1–2，**不含**前置 3 的终态 Run」 |
| D-1 `job_queue_running_max` 下限 | 已修：`:1773/1782/1811` 均已写「下限 1、上限 10，见 crud-06 一」 |
| 其余（M-1/M-2/M-3/M-7/M-8、D-3、D-4、二.5、二.16） | **未落地** → 本轮修复 |

## 已修项

| 项号 | 位置（文件:行） | 改法 | 证据 |
|-|-|-|-|
| **M-1 / D-3**（§8 示例把 Client 名当 `target.name`） | `集成测试用例.md:1928` | D11 固化示例 `manifest.target.name=bash-build，ops/op_bash_build.yaml 内 name=op_bash_build` → 中性锚 `manifest.target.name=op_renamed，ops/op_prompt_review.yaml 内 name=op_prompt_review`（与 TC-E4b 第 1 步同值） | grep `manifest.target.name=bash-build`=0；`manifest.target.name=op_renamed`=2 |
| **M-2**（E4a~d 汇总名 `导入校验-` vs 详细标题 `导入-`） | `:1934/1945/1955/1965` | 4 个详细标题前缀补「校验」→ `导入校验-manifest.<锚> 名称锚不一致 → 400`，与汇总列表逐字一致 | 名称比对脚本：`mismatches: 0`（91 例全对） |
| **M-3**（E1a 前置标签变体） | `:1781` | `- **前置条件**（数据来源见本节「E 系列数据来源映射」）：` → `- **前置条件**：`，说明移入第 1 步首句（`:1782`「构造数据来源见本节…」） | grep `前置条件（数据来源见本节`=0；标签形态仅余 `''` |
| **M-7**（E4a 前置两可选包而断言只对 `tc_x3`） | `:1938` | 固定为 `tc_x3_multi.zip`；把 `tc_e2_loop.zip` 移入注：写明确对应期望 message（`…workflow.yaml 内 name=wf_tc_e2_loop`）并注「勿混用」 | grep `（或 \`tc_e2_loop.zip\`）`=0；`:1940` 断言值 `wf_tc_x3_multi` 与实物一致 |
| **M-8**（ZIP 容器两谱系） | `:22` | 在 `tc_x3` 成员序说明后补注：逐字节比对仅覆盖**成员内容与成员顺序**，不含 ZIP 容器元数据（时间戳 / ExternalAttributes / 通用位标志）；`tc_x3`/`tc_e2` 为 Python `zipfile` 谱系、`tc_j3`/`tc_x4/*` 为既有谱系 | grep `容器元数据`=1 |
| **D-4**（`tests:1220` 「仍应唯一」） | `:1220` | 改为「属**夹具数据质量**问题…**包内 `clientId` 不重复属夹具数据质量要求，导入不校验其存在/唯一**」（与 D-4 拍板一致） | grep `导入不校验其存在/唯一`=1；旧串 `仍应唯一` 已随改写移除 |
| **二.5**（`#n` → 「数据集行 n」） | `:1747` | `（#9 running）` → `（数据集行 9：\`running\`）`（唯一残留的测试面 `#n`） | grep `（#9 \`running\`）`=0；`（数据集行 9：\`running\`）`=1 |
| **二.16**（`cancelled`/`waiting` 终态夹具 + 用例 + 统计） | 新增 `fixtures/tc_r1/seed_terminal_states.sql`；`集成测试用例.md:1154-1164`（TC-R4）、`:21`（夹具表）、`:91`（汇总）、`:1998/2003`（统计表） | ① 新增最小夹具：1 个 Workflow（`Start→A(op)→B(op)→End`）+ 2 条 Run（① `run-tc-r4-01`=cancelled 终态，steps A=cancelled + B=waiting；② `run-tc-r4-02`=running 非终态，steps A=running + B=waiting）；② 新增用例 **TC-R4**（P3）验证终态 Run 未执行节点=「⊘ 未执行」、非终态=「等待中」，并含接口一致性（`waiting` 记录数据层保留）+ 终态切换反证；③ 夹具表补该脚本并挂 `R4`；④ 统计表 运行历史 `4→5`、P3 `0→1`，合计 `90→91` / P3 `57→58` | sqlite3 实跑 `.read` 三脚本均 OK；查询：`run-tc-r4-01/cancelled`、`run-tc-r4-01/wnode-tc-r4-b/waiting`、`run-tc-r4-02/running` 等与断言一致（见下）；grep `⊘ 未执行`=5、`seed_terminal_states.sql`=3 |

## 未落地与原因

| 项 | 状态 | 原因 |
|-|-|-|
| **D-2**（`proposal-01:2309` §15.2 `max` 措辞） | 未改（非本组文件） | 属 `proposal-01` 归属，测试面不能自改 |
| **D-15/G9 的原型 mock 夹具**（`原型图/mock-data.js` 补 cancelled Run/step） | 未改（非本组文件） | `_val3_04_proto.md` 的 m4/P6 属**原型组**文件；本组按「二.16」在**测试面**补等价最小夹具与用例（`seed_terminal_states.sql` + TC-R4），使该分支在集成测试层可自动验证 |
| G-1 其余跨文件项（`crud-03`/`crud-04` 侧） | 未改 | 非本组文件；测试文档侧映射表/前置已自洽 |
| `tests` 内 `settings.<键>` 写法（`:1774/1782/1811/1834/1868`） | 保留 | 采用 `settings.key` 点号形式（非旧口径 `settings \`X\`` 反引号空格形），非 `_val3` 报告的测试面项，且与 `GET /api/settings` 契约同名，改动无据 |

## 机械核对证据

**脚本**：`python %TEMP%\jz_check.py`（`PYTHONIOENCODING=utf-8`）、`python %TEMP%\jz_name.py`；`sqlite3` 3.50.6。

### 1. 用例 ID / 条数 / 优先级 vs 统计表（逐格）
```
detail cases: 91  unique: 91        summary rows: 91  unique: 91
only in detail: []   only in summary: []   order identical: True
cases missing priority: []
DIST  运行历史 5 0 4 0 1 0
TABLE 运行历史 ('5','0','4','0','1')
TABLE | **合计** | **91** | **4** | **18** | **11** | **58** |
```
其余模块逐格一致：Client 5(1/4/0/0)、OP 5(1/4/0/0)、Workflow 3(1/2/0/0)、Job 3(1/2/0/0)、跨页面联动 52(0/1/11/40)、配置/系统 1(0/1/0/0)、错误族矩阵 13(P3 13)、导入校验 4(P3 4)；合计 4+18+11+58 = **91** ✔。

### 2. 汇总名 vs 详细标题
```
mismatches: 0   (91/91 逐例一致；含新增 TC-R4 与 E4a~d 前缀)
```

### 3. 旧/新措辞（grep）
```
OLD 全部 = 0：retry.on=failed / on_failed / on:failed / retry_from_step_id / 前端原型： / max+1 /
  min(3×3 / timeoutSeconds=1, sleep 5 / 记 error 日志、不创建 Run / 不限制（按 `max×3=9` 触顶失败） /
  TC-R1 / R2 / R3 / （#9 `running`） / manifest.target.name=bash-build / （或 `tc_e2_loop.zip`） /
  #### TC-E4a..d 导入-manifest / 前置条件（数据来源见本节   → 20/20 = 0
NEW 到位：job_queue_running_max=1 ×11；下限 1、上限 10 ×3；（数据集行 9：`running`）×1；
  manifest.target.name=op_renamed ×2；#### TC-E4a..d 导入校验-manifest 各 1；导入不校验其存在/唯一 ×1；
  容器元数据 ×1；TC-R4 ×3；seed_terminal_states.sql ×3；⊘ 未执行 ×5
```

### 4. 悬空 / 重复引用
```
non-case TC refs: ['TC-E3','TC-X2']   ← 均为族引用（可接受），无悬空单例引用；无重复用例 ID
```

### 5. 行尾 / 编码
```
集成测试用例.md：bytes=169593 CRLF=2003 LF-only=0 BOM=True
fixtures/tc_r1/seed.sql: CRLF=0 LF-only=95  seed_terminal_states.sql: CRLF=0 LF-only=101（与既有夹具同为 LF）
```

### 6. ZIP 逐成员 SHA256 vs 源目录 + 成员序 + 名称锚（6 包 / 22 成员）
```
tc_x3_multi.zip   order workflow.yaml>manifest.json>ops/op_prompt_review.yaml>ops/op_bash_build.yaml  ALLMATCH=True
tc_e2_loop.zip    order workflow.yaml>manifest.json>ops/op_tc_e2_fail.yaml>ops/op_tc_e2_ok.yaml        ALLMATCH=True
tc_j3_schedule.zip order job.yaml>manifest.json>ops/op_prompt_review.yaml                              ALLMATCH=True
tc_x4_schedule_workflow.zip order job.yaml>manifest.json>workflows/wf_deploy_prod.yaml>ops/op_prompt_review.yaml ALLMATCH=True
tc_x4_manual_op.zip        order job.yaml>manifest.json>ops/op_prompt_review.yaml                      ALLMATCH=True
tc_x4_manual_workflow.zip  order job.yaml>manifest.json>workflows/wf_deploy_prod.yaml>ops/op_prompt_review.yaml ALLMATCH=True
名称锚：tc_x3 wf=wf_tc_x3_multi✔ / ops 各✔；tc_e2 wf=wf_tc_e2_loop✔ / ops 各✔；
        tc_j3 job=tc_j3_schedule✔ target=op_prompt_review✔；tc_x4×3 job✔ target=wf_deploy_prod|op_prompt_review✔ ops✔
```

### 7. 新夹具可加载性（sqlite3 3.50.6 实跑）
```
sqlite3 %TEMP%\jzr4.db ".read schema.sql"            -> SCHEMA_OK
sqlite3 %TEMP%\jzr4.db ".read tests/fixtures/tc_r1/seed.sql"                    -> SEED_OK
sqlite3 %TEMP%\jzr4.db ".read tests/fixtures/tc_r1/seed_terminal_states.sql"    -> TERM_OK
查询：run-tc-r4-01|cancelled|cancelled ; run-tc-r4-02|running|NULL
      run-tc-r4-01|wnode-tc-r4-a|cancelled ; run-tc-r4-01|wnode-tc-r4-b|waiting
      run-tc-r4-02|wnode-tc-r4-a|running   ; run-tc-r4-02|wnode-tc-r4-b|waiting
      workflows=1 ; workflow_nodes=4
```

### 备注（工具链）
- 文档为 CRLF，编辑工具写入的换行默认为 LF；所有插入行经归一化脚本（`%TEMP%\jz_norm.py`：先归一并统一补 `CRLF`）收口，最终 `LF-only=0`。新增 SQL 夹具按既有夹具约定保持 LF。
- 校验脚本均落 `%TEMP%`，未在被审目录落盘。
