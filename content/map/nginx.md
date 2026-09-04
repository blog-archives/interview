---
title: Nginx
order: 4
---

## 1. 它是什么

**Nginx** 是一个高性能的 **Web 服务器（Web Server）** 和 **反向代理服务器（Reverse Proxy Server）**，也可以承担负载均衡、静态资源服务、HTTPS 终止、限流等流量处理工作。

如果只用一句话介绍，可以说：

> **Nginx 是一个通常部署在客户端和业务服务之间的高性能 Web 服务器和反向代理服务器，负责接收请求、匹配规则、转发流量，并可以在多个后端实例之间进行负载均衡。**

因此，不建议简单把 Nginx 定义成“网关”或者“路由”。**路由和网关能力只是它可以承担的职责；它更基础、更准确的定位仍然是 Web Server + Reverse Proxy。**

对于后端系统，可以先把 Nginx 放到这个位置理解：

```text
                         ┌─ 静态文件
                         │
Client ──────→ Nginx ────┼─→ Go Server A
                         ├─→ Go Server B
                         └─→ Go Server C
```

它最常见的几个使用场景是：

- 直接提供 HTML、CSS、JS、图片等静态资源；
- 作为反向代理，把请求转发给 Go、Java 等业务服务；
- 在多个业务实例之间进行负载均衡；
- 额外承担 HTTPS、限流等统一流量入口能力。

它不负责业务逻辑，也不能代替数据库、消息队列、注册中心或分布式一致性系统。

---

## 2. 最小工作模型

理解 Nginx，可以先忽略高并发、负载均衡等能力，只看一个最简单的反向代理。

假设客户端访问：

```text
https://api.example.com/users
```

Nginx 收到请求之后，根据配置找到对应处理规则：

```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
    }
}
```

此时真正处理业务的是 `127.0.0.1:8080` 上运行的 Go 服务。

整个过程是：

```text
Client
   │
   │ Request
   ▼
Nginx
   │
   │ proxy_pass
   ▼
Go Service
   │
   │ Response
   ▼
Nginx
   │
   ▼
Client
```

这里最重要的一点是：

> **反向代理不是告诉客户端“你去另一个地址访问”，而是 Nginx 自己替客户端访问后端，再把后端响应返回客户端。**

Nginx 官方的代理模块本质上就是负责把请求传递给其他服务器。

这和 **重定向（Redirect）** 完全不同。

反向代理：

```text
Client → Nginx → Backend → Nginx → Client
```

重定向：

```text
Client → Nginx
          │
          └─ 返回 301 / 302 + 新地址

Client → 新地址
```

所以可以简单记：

> **代理是“我替你去访问”，重定向是“我告诉你去哪，你自己重新访问”。**

---

## 3. 核心概念与关系

### Master Process 与 Worker Process

Nginx 使用 **主进程 / 工作进程模型（Master/Worker Process Model）**。

**Master Process** 负责读取配置、启动和管理 Worker、处理 reload 等管理工作。

**Worker Process** 才真正负责接收连接和处理请求。

因此：

```text
Master
  ↓
多个 Worker
  ↓
处理客户端连接和请求
```

Worker 采用事件驱动方式处理网络连接，一个 Worker 可以同时管理大量连接，而不需要为每个连接单独创建一个线程。这是 Nginx 擅长高并发网络 I/O 的重要基础。Nginx 官方入门文档也将 master 与 worker 的职责明确区分。

### server 与 location

客户端请求进入 Nginx 后，需要先确定：

> **这个请求应该按照哪一组规则处理？**

**`server`** 表示一个虚拟服务器（Virtual Server），主要根据监听端口、域名等信息确定请求属于哪个站点。

例如：

```nginx
server {
    listen 80;
    server_name api.example.com;
}
```

确定 `server` 后，再根据 URI 匹配 **`location`**：

```nginx
location /api/ {
    ...
}
```

所以第一阶段可以理解为：

```text
请求
 ↓
server：属于哪个站点？
 ↓
location：这个 URL 怎么处理？
```

Nginx 官方请求处理文档描述的也是先确定处理请求的 `server`，再根据 URI 选择相应的 `location`。

