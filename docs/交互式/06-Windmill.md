# Windmill 内网 Human-in-the-Loop 场景评估

## 一、我的使用场景

- 在内网环境下使用。
- 使用的 Agent CLI 是内部工具。
- Agent CLI 使用时，有数据和权限校验要求。
- 如果在容器中或挂载到容器中使用 Agent CLI，会有权限校验不过的问题。
- 需求：在办公电脑上直接运行，从而直接调用本地的工具。

## 二、Windmill 介绍

### 2.1 Windmill 是什么？

Windmill 是一个 **代码优先（code-first）的开源工作流编排平台**，其核心定位是“用代码构建一切”，与 Langflow/n8n 的“低代码画布”路线截然不同。它**原生支持 HITL 审批步骤**，且在 Windows 办公电脑上**确实可以不依赖 Docker 直接运行 Worker**，但这需要**企业版许可**。

Windmill 是一个开源、可自托管的**工作流引擎和开发者平台**，被定位为 Retool、Airflow、n8n 的开源替代品。它的核心理念是**将脚本（而非可视化节点）作为工作流的基本单元**。

| 维度 | 说明 |
|-|-|
| 本质 | 代码优先的工作流编排平台（非低代码画布工具） |
| 核心能力 | 将 TypeScript/Python/Go/Bash 等 20+ 语言的脚本自动转为 API、Webhook、工作流和内部应用 |
| 工作流模型 | 基于 DAG（有向无环图）的状态机，脚本可组合为流程 |
| 开源协议 | AGPL-3.0（社区版），企业版提供额外功能 |
| HITL 支持 | ✅ **原生支持**，内置 Approval/Suspend 步骤 |
| 本地运行 | Worker 可在 Windows 上**不依赖 Docker** 运行（**需企业版**） |

Windmill 的架构由三个必需组件构成：**PostgreSQL 数据库**、**Server 容器**（前端+API）和 **Worker 容器**（执行脚本）。Server 和 Worker 本身可以跑在 Docker 中，但 **Worker 也支持以原生 Windows 可执行文件的形式运行**，这为你的场景提供了一个潜在的突破口。

### 2.2 Human-in-the-Loop (HITL) 的工作机制

Windmill 的 HITL 是**原生内置的**，通过 **Suspend/Approval 步骤**实现，而非像 Coze 那样需要外部审批中继。

#### 核心机制：Suspend + Resume URLs

工作流中的任意步骤都可以启用 **Suspend** 选项，使流程在此处暂停。

