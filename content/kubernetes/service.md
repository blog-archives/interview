## Pod IP 为什么不能直接作为服务地址使用？

Pod 的生命周期不稳定，Pod 被重新创建后，IP 通常会变化；扩容时还会出现多个 Pod IP，所以不能把某个 Pod IP 当作固定服务地址。

K8s 通过 Service 提供稳定的访问入口，并把请求转发到后面健康、就绪的 Pod。

### 延伸问题

1. 容器重启后，Pod IP 会变化吗？

> 通常不会。容器重启仍发生在同一个 Pod 中，Pod 的网络环境没有重建。

2. 什么情况下 Pod IP 会变化？

> Pod 被删除、驱逐或故障替换后，新创建的 Pod 会重新分配 IP，因此通常会变化。

3. Pod IP 是谁分配的？

> Pod 被调度到节点后，由节点上的容器网络插件，也就是 CNI 插件负责分配。

4. 新 Pod 一定会被分配到其他节点吗？

> 不一定。即使仍在原节点，也属于新的 Pod，IP 仍可能变化。

5. Pod IP 可以直接从集群外访问吗？

> 通常不能。Pod IP 主要用于集群内部通信，对外访问一般需要通过 Service 或 Ingress。

## Service 是什么？常见的 Service 类型有哪些？

Service 常见有三种类型：ClusterIP 用于集群内部访问；NodePort 通过节点 IP 和固定端口暴露服务；LoadBalancer 通常借助云平台的外部负载均衡器对外提供访问入口。

## ClusterIP、NodePort、LoadBalancer 的主要区别是什么？

- ClusterIP 只供集群内部访问，适合微服务之间调用。
- NodePort 在每个节点开放固定端口，可以从集群外访问，但入口比较简单，通常用于测试或临时访问。
- LoadBalancer 通过外部负载均衡器提供公网或内网入口，更适合云环境下的生产服务。

简单说，就是从集群内部访问，到直接通过节点暴露，再到通过专业负载均衡器对外暴露。

### 延伸问题

1. 问：Service 是如何找到后端 Pod 的？

> Service 通常通过 Label Selector 选择 Pod，并将流量转发给这些 Pod。

2. 问：Pod 没有通过 Readiness Probe，还会接收 Service 流量吗？

> 通常不会。未就绪的 Pod 会从 Service 的可用后端中移除。

3. 问：NodePort 只能通过运行了目标 Pod 的节点访问吗？

> 不是。通常可以访问任意 Node 的 IP 和 NodePort，流量会被转发到实际运行 Pod 的节点。

4. 问：Service 本身有负载均衡能力吗？

> 有。Service 可以把请求分发给后端多个 Pod，但它主要提供四层负载均衡，不负责复杂的 HTTP 路由。

5. 问：LoadBalancer 和 NodePort 有什么关系？

> LoadBalancer 通常在集群外提供负载均衡入口，再把流量转入集群；很多实现底层会结合 NodePort，但具体取决于集群和云平台。

## 集群内一个服务如何访问另一个服务？

集群内一个服务通常通过目标 Service 的 DNS 名称和端口访问另一个服务。

CoreDNS 会把 Service 名称解析为 ClusterIP，然后 Service 再把请求转发到后端已经就绪的 Pod。

例如同一命名空间下，可以通过 用户服务名:端口 访问用户服务。这样即使后端 Pod 重建或 IP 变化，调用方也不需要修改地址。

### 延伸问题

1. Service 的 DNS 名称是什么格式？

> 同一命名空间可以直接使用 Service 名称；不同命名空间通常使用 `Service名.命名空间名`。

2. Service 名称是由谁解析的？

> 通常由集群中的 CoreDNS 解析，将 Service 名称解析为对应的 ClusterIP。

3. Service 如何知道流量应该转发给哪些 Pod？

> Service 通过 Label Selector 选择符合条件的 Pod，并维护对应的可用后端。

4. Service 的 `port` 和 `targetPort` 有什么区别？

> `port` 是 Service 对外提供的端口，`targetPort` 是后端 Pod 中应用实际监听的端口。

5. 可以绕过 Service，直接通过 Pod IP 访问吗？

> 技术上可以，但不推荐，因为 Pod 重建后 IP 可能变化，也不方便进行服务发现和负载均衡。

## Ingress 与 Service 分别负责什么？

Ingress 是 K8s 中管理 **HTTP 和 HTTPS 入口路由规则**的资源。它可以根据域名或请求路径，把外部流量转发到不同的 Service。

Ingress 只是规则，通常还需要 Ingress Controller 真正处理流量。

- Service 为一组 Pod 提供稳定的访问入口，并把流量转发给这些 Pod。
- Ingress 位于 Service 前面，接收外部的 HTTP/HTTPS 请求，再根据域名或路径决定转发给哪个 Service。

一句话：Ingress 负责外部请求的路由，Service 负责把请求转发到具体 Pod。

### 延伸问题

1. Ingress 和 Ingress Controller 有什么区别？

> Ingress 是路由规则，Ingress Controller 是读取并执行这些规则的实际组件。只有 Ingress 规则，没有 Controller，通常不会生效。

2. Ingress 可以直接把请求转发给 Pod 吗？

> 通常不会。Ingress 一般先把请求转发给 Service，再由 Service 转发到具体 Pod。

3. Ingress 可以根据什么条件转发请求？

> 最常见的是根据域名和 URL 路径，例如把 `api.example.com` 和 `/order` 转发到不同的 Service。

4. Ingress 和 LoadBalancer 类型的 Service 有什么区别？

> - LoadBalancer 是 Service 的一种类型，解决外部流量如何获得进入集群，并到达这个 Service。
> - Ingress 是路由规则，由 Ingress Controller 执行，解决进入集群的 HTTP/HTTPS 流量应该转发到哪个 Service。
>
> 一句话：LoadBalancer 负责把流量引进来，Ingress 负责判断流量接下来往哪里走。

5. Ingress 能处理 HTTPS 吗？

> 可以。Ingress 通常可以配置 TLS 证书，在入口处完成 HTTPS 加密和解密，再把请求转发给后端 Service。

## 如果一个服务在 K8s 内访问另一个服务超时，你会从哪些方面排查？

我会顺着请求链路一步一步排查：

1. 先看调用方配置，确认目标 Service 名称和端口有没有写错。
2. 再看 Service，确认它的端口配置和 Pod 标签选择是否正确。
3. 然后看 Service 后面有没有关联到正常、Ready 的 Pod。
4. 再进入目标 Pod，看应用是否启动成功、端口是否监听，并检查应用日志。
5. 如果前面都正常，最后排查 NetworkPolicy、网络插件和节点网络等问题。

记忆顺序就是：**调用方 → Service → Pod → 应用 → 集群网络。**