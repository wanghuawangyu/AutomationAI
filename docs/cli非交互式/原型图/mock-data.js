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
 * - OP 的超时字段为 `timeoutSeconds`（**整数秒**，对齐 crud-02）；`timeoutMs`（毫秒）只出现在
 *   Run 的 **StepRecord** 内（记录当次执行实际使用的超时毫秒数），两者语义不同、不可混用。
 * - 列表接口响应统一为 `{ items, total, page, page_size }`（crud-01 3.1.1 / crud-02 / crud-03 / crud-04 / crud-05），
 *   前端消费列表响应一律用 `listItems(res)` 取数组。
 * - `needsUpdate`（Job / Workflow）是**后端动态计算字段**（不落库），此处为 mock 快照，仅用于界面展示。
 */

/** 列表响应 → 数组：兼容 `{items,total,page,page_size}` 包裹结构（各列表接口统一，见文件头注释） */
function listItems(res) {
  return (res && res.items) || res || [];
}

/* ---------- 错误响应统一口径（crud-01 3.1.2 / crud-04 3.4 错误响应 / crud-05 / crud-06 一致规定） ----------
   响应体固定为 `{ "error": { "code": "...", "message": "..." } }`（嵌套对象，非扁平字符串）；
   页面一律用 errorText(res) / errorCode(res) 消费，不直接读 res.message。 */
function __err(code, message) {
  return { error: { code: code, message: message } };
}
/** 取错误码（无错误返回 ''） */
function errorCode(res) {
  return (res && res.error && res.error.code) || '';
}
/** 取错误文案（无错误返回 ''；message 缺省时退回 code） */
function errorText(res) {
  if (!res || !res.error) return '';
  if (typeof res.error === 'string') return res.error;   // 兼容纯字符串错误（非文档口径，仅兜底）
  return res.error.message || res.error.code || '';
}

/* ---------- triggeredBy 展示映射（5 值全量；proposal-01 §12.4 / crud-05 3.5.1 枚举） ---------- */
var TRIGGER_TEXT = {
  manual: '持久 Job / 手动',
  schedule: '持久 Job / 定时',
  single_op: '单次执行 · OP',
  single_workflow: '单次执行 · Workflow',
  retry: '持久 Job / 重试'
};
function triggerTextOf(triggeredBy) {
  return TRIGGER_TEXT[triggeredBy] || triggeredBy || '';
}

/* ---------- 输出转义（R6-S1）----------
   实体名称（name）与 label / type / 绑定的参数名等字段允许**任意 UTF-8 字符**（proposal-01-界面设计.md:78「长度 ≤ 512 字符，字符集不限」），
   因此凡把数据拼进 HTML 的位置一律要转义，否则名称含 `'` 会破坏内联 onclick（该行按钮全部失效）、含 `<>` 会被当标签解析。
   约定：文本节点 / 属性值用 escText()；确需写成内联处理器（onclick="f('X')"）的字符串字面量用 escJsStr()；
   列表行（client / op / workflow / job / index 运行历史）一律改用 data-* 属性 + 事件委托，不在 onclick 里拼数据。 */
