# 界面设计 —— AI 自动化五界面关系与功能描述

## 一、应用定位

**应用名称**：AI 自动化

**定位**：基于 CLI 命令行的确定性工作流编排器。通过命令行调用 Agent CLI 与本地脚本执行器（bash / python / powershell），复用其原生能力，提供 Client / OP / Workflow / Job / 运行历史的四层定义与统一执行能力。

**核心原则**：

> **执行点只有 Job。OP 和 Workflow 是定义，Job 是执行载体。所有执行记录统一进入运行历史。**

**关键约束**：

1. **所有 ID 使用 32 位 UUID**（去掉连字符，共 32 个十六进制字符）。
2. **Client 可能支持交互式，但本 APP 下只能使用非交互式方式调用。**
3. **OP 是最小执行单元，不含 retry 字段。** 重试在 Workflow 编排层配置。
4. **OP 不与 Client 绑定**，执行时由用户通过下拉列表选择。
5. **OpInput / OpOutput 的 type 只支持 string。**
6. **所有时间字段使用 u128 毫秒时间戳**，命名以 Ms 结尾。
7. **OP / Workflow / Job 都有版本概念**，默认 v1。
8. **Workflow 有入参和出参。**
9. **单次执行需要指定工作区。**
10. **版本号自动带入，不需要人工填写。**
11. **保存时版本确认默认"不更新版本"。**
12. **运行历史记录版本快照，不随上游更新而变。**
13. **运行历史是默认首页。**
14. **失败的 Workflow 支持从失败 OP 重试。**
15. **超时只属于 OP，超时是终止信号。**
16. **循环终止由 max × 3 控制。**
17. **所有任务后台运行，前端轮询 DB 获取状态，不使用事件流。**
18. **Workflow 编辑器布局：左侧 OP 库（可搜索、可拖动）+ 中间画布 + 右侧节点详情面板。**
19. **Job target 为单个 OP 时，创建 Job 时必须选择一个 Client。**
20. **OP.interactive 字段保留占位（默认 false），前端界面不提供人工设置入口。**
21. **每个 Workflow 有固定的 Start 和 End 节点，不绑定 OP。**

---

## 二、ID 规范

### 2.1 统一格式

所有 ID 均为 **32 位 UUID**（无连字符）：

```text
格式：xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
长度：32 个字符
字符集：0-9, a-f
示例：a1b2c3d4e5f67890abcdef1234567890
```

### 2.2 涉及 ID 的实体

| 实体 | ID 字段 |
|-|-|
| Client | id |
| OP | id（写入 DB 时生成，界面不感知） |
| Workflow | id |
| WorkflowNode | nodeId |
| Job | id |
| JobRun | id |
| StepRecord | stepId（等于对应 nodeId） |

### 2.3 命名与 ID 分离

| 字段 | 用途 |
|-|-|
| id | 系统内部引用 |
| name | 界面展示 |

**规则**：

- 界面展示 name。
- 内部引用使用 id。
- **OP 的 name 全局唯一**。
- **OP 的 id 界面不感知**。

---

## 三、时间戳规范

所有时间字段使用 **u128 毫秒时间戳**：

| 字段 | 类型 | 说明 |
|-|-|-|
| createdAtMs | u128 | 创建时间 |
| updatedAtMs | u128 | 更新时间 |
| startedAtMs | u128 | 开始时间 |
| finishedAtMs | u128 | 结束时间 |

**规则**：JSON 传输用 string，SQLite 存储用 TEXT。

---

## 四、整体界面布局

应用为**两栏布局**：左侧固定菜单栏，右侧内容区。**默认首页为运行历史。**

```text
┌──────────────────┬──────────────────────────────────────────────────┐
│  左侧菜单栏       │  右侧内容区                                       │
│  (固定)           │                                                  │
│                  │  默认进入：运行历史                                │
│  🧩 Client 管理   │                                                  │
│  📦 OP 管理       │  当前选中菜单的界面                                │
│  📋 Workflow 管理 │                                                  │
│  ⏰ Job 管理      │                                                  │
│  📜 运行历史 ★    │  ← 默认选中，作为首页                              │
│                  │                                                  │
└──────────────────┴──────────────────────────────────────────────────┘
```

### 4.1 左侧菜单栏

| 菜单项 | 说明 |
|-|-|
| Client 管理 | 管理 CLI 适配配置（仅非交互式） |
| OP 管理 | 管理最小可执行单元 |
| Workflow 管理 | 管理 DAG 编排 |
| Job 管理 | 管理持久作业配置 |
| 运行历史 ★ | 查看所有 Job Run（默认首页） |

**设计原则**：

- 一级菜单固定为五个，不增加。
- 无会话管理，无右侧栏。
- **应用启动后默认进入运行历史界面。**

---

## 五、五界面关系图

```text
┌────────────────────┐
│  Client 管理        │
│  （CLI 非交互适配）  │
└─────────┬──────────┘
          │ 执行时通过下拉列表选择
          │ （OP 单次执行 / Workflow 节点配置 / Job target=OP 时创建时选择）
          ▼
┌────────────────────┐        被引用为节点        ┌────────────────────┐
│  OP 管理            │ ─────────────────────────→ │  Workflow 管理      │
│  （最小可执行单元）  │                            │  （DAG 编排）        │
└─────────┬──────────┘                            └─────────┬──────────┘
          │ 单次执行                                      │ 单次执行
          │ 创建虚拟 Job                                  │ 创建虚拟 Job
          ▼                                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Job 层（统一执行载体）                   │
│  ┌──────────────────┐         ┌──────────────────┐              │
│  │  持久 Job         │         │  虚拟 Job         │              │
│  └────────┬─────────┘         └────────┬─────────┘              │
│           └────────────┬───────────────┘                        │
│                        ▼                                        │
│                  Job Run（执行实例）                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
              ┌────────────────────┐
              │  运行历史 ★         │
              │  （默认首页）        │
              └────────────────────┘

附：Workflow 管理 → Client 管理（节点配置时下拉选择 Client）
```

**核心关系**：

```text
Client ←（执行时下拉选择）← OP ← Workflow
                              │
                              └──→ Job（持久 / 虚拟）──→ Job Run ──→ 运行历史（首页）
```

---

## 六、界面引用关系表

| 源界面 | 目标界面 | 关系 | 说明 |
|-|-|-|-|
| Client 管理 | 无上游 | 被执行时选择 | 不引用其他界面 |
| OP 管理 | Client 管理 | 执行时下拉选择 | 按 OP 类型过滤 Client |
| OP 管理 | 运行历史 | 单次执行 | 创建虚拟 Job |
| Workflow 管理 | OP 管理 | 引用 | Workflow 节点引用 OP |
| Workflow 管理 | Client 管理 | 节点配置 | 下拉选择 Client |
| Workflow 管理 | 运行历史 | 单次执行 | 创建虚拟 Job |
| Job 管理 | OP / Workflow | 引用 | Job target |
| Job 管理 | Client 管理 | 创建时选择 | target=OP 时创建 Job 需选 Client |
| Job 管理 | 运行历史 | 手动 / 定时运行 | 使用持久 Job |
| 运行历史 | OP / Workflow / Job / Client | 回溯 | 查看定义 |

---

## 七、统一执行模型

### 7.1 执行来源

```text
执行来源（全部非交互，全部后台运行，全部走 Job）
├── OP 单次执行 ──────→ 虚拟 Job ──┐
├── Workflow 单次执行 ─→ 虚拟 Job ──┤
├── Job 手动运行 ──────→ 持久 Job ──┼──→ Job Run ──→ 运行历史
├── Job 定时运行 ──────→ 持久 Job ──┤
└── 重试（从失败节点） ─→ 持久/虚拟 ─┘
```

### 7.2 执行来源表

| 执行来源 | 触发位置 | Job 形态 | 是否进入运行历史 |
|-|-|-|-|
| OP 单次执行 | OP 列表 | 虚拟 Job | ✅ |
| Workflow 单次执行 | Workflow 列表 | 虚拟 Job | ✅ |
| Job 手动运行 | Job 列表 | 持久 Job | ✅ |
| Job 定时运行 | 后台调度 | 持久 Job | ✅ |
| 重试 | Job / 运行历史 / Workflow 详情 | 持久 / 虚拟 | ✅ |

### 7.3 Job 的两种形态

| 形态 | 来源 | 是否持久化 | 触发方式 |
|-|-|-|-|
| 持久 Job | Job 管理界面创建 | ✅ | 手动 / 定时 |
| 虚拟 Job | OP / Workflow 单次执行时创建 | ❌ | 单次 |

> 说明：Job 定义时触发方式为**手动 / 定时二选一**；但无论哪种，Job 管理界面的 [运行] 按钮都可手动触发一次（定时 Job 也能被手动运行）。

### 7.4 Client 的非交互式约束

> Client 本身可能支持交互式，但本 APP 下只能使用非交互式方式调用。

| 规则 | 说明 |
|-|-|
| CliProfile 只配置非交互式参数 | 使用 headless 参数 |
| 强制 stdin 关闭 | 防止 CLI 进入交互等待 |
| 超时保护 | OP 必须配置 timeout |

### 7.5 交互性传播链（保留占位，当前恒 false）

> `OP.interactive` 字段保留在数据结构和 body 体中占位，默认 false，前端界面不提供人工设置入口。当前版本中它恒为 false，以下传播链作为未来预留语义保留。

```text
Client（强制非交互式）
    ▼
OP.interactive（字段占位，默认 false，界面不暴露）
    ▼
Workflow.interactive = 引用 OP 中任意一个 interactive
    ▼
Job.interactive = target 的 interactive
```

### 7.6 重试模型

> OP 不含 retry。重试在 Workflow 节点级配置。

```typescript
interface NodeRetry {
  on: "failure" | "success";        // 互斥
  max: number;                       // 每轮重试次数
  backoff: "constant" | "linear" | "exponential";
  interval: number;                  // 毫秒
}
```

### 7.7 超时模型

> **超时只属于 OP。任何引用该 OP 的执行，单次执行超时 = OP.timeout。**

| 层级 | 是否有 timeout |
|-|-|
| OP | ✅ |
| Workflow | ❌ |
| WorkflowNode | ❌ |
| Job | ❌ |
| Client | ❌ |

**核心规则**：

| 规则 | 说明 |
|-|-|
| 超时是终止信号 | 不是失败，不参与重试策略 |
| 超时立即终止 | 不走边、不回跳、不重试 |
| 全层级 timeout | Step / Workflow / Job 状态均为 timeout |
| 不可重试 | 超时 Run 不支持 [重试] |
| 可重跑 | 超时 Run 支持 [重跑] |

### 7.8 后台运行与前端获取

> **所有任务在后台运行。单个 OP 完成后写入 DB。前端通过轮询获取状态。**

| 场景 | 前端策略 |
|-|-|
| 运行历史列表（有运行中的 Run） | 每 3~5 秒轮询 |
| 运行历史列表（无运行中的 Run） | 每 30 秒或手动刷新 |
| Run 详情（有运行中的 Step） | 每 2~3 秒轮询 |
| Run 详情（已完成） | 不轮询，手动刷新 |

**不使用**：SSE 事件流、WebSocket。

---

## 八、Client 管理界面

