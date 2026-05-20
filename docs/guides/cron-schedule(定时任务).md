# 参考 Cron 计划

## 目标

生产大脑运行 20+ 个定期作业，使其保持活跃、最新和复合。本指南显示了计划、模式和如何设置它。

## 用户得到什么

没有这个：大脑只在你手动摄取数据时更新。页面变得陈旧，实体变得单薄，引用断裂，代理从旧上下文回答。

有了这个：大脑自我维护。电子邮件、社交、日历和会议自动流入。单薄的页面在夜间变得丰富。断裂的引用得到修复。你醒来时，大脑比你入睡时更聪明。

## 计划

| 频率 | 作业 | 大脑交互 | 配方 |
|-----------|-----|-------------------|--------|
| 每 30 分钟 | 电子邮件监控 | 搜索发件人，更新人物页面 | [email-to-brain](../../recipes/email-to-brain.md) |
| 每 30 分钟 | X/Twitter 收集 | 创建/更新媒体页面，实体提取 | [x-to-brain](../../recipes/x-to-brain.md) |
| 每天 3 次（工作日） | 会议同步 | 完整摄取 + 参会者传播 | [meeting-sync](../../recipes/meeting-sync.md) |
| 每周 | 日历同步 | 每日文件 + 参会者丰富 | [calendar-to-brain](../../recipes/calendar-to-brain.md) |
| 每天上午 | 晨间简报 | 搜索日历参会者、交易状态、活跃主题 | [briefing skill](../../skills/briefing/SKILL.md) |
| 每周 | 大脑维护 | `gbrain doctor`、`embed stale`、孤儿检测 | [maintain skill](../../skills/maintain/SKILL.md) |
| 每晚 | 梦境循环 | 实体扫描、丰富单薄点、修复引用 | 见下文 |

## 实现：设置 Cron 作业

```bash
# 电子邮件收集器 — 每 30 分钟
*/30 * * * * cd /path/to/email-collector && node email-collector.mjs collect && node email-collector.mjs digest

# X/Twitter 收集器 — 每 30 分钟
*/30 * * * * cd /path/to/x-collector && node x-collector.mjs collect >> /tmp/x-collector.log 2>&1

# 会议同步 — 上午 10 点、下午 4 点、晚上 9 点，工作日
0 10,16,21 * * 1-5 cd /path/to/meeting-sync && node meeting-sync.mjs >> /tmp/meeting-sync.log 2>&1

# 日历同步 — 周日上午 10 点
0 10 * * 0 cd /path/to/calendar-sync && node calendar-sync.mjs --start $(date -v-7d +%Y-%m-%d) --end $(date +%Y-%m-%d)

# 大脑健康 — 每周一上午 6 点
0 6 * * 1 gbrain doctor --json >> /tmp/gbrain-health.log 2>&1 && gbrain embed --stale

# 梦境循环 — 每晚凌晨 2 点
0 2 * * * /path/to/dream-cycle.sh
```

### 安静时间门（强制性）

每个发送通知的 cron 作业必须首先检查安静时间。有关完整模式，请参阅 [安静时间](quiet-hours.md)。

```bash
# 在每个 cron 脚本中：
if ! bash scripts/quiet-hours-gate.sh; then
  mkdir -p /tmp/cron-held
  echo "$OUTPUT" > /tmp/cron-held/$(basename "$0" .sh).md
  exit 0
fi
# 不是安静时间 — 正常发送
```

### 支持旅行的时区处理

代理读取你的日历以查找航班、酒店和办公室外块来推断你当前的位置和时区。所有时间都显示在你的本地时区。

```
// 示例：用户飞往东京
// 太平洋时间下午 2 点 = 东京时间凌晨 3 点 = 安静时间
// 暂停通知，折叠到晨间简报中

get_user_timezone():
  calendar = gbrain search "flight" --type calendar --recent 7d
  if recent_flight:
    return infer_timezone(flight.destination)
  return config.default_timezone  // 回退：US/Pacific
```

当你旅行时：在你家醒来时间触发但在目的地睡眠时间触发的 cron 作业会被暂停并折叠到下一个晨间简报中。不需要配置更改。

