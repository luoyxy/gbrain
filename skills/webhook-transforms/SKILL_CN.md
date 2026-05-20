---
name: webhook-transforms
version: 1.0.0
description: |
  将外部事件（SMS、会议、社交媒体提及）转换为
  可brain摄取信号的通用框架。定义转换函数，注册webhook URL，
  传入事件通过brain管道处理。
triggers:
  - "set up webhook"
  - "process webhook event"
  - "transform this event"
tools:
  - put_page
  - add_timeline_entry
  - search
mutating: true
---

# Webhook转换

## 契约

本技能保证：
- 外部事件被转换为带有正确引用的brain页面
- 原始负载被保留（如果转换失败，使用死信队列）
- 实体提取在每个转换的事件上运行
- 输入清理：没有原始HTML/脚本传递到brain页面
- 错误处理：转换失败记录原始负载，重试一次

## 阶段

1. **定义转换。** 将事件模式映射到brain页面格式：
   - 输入：原始webhook负载（JSON）
   - 输出：brain页面内容（markdown）+ 元数据（slug、type、citations）
   - 必须清理：去除HTML标签，转义脚本内容

2. **注册webhook URL。** 向外部服务提供webhook端点。

3. **收到事件时：**
   - 解析负载
   - 运行转换函数
   - 通过`gbrain put`写入brain页面
   - 提取实体，运行丰富
   - 向提及的实体添加时间线条目
   - 同步：`gbrain sync`

4. **错误处理：**
   - 如果转换抛出：将原始负载记录到`_dead-letter/{timestamp}.md`
   - 向代理显示错误类型
   - 重试一次
   - 不要丢失事件

## 转换示例

### 收到SMS
```
输入：{from: "+1555...", body: "Meeting moved to 3pm", timestamp: "..."}
输出：发送者brain页面上的时间线条目 + 如果检测到行动项则更新任务
```

### 会议完成
```
输入：{title: "Weekly sync", attendees: [...], transcript: "...", summary: "..."}
输出：委托给meeting-ingestion技能
```

### 社交媒体提及
```
输入：{platform: "twitter", author: "@handle", text: "...", url: "..."}
输出：media/中的brain页面 + 实体提取 + 反向链接
```

## 输出格式

事件已转换并写入brain。报告："Webhook: {event_type} from {source}
→ {brain_page_path}"

## 反模式

- 将原始HTML/脚本传递到brain页面（XSS风险）
- 转换失败时静默丢弃事件（使用死信队列）
- 处理webhook而不进行实体提取
- 在brain写入之前不清理外部输入
