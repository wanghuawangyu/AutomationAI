# 子文档二：CliProfile

## 一、定位

CliProfile 是编排器与具体 Agent CLI 之间的**唯一契约**。它描述"如何调用某个 CLI"，不描述"CLI 内部如何工作"。

**切换 Agent = 切换 CliProfile，App 与 Workflow 引擎完全不变。**

### 核心约束

- 不绑定 Agent CLI，通过 CliProfile 配置适配。
- 只走命令行，通过子进程调用，不依赖 serve API。
- 无统一事件流，以退出码、stdout/stderr、产物文件为判定依据。

## 二、数据结构

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

## 三、字段说明

| 字段 | 说明 |
|-|-|
| id | 唯一标识，用于 OP 引用 |
| name | 显示名称 |
| command | 可执行文件命令 |
| argsTemplate | 参数模板数组，支持变量插值 |
| workingDir | 工作目录模板 |
| inputMode | prompt 的传递方式 |
| stdinTemplate | 当 inputMode = stdin 时的输入模板 |
| outputParser | 输出解析策略 |
| exitCodeMap | 退出码语义映射 |
| env | 附加环境变量 |
| defaultTimeout | 默认超时（秒） |
| defaultRetry | 默认重试策略 |
| capabilities | 能力声明，供引擎降级判断 |

## 四、输入方式

| inputMode | 说明 | 适用 |
|-|-|-|
| arg | prompt 作为命令行参数 | 大多数 CLI |
| stdin | prompt 通过 stdin 传入 | 支持管道输入的 CLI |
| file | prompt 写入临时文件，路径作为参数传入 | 超长 prompt |

## 五、输出解析

出参解析方式由 CliProfile 的 outputParser 决定：

| mode | 说明 | 适用 |
|-|-|-|
| text | 整个 stdout 作为字符串 | 通用 |
| json | 从 stdout 提取 JSON，按 jsonPath 取值 | 支持 JSON 输出的 CLI |
| jsonl | 逐行解析 JSON，最后一行或聚合作为结果 | 支持 JSONL 的 CLI |
| regex | 用正则从 stdout 提取 | 无结构化输出 |

**产物文件优先级**：如果 CliProfile 指定了 resultFile，且文件存在，优先从该文件读取出参。

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

## 六、能力声明

| 能力 | 说明 | 影响 |
|-|-|-|
| nonInteractive | 是否支持非交互模式 | 为 false 时不能作为 Job 目标 |
| sessionResume | 是否支持会话恢复 | 为 true 时可在 Run 重启时复用会话 |
| structuredOutput | 是否支持结构化输出 | 为 true 时可使用 json/jsonl 解析 |

## 七、配置示例

### 7.1 Claude Code

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

### 7.2 Codex CLI

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

### 7.3 Cursor Agent

```yaml
id: cursor-agent
name: Cursor Agent
command: cursor-agent
argsTemplate:
  - "-p"
  - "{{prompt}}"
  - "--output-format"
  - "json"
inputMode: arg
outputParser:
  mode: json
exitCodeMap:
  success: [0]
capabilities:
  nonInteractive: true
  sessionResume: true
  structuredOutput: true
```

### 7.4 通用 Agent CLI

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

### 7.5 stdin 模式示例

```yaml
id: pipe-agent
name: 管道式 Agent
command: agent-cli
argsTemplate:
  - "run"
  - "--no-tty"
inputMode: stdin
stdinTemplate: "{{prompt}}"
outputParser:
  mode: text
exitCodeMap:
  success: [0]
capabilities:
  nonInteractive: true
  sessionResume: false
  structuredOutput: false
```

## 八、变量插值

CliProfile 中的模板支持以下变量：

| 变量 | 说明 |
|-|-|
| `{{prompt}}` | 渲染后的 prompt |
| `{{workspace}}` | 当前工作区路径 |
| `{{env.xxx}}` | 环境变量 |
| `{{secrets.xxx}}` | 敏感信息（如 API Key） |

## 九、CliProfile 管理

### 9.1 管理能力

- 新增、编辑、复制、删除。
- 导入/导出 YAML 文件。
- 从内置模板创建。

### 9.2 存储

存储于本地 SQLite（cli_profiles 表）。

### 9.3 编辑器 UI

```text
┌──────────────────────────────────────────────┐
│  ← 返回  编辑: claude-code                    │
├──────────────────────────────────────────────┤
│  名称: [Claude Code          ]                │
│  ID:   [claude-code          ]                │
│  描述: [Claude Code CLI 适配  ]                │
│                                              │
│  命令: [claude               ]                │
│  工作目录: [{{workspace}}     ]                │
│                                              │
│  参数模板:                                    │
│  ┌────────────────────────────────────────┐  │
│  │ ["-p", "{{prompt}}",                   │  │
│  │  "--output-format", "json"]            │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  输入方式: [arg ▾]                            │
│                                              │
│  输出解析:                                    │
│  mode: [json ▾]                              │
│  jsonPath: [$.result           ]             │
│  resultFile: [.agent/result.json]            │
│                                              │
│  退出码语义:                                  │
│  成功: [0]                                    │
│                                              │
│  能力声明:                                    │
│  [✓] 支持非交互模式                           │
│  [✓] 支持会话恢复                             │
│  [✓] 支持结构化输出                           │
│                                              │
│  超时: [600s]  重试: [0次]                    │
│                                              │
│           [取消]  [保存]  [测试命令]          │
└──────────────────────────────────────────────┘
```

### 9.4 测试命令

保存前可点击"测试命令"，引擎会：
1. 使用示例 prompt 渲染命令。
2. 启动子进程执行。
3. 显示 stdout / stderr / 退出码 / 解析结果。
4. 让用户确认配置是否正确。

## 十、内置模板

系统预置常见 CLI 的配置模板：

| 模板 ID | 名称 | 命令 |
|-|-|-|
| claude-code | Claude Code | claude |
| codex | Codex CLI | codex |
| cursor-agent | Cursor Agent | cursor-agent |
| cline | Cline | cline |
| opencode | OpenCode | opencode |
| crush | Crush | crush |
| jcode | jcode | jcode |
| generic-agent | 通用 Agent CLI | my-agent |

用户可基于模板创建、修改、保存。

## 十一、关键设计决策

| 决策点 | 建议 | 理由 |
|-|-|-|
| 定位 | 编排器与 CLI 的唯一契约 | 切换 CLI 只改配置 |
| 存储 | 本地 SQLite | 轻量、事务性 |
| 模板 | 支持内置 + 自定义 | 降低配置成本 |
| 变量 | 支持插值 | 灵活适配 |
| 能力声明 | 显式声明 | 供引擎降级判断 |
| 测试 | 保存前可测试 | 降低配置错误 |