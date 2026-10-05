# 基于 CLI 命令行的确定性工作流编排需求文档

## 一、背景与目标

### 1.1 背景

在家庭/个人开发环境中，用户希望复用已有的 Agent CLI（如 Claude Code、Codex、Cursor Agent、Cline、OpenCode、Crush、jcode 等）的能力，通过命令行方式驱动它们执行任务，并获得**确定性、可恢复、可管理**的编排能力。

现有开源编排方案（Langflow、Flowise、Sim Studio、Kestra、AWF、CAO 等）存在以下问题：

- 多数基于 LLM API 编排，无法复用 CLI Agent 的原生工具、认证、权限、技能。
- 少数 CLI-Native 方案（AWF、CAO、AgentOrb）虽能驱动 CLI，但编排能力偏线性或强绑定某个 Agent，缺少 OP / Workflow / Job / Run 的完整分层。
- 交互式 HITL 无法通用化，PTY 包 TUI 成本极高。

### 1.2 目标

构建一个**基于 CLI 命令行的确定性工作流编排器**，具备：

- **四层结构**：OP → Workflow → Job → Run。
- **CLI-Native**：所有执行通过命令行调用 Agent CLI，复用其原生能力。
- **确定性**：不依赖 LLM 解析自然语言，步骤、流转、判定完全由配置和退出码/产物驱动。
- **可恢复**：崩溃或重启后可从断点恢复或人工选择重跑。
- **非交互优先**：核心能力面向非交互式作业；交互式降级为外部终端 + 人工推进。
- **配置驱动**：切换 Agent 只改配置，不改应用代码。

### 1.3 非目标

- ❌ 不实现内嵌终端 / PTY 模拟器。
- ❌ 不实现自动识别 ask 并自动回答（通用层不做）。
- ❌ 不绑定任何特定 Agent CLI 的 serve API。
- ❌ 不依赖 LLM 做流程控制。

---

## 二、核心约束与设计原则

### 2.1 核心约束

| 约束 | 说明 |
|-|-|
| 不绑定 Agent CLI | 通过 CliProfile 配置适配，不写死任何 CLI |
| 只走命令行 | 通过子进程调用，不依赖 serve API |
| 无统一事件流 | 以退出码、stdout/stderr、产物文件为判定依据 |
| 非交互优先 | 交互式降级为外部终端 + 人工推进 |
| 本地运行 | 不依赖云端、不依赖容器 |
| 确定性 | 流程、流转、判定由配置驱动，不由 LLM 决定 |

### 2.2 设计原则

1. **OP 是函数，Workflow 是程序，Job 是作业配置，Run 是执行实例。**
2. **参数沿 DAG 流动**，上游出参自动流向绑定了它的下游入参。
3. **流转基于退出码和产物**，不由自然语言决定。
4. **CLI 差异封装在 CliProfile**，App 与 Workflow 引擎不感知具体 CLI。
5. **能力缺失时降级**，不要求所有 CLI 能力一致。
6. **交互式以人机协作存在**，不试图自动化。

---

## 三、四层架构总览

```text
┌─────────────────────────────────────────────────────┐
│  作业层 (Job)                                        │
│  - 引用一个 OP 或一个 Workflow                        │
│  - 绑定工作区                                         │
│  - 配置触发方式（手动 / 定时）                         │
│  - 每次触发产生一个 Job Run                           │
└─────────────────────────────────────────────────────┘
                        │ 引用
                        ▼
┌─────────────────────────────────────────────────────┐
│  Workflow 层 (编排)                                  │
│  - 引用多个 OP，绑定参数，定义流转                     │
│  - 基于数据流 + 控制流的 DAG                          │
└─────────────────────────────────────────────────────┘
                        │ 引用
                        ▼
┌─────────────────────────────────────────────────────┐
│  OP 层 (单个操作)                                    │
│  - 名称、ID、类型、内容、入参、出参                    │
│  - 执行器：agent_cli / bash / python / powershell     │
└─────────────────────────────────────────────────────┘
                        │ 触发
                        ▼
┌─────────────────────────────────────────────────────┐
│  Run 层 (执行实例)                                   │
│  - 每次执行产生一个实例                               │
│  - 记录触发来源、输入、输出、退出码、日志、产物         │
└─────────────────────────────────────────────────────┘
```

| 层 | 职责 | 类比 |
|-|-|-|
| OP | 定义一个可独立执行的操作 | 函数定义 |
| Workflow | 引用多个 OP，绑定参数，定义流转 | 程序 |
| Job | 把 OP 或 Workflow 实例化为可执行作业 | 可执行作业配置 |
| Run | 每次执行产生一个运行实例 | 一次执行 |

---

## 四、CliProfile：CLI 适配层

### 4.1 定位

CliProfile 是编排器与具体 Agent CLI 之间的唯一契约。它描述"如何调用某个 CLI"，不描述"CLI 内部如何工作"。

**切换 Agent = 切换 CliProfile，App 与 Workflow 引擎完全不变。**

### 4.2 数据结构

