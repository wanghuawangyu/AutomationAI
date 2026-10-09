# 后端 CRUD —— Client 管理

> 来源：`proposal-02-后端设计.md` 第 3.1 节、第 5 章（独立拆分并扩展为 Executor 完整设计，含 5.0–5.6）
> 配套文档: `proposal-01-界面设计.md`、`proposal-02-后端设计.md`
> 配套建表脚本: `schema.sql`

---

### 3.1 Client 管理

| 方法   | 路径                     | 请求 Body | 响应                                       | 说明                         |
| ------ | ------------------------ | --------- | ------------------------------------------ | ---------------------------- |
| GET    | `/api/clients`           | —         | `{items:[Client], total, page, page_size}` | 列表, 支持 keyword/type 筛选 |
| GET    | `/api/clients/{clientId}`      | —         | Client                                     | 详情                         |
| POST   | `/api/clients`           | Client    | Client                                     | 创建, id 由后端生成          |
| PUT    | `/api/clients/{clientId}`      | Client    | Client                                     | 更新                         |
| DELETE | `/api/clients/{clientId}`      | —         | `{ok:true}`                                | 删除                         |
| POST   | `/api/clients/{clientId}/test` | —         | `{success, exitCode, rawOutput, error, durationMs}` | 测试 Client 执行能力（封装 Executor::execute） |

**Client 对象**：
```json
{
  "clientId": "a1b2c3d4e5f67890abcdef1234567890",
  "name": "my-bash",
  "description": "本地 bash",
  "type": "bash",
  "command": null,
  "argsTemplate": null,
  "inputMode": null,
  "outputMode": null,
  "outputJsonPath": null,
  "exitCodeSuccess": null,
  "binaryPath": "/bin/bash",
  "createdAtMs": "1728000000000",
  "updatedAtMs": "1728000000000"
}
```

**业务规则**：
- `type=bash/python/powershell` 时需 `binaryPath`（`exitCodeSuccess` 为通用可选配置，默认 `[0]`）；其余 prompt 专用字段为空。
- `type=prompt` 时需 `command`；`argsTemplate`（按 inputMode 使用占位符：arg=`{{prompt}}`、file=`{{prompt-file}}`、stdin=无，可选）、`inputMode`（arg/stdin/file）按需配置；`outputMode`/`outputJsonPath` 为通用输出解析配置（主要用于 prompt 类主函数解析 CLI 输出，见 5.4/5.5）。
- 删除 Client 前检查是否被 Job 引用，被引用时返回 409。

**Client 对象字段说明**：

| 字段            | 类型               | 说明                                                                    |
| --------------- | ------------------ | ----------------------------------------------------------------------- |
| clientId | string(32 位 UUID) | 系统生成，创建时由后端生成，不随请求传入                                |
| name            | string             | 全局唯一，界面展示                                                      |
| description     | string \| null     | 描述                                                                    |
| type            | enum               | `prompt` / `bash` / `python` / `powershell`                             |
| command         | string \| null     | prompt 类型专用：可执行命令                                             |
| argsTemplate    | string \| null     | prompt 类型专用：参数模板字符串，按 inputMode 使用对应占位符（arg=`{{prompt}}` / file=`{{prompt-file}}` / stdin=无，见 5.5）；可选——可不使用、用固定参数 |
| inputMode       | enum \| null       | prompt 类型专用：`arg` / `stdin` / `file`                               |
| outputMode      | enum \| null       | 输出解析：`text` / `json` / `jsonl`                                     |
| outputJsonPath  | string \| null     | outputMode=json 时提取出参的 JSON 路径                                  |
| exitCodeSuccess | number[] \| null   | 视为成功的退出码集合，如 `[0]`                                          |
| binaryPath      | string \| null     | bash/python/powershell 类型专用：可执行文件路径                         |
| createdAtMs     | string             | 创建时间（毫秒时间戳字符串）                                            |
| updatedAtMs     | string             | 更新时间（毫秒时间戳字符串）                                            |

---

### 3.1.0 通用约定

> 以下为 Client 管理全部 API 的完整 HTTP 定义。通用约定：
> - 基础路径 `/api`。
> - 路径参数中的 `clientId` 均为 32 位无连字符 UUID，格式非法返回 400。
> - 时间字段在 JSON 中统一为 string（毫秒时间戳）。
> - 列表分页参数 `page` / `page_size`（`page_size` ∈ 10 / 50 / 100 / 1000，默认 10）。
> - 错误响应统一格式 `{"error":{"code":"...","message":"..."}}`。

**字段命名 ↔ 数据库列映射**（API 字段 camelCase ↔ `schema.sql` 列 snake_case）：

| API 字段 | 数据库列 | 说明 |
|-|-|-|
| `Client.clientId` | `clients.client_id` | 主键，32 位 UUID |
| `Client.createdAtMs` | `clients.created_at_ms` | 毫秒时间戳 |
| `Client.updatedAtMs` | `clients.updated_at_ms` | 毫秒时间戳 |

---

### 3.1.1 GET /api/clients —— Client 列表

**功能说明**：本接口支撑 Client 列表页（proposal-01 第 8.5 节）的完整展示与过滤。界面上的三个过滤/分页控件与查询参数一一对应：**搜索框内容 → `keyword`、类型筛选 chip → `type`、分页控件 → `page`/`page_size`**。其中搜索框与类型筛选为 **AND 关系**（先同时过滤，再分页返回），均由后端执行（前端不做全量加载与客户端过滤）。

**路径参数**：无

**查询参数**：

| 参数      | 位置  | 类型    | 必填 | 默认           | 说明                                                                        | 对应界面控件                                                    |
| --------- | ----- | ------- | ---- | -------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| page      | query | integer | 否   | 1              | 页码，从 1 开始                                                             | 分页控件「页码 / 上一页 / 下一页」                              |
| page_size | query | integer | 否   | 10             | 每页条数，∈ {10, 50, 100, 1000}，非法值返回 400                             | 分页控件「每页条数」下拉                                        |
| keyword   | query | string  | 否   | —              | 模糊匹配 name / type / binaryPath（LIKE，与 type 为 AND 关系）              | 搜索框「🔍 搜索...」                                             |
| type      | query | string  | 否   | —              | 按类型过滤：`prompt` / `bash` / `python` / `powershell`                     | 类型筛选 chip「全部类型 / prompt / bash / python / powershell」 |
| sort      | query | string  | 否   | `-createdAtMs` | 排序字段：`name` / `type` / `createdAtMs` / `updatedAtMs`，`-` 前缀表示降序 | 后端预留（界面暂未暴露排序控件）                                |

**请求体**：无

**成功响应 `200 OK`**：

```json
{
  "items": [
    {
      "clientId": "a1b2c3d4e5f67890abcdef1234567890",
      "name": "my-bash",
      "description": "本地 bash",
      "type": "bash",
      "command": null,
      "argsTemplate": null,
      "inputMode": null,
      "outputMode": null,
      "outputJsonPath": null,
      "exitCodeSuccess": null,
      "binaryPath": "/bin/bash",
      "createdAtMs": "1728000000000",
      "updatedAtMs": "1728000000000"
    }
  ],
  "total": 23,
  "page": 1,
  "page_size": 10
}
```

| 响应字段  | 类型     | 说明                 |
| --------- | -------- | -------------------- |
| items     | Client[] | 当前页 Client 列表   |
| total     | integer  | 符合筛选条件的总条数 |
| page      | integer  | 当前页码             |
| page_size | integer  | 每页条数             |

**错误响应**：

| 状态码 | code               | 场景                                             |
| ------ | ------------------ | ------------------------------------------------ |
| 400    | `VALIDATION_ERROR` | `page_size` 不在合法集合、`type`/`sort` 取值非法 |

---

### 3.1.2 GET /api/clients/{clientId} —— Client 详情

**功能说明**：查询单个 Client 的完整配置。用于编辑界面加载现有 Client 并回填表单，以及运行历史 / Job 详情等场景回溯其定义。

**路径参数**：

| 参数 | 类型               | 必填 | 说明            |
| ---- | ------------------ | ---- | --------------- |
| clientId | string(32 位 UUID) | 是   | Client 唯一标识 |

**查询参数**：无

**请求体**：无

**成功响应 `200 OK`**：返回单个 Client 对象（结构见 3.1 节）。

**错误响应**：

| 状态码 | code               | 场景        |
| ------ | ------------------ | ----------- |
| 400    | `VALIDATION_ERROR` | clientId 格式非法 |
| 404    | `CLIENT_NOT_FOUND` | clientId 不存在   |

---

### 3.1.3 POST /api/clients —— 创建 Client

**功能说明**：新建 Client，`name` 全局唯一；`clientId`、`createdAtMs`、`updatedAtMs` 由后端生成。创建成功后即可被 Job 引用，或用于单次执行。

**路径参数**：无

**查询参数**：无

