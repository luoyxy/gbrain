# GBrain 部署拓扑结构

GBrain 支持三种部署形态。它们可以组合：单个用户可以混合使用全部三种形态，同一台机器上没有冲突，因为每个形态都解析为"当前活动的 `~/.gbrain/config.json` 是什么？"，并且 `GBRAIN_HOME` 控制该选择。

本页涵盖三种拓扑结构、每种形态适用的场景以及具体的设置配方。将本文档与 `docs/architecture/brains-and-sources.md`（涵盖大脑内部组织轴）配对使用 —— 该文档是关于哪个数据库；本文档是关于该数据库位于何处。

## 快速决策树

```
   "我正在设置 gbrain..."
        │
        ▼
  仅为我一个人，在一台机器上？ ── 是 ──▶ 拓扑 1（单大脑）
        │
        否
        │
        ▼
  远程机器会托管大脑
  而我的代理在本地运行？ ─── 是 ──▶ 拓扑 2（跨机器薄客户端）
        │
        否
        │
        ▼
  多个 Conductor worktree 那些
  不应该共享代码索引？ ── 是 ──▶ 拓扑 3（分离引擎）
```

拓扑 2 和 3 可以堆叠：薄客户端安装也可以托管每 worktree 代码引擎，并且每 worktree 代码引擎也可以将其产物大脑指向远程服务器。

## 拓扑 1 — 单大脑（今天的默认设置）

```
  ┌────────────────┐
  │   一台机器     │
  │  ┌──────────┐  │
  │  │  gbrain  │──┼──→  ~/.gbrain/  →  PGLite 或  Supabase
  │  │   CLI    │  │
  │  └──────────┘  │
  └────────────────┘
```

你得到什么：一个本地数据库（小型大脑用 PGLite，~1000+ 文件推荐用 Supabase）。所有命令直接针对它工作。`gbrain serve` 通过 MCP 向单个代理暴露它。

适用场景：单独使用，单台机器，一个代理，无 Conductor 并行性。
这是默认设置；`gbrain init`（无标志）给你这个。

设置：

```
gbrain init           # 交互式 — 默认为 PGLite
gbrain init --pglite  # 显式本地
gbrain init --supabase  # 远程 Supabase（推荐用于 1000+ 文件）
```

此处没有其他特殊之处。其他两种拓扑结构是关于"谁拥有数据库"和"代理如何与之通信"。

## 拓扑 2 — 跨机器薄客户端

```
  ┌────────────┐                    ┌──────────────────┐
  │ neuromancer│                    │    brain-host    │
  │ ┌────────┐ │ HTTP MCP / OAuth   │  ┌────────────┐  │
  │ │ Hermes │─┼───────────────────→│  │   gbrain   │──┼──→ Supabase
  │ │ agent  │ │                    │  │ serve --http│  │
  │ └────────┘ │                    │  └────────────┘  │
  │            │                    │   (with autopilot)│
  │  无本地    │                    │                  │
  │  gbrain DB │                    │                  │
  └────────────┘                    └──────────────────┘
```

你得到什么：一台机器（"neuromancer"）上的代理通过带 OAuth 的 HTTP MCP 使用托管在另一台机器（"brain-host"）上的大脑。代理的机器没有本地引擎。所有查询、搜索、嵌入和索引都在 host 上发生。

适用场景：

- 大型大脑（Supabase + autopilot）位于性能强劲的机器上；其他地方的代理只是使用它。
- 你需要跨多台机器的单一真相来源。
- 启动并行本地安装会造成来源 ID 争用或重复工作。

薄客户端的 `~/.gbrain/config.json` 携带 `remote_mcp` 字段而非本地数据库连接：

```jsonc
{
  "engine": "postgres",  // 被忽略 — 从不使用
  "remote_mcp": {
    "issuer_url": "https://brain-host.local:3001",
    "mcp_url":    "https://brain-host.local:3001/mcp",
    "oauth_client_id": "neuromancer-...",
    "oauth_client_secret": "..."  // 或设置 GBRAIN_REMOTE_CLIENT_SECRET
  }
}
```

CLI 调度守卫拒绝薄客户端安装上的任何数据库绑定命令（`sync`、`embed`、`extract`、`migrate`、`apply-migrations`、`repair-jsonb`、`orphans`、`integrity`、`serve`），并给出清晰的错误指向远程 host。`gbrain doctor` 运行专用的薄客户端检查集（OAuth 发现、token 往返、MCP 冒烟）。

### 设置

**第 1 步 — 在 host 上（brain-host）：**

```bash
gbrain init --supabase                         # 或 --pglite，没关系
gbrain serve --http --port 3001 --bind 0.0.0.0 # v0.34：显式绑定以进行远程访问
                                                #（自 v0.34 起默认为 127.0.0.1）
gbrain auth register-client neuromancer \
  --grant-types client_credentials \
  --scopes read,write,admin                    # admin 需要用于 ping/doctor
```

