# Pod 异常类

Pod是K8s中最小的调度单元，一个Pod可以封装一个或多个容器，包含业务应用容器、存储卷、网络配置以及容器运行所需的各类元数据，集群调度、网络、存储都是围绕Pod来管理。

## Pod类故障通用排查总览

> 现象大类：Pod起不来、反复重启、异常被杀、Running但业务不可用。

**第一步：`kubectl describe pod <pod‑name>`，优先读Events事件块**
绝大多数K8s层面的标记都会在这里：Pending调度失败、OOMKilled、Evicted驱逐、探针失败、容器退出、镜像拉取失败。
拿到事件信息，就能先区分故障大类：调度问题？镜像？存储？资源？探针？容器内部崩溃？

> 很多故障到这一步就已经定位方向，不需要看日志。

**第二步：看日志，前提：容器实例曾经创建过**

1. 容器还在运行：`kubectl logs pod-name`，取当前容器日志
2. 容器已经崩溃重启：加 `-p / --previous`，读取上一次崩溃容器日志 `kubectl logs -p pod-name`
3. Pod内多容器：必须追加 `-c 容器名` 指定目标容器，不然默认拿第一个容器日志。示例：`kubectl logs -p pod-name -c sidecar`

> ⚠️重要边界（面试容易踩坑）

1. Pending状态：容器根本没创建，**logs / logs -p 无效，只靠describe事件排查**
2. Evicted驱逐：旧Pod整体被删除销毁，`‑p` 也拿不到旧Pod日志，要去查旧Node和集群全局事件
3. 内核强杀（OOM、死锁卡死）：程序来不及输出日志，日志可能为空，不能完全依赖日志，需要exec进容器手动复现问题。

**第三步：日志拿到业务报错之后，落到业务代码/配置/资源参数去修复**

---

## Pod 处于 CrashLoopBackOff 反复重启，你如何排查定位问题？

CrashLoopBackOff是容器反复退出崩溃后，kubelet触发的回退重试状态。容器启动后很快异常退出，kubelet会不断尝试重启容器；多次重启失败后，会拉长重启间隔避免无限疯狂重试，就进入该状态，并不直接代表某一个具体故障，只是反复崩溃后的现象。

排查优先看事件再看日志：先执行 `kubectl describe pod` 查看事件，确认退出码、是否OOMKilled；再用`kubectl logs -p`获取上一次崩溃容器的日志，定位程序侧报错；再核对镜像、启动命令、资源limit、健康检查配置，区分是业务代码问题、配置错误，还是K8s资源层面导致的崩溃。

## Pod 状态一直 Pending，无法正常启动，请说你的排查流程。

Pending 代表 Pod 已经被 apiserver 接收保存到 etcd，但**还没有调度到节点上，或者已经分配节点但容器还没完成创建**。这个阶段业务容器还没跑起来，不会产生业务日志，logs 命令在这里基本没用。

优先执行`kubectl describe pod <pod名>`，重点看 Events 事件块，Pending 几乎所有原因都会在这里体现。

1. 如果提示调度失败：看事件判断原因，常见有节点资源不足、污点容忍不匹配、节点亲和 / 反亲和规则不满足、PVC 无法绑定；
2. 如果已经分配到 node，但卡在拉镜像阶段：排查镜像地址、镜像密钥、镜像是否存在、网络能否拉取镜像；
3. 再核对 Pod yaml：资源 request、PVC 声明、污点容忍、亲和配置；
4. 辅助命令：`kubectl get events --sort-by=.metadata.creationTimestamp`看集群全局事件，确认是否有其他集群层面约束。

> 面试口述要点：Pending 不要去敲 logs，容器没启动拿不到日志，核心靠 describe 看事件。

## Pod 显示 Running，但是业务访问完全没有响应，怎么排查？

Pod 为 Running，仅代表容器进程已经启动，K8s 层面认为容器存活；**不代表业务程序正常就绪，也不代表网络、服务注册没问题**。有可能业务卡死、内部端口没监听、探针失败、服务没注册、网络不通，业务就是无法对外响应。

Pod 状态为 Running，只代表容器已经跑起来，不代表内部业务服务正常。
先用 kubectl describe pod 简单过一遍事件，重点看就绪探针是否持续失败；
接着看 kubectl logs 查看业务日志，如果日志完备，就能判断业务有没有正常启动、有没有报错；
如果日志看不出线索，就进入容器内部自测端口，区分是业务自身问题，还是 K8s 网络、service 层面的问题。

## Pod 被 OOMKilled 杀掉，重启，如何排查根因以及处理？

OOMKilled 代表容器内进程内存使用，超过 Pod 设置的`resources.limits.memory`内存上限，内核直接把容器杀掉；Kubelet 检测到容器退出，就会重新拉起容器，于是出现反复重启。注意：是 K8s 的 limit 触发，不是宿主机整体内存耗尽。

1. `describe pod` 事件会直接打印 OOMKilled，同时核对 yaml 里的 `limits.memory`，确认阈值是多少。
2. `kubectl logs -p` 看被杀之前的业务日志。**这里有个高频坑：内核直接杀进程，程序没有机会输出崩溃日志，日志经常是空的，拿不到业务报错，不能完全依赖日志定位泄漏。**
3. `kubectl top pod` 观察内存走势，看是一启动就打满，还是运行一段时间慢慢上涨，用来区分是配置太小，还是内存泄漏。
4. 如果怀疑内存泄漏，就要落到业务侧：Go 服务就用 pprof 采集内存指标，定位到底哪块逻辑在不停吃内存，回到代码层面修复；如果只是业务本身负载就需要更大内存，直接调大 limit 即可。