**请求体** `ClientCreateRequest`（不含 `clientId` / `createdAtMs` / `updatedAtMs`，由后端生成）：

```json
{
  "name": "my-bash",
  "description": "本地 bash",
  "type": "bash",
  "command": null,
  "argsTemplate": null,
  "inputMode": null,
  "outputMode": null,
  "outputJsonPath": null,
  "exitCodeSuccess": null,
  "binaryPath": "/bin/bash"
}
```

| 字段            | 类型             | 必填 | 说明                               |
| --------------- | ---------------- | ---- | ---------------------------------- |
| name            | string           | 是   | 全局唯一                           |
| description     | string \| null   | 否   | 描述                               |
| type            | enum             | 是   | 四种类型之一                       |
| command         | string \| null   | 条件 | type=prompt 时必填                 |
| argsTemplate    | string \| null  | 否   | 参数模板字符串（按 inputMode 使用占位符：arg=`{{prompt}}`/file=`{{prompt-file}}`/stdin=无，见 5.5） |
| inputMode       | enum \| null     | 否   | arg / stdin / file                 |
| outputMode      | enum \| null     | 否   | text / json / jsonl                |
| outputJsonPath  | string \| null   | 否   | JSON 提取路径                      |
| exitCodeSuccess | number[] \| null | 否   | 成功退出码，默认 `[0]`             |
| binaryPath      | string \| null   | 条件 | type=bash/python/powershell 时必填 |

**成功响应 `200 OK`**：返回已创建的完整 Client 对象（含后端生成的 `clientId`、`createdAtMs`、`updatedAtMs`）。

**错误响应**：

| 状态码 | code                 | 场景                                                                                    |
| ------ | -------------------- | --------------------------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`   | name 为空、type 非法、type=prompt 缺 command、type=bash/python/powershell 缺 binaryPath |
| 409    | `CLIENT_NAME_EXISTS` | name 已存在（唯一约束冲突）                                                             |

---

### 3.1.4 PUT /api/clients/{clientId} —— 更新 Client

**功能说明**：整体替换 Client 的可编辑字段。**`createdAtMs`、`updatedAtMs` 为审计字段，不允许在请求中指定，也不能被更新**——`createdAtMs` 在首次创建（POST /api/clients）时由后端生成并固定；`updatedAtMs` 在每次成功更新后由后端自动刷新。更新完成后，后端将本次更新内容写入操作审计日志。

**路径参数**：

| 参数 | 类型               | 必填 | 说明               |
| ---- | ------------------ | ---- | ------------------ |
| clientId | string(32 位 UUID) | 是   | 待更新 Client 标识 |

**查询参数**：无

**请求体** `ClientUpdateRequest`（仅含可编辑字段，**不含 `clientId` / `createdAtMs` / `updatedAtMs`**），字段约束同 POST：

```json
{
  "name": "my-bash",
  "description": "更新后的描述",
  "type": "bash",
  "command": null,
  "argsTemplate": null,
  "inputMode": null,
  "outputMode": null,
  "outputJsonPath": null,
  "exitCodeSuccess": null,
  "binaryPath": "/usr/bin/bash"
}
```

| 字段            | 类型             | 必填 | 说明                               |
| --------------- | ---------------- | ---- | ---------------------------------- |
| name            | string           | 是   | 全局唯一                           |
| description     | string \| null   | 否   | 描述                               |
| type            | enum             | 是   | prompt/bash/python/powershell      |
| command         | string \| null   | 条件 | type=prompt 时必填                 |
| argsTemplate    | string \| null  | 否   | 参数模板字符串（按 inputMode 使用占位符：arg=`{{prompt}}`/file=`{{prompt-file}}`/stdin=无，见 5.5） |
| inputMode       | enum \| null     | 否   | arg / stdin / file                 |
| outputMode      | enum \| null     | 否   | text / json / jsonl                |
| outputJsonPath  | string \| null   | 否   | JSON 提取路径                      |
| exitCodeSuccess | number[] \| null | 否   | 成功退出码                         |
| binaryPath      | string \| null   | 条件 | type=bash/python/powershell 时必填 |

> **审计字段规则**：请求若携带 `clientId` / `createdAtMs` / `updatedAtMs`，后端一律忽略（或返回 400，按实现约定）；`createdAtMs` 保持首次创建值不变，`updatedAtMs` 由后端刷新为当前时间戳。

**审计日志**：接口完成更新后，将本次更新内容写入操作审计日志（存储位置见后端设计文档第七章「日志管理」——操作审计，DB 或日志文件）。记录内容至少包含：

| 字段        | 说明                                   |
| ----------- | -------------------------------------- |
| action      | 操作类型，恒为 `client.update`         |
| targetId    | 被更新 Client 的 id                    |
| before      | 更新前的字段快照（或仅变更字段的旧值） |
| after       | 更新后的字段快照（或仅变更字段的新值） |
| updatedAtMs | 本次更新的时间戳                       |

**成功响应 `200 OK`**：返回更新后的 Client 对象（`updatedAtMs` 已由后端刷新，`createdAtMs` 保持首次创建值）。

**错误响应**：

| 状态码 | code                 | 场景                                             |
| ------ | -------------------- | ------------------------------------------------ |
| 400    | `VALIDATION_ERROR`   | 请求体字段非法（含请求携带审计字段时按约定拒绝） |
| 404    | `CLIENT_NOT_FOUND`   | clientId 不存在                                        |
| 409    | `CLIENT_NAME_EXISTS` | 修改后的 name 与其他 Client 冲突                 |

---

### 3.1.5 DELETE /api/clients/{clientId} —— 删除 Client

**功能说明**：删除 Client。若该 Client 正被 Job 引用则返回 409 拒绝删除，避免产生悬挂引用。

**路径参数**：

| 参数 | 类型               | 必填 | 说明               |
| ---- | ------------------ | ---- | ------------------ |
| clientId | string(32 位 UUID) | 是   | 待删除 Client 标识 |

**查询参数**：无

**请求体**：无

**成功响应 `200 OK`**：

```json
{ "ok": true }
```

**错误响应**：

| 状态码 | code                | 场景                                |
| ------ | ------------------- | ----------------------------------- |
| 400    | `VALIDATION_ERROR`  | clientId 格式非法                         |
| 404    | `CLIENT_NOT_FOUND`  | clientId 不存在                           |
| 409    | `CLIENT_REFERENCED` | 该 Client 正被 Job 引用，删除被拒绝 |

---

### 3.1.6 POST /api/clients/{clientId}/test —— 测试 Client 执行能力

**功能说明**：对 4 种类型（prompt / bash / python / powershell）均可执行测试，用于验证该 Client 在**第5章 Executor 体系下的完整执行能力**——不是仅探测命令是否可用，而是按 `client.type` 构造一个最小测试用例，**完整走一遍 `Executor.execute` 流程**（生成 main 文件 → 选定 run.xxx → 注入执行上下文 → 启动子进程并重定向 → 回收 stdout/stderr/rc）。**测试内容由后端根据 `client.type` 决定，前端不感知测试细节**，因此本接口**无请求体**（前端仅发起测试请求即可）。

> **同步实时返回**：本接口直接调用 `Executor::execute` 并**阻塞等待**其 `ExecuteResult`，请求结束即返回测试结果——前端点击「测试」可立即看到成败，**不走异步任务队列**。
> **不写入运行历史**：test 是验证 Client 执行能力的动作，**不创建 JobRun / step_record、不进入运行历史**——它是同步探测而非一次真实运行，避免污染运行历史。

**路径参数**：

| 参数 | 类型               | 必填 | 说明               |
| ---- | ------------------ | ---- | ------------------ |
| clientId | string(32 位 UUID) | 是   | 待测试 Client 标识 |

**查询参数**：无　**请求体**：无

**后端实现**：本接口**直接同步调用 `Executor::execute`**——test 已具备该 `client` 的全部执行能力，**无需异步队列、也无需一个正式 OP**：按 `client.type` **自组装一个测试用最小执行描述**（结构类似 OP，仅含测试所需字段：`content`=下方最小测试内容、默认 `timeoutMs`、空 `inputs`、空 `outputs`），连同该 Client 实例组装成 `ExecuteRequest`（`run_id` 由后端生成）同步调用 `Executor::execute`，返回其 `ExecuteResult`。**不重复实现执行细节**（写 main 文件、选 run.xxx、注入上下文、启动子进程、重定向、回收出参与退出码，均由 Executor 内部完成）。

测试用例最小化（仅用于验证 Executor 流程跑通）：

| Client 类型 | 最小测试用例（content）                                    |
| ----------- | ---------------------------------------------------------- |
| prompt      | 提示词"仅返回固定文本，不执行外部操作"                     |
| bash        | 脚本 `echo "executor-test-ok"`                             |
| python      | 脚本 `print("executor-test-ok")`                           |
| powershell  | 脚本 `Write-Output "executor-test-ok"`                     |

> **测试判定标准**：test 成败 = `ExecuteResult.status == success`（Executor 调用流程正常跑完）。测试用例正常应 `exit_code=0`、`raw_output` 含测试文本。main 文件、临时结果目录运行后清理，测试不保留结果。

**成功响应 `200 OK`**：

```json
{
  "success": true,
  "exitCode": 0,
  "rawOutput": "executor-test-ok",
  "error": null,
  "durationMs": 23
}
```

| 响应字段   | 类型             | 说明                                                          |
| ---------- | ---------------- | ------------------------------------------------------------- |
| success    | boolean          | Executor 调用流程是否正常跑完（run.xxx 退出码 0 且 rc_file 可读） |
| exitCode   | integer          | 用户脚本/CLI 的退出码（读自 rc_file；测试用例正常应为 0）      |
| rawOutput  | string \| null   | 测试用例的原始输出（读自 stdout_file）                         |
| error      | string \| null   | 失败原因（读自 stderr_file，或流程自身错误）                   |
| durationMs | integer          | 测试耗时（毫秒）                                               |

**错误响应**：

| 状态码 | code               | 场景                     |
| ------ | ------------------ | ------------------------ |
| 400    | `VALIDATION_ERROR` | clientId 格式非法              |
| 404    | `CLIENT_NOT_FOUND` | clientId 不存在                |
| 500    | `INTERNAL_ERROR`   | 执行测试进程发生内部错误 |

---

## 五、单次执行器 (Executor)

### 5.0 设计原则：统一的可执行模型

> **核心认知**：无论 prompt 还是 bash / python / powershell，`Executor` 的职责本质相同——**"启动一个可执行命令，向它注入输入与上下文，捕获并解析其输出"**。四类 Client 的差异只体现在"待执行内容从哪来、如何喂入进程"，最终都是运行一个二进制。

| Client 类型 | 可执行二进制                   | 待执行内容（OP.content） | 喂入方式                                                      |
| ----------- | ------------------------------ | ------------------------ | ------------------------------------------------------------- |
| prompt      | `command`（外部 CLI）          | prompt 文本              | 经 `argsTemplate` + `inputMode`（arg/stdin/file）传给 command |
| bash        | `binaryPath`（如 `/bin/bash`） | bash 脚本源码            | 包装脚本内联执行                                              |
| python      | `binaryPath`（如 `python3`）   | python 源码              | 包装脚本内联执行                                              |
| powershell  | `binaryPath`（如 `pwsh`）      | powershell 源码          | 包装脚本内联执行                                              |

> **关键认知**：`prompt` 的 `command` 与脚本类的 `binaryPath` 本质都是"一个可运行的二进制"。区别仅在于——脚本类把 `OP.content` 当作**程序源码**由解释器执行；prompt 把 `OP.content` 当作**输入文本**交由外部 CLI 处理。**四类都设置工作区（workspace）、都注入统一环境变量、都捕获 stdout 并按 outputMode 解析。**

### 5.1 运行过程

**执行器入口接口（Executor API）**：Executor 对外只暴露一个入口函数，调用方（`test` 接口、Job 执行、单次 OP 执行）统一经它发起一次执行，不感知内部细节：

```rust
/// 单次执行器：入口函数
pub struct Executor;
impl Executor {
    /// 执行一次 OP，返回 ExecuteResult；内部完成 5.1–5.4 全部流程，调用方只构造请求、接收结果
    pub fn execute(req: ExecuteRequest) -> Result<ExecuteResult, ExecutorError>;
}

