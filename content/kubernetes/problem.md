## Pod 不断重启，出现 CrashLoopBackOff，你怎么排查？

Pod 出现 CrashLoopBackOff，说明容器启动后反复退出，K8s 正在退避重启。首先 describe Pod，查看容器的 Last State、退出码、Reason 和 Events，判断是否 OOMKilled、探针失败或配置挂载异常；然后查看当前日志和 --previous 的上一次容器日志，定位业务启动错误。如果日志不足，再检查配置、依赖服务和容器启动参数。

### 延伸问题

1. CrashLoopBackOff 表示 Pod 本身坏了吗？

> 不一定。通常是 Pod 内的容器启动后反复异常退出，K8s 对重启操作进行了退避等待。

2. 为什么排查时要查看 `--previous` 日志？

> 因为当前容器可能刚刚重启，上一次容器实例的错误日志需要通过 `--previous` 查看。

3. 如何判断容器是不是因为内存不足而重启？

> 查看容器的 Last State 和退出原因，如果显示 `OOMKilled`，通常说明容器超过内存限制或节点发生了内存压力。

4. 健康检查会导致 CrashLoopBackOff 吗？

> Liveness Probe 或 Startup Probe 持续失败会触发容器重启，反复失败后可能出现 CrashLoopBackOff；Readiness Probe 失败只会停止接收流量。

5. CrashLoopBackOff 和 ImagePullBackOff 有什么区别？

> CrashLoopBackOff 是容器已经启动但反复退出；ImagePullBackOff 是镜像拉取失败，容器通常还没有成功启动。

## Pod 显示 Running，但访问服务仍然失败，可能是什么原因？

Pod 显示 Running 只代表容器进程还活着。排查时我会沿访问链路逐层确认：先看 Pod 是否 Ready、应用日志以及端口是否正常监听；再检查 Service 的 selector、端口和 targetPort，以及 EndpointSlice 中是否有对应的 Pod IP；如果直接访问 Pod 正常、通过 Service 失败，再排查 kube-proxy、CNI 或 NetworkPolicy；如果集群内正常、外部失败，再检查 Ingress 和外部负载均衡。

### 延伸问题

1. Pod 显示 Running，就代表应用可以正常提供服务吗？

> 不代表。Running 只说明容器进程正在运行，还需要确认 Pod 是否 Ready，以及应用是否真正启动完成。

2. Pod Running 但 Readiness Probe 失败，会发生什么？

> Pod 仍然可以保持 Running，但会处于 NotReady 状态，其 IP 通常不会作为可用后端接收 Service 流量。

3. Service 为什么可能找不到正在运行的 Pod？

> 常见原因是 Service 的 selector 与 Pod 标签不匹配，或者 Pod 没有通过 Readiness Probe，导致 EndpointSlice 中没有可用地址。

4. Service 的 port 和 targetPort 有什么区别？

> port 是 Service 对外提供的端口，targetPort 是流量最终转发到 Pod 应用的端口，targetPort 配错会导致访问失败。

5. 直接访问 Pod 正常，但通过 Service 访问失败，应该重点排查什么？

> 重点检查 Service 的 selector、端口配置和 EndpointSlice；这些正常后，再排查 kube-proxy、CNI 和 NetworkPolicy。

## 镜像拉取失败时，你会检查什么？

镜像拉取失败时，先 describe Pod 查看 Events 中的具体报错。然后确认镜像仓库地址、镜像名和 tag 是否正确、镜像是否存在；如果是私有仓库，再检查 imagePullSecret 的配置、凭证有效期和访问权限；如果这些都正常，再排查工作节点到镜像仓库的网络、DNS、证书和仓库限流问题。

### 延伸问题

1. `ErrImagePull` 和 `ImagePullBackOff` 有什么区别？

> `ErrImagePull` 表示某次镜像拉取失败；多次失败后，K8s 会进入 `ImagePullBackOff`，延长下一次重试的等待时间。

2. 本地可以拉取镜像，为什么 Pod 仍然拉取失败？

> 本地和工作节点使用的网络、DNS、仓库凭证及容器运行时可能不同，本地成功不能证明节点一定可以拉取。

3. 私有镜像仓库拉取失败，重点检查什么？

> 检查 `imagePullSecret` 是否存在、凭证是否过期、账号是否有权限，以及 Pod 或 ServiceAccount 是否正确引用该 Secret。

4. 镜像明明存在，为什么还会提示 `not found`？

> 可能是仓库地址、项目路径、镜像名称或 tag 写错，也可能是当前账号没有权限，仓库为了安全返回了类似不存在的错误。

5. 镜像拉取策略会影响拉取结果吗？

> 会。`Always` 通常每次启动都会向仓库确认镜像；`IfNotPresent` 在节点已有镜像时可以直接使用；`Never` 则要求镜像必须已存在于节点。

## 如何查看某个 Pod 的日志、事件和资源使用情况？

Pod 日志使用 kubectl logs 查看，事件通过 kubectl describe pod 查看，当前 CPU 和内存使用量通过 kubectl top pod 查看。如果 Pod 有多个容器，需要指定容器；如果容器已经重启，可以使用 --previous 查看上一次容器实例的日志。

### 延伸问题

1. Pod 中有多个容器时，如何查看指定容器的日志？

> 使用 `kubectl logs` 时通过 `-c` 指定容器名称，否则可能无法确定要查看哪个容器。

2. 容器重启后，如何查看重启前的日志？

> 使用 `kubectl logs --previous`，查看同一个 Pod 中上一次容器实例的日志。

3. `kubectl top pod` 无法返回数据，常见原因是什么？