```typescript
interface CliProfile {
  id: string;                       // "claude-code"
  name: string;                     // "Claude Code"
  description?: string;

  // 命令模板
  command: string;                  // "claude"
  argsTemplate: string[];           // ["-p", "{{prompt}}", "--bare"]
  workingDir: string;               // "{{workspace}}"

  // 输入方式
  inputMode: "arg" | "stdin" | "file";
  stdinTemplate?: string;           // 当 inputMode = stdin 时使用

  // 输出解析
  outputParser: {
    mode: "text" | "json" | "jsonl" | "regex";
    jsonPath?: string;              // 当 mode = json 时，提取 JSON 的路径
    regexPattern?: string;          // 当 mode = regex 时
    resultFile?: string;            // 产物文件路径，如 ".agent/result.json"
  };

  // 退出码语义
  exitCodeMap: {
    success: number[];              // [0]
    // 其他非 success 码统一视为失败
  };

  // 环境变量
  env?: Record<string, string>;

  // 超时与重试默认值
  defaultTimeout?: number;          // 秒
  defaultRetry?: RetryPolicy;

  // 能力声明（供引擎降级）
  capabilities: {
    nonInteractive: boolean;        // 是否支持非交互模式
    sessionResume: boolean;         // 是否支持会话恢复
    structuredOutput: boolean;      // 是否支持结构化输出
  };
}

interface RetryPolicy {
  maxAttempts: number;
  backoff: "constant" | "linear" | "exponential";
  intervalMs: number;
}
```

### 4.3 配置示例

```yaml
id: claude-code
name: Claude Code
command: claude
argsTemplate:
  - "-p"
  - "{{prompt}}"
  - "--output-format"
  - "json"
inputMode: arg
workingDir: "{{workspace}}"
outputParser:
  mode: json
  jsonPath: "$.result"
exitCodeMap:
  success: [0]
defaultTimeout: 600
capabilities:
  nonInteractive: true
  sessionResume: true
  structuredOutput: true
```

```yaml
id: codex
name: Codex CLI
command: codex
argsTemplate:
  - "exec"
  - "{{prompt}}"
  - "--json"
inputMode: arg
outputParser:
  mode: jsonl
exitCodeMap:
  success: [0]
capabilities:
  nonInteractive: true
  sessionResume: true
  structuredOutput: true
```

```yaml
id: generic-agent
name: 通用 Agent CLI
command: my-agent
argsTemplate:
  - "--prompt"
  - "{{prompt}}"
inputMode: arg
outputParser:
  mode: text
exitCodeMap:
  success: [0]
capabilities:
  nonInteractive: true
  sessionResume: false
  structuredOutput: false
```

### 4.4 CliProfile 管理

- 通过 UI 管理（新增、编辑、复制、删除、导入/导出）。
- 存储于本地 SQLite（`cli_profiles` 表）。
- 支持从 YAML 文件导入。
- 支持内置模板（预置常见 CLI 的配置）。

---

## 五、OP 层：单个操作

### 5.1 定位

OP 是**最小可执行单元**，定义一个操作。它是"函数"，只声明签名，不关心流转。

### 5.2 数据类型

```typescript
interface OpDefinition {
  id: string;
  name: string;
  description?: string;
  type: "agent_cli" | "bash" | "python" | "powershell";
  content: string;                  // prompt 模板或脚本内容
  inputs: OpInput[];
  outputs: OpOutput[];
  interactive: boolean;             // 手动标记：执行中是否可能产生 ask
  cliProfileId?: string;            // 当 type = agent_cli 时指定
  timeout?: number;                 // 秒
  retry?: RetryPolicy;
  createdAt: string;
  updatedAt: string;
}

interface OpInput {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
  default?: unknown;
  description?: string;
}

interface OpOutput {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  description?: string;
}
```

### 5.3 OP 类型

| 类型 | 说明 | 执行器 |
|-|-|-|
| agent_cli | 调用 Agent CLI，由 CliProfile 决定具体命令 | 子进程 |
| bash | 执行 Bash 脚本 | 子进程 |
| python | 执行 Python 脚本 | 子进程 |
| powershell | 执行 PowerShell 脚本 | 子进程 |

### 5.4 OP 内容模板

OP 的 `content` 支持变量插值：

```text
请审查以下代码变更：
{{diff}}

要求：
1. 找出潜在 bug
2. 给出改进建议
3. 以 JSON 格式输出：{"issues": [...], "suggestions": [...]}
```

可用变量：

| 变量 | 说明 |
|-|-|
| `{{workspace}}` | 当前工作区路径 |
| `{{input.xxx}}` | OP 入参 |
| `{{env.xxx}}` | 环境变量 |

### 5.5 OP 执行结果

```typescript
interface OpRunResult {
  opId: string;
  runId: string;
  status: "success" | "failed" | "timeout" | "cancelled" | "interrupted";
  outputs: Record<string, unknown>;   // 结构化出参
  rawOutput: string;                  // 原始输出（stdout）
  stderr?: string;                    // 标准错误
  exitCode?: number;                  // 进程退出码
  error?: string;                     // 失败信息
  startedAt: string;
  finishedAt: string;
  duration: number;
}
```

### 5.6 OP 出参解析

出参解析方式由 CliProfile 的 `outputParser` 决定：

| mode | 说明 | 适用 |
|-|-|-|
| text | 整个 stdout 作为字符串 | 通用 |
| json | 从 stdout 提取 JSON，按 jsonPath 取值 | 支持 JSON 输出的 CLI |
| jsonl | 逐行解析 JSON，最后一行或聚合作为结果 | 支持 JSONL 的 CLI |
| regex | 用正则从 stdout 提取 | 无结构化输出 |