/// 执行请求结构体 (最小原子执行: 只描述"执行什么、用什么执行、本次入参、在哪里执行、执行实例标识", 不包含步骤/编排概念)
pub struct ExecuteRequest {
    pub run_id:    String,                  // 本次执行实例唯一标识, 用于 main 文件 / 临时结果目录 / 日志命名 (避免多执行实例冲突):
                                           //   - workflow/Job 场景: 由 <jobRunId>_<stepId> 组合而成 (同一 Job 内各步骤并发执行时仍全局唯一)
                                           //   - 单次 OP / test 场景: 调用方生成的 runId
    pub client:    Client,                  // Client 实例 (或其执行所需配置快照): 依 type 选 run.xxx, 依 command/binaryPath/argsTemplate/inputMode 组装命令, 依 outputMode/outputJsonPath 解析出参
    pub op:        Op,                      // 操作定义: content / timeoutMs / inputs / outputs
    pub inputs:    HashMap<String, String>, // 本次运行入参 (已校验 required、应用 default)
    pub workspace: PathBuf,                 // 工作区绝对路径
}

/// 执行结果结构体 (最小原子执行的结果; 步骤归属由上层拿到结果后自行关联, ExecuteResult 本身不感知 step)
pub struct ExecuteResult {
    pub status:      ExecuteStatus,           // success | failed | timeout
    pub outputs:     HashMap<String, String>, // 出参 (脚本类: 读 OUTPUT_ARGS 回传; prompt 类: 主函数解析 stdout_file/outputs_file)
    pub raw_output:  String,                  // main/CLI 原始输出 (读 stdout_file)
    pub error:       String,                  // 错误信息 (读 stderr_file)
    pub exit_code:   i32,                     // 用户脚本/CLI 退出码 (读 rc_file)
    pub duration_ms: u64,                     // 执行耗时
    pub timed_out:   bool,                    // 是否超时
}
```

> **Executor 是最小原子执行单元**：只输入"执行什么（op）、用什么执行（client）、本次入参（inputs）、在哪里执行（workspace）、执行实例标识（run_id）"，返回一次执行的结果 `ExecuteResult`。**`run_id` 只是执行实例的全局唯一标识**（用于 main 文件/临时目录/日志命名），不是步骤编排信息：workflow/Job 场景由 `<jobRunId>_<stepId>` 组合（同一 Job 内不同步骤并发执行时标识仍唯一、文件不冲突），单次 OP / test 由调用方生成。**Executor 不感知 step / 步骤**——步骤归属、与 Workflow/Job 的关系由上层（编排层）在拿到 `ExecuteResult` 后自行关联。`test` 接口（3.1.6）、Job 执行、单次 OP 执行均封装这一入口。**临时文件的创建归属 `execute` 内部**：调用方只保证 `run_id` 全局唯一即可——`.ai_auto_result-<runId>/` 临时目录、`<workspace>/.main-<runId>-<opId>.*` main 文件均由 `execute` 内部创建，运行结束由 `execute` 清理，调用方不参与创建与清理。

**运行目录约定**：Executor 运行所需文件统一放在 **APP 统一运行时目录**下，与前端生成的中间文件同处一个根目录：

```text
<APP 统一运行时目录>
├── <前端生成的中间文件 ...>
└── scripts/                          # 包装脚本目录 (APP 临时生成)
    ├── run.bash   run.py   run.ps1
    ├── run.prompt.ps1                # run.prompt 的 Windows 变体
    └── run.prompt.bash               # run.prompt 的 Linux 变体
└── .ai_auto_result-<runId>/          # 单次运行临时结果目录 (以 .ai_auto_result 开头)
    ├── stdout          # stdout_file (main/CLI 原始输出)
    ├── stderr          # stderr_file (错误输出)
    ├── rc              # rc_file (退出码)
    └── outputs.json    # outputs_file (仅 prompt 类): 出参结果 JSON, 即 W_AI_AUTO_OP_OUTPUTS_FILE
