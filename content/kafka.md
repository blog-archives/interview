---
title: kafka
---

# 一、Kafka 基础定义

Kafka 是一款**分布式、高吞吐、可持久化**的消息中间件（消息队列），核心基于发布\-订阅（Pub/Sub）模型设计。区别于传统消息队列，其本质是一套**分布式事件日志系统**，核心优势是高吞吐、数据可回溯、支持多消费组复用数据，广泛应用于大数据、实时数据流、系统解耦等场景。

## 1\.1 核心核心组件

- **Producer（生产者）**：消息发送方，负责向Kafka集群的指定主题推送消息数据。

- **Broker（服务节点）**：Kafka的服务实例，多个Broker节点共同组成Kafka集群。所有消息数据最终存储在Broker节点中，是集群的核心存储与服务载体。

- **Topic（主题）**：消息的逻辑分类单元，所有消息都归属指定Topic，是生产者推送、消费者订阅的核心对象。

- **Partition（分区）**：Topic的物理拆分单元，是Kafka最小数据存储单元。一个Topic可拆分为多个分区，分区可分布式部署在不同Broker节点，实现水平扩容与并行读写。

- **Consumer（消费者）**：消息读取方，负责订阅Topic、拉取并处理消息。

- **ConsumerGroup（消费组）**：消费者逻辑集合，组内所有消费者订阅同一个Topic。核心规则：**一个分区同一时间只能被消费组内一个消费者消费**，天然实现消费端负载均衡。不同消费组可独立消费同一Topic的全量数据，实现数据复用。

- **Offset（位移/游标）**：消息消费位置的唯一标记，属于「消费组\+Topic\+分区」的组合维度，用于记录消费组在对应分区的消费进度，支持消息回溯、重复消费。

## 1\.2 底层核心特性

Kafka 高性能、高可靠的核心底层设计：

1. **顺序磁盘读写**：所有消息采用日志追加式写入磁盘，规避随机IO开销，磁盘读写效率接近内存。

2. **零拷贝机制**：基于Linux sendfile系统调用，数据无需经过应用程序用户缓冲区，直接在内核空间完成转发，减少CPU拷贝与上下文切换，大幅提升吞吐。

3. **数据持久化**：消息消费后不会立即删除，根据预设的保留时间、存储大小策略自动清理，支持历史数据回溯重放。

4. **PageCache 缓存**：消息优先写入操作系统内核缓冲区，规避频繁磁盘IO，大部分热点消息可直接从内存读取。

# 二、消息队列核心价值与Kafka差异化优势

## 2\.1 通用MQ核心能力

所有消息队列的通用核心价值，Kafka均完美支持：

- **解耦**：上下游系统通过消息队列通信，无需直接依赖，降低系统耦合度。

- **异步**：同步流程转为异步处理，提升接口响应速度与系统吞吐量。

- **削峰**：瞬时高并发请求落队缓存，下游匀速消费，避免流量峰值压垮业务系统。

## 2\.2 Kafka 差异化核心优势

相较于RabbitMQ、RocketMQ等传统消息队列，Kafka核心定位是**分布式事件日志系统**，差异化能力如下：

1. 分区\+多副本（ISR）架构，集群高可用、支持水平扩容；

2. 顺序写磁盘\+PageCache\+零拷贝，吞吐能力远超常规MQ，适配海量数据场景；

3. 消息持久化留存，不随消费删除，支持多消费组复用同一份数据；

4. 支持Offset灵活重置，可回溯、重放任意历史留存数据。

# 三、Kafka 适用与不适用场景

## 3\.1 核心适用场景

- **日志/业务埋点采集（经典场景）**：接收前端、后端海量埋点日志、操作日志，统一上报后对接ELK、Flink完成日志分析、监控统计。

- **大数据实时计算**：作为实时流计算核心数据源，对接Flink、Spark Streaming，实现实时统计、实时预警、数据聚合。

- **高吞吐异步解耦**：高QPS业务场景，如订单支付完成后，通过Kafka推送事件，下游积分、短信、物流、通知等模块独立异步消费。

- **事件溯源**：完整记录业务全量变更事件，可通过回放历史事件，重建业务最新状态，适配金融、订单溯源场景。

- **大促流量削峰**：秒杀、电商大促等瞬时高并发场景，将突发请求落队缓存，下游限流匀速消费，保障系统稳定性。

- **异构系统数据同步**：采集数据库Binlog日志投递至Kafka，同步至ES、数据仓库、备份库，实现跨系统数据一致性同步。

## 3\.2 不适用场景

- **强一致性、严格事务场景**：Kafka事务仅支持分区内原子写，无法保证全局事务；且存在天然重复消费可能，无法满足金融转账、核心交易等100%不丢、不重复的严苛场景，业务必须自行实现幂等。

- **低延迟、少量消息场景**：Kafka默认开启批量攒消息机制，少量消息会存在批处理延迟，追求毫秒级极低延迟的场景优先选用RabbitMQ。

