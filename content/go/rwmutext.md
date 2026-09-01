Go的RWMutex内嵌一把Mutex用于写锁排队，依靠readerCount原子计数器以及常量rwmutexMaxReaders完成读写状态控制。读锁加锁时，goroutine尝试原子给readerCount加1，如果readerCount此时为负数，代表已经有写拿到锁，读不会修改计数器，直接阻塞排队；读锁释放时原子对readerCount做减1。写锁到来首先竞争内嵌Mutex，竞争成功后，会把readerCount原子减去rwmutexMaxReaders，让readerCount变为负数，以此作为全局可见的标记；此时，之前已经获取读锁的旧读不受影响，依旧可以正常执行、释放时继续递减readerCount，而所有后续新来的读看到readerCount为负，就识别出存在写锁，不再尝试累加计数器，进入阻塞等待。写锁拿到Mutex并完成减法之后，会持续等待readerCount等于负的rwmutexMaxReaders，该条件代表所有在标记设置前就已经运行的旧读全部释放完毕，这时写锁才进入临界区执行写逻辑。写锁执行完毕释放时，会将rwmutexMaxReaders加回readerCount恢复计数器，释放内嵌Mutex，同时唤醒被阻塞的读goroutine，被唤醒的读会再次尝试原子增加readerCount获取读锁；多个写之间依靠内嵌Mutex实现互斥，写还未抢到内嵌Mutex的时候不会修改readerCount，读感知不到写的存在，仍然可以正常进入。

## 问答

1. 问：新来的读怎么感知已经有写拿到锁？
   答：观察readerCount为负数，负数是写抢到Mutex后减去rwmutexMaxReaders产生的标记。

2. 问：写锁判断存量旧读全部结束的条件？
   答：readerCount == -rwmutexMaxReaders。

3. 问：写还没抢到内嵌Mutex，readerCount会变成负数吗？
   答：不会，减法操作只有抢到内嵌Mutex之后才执行，读此时看不到写。

4. 问：写打上负数标记之后，已经运行的旧读释放时还会递减readerCount吗？
   答：会，旧读只管递减，不会检测负数标记，靠一次次递减把readerCount推向 `-rwmutexMaxReaders`。

5. 问：写释放的时候做什么来复原状态？
   答：readerCount加上rwmutexMaxReaders恢复计数，释放内嵌Mutex，唤醒阻塞的读协程。