```

- **scripts 目录**：包装脚本 `run.xxx` 由 APP **在启动时临时生成**到 `<根>/scripts/` 目录。它与前端文件生成的目录同处统一根目录之下——只是专门放在 `scripts` 子目录。
- **临时结果目录**：每次运行创建 `<根>/.ai_auto_result-<runId>/`，存放本次的 stdout_file / stderr_file / rc_file，以及（仅 prompt 类）出参结果 JSON 文件 `outputs.json`——即 `W_AI_AUTO_OP_OUTPUTS_FILE` 指向该路径。**程序启动时主动清理所有以 `.ai_auto_result` 开头的残留目录**，防止程序中断导致文件大量残留。
  **创建归属**：临时目录与 main 文件由 `execute` 内部创建、运行结束由 `execute` 清理；调用方仅保证 `run_id` 唯一（workflow= `<jobRunId>_<stepId>`），不参与临时文件创建/清理。全局残留清理（启动时清 `.ai_auto_result*`）由 APP 启动流程负责。

```text
Executor.execute(req: ExecuteRequest)   # req = {run_id, client, op, inputs, workspace}
  │
  ├─ 1. 解析 OP 入参: 校验 required, 缺省项应用 default → 最终入参集 (见 5.3)
  │
  ├─ 2. 准备 main 文件: 把 OP.content 按脚本类型写入 workspace 根目录
  │     .main-<runId>-<opId>.bash / .main-<runId>-<opId>.py
  │     .main-<runId>-<opId>.ps1 / .main-<runId>-<opId>.prompt
  │     (命名含 runId + opId, 避免多运行/多 OP 间 main 文件冲突)
  │     运行完成后清理该 main 文件
  │
  ├─ 3. 选定包装脚本 run.xxx (见 5.5), 位于 <根>/scripts/:
  │     bash→run.bash, python→run.py, powershell→run.ps1
  │     prompt→run.prompt (Windows 变体 run.prompt.ps1 / Linux 变体 run.prompt.bash)
  │
  ├─ 4. 构造子进程固定参数 (5 个):
  │     run.xxx <workspace> <main_file> <stdout_file> <stderr_file> <rc_file>
  │     stdout_file / stderr_file / rc_file 位于本次临时目录 .ai_auto_result-<runId>/
  │     (临时目录以 .ai_auto_result 开头, 程序启动时清理所有此类残留)
  │
  ├─ 5. 注入执行上下文 (见 5.2 / 5.3):
  │     - 环境变量 (tokio .env()): 框架级 W_AI_AUTO_* 元信息与解析配置
  │     - stdin 逐行喂入参: 每行 "INPUT_ARGS: <key>: <base64Value>"
  │       共 W_AI_AUTO_OP_INPUT_COUNT 行 (脚本类 run.xxx 读 N 次反解注入上下文;
  │       prompt 类照常写入但脚本内忽略——入参经 meta 指令进 final prompt)
  │
  ├─ 6. 启动子进程:
  │     - 指定工作目录 (current_dir=workspace); 但 run.xxx 可能位于固定位置, 脚本内仍 cd 到 workspace
  │     - 创建独立进程组 (process_group=0 / setsid): 子进程成为新进程组 leader
  │       → 该组包含 run.xxx 及其派生的 main.xxx / 外部 CLI 整棵进程树
  │
  ├─ 7. 超时控制 (op.timeoutMs): 超时则按进程组查杀整棵进程树, timedOut=true
  │
  ├─ 8. 子进程结束后, 主进程回收结果:
  │     - 脚本类: 读子进程 stdout → 取以 "OUTPUT_ARGS:" 开头的行, 反 base64 → outputs (见 5.4)
  │     - prompt 类: 由主函数读 stdout_file (CLI 输出) + outputs_file (AI 写出参 JSON),
  │       按 outputMode/jsonPath 统一解析出参 (见 5.5)
  │     - 读 stdout_file → rawOutput (main 原始输出)
  │     - 读 stderr_file → error
  │     - 读 rc_file    → 用户/CLI 退出码, 结合 exitCodeSuccess 判定 status
  │       (run.xxx 自身退出码仅表示流程是否正常跑完; 正常跑完即 0, 用户成败由 rc_file 判定, 见 5.4)
  │
  └─ 9. 组装 ExecuteResult {status, outputs, rawOutput, exitCode, error, durationMs}
