---
title: Nginx
order: 3
---

## 1. 它是什么

**Nginx 是一个事件驱动的 Web Server 和反向代理服务器，常作为系统流量入口，负责接收连接、匹配规则并把请求返回静态内容或转发给后端服务。**

第一阶段只需理解：正向代理与反向代理的区别，`server`、`location`、`proxy_pass`、`upstream` 怎样决定请求去向，一次代理请求和响应怎样流转，以及后端故障、超时和 Nginx 单点的边界。

客户端通常只知道 Nginx 地址。Nginx 可以终止 TLS、提供静态文件、限流并在多个应用实例间负载均衡；业务逻辑仍由 Go、Java 等后端执行。Consul 可以向系统提供动态实例地址，OpenTelemetry 可以记录调用链，Prometheus 可以采集 Nginx 指标，这些组件与代理请求各负其责。

## 2. 最小工作模型

```mermaid
flowchart LR
    A[客户端] -->|原始 HTTP 请求| B[Nginx]
    B -->|新建上游请求| C[后端服务]
    C -->|上游响应| B
    B -->|最终响应| A
```

反向代理隐藏真实后端。客户端请求先到 Nginx；Nginx 根据 Host、URI 等规则选择配置，再向后端建立或复用连接并发起另一条请求。后端响应先回到 Nginx，Nginx 可以缓冲、修改 Header 或压缩后再返回客户端。

## 3. Process、server、location 与 upstream

### Master Process 与 Worker Process

启动 Nginx 后，通常会看到一个 Master Process 和多个 Worker Process。Master 不直接处理普通 HTTP 请求，主要负责读取并校验配置、打开监听端口、创建 Worker，以及收到重载信号时平滑替换 Worker。这样修改配置后，新 Worker 使用新配置接收连接，旧 Worker 可以处理完已有请求再退出。

Worker 才是真正处理客户端连接的进程。每个 Worker 内部使用事件循环观察大量 Socket：某个连接可读、可写或超时后，才继续处理对应事件，而不是为每个连接长期占用一个线程。多个 Worker 可以利用多核，但一个请求不会在几个 Worker 之间来回传递。

### server：先确定由哪个虚拟主机处理

`server` 是一组虚拟主机配置。它通常包含 `listen` 和 `server_name`：前者表示在哪个地址和端口接收连接，后者表示接受哪些 Host。请求到达后，Nginx 先根据监听地址，再根据请求中的 Host 选择一个 `server`；如果没有精确匹配，就进入该端口的默认 Server。

因此，同一台 Nginx 可以让 `api.example.com` 和 `static.example.com` 共用 80 或 443 端口，却进入不同配置。TLS 场景还会结合 SNI 选择证书和虚拟主机，但第一阶段只要记住：`server` 解决“这个域名归哪组配置处理”。

### location：在虚拟主机内匹配请求路径

确定 `server` 后，Nginx 再使用 URI 选择 `location`。例如 `/api/` 可以进入反向代理规则，`/assets/` 可以读取静态文件。Location 有精确匹配、前缀匹配和正则匹配，存在明确优先级；它不是按配置文件从上到下简单命中第一条。

`location` 自己通常不代表后端实例，而是一个处理规则容器。里面可以配置 `proxy_pass`、`root`、访问控制、限流或 Header。没有理解这一层，就容易把“请求匹配哪条规则”和“最终转发给哪台机器”混成同一件事。

### upstream：组织一组候选后端

`upstream` 给一组后端地址起一个逻辑名称，例如 `order_backend`。它还可以配置 Round Robin、Least Connections、权重、备用节点以及失败判定参数。Nginx 收到需要代理的请求时，负载均衡模块从这组候选地址中选择一个实例。

Upstream 保存的是代理目标配置和少量运行状态，不保存订单数据，也不是服务注册中心。静态配置中的实例变化需要重载；动态环境可以借助 DNS、Consul、Kubernetes 或商业能力更新候选列表。

### proxy_pass：真正创建上游请求

`proxy_pass` 才会让 Nginx 作为 HTTP Client 向选中的上游实例发起请求。Nginx 会建立或复用到后端的连接，构造新的请求行和 Header，把响应读回来后再交给客户端。客户端与 Nginx 的连接、Nginx 与后端的连接是两条独立连接，因此两侧可以有不同的超时、Keepalive 和协议版本。

