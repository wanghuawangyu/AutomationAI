# 修复报告（第 2 轮修复者 · G 组：`tasks.md`）

- 角色：**修复者（第 2 轮）**。范围：`tasks.md`（唯一改动文件）。
- 口径：`_fix_v3_decisions.md`（唯一权威）+ 本组项 `_val3_05_global.md`。
- 文件属性：UTF-8（无 BOM）、**LF 行尾**（改前改后一致，未整文件转换）。
- 改后行数：322 → 322（行数不变，均为单行内改写）。

## 一、已修项表

| 序号 | 口径来源 | 位置（改后行号） | 改前 | 改后 |
|-|-|-|-|-|
| 1 | 一.9（`_val3_05_global.md` N-7） | `:227` T8.3 | `节点数 > settings \`workflow_max_nodes\` → 400 \`VALIDATION_ERROR\`` | `节点数 > 配置项 \`workflow_max_nodes\`（\`ai-automation.json\`，默认 200、上限 1000，见 crud-06 一）→ 400 \`VALIDATION_ERROR\`` |
| 2 | 一.9（N-7） | `:228` T8.4 | 同上（`settings \`workflow_max_nodes\``） | 同上（配置项表述） |
| 3 | 一.9（N-7） | `:233` T8.9 | 同上（`settings \`workflow_max_nodes\``） | 同上（配置项表述） |
| 4 | 一.10（N-9） | `:230` T8.6 | 旧 7 条校验集（`Start/End 唯一、start→end 可达、允许回跳环、Start 无 on_failure、op 节点绑定 opId+opVersion、bindings 引用存在`） | `**crud-03 3.3「校验规则」全部 16 条**`（列全：Start/End 唯一与各自入出边、start→end 可达、op 节点从 Start 可达且能到达 End、opId+opVersion 绑定、`clientId` 非空、Client 类型匹配、绑定必须指向前置节点、required 有来源、Start 无 `on_failure` 出边、**允许回跳环**） |
| 5 | 一.10（N-9） | `:230` T8.6 参考/验收列 | 参考 `crud-03 3.3.6/校验规则`；验收仅 `{valid,errors[]}` | 参考 `crud-03 3.3.6 / 3.3「校验规则」（16 条）`；验收补「逐条规则各构造一个负向用例 → 均返回 `valid=false` + 对应 `errors[]` 文案」 |
| 6 | 一.10（N-10） | `:157` T5.2 | `\`ConfigRepo\`：读 \`ai-automation.json\` → \`Arc<RwLock<Config>>\`` | `配置服务模块：读 \`ai-automation.json\` → \`Arc<RwLock<Config>>\`（**不引入 \`ConfigRepo\` trait**，配置不走 Repository，见 proposal-02 §6）` |
| 7 | 二.5（N-5） | `:263` T9.3 | 参考 `crud-04 3.4.6 #3` | 参考 `crud-04 3.4.6「job_queue_waiting_max 的语义」`（跨文件 `#n` 改具名） |
| 8 | M-6（L-12 残留） | `:48` T1.8 | `proposal-02 §11` | `proposal-02 §11（十一、分页规范）`（补中文章节括注） |
| 9 | M-6 | `:235` T8.11 | `crud-03 §4.3` | `crud-03 4.3`（去 `§`，与全表 `crud-03 4.3.4` 体例一致） |
| 10 | M-6 | `:238` T8.14 | `crud-03 §4.3.1` | `crud-03 4.3.1`（去 `§`） |
| 11 | M-6 附带（同体例，报告未单列） | `:211` T7.6 | `crud-02 3.2.6/§4.1` | `crud-02 3.2.6/4.1`（去 `§`） |
| 12 | M-6 附带（同体例） | `:231` T8.7 | `crud-03 3.3.7/§4.2` | `crud-03 3.3.7/4.2`（去 `§`） |
| 13 | N-6（`_val3_05_global.md` 建议改法点名的 `tasks:94` 项） | `:94` T2.1 验收列 | 机械判据仅 `mockFetch(...)` = 0、无 `mock-data.js` | 追加「导出默认文件名 = `client-<name>.yaml`（name **原样**，不做字符替换 / 不做名称改写，见 crud-01 3.1.7）」可机械判据（防 T2.1「从 `原型图/*` 搬运」继承 `slugName`） |

