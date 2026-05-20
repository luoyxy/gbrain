# 小型代理 Shell 作业 — 将确定性 cron 移出网关#

## 30 秒#

```bash
# 运行你的第一个 shell 作业：
GBRAIN_ALLOW_SHELL_JOBS=1 gbrain jobs submit shell \
  --params '{"cmd":"echo hello","cwd":"/tmp"}' --follow
# → exit_code: 0, stdout_tail: "hello\n", duration_ms: 43
```

就是这样。你的 cron 脚本现在有了容身之处，具有重试、退避、DLQ 和 `gbrain jobs list` 可见性，而无需每个都启动一个完整的 LLM 会话。

**PGLite 用户：** `gbrain jobs work` 不会在 PGLite 上运行（独占文件锁）。每个 crontab 调用必须使用 `--follow` 进行内联执行。

Postgres 用户可以运行持久 worker；请参阅下面的配方。

---

## 为什么它存在#

如果你的代理从 cron 运行确定性脚本（令牌刷新、API 获取、抓取 + 写入），每个都会付出完整 LLM 会话在网关上的代价。十四个同时触发在 A 轮部署上将 CPU 固定在 100% 并阻塞实时消息。这些脚本都不需要推理。它们需要 shell。

Shell 作业将它们移动到 Minions worker：每个确定性脚本执行一个 cron，零 LLM 令牌，统一的可见性和重试。

---

## 安全模型（阅读此文）#

Shell 执行是一个很大的影响范围。我们发布了两个独立的门，都必须通过：

1. **MCP 边界。** 使用 `submit_job` 和 `name: 'shell'` 在 `ctx.remote === true`（MCP 调用者）时被拒绝。独立于 env 标志。远程代理永远不能提交 shell 作业。`MinionQueue.add('shell', ...)` 也有自己的守卫，因此进程内处理程序不能编程绕过此门。

2. **Env 标志。** Worker 仅在 `GBRAIN_ALLOW_SHELL_JOBS=1` 设置在 worker 进程上时注册 shell 处理程序。默认：关闭。你的代理在每个主机上选择加入。

**Env allowlist 做什么 AND 不做什么。** Shell 作业以最小 env 运行：`PATH, HOME, USER, LANG, TZ, NODE_ENV`。你的密钥如 `OPENAI_API_KEY` 和 `DATABASE_URL` 不会传递到子进程。你通过 `env: { ... }` 选择加入其他密钥（仅非秘密值；请参阅下面的"秘密"）。`inherit: ["database_url"]` 是传递秘密的首选方式 — 行中的名称；在子生成时从 `gbrain config set` 解析值。这阻止了在用户创作的脚本中进行意外的 `$OPENAI_API_KEY` 插值。它**不**沙箱文件系统读取：shell 脚本可以 `cat ~/.env` 或 worker 进程可以读取的任何文件。操作员选择安全的 `cwd`。这就是信任边界。

**审计跟踪，不是取证保险。** 每次提交都会将 JSONL 行写入 `~/.gbrain/audit/shell-jobs-YYYY-Www.jsonl`（ISO 周轮换；通过 `GBRAIN_AUDIT_DIR` 覆盖）。失败记录在 stderr 中，不会阻塞提交，因此磁盘已满的对手可以静默禁用跟踪。适用于"上周二这个 cron 提交了什么"，而不是用于安全关键的取证。

**命令文本按原样记录。** 如果你在 `cmd` 中嵌入秘密（`curl -H 'Authorization: Bearer ...'`），它会显示在审计文件中。将秘密放在 `env:` 中代替。

---

## 迁移 Cron#

### Postgres Worker（推荐）#

在一个终端上，启动持久 worker：

```bash
GBRAIN_ALLOW_SHELL_JOBS=1 gbrain jobs work
```

重写 crontab 以提交 shell 作业（无 `--follow`）：

