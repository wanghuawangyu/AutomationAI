# 子文档三：OP

## 一、定位

OP 是**最小可执行单元**，定义一个操作。它是"函数"，只声明签名，不关心流转。

- 定义单个操作。
- 声明名称、ID、类型、内容、入参、出参。
- 只声明签名，不关心执行流转。
- 可以被 Workflow 引用，也可以单独运行。

## 二、数据结构

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

interface RetryPolicy {
  maxAttempts: number;
  backoff: "constant" | "linear" | "exponential";
  intervalMs: number;
}
```

## 三、字段说明

| 字段 | 说明 |
|-|-|
| id | 唯一标识，用于 Workflow 引用 |
| name | 显示名称 |
| description | 描述 |
| type | 执行器类型 |
| content | 内容模板（prompt 或脚本） |
| inputs | 入参声明 |
| outputs | 出参声明 |
| interactive | 手动标记：执行中是否可能产生 ask |
| cliProfileId | 当 type = agent_cli 时指定 |
| timeout | 超时（秒） |
| retry | 重试策略 |

## 四、OP 类型

| 类型 | 说明 | 执行器 | 典型场景 |
|-|-|-|-|
| agent_cli | 调用 Agent CLI，由 CliProfile 决定具体命令 | 子进程 | 分析日志、生成代码、总结内容 |
| bash | 执行 Bash 脚本 | 子进程 | Linux/macOS 下的命令执行 |
| python | 执行 Python 脚本 | 子进程 | 数据处理、调用 Python 库 |
| powershell | 执行 PowerShell 脚本 | 子进程 | Windows 下的命令执行 |

## 五、交互性标记

interactive 属性：

| 值 | 说明 |
|-|-|
| true | 执行中可能产生 ask，需要用户回答 |
| false | 执行中不产生 ask，全自动完成 |

**规则**：
- 手动标记，不由类型自动决定。
- interactive = true 的 OP 不能用于定时 Job。
- interactive = true 的 OP 在 Workflow 中会触发交互式步骤处理。

## 六、OP 内容模板

### 6.1 变量插值

OP 的 content 支持变量插值：

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

### 6.2 各类型的内容示例

**agent_cli**

```text
在当前工作区运行测试，并输出结果 JSON：
{
  "passed": boolean,
  "count": number
}
```

**bash**

```bash
#!/bin/bash
cd "{{workspace}}"
npm run test
```

**python**

```python
import json
import os

workspace = "{{workspace}}"
result = {"status": "success", "workspace": workspace}
print(json.dumps(result))
```

**powershell**

```powershell
Set-Location "{{workspace}}"
npm run test
```

## 七、OP 执行结果

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

### 三个关键产物

| 产物 | 用途 |
|-|-|
| status | Workflow 层用它决定走成功分支还是失败分支 |
| outputs | Workflow 层用它绑定到下游 OP 的入参 |
| rawOutput | 用于展示、调试、审计 |

## 八、OP 出参解析

### 8.1 解析优先级

1. 若 CliProfile 指定 resultFile，且文件存在 → 从文件读取。
2. 否则按 outputParser.mode 解析 stdout。
3. 若解析失败 → 出参为空，但 Run 状态仍按退出码判定。

### 8.2 解析方式

| mode | 说明 |
|-|-|
| text | 整个 stdout 作为字符串 |
| json | 从 stdout 提取 JSON，按 jsonPath 取值 |
| jsonl | 逐行解析 JSON，最后一行或聚合作为结果 |
| regex | 用正则从 stdout 提取 |

### 8.3 产物文件约定

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

### 8.4 stdout JSON 约定

```json
{
  "result": "...",
  "outputs": {
    "key": "value"
  }
}
```

## 九、OP 管理器

### 9.1 列表视图

```text
┌──────────────────────────────────────────────────────────┐
│  OP 管理                              [＋ 新建] [导入]    │
├──────────────────────────────────────────────────────────┤
│  🔍 搜索...                                              │
├──────────────────────────────────────────────────────────┤
│  📦 check_tests    agent_cli   入参 0 · 出参 2 · 非交互  2天前  [运行] [编辑] [复制] [删除] │
│  📦 review         agent_cli   入参 1 · 出参 1 · 交互式  1周前  [运行] [编辑] [复制] [删除] │
│  📦 clean_logs     powershell  入参 1 · 出参 0 · 非交互  1周前  [运行] [编辑] [复制] [删除] │
│  📦 process_data   python      入参 1 · 出参 1 · 非交互  1月前  [运行] [编辑] [复制] [删除] │
└──────────────────────────────────────────────────────────┘
```

### 9.2 编辑器视图

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

## 十、单独运行视图

```text
┌──────────────────────────────────────────────┐
│  运行结果: check_tests                        │
├──────────────────────────────────────────────┤
│  状态: ✓ 成功                                 │
│  耗时: 12.3s                                  │
│  退出码: 0                                    │
│                                              │
│  出参:                                        │
│  passed: true                                │
│  count:  23                                  │
│                                              │
│  原始输出:                                     │
│  ┌────────────────────────────────────────┐  │
│  │ 23 tests passed, 0 failed              │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

