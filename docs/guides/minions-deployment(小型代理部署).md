# 小型代理工作器部署指南

跨崩溃、重新启动和 Postgres 连接故障保持 `gbrain jobs work` 运行。为代理编写逐行执行。

## 问题

持久工作器可能静默地从以下方面终止：

- 数据库连接丢弃（Supabase/Postgres 维护或网络故障）。
- 锁续期失败 → 停顿检测器最终将作业列为死信。
- Bun 进程崩溃，没有自动重启。
- 内部事件循环死亡（PID 存活，工作器循环停止）。

当工作器死掉时，提交的作业永远坐在 `waiting` 中。规范答案是 `gbrain jobs supervisor` — 一个一等 CLI，它生成 `gbrain jobs work` 作为子进程，并在崩溃时自动重启它。

## 工作器监督

### 规范模式

`gbrain jobs supervisor` 是 `gbrain jobs work` 的自动重启包装器。它写入一个 PID 文件，在崩溃时以指数退避（1 秒 → 60 秒上限）重启工作器，向审计文件发出生命周期事件，并在 SIGTERM 上优雅排空（在 SIGKILL 之前有 35 秒的工作器排空窗口）。退出代码被记录，以便代理可以对它们进行分支。

**典型命令：**

```bash
# 在前台启动（阻塞；Ctrl-C 停止）。
gbrain jobs supervisor --concurrency 4

# 分离启动 — 在 stdout 上返回 {"event":"started","supervisor_pid":…}。
gbrain jobs supervisor start --detach --json

# 无需读取日志文件即可检查活跃度。
gbrain jobs supervisor status --json

# 优雅停止（SIGTERM + 排空等待 + SIGKILL 回退）。
gbrain jobs supervisor stop
```

**退出代码：**

| 代码 | 含义 |
|---|---|
| 0 | 干净关闭（收到 SIGTERM/SIGINT，工作器已排空） |
| 1 | 超过最大崩溃次数（工作器不断死掉） |
| 2 | 另一个监督器持有 PID 锁 |
| 3 | PID 文件不可写（权限 / 路径错误） |

看到退出 = 2 的代理可以安全地将其视为"已经有一个在运行"；退出 = 1 应该分页管理员。

### 何时使用哪个监督器？

监督器解决了进程内崩溃恢复。平台级监督（systemd、Fly、Render）处理主机级故障。你通常想要两者。