`register-client` 命令打印 `client_id` 和 `client_secret`。
注意两者。**范围必须包含 `admin`** —— `submit_job`（由 `gbrain remote ping` 使用）和 `run_doctor`（由 `gbrain remote doctor` 使用）都需要它。

**第 2 步 — 在薄客户端上（neuromancer）：**

```bash
gbrain init --mcp-only \
  --issuer-url https://brain-host.local:3001 \
  --mcp-url https://brain-host.local:3001/mcp \
  --oauth-client-id <id> \
  --oauth-client-secret <secret>
```

预飞行冒烟运行三个探测（OAuth 发现、token 往返、MCP 初始化）。如果任何失败，init 以可操作的错误退出。成功时，`~/.gbrain/config.json` 获得 `remote_mcp` 设置并且不创建本地数据库。

**第 3 步 — 配置你的代理的 MCP 客户端。**

对于 Claude Desktop / Hermes / openclaw，添加单个 MCP 服务器条目指向 host 的 `mcp_url`，并带有来自 `register-client` 的 bearer token。Claude Desktop 的 `~/.config/claude/claude_desktop_config.json` 示例：

```jsonc
{
  "mcpServers": {
    "gbrain": {
      "type": "url",
      "url": "https://brain-host.local:3001/mcp",
      "headers": { "Authorization": "Bearer <client_secret>" }
    }
  }
}
```

**第 4 步 — 验证。**

```bash
gbrain doctor             # 运行薄客户端检查（不需要本地数据库）
gbrain remote ping        # 触发 host 上的 autopilot 循环（层级 B）
gbrain remote doctor      # 要求 host 运行它自己的 doctor（层级 B）
```

`gbrain sync` 和朋友将拒绝并给出清晰的薄客户端错误命名 `mcp_url`。这是正确的行为 —— 这些命令需要不存在于此处的本地引擎。

### 重新运行守卫

在已经设置了薄客户端配置的机器上运行 `gbrain init`（无标志）会拒绝，除非使用 `--force`。这捕获了脚本化设置循环的摩擦，其中编排器不断尝试创建本地数据库。使用 `gbrain init --mcp-only --force` 刷新薄客户端配置。

### 存储 OAuth 密钥

三个存储路径按优先级顺序：

1. **`GBRAIN_REMOTE_CLIENT_SECRET` 环境变量**（用于无头代理的首选）。
   设置时，覆盖配置文件中的任何内容。当环境变量是来源时，init 流程不会持久化配置文件的副本。
2. **带有 0600 权限的 `~/.gbrain/config.json`**（用于交互式设置的默认设置；反映今天 Supabase 密钥的存储方式）。
3. **macOS Keychain 集成** 在路线图上；不在 v1 中。

## 拓扑 3 — 分离引擎，每 worktree 代码 + 远程产物

```
  ┌──────────────────────────────────────────────────────┐
  │                  一台机器                         │
  │                                                      │
  │  ┌─ worktree A ──────────────┐                       │
  │  │  GBRAIN_HOME=A/.conductor │                       │
  │  │  gbrain serve --port 3001 │── PGLite (code A)     │
  │  └───────────────────────────┘                       │
  │                                                      │
  │  ┌─ worktree B ──────────────┐                       │
  │  │  GBRAIN_HOME=B/.conductor │                       │
  │  │  gbrain serve --port 3002 │── PGLite (code B)     │
  │  └───────────────────────────┘                       │
  │                                                      │
  │  ┌─ default ~/.gbrain ──────┐    HTTP MCP / OAuth   │
  │  │  gbrain serve --port 3000 │──────────────────────→ 远程产物
  │  └───────────────────────────┘                        (Supabase / brain-host)
  │                                                      │
  │  代理的 MCP 配置（Hermes / Claude Desktop）：       │
  │    mcp__gbrain_code__*       → http://localhost:3001 │
  │    mcp__gbrain_artifacts__*  → http://brain-host/mcp │
  └──────────────────────────────────────────────────────┘
```

你得到什么：每个 Conductor worktree 有自己的每 worktree 代码索引（本地 PGLite，当 worktree 死掉时可丢弃）。产物（计划、学习、转录）仍然存在于所有 worktree 可以看到并写入的共享大脑中。

适用场景：

- 一台机器上的多个 Conductor worktree，都触及同一个代码仓库。
- 你不希望每个 worktree 的代码导入破坏其他人的 `last_commit`、来源 ID 或符号表。
- 你确实希望产物（计划、学习、回顾、转录）在 worktree 之间可见。

### 它如何工作

`GBRAIN_HOME` 选择哪个 `~/.gbrain` 目录处于活动状态。按 worktree 设置：

```bash
export GBRAIN_HOME=/path/to/worktree-A/.conductor/gbrain
gbrain init --pglite
gbrain serve --http --port 3001
```

