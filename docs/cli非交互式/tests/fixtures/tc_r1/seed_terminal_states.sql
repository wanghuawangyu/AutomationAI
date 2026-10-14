-- ============================================================
-- TC-R4 终态未执行 / 非终态等待中 最小数据集 —— 直接向数据库注入
-- 目标库: {run}/data/data.db   (SQLite, schema.sql)
-- 用法:   sqlite3 "{run}/data/data.db" ".read seed_terminal_states.sql"
-- 说明:
--   * 目的（D15/G9 分支）：使「终态 Run 的未执行节点显示 ⊘ 未执行」与
--     「非终态 Run 的未执行节点显示 等待中」两类渲染可自动验证。
--   * 注入 1 个 Workflow（Start → A(op) → B(op) → End）、2 条 job_runs：
--       ① run-tc-r4-01 = cancelled（终态）；steps：A=cancelled（已执行）+ B=waiting（未执行）
--       ② run-tc-r4-02 = running （非终态）；steps：A=running    + B=waiting
--     → ① 的 B 归「未执行」（proposal-01 §14.2「cancelled 之前的 waiting 记录 = 未执行」）；
--       ② 的 B 保持「等待中」（Run 非终态）。
--   * 与 seed.sql 一致：使用非 UUID 的可读占位 id；step_records.step_id = workflow_nodes.workflow_node_id
--     （画布节点状态按 step_id 与节点对应，故必须相等）。
--   * 取值域（本夹具同契约）：workflows.edges[].condition ∈ {on_success, on_failure, always}
--     （crud-03 3.3 边字段表；不得写 success / failed 等非枚举值）。
--   * 供节点下钻（点 OP 节点跳 OP 详情）与按 op_id 反查，另补被引用的 1 行 ops
--     （op_id='10000001'、name='op_prompt_review'）与 1 行 clients
--     （client_id='f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1'、type='prompt'），使 TC-R4 顺手点节点下钻时不出现空态。
--   * 全新运行目录可先清空（见下方 DELETE）；测试库请勿在生产数据上执行。
-- ============================================================
PRAGMA foreign_keys = ON;

-- 清空（全新目录可省略；仅清理本夹具所用 id，避免影响 seed.sql 数据）
DELETE FROM step_records WHERE run_id IN ('run-tc-r4-01','run-tc-r4-02');
DELETE FROM job_runs     WHERE run_id IN ('run-tc-r4-01','run-tc-r4-02');
DELETE FROM run_node_state WHERE run_id IN ('run-tc-r4-01','run-tc-r4-02');

-- 被引用实体（op / client）——先清本夹具 id，保证可重复执行
DELETE FROM ops     WHERE op_id = '10000001' OR name = 'op_prompt_review';
DELETE FROM clients WHERE client_id = 'f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1' OR name = 'Claude Code';

-- 基准时刻（毫秒）
CREATE TEMP TABLE IF NOT EXISTS _now4 AS SELECT CAST(strftime('%s','now') AS INTEGER) * 1000 AS ms;

-- ------------------------------------------------------------
-- 被引用的 OP / Client（画布点 OP 节点下钻 / 按 op_id 反查所需）
-- ------------------------------------------------------------
INSERT INTO ops
(op_id, name, type, description, content, timeout_seconds, interactive, version, inputs, outputs, created_at_ms, updated_at_ms)
VALUES
('10000001','op_prompt_review','prompt','TC-R4 夹具：节点下钻 / OP 详情展示用','review the diff and report issues',60,0,1,'[]',
 '[{"name":"passed","type":"string","description":"是否通过"}]',
 (SELECT ms FROM _now4),(SELECT ms FROM _now4));

INSERT INTO clients
(client_id, name, description, type, command, args_template, input_mode, output_mode, output_json_path, exit_code_success, binary_path, created_at_ms, updated_at_ms)
VALUES
('f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1','Claude Code','TC-R4 夹具：prompt 类型 Client','prompt','claude',
 '--print --output-format json --model sonnet','stdin','json','$.result','[0]',NULL,
 (SELECT ms FROM _now4),(SELECT ms FROM _now4));

-- ------------------------------------------------------------
-- 1 个 Workflow（供执行详情只读画布渲染节点与连线）
-- ------------------------------------------------------------
DELETE FROM workflow_nodes WHERE workflow_id = 'wfid-tc-r4-01';
DELETE FROM workflows      WHERE workflow_id = 'wfid-tc-r4-01';

INSERT INTO workflows
(workflow_id, name, description, version, inputs, outputs, edges, created_at_ms, updated_at_ms)
VALUES
('wfid-tc-r4-01','wf_tc_r4_terminal','TC-R4 终态/非终态节点渲染最小夹具',1,'[]','[]',
 '[{"from":"wnode-tc-r4-start","to":"wnode-tc-r4-a","condition":"on_success"},' ||
 '{"from":"wnode-tc-r4-a","to":"wnode-tc-r4-b","condition":"on_success"},' ||
 '{"from":"wnode-tc-r4-b","to":"wnode-tc-r4-end","condition":"on_success"}]',
 (SELECT ms FROM _now4), (SELECT ms FROM _now4));

INSERT INTO workflow_nodes
(workflow_node_id, label, workflow_id, kind, op_id, op_version, client_id, bindings, retry, position_x, position_y)
VALUES
('wnode-tc-r4-start','node_start','wfid-tc-r4-01','start',NULL,NULL,NULL,NULL,NULL,0,200),
('wnode-tc-r4-a','node_a','wfid-tc-r4-01','op','10000001',1,'f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1','{}',NULL,200,200),
('wnode-tc-r4-b','node_b','wfid-tc-r4-01','op','10000001',1,'f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1','{}',NULL,400,200),
('wnode-tc-r4-end','node_end','wfid-tc-r4-01','end',NULL,NULL,NULL,NULL,NULL,600,200);