### 8.1 定位

管理 CLI 适配配置，是编排器与具体执行器的**唯一契约**。支持 4 种类型：

| 类型 | 对应执行器 | 用户配置 |
|-|-|-|
| **prompt** | Agent CLI | 完整配置 |
| **bash** | 本地 bash 二进制 | 只指定二进制路径 |
| **python** | 本地 Python 二进制 | 只指定二进制路径 |
| **powershell** | 本地 PowerShell 二进制 | 只指定二进制路径 |

### 8.2 数据结构

```typescript
type ClientType = "prompt" | "bash" | "python" | "powershell";

interface CliProfile {
  id: string;
  name: string;
  description?: string;
  type: ClientType;

  // prompt 类型专用
  command?: string;
  argsTemplate?: string[];               // 支持 {{prompt}}、{{workspace}} 占位符；{{workspace}} 运行时由 Job 工作区注入
  inputMode?: "arg" | "stdin" | "file";   // 内容源统一来自 OP.content
  outputParser?: {
    mode: "text" | "json" | "jsonl";
    jsonPath?: string;
  };
  exitCodeMap?: { success: number[] };

  // bash / python / powershell 类型专用
  binaryPath?: string;

  createdAtMs: bigint;
  updatedAtMs: bigint;
}
```

### 8.3 类型与执行器匹配

| OP 类型 | 可选 Client 类型 |
|-|-|
| Prompt | prompt |
| Bash | bash |
| Python | python |
| PowerShell | powershell |

### 8.4 包装脚本机制（后端实现）

APP 内部硬编码通用包装脚本，运行时临时生成：

| 脚本类型 | 执行方式 | 包装脚本职责 |
|-|-|-|
| Python | 使用 `exec` 执行 | 注入入参变量、捕获出参 |
| Bash | 使用 `source` 命令执行 | 注入入参变量、捕获出参 |
| PowerShell | 使用 `. .` 方式执行 | 注入入参变量、捕获出参 |

### 8.5 列表视图

```text
┌──────────────────────────────────────────────────────────────┐
│  Client 管理                          [＋ 新建] [导入]        │
├──────────────────────────────────────────────────────────────┤
│  🔍 搜索...                                                  │
│  筛选: [全部类型 ▾] [prompt] [bash] [python] [powershell]     │
├──────────────────────────────────────────────────────────────┤
│  🧩 Claude Code     prompt      claude          2天前   [编辑] [复制] [删除] │
│  🧩 Codex CLI       prompt      codex           1周前   [编辑] [复制] [删除] │
│  🧩 本地 Bash        bash        /usr/bin/bash   1周前   [编辑] [复制] [删除] │
│  🧩 本地 Python      python      /usr/bin/python3 1周前  [编辑] [复制] [删除] │
│  🧩 本地 PowerShell  powershell  C:\...\pwsh.exe 1周前  [编辑] [复制] [删除] │
└──────────────────────────────────────────────────────────────┘
```

### 8.6 编辑器视图（prompt 类型）

```text
┌──────────────────────────────────────────────┐
│  ← 返回  编辑: Claude Code                    │
├──────────────────────────────────────────────┤
│  名称: [Claude Code          ]                │
│  描述: [Claude Code CLI 适配  ]                │
│                                              │
│  类型:  (●) Prompt  ( ) Bash  ( ) Python  ( ) PowerShell │
│                                              │
│  ── Prompt 类型配置 ──                        │
│  命令: [claude               ]                │
│  参数模板: ["-p","{{prompt}}","--output-format","json"] │
│  输入方式: [arg ▾]  (arg / stdin / file)      │
│  输出解析: mode [json ▾]  jsonPath [$.result] │
│  退出码语义: 成功 [0]                          │
│                                              │
│           [取消]  [保存]  [测试命令]          │
└──────────────────────────────────────────────┘
```

> 说明：Client **不含超时字段**（超时只属于 OP）；Client **不含工作目录字段**（工作目录只属于 Job 运行时，见 JobDefinition.workspace / JobRun.workspace；参数模板中的 `{{workspace}}` 占位符在运行时由 Job 工作区注入）；inputMode 只决定 prompt 的投递方式，内容源统一来自 OP.content。

### 8.7 编辑器视图（bash / python / powershell 类型）

```text
┌──────────────────────────────────────────────┐
│  ← 返回  编辑: 本地 Bash                      │
├──────────────────────────────────────────────┤
│  名称: [本地 Bash            ]                │
│  描述: [本地 bash 二进制      ]                │
│                                              │
│  类型:  ( ) Prompt  (●) Bash  ( ) Python  ( ) PowerShell │
│                                              │
│  ── Bash 类型配置 ──                          │
│  二进制路径: [/usr/bin/bash    ]  [浏览]       │
│                                              │
│  ℹ 入参 / 出参的注入与提取由 APP 内部的包装脚本处理 │
│                                              │
│           [取消]  [保存]  [测试路径]          │
└──────────────────────────────────────────────┘
```

### 8.8 Client 测试对话框

点击 [测试命令] / [测试路径] 弹出：

```text
┌──────────────────────────────────────┐
│  测试 Client: Claude Code             │
├──────────────────────────────────────┤
│  类型: prompt                         │
│  命令: claude                         │
│  参数: ["-p","hello","--output-format","json"] │
│                                      │
│  [运行测试]                           │
│  ── 结果 ──                           │
│  ✓ 命令可用 / ✗ 未找到命令            │
└──────────────────────────────────────┘
```

### 8.9 导入对话框

```text
┌──────────────────────────────────────┐
│  导入 Client                          │
├──────────────────────────────────────┤
│  选择 YAML 文件                       │
│  ┌────────────────────────────────┐  │
│  │ 📦 claude-code.yaml  [选择文件] │  │
│  └────────────────────────────────┘  │
│  ⚠ 若同名 Client 已存在，导入时将提示冲突处理。 │
│  [取消]  [导入]                       │
└──────────────────────────────────────┘
```

---

## 九、OP 管理界面

### 9.1 定位

管理**最小可执行单元**。

**核心约束**：

1. OP 是最小单元，**不含 retry 字段**。
2. OP **不与 Client 绑定**。
3. OP **不展示 id**。
4. OP 的 **name 全局唯一**。
5. OpInput / OpOutput 的 **type 只支持 string**。
6. OP 有 **版本概念**，默认 v1。
7. **OP 是唯一有 timeout 字段的层级。**

### 9.2 数据结构

```typescript
interface OpDefinition {
  id: string;
  name: string;
  description?: string;
  type: "prompt" | "bash" | "python" | "powershell";
  content: string;
  inputs: OpInput[];
  outputs: OpOutput[];
  interactive: boolean;   // 字段占位，默认 false，界面不暴露
  timeout?: number;
  version: number;
  createdAtMs: bigint;
  updatedAtMs: bigint;
}

interface OpInput {
  name: string;
  type: "string";
  required: boolean;
  default?: string;
  description?: string;
}

interface OpOutput {
  name: string;
  type: "string";
  description?: string;
}
```

### 9.3 列表视图

```text
┌──────────────────────────────────────────────────────────────┐
│  OP 管理                              [＋ 新建] [导入]        │
├──────────────────────────────────────────────────────────────┤
│  🔍 搜索...                                                  │
├──────────────────────────────────────────────────────────────┤
│  📦 check_tests     prompt      v2  入参 1 · 出参 3  2天前   [执行] [编辑] [复制] [导出] [删除] │
│  📦 review          prompt      v2  入参 1 · 出参 1  1周前   [执行] [编辑] [复制] [导出] [删除] │
│  📦 deploy          prompt      v2  入参 1 · 出参 1  2天前   [执行] [编辑] [复制] [导出] [删除] │
│  📦 notify          prompt      v1  入参 1 · 出参 0  2天前   [执行] [编辑] [复制] [导出] [删除] │
│  📦 notify_fail     prompt      v1  入参 0 · 出参 0  2天前   [执行] [编辑] [复制] [导出] [删除] │
│  📦 clean_logs      powershell  v3  入参 1 · 出参 0  1周前   [执行] [编辑] [复制] [导出] [删除] │
│  📦 process_data    python      v3  入参 1 · 出参 1  1月前   [执行] [编辑] [复制] [导出] [删除] │
│  📦 health_check    bash        v1  入参 1 · 出参 1  1月前   [执行] [编辑] [复制] [导出] [删除] │
│  📦 collect_metrics python      v1  入参 1 · 出参 1  1月前   [执行] [编辑] [复制] [导出] [删除] │
│  📦 run_lint        bash        v2  入参 1 · 出参 1  1月前   [执行] [编辑] [复制] [导出] [删除] │
└──────────────────────────────────────────────────────────────┘
```

> 各 OP 入参 / 出参：
> - check_tests：入参 test_cmd；出参 passed、count、result
> - review：入参 test_result；出参 approved
> - deploy：入参 target_env；出参 url
> - notify：入参 message；出参 无
> - notify_fail：入参 无；出参 无
> - clean_logs：入参 endpoint；出参 无
> - process_data：入参 source；出参 count
> - health_check：入参 endpoint；出参 healthy
> - collect_metrics：入参 endpoint；出参 metrics
> - run_lint：入参 target；出参 issues

### 9.4 编辑器视图

**元素顺序**：名称 → 描述 → 超时 → 入参 → 出参 → **类型（选择框）** → **内容（随类型变化）** → 操作

```text
┌──────────────────────────────────────────────┐
│  ← 返回  编辑: check_tests   v2               │
├──────────────────────────────────────────────┤
│  名称: [check_tests        ]                  │
│  描述: [运行测试并报告结果    ]                 │
│                                              │
│  超时: [300s]                                 │
│                                              │
│  入参:  [＋ 添加]                             │
│  ┌────────────────────────────────────────────────┐  │
│  │ name       type    required  default  description │  │
│  │ test_cmd   string  ✓         -        测试命令   │  │
│  └────────────────────────────────────────────────┘  │
│                                              │
│  出参:  [＋ 添加]                             │
│  ┌────────────────────────────────────────────────┐  │
│  │ name     type    description                     │  │
│  │ passed   string  测试是否通过                    │  │
│  │ count    string  通过用例数                      │  │
│  │ result   string  测试结果详情                    │  │
│  └────────────────────────────────────────────────┘  │
│                                              │
│  类型:  (●) Prompt  ( ) Bash  ( ) Python  ( ) PowerShell │
│                                              │
│  内容（Prompt）:                              │
│  ┌────────────────────────────────────────┐  │
│  │ 在当前工作区运行测试，并输出结果 JSON    │  │
│  └────────────────────────────────────────┘  │
│                                              │
│           [取消]  [保存]                      │
└──────────────────────────────────────────────┘
```

**类型选择框**：

| 选项 | 内容区域标题 | 内容语义 |
|-|-|-|
| ( ) Prompt | 内容（Prompt） | prompt 模板 |
| ( ) Bash | 内容（Bash 脚本） | bash 脚本 |
| ( ) Python | 内容（Python 脚本） | Python 脚本 |
| ( ) PowerShell | 内容（PowerShell 脚本） | PowerShell 脚本 |

### 9.5 保存时的版本确认

