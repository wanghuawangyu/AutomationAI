# AI 自动化 —— 五界面关系与功能描述

## 一、应用定位

**应用名称**：AI 自动化

**定位**：基于 CLI 命令行的确定性工作流编排器。通过命令行调用 Agent CLI，复用其原生能力，提供 Client / OP / Workflow / Job / 运行历史的四层定义与统一执行能力。

**核心原则**：

> **执行点只有 Job。OP 和 Workflow 是定义，Job 是执行载体。所有执行记录统一进入运行历史。**

**关键约束**：

1. **所有 ID 使用 32 位 UUID**（去掉连字符的 UUID v4，共 32 个十六进制字符）。
2. **Client 可能支持交互式，但在本 APP 下只能使用非交互式方式调用。**
3. **OP 是最小执行单元，不含 retry 字段。** 重试在 Workflow 编排层配置，可指定成功时重试或失败时重试。
4. **OP 不与 Client 绑定**，执行时由用户通过下拉列表选择 Client。
5. **OpInput / OpOutput 的 type 只支持 string。**
6. **所有时间字段使用 u128 毫秒时间戳**，命名以 Ms 结尾，不使用字符串。
7. **OP 有版本概念**，保存时确认是否升版本，默认 v1。
8. **Workflow 有入参和出参**，用于承接外部输入和暴露内部结果。
9. **单次执行需要指定工作区**，因为是虚拟 Job，工作区不可省略。

---

## 二、ID 规范

### 2.1 统一格式

所有 ID 均为 **32 位 UUID**（无连字符）：

```text
格式：xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
长度：32 个字符
字符集：0-9, a-f
生成方式：UUID v4，去掉连字符
示例：a1b2c3d4e5f67890abcdef1234567890
```

### 2.2 涉及 ID 的实体

| 实体 | ID 字段 | 说明 |
|-|-|-|
| Client | id | CliProfile 唯一标识 |
| OP | id | OP 唯一标识（写入 DB 时生成，界面不感知） |
| Workflow | id | Workflow 唯一标识 |
| WorkflowNode | nodeId | 节点在 Workflow 内的唯一标识 |
| Job | id | 持久 Job 唯一标识 |
| JobRun | id | 每次执行的唯一标识 |
| StepRecord | stepId | 等于对应 nodeId |

### 2.3 命名与 ID 分离

| 字段 | 用途 | 示例 |
|-|-|-|
| id | 系统内部引用，机器使用 | `a1b2c3d4e5f67890abcdef1234567890` |
| name | 人类可读名称，界面展示 | `check_tests` |

**规则**：

- 界面列表、编辑器、下拉选择等展示 name。
- 内部引用、数据库外键、绑定关系等使用 id。
- name 允许重复，id 必须唯一。
- **OP 的 name 全局唯一**（从 Workflow 引用 OP 的角度看，name 是引用键）。
- **OP 的 id 界面不感知**，写入 DB 时自动生成。

---

## 三、时间戳规范

### 3.1 统一格式

所有时间字段使用 **u128 毫秒时间戳**：

| 字段 | 类型 | 说明 |
|-|-|-|
| createdAtMs | u128 | 创建时间（毫秒时间戳） |
| updatedAtMs | u128 | 更新时间（毫秒时间戳） |
| startedAtMs | u128 | 开始时间（毫秒时间戳） |
| finishedAtMs | u128 | 结束时间（毫秒时间戳） |
| lastActivityAtMs | u128 | 最后活动时间（毫秒时间戳） |

### 3.2 规则

| 规则 | 说明 |
|-|-|
| 后缀 | 所有时间戳字段以 `Ms` 结尾 |
| 类型 | u128（无符号 128 位整数） |
| 单位 | 毫秒 |
| 语义 | Unix Epoch 毫秒时间戳 |
| 不使用 | 不使用 ISO 8601 字符串 |
| 不使用 | 不使用秒级时间戳 |

### 3.3 传输与存储

| 场景 | 处理 |
|-|-|
| 后端 → 前端 | JSON 以 string 形式传输（超出 JS Number 安全范围） |
| 前端 → 后端 | JSON 以 string 形式传输，后端解析为 u128 |
| SQLite 存储 | 使用 TEXT，存十进制字符串 |
| 前端展示 | 按需格式化为人类可读时间 |

**示例**：

```json
{
  "id": "a1b2c3d4e5f67890abcdef1234567890",
  "name": "check_tests",
  "createdAtMs": "1735689600000",
  "updatedAtMs": "1735689600000"
}
```

---

## 四、整体界面布局

应用为**两栏布局**：左侧固定菜单栏，右侧内容区。

```text
┌──────────────────┬──────────────────────────────────────────────────┐
│  左侧菜单栏       │  右侧内容区                                       │
│  (固定)           │                                                  │
│                  │                                                  │
│  🧩 Client 管理   │  当前选中菜单的界面                                │
│  📦 OP 管理       │                                                  │
│  📋 Workflow 管理 │                                                  │
│  ⏰ Job 管理      │                                                  │
│  📜 运行历史      │                                                  │
│                  │                                                  │
│                  │                                                  │
└──────────────────┴──────────────────────────────────────────────────┘
```

| 区域 | 是否可收起 | 说明 |
|-|-|-|
| 左侧菜单栏 | ❌ 固定 | 五个一级菜单，始终可见 |
| 右侧内容区 | — | 当前选中菜单对应的界面 |

### 4.1 左侧菜单栏

```text
┌──────────────────┐
│  AI 自动化        │  ← 应用标题
├──────────────────┤
│  🧩 Client 管理   │
│  📦 OP 管理       │
│  📋 Workflow 管理 │
│  ⏰ Job 管理      │
│  📜 运行历史      │
├──────────────────┤
│                  │
│  ⚙ 设置          │  ← 底部辅助入口
└──────────────────┘
```

| 菜单项 | 说明 |
|-|-|
| Client 管理 | 管理 CLI 适配配置（仅非交互式） |
| OP 管理 | 管理最小可执行单元 |
| Workflow 管理 | 管理 DAG 编排 |
| Job 管理 | 管理持久作业配置 |
| 运行历史 | 查看所有 Job Run |

**设计原则**：

- 一级菜单固定为五个，不增加。
- 当前 APP 只做扩展功能中的子功能，无会话管理。
- 无右侧栏，无 Tab 工作台。
- 界面简洁，只保留核心功能。

---

## 五、五界面关系图

```text
┌────────────────────┐
│  Client 管理        │
│  （CLI 非交互适配）  │
└─────────┬──────────┘
          │ 执行时通过下拉列表选择
          ▼
┌────────────────────┐        被引用为节点        ┌────────────────────┐
│  OP 管理            │ ─────────────────────────→ │  Workflow 管理      │
│  （最小可执行单元）  │                            │  （DAG 编排）        │
└─────────┬──────────┘                            └─────────┬──────────┘
          │ 单次执行                                      │ 单次执行
          │ 创建虚拟 Job                                  │ 创建虚拟 Job
          │ 指定工作区                                    │ 指定工作区
          │ 选择 Client                                   │
          │                                              │
          ▼                                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Job 层（统一执行载体）                   │
│  ┌──────────────────┐         ┌──────────────────┐              │
│  │  持久 Job         │         │  虚拟 Job         │              │
│  │  （Job 管理界面）  │         │  （单次执行创建）  │              │
│  └────────┬─────────┘         └────────┬─────────┘              │
│           │                            │                        │
│           └────────────┬───────────────┘                        │
│                        ▼                                        │
│                  Job Run（执行实例）                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
              ┌────────────────────┐
              │  运行历史            │
              │  （全局 Job Run 管理）│
              └────────────────────┘
```

**核心关系一句话**：

```text
Client ←（执行时下拉选择）← OP ← Workflow
                              │
                              └──→ Job（持久 / 虚拟）──→ Job Run ──→ 运行历史
```

**说明**：

- Client 与 OP 不是引用关系，而是执行时的选择关系。
- OP 单次执行时，用户通过下拉列表选择 Client。
- OP 被 Workflow 引用为节点时，节点配置中通过下拉列表选择 Client。
- Workflow 有独立的入参和出参，用于承接外部输入、暴露内部结果。

