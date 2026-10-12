/**
 * 全局 Mock 数据 —— **严格对齐后端 API 结构**
 * 对应文档：
 *   Client   → proposal-02-后端crud-01client管理.md
 *   OP       → proposal-02-后端crud-02op管理.md
 *   Workflow → proposal-02-后端crud-03workflow管理.md
 *   Job      → proposal-02-后端crud-04job管理.md
 *   Run      → proposal-02-后端crud-05运行历史.md
 *   Settings → proposal-02-后端crud-06配置管理.md
 *
 * 约定：
 * - 实体间一律用 **id 引用**（clientId / opId / workflowId / jobId），不内嵌名称；
 *   展示名由 *(id) 索引表 join 得到（对齐后端 targetName / opName 等计算字段）。
 * - 运行历史 `steps` 为**扁平 StepRecord 数组**（一条执行 = 一条记录，含 activationSeq / retrySeq），
 *   **不使用 attempts 内嵌数组**（D3 拍板：判断以最后一条记录为准）。
 * - 所有耗时字段统一 `durationMs`（毫秒）；时间字段统一毫秒时间戳。
 */

// ========== Client 数据（GET /api/clients，crud-01 3.1）==========
var CLIENTS = [
  {
    clientId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    name: 'Claude Code',
    description: 'Claude Code CLI',
    type: 'prompt',
    command: 'claude',
    argsTemplate: '--print --output-format json --model sonnet',
    inputMode: 'stdin',
    outputMode: 'json',
    outputJsonPath: '$.result',
    exitCodeSuccess: [0],
    binaryPath: null,
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  },
  {
    clientId: 'b2c3d4e5f60718293a4b5c6d7e8f90a1',
    name: 'Codex CLI',
    description: 'OpenAI Codex CLI',
    type: 'prompt',
    command: 'codex',
    argsTemplate: null,
    inputMode: 'stdin',
    outputMode: 'text',
    outputJsonPath: null,
    exitCodeSuccess: [0],
    binaryPath: null,
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  },
  {
    clientId: 'c3d4e5f60718293a4b5c6d7e8f90a1b2',
    name: '本地 Bash',
    description: '本地 Bash Shell',
    type: 'bash',
    command: null,
    argsTemplate: null,
    inputMode: null,
    outputMode: null,          // 仅 prompt 类使用；脚本类（bash/python/powershell）为空
    outputJsonPath: null,
    exitCodeSuccess: [0],
    binaryPath: '/usr/bin/bash',
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  },
  {
    clientId: 'd4e5f60718293a4b5c6d7e8f90a1b2c3',
    name: '本地 Python',
    description: '本地 Python',
    type: 'python',
    command: null,
    argsTemplate: null,
    inputMode: null,
    outputMode: null,          // 仅 prompt 类使用
    outputJsonPath: null,
    exitCodeSuccess: [0],
    binaryPath: '/usr/bin/python3',
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  },
  {
    clientId: 'e5f60718293a4b5c6d7e8f90a1b2c3d4',
    name: '本地 PowerShell',
    description: '本地 PowerShell',
    type: 'powershell',
    command: null,
    argsTemplate: null,
    inputMode: null,
    outputMode: null,          // 仅 prompt 类使用
    outputJsonPath: null,
    exitCodeSuccess: [0],
    binaryPath: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  }
];

var CLIENT_BY_ID = {};
var CLIENT_BY_NAME = {};
CLIENTS.forEach(function (c) { CLIENT_BY_ID[c.clientId] = c; CLIENT_BY_NAME[c.name] = c; });

// ========== OP 数据（GET /api/ops，crud-02 3.2）==========
// 注意：OP **不与 Client 绑定**（无 client 字段）；执行时才指定 clientId。
var OPS = [
  {
    opId: '10000000000000000000000000000001',
    name: 'check_tests',
    type: 'prompt',
    description: '运行测试并报告结果',
    content: '在当前工作区运行测试，并输出结果 JSON',
    timeoutMs: 300000,
    interactive: false,
    version: 2,
    inputs: [{ name: 'test_cmd', type: 'string', required: true, default: null, description: '测试命令' }],
    outputs: [
      { name: 'passed', type: 'string', description: '测试是否通过' },
      { name: 'count', type: 'string', description: '通过用例数' },
      { name: 'result', type: 'string', description: '测试结果详情' }
    ],
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  },
  {
    opId: '10000000000000000000000000000002',
    name: 'review',
    type: 'prompt',
    description: '审查测试结果',
    content: '审查测试结果并给出结论',
    timeoutMs: 600000,
    interactive: false,
    version: 2,
    inputs: [{ name: 'test_result', type: 'string', required: true, default: null, description: '测试结果' }],
    outputs: [{ name: 'approved', type: 'string', description: '是否通过审查' }],
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  },
  {
    opId: '10000000000000000000000000000003',
    name: 'deploy',
    type: 'prompt',
    description: '部署到目标环境',
    content: '将当前工作区部署到指定环境，并返回访问 URL',
    timeoutMs: 120000,
    interactive: false,
    version: 2,
    inputs: [{ name: 'target_env', type: 'string', required: true, default: null, description: '目标环境' }],
    outputs: [{ name: 'url', type: 'string', description: '部署后的 URL' }],
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  },
  {
    opId: '10000000000000000000000000000004',
    name: 'notify',
    type: 'prompt',
    description: '发送成功通知',
    content: '发送通知消息',
    timeoutMs: 60000,
    interactive: false,
    version: 1,
    inputs: [{ name: 'message', type: 'string', required: true, default: null, description: '通知内容' }],
    outputs: [],
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  },
  {
    opId: '10000000000000000000000000000005',
    name: 'notify_fail',
    type: 'prompt',
    description: '发送失败通知',
    content: '发送失败告警通知',
    timeoutMs: 60000,
    interactive: false,
    version: 1,
    inputs: [{ name: 'error', type: 'string', required: false, default: null, description: '错误信息' }],
    outputs: [],
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  },
  {
    opId: '10000000000000000000000000000006',
    name: 'clean_logs',
    type: 'powershell',
    description: '清理历史日志',
    content: 'Get-ChildItem -Path $env:WORKSPACE -Recurse -Filter *.log | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item',
    timeoutMs: 120000,
    interactive: false,
    version: 3,
    inputs: [{ name: 'endpoint', type: 'string', required: true, default: null, description: '日志服务地址' }],
    outputs: [],
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  },
  {
    opId: '10000000000000000000000000000007',
    name: 'process_data',
    type: 'python',
    description: '处理数据',
    content: 'import json\n# 处理数据源并输出结果',
    timeoutMs: 300000,
    interactive: false,
    version: 3,
    inputs: [{ name: 'source', type: 'string', required: true, default: null, description: '数据源' }],
    outputs: [{ name: 'count', type: 'string', description: '处理条数' }],
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  },
  {
    opId: '10000000000000000000000000000008',
    name: 'health_check',
    type: 'bash',
    description: '健康检查',
    content: '#!/usr/bin/env bash\ncurl -sf "$endpoint/health"',
    timeoutMs: 180000,
    interactive: false,
    version: 1,
    inputs: [{ name: 'endpoint', type: 'string', required: true, default: null, description: '服务地址' }],
    outputs: [{ name: 'healthy', type: 'string', description: '是否健康' }],
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  },
  {
    opId: '10000000000000000000000000000009',
    name: 'collect_metrics',
    type: 'python',
    description: '采集指标',
    content: 'import json\n# 采集指标',
    timeoutMs: 240000,
    interactive: false,
    version: 1,
    inputs: [{ name: 'endpoint', type: 'string', required: true, default: null, description: '服务地址' }],
    outputs: [{ name: 'metrics', type: 'string', description: '指标数据' }],
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  },
  {
    opId: '1000000000000000000000000000000a',
    name: 'run_lint',
    type: 'bash',
    description: '运行代码检查',
    content: '#!/usr/bin/env bash\nnpm run lint',
    timeoutMs: 180000,
    interactive: false,
    version: 2,
    inputs: [{ name: 'target', type: 'string', required: true, default: null, description: '检查目标' }],
    outputs: [{ name: 'issues', type: 'string', description: '问题列表' }],
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  }
];

var OP_BY_ID = {};
var OP_BY_NAME = {};
OPS.forEach(function (o) { OP_BY_ID[o.opId] = o; OP_BY_NAME[o.name] = o; });

// OP 类型 → 可用于执行的 Client 列表（界面按 OP type 过滤可选 Client；后端无此字段，属前端展示辅助）
function clientsForOpType(type) {
  return CLIENTS.filter(function (c) {
    if (type === 'prompt') return c.type === 'prompt';
    return c.type === type;
  });
}