- **消息即时销毁场景**：Kafka为持久化存储，消息不会消费后立即删除，需等待系统策略清理，会产生固定磁盘开销。

- **严格全局消息有序**：仅支持**单分区内消息有序**，多分区无法保证全局有序；强制全局有序需单分区部署，彻底丧失并行扩容能力。

- **延迟队列、任务调度**：原生不支持延迟消息、死信队列，无定时任务调度能力，自定义封装成本高。

- **小规模简单业务**：低QPS、简单业务场景下，部署维护Kafka集群成本过高，性价比极低。

# 四、消息模型与核心机制详解

## 4\.1 两大消息收发模型

- **点对点（P2P）**：一条消息仅能被一个消费者消费，消费后对其他消费者不可见。

- **发布\-订阅（Pub/Sub）**：一条消息可被多个消费组/消费者独立消费，数据可复用。

RabbitMQ、RocketMQ 原生支持两种模型；**Kafka 原生核心范式为发布\-订阅模型**，所有设计均围绕多消费组数据复用打造。

## 4\.2 Topic 与 Partition 核心机制

Topic是消息逻辑分类，Partition是Topic的物理拆分单元，也是Kafka最小存储与并行单元：

1. 消息写入时，根据消息Key哈希路由至指定分区，**相同Key的消息必然落入同一分区**，保障单Key消息有序；

2. 多个分区可分布式部署在不同Broker节点，分区数量越多，集群并行读写、扩容能力越强；

3. 单分区内消息严格**顺序追加写入**，每条消息拥有唯一Offset位移。

## 4\.3 消费组与 Offset 核心原理

### 4\.3\.1 消费组特性

消费组为逻辑概念，无需手动创建，由消费者配置的 `group.id` 自动映射生成：

- 消费者通过 `subscribe()` 订阅Topic时，必须指定 group\.id，走消费组负载均衡机制；

- 消费者通过 `assign()` 指定具体分区消费时，无需配置 group\.id。

### 4\.3\.2 Offset 存储与推进机制

Offset 是「消费组\+Topic\+Partition」的专属消费游标，记录对应分区的消费进度，核心规则：

1. Offset 持久化存储在Broker的内置主题`__consumer_offsets` 中；

2. Broker仅负责Offset持久化存档，**消费者拉取消息的依据是自身Fetch请求携带的Offset**，不会主动读取Broker存档；

3. 消费者执行Commit操作后，才会将内存中的消费进度同步更新至Broker持久化存档；

4. 存档的核心作用：消费者重启、集群Rebalance（消费者变更、分区重分配）时，新消费者可从Broker读取历史Offset，接续消费，避免进度丢失。

### 4\.3\.3 消息回溯与重复消费原理

回溯重放的本质是**修改Broker中消费组的Offset游标**，具体流程：

1. 停止对应消费组的所有消费者实例；

2. 通过命令行或API，将目标分区的消费组Offset修改为历史位置；

3. 重启消费者，实例从Broker获取更新后的历史Offset，重新拉取后续消息，完成回溯；

4. 前提：需要回溯的历史消息未被Kafka保留策略清理。

### 4\.3\.4 主流MQ Offset机制对比

- **Kafka**：消费组模式下Offset统一持久化在Broker，游标由消费者主动提交推进，集群统一维护消费进度；

- **RocketMQ**：集群消费Offset存Broker，广播消费Offset存消费者本地；

- **RabbitMQ**：无Offset概念，以单条消息为粒度管理状态（ready/unacked），消费者ACK后消息立即删除，无进度游标。

## 4\.4 ISR 副本机制

ISR（In\-Sync Replicas）是Kafka高可用的核心机制：

1. ISR是**分区Leader节点在内存维护的动态副本同步名单**，非磁盘持久化数据，Leader切换后会重新生成；

2. 名单仅包含与Leader数据进度完全同步的Follower副本；

3. 核心作用：用于判断`acks=all` 写入成功条件、筛选Leader故障后的备选节点；

4. 动态伸缩：Follower副本数据滞后会被踢出ISR，追上同步进度后可重新加入。

## 4\.5 消息写入与刷盘机制

### 4\.5\.1 消息完整写入流程

1. 生产者将消息推送至分区Leader副本所在的Broker节点；

2. Leader接收消息，执行write系统调用，写入本机操作系统**PageCache（内核内存）**，暂不刷物理磁盘；

3. Leader将消息同步发送给ISR集合中所有Follower副本；

4. 所有Follower接收消息后，同样写入本机PageCache，不主动刷盘；

5. 所有Follower完成PageCache写入后，向Leader返回ACK确认；

6. Leader收到全部ISR副本ACK后，向生产者返回消息写入成功；

7. 后续由Linux系统后台异步将PageCache脏页数据刷入物理磁盘，Kafka不干预刷盘时机。

### 4\.5\.2 ACK 与 fsync 区别

- **ACK**：确认所有ISR副本已将消息写入PageCache内核内存，代表消息写入成功；