```cron
# 之前（LLM 网关）：
#   OpenClaw cron：x-garrytan-unified

# 之后（小型代理 worker）：
3 13,16,19,22,1,4,7,10 * * * \
  gbrain jobs submit shell \
    --params '{"cmd":"node scripts/x-garrytan-daily.mjs","cwd":"/data/.openclaw/workspace"}' \
    --max-attempts 3 --timeout-ms 300000
```

Worker 在下次轮询时认领作业，运行它，记录 `exit_code` + `stdout_tail` + `stderr_tail` 在结果中。失败根据 `--max-attempts` 和指数退避重试。

### PGLite（内联执行）#

PGLite 不支持持久 worker 守护进程。每个 crontab 调用使用 `--follow` 运行内联：

```cron
# 每个 cron 刻度生成一个短期 worker，它内联运行作业。
3 13,16,19,22,1,4,7,10 * * * \
  GBRAIN_ALLOW_SHELL_JOBS=1 gbrain jobs submit shell \
    --params '{"cmd":"node scripts/x-garrytan-daily.mjs","cwd":"/data/.openclaw/workspace"}' \
    --follow \
    --timeout-ms 300000
```

注意：`--follow` 阻塞 crontab 插槽直到作业完成。如果 14 个 shell cron 同时触发并且每个需要 30 秒，它们通过 crontab 的生成限制进行序列化。Postgres + 持久 worker 更好地扩展。

### 从 Shell 作业调用 `gbrain` 本身 — 对秘密使用 `inherit:` {#secrets}#

一个常见模式是提交运行 `gbrain` CLI 命令的 shell 作业：

```bash
gbrain jobs submit shell --params '{
  "cmd": "gbrain sync --skip-failed && gbrain embed --stale",
  "cwd": "/data/gbrain",
  "inherit": ["database_url"]
}'
```

