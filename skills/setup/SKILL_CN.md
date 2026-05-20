---
name: setup
description: 设置GBrain，自动配置Supabase或PGLite、AGENTS.md注入、首次导入
triggers:
  - "设置gbrain"
  - "初始化brain"
  - "gbrain setup"
tools:
  - get_stats
  - get_health
  - sync_brain
  - put_page
mutating: true
---

# 设置GBrain

从零开始设置GBrain。目标：5分钟内完成可工作的brain。

## 契约

- 设置完成并通过`gbrain doctor --json`验证（所有检查OK）。
- brain优先查找协议被注入到项目的AGENTS.md或等效文件中。
- 实时同步已配置并验证（测试变更已推送并通过搜索找到）。
- 模式状态跟踪在`~/.gbrain/update-state.json`中，以便未来升级知道用户采纳或拒绝的内容。
- 不请求Supabase anon key；GBrain仅使用数据库连接字符串。

## 安装（如果尚未安装）

```bash
bun add github:garrytan/gbrain
```

## GBrain如何连接

GBrain通过wire协议直接连接到Postgres。不是通过Supabase REST API。你需要**数据库连接字符串**（一个`postgresql://` URI），而不是项目URL或anon key。密码嵌入在连接字符串中。

使用**共享连接池器**连接字符串（端口6543），而不是直接连接（端口5432）。直接主机名仅解析为IPv6，许多环境无法访问。查找方法：转到项目，单击项目URL旁边的**Get Connected**，然后单击**Direct Connection String** > **Session Pooler**，并复制**Shared Pooler**连接字符串。

**不要询问Supabase anon key。** GBrain不使用它。

## 为什么选择Supabase

Supabase为你提供托管的Postgres + pgvector（内置向量搜索），价格为25美元/月：
- Pro级别8GB数据库 + 100GB存储
- 无需管理服务器，自动备份，用于调试的仪表板
- pgvector预安装，开箱即用
- 替代方案：任何带pgvector扩展的Postgres（自托管、Neon、Railway等）

## 前置条件

- Supabase帐户（推荐Pro级别，25美元/月）或任何带pgvector的Postgres
- OpenAI API密钥（用于语义搜索嵌入，约4-5美元用于7,500个页面）
- 基于git的markdown知识库（或全新开始）

## 可用的init选项

- `gbrain init --supabase` -- 交互式向导（提示输入连接字符串）
- `gbrain init --url <connection_string>` -- 直接，无提示
- `gbrain init --non-interactive --url <连接字符串>` -- 用于脚本/代理
- `gbrain doctor --json` -- init后健康检查

没有`--local`、`--sqlite`或离线模式。GBrain需要Postgres + pgvector（本地PGLite或远程Supabase / 自托管）。

## 阶段A.5：选择拓扑（在阶段A之前运行）

GBrain支持三种部署形态。在安装前选择正确的形态，因为选择错误会造成争用或重复工作，难以撤销。阅读`docs/architecture/topologies.md`了解全貌；简短版本：

在运行`gbrain init`之前询问用户：

> "三种部署形态：
>  1. **单brain（默认）** — 一台机器，一个数据库，一个代理。如果不确定，请选择此选项。
>  2. **跨机器瘦客户端** — 你的brain位于另一台机器上（例如brain-host），运行`gbrain serve --http`，此安装仅通过MCP调用它。此机器上没有本地数据库。
>  3. **每worktree代码 + 共享远程制品** — 使用Conductor的用户，多个worktree索引同一代码仓库。每个worktree拥有自己的代码引擎；制品位于共享远程brain上。
>
>  哪个适合？"

### 如果用户选择1（单brain）— 继续阶段A

继续使用现有的`gbrain init --supabase` / `--pglite`设置。

### 如果用户选择2（跨机器瘦客户端）

1. **确认主机已存在。** 询问："远程`gbrain serve --http`是否已在主机上运行？" 如果没有，用户需要首先设置主机（在主机上执行阶段A-C，然后执行`gbrain serve --http`）。在主机启动之前，不要尝试在此机器上运行init。

