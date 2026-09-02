## requests 和 limits 的区别是什么？

requests 表示容器正常运行预期需要的资源，K8s 会根据它进行调度；limits 表示容器运行时最多能使用的资源。CPU 超过 limit 一般会被限速，内存超过 limit 才可能被 OOM Kill。

### 延伸问题

1. K8s 调度 Pod 时主要看 requests 还是 limits？

> 主要看 requests。Scheduler 会根据 Pod 的 requests 和节点剩余的可分配资源，判断节点能否容纳这个 Pod。

2. 如果节点实际资源很空闲，容器可以使用超过 requests 的资源吗？

> 可以。requests 不是运行时上限，只要节点还有空闲资源，并且没有超过 limits，容器就可以继续使用。

3. CPU 使用量超过 limits 后，容器会被杀掉吗？

> 通常不会。CPU 超过 limit 后一般会被节流，表现为程序运行变慢、请求延迟升高。

4. 内存使用量超过 limits 后会发生什么？

> 容器可能被 OOM Kill。之后是否重新启动，取决于 Pod 的重启策略，常见工作负载中的容器通常会被重新拉起。

5. 节点明明还有空闲资源，为什么 Pod 仍然可能处于 Pending？

> 因为调度器主要根据 requests 计算，而不是根据节点当时的实际使用量。如果 Pod 的 requests 大于任何节点剩余的可分配资源，就无法完成调度。

## 不配置资源请求和限制，可能产生什么问题？

不配置 requests，调度器就无法准确判断 Pod 需要多少资源，可能把它调度到一个看似能放、实际资源已经很紧张的节点上。
不配置 limits，容器就缺少明确的使用上限，异常时可能大量消耗节点资源，影响其他 Pod。
如果两者都不配置，Pod 通常属于 BestEffort，节点资源紧张时更容易被驱逐或被 OOM Kill。

### 延伸问题

1. requests 和 limits 都不配置时，Pod 一定无法运行吗？

> 不会。Pod 通常仍然可以运行，但调度器无法准确评估它的资源需求，而且它通常属于 BestEffort，资源紧张时保障最低。

2. 只配置 requests、不配置 limits 会怎样？

> Pod 可以获得合理的调度依据，但运行时没有明确上限。它可以使用超过 requests 的资源，异常时可能占用大量节点资源。

3. 只配置 limits、不配置 requests 会怎样？

> 如果没有其他默认规则，K8s 通常会把 limit 同时作为 request。这样调度器会按照 limit 来计算资源需求，可能降低节点的资源利用率。

4. 为什么没有配置资源的 Pod 更容易被驱逐？

> 因为 requests 和 limits 都未配置时，Pod 通常属于 BestEffort。在节点资源紧张时，K8s 会优先处理资源保障等级较低的 Pod。

5. requests 和 limits 是不是设置得越大越好？

> 不是。设置过小可能导致限速、OOM 或运行不稳定；设置过大又会浪费可调度容量，导致其他 Pod 无法调度。通常需要结合监控数据和业务峰值合理设置。

## CPU limit 与内存 limit 超出后分别可能发生什么？

CPU 超过 limit 时，容器通常不会被杀掉，而是受到 CPU 节流，程序运行变慢、请求延迟可能升高。
内存超过 limit 时，会触发容器级别的 OOM，进程可能被 OOM Killer 杀掉，容器因此退出。

### 延伸问题

1. CPU 被节流后，应用通常会有什么表现？

> 应用一般不会退出，但执行速度会下降，可能出现请求延迟升高、吞吐量降低，甚至健康检查超时。

2. 容器发生 OOM Kill 后，整个 Pod 都会被删除吗？

> 通常不会。被杀掉的是超过内存限制的容器进程，Pod 对象一般仍然存在。kubelet 会根据重启策略决定是否重启容器。
> OOM 通常杀的是容器；Pod 还在，但会暂时 NotReady。Service 能停止继续导流，但正在处理的请求和状态传播窗口内的请求仍可能失败。

3. 容器因 OOM Kill 重启后，Pod IP 会变化吗？

> 通常不会，因为这是同一个 Pod 内的容器重启，Pod 的网络环境没有被重新创建。

4. 内存使用量超过 request，但没有超过 limit，会被 OOM Kill 吗？

