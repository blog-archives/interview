---
title: Pod 与工作负载
order: 2
---

## 什么是 Pod？为什么 Kubernetes 不直接以容器为调度单位？

Pod 是 Kubernetes 中最小的可部署、可调度单元。一个 Pod 包含一个或多个需要紧密协作的容器，它们总被调度到同一 Node，共享 Pod 网络命名空间和 IP，可以通过 `localhost` 通信；还可以挂载同一个 Volume 共享文件。

容器默认仍有独立的根文件系统，资源 request / limit 也通常按容器设置。进程命名空间默认不共享，只有显式开启 `shareProcessNamespace` 才能互相看到进程。

大多数业务 Pod 只有一个主容器。只有当辅助能力必须与主容器共享网络、文件和生命周期时，才适合使用 sidecar；两个需要独立发布和扩缩容的微服务不应放进同一个 Pod。

> 容器重启和 Pod 被替换有什么区别？

容器重启通常发生在同一个 Pod 内，Pod UID 和 IP 不变；Pod 被删除、驱逐或替换后会创建新对象，UID 和 IP 通常改变。Pod 不是“重启后还是原来的机器”。

> Pod IP 稳定吗？

只在 Pod 生命周期内相对稳定。调用方应通过 Service 发现一组可替换的 Pod，而不是把某个 Pod IP 写进配置。

> Init Container 和 Sidecar 有什么区别？

Init Container 在业务容器启动前按顺序完成初始化；Sidecar 与主容器长期协作。原生 sidecar 以特殊的可重启 Init Container 表达，是否使用要结合集群版本与实现。

## Deployment、StatefulSet、DaemonSet、Job 分别适合什么场景？

| 对象 | 语义 | 常见场景 |
|---|---|---|
| Deployment | 管理可替换的无状态副本，支持滚动更新和回滚 | API、Web、消费者 |
| StatefulSet | Pod 有稳定序号、网络身份和存储绑定 | 数据库、需要成员身份的有状态集群 |
| DaemonSet | 在每个符合条件的 Node 上运行一个 Pod | 日志采集、监控 Agent、网络或存储节点组件 |
| Job | 确保一次性任务成功完成指定次数 | 数据迁移、离线处理 |
| CronJob | 按计划创建 Job | 定时清理、周期报表、备份触发 |

StatefulSet 只提供稳定身份、顺序和存储绑定，不会自动解决数据库复制、选主、数据一致性、备份和恢复；这些仍依赖数据库自身、Operator 或托管服务。

> Deployment 和 StatefulSet 最核心的区别是什么？

Deployment 的副本通常同质且可互换；StatefulSet 的每个副本有稳定序号，例如 `mysql-0`，并常通过 `volumeClaimTemplates` 绑定各自的 PVC。

> DaemonSet 为什么通常不配置 `replicas`？

副本数由满足调度条件的节点数决定。新增合格 Node 时控制器会创建 Pod，Node 移除后对应 Pod 也会被处理。

> CronJob 能保证任务绝对只执行一次吗？

不能把调度语义当成业务 exactly-once。任务可能错过、并发或重复创建，业务处理仍应幂等，并合理配置 `concurrencyPolicy`、截止时间和历史保留数量。

## `replicas` 如何实现自愈？副本多就一定高可用吗？

`replicas` 表示期望副本数。Deployment 管理 ReplicaSet，ReplicaSet 持续比较实际 Pod 数量与目标：少了就创建，多了就删除。新 Pod 仍需经过调度、拉取镜像、挂载、启动和就绪检查，因此“已补对象”不等于“容量已经恢复”。

副本多不必然高可用。如果副本落在同一 Node 或同一可用区，仍可能被单点故障一起影响；还要结合拓扑分布约束或反亲和性、PodDisruptionBudget、足够的备用资源，以及下游容量设计。

> 为什么不手动创建多个 Pod？

裸 Pod 不会因为进程或节点故障自动出现替代对象，也不便统一扩缩容和发布。生产服务通常交给工作负载控制器管理。

> PodDisruptionBudget 能防止所有 Pod 中断吗？

不能。PDB 主要约束使用 Eviction API 的自愿中断，例如节点维护；它不能阻止节点宕机等非自愿中断，也不能替代多副本和合理分布。

## Deployment 如何滚动更新？失败时如何处理？

更新 Pod 模板后，Deployment 创建新 ReplicaSet，并按策略逐步扩新、缩旧：

- `maxSurge`：更新期间允许超过期望副本数的最大数量；
- `maxUnavailable`：更新期间允许不可用的最大数量；
- `minReadySeconds`：Pod Ready 后至少稳定多久才算 Available；
- `progressDeadlineSeconds`：用于报告发布进度停滞，不会自动完成回滚。

新 Pod 通过 readiness 后才成为常规 Service 后端。失败时先看 rollout 状态、Events、Pod 日志和探针；若新版本存在风险，先暂停或回滚恢复服务，再保留现场定位镜像、配置、资源、依赖或探针问题。

```bash
kubectl rollout status deployment/<name> -n <namespace>
kubectl rollout history deployment/<name> -n <namespace>
kubectl rollout undo deployment/<name> -n <namespace>
```

> `Running` 但不 `Ready` 的新 Pod 会怎样？

进程已运行，但尚不能接收常规 Service 流量。若一直无法 Ready，发布可能停滞，旧副本是否继续保留取决于滚动更新参数和当前可用数量。

> 滚动更新、蓝绿发布和金丝雀发布有什么区别？

滚动更新逐批替换副本；蓝绿同时保留两套完整环境并一次切流；金丝雀先让少量用户或流量访问新版本，再逐步扩大。后两者通常需要额外的网关、Ingress Controller、Service Mesh 或发布平台能力。

## Liveness、Readiness、Startup Probe 分别解决什么问题？

| 探针 | 判断的问题 | 失败后的主要动作 |
|---|---|---|
| Liveness | 容器是否陷入不可恢复的异常 | kubelet 终止容器，再按 `restartPolicy` 处理 |
| Readiness | 容器当前是否可以接收流量 | 标记 NotReady，从匹配 Service 的常规后端移除，不重启容器 |
| Startup | 慢启动应用是否已经启动成功 | 成功前不执行 liveness 和 readiness；持续失败则重启容器 |

健康检查要低成本且语义分离。Liveness 应只反映“重启有望恢复”的应用自身故障，不要把短暂的数据库或 Redis 故障直接变成全体实例重启；Readiness 可以反映处理核心请求所必需的依赖，但要防止依赖抖动造成所有副本同时摘流。

慢启动 Go 服务通常同时配置 Startup 和 Readiness：Startup 给初始化留出时间，Readiness 在配置加载、缓存预热等工作完成后才成功。Go 进程还应正确处理 SIGTERM，实现优雅退出。

> Startup Probe 成功前，Readiness 会执行吗？

不会。配置 Startup Probe 后，liveness 和 readiness 都要等它成功后才开始执行。这也是原笔记中需要纠正的一处。

> 探针过严有什么风险？

超时太短、阈值太低或检查外部依赖，可能在高负载时制造误判和级联故障。要结合正常延迟和启动时间设置 `timeoutSeconds`、`periodSeconds`、`failureThreshold`。

> 没配置 Liveness，进程崩溃还会重启吗？

可以。容器进程退出后，kubelet 会按 Pod 的 `restartPolicy` 处理。Liveness 主要用于进程没退出但已死锁或无法继续工作的情况。
