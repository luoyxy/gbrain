---
name: publish
description: 将脑页面分享为精美的密码保护HTML，无需LLM调用
triggers:
  - "分享此页面"
  - "发布页面"
  - "创建可分享链接"
tools:
  - get_page
  - search
mutating: false
---

# 发布技能

将脑页面分享为精美的、自包含的HTML文档。可选使用客户端AES-256-GCM加密。无需服务器。

这是一个**代码+技能组合**：确定性代码（`gbrain publish`）负责剥离、加密和HTML生成。本技能告诉你何时以及如何使用它。参见[薄 harness，厚技能](https://x.com/garrytan/status/2042925773300908103)了解架构理念。

## 契约

- 发布的HTML完全自包含：无外部依赖，无需服务器。
- 所有私有元数据（frontmatter、来源引用、确认号、脑交叉链接、时间线）在发布前被剥离。
- 密码保护使用带PBKDF2密钥派生的AES-256-GCM；明文不会出现在加密的HTML文件中。
- 除非用户明确要求"开放"、"无密码"或"公开"，否则默认始终加密。
- 外部URL（`https://...`）被保留；仅剥离内部脑路径。

## 何时发布

- 用户要求分享脑页面、创建可分享链接，或说"给我一个页面"
- 用户想要将交易备忘录、人物简报或研究发送给外部人员
- 用户要求发布数据室分析或行程计划
- 任何需要让脑内容离开脑系统而不暴露整个系统的情况

## 默认：始终加密

脑内容是私密的。除非用户明确说"开放"、"无密码"或"公开"，否则默认使用密码保护。

如果未指定密码，自动生成一个。通过不同于URL的渠道分享密码。

## 快速参考

```bash
# 基本发布（输出本地HTML文件）
gbrain publish brain/companies/acme.md

# 密码保护（自动生成密码）
gbrain publish brain/companies/acme.md --password

# 密码保护（指定密码）
gbrain publish brain/companies/acme.md --password "secret123"

# 自定义标题
gbrain publish brain/companies/acme.md --password --title "Acme -- 交易分析"

# 自定义输出路径
gbrain publish brain/companies/acme.md --out /tmp/acme-share.html
```

## 被剥离的内容

发布命令自动移除所有私密/内部数据：

| 被剥离的内容 | 示例 | 原因 |
|---------|---------|-----|
| YAML frontmatter | `title:`, `type:`, `tags:` | 内部元数据 |
| `[Source: ...]` 引用 | 所有格式 | 来源是内部的 |
| 确认号 | `ABC123DEF` -> "on file" | PII/预订数据 |
| 脑交叉链接 | `[Jane](../people/jane.md)` -> `Jane` | 内部路径 |
| 时间线部分 | `---` / `## Timeline` 下方的所有内容 | 原始证据日志 |
| "另见"行 | 内部引用 | 脑导航 |

**保留的：** 外部URL（`https://...`）、所有其他内容。

## 分享工作流

### 选项A：本地文件（最简单）

```bash
gbrain publish brain/people/jane-doe.md --password --out ~/Desktop/jane-briefing.html
```

通过电子邮件、Slack、Airdrop分享HTML文件。单独分享密码。

### 选项B：上传到云存储

```bash
# 先本地发布
gbrain publish brain/companies/acme.md --password "secret" --out /tmp/acme.html

# 上传到Supabase Storage
gbrain files upload /tmp/acme.html --page shares/acme

# 获取签名URL（1小时有效期）
gbrain files signed-url shares/acme/acme.html
```

分享签名URL + 密码。URL在1小时后过期。根据需要重新生成。

### 选项C：静态托管（Render、Netlify、S3）

将HTML文件上传到任何静态托管服务。文件是自包含的，不需要服务器逻辑。受密码保护的文件通过Web Crypto API完全在客户端工作。

### 选项D：GitHub Pages / Gist

```bash
gbrain publish brain/trips/japan-2026.md --out trip.html
# 上传到GitHub Gist或Pages仓库
```

## 密码保护详情

- **算法：** AES-256-GCM
- **密钥派生：** PBKDF2，10万次迭代，SHA-256
- **盐：** 每次加密随机16字节
- **IV：** 每次加密随机12字节
- **解密：** 通过Web Crypto API（SubtleCrypto）在客户端进行
- **无需服务器认证** -- HTML文件是自包含的
- **"在此设备上记住"** -- 在localStorage中保存密码

加密时，发布的HTML仅包含密文。明文中不包含在文件中的任何位置。

## 更新已发布的页面

使用相同的输出路径重新运行发布命令：
```bash
gbrain publish brain/companies/acme.md --password "same-password" --out shares/acme.html
```

相同文件，相同URL（如果托管），更新的内容。

## 撤销访问

删除文件。如果使用签名URL，URL会自动过期（1小时）。如果使用静态托管，从主机中删除文件。

## 反模式

- **无加密发布。** 脑内容是私密的。除非用户明确说"开放"、"无密码"或"公开"，否则默认使用密码保护。
- **在同一渠道分享密码和URL。** 为了安全，始终通过不同于URL的渠道分享密码。
- **假设用户想要原始markdown。** 发布命令生成精美的HTML。当`gbrain publish`存在时，不要复制粘贴markdown。
- **包含内部元数据。** 永远不要手动分享包含frontmatter、来源引用或时间线部分的内容。让发布命令剥离它。

## 输出格式

```
已发布: [页面标题]
========================

文件: [输出路径]
加密: [是 (AES-256-GCM) / 否]
密码: [自动生成的密码 / 用户提供的 / 无]
大小: [文件大小]

通过以下方式分享文件: [电子邮件 / Slack / Airdrop / 云上传]
通过以下方式分享密码: [不同的渠道]
```

## 使用的工具

- `gbrain publish` -- 确定性HTML生成（无LLM调用）
- `gbrain files upload` -- 上传到云存储（可选）
- `gbrain files signed-url` -- 生成访问链接（可选）
