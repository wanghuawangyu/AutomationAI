/**
 * 全局 Mock 数据
 * 数据包含关系：Client → OP → Workflow → Job → RunHistory
 * 被引用的数据只写一份，引用方通过名称/版本关联
 */

// ========== Client 数据 ==========
var CLIENTS = {
  'Claude Code': {
    clientId: 'client-claude',
    type: 'prompt',
    format: 'json',
    description: 'Claude Code CLI',
    binaryPath: 'claude',
    paramTemplate: '--print --output-format json --model sonnet',
    inputMode: 'stdin'
  },
  'Codex CLI': {
    clientId: 'client-codex',
    type: 'prompt',
    format: 'text',
    description: 'OpenAI Codex CLI',
    binaryPath: 'codex',
    paramTemplate: '--prompt --output text',
    inputMode: 'stdin'
  },
  '本地 Bash': {
    clientId: 'client-bash',
    type: 'bash',
    format: 'text',
    description: '本地 Bash Shell',
    binaryPath: '/usr/bin/bash'
  },
  '本地 Python': {
    clientId: 'client-python',
    type: 'python',
    format: 'json',
    description: '本地 Python',
    binaryPath: '/usr/bin/python3'
  },
  '本地 PowerShell': {
    clientId: 'client-powershell',
    type: 'powershell',
    format: 'text',
    description: '本地 PowerShell',
    binaryPath: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'
  }
};

// ========== OP 数据 ==========
var OPS = {
  'check_tests': {
    opId: 'op-check-tests',
    name: 'check_tests',
    version: 2,
    type: 'prompt',
    timeout: 300,
    description: '运行测试并报告结果',
    client: 'Claude Code',
    inputs: [
      { name: 'test_cmd', type: 'string', required: true, defaultValue: '', description: '测试命令' }
    ],
    outputs: [
      { name: 'passed', type: 'string', description: '测试是否通过' },
      { name: 'count', type: 'string', description: '通过用例数' },
      { name: 'result', type: 'string', description: '测试结果详情' }
    ],
    content: '在当前工作区运行测试，并输出结果 JSON'
  },
  'review': {
    opId: 'op-review',
    name: 'review',
    version: 2,
    type: 'prompt',
    timeout: 600,
    description: '审查测试结果',
    client: 'Claude Code',
    inputs: [
      { name: 'test_result', type: 'string', required: true, defaultValue: '', description: '测试结果' }
    ],
    outputs: [
      { name: 'approved', type: 'string', description: '是否通过审查' }
    ],
    content: '审查测试结果并给出结论'
  },
  'deploy': {
    opId: 'op-deploy',
    name: 'deploy',
    version: 2,
    type: 'prompt',
    timeout: 120,
    description: '部署到目标环境',
    client: 'Claude Code',
    inputs: [
      { name: 'target_env', type: 'string', required: true, defaultValue: '', description: '目标环境' }
    ],
    outputs: [
      { name: 'url', type: 'string', description: '部署后的 URL' }
    ],
    content: '将当前工作区部署到指定环境，并返回访问 URL'
  },
  'notify': {
    opId: 'op-notify',
    name: 'notify',
    version: 1,
    type: 'prompt',
    timeout: 60,
    description: '发送成功通知',
    client: 'Claude Code',
    inputs: [
      { name: 'message', type: 'string', required: true, defaultValue: '', description: '通知内容' }
    ],
    outputs: [],
    content: '发送通知消息'
  },
  'notify_fail': {
    opId: 'op-notify-fail',
    name: 'notify_fail',
    version: 1,
    type: 'prompt',
    timeout: 60,
    description: '发送失败通知',
    client: 'Claude Code',
    inputs: [],
    outputs: [],
    content: '发送失败告警通知'
  },
  'clean_logs': {
    opId: 'op-clean-logs',
    name: 'clean_logs',
    version: 3,
    type: 'powershell',
    timeout: 120,
    description: '清理历史日志',
    client: '本地 PowerShell',
    inputs: [
      { name: 'endpoint', type: 'string', required: true, defaultValue: '', description: '日志服务地址' }
    ],
    outputs: [],
    content: 'Get-ChildItem -Path $env:WORKSPACE -Recurse -Filter *.log | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item'
  },
  'process_data': {
    opId: 'op-process-data',
    name: 'process_data',
    version: 3,
    type: 'python',
    timeout: 300,
    description: '处理数据',
    client: '本地 Python',
    inputs: [
      { name: 'source', type: 'string', required: true, defaultValue: '', description: '数据源' }
    ],
    outputs: [
      { name: 'count', type: 'string', description: '处理条数' }
    ],
    content: 'import json\n# 处理数据源并输出结果'
  },
  'health_check': {
    opId: 'op-health-check',
    name: 'health_check',
    version: 1,
    type: 'bash',
    timeout: 180,
    description: '健康检查',
    client: '本地 Bash',
    inputs: [
      { name: 'endpoint', type: 'string', required: true, defaultValue: '', description: '服务地址' }
    ],
    outputs: [
      { name: 'healthy', type: 'string', description: '是否健康' }
    ],
    content: '#!/usr/bin/env bash\ncurl -sf "$endpoint/health"'
  },
  'collect_metrics': {
    opId: 'op-collect-metrics',
    name: 'collect_metrics',
    version: 1,
    type: 'python',
    timeout: 240,
    description: '采集指标',
    client: '本地 Python',
    inputs: [
      { name: 'endpoint', type: 'string', required: true, defaultValue: '', description: '服务地址' }
    ],
    outputs: [
      { name: 'metrics', type: 'string', description: '指标数据' }
    ],
    content: 'import json\n# 采集指标'
  },
  'run_lint': {
    opId: 'op-run-lint',
    name: 'run_lint',
    version: 2,
    type: 'bash',
    timeout: 180,
    description: '运行代码检查',
    client: '本地 Bash',
    inputs: [
      { name: 'target', type: 'string', required: true, defaultValue: '', description: '检查目标' }
    ],
    outputs: [
      { name: 'issues', type: 'string', description: '问题列表' }
    ],
    content: '#!/usr/bin/env bash\nnpm run lint'
  }
};