// ========== Workflow 数据（GET /api/workflows，crud-03 3.3）==========
// nodes 为**数组**；node 引用 OP 用 opId、引用 Client 用 clientId；bindings 为**结构化对象**；
// edges 为 `{from, to, condition}` 对象数组，condition 为字符串枚举（on_success / on_failure / always）。
var WORKFLOWS = [
  {
    workflowId: 'f0000000000000000000000000000001',
    name: 'deploy_workflow',
    version: 2,
    description: '部署工作流',
    inputs: [{ name: 'target_env', type: 'string', required: true, description: '目标环境' }],
    outputs: [
      { name: 'deploy_url', from: { nodeId: '4e5f60718293a4b5c6d7e8f9a1b2c3d4', outputName: 'url' }, description: '部署后的访问地址' },
      { name: 'status', from: { nodeId: '3d4e5f60718293a4b5c6d7e8f9a1b2c3', outputName: 'approved' }, description: '最终状态' }
    ],
    nodes: [
      { nodeId: '0a1b2c3d4e5f60718293a4b5c6d7e8f9', label: 'node_start', kind: 'start', position: { x: 20, y: 155 } },
      {
        nodeId: '1b2c3d4e5f60718293a4b5c6d7e8f9a1', label: 'node_check', kind: 'op', position: { x: 180, y: 50 },
        opId: '10000000000000000000000000000001', opVersion: 2, clientId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        bindings: { test_cmd: { kind: 'literal', value: 'pytest' } },
        retry: null
      },
      {
        nodeId: '3d4e5f60718293a4b5c6d7e8f9a1b2c3', label: 'node_review', kind: 'op', position: { x: 360, y: 50 },
        opId: '10000000000000000000000000000002', opVersion: 2, clientId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        bindings: { test_result: { kind: 'node_output', nodeId: '1b2c3d4e5f60718293a4b5c6d7e8f9a1', outputName: 'passed' } },
        retry: { on: 'failure', max: 3, backoff: 'exponential', interval: 1000 }
      },
      {
        nodeId: '4e5f60718293a4b5c6d7e8f9a1b2c3d4', label: 'node_deploy', kind: 'op', position: { x: 540, y: 50 },
        opId: '10000000000000000000000000000003', opVersion: 2, clientId: 'c3d4e5f60718293a4b5c6d7e8f90a1b2',
        bindings: { target_env: { kind: 'workflow_input', inputName: 'target_env' } },
        retry: { on: 'failure', max: 2, backoff: 'linear', interval: 2000 }
      },
      {
        nodeId: '5f60718293a4b5c6d7e8f9a1b2c3d4e5', label: 'node_notify', kind: 'op', position: { x: 720, y: 50 },
        opId: '10000000000000000000000000000004', opVersion: 1, clientId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        bindings: { message: { kind: 'literal', value: '部署成功' } },
        retry: null
      },
      {
        nodeId: '60718293a4b5c6d7e8f9a1b2c3d4e5f6', label: 'node_notify_fail', kind: 'op', position: { x: 360, y: 230 },
        opId: '10000000000000000000000000000005', opVersion: 1, clientId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        bindings: { error: { kind: 'node_output', nodeId: '1b2c3d4e5f60718293a4b5c6d7e8f9a1', outputName: 'result' } },
        retry: null
      },
      { nodeId: '2c3d4e5f60718293a4b5c6d7e8f9a1b2', label: 'node_end', kind: 'end', position: { x: 940, y: 155 } }
    ],
    edges: [
      { from: '0a1b2c3d4e5f60718293a4b5c6d7e8f9', to: '1b2c3d4e5f60718293a4b5c6d7e8f9a1', condition: 'on_success' },
      { from: '1b2c3d4e5f60718293a4b5c6d7e8f9a1', to: '3d4e5f60718293a4b5c6d7e8f9a1b2c3', condition: 'on_success' },
      { from: '1b2c3d4e5f60718293a4b5c6d7e8f9a1', to: '60718293a4b5c6d7e8f9a1b2c3d4e5f6', condition: 'on_failure' },
      { from: '3d4e5f60718293a4b5c6d7e8f9a1b2c3', to: '4e5f60718293a4b5c6d7e8f9a1b2c3d4', condition: 'on_success' },
      { from: '4e5f60718293a4b5c6d7e8f9a1b2c3d4', to: '5f60718293a4b5c6d7e8f9a1b2c3d4e5', condition: 'on_success' },
      { from: '5f60718293a4b5c6d7e8f9a1b2c3d4e5', to: '2c3d4e5f60718293a4b5c6d7e8f9a1b2', condition: 'on_success' },
      { from: '60718293a4b5c6d7e8f9a1b2c3d4e5f6', to: '2c3d4e5f60718293a4b5c6d7e8f9a1b2', condition: 'on_success' }
    ],
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  },
  {
    workflowId: 'f0000000000000000000000000000002',
    name: 'log_analysis',
    version: 1,
    description: '日志分析工作流',
    needsUpdate: true,
    inputs: [{ name: 'log_source', type: 'string', required: true, description: '日志来源' }],
    outputs: [{ name: 'report', from: { nodeId: '93a4b5c6d7e8f9a1b2c3d4e5f6071829', outputName: 'count' }, description: '分析报告' }],
    nodes: [
      { nodeId: '718293a4b5c6d7e8f9a1b2c3d4e5f607', label: 'node_start', kind: 'start', position: { x: 20, y: 155 } },
      {
        nodeId: '8293a4b5c6d7e8f9a1b2c3d4e5f60718', label: 'node_collect', kind: 'op', position: { x: 180, y: 50 },
        opId: '10000000000000000000000000000009', opVersion: 1, clientId: 'd4e5f60718293a4b5c6d7e8f90a1b2c3',
        bindings: { endpoint: { kind: 'workflow_input', inputName: 'log_source' } },
        retry: null
      },
      {
        nodeId: '93a4b5c6d7e8f9a1b2c3d4e5f6071829', label: 'node_process', kind: 'op', position: { x: 360, y: 50 },
        opId: '10000000000000000000000000000007', opVersion: 3, clientId: 'd4e5f60718293a4b5c6d7e8f90a1b2c3',
        bindings: { source: { kind: 'node_output', nodeId: '8293a4b5c6d7e8f9a1b2c3d4e5f60718', outputName: 'metrics' } },
        retry: null
      },
      { nodeId: 'a4b5c6d7e8f9a1b2c3d4e5f60718293a', label: 'node_end', kind: 'end', position: { x: 540, y: 155 } }
    ],
    edges: [
      { from: '718293a4b5c6d7e8f9a1b2c3d4e5f607', to: '8293a4b5c6d7e8f9a1b2c3d4e5f60718', condition: 'always' },
      { from: '8293a4b5c6d7e8f9a1b2c3d4e5f60718', to: '93a4b5c6d7e8f9a1b2c3d4e5f6071829', condition: 'on_success' },
      { from: '93a4b5c6d7e8f9a1b2c3d4e5f6071829', to: 'a4b5c6d7e8f9a1b2c3d4e5f60718293a', condition: 'always' }
    ],
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  },
  {
    workflowId: 'f0000000000000000000000000000003',
    name: 'code_review',
    version: 3,
    description: '代码审查工作流',
    inputs: [{ name: 'repo', type: 'string', required: true, description: '仓库地址' }],
    outputs: [{ name: 'result', from: { nodeId: 'd7e8f9a1b2c3d4e5f60718293a4b5c6d', outputName: 'approved' }, description: '审查结果' }],
    nodes: [
      { nodeId: 'b5c6d7e8f9a1b2c3d4e5f60718293a4b', label: 'node_start', kind: 'start', position: { x: 20, y: 155 } },
      {
        nodeId: 'c6d7e8f9a1b2c3d4e5f60718293a4b5c', label: 'node_lint', kind: 'op', position: { x: 180, y: 50 },
        opId: '1000000000000000000000000000000a', opVersion: 2, clientId: 'c3d4e5f60718293a4b5c6d7e8f90a1b2',
        bindings: { target: { kind: 'workflow_input', inputName: 'repo' } },
        retry: null
      },
      {
        nodeId: 'd7e8f9a1b2c3d4e5f60718293a4b5c6d', label: 'node_review', kind: 'op', position: { x: 360, y: 50 },
        opId: '10000000000000000000000000000002', opVersion: 2, clientId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        bindings: { test_result: { kind: 'node_output', nodeId: 'c6d7e8f9a1b2c3d4e5f60718293a4b5c', outputName: 'issues' } },
        retry: null
      },
      { nodeId: 'e8f9a1b2c3d4e5f60718293a4b5c6d7e', label: 'node_end', kind: 'end', position: { x: 540, y: 155 } }
    ],
    edges: [
      { from: 'b5c6d7e8f9a1b2c3d4e5f60718293a4b', to: 'c6d7e8f9a1b2c3d4e5f60718293a4b5c', condition: 'always' },
      { from: 'c6d7e8f9a1b2c3d4e5f60718293a4b5c', to: 'd7e8f9a1b2c3d4e5f60718293a4b5c6d', condition: 'on_success' },
      { from: 'd7e8f9a1b2c3d4e5f60718293a4b5c6d', to: 'e8f9a1b2c3d4e5f60718293a4b5c6d7e', condition: 'always' }
    ],
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  },
  {
    workflowId: 'f0000000000000000000000000000004',
    name: 'hourly_check',
    version: 1,
    description: '每小时健康检查',
    inputs: [{ name: 'endpoint', type: 'string', required: true, description: '检查地址' }],
    outputs: [{ name: 'healthy', from: { nodeId: '0a1b2c3d4e5f60718293a4b5c6d7e8fa', outputName: 'healthy' }, description: '是否健康' }],
    nodes: [
      { nodeId: 'f9a1b2c3d4e5f60718293a4b5c6d7e8f', label: 'node_start', kind: 'start', position: { x: 20, y: 155 } },
      {
        nodeId: '0a1b2c3d4e5f60718293a4b5c6d7e8fa', label: 'node_health', kind: 'op', position: { x: 180, y: 155 },
        opId: '10000000000000000000000000000008', opVersion: 1, clientId: 'd4e5f60718293a4b5c6d7e8f90a1b2c3',
        bindings: { endpoint: { kind: 'workflow_input', inputName: 'endpoint' } },
        retry: null
      },
      { nodeId: '1a2b3c4d5e6f708192a3b4c5d6e7f809', label: 'node_end', kind: 'end', position: { x: 380, y: 155 } }
    ],
    edges: [
      { from: 'f9a1b2c3d4e5f60718293a4b5c6d7e8f', to: '0a1b2c3d4e5f60718293a4b5c6d7e8fa', condition: 'on_success' },
      { from: '0a1b2c3d4e5f60718293a4b5c6d7e8fa', to: '1a2b3c4d5e6f708192a3b4c5d6e7f809', condition: 'on_success' }
    ],
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  }
];

