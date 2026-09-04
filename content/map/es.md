---
title: Elasticsearch（ES）
order: 3
---

## 1. 它是什么

Elasticsearch 是一个基于 Apache Lucene 构建的分布式搜索与分析引擎（Distributed Search and Analytics Engine），同时具备可扩展数据存储和向量数据库能力。它能够索引结构化、非结构化、时序、地理空间和向量数据，并提供近实时搜索与聚合分析。

通俗来说，Elasticsearch 会在数据写入时提前构建适合查询的数据结构，使系统不必在每次搜索时扫描所有原始数据。

它主要解决以下问题：

- 全文检索、相关性排序和模糊匹配。
- 多条件过滤、排序和分页。
- 大规模聚合分析。
- 日志、指标和安全事件的近实时检索。
- 地理空间搜索。
- 向量搜索、语义搜索与混合检索。
- 将索引和查询负载分布到多个节点。

常见使用场景包括：

- 网站、商品、文档和企业知识库搜索。
- 日志检索与可观测性分析。
- 安全事件分析。
- 实时运营指标和数据看板。
- 地理位置搜索。
- RAG 系统中的文档检索。
- 结构化检索、全文检索与向量检索的组合。

Elasticsearch 不适合直接替代：

- 需要复杂多表事务和外键约束的关系型数据库。
- 强调精确账务一致性的核心交易数据库。
- 大文件或二进制对象存储。
- 离线批处理计算平台。
- 所有数据的唯一备份。

在很多系统中，关系型数据库仍是事实来源（System of Record），Elasticsearch 保存为搜索优化后的派生数据。数据通过应用双写、消息队列或变更数据捕获（Change Data Capture，CDC）同步到 Elasticsearch。

