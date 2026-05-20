---
name: reports
version: 1.0.0
description: |
  保存和加载带时间戳的报告。关键字路由实现快速查找。
  Cron作业将输出保存为报告；代理或用户通过关键字查询它们。
triggers:
  - "保存报告"
  - "加载最新报告"
  - "最新简报是什么"
  - "给我看pulse"
tools:
  - get_page
  - put_page
  - search
mutating: true
---

# 报告技能

## 契约

本技能保证：
- 报告使用带时间戳的文件名和frontmatter保存
- 关键字路由：查询 → 报告类别映射
- 可通过类别名称加载最新报告
- 报告可通过gbrain search/query搜索

## 阶段

1. **保存报告。** 写入`reports/{category}/{YYYY-MM-DD-HHMM}.md`，包含frontmatter：
   ```yaml
   ---
   title: {报告标题}
   type: report
   category: {类别名称}
   date: {YYYY-MM-DD}
   time: {HH:MM PT}
   ---
   ```
2. **加载最新。** 给定类别，找到最新的报告文件。
3. **关键字路由。** 将常见查询映射到报告类别：
   - "email" / "inbox" → ea-inbox-sweep
   - "social" / "mentions" → social-mentions
   - "briefing" / "morning" → morning-briefing
   - "meeting" → meeting-sync
   - 可配置自定义映射

## 输出格式

已保存：`reports/{category}/{YYYY-MM-DD-HHMM}.md`
已加载：带元数据的完整报告内容。

## 反模式

- 保存报告时不带frontmatter（使它们无法搜索）
- 在不同运行之间使用不一致的类别名称
- 当只需要最新报告时加载所有报告
- 不按关键字路由（强制使用确切类别名称）
