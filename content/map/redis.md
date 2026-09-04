---
title: Redis
order: 1
---

## 1. Redis 是什么

**Redis（Remote Dictionary Server）是一个基于内存运行的数据结构服务器（in-memory data structure server）**。它以 Key-Value 模型组织数据，并原生支持 String、Hash、List、Set、Sorted Set、Stream 等数据结构。

通俗来说，Redis 是一个可以通过网络访问的高速数据容器。应用不仅能按 Key 读取 Value，还能直接让 Redis 完成计数、集合运算、排序、队列操作等任务。

Redis 的主要特点包括：

- 数据主要保存在内存中，读写延迟低。
- 支持多种具有明确语义的数据结构。
- 单条命令通常具有原子性。
- 可以通过 RDB 或 AOF 将数据持久化到磁盘。
- 支持主从复制、Sentinel 高可用和 Redis Cluster 分片。
- 除了缓存，也可用于计数、排行榜、会话、限流、消息流和分布式协调。

因此，把 Redis 简单理解为“缓存”并不准确。缓存是它最常见的用途，但 Redis 本身首先是一个数据结构服务器。[Redis 官方数据类型概览](https://redis.io/docs/latest/develop/data-types/)

## 2. Redis 的最小工作模型

一个最简单的 Redis 系统只包含三个部分：

```text
应用程序
   │
   │ Redis 命令
   ▼
Redis Server
   │
   ▼
Keyspace
   ├── Key A → Value A
   ├── Key B → Value B
   └── Key C → Value C
```

### 2.1 Key、Value 与 Keyspace

**Key（键）** 是数据的唯一标识。Redis 的 Key 本质上是二进制安全的字符串，应用通常使用具有业务含义的命名方式：

```text
user:1001
product:3002
order:202609030001
```

**Value（值）** 是 Key 对应的数据。Value 不只是普通字符串，也可以是 Hash、List、Set 等数据结构。

**Keyspace（键空间）** 是一个 Redis 数据库中全部 Key 的集合。数据过期、扫描、内存淘汰等机制，本质上都在管理这个键空间。

### 2.2 Command 与 RESP

应用不会直接访问 Redis 的内存，而是通过 Redis Client 发送命令：

```text
SET user:1001:name Alice
GET user:1001:name
INCR article:88:views
```

客户端与服务端之间使用 **RESP（Redis Serialization Protocol）** 传输命令和响应。客户端库负责把编程语言中的调用编码成 RESP，再将服务端响应转换回相应的数据类型。

完整链路可以概括为：

```text
业务代码
  → Redis Client
  → 使用 RESP 编码命令
  → Redis Server 执行命令
  → 返回 RESP 响应
  → Client 转换为语言对象
```

平时使用 Java、Go 或 Python 客户端时，开发者通常感觉不到 RESP 的存在，但它解释了 Redis 客户端与服务端如何通信。

## 3. Redis 的核心数据结构

选择 Redis 数据类型时，关键不是“数据长什么样”，而是“需要对数据执行什么操作”。

| 数据类型 | 专业定义 | 典型用途 |
|---|---|---|
| String | 二进制安全的字节序列 | 文本、序列化对象、计数器、位图 |
| Hash | 一个 Key 下的 Field-Value 集合 | 用户信息、商品属性、对象字段 |
| List | 按插入顺序排列、允许重复的元素序列 | 简单队列、最新记录 |
| Set | 无序且成员唯一的集合 | 去重、标签、交集和并集 |
| Sorted Set | 每个唯一成员关联一个 Score，并按 Score 排序 | 排行榜、延迟任务、范围查询 |
| Stream | 带消息 ID 的追加式日志结构 | 消息流、消费者组、事件处理 |

此外，Redis 还提供 Bitmap、Bitfield、HyperLogLog、Geospatial，以及新版本中的 JSON、Time Series、Vector Set 等能力。

数据结构会直接影响：

- 能使用哪些命令。
- 操作的时间复杂度。
- 数据占用的内存。
- 是否适合分片和批量处理。

例如，排行榜使用 Sorted Set，并不是因为“排行榜看起来像列表”，而是因为它需要根据 Score 动态排序并执行排名查询。

## 4. 一条命令如何执行

Redis 采用客户端—服务器架构。一次命令大致经历以下过程：

```text
客户端建立连接
  → 发送 RESP 请求
  → Redis 事件循环发现连接可读
  → 解析命令与参数
  → 在 Keyspace 中执行数据结构操作
  → 生成响应
  → 将结果写回客户端
```

### 4.1 Event Loop 与命令执行

Redis 使用 **事件驱动（event-driven）** 模型处理网络连接。命令执行的核心路径主要是串行的，这减少了多个线程同时修改共享数据时的大量加锁成本。

“Redis 是单线程的”是一种常见但不够严谨的说法：

- Redis 的命令执行核心主要由主线程完成。
- 网络 I/O、持久化、异步释放内存等工作可能由其他线程或子进程参与。
- 某条耗时命令仍可能阻塞主线程，影响其他请求。

所以 Redis 性能高，不只是因为“使用内存”，还因为它的数据结构、事件模型和命令执行路径都针对低延迟进行了设计。

### 4.2 Atomicity：单条命令的原子性

**原子操作（Atomic Operation）** 是指一个操作执行期间不会被其他命令插入并观察到中间状态。

例如，统计浏览次数时：

```text
GET article:88:views
在客户端加一
SET article:88:views 新值
```

这是三个步骤，多个客户端并发执行时可能互相覆盖。

Redis 提供的：

```text
INCR article:88:views
```

会在服务端一次完成读取、加一和写回，因此适合并发计数。

需要注意：

- 单条 Redis 命令通常具有原子性。
- 多条独立命令组合起来，不会自动具有整体原子性。
- 多步骤操作可以根据场景使用 `MULTI/EXEC`、Lua 脚本或 Redis Functions。
- Redis 事务不等同于关系数据库事务，不提供相同的回滚和隔离语义。

## 5. 数据为什么会消失：Expiration 与 Eviction

Redis 的数据主要存放在内存中，而内存容量有限。Redis 使用两套不同机制管理数据生命周期。

### 5.1 Expiration 与 TTL

**Expiration（过期）** 表示为 Key 设置失效时间。

**TTL（Time To Live）** 表示 Key 距离过期还剩多长时间。

```text
SET session:abc user-1001 EX 1800
```

表示该会话将在 1800 秒后过期。

TTL 适合处理：

- 缓存有效期。
- 登录会话。
- 验证码。
- 幂等标记。
- 短期状态。

### 5.2 Eviction

**Eviction（内存淘汰）** 是 Redis 达到 `maxmemory` 限制后，根据配置的淘汰策略选择数据移除。

两者的区别是：

```text
Expiration：Key 自己的生命周期结束了
Eviction：Key 可能尚未过期，但 Redis 内存不足
```

常见淘汰策略会根据 Key 是否设置 TTL、访问频率或空闲时间选择候选数据；`noeviction` 则会在无法继续分配内存时拒绝相关写入。

因此，设置 TTL 不等于完成了内存容量规划，启用淘汰也不意味着可以忽略数据的重要程度。

## 6. 从内存到磁盘：Persistence

内存速度快，但进程退出或机器故障后，内存数据可能丢失。Redis 使用 **Persistence（持久化）** 将数据写入持久存储，以便重启后恢复。

Redis Open Source 主要有两种持久化方式。

### 6.1 RDB

**RDB（Redis Database）** 是数据集在某个时间点的快照。

专业上，它属于 point-in-time snapshot：周期性保存某一时刻的完整数据状态。

直观上，可以把它理解为定期为内存数据“拍照”。

优点：

- 文件相对紧凑。
- 适合备份和全量恢复。
- 恢复速度通常较快。

代价：

- 两次快照之间的新数据可能丢失。
- 创建快照会产生 CPU、内存和磁盘 I/O 开销。

### 6.2 AOF

**AOF（Append Only File）** 通过追加记录会修改数据集的写操作，并在重启时重放这些操作恢复数据。

优点：

- 可以获得比周期性快照更小的数据丢失窗口。
- 写入记录便于按操作重建数据集。

代价：

- 文件通常比 RDB 更大。
- 需要 AOF rewrite 控制文件增长。
- 不同 `fsync` 策略会在性能与持久性之间产生不同权衡。

Redis 可以只使用 RDB、只使用 AOF、同时启用两者，也可以完全关闭持久化。[Redis 官方持久化说明](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)

## 7. 从恢复数据到保持服务可用：Replication 与 Sentinel

持久化解决的是“Redis 重启后怎样恢复数据”，但不能保证节点故障时服务仍然可以立即访问。

为此，需要引入复制与故障转移。

### 7.1 Primary-Replica Replication

**Replication（复制）** 是 Primary 将数据变化同步给一个或多个 Replica 的机制。

```text
Client
   │ 写入
   ▼
Primary
   ├── 复制数据 → Replica 1
   └── 复制数据 → Replica 2
```

Redis Open Source 的常规复制采用异步方式。Primary 返回写入成功时，Replica 不一定已经获得这次写入。因此，复制可以提高可用性和读扩展能力，但不能自动提供强一致性或绝对零数据丢失。

Replica 断线后重新连接时：

- 条件允许时执行部分重同步，只补充缺失的数据。
- 无法部分同步时执行全量同步。

复制的专业角色是维护冗余副本；通俗来说，就是让其他节点准备一份可以接替的数据。

### 7.2 Sentinel

只有副本还不够：Primary 故障后，还需要发现故障、选择新 Primary，并把新地址告诉客户端。

**Redis Sentinel** 是面向非 Cluster 主从部署的高可用组件，主要负责：

- Monitoring：监控 Primary 和 Replica。
- Notification：报告节点状态变化。
- Automatic failover：Primary 故障后提升某个 Replica。
- Configuration provider：向客户端提供当前 Primary 地址。

Sentinel 解决的是**高可用和故障转移**，不负责把数据分散到多个 Primary 上。

## 8. 从单机容量到水平扩展：Redis Cluster

Primary 加多个 Replica 仍然存在一个限制：它们通常保存相同的数据，无法突破单个 Primary 的内存容量和写入能力。

**Sharding（分片）** 通过让不同节点负责不同 Key，将数据和请求分散到多台机器。

Redis Open Source 提供的原生分片方案是 **Redis Cluster**。

### 8.1 Hash Slot

Redis Cluster 将 Keyspace 划分为 **16,384 个 Hash Slot（哈希槽）**。每个 Primary 节点负责其中一部分槽。

Key 到节点的定位过程可以简化为：

```text
Key
  → CRC16(Key) mod 16384
  → 得到 Hash Slot
  → 找到负责该 Slot 的 Primary
  → 执行命令
```

实际还存在 Hash Tag 等规则，但第一阶段只需理解：

- Key 不直接固定到某台服务器。
- Key 先映射到 Hash Slot。
- Hash Slot 再分配给节点。
- 迁移 Slot 就能重新分布数据。

每个负责 Slot 的 Primary 还可以配置 Replica，从而同时获得分片和故障转移能力。[Redis Cluster 规范](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/)

### 8.2 Cluster 的边界

分片并非没有代价：

- 客户端必须知道或能够发现集群拓扑。
- 多 Key 命令可能因为 Key 位于不同 Slot 而受到限制。
- 扩缩容涉及 Slot 与数据迁移。
- 热 Key 仍可能让单个节点过载。
- Redis Cluster 的复制仍以异步复制为基础，极端故障下可能丢失已确认写入。

因此，Cluster 解决的是水平扩展与一定程度的高可用，不是通用的强一致分布式数据库方案。

## 9. 三种常见部署形态

| 部署形态 | 数据是否分片 | 自动故障转移 | 主要用途 |
|---|---:|---:|---|
| 单节点 | 否 | 否 | 本地开发、可重建缓存 |
| Primary + Replica + Sentinel | 否 | 是 | 单份数据能放入一个节点，但需要高可用 |
| Redis Cluster | 是 | 是 | 需要扩大容量和吞吐，同时应对节点故障 |

选择时可以先问两个问题：

1. 一份完整数据能否放入单个节点？
2. 节点故障后是否允许人工恢复？

如果数据放得下但需要自动故障转移，可以考虑 Sentinel 架构；如果单节点容量或吞吐不足，则需要考虑 Cluster 或其他分片方案。

## 10. Redis 作为缓存时如何工作

缓存是最适合使用简短案例解释的部分。

最常见的模式是 **Cache Aside（旁路缓存）**：

```text
读取请求
  → 查询 Redis
  → 命中：直接返回
  → 未命中：查询数据库
  → 将结果写入 Redis
  → 返回结果
```

Cache Aside 不是 Redis 自动执行的功能，而是由应用程序维护的缓存策略。

更新数据时，常见做法是：

```text
先更新数据库
  → 再删除缓存
  → 后续读取重新加载
```

这种方案简单实用，但数据库与缓存是两个独立系统，无法天然组成一个原子事务。并发、失败和执行顺序都可能造成短暂不一致。

### 10.1 三类缓存故障

| 问题 | 专业含义 | 常见处理思路 |
|---|---|---|
| 缓存穿透 | 持续查询不存在的数据，请求绕过缓存到达数据库 | 参数校验、缓存空值、Bloom Filter |
| 缓存击穿 | 单个热 Key 失效，大量请求同时重建 | 互斥重建、逻辑过期、提前刷新 |
| 缓存雪崩 | 大量 Key 集中过期或缓存服务整体不可用 | TTL 随机化、高可用、限流降级 |

这三个概念都发生在缓存未命中之后，但影响范围不同：穿透强调不存在的数据，击穿强调单个热 Key，雪崩强调大量数据或整个缓存层。

## 11. Redis 为什么快

Redis 的低延迟来自多个因素共同作用：

1. **In-memory access**：主要数据位于内存，避免普通磁盘随机读取。
2. **高效数据结构**：不同命令使用针对性的数据结构和内部编码。
3. **事件驱动网络模型**：能够在一个进程中管理大量客户端连接。
4. **主要命令路径串行执行**：减少共享数据竞争和锁开销。
5. **较短的执行路径**：Key-Value 模型和命令语义相对直接。
6. **Pipeline 与批量命令**：减少网络 RTT 对整体延迟的影响。

但“Redis 很快”不代表所有命令都快。命令复杂度、Key 大小、返回数据量、网络延迟和持久化操作都会影响性能。

尤其需要关注：

- **Big Key（大 Key）**：单个 Value 占用大量内存或包含大量元素。
- **Hot Key（热 Key）**：少数 Key 承担了过高的访问流量。
- 时间复杂度较高的命令。
- 一次返回或删除大量数据。
- RDB、AOF rewrite 产生的额外资源压力。
- Pipeline 过大造成的客户端或服务端内存占用。

## 12. 容易混淆的概念

| 概念 | 解决的问题 | 关键区别 |
|---|---|---|
| Expiration 与 Eviction | 数据生命周期与内存不足 | 前者按 Key 到期；后者因内存压力移除数据 |
| RDB 与 AOF | 重启后的数据恢复 | RDB 保存状态快照；AOF 记录写操作 |
| Persistence 与 Replication | 恢复与可用性 | 持久化写磁盘；复制把数据发送到其他节点 |
| Replication 与 Backup | 在线冗余与历史恢复 | 错误操作会传播到 Replica，独立备份才能恢复旧状态 |
| Sentinel 与 Cluster | 高可用与水平分片 | Sentinel 不分片；Cluster 将 Keyspace 分配到多个 Primary |
| Pipeline 与 Transaction | 通信效率与执行隔离 | Pipeline 减少 RTT；Transaction 让命令队列连续执行 |
| Big Key 与 Hot Key | 数据体积与访问频率 | 大 Key 不一定热门，热 Key 也不一定很大 |
| Cache Hit 与 Cache Miss | 缓存读取结果 | 命中表示缓存存在；未命中不代表数据库不存在 |

## 13. 完整概念图

```text
Application
   │
   │ Redis Client / RESP
   ▼
Redis Node
   ├── Keyspace
   │     └── Key → String / Hash / List / Set / ZSet / Stream
   │
   ├── Command Execution
   │     ├── Atomic Command
   │     ├── Transaction / Lua / Function
   │     └── Pipeline（减少 RTT）
   │
   ├── Data Lifecycle
   │     ├── Expiration / TTL
   │     └── Eviction / maxmemory
   │
   ├── Persistence
   │     ├── RDB
   │     └── AOF
   │
   ├── Replication
   │     └── Primary → Replica
   │
   └── Deployment
         ├── Sentinel：监控与故障转移
         └── Cluster：Hash Slot、分片与故障转移
```

这些概念可以归纳成四个层次：

```text
怎样使用数据：Key、Value、Data Type、Command
怎样执行请求：RESP、Event Loop、Atomicity、Pipeline
怎样管理数据：TTL、Eviction、RDB、AOF
怎样运行集群：Replication、Sentinel、Cluster、Hash Slot
```

## 14. 第一阶段需要记住什么

1. Redis 是内存数据结构服务器，不只是缓存。
2. Redis 通过 Key 定位数据，Value 可以具有不同的数据结构语义。
3. 应根据所需操作选择数据类型，而不只是根据数据外观选择。
4. 单条命令通常具有原子性，多条命令组合则需要额外机制。
5. Expiration 管理数据到期，Eviction 处理内存不足。
6. RDB 和 AOF 解决重启后的数据恢复问题。
7. Replication 保存在线副本，但异步复制不等于强一致。
8. Sentinel 负责非分片主从架构的监控与故障转移。
9. Redis Cluster 通过 16,384 个 Hash Slot 实现分片。
10. Pipeline、Transaction、Persistence、Replication 分别解决不同问题，不能混为一谈。
11. Redis 性能高不代表可以忽略命令复杂度、Big Key 和 Hot Key。
12. Redis 作为缓存时，数据库与缓存之间的一致性通常由应用负责。

## 15. 后续可以深入的问题

1. Redis 的事件循环和 I/O 多线程具体如何协作？
2. String、Hash、List、Set、Sorted Set 使用了哪些内部编码？
3. Redis 如何实现 Key 的主动过期与惰性过期？
4. LRU、LFU 等淘汰策略如何近似实现？
5. RDB fork、Copy-on-Write 和 AOF rewrite 如何影响内存？
6. 全量复制和部分重同步分别怎样工作？
7. Sentinel 如何判断主观下线和客观下线？
8. Redis Cluster 如何发现节点并完成故障转移？
9. Hash Tag 如何解决 Cluster 中的多 Key 操作问题？
10. Cache Aside 在并发更新下为什么会产生不一致？
11. Redis 分布式锁需要满足哪些正确性条件？
12. 如何识别和治理 Big Key、Hot Key 与慢命令？

## 官方资料

- [Redis 数据类型](https://redis.io/docs/latest/develop/data-types/)
- [Redis 数据结构快速入门](https://redis.io/docs/latest/develop/get-started/data-store/)
- [Redis Pipeline](https://redis.io/docs/latest/develop/using-commands/pipelining/)
- [Redis 持久化](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)
- [Redis Replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/)
- [Redis Cluster specification](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/)