> 说明：第 11/12 项属 M-6「编号体例」同一口径的自然延伸（全表 crud 引用无 `§`），为使体例一次性收口而一并修改，未自创第三口径。

## 二、未修项与原因

| 项 | 位置 | 处置 | 原因 |
|-|-|-|-|
| N-2（`crud-04 4.5.2` 层级） | `tasks:298` T10.12 参考 `crud-04 4.5.2` | **不改** | 引用目标**实际存在**（`crud-04:631` `**4.5.2 cron 入口**`），仅因 crud-04 侧用行内加粗导致机械解析失败。该「提升为 `#### 4.5.x`」属 `crud-04` 修复范围，非本文件；本文件引用不动，待 crud-04 提级后自然可解析。 |
| N-9 条数口径的落地时点 | `:230` 引「16 条」 | **已按口径写 16** | `_fix_v3_decisions.md` 二.4 已拍板「规则 17 → 16（删除『汇聚』）」。`crud-03:112-128` 当前仍为 17 行（含规则 8 汇聚），由 C 组同步删除；本文件按**拍板后**条数书写，改后两侧一致（16）。 |
| `proposal-02 §10.1` 示例改中性名（N-11） | — | **不在本文件范围** | N-11 落点在 `proposal-02`（B 组）。 |
| M-5 `EXPORT_UNAVAILABLE` | — | **不在本文件范围** | 落点在 `prototype/mock-data.js`。 |

## 三、自检证据

改动后机械核对（命令为 `powershell -NoProfile -Command "..."`，工作目录 `docs/cli非交互式`，全部读 `tasks.md`）：

| 判据 | 命令（要点） | 结果 |
|-|-|-|
| 旧措辞 `settings \` 残留 | `([regex]::Matches($c,'settings \`')).Count` | **0** ✓ |
| 旧措辞 `\`ConfigRepo\`：` 残留 | `([regex]::Matches($c,'\`ConfigRepo\`：')).Count` | **0** ✓ |
| `ConfigRepo` 仅存于「不引入」陈述 | `([regex]::Matches($c,'ConfigRepo')).Count` | **1**（`T5.2` 的「**不引入 `ConfigRepo` trait**」）✓ |
| 跨文件 `#n` 残留 | `([regex]::Matches($c,'3\.4\.6 #3')).Count` | **0** ✓ |
| crud 引用残留 `§` | `([regex]::Matches($c,'crud-0\d §')).Count` | **0** ✓ |
| 新措辞到位 | `([regex]::Matches($c,'配置项 \`workflow_max_nodes\`')).Count` | **3** ✓ |
| 旧 7 条校验集残留 | `([regex]::Matches($c,'bindings 引用存在')).Count` | **0** ✓ |
| 新条数措辞 | `([regex]::Matches($c,'16 条')).Count` | **2** ✓ |
| 非术语 `settings` 保留 | `/api/settings`=4、`settings.html`=1 | 保留 ✓（未误伤） |
| 表格结构完整 | 遍历 `^\|` 行，计数 `\|` ≥ 4 | 168 行全部合规，无 BAD ✓ |
| 引用章节存在 | 逐处核对 | `proposal-02 §11（十一、分页规范）`→`:372`；`§6`→`:166`（六、DB 操作层）；`crud-06 一`→`:60`；`crud-06 〇`→`:10`；`crud-01 3.1.7`→`:385`；`crud-04 3.4.6`→`:286`（注 `job_queue_waiting_max 的语义` @ `:328`）；`crud-03 3.3/3.3.6` 齐备 ✓ |
| 行尾/编码 | `[IO.File]::ReadAllBytes` 检查 `0x0D` / BOM | `LF only OK`、`no BOM OK` ✓ |

## 四、回执

- 改动文件：仅 `tasks.md`（13 处单行改写，未新增/删除行）。
- 各项落地位点：一.9 → `:227/228/233`；一.10 → `:157`（T5.2）+ `:230`（T8.6 条数 16 与验收判据）；二.5 → `:263`；M-6 → `:48/235/238`（+`211/231` 同体例）；N-6 的 tasks 侧 → `:94`。
- 未落地项：N-2（`tasks:298` 引用待 `crud-04` 提级）、N-9 条数两侧完全一致依赖 C 组删规则 8；均非本文件权威可单独闭合。