每个 worktree 的 `gbrain serve` 实例绑定自己的端口并为自己的数据库编制索引。多个 `gbrain serve` 进程很好地共存 —— 它们是带有单独配置和单独连接池的单独操作系统进程。

产物大脑作为单独的 `gbrain serve` 实例运行，带有默认的 `~/.gbrain`（无 GBRAIN_HOME 覆盖） —— 或远程，在这种情况下它是拓扑 2 设置。

代理的 MCP 客户端配置列出多个服务器，每个带有唯一别名。工具名称以 `mcp__<alias>__<tool>` 命名，因此代理调用 `mcp__gbrain_code__search` 进行代码查找，调用 `mcp__gbrain_artifacts__search` 进行产物查找。

### 关键：别名级路由是手动的

拓扑 3 在 gbrain 内部没有智能每工具路由。代理在选择别名时选择要查询的大脑。**错误的别名会静默写入（或查询）错误的大脑。** 这是故意的（显式胜过魔法）但是真实的：

- 如果代理用代码形状的内容调用 `mcp__gbrain_artifacts__put_page`，该页面会永远落在产物大脑中。
- 如果代理对实际上想要产物上下文的问题调用 `mcp__gbrain_code__search`，搜索会返回空。

缓解措施：

- 清晰地命名别名。`gbrain_code` vs `gbrain_artifacts` 是明确的；`gbrain` vs `gbrain_local` 不是。
- 在代理的系统提示或规则中记录哪个别名去哪里。明确说明"代码问题 → `gbrain_code`；其他一切 → `gbrain_artifacts`"。
- 将拓扑 3 与 `gstack` 的每 worktree 布线配对（设置别名名称 + 代理规则跨 worktree 一致）。

### 设置（手动；gstack 自动化此侧）

gbrain 侧需要零新代码 —— `GBRAIN_HOME` 和 `--port` 已经存在。设置看起来像：

```bash
# 在端口 3000 上启动产物大脑（默认 ~/.gbrain）
gbrain serve --http --port 3000 &

# 在端口 3001 上启动每 worktree 代码大脑
export GBRAIN_HOME=/path/to/worktree-A/.conductor/gbrain
gbrain init --pglite
gbrain serve --http --port 3001 &
unset GBRAIN_HOME
```

然后配置代理的 MCP 配置，包含两个条目（不同别名、不同端口）。对于 Claude Desktop：

```jsonc
{
  "mcpServers": {
    "gbrain_artifacts": {
      "type": "url",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer <token-A>" }
    },
    "gbrain_code": {
      "type": "url",
      "url": "http://localhost:3001/mcp",
      "headers": { "Authorization": "Bearer <token-B>" }
    }
  }
}
```

gstack 侧布线（每 worktree home 设置、端口分配、自动 MCP 配置生成、每 worktree 数据库的 gitignore）位于 gstack 仓库的 setup-gbrain 技能中 —— 它组合这些原语，gbrain 不必知道 Conductor。

## 组合拓扑结构

这三种形态可以组合。单台机器可以运行：

- 指向远程产物大脑的薄客户端默认配置（拓扑 2）。
- 加上它们自己的 `GBRAIN_HOME` 下的每 worktree 代码大脑（拓扑 3）。
- 每个 worktree 的 `gbrain serve` 实例是本地的；代理的 MCP 配置将它们与远程产物大脑一起列出。

`GBRAIN_HOME` 控制任何单个 CLI 调用的活动配置文件。`gbrain serve --port` 控制服务器监听的端口。代理的 MCP 客户端为每个工具调用选择别名并因此选择目的地。没有全局 gbrain 编排器同时知道它们所有 —— 这是设计使然。

## 何时不使用这些拓扑结构

- **如果你的代理只在同一台机器上运行如同大脑，不要使用拓扑 2。** 本地 `gbrain` 安装 + `gbrain serve`（stdio）更简单且更快。
- **如果你一次只有一个 Conductor worktree，不要使用拓扑 3。** 每 worktree 引擎存在是为了防止争用；一次一个使用没有争用。
- **不要在同一台机器上的同一 `GBRAIN_HOME` 中使用 `remote_mcp` 薄客户端和本地引擎。** 当设置 `remote_mcp` 时，调度守卫拒绝数据库绑定命令。如果你真的想在一台机器上同时使用两种模式，使用 `GBRAIN_HOME` 来分离它们（一个 home 用于薄客户端，另一个用于本地引擎）。

## 另请参阅

- `docs/architecture/brains-and-sources.md` — 大脑内部组织（大脑与来源轴）。
- `docs/mcp/CLAUDE_DESKTOP.md` 和兄弟 — 每客户端 MCP 设置。
- `gbrain init --help` 和 `gbrain auth --help` 以获取命令级详细信息。
