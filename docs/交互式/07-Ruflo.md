# Ruflo（原 claude-flow）内网 Human-in-the-Loop 场景评估与借鉴分析

> **特别说明**：Ruflo 是**专为 Claude Code CLI 适配**的多 Agent 编排层。它无法脱离 Claude Code CLI 独立运行，也无法通过配置将底层 Agent CLI 替换为自定义 CLI。本文在评估其是否适合我的内网场景的同时，也分析其架构对开发内部 Agent CLI 交互式工作流的借鉴意义。

## 一、我的使用场景

- 在内网环境下使用。
- 使用的 Agent CLI 是内部工具。
- Agent CLI 使用时，有数据和权限校验要求。
- 如果在容器中或挂载到容器中使用 Agent CLI，会有权限校验不过的问题。
- 需求：在办公电脑上直接运行，从而直接调用本地的工具。

核心诉求：**CLI 触发工作流，执行中 Agent 可暂停提问，我回答后从断点继续；不依赖容器，能调用本地工具，满足内网与权限校验要求。**

## 二、Ruflo（原 claude-flow）介绍

### 2.1 Ruflo 是什么？

Ruflo（原名 claude-flow）是一个**多 Agent 编排框架**，由 rUv 开发，本质上是 Claude Code 的“神经系统”。它**不替代 Claude Code，而是在其之上添加协调层**，让 100+ 个专业 Agent 感觉像一个统一的工具。

| 维度 | 说明 |
|-|-|
| 本质 | Claude Code 的多 Agent 编排层（meta-harness） |
| 核心依赖 | **必须安装 Claude Code CLI**（`@anthropic-ai/claude-code`）和 **Anthropic API Key** |
| 核心能力 | 98+ 专业 Agent、60+ 命令、30+ 技能、MCP 服务器、自学习 hooks、持久化记忆 |
| 技术栈 | Node.js 20+，WASM 内核（Rust 预编译，无需 cargo 编译） |
| 开源协议 | MIT |
| 部署方式 | npm 全局安装（`pnpm add -g ruflo@latest`），也可 Docker 容器化 |

Ruflo 的核心组件包括：**Q-Learning 路由器**（智能路由任务）、**Swarm 协调**（mesh/hier/ring/star 拓扑 + Raft/BFT/Gossip/CRDT 共识）、**HNSW 向量记忆**、**ReasoningBank 模式存储**、**12 个后台 Worker**（audit/optimize/testgaps 等）。

### 2.2 核心定位：为 Claude Code CLI 适配的编排层

Ruflo 的架构前提是 **Claude Code CLI 作为底层执行环境**。它通过向 Claude Code 的 `.claude/settings.json` 注入 Hooks，监听 `session_start`、`tool_execution` 等生命周期事件，从而“劫持”并介入 Claude Code 的执行流。没有 Claude Code，Ruflo 的 Hook 不会被触发，整个编排系统无从谈起。

### 2.3 两种安装模式对比

Ruflo 提供两种安装路径，功能范围差异很大：

| 维度 | 插件模式 (Path A) | CLI 模式 (Path B) |
|-|-|-|
| 安装命令 | `/plugin marketplace add ruvnet/ruflo` 然后 `/plugin install ruflo-core@ruflo` | `npx ruflo@latest init` 或 `npm install -g ruflo@latest` |
| 提供内容 | Slash 命令 + 少量技能 + Agent 定义 | 完整的 Ruflo 循环：98 个 Agent、60+ 命令、30 个技能、MCP 服务器、Hooks、守护进程 |
| MCP 服务器 | 仅 `ruflo-core` 自带（其他插件通常不带） | ✅ 始终注册 |
| Hooks 安装 | ❌ 不安装 | ✅ 安装 |
| 适用场景 | 试用单个插件的命令，无需完整安装 | 生产使用，所有功能按文档工作 |

### 2.4 架构分层：不是插件，而是“Agent 操作系统”

有架构分析明确指出，将 Ruflo 称为“Claude Code 的扩展插件”是**低估了它**。更准确的描述是：Ruflo 是一个**围绕 Claude Code 构建的独立 Agent 操作系统**，包含五个层次：

| 层级 | 作用 |
|-|-|
| CLI | 用户界面，支持 `ruflo init`、`swarm`、`memory` 等命令 |
| MCP | 可由 Claude Code 或 Web UI 调用的工具服务器 |
| Swarm | Agent 生成、任务分配、拓扑、共识、消息总线 |
| Memory | SQLite、AgentDB、HNSW、ReasoningBank、模式学习 |
| Plugins | 将命令、Agent 和技能作为 Claude Code 插件单元部署 |

