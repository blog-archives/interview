---
title: 服务发现与网络
order: 3
---

## Pod IP 为什么不能作为固定服务地址？Service 解决了什么问题？

Pod 是短暂资源，被滚动更新、驱逐或故障替换后，名称和 IP 都可能变化；扩容后还会同时存在多个后端。Service 为一组后端提供稳定的虚拟 IP 或 DNS 名称，并依据 selector 维护相应的 EndpointSlice，让调用方与变化的 Pod 集合解耦。

Service 类型不只三种：

| 类型 | 作用 |
|---|---|
| `ClusterIP` | 默认类型，提供集群内虚拟 IP |
| `NodePort` | 在每个 Node 的指定端口暴露 Service，同时也包含 ClusterIP 能力 |
| `LoadBalancer` | 请求基础设施提供方或相应实现创建外部负载均衡入口 |
| `ExternalName` | 通过 DNS CNAME 映射到外部域名，不代理流量 |

另外，`clusterIP: None` 表示 Headless Service：不分配虚拟 ClusterIP，DNS 可直接返回后端地址，常用于 StatefulSet 的成员发现。

### 延伸问题

1. Service 如何找到 Pod？

> 常见方式是 selector 匹配 Pod 标签，控制面据此维护 EndpointSlice。Service 也可以没有 selector，由用户或其他控制器维护后端。

2. NotReady 的 Pod 会接收 Service 流量吗？

> 默认不会作为常规就绪后端。特殊配置、无其他可用后端时对 terminating endpoint 的处理、以及具体数据面实现会影响边界行为，因此优雅下线不能只依赖这一句话。

3. NodePort 是否只能访问运行目标 Pod 的节点？

> 通常任意 Node 的 NodePort 都可作为入口，再由 Service 数据面转发；但 `externalTrafficPolicy: Local` 等配置会改变转发和可用性语义。

4. Service 会把请求绝对平均地分到每个 Pod 吗？

> 不保证。数据面通常按连接或流进行选择，长连接、客户端连接池、拓扑和不同代理实现都会造成流量不均。

## 集群内服务如何发现和访问另一个服务？

调用方通常访问目标 Service 的 DNS 名称和 `port`。CoreDNS 将名称解析为 Service ClusterIP；Service 数据面再把连接转发到某个可用 endpoint 的 `targetPort`。

- 同一 Namespace：`orders:8080`
- 跨 Namespace：`orders.prod:8080`
- 完整名称：`orders.prod.svc.cluster.local:8080`

`port` 是 Service 暴露的端口，`targetPort` 是后端应用接收流量的端口；`containerPort` 主要是 Pod 清单中的端口声明和元数据，不会单独让端口自动对外开放。

### 延伸问题

1. DNS 解析成功是否说明后端一定可用？

> 不能。DNS 只解决名称到 Service 或 endpoint 的解析，还要检查 EndpointSlice、Pod readiness、应用监听、NetworkPolicy 和数据面。

2. 可以直接访问 Pod IP 吗？

> 集群网络允许时技术上可以，但会失去稳定服务发现和负载分发，不应作为普通服务间调用的固定配置。点对点管理、调试或 Headless Service 场景另当别论。

3. 为什么 StatefulSet 常配 Headless Service？

> 它让客户端或集群成员能通过稳定 DNS 名称发现各个有身份的 Pod，而不是只访问一个负载均衡虚拟 IP。

## Ingress、Gateway API、LoadBalancer Service 分别负责什么？

- `LoadBalancer` Service 为一个 Service 请求外部四层入口，具体能力取决于云平台或负载均衡实现；
- Ingress 声明 HTTP / HTTPS 的域名和路径路由，必须有 Ingress Controller 才会生效；
- Gateway API 是更通用、角色边界更清晰的下一代流量路由 API，也需要相应 Controller。

Kubernetes 官方目前建议新能力优先考虑 Gateway API；Ingress API 已冻结但仍是稳定 API，并没有被删除。两者通常都把流量路由到 Service，而不是让一份规则自己直接转发数据包。

### 延伸问题

1. 只有 Ingress YAML，没有 Ingress Controller 会怎样？

> 通常不会产生实际入口。Ingress 是期望路由规则，Controller 才负责配置代理、负载均衡器或边缘设备。

2. Ingress 能暴露任意 TCP / UDP 服务吗？

> 标准 Ingress 面向 HTTP / HTTPS。其他协议通常使用 NodePort、LoadBalancer，或采用支持相应协议的 Gateway API / Controller 扩展能力。

3. HTTPS 通常在哪里终止？

> 常见做法是在 Ingress / Gateway 层配置证书并终止 TLS，也可以做 TLS 透传或到后端再次加密，取决于 Controller 能力和安全要求。

## 集群内访问 Service 超时，如何排查？

按请求链路定位，不要一上来就怀疑 CNI：

1. **调用方**：名称、Namespace、端口、超时配置是否正确，DNS 能否解析；
2. **Service**：selector、`port`、`targetPort` 是否正确；
3. **EndpointSlice**：是否存在 Ready endpoint，IP 与端口是否符合预期；
4. **Pod / 应用**：是否 Ready，进程是否监听正确地址和端口，直连 Pod IP 是否成功；
5. **网络策略与数据面**：检查 NetworkPolicy、CNI、kube-proxy 或替代实现、节点路由；
6. **外部链路**：若集群内正常，再检查 Ingress / Gateway、外部负载均衡、DNS 和防火墙。

```bash
kubectl get svc <service> -n <namespace> -o yaml
kubectl get endpointslice -n <namespace> -l kubernetes.io/service-name=<service>
kubectl get pod -n <namespace> -l <label-key>=<label-value> -o wide
kubectl exec -n <namespace> <client-pod> -- nslookup <service>
```

记忆顺序：**调用方 → DNS → Service → EndpointSlice → Pod → 应用 → 网络数据面。**
