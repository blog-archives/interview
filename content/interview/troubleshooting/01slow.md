---
title: 接口变慢的完整排查路径
order: 1
id: 4dd29eefc9294dcb9e35eb95ece63366
---

- **复现与确认范围**：先确认是真的慢，还是偶发感受 → 自己请求接口/访问页面，判断是单接口、单服务、单 Pod，还是整个集群都慢
- **监控定位**：如果有 Grafana / APM → 看 **RT、P95/P99、QPS、错误率**，从集群下钻到服务、Pod、接口
- **Trace 定位链路**：如果有链路追踪 → 拿慢请求的 **trace_id**，看时间耗在哪个 RPC、MySQL、Redis 或业务 span
- **日志定位**：没有 Trace 但有日志 → 按 **latency / request_time / 接口 / Pod / 时间窗口**筛慢请求，再结合 request_id 看上下文和调用阶段
- **现场复现**：监控日志都缺失 → 浏览器 DevTools / curl 判断前端、网络还是后端；确认后端后进入对应机器或 Pod
- **资源排查**：定位到服务后，先看 **CPU、内存、GC、Load、磁盘 IO、网络、连接数**，判断是否有资源瓶颈
- **进程排查**：资源现象还不能解释问题 → Go 服务看 **pprof：CPU、goroutine、mutex、block、heap**，判断 CPU 热点、协程堆积、锁等待、内存问题
- **依赖排查**：如果请求明显在等待外部资源 → 查 **MySQL、Redis、下游 RPC、连接池**，看慢 SQL、连接池打满、Redis 慢命令、下游 RT
- **提出假设并验证**：看到现象后不要直接猜代码 → 比如 **CPU 高 → 怀疑死循环/热点计算/GC → pprof 验证**；**goroutine 堆积 → 怀疑等锁/等连接/等 RPC → stack/block/mutex 验证**
- **代码与变更确认**：证据已经缩小到具体函数/调用后 → 对齐故障时间和最近发布、配置变更，确认具体代码根因
- **修复与复盘**：修复问题后重新验证 RT 是否恢复；如果这次因为缺日志、缺监控导致排查困难 → 补 access log、慢请求日志、Trace、pprof、告警

**复现范围 → 监控 → Trace → 日志 → 现场复现 → 资源 → 进程 → 依赖 → 代码 → 修复复盘。**

![](assets/slow-api.svg)

## 一、资源层：先确认哪类资源异常

| 观察对象           | 工具 / 命令                                | 主要看什么                          | 结果如何继续判断               |
| ------------------ | ------------------------------------------ | ----------------------------------- | ------------------------------ |
| 进程 CPU、内存概览 | `top`                                      | 进程 CPU、内存、负载                | 找到异常进程后进入线程或 pprof |
| 交互式进程和线程   | `htop`                                     | 进程、线程、单核分布                | 判断是否单核打满或某进程异常   |
| 单进程线程 CPU     | `top -H -p <pid>`、`pidstat -p <pid> -t 1` | 哪个线程消耗 CPU                    | 关联 CPU profile 或线程栈      |
| 主机内存           | `free -h`                                  | available、swap、缓存               | 判断是否内存压力或发生 swap    |
| 内存与 IO 趋势     | `vmstat 1`                                 | swap、运行队列、上下文切换、IO wait | 区分内存、调度和 IO 等待       |
| 磁盘 IO            | `iostat -xz 1`                             | util、await、队列、吞吐             | 判断磁盘是否造成请求阻塞       |
| 网络连接           | `ss -s`、`ss -antp`                        | TCP 状态、连接堆积、端口占用        | 判断连接异常或网络等待         |
| 文件描述符         | `lsof -p <pid> \| wc -l`                   | FD 使用量                           | 判断连接 / 文件句柄是否耗尽    |
| Pod / Node 资源    | `kubectl top pod`、`kubectl top node`      | 容器和节点 CPU、内存                | 区分单 Pod、节点还是集群问题   |
| Pod 状态和事件     | `kubectl describe pod <pod>`               | 重启、探针失败、驱逐、事件          | 判断实例是否不稳定             |
| OOM 证据           | `dmesg \| grep -i oom`                     | OOM killer、内核异常                | 回到内存限制、泄漏或容器配置   |

## 二、Go 进程层：把资源现象映射到内部证据

前提是服务暴露了 `/debug/pprof/`，通常通过 `net/http/pprof` 开启。