> 通常是 Metrics Server 没有安装、运行异常，或者暂时还没有采集到指标。

4. `kubectl top` 和 `kubectl describe` 看到的资源信息有什么区别？

> `top` 展示当前实际的 CPU 和内存使用量；`describe` 主要展示配置的 requests、limits、运行状态和事件。

5. `kubectl describe pod` 主要关注哪些信息？

> 重点查看容器状态、Last State、退出原因、重启次数、Readiness 状态以及最后的 Events。

## 如何实现一个 Go 服务的灰度发布或金丝雀发布？

灰度发布和金丝雀发布的整体思路都是让新旧版本同时存在，先让部分用户或少量流量访问新版本，验证没有问题后逐步扩大范围，最终替换旧版本。区别主要在分流方式：灰度发布通常按照用户 ID、地区、租户或请求头等条件选择特定用户；金丝雀发布通常按照流量权重，从 5%、20% 逐步扩大到 100%。

新旧版本分别使用一套 Deployment 和 Service，通过 Ingress、网关或 Service Mesh 配置用户规则或者流量权重。先让部分用户或少量流量进入新版本，持续观察日志、错误率、延迟和业务指标；确认正常后逐步扩大范围，最终下线旧版本，出现异常则快速把流量切回旧版本。

### 延伸问题

1. 为什么新旧版本通常分别使用不同的 Service？

> Service 主要负责把流量转发到匹配标签的 Pod，不擅长复杂的用户路由和精确权重控制。因此新旧版本分别使用一个 Service，作为两个独立且稳定的后端入口，再由 Ingress、网关或 Service Mesh 决定请求进入哪个版本。

2. 只调整新旧版本的 Pod 副本数，可以实现金丝雀发布吗？

> 正规的金丝雀发布通常通过 Ingress、网关或 Service Mesh 配置流量权重。调整 Pod 副本数只在新旧 Pod 共用一个 Service 时，才能间接得到大致比例；如果新旧版本使用不同 Service，副本数不会决定版本之间的流量比例。

3. 灰度发布时，如何保证同一个用户始终访问同一个版本？

> 可以根据用户 ID、Cookie 或请求头配置一致的路由规则，避免同一用户在新旧版本之间来回切换。

4. 发布过程中应该重点观察哪些指标？

> 重点观察错误率、响应延迟、资源使用、健康检查结果，以及订单成功率等核心业务指标。

5. 新版本出现异常时，应该如何快速回滚？

> 将新版本的路由权重降为零或删除灰度规则，让流量全部回到旧版本，再保留现场排查新版本问题。

## 如何实现服务优雅下线，避免正在处理的请求被中断？

K8s 在终止 Pod 时，会将它从 Service 的可用后端中摘除，并向容器发送 SIGTERM，但这两个过程可能并行发生。业务程序收到信号后，要立即停止接受新请求，等待正在处理的请求完成，再关闭数据库连接等资源并主动退出。K8s 会通过 terminationGracePeriodSeconds 提供宽限时间，超时后才会强制终止。

### 延伸问题

1. Pod 终止时，K8s 会立即发送 `SIGKILL` 吗？

> 不会。通常先发送 `SIGTERM` 并等待宽限时间，只有进程超时仍未退出时才发送 `SIGKILL`。

2. `terminationGracePeriodSeconds` 有什么作用？

> 它定义 Pod 强制终止前的宽限时间，让应用有机会完成存量请求、释放资源并主动退出。

3. `preStop` 有什么作用？

> 它可以在容器收到 `SIGTERM` 前执行退出准备，例如短暂等待流量摘除传播，但它的执行时间也包含在终止宽限时间内。

4. 为什么 Pod 已经开始终止，仍可能收到少量新请求？

> 因为 EndpointSlice、Ingress 和外部负载均衡的更新存在传播延迟，流量摘除与容器终止也可能并行发生。

5. Go 服务如何等待正在处理的 HTTP 请求完成？

> 收到 `SIGTERM` 后调用 `http.Server.Shutdown`，停止接受新连接，并在设定的超时时间内等待正在处理的请求完成。

## K8s 节点宕机后，Deployment 管理的服务会发生什么？

工作节点宕机后，控制面会因为收不到节点心跳，将节点标记为 NotReady。该节点上的 Pod 会变成不可用，并逐渐从 Service 的可用后端中移除。经过故障确认和驱逐等待后，ReplicaSet 发现可用副本数不足，就会创建新的 Pod，再由 Scheduler 调度到其他健康且资源充足的节点上。

### 延伸问题

1. 节点变成 NotReady 后，Pod 会立即在其他节点重建吗？

> 不会。控制面需要经过故障检测和驱逐等待，确认节点不可用后才会处理原 Pod 并创建替代 Pod。

2. 节点宕机后，Service 还会继续向该节点上的 Pod 转发流量吗？

> 当 Pod 被判断为 NotReady 后，它会逐渐从 Service 的可用 EndpointSlice 中移除，之后不再接收新流量。

3. 新 Pod 一定能成功调度到其他节点吗？

> 不一定。如果其他节点资源不足，或者不满足亲和性、污点容忍等调度条件，新 Pod 会保持 Pending。

4. 节点宕机时，Pod 能执行优雅退出吗？

> 通常不能，因为节点已经无法运行 kubelet，容器也无法正常接收 K8s 发送的 SIGTERM。

5. 如何减少节点宕机对服务的影响？

> 应部署多个副本，并通过 Pod 反亲和性或拓扑分布约束，将副本分散到不同节点或可用区，同时保证集群有足够的备用资源。