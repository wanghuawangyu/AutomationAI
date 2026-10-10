-- ============================================================
-- AI 自动化 —— SQLite 数据库建表脚本
-- 对应文档: proposal-02-后端设计.md
-- 字符集: UTF-8
-- 说明:
--   主键统一命名为业务属性 id (如 client_id / op_id / workflow_id / job_id /
--     run_id / event_id / node_id / record_id), 值均为 32 位无连字符
--     UUID; 子表 (nodes/step_records) 主键亦为 UUID, 由应用层 INSERT 时生成
--     (不使用 AUTOINCREMENT); edges 随 Workflow 整体存于 workflows.edges JSON 字段
--    settings 表无 id 列, key 为业务配置键 (非 UUID);
--   时间字段为 TEXT 存储毫秒时间戳字符串
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ============================================================
-- 1. clients —— Client 管理
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
    client_id       TEXT PRIMARY KEY,                    -- 32 位 UUID
    name            TEXT NOT NULL UNIQUE,
    description     TEXT,
    type            TEXT NOT NULL CHECK (type IN ('prompt','bash','python','powershell')),

    -- prompt 类型专用; bash/python/powershell 仅用 binary_path
    command         TEXT,
    args_template   TEXT,                                -- JSON 数组, 如 ["--prompt","{{prompt}}","--workspace","{{workspace}}"]
    input_mode      TEXT CHECK (input_mode IN ('arg','stdin','file')),
    output_mode     TEXT CHECK (output_mode IN ('text','json','jsonl')),
    output_json_path TEXT,
    exit_code_success TEXT,                              -- JSON 数组, 如 [0]

    -- bash/python/powershell 专用
    binary_path     TEXT,

    created_at_ms   TEXT NOT NULL,
    updated_at_ms   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(type);

