---
title: CDC：数据库变更数据捕获
order: 3
---

## 1. CDC 是什么

CDC 是 **Change Data Capture（变更数据捕获）**。可以把它理解为数据库的“变更监听器”：它读取数据库的变更日志，例如 MySQL Binlog，捕获表中的 `INSERT`、`UPDATE`、`DELETE`，再把这些变化同步到其他系统。

一个常见链路是：

```text
MySQL → CDC 工具 → Kafka → Elasticsearch / ClickHouse / 缓存 / 数仓
```

CDC 关注的是“数据库里实际发生了什么变化”，而不是周期性查询整张表。很多工具还支持首次读取存量数据，再持续消费增量日志。

这篇总览用于先建立 CDC 的共同模型；三个工具的运行方式、状态和具体案例见：[Debezium](debezium.md)、[Flink CDC](flink-cdc.md)、[Canal](canal.md)。建议先读 Debezium 建立“快照 + 日志 + Kafka”的基础，再按工作负载比较 Flink CDC 与 Canal。

## 2. 为什么需要 CDC

在没有 CDC 时，常见做法是业务双写或定时轮询。

| 方案 | 做法 | 主要问题或特点 |
| --- | --- | --- |
| 业务双写 | 业务代码同时写数据库和 MQ、搜索等下游 | 侵入业务；部分写入失败时，需要处理一致性和补偿 |
| 定时轮询 | 定期查询更新时间或扫描数据 | 有额外数据库压力；存在扫描间隔；删除等变化较难可靠识别 |
| CDC | 读取数据库变更日志并投递下游 | 业务侵入较小；能够捕获数据库真实的增删改；但仍需处理延迟、重复、顺序和故障恢复 |

CDC 的核心价值是：

- **减少业务侵入**：同步逻辑与核心业务代码解耦。
- **避免频繁轮询**：直接消费变更日志，降低无效查询和扫描压力。
- **捕获真实落库结果**：以下游可消费的事件形式还原数据库中的实际变化。

需要注意：CDC 通常提供近实时的数据同步，但不能简单理解为“绝对比业务 MQ 更实时”。业务在执行过程中直接发送 MQ，链路可能更短；CDC 一般要等待事务提交并读取日志。二者的主要区别是数据来源、业务侵入程度和一致性处理方式。

## 3. 适用场景

- 将数据库变更发送到 Kafka，供多个下游异步消费。
- 同步到 Elasticsearch 等搜索系统，更新搜索索引。
- 同步到 ClickHouse、数据仓库或数据湖，建设实时分析链路。
- 根据数据库变化刷新或失效缓存。
- 在不同数据库、存储系统或微服务之间做实时、增量数据同步。
- 对变更数据做过滤、转换、关联、聚合等实时 ETL。

CDC 更适合“以数据库实际变更为事实来源”的数据同步。若事件需要表达明确的业务语义，例如“订单已支付”或“退款审核通过”，业务事件或 MQ 往往更直接；数据库某个字段发生变化，不一定能完整表达业务含义。

## 4. 主流工具

### [Debezium](debezium.md)

Debezium 是通用、专业的 CDC 工具，支持 MySQL、PostgreSQL 等多种数据库，并且与 Kafka Connect、Kafka 生态结合良好。它适合多数据库接入，或以 Kafka 作为数据总线的系统。

### [Canal](canal.md)

Canal 主要聚焦 MySQL Binlog 解析和增量订阅。它的能力范围更集中，使用相对直接，常见于 MySQL 数据同步、缓存更新和搜索索引更新等场景。

### [Flink CDC](flink-cdc.md)

Flink CDC 可以将数据库变更直接接入 Flink，在捕获数据之后继续完成过滤、转换、关联、聚合和实时 ETL。若系统已有 Flink 体系，接入和后续计算通常会更顺手。

其他 CDC 或数据集成方案还有 Maxwell、SeaTunnel、Kafka Connect 的各类数据库连接器，以及部分云厂商的数据同步服务。面试中优先掌握 Debezium、Canal 和 Flink CDC 即可。

## 5. Debezium、Canal、Flink CDC 对比

| 工具 | 核心定位 | 数据库支持 | 主要生态 | 优点 | 缺点 | 适用场景 |
| --- | --- | --- | --- | --- | --- | --- |
| [Debezium](debezium.md) | 通用、专业的 CDC | 较广，支持 MySQL、PostgreSQL 等多种数据库 | Kafka Connect、Kafka；也可用其他运行方式 | 连接器成熟；多数据库能力强；适合标准化事件流 | 组件和配置相对多；运维 Kafka Connect 体系有一定成本 | 多数据库接入；数据库变更进入 Kafka；事件流平台 |
| [Canal](canal.md) | 聚焦 MySQL Binlog 的增量订阅 | 主要面向 MySQL | 国内 MySQL 技术栈；可对接 MQ、搜索、缓存等 | 定位集中；链路直观；MySQL 场景使用相对直接 | 数据库类型受限；复杂数据加工通常需要额外组件 | 主要使用 MySQL，需求较简单；更新 ES、缓存或同步数据 |
| [Flink CDC](flink-cdc.md) | CDC + Flink 实时数据处理 | 支持多种常见数据库，具体取决于连接器 | Flink、Flink SQL、实时数仓 | 捕获后可直接过滤、转换、关联、聚合；适合实时 ETL | 引入和运维 Flink 有成本；简单同步场景可能偏重 | CDC 后继续实时计算；实时数仓；已有 Flink 体系 |

核心记忆：

> **Debezium = 通用专业 CDC；Canal = 聚焦 MySQL CDC；Flink CDC = CDC + 实时数据处理。**

## 6. 极简选型总结

- **多数据库或 Kafka 体系**：优先考虑 [Debezium](debezium.md)。
- **主要是 MySQL，需求简单直接**：可以考虑 [Canal](canal.md)。
- **CDC 之后还要实时计算，或已有 Flink 体系**：优先考虑 [Flink CDC](flink-cdc.md)。

面试时可以这样口述：

> CDC 是通过 MySQL Binlog 等数据库变更日志，捕获增删改并同步到 Kafka、搜索、缓存或数仓的技术。它相比业务双写更少侵入业务，相比轮询能减少扫描压力，并且捕获的是实际落库变化，但不代表一定比业务 MQ 更实时。工具上，Debezium 更通用并适合 Kafka 体系，Canal 更聚焦 MySQL，Flink CDC 则适合在捕获变更后继续做实时 ETL 和计算。