## Pod 反复被节点驱逐 Evicted，频繁重建，怎么排查？

Evicted 代表**节点侧 kubelet 主动驱逐 Pod**。
注意和 OOMKilled 区分：

- OOMKilled：Pod 自己的内存超过自己的`limits`，内核杀掉这个容器，Pod 还待在原节点。
- Evicted：**整个宿主机节点资源快要耗尽（内存、磁盘、inode 打满）**，kubelet 为了保护节点本身不崩溃，挑选部分 Pod 直接驱逐，Pod 会被删掉，控制器再重新调度到别的节点重建。

被驱逐的 Pod 本身容器不一定有 bug，问题根源大多在**节点机器资源压力**，不是 Pod 内部业务报错。

Pod 发生 Evicted 驱逐之后，旧 Pod 已经被删除，现在看到的是控制器重建后的新 Pod，不能排查新 Pod。
首先 `kubectl describe pod` 当前新 Pod，从事件中获取被驱逐时的旧 Node 名称和驱逐原因。
然后针对这个旧节点，使用`kubectl top node`看资源占用，`kubectl describe node`查看节点层面的事件。
如果事件信息不全，就用`kubectl get events --sort-by=.metadata.creationTimestamp`全局回溯集群历史事件。
注意：旧 Pod 已经销毁，`kubectl logs -p`拿不到被驱逐 Pod 的日志。

## Pod 启动后不断被 livenessProbe 存活探针杀掉重启，你怎么做？

livenessProbe 存活探针，是 kubelet 用来检测**容器内部业务是不是还活着**的机制。
它会按照配置间隔，去执行检测（http 请求、tcp 端口探测、执行容器内命令）。

- 如果探测成功：认为业务正常，什么都不做；
- 如果连续多次探测失败：kubelet 判定容器卡死、僵死，直接杀掉容器，然后重启容器。

> 区分：容器进程没挂，但是业务卡死不响应，进程还在，Pod 状态依旧 Running，就靠存活探针发现问题，主动重启。
> 和 readinessProbe 就绪探针不一样：liveness 失败 → **杀容器重启**；readiness 失败 → 摘掉 service 流量，不杀容器。

1. `kubectl describe pod <pod名称>`，Events 事件里会明确打印存活探针探测失败、容器被 kill 的记录，同时这里可以看到探针的完整配置：探测方式、超时时间、失败阈值。
2. `kubectl logs -p <pod名>`，查看上一次被杀掉容器的业务日志，看业务是否卡死、死锁、阻塞。
3. 模拟探针的检测逻辑：`kubectl exec`进入 Pod 内部，手动复现探针的检测，比如 curl 健康检查接口，看是否超时、报错。
4. 分析两种根因：
    - 业务真实故障：业务死锁、阻塞，确实无法响应探针，需要修复业务代码；
    - 探针配置不合理：超时时间太短、初始延迟 initialDelaySeconds 设置过小，业务还没启动完成探针就开始检测，误杀容器。

## Pod 就绪探针 readinessProbe 一直失败，Pod 无法加入 Service 后端，如何排查？

就绪探针用来判断**业务是否已经准备好接收流量**。探测失败的时候，**不会杀掉容器，不会重启 Pod**，仅仅把这个 Pod 从 Service 的 Endpoints 后端列表中摘除，流量不会转发过来。Pod 状态依旧是 Running。

> 和 livenessProbe 对比：
> liveness 失败 → 杀容器重启；
> readiness 失败 → 摘掉流量，容器继续运行。

1. `kubectl describe pod <pod名称>`，事件会输出就绪探针失败记录，同时查看探针配置：探测方式、超时、初始延迟。
2. `kubectl get endpoints <service名称>`，可以直观确认这个 Pod 确实不在服务后端列表里。
3. `kubectl logs <pod名>` 查看当前 Pod 日志，看启动过程有没有报错、初始化有没有卡住。这里不需要 `-p`，容器没有被销毁重启。
4. `kubectl exec -it` 进入 Pod 内部，手动执行探针的检测逻辑（curl 健康接口 / 执行探测命令），复现失败现象。
5. 判断根因：
    - 业务问题：服务初始化慢、启动报错，健康接口返回异常；
    - 配置问题：initialDelaySeconds 太短，业务还没初始化完成就开始探测。

## 同一个 Pod 里面有多个容器，其中一个容器崩溃，另一个正常运行，怎么排查。

同一个 Pod 多个容器，其中一个容器崩溃退出，另外一个容器还在正常运行。此时 Pod 整体状态会变成 CrashLoopBackOff。

注意：不是整个 Pod 全部挂掉，只是其中某一个 sidecar 容器崩溃；另一个业务容器还活着。很多人会误以为 Pod 全部容器一起挂，这是容易踩的点。

1. `kubectl describe pod <pod名称>`，Events 事件会明确标出**具体是哪一个容器发生退出崩溃**，看退出码、OOM 标记。describe 里可以看到 Pod 内全部容器列表，区分哪个正常、哪个异常。
2. `kubectl logs -p <pod名> -c <崩溃容器名字>`

> 重点：多容器 Pod，必须用 `-c` 指定容器名，否则默认取第一个容器日志；加上 `-p` 获取上一次崩溃实例日志。

3. 看崩溃容器的日志，定位 sidecar 容器报错原因（配置错误、资源超限、程序 bug）。正常的容器不用管它的日志。
4. 核对该异常容器的资源 limit、启动命令、配置；判断是业务 bug、配置错误还是资源不足。
