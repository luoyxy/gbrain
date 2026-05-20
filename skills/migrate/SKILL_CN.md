---
name: migrate
description: 来自 Obsidian、Notion、Logseq、markdown、CSV、JSON、Roam 的通用迁移
  到 GBrain。
triggers:
  - "migrate from"
  - "import from obsidian"
  - "import from notion"
tools:
  - put_page
  - search
  - add_link
  - add_tag
  - sync_brain
mutating: true
---

# 迁移技能#

来自任何 wiki、笔记工具或大脑系统的通用迁移到 GBrain。

## 合约#

- 源数据从不被修改或删除；迁移仅是附加的。
- 每个迁移的页面都通过读取回 gbrain 并抽查进行验证。
- 源系统中的交叉引用（wikilinks、块引用、标签）被转换为 gbrain 等效项。
- 在批量执行之前，在样本（5-10 个文件）上测试迁移。
- 迁移后健康检查确认页面计数、链接完整性和嵌入覆盖。

## 支持的源#

| 源 | 格式 | 策略 |
|--------|--------|----------|
| Obsidian | Markdown + `[[wikilinks]]` | 直接导入，将 wikilinks 转换为 gbrain 链接 |
| Notion | 导出的 Markdown 或 CSV | 解析 Notion 的导出结构 |
| Logseq | 带有 `((块引用))` 的 Markdown | 将块引用转换为页面链接 |
| 纯 markdown | 任何 .md 目录 | 直接将目录导入 gbrain |
| CSV | 表格数据 | 将列映射到 frontmatter 字段 |
| JSON | 结构化数据 | 将键映射到页面字段 |
| Roam | JSON 导出 | 将块结构转换为页面 |

## 阶段#

1. **评估源。** 什么格式？多少文件？什么结构？#
2. **规划映射。** 源字段如何映射到 gbrain 字段（类型、标题、标签、编译真相、时间线）？#
3. **用样本测试。** 导入 5-10 个文件，通过从 gbrain 读取它们并导出以验证。#
4. **批量导入。** 将完整目录导入 gbrain。#
5. **验证。** 检查 gbrain 健康状况和统计数据，抽查页面。#
6. **构建链接。** 从内容中提取交叉引用并创建 gbrain 中的类型化链接。#

## Obsidian 迁移#

1. 将 vault 目录导入 gbrain（Obsidian vault 是 markdown 目录）#
2. 使用原生 wikilink 支持连接图（v0.12.1+）：#
   ```bash
   gbrain extract links --source db --dry-run | head -20    # 预览
   gbrain extract links --source db                         # 提交
   ```
#
   `extract links` 原生解析 `[[相对/路径]]` 和 `[[相对/路径\|显示文本]]`#
   以及标准 `[文本](页面.md)` markdown 语法。祖先搜索解析处理#
   作者省略一个或多个前导 `../` 前缀的 wiki KB。`.md` 后缀是#
   为 wikilinks 自动推断的。

Obsidian 特定的：#
- 标签（`#tag`）成为 gbrain 标签#
- Frontmatter 属性映射到 gbrain frontmatter#
- 附件（图像、PDF）被注意但通过文件存储单独处理#

## Notion 迁移#

1. 从 Notion 导出：设置 > 导出 > Markdown & CSV#
2. Notion 使用 UUID 在文件名中导出嵌套目录#
3. 从文件名中去除 UUID 以获得干净的 slug#
4. 将 Notion 的数据库属性映射到 frontmatter#
5. 将清理后的目录导入 gbrain#

## CSV 迁移#

对于表格数据（例如，CRM 导出、联系人列表）：#
1. 对于 CSV 中的每一行，使用列值作为 frontmatter 创建页面#
2. 使用指定的列作为 slug（例如，姓名）#
3. 使用另一列作为编译真相（例如，笔记）#
4. 在 gbrain 中存储每个页面#
5. 从相关字段中提取实体#

## 验证#

任何迁移后：#
1. 检查 gbrain 统计数据以验证页面计数与源匹配#
2. 检查 gbrain 健康状况以查找孤立页面和缺失的嵌入#
3. 从 gbrain 导出页面以进行往返验证#
4. 抽查 5-10 个页面以验证映射正确性#

## 报告存储#

迁移后，保存报告：#
- 处理的实体数#
- 新页面创建 vs 现有更新#
- 数据源和结果质量#
- 显著发现或矛盾#
- 验证标志或 API 失败#

这为随时间的大脑迁移创建了审计线索。

## 反模式#

- **在没有样本测试的情况下批量导入。** 首先在 3-5 个项目上测试。清理#
   数百个坏页面的成本巨大。#
- **销毁源数据。** 迁移是附加的。永远不要修改、移动或#
   删除源文件。#
- **忽略交叉引用。** Wikilinks、块引用和标签必须#
   转换为 gbrain 等效项。丢弃它们会丢失知识图谱。#
- **在没有验证的情况下跳过健康检查。** 每个维度都必须检查并报告，即使#
   干净。#
- **创建没有内容的页面。** 每个迁移的页面都必须有来自#
   源的有意义内容。#

## 输出格式#

迁移报告遵循此结构：

```
迁移报告 — YYYY-MM-DD
=========================

维度           | 发现问题 | 已修复 | 剩余 |
|----------------------|-------------|-------|-----------|
 页面计数          | N           | N     | N         |
| 孤立页面         | N           | N     | N         |
| 死链接           | N           | N     | N         |
| 缺失交叉引用   | N           | N     | N         |
| 反向链接违规 | N           | N     | N         |
| 引用差距        | N           | N     | N         |
| 归档违规    | N           | N     | N         |
| 标签不一致  | N           | N     | N         |
| 嵌入过时性  | N           | N     | N         |
| 安全（RLS）       | N           | N     | N         |
| 架构健康        | N           | N     | N         |
| 文件存储         | N           | N     | N         |
| 开放线程         | N           | N     | N         |

### 详情#

[每维度细分，带有具体页面和采取的措施]

### 基准结果（如果运行）#

[层 1-4 查询结果，带有通过/失败]

### 突出问题#

[需要用户注意或确认的项目]
```

## 工具使用#

- 在 gbrain 中存储/更新页面（put_page）#
- 按过滤器在 gbrain 中列出页面（list_pages）#
- 从 gbrain 读取页面（get_page）#
- 检查 gbrain 中的反向链接（get_backlinks）#
- 在 gbrain 中链接实体（add_link）#
- 在 gbrain 中移除链接（remove_link）#
- 在 gbrain 中标记页面（add_tag）#
- 在 gbrain 中移除标签（remove_tag）#
- 查看 gbrain 中的时间线（get_timeline）#
- 检查 gbrain 健康状况（get_health）#