2. **从主机操作员获取OAuth凭据。** 要求用户在主机上运行：
   ```bash
   gbrain auth register-client <name> \
     --grant-types client_credentials \
     --scopes read,write,admin
   ```
   `admin` scope是必需的，因为`gbrain remote ping`和`gbrain remote doctor`（B级便捷命令）使用`admin` scope调用MCP操作。`read,write`单独会破坏ping/doctor。

3. **在此机器上运行瘦客户端init：**
   ```bash
   gbrain init --mcp-only \
     --issuer-url https://<host>:<port> \
     --mcp-url https://<host>:<port>/mcp \
     --oauth-client-id <id> \
     --oauth-client-secret <secret>
   ```
   或者设置`GBRAIN_REMOTE_CLIENT_SECRET`环境变量代替flag（首选用于无头/脚本设置）。预运行三个冒烟探测；任何失败都会显示可操作的错误。

4. **配置代理的MCP客户端。** 添加指向`<mcp_url>`的服务器条目，带bearer token。参见`docs/mcp/CLAUDE_DESKTOP.md`、`docs/mcp/CLAUDE_CODE.md`等了解每个客户端的片段。

5. **使用`gbrain doctor`验证。** 瘦客户端doctor运行OAuth发现、token往返和针对主机MCP冒烟。应报告`mode: thin-client`，所有检查为绿色。

6. **完全跳过阶段B、C、C.5和H。** 它们用于本地引擎。主机的autopilot处理sync/extract/embed。瘦客户端仅消费。

7. **继续阶段D（brain优先查找）。** 它通过MCP完全相同地工作 — 代理使用相同的brain-ops技能来query/search/get_page，它们只是通过主机的`gbrain serve --http`往返。

如果init报告"thin-client config already present"，则先前的设置已配置此机器。在没有`--force`的情况下拒绝是正确的行为；要么接受现有配置，要么传递`--force`刷新。

### 如果用户选择3（每worktree拆分引擎）

这种形态需要gstack处理的每worktree连接，而不是gbrain直接处理。gbrain的角色只是在设置`GBRAIN_HOME`时运行本地引擎 — 这已经有效。

让用户指向`docs/architecture/topologies.md`（拓扑3部分）了解连接方法，然后继续阶段A作为正常 — 此机器上的`gbrain init`设置制品brain（"默认"主目录）。每worktree代码引擎在gstack创建它们时按每worktree配置。

如果用户有远程制品brain（拓扑2 + 3组合），请遵循上述瘦客户端设置以获取制品brain，而不是阶段A。

## 阶段A：Supabase设置（推荐）

引导用户创建Supabase项目：

1. "转到https://supabase.com并注册或登录。"
2. "单击左上角的'New Project'。"
   - 名称：`gbrain`
   - 区域：选择离你最近的
   - 数据库密码：生成一个强密码并保存
3. "等待约2分钟让项目初始化。"
4. "查找连接字符串：转到你的项目，单击项目URL旁边的**Get Connected**，然后单击**Direct Connection String** > **Session Pooler**，并复制**Shared Pooler**连接字符串（端口6543）。"
5. 初始化gbrain：
   ```bash
   gbrain init --non-interactive --url "postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
   ```
6. 验证：`gbrain doctor --json`

**OpenClaw/Hermes代理说明：** 将Supabase访问token存储在持久化env中为`SUPABASE_ACCESS_TOKEN`。gbrain不存储它，你未来的`gbrain doctor`运行需要它。在以下位置生成：https://supabase.com/dashboard/account/tokens

## 阶段B：自带Postgres（替代方案）

如果用户已经有带pgvector的Postgres：

1. 从用户获取连接字符串。
2. 运行：`gbrain init --non-interactive --url "<连接字符串>"`
3. 验证：`gbrain doctor --json`

如果连接失败并显示ECONNREFUSED且URL包含`supabase.co`，用户可能粘贴了直接连接（仅IPv6）。引导他们使用Session pooler字符串（参见阶段A步骤4）。

## 阶段C：首次导入

1. **发现markdown仓库。** 扫描环境中的git仓库，查找markdown内容。