**产物文件优先级**：如果 CliProfile 指定了 `resultFile`，且文件存在，优先从该文件读取出参。

约定产物文件格式：

```json
{
  "status": "success",
  "outputs": {
    "passed": true,
    "count": 23
  },
  "raw": "..."
}
```

### 5.7 OP 编辑器 UI

```text
┌──────────────────────────────────────────────┐
│  ← 返回  编辑: check_tests                    │
├──────────────────────────────────────────────┤
│  名称: [check_tests        ]                  │
│  ID:   [check_tests        ]                  │
│  类型: [agent_cli ▾]                          │
│  CLI:  [claude-code ▾]                        │
│  描述: [运行测试并报告结果    ]                 │
│                                              │
│  交互性: [ ] 执行中可能产生 ask               │
│                                              │
│  内容:                                        │
│  ┌────────────────────────────────────────┐  │
│  │ 在当前工作区运行测试，并输出结果 JSON    │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  入参:  [＋ 添加]                             │
│  ┌────────────────────────────────────────┐  │
│  │ name: test_cmd  type: string            │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  出参:  [＋ 添加]                             │
│  ┌────────────────────────────────────────┐  │
│  │ name: passed    type: boolean          │  │
│  │ name: count     type: number           │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  超时: [300s]  重试: [0次]                    │
│                                              │
│           [取消]  [保存]  [试运行]            │
└──────────────────────────────────────────────┘
```

---

## 六、Workflow 层：编排

### 6.1 定位

Workflow 是**基于数据流 + 控制流的有向无环图（DAG）**，引用多个 OP，绑定参数，定义流转。

### 6.2 数据类型

```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  inputs: WorkflowInput[];
  outputs: WorkflowOutput[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}

interface WorkflowInput {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
  default?: unknown;
  description?: string;
}

interface WorkflowOutput {
  name: string;
  from: { nodeId: string; outputName: string };
  description?: string;
}

interface WorkflowNode {
  nodeId: string;
  opId: string;
  opVersion?: string;
  bindings: Record<string, ParamBinding>;
  joinPolicy?: "all_success" | "all_done" | "any_success" | "any_done";
  overrides?: {
    timeout?: number;
    retry?: RetryPolicy;
  };
}

type ParamBinding =
  | { kind: "workflow_input"; name: string }
  | { kind: "node_output"; nodeId: string; name: string }
  | { kind: "literal"; value: unknown };

interface WorkflowEdge {
  from: string;
  to: string;
  condition: EdgeCondition;
}

type EdgeCondition =
  | { kind: "always" }
  | { kind: "on_success" }
  | { kind: "on_failure" }
  | { kind: "expression"; expr: string };
```

### 6.3 参数模型

**参数三种来源**：

| 来源 | 说明 | 是否需要在编排层声明 |
|-|-|-|
| Workflow 入参 | 整个编排的外部输入 | ✅ 必须声明 |
| Op 出参 | 某个 op 执行后产生的结果 | ❌ 由 op 自己定义 |
| Op 入参 | 某个 op 执行前需要的参数 | 取决于来源 |

**参数连接规则**：

```text
Workflow 入参 ──→ Op A ──→ Op A 出参 ──→ Op B 入参
                     │
                     └──→ Op A 出参 ──→ Workflow 出参
```

| 场景 | 处理方式 |
|-|-|
| Op B 入参来自 Op A 出参 | 自动连接，不需要在编排层声明 |
| Op B 入参来自 Workflow 入参 | 在 Workflow 入参中声明，Op B 引用该参数名 |
| Op B 入参既无上游产生，也不在 Workflow 入参中 | 校验不通过，报错 |
| 某 op 出参被指定为 Workflow 出参 | 在 Workflow 出参中声明 |

### 6.4 流转模型

**四种流转类型**：

| 类型 | 说明 | 触发条件 |
|-|-|-|
| 顺序流转 | 上一个 op 完成后执行下一个 | 无条件 |
| 条件流转 | 根据上游结果决定分支 | on_success / on_failure / expression |
| 并行流转 | 一个 op 完成后同时触发多个下游 | 扇出 |
| 汇聚流转 | 多个 op 都完成后才触发下一个 | 扇入 |

**扇出（并行）**：

```text
        ┌──→ Op B1
Op A ───┼──→ Op B2
        └──→ Op B3
```

**扇入（汇聚）**：

```text
Op B1 ──┐
Op B2 ──┼──→ Op C
Op B3 ──┘
```

| 汇聚策略 | 说明 |
|-|-|
| all_success（默认） | 所有上游都成功后才触发 |
| all_done | 所有上游都完成（无论成功失败）后触发 |
| any_success | 任意一个上游成功即触发 |
| any_done | 任意一个上游完成即触发 |

**条件分支**：

```text
        ┌──→ Op B_success (on_success)
Op A ───┤
        └──→ Op B_failure (on_failure)
```

```text
        ┌──→ Op B (expr: "node_check.outputs.count > 0")
Op A ───┤
        └──→ Op C (expr: "node_check.outputs.count == 0")
```

