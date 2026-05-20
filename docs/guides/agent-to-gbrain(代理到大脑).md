# 下游代理应如何与 gbrain 通信

本指南适用于需要从自身运行时调用 gbrain 操作的下游代理（hermes、openclaw、未来的分支）的作者。首先阅读本文档将为您节省一个调试周期：gbrain 有**两个不同的接口**，选择哪一个取决于具体操作。

## 两个接口

```
                       ┌─────────────────────────────────────────────┐
                       │                gbrain 进程                   │
                       │                                              │
    Agent (hermes,      │  ┌──────────────────┐    ┌────────────────┐ │
   openclaw, 分支) ───┼──▶  MCP 操作接口    │    │   localOnly   │ │
                       │  │ (HTTP + OAuth)   │    │   管理操作    │ │
                       │  │                   │    │                │ │
                       │  │  search, query,  │    │  sync, embed, │ │
                       │  │  put_page,       │    │  dream,       │ │
                       │  │  get_page,       │    │  doctor,      │ │
                       │  │  find_experts,   │    │  autopilot,   │ │
                       │  │  ...              │    │  init,        │ │
                       │  │                   │    │  secrets       │ │
                       │  └──────────────────┘    └────────────────┘ │
                       │           ▲                       ▲          │
                       │           │                       │          │
                       │           │                       │          │
                       │     瘦客户端 OAuth         shell-job   │
                       │     (MCP 等效操作首选)    (localOnly    │
                       │                        操作唯一路径)   │
                       └─────────────────────────────────────────────┘
```

这两个接口**不可互换**。根据操作选择，而非个人偏好。

## 接口 1 — 基于 HTTP 的 MCP 操作（瘦客户端 + OAuth）

用于任何具有 MCP 等效项的操作：`search`、`query`、`put_page`、`get_page`、`find_experts`、`find_orphans`、`find_anomalies`、`get_recent_salience`、`find_trajectory` 等。规范列表是 `src/core/operations.ts` 中 `localOnly` 标志未设置（或为 `false`）的操作集合。

### 设置

主机将 gbrain 作为长期运行的 HTTP 服务器运行：

```bash
GBRAIN_ALLOW_SHELL_JOBS=1 gbrain serve --http --port 3131
```

代理注册为 OAuth 客户端（一次性）：

```bash
gbrain auth register-client hermes \
  --grant-types client_credentials \
  --scopes read,write
# 一次性打印 client_id + client_secret。请安全存储。
```

代理的运行时使用来自 `client_credentials` 授权的承载令牌调用 `/mcp`。密钥保留在 gbrain serve 进程中；代理永远不会看到 DATABASE_URL 或 API 密钥。

瘦客户端模式（`gbrain init --mcp-only`）为代理提供相同的客户端凭据连接，此外 `gbrain` CLI 本身通过配置的远程 MCP 路由符合 MCP 条件的命令。代理可以直接调用 `gbrain search` / `gbrain query`，CLI 会处理 OAuth 流程。

### 为何这是 MCP 操作的首选

- 密钥永远不会离开服务器进程。
- OAuth 范围为您提供 `read`、`write`、`admin` 分离 — 代理只获得它需要的权限。
- 源范围令牌（`register-client` 上的 `--source dept-x`）将代理限制在联邦大脑中的特定源。
- 一个审计层面（`mcp_request_log`）统一覆盖每个操作调用。

## 接口 2 — 通过 shell-job `inherit:` 的 localOnly 管理操作

某些操作在 `src/core/operations.ts` 中标记为 `localOnly: true`，并且在 `src/cli.ts:isThinClient` 的瘦客户端模式中被**拒绝**。完整列表（截至 v0.36.5.0）包括：

- `sync`（文件系统遍历需要本地 FS 访问）
- `embed`（协调嵌入管道）
- `extract`（遍历 markdown 文件）
- `dream`（合成周期）
- `doctor`（文件系统健康检查）
- `autopilot`（后台守护进程编排）
- `init`（创建 `~/.gbrain/`）
- `secrets`（配置管理）

对于这些操作，代理无法通过 HTTP MCP 路由。唯一的路径是将 `gbrain` 作为 CLI 子进程运行。推荐的模式是将子进程作为 shell job 提交给 gbrain Minions 工作器，这样重试/退避/死信队列/审计跟踪都会自动获得。

### 设置

```bash
gbrain jobs submit shell --params '{
  "cmd": "gbrain sync --skip-failed && gbrain embed --stale",
  "cwd": "/data/gbrain",
  "inherit": ["database_url"]
}'
```