```

### 5.2 执行上下文与环境变量注入

**注入方式**：所有环境变量**统一加 `W_AI_AUTO_` 前缀**（`W_AI_AUTO_XXX`，XXX 为下方变量名），通过 `tokio::process` 启动子进程时注入（`.env()`），不在包装脚本内声明。注入给 `run.xxx` 进程；`main.xxx` 复用同一执行上下文——`run.bash` 以**子 shell `source`** 执行，main 在子 shell 内直接可见全部变量（入参 `export` 后随环境继承）；`run.py` / `run.ps1` 以子进程方式执行并继承同一环境。加前缀是为避免脚本中与系统环境变量冲突。

统一注入变量（框架级元信息与解析配置）：

| 变量 | 说明 |
|-|-|
| `W_AI_AUTO_WORKSPACE` | 工作区绝对路径（也作为 run.xxx 的第 1 个参数传入） |
| `W_AI_AUTO_RUN_ID` | 本次执行实例 `run_id`（= ExecuteRequest.run_id）：workflow/Job 场景为 `<jobRunId>_<stepId>`，单次 OP / test 为调用方生成的 runId |
| `W_AI_AUTO_STEP_ID` | （可选，由上层透传）步骤上下文 id；Executor 最小执行不依赖它，仅透传给脚本供日志/命名参考 |
| `W_AI_AUTO_OP_NAME` | OP 名称 |
| `W_AI_AUTO_OP_VERSION` | OP 版本号 |
| `W_AI_AUTO_TIMEOUT_MS` | 本次执行超时毫秒 |
| `W_AI_AUTO_OP_INPUT_COUNT` | 入参个数（run.xxx 据此从 stdin 读取 N 次，见下方入参 stdin 协议） |
| `W_AI_AUTO_OP_OUTPUT_COUNT` | 出参个数（脚本类据此判断是否再从 stdin 读一行出参名；prompt 类不读，见 5.4 / 5.5） |
| `W_AI_AUTO_OP_OUTPUT_MODE` / `W_AI_AUTO_OP_OUTPUT_JSON_PATH` / `W_AI_AUTO_OP_OUTPUTS_DEF_JSON` | outputs 解析配置，**主要用于 prompt 类**：Executor 主函数用 `OUTPUT_MODE`/`OUTPUT_JSON_PATH` 从 CLI 输出（stdout_file）解析出参；脚本类出参直接取执行上下文同名变量、不按 outputMode（见 5.4）。`OUTPUTS_DEF_JSON` 由主线程拼进 final prompt，不再注入 run.prompt |
| `W_AI_AUTO_OP_COMMAND` / `W_AI_AUTO_OP_ARGS_TEMPLATE` / `W_AI_AUTO_OP_INPUT_MODE` / `W_AI_AUTO_OP_OUTPUTS_FILE` | 仅 prompt：外部 CLI、额外参数模板（按 inputMode 使用占位符：arg=`{{prompt}}`=final prompt 文本 / file=`{{prompt-file}}`=final prompt 文件路径 / stdin=无占位符）、喂入方式（arg=命令行参数 / stdin=final prompt 经 stdin / file=final prompt 文件路径）、出参结果 JSON 文件路径（可选）。主进程照常按协议写入入参值/出参名 stdin（run.prompt 脚本内忽略不使用）；出参定义（含描述）等大内容由主线程拼进 final prompt（main_file），不进环境变量 |

**stdin 注入协议**：入参与出参名**不通过环境变量注入**，而是经 stdin 逐行喂给 run.xxx，避免占用环境变量空间、并与系统变量隔离：

```text
INPUT_ARGS: <key>: <base64Value>          # 每行一个入参, 共 W_AI_AUTO_OP_INPUT_COUNT 行
INPUT_ARGS: <key>: <base64Value>
...
OUTPUT_NAMES: <name1>,<name2>,<name3>     # 仅当 W_AI_AUTO_OP_OUTPUT_COUNT > 0 时再读这一行
```

- 主进程先把每个入参值 base64 编码，组装成 `INPUT_ARGS: key: base64Value`，一个入参一行写入 run.xxx 的 stdin。
- run.xxx 从 stdin 读取 N 次（N = `W_AI_AUTO_OP_INPUT_COUNT`），逐行解析出 key 与 base64 值，反 base64 还原入参值，再**以用户定义的入参名作为变量名注入脚本执行的上下文**（不带 `W_AI_AUTO_` 前缀），供用户脚本直接按入参名使用。
- 读完入参后，run.xxx 检查 `W_AI_AUTO_OP_OUTPUT_COUNT`：若为 0 则不再读 stdin；若非 0，则再读一行 `OUTPUT_NAMES: name1,name2,...`（逗号分隔的出参名列表），得到本次要提取的出参名。

> **main_file 与工作目录**：`main` 文件 = 用户 OP.content 按类型写入 workspace 根目录的 `.main-<runId>-<opId>.{bash|py|ps1|prompt}`（命名含 runId+opId 避免冲突）；**prompt 类例外**：main_file 不是原始 OP.content，而是**主线程组装好的 final prompt**（用户模板 + meta 指令）。`run.xxx` 负责 `cd` 到 workspace 再执行（启动时虽已指定工作目录，脚本内仍会 cd——因为 run.xxx 可能位于固定位置，而非 workspace 内）。**运行完成后由 Executor 清理该 main 文件**。

### 5.3 入参定义与注入

**OP.inputs 结构**（每项）：

| 字段        | 类型           | 说明                                                                                  |
| ----------- | -------------- | ------------------------------------------------------------------------------------- |
| name        | string         | 入参名，作为 stdin 协议的 key（`INPUT_ARGS: <name>: <base64Value>`）；AI 通过 meta 指令【入参 K:V】获取入参 |
| type        | string         | 恒为 `"string"`                                                                       |
| required    | boolean        | 是否必填                                                                              |
| default     | string \| null | 默认值，请求未提供时应用                                                              |
| description | string         | 说明                                                                                  |

**注入通道**：

| 通道                                       | 适用类型 | 说明                                                                                    |
| ------------------------------------------ | -------- | --------------------------------------------------------------------------------------- |
| stdin 协议 `INPUT_ARGS: <key>: <base64Value>` | 脚本类（bash/python/powershell） | 每个入参一行，共 `W_AI_AUTO_OP_INPUT_COUNT` 行；run.xxx 反 base64 后以用户入参名为变量名注入（不带前缀）；prompt 类照常写入但脚本内忽略，入参经 meta 指令进 final prompt |
| prompt 文本 / stdin / 文件                 | prompt   | main_file（.main-<runId>-<opId>.prompt）的文本按 inputMode（arg/stdin/file）喂给外部 CLI |

**入参解析规则**：请求提供的 inputs 校验 required；缺省项取 default；仍缺必填项时报 400（运行时校验）。

### 5.4 出参定义与输出解析

**OP.outputs 结构**（每项）：

| 字段        | 类型   | 说明                       |
| ----------- | ------ | -------------------------- |
| name        | string | 出参名，作为解析结果的 key |
| type        | string | 恒为 `"string"`            |
| description | string | 说明                       |

**解析位置（脚本类）**：在 run.xxx（子进程侧）完成，而非主进程。原因：脚本类的部分出参值依赖于脚本运行上下文（退出码、环境变量、main_file 等），需在子进程内就地获取后再回传。各 run.xxx 实现略有差异；**prompt 类例外**——无变量作用域，出参由主函数读 CLI 输出统一解析（见 5.5）：
- `run.bash`：以**子 shell `source`** 执行 main，出参协议实现在子 shell 的 **`EXIT` trap** 内——main 无论正常结束还是 `exit` 提前退出，trap 都在子 shell 退出前执行，此时 main 留下的同名变量仍存在，据此逐出参取回；`exit` 只退出子 shell，不杀 run.bash。
- `run.py` / `run.ps1`：以子进程执行 main，出参协议在 run.xxx 内于 main 结束后解析执行。

**出参个数与名称注入（脚本类）**：为让 run.xxx 知道该取哪些出参值（执行上下文中变量很多）：
- 出参个数经环境变量 `W_AI_AUTO_OP_OUTPUT_COUNT` 注入。
- 出参名**不经环境变量、也不逐变量注入**，而是经 stdin 在入参行之后以**一行逗号分隔**的列表注入（`OUTPUT_NAMES: name1,name2,name3`），与入参共用 stdin 通道。
- run.xxx 读完入参行后检查 `W_AI_AUTO_OP_OUTPUT_COUNT`：为 0 则不再读 stdin；非 0 则再读一行取到完整的出参名列表。

**解析流程（脚本类，run.xxx 内）**：

1. main.xxx 运行结束，其原始 stdout / stderr 已重定向到 `stdout_file` / `stderr_file`（作为 rawOutput / error 保留）。
2. **按出参名顺序精确取值（从执行上下文同名变量）**：run.xxx 已通过 stdin 拿到逗号分隔的出参名列表（`OUTPUT_NAMES` 行），按逗号切分得到出参名序列；执行完 main.xxx 后，For 循环按每个出参名，从**执行上下文同名变量**（用户脚本内为出参名赋值的变量）中逐个取出对应的值。这样 run.xxx 无需在众多变量中猜测，只按声明的出参名精确取值。脚本类**不按 `outputMode` 解析 main 输出**——`outputMode`/`outputJsonPath` 不作用于脚本类，仅用于 prompt 类由 Executor 主函数解析 CLI 输出（见 5.5）。
3. **每个出参单独回传**：不组装成一个整体 JSON，而是**一个出参对应一次 echo**——将单个出参的 `name` 与 `base64(value)` 组装成一行 `OUTPUT_ARGS: <name>: <base64Value>` 输出到子进程 stdout。

**输出协议**：

```text
OUTPUT_ARGS: <name1>: <base64Value1>
OUTPUT_ARGS: <name2>: <base64Value2>
...
```

每个出参一行；主进程读取**所有**以 `OUTPUT_ARGS:` 前缀的行，逐行反 base64 得到出参名值对，其余行忽略。

**主进程回收**：
- 读子进程 stdout → 取所有 `OUTPUT_ARGS:` 开头的行，逐行反 base64 → 每个出参名值对 → `outputs`
- 读 `stdout_file` → `rawOutput`（main 原始输出，用于展示）
- 读 `stderr_file` → `error`
- 读 `rc_file` → 用户脚本（或 prompt 的 CLI）的**退出码**，∈ `exitCodeSuccess`（默认 `[0]`）→ success，否则 failed；`timedOut=true` → timeout

> **run.xxx 退出码语义**：run.xxx 脚本自身的退出码**只代表"Executor 调用流程是否正常跑完"**——正常跑完（生成 main、启动 run.xxx、注入上下文、重定向、回收）即 `0`；非 0 仅表示流程自身出错（如 workspace 缺失、run.xxx 生成失败）。**用户脚本（脚本类）或外部 CLI（prompt 类）的成功/失败由主进程读 `rc_file` 中的退出码判定**，与 run.xxx 退出码无关。因此 run.xxx 一律在流程跑完后 `exit 0`，用户/CLI 的退出码只写进 `rc_file`，不充当 run.xxx 自身的退出码。

**脚本输出约定**：脚本类出参**不经 main 输出**——run.xxx 直接从执行上下文同名变量（用户脚本内为出参名赋值）逐出参取值回传（见上文步骤 2）；用户脚本**无需为出参打印 JSON**。`outputMode`/`outputJsonPath` 不作用于脚本类，仅用于 prompt 类主函数解析 CLI 输出（见 5.5）。

### 5.5 包装脚本（run.xxx）

> `run.xxx` 是 Executor **运行时自带**的固定包装脚本，非用户内容，由 APP 在启动时临时生成到 `<根>/scripts/` 目录（与前端文件生成同处统一根目录、位于 scripts 子目录）；四类脚本的**固定入参一致**（5 个）：
> `workspace main_file stdout_file stderr_file rc_file`
> - `workspace`：当前工作目录（脚本内 `cd` 到这里）
> - `main_file`：用户 OP.content 按类型保存在 workspace 根目录的 `.main-<runId>-<opId>.{bash|py|ps1|prompt}` 路径（命名含 runId+opId 避免冲突；运行完成后清理）
> - `stdout_file` / `stderr_file`：main.xxx 运行的 stdout / stderr 记录文件
> - `rc_file`：main.xxx 运行完成后的退出码记录文件

**① run.bash**

```bash
#!/bin/bash
# run.bash — bash 通用包装 (Executor 自带)  [子 shell source 模式]
# 固定入参: workspace main_file stdout_file stderr_file rc_file
workspace="$1"; main_file="$2"; stdout_file="$3"; stderr_file="$4"; rc_file="$5"
cd "$workspace" || { echo "ERR: workspace not found" >&2; echo 2 > "$rc_file"; exit 2; }

# --- 从 stdin 读取入参 (协议见 5.2/5.3) ---
# 读 W_AI_AUTO_OP_INPUT_COUNT 行 "INPUT_ARGS: key: base64Value",
# 反 base64 后以用户定义的入参名为变量名 export (不带前缀); 子 shell 继承环境, main 直接可见
count="${W_AI_AUTO_OP_INPUT_COUNT:-0}"
i=0
while [ "$i" -lt "$count" ]; do
  IFS= read -r line
  case "$line" in
    INPUT_ARGS:\ *) ;;
    *) continue ;;
  esac
  kv="${line#INPUT_ARGS: }"
  key="${kv%%: *}"
  b64="${kv#*: }"
  val="$(printf '%s' "$b64" | base64 -d)"
  export "${key}=${val}"    # 直接用用户定义的入参名为变量名, 不带前缀
  i=$((i+1))
done

# --- 出参名列表: OUTPUT_COUNT > 0 时再读一行 "OUTPUT_NAMES: name1,name2,..." ---
out_names=""
if [ "${W_AI_AUTO_OP_OUTPUT_COUNT:-0}" -gt 0 ]; then
  IFS= read -r out_line
  out_names="${out_line#OUTPUT_NAMES: }"
fi

# --- 子 shell source: exit 只退子 shell, 主进程安全; 出参协议在 EXIT trap 内实现 ---
# source 用户脚本: 与子 shell 同一上下文, 脚本内设置的变量直接保留在子 shell
# EXIT trap 保证: main 无论正常结束还是 exit 提前退出, 协议都在子 shell 退出前执行
# 此时 main 留下的同名变量仍存在; 逐出参名用 ${!n} 取值, 逐出参 echo 到子 shell stdout
(
  IFS=',' read -ra _names <<< "$out_names"
  trap '
    for n in "${_names[@]}"; do
      n="${n//[[:space:]]/}"
      [ -n "$n" ] || continue
      b64="$(printf "%s" "${!n}" | base64)"
      echo "OUTPUT_ARGS: ${n}: ${b64}"
    done
  ' EXIT
  source "$main_file" >"$stdout_file" 2>"$stderr_file"
)
rc=$?                        # 用户脚本(main)的退出码: 写 rc_file, 供主进程判断用户脚本成败
echo "$rc" > "$rc_file"