```text
┌──────────────────────────────────────┐
│  保存 OP: check_tests                 │
├──────────────────────────────────────┤
│  当前版本: v2                         │
│  是否更新版本？                        │
│  ○ 更新版本（v2 → v3）                │
│  ● 不更新版本（覆盖 v2）               │ ← 默认选中
│           [取消]  [确认]              │
└──────────────────────────────────────┘
```

### 9.6 单次执行流程

```text
列表界面点击 [执行]
        ▼
┌──────────────────────────────────────┐
│  执行: check_tests                    │
├──────────────────────────────────────┤
│  工作区: [/path/to/workspace]  [选择] │
│  入参: test_cmd: [npm run test ] *    │
│  选择 Client:                         │
│  ┌────────────────────────────────┐  │
│  │ Claude Code              ▾     │  │  ← 按 OP 类型动态过滤
│  └────────────────────────────────┘  │
│           [取消]  [执行]              │
└──────────────────────────────────────┘
        ▼
┌──────────────────────────────────────┐
│  二次确认                             │
│  即将执行: check_tests                │
│  工作区: /path/to/workspace           │
│  Client: Claude Code                  │
│  入参: test_cmd: npm run test         │
│           [取消]  [确认执行]          │
└──────────────────────────────────────┘
        ▼
创建虚拟 Job → 后台执行 → Job Run 进入运行历史
```

### 9.7 导出 YAML

| 操作 | 说明 |
|-|-|
| 点击 [导出] | 弹出导出对话框，选择目标目录 |
| 导出内容 | OP 为 YAML 文件，文件名 `{op-name}-v{version}.yaml` |
| 导出位置 | 用户选择的目录下 |

```text
┌──────────────────────────────────────┐
│  导出 OP: check_tests                 │
├──────────────────────────────────────┤
│  文件名: [check_tests-v2.yaml]        │
│  导出目录: [/path/to/export]  [选择]  │
│           [取消]  [导出]              │
└──────────────────────────────────────┘
```

---

## 十、Workflow 管理界面

### 10.1 定位

管理 **DAG 编排**。Workflow 是"程序"，引用 OP，绑定参数，定义流转。

**核心能力**：

- 引用多个 OP，绑定参数，定义流转。
- 有独立的**入参**和**出参**。
- **编辑器左侧提供 OP 库，可搜索、可拖动。**
- **有固定的 Start 和 End 节点。**

### 10.2 数据结构

```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: number;
  inputs: WorkflowInput[];
  outputs: WorkflowOutput[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAtMs: bigint;
  updatedAtMs: bigint;
}

interface WorkflowInput {
  name: string;
  type: "string";
  required: boolean;
  default?: string;
  description?: string;
}

interface WorkflowOutput {
  name: string;
  from: { nodeId: string; outputName: string };
  description?: string;
}

type WorkflowNodeKind = "start" | "op" | "end";

interface WorkflowNode {
  nodeId: string;                   // 32 位 UUID
  kind: WorkflowNodeKind;           // 节点类型

  // kind === "op" 时的字段
  opId?: string;
  opVersion?: number;
  clientId?: string;
  bindings?: Record<string, ParamBinding>;
  retry?: NodeRetry;

  // kind === "start" | "end" 时，OP 字段均不存在
}

type ParamBinding =
  | { kind: "node_output"; nodeId: string; name: string }
  | { kind: "workflow_input"; name: string }
  | { kind: "literal"; value: string };

interface WorkflowEdge {
  from: string;
  to: string;
  condition: EdgeCondition;
}

type EdgeCondition =
  | { kind: "on_success" }          // 绿色锚点
  | { kind: "on_failure" }          // 红色锚点
  | { kind: "always" };             // 蓝色锚点
```

### 10.3 Start / End 固定节点

**核心原则**：

> **每个 Workflow 都有一个固定的 Start 节点和一个固定的 End 节点。这两个节点不绑定任何 OP，只标识 Workflow 的开始和结束。**

| 节点 | 语义 | 绑定 OP |
|-|-|-|
| **Start** | Workflow 的入口，执行从此开始 | ❌ 不绑定 |
| **End** | Workflow 的出口，执行流到达即完成 | ❌ 不绑定 |

**关键点**：

- 每个 Workflow **有且仅有一个** Start 节点。
- 每个 Workflow **有且仅有一个** End 节点。
- Start / End **不可删除、不可复制**。
- Start / End **不消耗时间、不产生 StepRecord**。
- Start / End 在画布上有独立的图标和样式。

**节点字段约束**：

| kind | opId | opVersion | clientId | bindings | retry |
|-|-|-|-|-|-|
| start | ❌ | ❌ | ❌ | ❌ | ❌ |
| op | ✅ 必填 | ✅ 必填 | ✅ 可选 | ✅ 必填 | ✅ 可选 |
| end | ❌ | ❌ | ❌ | ❌ | ❌ |

**锚点规则**：

| 节点类型 | 左侧入边锚点 | 右侧出边锚点 |
|-|-|-|
| Start | ❌ 无 | 🟢 绿色（单一） |
| OP 节点 | 🔴🟢🔵 均可入边 | 🔴 红 / 🟢 绿 / 🔵 蓝（三色） |
| End | 🔴🟢🔵 均可入边 | ❌ 无 |

**Start / End 节点样式**：

| 节点 | 图标 | 形状 | 颜色 |
|-|-|-|-|
| Start | ▶ | 圆形 / 圆角矩形 | 🟢 绿色 |
| End | ◉ | 圆形 / 圆角矩形 | 🟢 绿色 |

**默认布局**：新建 Workflow 时，画布默认放置 Start 和 End 两个节点：

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  画布                                                                     │
│                                                                          │
│  ┌────────┐                                          ┌────────┐          │
│  │ ▶ Start│                                          │  End ◉ │          │
│  └────────┘                                          └────────┘          │
│    (绿色圆形)                                          (绿色圆形)         │
│                                                                          │
│  ℹ 从 OP 库拖动 OP 到画布创建节点，连接到 Start 和 End                     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 10.4 参数绑定

**参数绑定来源**：

| 来源 | 说明 |
|-|-|
| 任意前置节点的出参 | 只要该节点在当前节点之前已可执行 |
| Workflow 入参 | 来自 Workflow 定义中的 inputs |
| 字面量 | 手动填写的字符串 |

### 10.5 汇聚策略（由 DAG 边决定）

**不单独配置汇聚策略**，由 DAG 边决定：

| 场景 | 汇聚语义 |
|-|-|
| 多个节点汇聚到一个节点 | 该节点需要所有上游执行完才执行 |
| 一个节点扇出到多个节点 | 该节点执行完后可同时执行所有下游 |

### 10.6 节点锚点（三色锚点）

**每个 OP 节点右侧有 3 个锚点**：

| 锚点 | 颜色 | 语义 | 边触发条件 |
|-|-|-|-|
| 失败锚点 | 🔴 红色 | 失败时向下走 | on_failure |
| 成功锚点 | 🟢 绿色 | 成功时向下走 | on_success |
| 通用锚点 | 🔵 蓝色 | 无论成功失败都往下走 | always |

**连线交互**：从锚点拖出，连到目标节点后生成一条边，边的触发条件由**出发锚点颜色**决定，并写入 edges 数据。

### 10.7 节点重试策略

```typescript
interface NodeRetry {
  on: "failure" | "success";        // 互斥
  max: number;
  backoff: "constant" | "linear" | "exponential";
  interval: number;                  // 毫秒
}
```

| on | 语义 |
|-|-|
| failure | 失败时重试；成功一次即停止走成功边；连续失败 N 次后走失败边 |
| success | 成功时重试；连续成功 N 次才停止走成功边；任意失败立即走失败边 |

### 10.8 列表视图

```text
┌──────────────────────────────────────────────────────────────┐
│  Workflow 管理                        [＋ 新建] [导入]        │
├──────────────────────────────────────────────────────────────┤
│  🔍 搜索...                                                  │
│  筛选: [全部 ▾] [需要更新] [已同步]                           │
├──────────────────────────────────────────────────────────────┤
│  📋 deploy_workflow   v2  5 节点 · 入参 1 · 出参 1  2天前  [执行] [编辑] [复制] [导出] [删除] │
│  📋 log_analysis      v1  5 节点 · 入参 1 · 出参 1  1周前  ⚠ 需要更新  [执行置灰] [编辑] [复制] [导出] [删除] │
│  📋 code_review       v3  5 节点 · 入参 1 · 出参 1  1月前  [执行] [编辑] [复制] [导出] [删除] │
└──────────────────────────────────────────────────────────────┘
```

### 10.9 编辑器视图（三栏布局）