`inherit: ["database_url"]` 字段告诉工作器从其 `loadConfig()` 中查找 `database_url` 并将值作为 `GBRAIN_DATABASE_URL` 注入到子进程环境中。`minion_jobs.data` 中的数据库行仅携带名称 — `inherit: ["database_url"]` — 永远不会携带值。有关完整的验证规则和错误目录，请参阅 [minions-shell-jobs.md#secrets](./minions-shell-jobs.md#secrets)。

### 为何这比在每个作业中写入密钥更可取

- 在 v0.36.5.0 之前，调用者对每个作业传递 `env: { GBRAIN_DATABASE_URL: "postgresql://..." }`。URL 以明文形式出现在 `minion_jobs.data` 和 shell 审计 JSONL 中。任何具有大脑数据库读取权限的人（或通过挂载的共享大脑、或大脑转储）都可以看到该 URL。从 v0.36.5.0 开始，这在入队前验证中被拒绝。错误消息将 `inherit: ["database_url"]` 命名为替代方案。

### 工作器设置（一次性，每个主机）

代理的主机需要一个处理 shell job 的工作器：

```bash
# 一次性内联执行（PGLite 或 Postgres）：
gbrain jobs submit shell --params '{...}' --follow

# 持久工作器（仅 Postgres — PGLite 使用 --follow 内联）：
GBRAIN_ALLOW_SHELL_JOBS=1 gbrain jobs work
```

`GBRAIN_ALLOW_SHELL_JOBS=1` 是工作器端的选择加入。没有它，shell job 将无限期地停留在 `waiting` 状态。请在工作器进程环境中（或在您的部署单元/launchd plist 中）设置它，而不是在每个提交中设置 — 提交者环境是工作器环境的弱代理。

## 决策表

| 操作 | 接口 | 原因 |
|---|---|---|
| `search` / `query` | 通过瘦客户端的 HTTP MCP | 具有 MCP 操作；OAuth 范围限定。 |
| `get_page` / `list_pages` | HTTP MCP | 同上。 |
| `put_page` | HTTP MCP | 同上；适用时尊重子代理允许列表。 |
| `find_experts` / `find_orphans` | HTTP MCP | 同上。 |
| `sync` / `embed` / `extract` | Shell job + `inherit:` | `localOnly: true`。 |
| `dream` | Shell job + `inherit:` | `localOnly: true`。 |
| `doctor` | Shell job + `inherit:`（或无继承，如果无数据库） | `localOnly: true`。 |
| `autopilot` | 直接在主机上作为守护进程运行 | 长期运行，不是作业形态。 |
| `init` / `secrets` | 一次性主机设置 | 操作员操作，不是代理操作。 |

## 推荐模式

- **对于不想出现在行中的密钥，首选 `inherit:`。** 名称出现在 `minion_jobs.data` 中；值在子进程生成时从工作器的配置中解析。如果大脑数据库穿越信任边界，密钥会保留在外面。
- **自由格式名称。** `inherit:` 接受工作器上的任何 snake_case 配置键 — `database_url`、`anthropic_api_key`、`openai_api_key`、`voyage_api_key`、`groq_api_key`、`zeroentropy_api_key`，或您填入 `~/.gbrain/config.json` 的任何自定义字段。代理选择它需要的内容。
- **`env:` 仍然有效**，用于非密钥值，或用于您希望值出现在行中的情况（例如，审计流程稍后需要读回的不透明关联令牌）。验证器不会质疑您。
- **永远不要尝试通过瘦客户端 MCP 路由 `localOnly` 操作。** 它将失败并显示 `localOnly op refused in thin-client mode`。使用 shell-job + `inherit:`（用于密钥）或 `env:`（用于非密钥）。

## 迁移：从 v0.36.5.0 之前版本

如果您的代理提交通过 `env:` 传递密钥的 shell job：

```jsonc
// v0.36.5.0 之前：可用但 URL 以明文形式持久化在 minion_jobs.data 中。
{
  "cmd": "gbrain sync --skip-failed",
  "cwd": "/data/gbrain",
  "env": { "GBRAIN_DATABASE_URL": "postgresql://..." }
}
```

切换到（推荐）：

```jsonc
// v0.36.5.0+：名称在行中，值在子进程生成时从工作器配置解析。
{
  "cmd": "gbrain sync --skip-failed",
  "cwd": "/data/gbrain",
  "inherit": ["database_url"]
}
```

确保工作器主机配置了 `database_url`（通过 `gbrain config set database_url <value>` 或通过工作器进程上的 `GBRAIN_DATABASE_URL` / `DATABASE_URL` 环境变量）。如果工作器无法解析该键，验证器将在提交时拒绝该作业，并附上可粘贴的提示。