## 三、Human-in-the-Loop (HITL) 的工作机制

Ruflo 通过 **`ruflo-workflows` 插件**提供 HITL 支持，核心机制是 **MCP workflow 工具集的状态机生命周期**和**人工审批门（Approval Gate）**。

### 3.1 核心机制：Workflow 状态机 + Approval Gate

`ruflo-workflows` 插件提供了 10 个 MCP 工具，其中包含完整的暂停/恢复生命周期：

| 工具 | 用途 |
|-|-|
| `workflow_create` | 创建新的工作流定义 |
| `workflow_run` | 运行工作流 |
| `workflow_pause` | **暂停**运行中的工作流 |
| `workflow_resume` | **恢复**已暂停的工作流 |
| `workflow_status` | 查看运行状态 |

状态机生命周期为：`created → running ↔ paused → completed/canceled`。

**人工审批门（Approval Gate）**：工作流定义中可设置 `manual pause points for human review`，在关键操作前暂停，等待人工审核。

### 3.2 权限审批的精细化控制

Ruflo 的 AgenticPolicyEngine 对审批有以下控制：
- **Deny 覆盖 Approval 和 Allow**——拒绝优先级最高
- **Agent 不能自己批准自己**——强制要求独立审批人
- **审批是有作用域的、会过期的、可撤销的、有限次使用的**

### 3.3 实际案例

有技术博客展示了在 Ruflo 流水线中，所有 Agent 的写操作必须经过 **“预览 → 审核 → 写入”** 流程，表现为一个“人工审批节点”。如果审批不通过，流水线将自动回滚。

## 四、是否适合我的场景？（匹配度分析）

| 我的需求 | Ruflo 的支持情况 | 关键细节 |
|-|-|-|
| 内网环境使用 | ❌ **不满足** | Ruflo **必须连接 Anthropic API**（`ANTHROPIC_API_KEY`）才能调用 LLM。在完全离线的内网中，除非有 Anthropic 的企业级私有部署，否则无法使用。 |
| 内部 Agent CLI 对接 | ❌ **不满足** | Ruflo 的设计前提是 **Claude Code CLI** 作为底层执行环境。它不是一个可以独立运行的编排引擎，而是 Claude Code 的“增强层”。内部 Agent CLI **无法替代 Claude Code** 来承载 Ruflo。 |
| 数据和权限校验 | ⚠️ **有 RBAC 能力，但耦合 Claude Code** | Ruflo 提供了 Claims 授权系统，支持 RBAC/ABAC 策略、声明式权限授予/撤销/校验、审计日志闭环。但这些权限校验是围绕 Claude Code 的 Agent 生态设计的，无法直接迁移到内部 CLI 体系。 |
| 办公电脑直接运行，调用本地工具 | ⚠️ **技术上可行，但前提是 Claude Code** | Ruflo 支持原生 Windows PowerShell/cmd 运行，有 Windows 原生 Worker 实现。但 **所有执行最终都经过 Claude Code**，本地工具调用需要通过 Claude Code 的 MCP 工具或 hooks 间接实现。 |
| 不依赖容器 | ✅ **支持** | Ruflo 可以通过 npm 全局安装，不强制 Docker。但 Docker 是可选部署方式之一。 |

### 4.1 需要留意的关键点

1. **Claude Code 是硬性前置依赖**：Ruflo 的本质是“Claude Code 的神经系统”，离开 Claude Code 它无法工作。内部 Agent CLI 与 Claude Code 是不同的工具，**无法直接用 Ruflo 增强内部 CLI**。
2. **Anthropic API 是硬性外部依赖**：所有 LLM 调用都需要 `ANTHROPIC_API_KEY`。在内网环境中，除非 Anthropic 提供私有化部署，否则 Ruflo 的 AI 能力无法使用。
3. **HITL 依附于 Claude Code 的 MCP 生态**：Ruflo 的 workflow 工具通过 MCP 协议与 Claude Code 通信。内部 CLI 如果不支持 MCP，则无法接入这套 HITL 机制。
4. **Windows 兼容性在持续改进**：Ruflo 近期修复了 Windows 原生 hooks 和 daemon 的问题（v3.5.5–v3.5.7），但目前仍在 alpha 阶段，稳定性需要验证。

## 五、能否通过配置将底层 Agent CLI 从 Claude Code 换成自定义 CLI？

