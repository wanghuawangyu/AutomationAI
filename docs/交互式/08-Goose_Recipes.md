# Goose Recipes 内网 Human-in-the-Loop 场景评估

> **特别说明**：Goose Recipes 是 **Goose Agent 的专有工作流封装格式**，本质上是 YAML 格式的配置文件，只能由 Goose 运行时解析和执行。内部 Agent CLI 无法直接使用或执行 Recipe 文件。本文在评估其是否适合我的内网场景的同时，也分析其 HITL 设计对内部 CLI 的借鉴意义。

## 一、我的使用场景

- 在内网环境下使用。
- 使用的 Agent CLI 是内部工具。
- Agent CLI 使用时，有数据和权限校验要求。
- 如果在容器中或挂载到容器中使用 Agent CLI，会有权限校验不过的问题。
- 需求：在办公电脑上直接运行，从而直接调用本地的工具。

核心诉求：**CLI 触发工作流，执行中 Agent 可暂停提问，我回答后从断点继续；不依赖容器，能调用本地工具，满足内网与权限校验要求。**

## 二、Goose Recipes 介绍

### 2.1 Goose Recipes 是什么？

Goose Recipes 是一个**预配置的工作流模板系统**，本质上是 **YAML 格式的配置文件**，用于封装完整的 Goose Agent 体验——包括系统指令、扩展（工具）、参数、设置和初始提示词。

| 维度 | 说明 |
|-|-|
| 本质 | YAML 格式的工作流模板，封装 Goose Agent 的完整配置 |
| 核心能力 | 定义 Agent 的指令、可用的扩展（工具）、参数、模型设置、子配方编排 |
| 技术栈 | Rust（Goose 本体），YAML（Recipe 定义） |
| 开源协议 | Apache 2.0 |
| 部署方式 | `pip install goose-ai` / `brew install block/tap/goose` / `cargo install goose-cli` |
| HITL 支持 | ✅ **原生内置**，通过权限模式实现 |

Recipe 的核心结构包括：**instructions**（系统提示词）、**extensions**（可用的工具和 MCP 服务器）、**parameters**（用户可配置的输入参数）、**settings**（模型和参数配置）、**sub_recipes**（可复用的子工作流组件）。

一个 Recipe 的典型定义如下：

```yaml
version: 1.0.0
title: Code Review Assistant
description: AI assistant for thorough code reviews
instructions: |
  You are a code review assistant. Review code for security vulnerabilities...
extensions:
  - type: builtin
    name: developer
settings:
  goose_provider: anthropic
  goose_model: claude-sonnet-4-20250514
parameters:
  - key: github_repo
    input_type: string
    requirement: required
    description: "GitHub repository (owner/repo)"
```

### 2.2 核心定位：Goose Agent 的专有工作流封装格式

Goose Recipes 是 **Goose Agent 的专有格式**，`goose recipe` 命令只能由 Goose CLI 或 Goose Desktop 执行。内部 Agent CLI **无法直接执行或解析 Recipe 文件**。Goose 虽然支持 "CLI Providers"（可对接 Claude Code、Codex、Gemini CLI），但这是**Goose 调用其他 CLI**，而非**其他 CLI 调用 Goose**。

## 三、Human-in-the-Loop (HITL) 的工作机制

Goose 的 HITL 是**原生内置的**，通过 **Permission Modes（权限模式）** 实现，而非像 LangGraph 那样使用 `interrupt()` 原语。

### 3.1 四种权限模式

| 模式 | 说明 | 适用场景 |
|-|-|-|
| **Completely Autonomous** | Agent 可自由修改文件、使用扩展、删除文件，无需批准 | 追求完全自动化的用户 |
| **Manual Approval** | **每次使用工具或扩展前都需要确认**，支持细粒度的工具权限控制 | 需要审查每一次变更和工具使用的用户 |
| **Smart Approval** | 基于风险的自动批准：低风险操作自动通过，高风险操作标记待审批 | 希望在自主性和监督之间取得平衡的用户 |
| **Chat Only** | 仅对话，不使用扩展，不修改文件 | 纯对话式分析场景 |

在 Manual 和 Smart Approval 模式下，会话窗口中会出现 **"Allow" 和 "Deny" 按钮**，Goose 仅对标记为 "write" 的工具（如文本编辑、`rm`、`cp`、`mv` 等 shell 命令）请求权限。

### 3.2 权限配置方式

Goose 使用 `permissions.yaml` 文件进行细粒度的工具权限控制：

```yaml
user:
  always_allow:
    - platform__search_available_extensions
    - developer__shell
  ask_before: []
  never_allow: []
```

也可以通过 `goose configure` 命令交互式配置，或在会话中使用 `/mode` 命令即时切换模式。

### 3.3 HITL 的实际应用案例

有技术博客展示了在 Goose 流水线中，**所有 Agent 的写操作必须经过 "预览 → 审核 → 写入" 流程**，表现为一个人工审批节点。如果审批不通过，流水线将自动回滚。