```bash
echo "=== GBrain环境发现 ==="
for dir in /data/* ~/git/* ~/Documents/* 2>/dev/null; do
  if [ -d "$dir/.git" ]; then
    md_count=$(find "$dir" -name "*.md" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$md_count" -gt 10 ]; then
      total_size=$(du -sh "$dir" 2>/dev/null | cut -f1)
      echo "  $dir ($total_size, $md_count .md 文件)"
    fi
  fi
done
echo "=== 发现完成 ==="
```

2. **导入最佳候选。** 对于大型导入（>1000个文件），使用nohup以在会话超时后继续运行：
   ```bash
   nohup gbrain import <dir> --no-embed --workers 4 > /tmp/gbrain-import.log 2>&1 &
   ```
   然后检查进度：`tail -1 /tmp/gbrain-import.log`

   对于较小的导入，直接运行：
   ```bash
   gbrain import <dir> --no-embed
   ```

3. **证明搜索有效。** 根据导入的数据选择语义查询：
   ```bash
   gbrain search "<来自导入数据的主题>"
   ```
   这是神奇的时刻：用户看到搜索找到grep无法找到的内容。

4. **开始嵌入。** 刷新陈旧的嵌入（在后台运行）。关键字搜索现在有效，随着嵌入完成，语义搜索会改进。

5. **回填知识图谱。** 从导入的页面填充类型化链接和结构化时间线。Auto-link向前维护两者，但历史页面需要一次性回填。

   ```bash
   gbrain extract links --source db --dry-run | head -20    # 预览
   gbrain extract links --source db                         # 提交
   gbrain extract timeline --source db                      # 日期事件
   gbrain stats                                             # 验证links > 0
   ```

   此后，`gbrain graph-query <slug> --depth 2`有效，搜索对连接良好的实体排名更高。幂等 — 随时可以重新运行。支持`--since YYYY-MM-DD`用于大型brain的增量运行。

   如果阶段C导入零页面，则跳过（auto-link处理新写入）。

6. **提供文件迁移。** 如果仓库有二进制文件（带图像、PDF、音频的.raw/目录）：
   > "你的brain仓库中有N个二进制文件（X GB）。想要将它们移动到云存储吗？你的git仓库将从X GB减少到Y MB。所有链接继续工作。"

   如果用户同意，配置存储并运行迁移：
   ```bash
   # 配置存储后端（推荐Supabase Storage）
   gbrain config set storage.backend supabase
   gbrain config set storage.bucket brain-files
   gbrain config set storage.projectUrl <supabase-url>
   gbrain config set storage.serviceRoleKey <service-role-key>

   # 将二进制文件迁移到云（3步生命周期）
   gbrain files mirror <brain-dir>       # 上传到云，保留本地
   gbrain files redirect <brain-dir>     # 用.redirect.yaml指针替换本地
   # （可选）gbrain files clean <brain-dir> --yes   # 也删除指针
   ```

   迁移后，`gbrain files upload-raw`自动处理新文件：小文本/PDF保留在git中，大/媒体文件转到云，带`.redirect.yaml`指针。文件>= 100 MB使用TUS可恢复上传以提高可靠性。

如果没有找到markdown仓库，从docs/GBRAIN_RECOMMENDED_SCHEMA.md创建带有几个模板页面的入门brain（一个人页面、一个公司页面、一个概念页面）。

## 阶段C.5：一步式autopilot + Minions安装（v0.11.1+）

运行迁移运行器一次，然后安装autopilot。两个命令，完成：

```bash
gbrain apply-migrations --yes       # 应用任何待定迁移；在健康安装上幂等
gbrain autopilot --install          # 监督自身 + fork Minions worker；支持env
```

`gbrain autopilot --install`的作用：