---

## 六、界面引用关系表

| 源界面 | 目标界面 | 关系 | 说明 |
|-|-|-|-|
| Client 管理 | 无上游 | 被执行时选择 | 不引用其他界面，在执行时被选用 |
| OP 管理 | Client 管理 | 执行时下拉选择 | prompt 类型 OP 执行时选择一个 Client |
| OP 管理 | 运行历史 | 单次执行 | 创建虚拟 Job，产生 Job Run |
| Workflow 管理 | OP 管理 | 引用 | Workflow 节点引用 OP |
| Workflow 管理 | Client 管理 | 节点配置下拉选择 | 节点配置中选择 Client |
| Workflow 管理 | 运行历史 | 单次执行 | 创建虚拟 Job，产生 Job Run |
| Job 管理 | OP 管理 | 引用 | Job target 可以是单个 OP |
| Job 管理 | Workflow 管理 | 引用 | Job target 可以是整个 Workflow |
| Job 管理 | 运行历史 | 手动 / 定时运行 | 使用持久 Job，产生 Job Run |
| 运行历史 | OP 管理 | 回溯 | 查看 Job Run 的 target OP 定义 |
| 运行历史 | Workflow 管理 | 回溯 | 查看 Job Run 的 target Workflow 定义 |
| 运行历史 | Job 管理 | 回溯 | 查看 Job Run 对应的持久 Job 定义 |
| 运行历史 | Client 管理 | 回溯 | 查看步骤实际使用的 Client 配置 |

---

## 七、统一执行模型

### 7.1 执行来源

当前 app 只有四种执行来源，全部为**非交互式自动执行**，全部以 Job 为载体：

```text
执行来源（全部非交互，全部自动完成，全部走 Job）
├── OP 单次执行 ──────→ 虚拟 Job ──┐
├── Workflow 单次执行 ─→ 虚拟 Job ──┤
├── Job 手动运行 ──────→ 持久 Job ──┼──→ Job Run ──→ 运行历史
└── Job 定时运行 ──────→ 持久 Job ──┘
```

### 7.2 四种执行来源表

| 执行来源 | 触发位置 | Job 形态 | 是否产生 Job Run | 是否自动完成 | 是否进入运行历史 |
|-|-|-|-|-|-|
| OP 单次执行 | OP 管理界面列表 | 虚拟 Job | ✅ | ✅ | ✅ |
| Workflow 单次执行 | Workflow 管理界面 | 虚拟 Job | ✅ | ✅ | ✅ |
| Job 手动运行 | Job 管理界面 | 持久 Job | ✅ | ✅ | ✅ |
| Job 定时运行 | 后台调度 | 持久 Job | ✅ | ✅ | ✅ |

### 7.3 Job 的两种形态

| 形态 | 来源 | 是否持久化 | 是否有 jobId | 触发方式 |
|-|-|-|-|-|
| 持久 Job | Job 管理界面创建 | ✅ 存入 job_definitions | ✅ 永久（32 位 UUID） | 手动 / 定时 |
| 虚拟 Job | OP / Workflow 管理界面单次执行时临时创建 | ❌ 不存入 job_definitions | ✅ 临时 id（32 位 UUID，仅本次运行） | 单次 |

### 7.4 Client 的非交互式约束

**核心约束**：

> Client 本身可能支持交互式（如 TUI 模式），但在本 APP 下只能使用非交互式方式调用。

| 规则 | 说明 |
|-|-|
| CliProfile 只配置非交互式参数 | 必须使用 CLI 的 headless 参数（如 `-p`、`exec`、`--print`、`--no-tty`） |
| 禁止使用交互式参数 | 不允许配置进入 TUI 或 REPL 的参数 |
| 强制 stdin 关闭 | 运行时 stdin 立即关闭，防止 CLI 进入交互等待 |
| 超时保护 | 每个步骤必须有超时，防止 CLI 无限等待用户输入 |
| 交互式能力不声明 | CliProfile 不声明交互式能力，App 不感知 |

### 7.5 交互式任务的处理

当前 app 不做工作台，且 Client 只走非交互式，因此：

| 情况 | 处理 |
|-|-|
| OP.interactive = true | 不能作为持久 Job 的 target，Job 界面运行按钮置灰 |
| Workflow 引用了 interactive OP | 不能作为持久 Job 的 target，Job 界面运行按钮置灰 |
| 交互式 OP 的单次执行 | 允许（仅用于定义验证，不承载交互） |
| 交互式 Workflow 的单次执行 | 允许（同上） |

**当前版本说明**：

- OP 的交互性作为开关按钮，默认关闭。
- 当前版本不支持用户选择（置灰 / 不可点击）。
- 存储值固定为 false。

### 7.6 交互性传播链

```text
Client（强制非交互式调用）
        │
        │ 所有调用均为非交互
        ▼
OP.interactive（手动标记，当前版本固定 false）
        │
        │ 传播
        ▼
Workflow.interactive = 引用的 OP 中任意一个 interactive
        │
        │ 传播
        ▼
Job.interactive = target 的 interactive
        │
        │ 决定
        ▼
Job 能否在 Job 管理界面直接运行
```

### 7.7 重试模型

**核心原则**：

> OP 是最小执行单元，**本身不含重试**。重试在 Workflow 编排层配置。

| 层 | 是否含重试 | 说明 |
|-|-|-|
| OP | ❌ | OP 只执行一次，不感知重试 |
| Workflow 节点 | ✅ | 编排时可为单个节点配置重试 |
| Job | ❌ | Job 只引用 OP / Workflow，不配置重试 |

**Workflow 节点级重试配置**：

```typescript
interface NodeRetry {
  on: "failure" | "success";        // 失败时重试 / 成功时重试
  maxAttempts: number;               // 最大重试次数（含首次执行）
  backoff: "constant" | "linear" | "exponential";
  intervalMs: number;
}
```

**两种重试语义**：

| on | 语义 | 典型场景 |
|-|-|---------|
| failure | 节点失败时重试，直到成功或耗尽次数 | 网络抖动、临时故障、CLI 偶发失败 |
| success | 节点成功时重试，用于重复执行直到满足某条件 | 轮询、等待资源就绪、重复检查 |

---

## 八、Client 管理界面

### 8.1 定位

管理 CLI 适配配置，是编排器与具体 Agent CLI 的**唯一契约**。

**切换 Agent = 切换 Client，App 与 Workflow 引擎完全不变。**

**核心约束**：Client 配置只描述**非交互式调用方式**。

### 8.2 入口

左侧菜单栏 → Client 管理

### 8.3 核心功能

| 功能 | 说明 |
|-|-|
| 列表 | 展示所有 Client，含名称、命令、输出模式、更新时间 |
| 新建/编辑 | 配置 command、argsTemplate、inputMode、outputParser、exitCodeMap、env、timeout |
| 复制 | 基于已有配置快速创建 |
| 删除 | 删除未被引用的配置 |
| 导入/导出 | 支持 YAML 文件 |
| 从模板创建 | 内置常见 CLI 的非交互式模板 |
| 测试命令 | 用示例 prompt 执行，显示 stdout / stderr / 退出码 / 解析结果 |

### 8.4 关键字段

| 字段 | 说明 |
|-|-|
| id | 32 位 UUID，唯一标识 |
| name | 显示名称 |
| command | 可执行命令 |
| argsTemplate | 参数模板（必须为非交互式参数） |
| inputMode | arg / stdin / file |
| outputParser | text / json / jsonl / regex |
| exitCodeMap | 成功退出码 |
| defaultTimeout | 默认超时（强制要求） |
| createdAtMs | u128 毫秒时间戳 |
| updatedAtMs | u128 毫秒时间戳 |

**注意**：Client 不含 retry 字段。重试只在 Workflow 节点配置。

### 8.5 数据结构

