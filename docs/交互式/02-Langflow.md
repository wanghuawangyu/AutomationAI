# Langflow 内网 Human-in-the-Loop 场景评估

## 一、我的使用场景

- 在内网环境下使用。
- 使用的 Agent CLI 是内部工具。
- Agent CLI 使用时，有数据和权限校验要求。
- 如果在容器中或挂载到容器中使用 Agent CLI，会有权限校验不过的问题。
- 需求：在办公电脑上直接运行，从而直接调用本地的工具。

## 二、Langflow 介绍

### 2.1 Langflow 是什么？

Langflow 是一个低代码 AI 工作流构建器，同时提供图形化画布和可编程的 Python 组件，核心定位是“可视化编排 AI 工作流”。与 LangGraph 不同，Langflow 更偏向于开箱即用的产品化工具，而非纯粹的底层框架。它内置 HITL 节点，且支持非 Docker 的本地部署。

| 维度 | 说明 |
|-|-|
| 本质 | 低代码/可视化的 AI 工作流构建平台，提供 Web UI 画布 |
| 核心功能 | 拖拽节点构建工作流、多智能体编排、内置 API 和 MCP 服务器 |
| 本地运行 | 支持 `pip install langflow` 直接安装，无需 Docker |
| HITL 支持 | Langflow 1.11 版本原生支持 Human-in-the-Loop |
| 开源协议 | MIT 开源，可永久免费使用 |

### 2.2 Human-in-the-Loop (HITL) 工作机制

Langflow 在 1.11 版本中正式引入了 HITL 功能，核心机制是持久化检查点和可中断执行。

工作流程：

1. 触发暂停：当组件抛出 `PauseRequested` 异常，或 Agent 尝试调用标记为 `requires_approval` 的工具时，工作流暂停。
2. 创建检查点：系统将当前图的完整状态（包括每个节点的状态、执行队列、流程上下文）序列化并写入数据库，形成 `GraphCheckpoint`。
3. 等待人工决策：工作流进入 `SUSPENDED` 状态，等待用户通过前端或 API 做出批准、拒绝或编辑的决策。
4. 从检查点恢复：用户决策后，系统从数据库读取检查点，注入人工决策，从断点精确恢复执行，不会重复执行已完成的节点。

### 2.3 持久化执行与崩溃安全

Langflow 的 HITL 机制是持久化的。即使 Langflow 服务器进程重启或崩溃，由于检查点已写入数据库，工作流仍然可以从暂停点恢复，不会丢失状态。

## 三、是否适合我的场景？（匹配度分析）

| 我的需求 | Langflow 支持情况 | 关键细节 |
|-|-|-|
| 内网环境使用 | ✅ 支持 | Langflow 可以在无外网连接的环境下运行，但需注意：某些组件（如 `HuggingFaceHub`）在实例化时仍可能尝试访问外网进行模型下载或版本检查。建议在内网预先下载所有依赖的模型和库，并集成 Ollama 等本地 LLM 来构建完全离线的系统。 |
| 内部 Agent CLI 对接 | ✅ 支持 | Langflow 可以将工作流部署为 MCP 服务器，你的内部 CLI 作为 MCP 客户端，通过 API Key 连接并调用 Langflow 中的 Flow。也可以使用社区提供的 `langflow-mcp-server` 包进行对接。 |
| 数据和权限校验 | ✅ 支持 | Langflow 后端围绕 `user_id` 实现权限控制，流程查询和图构建会校验用户身份。你可以通过自定义组件嵌入权限校验逻辑，例如在工具调用前检查 `LANGFLOW_AGENTIC_USER_ID` 环境变量，或使用 `GuardedTool` 进行策略校验。 |
| 办公电脑直接运行，调用本地工具 | ✅ 支持 | Langflow 支持 `pip install langflow` 直接安装，运行 `langflow run` 即可在本地启动。你可以通过自定义 Python 组件调用本地的 `subprocess` 来执行 Shell 命令或调用本地脚本，无需容器。 |
| 不依赖容器 | ✅ 支持 | 官方推荐使用 `uv pip install langflow` 或 `pip install langflow` 进行本地安装，无需 Docker。也提供 Langflow Desktop 桌面版，所有依赖已包含，适用于 Windows 和 macOS。 |

## 四、需要留意的关键点

1. 离线环境的隐式网络请求：部分组件可能隐式触发网络请求，在内网环境中需要逐一验证并替换为本地实现。
2. Python 版本要求：需要 Python 3.10–3.13，建议使用 `uv` 包管理器进行安装。
3. 安全漏洞历史：Langflow 曾披露过授权绕过漏洞（CVE-2026-34046），在使用旧版本时需注意升级到 1.5.1 以上。此外，MCP Tools 组件配置本地 stdio 子进程传输时，可能被用于执行任意系统命令，在生产环境中需要严格限制。
4. HITL 的恢复稳定性：有报告指出，批准暂停的 HITL 工具调用后，工作流可能不会恢复，而是直接失败。在实际使用前需要验证这一交互的稳定性。

## 五、综合结论

Langflow 适合我的场景，但需要自行解决离线环境的网络依赖问题，并验证 HITL 恢复的稳定性。

- 日常使用：在办公电脑上 `pip install langflow`，通过 `langflow run` 启动 Web UI 画布，拖拽构建包含 HITL 节点的工作流。
- CLI 对接：将 Langflow 工作流部署为 MCP 服务器，内部 Agent CLI 通过 API Key 连接调用。
- 本地工具调用：编写自定义 Python 组件，通过 `subprocess` 调用本地工具，实现与办公电脑环境的直接交互。
- 权限校验：在自定义组件中嵌入校验逻辑，利用 Langflow 的 `user_id` 机制进行流程级隔离。

与 LangGraph 相比，Langflow 的优势在于开箱即用的可视化画布和 HITL 节点，代价是需要额外处理离线依赖和潜在的安全配置。如果希望减少开发量、快速搭建带画布的 HITL 工作流，Langflow 是更直接的选择。