> 通常不会。request 主要用于调度，不是运行时上限。只要没有超过 limit，并且节点内存没有出现严重压力，容器可以继续运行。

5. CPU limit 设置得过小会导致容器重启吗？

> 一般不会直接导致重启，但严重节流可能让健康检查超时。如果 Liveness Probe 连续失败，kubelet 可能间接重启容器。

## Pod 一直处于 Pending，你会怎么排查？

Pod 一直 Pending，我会先用 describe Pod 看 Events。
如果还没调度，重点排查资源不足、调度规则、节点污点和 PVC；如果已经调度，则排查镜像拉取、存储挂载和网络问题。
Pending 时容器通常还没启动，所以业务日志一般看不到，logs 不是主要排查手段。

### 延伸问题

1. Pod 处于 Pending，是否一定代表还没有分配到节点？

> 不一定。它可能还没完成调度，也可能已经分配到节点，但正在等待镜像拉取、存储挂载或网络创建。

2. Events 中出现 `FailedScheduling` 通常说明什么？

> 说明调度器找不到合适的节点，常见原因是资源不足、调度规则不满足、节点污点或 PVCC 未绑定。

3. PVC 一直处于 Pending，会影响 Pod 启动吗？

> 会。如果 Pod 依赖的 PVC 没有完成绑定，Pod 通常无法完成调度或启动。

4. 镜像拉取失败时，Pod 也可能表现为 Pending 吗？

> 可能。Pod 已经分配到节点，但容器还在等待，通常还能看到 `ErrImagePull` 或 `ImagePullBackOff`。

5. Pending 状态下什么时候可以查看日志？

> 容器运行过或者 Init Container 已经启动时，可能有日志；如果容器从未启动，就没有业务日志可看。

## HPA 是什么？它依据什么指标扩缩容？

HPA 是我们配置的扩缩容规则，Controller 根据实时指标计算副本数，并修改工作负载的 replicas。它不是简单超过阈值就固定加一个 Pod。

### 延伸问题

1. HPA 会直接创建和删除 Pod 吗？

> 不会。HPA 修改 Deployment 等工作负载的副本数，再由对应的控制器创建或删除 Pod。

2. HPA 的 CPU 利用率是怎么计算的？

> 通常是容器实际 CPU 使用量除以配置的 `requests.cpu`，再计算各 Pod 的平均值。

3. 没有配置 CPU request，HPA 还能按 CPU 利用率扩容吗？

> 通常无法正常计算 CPU 利用率，因此可能无法执行扩缩容。

4. CPU 降下来后，HPA 会立刻缩容吗？

> 通常不会。HPA 有容忍范围和缩容稳定窗口，避免指标短暂波动导致 Pod 数量频繁变化。

5. HPA 获取 CPU 和内存数据需要什么组件？

> HPA 通过 Metrics API 获取指标，集群通常需要部署 Metrics Server；自定义指标则需要对应的监控系统和指标适配器。

## HPA 扩容 Pod 后，流量是如何分发到新 Pod 的？

HPA 只负责调整副本数，不负责流量分发。扩容出的新 Pod 启动并通过 Readiness Probe 后，会被加入 Service 的后端列表，之后 Service 的转发机制就可以把新的请求分发给它。

### 延伸问题

1. 新 Pod 创建成功后会立刻接收流量吗？

> 不一定。通常要等 Pod 通过 Readiness Probe，成为 Ready 状态后，才会加入 Service 的可用后端。

2. 新 Pod 一直没有通过 Readiness Probe 会怎样？

> 它不会接收 Service 转发的新流量，但仍然占用副本数量，HPA 也可能继续扩容直到达到最大副本数。

3. 新 Pod 已经 Ready，为什么仍然没有流量？

> 可能是 Pod 标签与 Service 的 Selector 不匹配，导致它没有被加入 Service 对应的 EndpointSlice。

4. Service 会把流量绝对平均地分给所有 Pod 吗？

> 不一定。流量分发通常基于连接进行，受到转发模式和长连接影响，不保证每个 Pod 收到完全相同的请求量。

5. HPA 缩容时，Pod 正在处理的请求怎么办？

> Pod 会先被移出可用后端，然后进入终止流程。可以结合优雅退出、终止宽限期和 `preStop`，尽量让正在处理的请求完成。