| 进程现象           | 工具 / 命令                                               | 看到什么                        | 常见假设                                 |
| ------------------ | --------------------------------------------------------- | ------------------------------- | ---------------------------------------- |
| CPU 高             | `go tool pprof http://host:port/debug/pprof/profile`      | CPU hotspot、函数占比           | 热点计算、死循环、序列化、重试放大       |
| goroutine 数量暴涨 | `curl http://host:port/debug/pprof/goroutine?debug=2`     | 数量和共同 stack                | 等锁、等连接、等下游、channel 阻塞、泄漏 |
| 堆内存持续增长     | `go tool pprof http://host:port/debug/pprof/heap`         | 存活对象和占用来源              | 无界缓存、大对象、对象生命周期异常       |
| 分配速率高         | `go tool pprof http://host:port/debug/pprof/allocs`       | 哪些函数频繁分配                | 临时对象过多、GC 压力                    |
| 锁竞争             | `go tool pprof http://host:port/debug/pprof/mutex`        | 锁等待热点                      | 锁粒度过大、临界区过长                   |
| 阻塞严重           | `go tool pprof http://host:port/debug/pprof/block`        | channel、锁、等待点             | 并发协调或依赖等待                       |
| 线程数异常         | `go tool pprof http://host:port/debug/pprof/threadcreate` | 线程创建来源                    | CGO、阻塞系统调用、线程管理异常          |
| GC 频繁 / 停顿变长 | Prometheus `go_*` 指标；必要时 `GODEBUG=gctrace=1`        | GC 次数、停顿、堆大小、分配速率 | 分配过快、对象存活时间过长、堆配置不合理 |

### goroutine 堆积的判断顺序

```text
数量是否持续增长？
  → 请求下降后是否回落？
  → stack 是否长期集中在同一个等待位置？
  → 是否与连接池、下游 RT、锁竞争同时发生？
```

只有“持续增长 + 请求下降后不回落 + stack 长期相同”时，才更像 goroutine 泄漏；如果大量 goroutine 都在获取数据库连接或读取下游响应，更可能是依赖变慢造成的正常积压。

## 三、依赖层：MySQL、Redis、RPC 和连接池

### MySQL

| 关注项           | 工具 / 查询                                                | 主要判断                          |
| ---------------- | ---------------------------------------------------------- | --------------------------------- |
| 当前执行中的 SQL | `SHOW FULL PROCESSLIST;`                                   | 执行时间、状态、是否大量 `Locked` |
| 慢查询           | 慢查询日志、`pt-query-digest`                              | 慢 SQL、调用次数、总耗时          |
| SQL 汇总         | `sys.statement_analysis`                                   | 平均耗时、扫描行数、调用次数      |
| 执行计划         | `EXPLAIN`、`EXPLAIN ANALYZE`                               | 是否走索引、扫描是否过多          |
| 当前事务         | `information_schema.innodb_trx`                            | 长事务、事务开始时间、未提交事务  |
| 锁等待           | `SHOW ENGINE INNODB STATUS\G`                              | 死锁、锁等待、冲突事务            |
| 阻塞关系         | `performance_schema.data_locks`、`data_lock_waits`         | 谁阻塞谁、等待哪把锁              |
| 连接压力         | `SHOW STATUS LIKE 'Threads_connected';`、`Threads_running` | 当前连接和运行中连接              |
| 连接上限         | `SHOW VARIABLES LIKE 'max_connections';`                   | 是否接近数据库上限                |

### Redis

| 关注项          | 工具 / 查询                             | 主要判断                     |
| --------------- | --------------------------------------- | ---------------------------- |
| 慢命令          | `SLOWLOG GET 20`                        | 哪些命令耗时高               |
| 延迟            | `redis-cli --latency`、`LATENCY DOCTOR` | 延迟抖动和阻塞原因           |
| 客户端连接      | `INFO clients`、`CLIENT LIST`           | 连接数、阻塞客户端           |
| 内存            | `INFO memory`                           | 使用量、碎片率、是否接近上限 |
| 命令分布        | `INFO commandstats`                     | 哪类命令调用多、耗时高       |
| 大 key / 热 key | `redis-cli --bigkeys`、`--hotkeys`      | 数据结构和访问热点问题       |

### RPC / HTTP 下游

| 关注项       | 工具 / 数据源                        | 主要判断                                |
| ------------ | ------------------------------------ | --------------------------------------- |
| 下游分段耗时 | Trace span                           | 建连、发送、等待响应分别耗时多少        |
| 代理转发耗时 | 网关 / access log 的 `upstream_time` | 慢在网关前还是下游服务                  |
| 下游稳定性   | Prometheus RT、错误率、超时率        | 是否为下游整体故障                      |
| 临时复现     | `curl -v`、`curl -w`                 | DNS、TCP、TLS、TTFB、总耗时             |
| 连接池       | 客户端池指标                         | active、idle、wait count、wait duration |

Go `database/sql` 可通过 `db.Stats()` 关注：`OpenConnections`、`InUse`、`Idle`、`WaitCount`、`WaitDuration`、`MaxOpenConnections`。

## 四、从现象到根因的闭环

```text
现象 → 提出假设 → 选择能证伪假设的工具 → 得到证据 → 确认根因或提出新假设
```

例如：

```text
连接池打满
→ 是 QPS 变大，还是单连接占用变长？
→ 看 QPS、WaitDuration、SQL RT、慢 SQL、锁等待、事务时间
→ 证据支持哪一种，再决定扩容、优化 SQL、缩短事务或修复连接泄漏
```