**不能。** Ruflo 无法通过配置将底层 Agent CLI 从 Claude Code 替换为内部 CLI。这不是一个简单的“换一个参数”能解决的问题，而是由 Ruflo 的底层架构决定的。

### 5.1 深度耦合的架构

Ruflo 的定位是 **Claude Code 的“编排层”或“元框架”（meta-harness）**，它本身不是一个独立的 Agent 执行引擎。它的核心工作机制是**依赖 Claude Code 的 Hook 系统**来劫持和路由任务。当你安装 Ruflo 后，它会向 Claude Code 的 `.claude/settings.json` 中写入 Hook 配置，Claude Code 在运行时会触发这些 Hook，Ruflo 则通过监听这些 Hook 来介入任务流程、调度其内部的 100+ 个 Agent。

这意味着 **Claude Code CLI 是 Ruflo 的“宿主”**，Ruflo 的一切能力都寄生在这个宿主之上。

### 5.2 现有的“自定义”配置能做什么？

Ruflo 确实提供了一些配置项，但它们解决的**不是“换掉 Claude Code”**，而是“**让 Claude Code 去连接谁**”：

- **更换 LLM Provider（模型提供方）**：你可以通过设置 `ANTHROPIC_BASE_URL` 或 `OPENAI_BASE_URL` 环境变量，让 Ruflo 将请求转发到 OpenRouter、Ollama 等兼容的 API 端点，而不是直连 Anthropic。但这改变的是 **LLM 的后端**，而不是**执行任务的 Agent CLI**。
- **更换 Agent 映射（Agent Mapping）**：你可以在 `.claude/settings.json` 中覆盖 Agent 的类型映射，例如把默认的 `coder` 映射到 `react-specialist`。这改变的是 Ruflo **内部**使用哪个子 Agent，而不是替换掉宿主 CLI。

### 5.3 社区与作者的立场

社区中确实有人提出过类似需求（Issue #506），希望 Ruflo 能对接 OpenRouter 等自定义模型，甚至探讨过“fork 代码直接调用 Claude Code Router”的可行性。但作者本人的回应是，他正在关注 **OpenCode CLI** 作为替代方案，同时也承认 Ruflo 本身有一些 OpenCode 不具备的增强特性。

这间接说明：**替换宿主 CLI 并非一个受支持的配置项，而是一个需要从代码层面重写架构的“大手术”**。Ruflo 的官方文档和技能定义中，也始终将自身描述为“面向 Claude Code、Cursor、Codex 等编码 Agent 的**编排层**”，而不是一个可以自由插拔底层 CLI 的通用框架。

## 六、Rust 实现与架构的借鉴意义

### 6.1 值得借鉴的架构分层

Ruflo 的 Rust 实现并非一个需要从零编译的底层内核，而是一组预编译的 `.wasm` 模块。它的价值在于**架构分层**和**与宿主 CLI 的集成模式**。其核心架构可抽象为以下分层：

| 层级 | Ruflo 的实现 | 对开发内部 Agent CLI 的借鉴意义 |
|-|-|-|
| CLI / MCP 接口层 | 提供 `ruflo` CLI 和 314 个 MCP 工具，作为用户和外部系统的入口。 | 内部 Agent CLI 需要类似的接口层，让用户能触发工作流、查看状态、响应审批。 |
| 路由与编排层 | Q-Learning 路由器 + Swarm 协调（mesh/hier/ring 等拓扑），负责将任务分发给正确的 Agent。 | 这是核心。需要一个**任务路由器**，将用户指令或工作流节点映射到内部 CLI 支持的具体工具或子 Agent 上。 |
| 记忆与状态层 | AgentDB（SQLite）+ HNSW 向量索引，提供跨会话的持久化记忆和上下文恢复能力。 | **HITL 的基石**。要实现“暂停-提问-恢复”，必须有一个**持久化的状态存储**，在暂停时保存完整的工作流上下文，恢复时精确加载。 |
| 宿主集成层（Hooks） | 通过向 Claude Code 的 `.claude/settings.json` 注入 Hooks，监听 `session_start`、`tool_execution` 等生命周期事件，从而“劫持”并介入 Claude Code 的执行流。 | **最值得借鉴的机制**。内部 CLI 也需要暴露类似的**生命周期钩子**（如 `before_tool_call`、`after_response`），让外部的编排层能够介入并注入 HITL 逻辑。 |

### 6.2 为什么不建议“完全照着复刻”？

