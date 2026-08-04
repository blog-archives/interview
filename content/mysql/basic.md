---
title: 基础题目
order: 1
---

## SQL 和 NoSQL 的区别

- SQL 是关系型数据库，以表格存储数据，表之间通过关联建立联系，通常遵循 ACID 事务特性，优先保证强一致性，适合数据结构相对固定、需要复杂关联查询的场景，比如金融交易系统。
- NoSQL 是非关系型数据库，支持文档、键值、列族、图等更灵活的数据模型，通常遵循 BASE 思想，以最终一致性换取更高的可用性和扩展性，适合数据量大、并发高、结构多变的场景，比如社交动态或日志存储。

选型时，若业务对事务一致性要求高，优先选 SQL；若更看重水平扩展和灵活的数据模型，优先选 NoSQL。也可以混合使用：核心交易数据放 SQL，高吞吐、弱一致的数据放 NoSQL。

## 数据库三大范式

数据库三大范式是设计关系型表结构的基本规则，目的是减少冗余、保证数据一致性。

- **第一范式（1NF）：每一列都是原子的，不可再分。**

    比如“联系方式”不能同时塞电话和地址，应拆成“电话”“地址”两列。

- **第二范式（2NF）：在 1NF 基础上，非主键列必须完全依赖整个主键，不能只依赖主键的一部分。**

    比如“员工项目表”主键是员工 ID + 项目 ID，若把“员工姓名”也放进这张表，姓名只依赖员工 ID，就构成部分依赖，应拆到员工表。

- **第三范式（3NF）：在 2NF 基础上，非主键列不能传递依赖于主键。**

    比如订单表存了用户 ID、用户所在城市，而城市其实由用户决定，属于传递依赖；城市应放在用户表，订单表只保留用户 ID。

实际业务中不必机械套用范式，适当冗余有时能换取更好的查询性能，关键是清楚冗余带来的一致性成本。

## 怎么连表查询

![](assets/iShot_2026-07-28_21.28.48.png)

### 内连接 Inner Join

只返回两表中满足连接条件的匹配行。

```sql
SELECT employees.name, departments.name
FROM employees
INNER JOIN departments
ON employees.department_id = departments.id;
```

### 左连接 Left Join

返回左表全部行；右表有匹配则带上匹配数据，没有匹配则右表字段为 `NULL`。

```sql
SELECT employees.name, departments.name
FROM employees
LEFT JOIN departments
ON employees.department_id = departments.id;
```

### 右连接 Right Join

返回右表全部行；左表有匹配则带上匹配数据，没有匹配则左表字段为 `NULL`。

```sql
SELECT employees.name, departments.name
FROM employees
RIGHT JOIN departments
ON employees.department_id = departments.id;
```

### 全外连接 Full Outer Join

返回左右两表的全部行：匹配上的拼成一行，任一侧没有匹配则另一侧字段为 `NULL`。注意：这不是笛卡尔积；笛卡尔积对应的是 `CROSS JOIN`。

MySQL 不直接支持 `FULL OUTER JOIN`，常用左连接与右连接做 `UNION` 模拟：

```sql
SELECT employees.name, departments.name
FROM employees
LEFT JOIN departments
ON employees.department_id = departments.id

UNION

SELECT employees.name, departments.name
FROM employees
RIGHT JOIN departments
ON employees.department_id = departments.id;
```

## 如何避免插入重复数据

在需要唯一的列上加 `UNIQUE` 约束（或唯一索引），从数据库层保证值不重复。

```sql
CREATE TABLE employees (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE
);
```

### INSERT ... ON DUPLICATE KEY UPDATE

在已有唯一索引的前提下，插入时若触发重复键冲突，则转为更新指定列。

```sql
INSERT INTO employees (id, name, email)
VALUES (1, 'John Doe', 'john.doe@example.com')
ON DUPLICATE KEY UPDATE
email = VALUES(email);
```

### INSERT IGNORE

在已有唯一索引的前提下，插入时若触发重复键冲突，则忽略该条插入，不报错。

```sql
INSERT IGNORE INTO employees (id, name, email)
VALUES (1, 'John Doe', 'john.doe@example.com');
```

### 业务层的 FirstOrCreate？

`FirstOrCreate` 不能替代唯一索引，因为它无法从根本上解决高并发下的重复写入。

