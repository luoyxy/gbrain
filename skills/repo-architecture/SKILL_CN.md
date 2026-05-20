---
name: repo-architecture
version: 1.0.0
description: |
  新脑文件的存放位置。按主要主题而不是格式或来源归档的决策协议。
  所有脑写入技能的参考。
triggers:
  - "这放在哪里"
  - "归档规则"
  - "创建新页面"
  - "哪个目录"
tools:
  - search
  - get_page
  - list_pages
mutating: false
---

# 仓库架构 — 归档规则

> **完整归档规则：** 参见 `skills/_brain-filing-rules.md`

## 契约

本技能保证：
- 每个新页面按主要主题归档（不是格式，不是来源）
- 对模糊情况遵循决策协议
- 捕获常见的错误归档模式

## 阶段

1. **确定主要主题。** 你会搜索什么来找到这个页面？
2. **遍历决策树：**
   - 关于一个人 → `people/{name-slug}.md`
   - 关于一家公司 → `companies/{name-slug}.md`
   - 可重用的概念/框架 → `concepts/{slug}.md`
   - 原始想法 → `originals/{slug}.md`
   - 会议 → `meetings/{slug}.md`
   - 媒体内容 → `media/{type}/{slug}.md`
   - 原始数据导入 → `sources/{slug}.md`
3. **交叉链接。** 从相关目录链接。
4. **检查显著性。** 参见 `skills/conventions/quality.md` 显著性门控。

## 输出格式

建议："将此文件归档在 `{type}/{slug}.md`，因为主要主题是 {reason}。"

## 反模式

- 按格式归档（"它是PDF所以放在sources/"）
- 按来源归档（"它来自电子邮件所以放在sources/"）
- 创建页面时不检查是否已存在
- 除原始数据转储外，使用`sources/`
