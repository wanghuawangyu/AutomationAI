-- ============================================================
-- TC-R1 运行历史筛选数据集 —— 直接向数据库注入
-- 目标库: {run}/data/data.db   (SQLite, schema.sql)
-- 用法:   sqlite3 "{run}/data/data.db" ".read seed.sql"
-- 说明:
--   * 运行历史是“执行产物”，前端无法新建；此处直接 INSERT job_runs / step_records。
--   * started_at_ms / finished_at_ms 以“写入时刻”为基准按偏移生成，保证 timeRange 相对当前。
--   * 共注入 11 条 job_runs + 11 条 step_records（S = 11）。
--   * 全新运行目录可先清空（见下方 DELETE）；测试库请勿在生产数据上执行。
-- ============================================================
PRAGMA foreign_keys = ON;

-- 清空（全新目录可省略）
DELETE FROM step_records;
DELETE FROM job_runs;

-- 基准时刻（毫秒）
CREATE TEMP TABLE IF NOT EXISTS _now AS SELECT CAST(strftime('%s','now') AS INTEGER) * 1000 AS ms;

-- ------------------------------------------------------------
-- 11 条 job_runs
--   offset(ms): 1=10m 2=30m 3=2h 4=3h 5=6h 6=20h 7=40h 8=50h 9=5m 10=1m 11=4d
-- ------------------------------------------------------------
INSERT INTO job_runs
(run_id, job_id, job_kind, job_version, triggered_by,
 target_kind, target_id, target_version, target_name,
 name, inputs, workspace, status, terminated_by,
 started_at_ms, finished_at_ms, duration_ms, created_at_ms, updated_at_ms)
VALUES
-- 1 check_tests (op/virtual/single_op/success) 10m
('run-tc-r1-01','job-r1-v1','virtual',NULL,'single_op','op','10000001',1,'check_tests','check_tests','{}','/path/ws-001','success',NULL,
 (SELECT ms FROM _now)-600000, (SELECT ms FROM _now)-600000+12300, 12300, (SELECT ms FROM _now)-600000, (SELECT ms FROM _now)-600000+12300),
-- 2 deploy_workflow (workflow/virtual/single_workflow/failed) 30m
('run-tc-r1-02','job-r1-v2','virtual',NULL,'single_workflow','workflow','f0001',1,'deploy_workflow','deploy_workflow','{}','/path/ws-002','failed','error',
 (SELECT ms FROM _now)-1800000, (SELECT ms FROM _now)-1800000+8200, 8200, (SELECT ms FROM _now)-1800000, (SELECT ms FROM _now)-1800000+8200),
-- 3 hourly_check (workflow/persistent/v1/schedule/success) 2h
('run-tc-r1-03','job-r1-03','persistent',1,'schedule','workflow','f0001',1,'hourly_check','hourly_check','{}','/path/ws-003','success',NULL,
 (SELECT ms FROM _now)-7200000, (SELECT ms FROM _now)-7200000+5300, 5300, (SELECT ms FROM _now)-7200000, (SELECT ms FROM _now)-7200000+5300),
-- 4 daily_cleanup (op/persistent/v2/schedule/success) 3h
('run-tc-r1-04','job-r1-04','persistent',2,'schedule','op','10000001',1,'daily_cleanup','daily_cleanup','{}','/path/ws-001','success',NULL,
 (SELECT ms FROM _now)-10800000, (SELECT ms FROM _now)-10800000+3200, 3200, (SELECT ms FROM _now)-10800000, (SELECT ms FROM _now)-10800000+3200),
-- 5 data_sync (op/persistent/v3/schedule/failed) 6h
('run-tc-r1-05','job-r1-05','persistent',3,'schedule','op','10000001',1,'data_sync','data_sync','{}','/path/ws-002','failed','error',
 (SELECT ms FROM _now)-21600000, (SELECT ms FROM _now)-21600000+4100, 4100, (SELECT ms FROM _now)-21600000, (SELECT ms FROM _now)-21600000+4100),
-- 6 deploy_workflow (workflow/persistent/v2/manual/timeout) 20h
('run-tc-r1-06','job-r1-06','persistent',2,'manual','workflow','f0001',1,'deploy_workflow','deploy_workflow','{}','/path/ws-004','timeout','timeout',
 (SELECT ms FROM _now)-72000000, (SELECT ms FROM _now)-72000000+137500, 137500, (SELECT ms FROM _now)-72000000, (SELECT ms FROM _now)-72000000+137500),
-- 7 review (op/virtual/single_op/success) 40h
('run-tc-r1-07','job-r1-v7','virtual',NULL,'single_op','op','10000001',1,'review','review','{}','/path/ws-001','success',NULL,
 (SELECT ms FROM _now)-144000000, (SELECT ms FROM _now)-144000000+6100, 6100, (SELECT ms FROM _now)-144000000, (SELECT ms FROM _now)-144000000+6100),