- **fsync**：强制将PageCache内存数据落地物理磁盘，实现持久化；

- 两者相互独立，Kafka默认不主动执行fsync，依靠系统异步刷盘保障性能。

## 4\.6 高吞吐核心：PageCache \+ 零拷贝

Kafka消费端超高吞吐的核心组合机制：

1. 生产者写入的消息优先存储在PageCache，热点消息无需读取磁盘；

2. 消费者拉取消息时，数据直接从PageCache读取；

3. 通过sendfile零拷贝机制，数据从PageCache直接转发至Socket、网卡，最终送达消费者；

4. 全程无磁盘IO、无JVM堆内存拷贝、无用户态与内核态多余切换，极致提升吞吐。

核心区分：PageCache 规避**磁盘IO开销**，零拷贝 规避**内存拷贝与上下文切换开销**。

# 五、Go 语言 Kafka 实操代码（sarama）

基于 `Shopify/sarama` 客户端，实现同步生产者、消费组消费者完整示例，可直接运行测试。

## 5\.1 同步生产者代码

```go
package main

import (
        "fmt"
        "log"

        "github.com/Shopify/sarama"
)

func main() {
        // 1. 配置
        config := sarama.NewConfig()
        config.Producer.RequiredAcks = sarama.WaitForAll // ACK策略
        config.Producer.Return.Successes = true          // 开启成功返回

        // 2. 创建同步生产者
        brokers := []string{"127.0.0.1:9092"}
        producer, err := sarama.NewSyncProducer(brokers, config)
        if err != nil {
                log.Fatalf("创建生产者失败: %v", err)
        }
        defer producer.Close()

        topic := "test_topic"

        // 3. 构造消息
        msg := &sarama.ProducerMessage{
                Topic: topic,
                // Key可以为空，Value是消息体
                Value: sarama.StringEncoder("hello kafka, this is go message"),
        }

        // 4. 发送消息
        partition, offset, err := producer.SendMessage(msg)
        if err != nil {
                log.Fatalf("发送消息失败: %v", err)
        }

        fmt.Printf("消息发送成功, partition=%d, offset=%d\n", partition, offset)
}
```

## 5\.2 消费组消费者代码

```go
package main

import (
        "context"
        "fmt"
        
        "log"
        "os"
        "os/signal"
        "syscall"

        "github.com/Shopify/sarama"
)

type consumerHandler struct{}

// 消费消息回调
func (h *consumerHandler) Setup(session sarama.ConsumerGroupSession) error {
        return nil
}

func (h *consumerHandler) Cleanup(session sarama.ConsumerGroupSession) error {
        return nil
}

func (h *consumerHandler) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
        // 循环接收消息
        for msg := range claim.Messages() {
                fmt.Printf("收到消息 topic=%s partition=%d offset=%d value=%s\n",
                        msg.Topic, msg.Partition, msg.Offset, string(msg.Value))

                // 标记这条消息消费完成，自动提交offset（根据配置）
                session.MarkMessage(msg, "")
        }
        return nil
}

func main() {
        config := sarama.NewConfig()
        config.Version = sarama.V2_6_0_0
        config.Consumer.Group.Rebalance.GroupStrategies = []sarama.BalanceStrategy{sarama.NewBalanceStrategyRange()}
        config.Consumer.Offsets.AutoCommit.Enable = true  // 开启自动提交offset
        config.Consumer.Offsets.AutoCommit.Interval = 1000 // 自动提交周期ms

        brokers := []string{"127.0.0.1:9092"}
        groupID := "test-group-01"
        topics := []string{"test_topic"}

        // 创建消费组客户端
        client, err := sarama.NewConsumerGroup(brokers, groupID, config)
        if err != nil {
                log.Fatalf("创建消费组失败:%v", err)
        }
        defer client.Close()

        // 监听退出信号
        ctx, cancel := context.WithCancel(context.Background())
        sigChan := make(chan os.Signal, 1)
        signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
        go func() {
                <-sigChan
                fmt.Println("\n收到退出信号")
                cancel()
        }()

        handler := &consumerHandler{}
        fmt.Println("消费者启动，等待消息...")

        // 循环消费（发生rebalance之后会再次调用Consume）
        for {
                err := client.Consume(ctx, topics, handler)
                if err != nil {
                        log.Printf("Consume err: %v", err)
                }
                if ctx.Err() != nil {
                        break
                }
        }
        fmt.Println("消费者退出")
}
```

# 六、主流MQ核心定位对比

- **Kafka**：核心定位**分布式事件日志系统**，追加日志存储、数据持久化可回溯、高吞吐、多消费组复用，适配大数据、流式场景；

- **RocketMQ**：底层基于日志存储，定位偏向**业务消息队列**，兼顾高吞吐与业务事务能力；

- **RabbitMQ**：传统队列模型，以单条消息为粒度管理生命周期，消费ACK后立即删除消息，主打低延迟、业务灵活适配，不适合海量数据场景。
