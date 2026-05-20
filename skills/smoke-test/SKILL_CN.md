---
name: smoke-test
description: |
  容器重启后的冒烟测试和自动修复，适用于gbrain和OpenClaw环境。
  测试关键服务，自动修复已知问题，可通过用户定义的
  ~/.gbrain/smoke-tests.d/*.sh中的测试脚本扩展。
triggers:
  - "smoke test"
  - "run smoke tests"
  - "container restart check"
  - "health check"
  - "did the restart break anything"
  - "did the container restart break anything"
tools:
  - exec
  - read
mutating: true
---

# 冒烟测试技能包

> 在任何容器重启后运行 `gbrain smoke-test` 或 `bash scripts/smoke-test.sh`。

## 契约

本技能保证：
- 8个核心测试验证重启后的gbrain + OpenClaw健康状况
- 已知失败在报告前自动修复
- 用户可通过 `~/.gbrain/smoke-tests.d/*.sh` 拖放脚本扩展
- 结果记录到 `/tmp/gbrain-smoke-test.log`
- 退出代码 = 未修复失败数（0 = 全部通过）

## 内置测试

| # | 测试 | 自动修复 |
|---|------|----------|
| 1 | Bun运行时 | 从bun.sh安装 |
| 2 | GBrain CLI加载 | 重装依赖 |
| 3 | GBrain数据库（doctor） | — |
| 4 | GBrain工作进程 | 启动工作进程 |
| 5 | OpenClaw Codex插件（Zod CJS） | `npm install zod@4 --force` |
| 6 | OpenClaw网关 | —（可能尚未启动）|
| 7 | 嵌入API密钥 | —（检查.env）|
| 8 | Brain仓库存在 | — |

## 用法

### CLI
```bash
gbrain smoke-test
```

### 直接
```bash
bash scripts/smoke-test.sh
```

### 从OpenClaw引导
添加到你的 `ensure-services.sh` 或等效文件：
```bash
bash /path/to/gbrain/scripts/smoke-test.sh >> /tmp/bootstrap.log 2>&1
```

### 从代理
```
exec: bash /data/gbrain/scripts/smoke-test.sh
```

## 添加自定义测试

在 `~/.gbrain/smoke-tests.d/` 中创建可执行脚本：

```bash
# ~/.gbrain/smoke-tests.d/check-redis.sh
#!/bin/bash
redis-cli ping | grep -q PONG
```

规则：
- 退出0 = 通过，非零 = 失败
- 文件名成为测试名称（例如，来自`check-redis.sh`的`check-redis`）
- 保持测试快速（每个< 10秒）
- 测试按字母顺序运行

## 添加内置测试

编辑 `scripts/smoke-test.sh`。遵循此模式：

```bash
# ── N. [服务名称] ──────────────────────────────────────
if [test condition]; then
  pass "[服务名称]"
else
  # 自动修复尝试
  [fix command]
  if [re-test condition]; then
    fixed "[修复了什么]"
    pass "[服务名称]（修复后）"
  else
    fail "[服务名称] — [错误详情]"
  fi
fi
```

### 设计规则：
1. **先测试** — 绝不在未确认损坏的情况下修复
2. **修复后重新测试** — 验证修复有效
3. **所有命令设置超时** — 对任何可能挂起的命令使用`timeout N`
4. **使用辅助函数** — `pass()`、`fail()`、`fixed()`、`skip()`
5. **幂等修复** — 安全重复运行
6. **优雅跳过** — 缺少前置条件时使用`skip()`，不要失败

## 环境变量

| 变量 | 默认值 | 描述 |
|-----|---------|-------------|
| `GBRAIN_SMOKE_LOG` | `/tmp/gbrain-smoke-test.log` | 日志文件路径 |
| `GBRAIN_DIR_OVERRIDE` | （自动检测） | 强制gbrain安装路径 |
| `GBRAIN_DATABASE_URL` | （来自.env） | 数据库连接URL |
| `OPENCLAW_GATEWAY_PORT` | `18789` | 要测试的网关端口 |
| `GBRAIN_BRAIN_PATH` | `/data/brain` | Brain仓库路径 |

## 已知问题及其自动修复

### Codex Zod core.cjs缺失（发现于2026-04-23）
- **症状：** `Cannot find module './core.cjs'` → 所有Codex ACP会话失败
- **原因：** Zod v4 npm包在某些安装中不包含`core.cjs`
- **自动修复：** 在codex扩展的zod目录中执行`npm install zod@4 --force`
- **持久性：** 不会在容器重启后保持（网关重装依赖）
- 这就是为什么冒烟测试必须在每次重启时运行

### GBrain工作进程认证失败
- **症状：** 工作进程无法连接到数据库
- **原因：** `GBRAIN_DATABASE_URL`未传播到工作子进程
- **自动修复：** 脚本显式传递`DATABASE_URL`和`GBRAIN_DATABASE_URL`

## 反模式

- ❌ 在每次聊天轮次运行冒烟测试。每次容器重启运行一次（或
  按用户请求）就足够了。脚本很便宜但不是免费的。
- ❌ 编写用户拖放脚本时，对任何可能
  挂起的命令不使用`timeout N`。单个挂起的拖放脚本会延迟后续每次运行。
- ❌ 在确认检查确实首先损坏之前自动修复。
  `pass → fail-detected → fix → re-test`循环是契约；跳过重新测试的修复
  可能会在仍然损坏的状态下报告成功。
- ❌ 将`skip`视为`fail`。缺少前置条件（未安装OpenClaw、
  未配置brain仓库）是跳过，不是失败。退出代码 = 
  真实失败计数，不是跳过的检查。
- ❌ 在用户拖放脚本中硬编码路径。读取环境变量
  （`GBRAIN_DATABASE_URL`、`HOME`等），以便脚本在
  容器重建之间迁移。

## 输出格式

脚本为每个检查向stdout写入一行状态（✅/❌/🧰/⏭️），加上
最后的摘要行：`Results: N/M passed, F auto-fixed, S skipped`。
结构化的带时间戳日志附加到`$GBRAIN_SMOKE_LOG`
（默认为`/tmp/gbrain-smoke-test.log`）以供运行后取证。退出代码
等于未修复失败的计数（0 = 全部通过，正整数 =
剩余失败计数）。