**表达式语法**：基于 `nodeId.outputs.xxx` 的确定性表达式，支持：

| 运算符 | 说明 |
|-|-|
| `==` `!=` | 相等 / 不等 |
| `>` `<` `>=` `<=` | 比较 |
| `&&` `\|\|` `!` | 逻辑 |
| `in` | 包含 |

### 6.5 Workflow 校验规则

**参数校验**：

| 规则 | 说明 |
|-|-|
| 入参来源校验 | 每个 op 的 required 入参必须有来源 |
| 出参引用校验 | Workflow 出参引用的 op 和出参名必须存在 |
| 类型匹配校验 | 上游出参类型与下游入参类型兼容 |
| 必填校验 | Workflow 入参中 required=true 的必须提供 |

**结构校验**：

| 规则 | 说明 |
|-|-|
| OP 引用存在 | 每个 node 的 opId 必须指向已存在的 OP |
| 入参绑定完整 | 每个 node 的每个 required 入参必须有 binding |
| Workflow 入参引用存在 | binding 中 workflow_input 引用必须已声明 |
| 上游节点存在 | binding 中 node_output 引用必须是上游节点 |
| 出参名存在 | binding 中 node_output 的 outputName 必须已声明 |
| Workflow 出参来源存在 | outputs.from 引用的 nodeId + outputName 必须存在 |
| DAG 无环 | 流转关系不能有循环 |
| 汇聚策略合法 | 有多条入边的节点必须有 joinPolicy |
| 连通性 | 所有节点必须从起点可达 |
| 起始 op | 至少有一个没有入边的 op 作为起点 |
| 终止 op | 至少有一个没有出边的 op 作为终点 |

### 6.6 Workflow 交互性动态计算

```typescript
function isWorkflowInteractive(
  workflow: WorkflowDefinition,
  opLibrary: Map<string, OpDefinition>
): boolean {
  return workflow.nodes.some(node => {
    const op = opLibrary.get(node.opId);
    return op?.interactive === true;
  });
}
```

| 规则 | 说明 |
|-|-|
| 引用的 OP 中任意一个 interactive | Workflow 标记为交互式 |
| 引用的 OP 全部 non-interactive | Workflow 标记为非交互式 |

### 6.7 YAML 定义示例

```yaml
name: deploy_workflow
description: 部署流程

inputs:
  - name: target_env
    type: string
    required: true
    description: "目标环境"

outputs:
  - name: deploy_url
    from: { nodeId: node_deploy, outputName: url }

nodes:
  - nodeId: node_check
    opId: check_tests
    bindings: {}

  - nodeId: node_review
    opId: review
    bindings:
      test_result:
        kind: node_output
        nodeId: node_check
        name: result

  - nodeId: node_deploy
    opId: deploy
    bindings:
      env:
        kind: workflow_input
        name: target_env
      decision:
        kind: node_output
        nodeId: node_review
        name: decision

  - nodeId: node_notify
    opId: notify
    bindings:
      url:
        kind: node_output
        nodeId: node_deploy
        name: url

edges:
  - from: node_check
    to: node_review
    condition: { kind: on_success }

  - from: node_check
    to: node_notify_failure
    condition: { kind: on_failure }

  - from: node_review
    to: node_deploy
    condition: { kind: expression, expr: "node_review.outputs.decision == 'approve'" }

  - from: node_deploy
    to: node_notify
    condition: { kind: on_success }
```

### 6.8 Workflow 编辑器 UI

```text
┌──────────────────────────────────────────────┐
│  ← 返回  编辑: deploy_workflow  [保存] [校验] │
├────────────────────────────┬─────────────────┤
│  画布                       │  节点详情         │
│                             │                 │
│  ┌──────────┐  ┌─────────┐ │  节点: node_review│
│  │check_tests│─→│ review  │ │  OP:   review    │
│  └──────────┘  └─────────┘ │                 │
│       │             │      │  参数绑定:        │
│       │on_failure   │approve│  test_result:    │
│       ▼             ▼      │    ← node_check  │
│  ┌──────────┐  ┌─────────┐ │      .result     │
│  │notify_fail│  │ deploy  │ │                 │
│  └──────────┘  └─────────┘ │  汇聚策略:        │
│                     │      │  [all_success ▾] │
│                     ▼      │                 │
│                ┌─────────┐ │                 │
│                │ notify  │ │                 │
│                └─────────┘ │                 │
└────────────────────────────┴─────────────────┘
```

---

## 七、Job 层：作业配置

### 7.1 定位

Job 把 OP 或 Workflow **实例化为可执行作业**，绑定工作区，配置触发方式。

### 7.2 数据类型

```typescript
interface JobDefinition {
  id: string;
  name: string;
  description?: string;

  // 作业目标
  target:
    | { kind: "op"; opId: string }
    | { kind: "workflow"; workflowId: string };

  // 工作区
  workspace: string;

  // 初始入参
  inputs: Record<string, unknown>;

  // 触发方式
  trigger:
    | { kind: "manual" }
    | { kind: "schedule"; cron: string; enabled: boolean };

  // 运行策略
  concurrency: "skip" | "queue" | "parallel";
  timeout?: number;

  createdAt: string;
  updatedAt: string;
}
```

### 7.3 Job 交互性

