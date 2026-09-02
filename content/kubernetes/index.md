---
title: Kubernetes 面试题
order: 2
---

这套题按面试中的理解顺序整理：先说明 Kubernetes 为什么存在，再讲工作负载、网络、配置、资源和存储，最后落到排障与生产设计。

## 阅读顺序

1. [[/kubernetes/basic|基础与架构]]：控制面、工作节点、声明式 API 与控制循环
2. [[/kubernetes/workload|Pod 与工作负载]]：Deployment、StatefulSet、DaemonSet、滚动更新与探针
3. [[/kubernetes/service|服务发现与网络]]：Service、DNS、Ingress / Gateway API 与网络排障
4. [[/kubernetes/config|配置与密钥]]：ConfigMap、Secret、配置更新与安全边界
5. [[/kubernetes/resource|资源与弹性伸缩]]：requests、limits、QoS、Pending 与 HPA
6. [[/kubernetes/pv|持久化存储]]：PV、PVC、StorageClass、访问模式与回收策略
7. [[/kubernetes/problem|故障排查]]：CrashLoopBackOff、访问失败、镜像拉取、优雅下线与节点故障
8. [[/kubernetes/advanced|生产实践与系统设计]]：技术选型、Go 服务改造、灰度发布、网络隔离和可观测性

## 一条主线记住 Kubernetes

> 用户向 API Server 声明期望状态，状态保存在 etcd；Controller 持续消除期望与实际的差异，Scheduler 为未调度的 Pod 选择 Node，Node 上的 kubelet 再通过容器运行时把 Pod 跑起来。

面试回答不要只背资源对象，建议使用下面的结构：

1. 先用一句话给定义或结论；
2. 再说明工作机制或请求链路；
3. 最后补充适用边界、常见故障和排查方式。

## 官方核对资料

- [集群架构](https://kubernetes.io/docs/concepts/architecture/)
- [工作负载与控制器](https://kubernetes.io/docs/concepts/workloads/controllers/)
- [Service、负载均衡与网络](https://kubernetes.io/docs/concepts/services-networking/)
- [资源管理](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
- [持久卷](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [Pod 生命周期与探针](https://kubernetes.io/docs/concepts/workloads/pods/probes/)

> 说明：题目按通用 Kubernetes 机制回答。云厂商、CNI、CSI、Ingress / Gateway Controller 和 Service 数据面的具体实现可能不同，面试中应结合所在环境说明。