Ruflo 的架构是**为 Claude Code 量身定制的**，它的许多精巧设计都建立在 Claude Code 特定的扩展机制之上。直接复刻会面临几个根本性挑战：

1. **Hooks 机制是强耦合的**：Ruflo 的编排能力高度依赖 Claude Code 的 Hook 系统。如果内部 Agent CLI **不原生支持类似的 Hook 机制**，那么“劫持执行流”这个最核心的能力就无法实现，整个架构的根基就不存在了。
2. **Rust/WASM 内核是“黑盒”**：Ruflo 的 Rust 组件是预编译的 `.wasm` 包，你**没有源码可供修改或移植**。你可以借鉴它的**架构思想**（如分层、路由、记忆），但无法复用它的**具体实现**。要获得同等能力，你需要用 Rust 或你熟悉的技术栈重新实现策略引擎、向量嵌入和证明系统，这是一个独立且庞大的工程。
3. **代码库的规模与复杂度**：Ruflo 的代码库是一个包含 15 个以上模块的 Monorepo，实现了 DDD 分层、6 种 Swarm 拓扑、拜占庭共识等企业级特性。即使只抽取核心的 HITL 和路由功能，其工程复杂度也远超一个“内部工具”的合理投入范围。

### 6.3 更务实的路径：借鉴思想，选择性自研

与其“复刻”，不如**提取 Ruflo 架构中的关键模式，在内部 CLI 上做选择性实现**。

建议的轻量级架构：

```text
内部 Agent CLI (你的触发入口)
    │
    ├── [可选] 暴露 Hooks：before_tool_call, after_response
    │
    └── 调用 → 工作流编排层 (你自研的核心)
                    │
                    ├── 持久化状态存储 (SQLite 即可)
                    ├── 任务路由器 (规则引擎，非 ML)
                    └── HITL 控制器
                            ├── 暂停：保存状态 → 返回审批请求
                            └── 恢复：加载状态 → 注入审批结果 → 继续
```

可以立即借鉴的具体点：

- **持久化检查点（Checkpointer）**：这是 HITL 的**最低要求**。每次状态变更（开始节点、完成节点、触发审批）都写入 SQLite。恢复时从最后一个检查点加载，而不是依赖内存中的会话。
- **显式的中断/恢复语义**：在工作流 DSL 或代码中，提供 `interrupt(payload)` 和 `resume(decision)` 这样的原语，让流程定义者能明确指定在何处需要人工介入。
- **工具审批门（Approval Gate）**：借鉴 Ruflo 的 `requires_approval` 模式，在工具注册表中为敏感工具打上标记。当 Agent 尝试调用此类工具时，自动触发暂停和审批流程。

## 七、综合结论

| 维度 | 评估 |
|-|-|
| 内网离线运行 | ❌ 必须连接 Anthropic API |
| 内部 Agent CLI 对接 | ❌ Ruflo 是 Claude Code 的增强层，不是独立引擎 |
| 权限校验 | ⚠️ 有 Claims RBAC 能力，但绑定 Claude Code 生态 |
| HITL 机制 | ✅ 有完整的 pause/resume 状态机和审批门，但依赖 MCP + Claude Code |
| 本地工具调用 | ⚠️ 需通过 Claude Code 间接实现 |
| 不依赖容器 | ✅ npm 安装即可 |

**根本冲突**：Ruflo 是 **Claude Code CLI 的专属编排层**，而非通用工作流引擎。我的场景需要的是一个能对接**内部 Agent CLI** 的编排框架，而 Ruflo 的设计前提与这一需求**直接冲突**。如果内部 CLI 恰好也兼容 Claude Code 的 MCP 协议且能连接 Anthropic API，则 Ruflo 可能可用；否则，**LangGraph 仍然是更务实的选择**——它不绑定任何特定的底层 CLI，HITL 机制原生内置，且完全可在内网离线运行。

**关于借鉴意义**：Ruflo 的架构**值得深度研究，但不必全盘复刻**。它的价值在于提供了一个“成熟 Agent 编排平台”的**参考蓝图**，让我清楚地看到 HITL 需要哪些组件：持久化状态、显式中断语义、审批门和与宿主 CLI 的集成点。正确路径是：**以 Ruflo 的架构分层为参考，基于内部 Agent CLI 的实际扩展能力，自研一个轻量级的 HITL 编排层**。核心投入应放在**持久化状态管理和清晰的中断/恢复原语**上，而非追求复刻其全部（包括基于 ML 的路由和复杂的共识算法）功能。