var WORKFLOW_BY_ID = {};
var WORKFLOW_BY_NAME = {};
WORKFLOWS.forEach(function (w) { WORKFLOW_BY_ID[w.workflowId] = w; WORKFLOW_BY_NAME[w.name] = w; });

// ========== Job 数据（GET /api/jobs，crud-04 3.4）==========
// target：kind=op → {opId, opVersion, clientId}；kind=workflow → {workflowId, workflowVersion}
// targetName / lastRun 为**计算字段**（join 得出），不落库。
var JOBS = [
  {
    jobId: '20000000000000000000000000000001',
    name: 'daily_cleanup',
    version: 2,
    kind: 'persistent',
    target: { kind: 'op', opId: '10000000000000000000000000000006', opVersion: 3, clientId: 'e5f60718293a4b5c6d7e8f90a1b2c3d4' },
    trigger: { kind: 'schedule', cron: '0 2 * * *' },
    enabled: true,
    workspace: '/path/to/workspace',
    inputs: { endpoint: 'localhost:8080' },
    concurrency: 'skip',
    needsUpdate: true,
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  },
  {
    jobId: '20000000000000000000000000000002',
    name: 'hourly_check',
    version: 1,
    kind: 'persistent',
    target: { kind: 'workflow', workflowId: 'f0000000000000000000000000000004', workflowVersion: 1 },
    trigger: { kind: 'schedule', cron: '0 * * * *' },
    enabled: true,
    workspace: '/path/to/workspace',
    inputs: { endpoint: 'http://svc:8080' },
    concurrency: 'skip',
    needsUpdate: false,
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  },
  {
    jobId: '20000000000000000000000000000003',
    name: 'manual_deploy',
    version: 2,
    kind: 'virtual',
    target: { kind: 'workflow', workflowId: 'f0000000000000000000000000000001', workflowVersion: 2 },
    trigger: { kind: 'manual' },
    enabled: true,
    workspace: '/path/to/workspace',
    inputs: { target_env: 'prod' },
    concurrency: 'skip',
    needsUpdate: false,
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  },
  {
    jobId: '20000000000000000000000000000004',
    name: 'weekly_report',
    version: 1,
    kind: 'persistent',
    target: { kind: 'op', opId: '10000000000000000000000000000007', opVersion: 3, clientId: 'd4e5f60718293a4b5c6d7e8f90a1b2c3' },
    trigger: { kind: 'schedule', cron: '0 18 * * 5' },
    enabled: false,
    workspace: '/path/to/workspace',
    inputs: { source: 'weekly_report.csv' },
    concurrency: 'skip',
    needsUpdate: false,
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  },
  {
    jobId: '20000000000000000000000000000005',
    name: 'data_sync',
    version: 3,
    kind: 'persistent',
    target: { kind: 'op', opId: '10000000000000000000000000000007', opVersion: 3, clientId: 'd4e5f60718293a4b5c6d7e8f90a1b2c3' },
    trigger: { kind: 'schedule', cron: '0 */6 * * *' },
    enabled: true,
    workspace: '/path/to/workspace',
    inputs: { source: 's3://bucket/data' },
    concurrency: 'queue',
    needsUpdate: false,
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  }
];

var JOB_BY_ID = {};
var JOB_BY_NAME = {};
JOBS.forEach(function (j) { JOB_BY_ID[j.jobId] = j; JOB_BY_NAME[j.name] = j; });