```typescript
interface CliProfile {
  id: string;                       // 32 位 UUID
  name: string;
  description?: string;
  command: string;
  argsTemplate: string[];
  workingDir: string;
  inputMode: "arg" | "stdin" | "file";
  stdinTemplate?: string;
  outputParser: {
    mode: "text" | "json" | "jsonl" | "regex";
    jsonPath?: string;
    regexPattern?: string;
    resultFile?: string;
  };
  exitCodeMap: {
    success: number[];
  };
  env?: Record<string, string>;
  defaultTimeout?: number;
  createdAtMs: bigint;              // u128 毫秒时间戳
  updatedAtMs: bigint;              // u128 毫秒时间戳
}
```

### 8.6 列表视图

```text
┌──────────────────────────────────────────────────────────┐
│  Client 管理                          [＋ 新建] [导入]    │
├──────────────────────────────────────────────────────────┤
│  🔍 搜索...                                              │
├──────────────────────────────────────────────────────────┤
│  🧩 Claude Code    claude       JSON 输出     2天前   [编辑] [复制] [删除] │
│  🧩 Codex CLI      codex        JSONL 输出    1周前   [编辑] [复制] [删除] │
│  🧩 Cursor Agent   cursor-agent JSON 输出     1周前   [编辑] [复制] [删除] │
│  🧩 通用 Agent CLI  my-agent     文本输出      1月前   [编辑] [复制] [删除] │
└──────────────────────────────────────────────────────────┘
```

### 8.7 编辑器视图

```text
┌──────────────────────────────────────────────┐
│  ← 返回  编辑: Claude Code                    │
├──────────────────────────────────────────────┤
│  名称: [Claude Code          ]                │
│  描述: [Claude Code CLI 适配  ]                │
│                                              │
│  命令: [claude               ]                │
│  工作目录: [{{workspace}}     ]                │
│                                              │
│  参数模板（非交互式）:                         │
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
│  超时: [600s]                                 │
│                                              │
│           [取消]  [保存]  [测试命令]          │
└──────────────────────────────────────────────┘
```

### 8.8 非交互式配置示例

**Claude Code**

```yaml
id: a1b2c3d4e5f67890abcdef1234567890
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
```

**Codex CLI**

```yaml
id: b2c3d4e5f67890abcdef1234567890a1
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
```

**通用 Agent CLI（stdin 模式）**

```yaml
id: c3d4e5f67890abcdef1234567890a1b2
name: 通用 Agent CLI
command: my-agent
argsTemplate:
  - "run"
  - "--no-tty"
  - "--no-interactive"
inputMode: stdin
stdinTemplate: "{{prompt}}"
outputParser:
  mode: text
exitCodeMap:
  success: [0]
```

### 8.9 关联界面

| 关系 | 说明 |
|-|-|
| 被执行时下拉选择 | prompt 类型 OP 执行时通过下拉列表选择 |
| 被 Workflow 节点配置下拉选择 | 节点配置中通过下拉列表选择 Client |
| 被运行历史回溯 | 查看步骤实际使用的 Client |

### 8.10 约束

- 所有 CliProfile 必须使用非交互式参数。
- 必须配置 defaultTimeout，防止 CLI 无限等待输入。
- 运行时强制关闭 stdin，防止 CLI 进入交互模式。
- 删除前需检查是否被引用。

---

## 九、OP 管理界面

### 9.1 定位

管理**最小可执行单元**。OP 是“函数”，只声明签名，不关心流转。

**核心约束**：

1. OP 是最小单元，**不含 retry 字段**。重试在 Workflow 编排层配置。
2. OP **不与 Client 绑定**。执行时由用户通过下拉列表选择。
3. OP **不展示 id**。id 在写入 DB 时自动生成（32 位 UUID），界面不感知。
4. OP 的 **name 全局唯一**。
5. OpInput / OpOutput 的 **type 只支持 string**。
6. OP 有 **版本概念**，保存时确认是否升版本，默认 v1。

### 9.2 入口

左侧菜单栏 → OP 管理

### 9.3 核心功能

| 功能 | 说明 |
|-|-|
| 列表 | 展示所有 OP，含名称、类型、版本、入参/出参数量、交互性、更新时间 |
| 新建/编辑 | 配置名称、类型、描述、超时、入参、出参、内容 |
| 执行 | 列表界面点击 [执行]，确认后填参、选工作区、下拉选 Client，创建虚拟 Job |
| 复制 | 基于已有 OP 快速创建 |
| 删除 | 删除未被 Workflow / Job 引用的 OP |
| 导入/导出 | 支持 YAML 文件 |

### 9.4 OP 类型

| 类型 | 说明 | 是否绑定 Client |
|-|-|-|
| prompt | 向 Agent CLI 发送 prompt（非交互式调用） | ❌ 不绑定，执行时下拉选择 |
| bash | 执行 Bash 脚本 | ❌ |
| python | 执行 Python 脚本 | ❌ |
| powershell | 执行 PowerShell 脚本 | ❌ |

### 9.5 数据结构

```typescript
interface OpDefinition {
  id: string;                       // 32 位 UUID，写入 DB 时生成，界面不感知
  name: string;                     // 全局唯一，界面展示与引用键
  description?: string;
  type: "prompt" | "bash" | "python" | "powershell";
  content: string;
  inputs: OpInput[];
  outputs: OpOutput[];
  interactive: boolean;
  timeout?: number;
  version: number;
  createdAtMs: bigint;              // u128 毫秒时间戳
  updatedAtMs: bigint;              // u128 毫秒时间戳
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

### 9.6 关键字段

| 字段 | 说明 |
|-|-|
| id | 32 位 UUID，写入 DB 时生成，界面不感知 |
| name | 显示名称，全局唯一 |
| type | prompt / bash / python / powershell |
| description | 描述 |
| content | prompt 模板或脚本内容 |
| inputs | 入参声明，type 只支持 string |
| outputs | 出参声明，type 只支持 string |
| interactive | 执行中是否可能产生 ask（当前版本固定 false，不可选） |
| timeout | 超时（秒） |
| version | 版本号，默认 1 |
| createdAtMs | u128 毫秒时间戳 |
| updatedAtMs | u128 毫秒时间戳 |

**注意**：

- OP **不含 clientId 字段**。OP 不与 Client 绑定。
- OP **不含 retry 字段**。重试在 Workflow 编排层配置。

### 9.7 列表视图

```text
┌──────────────────────────────────────────────────────────┐
│  OP 管理                              [＋ 新建] [导入]    │
├──────────────────────────────────────────────────────────┤
│  🔍 搜索...                                              │
├──────────────────────────────────────────────────────────┤
│  📦 check_tests    prompt      v1  入参 0 · 出参 2 · 非交互  2天前  [执行] [编辑] [复制] [删除] │
│  📦 review         prompt      v2  入参 1 · 出参 1 · 非交互  1周前  [执行] [编辑] [复制] [删除] │
│  📦 clean_logs     powershell  v1  入参 1 · 出参 0 · 非交互  1周前  [执行] [编辑] [复制] [删除] │
│  📦 process_data   python      v3  入参 1 · 出参 1 · 非交互  1月前  [执行] [编辑] [复制] [删除] │
└──────────────────────────────────────────────────────────┘
```

**说明**：

- 列表不展示 id，只展示 name。
- 列表展示版本号 v1 / v2 / v3。
- 不展示 Client 列（OP 不与 Client 绑定）。

### 9.8 编辑器视图

编辑器中的元素严格按以下顺序排列：

```text
┌──────────────────────────────────────────────┐
│  ← 返回  编辑: check_tests                    │
├──────────────────────────────────────────────┤
│  名称: [check_tests        ]                  │
│  类型: [prompt ▾]                             │
│  描述: [运行测试并报告结果    ]                 │
│                                              │
│  超时: [300s]                                 │
│                                              │
│  入参:  [＋ 添加]                             │
│  ┌────────────────────────────────────────┐  │
│  │ name: test_cmd  type: string  required  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  出参:  [＋ 添加]                             │
│  ┌────────────────────────────────────────┐  │
│  │ name: passed    type: string           │  │
│  │ name: count     type: string           │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  内容:                                        │
│  ┌────────────────────────────────────────┐  │
│  │ 在当前工作区运行测试，并输出结果 JSON    │  │
│  └────────────────────────────────────────┘  │
│                                              │
│           [取消]  [保存]                      │
└──────────────────────────────────────────────┘
```

**元素顺序说明**：

| 顺序 | 元素 | 说明 |
|-|-|-|
| 1 | 名称 | OP 名称，全局唯一 |
| 2 | 类型 | prompt / bash / python / powershell |
| 3 | 描述 | OP 描述 |
| 4 | 超时 | 执行超时（秒） |
| 5 | 入参 | 入参声明列表 |
| 6 | 出参 | 出参声明列表 |
| 7 | 内容 | prompt 模板或脚本内容 |
| 8 | 取消 / 保存 | 操作按钮 |

**编辑器不包含的元素**：

| 元素 | 原因 |
|-|-|
| ID | id 写入 DB 时生成，界面不感知 |
| Client | OP 不与 Client 绑定 |
| 重试 | OP 不含 retry，重试在 Workflow 节点级配置 |
| 单次执行 | 执行入口在列表界面，不在编辑器 |
| 交互性开关 | 当前版本不支持用户选择（置灰 / 不可点击） |

### 9.9 交互性开关

| 规则 | 说明 |
|-|-|
| 默认状态 | 关闭 |
| 当前版本 | 不支持用户选择（置灰 / 不可点击） |
| 未来版本 | 开放用户选择 |
| 存储值 | 当前版本固定为 false |

### 9.10 保存时的版本确认

点击“保存”后：

```text
┌──────────────────────────────────────┐
│  保存 OP: check_tests                 │
├──────────────────────────────────────┤
│  当前版本: v1                         │
│                                      │
│  是否更新版本？                        │
│                                      │
│  ● 更新版本（v1 → v2）                │
│  ○ 不更新版本（覆盖 v1）               │
│                                      │
│           [取消]  [确认]              │
└──────────────────────────────────────┘
```

**规则**：

| 规则 | 说明 |
|-|-|
| 默认版本号 | 新建 OP 时，version = 1 |
| 更新版本 | 用户选择“更新版本”，version = version + 1 |
| 不更新版本 | 用户选择“不更新版本”，version 保持不变，覆盖当前版本 |
| 保存后 | 记录 updatedAtMs |

### 9.11 单次执行流程（修正）

单次执行的入口**只在列表界面**，不在编辑器。

```text
列表界面点击 [执行]
        │
        ▼