使用 `Attrs` 或 `Assign` 时，它更像是业务层对“先查再插/更新”的封装，而不是数据库 `ON DUPLICATE KEY UPDATE` 的等价物。底层通常是非原子的两次 SQL，高并发下仍可能因间隙插入导致重复。保证唯一性应优先依赖数据库唯一索引，再配合 `ON DUPLICATE KEY UPDATE` 处理冲突；`FirstOrCreate` 只适合对唯一性要求不严、并发极低的边缘场景。

## CHAR 和 VARCHAR 的区别

- `CHAR` 是定长字符串，按声明长度分配空间，不足部分用空格填充；检索时会去掉末尾空格。适合长度固定且较短的数据，如状态码、MD5。
- `VARCHAR` 是变长字符串，按实际内容占用空间，并额外使用 1 或 2 字节记录长度。适合长度不固定的数据，如用户名、地址。

存储上 `VARCHAR` 通常更省空间；性能上两者在 InnoDB 中差距通常不大，不必过度迷信“`CHAR` 一定更快”，应按数据长度特征和业务语义选择。

## varchar(n) 中的 n 代表什么

`varchar(n)` 中的 `n` 表示最多可存储的 **字符数**，不是字节数；实际占用字节数取决于字符集和具体内容。以 `utf8mb4` 为例，一个字符最多占 4 字节，因此 `varchar(5)` 存 5 个英文字母大约 5 字节，存 5 个汉字大约 20 字节，此外还会额外占用 1 或 2 字节保存长度信息。

## int(1) 和 int(10) 的区别

在 MySQL 中，`int(1)` 和 `int(10)` 的存储空间相同，都是 4 字节，能表示的整数范围也完全一样。

括号里的数字只是 **显示宽度**。只有配合 `ZEROFILL` 时才有实际观感差异：`int(10) ZEROFILL` 存储 `5` 会显示为 `0000000005`；`int(1) ZEROFILL` 存储 `5` 仍显示为 `5`（宽度不够时不会截断数值，仍按完整数值输出）。未设置 `ZEROFILL` 时，两者显示没有区别。

```sql
CREATE TABLE test (
    num1 INT(1) ZEROFILL,
    num2 INT(10) ZEROFILL
);
```

## 各种 TEXT 的存储上限

| 类型 | 存储大小 |
|:---:|:---:|
| TINYTEXT | 255 bytes |
| TEXT | 64 KB |
| MEDIUMTEXT | 16 MB |
| LONGTEXT | 4 GB |

## IP 地址怎么存储

若只是简单存取、直接查看，用 `VARCHAR(15)` 存 IPv4 字符串最方便；若数据量大，想省空间并提升比较/范围查询效率，可用 `INT UNSIGNED`，配合 `INET_ATON` / `INET_NTOA` 转换。若还需支持 IPv6，可用 `VARBINARY(16)` 或 `VARCHAR(45)`。

### 字符串类型存储

直接把 IP 当作字符串存储，例如 `VARCHAR(15)`。

- 优点：直观，插入、查询、展示都方便，无需转换。
- 缺点：占用空间更大，字符串比较相对慢，也不利于范围查询。

```sql
CREATE TABLE ip_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip VARCHAR(15)
);

INSERT INTO ip_records (ip) VALUES ('192.168.1.1');
```

### 整数类型存储

把 IPv4 转成 32 位无符号整数存储，常用 `INT UNSIGNED`。

- 优点：更省空间，整数比较更快，适合范围查询。
- 缺点：读写需要转换，不够直观。

```sql
CREATE TABLE ip_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip INT UNSIGNED
);

INSERT INTO ip_records (ip) VALUES (INET_ATON('192.168.1.1'));

SELECT INET_NTOA(ip) FROM ip_records;
```

## 外键约束

外键约束要求从表关联字段的值必须等于主表对应主键/唯一键的值，或者为 `NULL`，以此维护表间引用完整性。

### 主表删除一条记录时，从表会怎样

取决于外键的 `ON DELETE` 规则：

- `RESTRICT` / `NO ACTION`：若从表仍有引用，则禁止删除主表记录并报错；
- `CASCADE`：删除主表记录时，同步删除从表中关联记录；
- `SET NULL`：删除主表记录后，从表外键列置为 `NULL`（该列须允许为空）；
- `SET DEFAULT`：理论上会设为默认值，但 InnoDB 并不支持该选项。

未显式指定时，常见默认行为接近 `RESTRICT`，即不允许删除仍被引用的主表记录。

```sql
CREATE TABLE orders (
    user_id INT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

DELETE FROM users WHERE id = 1;
```