## 梦境循环

最重要的 cron 作业。在你睡觉时运行。

### 它做什么

```
dream_cycle():
  // 阶段 1：实体扫描
  conversations = get_todays_conversations()
  for message in conversations:
    entities = detect_entities(message)
    for entity in entities:
      page = gbrain search "{entity.name}"
      if not page:
        create_page(entity)        // 新实体，创建 + 丰富
      elif page.is_thin():
        enrich_page(entity)        // 单薄页面，填充它
      else:
        update_timeline(entity)    // 现有页面，添加今天的提及

  // 阶段 2：修复断裂的引用
  pages = gbrain list --type person --limit 100
  for page in pages:
    for entry in page.timeline:
      if not entry.has_source_attribution():
        fix_citation(entry)        // 在缺少的地方添加 [来源：...]
      if entry.has_tweet_url() and not entry.url_is_valid():
        fix_url(entry)             // 断裂的推文链接

  // 阶段 3：整合记忆
  patterns = detect_patterns_across_conversations()
  for pattern in patterns:
    promote_to_memory(pattern)     // 短暂的 → 持久的知识

  // 阶段 4：同步
  gbrain sync --no-pull --no-embed
  gbrain embed --stale
```

### 设置梦境循环

**OpenClaw：** 默认附带 DREAMS.md 作为默认技能。三个阶段（浅睡、深睡、REM）在安静时间期间自动运行。

**Hermes 代理：**

```bash
/cron add "0 2 * * *" "梦境循环：搜索今天会话中提到的实体。对于每个人、公司或想法：检查大脑页面是否存在（gbrain search），如果单薄则创建或更新它。修复任何断裂的引用。然后整合：读取 MEMORY.md，提升重要信号，删除陈旧条目。"
  --name "nightly-dream-cycle"
```

**Claude Code / 自定义代理：** 创建一个脚本：

```bash
#!/bin/bash
# dream-cycle.sh

# 检查安静时间（应该是安静的 — 这是我们运行的时候）
echo "梦境循环开始于 $(date)"

# 阶段 1：实体扫描（生成子代理）
# 读取今天的会话日志，提取实体，更新大脑

# 阶段 2：引用卫生
gbrain doctor --json | jq '.checks[] | select(.status=="warn")'

# 阶段 3：嵌入任何陈旧内容
gbrain embed --stale

echo "梦境循环完成于 $(date)"
```

## 棘手的地方

1. **梦境循环不是可选的。** 没有它，信号会从每个对话中泄漏。有了它，什么都不会丢失。这就是忘记的代理和记住的代理之间的区别。

2. **每个通知作业上的安静时间门。** 如果你跳过它，用户会在凌晨 3 点被 ping。一次凌晨 3 点的 ping，他们会禁用整个系统。

3. **不要过度 cron。** 20+ 个作业听起来很多。从以下开始：电子邮件（30 分钟）、梦境循环（每晚）、大脑健康（每周）。随着你添加集成配方，添加更多。

4. **时区更改是自动的。** 当用户旅行时，不要让用户重新配置 cron。读取日历，推断时区，调整传递。

5. **暂停的消息必须被接收。** 如果安静时间暂停了通知，晨间简报必须包含它。否则信息会丢失。

## 如何验证

1. **安静时间：** 将安静时间设置为当前小时。运行通知 cron。验证输出转到 `/tmp/cron-held/`，而不是消息传递。
2. **梦境循环：** 手动运行梦境循环。检查单薄实体页面是否变得丰富，断裂的引用是否得到修复。
3. **电子邮件收集器 cron：** 等待 30 分钟。检查 `data/digests/` 是否有新的摘要。
4. **晨间简报：** 检查暂停的消息是否出现在简报中。
5. **健康检查：** 运行 `gbrain doctor --json`。所有检查都应该通过。

---

*是 [GBrain Skillpack](../GBRAIN_SKILLPACK.md) 的一部分。另请参阅：[安静时间](quiet-hours.md)、[操作规范](operational-disciplines.md)*
