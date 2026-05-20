# 在现有大脑上切换嵌入模型或维度

GBrain 在 `content_chunks` 上的固定维度 `vector(N)` 列中存储嵌入。如果你切换到具有不同维度的模型（例如，`text-embedding-3-large` 1536 → `voyage-multilingual-large-2` 2048，或回到较小的模型如 `nomic-embed-text` 768），磁盘上的列类型不会自动更改。

`gbrain init` 和 `gbrain doctor` 都会检测并拒绝在这种情况下静默继续。本文档是它们指向的配方。

## 为什么我们不自动执行此操作

切换维度需要：

1. 丢弃 HNSW 向量索引（pgvector 无法在 `ALTER COLUMN TYPE` 后存活）。
2. 更改列类型。
3. 清除每个现有嵌入（旧向量在新空间中无法使用）。
4. 重新嵌入整个语料库（在 50K 页面的大脑上可能需要数小时，并根据模型花费 $1-100 的 API 调用）。
5. 有条件地重新创建索引（HNSW 在每个 pgvector 上最多支持 2000 个维度；在此之上，你必须使用精确扫描）。

这不是升级时自动运行的操作。这是一个深思熟虑的、昂贵的操作。当你决定实际想要新模型时运行它。

## 配方 —— 针对你的大脑手动执行 `psql`

将 `<NEW_DIMS>` 替换为你的目标维度计数。

```sql
BEGIN;

-- 1. 丢弃 HNSW 索引。它无法在列类型更改后存活。
DROP INDEX IF EXISTS idx_chunks_embedding;

-- 2. 更改列类型。（如果现有数据已经消失，你可以 DROP COLUMN + ADD COLUMN
--    来代替——相同的最终状态。）
ALTER TABLE content_chunks ALTER COLUMN embedding TYPE vector(<NEW_DIMS>);

-- 3. 清除过时嵌入，使其不会存活到新空间中。
--    要么截断（更快，丢弃所有块），要么清空（保留
--    块文本以便重新嵌入重新生成而无需重新分块）：
UPDATE content_chunks SET embedding = NULL, embedded_at = NULL;

-- 4. 仅当 dims <= 2000 时重新创建 HNSW 索引。在此之上，将其保留为
--    无索引并依赖精确扫描（gbrain searchVector 自动处理此
--    问题——搜索只会变慢，不会损坏）。
--    对于 dims <= 2000（例如，1024、1536、768）：
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
  ON content_chunks USING hnsw (embedding vector_cosine_ops);
-- 对于 dims > 2000（例如，2048 Voyage 4 Large）：跳过步骤 4。

COMMIT;
```

然后更新 gbrain 的配置，以便它知道新维度：

```bash
gbrain config set embedding_model <model>
gbrain config set embedding_dimensions <NEW_DIMS>
```

并重新嵌入语料库：

```bash
gbrain embed --stale
```

## PGLite（本地大脑）

相同配方，但你以不同方式连接到嵌入式数据库：

```bash
gbrain config get database_url   # 确认引擎：pglite
# 打开 psql 等效项 —— 对于 PGLite，最简单的路径是编写一个小
# 脚本，导入 PGLiteEngine 并通过 engine.executeRaw 运行 SQL。
# 或者暂时迁移到 Postgres（如果你想
# 拥有真实的 psql 连接，则使用 `gbrain migrate --to supabase`）。
```

对于大多数 PGLite 用户，如果语料库足够小，重新同步比手工制作迁移更快，则更简单的路径是**擦除并重新初始化**：

```bash
mv ~/.gbrain/brain.pglite ~/.gbrain/brain.pglite.bak
gbrain init --pglite --embedding-dimensions <NEW_DIMS>
gbrain sync   # 从磁盘重新导入你的大脑仓库
```

## 验证

配方落地后，`gbrain doctor --fast` 应该报告绿色，并且 `gbrain doctor`（完整）应该说检查 8b 通过：

```
✓ embedding_provider     dim parity: config 768 / column vector(768) / live probe 768
```

如果没有，请提交带有 doctor 输出和你运行的 SQL 的问题。

## v0.29+ 计划

`gbrain migrate-embedding-dim --to <N>` 是一个跟踪的 TODO。它将运行
上面的配方，并带有进度报告 + 显式确认
门。在那之前，此手动配方是规范路径。
