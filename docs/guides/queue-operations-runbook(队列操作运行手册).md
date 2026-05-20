# 队列操作运行手册#

"我的队列看起来卡住了 — 我运行什么？" 下面的命令按你 probable 想要它们的顺序。附带 v0.19.1 之后发生生产事件，其中队列保持卡住超过 90 分钟，然后操作员才注意到。

## 第一个信号：作业未运行 #

```bash
gbrain doctor --json | jq '.checks[] | select(.name == "queue_health")'
```

`queue_health` 标记两个模式：

- **永远卡住**：`started_at` 超过 1 小时前的活跃作业。
- **waiting-depth**：任何按名称的队列深度超过 10（通过 `GBRAIN_QUEUE_WAITING_THRESHOLD` 覆盖）。表示缺少 `maxWaiting`。

## 分类命令 #

```bash
# 谁现在真的在运行？
gbrain jobs list --status active

# 谁在等待，最大的堆在前？
gbrain jobs list --status waiting --limit 50

# 特定作业出了什么问题？
gbrain jobs get <id>
```

## 救援操作（按升级顺序） #

```bash
# 强制终止单个卡住的作业：
gbrain jobs cancel <id>

# 完全清除一个特定的作业（最后的手段）：
gbrain jobs delete <id>

# 机制本身的健康状况：
gbrain jobs smoke --wedge-rescue
```

## 每个子检查的含义 #

- **永远卡住** — 一个 worker 认领了一个作业，开始执行，并且有超过 1 小时的锁定。wall-clock 扫描会在 2× `timeout_ms` 后驱逐作业；如果某个作业仍然处于活跃状态，则要么没有 `timeout_ms` 被设置，要么扫描是新部署的，并且此作业在扫描器运行之前被卡住。

- **waiting-depth** — 提交者提交的作业速度快于 worker 排空它们的速度。对于小型变更集（<= 100 个文件），嵌入会在导入期间内联生成。超过该大小，导入完成，但块没有嵌入。它们存在于数据库中，但在向量搜索中不可见。始终一起运行这两个命令。`&&` 确保在同步成功时才运行嵌入。

## 棘手的地方 #

1. **始终链接同步 + 嵌入。** 运行 `gbrain sync` 而没有 `gbrain embed --stale` 会使新块没有嵌入。它们存在于数据库中，但在向量搜索中不可见。始终一起运行这两个命令。`&&` 确保在同步成功时才运行嵌入。

2. **`--watch` 轮询，它不会流式传输。** `--watch` 标志每 60 秒（可配置）轮询一次。它不是文件系统观察器或 git hook。它在 5 次连续失败后退出，因此它需要进程管理器（systemd、pm2）或 cron 回退来保持活动。不要假设它永远运行。

3. **Webhook 需要服务器运行。** 如果你使用 GitHub webhook 进行即时同步，则接收服务器必须正在运行并且可访问。如果推送发生时服务器关闭，则会错过该同步。将 webhook 与捕获 webhook 错过的任何内容的 cron 回退配对。

## 如何验证 #

1. **编辑文件并搜索更改。** 编辑大脑 markdown 文件，提交并推送。等待下一个同步周期（cron 间隔或 `--watch` 轮询）。运行 `gbrain search "<来自编辑的文本>"`。更新的内容应出现在结果中。如果它返回的是旧内容，则同步失败了。

2. **将页面计数与文件计数进行比较。** 运行 `gbrain stats` 并计算大脑仓库中的可同步 markdown 文件。数据库中的页面计数应匹配。如果它们分歧，则文件被静默跳过（可能是事务模式连接问题）。

3. **检查已嵌入的块计数。** 在 `gbrain stats` 中，已嵌入的块计数应接近总块计数。大的差距意味着 `gbrain embed --stale` 在同步后未运行，使得块在向量搜索中不可见。

---

*是 [GBrain Skillpack](../GBRAIN_SKILLPACK.md) 的一部分。*