### proxy_pass

**`proxy_pass`** 是反向代理最核心的指令之一，表示：

> **当前请求要代理到哪个后端。**

例如：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8080;
}
```

因此到目前为止，请求处理主线已经可以写成：

```text
Client
 → Nginx
 → server
 → location
 → proxy_pass
 → Go Service
```

### upstream

如果后端只有一个实例，`proxy_pass` 指向一个地址即可。

但实际生产系统通常会部署多个实例：

```text
10.0.0.1:8080
10.0.0.2:8080
10.0.0.3:8080
```

这时可以定义 **上游服务器组（Upstream Group）**：

```nginx
upstream backend {
    server 10.0.0.1:8080;
    server 10.0.0.2:8080;
    server 10.0.0.3:8080;
}

location /api/ {
    proxy_pass http://backend;
}
```

`upstream` 可以理解为：

> **一组都能够处理这个请求的候选后端实例。**

而负载均衡算法负责回答：

> “这一次到底选哪一个？”

---

## 4. 一次典型请求如何完成

假设客户端请求：

```http
GET /api/users
Host: api.example.com
```

第一步，请求到达 Nginx，由 Worker 处理连接。

第二步，Nginx 根据监听端口、`Host` 等信息找到对应的 `server`。

第三步，根据 `/api/users` 匹配对应 `location`。

例如：

```nginx
location /api/ {
    proxy_pass http://backend;
}
```

第四步，发现目标是一个 `upstream`：

```nginx
upstream backend {
    server 10.0.0.1:8080;
    server 10.0.0.2:8080;
}
```

Nginx 根据负载均衡策略，从中选择一个实例，比如：

```text
10.0.0.2:8080
```

第五步，Nginx 与这个 Go 服务建立连接，把 HTTP 请求转发过去。

Go 服务完成业务处理后，把 Response 返回给 Nginx。

最后：

```text
Go Service
   ↓
Nginx
   ↓
Client
```

所以动态请求最核心的一条链路就是：

> **请求进入 → server → location → proxy_pass → upstream 选节点 → Backend → Nginx → Client**

---

## 5. 静态资源与负载均衡

### 静态资源

Nginx 不一定要把所有请求都交给 Go 服务。

例如：

```nginx
location / {
    root /var/www/frontend;
}
```

服务器文件系统中存在：

```text
/var/www/frontend/
├── index.html
├── app.js
├── app.css
└── logo.png
```

客户端请求：

```text
/logo.png
```

Nginx 可以直接找到文件并返回客户端，不需要经过 Go 服务。

所以：

> **静态资源通常由 Nginx 直接从它能够访问的文件系统中读取并返回。**

这里的文件可以位于机器本地，也可以通过容器 Volume 等方式挂载进去。Nginx 官方 Beginner's Guide 就使用本地目录中的 HTML 和图片演示静态文件服务。

典型的前后端部署就是：

```nginx
location / {
    root /var/www/frontend;
}

location /api/ {
    proxy_pass http://backend;
}
```

于是：

```text
/index.html
/app.js
/logo.png
        ↓
Nginx 自己返回

/api/users
/api/orders
        ↓
Nginx → Go Service
```

可以简单记：

> **静态资源 Nginx 自己拿，动态业务请求去后端拿。**

### 负载均衡

当 upstream 中有多个后端实例时，Nginx 需要选择一个。

最需要掌握四类策略：

| 策略 | 核心逻辑 | 典型用途 |
|---|---|---|
| Round Robin | 轮流分配 | 默认、实例性能接近 |
| Weight | 性能强的多分流量 | 机器配置不同 |
| Least Connections | 选择当前活跃连接较少的实例 | 请求耗时差异较大 |
| IP Hash / Hash | 根据 IP 或指定 Key 决定实例 | 会话粘性、固定映射 |

默认情况下，Nginx 可以按 **轮询（Round Robin）** 分配请求；也支持 Least Connections、IP Hash，并可以通过 `weight` 影响服务器被选中的比例。

因此负载均衡并不神秘，本质就是：

> **upstream 定义候选服务器池，负载均衡算法负责从池子里挑一个。**

---

## 6. 可靠性与扩展

首先考虑后端实例故障。

假设：

```text
Go A：正常
Go B：故障
Go C：正常
```

Nginx 的反向代理具备 **被动健康检查（Passive Health Check）** 能力。

如果与某个 upstream 实例通信发生失败，可以根据失败次数和时间窗口暂时把它视为失败节点，并尽量避免继续把请求分配给它。相关行为可以通过 `max_fails`、`fail_timeout` 等参数控制。

因此：

```text
            ┌─ Go A ✓