┌──────────────────────────────────────┐
│  确认执行: check_tests                │
│                                      │
│  是否执行该 OP？                       │
│                                      │
│           [取消]  [确认]              │
└──────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│  填写执行参数                         │
│                                      │
│  工作区: [/path/to/workspace]  [选择] │ ← 必填，可浏览选择
│                                      │
│  入参（如有）:                        │
│  test_cmd: [npm run test      ] *    │
│                                      │
│  选择 Client:                         │
│  ┌────────────────────────────────┐  │
│  │ Claude Code              ▾     │  │ ← 下拉列表
│  └────────────────────────────────┘  │
│                                      │
│           [取消]  [执行]              │
└──────────────────────────────────────┘
        │
        ▼
创建虚拟 Job（target = 该 OP，client = 用户选择，workspace = 用户指定）
        │
        ▼
虚拟 Job 执行，产生 Job Run
        │
        ▼
Job Run 进入运行历史
（标记为 jobKind=virtual, triggeredBy=single_op）
```

**执行规则**：

| 规则 | 说明 |
|-|-|
| 确认步骤 | 点击列表的 [执行] 后，先弹出确认框 |
| 工作区 | **必填**，用户通过浏览按钮选择，或使用默认工作区 |
| 入参填写 | 有 required 入参时，展示输入框 |
| 无入参 | 直接跳过入参部分 |
| Client 选择 | **通过下拉列表选择**，必须选择一个 Client |
| 虚拟 Job | 执行时创建虚拟 Job，target = 该 OP，携带用户选择的 Client 和工作区 |

### 9.12 关联界面

| 关系 | 说明 |
|-|-|
| 执行时下拉选择 Client | prompt 类型必须选择 |
| 被 Workflow 引用为节点 | Workflow 定义中的 node |
| 被 Job 引用为 target | Job target 可以是单个 OP |
| 单次执行产生 Job Run | 进入运行历史 |

### 9.13 约束

| 约束 | 说明 |
|-|-|
| name 全局唯一 | 从 Workflow 引用 OP 的角度看，name 是引用键 |
| id 界面不感知 | id 写入 DB 时生成 |
| 无 Client 绑定 | OP 不与 Client 绑定，执行时下拉选择 |
| 无 retry 字段 | 重试在 Workflow 节点级配置 |
| 交互性开关 | 默认关闭，当前版本不可选 |
| 版本管理 | 保存时可选是否升版本，默认 v1 |
| required 入参 | 必须由上游 OP / Workflow 入参 / 字面量提供 |
| 编辑器元素顺序 | 名称 → 类型 → 描述 → 超时 → 入参 → 出参 → 内容 → 操作 |

---

## 十、Workflow 管理界面

### 10.1 定位

管理 **DAG 编排**。Workflow 是“程序”，引用 OP，绑定参数，定义流转。

**核心能力**：

- 引用多个 OP，绑定参数，定义流转。
- 有独立的**入参**和**出参**。
- 入参用于承接外部输入；当某个 OP 的 required 入参不能从上游节点继承时，从 Workflow 入参继承。
- 出参用于暴露内部结果；将某个节点的出参指定为 Workflow 出参。

### 10.2 入口

左侧菜单栏 → Workflow 管理

### 10.3 核心功能

| 功能 | 说明 |
|-|-|
| 列表 | 展示所有 Workflow，含名称、节点数、交互性、更新时间 |
| 新建/编辑 | 画布式编辑器，支持拖拽 OP 创建节点、连线创建边 |
| **入参设置** | 声明 Workflow 的输入参数 |
| **出参设置** | 声明 Workflow 的输出参数，来源为某节点的某出参 |
| 节点配置 | 配置 opId、Client（下拉列表）、参数绑定、汇聚策略、超时、重试策略 |
| 边配置 | 配置条件：always / on_success / on_failure / expression |
| 参数绑定 | 支持 workflow_input / node_output / literal 三种来源 |
| 校验 | 参数校验、结构校验、执行校验 |
| 单次执行 | 创建虚拟 Job，产生 Job Run，进入运行历史 |
| 复制 | 基于已有 Workflow 快速创建 |
| 删除 | 删除未被 Job 引用的 Workflow |
| 导入/导出 | 支持 YAML 文件 |

### 10.4 流转类型

| 类型 | 说明 |
|-|-|
| 顺序流转 | 上一个 OP 完成后直接执行下一个 |
| 条件流转 | 根据 on_success / on_failure / expression 决定分支 |
| 并行流转 | 一个 OP 完成后同时触发多个下游 |
| 汇聚流转 | 多个 OP 都完成后才触发下一个 |

### 10.5 汇聚策略

| 策略 | 说明 |
|-|-|
| all_success | 所有上游成功后才触发 |
| all_done | 所有上游完成（无论成功失败）后触发 |
| any_success | 任意一个上游成功即触发 |
| any_done | 任意一个上游完成即触发 |

### 10.6 节点重试配置

```typescript
interface NodeRetry {
  on: "failure" | "success";
  maxAttempts: number;
  backoff: "constant" | "linear" | "exponential";
  intervalMs: number;
}
```

| on | 语义 | 典型场景 |
|-|-|---------|
| failure | 节点失败时重试 | 网络抖动、临时故障 |
| success | 节点成功时重试 | 轮询、等待资源就绪 |

### 10.7 数据结构（修正：含入参 / 出参）

```typescript
interface WorkflowDefinition {
  id: string;                       // 32 位 UUID
  name: string;
  description?: string;
  inputs: WorkflowInput[];          // Workflow 入参
  outputs: WorkflowOutput[];        // Workflow 出参
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAtMs: bigint;              // u128 毫秒时间戳
  updatedAtMs: bigint;              // u128 毫秒时间戳
}

