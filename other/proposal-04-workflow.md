# 子文档四：Workflow

## 一、定位

Workflow 是**基于数据流 + 控制流的有向无环图（DAG）**，引用多个 OP，绑定参数，定义流转。

- 引用多个 OP，绑定参数，定义流转。
- 是"程序"，不关心触发方式，不关心执行历史。
- 可以被 Job 引用，也可以单独运行。

## 二、数据结构

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

## 三、字段说明

### 3.1 Workflow

| 字段 | 说明 |
|-|-|
| id | 唯一标识 |
| name | 显示名称 |
| description | 描述 |
| inputs | 编排入参声明 |
| outputs | 编排出参声明 |
| nodes | 节点列表 |
| edges | 流转关系 |

### 3.2 WorkflowNode

| 字段 | 说明 |
|-|-|
| nodeId | 在 Workflow 内的唯一 ID（不是 OP 的 ID） |
| opId | 引用哪个 OP |
| opVersion | 可选：锁定 OP 版本 |
| bindings | 参数绑定 |
| joinPolicy | 汇聚策略 |
| overrides | 超时 / 重试覆盖 |

### 3.3 ParamBinding

| kind | 说明 |
|-|-|
| workflow_input | 来自 Workflow 入参 |
| node_output | 来自某个节点的出参 |
| literal | 字面量 |

### 3.4 EdgeCondition

| kind | 说明 |
|-|-|
| always | 无条件，顺序执行 |
| on_success | 上游成功 |
| on_failure | 上游失败 |
| expression | 表达式 |

## 四、参数模型

### 4.1 参数的三种来源

| 来源 | 说明 | 是否需要在编排层声明 |
|-|-|-|
| Workflow 入参 | 整个编排的外部输入 | ✅ 必须声明 |
| Op 出参 | 某个 op 执行后产生的结果 | ❌ 由 op 自己定义 |
| Op 入参 | 某个 op 执行前需要的参数 | 取决于来源 |

### 4.2 参数连接规则

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

### 4.3 核心原则

> 参数沿着 DAG 的边自动流动，不需要在编排层重复声明。只有真正的外部输入才在 Workflow 入参中声明，只有真正需要暴露的结果才在 Workflow 出参中声明。

## 五、流转模型

### 5.1 四种流转类型

| 类型 | 说明 | 触发条件 |
|-|-|-|
| 顺序流转 | 上一个 op 完成后直接执行下一个 | 无条件 |
| 条件流转 | 根据上一个 op 的结果决定走哪条分支 | on_success / on_failure / expression |
| 并行流转 | 一个 op 完成后同时触发多个下游 op | 扇出 |
| 汇聚流转 | 多个 op 都完成后才触发下一个 op | 扇入 |

### 5.2 扇出（并行）

```text
        ┌──→ Op B1
Op A ───┼──→ Op B2
        └──→ Op B3
```

- Op A 完成后，同时触发 B1、B2、B3。
- 三条边可以是相同条件，也可以是不同条件。

### 5.3 扇入（汇聚）

```text
Op B1 ──┐
Op B2 ──┼──→ Op C
Op B3 ──┘
```

| 汇聚策略 | 说明 |
|-|-|
| all_success（默认） | 所有上游 op 都成功后才触发 |
| all_done | 所有上游 op 都完成（无论成功失败）后触发 |
| any_success | 任意一个上游 op 成功即触发 |
| any_done | 任意一个上游 op 完成即触发 |

### 5.4 条件分支

**成功/失败分支**

```text
        ┌──→ Op B_success (on_success)
Op A ───┤
        └──→ Op B_failure (on_failure)
```

**表达式分支**

```text
        ┌──→ Op B (expr: "node_check.outputs.count > 0")
Op A ───┤
        └──→ Op C (expr: "node_check.outputs.count == 0")
```

### 5.5 表达式语法

基于 nodeId.outputs.xxx 的确定性表达式：

| 运算符 | 说明 |
|-|-|
| == / != | 相等 / 不等 |
| > / < / >= / <= | 比较 |
| && / \|\| / ! | 逻辑 |
| in | 包含 |

### 5.6 完整流转示例

```text
                    ┌──→ Op B1 ──┐
Op A ──→ Op_cond ───┼──→ Op B2 ──┼──→ Op C ──→ Op D
                    └──→ Op B3 ──┘
                         (join: all_success)
```

| 步骤 | 说明 |
|-|-|
| Op A | 第一个 op，执行完成后进入 Op_cond |
| Op_cond | 条件判断，决定是否扇出到 B1/B2/B3 |
| Op B1/B2/B3 | 并行执行 |
| Op C | 汇聚点，等 B1/B2/B3 都成功后触发 |
| Op D | 最后一个 op，完成后整个编排成功 |

