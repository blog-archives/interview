---
title: 快速学习
order:
---


## 第一层：必须重点准备

这些最容易被后端面试官追问，目标是达到“能讲原理、能设计方案、能排查故障”。

| 主题 | 面试需要掌握 | 进阶追问 |
|---|---|---|
| Redis | 数据类型、持久化、过期与淘汰、主从/哨兵/Cluster、缓存穿透/击穿/雪崩 | 热点Key、大Key、分布式锁、缓存一致性、脑裂 |
| Kafka | Topic、Partition、Consumer Group、Offset、消息顺序、重复、丢失、积压 | ISR、ACK、Rebalance、幂等生产者、事务、KRaft |
| Elasticsearch | 倒排索引、Mapping、分词、查询、分片与副本、数据同步 | 深分页、Segment、Refresh、分片规划、混合检索 |
| 分布式系统 | CAP、最终一致性、幂等、重试、限流、熔断、降级 | Raft、分布式事务、Fencing Token、多机房容灾 |
| 微服务治理 | 注册发现、配置中心、RPC、网关、负载均衡 | 服务雪崩、超时传播、重试风暴、灰度发布 |
| 生产故障排查 | CPU高、内存高、接口慢、数据库慢、消息积压 | 链路追踪、容量规划、应急止损、事故复盘 |

### Redis重点问题

至少能够完整回答：

- Redis为什么快？
- 缓存穿透、击穿、雪崩分别是什么？
- MySQL更新成功但Redis删除失败怎么办？
- Redis分布式锁有什么问题？
- 大Key和热点Key如何发现、处理？
- Redis Cluster如何分片？
- 主从切换期间可能发生什么？

### Kafka重点问题

至少能够完整回答：

- Kafka为什么吞吐量高？
- 如何保证消息不丢失？
- 如何处理重复消费？
- 如何保证消息顺序？
- Consumer Group和Partition是什么关系？
- Rebalance为什么危险？
- 消息积压怎么处理？
- Kafka和RocketMQ、RabbitMQ怎么选择？

### Elasticsearch重点问题

至少能够完整回答：

- 倒排索引是什么？
- ES为什么适合搜索？
- ES写入后为什么不是立即可见？
- 分片数量是不是越多越好？
- MySQL和ES如何同步？
- ES深分页怎么解决？
- 全文检索、向量检索、混合检索有什么区别？

---

## 第二层：选择性深入

这些技术面试中经常出现，但不需要全部深入。每个方向选择一两个即可。

| 方向 | 推荐技术 | 面试目标 |
|---|---|---|
| 消息中间件 | RocketMQ、RabbitMQ | 能和Kafka进行选型对比 |
| 注册配置中心 | Nacos、Consul、etcd、ZooKeeper | 理解注册发现、配置推送、AP/CP |
| RPC | Dubbo、gRPC | 理解序列化、连接、超时、重试、负载均衡 |
| API网关 | Spring Cloud Gateway、Kong、APISIX | 理解认证、限流、路由、灰度 |
| 服务容错 | Sentinel、Resilience4j | 理解限流、熔断、隔离、降级 |
| 分布式事务 | Seata、事务消息、Saga | 能分析不同方案的代价 |
| 数据同步 | Canal、Debezium、Flink CDC | 理解全量+增量、断点恢复、数据一致性 |
| 任务调度 | XXL-JOB、Quartz、Temporal | 理解分片、幂等、失败重试 |
| 对象存储 | S3、MinIO | 上传、分片、签名URL、生命周期 |
| OLAP数据库 | ClickHouse、Doris、StarRocks | 知道为什么不用MySQL做大规模分析 |
| 向量数据库 | Milvus、Qdrant、pgvector | 理解向量索引、相似度和Metadata过滤 |

这一层不要求你背源码。面试标准是能回答：

> 它解决什么问题？为什么选择它？它的核心机制是什么？使用后会引入什么新问题？

---

## 第三层：云原生与工程化

目标是能够理解公司真实的部署和运维体系。

