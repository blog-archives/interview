Go channel底层由hchan结构体实现，包含环形缓冲区buf、发送队列sendq、接收队列recvq以及标记缓冲区读写位置的sendx、recvx偏移量，有缓冲channel会分配环形数组用于暂存元素，无缓冲channel的buf则为nil，发送与接收不会经过缓冲区；当发送数据时，如果缓冲区未满就把数据写入环形缓冲，缓冲区已满或是无缓冲且没有正在等待的接收goroutine，发送goroutine就会被封装为sudog放入sendq队列挂起等待，接收操作逻辑与之对称，缓冲区有数据就取出数据，缓冲区为空且没有等待的发送goroutine，接收goroutine会封装成sudog进入recvq队列阻塞，一旦另一方goroutine就绪，就会从对应队列取出sudog唤醒goroutine完成数据拷贝，两个等待队列遵循先进先出的顺序，同时channel还维护关闭标记，关闭之后发送会触发panic，读取时缓冲区剩余数据可以正常取出，缓冲区读完则返回对应类型零值与ok=false，nil channel的收发操作则会直接让goroutine永久阻塞。

## 问答

1. 问：无缓冲channel发送数据，数据会经过buf缓冲区吗？
   答：不会，发送goroutine和接收goroutine直接拷贝数据。

2. 问：sendq、recvq队列里面存的是什么？
   答：sudog结构体，封装等待的goroutine以及数据相关信息，不是直接存G。

3. 问：channel关闭之后继续发送会怎么样？
   答：直接panic。

4. 问：channel关闭之后读取是什么表现？
   答：缓冲有数据正常读；缓冲耗尽，返回值零值，第二个返回值 ok=false。

5. 问：nil channel读写会panic吗？
   答：不会panic，goroutine永久阻塞。

6. 问：channel等待队列唤醒是顺序的吗？
   答：FIFO先进先出，按阻塞先后唤醒goroutine。

你可以继续讲你理解的下一块内容。