// ========== 运行历史数据（GET /api/runs，crud-05 3.5）==========
// JobRun：name = 运行名称快照；target 为快照（kind=op → opId/opVersion/name；kind=workflow → workflowId/workflowVersion/name）
// steps：扁平 StepRecord[]（同一步多次执行 = 多条记录，用 activationSeq / retrySeq 区分）
var RUNS = [
  {
    runId: 'run-001',
    name: 'check_tests',
    jobId: 'job-check-tests',
    jobKind: 'virtual',
    jobVersion: null,   // virtual Run 无 Job 修订号
    triggeredBy: 'single_op',
    target: { kind: 'op', opId: '10000000000000000000000000000001', opVersion: 2, name: 'check_tests' },
    inputs: { test_cmd: 'pytest' },
    workspace: '/path/ws-001',
    status: 'success',
    terminatedBy: null,
    timeoutStepId: null,
    timeoutOpName: null,
    steps: [
      {
        recordId: 'step-001a', stepId: '102030405060708090a0b0c0d0e0f001',
        activationSeq: 1, retrySeq: 1,
        opId: '10000000000000000000000000000001', opVersion: 2, opName: 'check_tests',
        clientId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        status: 'failed', inputs: { test_cmd: 'pytest' },
        bodySnapshot: '在当前工作区运行测试，并输出结果 JSON',
        outputs: null, rawOutput: '', exitCode: 1, error: 'Connection timeout',
        timeoutMs: 300000, timedOut: false,
        startedAtMs: 1728105683000, finishedAtMs: 1728105688200, durationMs: 5200
      },
      {
        recordId: 'step-001b', stepId: '102030405060708090a0b0c0d0e0f001',
        activationSeq: 1, retrySeq: 2,
        opId: '10000000000000000000000000000001', opVersion: 2, opName: 'check_tests',
        clientId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        status: 'success', inputs: { test_cmd: 'pytest' },
        bodySnapshot: '在当前工作区运行测试，并输出结果 JSON',
        outputs: { passed: 'true', count: '42' }, rawOutput: '42 tests passed', exitCode: 0, error: null,
        timeoutMs: 300000, timedOut: false,
        startedAtMs: 1728105690700, finishedAtMs: 1728105695300, durationMs: 4600
      }
    ],
    retryFromRunId: null,
    retryFromStepId: null,
    startedAtMs: 1728105683000,
    finishedAtMs: 1728105695300,
    durationMs: 12300,
    createdAtMs: '1728105682000',
    updatedAtMs: '1728105695300'
  },
  {
    runId: 'run-002',
    name: 'deploy_workflow',
    jobId: 'job-deploy',
    jobKind: 'virtual',
    jobVersion: null,   // virtual Run 无 Job 修订号
    triggeredBy: 'manual',
    target: { kind: 'workflow', workflowId: 'f0000000000000000000000000000001', workflowVersion: 2, name: 'deploy_workflow' },
    inputs: { target_env: 'prod' },
    workspace: '/path/ws-002',
    status: 'failed',
    terminatedBy: 'error',
    timeoutStepId: null,
    timeoutOpName: null,
    steps: [
      {
        recordId: 'step-002', stepId: '1b2c3d4e5f60718293a4b5c6d7e8f9a1', activationSeq: 1, retrySeq: 1,
        opId: '10000000000000000000000000000001', opVersion: 2, opName: 'check_tests', clientId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        status: 'success', inputs: { test_cmd: 'pytest' }, bodySnapshot: '在当前工作区运行测试，并输出结果 JSON',
        outputs: { passed: 'true' }, rawOutput: '10 tests passed', exitCode: 0, error: null,
        timeoutMs: 300000, timedOut: false, startedAtMs: 1728104710000, finishedAtMs: 1728104720200, durationMs: 10200
      },
      {
        recordId: 'step-003', stepId: '3d4e5f60718293a4b5c6d7e8f9a1b2c3', activationSeq: 1, retrySeq: 1,
        opId: '10000000000000000000000000000002', opVersion: 2, opName: 'review', clientId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        status: 'success', inputs: { test_result: 'pass' }, bodySnapshot: '审查测试结果并给出结论',
        outputs: { approved: 'true' }, rawOutput: 'Approved', exitCode: 0, error: null,
        timeoutMs: 600000, timedOut: false, startedAtMs: 1728104720200, finishedAtMs: 1728104728700, durationMs: 8500
      },
      {
        recordId: 'step-004', stepId: '4e5f60718293a4b5c6d7e8f9a1b2c3d4', activationSeq: 1, retrySeq: 1,
        opId: '10000000000000000000000000000003', opVersion: 2, opName: 'deploy', clientId: 'c3d4e5f60718293a4b5c6d7e8f90a1b2',
        status: 'failed', inputs: { target_env: 'prod' }, bodySnapshot: '将当前工作区部署到指定环境，并返回访问 URL',
        outputs: null, rawOutput: 'Deploy failed: connection refused', exitCode: 1, error: 'connection refused',
        timeoutMs: 120000, timedOut: false, startedAtMs: 1728104728700, finishedAtMs: 1728104730800, durationMs: 2100
      },
      {
        recordId: 'step-005', stepId: '60718293a4b5c6d7e8f9a1b2c3d4e5f6', activationSeq: 1, retrySeq: 1,
        opId: '10000000000000000000000000000005', opVersion: 1, opName: 'notify_fail', clientId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        status: 'success', inputs: { error: 'Deploy failed' }, bodySnapshot: '发送失败告警通知',
        outputs: null, rawOutput: 'Notification sent', exitCode: 0, error: null,
        timeoutMs: 60000, timedOut: false, startedAtMs: 1728104730800, finishedAtMs: 1728104732600, durationMs: 1800
      }
    ],
    retryFromRunId: null,
    retryFromStepId: null,
    startedAtMs: 1728104710000,
    finishedAtMs: 1728104732600,
    durationMs: 22600,
    createdAtMs: '1728104709000',
    updatedAtMs: '1728104732600'
  },
  {
    runId: 'run-003',
    name: 'hourly_check',
    jobId: '20000000000000000000000000000002',
    jobKind: 'persistent',
    jobVersion: 1,
    triggeredBy: 'schedule',
    target: { kind: 'workflow', workflowId: 'f0000000000000000000000000000004', workflowVersion: 1, name: 'hourly_check' },
    inputs: { endpoint: 'http://svc:8080' },
    workspace: '/path/ws-003',
    status: 'failed',
    terminatedBy: 'error',
    timeoutStepId: null,
    timeoutOpName: null,
    steps: [
      {
        recordId: 'step-006', stepId: '0a1b2c3d4e5f60718293a4b5c6d7e8fa', activationSeq: 1, retrySeq: 1,
        opId: '10000000000000000000000000000008', opVersion: 1, opName: 'health_check', clientId: 'd4e5f60718293a4b5c6d7e8f90a1b2c3',
        status: 'failed', inputs: { endpoint: 'http://svc:8080' }, bodySnapshot: '#!/usr/bin/env bash\ncurl -sf "$endpoint/health"',
        outputs: { error: 'connection refused' }, rawOutput: 'Error: Connection refused', exitCode: 1, error: 'connection refused',
        timeoutMs: 180000, timedOut: false, startedAtMs: 1728104400000, finishedAtMs: 1728104408200, durationMs: 8200
      }
    ],
    retryFromRunId: null,
    retryFromStepId: null,
    startedAtMs: 1728104400000,
    finishedAtMs: 1728104408200,
    durationMs: 8200,
    createdAtMs: '1728104399000',
    updatedAtMs: '1728104408200'
  },
  {
    runId: 'run-004',
    name: 'review',
    jobId: 'job-review',
    jobKind: 'virtual',
    jobVersion: null,   // virtual Run 无 Job 修订号
    triggeredBy: 'single_op',
    target: { kind: 'op', opId: '10000000000000000000000000000002', opVersion: 2, name: 'review' },
    inputs: { test_result: 'pass' },
    workspace: '/path/ws-001',
    status: 'success',
    terminatedBy: null,
    timeoutStepId: null,
    timeoutOpName: null,
    steps: [
      {
        recordId: 'step-007', stepId: '102030405060708090a0b0c0d0e0f005', activationSeq: 1, retrySeq: 1,
        opId: '10000000000000000000000000000002', opVersion: 2, opName: 'review', clientId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        status: 'success', inputs: { test_result: 'pass' }, bodySnapshot: '审查测试结果并给出结论',
        outputs: { approved: 'true' }, rawOutput: 'Approved', exitCode: 0, error: null,
        timeoutMs: 600000, timedOut: false, startedAtMs: 1728103800000, finishedAtMs: 1728103806100, durationMs: 6100
      }
    ],
    retryFromRunId: null,
    retryFromStepId: null,
    startedAtMs: 1728103800000,
    finishedAtMs: 1728103806100,
    durationMs: 6100,
    createdAtMs: '1728103799000',
    updatedAtMs: '1728103806100'
  },
  {
    runId: 'run-005',
    name: 'notify',
    jobId: 'job-notify',
    jobKind: 'persistent',
    jobVersion: 2,
    triggeredBy: 'retry',
    target: { kind: 'op', opId: '10000000000000000000000000000004', opVersion: 1, name: 'notify' },
    inputs: { message: '告警' },
    workspace: '/path/ws-004',
    status: 'timeout',
    terminatedBy: 'timeout',
    timeoutStepId: '102030405060708090a0b0c0d0e0f006',
    timeoutOpName: 'notify',
    steps: [
      {
        recordId: 'step-008', stepId: '102030405060708090a0b0c0d0e0f006', activationSeq: 1, retrySeq: 1,
        opId: '10000000000000000000000000000004', opVersion: 1, opName: 'notify', clientId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        status: 'timeout', inputs: { message: '告警' }, bodySnapshot: '发送通知消息',
        outputs: null, rawOutput: 'Timeout after 300s', exitCode: null, error: 'timeout',
        timeoutMs: 300000, timedOut: true, startedAtMs: 1728102900000, finishedAtMs: 1728103200000, durationMs: 300000
      }
    ],
    retryFromRunId: null,
    retryFromStepId: null,
    startedAtMs: 1728102900000,
    finishedAtMs: 1728103200000,
    durationMs: 300000,
    createdAtMs: '1728102899000',
    updatedAtMs: '1728103200000'
  },
  {
    runId: 'run-006',
    name: 'daily_cleanup',
    jobId: '20000000000000000000000000000001',
    jobKind: 'persistent',
    jobVersion: 2,
    triggeredBy: 'schedule',
    target: { kind: 'op', opId: '10000000000000000000000000000006', opVersion: 3, name: 'clean_logs' },
    inputs: { endpoint: 'localhost:8080' },
    workspace: '/path/ws-005',
    status: 'success',
    terminatedBy: null,
    timeoutStepId: null,
    timeoutOpName: null,
    steps: [
      {
        recordId: 'step-009', stepId: '102030405060708090a0b0c0d0e0f007', activationSeq: 1, retrySeq: 1,
        opId: '10000000000000000000000000000006', opVersion: 3, opName: 'clean_logs', clientId: 'e5f60718293a4b5c6d7e8f90a1b2c3d4',
        status: 'success', inputs: { endpoint: 'localhost:8080' }, bodySnapshot: 'Get-ChildItem -Path $env:WORKSPACE ...',
        outputs: null, rawOutput: 'Logs cleaned', exitCode: 0, error: null,
        timeoutMs: 120000, timedOut: false, startedAtMs: 1728019200000, finishedAtMs: 1728019203200, durationMs: 3200
      }
    ],
    retryFromRunId: null,
    retryFromStepId: null,
    startedAtMs: 1728019200000,
    finishedAtMs: 1728019203200,
    durationMs: 3200,
    createdAtMs: '1728019199000',
    updatedAtMs: '1728019203200'
  },
  {
    runId: 'run-007',
    name: 'data_sync',
    jobId: '20000000000000000000000000000005',
    jobKind: 'persistent',
    jobVersion: 3,
    triggeredBy: 'schedule',
    target: { kind: 'op', opId: '10000000000000000000000000000007', opVersion: 3, name: 'process_data' },
    inputs: { source: 's3://bucket/data' },
    workspace: '/path/ws-006',
    status: 'success',
    terminatedBy: null,
    timeoutStepId: null,
    timeoutOpName: null,
    steps: [
      {
        recordId: 'step-010', stepId: '102030405060708090a0b0c0d0e0f008', activationSeq: 1, retrySeq: 1,
        opId: '10000000000000000000000000000007', opVersion: 3, opName: 'process_data', clientId: 'd4e5f60718293a4b5c6d7e8f90a1b2c3',
        status: 'success', inputs: { source: 's3://bucket/data' }, bodySnapshot: 'import json\n# 处理数据源并输出结果',
        outputs: { count: '1024' }, rawOutput: '1024 records processed', exitCode: 0, error: null,
        timeoutMs: 300000, timedOut: false, startedAtMs: 1728106800000, finishedAtMs: 1728106812400, durationMs: 12400
      }
    ],
    retryFromRunId: null,
    retryFromStepId: null,
    startedAtMs: 1728106800000,
    finishedAtMs: 1728106812400,
    durationMs: 12400,
    createdAtMs: '1728106799000',
    updatedAtMs: '1728106812400'
  },
  {
    runId: 'run-008',
    name: 'hourly_check',
    jobId: '20000000000000000000000000000002',
    jobKind: 'persistent',
    jobVersion: 1,
    triggeredBy: 'manual',
    target: { kind: 'workflow', workflowId: 'f0000000000000000000000000000004', workflowVersion: 1, name: 'hourly_check' },
    inputs: { endpoint: 'http://svc:8080' },
    workspace: '/path/ws-003',
    status: 'success',
    terminatedBy: null,
    timeoutStepId: null,
    timeoutOpName: null,
    steps: [
      {
        recordId: 'step-011', stepId: '0a1b2c3d4e5f60718293a4b5c6d7e8fa', activationSeq: 1, retrySeq: 1,
        opId: '10000000000000000000000000000008', opVersion: 1, opName: 'health_check', clientId: 'd4e5f60718293a4b5c6d7e8f90a1b2c3',
        status: 'success', inputs: { endpoint: 'http://svc:8080' }, bodySnapshot: '#!/usr/bin/env bash\ncurl -sf "$endpoint/health"',
        outputs: { healthy: 'true' }, rawOutput: 'Service is healthy', exitCode: 0, error: null,
        timeoutMs: 180000, timedOut: false, startedAtMs: 1728107400000, finishedAtMs: 1728107405300, durationMs: 5300
      }
    ],
    retryFromRunId: null,
    retryFromStepId: null,
    startedAtMs: 1728107400000,
    finishedAtMs: 1728107405300,
    durationMs: 5300,
    createdAtMs: '1728107399000',
    updatedAtMs: '1728107405300'
  }
];

var RUN_BY_ID = {};
RUNS.forEach(function (r) { RUN_BY_ID[r.runId] = r; });

