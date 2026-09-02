---
title: 持久化存储
order: 6
---

## PV、PVC、StorageClass 分别是什么？为什么要分层？

- **PersistentVolume（PV）**：集群级资源，表示一份已制备的持久存储，生命周期独立于使用它的 Pod；
- **PersistentVolumeClaim（PVC）**：Namespace 级资源，表示应用对容量、访问模式和存储类别的申请；
- **StorageClass**：集群级资源，描述一类存储的 provisioner、参数、回收策略、绑定时机和扩容能力等。

Pod 引用 PVC，而不是直接耦合某块云盘、NFS 路径或具体 PV。控制面为 PVC 匹配已有 PV，或依据 StorageClass 动态制备，使存储供给与应用消费解耦。PV 与 PVC 的绑定通常是一对一；多个 Pod 能否共用同一个 PVC，则取决于访问模式、底层存储和调度位置。

### 延伸问题

1. 删除 Pod 后数据会消失吗？

> 通常不会。Pod 删除不会自动删除独立 PVC；替代 Pod 引用同一 PVC 时可以重新挂载原数据。但若使用 `emptyDir`、容器可写层等临时存储，Pod 消失时数据也会丢失。

2. PVC 一定能绑定成功吗？

> 不一定。容量、访问模式、StorageClass、selector、存储拓扑或 provisioner 能力不匹配时，PVC 会保持 Pending。

3. 不同 Namespace 的 Pod 能引用同一 PVC 吗？

> 不能直接引用。PVC 属于 Namespace，Pod 只能引用同 Namespace 的 PVC；PV 和 StorageClass 则是集群级资源。

## 静态制备和动态制备有什么区别？`WaitForFirstConsumer` 解决什么问题？

静态制备由管理员先创建底层存储和 PV，再等待 PVC 匹配。动态制备是在 PVC 出现后，由 StorageClass 指定的 CSI provisioner 创建底层存储和 PV，并自动绑定。

PVC 未填写 `storageClassName` 时，集群如果有默认 StorageClass，通常会采用默认类；显式设置 `storageClassName: ""` 则表示不请求 StorageClass 动态制备，并只匹配无存储类的 PV。

StorageClass 的 `volumeBindingMode` 常见为：

- `Immediate`：PVC 创建后立即制备和绑定；
- `WaitForFirstConsumer`：等使用 PVC 的 Pod 参与调度后，再综合 Node、可用区、亲和性等约束选择或创建存储，避免卷与 Pod 拓扑冲突。

### 延伸问题

1. 动态制备失败如何排查？

> 先看 PVC Events，再检查 StorageClass、CSI Controller / Node 插件、配额、云权限、容量和拓扑限制。Pod 与 PVC 互相等待时要结合两者的 Events 分析。

2. 一个集群可以有多个 StorageClass 吗？

> 可以，例如普通盘、SSD 和共享文件存储。应用按性能、成本、访问模式、可用区和数据保护要求选择。

3. PVC 扩容需要什么条件？

> StorageClass 允许扩容、CSI 驱动和底层存储支持相应操作，文件系统扩容还可能在节点挂载阶段完成。扩容前仍应备份重要数据并验证驱动行为。

## RWO、ROX、RWX、RWOP 分别表示什么？

| 模式 | 含义 |
|---|---|
| `ReadWriteOnce`（RWO） | 可由一个 Node 以读写方式挂载 |
| `ReadOnlyMany`（ROX） | 可由多个 Node 以只读方式挂载 |
| `ReadWriteMany`（RWX） | 可由多个 Node 以读写方式挂载 |
| `ReadWriteOncePod`（RWOP） | 整个集群中只允许一个 Pod 以读写方式挂载，需 CSI 支持 |

RWO 限制的是 Node，不等于只能有一个 Pod；同一 Node 上的多个 Pod 仍可能访问同一 RWO 卷。访问模式主要用于能力声明、匹配和挂载约束，RWX 也不会自动提供文件锁、事务或应用级一致性，并发安全仍由存储系统和应用负责。

### 延伸问题

1. 为什么很多云硬盘不支持 RWX？

> 块存储通常面向单节点挂载；多节点共享读写一般需要 NFS、CephFS 等共享文件系统或其他明确支持多挂载的存储。

2. PVC 申请 RWX 一直 Pending，常见原因是什么？

> 集群没有能提供 RWX 的 PV，或所选 StorageClass / CSI 驱动不支持该模式。写了 RWX 不会让底层单挂载磁盘自动具备共享能力。

3. 只允许一个 Pod 写为什么优先考虑 RWOP？

> RWO 仍可能被同一 Node 上多个 Pod 使用；RWOP 表达的是集群范围单 Pod 挂载约束，更接近该需求，但必须确认 CSI 驱动支持。

## 删除 PVC 后，PV 和底层数据会怎样？

主要取决于绑定 PV 的 `persistentVolumeReclaimPolicy`：

- `Delete`：PVC 释放后，系统通常删除 PV 对象，并让存储插件删除底层资产；
- `Retain`：PV 进入 Released，底层数据保留，需要管理员确认、清理或重新绑定。

动态 PV 的回收策略通常继承创建它的 StorageClass。最终应查看实际 PV，而不是仅凭“动态盘”猜测。正在被 Pod 使用的 PVC 有存储对象保护机制，删除请求可能进入 Terminating，直到使用关系解除。

### 延伸问题

1. `Retain` 的 PV 会立刻给新 PVC 使用吗？

> 通常不会。Released PV 仍保留旧 claim 信息和数据，需要管理员先决定数据处置并清理绑定信息。

2. 删除前把回收策略改成 `Retain` 能代替备份吗？

> 不能。它只能降低自动删除底层卷的风险，无法防止应用误写、存储故障、账号误删或区域灾难。重要数据仍需快照、备份和恢复演练。

3. 删除 PVC 是否一定立即删除云盘？

> 不应这样承诺。除回收策略外，还受 CSI 驱动、finalizer、云 API 和故障状态影响；应检查 PV、VolumeAttachment、CSI 日志及云资源实际状态。

## 为什么数据库常用 StatefulSet 加 PVC？

StatefulSet 为每个副本提供稳定序号和网络身份，并可通过 `volumeClaimTemplates` 为每个 Pod 创建独立 PVC。Pod 被替换后，相同序号的 Pod 能重新挂载原 PVC，适合需要稳定成员身份和持久数据的系统。

但“StatefulSet + PVC”不等于生产级数据库高可用：

- StatefulSet 不负责数据库复制、选主、脑裂防护和一致性；
- PVC 不等于备份，也不保证跨可用区恢复；
- 简单增加副本不会自动形成正确的 MySQL / Redis 集群；
- 多个数据库实例直接共享同一数据目录可能导致损坏。

生产环境通常优先评估托管数据库或成熟 Operator，并设计备份、恢复、升级、监控、容量和故障演练。

### 延伸问题

1. StatefulSet 缩容会自动删除 PVC 吗？

> 默认行为通常是保留 PVC 以避免误删数据；新版本也提供可配置的 PVC 保留策略。面试中应说明实际行为要查看 `persistentVolumeClaimRetentionPolicy` 和集群版本。

2. StatefulSet 是否保证 Pod 按顺序运行？

> 默认 `OrderedReady` 策略会按序创建和终止；`Parallel` 会放宽顺序。顺序只是一种编排能力，应用仍要正确处理重试和成员状态。

3. Pod 回来后挂上原 PVC，服务就一定恢复了吗？

> 不一定。还要确认数据完整、文件系统正常、数据库日志可恢复、拓扑允许挂载，并避免旧节点上残留实例与新实例同时写入。