| Job 的 target | 交互性来源 |
|-|-|
| `{ kind: "op", opId }` | 该 OP 的 interactive 属性 |
| `{ kind: "workflow", workflowId }` | 该 Workflow 的交互性 |

**规则**：

| 类型 | 能否在 Job 界面直接运行 | 执行位置 |
|-|-|-|
| 非交互式 OP / Workflow / Job | ✅ 可以 | Job 界面触发，创建后台 Run |
| 交互式 OP / Workflow / Job | ❌ 不可以 | 必须在工作台中触发（人工推进） |

### 7.4 触发方式

| 触发方式 | 说明 | 适用 |
|-|-|-|
| 手动 | 用户在 UI 点击"运行" | 所有非交互 Job |
| 定时 | Cron 表达式，后台调度 | 非交互 Job |

**定时 Job 的限制**：交互式 Job 禁止定时触发。

### 7.5 并发策略

| 策略 | 说明 |
|-|-|
| skip | 若上一个 Run 未完成，跳过本次触发 |
| queue | 排队等待，前一个完成后执行 |
| parallel | 并行执行，允许多个 Run 同时存在 |

### 7.6 Job 编辑器 UI

```text
┌──────────────────────────────────────────────┐
│  ← 返回  编辑: daily_cleanup                  │
├──────────────────────────────────────────────┤
│  名称: [daily_cleanup         ]               │
│  描述: [每日清理日志           ]               │
│                                              │
│  目标类型:                                    │
│  ● 单个 OP                                    │
│    OP: [clean_logs ▾]                        │
│  ○ 整个 Workflow                              │
│    Workflow: [选择 ▾]                         │
│                                              │
│  工作区: [/path/to/workspace]                 │
│                                              │
│  初始入参:                                    │
│    days: [7]                                 │
│                                              │
│  触发方式:                                    │
│  ● 仅手动                                     │
│  ○ 手动 + 定时                                │
│    Cron: [0 2 * * *        ]                 │
│    启用: [✓]                                  │
│                                              │
│  并发策略: [skip ▾]                           │
│  超时: [300s]                                 │
│                                              │
│           [取消]  [保存]  [试运行]            │
└──────────────────────────────────────────────┘
```

---

## 八、Run 层：执行实例

### 8.1 定位

每次执行（无论手动、定时、试运行）产生一个 Run 实例。Run 是**运行历史的统一记录单元**。

### 8.2 数据类型

```typescript
interface Run {
  id: string;                       // run_id
  jobId?: string;                   // 如果由 Job 触发
  triggeredBy: "manual" | "schedule" | "workspace";

  // 执行目标快照
  target:
    | { kind: "op"; opId: string }
    | { kind: "workflow"; workflowId: string };

  // 本次执行的入参
  inputs: Record<string, unknown>;

  // 工作区
  workspace: string;

  // 状态
  status:
    | "pending"
    | "running"
    | "waiting_user"          // 交互式步骤等待人工
    | "success"
    | "failed"
    | "cancelled"
    | "timeout"
    | "interrupted";

  // 结果
  opResult?: OpRunResult;
  workflowResult?: WorkflowRunResult;

  // 步骤记录（Workflow 时）
  steps: StepRecord[];

  // 时间
  startedAt: string;
  finishedAt?: string;
  duration?: number;
}

interface StepRecord {
  stepId: string;                   // nodeId
  opId: string;
  status: "pending" | "running" | "waiting_user" | "success" | "failed" | "skipped";
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  rawOutput?: string;
  exitCode?: number;
  error?: string;
  processRecord?: ProcessRecord;
  startedAt: string;
  finishedAt?: string;
  duration?: number;
}

interface ProcessRecord {
  pid: number;
  command: string;
  args: string[];
  cwd: string;
  stdoutPath: string;
  stderrPath: string;
  exitCode?: number;
  status: "running" | "exited" | "killed" | "unknown";
}

interface WorkflowRunResult {
  workflowId: string;
  status: Run["status"];
  outputs: Record<string, unknown>;
  steps: StepRecord[];
}
```

### 8.3 运行历史视图

```text
┌──────────────────────────────────────────────────────────┐
│  运行历史                                  [刷新] [筛选]  │
├──────────────────────────────────────────────────────────┤
│  🔍 搜索 OP / Workflow / Job 名称 / 状态...               │
├──────────────────────────────────────────────────────────┤
│  筛选: [全部类型 ▾] [全部状态 ▾] [全部工作区 ▾] [时间 ▾]   │
├──────────────────────────────────────────────────────────┤
│  📦 check_tests        OP        成功    12.3s   2分钟前  [查看] [重跑] │
│     触发: 工作台 / 试运行                                 │
├──────────────────────────────────────────────────────────┤
│  📋 deploy_workflow    Workflow  运行中  step 3/8  5分钟前 [查看] [终止] │
│     触发: 工作台 / 手动                                   │
├──────────────────────────────────────────────────────────┤
│  ⏰ daily_cleanup      Job       成功    3.2s    1小时前  [查看] [重跑] │
│     触发: 定时 / Job 界面                                 │
├──────────────────────────────────────────────────────────┤
│  ⏰ hourly_check       Job       等待人工 waiting  2小时前 [查看] [继续] [终止] │
│     触发: 工作台 / 手动                                   │
└──────────────────────────────────────────────────────────┘
```

