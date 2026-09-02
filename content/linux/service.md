---
title: 服务管理命令
order: 5
---

在使用 systemd 的 Linux 系统中，`systemctl` 用来管理服务生命周期，`journalctl` 用来查看 systemd-journald 收集的日志。容器中不一定运行 systemd，此时应使用容器运行时或编排平台提供的命令。

## systemctl：查看和管理服务

### 查看状态

| 命令 | 作用 |
|---|---|
| `systemctl status nginx` | 查看服务状态、主进程和最近日志 |
| `systemctl is-active nginx` | 判断服务当前是否处于 active 状态 |
| `systemctl is-enabled nginx` | 判断服务是否配置为开机启动 |
| `systemctl is-failed nginx` | 判断服务是否处于 failed 状态 |
| `systemctl list-units --type=service` | 查看已加载的服务单元 |

`active` 和 `enabled` 不是一回事：前者表示当前运行状态，后者表示是否加入开机启动关系。服务也可能处于 `active (exited)`，表示启动命令已经退出但 systemd 仍认为单元成功，具体含义取决于服务类型。

### 启动、停止与重载

| 命令 | 作用 |
|---|---|
| `systemctl start nginx` | 启动服务 |
| `systemctl stop nginx` | 停止服务 |
| `systemctl restart nginx` | 停止后重新启动 |
| `systemctl reload nginx` | 请求服务重新加载配置 |
| `systemctl reload-or-restart nginx` | 支持 reload 时重载，否则重启 |

这些操作通常需要相应权限。生产环境执行 `stop` 或 `restart` 前，应确认服务冗余、在途请求、启动耗时和回滚方式。

`reload` 通常尽量保留主进程或现有连接，但是否支持以及是否无损取决于具体服务。修改配置后，应先运行服务自身的配置检查命令，例如：

```shell
nginx -t
systemctl reload nginx
```

### 开机启动

| 命令 | 作用 |
|---|---|
| `systemctl enable nginx` | 设置开机启动 |
| `systemctl disable nginx` | 取消开机启动 |
| `systemctl enable --now nginx` | 设置开机启动并立即启动 |

`enable` 修改的是启动关系，默认不会立即启动服务；`--now` 才会同时改变当前运行状态。

### 查看配置

| 命令 | 作用 |
|---|---|
| `systemctl cat nginx` | 查看单元文件及覆盖配置 |
| `systemctl show nginx` | 查看解析后的全部属性 |
| `systemctl show nginx -p MainPID -p ExecMainStatus` | 查看指定属性 |
| `systemctl list-dependencies nginx` | 查看依赖关系 |

修改或新增 unit 文件后，通常需要让 systemd 重新读取配置：

```shell
systemctl daemon-reload
```

`daemon-reload` 只让 systemd 重新加载 unit 配置，不会自动重启业务服务。

## journalctl：查看服务和系统日志

| 命令 | 作用 |
|---|---|
| `journalctl -u nginx` | 查看指定服务的日志 |
| `journalctl -u nginx -n 100` | 查看最近 100 条 |
| `journalctl -u nginx -f` | 持续跟踪新日志 |
| `journalctl -u nginx --since '30 min ago'` | 查看最近 30 分钟 |
| `journalctl -u nginx --since '2026-09-02 10:00'` | 从指定时间开始查看 |
| `journalctl -u nginx -b` | 只看本次系统启动后的日志 |
| `journalctl -k` | 查看内核日志 |
| `journalctl -p err` | 按优先级筛选错误日志 |

服务启动失败时，`systemctl status` 通常只展示最后几条日志。应继续使用 `journalctl -u <服务名>` 查看完整上下文，并从第一次失败的位置开始分析。

同时查看某段时间内的两个服务：

```shell
journalctl -u nginx -u app --since '10 minutes ago'
```

反向查看最新日志：

```shell
journalctl -u nginx -r
```

## 服务启动失败的排查顺序

1. 运行 `systemctl status <服务名>`，记录退出状态、主进程和第一次错误；
2. 用 `journalctl -u <服务名> -b` 查看本次启动后的完整日志；
3. 检查配置语法、环境变量、文件权限和可执行文件路径；
4. 用 `ss -lntp` 检查是否发生端口冲突；
5. 检查依赖服务、磁盘空间、内存和资源限制；
6. 修复后重新启动，并通过端口、健康检查和真实请求验证；
7. 继续观察日志和指标，确认没有进入反复重启状态。

常见原因包括：

- 配置文件语法错误；
- 端口已经被其他进程占用；
- 运行用户无权访问配置、证书或数据目录；
- 环境变量或密钥缺失；
- 数据库、网络或挂载等依赖未就绪；
- 磁盘满、inode 耗尽或发生 OOM；
- `ExecStart` 路径和参数错误。

## 为什么进程存在不代表服务可用？

服务可用至少要逐层验证：

1. systemd 认为服务正常；
2. 目标进程确实存在；
3. 进程监听了正确地址和端口；
4. 健康检查可以成功；
5. 核心业务请求可以完成；
6. 数据库、缓存等下游依赖正常。

进程可能还在初始化、处于死锁、长时间 GC、连接池耗尽或只监听错误地址。`systemctl status` 的结果只是排查入口。

## restart 和 kill 的区别

`systemctl restart` 会按照 unit 中定义的停止、超时、信号和启动流程管理服务；直接 `kill` 只向某个 PID 发送信号，可能绕开服务管理器的生命周期和重启策略。

停止服务时通常应优先使用服务管理器。如果必须直接处理进程，先发送默认的 `SIGTERM` 并等待清理，只有进程无法退出时才考虑 `SIGKILL`。强制终止可能中断请求、丢失缓冲数据或留下不一致状态。

## 常见问题

> 为什么服务刚启动又退出？

重点查看主进程退出码和首次错误。原因可能是配置错误、端口冲突、权限不足、依赖不可用，也可能是程序本来以前台模式运行，但 unit 的 `Type` 配置与实际行为不匹配。

> 为什么服务失败后不断重启？

unit 可能配置了 `Restart=always` 或 `Restart=on-failure`。自动重启可以恢复短暂故障，也可能在配置错误时形成重启风暴。应查看第一次失败，而不是只关注最后一次重试。

> 修改了 unit 文件，为什么没有生效？

systemd 可能还没有重新读取配置。先执行 `systemctl daemon-reload`，再根据变更决定是否 reload 或 restart 对应服务。

> `journalctl` 查不到很早以前的日志怎么办？

journald 可能只使用易失存储、配置了容量上限，或者旧日志已经轮转清理。还应确认服务是否把日志写入独立文件、标准输出、容器日志或远端日志系统。