-- ============================================================
-- 2. ops —— OP 管理 (最小执行单元)
-- ============================================================
CREATE TABLE IF NOT EXISTS ops (
    op_id           TEXT PRIMARY KEY,                    -- 32 位 UUID, 界面不感知
    name            TEXT NOT NULL UNIQUE,                -- 全局唯一, 界面展示
    type            TEXT NOT NULL CHECK (type IN ('prompt','bash','python','powershell')),
    description     TEXT,
    content         TEXT NOT NULL,                       -- OP 正文 (脚本/prompt 内容)
    timeout_ms      INTEGER NOT NULL DEFAULT 60000,      -- 超时毫秒, 只属于 OP
    interactive     INTEGER NOT NULL DEFAULT 0,          -- 占位, 默认 false
    version         INTEGER NOT NULL DEFAULT 1,

    -- 入参/出参定义以 JSON 数组存储
    -- inputs:  [{"name":"cmd","type":"string","required":true,"default":null,"description":"..."}]
    -- outputs: [{"name":"passed","type":"string","description":"..."}]
    inputs          TEXT NOT NULL DEFAULT '[]',
    outputs         TEXT NOT NULL DEFAULT '[]',

    created_at_ms   TEXT NOT NULL,
    updated_at_ms   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ops_type ON ops(type);
CREATE INDEX IF NOT EXISTS idx_ops_name ON ops(name);

-- ============================================================
-- 3. workflows —— Workflow 定义
-- ============================================================
CREATE TABLE IF NOT EXISTS workflows (
    workflow_id     TEXT PRIMARY KEY,                    -- 32 位 UUID
    name            TEXT NOT NULL UNIQUE,
    description     TEXT,
    version         INTEGER NOT NULL DEFAULT 1,

    -- inputs:  WorkflowInput[]  JSON
    -- outputs: WorkflowOutput[] JSON (含 from.nodeId / from.outputName)
    inputs          TEXT NOT NULL DEFAULT '[]',
    outputs         TEXT NOT NULL DEFAULT '[]',
    -- edges: WorkflowEdge[] JSON ({from,to,condition}), 随 workflow 整体读写
    edges           TEXT NOT NULL DEFAULT '[]',

    created_at_ms   TEXT NOT NULL,
    updated_at_ms   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflows_name ON workflows(name);

-- ============================================================
-- 4. workflow_nodes —— Workflow 节点 (1:N)
--    主键 node_id 为 32 位 UUID (全局唯一, 应用层生成); label 为画布展示名
--    position: 创建 API 必填 (缺失 400), 导入 API 可空 (后端默认排布并持久化)
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_nodes (
    node_id         TEXT PRIMARY KEY,                    -- 32 位 UUID, 全局唯一 (原自增 id 已移除)
    label           TEXT NOT NULL,                       -- 画布展示名 (node_start 等, 前端生成, 非唯一标识)
    workflow_id     TEXT NOT NULL,                       -- 所属 workflow (workflows.workflow_id)
    kind            TEXT NOT NULL CHECK (kind IN ('start','op','end')),

    -- kind = op 时使用
    op_id           TEXT,
    op_version      INTEGER,
    client_id       TEXT,                                -- 可为空, 执行时再选
    -- bindings: {"paramName": {"kind":"node_output"|"workflow_input"|"literal", ...}}
    bindings        TEXT,                                -- JSON object
    -- retry: {"on":"failure","max":3,"backoff":"exponential","interval":1000}
    retry           TEXT,                                -- JSON object, 可空
    -- 画布坐标 (创建必填; 导入无坐标时后端生成默认排布)
    position_x      REAL,
    position_y      REAL,

    FOREIGN KEY (workflow_id) REFERENCES workflows(workflow_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wf_nodes_wf ON workflow_nodes(workflow_id);


-- ============================================================
-- 5. jobs —— Job 定义 (执行载体)
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
    job_id          TEXT PRIMARY KEY,                    -- 32 位 UUID
    name            TEXT NOT NULL UNIQUE,
    description     TEXT,
    kind            TEXT NOT NULL DEFAULT 'persistent' CHECK (kind IN ('persistent','virtual')),
    version         INTEGER NOT NULL DEFAULT 1,

    -- target: {"kind":"op","opId":"...","opVersion":2} 或 {"kind":"workflow","workflowId":"...","workflowVersion":1}
    target          TEXT NOT NULL,                       -- JSON object

    client_id       TEXT,                                -- target=op 时必填 (clients.client_id)
    workspace       TEXT NOT NULL,
    inputs          TEXT NOT NULL DEFAULT '{}',          -- {"paramName":"value"}

    -- trigger: {"kind":"manual"} 或 {"kind":"schedule","cron":"0 * * * *","enabled":true}
    trigger         TEXT NOT NULL,                       -- JSON object

    concurrency     TEXT NOT NULL DEFAULT 'skip' CHECK (concurrency IN ('skip','queue','parallel')),
    enabled         INTEGER NOT NULL DEFAULT 1,

    created_at_ms   TEXT NOT NULL,
    updated_at_ms   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_enabled ON jobs(enabled);
CREATE INDEX IF NOT EXISTS idx_jobs_name ON jobs(name);

-- ============================================================
-- 6. job_runs —— 运行历史 (JobRun)
-- ============================================================
CREATE TABLE IF NOT EXISTS job_runs (
    run_id          TEXT PRIMARY KEY,                    -- 32 位 UUID
    job_id          TEXT NOT NULL,                       -- 所属 job (jobs.job_id)
    job_kind        TEXT NOT NULL CHECK (job_kind IN ('persistent','virtual')),
    job_version     INTEGER,
    triggered_by    TEXT NOT NULL CHECK (triggered_by IN ('manual','schedule','single_op','single_workflow','retry')),

    -- target 快照 (运行时锁定版本)
    target_kind     TEXT NOT NULL CHECK (target_kind IN ('op','workflow')),
    target_id       TEXT NOT NULL,                       -- op_id 或 workflow_id
    target_version  INTEGER NOT NULL,

    -- target 名称快照 (便于列表展示, 不 join)
    target_name     TEXT NOT NULL,

    inputs          TEXT NOT NULL DEFAULT '{}',         -- JSON object
    workspace       TEXT NOT NULL,

    status          TEXT NOT NULL DEFAULT 'waiting'
                    CHECK (status IN ('waiting','running','success','failed','cancelled','timeout')),
    terminated_by    TEXT CHECK (terminated_by IN ('timeout','cancelled','error')),
    timeout_step_id TEXT,
    timeout_op_name TEXT,

    -- 重跑/重试溯源
    retry_from_run_id  TEXT,                             -- 上游 job_runs.run_id
    retry_from_step_id TEXT,                             -- 上游 step_records.record_id

    started_at_ms   TEXT,
    finished_at_ms  TEXT,
    duration_ms     INTEGER,

    created_at_ms   TEXT NOT NULL DEFAULT (strftime('%s','now') || '000'),

    FOREIGN KEY (job_id) REFERENCES jobs(job_id)
);

CREATE INDEX IF NOT EXISTS idx_runs_status ON job_runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_job ON job_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_runs_started ON job_runs(started_at_ms);
CREATE INDEX IF NOT EXISTS idx_runs_triggered ON job_runs(triggered_by);

-- ============================================================
-- 7. step_records —— 步骤执行记录 (StepRecord) / WorkerPool 任务排队表
--    主键 record_id 为 32 位 UUID (应用层生成)
--    ★ 同一 step 在本次 Run 内可能被执行多次, 由 activation_seq / retry_seq 定位:
--        activation_seq: 该 step 的第几次「激活(activation)」, 首次=1,
--                        循环回跳重新激活同一节点时 +1; 节点内部重试不递增
--        retry_seq     : 同一 activation 内的第几次尝试(含首次), 首次=1, 每次 apply_retry +1
--      (run_id, step_id, activation_seq, retry_seq) 唯一标识一次实际执行。
--      重试计数 = 同 (run_id, step_id, activation_seq) 记录数 - 1;
--      执行总次数上限 = min(max×3, max_loop_multiplier) = 同 (run_id, step_id) 的 step_records 记录数 (含全部 activation × attempt)。
--    ★ WorkerPool 的 run_job / run_step 在此插入 status=waiting 记录（任务入 DB 排队，
--      App 重启不丢失），由 WorkerPool 调度线程指派 Worker 执行并推进 waiting → running → 终态；
--      启动时 status=running 的残留记录由 WorkerPool 重新指派重跑（复用原 record_id）。
-- ============================================================
CREATE TABLE IF NOT EXISTS step_records (
    record_id       TEXT PRIMARY KEY,                    -- 32 位 UUID (原自增 id 已移除)
    run_id          TEXT NOT NULL,                       -- 所属运行 (job_runs.run_id)
    step_id         TEXT NOT NULL,                       -- 等于 workflow_node.node_id; 单次 OP/Job 执行时为 run_id
    activation_seq  INTEGER NOT NULL DEFAULT 1,          -- 该 step 的第几次激活(activation): 首次=1, 循环回跳重入 +1 (重试不递增)
    retry_seq       INTEGER NOT NULL DEFAULT 1,          -- 同一 activation 内的第几次尝试(含首次): 首次=1, 每次 apply_retry +1
    op_id           TEXT NOT NULL,
    op_version      INTEGER NOT NULL,
    op_name         TEXT NOT NULL,                       -- 快照: OP 名称
    client_id       TEXT,                                -- 执行时按 client_id 加载 Client（或存配置快照）
    source          TEXT NOT NULL DEFAULT 'job'
                    CHECK (source IN ('job','step')),    -- 任务来源: job=单次 OP/Job (Runner 触发, 完成调 job_complete 钩子)
                                                         --            step=workflow 步骤 (Engine 触发, 完成调 step_complete 钩子)

    status          TEXT NOT NULL DEFAULT 'waiting'
                    CHECK (status IN ('waiting','running','success','failed','timeout','cancelled')),  -- cancelled = 被终止/取消

    inputs          TEXT NOT NULL DEFAULT '{}',         -- JSON object
    body_snapshot   TEXT,                                -- OP 正文快照
    workspace       TEXT,                                -- 执行工作目录 (ExecuteRequest.workspace)
    outputs         TEXT,                                -- JSON object
    raw_output      TEXT,
    exit_code       INTEGER,
    error           TEXT,
    timeout_ms      INTEGER,
    timed_out       INTEGER NOT NULL DEFAULT 0,
    not_before_ms   TEXT,                                -- 最早可执行时间(毫秒时间戳); NULL=立即可执行. 用于重试退避/延迟调度(见 crud-03 4.3.2)

    created_at_ms   TEXT NOT NULL DEFAULT (strftime('%s','now') || '000'),  -- 入队时间（waiting 队列按此顺序调度）
    started_at_ms   TEXT,
    finished_at_ms  TEXT,
    duration_ms     INTEGER,

    FOREIGN KEY (run_id) REFERENCES job_runs(run_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_steps_run ON step_records(run_id);
CREATE INDEX IF NOT EXISTS idx_steps_op ON step_records(op_id);
CREATE INDEX IF NOT EXISTS idx_steps_status ON step_records(status);
CREATE INDEX IF NOT EXISTS idx_steps_waiting ON step_records(status, created_at_ms) WHERE status = 'waiting'; -- WorkerPool 调度线程轮询 waiting 队列
CREATE INDEX IF NOT EXISTS idx_steps_activation ON step_records(run_id, step_id, activation_seq, retry_seq); -- 定位一次实际执行 / 重试计数 / 循环上限判定

-- ============================================================
-- 8. settings —— 系统配置 (KV)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
    key             TEXT PRIMARY KEY,                    -- 配置键 (业务键, 非 UUID)
    value           TEXT NOT NULL,
    updated_at_ms   TEXT NOT NULL
);

-- 默认配置
INSERT OR IGNORE INTO settings(key, value, updated_at_ms) VALUES
    ('poll_interval_ms',   '2000',  '0'),
    ('log_level',          'info',   '0'),
    ('max_loop_multiplier','0',      '0'),
    ('db_version',         '1',      '0');

-- ============================================================
-- 9. engine_events —— Engine 调度事件流 (调度过程记录, 事件溯源)
--    参考 Mistral engine: Engine 采用事件驱动, 每次
--    "节点完成→决定下一步" 产生一条调度事件并持久化于此;
--    **写即处理、无事件循环**: 事件 INSERT 后立即由 process_event 同步处理
--    (谁产生谁调用), 仅崩溃残留的 processed=0 事件由 recover 一次性重放
--    数据生命周期:
--      成功完成的 workflow → 完成即物理删除本 run 的事件
--      失败的 workflow(可重试) → 保留; 最终不重试: 1 天后软删除
--        (置 soft_deleted_at_ms), 2 天后物理删除
-- ============================================================
-- ★ Engine 的 notify 与后台线程持久化：
--   Runner / 终止接口调 engine.notify(msg) 时，EngineStart / Terminate **不投内存 inbox**，
--   而是作为事件直接 INSERT 到本表（engine_start / terminate，payload 承载 inputs/workspace/reason），
--   写库成功后**立即由 process_event 同步处理**（写即处理，无事件循环 / 无唤醒信号），
--   处理完成才返回（写库失败视为投递失败）。
--   App 重启后：未消费事件仍在（notify 不丢），Engine::recover 一次性处理残留
--   processed=0 事件即恢复推进，之后无常驻循环。
CREATE TABLE IF NOT EXISTS engine_events (
    event_id      TEXT PRIMARY KEY,                    -- 32 位 UUID
    run_id          TEXT NOT NULL,                       -- 所属 job_run (job_runs.run_id)

    event_type      TEXT NOT NULL CHECK (event_type IN
                    ('engine_start','dispatch_step','step_completed','apply_retry','walk_edge','workflow_done','terminate')),

    step_id         TEXT,                                -- 相关节点 (workflow_node.node_id)
    step_status     TEXT CHECK (step_status IN ('success','failed','timeout')),

    payload         TEXT,                                -- JSON: 节点出参 / 下一批就绪节点 / 上下文快照 / EngineStart 的 inputs+workspace / Terminate 的 reason
    processed       INTEGER NOT NULL DEFAULT 0,          -- 0=未消费 1=已消费 (崩溃恢复重放依据)
    created_at_ms   TEXT NOT NULL DEFAULT (strftime('%s','now') || '000'),
    processed_at_ms TEXT,
    soft_deleted_at_ms TEXT,                             -- NULL=active; 非NULL=软删除时间(失败数据保留1天后置位)

    FOREIGN KEY (run_id) REFERENCES job_runs(run_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evts_run       ON engine_events(run_id);
CREATE INDEX IF NOT EXISTS idx_evts_processed ON engine_events(processed);
CREATE INDEX IF NOT EXISTS idx_evts_created   ON engine_events(created_at_ms);

-- ============================================================
-- 10. run_edge_state —— Engine 运行态“边状态”可选 checkpoint 表 (见 crud-03 4.3.3)
--    ⚠ 可选：不是热路径（热路径 = 内存 RunContext）。用途:
--      (1) 恢复加速: 把 RunContext 周期性/结束时快照至本表，重启优先读快照、减少重放量;
--      (2) 运维/诊断: 直接 SQL 观察某 run 的边状态。
--    可选存当前 activation 的边状态（pending/activated/dropped）;
--    engine_events 仍为唯一事实来源。数据生命周期同 engine_events。
--    edges 无独立 id，edge_key = "<from_node_id>|<to_node_id>|<condition>"。
-- ============================================================
CREATE TABLE IF NOT EXISTS run_edge_state (
    run_id        TEXT NOT NULL,                        -- job_runs.run_id
    edge_key      TEXT NOT NULL,                        -- <from_node_id>|<to_node_id>|<condition>
    from_node_id  TEXT NOT NULL,                        -- 源节点 (便于按节点批量更新其出边)
    state         TEXT NOT NULL DEFAULT 'pending'
                  CHECK (state IN ('pending','activated','dropped')),
    updated_at_ms TEXT NOT NULL,

    PRIMARY KEY (run_id, edge_key),
    FOREIGN KEY (run_id) REFERENCES job_runs(run_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_run_edge_state_run  ON run_edge_state(run_id);
CREATE INDEX IF NOT EXISTS idx_run_edge_state_from ON run_edge_state(run_id, from_node_id);

-- ============================================================
-- 11. run_node_state —— Engine 运行态“节点就绪”可选 checkpoint 表 (见 crud-03 4.3.3)
--    ⚠ 可选：不是热路径（热路径 = 内存 RunContext），与 run_edge_state 同生命周期。
--    可选存“当前 activation”的就绪快照，用于恢复加速/诊断:
--      节点就绪 = pending_in_edges = 0 且 activated_in_edges >= 1
--    循环回跳重入 N 时 activation_seq+1 并重置 pending(=N 入度)/activated(=0)。
-- ============================================================
CREATE TABLE IF NOT EXISTS run_node_state (
    run_id            TEXT NOT NULL,                    -- job_runs.run_id
    node_id           TEXT NOT NULL,                    -- workflow_nodes.node_id (start/op/end)
    activation_seq    INTEGER NOT NULL DEFAULT 1,       -- 当前 activation（回跳重入时 +1 并重置计数）
    pending_in_edges  INTEGER NOT NULL,                 -- 尚未决定的入边数（0 = 已全部决定）
    activated_in_edges INTEGER NOT NULL DEFAULT 0,      -- 已 activated 的入边数（>=1 且 pending=0 即就绪）
    status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','running','done','skipped')),
    updated_at_ms     TEXT NOT NULL,

    PRIMARY KEY (run_id, node_id),
    FOREIGN KEY (run_id) REFERENCES job_runs(run_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_run_node_state_run ON run_node_state(run_id);