### 8.4 三种人工操作

**操作 A：终止**

```typescript
async function terminateRun(runId: string, db: Database) {
  const run = db.getRun(runId);
  for (const step of run.steps) {
    if (step.processRecord?.pid && step.processRecord.status === "running") {
      await killProcess(step.processRecord.pid);
    }
  }
  db.markRunTerminated(runId);
}
```

**操作 B：从指定步骤重启**

```typescript
async function restartFromStep(
  runId: string,
  startStepId: string,
  db: Database
) {
  const run = db.getRun(runId);
  const newRun = db.createRun({
    ...run,
    status: "pending",
    currentStepId: startStepId,
    steps: run.steps.filter(
      s => isUpstreamOf(s.stepId, startStepId, run.workflowResult)
    ),
  });
  executeRun(newRun);
}
```

**操作 C：从中断处继续（交互式步骤）**

```typescript
async function resumeFromWaiting(runId: string, db: Database) {
  const run = db.getRun(runId);
  if (run.status !== "waiting_user") return;
  db.markStepContinued(runId, run.currentStepId);
  executeRun(run);
}
```

---

## 九、执行引擎

### 9.1 定位

执行引擎是 Run 的驱动器，负责：

1. 解析 Run 的 target（OP 或 Workflow）。
2. 按 DAG 顺序调度节点。
3. 启动 CLI 子进程，收集输出。
4. 根据退出码和产物判定节点状态。
5. 根据流转条件推进到下一步。
6. 遇到交互式节点时暂停，等人工继续。
7. 记录全过程到 SQLite。

### 9.2 执行流程

```text
┌──────────────────────────────────────────┐
│  1. 创建 Run 记录                         │
└─────────────────┬────────────────────────┘
                  ▼
┌──────────────────────────────────────────┐
│  2. 计算 DAG 可执行节点（入度为 0）        │
└─────────────────┬────────────────────────┘
                  ▼
┌──────────────────────────────────────────┐
│  3. 对每个节点：                          │
│     - 解析参数绑定                        │
│     - 渲染内容模板                        │
│     - 启动 CLI 子进程                     │
│     - 收集 stdout/stderr/退出码           │
│     - 解析出参                            │
│     - 判定状态                            │
└─────────────────┬────────────────────────┘
                  ▼
┌──────────────────────────────────────────┐
│  4. 根据边条件激活下游节点                 │
│     - on_success / on_failure / expr      │
│     - 汇聚节点检查 joinPolicy              │
└─────────────────┬────────────────────────┘
                  ▼
┌──────────────────────────────────────────┐
│  5. 重复 3-4 直到无节点可执行              │
└─────────────────┬────────────────────────┘
                  ▼
┌──────────────────────────────────────────┐
│  6. 汇总结果，标记 Run 状态                │
└──────────────────────────────────────────┘
```

### 9.3 单节点执行

```typescript
async function executeNode(
  node: WorkflowNode,
  op: OpDefinition,
  profile: CliProfile,
  context: ExecutionContext
): Promise<StepRecord> {
  // 1. 解析参数
  const inputs = resolveBindings(node.bindings, context);

  // 2. 渲染内容模板
  const prompt = renderTemplate(op.content, {
    workspace: context.workspace,
    input: inputs,
    env: process.env,
  });

  // 3. 构建命令
  const command = profile.command;
  const args = profile.argsTemplate.map(a =>
    a.replace("{{prompt}}", prompt)
  );

  // 4. 启动子进程
  const proc = spawn(command, args, {
    cwd: profile.workingDir.replace("{{workspace}}", context.workspace),
    env: { ...process.env, ...profile.env },
    timeout: node.overrides?.timeout ?? op.timeout ?? profile.defaultTimeout,
  });

  // 5. 收集输出
  const stdout = await collectStdout(proc);
  const stderr = await collectStderr(proc);
  const exitCode = await proc.exitCode;

  // 6. 解析出参
  const outputs = parseOutputs(stdout, profile.outputParser, op.outputs);

  // 7. 判定状态
  const status = profile.exitCodeMap.success.includes(exitCode)
    ? "success"
    : "failed";

  return {
    stepId: node.nodeId,
    opId: op.id,
    status,
    inputs,
    outputs,
    rawOutput: stdout,
    exitCode,
    startedAt: proc.startTime,
    finishedAt: new Date().toISOString(),
  };
}
```

### 9.4 并发调度

- 无依赖的节点可并行执行。
- 通过 DAG 拓扑排序确定可执行批次。
- 每批内节点并行，批间串行。
- 汇聚节点等待其所有上游完成后才可执行（按 joinPolicy）。

---

## 十、退出码与产物契约

### 10.1 退出码语义

| 退出码 | 含义 | Run 状态 |
|-|-|-|
| 0 | 成功 | success |
| 非 0 | 失败 | failed |
| 超时 | 进程被 kill | timeout |
| 被终止 | 用户终止 | cancelled |

### 10.2 产物契约

**优先级**：

1. 若 CliProfile 指定 `resultFile`，且文件存在 → 从文件读取。
2. 否则按 `outputParser.mode` 解析 stdout。
3. 若解析失败 → 出参为空，但 Run 状态仍按退出码判定。

**产物文件约定**（可选）：

