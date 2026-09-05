---
title: 快速入门
order: 1
---

## 学习原则

这个目录只用于 **快速了解常见中间件和基础设施组件**。不在这里安排 Go、Linux、MySQL、Docker、Kubernetes、算法、架构思想或通用分布式理论。

清单按通用后端开发中的使用频率、重要性、面试常见度和知识迁移价值排列。同一类产品不要同时深入：先学排在最前面的代表实现，理解共同模型后，再了解其他产品的差异。

每项技术第一轮只需要做到：知道它解决什么问题、位于系统哪里、核心对象是什么、一次数据或请求如何流转、状态保存在哪里，以及它的故障和使用边界。

## 第一批：优先学习

这 9 项构成最值得优先建立的中间件知识地图，建议按照顺序学习。

| 顺序 | 中间件 | 为什么优先 |
|---:|---|---|
| 1 | [Redis](redis.md) | 最常见的缓存与内存数据组件，能自然引出过期、淘汰、持久化、高可用和分布式锁 |
| 2 | [Kafka](kafka.md) | 用它建立消息队列、事件流、分区、消费组、顺序、重复和积压的完整模型 |
| 3 | [Nginx](nginx.md) | 常见流量入口，适合学习反向代理、负载均衡、连接、超时和限流 |
| 4 | [Elasticsearch](es.md) | 常见搜索与分析引擎，重点理解倒排索引、Mapping、分片和查询链路 |
| 5 | [Prometheus](prometheus.md) | 主流指标监控系统，理解采集、时间序列、PromQL、规则和告警链路 |
| 6 | [Grafana](grafana.md) | 常见可视化与告警平台，理解 Data Source、Dashboard、Panel 和查询流程 |
| 7 | [OpenTelemetry](opentelemetry.md) | 可观测性数据的统一采集标准，理解 Trace、Metric、Log 和上下文传播 |
| 8 | gRPC | 常见服务间通信方案，理解 IDL、序列化、HTTP/2、Deadline 和流式 RPC |
| 9 | [etcd](etcd.md) | 云原生常见一致性 KV，适合学习 Watch、Lease、Raft 和配置状态管理 |

如果只准备完成一轮学习，就先到这里。Redis、Kafka、Nginx 和 Elasticsearch 偏业务基础设施；Prometheus、Grafana 和 OpenTelemetry 构成可观测性主线；gRPC 和 etcd 补足服务通信与控制状态。

## 第二批：常见扩展

完成第一批后再学习下面这些组件。它们很常见，但使用范围更依赖公司技术栈和业务类型。

| 顺序 | 中间件 | 学习重点 |
|---:|---|---|
| 10 | RabbitMQ | Exchange、Queue、Binding、路由、确认、重试和死信队列 |
| 11 | RocketMQ | Topic、Queue、Consumer Group、顺序消息、延迟消息和事务消息 |
| 12 | Nacos | 服务注册发现、健康检查、配置发布和客户端监听 |
| 13 | [ZooKeeper](zookeeper.md) | ZNode、Watch、Session、临时节点、选举和协调场景 |
| 14 | [Consul](consul.md) | Agent、Catalog、健康检查、服务发现和 Service Mesh 边界 |
| 15 | APISIX | 动态路由、插件、认证、限流、服务发现和网关控制面 |
| 16 | [Loki](loki.md) | 标签索引、日志流、LogQL，以及它和 Elasticsearch 日志方案的差异 |
| 17 | Jaeger 或 Tempo | Trace、Span、上下文传播、采样、存储和查询链路 |
| 18 | Debezium | Snapshot、变更事件、Offset、Schema 变化和 CDC 恢复过程 |
| 19 | MinIO | S3 对象模型、Bucket、Object、分片上传和签名 URL |
| 20 | [MongoDB](mongodb.md) | Document、Collection、索引、副本集、分片和事务边界 |
| 21 | [ClickHouse](clickhouse.md) | 列式存储、分区、排序键、MergeTree 和聚合查询 |
| 22 | Temporal | Workflow、Activity、事件历史、重试和长流程状态恢复 |

RabbitMQ 和 RocketMQ 不需要在 Kafka 之后立即全部深学。先用 Kafka 建立消息系统的共同模型，再根据岗位选择其中一个做差异学习即可。

## 第三批：特定岗位或场景再学

这些组件不是不重要，而是第一轮投入的通用收益较低。遇到明确项目需求或招聘要求时，再把对应项提前。

| 方向 | 中间件 | 适用情况 |
|---|---|---|
| 消息与事件流 | Pulsar、NATS | 多租户消息平台、云原生低延迟通信或岗位明确使用 |
| API Gateway | Kong、Traefik | 已理解 Nginx 和网关主流程，需要比较插件生态或运行方式 |
| Service Mesh | Envoy、Istio | 需要 Sidecar、mTLS、服务间流量治理和统一遥测 |
| CDC 与流处理 | Canal、Flink CDC | 使用 MySQL 生态或需要带计算能力的大规模数据同步 |
| OLAP | Doris、StarRocks | 已了解 ClickHouse，需要面向实时数仓做产品选型 |
| 任务调度 | XXL-JOB、Quartz | Java 项目需要分布式任务调度或进程内定时任务 |
| Java 微服务 | Dubbo、Sentinel、Seata | 目标岗位使用阿里系 Java 微服务技术栈 |
| Java 网络框架 | [Netty](netty.md) | 需要理解 Java 高性能网络框架、RPC 或网关底层实现 |

## 同类中间件应该怎么选

| 类别 | 第一个学习 | 后续了解顺序 |
|---|---|---|
| 缓存 | Redis | 暂时不需要同时寻找替代品 |
| 消息队列 | Kafka | RabbitMQ 或 RocketMQ → NATS 或 Pulsar |
| 代理与网关 | Nginx | APISIX 或 Kong → Envoy 与 Istio |
| 搜索与日志 | Elasticsearch | [Loki](loki.md)；[ELK](elk.md) 作为组合方案理解，不重复算作一个产品 |
| 指标与可视化 | Prometheus → Grafana | 再学习 OpenTelemetry 与统一可观测性 |
| 注册、配置与协调 | etcd | Nacos、ZooKeeper、Consul 按岗位选择 |
| 分布式追踪 | OpenTelemetry | Jaeger 或 Tempo |
| CDC | Debezium | Canal 或 Flink CDC |
| OLAP | ClickHouse | Doris 或 StarRocks |

## 推荐执行顺序

1. 依次完成 Redis、Kafka、Nginx 和 Elasticsearch。
2. 接着完成 Prometheus、Grafana 和 OpenTelemetry，形成完整可观测性认识。
3. 再学习 gRPC 和 etcd，补充服务通信与控制状态。
4. 从第二批中根据岗位选择，不要求全部学习。
5. 第三批只保持定位认知，出现实际需求后再深入。

现有文档中已经包含 Redis、Kafka、Nginx、Elasticsearch、ELK、Loki、Prometheus、Grafana、OpenTelemetry、etcd、ZooKeeper、Consul、MongoDB、ClickHouse 和 Netty。后续新增文档时，优先补齐第一批缺少的 gRPC，然后再按照第二批顺序扩展。