// ---------- 计算字段（对应后端 join / 聚合，Mock 侧同样不落库）----------

/** Job 列表的 targetName：join OP / Workflow 名称（对应 crud-04 targetName） */
function targetNameOf(job) {
  if (!job || !job.target) return '';
  if (job.target.kind === 'op') {
    var op = OP_BY_ID[job.target.opId];
    return op ? op.name : '(已删除)';
  }
  var wf = WORKFLOW_BY_ID[job.target.workflowId];
  return wf ? wf.name : '(已删除)';
}

/** Job 列表的 lastRun（对应 crud-04 3.4.11 last-run）：由 RUNS 取最新一条，**返回完整 Run**（供 can-retry 判定） */
function lastRunOfJob(jobId) {
  var mine = RUNS.filter(function (r) { return r.jobId === jobId; });
  if (!mine.length) return null;
  mine.sort(function (a, b) { return Number(a.startedAtMs) - Number(b.startedAtMs); });
  return mine[mine.length - 1];
}

/** 失败的 step（对应界面「失败节点」列的前端聚合；后端无 failedNode 字段） */
function failedStepOf(run) {
  if (!run || !run.steps) return null;
  var fails = run.steps.filter(function (s) { return s.status === 'failed' || s.status === 'timeout'; });
  if (!fails.length) return null;
  return fails[fails.length - 1];
}

/** 同一 step 的多条执行记录（对应 3.5.5），按 (activationSeq, retrySeq) 降序 */
function stepRecordsOf(run, stepId) {
  return (run.steps || []).filter(function (s) { return s.stepId === stepId; })
    .sort(function (a, b) { return (b.activationSeq - a.activationSeq) || (b.retrySeq - a.retrySeq); });
}

/** 取该 step 的最终记录（D3：判断以最后一条为准） */
function lastRecordOf(run, stepId) {
  var list = stepRecordsOf(run, stepId);
  return list.length ? list[0] : null;
}

/* ---------- 重跑 / 重试前提（对应 crud-05 3.5.7 / 3.5.8 / 3.5.9 / 4.8） ---------- */

var TERMINAL_STATUS = { success: 1, failed: 1, timeout: 1, cancelled: 1 };

/** 重跑前提：Run 已结束（终态）且 target 仍存在 */
function canRerunOf(run) {
  if (!run) return { ok: false, reason: 'Run 不存在' };
  if (!TERMINAL_STATUS[run.status]) return { ok: false, reason: 'Run 未结束（waiting / running / terminating）' };
  if (!targetExists(run.target)) return { ok: false, reason: 'TARGET_NOT_FOUND' };
  return { ok: true, reason: null };
}

/** target 是否仍存在（OP / Workflow 未被删除） */
function targetExists(target) {
  if (!target) return false;
  if (target.kind === 'op') return !!OP_BY_ID[target.opId];
  return !!WORKFLOW_BY_ID[target.workflowId];
}

/**
 * 重试前提（can-retry 五条件，cord-05 3.5.9 / 4.8）：
 *  ① target=Workflow
 *  ② Run 已结束（failed / timeout / cancelled）**且存在失败或超时 step**
 *  ③ 版本一致（Run 快照版本 = 当前版本）
 *  ④ Workflow.needsUpdate = false
 *  ⑤ Job.needsUpdate = false（Job 已删 / 不存在 → 视为 false）
 * 返回 { ok, reason }；reason 文案与 3.5.9 reason 枚举一致。
 */
function canRetryOf(run) {
  if (!run) return { ok: false, reason: 'Run 不存在' };
  if (!TERMINAL_STATUS[run.status]) return { ok: false, reason: 'Run 未结束，无法重试。' };
  if (!(run.target && run.target.kind === 'workflow')) return { ok: false, reason: '仅 Workflow 支持重试。' };

  var wf = WORKFLOW_BY_ID[run.target.workflowId];
  if (!wf) return { ok: false, reason: '版本已更新，无法重试。请使用 [重跑]。' };
  if (wf.needsUpdate) return { ok: false, reason: 'Workflow 或 Job 需要更新，无法重试。' };

  var job = run.jobId ? JOB_BY_ID[run.jobId] : null;
  if (job && job.needsUpdate) return { ok: false, reason: 'Workflow 或 Job 需要更新，无法重试。' };

  if (run.target.workflowVersion !== wf.version) return { ok: false, reason: '版本已更新，无法重试。请使用 [重跑]。' };

  var hasFailStep = (run.steps || []).some(function (s) {
    return s.status === 'failed' || s.status === 'timeout';
  });
  if (!hasFailStep) return { ok: false, reason: '不存在失败或超时的 step。' };

  return { ok: true, reason: null };
}

// ========== Settings 数据（GET /api/settings，与 crud-06 3.3 结构体一致）==========
// runDir：当前配置目录（由 CLI 入口 -c 指定；未指定默认 ~/.ai-automation）；
// ~ 仅为输入简写：后端启动时展开为当前用户家目录的绝对路径（Unix /home/<user>；Windows C:\Users\<user>），
// 接口返回的 runDir / db_path / workspace_root 一律为已展开的绝对路径（下面用 Windows 形式示例），前端不再做展开/拼接
var SETTINGS = {
  runDir: 'C:\\Users\\alice\\.ai-automation',
  general: {
    poll_interval_ms: '2000',
    db_path: 'C:\\Users\\alice\\.ai-automation\\data\\data.db',
    workspace_root: 'C:\\Users\\alice\\.ai-automation\\workspaces',
    config_version: '1',
    db_version: '1'
  },
  client: { client_import_max_bytes: '1048576' },
  op: { op_import_max_bytes: '1048576' },
  workflow: { workflow_max_nodes: '200', workflow_auto_layout: 'true' },
  history: {
    job_queue_waiting_max: '20',
    job_queue_running_max: '10',
    history_max_per_job: '10',
    history_max_total: '1000',
    history_max_age_days: '180'
  },
  engine: { max_loop_multiplier: '0', engine_event_retention_days: '1' },
  worker: { worker_pool_size: '', worker_max_concurrency: '' },   // 派生只读，稍后按 job_queue_running_max 计算（见下）
  runner: { runner_poll_interval_ms: '1000', runner_batch_size: '10' },
  scheduler: { scheduler_max_jobs: '100' },
  log: { log_level: 'info', log_max_files: '10' }
};

// Worker 池为派生只读值：**数值派生自同一配置**（job_queue_running_max），但语义与「Task Runner 并发阈值」不同：
//   并发阈值 = 同时 running 的 JobRun 数上限（= job_queue_running_max）
//   池大小   = 常驻 Worker（执行体）数量 = ceil(job_queue_running_max × 1.5)，一个 JobRun 可并行多个 step
(function deriveWorkerFromRunningMax(){
  var runMax = parseInt(SETTINGS.history.job_queue_running_max, 10) || 10;
  var pool = Math.ceil(runMax * 1.5);
  SETTINGS.worker.worker_pool_size = String(pool);
  SETTINGS.worker.worker_max_concurrency = String(pool);
})();

