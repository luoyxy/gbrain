# 多来源大脑#

**单个 gbrain 数据库可以容纳多个知识仓库。** 每个都是一个 `source`：逻辑大脑内的大脑，具有自己的 slug 命名空间、自己的同步状态和自己的联邦策略。本指南的其余部分遍历三个规范场景。

## 三个场景#

### 1. 统一知识回忆（wiki + gstack）#

你拥有一个个人 wiki 和一个 `gstack` 检出。两者都属于你，你想要你的代理跨两者回忆你拥有的所有知识。当你问"我对 X 了解到什么？"时，无论它生活在 wiki 还是 gstack 计划中，你都想要最佳命中。

```bash
# 注册 gstack 来源，联邦因此它在跨来源搜索中加入
gbrain sources add gstack --path ~/.gstack --federated

# 固定目录，以便 `gbrain sync` 知道它在走哪个来源
cd ~/.gstack && gbrain sources attach gstack

# 初始同步
gbrain sync --source gstack

# 现在 `gbrain search "retry budgets"` 从 WIKI 和
# gstack 返回命中。每个结果都包含 source_id，以便代理可以正确引用。
```

结果：wiki 页面和 gstack 计划是分开的（不同的 source_ids，不同的 slug 命名空间）但共享搜索表面。

### 2. 目的分离的大脑（yc-media + garrys-list）#

你在同一个后端上运行两个完全不同的内容管道。YC Media 涵盖投资组合新闻和创始人资料。Garrys List 是个人写作。你明确不希望它们混合在搜索中 — YC 投资组合内容泄漏到文章搜索中是一个错误，而不是功能。

```bash
# 两个来源，都隔离（federated=false）
gbrain sources add yc-media --path ~/yc-media --no-federated
gbrain sources add garrys-list --path ~/writing --no-federated

# 固定每个检出目录
(cd ~/yc-media && gbrain sources attach yc-media)
(cd ~/writing && gbrain sources attach garrys-list)

# 独立同步每个
gbrain sync --source yc-media
gbrain sync --source garrys-list
```

结果：从任一目录中搜索都不会返回 `default` 来源（你的主 brain）。从 `~/yc-media` 内搜索仅返回 yc-media 命中。从 `~/writing` 内搜索仅返回 garrys-list。

联邦是选择加入，不是泄漏。

要按需跨它们搜索：

```bash
gbrain search "tech layoffs" --source yc-media,garrys-list
```

### 3. 混合（wiki 联邦 + 会话隔离）#

你的主 wiki 与几个受信任的来源联邦。你的会话记录（在 v0.18 中到来）位于一个单独的隔离来源中，因此它们不会主导每个搜索结果。

```bash
# 联邦来源
gbrain sources add gstack --path ~/.gstack --federated

# 隔离来源（未来的 v0.18 — 会话使用此形状进行摄取）
gbrain sources add sessions --path ~/.claude/sessions --no-federated
```

## 解析优先级#

当任何命令需要选择一个来源时，gbrain 遍历此列表（最高优先 first）：

1. 显式 `--source <id>` 标志。
2. `GBRAIN_SOURCE` 环境变量。
3. `..gbrain-source` dotfile 在 CWD 或任何祖先目录中。
4. 其 `local_path` 包含 CWD 的注册来源（嵌套检出的长度前缀获胜）。
5. 通过 `gbrain sources default <id>` 设置的 brain 级别默认值。
6. 播种的 `default` 来源。

因此在 `~/.gstack/plans/` 内，`gbrain put-page` 隐式写入 `gstack` 来源。在任何注册的目录外且没有 env/dotfile 设置的情况下，它写入默认值。

## 联邦标志#

每个来源行在其 JSONB 配置中存储 `config.federated: boolean`：

| 值 | 含义 |
|---|---|
| `true` | 来源参与非限定性的 `gbrain search "X"` 结果。 |
| `false`（新来源的默认值） | 仅当通过 `--source <id>` 或限定性引用显式命名时才搜索来源。 |

播种的 `default` 来源是 `federated=true`，因此 pre-v0.17 brains 的行为与之前完全相同 — 每个页面都出现在搜索中。

稍后使用 `gbrain sources federate <id>` / `unfederate <id>` 翻转。

## 命令#

完整子命令参考：

```
gbrain sources add <id> --path <p> [--name <n>] [--federated|--no-federated]
                              注册一个来源。id：[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])？
gbrain sources list [--json]   列出所有来源及其页面计数 + 联邦状态。
gbrain sources remove <id> [--yes] [--dry-run] [--keep-storage]
                              级联删除一个来源（页面、块、时间线）。
gbrain sources rename <id> <new-name>
                              仅更改显示名称；id 是不可变的。
gbrain sources default <id>   设置 brain 级别的默认值。
gbrain sources attach <id>    在 CWD 中写入 .gbrain-source（像 kubectl 上下文）。
gbrain sources detach         从 CWD 中移除 .gbrain-source。
gbrain sources federate <id>
gbrain sources unfederate <id>
```

## 代理的引用格式#

当代理接收多来源结果时，它们必须以 `[source-id:slug]` 形式引用页面。示例：

> 你告诉过我关于蒸馏协议 — 请参阅 [wiki:topics/ai]
> 和 [gstack:plans/multi-repo] 以获取此内容的来源。

引用键是 `sources.id`（不可变的）。通过 `gbrain sources rename` 重命名一个来源仅更改显示名称；现有引用继续工作。

## 写入特定来源#

```bash
# 显式传递 --source
gbrain put-page topics/ai ... --source wiki

# 或依赖 dotfile / env / CWD 匹配
cd ~/.gstack && gbrain put-page plans/multi-repo ...
# → 来源自动解析为 gstack
```

读取跨越联邦来源。写入需要已解析的来源（显式、推断或默认）。解析器在模糊时永远不会静默选择一个来源 — 它以清晰的修复错误。

## 升级现有大脑#

`gbrain upgrade` 自动运行 v16 + v17 迁移。你的现有页面全部移动到 `source_id='default'`。在添加第二个来源之前，行为保持不变。

要添加一个：

```bash
gbrain sources add gstack --path ~/.gstack --federated
cd ~/.gstack && gbrain sources attach gstack && gbrain sync
```

两个命令。现有默认来源未被触及。

## 不在 v0.18.0 中的内容#

- 会话记录摄取（`.jsonl`、提高的大小上限、会话 PageType）— v0.18。
- 每来源保留/TTL（`gbrain sources prune`）— v0.18。
- 通过调用者身份识别的 ACL 强制执行 — v0.17.1。
- `gbrain sources import-from-github <url>` 一次性引导 — 补丁发布后核心管道稳定下来。

所有这些构建在此处发布的 `sources` 原语上。
