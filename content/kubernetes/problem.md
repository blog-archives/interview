---
title: 故障排查
order: 7
---

## 排查 Kubernetes 问题的一般方法是什么？

先确定范围和最近变更，再沿“对象状态 → Events → 日志 → 指标 → 请求链路 → 节点与基础设施”逐层缩小，不要只凭 Pod 的 STATUS 一列下结论。

常用命令：

```bash
kubectl get pod <pod> -n <namespace> -o wide
kubectl describe pod <pod> -n <namespace>
kubectl logs <pod> -n <namespace> -c <container> --tail=200
kubectl logs <pod> -n <namespace> -c <container> --previous
kubectl get events -n <namespace> --sort-by=.lastTimestamp
kubectl top pod <pod> -n <namespace> --containers
```

`describe` 重点看 Conditions、容器 State / Last State、Reason、退出码、重启次数、挂载和 Events；`top` 依赖 Metrics API，常见实现是 Metrics Server。多容器 Pod 要指定容器，应用曾经重启过时要看 `--previous`。

> Events 和应用日志分别解决什么问题？

Events 更适合发现调度、拉镜像、挂载、探针和节点动作；应用日志用于定位进程内部错误。Events 有保留期限，重要故障还应依赖集中日志、指标和审计系统。

> `kubectl top` 没数据说明应用没使用资源吗？

不是。可能是 Metrics Server 未安装、API 不可用、采集延迟或权限问题。生产分析应结合长期监控，而不是只看一次 `top` 快照。

## Pod 反复重启并出现 CrashLoopBackOff，如何排查？

`CrashLoopBackOff` 表示容器启动后反复退出或被 kubelet 终止，系统正在对下一次重启退避；它不是一个独立的 Pod phase。

排查顺序：

1. `describe` 查看 State、Last State、Reason、退出码、重启次数和 Events；
2. 查看当前日志和 `--previous` 上一次容器日志；
3. 若为 `OOMKilled`，检查内存峰值、limit、节点压力和泄漏；
4. 若探针失败，核对端口、路径、超时、阈值和应用启动时间；
5. 检查 command / args、配置、Secret、权限、文件挂载和依赖连通性；
6. 核对镜像架构、入口进程是否前台运行，以及应用是否正常以非零退出码结束。

> Readiness 失败会导致 CrashLoopBackOff 吗？

不会直接重启容器。Liveness 或 Startup 持续失败会触发终止并可能进入重启退避；Readiness 失败主要让 Pod NotReady。

> CrashLoopBackOff 和 ImagePullBackOff 有什么区别？

前者通常是容器已经启动但反复退出；后者是镜像无法成功拉取，业务进程通常还没启动。

> 退出码 0 为什么也可能反复重启？

若工作负载要求容器持续运行，而入口命令完成后正常退出，`restartPolicy: Always` 仍会再次启动。应确认该任务究竟应该用 Deployment 还是 Job。

## Pod 显示 Running，但服务访问失败，怎么排查？

`Running` 只表示 Pod 已绑定节点，且至少一个容器正在运行、正在启动或重启，并不表示应用 Ready 或请求链路可用。

按层次排查：

1. Pod 是否 `Ready`，探针为什么失败；
2. 应用是否监听正确端口和地址——只监听 `127.0.0.1` 会导致其他 Pod 无法访问；
3. 日志是否有启动、依赖或 TLS 错误；
4. Service selector、`port` / `targetPort` 是否正确；
5. EndpointSlice 中是否出现正确且 Ready 的 Pod IP；
6. 直连 Pod IP 与通过 Service 的结果是否不同；
7. NetworkPolicy、Service 数据面和 CNI 是否正常；
8. 集群内正常但外部失败时，再查 Ingress / Gateway、LoadBalancer、DNS 和防火墙。

> Service selector 错误会看到什么？

Service 对象存在且 DNS 可能正常，但 EndpointSlice 没有预期后端，请求最终超时或被拒绝。

> Pod Ready 就一定能处理所有请求吗？

不一定。Readiness 只代表探针所覆盖的条件通过。业务路由、特定依赖、数据或权限仍可能出错，所以探针要与 SLO 和监控互补。

> 直连 Pod 正常、通过 Service 失败说明什么？

优先检查 Service / EndpointSlice 和数据面；但测试时要保证使用相同协议、端口、Host、TLS 和 NetworkPolicy 路径，避免错误对比。

