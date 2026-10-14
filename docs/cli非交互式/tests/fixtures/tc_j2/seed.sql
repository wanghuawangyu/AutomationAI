-- ============================================================
-- TC-J2 「最近执行失败」运行记录注入
-- 目标库: {run}/data/data.db   (SQLite, schema.sql)
-- 用法:   sqlite3 "{run}/data/data.db" ".read seed.sql"
-- 前置:   已按 TC-J2 数据集创建 11 个 Job（含 job_log_scan / job_cleanup / job_report），
--         且已导入失败 OP `op_always_fail`（fixtures/tc_j2/op_always_fail.yaml）。
-- 说明:
--   * 运行历史是“执行产物”，前端无法新建；此处直接 INSERT job_runs / step_records。
--   * job_id / op_id 均按 **名称解析**（jobs.name / ops.name），不依赖随机 uuid，可重复执行。
--   * 仅为 3 个 target=op_always_fail 的 Job 注入 failed 运行；其余 Job 保持无运行记录。
--   * 为可读性与用例引用，本夹具使用非 UUID 的可读占位 id（如 run-tc-j2-01）；仅用于测试注入，不代表接口返回的 id 形态（生产为 32 位无连字符 UUID）。
-- ============================================================
PRAGMA foreign_keys = ON;

-- 先清空本用例注入的记录（幂等，可重复执行）
DELETE FROM step_records WHERE record_id LIKE 'rec-tc-j2-%';
DELETE FROM job_runs   WHERE run_id    LIKE 'run-tc-j2-%';

CREATE TEMP TABLE IF NOT EXISTS _now AS SELECT CAST(strftime('%s','now') AS INTEGER) * 1000 AS ms;

-- ------------------------------------------------------------
-- 3 条 failed job_runs
--   数据集行 4 job_log_scan (6m前) / 数据集行 8 job_cleanup (12m前) / 数据集行 10 job_report (24m前)
-- ------------------------------------------------------------
INSERT INTO job_runs
(run_id, job_id, job_kind, job_version, triggered_by,
 target_kind, target_id, target_version, target_name,
 name, inputs, workspace, status, terminated_by,
 started_at_ms, finished_at_ms, duration_ms, created_at_ms, updated_at_ms)
SELECT 'run-tc-j2-01', j.job_id, 'persistent', j.version, 'manual',
       'op', o.op_id, o.version, o.name,
       j.name, '{}', j.workspace, 'failed', 'error',
       (SELECT ms FROM _now)-360000, (SELECT ms FROM _now)-360000+4000, 4000,
       (SELECT ms FROM _now)-360000, (SELECT ms FROM _now)-360000+4000
FROM jobs j JOIN ops o ON o.name = 'op_always_fail'
WHERE j.name = 'job_log_scan';

INSERT INTO job_runs
(run_id, job_id, job_kind, job_version, triggered_by,
 target_kind, target_id, target_version, target_name,
 name, inputs, workspace, status, terminated_by,
 started_at_ms, finished_at_ms, duration_ms, created_at_ms, updated_at_ms)
SELECT 'run-tc-j2-02', j.job_id, 'persistent', j.version, 'manual',
       'op', o.op_id, o.version, o.name,
       j.name, '{}', j.workspace, 'failed', 'error',
       (SELECT ms FROM _now)-720000, (SELECT ms FROM _now)-720000+4200, 4200,
       (SELECT ms FROM _now)-720000, (SELECT ms FROM _now)-720000+4200
FROM jobs j JOIN ops o ON o.name = 'op_always_fail'
WHERE j.name = 'job_cleanup';

INSERT INTO job_runs
(run_id, job_id, job_kind, job_version, triggered_by,
 target_kind, target_id, target_version, target_name,
 name, inputs, workspace, status, terminated_by,
 started_at_ms, finished_at_ms, duration_ms, created_at_ms, updated_at_ms)
SELECT 'run-tc-j2-03', j.job_id, 'persistent', j.version, 'manual',
       'op', o.op_id, o.version, o.name,
       j.name, '{}', j.workspace, 'failed', 'error',
       (SELECT ms FROM _now)-1440000, (SELECT ms FROM _now)-1440000+3800, 3800,
       (SELECT ms FROM _now)-1440000, (SELECT ms FROM _now)-1440000+3800
FROM jobs j JOIN ops o ON o.name = 'op_always_fail'
WHERE j.name = 'job_report';

-- ------------------------------------------------------------
-- 3 条 step_records（每个 run 1 条）
-- ------------------------------------------------------------
INSERT INTO step_records
(record_id, run_id, step_id, activation_seq, retry_seq, op_id, op_version, op_name, source, status,
 inputs, started_at_ms, finished_at_ms, duration_ms)
SELECT 'rec-tc-j2-01','run-tc-j2-01','step-tc-j2-01',1,1,o.op_id,o.version,o.name,'job','failed','{}',
       (SELECT ms FROM _now)-360000, (SELECT ms FROM _now)-360000+4000, 4000
FROM ops o WHERE o.name='op_always_fail';

INSERT INTO step_records
(record_id, run_id, step_id, activation_seq, retry_seq, op_id, op_version, op_name, source, status,
 inputs, started_at_ms, finished_at_ms, duration_ms)
SELECT 'rec-tc-j2-02','run-tc-j2-02','step-tc-j2-02',1,1,o.op_id,o.version,o.name,'job','failed','{}',
       (SELECT ms FROM _now)-720000, (SELECT ms FROM _now)-720000+4200, 4200
FROM ops o WHERE o.name='op_always_fail';

INSERT INTO step_records
(record_id, run_id, step_id, activation_seq, retry_seq, op_id, op_version, op_name, source, status,
 inputs, started_at_ms, finished_at_ms, duration_ms)
SELECT 'rec-tc-j2-03','run-tc-j2-03','step-tc-j2-03',1,1,o.op_id,o.version,o.name,'job','failed','{}',
       (SELECT ms FROM _now)-1440000, (SELECT ms FROM _now)-1440000+3800, 3800
FROM ops o WHERE o.name='op_always_fail';

-- ------------------------------------------------------------
-- 行数自检（机械门禁可读：期望 job_runs=3 / step_records=3）
--   若前置 Job（job_log_scan / job_cleanup / job_report）未建，上面的
--   INSERT ... SELECT 会静默 0 行；本 SELECT 使门禁可判「注入是否真的发生」。
-- ------------------------------------------------------------
SELECT 'tc_j2_seed_check: job_runs=' || (SELECT count(*) FROM job_runs WHERE run_id LIKE 'run-tc-j2-%')
       || ' step_records=' || (SELECT count(*) FROM step_records WHERE record_id LIKE 'rec-tc-j2-%') AS tc_j2_seed_check;