Client → Nginx
            ├─ Go B ✗
            │
            └─ Go C ✓
```

后端单个实例故障，不一定导致整个服务不可用。

但需要特别注意：

> **Nginx 能保护后端实例故障，不代表 Nginx 自己天然高可用。**

如果只有：

```text
Client → Nginx → Backend
          ↑
        单节点
```

Nginx 自己挂掉，整个入口仍然不可用。

因此真正的生产高可用通常需要：

```text
Client
   ↓
LB / VIP / DNS
   ↓
多个 Nginx
   ↓
多个 Backend
```

单机内部可以通过多个 Worker 利用多核 CPU；单台机器能力不足时，则需要增加 Nginx 实例实现水平扩展。

还要记住：

> **多个 Worker ≠ 多个 Nginx 节点。**

Worker 主要解决一台机器内部的并行处理能力，而多个 Nginx 实例才能解决整台机器故障和更大的水平扩展问题。

---

## 7. 为什么 Nginx 适合做这件事

第一个原因是它采用**事件驱动的网络处理模型**。

传统的“一连接一线程”模型，在连接数非常大时会带来更多线程、内存占用和上下文切换。

Nginx Worker 更倾向于：

> 一个 Worker 同时维护大量连接，哪个连接发生网络事件，就处理哪个连接。

因此它特别适合反向代理、静态文件、长连接等 I/O 密集型工作。

第二个原因是 **Master / Worker 分离**。

Master 负责进程和配置管理，Worker 专心处理请求，使配置 reload 可以通过启动新的 Worker、逐步退出旧 Worker 的方式完成，而不是粗暴中断全部现有连接。

第三个原因是：

> **流量处理和业务逻辑解耦。**

客户端只需要知道：

```text
api.example.com
```

至于后面到底有：

```text
Go A
Go B
Go C
```

甚至后端机器发生扩缩容，对客户端都可以保持透明。

相应代价是：系统多了一层网络代理和配置；Nginx 配置错误可能影响大量流量；而且它只负责入口流量管理，不能解决应用内部的业务容错、数据一致性等问题。

---

## 8. 容易混淆的概念

| 概念 | 主要作用 | 关键区别 |
|---|---|---|
| Reverse Proxy / Redirect | 代理访问 / 告诉客户端新地址 | Proxy 是 Nginx 去访问；Redirect 是客户端重新访问 |
| Web Server / Reverse Proxy | 自己返回内容 / 转发给后端 | 静态文件常用前者，API 常用后者 |
| server / location | 找站点 / 找 URI 规则 | 先 server，再 location |
| proxy_pass / upstream | 指定代理目标 / 定义后端服务器组 | upstream 解决“有哪些候选后端” |
| 多 Worker / 多 Nginx | 单机并行 / 水平扩展、高可用 | Worker 不能解决整台机器故障 |

---

## 9. 面试时需要掌握到什么程度

如果面试官问：

> **“你了解 Nginx 吗？”**

只回答：

> “Nginx 是一个反向代理服务器。”

虽然没有错，但信息量偏少，只证明知道一个标签。

对于普通 Go 后端岗位，更合适的回答是：

> **“了解。Nginx 是一个高性能的 Web 服务器和反向代理服务器，在后端系统里经常作为统一流量入口。它可以通过 server 和 location 匹配请求，再通过 proxy_pass 转发给后端服务；如果后端有多个实例，可以通过 upstream 配合轮询、权重、最少连接等策略做负载均衡。另外它也可以直接提供静态资源、处理 HTTPS、限流等。Nginx 本身采用 Master/Worker 和事件驱动模型，因此比较适合处理大量并发网络连接。”**

### 面试官通常会沿着这些方向继续追问

> 什么叫反向代理？

反向代理就是客户端只访问 Nginx，由 Nginx 代替客户端请求真正的后端服务，再把后端响应返回给客户端。

> 代理和重定向有什么区别？

代理是 Nginx 自己去访问目标服务，客户端通常不知道真实后端；重定向是 Nginx 告诉客户端一个新地址，由客户端重新发起请求。

> Nginx 怎么提供静态文件？

Nginx 可以根据 `root` 等配置，直接读取它能够访问的文件系统中的 HTML、CSS、JS、图片等文件并返回给客户端，不需要经过后端应用。

> 多个后端怎么做负载均衡？

可以通过 `upstream` 配置多个后端实例，再使用轮询、权重、最少连接、Hash 等策略选择一个实例转发请求。

> 后端节点挂了怎么办？

Nginx 可以根据连接或请求失败情况暂时避开异常节点，把流量继续转发给其他可用的后端实例。

> 为什么 Nginx 并发性能比较好？

核心原因是它采用 Master/Worker 进程模型和事件驱动的网络处理方式，一个 Worker 可以高效管理大量并发连接。

> Nginx 自己挂了怎么办？

单个 Nginx 仍然存在单点问题，生产环境通常会部署多个 Nginx 实例，再通过 VIP、云负载均衡或 DNS 等方式实现入口高可用。

> 你们项目里怎么使用 Nginx？

可以结合实际项目回答，例如让 Nginx 作为统一入口，负责 HTTPS、静态资源、API 反向代理以及多个 Go 服务实例之间的负载均衡。

所以对于普通后端开发，第一阶段真正需要掌握的是：

```text
定义
 ↓