function escText(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 内联 JS 字符串字面量转义：先转义 `\` 与 `'`（JS 层），再做 HTML 实体转义（属性层）——
    结果可安全嵌入 `onclick="f('X')"`：HTML 解析不会提前闭合属性，JS 解析不会提前闭合字符串字面量。 */
function escJsStr(s) {
  var js = String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return escText(js);
}

/* ---------- 名称边界（R6-G3 / R6-M1）：proposal-01-界面设计.md:78 —— 长度 ≤ 512 字符，字符集不限；后端同样校验（400 VALIDATION_ERROR） ----------
   4 类实体的创建（POST）与更新（PUT）入口统一调用：空 → 「name 不可为空」；超 512 → 「name 长度不能超过 512 字符」。 */
var NAME_MAX_LEN = 512;
function __nameErrs(name) {
  var errs = [];
  var s = (name == null) ? '' : String(name);
  if (!s) errs.push('name 不可为空');
  else if (s.length > NAME_MAX_LEN) errs.push('name 长度不能超过 ' + NAME_MAX_LEN + ' 字符');
  return errs;
}

/** 名称 → 文件名 slug（crud-01 3.1.7 `client-<name>.yaml`；D5：不可含路径分隔符 / `..`） */
function slugName(name) {
  return String(name == null ? '' : name).trim()
    .replace(/\s+/g, '_')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/^\.+/, '')
    .toLowerCase() || 'client';
}

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
    timeoutSeconds: 300,
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
    timeoutSeconds: 600,
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
    description: '部署应用到目标环境',
    content: '将当前工作区部署到指定环境，并返回访问 URL',
    timeoutSeconds: 120,
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
    description: '发送通知',
    content: '发送通知消息',
    timeoutSeconds: 60,
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
    timeoutSeconds: 60,
    interactive: false,
    version: 1,
    inputs: [],   // proposal-01 §9.3：notify_fail 入参 = 无
    outputs: [],
    createdAtMs: '1728000000000',
    updatedAtMs: '1728000000000'
  },
  {
    opId: '10000000000000000000000000000006',
    name: 'clean_logs',
    type: 'powershell',
    description: '清理过期日志',
    content: 'Get-ChildItem -Path $env:WORKSPACE -Recurse -Filter *.log | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item',
    timeoutSeconds: 60,
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
    description: '处理数据文件',
    content: 'import json\n# 处理数据源并输出结果',
    timeoutSeconds: 300,
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
    timeoutSeconds: 30,
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
    description: '收集指标',
    content: 'import json\n# 采集指标',
    timeoutSeconds: 60,
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
    timeoutSeconds: 60,
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
      { name: 'deploy_url', from: { workflowNodeId: '4e5f60718293a4b5c6d7e8f9a1b2c3d4', outputName: 'url' }, description: '部署后的访问地址' },
      { name: 'status', from: { workflowNodeId: '3d4e5f60718293a4b5c6d7e8f9a1b2c3', outputName: 'approved' }, description: '最终状态' }
    ],
    nodes: [
      { workflowNodeId: '0a1b2c3d4e5f60718293a4b5c6d7e8f9', label: 'node_start', kind: 'start', position: { x: 20, y: 155 } },
      {
        workflowNodeId: '1b2c3d4e5f60718293a4b5c6d7e8f9a1', label: 'node_check', kind: 'op', position: { x: 180, y: 50 },
        opId: '10000000000000000000000000000001', opVersion: 2, clientId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        bindings: { test_cmd: { kind: 'literal', value: 'pytest' } },
        retry: null
      },
      {
        workflowNodeId: '3d4e5f60718293a4b5c6d7e8f9a1b2c3', label: 'node_review', kind: 'op', position: { x: 360, y: 50 },
        opId: '10000000000000000000000000000002', opVersion: 2, clientId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        bindings: { test_result: { kind: 'node_output', workflowNodeId: '1b2c3d4e5f60718293a4b5c6d7e8f9a1', outputName: 'passed' } },
        retry: { on: 'failure', max: 3, backoff: 'exponential', interval: 1000 }
      },
      {
        workflowNodeId: '4e5f60718293a4b5c6d7e8f9a1b2c3d4', label: 'node_deploy', kind: 'op', position: { x: 540, y: 50 },
        opId: '10000000000000000000000000000003', opVersion: 2, clientId: 'c3d4e5f60718293a4b5c6d7e8f90a1b2',
        bindings: { target_env: { kind: 'workflow_input', inputName: 'target_env' } },
        retry: { on: 'failure', max: 2, backoff: 'linear', interval: 2000 }
      },
      {
        workflowNodeId: '5f60718293a4b5c6d7e8f9a1b2c3d4e5', label: 'node_notify', kind: 'op', position: { x: 720, y: 50 },
        opId: '10000000000000000000000000000004', opVersion: 1, clientId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        bindings: { message: { kind: 'literal', value: '部署成功' } },
        retry: null
      },
      {
        workflowNodeId: '60718293a4b5c6d7e8f9a1b2c3d4e5f6', label: 'node_notify_fail', kind: 'op', position: { x: 360, y: 230 },
        opId: '10000000000000000000000000000005', opVersion: 1, clientId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        bindings: { error: { kind: 'node_output', workflowNodeId: '1b2c3d4e5f60718293a4b5c6d7e8f9a1', outputName: 'result' } },
        retry: null
      },
      { workflowNodeId: '2c3d4e5f60718293a4b5c6d7e8f9a1b2', label: 'node_end', kind: 'end', position: { x: 940, y: 155 } }
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
    outputs: [{ name: 'report', from: { workflowNodeId: '93a4b5c6d7e8f9a1b2c3d4e5f6071829', outputName: 'count' }, description: '分析报告' }],
    nodes: [
      { workflowNodeId: '718293a4b5c6d7e8f9a1b2c3d4e5f607', label: 'node_start', kind: 'start', position: { x: 20, y: 155 } },
      {
        workflowNodeId: '8293a4b5c6d7e8f9a1b2c3d4e5f60718', label: 'node_collect', kind: 'op', position: { x: 180, y: 50 },
        opId: '10000000000000000000000000000009', opVersion: 1, clientId: 'd4e5f60718293a4b5c6d7e8f90a1b2c3',
        bindings: { endpoint: { kind: 'workflow_input', inputName: 'log_source' } },
        retry: null
      },
      {
        workflowNodeId: '93a4b5c6d7e8f9a1b2c3d4e5f6071829', label: 'node_process', kind: 'op', position: { x: 360, y: 50 },
        opId: '10000000000000000000000000000007', opVersion: 2, clientId: 'd4e5f60718293a4b5c6d7e8f90a1b2c3',
        bindings: { source: { kind: 'node_output', workflowNodeId: '8293a4b5c6d7e8f9a1b2c3d4e5f60718', outputName: 'metrics' } },
        retry: null
      },
      { workflowNodeId: 'a4b5c6d7e8f9a1b2c3d4e5f60718293a', label: 'node_end', kind: 'end', position: { x: 540, y: 155 } }
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
    outputs: [{ name: 'result', from: { workflowNodeId: 'd7e8f9a1b2c3d4e5f60718293a4b5c6d', outputName: 'approved' }, description: '审查结果' }],
    nodes: [
      { workflowNodeId: 'b5c6d7e8f9a1b2c3d4e5f60718293a4b', label: 'node_start', kind: 'start', position: { x: 20, y: 155 } },
      {
        workflowNodeId: 'c6d7e8f9a1b2c3d4e5f60718293a4b5c', label: 'node_lint', kind: 'op', position: { x: 180, y: 50 },
        opId: '1000000000000000000000000000000a', opVersion: 2, clientId: 'c3d4e5f60718293a4b5c6d7e8f90a1b2',
        bindings: { target: { kind: 'workflow_input', inputName: 'repo' } },
        retry: null
      },
      {
        workflowNodeId: 'd7e8f9a1b2c3d4e5f60718293a4b5c6d', label: 'node_review', kind: 'op', position: { x: 360, y: 50 },
        opId: '10000000000000000000000000000002', opVersion: 2, clientId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        bindings: { test_result: { kind: 'node_output', workflowNodeId: 'c6d7e8f9a1b2c3d4e5f60718293a4b5c', outputName: 'issues' } },
        retry: null
      },
      { workflowNodeId: 'e8f9a1b2c3d4e5f60718293a4b5c6d7e', label: 'node_end', kind: 'end', position: { x: 540, y: 155 } }
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
    outputs: [{ name: 'healthy', from: { workflowNodeId: '0a1b2c3d4e5f60718293a4b5c6d7e8fa', outputName: 'healthy' }, description: '是否健康' }],
    nodes: [
      { workflowNodeId: 'f9a1b2c3d4e5f60718293a4b5c6d7e8f', label: 'node_start', kind: 'start', position: { x: 20, y: 155 } },
      {
        workflowNodeId: '0a1b2c3d4e5f60718293a4b5c6d7e8fa', label: 'node_health', kind: 'op', position: { x: 180, y: 155 },
        opId: '10000000000000000000000000000008', opVersion: 1, clientId: 'd4e5f60718293a4b5c6d7e8f90a1b2c3',
        bindings: { endpoint: { kind: 'workflow_input', inputName: 'endpoint' } },
        retry: null
      },
      { workflowNodeId: '1a2b3c4d5e6f708192a3b4c5d6e7f809', label: 'node_end', kind: 'end', position: { x: 380, y: 155 } }
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
// description：crud-04 `jobs.description`（可空），参与 keyword 模糊匹配（crud-04 3.4.1「name / target 名称 / description」）
var JOBS = [
  {
    jobId: '20000000000000000000000000000001',
    name: 'daily_cleanup',
    version: 2,
    description: '清理过期日志',   // N3：crud-04 jobs.description（keyword 匹配维度之一）+ §11.4 编辑器「描述」回填
    kind: 'persistent',
    target: { kind: 'op', opId: '10000000000000000000000000000006', opVersion: 2, clientId: 'e5f60718293a4b5c6d7e8f90a1b2c3d4' },   // proposal-01 §10.3：daily_cleanup → OP clean_logs v2（落后当前 v3 → needsUpdate）
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
    description: '每小时健康检查',   // N3
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
    description: '生产部署',   // N3
    kind: 'persistent',   // 原型示意：Job 列表仅展示持久 Job（crud-04 3.4.1；virtual 仅存于 job_runs）
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
    description: '生成周报',   // N3
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
    description: '数据同步',   // N3
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
// JobRun：name = 运行名称快照；target 为**固定键位快照**（crud-05 3.5.1：{kind, opId, opVersion, workflowId, workflowVersion, name}，
// 不适用的一侧一律置 null，便于前端统一取值）
// steps：扁平 StepRecord[]（同一步多次执行 = 多条记录，用 activationSeq / retrySeq 区分）
var RUNS = [
  {
    runId: 'run-001',
    name: 'check_tests',
    jobId: 'job-check-tests',
    jobKind: 'virtual',
    jobVersion: null,   // virtual Run 无 Job 修订号
    triggeredBy: 'single_op',
    target: { kind: 'op', opId: '10000000000000000000000000000001', opVersion: 2, workflowId: null, workflowVersion: null, name: 'check_tests' },
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
    triggeredBy: 'single_workflow',   // crud-05 3.5.1：virtual Run 单次执行 Workflow → single_workflow（非 manual）
    target: { kind: 'workflow', opId: null, opVersion: null, workflowId: 'f0000000000000000000000000000001', workflowVersion: 2, name: 'deploy_workflow' },
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
    target: { kind: 'workflow', opId: null, opVersion: null, workflowId: 'f0000000000000000000000000000004', workflowVersion: 1, name: 'hourly_check' },
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
        timeoutMs: 30000, timedOut: false, startedAtMs: 1728104400000, finishedAtMs: 1728104408200, durationMs: 8200
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
    target: { kind: 'op', opId: '10000000000000000000000000000002', opVersion: 2, workflowId: null, workflowVersion: null, name: 'review' },
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
    target: { kind: 'op', opId: '10000000000000000000000000000004', opVersion: 1, workflowId: null, workflowVersion: null, name: 'notify' },
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
        outputs: null, rawOutput: 'Timeout after 60s', exitCode: null, error: 'timeout',
        timeoutMs: 60000, timedOut: true, startedAtMs: 1728102900000, finishedAtMs: 1728102960000, durationMs: 60000
      }
    ],
    retryFromRunId: null,
    retryFromStepId: null,
    startedAtMs: 1728102900000,
    finishedAtMs: 1728102960000,
    durationMs: 60000,
    createdAtMs: '1728102899000',
    updatedAtMs: '1728102960000'
  },
  {
    runId: 'run-006',
    name: 'daily_cleanup',
    jobId: '20000000000000000000000000000001',
    jobKind: 'persistent',
    jobVersion: 2,
    triggeredBy: 'schedule',
    target: { kind: 'op', opId: '10000000000000000000000000000006', opVersion: 2, workflowId: null, workflowVersion: null, name: 'clean_logs' },
    inputs: { endpoint: 'localhost:8080' },
    workspace: '/path/ws-005',
    status: 'success',
    terminatedBy: null,
    timeoutStepId: null,
    timeoutOpName: null,
    steps: [
      {
        recordId: 'step-009', stepId: '102030405060708090a0b0c0d0e0f007', activationSeq: 1, retrySeq: 1,
        opId: '10000000000000000000000000000006', opVersion: 2, opName: 'clean_logs', clientId: 'e5f60718293a4b5c6d7e8f90a1b2c3d4',
        status: 'success', inputs: { endpoint: 'localhost:8080' }, bodySnapshot: 'Get-ChildItem -Path $env:WORKSPACE ...',
        outputs: null, rawOutput: 'Logs cleaned', exitCode: 0, error: null,
        timeoutMs: 60000, timedOut: false, startedAtMs: 1728019200000, finishedAtMs: 1728019203200, durationMs: 3200
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
    target: { kind: 'op', opId: '10000000000000000000000000000007', opVersion: 3, workflowId: null, workflowVersion: null, name: 'process_data' },
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
    target: { kind: 'workflow', opId: null, opVersion: null, workflowId: 'f0000000000000000000000000000004', workflowVersion: 1, name: 'hourly_check' },
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
        timeoutMs: 30000, timedOut: false, startedAtMs: 1728107400000, finishedAtMs: 1728107405300, durationMs: 5300
      }
    ],
    retryFromRunId: null,
    retryFromStepId: null,
    startedAtMs: 1728107400000,
    finishedAtMs: 1728107405300,
    durationMs: 5300,
    createdAtMs: '1728107399000',
    updatedAtMs: '1728107405300'
  },
  /* ---- 以下 3 条为 N7 补齐的夹具（run-009 / run-010 / run-011，新增 id，不改动 run-001…run-008）----
     目的：① 让 Job「data_sync」的**最新 Run 为 failed**（§18.1.2「最近执行失败」chip 可演示）；
           ② 提供 1 条 running（workflow target）与 1 条 terminating（§12.4 非终态结果徽标 ● / ⏹、[终止] 按钮可演示）；
           ③ 与非终态 Run 配套的时间戳重基准见文件下方 RUN_START_AGO_MS（时间范围筛选可演示）。 */
  {
    runId: 'run-009',
    name: 'data_sync',
    jobId: '20000000000000000000000000000005',
    jobKind: 'persistent',
    jobVersion: 3,
    triggeredBy: 'schedule',
    target: { kind: 'op', opId: '10000000000000000000000000000007', opVersion: 3, workflowId: null, workflowVersion: null, name: 'process_data' },
    inputs: { source: 's3://bucket/data' },
    workspace: '/path/ws-006',
    status: 'failed',
    terminatedBy: 'error',
    timeoutStepId: null,
    timeoutOpName: null,
    steps: [
      {
        recordId: 'step-012', stepId: 'run-009', activationSeq: 1, retrySeq: 1,
        opId: '10000000000000000000000000000007', opVersion: 3, opName: 'process_data', clientId: 'd4e5f60718293a4b5c6d7e8f90a1b2c3',
        status: 'failed', inputs: { source: 's3://bucket/data' }, bodySnapshot: 'import json\n# 处理数据源并输出结果',
        outputs: null, rawOutput: 'Error: source unreachable', exitCode: 1, error: 'source unreachable',
        timeoutMs: 300000, timedOut: false, startedAtMs: 1728106900000, finishedAtMs: 1728106904100, durationMs: 4100
      }
    ],
    retryFromRunId: null,
    retryFromStepId: null,
    startedAtMs: 1728106900000,
    finishedAtMs: 1728106904100,
    durationMs: 4100,
    createdAtMs: '1728106899000',
    updatedAtMs: '1728106904100'
  },
  {
    runId: 'run-010',
    name: 'deploy_workflow',
    jobId: 'job-deploy',
    jobKind: 'virtual',
    jobVersion: null,
    triggeredBy: 'single_workflow',
    target: { kind: 'workflow', opId: null, opVersion: null, workflowId: 'f0000000000000000000000000000001', workflowVersion: 2, name: 'deploy_workflow' },
    inputs: { target_env: 'prod' },
    workspace: '/path/ws-002',
    status: 'running',   // N7：§12.4 结果列「● 运行中」+ 操作列 [终止]
    terminatedBy: null,
    timeoutStepId: null,
    timeoutOpName: null,
    steps: [
      {
        recordId: 'step-013', stepId: '1b2c3d4e5f60718293a4b5c6d7e8f9a1', activationSeq: 1, retrySeq: 1,
        opId: '10000000000000000000000000000001', opVersion: 2, opName: 'check_tests', clientId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        status: 'success', inputs: { test_cmd: 'pytest' }, bodySnapshot: '在当前工作区运行测试，并输出结果 JSON',
        outputs: { passed: 'true' }, rawOutput: '10 tests passed', exitCode: 0, error: null,
        timeoutMs: 300000, timedOut: false, startedAtMs: 1728108000000, finishedAtMs: 1728108010200, durationMs: 10200
      },
      {
        recordId: 'step-014', stepId: '3d4e5f60718293a4b5c6d7e8f9a1b2c3', activationSeq: 1, retrySeq: 1,
        opId: '10000000000000000000000000000002', opVersion: 2, opName: 'review', clientId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        status: 'running', inputs: { test_result: 'pass' }, bodySnapshot: '审查测试结果并给出结论',
        outputs: null, rawOutput: '', exitCode: null, error: null,
        timeoutMs: 600000, timedOut: false, startedAtMs: 1728108010200, finishedAtMs: null, durationMs: null
      },
      {
        recordId: 'step-015', stepId: '4e5f60718293a4b5c6d7e8f9a1b2c3d4', activationSeq: 1, retrySeq: 1,
        opId: '10000000000000000000000000000003', opVersion: 2, opName: 'deploy', clientId: 'c3d4e5f60718293a4b5c6d7e8f90a1b2',
        status: 'waiting', inputs: { target_env: 'prod' }, bodySnapshot: '将当前工作区部署到指定环境，并返回访问 URL',
        outputs: null, rawOutput: '', exitCode: null, error: null,
        timeoutMs: 120000, timedOut: false, startedAtMs: null, finishedAtMs: null, durationMs: null
      }
    ],
    retryFromRunId: null,
    retryFromStepId: null,
    startedAtMs: 1728108000000,
    finishedAtMs: null,   // 未结束：非终态不展示耗时（§12.4 结果列）
    durationMs: null,
    createdAtMs: '1728107999000',
    updatedAtMs: '1728108010200'
  },
  {
    runId: 'run-011',
    name: 'manual_deploy',
    jobId: '20000000000000000000000000000003',
    jobKind: 'persistent',
    jobVersion: 2,
    triggeredBy: 'manual',
    target: { kind: 'workflow', opId: null, opVersion: null, workflowId: 'f0000000000000000000000000000001', workflowVersion: 2, name: 'deploy_workflow' },
    inputs: { target_env: 'prod' },
    workspace: '/path/ws-003',
    status: 'terminating',   // N7：§12.4 结果列「⏹ 终止中」；terminating 无操作（已提交终止，等待在跑 OP 收敛）
    terminatedBy: 'cancelled',
    timeoutStepId: null,
    timeoutOpName: null,
    steps: [
      {
        recordId: 'step-016', stepId: '1b2c3d4e5f60718293a4b5c6d7e8f9a1', activationSeq: 1, retrySeq: 1,
        opId: '10000000000000000000000000000001', opVersion: 2, opName: 'check_tests', clientId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        status: 'success', inputs: { test_cmd: 'pytest' }, bodySnapshot: '在当前工作区运行测试，并输出结果 JSON',
        outputs: { passed: 'true' }, rawOutput: '10 tests passed', exitCode: 0, error: null,
        timeoutMs: 300000, timedOut: false, startedAtMs: 1728108600000, finishedAtMs: 1728108610200, durationMs: 10200
      },
      {
        recordId: 'step-017', stepId: '3d4e5f60718293a4b5c6d7e8f9a1b2c3', activationSeq: 1, retrySeq: 1,
        opId: '10000000000000000000000000000002', opVersion: 2, opName: 'review', clientId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        status: 'running', inputs: { test_result: 'pass' }, bodySnapshot: '审查测试结果并给出结论',
        outputs: null, rawOutput: '', exitCode: null, error: null,
        timeoutMs: 600000, timedOut: false, startedAtMs: 1728108610200, finishedAtMs: null, durationMs: null
      }
    ],
    retryFromRunId: null,
    retryFromStepId: null,
    startedAtMs: 1728108600000,
    finishedAtMs: null,
    durationMs: null,
    createdAtMs: '1728108599000',
    updatedAtMs: '1728108610200'
  }
];

var RUN_BY_ID = {};
RUNS.forEach(function (r) { RUN_BY_ID[r.runId] = r; });

/* StepRecord 字段补全（crud-05 3.5.0 字段表）：stepId / runId / source / workspace / notBeforeMs / createdAtMs
   —— source: workflow 步骤 = 'step'（Engine 触发）；单次 OP / Job(target=op) = 'job'（Runner 触发）
   —— stepId: workflow 步骤 = workflowNodeId；**单次 OP / Job（target=op）执行时 stepId = run_id**（crud-05 3.5.0） */
RUNS.forEach(function (r) {
  var isOpTarget = !(r.target && r.target.kind === 'workflow');
  (r.steps || []).forEach(function (s) {
    if (isOpTarget) s.stepId = r.runId;
    if (s.runId == null) s.runId = r.runId;
    if (s.source == null) s.source = (r.target && r.target.kind === 'workflow') ? 'step' : 'job';
    if (s.workspace == null) s.workspace = r.workspace;
    if (s.notBeforeMs == null) s.notBeforeMs = null;   // NULL = 立即可执行
    if (s.createdAtMs == null) s.createdAtMs = String(r.createdAtMs || s.startedAtMs || '');
  });
});

/* N7 时间戳重基准：原夹具为**固定绝对时间**（2024-10 前后，距当前约 1.9 年）→ 运行历史「时间范围」筛选（last_1h … last_30d）恒 0 条。
   这里按 runId 指定「起始时间距当前多少毫秒」，把该 Run 的**全部时间戳整体平移相同量**（保留 Run 内部
   各 step 的先后关系与耗时），id / 字段结构 / 引用关系一律不变。档位分布（每档至少一条，且**各 Job 的
   最新 Run 关系不被破坏**）：
     last_1h → run-001(51m) / run-004(25m) / run-009(30m) / run-010(2m) / run-011(40m)
     last_24h → run-002(3h)；last_2d → run-005(26h) / run-008(1d2h)
     last_3d → run-003(2d4h)；last_5d → run-006(6d)；last_30d → run-007(9d) */
var RUN_START_AGO_MS = {
  'run-001': 51 * 60000,
  'run-002': 3 * 3600000,
  'run-003': 2 * 86400000 + 4 * 3600000,
  'run-004': 25 * 60000,
  'run-005': 26 * 3600000,
  'run-006': 6 * 86400000,          // daily_cleanup 唯一 Run（最新）→ 6d 前
  'run-007': 9 * 86400000,          // data_sync 第二条（早于 run-009）→ 9d 前（last_30d 档）
  'run-008': 1 * 86400000 + 2 * 3600000,   // hourly_check 最新 Run（成功）；**必须新于 run-003(2d4h)**，否则 hourly_check 会被判为「最近运行失败」
  'run-009': 30 * 60000,            // data_sync 最新 Run（失败）→ 支撑「最近执行失败」chip
  'run-010': 2 * 60000,
  'run-011': 40 * 60000
};
(function __rebaseRunTimestamps() {
  var now = Date.now();
  RUNS.forEach(function (r) {
    var ago = RUN_START_AGO_MS[r.runId];
    if (ago == null || r.startedAtMs == null) return;   // 未指定 / 未开始（waiting 等，startedAtMs 为空）不参与平移
    var shift = (now - ago) - Number(r.startedAtMs);
    var mv = function (t) { return (t == null || t === '') ? t : Number(t) + shift; };
    r.startedAtMs = mv(r.startedAtMs);
    r.finishedAtMs = mv(r.finishedAtMs);
    r.createdAtMs = String(mv(r.createdAtMs));
    r.updatedAtMs = mv(r.updatedAtMs);
    (r.steps || []).forEach(function (s) {
      s.startedAtMs = mv(s.startedAtMs);
      s.finishedAtMs = mv(s.finishedAtMs);
      s.createdAtMs = String(mv(s.createdAtMs));
    });
  });
})();

/* N7：列表顺序对齐 crud-05 3.5.1 默认排序（`-startedAtMs` 降序；`started_at_ms` 为 NULL 的 waiting 记录排在**最后**，
   同序时以 createdAtMs 为次序参考）——否则新补的非终态 / 最近失败夹具会落到分页第 2 页，原型首页看不到。
   仅调整数组顺序，id / 字段 / 引用关系一律不变；运行时新创建的 Run 仍由 unshift 置顶。 */
RUNS.sort(function (a, b) {
  var av = a.startedAtMs, bv = b.startedAtMs;
  if (av == null && bv == null) return Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0);
  if (av == null) return 1;
  if (bv == null) return -1;
  if (Number(av) !== Number(bv)) return Number(bv) - Number(av);
  return Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0);
});

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

/** Job 列表的 lastRun（对应 crud-04 3.4.11 last-run）：由 RUNS 取**最近创建的一条**，**返回完整 Run**（供 can-retry 判定）
 *  排序键 = createdAtMs（“最近一次执行”按创建时间倒序）；**不能用 startedAtMs**——waiting 态 Run 的 startedAtMs 为 null
 *  （crud-05 3.5.0），否则刚手动触发、尚未开始的 Run 会被误判为最旧而不出现在 Job 列表「最近运行」列（N4 关联修正）。 */
function lastRunOfJob(jobId) {
  var mine = RUNS.filter(function (r) { return r.jobId === jobId; });
  if (!mine.length) return null;
  mine.sort(function (a, b) { return Number(a.createdAtMs || 0) - Number(b.createdAtMs || 0); });
  return mine[mine.length - 1];
}

/** Job 列表项的 lastRun 摘要（crud-04 3.4.1：**固定 5 字段** runId / status / startedAtMs / finishedAtMs / durationMs，可为 null） */
function lastRunSummaryOf(jobId) {
  var lr = lastRunOfJob(jobId);
  if (!lr) return null;
  return {
    runId: lr.runId,
    status: lr.status,
    startedAtMs: lr.startedAtMs == null ? null : String(lr.startedAtMs),
    finishedAtMs: lr.finishedAtMs == null ? null : String(lr.finishedAtMs),
    durationMs: lr.durationMs == null ? null : lr.durationMs
  };
}

/** Job 是否需要更新（crud-04 3.4.12）：target 版本落后/超前、OP 已删除，或所引 Workflow.needsUpdate=true */
function needsUpdateOfJob(job) {
  if (!job || !job.target) return false;
  if (job.target.kind === 'op') {
    var op = OP_BY_ID[job.target.opId];
    if (!op) return true;
    return parseInt(job.target.opVersion, 10) !== parseInt(op.version, 10);
  }
  var wf = WORKFLOW_BY_ID[job.target.workflowId];
  if (!wf) return true;
  if (wf.needsUpdate) return true;
  return parseInt(job.target.workflowVersion, 10) !== parseInt(wf.version, 10);
}

/** Workflow 的需更新节点（crud-03 3.3.10 / 3.3.11 共用同一判定内核）：引用的 OP 不存在（悬挂引用），或 opVersion 不等于 OP 当前 version */
function outdatedNodesOf(wf) {
  var outs = [];
  if (!wf) return outs;
  (wf.nodes || []).forEach(function (n) {
    if (n.kind !== 'op') return;
    var def = OP_BY_ID[n.opId];
    if (!def || parseInt(n.opVersion, 10) !== parseInt(def.version, 10)) outs.push(n.workflowNodeId);
  });
  return outs;
}

/** 「失败节点」列（proposal-01 §12.4 列规则，N14 收敛口径）：
 *  **仅当该 Run 的最终结果非成功**（failed / timeout / cancelled）时，取 `steps` 中
 *  最后一条 `failed` / `timeout` step（超时 step 同样计入）；**成功的 Run 一律不显示失败节点（界面渲染 `-`）**。
 *  返回 null 即表示界面显示 `-`（与 §12.4 示例中 check_tests 成功行显示 `-` 一致）。
 *  后端无 failedNode 字段，本字段为前端聚合计算值。 */
function failedStepOf(run) {
  if (!run || !run.steps) return null;
  if (run.status === 'success') return null;   // N14：成功的 Run（即使中间有 failed 记录，以最终结果为准）不显示失败节点
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

/** M3：RunResult（proposal-01 §12.3 / crud-05 3.5「JobRun 对象」）——**不落库**，详情接口按 steps 聚合。
 *  target=op → outputs + 执行摘要（rawOutput / error / exitCode / timedOut）；=workflow → outputs + durationMs；
 *  无 steps（如刚创建、尚未调度）→ null。 */
function runResultOf(run) {
  if (!run || !(run.steps || []).length) return null;
  var last = run.steps[run.steps.length - 1];
  var res = { outputs: last.outputs || {} };
  if (run.target && run.target.kind === 'op') {
    res.rawOutput = last.rawOutput || '';
    res.error = (last.error == null ? null : last.error);
    res.exitCode = (last.exitCode == null ? null : last.exitCode);
    res.timedOut = last.timedOut === true;
  }
  res.durationMs = (last.durationMs == null ? null : last.durationMs);
  return res;
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

// 恢复默认（POST /api/settings/reset，crud-06 3.5）的基准快照：在**派生计算之前**取，只含文件内定义的基础默认值
var SETTINGS_DEFAULT = JSON.parse(JSON.stringify(SETTINGS));

// 只读配置项（crud-06：不可 PUT 修改，reset 时也不参与重置）：
//   db_path / workspace_root / config_version / db_version —— 由 CLI 入口与迁移决定，非用户可配
//   worker_pool_size / worker_max_concurrency —— **派生只读**（由 job_queue_running_max 计算得出）
var READONLY_SETTING_KEYS = ['db_path', 'workspace_root', 'config_version', 'db_version', 'worker_pool_size', 'worker_max_concurrency'];

/* 可配置项的数值上限（R6-G2：由 /api/settings 局部变量上移为模块级常量，页面导入处复用 `op.op_import_max_bytes`） */
var SETTING_LIMITS = {
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

// 派生只读项重算（首次加载 / PUT 保存 / reset 共用同一逻辑）
function __deriveWorkerPool() {
  var runMax = parseInt(SETTINGS.history.job_queue_running_max, 10) || 10;
  var pool = Math.ceil(runMax * 1.5);
  SETTINGS.worker.worker_pool_size = String(pool);
  SETTINGS.worker.worker_max_concurrency = String(pool);
}

// Worker 池为派生只读值：**数值派生自同一配置**（job_queue_running_max），但语义与「Task Runner 并发阈值」不同：
//   并发阈值 = 同时 running 的 JobRun 数上限（= job_queue_running_max）
//   池大小   = 常驻 Worker（执行体）数量 = ceil(job_queue_running_max × 1.5)，一个 JobRun 可并行多个 step
__deriveWorkerPool();

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
    run.durationMs = run.startedAtMs == null ? null : Number(run.finishedAtMs) - Number(run.startedAtMs);   // 从未开始执行即取消 → durationMs 保持 null
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
  newRun.startedAtMs = null;   // crud-05 3.5.0 / proposal-01 §12.3：waiting 记录 startedAtMs 为 null（无开始时间，不匹配任何 timeRange 档）
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
    c.runId = newRun.runId;   // crud-05 3.5.0：StepRecord.runId 引用所属 job_runs.run_id（重跑/重试须一并重置）
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

/**
 * 单次执行（virtual Job）—— crud-02 3.2.6 `POST /api/ops/{opId}/execute`、crud-03 3.3.6 `POST /api/workflows/{workflowId}/execute`：
 * 创建 virtual JobRun（job_kind=virtual、job_version=NULL、triggered_by=single_op / single_workflow、status=waiting），
 * **入参取请求体的 inputs（入参名值对）、工作区取请求体的 workspace**，投递后台执行并返回 runId。
 * required 入参缺值 / workspace 为空 → 返回 null（调用方按 400 VALIDATION_ERROR 处理）。
 */
function __createVirtualRun(kind, def, inputs, workspace) {
  if (!def) return null;
  inputs = inputs || {};
  if (!workspace) return null;
  if (kind === 'op') {
    var missing = (def.inputs || []).some(function (i) {
      return i.required === true && (inputs[i.name] == null || String(inputs[i.name]) === '');
    });
    if (missing) return null;
  }
  var now = Date.now();
  var runId = __uid32();
  var run = {
    runId: runId,
    name: def.name,
    jobId: __uid32(),                     // virtual Run 无对应 Job 行，合成 id 满足 NOT NULL
    jobKind: 'virtual',
    jobVersion: null,                     // virtual Run 无 Job 修订号
    triggeredBy: kind === 'op' ? 'single_op' : 'single_workflow',
    target: kind === 'op'
      ? { kind: 'op', opId: def.opId, opVersion: def.version, workflowId: null, workflowVersion: null, name: def.name }
      : { kind: 'workflow', opId: null, opVersion: null, workflowId: def.workflowId, workflowVersion: def.version, name: def.name },
    inputs: inputs,
    workspace: workspace,
    status: 'waiting',
    terminatedBy: null,
    timeoutStepId: null,
    timeoutOpName: null,
    steps: [],
    retryFromRunId: null,
    retryFromStepId: null,
    startedAtMs: null,   // waiting 记录 startedAtMs 为 null（开始时间由运行器置 running 时写入；crud-05 3.5.0）
    finishedAtMs: null,
    durationMs: null,
    createdAtMs: String(now),
    updatedAtMs: String(now)
  };
  var mkStep = function (op, stepId, clientId) {
    return {
      recordId: __uid32(), stepId: stepId, activationSeq: 1, retrySeq: 1,
      opId: op.opId, opVersion: op.version, opName: op.name,
      clientId: clientId || null,
      status: 'waiting', inputs: inputs, bodySnapshot: op.content || '',
      outputs: null, rawOutput: '', exitCode: null, error: null,
      timeoutMs: (parseInt(op.timeoutSeconds, 10) || 60) * 1000,   // crud-05 3.5.0：timeoutMs = OP.timeoutSeconds × 1000
      timedOut: false, startedAtMs: null, finishedAtMs: null, durationMs: null,
      runId: runId, source: kind === 'op' ? 'job' : 'step',
      workspace: workspace, notBeforeMs: null, createdAtMs: String(now)
    };
  };
  if (kind === 'op') {
    run.steps = [mkStep(def, runId, null)];   // 单次 OP：stepId = runId（crud-05 3.5.0）
  } else {
    var wf = def;
    run.steps = (wf.nodes || []).filter(function (n) { return n.kind === 'op'; }).map(function (n) {
      var op = OP_BY_ID[n.opId];
      return op ? mkStep(op, n.workflowNodeId, n.clientId) : null;
    }).filter(Boolean);
  }
  RUNS.unshift(run);
  RUN_BY_ID[runId] = run;
  return run;
}

/**
 * 持久 Job 手动运行（N4）—— crud-04 3.4.9 / 4.8 `POST /api/jobs/{jobId}/run`：
 * 创建 JobRun（job_kind=persistent、job_version=Job 当前修订号、triggered_by=manual、status=waiting），
 * **快照 name / target / inputs / workspace**（与单次执行 __createVirtualRun 同思路，差异仅在 job_kind/job_id/triggered_by），
 * 按其 target 展开 waiting steps 并写入 RUNS / RUN_BY_ID，返回新 Run。
 */
function __createJobRun(job) {
  if (!job || !job.target) return null;
  var t = job.target;
  var now = Date.now();
  var runId = __uid32();
  var tName = targetNameOf(job);
  var inputs = JSON.parse(JSON.stringify(job.inputs || {}));
  var run = {
    runId: runId,
    name: job.name,                         // 名称快照（§12.4：persistent = 运行时 Job 名）
    jobId: job.jobId,
    jobKind: 'persistent',
    jobVersion: job.version,
    triggeredBy: 'manual',                  // crud-04 4.8：手动运行固定 triggered_by=manual
    target: t.kind === 'op'
      ? { kind: 'op', opId: t.opId, opVersion: t.opVersion, workflowId: null, workflowVersion: null, name: tName }
      : { kind: 'workflow', opId: null, opVersion: null, workflowId: t.workflowId, workflowVersion: t.workflowVersion, name: tName },
    inputs: inputs,
    workspace: job.workspace,
    status: 'waiting',
    terminatedBy: null,
    timeoutStepId: null,
    timeoutOpName: null,
    steps: [],
    retryFromRunId: null,
    retryFromStepId: null,
    startedAtMs: null,   // waiting 记录 startedAtMs 为 null（crud-05 3.5.0）
    finishedAtMs: null,
    durationMs: null,
    createdAtMs: String(now),
    updatedAtMs: String(now)
  };
  var mkStep = function (op, stepId, clientId, source) {
    return {
      recordId: __uid32(), stepId: stepId, activationSeq: 1, retrySeq: 1,
      opId: op.opId, opVersion: op.version, opName: op.name,
      clientId: clientId || null,
      status: 'waiting', inputs: inputs, bodySnapshot: op.content || '',
      outputs: null, rawOutput: '', exitCode: null, error: null,
      timeoutMs: (parseInt(op.timeoutSeconds, 10) || 60) * 1000,   // crud-05 3.5.0：timeoutMs = OP.timeoutSeconds × 1000
      timedOut: false, startedAtMs: null, finishedAtMs: null, durationMs: null,
      runId: runId, source: source,
      workspace: job.workspace, notBeforeMs: null, createdAtMs: String(now)
    };
  };
  if (t.kind === 'op') {
    var jobOp = OP_BY_ID[t.opId];
    if (!jobOp) return null;
    run.steps = [mkStep(jobOp, runId, t.clientId, 'job')];   // target=op：stepId = runId（crud-05 3.5.0）
  } else {
    var jobWf = WORKFLOW_BY_ID[t.workflowId];
    if (!jobWf) return null;
    run.steps = (jobWf.nodes || []).filter(function (n) { return n.kind === 'op'; }).map(function (n) {
      var op = OP_BY_ID[n.opId];
      return op ? mkStep(op, n.workflowNodeId, n.clientId || (t.kind === 'op' ? t.clientId : null), 'step') : null;
    }).filter(Boolean);
  }
  RUNS.unshift(run);
  RUN_BY_ID[runId] = run;
  return run;
}

/* ==================== Workflow DAG 校验（R6-G1） ====================
   crud-03 3.3.6 `POST /api/workflows/{workflowId}/validate` → `{valid, errors}`：
   「DAG 校验: 连通性、Start/End 存在、节点字段合法（允许回跳环，运行时计数终止）」。
   规则集 = proposal-01-界面设计.md §10.14 的 **11 条**；errors 用同节的 **8 条失败文案**（缺少 Start / 缺少 End /
   Start 有入边 / End 有出边 / Start 无出边 / End 无入边 / 节点从 Start 不可达 / 节点无法到达 End），
   其余 3 条规则（无环、required 入参有来源、多入边节点有明确汇聚）按同一措辞风格补充。
   回跳环：§10.14 注「循环回跳由重试 + 条件边实现，不算环」→ on_failure 条件边不参与环判定。 */
var WF_LOOP_EDGE_CONDITION = 'on_failure';

/** 从 root 出发沿邻接表可达的节点集合（传反图即得「能到达 root」的集合） */
function __reachableSet(root, adj) {
  var seen = {};
  if (!root || adj[root] === undefined) return seen;
  var stack = [root];
  while (stack.length) {
    var cur = stack.pop();
    if (seen[cur]) continue;
    seen[cur] = true;
    (adj[cur] || []).forEach(function (t) { stack.push(t); });
  }
  return seen;
}

/** DFS 找环（忽略 on_failure 回跳边）；返回环路径文案（如 `node_a → node_b → node_a`），无环返回 null */
function __findWfCycle(nodes, edges, adj) {
  var labelMap = {};
  nodes.forEach(function (n) { labelMap[n.workflowNodeId] = n.label || n.workflowNodeId; });
  var g = {};
  nodes.forEach(function (n) { g[n.workflowNodeId] = []; });
  edges.forEach(function (e) {
    if (adj[e.from] === undefined || adj[e.to] === undefined) return;   // 悬挂边另计
    if (e.condition === WF_LOOP_EDGE_CONDITION) return;                  // 回跳边不算环
    g[e.from].push(e.to);
  });
  var state = {}, path = [], found = null;
  var visit = function (id) {
    if (found) return;
    state[id] = 1;
    path.push(id);
    (g[id] || []).forEach(function (to) {
      if (found) return;
      if (state[to] === 1) found = path.slice(path.indexOf(to)).concat([to]);
      else if (!state[to]) visit(to);
    });
    if (!found) { state[id] = 2; path.pop(); }
  };
  nodes.forEach(function (n) { if (!found && !state[n.workflowNodeId]) visit(n.workflowNodeId); });
  if (!found) return null;
  return found.map(function (id) { return labelMap[id]; }).join(' → ');
}

/** Workflow DAG 校验内核：返回 { valid, errors }（errors 为空即通过） */
function validateWorkflowOf(wf) {
  if (!wf) return { valid: false, errors: ['Workflow 不存在'] };
  var errors = [];
  var nodes = wf.nodes || [];
  var edges = wf.edges || [];
  var ofKind = function (k) { return nodes.filter(function (n) { return n.kind === k; }); };
  var starts = ofKind('start'), ends = ofKind('end'), opNodes = ofKind('op');

  /* 规则 1 / 2：有且仅有一个 Start / 有且仅有一个 End */
  if (!starts.length) errors.push('Workflow 缺少 Start 节点');
  else if (starts.length > 1) errors.push('Workflow 只能有一个 Start 节点（当前 ' + starts.length + ' 个）');
  if (!ends.length) errors.push('Workflow 缺少 End 节点');
  else if (ends.length > 1) errors.push('Workflow 只能有一个 End 节点（当前 ' + ends.length + ' 个）');
  var sid = starts.length ? starts[0].workflowNodeId : null;
  var eid = ends.length ? ends[0].workflowNodeId : null;

  var inDeg = {}, outDeg = {}, adj = {}, rev = {};
  nodes.forEach(function (n) {
    inDeg[n.workflowNodeId] = 0; outDeg[n.workflowNodeId] = 0;
    adj[n.workflowNodeId] = []; rev[n.workflowNodeId] = [];
  });
  var dangling = 0;
  edges.forEach(function (e) {
    if (adj[e.from] === undefined || adj[e.to] === undefined) { dangling++; return; }
    outDeg[e.from]++; inDeg[e.to]++;
    adj[e.from].push(e.to); rev[e.to].push(e.from);
  });
  if (dangling) errors.push('有 ' + dangling + ' 条连线引用了不存在的节点');

  /* 规则 3 / 4 / 5 / 6：Start 无入边、End 无出边、Start 至少一条出边、End 至少一条入边 */
  if (sid) {
    if (inDeg[sid] > 0) errors.push('Start 节点不能有入边');
    if (outDeg[sid] === 0) errors.push('Start 节点至少需要一条出边');
  }
  if (eid) {
    if (outDeg[eid] > 0) errors.push('End 节点不能有出边');
    if (inDeg[eid] === 0) errors.push('End 节点至少需要一条入边');
  }

  /* 规则 7 / 8：所有 OP 节点从 Start 可达 / 能到达 End */
  var reach = __reachableSet(sid, adj);
  var toEnd = __reachableSet(eid, rev);
  opNodes.forEach(function (n) {
    var lbl = n.label || n.workflowNodeId;
    if (!reach[n.workflowNodeId]) errors.push('节点 ' + lbl + ' 从 Start 不可达');
    if (!toEnd[n.workflowNodeId]) errors.push('节点 ' + lbl + ' 无法到达 End');
  });

  /* 规则 9：DAG 无环（循环回跳除外） */
  var cyc = __findWfCycle(nodes, edges, adj);
  if (cyc) errors.push('DAG 存在环 ' + cyc + '（回跳请用 on_failure 条件边 + 重试）');

  /* 规则 10：所有 required 入参必须有来源 —— OP 节点必填入参必须有绑定，Workflow required 入参必须被节点引用 */
  var wfInputUsed = {};
  opNodes.forEach(function (n) {
    var lbl = n.label || n.workflowNodeId;
    var opDef = OP_BY_ID[n.opId];
    if (!opDef) { errors.push('节点 ' + lbl + ' 引用的 OP 不存在'); return; }
    var bindings = n.bindings || {};
    (opDef.inputs || []).forEach(function (i) {
      if (i.required !== true) return;
      if (!bindings[i.name]) errors.push('节点 ' + lbl + ' 的 required 入参 ' + i.name + ' 没有来源');
    });
    Object.keys(bindings).forEach(function (k) {
      var b = bindings[k] || {};
      if (b.kind === 'workflow_input') wfInputUsed[b.inputName] = true;
    });
  });
  (wf.inputs || []).forEach(function (i) {
    if (i.required === true && !wfInputUsed[i.name]) errors.push('Workflow 的 required 入参 ' + i.name + ' 没有来源');
  });

  /* 规则 11：有多条入边的节点必须有明确汇聚（入度 > 1 的节点，其 required 入参必须各有来源） */
  opNodes.forEach(function (n) {
    if (inDeg[n.workflowNodeId] <= 1) return;
    var opDef = OP_BY_ID[n.opId];
    if (!opDef) return;
    (opDef.inputs || []).forEach(function (i) {
      if (i.required !== true) return;
      var b = (n.bindings || {})[i.name];
      if (!b || !b.kind) {
        errors.push('节点 ' + (n.label || n.workflowNodeId) + ' 有 ' + inDeg[n.workflowNodeId] + ' 条入边，required 入参 ' + i.name + ' 没有明确汇聚来源');
      }
    });
  });

  return { valid: errors.length === 0, errors: errors };
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
          var READONLY = READONLY_SETTING_KEYS;   // 只读项（含派生只读的 worker 池）参与校验，但一律不写入
          var LIMITS = SETTING_LIMITS;   // R6-G2：上限表已上移为模块级常量（同一份来源，页面导入处复用 op_import_max_bytes）
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
          if (errs.length) return resolve(__err('VALIDATION_ERROR', errs.join('；')));
          Object.keys(upd).forEach(function (g) {
            Object.keys(upd[g] || {}).forEach(function (k) {
              if (READONLY.indexOf(k) < 0) SETTINGS[g][k] = String(upd[g][k]);
            });
          });
          __deriveWorkerPool();   // 可配置项变更后重算派生只读项
        }
        return resolve(SETTINGS);
      }
      if (path === '/api/settings/reset') {
        // crud-06 3.5：重置为**内置默认值**（只读项不参与），返回重置后的配置。
        // 只读项 db_path / workspace_root / config_version / db_version 由 CLI 入口与迁移决定，保持现状；
        // worker 池为派生只读值，按默认的 job_queue_running_max 重新派生（结果与首次加载一致）。
        Object.keys(SETTINGS).forEach(function (g) {
          if (!SETTINGS_DEFAULT[g] || typeof SETTINGS_DEFAULT[g] !== 'object') return;   // runDir 等标量字段不参与重置
          Object.keys(SETTINGS[g]).forEach(function (k) {
            if (READONLY_SETTING_KEYS.indexOf(k) >= 0) return;
            SETTINGS[g][k] = SETTINGS_DEFAULT[g][k];
          });
        });
        __deriveWorkerPool();
        return resolve(SETTINGS);
      }
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
          var cCreateErrs = __nameErrs(body && body.name);   // R6-M1 / R6-G3：name 空或超 512 → 400 VALIDATION_ERROR（与 jobs 分支同口径）
          if (cCreateErrs.length) return resolve(__err('VALIDATION_ERROR', cCreateErrs.join('；')));
          if (body && CLIENT_BY_NAME[body.name]) return resolve(__err('CLIENT_NAME_EXISTS', 'Client 名称已存在: ' + body.name));
          var nb = Object.assign({}, body); delete nb.clientId; delete nb.createdAtMs; delete nb.updatedAtMs;
          var nc = Object.assign({ clientId: __uid32(), createdAtMs: String(Date.now()), updatedAtMs: String(Date.now()) }, nb);
          CLIENTS.push(nc); CLIENT_BY_ID[nc.clientId] = nc; CLIENT_BY_NAME[nc.name] = nc;
          return resolve(nc);
        }
        // crud-01 3.1.1：列表响应统一为 { items, total, page, page_size }（mock 固定单页返回全部）
        return resolve({ items: CLIENTS, total: CLIENTS.length, page: 1, page_size: 10 });
      }
      if (path === '/api/ops') {
        if (method === 'POST') {
          var oCreateErrs = __nameErrs(body && body.name);   // R6-M1 / R6-G3：name 空或超 512 → 400 VALIDATION_ERROR
          if (oCreateErrs.length) return resolve(__err('VALIDATION_ERROR', oCreateErrs.join('；')));
          if (body && OP_BY_NAME[body.name]) return resolve(__err('OP_NAME_EXISTS', 'OP 名称已存在: ' + body.name));
          var nb = Object.assign({}, body); delete nb.opId; delete nb.version; delete nb.createdAtMs; delete nb.updatedAtMs;
          var no = Object.assign({ opId: __uid32(), version: 1, timeoutSeconds: 60, interactive: false, inputs: [], outputs: [], createdAtMs: String(Date.now()), updatedAtMs: String(Date.now()) }, nb);
          OPS.push(no); OP_BY_ID[no.opId] = no; OP_BY_NAME[no.name] = no;
          return resolve(no);
        }
        // crud-02 3.2.1：列表响应 { items, total, page, page_size }
        return resolve({ items: OPS, total: OPS.length, page: 1, page_size: 10 });
      }
      if (path === '/api/workflows') {
        if (method === 'POST') {
          var wCreateErrs = __nameErrs(body && body.name);   // R6-M1 / R6-G3：name 空或超 512 → 400 VALIDATION_ERROR
          if (wCreateErrs.length) return resolve(__err('VALIDATION_ERROR', wCreateErrs.join('；')));
          if (body && WORKFLOW_BY_NAME[body.name]) return resolve(__err('WORKFLOW_NAME_EXISTS', 'Workflow 名称已存在: ' + body.name));
          var nb = Object.assign({}, body); delete nb.workflowId; delete nb.version; delete nb.createdAtMs; delete nb.updatedAtMs;
          var nw = Object.assign({ workflowId: __uid32(), version: 1, nodes: [], edges: [], inputs: [], outputs: [], createdAtMs: String(Date.now()), updatedAtMs: String(Date.now()) }, nb);
          WORKFLOWS.push(nw); WORKFLOW_BY_ID[nw.workflowId] = nw; WORKFLOW_BY_NAME[nw.name] = nw;
          return resolve(nw);
        }
        // crud-03 3.3.1：列表响应 { items, total, page, page_size }
        return resolve({ items: WORKFLOWS, total: WORKFLOWS.length, page: 1, page_size: 10 });
      }
      if (path === '/api/jobs') {
        if (method === 'POST') {
          // crud-04 3.4.3：target / trigger 缺失或非法、workspace 缺失/空、target=op 缺 target.clientId → 400 VALIDATION_ERROR（先校验后落库）
          var newJobErrs = [];
          newJobErrs = newJobErrs.concat(__nameErrs(body && body.name));   // R6-M1 / R6-G3：name 空或超 512 统一口径
          if (!body || !body.target || (body.target.kind !== 'op' && body.target.kind !== 'workflow')) newJobErrs.push('target 非法');
          else if (body.target.kind === 'op' && !body.target.clientId) newJobErrs.push('target=op 时必须提供 target.clientId');
          if (!body || !body.trigger || (body.trigger.kind !== 'manual' && body.trigger.kind !== 'schedule')) newJobErrs.push('trigger 缺失/非法');
          if (!body || !body.workspace) newJobErrs.push('workspace 缺失/空');
          if (newJobErrs.length) return resolve(__err('VALIDATION_ERROR', newJobErrs.join('；')));
          if (JOB_BY_NAME[body.name]) return resolve(__err('JOB_NAME_EXISTS', 'Job 名称已存在: ' + body.name));
          var nb = Object.assign({}, body); delete nb.jobId; delete nb.version; delete nb.createdAtMs; delete nb.updatedAtMs;
          var nj = Object.assign({ jobId: __uid32(), version: 1, kind: 'persistent', target: null, trigger: null, enabled: true, inputs: {}, concurrency: 'skip', needsUpdate: false, createdAtMs: String(Date.now()), updatedAtMs: String(Date.now()) }, nb);
          nj.needsUpdate = needsUpdateOfJob(nj);   // needsUpdate 为服务端计算字段（不落库）
          JOBS.push(nj); JOB_BY_ID[nj.jobId] = nj; JOB_BY_NAME[nj.name] = nj;
          return resolve(nj);
        }
        // crud-04 3.4.1：列表项额外含 lastRun（**固定 5 字段摘要**：runId/status/startedAtMs/finishedAtMs/durationMs，可为 null）
        return resolve({
          items: JOBS.map(function (j) { return Object.assign({}, j, { lastRun: lastRunSummaryOf(j.jobId) }); }),
          total: JOBS.length, page: 1, page_size: 10
        });
      }
      // crud-05 3.5.1：列表响应 { items, total, page, page_size }
      if (path === '/api/runs') return resolve({ items: RUNS, total: RUNS.length, page: 1, page_size: 10 });

      /* ---------- 导入（D7=A：mock 校验重名 409；实际创建默认对象；须先于 ops/workflows/jobs 子资源判断，避免被 {id} 分支拦截） ---------- */
      if (path === '/api/ops/import') {
        // crud-02 3.2.8：请求体 `{ yaml }` 为 **YAML 文本内容**；R6-G2：页面必须提交所选文件内容（不得用文件名伪造 YAML）。
        // mock 从 YAML 文本解析 name / type / description / content / timeoutSeconds（简化行解析）；
        // name 缺失、type 缺失或非法 → 400 VALIDATION_ERROR（crud-02 3.2.8）。
        var ioYaml = (body && body.yaml) || '';
        var iopName = String((ioYaml.match(/^name:\s*(.+)$/m) || [])[1] || (body && body.name) || '').trim();
        var iopType = String((ioYaml.match(/^type:\s*(.+)$/m) || [])[1] || (body && body.type) || '').trim();
        var iopTimeout = parseInt((ioYaml.match(/^timeoutSeconds:\s*(\d+)/m) || [])[1], 10);
        var ioErrs = [];
        if (!iopName) ioErrs.push('导入的 YAML 缺少 name 字段');
        if (!iopType) ioErrs.push('导入的 YAML 缺少 type 字段');
        else if (['prompt', 'bash', 'python', 'powershell'].indexOf(iopType) < 0) ioErrs.push('导入的 YAML type 非法: ' + iopType);
        if (ioErrs.length) return resolve(__err('VALIDATION_ERROR', ioErrs.join('；')));
        if (OP_BY_NAME[iopName]) return resolve(__err('OP_NAME_EXISTS', '同名 OP 已存在（导入冲突）: ' + iopName));   // X7：crud-02 3.2.8
        var iop = {
          opId: __uid32(), name: iopName, type: iopType, version: 1,
          description: (ioYaml.match(/^description:\s*(.+)$/m) || [])[1] || '导入的 OP',
          content: (ioYaml.match(/^content:\s*(.+)$/m) || [])[1] || (body && body.content) || '',
          timeoutSeconds: isNaN(iopTimeout) ? 60 : iopTimeout,   // crud-02 3.2.8：缺省 timeoutSeconds=60；YAML 给出时以文件内容为准
          interactive: false, inputs: [], outputs: [], createdAtMs: String(Date.now()), updatedAtMs: String(Date.now())
        };
        OPS.push(iop); OP_BY_ID[iop.opId] = iop; OP_BY_NAME[iop.name] = iop;
        return resolve(iop);   // crud-02 3.2.8：返回导入创建的 OP 对象
      }
      if (path === '/api/workflows/import') {
        // crud-03 3.3.9：请求体 { zip: <base64> }（导入请求体只含 zip，再无 yaml），同名 → 409。
        // mock 无法真正解包 ZIP：名称取 body.name（调用方可随请求带出文件名）或默认值，包内依赖复用等行为均为模拟。
        if (!body || !body.zip) return resolve(__err('VALIDATION_ERROR', '导入请求体缺少 zip 字段'));
        var iwfName = (body && body.name) || 'imported_workflow';
        if (WORKFLOW_BY_NAME[iwfName]) return resolve(__err('WORKFLOW_NAME_EXISTS', '同名 Workflow 已存在（导入冲突）: ' + iwfName));   // X7：crud-03 3.3.9
        // 模拟「按 manifest 复用依赖」：以默认骨架（仅 Start + End）创建；依赖复用版本不一致的 warnings 模拟场景略
        var iwfSid = __uid32(), iwfEid = __uid32();
        var iwf = {
          workflowId: __uid32(), name: iwfName, version: 1, description: '导入的 Workflow',
          inputs: [], outputs: [],
          nodes: [
            { workflowNodeId: iwfSid, label: 'node_start', kind: 'start', position: { x: 40, y: 175 } },
            { workflowNodeId: iwfEid, label: 'node_end', kind: 'end', position: { x: 620, y: 175 } }
          ],
          edges: [], createdAtMs: String(Date.now()), updatedAtMs: String(Date.now())
        };
        WORKFLOWS.push(iwf); WORKFLOW_BY_ID[iwf.workflowId] = iwf; WORKFLOW_BY_NAME[iwf.name] = iwf;
        return resolve(iwf);   // crud-03 3.3.9：返回导入创建的 Workflow 对象
      }
      if (path === '/api/jobs/import') {
        // crud-04 3.4.10：请求体 { zip: <base64> }（导入请求体只含 zip，再无 yaml），同名 → 409。
        // mock 无法真正解包 ZIP：名称取 body.name（调用方可随请求带出文件名）或默认值，依赖复用均为模拟。
        if (!body || !body.zip) return resolve(__err('VALIDATION_ERROR', '导入请求体缺少 zip 字段'));
        var ijobName = (body && body.name) || 'imported_job';
        if (JOB_BY_NAME[ijobName]) return resolve(__err('JOB_NAME_EXISTS', '同名 Job 已存在（导入冲突）: ' + ijobName));   // X7：crud-04 3.4.10
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
          if (CLIENT_BY_NAME[icName]) return resolve(__err('CLIENT_NAME_EXISTS', '同名 Client 已存在（导入冲突）: ' + icName));   // crud-01 3.1.8
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
            if (cl.argsTemplate) cy += 'argsTemplate: ' + cl.argsTemplate + '\n';   // 参数模板为字符串（DB 直接存字符串）
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
          if (cRefJob) return resolve(__err('CLIENT_REFERENCED', 'Client 正被 Job「' + cRefJob.name + '」引用，删除被拒绝'));
          var ci = CLIENTS.findIndex(function (c) { return c.clientId === cid; });
          if (ci >= 0) { delete CLIENT_BY_NAME[CLIENTS[ci].name]; CLIENTS.splice(ci, 1); delete CLIENT_BY_ID[cid]; }
          return resolve({ ok: true });
        }
        if (method === 'PUT' && cl) {
          // crud-01 3.1.4（N5）：PUT 前做**重名校验**——修改后的 name 与其他 Client 冲突 → 409 CLIENT_NAME_EXISTS；
          // 并通过 CLIENT_BY_NAME 先删旧键、后写新键，保证名称索引与实体一致（否则改名后索引错位）
          var clUpd = Object.assign({}, body);
          if (clUpd.name !== undefined) {   // R6-G3：更新入口同样校验名称边界（400 VALIDATION_ERROR）
            var clUpdErrs = __nameErrs(clUpd.name);
            if (clUpdErrs.length) return resolve(__err('VALIDATION_ERROR', clUpdErrs.join('；')));
          }
          if (clUpd.name && clUpd.name !== cl.name && CLIENT_BY_NAME[clUpd.name]) {
            return resolve(__err('CLIENT_NAME_EXISTS', 'Client 名称已存在: ' + clUpd.name));
          }
          delete CLIENT_BY_NAME[cl.name];
          Object.assign(cl, clUpd, { clientId: cid, updatedAtMs: String(Date.now()) });
          CLIENT_BY_NAME[cl.name] = cl;
          return resolve(cl);
        }
        return resolve(cl || null);
      }

      /* ---------- OP 子资源 ---------- */
      if (parts[1] === 'ops' && parts[2]) {
        var op = OP_BY_ID[parts[2]];
        if (parts[3] === 'execute') {
          // crud-02 3.2.6：POST /api/ops/{opId}/execute —— 单次执行（virtual Job）；入参 / 工作区取自请求体
          var exRun = __createVirtualRun('op', op, (body || {}).inputs, (body || {}).workspace);
          if (!exRun) return resolve(__err('VALIDATION_ERROR', '单次执行缺少必填入参或工作区'));
          return resolve({ runId: exRun.runId });
        }
        if (parts[3] === 'export') return resolve({ yaml: 'name: ' + (op ? op.name : '') + '\ntype: ' + (op ? op.type : '') + '\n' });
        if (method === 'PUT' && op) {
          // crud-02 3.2.4：请求体 {op, bumpVersion}；bumpVersion=true → version+1，false → 覆盖当前版本
          var opUpd = Object.assign({}, body.op || {});
          if (opUpd.name !== undefined) {   // R6-G3：更新入口同样校验名称边界（400 VALIDATION_ERROR）
            var opUpdErrs = __nameErrs(opUpd.name);
            if (opUpdErrs.length) return resolve(__err('VALIDATION_ERROR', opUpdErrs.join('；')));
          }
          if (opUpd.name && opUpd.name !== op.name && OP_BY_NAME[opUpd.name]) return resolve(__err('OP_NAME_EXISTS', 'OP 名称已存在: ' + opUpd.name));
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
            return resolve(__err('OP_REFERENCED', 'OP 正被 ' + opRefBy + ' 引用，删除被拒绝'));
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
        if (parts[3] === 'execute') {
          // crud-03 3.3.6：POST /api/workflows/{workflowId}/execute —— 单次执行（virtual Job）；入参 / 工作区取自请求体
          var exWfRun = __createVirtualRun('workflow', wf, (body || {}).inputs, (body || {}).workspace);
          if (!exWfRun) return resolve(__err('VALIDATION_ERROR', '单次执行缺少工作区'));
          return resolve({ runId: exWfRun.runId });
        }
        if (parts[3] === 'validate') {
          // R6-G1：真实 DAG 校验（规则 / 文案见 validateWorkflowOf 头部注释；crud-03 3.3.6）
          if (!wf) return resolve(__err('WORKFLOW_NOT_FOUND', 'Workflow 不存在: ' + parts[2]));
          return resolve(validateWorkflowOf(wf));
        }
        if (parts[3] === 'needs-update') {
          var outs = outdatedNodesOf(wf);   // 与 outdated-nodes 共用同一判定内核（crud-03 3.3.10 与 3.3.11 计算结果一致）
          return resolve({ needsUpdate: outs.length > 0, outdatedNodes: outs });
        }
        // crud-03 3.3.11：GET /api/workflows/{id}/outdated-nodes 返回**裸数组**（真实计算的需更新节点 id 列表）
        if (parts[3] === 'outdated-nodes') return resolve(outdatedNodesOf(wf));
        if (parts[3] === 'export') return resolve({ zip: 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==' });
        if (method === 'PUT' && wf) {
          // crud-03 3.3.4：请求体 {workflow, bumpVersion}
          var wfUpd = Object.assign({}, body.workflow || {});
          if (wfUpd.name !== undefined) {   // R6-G3：更新入口同样校验名称边界（400 VALIDATION_ERROR）
            var wfUpdErrs = __nameErrs(wfUpd.name);
            if (wfUpdErrs.length) return resolve(__err('VALIDATION_ERROR', wfUpdErrs.join('；')));
          }
          if (wfUpd.name && wfUpd.name !== wf.name && WORKFLOW_BY_NAME[wfUpd.name]) return resolve(__err('WORKFLOW_NAME_EXISTS', 'Workflow 名称已存在: ' + wfUpd.name));
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
          if (wfRefJob) return resolve(__err('WORKFLOW_REFERENCED', 'Workflow 正被 Job「' + wfRefJob.name + '」引用，删除被拒绝'));
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
        if (parts[3] === 'run') {
          // crud-04 3.4.9 / 4.8（N4）：手动触发一次 Job 执行——**创建 JobRun 并进入运行历史**
          // （triggeredBy=manual、status=waiting），返回 { runId }，前端随后跳转运行历史查看状态流转。
          var nrj = __createJobRun(job);
          if (!nrj) return resolve(__err('JOB_NOT_FOUND', 'Job 不存在: ' + parts[2]));
          return resolve({ runId: nrj.runId });
        }
        if (parts[3] === 'enable' && job) { job.enabled = true; job.updatedAtMs = String(Date.now()); return resolve(job); }
        if (parts[3] === 'disable' && job) { job.enabled = false; job.updatedAtMs = String(Date.now()); return resolve(job); }
        if (parts[3] === 'export') return resolve({ zip: 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==' });
        if (parts[3] === 'last-run') return resolve(lastRunOfJob(parts[2]));
        if (parts[3] === 'needs-update') return resolve({ needsUpdate: needsUpdateOfJob(job) });   // crud-04 3.4.12
        if (method === 'PUT' && job) {
          // crud-04 3.4.4：请求体 {job, bumpVersion}；job 为**完整 JobCreateRequest（全量替换）**——
          // 未出现在请求体里的配置字段（target / trigger / inputs / workspace …）一律清空，不留旧值残余；
          // jobId / version / createdAtMs / updatedAtMs / needsUpdate 为服务端字段，不由请求体决定。
          var jobUpd = Object.assign({}, body.job || {});
          if (jobUpd.name !== undefined) {   // R6-G3：更新入口同样校验名称边界（400 VALIDATION_ERROR）
            var jobUpdErrs = __nameErrs(jobUpd.name);
            if (jobUpdErrs.length) return resolve(__err('VALIDATION_ERROR', jobUpdErrs.join('；')));
          }
          if (jobUpd.name && jobUpd.name !== job.name && JOB_BY_NAME[jobUpd.name]) return resolve(__err('JOB_NAME_EXISTS', 'Job 名称已存在: ' + jobUpd.name));
          delete jobUpd.jobId; delete jobUpd.version; delete jobUpd.createdAtMs; delete jobUpd.updatedAtMs;
          if (!('enabled' in jobUpd)) jobUpd.enabled = true;   // crud-04 3.4.3：enabled 可省略，默认 true
          var jobKeepId = job.jobId, jobKeepVer = parseInt(job.version, 10) || 1;
          var jobKeepCreated = job.createdAtMs;
          delete JOB_BY_NAME[job.name];
          Object.keys(job).forEach(function (k) { delete job[k]; });   // 全量替换：先清空旧字段，再整体写入
          Object.assign(job, jobUpd, {
            jobId: jobKeepId, version: jobKeepVer, createdAtMs: jobKeepCreated,
            updatedAtMs: String(Date.now())
          });
          job.needsUpdate = needsUpdateOfJob(job);   // target 可能已变，needsUpdate 按新 target 重算（crud-04 3.4.12）
          if (body.bumpVersion === true) job.version = jobKeepVer + 1;
          JOB_BY_NAME[job.name] = job;
          return resolve(job);
        }
        if (method === 'DELETE' && job) {
          // crud-04 3.4.5：有在途实例（waiting/running/terminating）拒绝删除；终止只能在运行历史页操作（D4=B）
          var jobActive = RUNS.some(function (r) { return r.jobId === parts[2] && (r.status === 'waiting' || r.status === 'running' || r.status === 'terminating'); });
          if (jobActive) return resolve(__err('JOB_HAS_ACTIVE_RUNS', '该 Job 存在在途运行实例（waiting/running/terminating），请到运行历史终止或等待完成后再删除'));
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
          if (eErrs.length) return resolve(__err('VALIDATION_ERROR', eErrs.join('；')));
          var efNow = Date.now();
          var efRuns = RUNS.filter(function (r) {
            if (ef.status && r.status !== ef.status) return false;
            if (ef.targetKind && (!r.target || r.target.kind !== ef.targetKind)) return false;
            if (ef.jobKind && r.jobKind !== ef.jobKind) return false;
            if (ef.triggeredBy && r.triggeredBy !== ef.triggeredBy) return false;
            if (ef.workspace && r.workspace !== ef.workspace) return false;
            if (ef.version && String(r.jobVersion) !== String(ef.version)) return false;
            if (ef.timeRange) {
              var efT = r.startedAtMs ? Number(r.startedAtMs) : 0;   // waiting（startedAtMs 为空）不匹配任何 timeRange 档（crud-05 3.5.1）
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
          // M3：导出依赖 CDN 的 SheetJS；不可用时以明确错误返回（不得抛未捕获异常、也不得让 Promise 永不 settle）
          if (typeof XLSX === 'undefined') {
            return resolve(__err('EXPORT_UNAVAILABLE', '导出组件未加载（SheetJS CDN 不可达），请检查网络后重试'));
          }
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
        // crud-05 3.5.6：POST /api/runs/{runId}/terminate —— target=OP 且该 OP 步骤已开始执行 → 409 RUN_NOT_TERMINABLE
        // （判定依据 = step_records.status=running，不看 job_runs.status；故 step 仍 waiting 排队时允许取消）
        if (parts[3] === 'terminate') {
          if (run.target && run.target.kind === 'op' && (run.steps || []).some(function (s) { return s.status === 'running'; })) {
            return resolve(__err('RUN_NOT_TERMINABLE', '终止失败：OP 正在运行，不可终止'));
          }
          __applyTerminate(run);
          return resolve({ ok: true });
        }
        if (parts[3] === 'rerun') return resolve({ runId: __spawnRun(run, 'manual', true).runId });
        if (parts[3] === 'retry') return resolve({ runId: __spawnRun(run, 'retry', false).runId });
        if (parts[3] === 'steps' && parts[4]) return resolve(stepRecordsOf(run, parts[4]));
        if (parts[3] === 'steps') return resolve(run.steps || []);
        if (parts[3] === 'status') return resolve({ status: run.status, updatedAtMs: run.updatedAtMs });
        // M3：详情响应按 §12.3 附上 result（RunResult；由 steps 末条聚合，无 steps → null）
        return resolve(Object.assign({}, run, { result: runResultOf(run) }));
      }

      /* ---------- 导入（已前移至列表之后；此处仅兜底返回） ---------- */

      resolve(null);
    }, 100);
  });
}