把这些对象连起来就是：Master 准备配置和 Worker，Worker 接收请求，`server` 根据端口与域名选虚拟主机，`location` 根据 URI 选处理规则，`upstream` 提供候选后端，`proxy_pass` 创建真正的上游请求。

## 4. 一次反向代理如何完成

下面把 `/api/` 请求分配给两个订单服务：

```nginx
upstream order_backend {
    least_conn;
    server 10.0.1.8:8080;
    server 10.0.1.9:8080;
}

server {
    listen 80;
    server_name api.example.com;

    location /api/ {
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_pass http://order_backend;
    }
}
```

客户端请求：

```http
GET /api/orders/1001 HTTP/1.1
Host: api.example.com
```

Nginx 先命中 `server_name`，再选择 `/api/` 的 `location`，由 `least_conn` 在 upstream 中选择当前活动连接较少的实例，并发送上游请求。后端返回 JSON 后，Nginx 把状态码、Header 和 Body 返回客户端。默认配置下 URI 是否保留 `/api/` 与 `proxy_pass` 是否携带 URI 有关，实际配置必须验证路径改写结果。

## 5. 静态文件、负载均衡与代理控制

静态资源可以由 `root` 或 `alias` 映射到本机文件，Nginx 直接读取并返回，不需要访问后端。动态请求经 `proxy_pass` 转发。默认负载均衡是 Round Robin，也可使用 Least Connections、IP Hash、权重等；算法只在候选实例中选择目标，不保证某次业务一定成功。

连接超时、发送超时、读取超时分别约束不同阶段。代理缓冲可以让 Nginx 较快读完后端响应，再按客户端速度发送，避免慢客户端长期占用后端连接；流式响应则常需要关闭或调整缓冲。重试只适合尚未产生不可逆副作用的请求，否则可能造成重复下单。

## 6. 可靠性与扩展

开源 Nginx 的 upstream 可以通过被动失败判断暂时避开异常实例；主动健康检查属于 NGINX Plus 等方案，或由外部发现系统配合。后端全部失败时，Nginx 返回 502、503 或 504，不能生成真实业务结果。超时、失败次数和重试条件需要与应用幂等性一起设计。

增加 Worker 可以利用单机多核，但不解决 Nginx 节点故障。生产入口通常部署多个 Nginx 实例，再由云负载均衡、VIP 或 DNS 提供入口高可用。配置、证书和静态文件需要在实例间同步；连接状态和本地缓存不会自动形成一致集群。

## 7. 设计取舍与容易混淆的概念

事件驱动 Worker 用较少线程处理大量就绪连接，减少阻塞等待和线程切换；代价是磁盘、DNS、脚本或上游调用若阻塞不当，会影响同 Worker 的其他连接。代理缓冲隔离上下游速度，却增加内存、磁盘和首字节之后的延迟取舍。

| 概念 | 主要作用 | 最关键区别 |
|---|---|---|
| 正向代理与反向代理 | 前者代表客户端，后者代表服务端集群 | 隐藏的对象不同 |
| `location` 与 `upstream` | 前者匹配请求，后者组织后端 | 一个选规则，一个提供候选目标 |
| `proxy_pass` 与负载均衡 | 前者执行转发，后者选择实例 | 负载均衡是转发前的一步 |
| Nginx 与 Netty | 前者是成品代理服务器，后者是网络开发框架 | Netty 需要编写应用 |
| 后端高可用与入口高可用 | 前者避免单个业务实例故障，后者避免 Nginx 单点 | 需要分别设计 |

## 8. 后续可以了解什么

- `location` 的匹配优先级如何决定？
- `proxy_pass` 带 URI 与不带 URI 时怎样改写路径？
- Keepalive 和代理缓冲怎样影响连接与延迟？
- 多个 Nginx 实例怎样实现配置同步和入口高可用？

## 资料来源

- [Nginx Beginner's Guide](https://nginx.org/en/docs/beginners_guide.html)
- [How Nginx Processes a Request](https://nginx.org/en/docs/http/request_processing.html)
- [Proxy Module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [HTTP Load Balancing](https://nginx.org/en/docs/http/load_balancing.html)