## 六、Workflow 校验规则

### 6.1 参数校验

| 规则 | 说明 |
|-|-|
| 入参来源校验 | 每个 op 的 required 入参必须有来源 |
| 出参引用校验 | Workflow 出参引用的 op 和出参名必须存在 |
| 类型匹配校验 | 上游出参类型与下游入参类型兼容 |
| 必填校验 | Workflow 入参中 required=true 的必须提供 |

### 6.2 结构校验

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

### 6.3 执行校验

| 规则 | 说明 |
|-|-|
| op 失败处理 | 每个 op 可以声明 on_failure 策略：abort / continue / retry |
| 超时 | 每个 op 可以声明超时时间 |
| 重试 | 每个 op 可以声明重试次数和间隔 |

## 七、Workflow 交互性动态计算

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

**动态计算**：Workflow 的交互性不写死，而是根据引用的 OP 动态计算。当 OP 的 interactive 属性变化时，引用它的 Workflow 自动重新计算。

## 八、YAML 定义示例

```yaml
name: deploy_workflow
description: 部署流程

# Workflow 入参
inputs:
  - name: target_env
    type: string
    required: true
    description: "目标环境"

# Workflow 出参
outputs:
  - name: deploy_url
    from: { nodeId: node_deploy, outputName: url }

# 节点
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

# 流转关系
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

## 九、Workflow 管理器

### 9.1 列表视图

```text
┌──────────────────────────────────────────────────────────┐
│  Workflow 库                          [＋ 新建] [导入]    │
├──────────────────────────────────────────────────────────┤
│  🔍 搜索...                                              │
├──────────────────────────────────────────────────────────┤
│  📋 deploy_workflow   部署流程 · 4 节点 · 交互式  2天前  [编辑] [复制] [删除] [导出] │
├──────────────────────────────────────────────────────────┤
│  📋 log_analysis      日志分析 · 5 节点 · 非交互  1周前  [编辑] [复制] [删除] [导出] │
├──────────────────────────────────────────────────────────┤
│  📋 code_review       代码审查 · 3 节点 · 非交互  1月前  [编辑] [复制] [删除] [导出] │
└──────────────────────────────────────────────────────────┘
```

### 9.2 编辑器视图

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

### 9.3 画布操作

- 从左侧 OP 库拖拽 OP 到画布，创建节点。
- 拖拽节点间的连线，创建边。
- 点击边，配置条件（always / on_success / on_failure / expression）。
- 点击节点，在右侧面板配置参数绑定。

### 9.4 参数绑定面板

```text
┌──────────────────────────────────────┐
│  节点: node_deploy                    │
│  OP:   deploy                         │
├──────────────────────────────────────┤
│  入参绑定:                            │
│                                      │
│  env (string, required):             │
│  ● Workflow 入参: [target_env ▾]     │
│  ○ 上游节点出参: [选择节点/参数 ▾]    │
│  ○ 字面量: [________________]         │
│                                      │
│  decision (string, required):        │
│  ○ Workflow 入参: [选择 ▾]           │
│  ● 上游节点出参: [node_review.decision ▾] │
│  ○ 字面量: [________________]         │
└──────────────────────────────────────┘
```

未绑定的入参高亮为错误状态，校验时提示。

## 十、Workflow 执行流程

```text
┌──────────────────────────────────────────┐
│  1. 校验 Workflow 定义                    │
│     - 参数校验 / 结构校验                  │
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

## 十一、并发调度

- 无依赖的节点可并行执行。
- 通过 DAG 拓扑排序确定可执行批次。
- 每批内节点并行，批间串行。
- 汇聚节点等待其所有上游完成后才可执行（按 joinPolicy）。

## 十二、单节点执行

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

## 十三、Workflow 与 OP / Job 的关系

| 关系 | 说明 |
|-|-|
| OP → Workflow | Workflow 引用 OP 作为节点 |
| Workflow → Job | Job 可以引用整个 Workflow 作为 target |
| 修改影响 | Workflow 修改会向上传播到引用它的 Job |

## 十四、关键设计决策

| 决策点 | 建议 | 理由 |
|-|-|-|
| 定位 | 程序，引用 OP，定义流转 | 职责清晰，可复用 |
| 参数模型 | 上游出参自动流向绑定它的下游入参 | 不需要重复声明 |
| 流转模型 | 顺序 / 条件 / 并行 / 汇聚 | 基于 DAG 的控制流 |
| 汇聚策略 | all_success / all_done / any_success / any_done | 灵活控制扇入 |
| 交互性 | 动态计算（引用 OP 中任意一个交互即交互） | 自动传播 |
| 校验 | 参数 + 结构 + 执行三层 | 保证正确性 |
| 存储 | 本地 SQLite | 轻量、事务性 |