- 在**macOS**上：在`~/Library/LaunchAgents/com.gbrain.autopilot.plist`写入launchd plist。
- 在**带systemd的Linux**上：在`~/.config/systemd/user/gbrain-autopilot.service`写入，带`Restart=on-failure`。
- 在**临时容器**（Render / Railway / Fly / Docker）上：写入`~/.gbrain/start-autopilot.sh`并打印一行，你的代理的bootstrap应该source它以在每次容器启动时启动autopilot。如果在检测到时自动注入到OpenClaw的`hooks/bootstrap/ensure-services.sh`（使用`--no-inject`选择退出）。
- 在**没有systemd的Linux**上：安装crontab条目（每5分钟）。

然后，Autopilot作为子进程监督Minions worker。用户从一步安装获得sync + extract + embed + backlinks + 持久Postgres支持作业处理。没有单独的`gbrain jobs work`守护进程要管理。

在PGLite上，autopilot内联运行（PGLite的独占文件锁阻止单独的worker进程）。其他一切仍然有效。

如果`apply-migrations`打印"N host-specific items need your agent's attention"，读取`~/.gbrain/migrations/pending-host-work.jsonl` + 遍历`skills/migrations/v0.11.0.md` + `docs/guides/plugin-handlers.md`以注册host-specific处理程序。在每批之后重新运行`apply-migrations`。

## 阶段D：Brain优先查找协议

将brain优先查找协议注入到项目的AGENTS.md（或等效文件）中。这用结构化gbrain查询替换基于grep的知识查找。

### 之前（grep）vs 之后（gbrain）

| 任务 | 之前（grep） | 之后（gbrain） |
|------|---------------|-----------------|
| 查找一个人 | `grep -r "Pedro" brain/` | `gbrain search "Pedro"` |
| 理解一个主题 | `grep -rl "deal" brain/ \| head -5 && cat ...` | `gbrain query "what's the status of the deal"` |
| 读取已知页面 | `cat brain/people/pedro.md` | `gbrain get people/pedro` |
| 查找连接 | `grep -rl "Brex" brain/ \| xargs grep "Pedro"` | `gbrain query "Pedro Brex relationship"` |

### 查找顺序（每个实体问题的强制性）

1. `gbrain search "name"` -- 关键字匹配，快速，无需嵌入即可工作
2. `gbrain query "what do we know about name"` -- 混合搜索，需要嵌入
3. `gbrain get <slug>` -- 当你从步骤1-2知道slug时直接读取页面
4. `grep`回退 -- 仅当gbrain返回零结果**且**文件可能存在于索引的brain之外时

在给你所需内容的第一个步骤停止。大多数查找在步骤1解决。

### 写入后同步规则

在仓库中创建或更新任何brain页面后，立即同步以使索引保持最新：

```bash
gbrain sync --no-pull --no-embed
```

这会索引新的/更改的文件，无需从git拉取或重新生成嵌入。嵌入可以稍后批量刷新（`gbrain embed --stale`）。

### gbrain vs memory_search

| 层 | 存储内容 | 何时使用 |
|-------|---------------|-------------|
| **gbrain** | 世界知识：人物、公司、交易、会议、概念、媒体 | "Pedro是谁？"、"董事会议上发生了什么？" |
| **memory_search** | 代理操作状态：偏好、决策、会话上下文 | "用户喜欢什么格式？"、"关于X我们决定了什么？" |

两者都应检查。gbrain用于关于世界的事实。memory_search用于代理应如何行为。

## 阶段E：加载生产代理指南

阅读`docs/GBRAIN_SKILLPACK.md`。这是生产代理如何使用gbrain的参考架构：brain-agent循环、实体检测、丰富管道、会议摄取、cron计划和五个操作规范。

将关键模式注入代理的系统上下文或AGENTS.md中：

1. **Brain-agent循环**（第2节）：响应前读取，学习后写入
2. **实体检测**（第3节）：在每条消息上spawn，捕获人物/公司/想法
3. **来源归因**（第7节）：每个事实需要`[Source: ...]`

告诉用户："生产代理指南位于docs/GBRAIN_SKILLPACK.md。它涵盖brain-agent循环、实体检测、丰富、会议摄取和cron计划。当你准备好从'搜索有效'到'brain自我维护'时阅读它。"

## 阶段F：健康检查