反向代理
 ↓
静态资源
 ↓
server / location / proxy_pass
 ↓
upstream
 ↓
负载均衡
 ↓
后端故障处理
 ↓
Master / Worker + 事件驱动
```

如果这条链路能够顺畅讲下来，对“了解 Nginx 吗？”这个问题已经足够形成一个完整而可信的回答。

---

## 10. 第一阶段记忆卡

1. **Nginx 是高性能 Web Server 和 Reverse Proxy，后端系统中经常作为统一流量入口。**
2. **反向代理是 Nginx 自己访问 Backend，再把结果返回客户端；不是让客户端重新访问 Backend。**
3. **HTTP 请求通常先匹配 `server`，再匹配 `location`，最后决定如何处理。**
4. **`proxy_pass` 负责转发请求，`upstream` 负责组织多个候选后端实例。**
5. **静态 HTML、CSS、JS、图片可以由 Nginx 直接从文件系统读取并返回，不需要经过 Go 服务。**
6. **多个 Backend 可以通过 Round Robin、Weight、Least Connections、Hash 等策略进行负载均衡。**
7. **后端节点故障时 Nginx 可以暂时避开失败节点，但单个 Nginx 自己仍然可能是单点。**
8. **Nginx 使用 Master/Worker 和事件驱动模型，核心优势是高效处理大量网络 I/O，而不是执行复杂业务逻辑。**

---

## 11. 后续深入方向

1. `location` 的精确匹配、前缀匹配和正则匹配优先级是什么？
2. `proxy_pass` 带 URI 与不带 URI 时，转发路径有什么区别？
3. Nginx Worker 的事件循环与 Linux `epoll` 是如何配合的？
4. Keepalive 为什么能减少 Nginx 与 Backend 之间的连接开销？
5. `proxy_buffering` 对性能和响应有什么影响？
6. Nginx 如何实现限流和连接数限制？
7. HTTPS/TLS 为什么经常在 Nginx 层终止？
8. 多个 Nginx 实例在生产环境中如何实现真正的高可用？

## 资料来源

- Nginx 官方 Beginner's Guide。
- Nginx 官方 How nginx processes a request。
- Nginx 官方 `ngx_http_proxy_module` 文档。
- Nginx 官方 HTTP Load Balancing 文档。