interface WorkflowInput {
  name: string;
  type: "string";                   // 只支持 string
  required: boolean;
  default?: string;
  description?: string;
}

interface WorkflowOutput {
  name: string;
  from: { nodeId: string; outputName: string };  // 来源：某个节点的某个出参
  description?: string;
}

interface WorkflowNode {
  nodeId: string;                   // 32 位 UUID
  opId: string;                     // 32 位 UUID
  opVersion?: number;
  clientId?: string;                // 节点配置的 Client（32 位 UUID）
  bindings: Record<string, ParamBinding>;
  joinPolicy?: "all_success" | "all_done" | "any_success" | "any_done";
  timeout?: number;
  retry?: NodeRetry;
}

type ParamBinding =
  | { kind: "workflow_input"; name: string }        // 来自 Workflow 入参
  | { kind: "node_output"; nodeId: string; name: string }  // 来自上游节点出参
  | { kind: "literal"; value: string };             // 字面量

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

### 10.8 参数模型

**Workflow 入参的作用**：

当某个 OP 的 required 入参不能从上游节点继承时，必须从 Workflow 入参继承。

```text
Workflow 入参 ──→ Op A 入参
Workflow 入参 ──→ Op C 入参（Op C 无上游可继承时）
```

**Workflow 出参的作用**：

将某个节点的出参暴露为 Workflow 出参，供外部消费。

```text
Op D 出参 ──→ Workflow 出参
```

**参数来源三种**：

| 来源 | 说明 | 是否需要在 Workflow 声明 |
|-|-|-|
| Workflow 入参 | 整个编排的外部输入 | ✅ 必须声明 |
| Op 出参 | 某个 op 执行后产生的结果 | ❌ 由 op 自己定义 |
| Op 入参 | 某个 op 执行前需要的参数 | 取决于来源 |

**参数连接规则**：

| 场景 | 处理方式 |
|-|-|
| Op 入参来自上游 Op 出参 | 自动连接，不需要在 Workflow 入参中声明 |
| Op 入参来自 Workflow 入参 | 在 Workflow 入参中声明，Op 引用该参数名 |
| Op 入参既无上游产生，也不在 Workflow 入参中 | 校验不通过，报错 |
| 某 Op 出参被指定为 Workflow 出参 | 在 Workflow 出参中声明 |

### 10.9 列表视图

```text
┌──────────────────────────────────────────────────────────┐
│  Workflow 管理                        [＋ 新建] [导入]    │
├──────────────────────────────────────────────────────────┤
│  🔍 搜索...                                              │
├──────────────────────────────────────────────────────────┤
│  📋 deploy_workflow   部署流程 · 4 节点 · 入参 1 · 出参 1  2天前  [编辑] [复制] [删除] [导出] │
│  📋 log_analysis      日志分析 · 5 节点 · 入参 2 · 出参 1  1周前  [编辑] [复制] [删除] [导出] │
│  📋 code_review       代码审查 · 3 节点 · 入参 0 · 出参 1  1月前  [编辑] [复制] [删除] [导出] │
└──────────────────────────────────────────────────────────┘
```

### 10.10 编辑器视图（修正：含入参 / 出参设置）

Workflow 编辑器分为三个区域：**顶部基础信息 + 入参/出参**、**左侧画布**、**右侧节点详情**。

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  ← 返回  编辑: deploy_workflow  [保存] [校验] [单次执行]                  │
├──────────────────────────────────────────────────────────────────────────┤
│  名称: [deploy_workflow       ]  描述: [部署流程            ]             │
├──────────────────────────────────────────────────────────────────────────┤
│  Workflow 入参:  [＋ 添加]                                                │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ name          type     required  default     description            │  │
│  │ target_env    string   ✓         -           目标环境               │  │
│  │ timeout       string   ✗         300         超时秒数               │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Workflow 出参:  [＋ 添加]                                                │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ name          from (nodeId.outputName)            description       │  │
│  │ deploy_url    node_deploy.url                    部署后的 URL       │  │
│  └────────────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────┬─────────────────────────────────────┤
│  画布                               │  节点详情                            │
│                                    │                                     │
│  ┌──────────┐    ┌──────────┐     │  节点: node_review                   │
│  │check_tests│───→│  review  │     │  OP:   review                       │
│  └──────────┘    └──────────┘     │  Client: [Claude Code ▾]  ← 下拉     │
│       │               │           │                                     │
│       │on_failure     │approve    │  参数绑定:                            │
│       ▼               ▼           │  test_result:                       │
│  ┌──────────┐    ┌──────────┐     │    ● 上游节点出参: [node_check.result ▾]│
│  │notify_fail│    │  deploy  │     │    ○ Workflow 入参: [选择 ▾]         │
│  └──────────┘    └──────────┘     │    ○ 字面量: [______________]         │
│                       │           │                                     │
│                       ▼           │  汇聚策略:                           │
│                  ┌──────────┐     │  [all_success ▾]                    │
│                  │  notify  │     │                                     │
│                  └──────────┘     │  超时: [300s]                        │
│                                    │                                     │
│                                    │  重试策略:                           │
│                                    │  on: [failure ▾]                    │
│                                    │  max: [3]                           │
│                                    │  backoff: [exponential ▾]           │
│                                    │  interval: [1000ms]                 │
└────────────────────────────────────┴─────────────────────────────────────┘
```

**编辑器结构说明**：

| 区域 | 内容 |
|-|-|
| 顶部 | 名称、描述、Workflow 入参、Workflow 出参 |
| 左侧画布 | 节点、边、流转关系 |
| 右侧节点详情 | 节点配置（opId、Client、参数绑定、汇聚策略、超时、重试） |

**Workflow 入参设置**：

| 字段 | 说明 |
|-|-|
| name | 参数名 |
| type | 固定 string |
| required | 是否必填 |
| default | 默认值（可选） |
| description | 描述 |

**Workflow 出参设置**：

| 字段 | 说明 |
|-|-|
| name | 输出参数名 |
| from | 来源：某个节点的某个出参（nodeId.outputName） |
| description | 描述 |

**节点详情中的 Client 选择**：

- 使用**下拉列表**选择 Client。
- 下拉项展示 Client 的 name。
- 必须选择一个 Client，不能为空。

**节点详情中的参数绑定**：

| 绑定来源 | 说明 |
|-|-|
| 上游节点出参 | 从上游节点的出参中选择 |
| Workflow 入参 | 从 Workflow 入参中选择 |
| 字面量 | 手动填写字符串 |

### 10.11 YAML 定义示例

```yaml
id: e5f67890abcdef1234567890a1b2c3d4
name: deploy_workflow
description: 部署流程

# Workflow 入参
inputs:
  - name: target_env
    type: string
    required: true
    description: "目标环境"
  - name: timeout
    type: string
    required: false
    default: "300"
    description: "超时秒数"

# Workflow 出参
outputs:
  - name: deploy_url
    from: { nodeId: "f67890abcdef1234567890a1b2c3d4e5", outputName: url }
    description: "部署后的 URL"

nodes:
  - nodeId: "90abcdef1234567890a1b2c3d4e5f678"
    opId: "d4e5f67890abcdef1234567890a1b2c3"
    clientId: "a1b2c3d4e5f67890abcdef1234567890"
    bindings: {}
    retry:
      on: failure
      maxAttempts: 3
      backoff: exponential
      intervalMs: 1000

  - nodeId: "abcdef1234567890a1b2c3d4e5f67890"
    opId: "e5f67890abcdef1234567890a1b2c3d4"
    clientId: "a1b2c3d4e5f67890abcdef1234567890"
    bindings:
      test_result:
        kind: node_output
        nodeId: "90abcdef1234567890a1b2c3d4e5f678"
        name: result

  - nodeId: "f67890abcdef1234567890a1b2c3d4e5"
    opId: "67890abcdef1234567890a1b2c3d4e5f6"
    clientId: "b2c3d4e5f67890abcdef1234567890a1"
    bindings:
      env:
        kind: workflow_input
        name: target_env
      decision:
        kind: node_output
        nodeId: "abcdef1234567890a1b2c3d4e5f67890"
        name: decision
    retry:
      on: success
      maxAttempts: 5
      backoff: constant
      intervalMs: 2000