| 技术 | 准备程度 |
|---|---|
| Docker | 能编写镜像、理解分层、网络、Volume和资源限制 |
| Kubernetes | 理解Pod、Deployment、Service、Ingress、ConfigMap、探针和滚动发布 |
| Nginx | 反向代理、负载均衡、限流、超时配置 |
| CI/CD | 理解构建、测试、发布、灰度和回滚 |
| Prometheus | 理解指标采集和基本PromQL |
| Grafana | 能设计服务监控面板 |
| ELK/EFK | 理解集中式日志链路 |
| OpenTelemetry | 理解日志、指标、Trace的统一采集 |
| 云服务 | 认识计算、网络、对象存储、数据库、IAM |

Kubernetes暂时不用深入源码。面试准备到下面这个程度即可：

- 一个请求如何从Ingress进入Pod。
- Pod挂掉后为什么能够恢复。
- Deployment和StatefulSet的区别。
- Readiness和Liveness有什么区别。
- 发布新版本时如何灰度和回滚。
- 配置和密钥如何管理。

---

## 第四层：AI后端新技术

这是你用来增加“新技术敏感度”和项目亮点的部分。

### 1. LLM应用基础

需要了解：

- Token和上下文窗口。
- Prompt、System Prompt、Few-shot。
- 流式输出。
- 结构化输出。
- Tool Calling。
- Temperature等推理参数。
- 模型限流、超时、重试和降级。
- Token成本与模型路由。
- Prompt Injection和敏感信息泄露。

### 2. Embedding与向量检索

需要了解：

- Embedding是什么。
- 文本如何转换为向量。
- 余弦相似度、点积、欧氏距离。
- HNSW等近似最近邻索引解决什么问题。
- Metadata过滤。
- ES、pgvector和独立向量数据库的区别。

### 3. RAG

这是最值得后端求职者实践的AI方向。

基础链路：

```text
文档解析
  → 文档清洗
  → Chunk切分
  → Embedding
  → 向量/全文索引
  → 问题检索
  → Rerank
  → 拼接上下文
  → LLM生成答案
  → 返回引用
```

面试需要掌握：

- RAG解决什么问题。
- RAG和微调有什么区别。
- Chunk大小如何选择。
- Top K如何选择。
- 为什么不能只使用向量检索。
- BM25和向量混合检索是什么。
- Reranker有什么作用。
- 如何减少幻觉。
- 如何给答案添加引用。
- 如何实现文档权限隔离。
- 如何评估召回率和答案质量。
- 如何处理PDF表格、图片和复杂格式。

### 4. Agent、MCP和Workflow

建立认知即可：

| 技术 | 需要知道什么 |
|---|---|
| Tool Calling | 模型如何选择和调用后端工具 |
| Agent | 模型进行规划、执行、观察和继续决策 |
| Workflow | 使用固定流程控制AI执行 |
| MCP | AI应用连接外部工具和数据源的标准化方式 |
| Memory | 短期会话、摘要记忆、长期记忆 |
| Guardrails | 输入输出校验、权限和安全控制 |
| Evals | 使用测试集评估AI应用 |
| AI Gateway | 模型路由、限流、审计、成本管理 |
| AI Observability | Token、延迟、错误、检索结果和Prompt追踪 |

---

## 最终压缩后的学习顺序

按照面试收益排序：

1. Redis生产问题。
2. Kafka可靠性和消费模型。
3. Elasticsearch搜索与数据同步。
4. 幂等、重试、限流、熔断、分布式事务。
5. 微服务注册、配置、RPC和网关。
6. Docker、Kubernetes基本部署链路。
7. 日志、指标、链路追踪和故障排查。
8. Embedding、向量检索和RAG。
9. Agent、Tool Calling、MCP。
10. ClickHouse、Flink CDC等扩展技术。

前三项建议达到“能被连续追问20分钟”；第4～7项要能处理系统设计题；第8～9项适合做项目亮点；最后一项建立认知即可。

你的学习单位也不应该是“看完Kafka教程”，而应该是一个面试专题，例如：

> Kafka如何保证订单事件不丢失、不重复，并在消费积压时快速恢复？

围绕一个问题同时准备原理、方案、代码、故障和选型，效率会远高于从头读完整课程。