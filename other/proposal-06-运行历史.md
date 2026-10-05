# 子文档六：运行历史

## 一、定位

运行历史是**跨工作区的全局运行管理视图**，记录所有 Run（含 OP / Workflow / Job 执行记录）。

- 全局视图，跨工作区。
- 展示所有 Run，无论触发来源。
- 提供筛选、查看、重跑、终止等操作。
- 入口在**菜单栏 → 扩展功能 → 运行历史**。

与右侧区域「运行列表 Tab」互补：运行列表是工作区级视图，运行历史是全局视图。

## 二、数据结构

### 2.1 Run

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
    | "waiting_user"
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
```

### 2.2 StepRecord

```typescript
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
```

### 2.3 ProcessRecord

```typescript
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
```

### 2.4 WorkflowRunResult

```typescript
interface WorkflowRunResult {
  workflowId: string;
  status: Run["status"];
  outputs: Record<string, unknown>;
  steps: StepRecord[];
}
```

## 三、视图结构

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

## 四、字段说明

| 字段 | 说明 |
|-|-|
| 类型 | OP / Workflow / Job |
| 触发来源 | 工作台触发 / Job 界面触发 / 定时触发 / 试运行 |
| 工作区归属 | 执行时绑定的工作区 |
| 状态 | pending / running / waiting_user / success / failed / cancelled / timeout / interrupted |
| 耗时 | 从启动到完成的时长 |
| 开始时间 | 相对时间 |

## 五、筛选条件

| 筛选 | 选项 |
|-|-|
| 类型 | 全部 / OP / Workflow / Job |
| 状态 | 全部 / 运行中 / 等待人工 / 成功 / 失败 / 取消 / 超时 / 中断 |
| 工作区 | 全部 / 具体工作区 |
| 时间 | 全部 / 最近 1 小时 / 最近 24 小时 / 最近 7 天 / 自定义 |

## 六、操作

### 6.1 查看

- 点击"查看"进入 Run 详情。
- 展示：状态、耗时、入参、出参、步骤列表、日志。

### 6.2 重跑

- 以当前 Run 的 inputs 和 workspace 创建一个新 Run。
- 新 Run 的 triggeredBy 记录为 "manual"。
- 原 Run 不受影响。

### 6.3 终止

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

### 6.4 从指定步骤重启

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

### 6.5 从中断处继续（交互式）

```typescript
async function resumeFromWaiting(runId: string, db: Database) {
  const run = db.getRun(runId);
  if (run.status !== "waiting_user") return;
  db.markStepContinued(runId, run.currentStepId);
  executeRun(run);
}
```

## 七、退出码与产物契约

### 7.1 退出码语义

| 退出码 | 含义 | Run 状态 |
|-|-|-|
| 0 | 成功 | success |
| 非 0 | 失败 | failed |
| 超时 | 进程被 kill | timeout |
| 被终止 | 用户终止 | cancelled |

### 7.2 产物契约

**优先级**：

1. 若 CliProfile 指定 resultFile，且文件存在 → 从文件读取。
2. 否则按 outputParser.mode 解析 stdout。
3. 若解析失败 → 出参为空，但 Run 状态仍按退出码判定。

**产物文件约定**：

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

**stdout JSON 约定**：

```json
{
  "result": "...",
  "outputs": {
    "key": "value"
  }
}
```

### 7.3 日志存储

- 每个步骤的 stdout / stderr 全量落盘。
- 路径：`~/.app-name/runs/{runId}/{stepId}.stdout.log`
- 支持大文件按需加载。
- 运行历史中可查看每个步骤的完整日志。

## 八、持久化

### 8.1 数据模型

SQLite 表：

| 表 | 用途 |
|-|-|
| cli_profiles | CLI 配置 |
| op_definitions | OP 定义 |
| workflow_definitions | Workflow 定义 |
| job_definitions | Job 定义 |
| runs | Run 实例 |
| steps | 步骤记录 |
| processes | 进程记录 |
| artifacts | 产物文件引用 |

### 8.2 恢复流程

应用重启后：

1. 扫描所有 `status in (pending, running, waiting_user)` 的 Run。
2. 对每个 Run 的每个步骤：
   - 若 processRecord.pid 存在，检查进程是否存活。
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

### 8.3 恢复原则

| 原则 | 说明 |
|-|-|
| 不自动重跑 | 重启是低频事件，由人工决策 |
| 不弹窗打扰 | 恢复结果直接体现在运行历史/运行列表 |
| 保留全部日志 | 即使进程已死，日志仍可查看 |
| 状态可人工修正 | 允许用户手动标记步骤完成/失败 |

## 九、交互式步骤处理

### 9.1 行为

Workflow 引擎遇到 interactive: true 的 OP：

1. 标记 Run 状态为 waiting_user，Step 状态为 waiting_user。
2. 在运行列表中显示"打开终端"按钮。
3. 用户点击，App 调用系统命令打开终端：

```text
# Windows
wt.exe -d {workspace} -- {command} {args}

# macOS
open -a Terminal --args {command} {args}

# Linux
x-terminal-emulator -e {command} {args}
```

4. 用户在终端中与 CLI 交互，包括 TUI。
5. 用户处理完，回到 App，点击"标记完成，继续"。
6. Workflow 引擎推进到下一步。

### 9.2 关键设计

| 规则 | 说明 |
|-|-|
| 不解析终端内容 | 引擎不知道用户在终端里做了什么 |
| 不识别 ask | 不尝试自动回答 |
| 不注入回答 | 一切交互在外部终端进行 |
| 人工确认边界 | 用户点"继续"作为步骤完成的信号 |
| 可跳过 | 用户可选择跳过该步骤 |

### 9.3 UI 展示

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

## 十、运行历史与运行列表的关系

| 维度 | 运行列表（右侧 Tab） | 运行历史（全局页） |
|-|-|-|
| 范围 | 当前工作区 | 所有工作区 |
| 入口 | 右侧区域 Tab | 菜单栏 → 扩展功能 |
| 定位 | 实时监控 | 全局管理 |
| 筛选 | 无筛选，按时间排序 | 多维度筛选 |
| 操作 | 查看、终止、继续 | 查看、重跑、终止、重启、继续 |

## 十一、关键设计决策

| 决策点 | 建议 | 理由 |
|-|-|-|
| 定位 | 全局运行管理视图 | 跨工作区统一查看 |
| 范围 | 所有 Run（OP / Workflow / Job） | 统一记录 |
| 触发来源 | 记录在 Run 中 | 便于追溯 |
| 恢复 | 人工决策 + 状态查询 | 重启是低频事件 |
| 交互式 | 外部终端 + 人工推进 | 不实现 PTY 包 TUI |
| 日志 | 全量落盘，按需加载 | 支持大文件、可审计 |
| 持久化 | SQLite | 本地、轻量、事务性 |
| 筛选 | 类型 / 状态 / 工作区 / 时间 | 覆盖主要场景 |