**布局**：顶部基础信息 + 入参 / 出参；中间三栏（**左侧 OP 库** + **中间画布** + **右侧节点详情面板**）。

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  ← 返回  编辑: deploy_workflow  v2  [保存] [校验]                                        │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  名称: [deploy_workflow       ]  描述: [部署流程            ]                             │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  Workflow 入参:  [＋ 添加]                                                                │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ name          type     required  default     description                            │  │
│  │ target_env    string   ✓         -           目标环境                               │  │
│  └────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
│  Workflow 出参:  [＋ 添加]                                                                │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ name          from (nodeId.outputName)            description                       │  │
│  │ deploy_url    node_deploy.url                    部署后的 URL                       │  │
│  └────────────────────────────────────────────────────────────────────────────────────┘  │
├──────────────────┬───────────────────────────────────────────┬───────────────────────────┤
│  OP 库            │  画布                                      │  节点详情面板              │
│  ┌────────────┐  │                                            │                           │
│  │ 🔍 搜索... │  │  ┌────────┐                                │  ┌─────────────────────┐ │
│  └────────────┘  │  │ ▶ Start│🟢                               │  │  节点: node_deploy   │ │
│                  │  └────────┘                                │  │  OP:   deploy        │ │
│  📦 check_tests  │       │                                    │  │  timeout = 120s      │ │
│  📦 review       │       │ on_success                         │  │  Client: [Claude ▾]  │ │
│  📦 deploy       │       ▼                                    │  │                      │ │
│  📦 notify       │  ┌──────────────┐                          │  │  参数绑定:            │ │
│  📦 process_data │  │ check_tests  │🟢                        │  │  target_env:         │ │
│  📦 clean_logs   │  └──────────────┘🔵                        │  │    ○ 前置节点出参:    │ │
│  📦 ...          │       │🔴                                  │  │      [选择 ▾]        │ │
│                  │       │                                    │  │    ○ Workflow 入参:  │ │
│  ────────────    │       │ on_success                         │  │      [target_env ▾]  │ │
│  ℹ 拖动 OP 到画布 │       ▼                                    │  │    ● 字面量: [staging]│ │
│  ℹ 释放创建节点   │  ┌──────────┐                              │  │                      │ │
│                  │  │  deploy  │🟢  ← 选中                    │  │  重试策略:            │ │
│                  │  └──────────┘🔵                             │  │  on: [failure ▾]     │ │
│                  │       │🔴                                  │  │  max: [3]            │ │
│                  │       │                                    │  │  backoff: [exp ▾]    │ │
│                  │       │ on_success                         │  │  interval: [1000]    │ │
│                  │       ▼                                    │  │                      │ │
│                  │  ┌──────────┐                              │  │  ℹ 超时由 OP 定义     │ │
│                  │  │  notify  │🟢                            │  │  （120s）             │ │
│                  │  └──────────┘🔵                             │  └─────────────────────┘ │
│                  │       │🔴                                  │                           │
│                  │       │                                    │                           │
│                  │       │ on_success                         │                           │
│                  │       ▼                                    │                           │
│                  │  ┌────────┐                                │                           │
│                  │  │ End ◉  │                                │                           │
│                  │  └────────┘                                │                           │
└──────────────────┴───────────────────────────────────────────┴───────────────────────────┘
```

**编辑器结构**：

| 区域 | 内容 |
|-|-|
| 顶部 | 名称、描述、Workflow 入参、Workflow 出参 |
| **左侧 OP 库** | **列出所有 OP，支持搜索，支持拖动到画布** |
| 中间画布 | 节点（Start / OP / End）、边、三色锚点 |
| 右侧节点详情面板 | 选中 node 的配置 |

### 10.10 OP 库

**OP 库定位**：列出所有可用的 OP，供用户拖动到画布创建节点。

| 功能 | 说明 |
|-|-|
| **列出所有 OP** | 展示所有 OP 的 name、类型、版本 |
| **关键字搜索** | 支持按 OP name 搜索过滤 |
| **拖动到画布** | 从库中拖动 OP，释放到画布上创建新节点 |
| **搜索实时过滤** | 输入关键字时实时过滤列表 |
| **展示类型图标** | 按 OP 类型展示不同图标（prompt / bash / python / powershell） |

**OP 库条目展示**：

```text
┌────────────────────┐
│  📦 check_tests    │
│     prompt · v2    │
├────────────────────┤
│  📦 review         │
│     prompt · v2    │
├────────────────────┤
│  📦 clean_logs     │
│     powershell · v3│
└────────────────────┘
```

**拖动行为**：

| 操作 | 行为 |
|-|-|
| 从 OP 库拖动 OP | 光标变为"复制/新建"状态 |
| 释放到画布空白处 | 创建一个新的节点，引用该 OP 的最新版本，**并自动带出该 OP 的全部入参（未绑定状态）** |
| 释放到画布已有节点上 | 不创建，提示"此处已有节点" |
| 释放到画布外 | 不创建，取消拖动 |

**搜索行为**：

| 操作 | 行为 |
|-|-|
| 输入关键字 | 实时过滤 OP 列表（模糊匹配 name） |
| 清空关键字 | 恢复显示所有 OP |
| 无匹配结果 | 显示"无匹配的 OP" |

### 10.11 节点详情面板

**面板行为**：

| 操作 | 行为 |
|-|-|
| 点击画布中的 node | 右侧展示该 node 配置 |
| 切换选中另一个 node | 右侧切换到新 node |
| 点击空白处 | 保持上一个选中（或显示空状态） |
| 面板可拖拽调整宽度 | 拖拽中间分隔线 |
| 面板可收起 | 点击收起按钮，画布扩展 |

**未选中 node 时的空状态**：

```text
┌──────────────────────────────────┐
│  节点详情                         │
│                                  │
│  请在画布中选择一个节点            │
│  以查看和编辑其配置                │
│                                  │
└──────────────────────────────────┘
```

**OP 节点详情面板内容**：

| 字段 | 说明 |
|-|-|
| 节点 ID | nodeId（展示用） |
| OP | 引用的 OP（含超时时间，只读） |
| Client | 下拉列表选择 |
| 参数绑定 | 每个入参的绑定来源，**可编辑**（前置节点出参下拉选 `nodeId.outputName`、Workflow 入参下拉选、字面量输入框） |
| 重试策略 | on / max / backoff / interval |
| ⚠ 提示 | 若 OP 已更新，显示提示条 |

**Start 节点详情面板**：

```text
┌──────────────────────────────────┐
│  节点: Start                      │
│  类型: 开始节点（系统节点）         │
│                                  │
│  ℹ 无需配置                       │
│  ℹ 从右侧 🟢 锚点连线到后续节点    │
│                                  │
└──────────────────────────────────┘
```

**End 节点详情面板**：

```text
┌──────────────────────────────────┐
│  节点: End                        │
│  类型: 结束节点（系统节点）         │
│                                  │
│  ℹ 无需配置                       │
│  ℹ 从任意节点连线到 End 左侧入边   │
│                                  │
└──────────────────────────────────┘
```

### 10.12 单次执行流程（从列表界面）

```text
列表界面点击 [执行]
        ▼
┌──────────────────────────────────────┐
│  执行: deploy_workflow                │
├──────────────────────────────────────┤
│  工作区: [/path/to/workspace]  [选择] │
│  Workflow 入参:                       │
│  target_env: [staging         ] *    │
│           [取消]  [执行]              │
└──────────────────────────────────────┘
        ▼
┌──────────────────────────────────────┐
│  二次确认                             │
│  即将执行: deploy_workflow            │
│  工作区: /path/to/workspace           │
│  Workflow 入参: target_env: staging   │
│           [取消]  [确认执行]          │
└──────────────────────────────────────┘
        ▼
创建虚拟 Job → 后台执行 → Job Run 进入运行历史
（jobKind=virtual, triggeredBy=single_workflow）
```

### 10.13 导出 ZIP

**ZIP 结构**：

```text
deploy_workflow-v2.zip
├── manifest.json
├── workflow.yaml
└── ops/
    ├── check_tests.yaml
    ├── review.yaml
    ├── deploy.yaml
    └── notify.yaml