// ========== Workflow 数据 ==========
var WORKFLOWS = {
  'deploy_workflow': {
    workflowId: 'wf-deploy',
    name: 'deploy_workflow',
    version: 2,
    description: '部署工作流',
    inputs: [
      { name: 'target_env', type: 'string', required: true, description: '目标环境' }
    ],
    outputs: [
      { name: 'deploy_url', type: 'string', description: '部署后的访问地址' },
      { name: 'status', type: 'string', description: '最终状态' }
    ],
    nodes: {
      '__start__': { kind: 'start', position: { x: 20, y: 155 } },
      'node_check': {
        kind: 'op', op: 'check_tests', opVersion: 2, position: { x: 180, y: 50 },
        params: { test_cmd: '${workspace}/run-tests.sh' },
        retry: null
      },
      'node_review': {
        kind: 'op', op: 'review', opVersion: 2, position: { x: 360, y: 50 },
        params: { test_result: '${node_check.outputs.passed}' },
        retry: { on: 'failure', max: 3, backoff: 'exponential', interval: 1000 }
      },
      'node_deploy': {
        kind: 'op', op: 'deploy', opVersion: 2, position: { x: 540, y: 50 },
        params: { target_env: '${workflow.target_env}' },
        retry: { on: 'failure', max: 2, backoff: 'linear', interval: 2000 }
      },
      'node_notify': {
        kind: 'op', op: 'notify', opVersion: 1, position: { x: 720, y: 50 },
        params: { message: '部署成功' },
        retry: null
      },
      'node_notify_fail': {
        kind: 'op', op: 'notify_fail', opVersion: 1, position: { x: 360, y: 230 },
        params: { error: '${node_check.error}' },
        retry: null
      },
      '__end__': { kind: 'end', position: { x: 940, y: 155 } }
    },
    edges: [
      ['__start__', 'node_check', 'on_success'],
      ['node_check', 'node_review', 'on_success'],
      ['node_check', 'node_notify_fail', 'on_failure'],
      ['node_review', 'node_deploy', 'on_success'],
      ['node_deploy', 'node_notify', 'on_success'],
      ['node_notify', '__end__', 'on_success'],
      ['node_notify_fail', '__end__', 'on_success']
    ]
  },
  'log_analysis': {
    workflowId: 'wf-log-analysis',
    name: 'log_analysis',
    version: 1,
    description: '日志分析工作流',
    needsUpdate: true,
    inputs: [
      { name: 'log_source', type: 'string', required: true, description: '日志来源' }
    ],
    outputs: [
      { name: 'report', type: 'string', description: '分析报告' }
    ],
    nodes: {
      '__start__': { kind: 'start', position: { x: 20, y: 155 } },
      'node_collect': {
        kind: 'op', op: 'collect_metrics', opVersion: 1, position: { x: 180, y: 50 },
        params: { endpoint: '${workflow.log_source}' },
        retry: null
      },
      'node_process': {
        kind: 'op', op: 'process_data', opVersion: 3, position: { x: 360, y: 50 },
        params: { source: '${node_collect.outputs.metrics}' },
        retry: null
      },
      '__end__': { kind: 'end', position: { x: 540, y: 155 } }
    },
    edges: [
      ['__start__', 'node_collect', 'always'],
      ['node_collect', 'node_process', 'on_success'],
      ['node_process', '__end__', 'always']
    ]
  },
  'code_review': {
    workflowId: 'wf-code-review',
    name: 'code_review',
    version: 3,
    description: '代码审查工作流',
    inputs: [
      { name: 'repo', type: 'string', required: true, description: '仓库地址' }
    ],
    outputs: [
      { name: 'result', type: 'string', description: '审查结果' }
    ],
    nodes: {
      '__start__': { kind: 'start', position: { x: 20, y: 155 } },
      'node_lint': {
        kind: 'op', op: 'run_lint', opVersion: 2, position: { x: 180, y: 50 },
        params: { target: '${workflow.repo}' },
        retry: null
      },
      'node_review': {
        kind: 'op', op: 'review', opVersion: 2, position: { x: 360, y: 50 },
        params: { test_result: '${node_lint.outputs.issues}' },
        retry: null
      },
      '__end__': { kind: 'end', position: { x: 540, y: 155 } }
    },
    edges: [
      ['__start__', 'node_lint', 'always'],
      ['node_lint', 'node_review', 'on_success'],
      ['node_review', '__end__', 'always']
    ]
  },
  'hourly_check': {
    workflowId: 'wf-hourly-check',
    name: 'hourly_check',
    version: 1,
    description: '每小时健康检查',
    inputs: [
      { name: 'endpoint', type: 'string', required: true, description: '检查地址' }
    ],
    outputs: [
      { name: 'healthy', type: 'string', description: '是否健康' }
    ],
    nodes: {
      '__start__': { kind: 'start', position: { x: 20, y: 155 } },
      'node_health': {
        kind: 'op', op: 'health_check', opVersion: 1, position: { x: 180, y: 155 },
        params: { endpoint: '${workflow.endpoint}' },
        retry: null
      },
      '__end__': { kind: 'end', position: { x: 380, y: 155 } }
    },
    edges: [
      ['__start__', 'node_health', 'on_success'],
      ['node_health', '__end__', 'on_success']
    ]
  }
};

