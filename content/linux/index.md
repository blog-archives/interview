---
title: Linux 常用命令
---

## 练习网站

- [Linux Journey](https://labex.io/linuxjourney)：最适合零基础。课程从目录、文件、权限、文本处理逐步展开，并提供浏览器里的 Linux 终端。
- [Killercoda](https://killercoda.com/)：提供真实的临时 Linux 环境，不需要安装虚拟机；适合自由实验，也有 Linux、Docker、Kubernetes 等场景。免费版单次环境最长约 1 小时。
- [OverTheWire：Bandit](https://overthewire.org/wargames/bandit/)：闯关式学习。通过 `ssh` 登录服务器，用 `ls`、`cat`、`find`、`grep`、管道和权限命令寻找下一关密码，趣味性很强。
- [PracticeLinux](https://www.practicelinux.com/)：浏览器终端配合 CTF 小任务，不注册也能开始，适合把常用命令练成肌肉记忆。
- [LearnShell](https://www.learnshell.org/)：更偏 Bash 脚本，涵盖变量、循环、函数、管道、正则表达式等，页面内可以直接运行代码。
- [SadServers](https://sadservers.com/)：适合已经掌握基本命令后练排障。它会给你一台“出故障”的真实 Linux 虚拟机，让你修复服务、网络、权限、Docker 等问题；部分练习免费。
- [Webminal](https://www.webminal.org/)：简单的在线 Linux 终端，适合随手测试命令，但需要注册免费账户。

我最推荐的路线是：**Linux Journey → Killercoda → Bandit → SadServers**。前两个打基础，Bandit练命令组合，最后用 SadServers 练真实排障。练习时不要把密码、密钥或私人文件粘贴进在线终端。

## 目录与文件

| 命令 | 作用 | 常用示例 |
|---|---|---|
| `pwd` | 显示当前工作目录 | `pwd` |
| `cd` | 切换目录 | `cd /var/log`、`cd ..`、`cd -` |
| `ls` | 查看目录内容 | `ls -lah` |
| `mkdir` | 创建目录 | `mkdir -p data/backup` |
| `touch` | 创建空文件或更新时间 | `touch app.log` |
| `cp` | 复制文件或目录 | `cp -a config config.bak` |
| `mv` | 移动或重命名 | `mv old.log old.log.bak` |
| `rm` | 删除文件或目录 | `rm file.log`、`rm -r old-dir` |
| `find` | 按条件查找文件 | `find /var/log -type f -name '*.log'` |
| `stat` | 查看文件详细信息 | `stat app.log` |

执行 `rm -r` 前，应先用 `pwd`、`ls` 或 `find` 确认目标范围。`rm` 通常不经过回收站，不要把 `rm -rf` 当成普通清理命令。

## 查看与筛选文本

| 命令 | 作用 | 常用示例 |
|---|---|---|
| `cat` | 一次性输出文件内容 | `cat config.yaml` |
| `less` | 分页查看大文件 | `less app.log` |
| `head` | 查看文件开头 | `head -n 20 app.log` |
| `tail` | 查看文件末尾或持续追加 | `tail -n 100 -F app.log` |
| `grep` | 按关键词或模式筛选 | `grep -n -C 3 'ERROR' app.log` |
| `wc` | 统计行数、单词数或字节数 | `wc -l access.log` |
| `sort` | 对文本行排序 | `sort result.txt` |
| `uniq` | 合并或统计相邻重复行 | `sort ip.txt \| uniq -c` |

大文件优先使用 `less`、`head`、`tail` 和 `grep`，不要直接 `cat` 整个文件。`uniq` 只能处理相邻的重复行，因此通常先配合 `sort`。

## 权限与用户

| 命令 | 作用 | 常用示例 |
|---|---|---|
| `whoami` | 查看当前用户名 | `whoami` |
| `id` | 查看用户 UID、GID 和用户组 | `id appuser` |
| `sudo` | 以其他用户身份执行命令 | `sudo systemctl status nginx` |
| `chmod` | 修改读、写、执行权限 | `chmod 640 app.conf` |
| `chown` | 修改所有者和所属组 | `chown app:app app.conf` |
| `umask` | 查看或设置默认权限掩码 | `umask` |

遇到 `Permission denied` 时，先确认进程使用的用户、文件所有者和路径各级目录权限。不要用 `chmod 777` 掩盖真正的权限配置问题。

## 进程与任务

| 命令 | 作用 | 常用示例 |
|---|---|---|
| `ps` | 查看进程快照 | `ps -ef`、`ps aux` |
| `pgrep` | 按名称查找进程 | `pgrep -a nginx` |
| `top` | 实时观察系统和进程资源 | `top`、`top -p 1234` |
| `kill` | 向进程发送信号 | `kill -TERM 1234` |
| `jobs` | 查看当前 Shell 的后台任务 | `jobs -l` |
| `bg` | 让暂停的任务在后台继续 | `bg %1` |
| `fg` | 把后台任务切回前台 | `fg %1` |
| `nohup` | 忽略挂断信号运行命令 | `nohup ./app >app.log 2>&1 &` |

`kill` 默认发送 `SIGTERM`，允许程序清理后退出；`kill -9` 发送无法被捕获的 `SIGKILL`，只应作为最后手段。生产服务更适合交给 systemd 或容器平台管理，而不是长期依赖 `nohup`。

`top` 的完整用法见 [[/linux/top|top 命令详解]]。

## CPU 与内存

| 命令 | 作用 | 常用示例 |
|---|---|---|
| `uptime` | 查看运行时间和平均负载 | `uptime` |
| `top` | 查看 CPU、内存和进程变化 | `top` |
| `free` | 查看物理内存与 Swap | `free -h` |
| `vmstat` | 连续观察 CPU、内存、换页和 I/O | `vmstat 1 5` |

判断内存是否紧张时，不要只看 `free` 列，应重点结合 `available`、Swap 换入换出和进程 RSS。判断负载时要把 load average 与 CPU 核数、CPU 使用率以及不可中断睡眠进程一起分析。

## 磁盘与文件占用

| 命令 | 作用 | 常用示例 |
|---|---|---|
| `df` | 查看文件系统容量和 inode | `df -h`、`df -i` |
| `du` | 统计目录和文件占用 | `du -xhd 1 /var` |
| `lsof` | 查看进程打开的文件 | `lsof +L1` |
| `lsblk` | 查看块设备和挂载关系 | `lsblk -f` |

磁盘排查不仅要看容量，还要检查 inode。`df` 和 `du` 差异很大时，要考虑已删除但仍被进程打开的文件。详细用法见 [[/linux/disk|磁盘排查命令]]。

## 网络与端口

| 命令 | 作用 | 常用示例 |
|---|---|---|
| `ip` | 查看网卡、IP 和路由 | `ip addr`、`ip route` |
| `ss` | 查看监听端口和连接状态 | `ss -lntp` |
| `ping` | 测试 IP 层连通性 | `ping -c 4 10.0.0.1` |
| `curl` | 发起 HTTP 请求并观察响应 | `curl -v http://127.0.0.1:8080/health` |
| `dig` | 查询 DNS 解析 | `dig example.com` |
| `nc` | 测试 TCP/UDP 端口 | `nc -vz 10.0.0.1 8080` |

`ping` 通不代表业务端口可用，`ping` 不通也可能只是 ICMP 被禁用。服务访问失败时，应分别验证 DNS、端口、协议和业务响应。详细用法见 [[/linux/network|网络排查命令]]。

## 服务与系统日志

| 命令 | 作用 | 常用示例 |
|---|---|---|
| `systemctl` | 管理 systemd 服务 | `systemctl status nginx` |
| `journalctl` | 查看 journald 日志 | `journalctl -u nginx -n 100` |
| `dmesg` | 查看内核环形缓冲区信息 | `dmesg -T \| tail` |
| `hostnamectl` | 查看主机与操作系统信息 | `hostnamectl` |

进程存在不代表服务可用。还需要确认端口监听、健康检查、真实请求和下游依赖。详细用法见 [[/linux/service|服务管理命令]]。

## 压缩与文件传输

| 命令 | 作用 | 常用示例 |
|---|---|---|
| `tar` | 打包、解包或配合 gzip 压缩 | `tar -czf logs.tar.gz logs/` |
| `gzip` | 压缩单个文件 | `gzip app.log` |
| `scp` | 通过 SSH 复制文件 | `scp app.log user@host:/tmp/` |
| `rsync` | 增量同步文件或目录 | `rsync -av source/ user@host:/data/` |

`scp` 和 `rsync` 会产生网络流量和磁盘 I/O。传输生产环境的大文件前，应确认磁盘余量、网络影响和目标路径。

## Shell 辅助

| 命令 | 作用 | 常用示例 |
|---|---|---|
| `history` | 查看当前 Shell 的历史命令 | `history` |
| `which` | 查找实际执行的命令路径 | `which java` |
| `man` | 查看命令手册 | `man ss` |
| `env` | 查看当前环境变量 | `env` |
| `export` | 设置当前 Shell 的环境变量 | `export APP_ENV=prod` |
| `echo` | 输出文本或变量值 | `echo "$PATH"` |

## 常用组合

```shell
# 找出 CPU 使用率最高的进程
ps -eo pid,user,%cpu,%mem,stat,cmd --sort=-%cpu | head

# 找出 /var 下占用较大的一级目录
du -xhd 1 /var | sort -h

# 查看 8080 端口是否正在监听
ss -lntp '( sport = :8080 )'

# 持续观察最近日志并筛选错误
tail -F app.log | grep --line-buffered -i 'error'

# 查看服务最近 30 分钟的日志
journalctl -u nginx --since '30 min ago'
```

这些组合只是排查入口。执行修改、删除、重启或终止进程等操作前，应先确认目标和影响范围。