## 十一、试运行

### 11.1 行为

- 在编辑器中点击"试运行"。
- 引擎使用默认入参或用户填写的测试入参执行一次。
- 显示完整结果：状态、退出码、stdout、stderr、解析出的出参。
- 不写入运行历史（除非用户点击"保存为 Run"）。

### 11.2 试运行入参

如果 OP 有 required 入参，试运行前需要用户填写：

```text
┌──────────────────────────────────────┐
│  试运行 check_tests                   │
├──────────────────────────────────────┤
│  工作区: [/path/to/workspace]         │
│                                      │
│  入参:                                │
│  test_cmd: [npm run test       ]     │
│                                      │
│           [取消]  [运行]              │
└──────────────────────────────────────┘
```

## 十二、OP 执行流程

```text
┌──────────────────────────────────────────┐
│  1. 接收执行请求（含入参）                 │
└─────────────────┬────────────────────────┘
                  ▼
┌──────────────────────────────────────────┐
│  2. 解析参数                              │
└─────────────────┬────────────────────────┘
                  ▼
┌──────────────────────────────────────────┐
│  3. 渲染内容模板                          │
│     - 替换 {{workspace}}、{{input.xxx}}   │
└─────────────────┬────────────────────────┘
                  ▼
┌──────────────────────────────────────────┐
│  4. 构建命令                              │
│     - 使用 CliProfile 的 command/args     │
│     - 替换 {{prompt}}                     │
└─────────────────┬────────────────────────┘
                  ▼
┌──────────────────────────────────────────┐
│  5. 启动子进程                            │
│     - 设置 cwd、env、timeout              │
└─────────────────┬────────────────────────┘
                  ▼
┌──────────────────────────────────────────┐
│  6. 收集输出                              │
│     - stdout、stderr、exitCode            │
│     - 全量落盘                            │
└─────────────────┬────────────────────────┘
                  ▼
┌──────────────────────────────────────────┐
│  7. 解析出参                              │
│     - 按 outputParser.mode 解析           │
│     - 优先从 resultFile 读取              │
└─────────────────┬────────────────────────┘
                  ▼
┌──────────────────────────────────────────┐
│  8. 判定状态                              │
│     - 按 exitCodeMap 判定                 │
│     - 记录 OpRunResult                    │
└──────────────────────────────────────────┘
```

## 十三、OP 与 Workflow / Job 的关系

| 关系 | 说明 |
|-|-|
| OP → Workflow | Workflow 引用 OP 作为节点 |
| OP → Job | Job 可以直接引用单个 OP 作为 target |
| 修改影响 | OP 修改会向上传播到引用它的 Workflow 和 Job |

## 十四、关键设计决策

| 决策点 | 建议 | 理由 |
|-|-|-|
| 定位 | 函数，只声明签名 | 职责单一，可复用 |
| 类型 | agent_cli / bash / python / powershell | 覆盖主要执行器 |
| 交互性 | 手动标记 | 不由类型自动决定 |
| 内容模板 | 支持变量插值 | 灵活复用 |
| 出参解析 | 退出码优先，JSON/文件/正则可选 | 兼容不同 CLI |
| 试运行 | 保存前可试 | 降低配置错误 |
| 存储 | 本地 SQLite | 轻量、事务性 |