官方将 Elasticsearch 定义为分布式搜索与分析引擎、可扩展数据存储和向量数据库。[Elasticsearch 官方参考文档](https://www.elastic.co/guide/en/elasticsearch/reference/current/)

## 2. 最小工作模型

理解 Elasticsearch，首先只需要六个对象：

- 客户端（Client）：通过 REST API 或语言客户端发送请求。
- 节点（Node）：一个运行中的 Elasticsearch 实例。
- 集群（Cluster）：协同工作的一个或多个 Node。
- 索引（Index）：逻辑上的文档集合。
- 分片（Shard）：Index 的物理分片。
- 文档（Document）：写入和查询的基本业务对象。

```text
Client
  │ HTTP / REST API
  ▼
Coordinating Node
  ├── 路由写入请求 ──> Primary Shard ──> Replica Shard
  │
  └── 分发搜索请求 ──> Shard 0 ─┐
                      Shard 1 ─┼─> 合并结果 ──> Client
                      Shard 2 ─┘

Master-eligible Nodes
  └── 管理 Cluster State、节点成员和 Shard Allocation
```

任何节点都能接收客户端请求，并为该请求充当协调节点（Coordinating Node）。协调节点本身不一定保存目标数据，它负责找到相关 Shard、转发请求、汇总结果并返回客户端。

每个 Shard 本质上都是一个独立的 Lucene Index。Elasticsearch 在 Lucene 之上增加了集群管理、数据分片、副本、REST API、Mapping、聚合和生命周期管理等能力。

## 3. 核心数据模型与组成部分

### 3.1 Document、Field 与 Index

文档（Document）是 Elasticsearch 存储和索引的基本业务对象，通常以 JSON 形式提交。文档由多个字段（Field）组成，并在一个 Index 中通过 `_id` 标识。

```json
{
  "title": "Kafka 入门指南",
  "category": "technology",
  "price": 49.0,
  "published_at": "2026-09-01",
  "tags": ["Kafka", "消息系统"]
}
```

索引（Index）是具有相似结构和查询目的的一组 Document。通俗来说，它有点像数据库中的表，但两者并不完全等价：

- Index 会被拆分成多个 Shard。
- Field 可能同时拥有多种索引表示。
- Elasticsearch 不提供传统关系数据库中的外键和跨表 Join 模型。
- Mapping 和倒排索引比“表结构”更能体现其搜索引擎属性。

### 3.2 Mapping 与字段类型

映射（Mapping）定义 Document 中各个 Field 的数据类型及其索引方式。它决定一个字段是全文检索、精确匹配、排序、聚合、日期运算，还是向量检索。

常见字段类型包括：

| 类型 | 主要用途 | 是否有倒排索引 | 典型查询 |
|---|---|---|---|
| `text` | 全文检索 | ✅ 有，分词后建立倒排索引 | `match`、`match_phrase` |
| `keyword` | 精确值检索 | ✅ 有，不分词，整个值作为 term | `term`、过滤、排序、聚合 |
| 数值类型 | 数值范围和统计分析 | ❌ 不是传统倒排索引，主要用 BKD Tree | `range`、聚合 |
| `date` | 时间过滤和时间聚合 | ❌ 不是传统倒排索引，主要用 BKD Tree | 时间范围、日期直方图 |
| `boolean` | 布尔条件 | ✅ 可建立 term 索引 | `term`、过滤 |
| `object` | 普通嵌套 JSON 对象 | ❌ 对象本身没有；其子字段各自决定 | 按子字段查询 |
| `nested` | 保持对象数组的独立关系 | ❌ `nested` 本身不是倒排索引类型；内部字段各自决定 | `nested` query |
| `geo_point` | 经纬度位置 | ❌ 使用专门的地理空间索引结构 | 距离、范围查询 |
| `dense_vector` | 稠密向量 | ❌ 使用向量索引，如 HNSW | kNN、相似度检索 |

Elasticsearch 可以通过动态映射（Dynamic Mapping）自动推断字段类型，但生产系统通常应使用显式 Mapping 或 Index Template，防止日期、数值和字符串被错误识别，也避免无限动态字段造成映射膨胀（Mapping Explosion）。

某些 Mapping 变更无法直接应用到既有字段。例如，通常不能把一个已经建立索引的字段从 `text` 原地改成 `date`。这类变更一般需要创建新 Index 并重新索引（Reindex）。

### 3.3 Analyzer 与倒排索引

分析器（Analyzer）是把文本转换成可检索词项（Term）的组件，通常由字符过滤器、分词器和词元过滤器组成。

例如：

```text
原文：The QUICK Brown-Fox
        │ Analyzer
        ▼
词项：[the, quick, brown, fox]
```

索引时分析器（Index Analyzer）处理写入文本；搜索时分析器（Search Analyzer）处理用户查询。二者通常需要产生兼容的 Term，否则用户输入可能无法匹配已建立的索引。[Analyzer 官方文档](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/analyzer)

倒排索引（Inverted Index）是一种从 Term 映射到包含该 Term 的 Document 的数据结构：

```text
kafka   → Document 1, Document 7
search  → Document 2, Document 4, Document 7
```

通俗来说，普通阅读是“打开文档找词”，倒排索引则是“先查词，再找到包含它的文档”。

倒排索引主要负责全文搜索和部分精确查询。它是 Elasticsearch 能够快速搜索大量文本的核心原因之一。

### 3.4 `_source`、Inverted Index 与 Doc Values

`_source` 是 Elasticsearch 保存的原始 JSON 文档表示，通常用于返回搜索结果、执行更新和重新索引。

倒排索引用于“根据值找文档”，适合搜索和过滤。

文档值（Doc Values）是索引时构建的磁盘列式数据结构，适合“根据文档读取字段值”，主要用于排序、聚合和脚本计算。

```text
_source:
  Document → 原始 JSON

Inverted Index:
  Term → Documents

Doc Values:
  Document → Field Values（列式组织）
```

同一字段可能同时占用 `_source`、倒排索引和 Doc Values 空间。这也是 Elasticsearch 磁盘占用可能明显大于原始 JSON 的原因之一。[Doc Values 官方文档](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/doc-values)

### 3.5 Shard 与 Replica

主分片（Primary Shard）保存 Index 的一部分 Document，并作为该分片组写入操作的入口。

副本分片（Replica Shard）是 Primary Shard 的副本。它用于：

- 在 Primary 所在节点故障时接替服务。
- 分担搜索和按 ID 读取请求。
- 提高数据可用性。

一个 Index 包含固定数量的 Primary Shard，并可为每个 Primary 配置若干 Replica：

```text
Index: products

Primary Shard 0 ── Replica 0
Primary Shard 1 ── Replica 1
Primary Shard 2 ── Replica 2
```

Primary Shard 保存不同的数据分片；Replica Shard 保存相同数据的副本。二者分别解决水平拆分与数据冗余问题。

## 4. 一次写入与搜索如何执行

### 4.1 一次文档写入

一次典型索引操作按照下面的顺序发生：

```text
Client
  → Coordinating Node
  → 可选 Ingest Pipeline
  → Routing 计算目标 Shard
  → Primary Shard 校验并执行
  → 并行转发给 In-Sync Replica
  → 满足确认条件
  → 返回写入结果
  → Refresh 后可被 Search 看见
```

1. Client 把 JSON 文档发送给任意 Node。
2. 接收请求的节点成为该请求的 Coordinating Node。
3. 如果配置了摄取管道（Ingest Pipeline），文档会先经过转换、清洗或富化。
4. 路由（Routing）根据 `_routing` 计算目标 Primary Shard；默认 `_routing` 通常使用文档 `_id`。
5. 请求被转发到目标 Primary Shard。
6. Primary 验证 Mapping、权限和操作合法性，为操作分配序列号并执行本地索引。
7. Primary 将操作并行发送给同步副本。
8. 满足复制和持久化条件后，Elasticsearch 向 Client 返回结果。
9. 后续 Refresh 会使新版本对 Search API 可见。

Elasticsearch 的数据复制采用主备模型（Primary-Backup Model）。Primary 负责验证和排序写入，再把操作复制到 Replica。[Reading and Writing Documents](https://www.elastic.co/docs/deploy-manage/distributed-architecture/reading-and-writing-documents)

### 4.2 Routing 如何定位 Shard

路由值（Routing Value）决定 Document 属于哪个 Primary Shard。默认使用 `_id`，也可以显式指定业务 Routing。

概念上可以理解为：

```text
target_shard = hash(routing_value) mod number_of_primary_shards
```

相同 Routing Value 会定位到同一个 Shard。自定义 Routing 可以减少查询需要访问的 Shard 数，但也可能造成数据倾斜和热分片。

使用自定义 Routing 后，读取、更新、删除和搜索通常都必须提供相同的 Routing Value，否则可能找不到文档，甚至在不同 Shard 中写出相同 `_id` 的多份文档。[`_routing` 官方文档](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/mapping-routing-field)

### 4.3 一次搜索请求

默认搜索通常经历 Query Phase 和 Fetch Phase：

```text
Client
  → Coordinating Node
  → 解析 Query DSL 和目标 Index
  → Scatter：向每个相关 Shard 的一个副本发送查询
  → 各 Shard 本地查询并返回候选结果
  → Gather：协调节点合并、排序、归并聚合
  → Fetch：向命中的 Shard 获取最终文档
  → 返回统一响应
```

查询阶段（Query Phase）中，每个 Shard 独立搜索自己的 Lucene Index，返回局部高分文档标识、分数、排序值和聚合中间结果。

获取阶段（Fetch Phase）中，Coordinating Node 确定全局最终命中文档后，再向对应 Shard 获取 `_source` 等结果内容。

这种分散—汇总（Scatter-Gather）模型使查询能够并行执行，但搜索涉及的 Shard 越多，网络、CPU、内存和尾延迟成本通常越高。

搜索请求可以从 Primary 或 Replica 中选择一个同步副本执行。默认的自适应副本选择（Adaptive Replica Selection）会参考历史响应时间、节点执行时间和搜索队列长度。[Search Shard Routing](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-shard-routing.html)

需要注意，部分搜索 API 在个别 Shard 失败时仍可能返回 HTTP `200 OK` 和部分结果。调用方应检查响应中的 `_shards.failed`、失败原因和 `timed_out`，不能只检查 HTTP 状态码。

### 4.4 Query、Filter 与相关性

查询上下文（Query Context）不仅判断文档是否匹配，还计算相关性分数（Relevance Score），适合全文搜索。

过滤上下文（Filter Context）只判断是否满足条件，不计算相关性，适合状态、类别、时间范围和权限条件。

```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "title": "distributed search" } }
      ],
      "filter": [
        { "term": { "status": "published" } },
        { "range": { "price": { "lte": 100 } } }
      ]
    }
  }
}
```

这里 `match` 负责文本相关性，`term` 和 `range` 负责精确筛选。

## 5. 数据生命周期与状态管理

### 5.1 Near Real-Time 与 Refresh

近实时搜索（Near Real-Time Search，NRT）表示写入成功的 Document 通常不会立即被 Search API 看见，而是在 Refresh 后可搜索。

刷新（Refresh）会把内存索引缓冲区中的数据写成新的 Lucene Segment，并打开新的搜索视图。它主要解决“何时能被搜索看见”，不是“何时持久化到磁盘”。

默认情况下，活跃 Index 通常会周期性 Refresh。强制每次写入立即 Refresh 会增加 Segment 数量和后台合并压力，因此不应把 `refresh=true` 当成常规高吞吐写入方式。[Near Real-Time Search](https://www.elastic.co/docs/manage-data/data-store/near-real-time-search)

需要区分：

- 写入 API 返回成功：写操作已满足确认与持久化要求。
- Search 能查到：相关操作已经过 Refresh。
- 按 `_id` 的实时 GET：可以在尚未 Refresh 时读取较新的文档版本。

### 5.2 Segment 与 Merge

段（Segment）是 Lucene 中不可变的索引文件集合。Refresh 会产生新 Segment；后续查询会同时搜索多个 Segment。

由于 Segment 不可变，更新和删除通常不会原地修改旧数据：

- 更新 Document：写入新版本，并把旧版本标记为删除。
- 删除 Document：在相关 Segment 中标记删除。
- 合并（Merge）：后台把多个较小 Segment 合并成较大 Segment，并真正清理已删除数据。

Segment Merge 会消耗磁盘 I/O、CPU 和临时磁盘空间。过于频繁的 Refresh、高更新率或大量小批次写入都可能增加 Merge 压力。

### 5.3 Translog 与 Flush

事务日志（Transaction Log，Translog）记录尚未安全包含在 Lucene Commit Point 中的索引操作，用于 Shard 异常重启后的恢复。

冲刷（Flush）会执行 Lucene Commit，并开启新的 Translog Generation。它主要控制恢复边界和 Translog 大小，不等同于 Refresh。

```text
写入操作
  ├── Indexing Buffer
  └── Translog

Refresh
  └── Buffer → 可搜索 Segment

Flush
  ├── Lucene Commit
  └── 新 Translog Generation
```

默认 `index.translog.durability=request` 时，Elasticsearch 在向客户端确认写请求前，会等待 Primary 和已分配 Replica 的 Translog 完成必要的 `fsync` 与提交。如果改为 `async`，则可能在崩溃时丢失上次同步后的已确认写入。[Translog 官方文档](https://www.elastic.co/docs/reference/elasticsearch/index-settings/translog)

### 5.4 Rollover、Data Stream 与 ILM

滚动（Rollover）是在当前写 Index 达到大小、文档数或年龄条件后创建新写 Index 的机制。它避免日志、指标等持续增长的数据永远写入一个超大 Index。

数据流（Data Stream）是面向追加型时序数据的一组隐藏后备索引（Backing Indices）的逻辑入口。写入进入当前 Write Index，查询可以覆盖整个 Data Stream。

索引生命周期管理（Index Lifecycle Management，ILM）根据策略自动管理 Index 或 Data Stream 的生命周期，常见阶段包括：

- Hot：持续写入并频繁查询。
- Warm：基本停止写入，但仍经常查询。
- Cold：较少查询，优先降低存储成本。
- Frozen：极少查询，允许更高访问延迟。
- Delete：删除已过保留期的数据。

ILM 可以执行 Rollover、迁移、Shrink、Force Merge、Searchable Snapshot 和 Delete 等动作。Elastic Cloud Serverless 使用更简化的数据流生命周期机制，而非传统 ILM。[Index Lifecycle Management](https://www.elastic.co/docs/manage-data/lifecycle/index-lifecycle-management)

## 6. 并发、可靠性与故障处理

### 6.1 乐观并发控制

乐观并发控制（Optimistic Concurrency Control，OCC）假设冲突并不频繁，更新时检查数据是否仍为读取时的版本，而不是提前长期加锁。

Elasticsearch 为每次操作分配：

- 序列号（Sequence Number，`_seq_no`）：Primary Shard 内递增的操作顺序。
- 主分片任期（Primary Term，`_primary_term`）：Primary 每次重新选举时变化的任期标识。

客户端可以在更新时携带 `if_seq_no` 和 `if_primary_term`。只有文档仍处于指定版本时更新才成功，否则返回冲突。

```text
Client A 读取：seq_no=10, primary_term=3
Client B 更新：文档变为 seq_no=11
Client A 携带 seq_no=10 更新
  → Version Conflict
```

这可以避免较旧更新覆盖较新结果，但业务仍需决定遇到冲突时是重读、合并、重试还是拒绝。[Optimistic Concurrency Control](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/optimistic-concurrency-control)

### 6.2 Primary、Replica 与同步副本

同一个 Primary Shard 及其 Replica Shard 构成复制组（Replication Group）。

同步副本集合（In-Sync Copies）是 Elasticsearch 认为应包含所有已确认写入的 Shard Copy 集合，由集群元数据维护。

写入时：

1. Primary 执行并验证操作。
2. Primary 将操作转发给 In-Sync Replica。
3. Replica 本地执行并回复。
4. 副本成功或被正式移出 In-Sync 集合后，Primary 才完成相应复制阶段。

当 Primary 所在 Node 故障时，Elected Master 可以把合格 Replica 提升为新的 Primary。缺少 Replica 时，相关 Shard 可能暂时不可用，或者在所有有效副本都丢失时发生数据损失。

Replica 必须部署在与 Primary 不同的 Node；单节点集群无法分配自己的 Replica。

### 6.3 Master-Eligible Node 与 Cluster State

主节点候选节点（Master-Eligible Node）能够参与集群选举和 Cluster State 提交。

当选主节点（Elected Master Node）负责：

- 跟踪集群中的 Node。
- 创建和删除 Index。
- 维护 Mapping 和 Index Settings。
- 决定 Shard Allocation。
- 管理 Primary 提升和 Replica 分配。
- 发布新的 Cluster State。

它不负责集中处理所有搜索和写入数据。把 Elected Master 称为“所有请求的主服务器”是不准确的；它主要负责控制面。

高可用集群通常至少配置三个 Master-Eligible Node。集群通过基于多数派的投票机制选举 Master 和提交 Cluster State，从而避免多个独立分区同时安全地修改集群状态。[Discovery and Cluster Formation](https://www.elastic.co/docs/deploy-manage/distributed-architecture/discovery-cluster-formation)

### 6.4 节点故障后的恢复

Data Node 故障后，Elasticsearch 通常执行：

```text
发现 Node 离开
  → Elected Master 更新 Cluster State
  → 将可用 Replica 提升为 Primary
  → 在其他 Node 分配新的 Replica
  → 从现有 Shard Copy 恢复数据
  → 集群逐步恢复 Green
```

恢复期间会产生磁盘和网络流量，搜索及写入性能可能下降。Elasticsearch 会自动执行大部分 Shard Recovery 和 Rebalancing，但运维人员仍需监控资源和未分配原因。

### 6.5 Cluster Health

集群健康状态（Cluster Health Status）根据 Shard Allocation 分为：

| 状态 | 含义 | 风险 |
|---|---|---|
| Green | 所有 Primary 和 Replica 均已分配 | 副本状态完整 |
| Yellow | 所有 Primary 可用，但存在未分配 Replica | 数据通常仍可访问，但冗余不足 |
| Red | 至少一个 Primary 未分配 | 部分数据和操作不可用 |

Yellow 不代表“完全正常”，Red 也不一定代表整个集群完全停止。实际影响取决于哪些 Index 和 Primary Shard 不可用。[Red or Yellow Cluster Health](https://www.elastic.co/docs/troubleshoot/elasticsearch/red-yellow-cluster-status)

### 6.6 Replica 不是 Backup

Snapshot 是 Elasticsearch 提供的时间点备份机制。Snapshot 将 Index、Data Stream 和可选 Cluster State 保存到集群之外的 Snapshot Repository。

Replica 主要解决在线节点故障，不能替代 Snapshot：

- 误删 Document 会同步到 Replica。
- 错误更新会同步到 Replica。
- 删除 Index 会影响其所有在线副本。
- 集群级故障可能同时影响 Primary 和 Replica。

Snapshot 可用于误删除恢复、灾难恢复和集群迁移。Snapshot Lifecycle Management（SLM）可以自动执行和清理 Snapshot。[Snapshot and Restore](https://www.elastic.co/docs/deploy-manage/tools/snapshot-and-restore)

## 7. 扩展与分布式机制

### 7.1 Primary Shard 实现数据拆分

一个 Index 的 Document 根据 Routing 分布到多个 Primary Shard：

```text
Index: logs
  ├── Primary Shard 0 → Node A
  ├── Primary Shard 1 → Node B
  ├── Primary Shard 2 → Node C
  └── Primary Shard 3 → Node D
```

不同 Shard 可以并行索引和查询，因此 Primary Shard 是数据容量与写入并行度的重要单位。

Primary Shard 数量通常在创建 Index 时确定，不能直接原地任意修改。调整方式包括：

- 创建新 Index 并 Reindex。
- 在满足约束时使用 Split API。
- 对只读 Index 使用 Shrink API。
- 通过 Rollover 为未来数据采用新的 Shard 配置。

Replica 数量则可以动态调整。

### 7.2 增加 Node 与 Shard Rebalancing

向 Cluster 增加 Data Node 后，Elasticsearch 会通过 Shard Allocation 和 Relocation 把部分 Shard Copy 移动到新 Node，并尝试平衡数据与负载。

这比单纯增加服务器更完整，但扩容不会立即带来全部性能收益：

- Shard Relocation 需要复制大量数据。
- 恢复过程消耗磁盘和网络资源。
- 如果只有一个热点 Shard，其单 Shard 写入能力仍可能是瓶颈。
- 过多的小 Shard 会增加 Cluster State、Heap 和调度开销。

[Clusters, Nodes, and Shards](https://www.elastic.co/docs/deploy-manage/distributed-architecture/clusters-nodes-shards)

### 7.3 Replica 的读写扩展差异

Replica 可以处理搜索和读取，因此增加 Replica 有机会提升读吞吐量。

但所有写操作仍必须先经过 Primary，并复制到 Replica，所以增加 Replica 会增加写入路径的 CPU、磁盘和网络开销。Replica 不是免费的写扩展机制。

可以概括为：

- 增加 Primary Shard：提高潜在写入和数据拆分并行度。
- 增加 Replica Shard：提高冗余和潜在读取并行度。
- 增加 Data Node：为 Shard 提供更多计算、内存和磁盘承载能力。

### 7.4 Over-Sharding 与 Hot Shard

过度分片（Over-Sharding）是创建大量过小 Shard，导致 Shard 管理成本超过并行收益。每个 Shard 都拥有 Lucene Segment、缓存、文件句柄和集群元数据开销。

热分片（Hot Shard）是流量或数据量远高于其他 Shard 的分片，常由 Routing 倾斜、数据分布不均或少量大客户造成。

因此 Shard 规划需要同时考虑：

- 数据总量及增长速度。
- 单个 Shard 大小。
- 写入吞吐。
- 查询并发。
- 聚合复杂度。
- 故障恢复时间。
- 节点数量和故障域。
- Rollover 策略。

## 8. 常见使用模式

### 8.1 应用全文搜索

```text
业务数据库
   │ CDC / Application Sync
   ▼
Elasticsearch
   │
   ├── Full-Text Search
   ├── Filter
   ├── Relevance Ranking
   └── Aggregation
```

Elasticsearch 提供索引、搜索和排序能力；数据库继续承担核心事务和约束；应用负责数据同步、Schema 演进和同步失败补偿。

### 8.2 日志与指标分析

```text
Application / Host
  → Elastic Agent / Beats / Logstash
  → Data Stream
  → Elasticsearch
  → Kibana
```

Elasticsearch 负责存储、检索和聚合；Agent、Beats 或 Logstash 负责采集和传输；Kibana 负责可视化和交互式分析。

Data Stream、Rollover 和 Lifecycle Management 共同控制持续增长的时序数据。

### 8.3 向量与混合检索

文档可以同时建立：

- `text` 字段的倒排索引。
- `keyword`、日期等结构化索引。
- `dense_vector` 字段的向量索引。

一次混合检索可以组合关键词相关性、向量相似度和业务过滤条件。Elasticsearch 提供检索和融合能力；Embedding 模型、文档切分、提示词和最终回答生成通常由外部 AI 应用负责。

## 9. 它为什么具有这些性能特点

### 9.1 倒排索引避免全文扫描

倒排索引提前建立 Term 到 Document 的映射，因此查询关键词时无需逐条扫描全部 `_source`。

代价是：

- 写入时需要执行文本分析和构建索引。
- 索引会占用额外磁盘。
- Mapping 或 Analyzer 选择不当时，往往需要 Reindex 才能彻底修正。

### 9.2 不可变 Segment

Lucene Segment 基本不可变，查询可以在无需复杂写锁的情况下并行读取稳定结构。

代价是更新与删除会产生旧版本和删除标记，需要后台 Merge 才能回收空间。高更新率数据不一定能发挥与追加型数据相同的效率。

### 9.3 Filesystem Cache

Elasticsearch 依赖操作系统文件系统缓存（Filesystem Cache）缓存热点索引页。常用倒排索引和 Doc Values 位于缓存时，搜索速度会显著优于频繁访问冷磁盘。

因此不能把所有内存都分配给 JVM Heap；系统还需要为 Filesystem Cache 保留空间。

### 9.4 Bulk 与并发写入

批量 API（Bulk API）允许在一个请求中提交多个 Index、Create、Update 或 Delete 操作，减少网络往返和请求管理开销。

多个写入线程可以利用不同 Shard 的并行能力，但并发过高会导致：

- 写入线程池排队。
- `429 Too Many Requests`。
- Heap 压力。
- Merge 和磁盘 I/O 饱和。
- 搜索延迟明显升高。

客户端应限制并发，并在收到 `429` 时进行带随机性的指数退避。[Bulk API](https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-bulk.html/) [Indexing Speed Guidance](https://www.elastic.co/docs/deploy-manage/production-guidance/optimize-performance/indexing-speed)

### 9.5 分布式并行与 Scatter-Gather

多个 Shard 能够并行查询，但并行不代表没有成本。一次查询如果涉及大量 Shard，协调节点需要等待、合并和排序大量局部结果。

因此：

- Shard 太少可能限制并行和容量。
- Shard 太多会增加扇出、协调和元数据成本。
- 深分页会迫使每个 Shard 保留大量候选结果。
- 高基数聚合可能消耗大量内存。
- 复杂脚本和低选择性查询可能占用大量 CPU。

Elasticsearch 的性能来自数据模型、Mapping、Shard 规划、硬件和请求模式共同作用，不能只归因于“使用了倒排索引”。

## 10. 常见节点角色与部署形态

### 10.1 主要节点角色

| 节点角色 | 主要职责 |
|---|---|
| Master-Eligible Node | 参与选举和 Cluster State 提交 |
| Data Node | 保存 Shard，执行索引、搜索和聚合 |
| Ingest Node | 执行 Ingest Pipeline |
| Coordinating-Only Node | 路由请求并合并结果 |
| ML Node | 运行机器学习任务 |
| Transform Node | 运行持续或批量数据转换 |
| Remote-Eligible Node | 连接远程 Cluster |

每个 Node 都具备请求协调能力。专用 Coordinating-Only Node 只是移除了其他显式角色，不代表协调工作本身没有 CPU 和内存开销。[Node Roles](https://www.elastic.co/docs/deploy-manage/distributed-architecture/clusters-nodes-shards/node-roles)

### 10.2 常见部署形态

| 形态 | 核心特点 | 适用场景 |
|---|---|---|
| 单节点 | 所有角色集中，无有效 Replica | 本地学习和开发 |
| 通用多节点 | Node 同时承担 Master、Data、Ingest 等角色 | 小型生产环境 |
| 专用 Master + Data | 控制面和数据面分离 | 中大型生产集群 |
| Hot-Warm-Cold 架构 | 不同年龄数据使用不同存储层 | 日志、指标和安全事件 |
| Elastic Cloud Hosted | 由 Elastic 管理基础设施和部分运维 | 希望降低集群管理成本 |
| Elastic Cloud on Kubernetes | 通过 ECK 在 Kubernetes 管理 | Kubernetes 标准化环境 |
| Elastic Cloud Serverless | 隐藏多数 Node 和 Shard 运维细节 | 按使用量管理的云场景 |
| 多 Cluster | Cross-Cluster Search 或 Replication | 跨地域查询、隔离和容灾 |

## 11. 容易混淆的概念

| 概念 | 解决的问题 | 关键区别 |
|---|---|---|
| Elasticsearch Index 与 Inverted Index | 逻辑数据集合；Term 查询结构 | 前者包含 Shard，后者是 Lucene 内部索引结构 |
| Index 与 Shard | 逻辑命名空间；物理数据分片 | 一个 Index 包含一个或多个 Shard |
| Shard 与 Segment | 分布式执行单位；Lucene 不可变文件单元 | 一个 Shard 是 Lucene Index，内部包含多个 Segment |
| Primary Shard 与 Elected Master | 数据写入入口；集群控制面负责人 | Primary 按 Shard 存在，Master 每个 Cluster 同时只有一个当选者 |
| Primary 与 Replica | 写入主副本；冗余副本 | 两者保存同一 Shard 数据，但职责不同 |
| Replica 与 Snapshot | 在线故障转移；离线时间点备份 | Replica 会同步错误操作，Snapshot 可恢复历史状态 |
| Refresh 与 Flush | 使数据可搜索；建立持久化 Commit Point | Refresh 解决可见性，Flush 解决恢复边界 |
| Merge 与 Force Merge | 后台合并 Segment；主动请求大规模合并 | 在线写入 Index 不应频繁执行 Force Merge |
| `text` 与 `keyword` | 全文分析；精确值匹配 | 名称、标签、状态等字段经常需要正确选择或使用 Multi-Field |
| `_source` 与 Doc Values | 原始文档；排序聚合的列式结构 | `_source` 适合返回和重建，Doc Values 适合字段值访问 |
| Update 与原地修改 | API 语义；Lucene 存储行为 | Update 通常仍会生成新版本并标记旧版本删除 |
| Query 与 Filter | 相关性检索；条件筛选 | Query 计算 Score，Filter 通常不计算 Score |
| Alias 与 Data Stream | Index 的逻辑别名；时序后备 Index 集合 | Data Stream 强调追加型数据和自动 Rollover |
| Mapping 与 Index Template | 当前 Index 的字段定义；新 Index 的创建规则 | 修改 Template 不会自动改造所有已有 Index |

## 12. 完整概念图

```text
┌──────────────────────────── 控制面 ────────────────────────────┐
│ Master-Eligible Nodes                                         │
│   └── Elected Master                                          │
│       ├── Cluster State                                       │
│       ├── Node Membership                                     │
│       ├── Index / Mapping Metadata                            │
│       └── Shard Allocation / Primary Promotion                │
└────────────────────────────────────────────────────────────────┘
                              │ 管理
                              ▼
┌──────────────────────────── 数据面 ────────────────────────────┐
│ Elasticsearch Cluster                                         │
│                                                                │
│ Index / Data Stream                                           │
│   ├── Primary Shard 0 ── Replica Shard 0                      │
│   ├── Primary Shard 1 ── Replica Shard 1                      │
│   └── Primary Shard 2 ── Replica Shard 2                      │
│                                                                │
│ 每个 Shard = 一个 Lucene Index                                │
│   ├── Segment                                                  │
│   │   ├── Inverted Index：全文查询                            │
│   │   ├── Doc Values：排序与聚合                              │
│   │   └── Stored _source：结果返回与重建                      │
│   └── Translog：异常恢复                                      │
│                                                                │
│ 生命周期：                                                     │
│   Indexing Buffer → Refresh → Segment → Merge                 │
│                         └──── Flush / Lucene Commit            │
└────────────────────────────────────────────────────────────────┘
           ▲ Write                               │ Search
           │                                     ▼
┌─────────────────────┐              ┌───────────────────────────┐
│ Client / Ingest      │              │ Coordinating Node         │
│ JSON Document        │              │ Scatter to Shards         │
│ Mapping / Analyzer   │              │ Gather / Reduce / Fetch   │
│ Routing / Bulk       │              └───────────────────────────┘
└─────────────────────┘
           │
           └── ILM / Data Stream Lifecycle
               Hot → Warm → Cold → Frozen → Delete

Cluster 外部：
  Snapshot Repository ── Backup / Restore
  Database / Object Storage ── Source of Record
  Kibana ── Visualization and Management
```

可以把 Elasticsearch 归纳为五个认知层次：

1. 数据怎样表示：Document 属于 Index，Mapping 决定 Field 的索引方式。
2. 搜索怎样实现：Analyzer 产生 Term，Inverted Index 支持查找，Doc Values 支持排序和聚合。
3. 请求怎样执行：Routing 找到 Shard，Primary 处理写入，搜索采用 Scatter-Gather。
4. 状态怎样管理：Refresh、Translog、Flush、Segment Merge 和 ILM 分别管理可见性、恢复和生命周期。
5. 系统怎样扩展和容错：Primary Shard 拆分数据，Replica 提供冗余与读取能力，Master 管理 Cluster State。

## 13. 第一阶段需要记住什么

1. Elasticsearch 是基于 Lucene 的分布式搜索和分析引擎，不只是一个保存 JSON 的数据库。
2. Document 是业务数据单位，Mapping 决定 Field 如何被分析、索引、排序和聚合。
3. `text` 用于全文分析，`keyword` 用于精确匹配、排序和聚合；混用是最常见的建模错误之一。
4. 倒排索引用于从 Term 找 Document，Doc Values 用于从 Document 读取字段值，`_source` 保存原始文档表示。
5. Index 是逻辑集合，Primary Shard 是数据拆分单位，每个 Shard 本质上是独立的 Lucene Index。
6. 写请求先到目标 Primary，再复制到 In-Sync Replica；搜索可以从 Primary 或 Replica 执行。
7. 写入成功不等于立即能被 Search 查到，Search 可见性由 Refresh 控制。
8. Refresh、Flush 和 Merge 是三个不同机制：分别管理搜索可见性、持久化恢复边界和 Segment 整理。
9. Replica 提供在线冗余和读取能力，但不能代替 Snapshot Backup。
10. Elected Master 负责 Cluster State 和 Shard Allocation，并不集中处理全部搜索和写入。
11. Shard 可以提高容量与并行度，但过多 Shard 会增加 Heap、元数据、合并和查询扇出成本。
12. Elasticsearch 通常是搜索优化后的派生存储；核心业务数据是否由它唯一保存，需要根据一致性、备份和恢复要求谨慎决定。

## 14. 后续可以深入的问题

1. Analyzer 中的 Character Filter、Tokenizer 和 Token Filter 如何协作？
2. BM25 相关性评分如何计算，如何调试某条结果的 Score？
3. Lucene Inverted Index、FST、Posting List 和 Skip List 如何工作？
4. Doc Values 为什么适合聚合，Global Ordinals 又解决什么问题？
5. Refresh、Flush、Translog 和 Lucene Commit 的底层关系是什么？
6. Segment Merge 如何选择 Segment，为什么它会引起磁盘和延迟抖动？
7. Primary Shard 如何维护 Sequence Number、Primary Term 和 Global Checkpoint？
8. Master Election、Voting Configuration 和 Cluster State Publication 如何运行？
9. Query Phase、Fetch Phase、DFS Query Then Fetch 有什么差异？
10. 如何规划 Shard 大小、Shard 数量、JVM Heap 和磁盘容量？
11. 如何排查慢查询、写入拒绝、Heap 压力、频繁 GC 和 Hot Shard？
12. 如何设计零停机 Reindex、Alias 切换、Mapping 升级和数据回滚？

## 15. 官方资料

- [Elasticsearch 当前官方参考文档](https://www.elastic.co/guide/en/elasticsearch/reference/current/)
- [Clusters, Nodes, and Shards](https://www.elastic.co/docs/deploy-manage/distributed-architecture/clusters-nodes-shards)
- [Node Roles](https://www.elastic.co/docs/deploy-manage/distributed-architecture/clusters-nodes-shards/node-roles)
- [Reading and Writing Documents](https://www.elastic.co/docs/deploy-manage/distributed-architecture/reading-and-writing-documents)
- [Mapping Reference](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference)
- [Analyzer Reference](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/analyzer)
- [Doc Values](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/doc-values)
- [Near Real-Time Search](https://www.elastic.co/docs/manage-data/data-store/near-real-time-search)
- [Translog Settings](https://www.elastic.co/docs/reference/elasticsearch/index-settings/translog)
- [Optimistic Concurrency Control](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/optimistic-concurrency-control)
- [Index Lifecycle Management](https://www.elastic.co/docs/manage-data/lifecycle/index-lifecycle-management)
- [Snapshot and Restore](https://www.elastic.co/docs/deploy-manage/tools/snapshot-and-restore)