运行`gbrain doctor --json`并报告结果。每次检查都应为OK。如果任何检查失败，doctor输出会准确告诉你什么问题及如何修复。

## 错误恢复

**如果任何gbrain命令失败，首先运行`gbrain doctor --json`。** 报告完整输出。它会检查连接、pgvector、RLS、模式版本和嵌入。

| 你看到的 | 原因 | 修复 |
|---|---|---|
| 连接被拒绝 | Supabase项目暂停、IPv6或错误URL | 使用Session pooler（端口6543），或supabase.com/dashboard > 恢复 |
| 密码验证失败 | 错误密码 | 项目设置 > 数据库 > 重置密码 |
| pgvector不可用 | 扩展未启用 | 在SQL编辑器中运行`CREATE EXTENSION vector;` |
| OpenAI密钥无效 | 过期或错误密钥 | platform.openai.com/api-keys > 创建新的 |
| 未找到页面 | 导入前查询 | 首先将文件导入gbrain |
| RLS未启用 | 安全缺口 | 再次运行`gbrain init`（自动启用RLS） |

## 阶段G：自动更新检查（如果尚未配置）

如果用户的安装**不**包括设置自动更新检查（例如，他们使用手动安装路径或旧版本的OpenClaw/Hermes粘贴），提供它：

> "你想要每日GBrain更新检查吗？当有新版本值得升级时 — 包括新技能和模式建议 — 我会通知你。在安装任何内容之前，你总是会被询问。"

如果同意：
1. 测试：`gbrain check-update --json`
2. 注册每日cron（参见GBRAIN_SKILLPACK.md第17节）

如果已配置或用户拒绝，跳过。

## 阶段H：实时同步设置（必须添加）

brain仓库是事实来源。如果同步不自动运行，向量数据库会落后，gbrain返回陈旧答案。此阶段不是可选的。

阅读`docs/GBRAIN_SKILLPACK.md`第18节了解完整参考。关键点：

1. **首先检查连接池器。** 同步在每次导入时使用事务。如果`DATABASE_URL`使用Supabase的Transaction mode pooler，同步将抛出`.begin() is not a function`并静默跳过大多数页面。验证连接字符串使用Session mode（端口6543、Session mode）或直接（端口5432）。

2. **设置自动同步。** 选择适合你环境的方法：
   - **Cron**（推荐用于代理）：每5-30分钟注册cron：
     `gbrain sync --repo /data/brain && gbrain embed --stale`
   - **Watch模式**：在进程管理器下`gbrain sync --watch --repo /data/brain`。与cron回退配对（watch在5次连续失败后退出）。
   - **Webhook或git hook**：如果在你的环境中可用。

3. **验证同步有效。** 不仅要检查命令是否运行。检查它是否工作：
   - `gbrain stats`应显示页面计数接近仓库中可同步文件计数。
   - 如果页面计数太低，pooler bug会静默跳过页面。
   - 推送测试更改并确认它出现在`gbrain search`中。

4. **链式同步 + 嵌入。** 始终运行两者：`gbrain sync --repo <path> && gbrain embed --stale`。对于小型同步，嵌入内联生成。`embed --stale`是任何陈旧块的安网。

告诉用户："实时同步已配置。Brain将自动保持最新。我将在下一阶段验证它是否工作。"

## 阶段I：完整验证

运行完整验证运行手册以确认整个安装工作。

1. 阅读`docs/GBRAIN_VERIFY.md`
2. 按顺序执行每个检查
3. 向用户报告结果
4. 在声明设置完成之前修复任何失败

运行手册中的每个检查都应通过。最重要的是检查4（实时同步实际工作）：推送更改、等待同步、搜索更正后的文本。"同步运行"与"同步工作"不同。

告诉用户："我已验证完整的GBrain安装。这是每个检查的状态：[列出结果]。一切正常 / [特定项目]需要注意。"

如果已配置或用户拒绝，跳过。

## 阶段J：冷启动 — 填充你的Brain（自动）

设置完成。Brain工作。但它是空的。**这是最重要的时刻** — 空的brain是无用的。直接转换到冷启动技能，用用户的实际数据填充它。