```json
{
  "status": "success",
  "outputs": {
    "passed": true,
    "count": 23
  },
  "raw": "..."
}
```

**stdout JSON 约定**（可选）：

```json
{
  "result": "...",
  "outputs": {
    "key": "value"
  }
}
```

### 10.3 日志存储

- 每个步骤的 stdout / stderr 全量落盘。
- 路径：`~/.app-name/runs/{runId}/{stepId}.stdout.log`
- 支持大文件按需加载。
- 运行历史中可查看每个步骤的完整日志。

---

## 十一、交互式步骤（降级方案）

### 11.1 定位

在不绑定任何 Agent CLI、不做 PTY 包 TUI 的前提下，交互式步骤采用**外部终端 + 人工推进**：

> Workflow 走到交互步骤时暂停，唤起系统终端，用户在终端中与 CLI 自由交互，完成后回到 App，点"继续"。

### 11.2 执行流程

1. Workflow 引擎遇到 `interactive: true` 的 OP。
2. 标记 Run 状态为 `waiting_user`，Step 状态为 `waiting_user`。
3. 在 UI 中显示"打开终端"按钮。
4. 用户点击，App 调用系统命令打开终端：

```text
# Windows
wt.exe -d {workspace} -- {command} {args}

# macOS
open -a Terminal --args {command} {args}

# Linux
x-terminal-emulator -e {command} {args}
```

5. 用户在终端中与 CLI 交互，包括 TUI。
6. 用户处理完，回到 App，点击"标记完成，继续"。
7. Workflow 引擎推进到下一步。

### 11.3 关键设计

| 规则 | 说明 |
|-|-|
| 不解析终端内容 | 引擎不知道用户在终端里做了什么 |
| 不识别 ask | 不尝试自动回答 |
| 不注入回答 | 一切交互在外部终端进行 |
| 人工确认边界 | 用户点"继续"作为步骤完成的信号 |
| 保留日志 | 可选：终端输出重定向到日志文件 |
| 可跳过 | 用户可选择跳过该步骤 |

### 11.4 UI 展示

```text
┌──────────────────────────────────────────┐
│  Step 3: review（交互式）                 │
│                                          │
│  状态: ⏸ 等待人工                         │
│                                          │
│  命令:                                    │
│  ┌────────────────────────────────────┐  │
│  │ claude -p "请审查以下代码..."       │  │
│  └────────────────────────────────────┘  │
│                                          │
│  工作区: /path/to/workspace               │
│                                          │
│  [打开终端]  [标记完成，继续]  [跳过]      │
└──────────────────────────────────────────┘
```

---

## 十二、持久化与恢复

### 12.1 数据模型

SQLite 表：

| 表 | 用途 |
|-|-|
| `cli_profiles` | CLI 配置 |
| `op_definitions` | OP 定义 |
| `workflow_definitions` | Workflow 定义 |
| `job_definitions` | Job 定义 |
| `runs` | Run 实例 |
| `steps` | 步骤记录 |
| `processes` | 进程记录 |
| `artifacts` | 产物文件引用 |

### 12.2 恢复流程

应用重启后：

1. 扫描所有 `status in (pending, running, waiting_user)` 的 Run。
2. 对每个 Run 的每个步骤：
   - 若 `processRecord.pid` 存在，检查进程是否存活。
   - 若进程已死，读退出码和日志，标记步骤状态。
3. 根据步骤状态重建 Run 状态：

| 情况 | 处理 |
|-|-|
| 所有步骤 success | 标记 Run success |
| 有步骤 failed | 标记 Run failed |
| 有步骤 waiting_user | 标记 Run waiting_user，UI 提示继续 |
| 进程丢失但无退出码 | 标记 Run interrupted |

4. 提供人工操作：
   - 终止
   - 从指定步骤重启
   - 从中断处继续（交互式）
   - 标记完成
   - 标记失败

### 12.3 恢复原则

- **不自动重跑**：重启是低频事件，由人工决策。
- **不弹窗打扰**：恢复结果直接体现在运行历史/工作台。
- **保留全部日志**：即使进程已死，日志仍可查看。
- **状态可人工修正**：允许用户手动标记步骤完成/失败。

---

## 十三、UI 与用户交互

### 13.1 整体布局

```text
┌──────────────┬────────────────────────────────┬──────────────┐
│  左侧栏       │  中间交互区                     │  右侧区域     │
│  (固定)       │                                │  (可收起)     │
│              │                                │              │
│  工作区列表   │  当前 Run 的详情 / 日志         │  按需加载的    │
│  └ 会话列表   │  + 操作按钮                     │  Tab 工作台   │
│              │                                │              │
└──────────────┴────────────────────────────────┴──────────────┘
```

### 13.2 菜单栏

```text
┌──────────────────────────────────────────────────────────────┐
│  会话管理  扩展功能  帮助                                      │
└──────────────────────────────────────────────────────────────┘

会话管理(S)
├── 新建工作区
├── 删除工作区
└── 导入外部配置

扩展功能(E)
├── CLI 配置管理...
├── OP 管理...
├── Workflow 管理...
├── 作业管理...
└── 运行历史...

帮助(H)
├── 使用文档
├── 快捷键
└── 关于
```

### 13.3 右侧区域 Tab

