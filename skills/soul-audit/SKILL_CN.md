---
name: soul-audit
version: 1.0.0
description: |
  6阶段交互式访谈，生成代理的身份（SOUL.md）、
  用户配置文件（USER.md）、访问控制（ACCESS_POLICY.md）和操作
  节奏（HEARTBEAT.md）。可随时重新运行以更新任何部分。
triggers:
  - "soul audit"
  - "customize agent"
  - "who am I"
  - "set up identity"
  - "change my agent's personality"
tools:
  - put_page
mutating: true
---

# 灵魂审计 — 代理身份构建器

通过交互式访谈生成代理的身份和操作配置。每个阶段生成一个文件。任何阶段都可以独立重新运行以更新。

**重要提示：** 本技能从**用户自己的回答**生成内容。它**绝不**
提供预填充的内容。 `templates/`中的模板是脚手架，不是默认值。

## 契约

本技能保证：
- SOUL.md从用户对代理身份、氛围、使命的描述生成
- USER.md从用户的自我描述生成（角色、项目、关键人物）
- ACCESS_POLICY.md通过可配置的访问层级生成
- HEARTBEAT.md通过用户选择的操作节奏生成
- 每个阶段是独立的且可重新运行
- 默认模式（跳过灵魂审计）：从`templates/`安装最小模板

## 阶段

### 阶段1：身份访谈
询问："这个代理对你来说是什么？研究伙伴？行政助理？思考伙伴？以上所有？"
生成：SOUL.md身份部分。

### 阶段2：氛围校准
展示3-4个沟通风格示例：
- **正式：** "我已准备了对情况的全面分析..."
- **直接：** "这是正在发生的事情。三件事很重要。"
- **技术：** "根本原因在于连接池。这是修复方法。"
- **随意：** "是的，所以基本上这个东西坏了，因为X。简单修复。"

询问哪个感觉对。生成：SOUL.md氛围+沟通风格部分。

### 阶段3：使命映射
询问："你的前3-5个目标是什么？你想要完成什么？"
生成：SOUL.md使命+操作原则部分。

### 阶段4：用户配置文件
询问："告诉我关于你自己。你是做什么的？你在做什么？你世界中的关键人物是谁？"
生成：带有角色、项目、关键人物、沟通偏好的USER.md。

### 阶段5：边界
询问："谁应该有权访问你的brain？是否有人应该看到部分但不是全部？有人要完全排除？"
生成：带有4个层级（Full/Work/Family/None）的ACCESS_POLICY.md。

### 阶段6：操作节奏
询问："代理应该多久检查一次？早晨简报？一天结束摘要？你想要什么定期工作？"
生成：带有操作节奏的HEARTBEAT.md。

## 默认模式（跳过灵魂审计）

如果用户在首次启动时跳过灵魂审计：
- 安装`templates/SOUL.md.template`作为SOUL.md（最小："具有持久内存的知识优先代理"）
- 安装`templates/USER.md.template`作为USER.md（从git配置自动填充姓名/电子邮件）
- 安装`templates/ACCESS_POLICY.md.template`作为ACCESS_POLICY.md（仅所有者访问）
- 安装`templates/HEARTBEAT.md.template`作为HEARTBEAT.md（默认节奏）

## 输出格式

生成/更新四个文件。报告："灵魂审计完成：SOUL.md、USER.md、
ACCESS_POLICY.md、HEARTBEAT.md已创建。随时重新运行任何阶段以更新。"

## 反模式

- 提供预填充的SOUL.md或USER.md内容（违反隐私）
- 在首次启动时强制进行灵魂审计（高摩擦，可选更好）
- 一次性询问所有6个阶段（压倒性，每个是独立的）
- 不提供重新运行单个阶段的选项