-- 8 hourly_check (workflow/persistent/v1/retry/cancelled) 50h
('run-tc-r1-08','job-r1-08','persistent',1,'retry','workflow','f0001',1,'hourly_check','hourly_check','{}','/path/ws-003','cancelled','cancelled',
 (SELECT ms FROM _now)-180000000, (SELECT ms FROM _now)-180000000+5000, 5000, (SELECT ms FROM _now)-180000000, (SELECT ms FROM _now)-180000000+5000),
-- 9 notify (op/persistent/v2/manual/running) 5m
('run-tc-r1-09','job-r1-09','persistent',2,'manual','op','10000001',1,'notify','notify','{}','/path/ws-004','running',NULL,
 (SELECT ms FROM _now)-300000, NULL, NULL, (SELECT ms FROM _now)-300000, (SELECT ms FROM _now)-300000),
-- 10 log_analysis (workflow/persistent/v1/schedule/waiting) 1m
('run-tc-r1-10','job-r1-10','persistent',1,'schedule','workflow','f0001',1,'log_analysis','log_analysis','{}','/path/ws-005','waiting',NULL,
 (SELECT ms FROM _now)-60000, NULL, NULL, (SELECT ms FROM _now)-60000, (SELECT ms FROM _now)-60000),
-- 11 clean_logs (op/persistent/v1/manual/success) 4d
('run-tc-r1-11','job-r1-11','persistent',1,'manual','op','10000001',1,'clean_logs','clean_logs','{}','/path/ws-005','success',NULL,
 (SELECT ms FROM _now)-345600000, (SELECT ms FROM _now)-345600000+3200, 3200, (SELECT ms FROM _now)-345600000, (SELECT ms FROM _now)-345600000+3200);

-- ------------------------------------------------------------
-- 11 条 step_records（每个 run 1 条，S = 11）
--   source: 单次/Job → 'job'; workflow 步骤 → 'step'
-- ------------------------------------------------------------
INSERT INTO step_records
(record_id, run_id, step_id, activation_seq, retry_seq, op_id, op_version, op_name, client_id, source, status,
 inputs, started_at_ms, finished_at_ms, duration_ms)
VALUES
('rec-tc-r1-01','run-tc-r1-01','step-tc-r1-01',1,1,'10000001',1,'op_prompt_review',NULL,'job','success','{}',
 (SELECT ms FROM _now)-600000, (SELECT ms FROM _now)-600000+12300, 12300),
('rec-tc-r1-02','run-tc-r1-02','step-tc-r1-02',1,1,'10000001',1,'op_prompt_review',NULL,'step','failed','{}',
 (SELECT ms FROM _now)-1800000, (SELECT ms FROM _now)-1800000+8200, 8200),
('rec-tc-r1-03','run-tc-r1-03','step-tc-r1-03',1,1,'10000001',1,'op_prompt_review',NULL,'step','success','{}',
 (SELECT ms FROM _now)-7200000, (SELECT ms FROM _now)-7200000+5300, 5300),
('rec-tc-r1-04','run-tc-r1-04','step-tc-r1-04',1,1,'10000001',1,'op_prompt_review',NULL,'job','success','{}',
 (SELECT ms FROM _now)-10800000, (SELECT ms FROM _now)-10800000+3200, 3200),
('rec-tc-r1-05','run-tc-r1-05','step-tc-r1-05',1,1,'10000001',1,'op_prompt_review',NULL,'job','failed','{}',
 (SELECT ms FROM _now)-21600000, (SELECT ms FROM _now)-21600000+4100, 4100),
('rec-tc-r1-06','run-tc-r1-06','step-tc-r1-06',1,1,'10000001',1,'op_prompt_review',NULL,'step','timeout','{}',
 (SELECT ms FROM _now)-72000000, (SELECT ms FROM _now)-72000000+137500, 137500),
('rec-tc-r1-07','run-tc-r1-07','step-tc-r1-07',1,1,'10000001',1,'op_prompt_review',NULL,'job','success','{}',
 (SELECT ms FROM _now)-144000000, (SELECT ms FROM _now)-144000000+6100, 6100),
('rec-tc-r1-08','run-tc-r1-08','step-tc-r1-08',1,1,'10000001',1,'op_prompt_review',NULL,'step','cancelled','{}',
 (SELECT ms FROM _now)-180000000, (SELECT ms FROM _now)-180000000+5000, 5000),
('rec-tc-r1-09','run-tc-r1-09','step-tc-r1-09',1,1,'10000001',1,'op_prompt_review',NULL,'job','running','{}',
 (SELECT ms FROM _now)-300000, NULL, NULL),
('rec-tc-r1-10','run-tc-r1-10','step-tc-r1-10',1,1,'10000001',1,'op_prompt_review',NULL,'step','waiting','{}',
 (SELECT ms FROM _now)-60000, NULL, NULL),
('rec-tc-r1-11','run-tc-r1-11','step-tc-r1-11',1,1,'10000001',1,'op_prompt_review',NULL,'job','success','{}',
 (SELECT ms FROM _now)-345600000, (SELECT ms FROM _now)-345600000+3200, 3200);