// ========== Mock API 函数（含变更类接口；内存态可变，便于原型演示全流程）==========
var __runSeq = 100;
function __newRunId() { return 'run-' + (++__runSeq); }
function __uid32() {
  var chars = '0123456789abcdef', s = '';
  for (var i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

/** 终止：waiting 步置 cancelled；无在跑 OP 则直接 cancelled */
function __applyTerminate(run) {
  var hasRunningOp = (run.steps || []).some(function (s) { return s.status === 'running'; });
  (run.steps || []).forEach(function (s) {
    if (s.status === 'waiting') s.status = 'cancelled';
  });
  run.status = hasRunningOp ? 'terminating' : 'cancelled';
  run.terminatedBy = 'cancelled';
  run.updatedAtMs = String(Date.now());
  if (!hasRunningOp) {
    run.finishedAtMs = Number(run.updatedAtMs);
    run.durationMs = Number(run.finishedAtMs) - Number(run.startedAtMs);
  }
}

/** 重跑 / 重试：基于原 Run 新建一条（简化：全部 step 置回 waiting） */
function __spawnRun(src, triggeredBy, useLatestVersion) {
  var now = Date.now();
  var newRun = JSON.parse(JSON.stringify(src));
  newRun.runId = __newRunId();
  newRun.triggeredBy = triggeredBy;
  newRun.status = 'waiting';
  newRun.terminatedBy = null;
  newRun.timeoutStepId = null;
  newRun.timeoutOpName = null;
  newRun.retryFromRunId = (triggeredBy === 'retry') ? src.runId : null;
  newRun.retryFromStepId = (triggeredBy === 'retry') ? (failedStepOf(src) || {}).stepId || null : null;
  newRun.startedAtMs = now;
  newRun.finishedAtMs = null;
  newRun.durationMs = null;
  newRun.createdAtMs = String(now);
  newRun.updatedAtMs = String(now);
  if (useLatestVersion && newRun.target && newRun.target.kind === 'workflow') {
    var wf = WORKFLOW_BY_ID[newRun.target.workflowId];
    if (wf) newRun.target.workflowVersion = wf.version;
  }
  newRun.steps = (src.steps || []).map(function (s) {
    var c = JSON.parse(JSON.stringify(s));
    c.recordId = __uid32();
    c.activationSeq = 1;
    c.retrySeq = 1;
    c.status = 'waiting';
    c.exitCode = null;
    c.error = null;
    c.outputs = null;
    c.rawOutput = '';
    c.timedOut = false;
    c.startedAtMs = null;
    c.finishedAtMs = null;
    c.durationMs = null;
    return c;
  });
  RUNS.unshift(newRun);
  RUN_BY_ID[newRun.runId] = newRun;
  return newRun;
}

function mockFetch(path, options) {
  var method = (options && options.method) ? String(options.method).toUpperCase() : 'GET';
  var body = options && options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : {};
  var parts = path.split('/').filter(Boolean);   // ['api','runs','run-001','terminate']
  void body;

  return new Promise(function (resolve) {
    setTimeout(function () {
      /* ---------- 系统 / 配置 ---------- */
      if (path === '/api/system/status') return resolve({ status: 'running', uptimeMs: '3600000', activeRuns: RUNS.filter(function (r) { return r.status === 'running' || r.status === 'terminating'; }).length });
      if (path === '/api/system/version') return resolve({ version: '0.1.0' });
      if (path === '/api/settings') {
        if (method === 'PUT') {
          // X4 修复：先校验后写入（对齐 crud-06 3.4「校验通过后更新内存」）——
          // 校验针对**提交值**（只读项 / 未知 key / 枚举 / 布尔 / 数值上限），任一命中即 400 且**不改内存**；
          // 全部通过才写入并派生 Worker 池（只读派生项不参与写入）。
          var READONLY = ['db_path', 'workspace_root', 'config_version', 'db_version'];
          var LIMITS = {
            'general.poll_interval_ms': 60000,
            'client.client_import_max_bytes': 104857600,
            'op.op_import_max_bytes': 104857600,
            'workflow.workflow_max_nodes': 1000,
            'history.job_queue_waiting_max': 1000,
            'history.job_queue_running_max': 10,
            'history.history_max_per_job': 1000,
            'history.history_max_total': 100000,
            'history.history_max_age_days': 180,
            'engine.max_loop_multiplier': 10000,
            'engine.engine_event_retention_days': 30,
            'runner.runner_poll_interval_ms': 60000,
            'runner.runner_batch_size': 100,
            'scheduler.scheduler_max_jobs': 1000,
            'log.log_max_files': 100
          };
          var BOOL_KEYS = ['workflow.workflow_auto_layout'];
          var ENUM_KEYS = { 'log.log_level': ['debug', 'info', 'warn', 'error'] };
          var upd = body || {};
          var errs = [];
          Object.keys(upd).forEach(function (g) {
            if (!SETTINGS[g]) { errs.push('未知配置分组: ' + g); return; }
            Object.keys(upd[g] || {}).forEach(function (k) {
              var gk = g + '.' + k;
              var val = String(upd[g][k]);
              if (READONLY.indexOf(k) >= 0) { errs.push('只读配置不可修改: ' + gk); return; }
              if (!(k in SETTINGS[g])) { errs.push('未知配置项: ' + gk); return; }
              if (ENUM_KEYS[gk] && ENUM_KEYS[gk].indexOf(val) < 0) { errs.push(gk + ' 取值非法: ' + val); return; }
              if (BOOL_KEYS.indexOf(gk) >= 0 && val !== 'true' && val !== 'false') { errs.push(gk + ' 须为 true/false'); return; }
              if (LIMITS[gk]) {
                var v = parseInt(val, 10);
                if (isNaN(v)) { errs.push(gk + ' 须为整数: ' + val); return; }
                if (!(gk === 'engine.max_loop_multiplier' && v === 0) && v > LIMITS[gk]) {
                  errs.push(gk + '=' + v + '（上限 ' + LIMITS[gk] + '）');
                }
              }
            });
          });
          if (errs.length) return resolve({ error: 'VALIDATION_ERROR', message: errs.join('；') });
          Object.keys(upd).forEach(function (g) {
            Object.keys(upd[g] || {}).forEach(function (k) {
              if (READONLY.indexOf(k) < 0) SETTINGS[g][k] = String(upd[g][k]);
            });
          });
          var runMax = parseInt(SETTINGS.history.job_queue_running_max, 10) || 10;
          SETTINGS.worker.worker_pool_size = String(Math.ceil(runMax * 1.5));
          SETTINGS.worker.worker_max_concurrency = SETTINGS.worker.worker_pool_size;
        }
        return resolve(SETTINGS);
      }
      if (path === '/api/settings/reset') return resolve(SETTINGS);
      if (path === '/api/workspaces') {
        // crud-06 3.6：job_runs.workspace 去重，按最近使用（max(created_at_ms)）倒序，默认 limit=10
        var wsLast = {};
        RUNS.forEach(function (r) {
          var t = Number(r.createdAtMs || r.startedAtMs || 0);
          if (r.workspace && !(wsLast[r.workspace] >= t)) wsLast[r.workspace] = t;
        });
        var wsItems = Object.keys(wsLast).sort(function (a, b) { return wsLast[b] - wsLast[a]; }).slice(0, 10);
        return resolve({ items: wsItems });
      }

      /* ---------- 列表 ---------- */
      if (path === '/api/clients') {
        if (method === 'POST') {
          // X7：同名 409（crud-01 3.1.3）；id / 时间戳由后端生成（请求携带则忽略）
          if (body && CLIENT_BY_NAME[body.name]) return resolve({ error: 'CLIENT_NAME_EXISTS', message: 'Client 名称已存在: ' + body.name });
          var nb = Object.assign({}, body); delete nb.clientId; delete nb.createdAtMs; delete nb.updatedAtMs;
          var nc = Object.assign({ clientId: __uid32(), createdAtMs: String(Date.now()), updatedAtMs: String(Date.now()) }, nb);
          CLIENTS.push(nc); CLIENT_BY_ID[nc.clientId] = nc; CLIENT_BY_NAME[nc.name] = nc;
          return resolve(nc);
        }
        return resolve(CLIENTS);
      }
      if (path === '/api/ops') {
        if (method === 'POST') {
          if (body && OP_BY_NAME[body.name]) return resolve({ error: 'OP_NAME_EXISTS', message: 'OP 名称已存在: ' + body.name });
          var nb = Object.assign({}, body); delete nb.opId; delete nb.version; delete nb.createdAtMs; delete nb.updatedAtMs;
          var no = Object.assign({ opId: __uid32(), version: 1, timeoutMs: 300000, interactive: false, inputs: [], outputs: [], createdAtMs: String(Date.now()), updatedAtMs: String(Date.now()) }, nb);
          OPS.push(no); OP_BY_ID[no.opId] = no; OP_BY_NAME[no.name] = no;
          return resolve(no);
        }
        return resolve(OPS);
      }
      if (path === '/api/workflows') {
        if (method === 'POST') {
          if (body && WORKFLOW_BY_NAME[body.name]) return resolve({ error: 'WORKFLOW_NAME_EXISTS', message: 'Workflow 名称已存在: ' + body.name });
          var nb = Object.assign({}, body); delete nb.workflowId; delete nb.version; delete nb.createdAtMs; delete nb.updatedAtMs;
          var nw = Object.assign({ workflowId: __uid32(), version: 1, nodes: [], edges: [], inputs: [], outputs: [], createdAtMs: String(Date.now()), updatedAtMs: String(Date.now()) }, nb);
          WORKFLOWS.push(nw); WORKFLOW_BY_ID[nw.workflowId] = nw; WORKFLOW_BY_NAME[nw.name] = nw;
          return resolve(nw);
        }
        return resolve(WORKFLOWS);
      }
      if (path === '/api/jobs') {
        if (method === 'POST') {
          if (body && JOB_BY_NAME[body.name]) return resolve({ error: 'JOB_NAME_EXISTS', message: 'Job 名称已存在: ' + body.name });
          var nb = Object.assign({}, body); delete nb.jobId; delete nb.version; delete nb.createdAtMs; delete nb.updatedAtMs;
          var nj = Object.assign({ jobId: __uid32(), version: 1, kind: 'persistent', target: null, trigger: null, enabled: true, inputs: {}, concurrency: 'skip', needsUpdate: false, createdAtMs: String(Date.now()), updatedAtMs: String(Date.now()) }, nb);
          JOBS.push(nj); JOB_BY_ID[nj.jobId] = nj; JOB_BY_NAME[nj.name] = nj;
          return resolve(nj);
        }
        return resolve(JOBS);
      }
      if (path === '/api/runs') return resolve(RUNS);

      /* ---------- 导入（D7=A：mock 校验重名 409；实际创建默认对象；须先于 ops/workflows/jobs 子资源判断，避免被 {id} 分支拦截） ---------- */
      if (path === '/api/ops/import') {
        var iopName = (body && body.name) || 'imported_op';
        if (OP_BY_NAME[iopName]) return resolve({ error: 'OP_NAME_EXISTS', message: '同名 OP 已存在（导入冲突）: ' + iopName });   // X7：crud-02 3.2.8
        var iop = {
          opId: __uid32(), name: iopName, type: (body && body.type) || 'prompt', version: 1,
          description: '导入的 OP', content: (body && body.content) || '', timeoutMs: 300000,
          interactive: false, inputs: [], outputs: [], createdAtMs: String(Date.now()), updatedAtMs: String(Date.now())
        };
        OPS.push(iop); OP_BY_ID[iop.opId] = iop; OP_BY_NAME[iop.name] = iop;
        return resolve(iop);   // crud-02 3.2.8：返回导入创建的 OP 对象
      }
      if (path === '/api/workflows/import') {
        var iwfName = (body && body.name) || 'imported_workflow';
        if (WORKFLOW_BY_NAME[iwfName]) return resolve({ error: 'WORKFLOW_NAME_EXISTS', message: '同名 Workflow 已存在（导入冲突）: ' + iwfName });   // X7：crud-03 3.3.9
        // 模拟「按 manifest 复用依赖」：以默认骨架（仅 Start + End）创建；依赖复用版本不一致的 warnings 模拟场景略
        var iwfSid = __uid32(), iwfEid = __uid32();
        var iwf = {
          workflowId: __uid32(), name: iwfName, version: 1, description: '导入的 Workflow',
          inputs: [], outputs: [],
          nodes: [
            { nodeId: iwfSid, label: 'node_start', kind: 'start', position: { x: 40, y: 175 } },
            { nodeId: iwfEid, label: 'node_end', kind: 'end', position: { x: 620, y: 175 } }
          ],
          edges: [], createdAtMs: String(Date.now()), updatedAtMs: String(Date.now())
        };
        WORKFLOWS.push(iwf); WORKFLOW_BY_ID[iwf.workflowId] = iwf; WORKFLOW_BY_NAME[iwf.name] = iwf;
        return resolve(iwf);   // crud-03 3.3.9：返回导入创建的 Workflow 对象
      }
      if (path === '/api/jobs/import') {
        var ijobName = (body && body.name) || 'imported_job';
        if (JOB_BY_NAME[ijobName]) return resolve({ error: 'JOB_NAME_EXISTS', message: '同名 Job 已存在（导入冲突）: ' + ijobName });   // X7：crud-04 3.4.10
        // 模拟「按 manifest 复用依赖」：target 指向现有首个 Workflow（复用，不自动创建）；Job.version 重置为 1（crud-04 3.4.10）
        var ijobWf = WORKFLOWS[0];
        var ijob = {
          jobId: __uid32(), name: ijobName, version: 1, kind: 'persistent', description: '导入的 Job',
          target: { kind: 'workflow', workflowId: ijobWf ? ijobWf.workflowId : '', workflowVersion: ijobWf ? ijobWf.version : 1 },
          trigger: { kind: 'manual' }, enabled: true, workspace: '/path/to/workspace',
          inputs: {}, concurrency: 'skip', needsUpdate: false,
          createdAtMs: String(Date.now()), updatedAtMs: String(Date.now())
        };
        JOBS.push(ijob); JOB_BY_ID[ijob.jobId] = ijob; JOB_BY_NAME[ijob.name] = ijob;
        return resolve(ijob);   // crud-04 3.4.10：返回导入创建的 Job 对象
      }

      /* ---------- Client 子资源 ---------- */
      if (parts[1] === 'clients' && parts[2]) {
        // crud-01 3.1.8：POST /api/clients/import —— 从 YAML 导入 Client（须先于 {clientId} 判断，parts[2]='import'）
        if (parts[2] === 'import' && method === 'POST') {
          var icYaml = (body && body.yaml) || '';
          var icName = (icYaml.match(/^name:\s*(.+)$/m) || [])[1] || 'imported_client';
          var icType = (icYaml.match(/^type:\s*(.+)$/m) || [])[1] || 'prompt';
          if (CLIENT_BY_NAME[icName]) return resolve({ error: 'CLIENT_NAME_EXISTS', message: '同名 Client 已存在（导入冲突）: ' + icName });   // crud-01 3.1.8
          var ic = {
            clientId: __uid32(), name: icName, type: icType, description: '',
            command: null, argsTemplate: null, inputMode: null, outputMode: null, outputJsonPath: null,
            exitCodeSuccess: null, binaryPath: null,
            createdAtMs: String(Date.now()), updatedAtMs: String(Date.now())
          };
          CLIENTS.push(ic); CLIENT_BY_ID[ic.clientId] = ic; CLIENT_BY_NAME[ic.name] = ic;
          return resolve(ic);   // crud-01 3.1.8：返回导入创建的 Client 对象
        }
        var cid = parts[2], cl = CLIENT_BY_ID[cid];
        if (parts[3] === 'test') return resolve({ success: true, exitCode: 0, rawOutput: 'ok', error: null, durationMs: 23 });
        if (parts[3] === 'export' && cl) {
          // crud-01 3.1.7：导出 Client 为 YAML（clientId/createdAtMs/updatedAtMs 不入 YAML）
          var cy = 'name: ' + cl.name + '\ntype: ' + cl.type + '\n';
          if (cl.description) cy += 'description: ' + cl.description + '\n';
          if (cl.type === 'prompt') {
            if (cl.command) cy += 'command: ' + cl.command + '\n';
            if (cl.argsTemplate) cy += 'argsTemplate: ' + JSON.stringify(cl.argsTemplate) + '\n';
            if (cl.inputMode) cy += 'inputMode: ' + cl.inputMode + '\n';
          } else if (cl.binaryPath) {
            cy += 'binaryPath: ' + cl.binaryPath + '\n';
          }
          if (cl.outputMode) cy += 'outputMode: ' + cl.outputMode + '\n';
          if (cl.outputJsonPath) cy += 'outputJsonPath: ' + cl.outputJsonPath + '\n';
          if (cl.exitCodeSuccess) cy += 'exitCodeSuccess: ' + JSON.stringify(cl.exitCodeSuccess) + '\n';
          return resolve({ yaml: cy });
        }
        if (method === 'DELETE') {
          // crud-01 3.1.5：被 Job（target.kind=op 的 target.clientId）引用 → 409
          var cRefJob = JOBS.find(function (j) { return j.target && j.target.clientId === cid; });
          if (cRefJob) return resolve({ error: 'CLIENT_REFERENCED', message: 'Client 正被 Job「' + cRefJob.name + '」引用，删除被拒绝' });
          var ci = CLIENTS.findIndex(function (c) { return c.clientId === cid; });
          if (ci >= 0) { delete CLIENT_BY_NAME[CLIENTS[ci].name]; CLIENTS.splice(ci, 1); delete CLIENT_BY_ID[cid]; }
          return resolve({ ok: true });
        }
        if (method === 'PUT' && cl) { Object.assign(cl, body, { clientId: cid, updatedAtMs: String(Date.now()) }); return resolve(cl); }
        return resolve(cl || null);
      }

      /* ---------- OP 子资源 ---------- */
      if (parts[1] === 'ops' && parts[2]) {
        var op = OP_BY_ID[parts[2]];
        if (parts[3] === 'execute') return resolve({ runId: __newRunId() });
        if (parts[3] === 'export') return resolve({ yaml: 'name: ' + (op ? op.name : '') + '\ntype: ' + (op ? op.type : '') + '\n' });
        if (method === 'PUT' && op) {
          // crud-02 3.2.4：请求体 {op, bumpVersion}；bumpVersion=true → version+1，false → 覆盖当前版本
          var opUpd = Object.assign({}, body.op || {});
          if (opUpd.name && opUpd.name !== op.name && OP_BY_NAME[opUpd.name]) return resolve({ error: 'OP_NAME_EXISTS', message: 'OP 名称已存在: ' + opUpd.name });
          delete opUpd.opId; delete opUpd.version; delete opUpd.createdAtMs; delete opUpd.updatedAtMs;
          delete OP_BY_NAME[op.name];
          Object.assign(op, opUpd, { updatedAtMs: String(Date.now()) });
          if (body.bumpVersion === true) op.version = (parseInt(op.version, 10) || 1) + 1;
          OP_BY_NAME[op.name] = op;
          return resolve(op);
        }
        if (method === 'DELETE' && op) {
          // crud-02 3.2.5：被 Workflow 节点或 Job.target(kind=op) 引用 → 409
          var opRefWf = WORKFLOWS.find(function (w) { return (w.nodes || []).some(function (n) { return n.opId === op.opId; }); });
          var opRefJob = JOBS.find(function (j) { return j.target && j.target.kind === 'op' && j.target.opId === op.opId; });
          if (opRefWf || opRefJob) {
            var opRefBy = opRefWf ? 'Workflow「' + opRefWf.name + '」' : 'Job「' + opRefJob.name + '」';
            return resolve({ error: 'OP_REFERENCED', message: 'OP 正被 ' + opRefBy + ' 引用，删除被拒绝' });
          }
          var oi = OPS.findIndex(function (x) { return x.opId === parts[2]; });
          if (oi >= 0) OPS.splice(oi, 1);
          delete OP_BY_ID[parts[2]]; delete OP_BY_NAME[op.name];
          return resolve({ ok: true });
        }
        return resolve(op || null);
      }

      /* ---------- Workflow 子资源 ---------- */
      if (parts[1] === 'workflows' && parts[2]) {
        var wf = WORKFLOW_BY_ID[parts[2]];
        if (parts[3] === 'execute') return resolve({ runId: __newRunId() });
        if (parts[3] === 'validate') return resolve({ valid: true, errors: [] });
        if (parts[3] === 'needs-update') {
          var outs = [];
          if (wf) (wf.nodes || []).forEach(function (n) {
            if (n.kind !== 'op') return;
            var def = OP_BY_ID[n.opId];
            if (!def || n.opVersion !== def.version) outs.push(n.nodeId);
          });
          return resolve({ needsUpdate: outs.length > 0, outdatedNodes: outs });
        }
        if (parts[3] === 'outdated-nodes' || (parts[3] === 'needs-update' && parts[4] === 'nodes')) return resolve({ outdatedNodes: [] });
        if (parts[3] === 'export') return resolve({ zip: 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==' });
        if (method === 'PUT' && wf) {
          // crud-03 3.3.4：请求体 {workflow, bumpVersion}
          var wfUpd = Object.assign({}, body.workflow || {});
          if (wfUpd.name && wfUpd.name !== wf.name && WORKFLOW_BY_NAME[wfUpd.name]) return resolve({ error: 'WORKFLOW_NAME_EXISTS', message: 'Workflow 名称已存在: ' + wfUpd.name });
          delete wfUpd.workflowId; delete wfUpd.version; delete wfUpd.createdAtMs; delete wfUpd.updatedAtMs;
          delete WORKFLOW_BY_NAME[wf.name];
          Object.assign(wf, wfUpd, { updatedAtMs: String(Date.now()) });
          if (body.bumpVersion === true) wf.version = (parseInt(wf.version, 10) || 1) + 1;
          WORKFLOW_BY_NAME[wf.name] = wf;
          return resolve(wf);
        }
        if (method === 'DELETE' && wf) {
          // crud-03 3.3.5：被 Job 引用 → 409
          var wfRefJob = JOBS.find(function (j) { return j.target && j.target.kind === 'workflow' && j.target.workflowId === wf.workflowId; });
          if (wfRefJob) return resolve({ error: 'WORKFLOW_REFERENCED', message: 'Workflow 正被 Job「' + wfRefJob.name + '」引用，删除被拒绝' });
          var wi = WORKFLOWS.findIndex(function (x) { return x.workflowId === parts[2]; });
          if (wi >= 0) WORKFLOWS.splice(wi, 1);
          delete WORKFLOW_BY_ID[parts[2]]; delete WORKFLOW_BY_NAME[wf.name];
          return resolve({ ok: true });
        }
        return resolve(wf || null);
      }

      /* ---------- Job 子资源 ---------- */
      if (parts[1] === 'jobs' && parts[2]) {
        var job = JOB_BY_ID[parts[2]];
        if (parts[3] === 'run') return resolve({ runId: __newRunId() });
        if (parts[3] === 'enable' && job) { job.enabled = true; job.updatedAtMs = String(Date.now()); return resolve(job); }
        if (parts[3] === 'disable' && job) { job.enabled = false; job.updatedAtMs = String(Date.now()); return resolve(job); }
        if (parts[3] === 'export') return resolve({ zip: 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==' });
        if (parts[3] === 'last-run') return resolve(lastRunOfJob(parts[2]));
        if (method === 'PUT' && job) {
          // crud-04 3.4.4：请求体 {job, bumpVersion}，job 为全量替换
          var jobUpd = Object.assign({}, body.job || {});
          if (jobUpd.name && jobUpd.name !== job.name && JOB_BY_NAME[jobUpd.name]) return resolve({ error: 'JOB_NAME_EXISTS', message: 'Job 名称已存在: ' + jobUpd.name });
          delete jobUpd.jobId; delete jobUpd.version; delete jobUpd.createdAtMs; delete jobUpd.updatedAtMs;
          delete JOB_BY_NAME[job.name];
          Object.assign(job, jobUpd, { updatedAtMs: String(Date.now()) });
          if (body.bumpVersion === true) job.version = (parseInt(job.version, 10) || 1) + 1;
          JOB_BY_NAME[job.name] = job;
          return resolve(job);
        }
        if (method === 'DELETE' && job) {
          // crud-04 3.4.5：有在途实例（waiting/running/terminating）拒绝删除；终止只能在运行历史页操作（D4=B）
          var jobActive = RUNS.some(function (r) { return r.jobId === parts[2] && (r.status === 'waiting' || r.status === 'running' || r.status === 'terminating'); });
          if (jobActive) return resolve({ error: 'JOB_HAS_ACTIVE_RUNS', message: '该 Job 存在在途运行实例（waiting/running/terminating），请到运行历史终止或等待完成后再删除' });
          var ji = JOBS.findIndex(function (x) { return x.jobId === parts[2]; });
          if (ji >= 0) JOBS.splice(ji, 1);
          delete JOB_BY_ID[parts[2]]; delete JOB_BY_NAME[job.name];
          return resolve({ ok: true });
        }
        return resolve(job || null);
      }

      /* ---------- Run 子资源 ---------- */
      if (parts[1] === 'runs') {
        if (path === '/api/runs/export') {
          // crud-05 3.5.10：后端按筛选生成两 sheet 的 .xlsx，以 base64 二进制返回；前端解码后写入所选目录
          var ef = body.filters || {};
          var EF_ENUMS = {
            status: ['waiting', 'running', 'terminating', 'success', 'failed', 'cancelled', 'timeout'],
            triggeredBy: ['manual', 'schedule', 'single_op', 'single_workflow', 'retry'],
            targetKind: ['op', 'workflow'],
            jobKind: ['persistent', 'virtual'],
            timeRange: ['last_1h', 'last_24h', 'last_2d', 'last_3d', 'last_5d', 'last_7d', 'last_30d']
          };
          var EF_RANGE_MS = { last_1h: 3600000, last_24h: 86400000, last_2d: 172800000, last_3d: 259200000, last_5d: 432000000, last_7d: 604800000, last_30d: 2592000000 };
          var eErrs = [];
          Object.keys(EF_ENUMS).forEach(function (k) {
            if (ef[k] != null && EF_ENUMS[k].indexOf(ef[k]) < 0) eErrs.push('filters.' + k + ' 取值非法: ' + ef[k]);
          });
          if (ef.version != null && !/^\d+$/.test(String(ef.version))) eErrs.push('filters.version 须为数字: ' + ef.version);
          if (eErrs.length) return resolve({ error: 'VALIDATION_ERROR', message: eErrs.join('；') });
          var efNow = Date.now();
          var efRuns = RUNS.filter(function (r) {
            if (ef.status && r.status !== ef.status) return false;
            if (ef.targetKind && (!r.target || r.target.kind !== ef.targetKind)) return false;
            if (ef.jobKind && r.jobKind !== ef.jobKind) return false;
            if (ef.triggeredBy && r.triggeredBy !== ef.triggeredBy) return false;
            if (ef.workspace && r.workspace !== ef.workspace) return false;
            if (ef.version && String(r.jobVersion) !== String(ef.version)) return false;
            if (ef.timeRange) {
              var efT = Number(r.startedAtMs || r.createdAtMs || 0);
              if (!efT) return false;
              if ((efNow - efT) > EF_RANGE_MS[ef.timeRange]) return false;
            }
            return true;
          });
          // 后端生成工作簿（原型在浏览器内借 CDN 的 SheetJS 扮演后端生成）
          var historyHeader = ['runId', 'name', 'jobId', 'jobKind', 'jobVersion', 'triggeredBy', 'workspace', 'status', 'terminatedBy', 'startedAtMs', 'finishedAtMs', 'durationMs'];
          var detailHeader = ['recordId', 'jobId', 'stepId', 'activationSeq', 'retrySeq', 'opId', 'opVersion', 'opName', 'clientId', 'status', 'exitCode', 'inputs', 'bodySnapshot', 'outputs', 'rawOutput', 'timedOut', 'startedAtMs', 'finishedAtMs', 'durationMs'];
          var historyRows = [historyHeader];
          var detailRows = [detailHeader];
          efRuns.forEach(function (r) {
            historyRows.push([
              r.runId, r.name, r.jobId, r.jobKind, r.jobVersion == null ? '' : r.jobVersion,
              r.triggeredBy, r.workspace, r.status, r.terminatedBy || '',
              r.startedAtMs, r.finishedAtMs, r.durationMs
            ]);
            (r.steps || []).forEach(function (s) {
              detailRows.push([
                s.recordId, r.jobId, s.stepId, s.activationSeq, s.retrySeq, s.opId, s.opVersion, s.opName, s.clientId,
                s.status, s.exitCode, JSON.stringify(s.inputs == null ? null : s.inputs), s.bodySnapshot || '',
                JSON.stringify(s.outputs == null ? null : s.outputs), s.rawOutput || '', s.timedOut,
                s.startedAtMs, s.finishedAtMs, s.durationMs
              ]);
            });
          });
          var efWb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(efWb, XLSX.utils.aoa_to_sheet(historyRows), '运行历史');
          XLSX.utils.book_append_sheet(efWb, XLSX.utils.aoa_to_sheet(detailRows), '运行明细');
          var efB64 = XLSX.write(efWb, { bookType: 'xlsx', type: 'base64' });
          return resolve({ xlsx: efB64, count: efRuns.length });   // D3：count = 本次导出运行历史条数（Sheet1 行数），由后端计算返回
        }
        var run = RUN_BY_ID[parts[2]];
        if (!run) return resolve(null);
        if (parts[3] === 'can-retry') {
          var cr = canRetryOf(run);
          return resolve({ canRetry: cr.ok, reason: cr.reason });
        }
        if (parts[3] === 'terminate') { __applyTerminate(run); return resolve(run); }
        if (parts[3] === 'rerun') return resolve({ runId: __spawnRun(run, 'manual', true).runId });
        if (parts[3] === 'retry') return resolve({ runId: __spawnRun(run, 'retry', false).runId });
        if (parts[3] === 'steps' && parts[4]) return resolve(stepRecordsOf(run, parts[4]));
        if (parts[3] === 'steps') return resolve(run.steps || []);
        if (parts[3] === 'status') return resolve({ status: run.status, updatedAtMs: run.updatedAtMs });
        return resolve(run);
      }

      /* ---------- 导入（已前移至列表之后；此处仅兜底返回） ---------- */

      resolve(null);
    }, 100);
  });
}