```

### 10.14 校验规则

| 校验 | 说明 |
|-|-|
| 有且仅有一个 Start | 否则校验不通过 |
| 有且仅有一个 End | 否则校验不通过 |
| Start 无入边 | 否则校验不通过 |
| End 无出边 | 否则校验不通过 |
| Start 至少一条出边 | 否则校验不通过 |
| End 至少一条入边 | 否则校验不通过 |
| 所有 OP 节点从 Start 可达 | 否则校验不通过 |
| 所有 OP 节点能到达 End | 否则校验不通过 |
| DAG 无环（除循环回跳） | 循环回跳由重试 + 条件边实现，不算环 |
| 所有 required 入参必须有来源 | 否则校验不通过 |
| 有多条入边的节点必须有明确汇聚 | 由 DAG 边决定 |

**校验失败时的提示**：

| 情况 | 提示 |
|-|-|
| 缺少 Start | "Workflow 缺少 Start 节点" |
| 缺少 End | "Workflow 缺少 End 节点" |
| Start 有入边 | "Start 节点不能有入边" |
| End 有出边 | "End 节点不能有出边" |
| Start 无出边 | "Start 节点至少需要一条出边" |
| End 无入边 | "End 节点至少需要一条入边" |
| 节点从 Start 不可达 | "节点 X 从 Start 不可达" |
| 节点无法到达 End | "节点 X 无法到达 End" |

---

## 十一、Job 管理界面

### 11.1 定位

管理**持久 Job**。

### 11.2 数据结构

```typescript
interface JobDefinition {
  id: string;
  name: string;
  description?: string;
  kind: "persistent";
  version: number;
  target:
    | { kind: "op"; opId: string; opVersion: number }
    | { kind: "workflow"; workflowId: string; workflowVersion: number };
  clientId?: string;          // target 为 OP 时必填（创建时选择）
  workspace: string;
  inputs: Record<string, string>;
  trigger:                     // 手动 / 定时二选一
    | { kind: "manual" }
    | { kind: "schedule"; cron: string; enabled: boolean };
  concurrency: "skip" | "queue" | "parallel";
  createdAtMs: bigint;
  updatedAtMs: bigint;
}
```

> 说明：
> - `clientId` 仅当 `target.kind === "op"` 时需要，创建 Job 时选择。
> - 定时 Job 也可在 Job 管理界面通过 [运行] 按钮手动触发一次。

### 11.3 列表视图

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  Job 管理                                        [＋ 新建] [导入]             │
├──────────────────────────────────────────────────────────────────────────────┤
│  🔍 搜索...                                                                  │
│  筛选: [全部 ▾] [需要更新] [已同步] [最近执行失败]                            │
├──────────────────────────────────────────────────────────────────────────────┤
│  ⏰ daily_cleanup                                                             │
│     OP: clean_logs  v2  非交互  0 2 * * *  ✅ 启用  ⚠ 需要更新               │
│     最近执行: ✓ 成功  3.2s  1周前                                             │
│     [运行置灰] [编辑] [导出] [禁用] [删除]                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│  ⏰ hourly_check                                                              │
│     Workflow: deploy_workflow  v1  非交互  0 * * * *  ✅ 启用  ⚠ 需要更新     │
│     最近执行: ✗ 失败  8.1s  2小时前                                            │
│     [运行置灰] [重试置灰] [编辑] [导出] [禁用] [删除]                         │
├──────────────────────────────────────────────────────────────────────────────┤
│  📌 manual_deploy                                                             │
│     Workflow: deploy_workflow  v2  非交互  手动  —                            │
│     最近执行: ✓ 成功  15.3s  3小时前                                           │
│     [运行] [编辑] [导出] [删除]                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│  ⏰ weekly_report                                                             │
│     Workflow: log_analysis  v1  非交互  0 9 * * 1  ⏸ 已禁用  ⚠ 需要更新       │
│     最近执行: ✓ 成功  22.7s  5天前                                            │
│     [运行置灰] [编辑] [导出] [启用] [删除]                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│  ⏰ data_sync                                                                 │
│     OP: process_data  v2  非交互  0 3 * * *  ✅ 启用  ⚠ 需要更新              │
│     最近执行: ✗ 失败  4.1s  5小时前                                            │
│     [运行置灰] [编辑] [导出] [禁用] [删除]                                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 11.4 编辑器视图（无超时字段）

```text
┌──────────────────────────────────────────────┐
│  ← 返回  编辑: daily_cleanup   v2             │
├──────────────────────────────────────────────┤
│  名称: [daily_cleanup         ]                │
│  描述: [每日日志清理           ]                │
│                                              │
│  目标类型:                                    │
│  ● 单个 OP                                    │
│    OP: [clean_logs ▾]                         │
│    Client: [本地 PowerShell ▾]  ← target=OP 时创建选择 │
│    ℹ 超时由 OP 定义                            │
│  ○ 整个 Workflow                              │
│    Workflow: [选择 ▾]                         │
│    ℹ 超时由各节点引用的 OP 定义                 │
│                                              │
│  工作区: [/path/to/workspace]                 │
│  初始入参: endpoint: [https://...]            │
│  触发方式: ● 手动   ○ 定时 Cron: [0 * * * *] ✓ │
│  并发策略: [skip ▾]                           │
│                                              │
│  ℹ Job 不设超时，超时由 OP 定义                │
│                                              │
│           [取消]  [保存]                      │
└──────────────────────────────────────────────┘
```

### 11.5 手动运行流程

```text
列表界面点击 [运行]
        ▼
┌──────────────────────────────────────┐
│  确认执行: daily_cleanup              │
├──────────────────────────────────────┤
│  即将执行:                            │
│    OP: clean_logs                    │
│  工作区: /path/to/workspace           │
│  入参: endpoint: https://...          │
│  触发来源: 手动                       │
│           [取消]  [确认执行]          │
└──────────────────────────────────────┘
        ▼
创建 Job Run → 后台执行 → 进入运行历史
```

### 11.6 定时运行流程

```text
Cron 触发 → 检查并发策略 → 检查交互性 → 创建 Job Run → 后台执行
```

### 11.7 导入导出

| 类型 | 格式 |
|-|-|
| OP | YAML（弹窗选目录导出） |
| Workflow | ZIP |
| Job | ZIP |

**Job 导出 ZIP 结构**：

```text
manual_deploy-v2.zip
├── manifest.json
├── job.yaml
├── workflows/
│   └── deploy_workflow.yaml
└── ops/
    ├── check_tests.yaml
    └── ...
```

---

## 十二、运行历史界面（默认首页）

### 12.1 定位

**运行历史是默认首页，是全局的 Job Run 管理视图。** 由三个子界面组成。

### 12.2 三个子界面结构

```text
┌─────────────────────────────────────────────────────────┐
│  第一层：Job 运行历史列表（主视图，默认首页）             │
└─────────────────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌────────────────────┐  ┌────────────────────────────┐
│ 第二层 A：          │  │ 第二层 B：                  │
│ OP 执行详情         │  │ Workflow 执行详情            │
└────────────────────┘  └──────────────┬─────────────┘
                                       ▼
                            ┌────────────────────┐
                            │ 第三层：            │
                            │ OP 执行详情         │
                            └────────────────────┘
```

### 12.3 数据结构

```typescript
type RunStatus =
  | "pending" | "running" | "success" | "failed"
  | "cancelled" | "timeout" | "interrupted";

interface JobRun {
  id: string;
  jobId: string;
  jobKind: "persistent" | "virtual";
  jobVersion?: number;
  triggeredBy: "manual" | "schedule" | "single_op" | "single_workflow" | "retry";
  target:
    | { kind: "op"; opId: string; opVersion: number }
    | { kind: "workflow"; workflowId: string; workflowVersion: number };
  inputs: Record<string, string>;
  workspace: string;
  status: RunStatus;
  terminatedBy?: "timeout" | "cancelled" | "error";
  timeoutStepId?: string;
  timeoutOpName?: string;
  opResult?: OpRunResult;
  workflowResult?: WorkflowRunResult;
  steps: StepRecord[];
  retryFromRunId?: string;
  retryFromStepId?: string;
  startedAtMs: bigint;
  finishedAtMs?: bigint;
  duration?: number;
}

type StepStatus =
  | "pending" | "running" | "success" | "failed" | "timeout" | "skipped";

interface StepRecord {
  stepId: string;
  opId: string;
  opVersion: number;
  clientId?: string;
  status: StepStatus;
  inputs: Record<string, string>;
  outputs?: Record<string, string>;
  rawOutput?: string;
  exitCode?: number;
  error?: string;
  timeoutMs?: number;
  timedOut?: boolean;
  processRecord?: ProcessRecord;
  attempts?: StepAttempt[];
  startedAtMs: bigint;
  finishedAtMs?: bigint;
  duration?: number;
}
```

### 12.4 第一层：Job 运行历史列表

```text
┌──────────────────────────────────────────────────────────────┐
│  运行历史                              [刷新] [自动刷新: 开]  │
├──────────────────────────────────────────────────────────────┤
│  🔍 搜索 OP / Workflow / Job 名称 / 状态 / 版本...             │
│  筛选: [全部类型 ▾] [全部来源 ▾] [全部触发 ▾]                  │
│         [全部状态 ▾] [全部工作区 ▾] [全部版本 ▾] [时间 ▾]       │
├──────────────────────────────────────────────────────────────┤
│  📦 check_tests   OP v2  成功  12.3s  2分钟前                 │
│     来源: 虚拟 Job / 单次执行                                 │
│     [查看] [重跑]                                             │
├──────────────────────────────────────────────────────────────┤
│  📋 deploy_workflow  Workflow v2  运行中  step 3/5  5分钟前   │
│     来源: 虚拟 Job / 单次执行                                 │
│     当前节点: node_deploy                                     │
│     [查看] [终止]                                             │
├──────────────────────────────────────────────────────────────┤
│  ⏰ hourly_check   Job v1  失败  8.1s  2小时前   ← 失败        │
│     来源: 持久 Job / 手动（手动触发定时 Job）                 │
│     target: Workflow deploy_workflow v1                      │
│     失败节点: node_deploy (step 3/5)                          │
│     ⚠ 需要更新，无法重试                                       │
│     [查看] [重试置灰] [重跑]                                   │
├──────────────────────────────────────────────────────────────┤
│  📋 deploy_workflow  Workflow v2  超时  137.5s  昨天 23:40    │
│     来源: 持久 Job / 定时                                     │
│     超时节点: node_deploy · 引用 OP deploy（timeout = 120s）   │
│     [查看] [重跑]                                             │
├──────────────────────────────────────────────────────────────┤
│  ⏰ daily_cleanup   Job v2  成功  3.2s  1周前                  │
│     来源: 持久 Job / 定时                                     │
│     target: OP clean_logs v2                                 │
│     [查看] [重跑]                                             │
├──────────────────────────────────────────────────────────────┤
│  ⏰ data_sync   Job v2  失败  4.1s  5小时前                    │
│     来源: 持久 Job / 定时                                     │
│     target: OP process_data v2                               │
│     ⚠ 版本已更新（失败时 v2 / 当前 v3），无法重试，请使用 [重跑] │
│     [查看] [重跑]                                             │
└──────────────────────────────────────────────────────────────┘
```

**操作按钮**：

| 按钮 | 说明 | 展示条件 |
|-|-|-|
| [查看] | 查看 Run 详情 | 始终 |
| [重跑] | 从头重新执行（用最新版本），**对 OP target 和 Workflow target 都可用** | 非运行中 |
| [终止] | 终止正在运行的 Run | 运行中 |
| [重试] | 从失败 OP 开始重试 | **仅 target=Workflow** + 失败（非超时）+ 版本一致 + Workflow.needsUpdate=false + Job.needsUpdate=false |

### 12.5 第二层 A：OP 执行详情

```text
┌──────────────────────────────────────────────────────────┐
│  ← 返回  执行详情: check_tests                            │
├──────────────────────────────────────────────────────────┤
│  【执行信息】                                             │
│  ├ 类型: OP                                              │
│  ├ 名称: check_tests                                     │
│  ├ 执行版本: v2  ← 快照                                  │
│  ├ 当前版本: v2                                          │
│  ├ 状态: ✓ 成功                                          │
│  ├ 耗时: 12.3s                                           │
│  ├ 工作区: /path/to/workspace                            │
│  └ 触发: 虚拟 Job / 单次执行                              │
│                                                          │
│  【入参】                                                 │
│  test_cmd: npm run test                                  │
│                                                          │
│  【正文】                                                 │
│  在当前工作区运行测试，并输出结果 JSON                     │
│                                                          │
│  【输出】                                                 │
│  23 tests passed, 0 failed                               │
│                                                          │
│  【出参】                                                 │
│  passed: true                                            │
│  count:  23                                              │
│  result: {"passed":true,"count":23}                      │
└──────────────────────────────────────────────────────────┘
```

> 说明：OP 执行详情页以 `check_tests` 为静态示例内容，不随 OP 变化。

### 12.6 第二层 B：Workflow 执行详情

**布局**：画布 + 节点详情面板。**无 OP 库**（执行历史是只读的，不需要新增节点）。

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  ← 返回  执行详情: deploy_workflow                                        │
├──────────────────────────────────────────────────────────────────────────┤
│  【执行信息】                                                             │
│  ├ 类型: Workflow                                                        │
│  ├ 名称: deploy_workflow                                                 │
│  ├ 执行版本: v1  ← 快照                                                   │
│  ├ 当前版本: v2                                                          │
│  ├ 状态: ✗ 失败                                                          │
│  ├ 耗时: 8.1s                                                            │
│  └ 触发: 持久 Job / 手动                                                  │
│                                                                          │
│  ⚠ 该 Workflow 执行失败。失败节点: node_deploy                            │
├─────────────────────────────────────────────┬────────────────────────────┤
│  画布（只读展示执行状态）                     │  节点详情                   │
│                                             │                            │
│  ┌────────┐                                 │  节点: node_deploy          │
│  │ ▶ Start│  🟢 已完成                       │  OP:   deploy              │
│  └────────┘                                 │  执行版本: OP v2            │
│       │                                     │  状态: ✗ 失败               │
│       ▼                                     │  耗时: 2.1s                 │
│  ┌──────────────┐                           │  退出码: 1                  │
│  │ check_tests  │  🟢 成功                  │                            │
│  └──────────────┘                           │  [重试] ← 从此节点开始重试  │
│       │                                     │  [查看 OP 执行详情]         │
│       ▼                                     │                            │
│  ┌──────────┐                               │                            │
│  │  review  │  🟢 成功                      │                            │
│  └──────────┘                               │                            │
│       │                                     │                            │
│       ▼                                     │                            │
│  ┌──────────┐                               │                            │
│  │  deploy  │  🔴 失败  ← 选中              │                            │
│  └──────────┘                               │                            │
│       │                                     │                            │
│       ▼                                     │                            │
│  ┌──────────┐                               │                            │
│  │  notify  │  ⚪ 未执行                    │                            │
│  └──────────┘                               │                            │
│       │                                     │                            │
│       ▼                                     │                            │
│  ┌────────┐                                 │                            │
│  │ End ◉  │  ⚪ 未到达                       │                            │
│  └────────┘                                 │                            │
└─────────────────────────────────────────────┴────────────────────────────┘
```

> 说明：[重试] 按钮位于**右侧节点详情面板内**（失败节点），顶部操作区不放置 [重试]。

**节点状态展示（边框颜色）**：

| 状态 | 边框 | 图标 |
|-|-|-|
| 成功 | 🟢 绿框 | ✓ |
| 失败 | 🔴 红框 | ✗ |
| 超时 | 🟠 橙框 | ⏱ |
| 运行中 | 🟡 黄框 | ● |
| 未执行 / 跳过 | ⚪ 灰框 | ⊘ |

**Start / End 在运行历史中的状态**：

| 状态 | 图标 | 说明 |
|-|-|-|
| Start 已开始 | 🟢 绿框 | Workflow 已经开始 |
| Start 未开始 | ⚪ 灰框 | Workflow 未开始（理论不会发生） |
| End 已到达 | 🟢 绿框 | Workflow 成功完成 |
| End 未到达 | ⚪ 灰框 | Workflow 未完成 |

**Start / End 不进入步骤列表**：

```text
┌──────────────────────────────────────────┐
│  Run: deploy_workflow (失败)              │
├──────────────────────────────────────────┤
│  步骤:                                    │
│  ├ node_check_tests  ✓ 成功  12.3s        │
│  ├ node_review       ✓ 成功  5.2s         │
│  ├ node_deploy       ✗ 失败  2.1s         │
│  └ node_notify       ⊘ 未执行             │
│                                          │
│  （Start 和 End 不出现在步骤列表中）       │
└──────────────────────────────────────────┘
```

### 12.7 第三层：从 Workflow 进入 OP 执行详情

与第二层 A 完全一致，唯一差异：

| 差异点 | 从列表进入 | 从 Workflow 进入 |
|-|-|-|
| 返回按钮 | 返回列表 | 返回 Workflow 执行详情 |
| 触发字段 | Job 触发信息 | Workflow + 节点名 |

### 12.8 重试机制

#### 12.8.1 三个重试入口

| 入口 | 位置 |
|-|-|
| 1 | Job 管理界面列表的 [重试] 按钮 |
| 2 | 运行历史界面列表的 [重试] 按钮 |
| 3 | Workflow 运行详情界面失败节点详情面板上的 [重试] 按钮 |

#### 12.8.2 重试前提条件（五条件）

| 条件 | 说明 |
|-|-|
| target 为 Workflow | 只有 Workflow 才有"从失败 OP 开始"的概念 |
| 最近一次执行失败（非超时） | 超时不可重试 |
| 失败 Run 的版本 = 当前最新版本 | 版本一致才允许重试 |
| Workflow.needsUpdate = false | 无需更新 |
| Job.needsUpdate = false | 无需更新 |

#### 12.8.3 版本一致性判断

```text
失败 Run 的版本快照 vs 当前最新版本

如果 快照版本 != 当前版本:
  → 不允许重试
  → 提示："版本已更新，无法重试。请使用 [重跑]。"

如果 快照版本 == 当前版本:
  → 允许重试
  → 使用最新版本重试
```

#### 12.8.4 重试对话框

```text
┌──────────────────────────────────────┐
│  重试: hourly_check                   │
├──────────────────────────────────────┤
│  失败信息:                            │
│    执行时间: 2小时前                   │
│    失败节点: node_deploy (step 3/5)   │
│    失败原因: exit code 1              │
│                                      │
│  重试方式:                            │
│    从失败节点开始重试（固定）           │
│                                      │
│  版本使用:                            │
│    使用最新版本（固定）                 │
│                                      │
│           [取消]  [确认重试]          │
└──────────────────────────────────────┘
```

#### 12.8.5 重试 vs 重跑

| 维度 | 重试 | 重跑 |
|-|-|-|
| 起始位置 | 从失败 step 开始 | 从头开始 |
| 版本使用 | 最新版本（= 快照版本） | 最新版本（固定） |
| 前提条件 | 五条件（见 12.8.2） | 无版本限制 |
| 触发位置 | Job / 运行历史 / Workflow 详情（失败节点面板） | 运行历史 / OP 执行详情 / Workflow 执行详情 |
| 适用 target | 仅 Workflow | OP / Workflow |
| 超时 Run | ❌ 不支持 | ✅ 支持 |

### 12.9 超时终止的展示

```text
┌──────────────────────────────────────────┐
│  Run: deploy_workflow (超时)              │
├──────────────────────────────────────────┤
│  执行信息:                                │
│  ├ 类型: Workflow                        │
│  ├ 名称: deploy_workflow                 │
│  ├ 执行版本: v2                          │
│  ├ 状态: ⏱ 超时                          │
│  ├ 耗时: 137.5s                          │
│  └ 触发: 持久 Job / 定时                  │
│                                          │
│  超时信息:                                │
│  ├ 超时节点: node_deploy                 │
│  ├ 引用 OP: deploy (timeout = 120s)      │
│  └ 终止原因: 单次执行超过 OP 超时时间      │
│                                          │
│  步骤:                                    │
│  ├ node_check       ✓ 成功  12.3s        │
│  ├ node_review      ✓ 成功  5.2s         │
│  ├ node_deploy      ⏱ 超时  120.0s  ← 终止点 │
│  ├ node_notify      ⊘ 未执行             │
│  └ node_notify_fail ⊘ 未执行             │
└──────────────────────────────────────────┘
```

### 12.10 轮询与刷新

| 场景 | 轮询频率 | 接口 |
|-|-|-|
| 运行历史列表（有运行中的 Run） | 每 3~5 秒 | `/api/runs` |
| 运行历史列表（无运行中的 Run） | 每 30 秒或手动刷新 | `/api/runs` |
| Run 详情（有运行中的 Step） | 每 2~3 秒 | `/api/runs/{id}` |
| Run 详情（已完成） | 不轮询，手动刷新 | `/api/runs/{id}` |

**不使用**：SSE 事件流、WebSocket。

---

## 十三、版本管理与级联更新

### 13.1 核心原则

> **OP、Workflow、Job 均有版本号。下游引用上游时，版本号自动带入。上游版本更新后，下游标记"需要更新"，用户进入编辑器手动修改配置后保存即可。**

### 13.2 "需要更新"检测规则

```text
Workflow.needsUpdate =
  存在某个 node，满足 node.opVersion != 该 OP 的当前 version

Job.needsUpdate（target 为 OP）=
  job.target.opVersion != 该 OP 的当前 version

Job.needsUpdate（target 为 Workflow）=
  job.target.workflowVersion != 该 Workflow 的当前 version
  或 该 Workflow 自身 needsUpdate = true
```

**动态计算，不持久化存储。**

### 13.3 使用限制

| 实体状态 | 能否执行 | 能否被引用 |
|-|-|-|
| Workflow.needsUpdate = true | ❌ | ❌ |
| Job.needsUpdate = true | ❌ | — |
| 所有实体已同步 | ✅ | ✅ |

### 13.4 OP 更新后的级联处理

> OP 更新后，Workflow 标记"需要更新"。用户进入 Workflow 编辑器，**手动修改受影响的节点配置**，保存即可。

**Workflow 编辑器展示**：

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  ← 返回  编辑: log_analysis   v1   [保存] [校验]                        │
├──────────────────────────────────────────────────────────────────────────┤
│  ⚠ 该 Workflow 有 2 个节点需要手动修改 OP 配置                            │
├──────────────┬───────────────────────────────┬─────────────────────────┤
│  OP 库        │  画布                          │  节点详情               │
│              │                               │                        │
│              │  ┌──────────┐    ┌──────────┐ │  节点: node_review     │
│              │  │check_tests│───→│  review  │ │  ⚠ 该 OP 已更新         │
│              │  │    ⚠     │    │    ⚠     │ │    当前引用: v1        │
│              │  └──────────┘    └──────────┘ │    OP 最新: v2         │
└──────────────┴───────────────────────────────┴─────────────────────────┘
```

**规则**：

| 规则 | 说明 |
|-|-|
| 受影响节点用 ⚠ 标记 | 不使用高亮 |
| 强制手动操作 | 用户必须打开节点、修改、保存 |
| 无"一键同步" | 不提供"全部确认更新"按钮 |
| 保存节点后版本自动更新 | opVersion 自动更新为最新 |
| 支持部分更新 | 可只更新部分节点 |
| 未全部更新 | 仍标记 needsUpdate |

### 13.5 保存时的版本确认（默认不更新）

```text
┌──────────────────────────────────────┐
│  保存: check_tests                    │
├──────────────────────────────────────┤
│  当前版本: v2                         │
│  是否更新版本？                        │
│  ○ 更新版本（v2 → v3）                │
│  ● 不更新版本（覆盖 v2）               │ ← 默认选中
│           [取消]  [确认]              │
└──────────────────────────────────────┘
```

### 13.6 运行按钮状态

| 实体状态 | 运行按钮 | 提示 |
|-|-|-|
| 已同步 + 非交互 | ✅ | — |
| 需要更新 | ❌ 置灰 | "需要更新后才能运行" |
| 交互式 | ❌ 置灰 | "交互式作业，无法执行" |
| 已禁用 | ❌ 置灰 | 旁边显示 [启用] |

---

## 十四、超时语义

### 14.1 核心原则

> **超时只属于 OP。任何引用该 OP 的执行，单次执行超时 = OP.timeout。**

| 层级 | 是否有 timeout 字段 |
|-|-|
| OP | ✅ |
| Client | ❌ |
| Workflow | ❌ |
| WorkflowNode | ❌ |
| Job | ❌ |

### 14.2 超时的执行语义

```text
Workflow deploy_workflow
     ├── node_check → OP check_tests (timeout = 300s) → 单次 300s
     ├── node_review → OP review (timeout = 600s) → 单次 600s
     └── node_deploy → OP deploy (timeout = 120s) → 单次 120s
```

### 14.3 超时是终止信号（不是失败）

| 维度 | 失败 | 超时 |
|-|-|-|
| 触发 | 退出码非 0 | 进程被 kill |
| 参与重试 | ✅ | ❌ |
| 走 DAG 边 | ✅ | ❌ |
| 回跳 | ✅ | ❌ |
| 最终状态 | failed | timeout |

### 14.4 超时终止流程

```text
执行 node_check (OP timeout = 300s)
     └ 超过 300s（进程被 kill）
         ▼
    1. 当前 step 状态 = timeout
    2. 不参与重试策略判定
    3. 不走任何 DAG 边
    4. 不回跳
    5. 整个 Job 立即终止
    6. Job / Workflow / Step 状态均为 timeout
```

### 14.5 超时与重试策略的交互

**on=failure 时**：超时**不触发**重试，立即终止。

**on=success 时**：超时**不视为**失败，不走失败边，立即终止。

**重试策略只对"正常运行完成的结果"有效**：

| 结果类型 | 参与重试策略 |
|-|-|
| 正常成功 | ✅ |
| 正常失败 | ✅ |
| 超时 | ❌ |
| 用户终止 | ❌ |

---

## 十五、循环场景

### 15.1 核心概念

| 概念 | 说明 |
|-|-|
| 节点重试 | 同一节点内，自动重复执行 N 次（不创建新节点） |
| 循环回跳 | 从一个节点走回之前的节点，形成环（指向原节点） |

### 15.2 循环终止条件

> **单节点在一次 Run 中的执行次数上限 = max × 3。达到上限时，整个 Run 失败。**

| 字段 | 说明 |
|-|-|
| max | 每轮重试次数（来自 NodeRetry） |
| 3 | 硬编码的最大循环轮数 |
| 执行上限 | max × 3 |

**不再依赖**：Job timeout、Workflow 执行上限。

### 15.3 on=failure 循环场景

**拓扑**：

```text
       ┌─────────────────────────┐
       │  (🔵 always 回跳)        │
       ▼                         │
┌──────────────┐                 │
│      A       │  (on=failure, max=3)
│              │🟢 ──→ End       │
│              │🔴 ──→ C          │
└──────────────┘       │          │
                       │ 🔵       │
                       └──────────┘
```

**执行上限**：3 × 3 = 9

**语义**：

> A 只要成功一次，就走 🟢 边到 End。只有连续失败 3 次，才走 🔴 边到 C。C 执行完回跳原始 A。

**执行流程**：

```text
【场景 1：A 首次成功】
A[1] 成功 → 走 🟢 边 → End → Workflow 完成

【场景 2：A 重试后成功】
A[1] 失败 → A[2] 成功 → 走 🟢 边 → End → Workflow 完成

【场景 3：A 连续失败 3 次，回跳后成功】
第 1 轮: A[1~3] 都失败 → C → 回跳 A
第 2 轮: A[4] 失败 → A[5] 成功 → 走 🟢 边 → End → Workflow 完成

【场景 4：连续三轮都失败，整个 Run 失败】
第 1 轮: A[1~3] 都失败 → C → 回跳 A
第 2 轮: A[4~6] 都失败 → C → 回跳 A
第 3 轮: A[7~9] 都失败 → 达到上限 9 → 整个 Run 失败
```

**关键点**：

- C 的边回跳到原始 A，不创建新 A
- A 成功一次即停止重试
- A 连续失败 3 次才走 C
- 每轮回跳后 A 的重试计数重置

### 15.4 on=success 循环场景

**拓扑**：同 on=failure

**执行上限**：3 × 3 = 9

**语义**：

> A 必须连续成功 3 次才走 🟢 边到 End。任意一次失败，立即走 🔴 边到 C。C 执行完回跳原始 A。

**执行流程**：

```text
【场景 1：A 连续成功 3 次】
A[1] 成功 → A[2] 成功 → A[3] 成功 → 走 🟢 边 → End → Workflow 完成

【场景 2：A 中途失败，回跳后成功】
第 1 轮: A[1] 成功 → A[2] 失败 → 走 🔴 边 → C → 回跳 A
第 2 轮: A[3] 成功 → A[4] 成功 → A[5] 成功 → 走 🟢 边 → End → Workflow 完成

【场景 3：连续多轮失败，达到上限】
直到 A 总执行次数达到 9 → 整个 Run 失败
```

**关键点**：

- A 必须连续成功 N 次
- 任意失败立即走 C
- C 回跳原始 A
- 每轮回跳后 A 的重试计数重置

### 15.5 两种场景对比

| 维度 | on=failure | on=success |
|-|-|-|
| 重试触发 | 失败时 | 成功时 |
| 走向成功边 | 任意一次成功 | 连续成功 N 次 |
| 走向失败边 | 连续失败 N 次 | 任意一次失败 |
| 提前停止 | 成功即停止 | 失败即停止 |
| 典型场景 | 网络抖动重试 | 稳定性验证、多次采样 |

### 15.6 运行历史展示

```text
┌──────────────────────────────────────────┐
│  Run: deploy_workflow (失败)              │
├──────────────────────────────────────────┤
│  失败原因: 节点 A 执行次数达到上限（9 次）  │
│                                          │
│  步骤:                                    │
│  ├ A (第 1 次)  ✗ 失败  2.1s              │
│  ├ A (第 2 次)  ✗ 失败  1.8s              │
│  ├ A (第 3 次)  ✗ 失败  2.3s              │
│  ├ C (第 1 次)  ✓ 成功  1.5s              │
│  ...                                      │
│  ├ A (第 9 次)  ✗ 失败  2.0s  ← 达到上限  │
│                                          │
│  总执行次数: 9                            │
│  循环轮数: 3                              │
│  状态: ✗ 失败                            │
└──────────────────────────────────────────┘
```

### 15.7 循环场景下的超时

> 循环回跳场景下，**超时立即终止整个 Run，不再回跳**。

**双重循环保障**：

| 保障 | 说明 |
|-|-|
| 超时立即终止 | 单次执行超时 → Run 终止 |
| 执行次数上限 | 正常失败 → max × 3 后终止 |

### 15.8 Start / End 与循环的关系

**修正后**：

- 之前循环场景示例中的"B（终结）"节点，改为直接连到 End。
- 如果需要结束前执行一个 OP，则串接该 OP 后再连 End。

```text
A ──🟢──→ End                    （无终结 OP）

或

A ──🟢──→ B（OP 节点）──🟢──→ End   （有终结 OP）
```

---

## 十六、后端接口列表

> **仅定义 URL 地址，不定义 body 体。所有任务后台运行，前端轮询获取状态。**

### 16.1 Client 相关

| 方法 | URL | 说明 |
|-|-|-|
| GET | `/api/clients` | 获取 Client 列表 |
| GET | `/api/clients/{id}` | 获取单个 Client |
| POST | `/api/clients` | 创建 Client |
| PUT | `/api/clients/{id}` | 更新 Client |
| DELETE | `/api/clients/{id}` | 删除 Client |
| POST | `/api/clients/{id}/test` | 测试 Client 命令或路径 |

### 16.2 OP 相关

| 方法 | URL | 说明 |
|-|-|-|
| GET | `/api/ops` | 获取 OP 列表 |
| GET | `/api/ops/{id}` | 获取单个 OP |
| POST | `/api/ops` | 创建 OP |
| PUT | `/api/ops/{id}` | 更新 OP |
| DELETE | `/api/ops/{id}` | 删除 OP |
| POST | `/api/ops/{id}/execute` | 单次执行 OP |
| POST | `/api/ops/{id}/export` | 导出 OP 为 YAML（指定目标目录） |
| POST | `/api/ops/import` | 从 YAML 导入 OP |

### 16.3 Workflow 相关

| 方法 | URL | 说明 |
|-|-|-|
| GET | `/api/workflows` | 获取 Workflow 列表 |
| GET | `/api/workflows/{id}` | 获取单个 Workflow |
| POST | `/api/workflows` | 创建 Workflow |
| PUT | `/api/workflows/{id}` | 更新 Workflow |
| DELETE | `/api/workflows/{id}` | 删除 Workflow |
| POST | `/api/workflows/{id}/validate` | 校验 Workflow |
| POST | `/api/workflows/{id}/execute` | 单次执行 Workflow |
| POST | `/api/workflows/{id}/export` | 导出 Workflow 为 ZIP |
| POST | `/api/workflows/import` | 从 ZIP 导入 Workflow |

### 16.4 Job 相关

| 方法 | URL | 说明 |
|-|-|-|
| GET | `/api/jobs` | 获取 Job 列表 |
| GET | `/api/jobs/{id}` | 获取单个 Job |
| POST | `/api/jobs` | 创建 Job |
| PUT | `/api/jobs/{id}` | 更新 Job |
| DELETE | `/api/jobs/{id}` | 删除 Job |
| POST | `/api/jobs/{id}/run` | 手动运行 Job |
| POST | `/api/jobs/{id}/enable` | 启用 Job |
| POST | `/api/jobs/{id}/disable` | 禁用 Job |
| POST | `/api/jobs/{id}/export` | 导出 Job 为 ZIP |
| POST | `/api/jobs/import` | 从 ZIP 导入 Job |
| GET | `/api/jobs/{id}/last-run` | 获取 Job 最近一次执行 |

### 16.5 运行历史相关

| 方法 | URL | 说明 |
|-|-|-|
| GET | `/api/runs` | 获取 Run 列表（支持筛选） |
| GET | `/api/runs/{id}` | 获取 Run 详情 |
| GET | `/api/runs/{id}/status` | 轻量接口，仅返回状态和最后更新时间（轮询用） |
| GET | `/api/runs/{id}/steps` | 获取 Run 的步骤列表 |
| GET | `/api/runs/{id}/steps/{stepId}` | 获取单个步骤详情 |
| POST | `/api/runs/{id}/terminate` | 终止 Run |
| POST | `/api/runs/{id}/rerun` | 重跑 Run |
| POST | `/api/runs/{id}/retry` | 重试 Run（从失败 step 开始） |
| GET | `/api/runs/{id}/can-retry` | 检查 Run 是否可重试 |

### 16.6 版本与更新相关

| 方法 | URL | 说明 |
|-|-|-|
| GET | `/api/workflows/{id}/needs-update` | 检查 Workflow 是否需要更新 |
| GET | `/api/jobs/{id}/needs-update` | 检查 Job 是否需要更新 |
| GET | `/api/workflows/{id}/outdated-nodes` | 获取 Workflow 中落后的节点 |

### 16.7 系统与配置相关

| 方法 | URL | 说明 |
|-|-|-|
| GET | `/api/system/status` | 获取系统状态 |
| GET | `/api/system/version` | 获取 APP 版本 |
| GET | `/api/settings` | 获取设置 |
| PUT | `/api/settings` | 更新设置 |
| GET | `/api/workspaces` | 获取工作区列表 |
| POST | `/api/workspaces/browse` | 浏览文件系统选择工作区 |

**说明**：**不涉及**事件与流式相关接口（无 SSE，无 WebSocket）。

---

## 十七、前端独立界面清单

### 17.1 Client 管理

| 界面 | 说明 |
|-|-|
| Client 列表 | 含类型、名称、命令/路径、更新时间 |
| Client 编辑器（Prompt 类型） | 完整配置 |
| Client 编辑器（Bash / Python / PowerShell） | 只指定二进制路径 |
| Client 测试对话框 | 测试命令或路径可用性 |
| Client 导入对话框 | 选择 YAML 文件导入 |

### 17.2 OP 管理

| 界面 | 说明 |
|-|-|
| OP 列表 | 含名称、类型、版本、入参/出参数量 |
| OP 编辑器 | 名称、描述、超时、入参、出参、类型（选择框）、内容 |
| OP 单次执行参数对话框 | 工作区、入参、Client 下拉列表（按类型过滤） |
| OP 单次执行二次确认弹窗 | 展示即将执行的完整参数 |
| OP 导入对话框 | 选择 YAML 文件导入 |
| OP 导出对话框 | 选择目标目录，导出为 YAML 文件 |

### 17.3 Workflow 管理

| 界面 | 说明 |
|-|-|
| Workflow 列表 | 含名称、版本、节点数、入参/出参数、需要更新标记、执行按钮 |
| Workflow 编辑器（三栏布局） | 顶部（基础信息 + 入参/出参）、左侧 OP 库（可搜索、可拖动）、中间画布（含 Start / OP / End 节点）、右侧节点详情面板 |
| OP 库面板（编辑器内） | 列出所有 OP，支持搜索，支持拖动到画布 |
| Workflow 节点详情面板 | 点击画布 node 后展示；Start / End 节点显示无需配置 |
| Workflow 单次执行参数对话框 | 工作区、Workflow 入参 |
| Workflow 单次执行二次确认弹窗 | 展示即将执行的完整参数 |
| Workflow 导入对话框 | 选择 ZIP 文件导入 |
| Workflow 导出对话框 | 导出为 ZIP 文件 |
| Workflow 校验结果面板 | 展示校验结果 |

### 17.4 Job 管理

| 界面 | 说明 |
|-|-|
| Job 列表 | 含名称、版本、target 类型、最近执行结果、触发方式、重试按钮 |
| Job 编辑器 | 名称、描述、target、Client（target=OP 时）、工作区、初始入参、触发方式、并发策略 |
| Job 手动运行确认弹窗 | 展示已配置的参数 |
| Job 导入对话框 | 选择 ZIP 文件导入 |
| Job 导出对话框 | 导出为 ZIP 文件 |

### 17.5 运行历史

| 界面 | 说明 |
|-|-|
| 运行历史列表（默认首页） | 含类型、名称、版本、状态、耗时、时间、失败节点、自动刷新开关 |
| OP 执行详情 | 版本、结果、入参、正文、输出、出参 |
| Workflow 执行详情（画布 + 节点详情，无 OP 库） | 按图画布展示（含 Start / End），节点用颜色框标记，节点详情面板 |
| Run 重试对话框 | 展示失败信息、固定"从失败节点开始"、"使用最新版本" |
| Run 重跑对话框 | 固定使用最新版本重新从头执行 |
| Run 终止确认弹窗 | 确认终止 |
| 版本对比提示条 | 若执行版本 ≠ 当前版本 |

### 17.6 通用组件

| 组件 | 说明 |
|-|-|
| 版本选择对话框 | OP / Workflow / Job 保存时的版本确认（默认不更新） |
| 需要更新提示条 | Workflow / Job 编辑器顶部 |
| 节点 ⚠ 标记组件 | 画布上受影响的节点 |
| 工作区选择器 | 浏览文件系统选择工作区 |
| 二次确认弹窗 | 通用确认组件 |
| 导入冲突处理对话框 | 处理导入时的冲突 |
| 自动刷新开关 | 运行历史 / Run 详情顶部 |

---

## 十八、关键设计决策

| 决策点 | 建议 | 理由 |
|-|-|-|
| 应用名称 | AI 自动化 | 定位清晰 |
| 默认首页 | 运行历史 | 用户最常查看执行结果 |
| 界面布局 | 左侧菜单栏 + 右侧内容区 | 简洁 |
| 一级菜单 | 固定五个 | 覆盖全部核心功能 |
| ID 格式 | 32 位 UUID | 全局唯一 |
| name 与 id 分离 | name 展示，id 引用 | 兼顾可读性与唯一性 |
| Client 类型 | prompt / bash / python / powershell | 覆盖执行器 |
| Client 选择方式 | 下拉列表（按 OP 类型过滤） | 直观 |
| Client 是否含超时 | ❌ | 超时只属于 OP |
| Client 输出解析 mode | text / json / jsonl | 覆盖主要场景 |
| 包装脚本 | 硬编码到 APP，运行时临时生成 | 用户不感知 |
| OP 类型 | prompt / bash / python / powershell | 覆盖主要执行器 |
| OP 与 Client 绑定 | 不绑定 | OP 只声明"做什么" |
| OP 是否含 retry | ❌ | OP 是最小单元 |
| OP.interactive | 字段占位，默认 false，界面不暴露 | 未来预留 |
| 重试位置 | Workflow 节点级 | 编排层控制 |
| NodeRetry 字段名 | on / max / backoff / interval | 与前端一致 |
| OP 版本管理 | 保存时可选升版本，默认 v1 | 支持演进 |
| Workflow / Job 版本管理 | 保存时可选升版本，默认 v1 | 支持演进 |
| 版本号填写方式 | 自动带入 | 降低用户负担 |
| 保存确认默认 | 不更新版本 | 减少意外升版本 |
| 列表展示版本号 | ✅ | 用户需要看到当前版本 |
| Job 列表展示最近执行结果 | ✅ | 快速了解健康状况 |
| OP 单次执行入口 | 只在列表界面 | 编辑器专注定义 |
| Workflow 单次执行入口 | 只在列表界面 | 编辑器专注定义 |
| Workflow 编辑器布局 | 左侧 OP 库 + 中间画布 + 右侧节点详情面板 | 从 OP 库拖动创建节点，直观 |
| OP 库功能 | 列出所有 OP，支持搜索，支持拖动 | 快速构建 Workflow |
| 拖动创建节点 | 自动带出 OP 全部入参（未绑定） | 减少手动配置 |
| 画布锚点连线 | 支持从锚点拖拽生成边 | 直观编排 |
| Workflow 执行详情布局 | 画布 + 节点详情面板（无 OP 库） | 执行详情只读，不需要新增节点 |
| 参数绑定来源 | 任意前置节点出参 / Workflow 入参 / 字面量 | 灵活 |
| 参数绑定编辑 | 节点详情面板内可编辑 | 完整配置能力 |
| 汇聚策略 | 由 DAG 边决定 | 不单独配置 |
| 节点锚点 | 红/绿/蓝三色 | 决定边触发条件 |
| **Start / End 节点** | **固定存在，不绑定 OP** | **明确标识 Workflow 起点和终点** |
| **Start 锚点** | **仅右侧 🟢 出边锚点** | **Start 必然成功** |
| **End 锚点** | **仅左侧入边锚点** | **End 是终点** |
| **End 完成语义** | **任意入边触发即完成** | **简化逻辑** |
| 循环实现 | 重试 + 条件边 + 回跳 | 指向原节点 |
| 循环终止 | max × 3 | 不依赖 Job / Workflow 时间 |
| 超时归属 | 只在 OP 上 | OP 是原子执行单元 |
| 超时语义 | 终止信号，不是失败 | 不走边、不回跳、不重试 |
| 超时不可重试 | ✅ | 版本已不一致 |
| 执行点 | 统一收拢到 Job | 执行逻辑单一 |
| 后台运行 | ✅ | 前端轮询获取状态 |
| 轮询策略 | 按场景调整频率 | 平衡实时性与资源 |
| 重试版本 | 使用最新版本 | 原版本已被覆盖 |
| 重试方式 | 从失败节点开始（固定） | 定义 |
| 重试前提 | 五条件 | 版本一致 + 无需更新 |
| 重试入口 | 三处（Job / 运行历史 / Workflow 详情失败节点面板） | 方便操作 |
| 重跑版本 | 固定使用最新版本 | 简化 |
| 重跑入口 | 三处（运行历史 / OP 详情 / Workflow 详情） | 方便操作 |
| 运行历史记录版本号 | ✅ 快照 | 审计追溯 |
| 运行历史三个子界面 | ✅ | 分层清晰 |
| Workflow 执行详情边框颜色 | 🟢 成功 / 🔴 失败 / 🟠 超时 | 颜色直观 |
| 节点点击进入 OP 详情 | ✅ | 从宏观到微观 |
| 触发来源 | manual / schedule / single_op / single_workflow / retry | 覆盖全部场景 |
| Job 形态 | persistent / virtual | 区分持久与单次 |
| Job trigger | 手动 / 定时二选一 | 定义时明确 |
| Job target=OP 的 Client | 创建 Job 时选择 | 固定执行契约 |
| 导入导出格式 | OP：YAML；Workflow / Job：ZIP | 关联内容打包 |
| OP 导出方式 | 弹窗选目录后导出 | 用户可控位置 |

---

## 十九、核心结论

**应用形态**：

```text
AI 自动化
├── 左侧菜单栏（固定五个）
│   ├── Client 管理
│   ├── OP 管理
│   ├── Workflow 管理
│   ├── Job 管理
│   └── 运行历史 ★（默认首页）
└── 右侧内容区
```

**执行模型**：

```text
Client ←（执行时下拉选择）← OP ← Workflow（含入参 / 出参 + Start / End 节点）
                              │
                              └──→ Job（持久 / 虚拟）──→ Job Run ──→ 运行历史（首页）
```

**一句话总结**：

> **执行点只有 Job。OP 和 Workflow 是定义，Job 是执行载体。所有执行记录统一进入运行历史，运行历史是默认首页。**

**十一条硬约束**：

1. **所有 ID 使用 32 位 UUID**，界面展示用 name。
2. **Client 分 4 种类型**（prompt / bash / python / powershell），按 OP 类型过滤。
3. **OP 不含 retry 字段**，重试在 Workflow 节点级配置。
4. **OP 不与 Client 绑定**，执行时通过下拉列表选择；Job target=OP 时创建 Job 选择 Client。
5. **Workflow 有独立入参和出参**，参数绑定支持任意前置节点。
6. **超时只属于 OP**，超时是终止信号，全层级标记 timeout。
7. **循环终止由 max × 3 控制**，超时立即终止。
8. **重试使用最新版本，且只在五条件满足时可用**。
9. **所有任务后台运行，前端轮询获取状态**，不使用事件流。
10. **Workflow 编辑器左侧提供 OP 库**，支持搜索和拖动创建节点；**Workflow 执行详情无 OP 库**。
11. **Workflow 有固定的 Start 和 End 节点**，不绑定 OP。

**Workflow 编辑器布局（三栏）**：

| 区域 | 内容 |
|-|-|
| 顶部 | 名称、描述、Workflow 入参、Workflow 出参 |
| 左侧 | OP 库（可搜索、可拖动） |
| 中间 | 画布（含 Start / OP / End 节点） |
| 右侧 | 节点详情面板 |

**Workflow 执行详情布局（两栏，无 OP 库）**：

| 区域 | 内容 |
|-|-|
| 顶部 | 执行信息 + [重跑] |
| 左侧 | 画布（只读展示执行状态，含 Start / End） |
| 右侧 | 节点详情面板（失败节点含 [重试]） |

**Start / End 节点规范**：

- 每个 Workflow 有且仅有一个 Start 和一个 End。
- Start / End 不绑定 OP，不可删除。
- Start 只有右侧 🟢 出边锚点。
- End 只有左侧入边锚点。
- End 任意入边触发即完成，Workflow 成功。
- Start / End 不产生 StepRecord，不进入步骤列表，不涉及版本。

**执行交互规范**：

| 执行方式 | 参数填写 | 二次确认 | Job 形态 |
|-|-|-|-|
| OP 单次执行 | ✅（工作区 + 入参 + Client） | ✅ | virtual |
| Workflow 单次执行 | ✅（工作区 + 入参） | ✅ | virtual |
| Job 手动运行 | ❌ | ✅ 只展示 | persistent |
| Job 定时运行 | ❌ | ❌ | persistent |
| 重试 | ❌ | ✅ 展示失败信息 | persistent / virtual |

**版本管理规范**：

- OP / Workflow / Job 都有版本号，默认 v1，列表展示。
- 保存时默认"不更新版本"。
- 版本号自动带入，不需人工填写。
- 上游更新后下游标记"需要更新"。
- 用户通过编辑下游完成更新，无"同步"按钮。
- 受影响节点用 ⚠ 标记，强制手动修改。

**运行历史规范**：

- 默认首页。
- 三个子界面：Job 运行历史列表、OP 执行详情、Workflow 执行详情。
- 记录版本快照，不随上游更新而变。
- Workflow 执行详情按图画布展示（含 Start / End），节点用颜色框标记。
- 点击 Workflow 中的节点进入 OP 执行详情。
- 支持自动刷新（轮询）。

**超时与循环规范**：

- 只有 OP 有 timeout。
- 超时是终止信号，立即终止整个 Job，全层级标记 timeout。
- 超时不可重试，只能重跑。
- 循环终止由 max × 3 控制。
- 超时与执行次数上限双重保障，杜绝死循环。

**重试规范**：

- 仅 target 为 Workflow 且满足五条件时可用。
- 从失败 OP 开始重试。
- 使用最新版本（= 快照版本，版本一致时）。
- 版本不一致或 needsUpdate 时禁止重试，提示用户重跑。
- 三个入口：Job 管理 / 运行历史 / Workflow 运行详情失败节点面板。

**导入导出规范**：

- OP：YAML（弹窗选目录导出）。
- Workflow：ZIP（含 workflow.yaml + 引用的 ops/*.yaml + manifest.json）。
- Job：ZIP（含 job.yaml + target + 引用的 ops/workflows + manifest.json）。

**五界面分工**：

- **Client 管理**：定义"怎么非交互式调 CLI 或本地脚本执行器"。
- **OP 管理**：定义"做什么"。
- **Workflow 管理**：定义"按什么顺序做，节点如何重试，用哪个 Client"，左侧 OP 库 + 中间画布（含 Start / End）+ 右侧节点详情。
- **Job 管理**：定义"什么时候做、在哪做"，展示最近执行结果。
- **运行历史**（首页）：记录"做过什么、结果如何、用的哪个版本"，支持从失败 OP 重试。