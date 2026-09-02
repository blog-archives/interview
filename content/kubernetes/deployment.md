# Deployment

Deployment 是 K8s 最常用的无状态工作负载，用来管理 Pod 副本。它通过控制 ReplicaSet 实现滚动更新：更新镜像时会生成新 ReplicaSet，逐步创建新版本 Pod、销毁旧版本 Pod，实现业务不停机升级。

## Deployment 修改镜像版本执行滚动更新，新 Pod 创建失败，旧 Pod 还在，业务没完成升级，如何排查？

修改镜像触发滚动更新后，新版本 Pod 一直无法正常就绪，滚动更新流程就会卡住停止。Deployment 不会继续销毁旧 Pod，旧 Pod 继续对外提供服务，升级无法完成。并不是更新指令没下发，而是新产出的 Pod 本身出问题，导致滚动流程停滞。

1. 先看 Deployment 状态：`kubectl describe deployment <deployment名称>`，观察事件，看滚动更新的进度、报错；同时查看新旧两个 ReplicaSet 资源。
2. 找到本次更新生成的**新版本 Pod**，对它执行`kubectl describe pod`，看 Events 事件。新 Pod 失败根源还是 Pod 层面问题：Pending 调度失败、镜像拉取失败、探针就绪失败、配置错误等。
3. 如果新版本 Pod 已经启动过，使用`kubectl logs [-p] 新pod名称`查看新版本容器日志，定位新版本配置、镜像带来的业务报错。
4. 辅助查看 ReplicaSet：`kubectl get replicaset`，可以看到新旧 RS 的副本期望、就绪数量，确认是新 RS 的 Pod 起不来。
5. 定位根因：新版本镜像异常、配置变更错误、资源配置不足、探针配置问题、PVC / 调度约束导致新 Pod 无法就绪。

> 注意：旧 Pod 本身没有故障，不要去排查旧 Pod，问题出在**刚生成的新版本 Pod**。

## Deployment 配置副本数为 5，实际集群中只看到 2 个运行的 Pod，请描述排查思路。

期望副本 5，实际只有 2 个 Running。代表控制器尝试创建更多 Pod，但新增 Pod 没能成功进入 Running 就绪状态。已经运行的 2 个 Pod 本身没问题，问题出在待创建的其余副本，不一定是业务 bug，可能是调度、资源、约束等因素阻止 Pod 正常就绪。

1. `kubectl describe deployment <deploy名字>`，查看 Deployment 事件，看扩副本相关报错，观察关联的 ReplicaSet 状态。
2. `kubectl get replicaset`，找到对应的 ReplicaSet，看它的期望、就绪、可用副本数。
3. 找到那些没有正常 Running 的异常 Pod，对异常 Pod 执行`kubectl describe pod`，看 Events 事件。常见原因：节点资源不足、污点亲和规则不满足、PVC 无法绑定、镜像拉取失败、就绪探针失败。
4. 如果异常 Pod 已经启动过，使用`kubectl logs [-p] <异常pod名>`查看日志定位业务侧问题。
5. 也可以全局查看集群事件：`kubectl get events --sort-by=.metadata.creationTimestamp`，看批量创建 Pod 时的报错。

## 滚动更新过程中，业务出现短暂大量报错，怎么定位是 K8s 层面还是业务本身问题。

执行滚动更新的时候，业务出现短暂大量报错。报错只发生在升级的时间段，升级完成之后恢复正常。
报错来源分两大类：

1. K8s 层面：Pod 启停、流量切换、就绪探针、连接断开引发报错；
2. 业务本身：新旧版本接口不兼容、数据库 schema 变更、缓存数据结构不兼容，新旧版本同时运行互相干扰。

首先对齐报错时间是否和滚动更新重合。
如果是业务报错，大概率是新旧版本不兼容，新旧 Pod 共存时互相影响。
K8s 层面有两种情况：一是就绪探针配置不合理，新 Pod 还没初始化完成就接收流量；二是旧 Pod 销毁，没有优雅关闭，正在处理的连接被强制断开，出现连接重置类报错。分别调整探针参数，或者业务实现优雅关闭来处理。