// ========== Job 数据 ==========
var JOBS = {
  'daily_cleanup': {
    jobId: 'job-daily-cleanup',
    name: 'daily_cleanup',
    version: 2,
    kind: 'persistent',
    target: { kind: 'op', op: 'clean_logs', opVersion: 3 },
    trigger: { kind: 'schedule', cron: '0 2 * * *', enabled: true },
    workspace: '/path/to/workspace',
    inputs: { endpoint: 'localhost:8080' },
    concurrency: 'skip',
    needsUpdate: true,
    note: '需要更新',
    lastRun: { status: 'success', duration: '3.2s', time: '1周前' }
  },
  'hourly_check': {
    jobId: 'job-hourly-check',
    name: 'hourly_check',
    version: 1,
    kind: 'persistent',
    target: { kind: 'workflow', workflow: 'hourly_check', workflowVersion: 1 },
    trigger: { kind: 'schedule', cron: '0 * * * *', enabled: true },
    workspace: '/path/to/workspace',
    inputs: { endpoint: 'http://svc:8080' },
    concurrency: 'skip',
    needsUpdate: true,
    note: '需要更新',
    lastRun: { status: 'failed', duration: '8.1s', time: '2小时前' }
  },
  'manual_deploy': {
    jobId: 'job-manual-deploy',
    name: 'manual_deploy',
    version: 2,
    kind: 'virtual',
    target: { kind: 'workflow', workflow: 'deploy_workflow', workflowVersion: 2 },
    trigger: { kind: 'manual' },
    workspace: '/path/to/workspace',
    inputs: { target_env: 'prod' },
    concurrency: 'skip',
    needsUpdate: false,
    note: '',
    lastRun: { status: 'success', duration: '15.3s', time: '3小时前' }
  },
  'weekly_report': {
    jobId: 'job-weekly-report',
    name: 'weekly_report',
    version: 1,
    kind: 'persistent',
    target: { kind: 'op', op: 'process_data', opVersion: 3 },
    trigger: { kind: 'schedule', cron: '0 18 * * 5', enabled: true },
    workspace: '/path/to/workspace',
    inputs: { source: 'weekly_report.csv' },
    concurrency: 'skip',
    needsUpdate: false,
    note: '',
    lastRun: { status: 'success', duration: '45.6s', time: '2天前' }
  },
  'data_sync': {
    jobId: 'job-data-sync',
    name: 'data_sync',
    version: 3,
    kind: 'persistent',
    target: { kind: 'op', op: 'process_data', opVersion: 3 },
    trigger: { kind: 'schedule', cron: '0 */6 * * *', enabled: true },
    workspace: '/path/to/workspace',
    inputs: { source: 's3://bucket/data' },
    concurrency: 'queue',
    needsUpdate: false,
    note: '',
    lastRun: { status: 'success', duration: '12.4s', time: '1小时前' }
  }
};