## in 和 exists 的区别

### IN 的执行思路

1. 先执行子查询 `SELECT id FROM B`，得到一个结果集合，例如 `[1, 2, 3]`。
2. 再扫描外表 `A`，判断每一行的 `id` 是否落在这个集合中；在则保留。

当 `B` 结果集较小时，集合查找通常很快；若 `B` 很大，物化结果集的成本会明显上升。

```sql
SELECT * FROM A WHERE id IN (SELECT id FROM B);
```

### EXISTS 的执行思路

1. 逐行取外表 `A` 的记录。
2. 把当前行的关联值代入子查询，例如执行 `SELECT 1 FROM B WHERE B.id = A.id`；只要找到一行就立刻停止，返回“存在”。
3. 对 `A` 的每一行重复该过程。

因此当 `A` 较小，或 `B` 的关联字段有合适索引时，`EXISTS` 往往表现不错。

```sql
SELECT * FROM A WHERE EXISTS (SELECT 1 FROM B WHERE B.id = A.id);
```

### 选择与比较

- 经验规则：内表结果集小，倾向 `IN`；外表小或内表很大且关联列有索引，倾向 `EXISTS`。现代 MySQL 优化器常会改写二者，实际应以执行计划为准。
- `NULL` 处理：`IN` 子查询结果中若包含 `NULL`，可能让部分判断变成 `UNKNOWN`，从而筛不中行；`EXISTS` 只关心子查询是否返回行，即使子查询选出的是 `NULL`，只要有行就视为存在，例如 `EXISTS (SELECT NULL)` 为真。

## 查询语句的执行顺序

逻辑执行顺序通常是：

1. `FROM` / `JOIN`：确定并连接数据源
2. `WHERE`：按行过滤
3. `GROUP BY`：分组
4. `HAVING`：按分组结果过滤
5. `SELECT`：选择输出列（含别名、聚合等）
6. `DISTINCT`：去重
7. `ORDER BY`：排序
8. `LIMIT` / `OFFSET`：限制返回行数

这是理解 SQL 的逻辑顺序；优化器实际物理执行计划可能不同，但写 SQL 和排查结果时按这个顺序思考最稳妥。

## 实现可重入的锁

> [!NOTE] 什么是可重入锁
> 可重入锁指同一个线程已经持有某把锁后，再次请求同一把锁可以直接成功，而不会被自己阻塞。例如线程执行方法 A 时加了锁，A 内部又调用同样需要这把锁的方法 B，可重入锁允许继续进入，从而避免“自己锁死自己”。

```sql
CREATE TABLE lock_table (
    id INT AUTO_INCREMENT PRIMARY KEY,
    -- 锁名称，作为锁的唯一标识
    lock_name VARCHAR(255) NOT NULL,
    -- 当前持有锁的线程 ID
    holder_thread_id BIGINT NOT NULL,
    -- 同一线程的重入次数
    reentry_count INT NOT NULL DEFAULT 0,
    UNIQUE KEY uk_lock_name (lock_name)
);
```

### 加锁逻辑

1. 开启事务
2. 执行 `SELECT * FROM lock_table WHERE lock_name = ? FOR UPDATE`
    - 记录不存在：插入新锁，`reentry_count = 1`
    - 记录存在且持有者是当前线程：重入，`reentry_count = reentry_count + 1`
    - 记录存在且持有者是其他线程：加锁失败或阻塞等待（按业务策略处理）
3. 提交事务

对应 SQL 示意：

```sql
INSERT INTO lock_table (lock_name, holder_thread_id, reentry_count)
VALUES (?, ?, 1);

UPDATE lock_table
SET reentry_count = reentry_count + 1
WHERE lock_name = ? AND holder_thread_id = ?;
```

### 解锁逻辑

1. 开启事务
2. 执行 `SELECT * FROM lock_table WHERE lock_name = ? FOR UPDATE`
    - 记录存在、持有者是当前线程，且 `reentry_count > 1`：重入次数减 1
    - 记录存在、持有者是当前线程，且 `reentry_count = 1`：删除记录，真正释放锁
    - 持有者不是当前线程：无权解锁，直接失败
3. 提交事务

对应 SQL 示意：

```sql
UPDATE lock_table
SET reentry_count = reentry_count - 1
WHERE lock_name = ? AND holder_thread_id = ? AND reentry_count > 1;

DELETE FROM lock_table
WHERE lock_name = ? AND holder_thread_id = ? AND reentry_count = 1;
```
