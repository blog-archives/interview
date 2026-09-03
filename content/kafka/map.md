---
title: Kafka 快速入门
order: 1
---

## 1. 它是什么

Apache Kafka 是一种 **分布式事件流平台**（Distributed Event Streaming Platform）。它能够持续接收、持久化和分发大量事件，并允许多个应用按照各自的进度读取、重放和处理这些事件。

通俗来说，Kafka 像一套可长期保存的公共事件流水账：生产方把“发生了什么”追加进去，多个消费方可以独立阅读，而且不要求生产方知道谁会消费。

Kafka 主要解决四类问题：

- 在生产者与消费者之间建立异步、松耦合的数据通道。
- 以较高吞吐量持久保存连续产生的事件。
- 允许多个下游系统独立消费和重放同一份数据。
- 通过分区、副本和集群机制实现水平扩展与故障恢复。

常见场景包括：

- 微服务之间的异步事件通信。
- 日志、埋点、指标等数据采集。
- 数据库变更数据捕获（Change Data Capture，CDC）。
- 实时数据管道和流处理。
- 缓存、搜索索引、数据仓库等系统的数据同步。
- 事件溯源（Event Sourcing）中的事件存储与分发。

Kafka 不适合直接替代：

- 面向随机查询和事务性 CRUD 的关系型数据库。
- 需要立即返回业务结果的同步 RPC。
- 搜索引擎或分析数据库。
- 大文件对象存储。
- 默认要求每条任务独立领取、确认、超时重投的传统任务队列。