**不要在未提供冷启动的情况下结束设置。** 用户刚刚在设置上投入了15+分钟。回报是看到他们的brain用自己的数据变得活跃。在这里停止就像安装电话却从不添加联系人。

验证通过后立即呈现：

> "✅ GBrain已设置并验证。现在让我们用你的数据填充它。
>
> 我可以连接你的Google服务（联系人、日历、电子邮件），导入
> 你现有的笔记，从ChatGPT/Claude拉入对话，以及
> 归档你的推文 — 所有都在一个会话中。每个步骤都是可选的。
>
> **准备好填充你的brain吗？**"

如果用户说可以（或任何肯定）：
→ **立即加载并执行`skills/cold-start/SKILL.md`。** 不要只打印引用 — 实际运行冷启动技能。

如果用户说不可以或想要停止：
→ 记录在`~/.gbrain/cold-start-state.json`中：
```json
{"deferred": true, "deferred_at": "ISO-timestamp", "phases_completed": []}
```
→ 告诉他们："你可以随时通过要求我'填充我的brain'或'冷启动'来运行冷启动。"

## 模式状态跟踪

在呈现推荐目录（阶段C/E）且用户选择要创建的目录后，写入`~/.gbrain/update-state.json`记录：
- `schema_version_applied`：当前gbrain版本
- `skillpack_version_applied`：当前gbrain版本
- `schema_choices.adopted`：用户创建的目录
- `schema_choices.declined`：用户明确跳过的目录
- `schema_choices.custom`：用户添加的不在推荐模式中的目录

此文件使未来升级能够建议新模式添加，而无需重新建议用户已拒绝的内容。

## 反模式

- **在未提供冷启动的情况下结束设置。** 空的brain是无用的。阶段J（冷启动）是设置获得回报的地方。验证后始终呈现"准备好填充？"提示。跳过这就像安装应用却从不登录。
- **询问Supabase anon key。** GBrain通过wire协议直接连接到Postgres，而不是通过REST API。仅需要数据库连接字符串。
- **跳过实时同步设置。** 如果同步不自动运行，向量数据库会落后，搜索返回陈旧答案。阶段H不是可选的。
- **在未验证的情况下声明设置完成。** "命令运行"与"它工作"不同。推送测试更改、等待同步、搜索更正后的文本。
- **使用Transaction mode pooler。** 同步在每次导入时使用事务。Transaction mode pooler导致`.begin() is not a function`错误并静默跳过页面。始终使用Session mode（端口6543）。
- **在未证明搜索的情况下导入。** 神奇的时刻是用户看到搜索找到grep无法找到的内容。不要跳过它。

## 输出格式

```
GBRAIN设置完成
=====================

引擎: [PGLite / Supabase Postgres]
连接: [已验证 / pooler模式已确认]
导入页面数: N
嵌入: N/N（关键字搜索激活，语义改进中）
实时同步: [已配置 / 方法]
健康检查: 全部OK / [特定失败]
验证: [GBRAIN_VERIFY.md结果]

🧠 准备好填充你的brain了吗？我可以连接你的Google服务、
导入你的笔记并拉入你的对话 — 所有都在一个会话中。
→ 启动冷启动...
```

**输出应直接转换到冷启动（阶段J），而不是以项目符号列表结束。** 项目符号列表用于用户推迟冷启动时。

## 使用的工具

- `gbrain init --non-interactive --url ...` -- 创建brain
- `gbrain import <dir> --no-embed [--workers N]` -- 导入文件
- `gbrain search <query>` -- 搜索brain
- `gbrain doctor --json` -- 健康检查
- `gbrain check-update --json` -- 检查更新
- `gbrain embed refresh` -- 生成嵌入
- `gbrain embed --stale` -- 回填缺失的嵌入
- `gbrain sync --repo <path>` -- 来自brain仓库的一次性同步
- `gbrain sync --watch --repo <path>` -- 持续同步轮询
- `gbrain config get sync.last_run` -- 检查上次同步时间戳
- `gbrain stats` -- 页面计数 + 嵌入覆盖率