| 环境 | 推荐 |
|---|---|
| **容器（Fly / Railway / Render / Heroku）** | `gbrain jobs supervisor` 作为 PID 1 运行。平台在 OOM / 主机丢失时重启容器；监督器在崩溃时重启工作器。请参阅 [Fly.io](#flyio) / [Render / Railway / Heroku](#render--railway--heroku)。 |
| **带有 systemd 的 Linux VM** | 推荐两层：systemd 监督 `gbrain jobs supervisor`，而后者又监督 `gbrain jobs work`。为你提供重新启动时自动重启（systemd）加上快速崩溃恢复（监督器）。请参阅 [systemd](#systemd)。 |
| **开发笔记本电脑 / macOS** | 终端中的 `gbrain jobs supervisor`。Ctrl-C 停止它。不需要系统级设置。 |

### 本指南中使用的变量

在复制粘贴任何代码片段之前，请替换这些变量一次。

| 变量 | 含义 | 典型值 |
|---|---|---|
| `$GBRAIN_BIN` | `gbrain` 二进制的绝对路径 | `$(command -v gbrain)` — 通常是 `/usr/local/bin/gbrain` 或 `~/.bun/bin/gbrain` |
| `$GBRAIN_WORKER_USER` | 拥有工作器进程的 OS 用户 | 运行 `gbrain init` 的同一用户；永远不要 `root` |
| `$GBRAIN_WORKSPACE` | 此部署提交的 shell 作业的 `cwd` | 绝对路径，例如 `/srv/my-brain` |
| `$GBRAIN_ENV_FILE` | systemd / shell 获取的密钥文件 | `/etc/gbrain.env`（模式 600） |

### 先决条件

在任何部署步骤之前运行这些。

```bash
# 1. gbrain 在 PATH 上，并解析为绝对位置。
command -v gbrain || { echo "gbrain 不在 PATH 上。安装，然后重试。"; exit 1; }

# 2. DATABASE_URL 指向可访问的 Postgres。
#    （监督器是仅 Postgres 的。PGLite 的独占文件锁会阻塞
#    单独的工作器进程。如果 `config.engine === 'pglite'` CLI 会拒绝
#    并显示明确的错误。）
gbrain doctor --fast --json | jq '.checks[] | select(.name=="db_connectivity")'

# 3. 模式是最新的。如果 version=0 或 status=="fail"：
#    gbrain apply-migrations --yes
gbrain doctor --fast --json | jq '.checks[] | select(.name=="schema_version")'

# 4. 如果你计划提交 `shell` 作业，请传递 --allow-shell-jobs 到
#    监督器（或在启动之前导出 GBRAIN_ALLOW_SHELL_JOBS=1）。
#    没有该标志，shell 处理程序在工作器启动时被禁用。
```

## 代理使用（OpenClaw / Hermes / Cursor / Codex）

代理可以驱动的三命令模式，无需 shell 考古学：

```bash
# 启动（在 stdout 上返回 PID + pid_file 作为 JSON，然后分离）
gbrain jobs supervisor start --detach --json
# → {"event":"started","supervisor_pid":1234,"worker_pid":1235,"pid_file":"/Users/you/.gbrain/supervisor.pid"}

# 检查健康（机器可解析的 JSON，没有日志抓取）
gbrain jobs supervisor status --json
# → {"running":true,"supervisor_pid":1234,"last_start":"2026-04-23T15:30:22Z","crashes_24h":0, ...}

# 停止干净（SIGTERM + 35 秒排空 + SIGKILL 回退）
gbrain jobs supervisor stop
```

每个生命周期事件（生成、崩溃、退避、健康警告、最大崩溃、关闭）也被写入 `${GBRAIN_AUDIT_DIR:-~/.gbrain/audit}/supervisor-YYYY-Www.jsonl` 以供历史检查。`gbrain doctor` 读取该文件并在其健康报告中显示 `supervisor` 检查。

## 部署：systemd

用于具有 shell 访问权限的长运行 Linux VM。

```bash
# 如果不存在，创建工作器用户。
sudo useradd --system --home "$GBRAIN_WORKSPACE" --shell /usr/sbin/nologin gbrain \
  2>/dev/null || true
sudo mkdir -p "$GBRAIN_WORKSPACE" && sudo chown gbrain:gbrain "$GBRAIN_WORKSPACE"

# 安装 env 文件（密钥不在单元文件中）。
sudo install -m 600 -o gbrain -g gbrain \
  docs/guides/minions-deployment-snippets/gbrain.env.example /etc/gbrain.env
sudo edit /etc/gbrain.env
# 填写 DATABASE_URL，可选 GBRAIN_ALLOW_SHELL_JOBS=1。

# 安装单元文件，将 /srv/gbrain → 你的工作区路径替换。
sudo install -m 644 docs/guides/minions-deployment-snippets/systemd.service \
  /etc/systemd/system/gbrain-worker.service
sudo sed -i "s|/srv/gbrain|$GBRAIN_WORKSPACE|g" \
  /etc/systemd/system/gbrain-worker.service

sudo systemctl daemon-reload
sudo systemctl enable --now gbrain-worker
sudo systemctl status gbrain-worker
journalctl -u gbrain-worker -n 50
```

随附的单元文件调用 `gbrain jobs supervisor`（不是直接 `gbrain jobs work`），因此你获得两层监督：systemd 在主机重新启动时重启监督器，监督器在进程内崩溃时重启工作器。

`Restart=always` + `RestartSec=10s` 处理监督器级恢复。
单元以无特权的 `gbrain` 运行，带有 `PrivateTmp`、`ProtectSystem=strict` 和 `ReadWritePaths=$GBRAIN_WORKSPACE,$HOME/.gbrain`（用于 PID 文件和审计日志）。`LimitNOFILE=65535` 覆盖 Bun + Postgres 池 + 并发 LLM 子代理调用，而不会达到默认 1024 上限。

## 部署：Fly.io

```bash
# 将 [processes] 块从 fly.toml.partial 合并到你的 fly.toml。
cat docs/guides/minions-deployment-snippets/fly.toml.partial >> fly.toml
# 审查 + 根据需要编辑。

# 设置密钥（Fly 在崩溃时处理重启）。
fly secrets set DATABASE_URL='postgres://…' GBRAIN_ALLOW_SHELL_JOBS=1
```

`[processes]` 块将 `gbrain jobs supervisor` 作为 PID 1 运行。Fly 在主机故障时重启容器；监督器在进程内崩溃时重启工作器。

## 部署：Render / Railway / Heroku

将 [`Procfile`](./minions-deployment-snippets/Procfile) 放在仓库根目录。
随附的 Procfile 调用 `gbrain jobs supervisor`。通过平台的 env UI 或 CLI 设置 `DATABASE_URL` + 可选 `GBRAIN_ALLOW_SHELL_JOBS=1`。

## 部署：内联 `--follow`（没有持久工作器）

用于固定计划上的短期确定性脚本，你在两次运行之间不需要持久工作器。每个 cron 运行都带来自己的临时工作器。`--follow` 在队列上启动一个，并阻塞直到刚提交的作业到达终端状态（`completed` / `failed` / `dead` / `cancelled`）。每个作业 2-3 秒的启动开销；与计划工作的作业持续时间相比可以忽略不计。

```bash
GBRAIN_ALLOW_SHELL_JOBS=1 gbrain jobs submit shell \
  --queue nightly-enrich \
  --params "{\"cmd\":\"$GBRAIN_BIN embed --stale\",\"cwd\":\"$GBRAIN_WORKSPACE\"}" \
  --follow \
  --timeout-ms 600000
```

将 `gbrain embed --stale` 替换为你要调度的任何 gbrain 子命令（`sync`、`extract`、`orphans`、`doctor`、`check-backlinks`、`lint`、`autopilot`）。对于共享队列上的严格单作业语义，请使用上面的专用队列名称，如 `nightly-enrich`。

## 从旧部署升级

### 从 `minion-watchdog.sh`（v0.20 之前）升级

此指南的早期版本附带了一个 68 行的 bash watchogram（`minion-watchdog.sh`）。它已被 `gbrain jobs supervisor` 取代，后者处理脚本所做的一切，加上原子 PID 锁定、结构化审计事件、队列范围的健康检查和 SIGTERM 上的优雅排空。

**迁移：**

```bash
# 1. 停止并删除旧的 watchopotam。
sudo kill $(head -n1 /tmp/gbrain-worker.pid) 2>/dev/null
sudo rm -f /usr/local/bin/minion-watchdog.sh /tmp/gbrain-worker.pid \
          /tmp/gbrain-worker.log
crontab -e   # 删除 "*/5 * * * * /usr/local/bin/minion-watchdog.sh" 行

# 2. 启动监督器（systemd 用户：从
#    docs/guides/minions-deployment-snippets/systemd.service 重新安装单元，
#    它现在调用 `gbrain jobs supervisor`）。
gbrain jobs supervisor start --detach --json
# 或：sudo systemctl restart gbrain-worker

# 3. 验证。
gbrain jobs supervisor status --json
gbrain doctor   # 'supervisor' 检查应该报告 running=true
```

### 模式 / 迁移卫生

无论从哪个部署路径升级：

1. **在升级之前停止工作器。** `gbrain jobs supervisor stop`（或 `sudo systemctl stop gbrain-worker`）。跳过此步骤会使飞行中的作业面临部分模式的风险。
2. **运行 `gbrain upgrade`。** 然后如果 `gbrain doctor` 将任何迁移报告为 `partial` 或 `pending`，则运行 `gbrain apply-migrations --yes`。
3. **如果你运行 shell 作业：** 从 v0.14 开始，将 `--allow-shell-jobs` 传递给监督器（或通过 `/etc/gbrain.env` 保留 `GBRAIN_ALLOW_SHELL_JOBS=1`）。提交者不需要该标志；只有工作器需要。
4. **验证。** `gbrain doctor` 应该报告零个 `pending` 或 `partial` 迁移以及健康的 `supervisor` 检查。`gbrain jobs stats` 应该显示在升级前和升级后之间没有 unexplained 的增长在 `dead` 中。

## 已知问题

### Supabase 连接丢弃

工作器使用单个 Postgres 连接。如果 Supabase 丢弃它（维护、连接限制、网络故障），锁续期会静默失败。然后停顿检测器在 `max_stalled` 未命中后将作业列为死信。

**使这更糟的当前默认值：**

- `lockDuration: 30000`（30 秒）— 对于连接故障期间的长时间作业来说太短了。
- `max_stalled: 5`（模式列默认值 — 请参阅 `src/schema.sql` 和 `src/core/pglite-schema.ts`）。在死信之前有 5 次错过的跳跃。
- `stalledInterval: 30000`（30 秒）— 检查过于激进。

**今天按作业调整。** `gbrain jobs submit` 接受 `--max-stalled N`、`--backoff-type fixed|exponential`、`--backoff-delay <ms>`、`--backoff-jitter 0..1` 和 `--timeout-ms N` 作为一等标志（自 v0.13.1 起）。这些在提交时写入作业行 — 这是 `handleStalled()` 读取的内容 — 因此按作业调整是今天真正的东西。

### 不要将 `maxStalledCount` 传递给 `MinionWorker`

这是无操作的。停顿检测器读取行的 `max_stalled` 列（在提交时设置），而不是 `src/core/minions/worker.ts:74` 中的工作器 opt。请改用 `gbrain jobs submit --max-stalled N` 按作业设置。

### 僵尸 shell 子进程

当 Bun 工作器硬崩溃时，来自 shell 作业的子进程可能变成僵尸。监督器的 SIGTERM → 35 秒排空 → SIGKILL 窗口涵盖了 shell 处理程序的 5 秒子进程终止宽限期（`KILL_GRACE_MS`）。对于长时间运行的 shell 作业，更喜欢通过提交时的 `--timeout-ms` 进行超时，而不是依赖硬终止。

## 冒烟测试

```bash
# 监督器存活？
gbrain jobs supervisor status --json | jq .running

# 聚合队列健康。
gbrain jobs stats

# 当前停顿的作业（仍然 `active` 且 lock_until 已过期，预重新排队）。
gbrain jobs list --status active --limit 10

# 死信作业。
gbrain jobs list --status dead --limit 10

# Shell 处理程序已注册？（检查监督器审计日志或工作器 stderr。）
gbrain jobs supervisor status --json | jq '.worker_config.allow_shell_jobs'
```

## 卸载

**`gbrain jobs supervisor`**（前台或 `--detach`）：

```bash
gbrain jobs supervisor stop
```

**systemd：**

```bash
sudo systemctl disable --now gbrain-worker
sudo rm /etc/systemd/system/gbrain-worker.service /etc/gbrain.env
sudo systemctl daemon-reload
```

**Fly / Render / Railway：** 从 `fly.toml` / `Procfile` 中删除 `worker` 进程并重新部署。通过 `fly secrets` 设置的密钥会持久保存，直到 `fly secrets unset`。

**内联 `--follow`：** 删除 cron 条目。没有其他东西需要清理 — 临时工作器与其作业一起退出。