## ImagePullBackOff 如何排查？

先用 `kubectl describe pod` 读取 Events 的原始错误，再分层检查：

1. registry、项目路径、镜像名、tag 或 digest 是否存在且拼写正确；
2. `imagePullPolicy` 是否符合预期，避免把节点缓存误当成发布成功；
3. 私有仓库的 `imagePullSecrets` 是否存在、同 Namespace、凭证有效并被 Pod / ServiceAccount 引用；
4. Node 到仓库的 DNS、网络、代理、证书信任和防火墙；
5. 仓库权限、限流、配额和可用性；
6. 镜像 manifest 是否包含 Node 所需 CPU 架构。

> 本机 `docker pull` 成功，为什么集群仍失败？

拉取动作发生在目标 Node 的容器运行时环境，本机与 Node 的凭证、DNS、网络、证书、代理和架构都可能不同。

> `ErrImagePull` 与 `ImagePullBackOff` 有什么区别？

`ErrImagePull` 表示一次拉取失败；连续失败后进入 `ImagePullBackOff`，后续重试间隔逐渐增大。

> 为什么生产环境更推荐镜像 digest？

digest 指向不可变内容，避免同一个 tag 被覆盖后不同节点实际运行不同镜像，也更便于审计和回滚。

## 如何实现 Go 服务优雅下线？

删除 Pod 后会进入终止流程：API 中记录删除时间，EndpointSlice 将 endpoint 标记为 terminating / 非常规 Ready；kubelet 启动 Pod 终止宽限期，执行 `preStop`（如有），再向容器主进程发送终止信号；宽限期耗尽后仍未退出才强制终止。

Go 服务需要自己配合：

1. PID 1 正确接收 `SIGTERM`，停止接收新请求；
2. 调用 `http.Server.Shutdown(ctx)` 等待在途请求完成；
3. 停止后台消费者和定时任务，提交或回滚进行中的工作；
4. 最后关闭数据库、缓存和追踪导出器并退出；
5. `terminationGracePeriodSeconds` 要覆盖 `preStop` 与应用退出的总耗时。

流量摘除、代理同步和应用终止可能并行传播，仍可能有少量新请求到达。应用应先将自身设为不接新流量，并保持一段可控的 drain 时间；客户端也需要合理的超时、重试和幂等。

> `preStop` 的时间是否在宽限期之外？

不是。终止宽限期在执行 `preStop` 前已经开始计时，hook 占用的时间会减少留给应用处理 SIGTERM 的时间。

> 节点突然断电还能优雅退出吗？

不能指望。优雅终止适用于 kubelet 能参与的正常删除或受控关机；硬故障必须靠多副本、幂等、租约 / 超时和数据恢复设计。

> 只写 `sleep` 的 preStop 足够吗？

它只能为流量传播争取时间，不能替代应用处理 SIGTERM、停止接新请求和等待在途请求。固定 sleep 也应基于实际链路验证。

## Node 宕机后，Deployment 管理的服务会发生什么？

控制面收不到心跳后会把 Node 的 Ready 状态标为 `Unknown`，并添加 `node.kubernetes.io/unreachable` 或 `not-ready` 污点。相关 Pod 会变为 NotReady，逐步不再作为 Service 的常规后端。

Pod 不会瞬间在其他节点出现。默认情况下，Node Controller 会等待一段时间再发起驱逐；普通 Pod 通常自动带有对 not-ready / unreachable 的 300 秒 `NoExecute` 容忍。原 Pod 被驱逐或删除后，ReplicaSet 才创建替代 Pod，再由 Scheduler 放到健康且有容量的 Node。具体时间受控制面参数、Pod toleration、集群规模和故障范围影响。

> 为什么不立即重建？

短暂网络抖动时立即在别处启动可能造成不必要迁移；有状态工作负载还要防止旧实例其实仍在运行而产生双写。故障检测时间是恢复速度与误判风险的权衡。

> 新 Pod 一定能调度成功吗？

不一定。其他节点可能资源不足，或不满足亲和性、污点容忍、可用区和存储拓扑，替代 Pod 会 Pending。

> 如何降低节点故障影响？

使用多个副本、拓扑分布约束 / 反亲和性跨节点和可用区分散，预留容量，正确配置 readiness，并验证故障转移时间。PDB 主要保护自愿中断，不能阻止节点硬故障。