-- ------------------------------------------------------------
-- 2 条 job_runs（均为 virtual / target=workflow）
-- ------------------------------------------------------------
INSERT INTO job_runs
(run_id, job_id, job_kind, job_version, triggered_by,
 target_kind, target_id, target_version, target_name,
 name, inputs, workspace, status, terminated_by,
 started_at_ms, finished_at_ms, duration_ms, created_at_ms, updated_at_ms)
VALUES
-- ① 终态 cancelled：A 已执行后被取消，B 从未执行（waiting 记录）
('run-tc-r4-01','jobid-tc-r4-01','virtual',NULL,'single_workflow','workflow','wfid-tc-r4-01',1,'wf_tc_r4_terminal',
 'wf_tc_r4_terminal','{}','/path/ws-r4','cancelled','cancelled',
 (SELECT ms FROM _now4)-120000, (SELECT ms FROM _now4)-60000, 60000, (SELECT ms FROM _now4)-120000, (SELECT ms FROM _now4)-60000),
-- ② 非终态 running：A 运行中，B 排队等待
('run-tc-r4-02','jobid-tc-r4-02','virtual',NULL,'single_workflow','workflow','wfid-tc-r4-01',1,'wf_tc_r4_terminal',
 'wf_tc_r4_terminal','{}','/path/ws-r4','running',NULL,
 (SELECT ms FROM _now4)-30000, NULL, NULL, (SELECT ms FROM _now4)-30000, (SELECT ms FROM _now4)-30000);

-- ------------------------------------------------------------
-- 4 条 step_records（step_id = workflow_node_id）
-- ------------------------------------------------------------
INSERT INTO step_records
(record_id, run_id, step_id, activation_seq, retry_seq, op_id, op_version, op_name, client_id, source, status,
 inputs, started_at_ms, finished_at_ms, duration_ms)
VALUES
-- ① A：执行后被取消
('rec-tc-r4-01a','run-tc-r4-01','wnode-tc-r4-a',1,1,'10000001',1,'op_prompt_review',NULL,'step','cancelled','{}',
 (SELECT ms FROM _now4)-120000, (SELECT ms FROM _now4)-70000, 50000),
-- ① B：未执行（终态 Run 的 waiting 记录）
('rec-tc-r4-01b','run-tc-r4-01','wnode-tc-r4-b',1,1,'10000001',1,'op_prompt_review',NULL,'step','waiting','{}',
 NULL, NULL, NULL),
-- ② A：运行中
('rec-tc-r4-02a','run-tc-r4-02','wnode-tc-r4-a',1,1,'10000001',1,'op_prompt_review',NULL,'step','running','{}',
 (SELECT ms FROM _now4)-30000, NULL, NULL),
-- ② B：排队等待（Run 非终态 → 显示「等待中」）
('rec-tc-r4-02b','run-tc-r4-02','wnode-tc-r4-b',1,1,'10000001',1,'op_prompt_review',NULL,'step','waiting','{}',
 NULL, NULL, NULL);

-- ------------------------------------------------------------
-- run_node_state（可选 checkpoint，供直接读状态的后端/UI 亦可得一致结论）
-- ------------------------------------------------------------
INSERT INTO run_node_state
(run_id, workflow_node_id, activation_seq, pending_in_edges, activated_in_edges, status, updated_at_ms)
VALUES
('run-tc-r4-01','wnode-tc-r4-start',1,0,1,'done',   (SELECT ms FROM _now4)-60000),
('run-tc-r4-01','wnode-tc-r4-a',    1,0,1,'done',   (SELECT ms FROM _now4)-70000),
('run-tc-r4-01','wnode-tc-r4-b',    1,1,0,'skipped',(SELECT ms FROM _now4)-60000),
('run-tc-r4-01','wnode-tc-r4-end',  1,1,0,'skipped',(SELECT ms FROM _now4)-60000),
('run-tc-r4-02','wnode-tc-r4-start',1,0,1,'done',   (SELECT ms FROM _now4)-30000),
('run-tc-r4-02','wnode-tc-r4-a',    1,0,1,'running',(SELECT ms FROM _now4)-30000),
('run-tc-r4-02','wnode-tc-r4-b',    1,1,0,'pending',(SELECT ms FROM _now4)-30000),
('run-tc-r4-02','wnode-tc-r4-end',  1,1,0,'pending',(SELECT ms FROM _now4)-30000);

-- ------------------------------------------------------------
-- 行数自检（机械门禁可读：期望 job_runs=2 / step_records=4 / run_node_state=8 / workflows=1）
--   上方 INSERT 若因 id 冲突 / 被前置 DELETE 影响而静默不生效，本 SELECT 使门禁可判。
-- ------------------------------------------------------------
SELECT 'tc_r1_terminal_check: job_runs=' || (SELECT count(*) FROM job_runs WHERE run_id IN ('run-tc-r4-01','run-tc-r4-02'))
       || ' step_records=' || (SELECT count(*) FROM step_records WHERE run_id IN ('run-tc-r4-01','run-tc-r4-02'))
       || ' run_node_state=' || (SELECT count(*) FROM run_node_state WHERE run_id IN ('run-tc-r4-01','run-tc-r4-02'))
       || ' workflows=' || (SELECT count(*) FROM workflows WHERE workflow_id='wfid-tc-r4-01') AS tc_r1_terminal_check;