# run.xxx 自身退出码仅表示"Executor 调用流程是否正常跑完" — 正常跑完即 0;
# 用户脚本成败由主进程读 rc_file / stderr_file 判定, 不经 run.xxx 退出码感知
exit 0
```

**② run.py**

```python
#!/usr/bin/env python3
# run.py — python 通用包装 (Executor 自带)  [exec 模式]
# 固定入参: workspace main_file stdout_file stderr_file rc_file
import os, sys, base64, contextlib, traceback
workspace, main_file, stdout_file, stderr_file, rc_file = sys.argv[1:6]
os.chdir(workspace)

# --- 从 stdin 读取入参 (协议见 5.2/5.3): 每行 "INPUT_ARGS: key: base64Value" ---
count = int(os.environ.get("W_AI_AUTO_OP_INPUT_COUNT", "0"))
inputs = {}
for _ in range(count):
    line = sys.stdin.readline().strip()
    if not line.startswith("INPUT_ARGS: "):
        continue
    key, b64 = line[len("INPUT_ARGS: "):].split(": ", 1)
    inputs[key] = base64.b64decode(b64).decode("utf-8")

# --- 出参名列表: OUTPUT_COUNT > 0 时再读一行 "OUTPUT_NAMES: name1,name2,..." ---
out_names = []
if int(os.environ.get("W_AI_AUTO_OP_OUTPUT_COUNT", "0")) > 0:
    line = sys.stdin.readline().strip()
    if line.startswith("OUTPUT_NAMES: "):
        out_names = [n.strip() for n in line[len("OUTPUT_NAMES: "):].split(",") if n.strip()]

# --- exec 执行用户脚本: 入参注入 locals, 出参从 locals 读 (用户免感知协议) ---
# exec 前把 sys.stdout/sys.stderr 重定向到 stdout_file/stderr_file, 用户 print 进 rawOutput
g = {"__name__": "__main__"}
l = dict(inputs)                 # 用户脚本直接按入参名访问
rc = 0
real_stdout = sys.stdout
with open(stdout_file, "w", encoding="utf-8") as so, \
     open(stderr_file, "w", encoding="utf-8") as se:
    with contextlib.redirect_stdout(so), contextlib.redirect_stderr(se):
        try:
            with open(main_file, encoding="utf-8") as f:
                src = f.read()
            exec(compile(src, main_file, "exec"), g, l)
        except SystemExit as e:          # exit()/quit()/sys.exit() → 视为用户段结束
            rc = e.code if isinstance(e.code, int) else 0
        except BaseException:            # 用户脚本异常 → failed, 堆栈写 stderr_file
            rc = 1
            traceback.print_exc(file=se)

# --- 出参从 locals 读 (用户设的同名变量), 每出参一行回传到真实 stdout ---
for name in out_names:
    b64 = base64.b64encode(str(l.get(name, "")).encode("utf-8")).decode()
    print(f"OUTPUT_ARGS: {name}: {b64}", file=real_stdout)

# run.py 自身正常跑完进程退出码为 0 (无显式 exit); 用户脚本 rc 已写 rc_file, 由主进程读取判定
with open(rc_file, "w") as f:
    f.write(str(rc))
```

**③ run.ps1**

```powershell
# run.ps1 — powershell 通用包装 (Executor 自带)  [子进程 dot-source 模式]
# 固定入参: workspace main_file stdout_file stderr_file rc_file
$workspace, $main_file, $stdout_file, $stderr_file, $rc_file = $args
Set-Location $workspace

# --- 从 stdin 读取入参 (协议见 5.2/5.3): 每行 "INPUT_ARGS: key: base64Value" ---
# 反 base64 后以用户定义的入参名为环境变量注入 (不带前缀), 子进程继承后赋同名脚本级变量
$count = [int]$env:W_AI_AUTO_OP_INPUT_COUNT
$inputNames = @()
for ($i = 0; $i -lt $count; $i++) {
  $line = [Console]::ReadLine()
  if ($line -notlike "INPUT_ARGS: *") { continue }
  $rest = $line.Substring("INPUT_ARGS: ".Length)
  $key, $b64 = $rest -split ": ", 2
  $value = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64.Trim()))
  [Environment]::SetEnvironmentVariable($key, $value, 'Process')   # 用用户入参名为变量名, 不带前缀
  $inputNames += $key
}

# --- 出参名列表: OUTPUT_COUNT > 0 时再读一行 "OUTPUT_NAMES: name1,name2,..." ---
$outNames = @()
if ([int]$env:W_AI_AUTO_OP_OUTPUT_COUNT -gt 0) {
  $line = [Console]::ReadLine()
  if ($line -like "OUTPUT_NAMES: *") {
    $outNames = @($line.Substring("OUTPUT_NAMES: ".Length) -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  }
}

# --- 子进程 dot-source 隔离: 用户 exit 只终止子进程, run.ps1 不死 ---
# PowerShell 无 EXIT trap / SystemExit: 用户脚本 exit 会终止宿主, 故必须在子进程内 dot-source
$env:W_AI_AUTO_MAIN_FILE     = $main_file
$env:W_AI_AUTO_STDOUT_FILE   = $stdout_file
$env:W_AI_AUTO_STDERR_FILE   = $stderr_file
$env:W_AI_AUTO_OP_INPUT_NAMES  = ($inputNames -join ",")
$env:W_AI_AUTO_OP_OUTPUT_NAMES = ($outNames -join ",")

$inner = @'
# inner — 在子进程内 dot-source 用户脚本 (同 run.bash 子 shell source)
$ErrorActionPreference = 'Stop'   # Write-Error / throw 转终止性错误 → 子进程 rc 非 0 (失败)
# PowerShell 平台差异: dot-source 下用户 exit 不终止子进程(出参仍可读), 但退出码不可得(恒 0),
# 故失败请用 throw / Write-Error 表达, 勿用 exit 表达退出码
$inNames = @($env:W_AI_AUTO_OP_INPUT_NAMES -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ })
foreach ($n in $inNames) { Set-Variable -Name $n -Value ([Environment]::GetEnvironmentVariable($n, 'Process')) }
$outNames = @($env:W_AI_AUTO_OP_OUTPUT_NAMES -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$main = $env:W_AI_AUTO_MAIN_FILE
# dot-source 用户脚本 (script scope, 变量保留): 成功流写 stdout_file, 错误流写 stderr_file
$so = . $main 2> $env:W_AI_AUTO_STDERR_FILE
if ($so) { $so | Set-Content -Encoding UTF8 $env:W_AI_AUTO_STDOUT_FILE }
# 出参: 读 script scope 同名变量, 逐出参 echo OUTPUT_ARGS (每个出参单独一行)
foreach ($n in $outNames) {
  $val = Get-Variable -Name $n -ValueOnly -ErrorAction SilentlyContinue
  if ($null -eq $val) { $val = "" }
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([string]$val))
  Write-Output "OUTPUT_ARGS: $n`: $b64"
}
'@

$innerPath = Join-Path (Split-Path $stdout_file) "inner-$($env:W_AI_AUTO_RUN_ID).ps1"
[IO.File]::WriteAllText($innerPath, $inner, [Text.UTF8Encoding]::new($false))
& (Join-Path $PSHOME 'powershell.exe') -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $innerPath 2>$null
$rc = $LASTEXITCODE
Remove-Item $innerPath -Force -ErrorAction SilentlyContinue