// ========== 运行历史数据 ==========
var RUN_HISTORY = [
  {
    runId: 'run-001',
    jobId: 'job-check-tests',
    jobKind: 'virtual',
    jobVersion: 2,
    triggeredBy: 'single_op',
    workspace: '/path/ws-001',
    status: 'success',
    terminatedBy: '',
    startedAtMs: 1728105683000,
    finishedAtMs: 1728105695300,
    duration: 12.3,
    jobName: 'check_tests',
    jobType: 'OP',
    steps: [
      {
        recordId: 'step-001',
        stepId: 'step-1',
        opId: 'check_tests',
        opVersion: 2,
        clientId: 'client-claude',
        status: 'success',
        exitCode: 0,
        inputs: { test_cmd: 'pytest' },
        bodySnapshot: '在当前工作区运行测试，并输出结果 JSON',
        outputs: { passed: 'true', count: '42' },
        rawOutput: '42 tests passed',
        timedOut: false,
        startedAtMs: 1728105683000,
        finishedAtMs: 1728105695300,
        duration: 12.3,
        attempts: [
          { time: '12:01:23', status: 'failed', duration: '5.2s', exitCode: 1, error: 'Connection timeout', inputs: { test_cmd: 'pytest' }, bodySnapshot: '在当前工作区运行测试，并输出结果 JSON', outputs: {}, rawOutput: '' },
          { time: '12:01:35', status: 'success', duration: '12.3s', exitCode: 0, error: '', inputs: { test_cmd: 'pytest' }, bodySnapshot: '在当前工作区运行测试，并输出结果 JSON', outputs: { passed: 'true', count: '42' }, rawOutput: '42 tests passed' }
        ]
      }
    ]
  },
  {
    runId: 'run-002',
    jobId: 'job-deploy',
    jobKind: 'virtual',
    jobVersion: 2,
    triggeredBy: 'manual',
    workspace: '/path/ws-002',
    status: 'failed',
    terminatedBy: 'error',
    startedAtMs: 1728104710000,
    finishedAtMs: 1728104718200,
    duration: 8.2,
    jobName: 'deploy_workflow',
    jobType: 'Workflow',
    workflowId: 'wf-deploy',
    failedNode: 'node_deploy',
    steps: [
      { recordId: 'step-002', stepId: 'step-1', opId: 'check_tests', opVersion: 2, clientId: 'client-claude', status: 'success', exitCode: 0, inputs: { test_cmd: 'pytest' }, bodySnapshot: '在当前工作区运行测试，并输出结果 JSON', outputs: { passed: 'true' }, rawOutput: '10 tests passed', timedOut: false, startedAtMs: 1728104710000, finishedAtMs: 1728104720200, duration: 10.2, attempts: [] },
      { recordId: 'step-003', stepId: 'step-2', opId: 'review', opVersion: 2, clientId: 'client-claude', status: 'success', exitCode: 0, inputs: { test_result: 'pass' }, bodySnapshot: '审查测试结果并给出结论', outputs: { approved: 'true' }, rawOutput: 'Approved', timedOut: false, startedAtMs: 1728104720200, finishedAtMs: 1728104728700, duration: 8.5, attempts: [] },
      { recordId: 'step-004', stepId: 'step-3', opId: 'deploy', opVersion: 2, clientId: 'client-bash', status: 'failed', exitCode: 1, inputs: { target_env: 'prod' }, bodySnapshot: '将当前工作区部署到指定环境，并返回访问 URL', outputs: {}, rawOutput: 'Deploy failed: connection refused', timedOut: false, startedAtMs: 1728104728700, finishedAtMs: 1728104730800, duration: 2.1, attempts: [] },
      { recordId: 'step-005', stepId: 'step-4', opId: 'notify_fail', opVersion: 1, clientId: 'client-claude', status: 'success', exitCode: 0, inputs: { error: 'Deploy failed' }, bodySnapshot: '发送失败告警通知', outputs: {}, rawOutput: 'Notification sent', timedOut: false, startedAtMs: 1728104730800, finishedAtMs: 1728104732600, duration: 1.8, attempts: [] }
    ]
  },
  {
    runId: 'run-003',
    jobId: 'job-hourly-check',
    jobKind: 'persistent',
    jobVersion: 1,
    triggeredBy: 'schedule',
    workspace: '/path/ws-003',
    status: 'failed',
    terminatedBy: 'error',
    startedAtMs: 1728104400000,
    finishedAtMs: 1728104408200,
    duration: 8.2,
    jobName: 'hourly_check',
    jobType: 'Workflow',
    workflowId: 'wf-hourly-check',
    failedNode: 'node_health',
    steps: [
      { recordId: 'step-006', stepId: 'step-1', opId: 'health_check', opVersion: 1, clientId: 'client-python', status: 'failed', exitCode: 1, inputs: { endpoint: 'http://svc:8080' }, bodySnapshot: '#!/usr/bin/env bash\ncurl -sf "$endpoint/health"', outputs: { error: 'connection refused' }, rawOutput: 'Error: Connection refused', timedOut: false, startedAtMs: 1728104400000, finishedAtMs: 1728104408200, duration: 8.2, attempts: [] }
    ]
  },
  {
    runId: 'run-004',
    jobId: 'job-review',
    jobKind: 'virtual',
    jobVersion: 1,
    triggeredBy: 'single_op',
    workspace: '/path/ws-001',
    status: 'success',
    terminatedBy: '',
    startedAtMs: 1728103800000,
    finishedAtMs: 1728103806100,
    duration: 6.1,
    jobName: 'review',
    jobType: 'OP',
    steps: [
      { recordId: 'step-007', stepId: 'step-1', opId: 'review', opVersion: 2, clientId: 'client-claude', status: 'success', exitCode: 0, inputs: { test_result: 'pass' }, bodySnapshot: '审查测试结果并给出结论', outputs: { approved: 'true' }, rawOutput: 'Approved', timedOut: false, startedAtMs: 1728103800000, finishedAtMs: 1728103806100, duration: 6.1, attempts: [] }
    ]
  },
  {
    runId: 'run-005',
    jobId: 'job-notify',
    jobKind: 'persistent',
    jobVersion: 2,
    triggeredBy: 'retry',
    workspace: '/path/ws-004',
    status: 'timeout',
    terminatedBy: 'timeout',
    startedAtMs: 1728102900000,
    finishedAtMs: 1728103200000,
    duration: 300.0,
    jobName: 'notify',
    jobType: 'OP',
    steps: [
      { recordId: 'step-008', stepId: 'step-1', opId: 'notify', opVersion: 1, clientId: 'client-claude', status: 'timeout', exitCode: null, inputs: { message: '告警' }, outputs: {}, rawOutput: 'Timeout after 300s', timedOut: true, startedAtMs: 1728102900000, finishedAtMs: 1728103200000, duration: 300.0, attempts: [] }
    ]
  },
  {
    runId: 'run-006',
    jobId: 'job-daily-cleanup',
    jobKind: 'persistent',
    jobVersion: 2,
    triggeredBy: 'schedule',
    workspace: '/path/ws-005',
    status: 'success',
    terminatedBy: '',
    startedAtMs: 1728019200000,
    finishedAtMs: 1728019203200,
    duration: 3.2,
    jobName: 'daily_cleanup',
    jobType: 'OP',
    steps: [
      { recordId: 'step-009', stepId: 'step-1', opId: 'clean_logs', opVersion: 3, clientId: 'client-powershell', status: 'success', exitCode: 0, inputs: { endpoint: 'localhost:8080' }, outputs: {}, rawOutput: 'Logs cleaned', timedOut: false, startedAtMs: 1728019200000, finishedAtMs: 1728019203200, duration: 3.2, attempts: [] }
    ]
  },
  {
    runId: 'run-007',
    jobId: 'job-data-sync',
    jobKind: 'persistent',
    jobVersion: 3,
    triggeredBy: 'schedule',
    workspace: '/path/ws-006',
    status: 'success',
    terminatedBy: '',
    startedAtMs: 1728106800000,
    finishedAtMs: 1728106812400,
    duration: 12.4,
    jobName: 'data_sync',
    jobType: 'OP',
    steps: [
      { recordId: 'step-010', stepId: 'step-1', opId: 'process_data', opVersion: 3, clientId: 'client-python', status: 'success', exitCode: 0, inputs: { source: 's3://bucket/data' }, outputs: { count: '1024' }, rawOutput: '1024 records processed', timedOut: false, startedAtMs: 1728106800000, finishedAtMs: 1728106812400, duration: 12.4, attempts: [] }
    ]
  },
  {
    runId: 'run-008',
    jobId: 'job-hourly-check',
    jobKind: 'persistent',
    jobVersion: 1,
    triggeredBy: 'manual',
    workspace: '/path/ws-003',
    status: 'success',
    terminatedBy: '',
    startedAtMs: 1728107400000,
    finishedAtMs: 1728107405300,
    duration: 5.3,
    jobName: 'hourly_check',
    jobType: 'Workflow',
    workflowId: 'wf-hourly-check',
    steps: [
      { recordId: 'step-011', stepId: 'step-1', opId: 'health_check', opVersion: 1, clientId: 'client-python', status: 'success', exitCode: 0, inputs: { endpoint: 'http://svc:8080' }, bodySnapshot: '#!/usr/bin/env bash\ncurl -sf "$endpoint/health"', outputs: { healthy: 'true' }, rawOutput: 'Service is healthy', timedOut: false, startedAtMs: 1728107400000, finishedAtMs: 1728107405300, duration: 5.3, attempts: [] }
    ]
  }
];

// ========== Mock API 函数 ==========
function mockFetch(path) {
  // 模拟网络延迟
  return new Promise(function(resolve) {
    setTimeout(function() {
      if (path === '/api/clients') resolve(Object.values(CLIENTS));
      else if (path === '/api/ops') resolve(Object.values(OPS));
      else if (path === '/api/workflows') resolve(Object.values(WORKFLOWS));
      else if (path === '/api/jobs') resolve(Object.values(JOBS));
      else if (path === '/api/runs') resolve(RUN_HISTORY);
      else if (path.startsWith('/api/ops/')) resolve(OPS[path.split('/')[3]]);
      else if (path.startsWith('/api/workflows/')) {
        var wfId = path.split('/')[3];
        var found = Object.values(WORKFLOWS).find(function(w) { return w.workflowId === wfId; });
        resolve(found || null);
      }
      else if (path.startsWith('/api/jobs/')) resolve(JOBS[path.split('/')[3]]);
      else if (path.startsWith('/api/runs/')) {
        var run = RUN_HISTORY.find(function(r) { return r.runId === path.split('/')[3]; });
        resolve(run);
      }
      else resolve(null);
    }, 100);
  });
}