1. **流程到达审批步骤** → 该步骤调用 \`wmill.getResumeUrls()\` 生成**唯一的、秘密的恢复 URL**。
2. **流程暂停，Worker 完全释放** → 工作流进入挂起状态，**不再占用任何计算资源**，直到收到恢复事件。
3. **审批人通过 URL 做出决策** → 审批人通过 HTTP POST 向恢复 URL 发送 payload（批准/拒绝/自定义输入），或者直接在 Windmill 的审批页面上操作。
4. **流程从断点恢复** → 收到所需数量的审批事件后，流程恢复执行，审批结果可通过 \`resume["argument"]\` 获取。

#### 关键 HITL 特性

| 特性 | 说明 |
|-|-|
| 审批人数可配置 | 可要求 1 人或多人审批，未达到阈值前流程永久挂起（除非配置超时） |
| 自审批控制 | 通过 \`selfApproval\` 标志控制**触发工作流的人是否可以自己审批**，设为 \`false\` 可强制要求不同审批人 |
| 流程级预审批 | 通过 \`flowLevel: true\` 生成流程级恢复 URL，早期请求的审批可满足后续任意 Suspend 步骤 |
| 多通道审批 | 支持通过 Slack/Teams 发送交互式审批消息，也可通过 Email/SMS 发送恢复 URL |
| Workflows-as-Code HITL | 代码定义的流程中可使用 \`waitForApproval()\` 原语，Worker 在等待期间完全释放 |

**实际案例**：Windmill 官方博客展示了一个 AI 客服自动化流程——AI 起草回复后，**每一条面向客户的回复都必须经过人工审批才能发出**，审批在 Discord 中完成，整个流程运行在 Windmill 上。

## 三、是否适合我的场景？（匹配度分析）

| 我的需求 | Windmill 的支持情况 | 关键细节 |
|-|-|-|
| 内网环境使用 | ✅ 支持 | 完全可自托管，支持 Docker Compose 或 Kubernetes 部署。可配置为纯内网运行，无外部依赖。 |
| 内部 Agent CLI 对接 | ✅ 完全支持 | \`wmill\` CLI 支持 \`wmill flow run\` / \`wmill script run\` 直接触发工作流，输入通过 \`--data\` 传递，**Flow Steps 和 Logs 会自动流式输出到终端**。CLI 可通过 \`npm install -g windmill-cli\` 安装。 |
| 数据和权限校验 | ✅ 企业级支持 | 提供**5 种内置角色**（Superadmin/Devops/Admin/Developer/Operator）、**基于文件夹的 ACL**、**路径级权限控制**。支持 SSO（Google/GitHub/Azure AD/Okta）、SAML 和 SCIM（企业版），所有操作记录在**审计日志**中。 |
| 办公电脑直接运行，调用本地工具 | ⚠️ 技术可行，但需企业版许可 | **Windows Worker 支持原生运行，不依赖 Docker 或 WSL**，可直接调用本地 Python、Bun、PowerShell、C# 等执行器。Jobs 以原生 Windows 进程运行，可**完整访问域凭据、Kerberos 票据、私有模块源和本地证书存储**。**但这明确是 Self-Hosted Enterprise 功能**。 |
| 不依赖容器 | ⚠️ 部分满足（需企业版） | Worker 可不依赖 Docker 运行，但 **Server 和 PostgreSQL 仍需部署**。Server 可运行在另一台机器或同一台机器的非容器方式中，但官方最简部署路径仍是 Docker Compose。 |

## 四、需要留意的关键点

1. **Windows 原生 Worker 是企业版功能**：这是最关键的约束。社区版（AGPL）的 Worker 运行**推荐使用 Docker**。如果你的办公电脑只能运行社区版，则无法绕过 Docker。企业版需要商业许可，在内网气隙环境中获取许可可能需要联系 Windmill Labs。

2. **Server 端仍需 PostgreSQL**：即使 Worker 以原生 Windows 进程运行，**Windmill Server 和 PostgreSQL 数据库仍然需要部署**。Server 可以运行在另一台机器上（通过 \`DATABASE_URL\` 连接），但这意味着你的办公电脑不是“完全独立”运行的——它需要连接到一个 Server 实例。

3. **Server 可以不跑在办公电脑上**：如果你的办公电脑只需要作为 **Worker**（执行本地工具），而 Server 和内网其他机器共用，那么办公电脑上只需运行 \`windmill-ee.exe\`，**确实不需要 Docker**。这可以规避“在容器中权限校验不过”的问题。

4. **CLI 原生支持是显著优势**：与 Coze Studio 不同，\`wmill\` CLI 是 Windmill 的一等公民，支持完整的 \`list/get/new/run\` 子命令体系，且输出支持 \`--json\` 便于管道处理，完全适合作为内部 Agent CLI 的触发后端。

5. **HITL 是原生能力而非事后拼接**：Windmill 的 Suspend/Approval 是工作流引擎的核心功能，审批结果可注入后续步骤的输入，条件分支可基于审批结果动态选择路径——这与 Coze Studio 需要外部审批中继的“拼接式 HITL”有本质区别。

## 五、综合结论

| 维度 | 评估 |
|-|-|
| 内网离线运行 | ✅ 完全可行，官方支持自托管 |
| CLI 作为触发入口 | ✅ **原生一等公民**，\`wmill flow run\` 直接触发并流式输出 |
| 权限校验 | ✅ 企业级 RBAC、SSO、SAML、审计日志一应俱全 |
| HITL 机制 | ✅ **原生内置**，Suspend/Approval 步骤，审批结果可驱动分支 |
| 本地工具调用（不依赖 Docker） | ⚠️ **技术上支持，但需企业版许可**；Worker 可以原生 Windows 进程运行，Server 可在内网其他机器 |
| 与 Coze Studio 的关键差异 | CLI 原生支持 ✅ / HITL 原生内置 ✅ / 但本地运行需企业版 ⚠️ |

**Windmill 是你的场景中迄今最接近“完全满足”的工具**，前提是你能够获取企业版许可，或者接受“Server 跑在内网其他机器、Worker 跑在办公电脑上”的混合架构。如果你必须使用社区版且必须在办公电脑上完全自包含运行，Windmill 的 Docker 依赖问题仍然存在，此时 **LangGraph + 内部 CLI** 的组合仍然是更务实的选择。