| Tab | 定位 |
|-|-|
| 运行列表 | 当前工作区的所有 Run，实时状态 |
| 文件 | 工作区文件树 |
| 文件预览 | 双击文件派生 |

### 13.4 运行列表视图

```text
┌──────────────────────────────────────────────┐
│  [运行列表 ×] [文件 ×] [＋]                    │
├──────────────────────────────────────────────┤
│  ▼ 当前工作区 (3)                             │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 📋 deploy_workflow                      │  │
│  │ ● 运行中  step 3/8   2 分钟前           │  │
│  │ ┌────────────────────────────────────┐ │  │
│  │ │ 步骤                                │ │  │
│  │ │  ✓ check_tests  12.3s              │ │  │
│  │ │  ✓ review       5.2s               │ │  │
│  │ │  ● deploy       ← 运行中            │ │  │
│  │ │    └ 输出: Deploying...            │ │  │
│  │ └────────────────────────────────────┘ │  │
│  ├────────────────────────────────────────┤  │
│  │ 📦 log_analysis                         │  │
│  │ ✓ 已完成     10 分钟前                  │  │
│  ├────────────────────────────────────────┤  │
│  │ 📦 code_review                          │  │
│  │ ⏸ 等待人工   1 小时前                   │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### 13.5 输入区行为

| 当前视图 | 输入区行为 |
|-|-|
| 工作台首页 | 输入 `/` 触发选择器，选择 OP / Workflow / Job |
| Run 详情（运行中） | 只读，显示日志 |
| Run 详情（等待人工） | 显示"打开终端"和"继续"按钮 |
| Run 详情（已完成） | 只读，显示结果 |

### 13.6 触发入口

在中间交互区输入 `/`：

```text
┌──────────────────────────────────────┐
│  选择执行目标                         │
├──────────────────────────────────────┤
│  📦 OP                               │
│  📋 Workflow                         │
│  ⏰ Job                              │
│  ──────────────────────────────────  │
│  ⚙ 管理...                           │
└──────────────────────────────────────┘
```

选择后填写入参、选择工作区，点击"启动"。

---

## 十四、实现优先级

| 顺序 | 内容 | 说明 |
|-|-|-|
| 1 | CliProfile 管理 | CLI 配置的增删改查、导入导出 |
| 2 | OP 管理 + 试运行 | OP 定义、单次执行、结果查看 |
| 3 | 执行引擎（单 OP） | 启动进程、收集输出、解析出参、退出码判定 |
| 4 | Workflow 管理 + 执行 | DAG 定义、参数绑定、流转、执行 |
| 5 | Run 持久化与恢复 | SQLite、日志落盘、重启恢复 |
| 6 | Job 管理 + 定时 | Job 定义、Cron 调度、并发策略 |
| 7 | 运行历史 | 全局列表、筛选、重跑、终止 |
| 8 | 右侧区域框架 | Tab 加载、排序、会话级保持 |
| 9 | 文件 Tab + 文件预览 | 文件树、懒加载、双击预览 |
| 10 | 交互式步骤降级 | 外部终端唤起、人工继续 |

---

## 十五、关键设计决策总结

| 决策点 | 建议 | 理由 |
|-|-|-|
| 执行内核 | CLI 子进程 | 不绑定 serve API，复用 CLI 原生能力 |
| 确定性来源 | 退出码 + 产物 | 不依赖 LLM 解析 |
| CLI 适配 | CliProfile 配置 | 切换 Agent 只改配置 |
| 参数模型 | 上游出参自动流向绑定它的下游入参 | 不需要重复声明 |
| 流转模型 | 顺序 / 条件 / 并行 / 汇聚 | 基于 DAG 的控制流 |
| 交互式 | 外部终端 + 人工推进 | 不实现 PTY 包 TUI |
| 恢复 | 人工决策 + 状态查询 | 重启是低频事件 |
| 并发 | DAG 拓扑排序，无依赖节点并行 | 最大化吞吐 |
| 产物契约 | 退出码优先，JSON/文件/正则可选 | 兼容不同 CLI 输出能力 |
| 日志 | 全量落盘，按需加载 | 支持大文件、可审计 |
| 持久化 | SQLite | 本地、轻量、事务性 |
| 界面 | 左中右三栏 + 可收起 Tab | 与桌面应用习惯一致 |

---

## 十六、核心结论

**本方案的核心是：**

> **把 Agent CLI 当作黑盒命令。编排器只负责启动进程、送输入、收输出、看退出码、读产物、按 DAG 推进。交互式步骤降级为"唤起外部终端 + 人工推进"。**

**四层结构**：

- **OP** 是"函数"，定义单个操作，声明签名。
- **Workflow** 是"程序"，引用 OP，绑定参数，定义流转。
- **Job** 是"可执行的作业配置"，绑定工作区，配置触发方式。
- **Run** 是"一次执行实例"，统一记录所有执行。

**不依赖**：

- ❌ serve API
- ❌ 统一事件流
- ❌ 内嵌终端
- ❌ LLM 做流程控制

**复用**：

- ✅ CLI 原生工具、技能、权限、认证
- ✅ 退出码、stdout/stderr、产物文件
- ✅ 已有 Agent CLI 的一切能力

**切换 Agent = 切换 CliProfile，App 与 Workflow 引擎不变。**