## 四、是否适合我的场景？（匹配度分析）

| 我的需求 | Goose Recipes 的支持情况 | 关键细节 |
|-|-|-|
| 内网环境使用 | ✅ **支持** | Goose 支持完全本地化运行，可连接 Ollama 等本地 LLM，所有数据和推理在内网完成。安装后**无需强制连接外部 API**。 |
| 内部 Agent CLI 对接 | ❌ **不满足** | Goose Recipes 是 **Goose Agent 的专有格式**。`goose recipe` 命令只能由 Goose CLI 或 Goose Desktop 执行。内部 Agent CLI **无法直接执行或解析 Recipe 文件**。Goose 虽然支持 "CLI Providers"（可对接 Claude Code、Codex、Gemini CLI），但这是**Goose 调用其他 CLI**，而非**其他 CLI 调用 Goose**。 |
| 数据和权限校验 | ⚠️ **有权限控制，但耦合 Goose 生态** | Goose 提供 `permissions.yaml` 进行工具级权限控制，支持 `always_allow` / `ask_before` / `never_allow` 三级配置。但这些权限校验是**围绕 Goose 自身的工具生态**设计的，无法直接迁移到内部 CLI 体系。 |
| 办公电脑直接运行，调用本地工具 | ⚠️ **技术上可行，但前提是使用 Goose Agent** | Goose 本身支持 `pip install goose-ai` 直接安装，有 CLI 和 Desktop 两种形态。Developer Extension 可执行本地 Shell 命令和文件操作。但**所有执行都必须通过 Goose Agent 运行时**，你的内部 CLI 无法作为执行引擎。 |
| 不依赖容器 | ✅ **支持** | Goose 通过 `pip install` 或 `cargo install` 直接安装在操作系统上，不强制 Docker。 |

## 五、需要留意的关键点

1. **Recipe 是 Goose 的专有格式**：Recipe 文件（YAML）只能由 Goose 运行时解析和执行。内部 Agent CLI 如果不支持 Goose 的 Recipe 规范，则无法使用这些工作流定义。这与 Coze Studio 的 Workflow 类似——格式是平台专有的。

2. **HITL 深度绑定 Goose 的权限系统**：Goose 的 Manual Approval 和 Smart Approval 模式依赖于 Goose 自身的工具调用拦截机制。内部 CLI 如果不暴露类似的 Hook 点，则无法接入这套 HITL 机制。

3. **"CLI Providers" 的方向是反的**：Goose 支持对接 Claude Code、Codex、Gemini CLI 作为**下层 Provider**，这意味着 Goose 是**上层编排器**。你的场景需要的是**内部 CLI 作为上层**，这与 Goose 的架构方向相反。

4. **沙盒机制仅限 macOS**：Goose v1.25.0 引入的安全沙盒（基于 seatbelt）**仅适用于 macOS**。在 Windows 办公电脑上，Goose 的沙盒能力不可用，安全性依赖权限模式而非操作系统级隔离。

5. **Recipe 可自动提交执行**：Recipe 在 Desktop UI 中被接受后，会**自动提交并开始执行**，无需用户手动点击活动气泡。这意味着 HITL 的暂停点必须在 Recipe 定义中通过权限模式预先配置，而非在执行过程中动态触发。

## 六、综合结论

| 维度 | 评估 |
|-|-|
| 内网离线运行 | ✅ 完全可行，支持 Ollama 本地 LLM |
| 内部 Agent CLI 对接 | ❌ Recipe 是 Goose 专有格式，内部 CLI 无法执行 |
| 权限校验 | ⚠️ 有 permissions.yaml 工具级控制，但绑定 Goose 生态 |
| HITL 机制 | ✅ 有四种权限模式，Manual/Smart Approval 支持审批，但依赖 Goose 运行时 |
| 本地工具调用 | ⚠️ Developer Extension 可执行本地命令，但必须通过 Goose Agent |
| 不依赖容器 | ✅ pip/cargo 直接安装 |

**根本冲突**：Goose Recipes 是 **Goose Agent 的专有工作流封装格式**，而非通用的工作流定义标准。我的场景需要的是一个能**对接内部 Agent CLI** 的编排方案，而 Goose Recipes 的设计前提（Goose Agent 作为执行引擎）与这一需求**直接冲突**。这与 Ruflo 的问题类似——都是为特定 Agent CLI 量身定制的编排层，无法适配其他 CLI。

**关于借鉴意义**：Goose 的 **permissions.yaml 三级权限模型**（`always_allow` / `ask_before` / `never_allow`）和 **Smart Approval 的基于风险的自动批准策略**，对内部 CLI 的 HITL 设计有参考价值。可以借鉴其**工具级权限粒度**和**风险分级审批**的思路，在内部 CLI 中实现类似的审批门控机制。