# run.ps1 自身正常跑完进程退出码为 0 (无显式 exit); 用户脚本 rc 已写 rc_file, 由主进程读取判定
# rc 回写; OUTPUT_ARGS 已由子进程透传到本进程 stdout (逐出参一行)
[IO.File]::WriteAllText($rc_file, "$rc", [Text.UTF8Encoding]::new($false))
```

**④ run.prompt**（Windows 变体 = `run.prompt.ps1` / Linux 变体 = `run.prompt.bash`）

> **职责差异（与 run.bash/run.py/run.ps1 的本质区别）**：run.bash 等是"同类脚本执行同类脚本"（OP.content 是可执行源码、内联执行），才有用户 `exit` 会不会杀主进程的退出问题；run.prompt 的 OP.content 是**提示词文本**，执行对象是**外部 agent CLI 的子进程**（Claude / Doubao / 自研 agent 二进制），不存在脚本 exit 问题。
>
> run.prompt 要解决另一组问题，同时**复用与其他 run.xxx 一致的外层调用协议**（主进程照常把 INPUT_ARGS / OUTPUT_NAMES 写入 stdin、脚本内忽略不读取、写 rc_file），让用户用 prompt 时拥有与脚本一致的出入参与成功/失败体验；**出参不在脚本内回传**——prompt 类无变量作用域，脚本只执行命令，出参由主函数读 CLI 输出统一解析（见 5.5）。
>
> **核心：final prompt 由 Executor 主线程组装（非 run.prompt 内组装）**。入参值、出参定义（含 description）等大内容若经**环境变量 / stdin 中转会受长度限制**，因此**组装动作放到主线程（Executor）**：Executor 拥有 OP.content、本次运行入参、OP.outputs 定义，在启动 run.prompt 前把**最终 prompt 文本**组装好并写入 main_file（.main-<runId>-<opId>.prompt）。**run.prompt 不再读取 stdin 协议**（主进程仍按协议写入 INPUT_ARGS / OUTPUT_NAMES，脚本内忽略不使用），入参/出参信息不进 run.prompt 上下文——meta（含出参描述）由主线程拼进 final prompt 文件。
>
> **主线程组装的 final prompt = 用户 `OP.content`（提示词模板）+ 追加的 meta 指令**，meta 指令约定：
>
> 1. **入参**：按 `K:V` 格式换行写出，每行一组——`key1: value1`、`key2: value2`……（值由主线程从本次运行入参填入）。
> 2. **出参定义**：逐行列出**出参名与说明（description）**——`name: description`，来自 OP.outputs。**描述必须带上**——只给名字时 AI 无法理解该出参的含义，也就无法正确产出。
> 3. **输出要求**：处理完成后，把出参值组装成一个 JSON 对象（字段名=出参名，值=结果），**保存到文件 `W_AI_AUTO_OP_OUTPUTS_FILE`**（= `<根>/.ai_auto_result-<runId>/outputs.json`，见 5.1 结果目录约定），并把该 JSON **原样打印到 stdout**。
> 4. **main file 指引**：告知 AI 依据以上入参与出参要求，执行/参考 main file（给出路径）。
>
> **两个 main file（区分原始输入与组装产物）**：prompt 类在组装前后存在两个"main 文件"概念，不要混淆——
> 1. **原始输入（用户 `OP.content`）**：用户编写的原始提示词文本（纯文本，不引用占位符；入参经 meta 指令【入参 K:V】注入），是 OP 定义的一部分，始终原样保存。运行时由 Executor 落盘为 **`.origin-<runId>-<opId>.prompt`**（workspace 根目录，`origin` 前缀标记"原始"，命名含 runId+opId 避免冲突；**仅主线程组装 final prompt 时读取，不传给 run.prompt**，运行完成后由 Executor 清理）。
> 2. **组装产物（final prompt）**：主线程把原始输入与 meta 指令（入参 K:V、出参定义含描述、输出要求、main file 指引）拼装成的完整提示词，写入 **`.main-<runId>-<opId>.prompt`**（即 main_file；`main` 前缀与脚本类 `.main-<runId>-<opId>.bash` 统一——都表示"传给 run.xxx 的文件"；运行完成后由 Executor 清理）。
>
> 两者关系：**final prompt 包含原始输入**（原始模板为主体，meta 指令作为追加的任务说明）；**最终传给 run.prompt（进而交给外部 agent CLI）的是后者——组装后的 final prompt**。Executor 运行时先用 `OP.content` 组装出 final prompt 写入 main_file，再启动 run.prompt；run.prompt 读到的 main_file 即 final prompt（含原始输入 + meta 指令）。原始输入本身不再单独传给 run.prompt。
>
> **run.prompt 职责（与其他 run.xxx 保持一致的调用协议）**：主进程照常按协议把 `INPUT_ARGS` / `OUTPUT_NAMES` 写入本脚本 stdin，脚本**不读取不使用**（协议不变、脚本内忽略；入参/出参信息已由主线程组装进 final prompt 的 meta 指令）→ 读 main_file（即 final prompt，主线程已组装）→ `argsTemplate` 替换（**占位符按 inputMode 分支**：`arg` 用 `{{prompt}}`=final prompt 文本 / `file` 用 `{{prompt-file}}`=final prompt 文件路径(main_file) / `stdin` 无占位符、prompt 走 stdin；不支持 `{{main_file}}`/`{{output_file}}`/`{{input:name}}`——stdout/stderr 走重定向、main file 即 prompt）→ 按 `inputMode` 交付 CLI → **脚本只把 CLI 的 stdout/stderr 重定向到 `stdout_file`/`stderr_file`、写 `rc_file`，结束，不做任何出参解析**（免去 shell 解析 JSON / jq 依赖）。**出参解析统一由 Executor 主函数在脚本退出后完成**：读取 `stdout_file`/`stderr_file`/`rc_file`，以及（若存在）`outputs_file`（AI 写出的出参结果 JSON），按 `outputMode`/`outputJsonPath` 从 `stdout_file` 定位结果节点、按出参名取值，组装 ExecuteResult。**调用协议不变**——主进程仍按与脚本类一致的方式写入 stdin，仅 run.prompt 脚本内不使用这些值。
>
> 环境变量由 Executor 注入（仅轻量配置）：`W_AI_AUTO_OP_COMMAND`（外部 CLI）、`W_AI_AUTO_OP_ARGS_TEMPLATE`（额外参数模板，按 inputMode 使用占位符：arg=`{{prompt}}`=final prompt 文本 / file=`{{prompt-file}}`=final prompt 文件路径 / stdin=无，可选——可不使用、用纯固定参数）、`W_AI_AUTO_OP_INPUT_MODE`（arg/stdin/file）、`W_AI_AUTO_OP_OUTPUTS_FILE`（出参结果 JSON 文件路径，可选）、`W_AI_AUTO_OP_OUTPUT_MODE` / `W_AI_AUTO_OP_OUTPUT_JSON_PATH`（出参解析配置）。**入参值（INPUT_ARGS）与出参名（OUTPUT_NAMES）走 stdin 协议，与其他 run.xxx 一致**；**大内容（出参定义 JSON 含描述）不进环境变量，由主线程拼进 final prompt 文件**。**出参来源**：脚本类从"脚本变量作用域"取值，prompt 类由 **Executor 主函数统一解析**（读 CLI 输出 stdout_file，按 outputMode/jsonPath 定位结果节点、按出参名取值；outputs_file 为 AI 写出的出参结果文件）——脚本只执行命令、不做 JSON 解析，避免 jq 依赖、逻辑统一。

**prompt 类出参提取方式（Executor 主函数按 `outputMode` 从 CLI 输出解析）**：

| outputMode | 提取方式 |
| - | - |
| text | 不结构化，outputs 为空 |
| json | 解析 CLI 输出为 JSON，按 `outputJsonPath` 提取出参节点 |
| jsonl | 逐行解析（每行一个 JSON 对象） |

**argsTemplate 占位符约定（prompt 类，按 inputMode 区分）**：

| inputMode | 可用占位符 | 替换为 |
| - | - | - |
| arg | `{{prompt}}` | 组装后的 final prompt **文本**（作为命令行参数） |
| file | `{{prompt-file}}` | 组装后的 final prompt **文件路径**（= main_file） |
| stdin | 无 | prompt 经 stdin 喂入，不进命令行参数；模板仅含固定参数 |

> 模板未含对应占位符时：arg 模式把 prompt 文本追加到命令末尾；file 模式把 main_file 路径追加到命令末尾；stdin 模式不附加。不支持 `{{main_file}}`/`{{output_file}}`/`{{input:name}}`（stdout/stderr 走重定向、main file 即 prompt）。

**meta 指令模板（Executor 主线程组装）**：主线程按以下模板拼装 meta 指令（动态内容以 `<...>` 标注），再与用户 `OP.content`（原始输入）拼接成 final prompt：

```text
本次运行的环境与任务要求如下：

【工作目录】<workspace>
【main file】<main_file>：请阅读该文件内容，并依据下方入参与出参要求处理其内容。

【入参（K:V 格式，每行一组）】
<key1>: <value1>
<key2>: <value2>
...

【出参定义（请将结果填入对应字段）】
<name1>: <description1>
<name2>: <description2>
...

【输出要求】
处理完成后，请将上述出参字段的值组装成一个 JSON 对象（字段名=出参名，值=结果），
将该 JSON 保存到文件：<outputs_file>，并把该 JSON 原样打印到标准输出。
```

拼接规则：**final prompt = 用户 `OP.content`（原始模板）+ `\n\n` + 上述 meta 指令**，写入 main_file（`.main-<runId>-<opId>.prompt`）后传给 run.prompt。

组装后的 final prompt 示例（含原始输入与 meta 指令）：

```text
你是资深翻译助手。请将以下中文翻译成英文，并给出译文。

本次运行的环境与任务要求如下：

【工作目录】/workspace
【main file】/workspace/.main-<runId>-<opId>.prompt：请阅读该文件内容，并依据下方入参与出参要求处理其内容。

【入参（K:V 格式，每行一组）】
source_text: 你好，世界