edges:
  - from: "90abcdef1234567890a1b2c3d4e5f678"
    to: "abcdef1234567890a1b2c3d4e5f67890"
    condition: { kind: on_success }

  - from: "abcdef1234567890a1b2c3d4e5f67890"
    to: "f67890abcdef1234567890a1b2c3d4e5"
    condition: { kind: expression, expr: "outputs.decision == 'approve'" }
```

### 10.12 单次执行流程（修正：需指定工作区）

```text
点击"单次执行"
        │
        ▼
┌──────────────────────────────────────┐
│  单次执行: deploy_workflow            │
├──────────────────────────────────────┤
│  工作区: [/path/to/workspace]  [选择] │ ← 必填，可浏览选择
│                                      │
│  入参:                                │
│  target_env: [staging         ] *    │
│  timeout:    [300             ]      │
│                                      │
│  * 为必填项                           │
│                                      │
│           [取消]  [执行]              │
└──────────────────────────────────────┘
        │
        ▼
创建虚拟 Job（target = 该 Workflow，workspace = 用户指定）
        │
        ▼
虚拟 Job 执行，产生 Job Run
        │
        ▼
Job Run 进入运行历史
（标记为 jobKind=virtual, triggeredBy=single_workflow）
```

**执行规则**：

| 规则 | 说明 |
|-|-|
| 工作区 | **必填**，用户通过浏览按钮选择，或使用默认工作区 |
| 入参填写 | 有 required 入参时，展示输入框 |
| 无入参 | 直接跳过入参部分 |
| 虚拟 Job | 执行时创建虚拟 Job，target = 该 Workflow，workspace = 用户指定 |

### 10.13 关联界面

| 关系 | 说明 |
|-|-|
| 引用 OP | Workflow 节点引用 OP |
| 引用 Client | 节点配置中通过下拉列表选择 Client |
| 被 Job 引用为 target | Job target 可以是整个 Workflow |
| 单次执行产生 Job Run | 进入运行历史 |

### 10.14 约束

- DAG 无环。
- 所有 required 入参必须有来源（上游节点出参 / Workflow 入参 / 字面量）。
- 有多条入边的节点必须有 joinPolicy。
- 交互性动态计算：引用 OP 中任意一个 interactive 即为交互式。
- 重试只在节点级配置，OP 本身不含重试。
- 节点必须指定 Client（clientId），通过下拉列表选择。
- Workflow 出参必须引用已存在的 nodeId 和 outputName。

---

## 十一、Job 管理界面

### 11.1 定位

管理**持久 Job**。Job 把 OP 或 Workflow 实例化为可执行作业，绑定工作区，配置触发方式。

### 11.2 入口

左侧菜单栏 → Job 管理

### 11.3 核心功能

| 功能 | 说明 |
|-|-|
| 列表 | 展示所有持久 Job，含名称、target 类型、交互性、触发方式、启用状态、操作 |
| 新建/编辑 | 配置名称、描述、target、工作区、初始入参、触发方式、并发策略、超时 |
| 目标选择 | 选择单个 OP 或整个 Workflow |
| 触发配置 | 手动 / 定时（Cron），支持启用/禁用 |
| 并发策略 | skip / queue / parallel |
| 运行 | 非交互 Job 可点击运行，产生 Job Run |
| 启用/禁用 | 控制定时触发是否生效 |
| 复制/删除 | 管理 Job 生命周期 |

### 11.4 Job 交互性

| target | 交互性来源 |
|-|-|
| OP | 该 OP 的 interactive 属性 |
| Workflow | 该 Workflow 的交互性 |

**执行位置约束**：

| 类型 | 能否在 Job 界面直接运行 | 执行位置 |
|-|-|-|
| 非交互式 Job | ✅ 可以 | Job 界面触发，创建 Job Run |
| 交互式 Job | ❌ 不可以 | 运行按钮置灰 |

### 11.5 数据结构

```typescript
interface JobDefinition {
  id: string;                       // 32 位 UUID
  name: string;
  description?: string;
  kind: "persistent";
  target:
    | { kind: "op"; opId: string }
    | { kind: "workflow"; workflowId: string };
  workspace: string;
  inputs: Record<string, string>;
  trigger:
    | { kind: "manual" }
    | { kind: "schedule"; cron: string; enabled: boolean };
  concurrency: "skip" | "queue" | "parallel";
  timeout?: number;
  createdAtMs: bigint;              // u128 毫秒时间戳
  updatedAtMs: bigint;              // u128 毫秒时间戳
}
```

### 11.6 关键字段

| 字段 | 说明 |
|-|-|
| id | 32 位 UUID，唯一标识 |
| name | 显示名称 |
| target | 引用一个 OP 或 Workflow（用 32 位 UUID） |
| workspace | 绑定的工作区路径 |
| inputs | 初始入参，值统一为 string |
| trigger | 触发方式 |
| concurrency | 并发策略 |
| timeout | 超时 |
| createdAtMs | u128 毫秒时间戳 |
| updatedAtMs | u128 毫秒时间戳 |

**注意**：Job 不含 retry 字段。重试只在 Workflow 节点配置。

### 11.7 列表视图

```text
┌──────────────────────────────────────────────────────────┐
│  Job 管理                              [＋ 新建]          │
├──────────────────────────────────────────────────────────┤
│  🔍 搜索...                                              │
├──────────────────────────────────────────────────────────┤
│  ⏰ daily_cleanup    OP: clean_logs     非交互  0 2 * * *  ✅ 启用  [运行] [编辑] [禁用] [删除] │
│  ⏰ hourly_check     Workflow: health   交互式  0 * * * *  ✅ 启用  [运行置灰] [编辑] [禁用] [删除] │
│  📌 manual_deploy    Workflow: deploy   非交互  手动       —      [运行] [编辑] [删除] │
└──────────────────────────────────────────────────────────┘
```

### 11.8 编辑器视图

```text
┌──────────────────────────────────────────────┐
│  ← 返回  编辑: hourly_check                   │
├──────────────────────────────────────────────┤
│  名称: [hourly_check         ]                │
│  描述: [每小时健康检查        ]                │
│                                              │
│  目标类型:                                    │
│  ● 单个 OP                                    │
│    OP: [health_check ▾]                      │
│  ○ 整个 Workflow                              │
│    Workflow: [选择 ▾]                         │
│                                              │
│  工作区: [/path/to/workspace]                 │
│                                              │
│  初始入参:                                    │
│    endpoint: [https://api.internal/health ]  │
│                                              │
│  触发方式:                                    │
│  ● 手动 + 定时                                │
│    Cron: [0 * * * *        ]                 │
│    启用: [✓]                                  │
│  ○ 仅手动                                     │
│                                              │
│  交互性: ⚠ 交互式（target 包含交互式 OP）      │
│                                              │
│  并发策略: [skip ▾]                           │
│  超时: [300s]                                 │
│                                              │
│           [取消]  [保存]                      │
└──────────────────────────────────────────────┘
```

### 11.9 触发方式

| 触发方式 | 说明 | 适用 |
|-|-|-|
| 手动 | 用户在 UI 点击“运行” | 所有非交互 Job |
| 定时 | Cron 表达式，后台调度 | 非交互 Job |

**定时触发限制**：

| 限制 | 说明 |
|-|-|
| 交互式 Job 禁止定时 | 校验时报错 |
| 上一次未完成 | 按 concurrency 策略处理 |
| 应用未运行 | 错过的触发不补 |

### 11.10 并发策略

| 策略 | 说明 |
|-|-|
| skip | 若上一个 Job Run 未完成，跳过本次触发 |
| queue | 排队等待，前一个完成后执行 |
| parallel | 并行执行，允许多个 Job Run 同时存在 |

### 11.11 关联界面

| 关系 | 说明 |
|-|-|
| 引用 OP | Job target 可以是单个 OP |
| 引用 Workflow | Job target 可以是整个 Workflow |
| 触发产生 Job Run | 进入运行历史 |

### 11.12 约束

- 交互式 Job 的“运行”按钮置灰。
- 交互式 Job 禁止定时触发。
- 定时 Job 必须为非交互式。
- Job 不含 retry 字段，重试只在 Workflow 节点配置。

---

## 十二、运行历史界面

### 12.1 定位

**运行历史是全局的 Job Run 管理视图**，记录所有 Job Run，无论持久 Job 还是虚拟 Job。

### 12.2 入口

左侧菜单栏 → 运行历史

### 12.3 核心功能

| 功能 | 说明 |
|-|-|
| 列表 | 展示所有 Job Run，含类型、名称、来源、触发、状态、耗时、时间 |
| 搜索 | 按 OP / Workflow / Job 名称、状态搜索 |
| 筛选 | 类型 / 来源 / 触发 / 状态 / 工作区 / 时间 |
| 查看详情 | 展示状态、耗时、工作区、入参、出参、步骤列表、每步日志、退出码、产物、每次重试记录 |
| 重跑 | 以当前 Job Run 的 inputs 和 workspace 创建新 Job Run |
| 终止 | 终止正在运行的 Job Run，kill 相关进程 |
| 从指定步骤重启 | 从某个步骤重新执行后续流程 |
| 查看定义 | 跳转到 OP / Workflow / Job / Client 定义 |
| 恢复 | 应用重启后扫描未完成 Job Run，重建状态 |

### 12.4 数据结构

```typescript
interface JobRun {
  id: string;                       // 32 位 UUID
  jobId: string;                    // 32 位 UUID
  jobKind: "persistent" | "virtual";
  triggeredBy: "manual" | "schedule" | "single_op" | "single_workflow";
  target:
    | { kind: "op"; opId: string }
    | { kind: "workflow"; workflowId: string };
  inputs: Record<string, string>;
  workspace: string;                // 单次执行时由用户指定
  status:
    | "pending"
    | "running"
    | "success"
    | "failed"
    | "cancelled"
    | "timeout"
    | "interrupted";
  opResult?: OpRunResult;
  workflowResult?: WorkflowRunResult;
  steps: StepRecord[];
  startedAtMs: bigint;              // u128 毫秒时间戳
  finishedAtMs?: bigint;            // u128 毫秒时间戳
  duration?: number;                // 毫秒
}

interface StepRecord {
  stepId: string;                   // 32 位 UUID，等于 nodeId
  opId: string;                     // 32 位 UUID
  clientId?: string;                // 32 位 UUID，实际使用的 Client
  status: "pending" | "running" | "success" | "failed" | "skipped";
  inputs: Record<string, string>;
  outputs?: Record<string, string>;
  rawOutput?: string;
  exitCode?: number;
  error?: string;
  processRecord?: ProcessRecord;
  attempts?: StepAttempt[];
  startedAtMs: bigint;
  finishedAtMs?: bigint;
  duration?: number;
}

interface StepAttempt {
  attempt: number;
  status: "success" | "failed" | "timeout" | "cancelled";
  rawOutput?: string;
  exitCode?: number;
  error?: string;
  startedAtMs: bigint;
  finishedAtMs?: bigint;
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
  startedAtMs: bigint;
  finishedAtMs?: bigint;
}

interface OpRunResult {
  opId: string;
  runId: string;
  status: "success" | "failed" | "timeout" | "cancelled" | "interrupted";
  outputs: Record<string, string>;
  rawOutput: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
  startedAtMs: bigint;
  finishedAtMs: bigint;
  duration: number;
}

interface WorkflowRunResult {
  workflowId: string;
  status: "pending" | "running" | "success" | "failed" | "cancelled" | "timeout" | "interrupted";
  outputs: Record<string, string>;
  steps: StepRecord[];
}
```

### 12.5 视图结构

```text
┌──────────────────────────────────────────────────────────┐
│  运行历史                                  [刷新] [筛选]  │
├──────────────────────────────────────────────────────────┤
│  🔍 搜索 OP / Workflow / Job 名称 / 状态...               │
├──────────────────────────────────────────────────────────┤
│  筛选: [全部类型 ▾] [全部来源 ▾] [全部触发 ▾]              │
│         [全部状态 ▾] [全部工作区 ▾] [时间 ▾]               │
├──────────────────────────────────────────────────────────┤
│  📦 check_tests        OP        成功    12.3s   2分钟前  [查看] [重跑] │
│     来源: 虚拟 Job / 单次执行                              │
│     工作区: /path/to/workspace                            │
├──────────────────────────────────────────────────────────┤
│  📋 deploy_workflow    Workflow  运行中  step 3/8  5分钟前 [查看] [终止] │
│     来源: 虚拟 Job / 单次执行                              │
│     工作区: /path/to/workspace                            │
├──────────────────────────────────────────────────────────┤
│  ⏰ daily_cleanup      Job       成功    3.2s    1小时前  [查看] [重跑] │
│     来源: 持久 Job / 定时                                  │
│     工作区: /path/to/workspace                            │
├──────────────────────────────────────────────────────────┤
│  ⏰ hourly_check       Job       失败    8.1s    2小时前  [查看] [重跑] │
│     来源: 持久 Job / 手动                                  │
│     工作区: /path/to/workspace                            │
└──────────────────────────────────────────────────────────┘
```

### 12.6 步骤重试记录

当 Workflow 节点配置了 retry 时，运行历史中该步骤会展示多次尝试：

```text
┌──────────────────────────────────────────┐
│  Step 3: deploy（nodeId=xxx）             │
│  Client: Claude Code                     │
│                                          │
│  重试策略: on=failure, max=3             │
│                                          │
│  尝试 1: ✗ 失败  2.1s                    │
│    └ 退出码: 1                           │
│    └ 输出: connection timeout            │
│                                          │
│  尝试 2: ✗ 失败  1.8s                    │
│    └ 退出码: 1                           │
│    └ 输出: connection timeout            │
│                                          │
│  尝试 3: ✓ 成功  3.2s                    │
│    └ 退出码: 0                           │
│    └ 输出: deployed to staging           │
│                                          │
│  最终状态: ✓ 成功（第 3 次尝试）          │
└──────────────────────────────────────────┘
```

### 12.7 字段说明

| 字段 | 说明 |
|-|-|
| 类型 | OP / Workflow（target 的类型） |
| 名称 | target 的名称 |
| 来源 | 持久 Job / 虚拟 Job |
| 触发 | 手动 / 定时 / 单次执行 |
| 状态 | pending / running / success / failed / cancelled / timeout / interrupted |
| 工作区 | 本次执行绑定的工作区路径 |
| 耗时 | 从启动到完成的时长 |
| 时间 | 相对时间 |

### 12.8 筛选条件

| 筛选 | 选项 |
|-|-|
| 类型 | 全部 / OP / Workflow |
| 来源 | 全部 / 持久 Job / 虚拟 Job |
| 触发 | 全部 / 手动 / 定时 / 单次执行 |
| 状态 | 全部 / 运行中 / 成功 / 失败 / 取消 / 超时 / 中断 |
| 工作区 | 全部 / 具体工作区 |
| 时间 | 全部 / 最近 1 小时 / 最近 24 小时 / 最近 7 天 / 自定义 |

### 12.9 Job Run 状态

| 状态 | 说明 |
|-|-|
| pending | 待执行 |
| running | 运行中 |
| success | 成功 |
| failed | 失败 |
| cancelled | 已取消 |
| timeout | 超时 |
| interrupted | 中断（进程丢失） |

### 12.10 三种人工操作

| 操作 | 说明 |
|-|-|
| 终止 | kill 正在运行的进程，标记 cancelled |
| 重跑 | 以当前 Job Run 的 inputs 和 workspace 创建新 Job Run |
| 从指定步骤重启 | 从某个步骤重新执行后续流程 |

**重跑规则**：

| 原 jobKind | 重跑方式 |
|-|-|
| persistent | 使用原持久 Job 重新触发 |
| virtual | 创建一个新的虚拟 Job |

### 12.11 触发来源标记

| 触发来源 | jobKind | triggeredBy |
|-|-|-|
| OP 单次执行 | virtual | single_op |
| Workflow 单次执行 | virtual | single_workflow |
| Job 手动运行 | persistent | manual |
| Job 定时运行 | persistent | schedule |

### 12.12 关联界面

| 关系 | 说明 |
|-|-|
| 回溯 OP 定义 | 查看 Job Run 的 target OP |
| 回溯 Workflow 定义 | 查看 Job Run 的 target Workflow |
| 回溯 Job 定义 | 查看 Job Run 对应的持久 Job（虚拟 Job 无此回溯） |
| 回溯 Client | 查看步骤实际使用的 Client 配置 |

### 12.13 约束

- 不自动重跑，重启后由人工决策。
- 不弹窗打扰，恢复结果直接体现在运行历史。
- 保留全部日志，即使进程已死，日志仍可查看。
- 允许用户手动标记步骤完成 / 失败。
- 步骤重试记录保留每次尝试，但只在 Workflow 节点配置重试时才有。

---

## 十三、五界面功能对照表

| 界面 | 上游依赖 | 下游产出 | 核心职责 | 是否产生 Job Run | 是否含 retry |
|-|-|-|-|-|-|
| Client 管理 | 无 | 被执行时下拉选择 | 描述如何非交互式调用 CLI | ❌ | ❌ |
| OP 管理 | 执行时下拉选择 Client | 被 Workflow / Job 引用 | 定义单个操作 | ✅（单次执行） | ❌ |
| Workflow 管理 | OP / Client（下拉） | 被 Job 引用 | 定义 DAG 编排 + 入参 / 出参 | ✅（单次执行） | ✅（节点级） |
| Job 管理 | OP / Workflow | 产生 Job Run | 定义持久作业与触发 | ✅（手动 / 定时） | ❌ |
| 运行历史 | 所有 Job Run | 回溯所有定义 | 全局 Job Run 管理 | — | — |

---

## 十四、关键设计决策

| 决策点 | 建议 | 理由 |
|-|-|-|
| 应用名称 | AI 自动化 | 定位清晰 |
| 界面布局 | 左侧菜单栏 + 右侧内容区 | 简洁，无会话管理，无右侧栏 |
| 一级菜单 | 固定五个 | 覆盖全部核心功能 |
| ID 格式 | 32 位 UUID | 全局唯一，无冲突 |
| name 与 id 分离 | name 展示，id 引用 | 兼顾可读性与唯一性 |
| OP 的 id | 界面不感知 | id 是存储层细节，界面只需 name |
| OP 的 name | 全局唯一 | 从 Workflow 引用 OP 的角度，name 是引用键 |
| Client 选择方式 | 下拉列表 | 直观，避免手动输入错误 |
| Client 约束 | 只走非交互式 | 统一执行语义，避免 PTY 复杂度 |
| OP 类型 | prompt / bash / python / powershell | 覆盖主要执行器 |
| OP 与 Client 绑定 | 不绑定 | OP 只声明“做什么”，Client 在执行时选择 |
| OP 是否含 retry | ❌ 不含 | OP 是最小单元，只执行一次 |
| 重试位置 | Workflow 节点级 | 编排层控制重试策略 |
| 重试条件 | on: failure / success | 支持失败重试和成功重试两种语义 |
| OP 版本管理 | 保存时可选升版本 | 支持 OP 演进，同时允许覆盖 |
| OP 版本默认值 | 1 | 新建 OP 时 version = 1 |
| OP 交互性开关 | 默认关闭，不可选 | 当前版本不支持用户选择 |
| OP 单次执行入口 | 只在列表界面 | 编辑器专注定义，执行是列表操作 |
| OP 编辑器元素顺序 | 名称 → 类型 → 描述 → 超时 → 入参 → 出参 → 内容 → 操作 | 按信息层次排列 |
| Workflow 入参 | ✅ 必须支持 | 承接外部输入，补充 OP 无法继承的参数 |
| Workflow 出参 | ✅ 必须支持 | 暴露内部结果，供外部消费 |
| Workflow 编辑器布局 | 顶部（基础信息 + 入参 / 出参）+ 画布 + 节点详情 | 信息分层清晰 |
| OpInput / OpOutput 类型 | 只支持 string | CLI 输出本质是文本，简化绑定与校验 |
| 时间戳命名 | 后缀 Ms | 明确单位，避免歧义 |
| 时间戳类型 | u128 | 无符号 128 位，足够大 |
| 时间戳单位 | 毫秒 | 精度足够，量级合理 |
| 时间戳传输 | JSON 用 string | 超出 JS Number 安全范围 |
| 时间戳存储 | SQLite 用 TEXT | 便于调试和跨语言处理 |
| 执行点 | 统一收拢到 Job | 执行逻辑单一，避免多套 |
| OP / Workflow 单次执行 | 创建虚拟 Job | 复用 Job 执行路径 |
| 单次执行工作区 | 必填，用户指定 | 虚拟 Job 无预设工作区，必须明确 |
| 虚拟 Job 是否持久化 | 不写入 job_definitions | 一次性，无需长期保存 |
| 虚拟 Job 是否留痕 | Job Run 中带虚拟 Job 快照 | 支持运行历史回溯 |
| 执行记录 | 全部进入运行历史 | 统一管理，统一筛选 |
| 交互式任务 | 可以定义，不能持久执行 | 当前 app 不做工作台 |
| 触发来源 | manual / schedule / single_op / single_workflow | 覆盖全部场景 |
| Job 形态 | persistent / virtual | 区分持久 Job 与单次执行 |

---

## 十五、核心结论

**应用形态**：

```text
AI 自动化
├── 左侧菜单栏（固定五个）
│   ├── Client 管理
│   ├── OP 管理
│   ├── Workflow 管理
│   ├── Job 管理
│   └── 运行历史
└── 右侧内容区（当前菜单的界面）
```

**执行模型**：

```text
Client ←（执行时下拉选择）← OP ← Workflow（含入参 / 出参）
                              │
                              └──→ Job（持久 / 虚拟）──→ Job Run ──→ 运行历史
```

**一句话总结**：

> **执行点只有 Job。OP 和 Workflow 是定义，Job 是执行载体。所有执行记录统一进入运行历史。**

**五条硬约束**：

1. **所有 ID 使用 32 位 UUID**，界面展示用 name，内部引用用 id。OP 的 id 界面不感知。
2. **Client 只走非交互式调用**，无论其本身是否支持交互式，本 APP 强制使用 headless 参数。
3. **OP 不含 retry 字段**，重试在 Workflow 节点级配置，支持 on=failure / on=success 两种语义。
4. **OP 不与 Client 绑定**，执行时通过下拉列表选择 Client。OP 的 name 全局唯一，且有版本概念（默认 v1）。
5. **Workflow 有独立入参和出参**，入参用于承接外部输入，出参用于暴露内部结果。

**修正点**：

1. **Client 选择使用下拉列表**（OP 单次执行、Workflow 节点配置均使用下拉列表）。
2. **Workflow 编辑器增加入参和出参设置**，顶部区域集中管理。
3. **单次执行需要指定工作区**，OP 和 Workflow 单次执行对话框中均有工作区选择。

**数据规范**：

- OpInput / OpOutput 的 type 只支持 string。
- 所有时间字段使用 u128 毫秒时间戳，命名以 Ms 结尾。
- 时间戳在 JSON 传输中用 string，SQLite 存储用 TEXT。

**五界面分工**：

- **Client 管理**：定义“怎么非交互式调 CLI”。
- **OP 管理**：定义“做什么”。
- **Workflow 管理**：定义“按什么顺序做，节点如何重试，用哪个 Client，入参出参是什么”。
- **Job 管理**：定义“什么时候做、在哪做”。
- **运行历史**：记录“做过什么、结果如何、重试了几次”。

**单次执行**：

- OP 单次执行入口在列表界面：点击 [执行] → 确认 → 指定工作区 → 填参数 → 下拉选 Client → 执行。
- Workflow 单次执行入口在编辑器：点击 [单次执行] → 指定工作区 → 填参数 → 执行。
- 单次执行以虚拟 Job 方式执行，产生 Job Run，进入运行历史，标记为 jobKind=virtual。