`inherit: ["database_url"]` 告诉 worker 从其 `loadConfig()` 中查找 `database_url` 并将值作为 `GBRAIN_DATABASE_URL` 注入到子进程环境中。`minion_jobs.data` 中的数据库行仅携带名称 — `inherit: ["database_url"]` — 永远不携带值。请参阅 [minions-shell-jobs.md#secrets](./minions-shell-jobs.md#secrets) 以获取完整的验证规则和错误目录。

**为什么这比在每个作业中写入秘密更可取：**

- 在 v0.36.5.0 之前，调用者通过 `env: { GBRAIN_DATABASE_URL: "postgresql://..." }` 传递每个作业。URL 以明文形式出现在 `minion_jobs.data` 和 shell 审计 JSONL 中。任何具有 brain-DB 读取权限的人（或通过挂载的共享 brain，或 brain 转储）都可以看到该 URL。从 v0.36.5.0 开始，这在入队前验证中被拒绝。错误消息将 `inherit: ["database_url"]` 命名为替代方案。

### 使用 `argv` 提交（无 shell 插值）#

对于从 JSON 编程组装命令的调用者，请使用 `argv` 代替 `cmd`。无 shell，无注入表面：

```bash
gbrain jobs submit shell \
  --params '{"argv":["node","scripts/fetch.mjs","--date","2026-04-19"],"cwd":"/data"}' \
  --follow
```

---

## 调试失败的作业#

```bash
# 列出死信作业
gbrain jobs list --status dead

# 检查一个
gbrain jobs get 42
# → error_text, stacktrace, result.stdout_tail, result.stderr_tail

# 提交审计日志（操作员跟踪，不是取证）
cat ~/.gbrain/audit/shell-jobs-*.jsonl | jq '.'

# 首次失败模式：在没有 worker 上 env 标志提交
gbrain jobs list --status waiting --name shell
# 如果行在这里堆积，没有运行 GBRAIN_ALLOW_SHELL_JOBS=1 的 worker 正在运行。
```

---

## 限制#

- **文件系统读取不被沙箱化。** 请参阅上面的"安全模型"。不要将 `cwd` 指向充满秘密的目录。
- **审计日志是建议性的。** 磁盘已满或 EACCES 静默禁用它。
- **取消延迟是锁续期绑定的**（默认约 7-15 秒）。取消的作业在下次锁续期失败之前保持运行。
- **`--follow` 认领顺序** 是按 priority/created_at 的。如果在 `--follow` 时队列中有另一个作业在等待，则该作业首先运行。
- **`cwd` 符号链接 TOCTOU。** 绝对路径检查不会防护在执行时指向其他位置的符号链接。操作员范围的关注点。

---

## 错误 {#errors}#

| 错误 | 含义 | 修复 |
|---|---|---|
| `shell: specify exactly one of cmd or argv` | `cmd` 和 `argv` 是互斥的。两者都不在也是无效的。 | 选择一个。`cmd` 用于 shell 插值字符串；`argv` 用于结构化参数。 |
| `shell: cwd is required and must be an absolute path` | `cwd` 必须是带有 `/` 开头的字符串。 | 在 `--params` 中将 `cwd` 设置为绝对路径。 |
| `shell: argv must be an array of strings` | `argv` 具有非字符串条目或不是数组。 | 传递 `argv: ["bin","arg1","arg2"]`。 |
| `shell: env values must all be strings` | `env` 具有数字/布尔/对象值。 | 字符串化：`"env":{"COUNT":"3"}` 而不是 `"env":{"COUNT":3}`。 |
| `shell: inherit must be an array of config-key names` | `inherit` 不是数组。 | 传递 `"inherit": ["database_url", ...]`。 |
| `shell: inherit entries must be non-empty strings` | `inherit` 的元素为空、非字符串或 null。 | 使用 snake_case 配置键名称如 `database_url`、`anthropic_api_key`。 |
| `shell: inherit name "<X>" must match [a-z][a-z0-9_]*` | 名称未能通过 snake_case 正则表达式（大写、前导数字/下划线、特殊字符）。 | 按原样使用配置键名称；`database_url`，而不是 `DATABASE_URL`。 |
| `shell: inherit requested "<X>" but worker has no <X> configured` | Worker 无法从 `loadConfig()` 解析请求的名称。 | 在 worker 主机上运行 `gbrain config set <X> <value>`，或通过 worker 进程上的 `GBRAIN_DATABASE_URL` / `DATABASE_URL` 环境变量。如果 worker 无法解析该键，验证器将在提交时拒绝该作业，并附上可粘贴的提示。 |
| `shell: redact-secrets must be a boolean if set` | 调用者为 `redact-secrets` 传递了非布尔值。 | 传递 `true` 或 `false`（或省略）。CLI `--redact-secrets` 标志自动设置它。 |
| `permission_denied: shell jobs cannot be submitted over MCP` | MCP 客户端尝试提交 shell 作业。按设计，仅 CLI。 | 从 CLI 提交或 via 受信任的操作处理程序（`ctx.remote === false`）。 |
| `protected job name 'shell' requires CLI or operation-local submitter` | 调用者在没有 `trusted` 选择加入的情况下调用了 `MinionQueue.add('shell', ...)`。 | 将 `{ allowProtectedSubmit: true }` 作为第 4 个参数传递。CLI 和 `submit_job` 会自动执行此操作。 |
| `aborted: timeout` / `aborted: cancel` / `aborted: shutdown` / `aborted: lock-lost` | Worker 的中止信号在中间执行时触发。子进程获得 SIGTERM，5 秒宽限期，然后 SIGKILL。 | 预期的：超时 / 用户取消 / 部署重启 / 停顿。通过 `gbrain jobs get` 检查以查看哪个。 |
| `exit N: <stderr_tail_500>` | 脚本以非零退出。 | 读取 `stderr_tail` 在 `gbrain jobs get`。 |

---

*是 [GBrain Skillpack](../GBRAIN_SKILLPACK.md) 的一部分。另请参阅：[小型代理部署](minions-deployment.md)、[队列操作运行手册](queue-operations-runbook.md)*
