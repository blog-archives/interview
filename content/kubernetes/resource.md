---
title: 资源与弹性伸缩
order: 5
---

## requests、limits 和 QoS 分别是什么？

- `requests` 是调度和资源保障的依据。Scheduler 比较 Pod 请求总量与 Node 的 allocatable 资源；
- `limits` 是运行时上限，由容器运行时和内核 cgroup 执行；
- 容器可在有空闲资源时使用超过 request 的资源，但不能据此假设它永远拿得到这些资源。

如果只设置某种资源的 limit、没有显式设置 request，且准入阶段也未注入默认 request，Kubernetes 会把该 limit 复制为对应 request。

Pod 会根据所有容器的 CPU / 内存 requests 与 limits 被划分为 `Guaranteed`、`Burstable` 或 `BestEffort`。QoS 会影响节点资源压力和 OOM 场景下的保护程度，但实际驱逐排序还会考虑是否超过 request、Pod Priority 和超出比例，不能简单背成绝对固定顺序。

### 延伸问题

1. Node 当前使用率很低，为什么 Pod 仍可能 Pending？

> Scheduler 做容量判断主要看已分配 requests，而不是瞬时使用率。若没有任一节点能容纳新 Pod 的 requests，它就无法调度。

2. requests 和 limits 都不设置会怎样？

> 若所有容器都没有 CPU / 内存 request 和 limit，Pod 通常属于 BestEffort；它可以运行，但没有明确调度依据和资源保障，在资源压力下风险更高。

3. requests 是否设置得越大越好？

> 不是。过小会造成争抢和驱逐风险，过大则浪费可调度容量。应根据历史分位数、启动峰值、SLO 和压测持续校准，而不是照搬固定比例。

## CPU 和内存超过限制后分别会发生什么？

CPU limit 通常通过节流执行：容器不会仅因 CPU 超限直接被杀，但延迟和吞吐可能恶化，严重时探针超时又间接触发重启。

内存 limit 由内核以 OOM 机制反应式执行。容器尝试使用更多内存时，进程可能被 OOM Killer 终止；若 PID 1 退出，kubelet 再按 `restartPolicy` 处理容器。同一个 Pod 内的容器重启通常不会改变 Pod IP。

内存未超过容器 limit 也不代表绝不会 OOM 或被驱逐：节点整体内存压力、进程的 OOM 分数、QoS、Priority 和实际使用相对 request 的情况都会影响结果。

### 延伸问题

1. 内存超过 request 但没超过 limit 会怎样？

> request 不是运行时上限，节点有资源时可以继续使用；但节点出现内存压力时，超过 request 的工作负载更可能成为驱逐或 OOM 风险对象。

2. OOMKilled 会删除整个 Pod 吗？

> 通常先终止具体容器进程，Pod 对象仍在；容器是否重启取决于重启策略。若工作负载控制器最终替换整个 Pod，才会出现新 UID 和 IP。

3. 为什么只看平均内存不够？

> OOM 由瞬时峰值触发。容量评估要观察峰值、分位数、工作集、缓存和启动阶段，并区分容器 OOM 与节点级内存压力。

## Pod 一直处于 Pending，如何排查？

`Pending` 表示 Pod 已被集群接受，但一个或多个容器尚未完成创建。它既可能尚未调度，也可能已经绑定 Node、正在等待镜像或存储等准备步骤。

先执行：

```bash
kubectl get pod <pod> -n <namespace> -o wide
kubectl describe pod <pod> -n <namespace>
kubectl get events -n <namespace> --sort-by=.lastTimestamp
```

如果 `NODE` 为空且有 `FailedScheduling`，重点检查：

- CPU、内存、临时存储、GPU 等 requests；
- nodeSelector、亲和 / 反亲和、拓扑分布约束；
- taint / toleration 和 Pod Priority；
- PVC 是否绑定、存储拓扑是否满足；
- ResourceQuota、节点是否 Ready 且可调度。

如果已绑定 Node，则根据 Events 检查镜像拉取、Volume 挂载、CNI sandbox、Secret / ConfigMap 等问题。容器从未启动时没有业务日志，`kubectl logs` 不是第一入口。

### 延伸问题

1. PVC Pending 为什么会影响 Pod？

> Pod 需要的卷没有准备好时不能安全运行。对于 `WaitForFirstConsumer`，存储绑定会与 Pod 调度协同进行，需要同时看 Pod、PVC、StorageClass 和 CSI 事件。

2. ImagePullBackOff 算 Pending 吗？

> Pod phase 可能仍是 Pending，但容器状态会显示 `Waiting`，Reason 为 `ErrImagePull` 或 `ImagePullBackOff`。不要只看一列 STATUS 判断阶段。

## HPA 如何决定扩缩容？扩容后流量如何进入新 Pod？

HorizontalPodAutoscaler 是 API 对象和控制器，它周期性读取指标并修改 Deployment、StatefulSet 等可扩缩对象的期望副本数，不直接创建 Pod，也不负责流量转发。

它可使用 CPU、内存、自定义或外部指标。以 CPU 平均利用率为例，利用率基于实际使用量与 `requests.cpu` 的比值；相关容器缺少 CPU request 时，该 Pod 的利用率可能无法定义，从而影响扩缩容。资源指标通常由 Metrics Server 提供的 `metrics.k8s.io` API 获取。

控制器大致按当前副本数和“当前指标 / 目标指标”的比例计算期望副本数，并应用容忍范围、最小 / 最大副本、扩缩策略和稳定窗口，避免频繁抖动。

扩容后由工作负载控制器创建 Pod；新 Pod 启动并 Ready 后进入 Service 的 EndpointSlice，Service 数据面才可能把新连接转发给它。

### 延伸问题

1. HPA 会超过 `maxReplicas` 吗？

> 不会。容量规划必须考虑到达到 `maxReplicas` 后仍可能过载，并监控扩容受限、调度失败和冷启动时间。

2. CPU 降低后会立即缩容吗？

> 通常不会。默认行为包含容忍和缩容稳定机制，`behavior` 还可限制每个时间窗口的缩容速度，防止指标波动导致震荡。

3. 新 Pod Ready 后流量一定均匀吗？

> 不一定。长连接、连接池和代理算法都会影响分布。HPA 只提高 endpoint 数量，不等于现有连接会自动重平衡。

4. HPA 与手工修改 `replicas` 有什么冲突？

> HPA 会持续写目标对象的 scale；在 HPA 管理期间手工设置副本数可能很快被下一次调谐覆盖，应通过 HPA 的 min / max 和指标策略管理容量。