【出参定义（请将结果填入对应字段）】
translation: 翻译后的英文文本

【输出要求】
处理完成后，请将上述出参字段的值组装成一个 JSON 对象（字段名=出参名，值=结果），
将该 JSON 保存到文件：/workspace/.ai_auto_result-<runId>/outputs.json，并把该 JSON 原样打印到标准输出。
```

`run.prompt.bash`（Linux）示例：

```bash
#!/bin/bash
# run.prompt.bash (Linux) — prompt 包装 (Executor 自带)
# 固定入参: workspace main_file stdout_file stderr_file rc_file
# 职责: 主进程按协议把 INPUT_ARGS / OUTPUT_NAMES 写入本脚本 stdin, 本脚本不读取不使用(协议不变, 脚本内忽略);
#       入参/出参信息已由主线程组装进 final prompt 的 meta 指令;
#       main_file 已由 Executor 主线程组装为 final prompt(用户模板+meta指令, 含出参描述),
#       按 inputMode 交付 CLI → 把 CLI 的 stdout/stderr 重定向到 stdout_file/stderr_file → 写 rc_file。
#       ★ 脚本只负责执行命令, 不做任何出参解析(免去 shell 解析 JSON / jq 依赖);
#         出参由 Executor 主函数在脚本退出后统一解析 (读 stdout_file/rc_file 及 outputs_file)
workspace="$1"; main_file="$2"; stdout_file="$3"; stderr_file="$4"; rc_file="$5"
cd "$workspace" || { echo 2 > "$rc_file"; exit 2; }

# 注意: 主进程仍按协议把 INPUT_ARGS / OUTPUT_NAMES 写入本脚本 stdin, 但本脚本不读取、
# 不使用这些值 (argsTemplate 只认 {{prompt}}, 出参由主函数解析) — 协议不变, 脚本内忽略即可。

# 交付 prompt 并运行 agent CLI (argsTemplate 占位符按 inputMode 区分: arg={{prompt}} / file={{prompt-file}} / stdin=无)
case "$W_AI_AUTO_OP_INPUT_MODE" in
  stdin)
    # prompt 直接以 main_file 文件重定向喂给 CLI; stdin 模式下 prompt 不进命令行,
    # argsTemplate 只含固定参数 (stdin 无占位符, 保留原样便于诊断配置错误)
    args="${W_AI_AUTO_OP_ARGS_TEMPLATE}"
    $W_AI_AUTO_OP_COMMAND $args <"$main_file" >"$stdout_file" 2>"$stderr_file"
    ;;
  file)
    # {{prompt-file}} → main_file 路径 (把 main file 作为 prompt 传给 CLI); 模板无占位符则附加路径
    args="${W_AI_AUTO_OP_ARGS_TEMPLATE}"
    if [[ "$args" == *"{{prompt-file}}"* ]]; then
      args="${args//\{\{prompt-file\}\}/$main_file}"
    else
      args="$args $main_file"
    fi
    $W_AI_AUTO_OP_COMMAND $args >"$stdout_file" 2>"$stderr_file"
    ;;
  *)
    # final prompt = main_file (主线程已组装好, 含入参 K:V 与出参描述)
    prompt="$(cat "$main_file")"
    # arg: {{prompt}} → final prompt 文本作为命令行参数 (替换后直接用, 不再附加)
    args="${W_AI_AUTO_OP_ARGS_TEMPLATE//\{\{prompt\}\}/$prompt}"
    $W_AI_AUTO_OP_COMMAND $args >"$stdout_file" 2>"$stderr_file"
    ;;
esac
rc=$?                        # CLI 退出码: 写 rc_file, 供主进程读取 (用户/CLI 执行结果)
echo "$rc" > "$rc_file"

# run.xxx 自身退出码仅表示流程是否正常跑完 — 正常跑完即 0; CLI 成败由主进程读 rc_file 判定。
# 出参解析不在脚本内进行, 由 Executor 主函数读 stdout_file/stderr_file/rc_file 及 outputs_file 统一完成
exit 0
```

`run.prompt.ps1`（Windows，职责同 bash 变体）：

```powershell
# run.prompt.ps1 (Windows) — prompt 包装 (Executor 自带)
# 固定入参: workspace main_file stdout_file stderr_file rc_file
# 职责: 主进程按协议把 INPUT_ARGS / OUTPUT_NAMES 写入本脚本 stdin, 本脚本不读取不使用(协议不变, 脚本内忽略);
#       入参/出参信息已由主线程组装进 final prompt 的 meta 指令;
#       main_file 已由 Executor 主线程组装为 final prompt(用户模板+meta指令, 含出参描述),
#       按 inputMode 交付 CLI → 把 CLI 的 stdout/stderr 重定向到 stdout_file/stderr_file → 写 rc_file。
#       ★ 脚本只负责执行命令, 不做任何出参解析(免去 shell 解析 JSON 负担);
#         出参由 Executor 主函数在脚本退出后统一解析 (读 stdout_file/rc_file 及 outputs_file)
$workspace, $main_file, $stdout_file, $stderr_file, $rc_file = $args
Set-Location $workspace

# 注意: 主进程仍按协议把 INPUT_ARGS / OUTPUT_NAMES 写入本脚本 stdin, 但本脚本不读取、
# 不使用这些值 (argsTemplate 只认 {{prompt}}, 出参由主函数解析) — 协议不变, 脚本内忽略即可。

# 交付 prompt 并运行 agent CLI (argsTemplate 占位符按 inputMode 区分: arg={{prompt}} / file={{prompt-file}} / stdin=无)
$cmd = $env:W_AI_AUTO_OP_COMMAND
$tpl = $env:W_AI_AUTO_OP_ARGS_TEMPLATE
switch ($env:W_AI_AUTO_OP_INPUT_MODE) {
  "stdin" {
    # prompt 直接以 main_file 文件喂给 CLI (PS 无 < 输入重定向, 用 Get-Content 读整个文件再管道);
    # stdin 模式下 prompt 不进命令行, argsTemplate 只含固定参数 (stdin 无占位符, 保留原样便于诊断)
    $cmdArgs = $tpl
    $cmdTokens = @($cmdArgs -split "\s+" | Where-Object { $_ })
    Get-Content -Raw $main_file | & $cmd @cmdTokens 1> $stdout_file 2> $stderr_file
  }
  "file" {
    # {{prompt-file}} → main_file 路径 (把 main file 作为 prompt 传给 CLI); 模板无占位符则附加路径
    if ($tpl.Contains("{{prompt-file}}")) { $cmdArgs = $tpl.Replace("{{prompt-file}}", $main_file) } else { $cmdArgs = "$tpl $main_file" }
    $cmdTokens = @($cmdArgs -split "\s+" | Where-Object { $_ })
    & $cmd @cmdTokens 1> $stdout_file 2> $stderr_file
  }
  default {
    # final prompt = main_file (主线程已组装好, 含入参 K:V 与出参描述)
    $prompt = [IO.File]::ReadAllText($main_file, [Text.UTF8Encoding]::new($false))
    # arg: {{prompt}} → final prompt 文本作为命令行参数 (替换后直接用, 不再附加)
    $cmdArgs = $tpl.Replace("{{prompt}}", $prompt)
    $cmdTokens = @($cmdArgs -split "\s+" | Where-Object { $_ })
    & $cmd @cmdTokens 1> $stdout_file 2> $stderr_file
  }
}
$rc = $LASTEXITCODE                       # CLI 退出码: 写 rc_file, 供主进程读取 (用户/CLI 执行结果)
[IO.File]::WriteAllText($rc_file, "$rc", [Text.UTF8Encoding]::new($false))

# run.xxx 自身退出码仅表示流程是否正常跑完 — 正常跑完即 0; CLI 成败由主进程读 rc_file 判定。
# 出参解析不在脚本内进行, 由 Executor 主函数读 stdout_file/stderr_file/rc_file 及 outputs_file 统一完成
exit 0
```

### 5.6 导出与导入的执行上下文

`run.xxx` 为 Executor 运行时自带模板，**不属于导出内容**。导出的是可重建执行所需的**定义**：

- OP 定义：`content`、`timeoutMs`、`version`。
- 入参定义：`inputs`（name/type/required/default/description）。
- 出参定义：`outputs`（name/type/description）。
- Client 关联：目标 `type`（prompt/bash/python/powershell）及所需配置（`command`/`binaryPath`、`argsTemplate`、`inputMode`、`outputMode`、`outputJsonPath`、`exitCodeSuccess`）。
- 关联 Client 的 ID 引用需在导入时校验或映射，避免执行时出现悬挂 Client。

> 导入端据此即可重建 `.main-<runId>-<opId>.xxx` 与五个运行参数，无需补填即可执行；这也是 `OP/Workflow/Job` export/import 接口（3.2.7–3.2.8、3.3.8–3.3.9、3.4.9–3.4.10）的设计依据。