最后一点存在版本边界：Kafka 4.x 提供共享消费者（Share Consumer）和共享组（Share Group），增强了传统队列式消费能力；但理解 Kafka 的主线仍应从 Topic、Partition、Consumer Group 和 Offset 开始。官方将 Kafka 定义为事件流平台，而不只是“消息队列”。[Apache Kafka 官方简介](https://kafka.apache.org/documentation/)

## 2. 最小工作模型

理解 Kafka，首先只需要五个角色：

- 生产者（Producer）：向 Kafka 写入事件的客户端应用。
- Broker：接收、保存并提供事件读取服务的 Kafka 服务器。
- 主题（Topic）：事件的逻辑分类。
- 消费者（Consumer）：从 Kafka 拉取并处理事件的客户端应用。
- 控制器（Controller）：管理集群元数据和分区领导者等控制状态。

```text
                          ┌── KRaft Controller Quorum
                          │   管理集群元数据与选举
                          ▼
Producer ── Produce ──> Kafka Broker Cluster
                         │
                         └── Topic
                              ├── Partition 0：有序追加日志
                              ├── Partition 1：有序追加日志
                              └── Partition 2：有序追加日志
                                      │
                                      ▼ Fetch
                                Consumer Group
                                  ├── Consumer A
                                  └── Consumer B
```

生产者和消费者都是 Kafka 之外的客户端。Broker 负责数据面，Controller 主要负责控制面。生产者直接向目标 Partition 的 Leader Broker 写入，消费者也直接从负责相应 Partition 的 Broker 拉取数据，不经过一个中央消息路由节点。

多个 Broker 组成 Kafka 集群（Kafka Cluster）。客户端最初只需连接少量引导服务器（Bootstrap Servers），取得完整集群元数据后，就能找到目标 Partition 当前所在的 Broker。

## 3. 核心数据模型与组成部分

### 3.1 事件、主题与分区

事件（Event）或记录（Record）是 Kafka 读写的基本数据单位，文档和日常讨论中也常称为消息（Message）。一条事件通常包含：

| 字段 | 专业含义 | 实际作用 |
|---|---|---|
| Key | 可选的字节序列 | 参与分区选择，也可表示事件所属实体 |
| Value | 事件正文的字节序列 | 保存实际业务数据 |
| Timestamp | 时间戳 | 表示事件创建时间或 Broker 接收时间 |
| Headers | 可选元数据集合 | 携带追踪标识、类型等附加信息 |

Kafka 将 Key 和 Value 视为字节序列，并不理解其中的 JSON、Avro 或 Protobuf 结构。序列化器（Serializer）负责在发送前将业务对象转换成字节；反序列化器（Deserializer）负责在消费时还原。数据格式及 Schema 兼容性通常由客户端、Schema Registry 或业务治理体系负责，而不是 Broker 自动保证。

主题（Topic）是事件的逻辑命名空间。生产者向 Topic 发布事件，消费者订阅 Topic。一个 Topic 可以同时拥有多个生产者和多个消费者。

分区（Partition）是 Topic 的物理分片和并行处理单位。每个 Partition 都是一条只能在尾部追加的有序日志；同一 Topic 的不同 Partition 可以分布在不同 Broker 上。

```text
Topic: orders
  ├── Partition 0: [0][1][2][3]...
  ├── Partition 1: [0][1][2]...
  └── Partition 2: [0][1][2][3][4]...
```

Kafka 只保证单个 Topic-Partition 内的写入顺序，不保证整个 Topic 跨 Partition 的全局顺序。

### 3.2 Key、分区选择与顺序

事件键（Record Key）常用于决定事件进入哪个 Partition。默认分区策略通常会让相同 Key 稳定地映射到同一 Partition，从而使同一业务实体的事件进入同一条有序日志。

例如，以 `orderId` 为 Key，可以让同一订单的创建、支付和取消事件保持分区内顺序。

但 Key 不是数据库意义上的唯一主键：

- Kafka 允许多条事件拥有相同 Key。
- 普通保留策略不会因为 Key 相同而覆盖旧记录。
- 增加 Partition 数量后，哈希映射结果可能变化，后续同 Key 事件可能进入新 Partition。
- 跨 Partition 不存在自然的全局顺序。

### 3.3 日志与 Offset

日志（Log）是 Partition 在 Broker 上的持久化表示。Kafka 将记录顺序追加到日志，并把日志拆成多个日志段（Log Segment），便于滚动、删除和压缩。

偏移量（Offset）是 Kafka 为每条记录在某个 Partition 内分配的单调递增位置。通俗来说，它像该 Partition 日志中的位置编号。

Offset 在系统中主要承担三项职责：

- 标识记录在 Partition 中的位置。
- 告诉 Broker 从哪里开始读取。
- 表示消费者已经处理到哪里。

Offset 只在所属 Partition 内有意义。因此，一条记录通常由 `Topic + Partition + Offset` 定位，而不能只靠 Offset 全局定位。

## 4. 一次消息生产与消费如何执行

### 4.1 生产流程

一次典型写入按照下面的顺序发生：

```text
业务对象
  → Serializer 序列化
  → Partitioner 选择 Partition
  → Producer 在内存中组成 Record Batch
  → 根据元数据找到 Partition Leader
  → Leader 追加本地日志
  → Follower 拉取并复制
  → 满足确认条件
  → Producer 收到成功或失败结果
```

1. Producer 使用 Bootstrap Servers 建立初始连接，并获取 Topic、Partition、Leader 等元数据。
2. Serializer 将 Key 和 Value 转换成字节。
3. 分区器（Partitioner）根据显式 Partition、Key 或默认策略选择目标 Partition。
4. Producer 将同一目标 Partition 的多条记录聚合为记录批次（Record Batch），必要时压缩。
5. Producer 将批次直接发给该 Partition 的 Leader Replica。
6. Leader 将批次追加到本地日志，Follower Replica 主动从 Leader 拉取并复制。
7. Broker 根据确认机制（Acknowledgment，`acks`）决定何时回复 Producer。
8. 如果发生可重试错误，Producer 可以刷新元数据并重试。

`send()` 经常表现为异步调用，但这不表示写入已经成功。最终结果仍需通过返回的 Future、回调或同步等待进行确认。

### 4.2 消费流程

消费者采用拉取模型（Pull Model）：

```text
Consumer 加入 Consumer Group
  → 获得 Partition 分配
  → 根据当前位置发送 Fetch
  → Broker 返回一批记录
  → Consumer 反序列化并处理
  → 提交下一次应读取的 Offset
```

消费者组（Consumer Group）是一组以同一个 `group.id` 协作消费的 Consumer。同一个传统 Consumer Group 内，一个 Partition 在同一时刻只分配给一个 Consumer；不同 Consumer Group 则可以独立读取同一 Topic 的完整数据。

组协调器（Group Coordinator）是负责管理某个 Consumer Group 的 Broker 角色。它接收成员心跳、维护组状态，并协调 Partition 分配。

再平衡（Rebalance）是组成员或订阅关系发生变化后重新分配 Partition 的过程。消费者加入、退出、超时或 Topic Partition 变化都可能触发它。再平衡能够恢复并行消费，但也可能造成短暂停顿和状态迁移。

消费者位置需要区分：

- 当前消费位置（Position）：Consumer 下一次 `poll()` 准备读取的位置，主要存在于客户端运行状态中。
- 已提交偏移量（Committed Offset）：持久记录的恢复位置，通常保存在 Kafka 内部 Topic `__consumer_offsets` 中。

提交的通常是“下一条要读取的 Offset”，而不是“刚处理完的那条 Offset”。Consumer 崩溃后，新实例通常从 Committed Offset 恢复，因此处理完成与 Offset 提交的先后顺序决定了投递语义。[Kafka Consumer Offset Tracking](https://kafka.apache.org/43/implementation/distribution/)

### 4.3 并发模型的关键边界

Kafka 不是“单线程系统”。Broker、Producer 和各种客户端内部都可能使用多个网络、I/O 或后台线程。

Kafka 的有序性来自每个 Partition 的有序追加，而不是整个系统只有一个线程。Partition 同时承担：

- 写入并行单位。
- 消费并行单位。
- 顺序保证边界。
- 副本复制与故障转移单位。

传统 Consumer Group 的有效消费并行度不会超过所订阅 Partition 的数量。若一个 Topic 有 6 个 Partition，同组运行 8 个 Consumer，通常至少有 2 个不会分到该 Topic 的 Partition。

## 5. 数据生命周期与状态管理

### 5.1 创建与更新

Kafka 的日志以追加（Append）为主。新记录写在 Partition 尾部，已有记录不会像数据库行一样被原地更新。

“更新某个对象”通常意味着写入一条具有相同 Key 的新事件。是否把旧事件视为失效状态，由消费者或日志压缩策略决定。

### 5.2 保留与删除

保留策略（Retention Policy）决定旧日志段何时可被清理。常见机制包括：

- 基于时间保留：记录超过指定时间后，其所在日志段可被删除。
- 基于大小保留：Partition 日志超过容量上限后，较旧日志段可被删除。
- 无限期保留：在存储允许时不主动按时间或大小删除。

Kafka 中“已经被消费”与“可以被删除”是两个独立概念。Consumer 读取记录不会立即删除它，因此：

- 多个 Consumer Group 可以独立读取同一份数据。
- Consumer 可以回退 Offset 重新处理。
- 消费较慢会产生 Consumer Lag，但不会单独阻止按 Topic 策略清理数据。
- 如果 Consumer 落后时间超过数据保留期，它可能永久错过已经清理的记录。

消费者滞后（Consumer Lag）是 Partition 最新可读位置与 Consumer 已处理或已提交位置之间的差距，是判断下游是否跟得上生产速度的重要指标。

### 5.3 日志压缩

日志压缩（Log Compaction）是一种按 Key 保留最新状态的清理策略。它在后台删除同一 Key 较旧的记录，同时至少保留该 Key 的最新值。

通俗来说，普通 Retention 关心“这条记录有多旧”，Log Compaction 关心“这个 Key 是否已经有更新版本”。

墓碑记录（Tombstone Record）是 Key 非空、Value 为 `null` 的特殊记录，用于表达该 Key 已被删除。压缩器会先据此清理旧值，墓碑本身在满足保留条件后也可被清除。

需要注意：

- Compaction 是异步进行的，不会在写入新值时立即删除旧值。
- 它不会改变保留下来的记录的 Offset，也不会重新排序。
- 它保证保留最新状态，不保证只剩一份最新记录。
- 没有 Key 的记录无法获得有意义的按 Key 压缩语义。

[Kafka 官方 Log Compaction 设计](https://kafka.apache.org/43/design/design/#log_compaction)

## 6. 可靠性与故障处理

### 6.1 进程重启后怎样恢复

Broker 将 Partition 日志持久化到文件系统。进程重启后，可以从现有日志段和检查点恢复，而不要求从上游重新获取全部业务数据。

Consumer 的业务处理状态不由 Kafka 自动恢复，但它可以从 Committed Offset 继续读取。若消费者还维护本地聚合状态，则需要由应用、Kafka Streams 状态存储或外部数据库负责恢复。

Kafka 广泛利用操作系统页缓存（Page Cache）。写入被 Broker 接受，并不必然等价于每条记录已经单独执行物理磁盘 `fsync`；生产系统通常同时依靠跨 Broker 副本来降低单机或单盘故障风险。

### 6.2 副本、Leader 与 ISR

副本（Replica）是同一个 Partition 数据的多份拷贝。副本因子（Replication Factor）表示每个 Partition 拥有多少个副本，包括 Leader。

每个 Partition 在正常情况下有：

- 一个领导者副本（Leader Replica）：处理该 Partition 的写入，并通常承担读取。
- 零个或多个跟随者副本（Follower Replica）：从 Leader 拉取并复制日志。

同步副本集合（In-Sync Replicas，ISR）是当前仍与 Leader 保持足够同步的副本集合。它不是所有已配置副本的固定列表，而是会随副本存活和落后情况变化。

高水位（High Watermark，HW）表示 Partition 中已被确认复制到要求范围、可安全暴露给普通消费者的位置。Leader 日志末尾可能暂时存在尚未达到高水位的记录。

```text
Partition 0
  Leader   : [0][1][2][3][4]  ← Log End
  Follower : [0][1][2][3]
  Follower : [0][1][2][3]
                         ↑
                    High Watermark
```

当 Leader Broker 故障时，Controller 会从合格副本中选举新的 Leader。正常选举优先保护已提交数据；如果允许非同步副本选举（Unclean Leader Election），可能用数据丢失换取可用性。

### 6.3 写入确认不等于绝对不丢失

生产者确认级别（Acknowledgment，`acks`）控制 Producer 何时把写入视为完成：

| 设置 | 成功条件 | 主要取舍 |
|---|---|---|
| `acks=0` | 不等待 Broker 回复 | 延迟低，但连 Broker 是否收到都无法确认 |
| `acks=1` | Leader 已追加本地日志 | Leader 立即故障时，未复制记录可能丢失 |
| `acks=all` | 当前 ISR 满足复制确认条件 | 最强的内置持久性保证，但延迟和不可用概率更高 |

最小同步副本数（Minimum In-Sync Replicas，`min.insync.replicas`）与 `acks=all` 配合，规定一次写入至少需要有多少个 ISR 可参与，避免集群只剩一个同步副本时仍继续确认高可靠写入。

`acks=all` 仍不代表“任何情况下都绝不丢数据”。它的实际保证还受以下因素影响：

- Replication Factor。
- 当前 ISR 状态。
- `min.insync.replicas`。
- 是否允许非同步副本成为 Leader。
- 多副本是否部署在独立故障域。
- 磁盘、运维误操作和软件故障。
- Producer 是否正确处理超时、重试和最终失败。

[Kafka Producer `acks` 配置](https://kafka.apache.org/43/configuration/producer-configs/)  
[Kafka Topic `min.insync.replicas` 配置](https://kafka.apache.org/43/configuration/topic-configs/)

### 6.4 KRaft 元数据仲裁

KRaft（Kafka Raft Metadata Mode）是 Kafka 当前用于管理集群元数据的内置仲裁机制。Controller 节点组成元数据仲裁组（Metadata Quorum），通过复制元数据日志维护 Broker、Topic、Partition、副本分配和 Leader 等状态。

通俗来说，数据记录存放在 Broker 的 Partition 日志中；“哪些 Broker 存放哪些 Partition、谁是 Leader”等集群目录信息由 KRaft Controller Quorum 管理。

Controller 通常部署 3 或 5 个，必须保持多数节点可用才能正常维护控制面。Active Controller 故障后，可从其他 Controller 中选出新的 Active Controller。生产关键环境通常将 Broker 与 Controller 角色分离。

从 Kafka 4.0 开始，ZooKeeper 模式已被移除，当前版本仅支持 KRaft。[Kafka KRaft 官方文档](https://kafka.apache.org/43/operations/kraft/) [Kafka 4.3 升级说明](https://kafka.apache.org/43/getting-started/upgrade/)

### 6.5 投递语义、幂等与事务

至少一次（At-Least-Once）表示记录不会因为常规消费恢复流程被静默跳过，但可能被重复处理。典型做法是先处理记录，再提交 Offset；若处理完成后、提交前崩溃，记录会被再次消费。

至多一次（At-Most-Once）表示记录最多处理一次，但可能丢失。典型做法是先提交 Offset，再处理记录；若提交后、处理前崩溃，记录将被跳过。

幂等生产者（Idempotent Producer）使用 Producer ID 和序列号消除 Producer 因重试造成的重复日志记录。它解决的是“同一次逻辑发送因网络不确定而重复写入”，并不会自动让消费者的数据库更新也具备幂等性。

事务（Transaction）允许 Producer 将多个 Partition 的写入，以及消费 Offset 的更新，原子地提交或中止。配合读取已提交数据（`read_committed`）的 Consumer，可以为“从 Kafka 读取、处理、再写回 Kafka”的链路建立精确一次处理语义（Exactly-Once Semantics，EOS）。

它不意味着任何外部系统都自动获得全局精确一次：

- 写数据库、调用 HTTP API 等外部副作用仍需外部事务、幂等键或去重设计。
- Consumer 必须使用正确的隔离级别。
- 处理结果与消费 Offset 必须纳入同一可协调的原子边界。

[Kafka Message Delivery Semantics](https://kafka.apache.org/43/design/design/#message_delivery_semantics)

### 6.6 高可用、恢复与备份的区别

- 副本主要解决在线 Broker 故障和服务连续性。
- Offset 和日志恢复主要解决进程重启后的继续运行。
- 跨机架副本降低单个故障域失效的风险。
- 跨集群复制可用于异地容灾或数据分发。
- 离线备份用于应对误删除、逻辑污染或需要恢复历史状态的情况。

在线 Replica 不是离线 Backup。错误写入或删除操作可能同步传播到所有副本，因此高可用不能替代独立备份和恢复演练。

## 7. 扩展与分布式机制

### 7.1 Partition 实现水平扩展

单台 Broker 的磁盘、网络和 CPU 都有限。Kafka 使用 Partitioning 将一个 Topic 拆成多条日志，并把它们分布到不同 Broker。

```text
Broker 1: orders-0 Leader, orders-2 Follower
Broker 2: orders-1 Leader, orders-0 Follower
Broker 3: orders-2 Leader, orders-1 Follower
```

Producer 根据元数据直接找到目标 Leader；Consumer 根据 Partition 分配并行读取。因此，增加 Partition 可以扩大潜在读写并行度。

Partition 与 Replica 解决的问题不同：

- Partition 主要解决容量拆分、负载分布和并行处理。
- Replica 主要解决冗余、故障转移和可用性。

增加 Replica 通常会增加存储和复制开销，并不会按相同比例提高单个 Partition 的写吞吐量。

### 7.2 增加 Broker 与数据迁移

向集群增加 Broker 后，已有 Partition 不一定自动迁移到新节点。需要进行分区重分配（Partition Reassignment），将 Replica 复制到新 Broker，等待追平后再调整旧副本和 Leader 分布。

重分配会消耗磁盘与网络带宽，应进行限速、监控和容量规划。官方运维文档也指出，Kafka 不会仅因为启动了新 Broker 就自动把已有数据重新均衡过去。[Kafka Basic Operations](https://kafka.apache.org/43/operations/basic-kafka-operations/)

### 7.3 增加 Partition 的约束

Kafka 支持增加 Topic 的 Partition 数量，但当前不支持直接减少。

增加 Partition 需要谨慎，因为它可能：

- 改变 Key 到 Partition 的默认映射。
- 破坏同 Key 在扩容前后的连续顺序假设。
- 触发 Consumer Group 重新分配。
- 增加 Broker 元数据、文件句柄、复制任务和选举成本。

所以 Partition 数量既是吞吐设计，也是语义设计和运维设计，不能只在出现性能问题时无限增加。

### 7.4 热分区

热分区（Hot Partition）是流量明显高于其他 Partition 的分区。即使集群总体资源充足，热点 Partition 的 Leader 仍可能受到单台 Broker 的网络、磁盘或 CPU 限制。

常见原因包括：

- Key 分布倾斜。
- 少量超级大客户产生大部分事件。
- 固定写入某个 Partition。
- Partition 数量不足或 Leader 分布不均。

解决思路通常涉及重新设计 Key、拆分热点实体、调整 Partition 或重新分配 Leader，而不仅是增加 Replica。

## 8. 常见使用模式

### 8.1 异步事件骨干

```text
订单服务 ── OrderCreated ──> Kafka
                               ├── 库存服务
                               ├── 风控服务
                               └── 数据分析服务
```

Kafka 提供事件的持久存储与多订阅分发；各业务服务负责定义事件语义、处理失败、保证业务幂等以及管理 Schema 演进。

生产者与消费者互相不需要知道对方的地址和运行状态。消费者短暂停机时，事件可以暂存在 Kafka 中，恢复后继续追赶。

### 8.2 数据集成与 CDC

Kafka Connect 是 Kafka 提供的数据集成框架，用于运行可复用的 Source Connector 和 Sink Connector：

```text
数据库/文件/SaaS
      │
 Source Connector
      ▼
    Kafka
      │
 Sink Connector
      ▼
搜索引擎/数仓/对象存储
```

Kafka Connect 负责连接器运行、任务分配和 Offset 管理；具体连接器负责理解外部系统。CDC 事件的捕获语义通常由 Debezium 等连接器提供，并不是 Kafka Broker 自己读取数据库日志。

### 8.3 流处理

Kafka Streams 是用于构建流处理应用的客户端库。它可以从 Topic 读取事件，执行过滤、聚合、Join、窗口计算等操作，再写入其他 Topic。

Kafka 提供输入输出日志和事务能力；Kafka Streams 提供处理拓扑、本地状态存储、状态恢复和精确一次处理模式；业务应用负责定义实际计算规则。

## 9. 它为什么具有这些性能特点

Kafka 的性能来自多项机制共同作用，而不是简单因为“顺序写磁盘”。

### 9.1 顺序追加与日志段

Partition 主要进行顺序追加，避免为每条记录维护复杂的随机更新结构。历史读取也主要按 Offset 顺序扫描，容易利用磁盘顺序 I/O 和操作系统预读。

代价是 Kafka 不擅长按任意字段随机查询，也不支持像数据库一样原地修改历史记录。

### 9.2 Page Cache

Kafka 大量利用操作系统 Page Cache 缓存日志数据，减少 JVM 堆内的大对象缓存和垃圾回收压力。Consumer 追赶及时、热点数据仍在缓存中时，读取可能无需真正访问磁盘。

代价是性能会受操作系统内存、磁盘能力和其他进程竞争影响，不能把所有 Broker 内存简单理解为 JVM Heap。

### 9.3 批处理与压缩

Producer 将多条记录组成 Record Batch，Broker 按批追加，Consumer 也批量 Fetch。批处理能够摊薄网络往返、系统调用和磁盘操作成本。

批次还可整体压缩，在同类记录之间获得更好的压缩率。批次通常以压缩形式存储并传输。

代价包括：

- 为等待更多记录形成批次，可能增加少量延迟。
- 压缩和解压缩消耗 CPU。
- 过大的批次会增加内存占用、失败重试成本和单次延迟。

### 9.4 较少的数据复制

Kafka 的记录格式在 Producer、Broker 日志和 Consumer 之间具有较强一致性，可减少格式转换。支持条件满足时，Broker 还能利用零拷贝（Zero-Copy）路径把 Page Cache 中的数据传向网络。

启用 TLS 等情况下，数据路径可能需要经过用户态加密处理，不能笼统认为所有 Kafka 传输都使用零拷贝。

### 9.5 Partition 并行

不同 Partition 可以位于不同 Broker，并由不同 Consumer 并行处理。这使吞吐量可以通过水平扩展提高。

相应代价是：

- 全局顺序被拆成 Partition 内顺序。
- Partition 过多会增加元数据和运维成本。
- Key 倾斜会形成热点。
- Consumer 并行度受到 Partition 数量限制。

最终吞吐和延迟还受到消息大小、批次配置、压缩算法、副本数、确认策略、磁盘、网络、Partition 分布、Consumer 处理速度和安全协议等因素影响，不存在脱离环境的固定性能数字。[Kafka 官方设计：Persistence 与 Efficiency](https://kafka.apache.org/43/design/design/)

## 10. 常见部署与使用形态

| 形态 | 核心能力 | 解决的问题 | 适用场景 |
|---|---|---|---|
| 单节点 Broker + Controller | 最小 Kafka 环境 | 学习和功能验证 | 本地开发，不具备真正高可用 |
| 多 Broker KRaft 集群 | 分区、副本、故障转移 | 生产事件存储与分发 | 常规生产环境 |
| 独立 Controller Quorum + Broker 集群 | 控制面与数据面隔离 | 降低资源干扰，可分别扩展维护 | 关键生产环境 |
| Kafka + Connect | 标准化数据导入导出 | 外部系统集成 | CDC、数仓、搜索同步 |
| Kafka + Streams | 有状态或无状态流处理 | 实时转换、聚合、Join | 实时计算应用 |
| 多 Kafka 集群 + 跨集群复制 | 异地复制和区域隔离 | 容灾、迁移、跨地域分发 | 多数据中心架构 |

生产环境还应建立安全边界：

- 传输层安全（Transport Layer Security，TLS）用于加密网络通信。
- 简单认证与安全层（Simple Authentication and Security Layer，SASL）可用于客户端身份认证。
- 访问控制列表（Access Control List，ACL）用于限制主体对 Topic、Group 等资源的操作权限。

这些机制保护访问安全，但不会替代应用层的敏感字段加密、数据分类和合规治理。

## 11. 容易混淆的概念

| 概念 | 分别解决的问题 | 关键区别 |
|---|---|---|
| Topic 与 Partition | 逻辑分类；物理拆分 | Topic 包含多个 Partition，顺序和副本都以 Partition 为边界 |
| Partition 与 Replica | 并行与容量；冗余与恢复 | Partition 是不同数据分片，Replica 是同一分片的拷贝 |
| Broker 与 Controller | 保存和传输事件；管理元数据 | Broker 处理数据面，Controller 管理控制面 |
| Offset 与 Committed Offset | 标识日志位置；记录组的恢复进度 | Offset 属于记录，Committed Offset 属于 Consumer Group 的消费状态 |
| Consumer 与 Consumer Group | 执行读取；协调并行消费 | 同组成员分摊 Partition，不同组各自独立读取 |
| `acks` 与 Offset Commit | 确认生产写入；记录消费进度 | 一个属于生产可靠性，一个属于消费恢复 |
| Retention 与 Compaction | 按时间/大小删旧数据；按 Key 保留最新状态 | 前者关注记录年龄，后者关注是否存在更新值 |
| Key 与唯一主键 | 分区及业务关联；数据库唯一约束 | Kafka Key 默认不唯一，也不会自动拒绝重复 |
| Idempotence 与 Transaction | 消除重试重复；原子提交多项写入 | 幂等生产者保护单次发送重试，事务提供更大的原子边界 |
| At-Least-Once 与 Exactly-Once | 避免遗漏；避免可观察的重复结果 | EOS 需要明确的处理范围，尤其要区分 Kafka 内与外部副作用 |
| Replica 与 Backup | 在线故障转移；历史或灾难恢复 | Replica 会同步当前状态，不能独立抵御所有误操作 |
| Kafka 与 Kafka Streams | 事件存储分发平台；流处理库 | Kafka Broker 不会自动执行应用的聚合和 Join 逻辑 |

## 12. 完整概念图

```text
┌──────────────────────────── 控制面 ────────────────────────────┐
│ KRaft Controller Quorum                                       │
│   ├── Cluster Metadata                                        │
│   ├── Broker Registration                                     │
│   ├── Partition / Replica Assignment                          │
│   └── Leader Election                                         │
└────────────────────────────────────────────────────────────────┘
                              │ 管理
                              ▼
┌──────────────────────────── 数据面 ────────────────────────────┐
│ Kafka Broker Cluster                                           │
│                                                                │
│ Topic: orders                                                  │
│   ├── Partition 0                                              │
│   │     ├── Leader Replica  ── append / fetch                  │
│   │     └── Follower Replicas ── replication ──> ISR / HW      │
│   ├── Partition 1                                              │
│   └── Partition 2                                              │
│                                                                │
│ 每个 Partition：                                               │
│   Log Segments → Record Batches → Records(Key/Value/Offset)    │
│        │                                                       │
│        ├── Retention：按时间或大小清理                         │
│        └── Compaction：按 Key 保留最新状态                     │
└────────────────────────────────────────────────────────────────┘
          ▲ Produce                               │ Fetch
          │                                       ▼
┌──────────────────┐                    ┌─────────────────────────┐
│ Producer          │                    │ Consumer Group          │
│ Serializer        │                    │ Consumer A ← Partition 0│
│ Partitioner       │                    │ Consumer B ← Partition 1│
│ Batch/Compression │                    │ Consumer C ← Partition 2│
│ acks/Retry        │                    │ Offset Commit / Rebalance│
│ Idempotence/Txn   │                    └─────────────────────────┘
└──────────────────┘                                  │
                                                      ▼
                                         数据库、服务、Streams、
                                         搜索、数仓等下游系统
```

可以把整套知识归纳为五个认知层次：

1. 数据怎样表示：Record 属于 Topic，并实际追加到某个 Partition。
2. 请求怎样执行：Producer 找到 Leader 写入，Consumer 按 Offset 拉取。
3. 状态怎样管理：日志由 Retention 或 Compaction 清理，消费进度由 Committed Offset 保存。
4. 故障怎样处理：Replica、ISR、Leader Election 和 KRaft Quorum 分别保护数据面与控制面。
5. 系统怎样扩展：Partition 提供并行，Broker 承载分片，Consumer Group 分摊处理任务。

## 13. 第一阶段需要记住什么

1. Kafka 是分布式事件流平台，核心不是把消息尽快删除，而是持久保存并允许独立消费和重放。
2. Topic 是逻辑分类，Partition 才是日志、顺序、并发、复制和故障转移的基本边界。
3. Kafka 只保证单个 Partition 内的顺序，不保证 Topic 的跨 Partition 全局顺序。
4. Record Key 常用于让相关事件进入同一 Partition，但它不是自动唯一的数据库主键。
5. Producer 直接向 Partition Leader 写入；Follower 从 Leader 复制；Consumer 根据 Offset 拉取记录。
6. 同一个传统 Consumer Group 内，一个 Partition 同时由一个 Consumer 负责；不同 Group 可以各自完整消费。
7. 消费不会删除记录。Retention 和 Compaction 决定数据生命周期，Committed Offset 只记录消费恢复位置。
8. Partition 解决拆分与并行，Replica 解决冗余和故障转移，两者不能互相替代。
9. `acks=all`、合理的 `min.insync.replicas` 和多故障域副本能够提高持久性，但不等于任何情况下绝不丢数据。
10. Kafka 常见消费语义是至少一次，业务消费者仍需处理重复事件；Kafka 内置事务的精确一次能力有明确作用范围。
11. KRaft Controller Quorum 管理集群元数据；Kafka 4.x 已不再使用 ZooKeeper 模式。
12. Kafka 的高吞吐来自顺序追加、Page Cache、批处理、压缩、较少复制和 Partition 并行，同时付出延迟、资源、顺序范围和运维复杂度方面的代价。

## 14. 后续可以深入的问题

1. Producer 如何进行批处理、重试、超时控制和连接复用？
2. 默认分区策略如何工作，增加 Partition 为什么可能改变 Key 映射？
3. Kafka 日志段、稀疏索引和时间索引在磁盘上如何组织？
4. High Watermark、Log End Offset 和 Last Stable Offset 分别表示什么？
5. ISR 如何变化，Leader Election 怎样避免已提交数据被截断？
6. KRaft 元数据日志如何复制、选举和生成 Snapshot？
7. Consumer Group 的协调、心跳、Rebalance 和分配协议如何运行？
8. Offset 自动提交和手动提交分别有哪些重复或丢失窗口？
9. Idempotent Producer、Transaction Coordinator 和事务标记如何实现 EOS？
10. Log Compaction 如何选择日志段，并怎样处理 Tombstone？
11. 如何根据吞吐量、保留时间、消息大小和副本数进行容量规划？
12. 如何排查 Consumer Lag、热点 Partition、Under-Replicated Partition 和频繁 Rebalance？

## 15. 官方资料

- [Apache Kafka 当前官方文档](https://kafka.apache.org/documentation/)
- [Kafka 4.3 Getting Started](https://kafka.apache.org/43/getting-started/)
- [Kafka Design](https://kafka.apache.org/43/design/design/)
- [Kafka APIs](https://kafka.apache.org/43/apis/)
- [Producer 配置](https://kafka.apache.org/43/configuration/producer-configs/)
- [Consumer 配置](https://kafka.apache.org/43/configuration/consumer-configs/)
- [Topic 配置](https://kafka.apache.org/43/configuration/topic-configs/)
- [KRaft 运维文档](https://kafka.apache.org/43/operations/kraft/)
- [Kafka 基础运维](https://kafka.apache.org/43/operations/basic-kafka-operations/)
- [Kafka Connect](https://kafka.apache.org/43/connect/)
- [Kafka Streams](https://kafka.apache.org/43/streams/)
- [Kafka 安全文档](https://kafka.apache.org/43/security/)