---
title: 基础题目
order: 1
---

## SQL 和 NOSQL 的区别

- SQL 是关系型数据库，用表格存储数据，表间有关联，遵循 ACID 事务特性，强一致性优先，适合数据结构固定、需要复杂关联查询的场景，比如金融交易系统。
- NoSQL 是非关系型数据库，支持文档、键值对等灵活格式，遵循 BASE 思想，以最终一致性换取高可用性和扩展性，适合数据量大、并发高、结构多变的场景，比如社交平台或电商日志。

选型时，若业务对事务一致性要求高，选 SQL；若需高扩展和灵活数据格式，选 NoSQL，也可混合使用，核心数据用 SQL，非核心用 NoSQL。

## 数据库三大范式

数据库三大范式是设计关系型数据库表结构的规则，目的是减少冗余、保证数据一致性。

- **第一范式：每个列都是原子的，不可再分。** 解决列不原子的问题，确保每一列不可再分。
    
    比如“联系方式”不能同时存电话和地址，要拆成两列。

- **第二范式：在第一范式基础上，非主键列完全依赖主键，不能只依赖主键的一部分。** 解决部分依赖的问题。

    比如“员工项目表”，主键是员工 ID + 项目 ID，非主键列 “参与时间” 必须同时依赖这两个主键

- **第三范式：在第二范式基础上，非主键列不传递依赖于主键。** 解决传递依赖的问题。

    比如用户表有用户 ID、姓名、城市，订单表就不该再存城市，直接关联用户 ID 即可。

## 怎么连表查询

![](assets/iShot_2026-07-28_21.28.48.png)

### 内连接 Inner Join

内连接返回两个表中匹配关系的行

```sql
SELECT employees.name, departments.name
FROM employees
INNER JOIN departments
ON employees.department_id = departments.id;
```

### 左连接 Left Join

左连接返回左表所有行，右表中匹配的行

```sql
SELECT employees.name, departments.name
FROM employees
LEFT JOIN departments
ON employees.department_id = departments.id;
```

### 右连接 Right Join

右连接返回右表所有行，左表中匹配的行

```sql
SELECT employees.name, departments.name
FROM employees
RIGHT JOIN departments
ON employees.department_id = departments.id;
```

### 全连接 Union Join

全连接返回两个表中所有行的笛卡尔积，相当于内连接和左连接的并集

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

在表的相关列上添加 UNIQUE 约束，确保列的值唯一。

```sql
CREATE TABLE employees (
    id INT PRIMARY KEY,
    name VARCHAR(255) UNIQUE,
    email VARCHAR(255)
);
```

### INSERT ... ON DUPLICATE KEY UPDATE

在建立了唯一索引的基础上，通过 `ON DUPLICATE KEY UPDATE` 语句，当发生重复冲突时，可以更新指定列的值。

```sql
INSERT INTO employees (id, name, email)
VALUES (1, 'John Doe', 'john.doe@example.com')
ON DUPLICATE KEY UPDATE
email = VALUES(email);
```

### INSERT IGNORE

在建立了唯一索引的基础上，通过 `INSERT IGNORE` 语句，当发生重复冲突时，可以忽略重复数据。

```sql
INSERT IGNORE INTO employees (id, name, email)
VALUES (1, 'John Doe', 'john.doe@example.com');
```

### 业务层的 FirstOrCreate?

`FirstOrCreate` 不能替代唯一索引，因为它无法从根本上解决高并发下的数据重复问题。

当使用 `Attrs` 或 `Assign` 时，它更像是业务层对“查询+插入/更新”逻辑的封装，而非对数据库 `ON DUPLICATE KEY UPDATE` 的直接替代。其底层通过非原子的两次 SQL 操作实现，高并发下仍可能因间隙插入导致重复。大部分场景下，确保数据唯一性应优先依赖数据库唯一索引，再结合 `ON DUPLICATE KEY UPDATE` 处理冲突更新，`FirstOrCreate` 仅适合对唯一性要求不严格、并发极低的边缘场景。

## CHAR 和 VARCHAR 的区别

- CHAR 是定长字符串，长度固定，不足会用空格填充，查询时会自动去掉末尾空格，适合存储长度固定的数据，比如手机号、身份证号。
- VARCHAR 是变长字符串，长度可变，只占用实际数据长度+1或2字节的额外空间，不会填充空格，适合存储长度不固定的数据，比如用户名、地址。

从性能看，CHAR 查询更快，因为长度固定，VARCHAR 更节省存储空间。

## varchar(n) 中的 n 代表什么

varchar 后面的数字代表字符数，具体字节数取决于字符编码和实际存储的字符数。以 utf8mb4 编码为例，每个字符占 1-4 字节，varchar (5) 存 5 个英文占 5 字节，存 5 个中文则占 20 字节，同时还会额外加 1-2 字节存储长度信息。

## int(1) 和 int(10) 的区别

在 MySQL 中，int(1) 和 int(10) 的存储大小完全相同，都是4字节，能存储的整数范围也一样。

区别仅在于显示宽度，当设置了 `zerofill` 时，int(10) 会用 0 填充到 10 位，比如存储 5 会显示 0000000005，而 int(1) 显示 05，但不影响实际存储的值。如果没有 `zerofill`，两者显示效果没有区别。

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

如果只是简单存储、直接查看，选 `VARCHAR(15)` 存 IPv4 字符串最方便；如果数据量大，想节省空间、提升查询速度，就用 `INT UNSIGNED` 配合 `INET_ATON/INET_NTOA` 转换。

### 字符串类型存储

直接将 IP 地址作为字符串存储在数据库中，比如 `VARCHAR(15)`。

- 优点：直观易懂，方便直接进行数据的插入、查询和显示，不需要进行额外的转换操作
- 缺点：占用存储空间较大，字符串比较操作的性能相对较低，不利于进行范围查询。

```sql
CREATE TABLE ip_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip VARCHAR(15)
);

INSERT INTO ip_records (ip) VALUES ('192.168.1.1');
```

### 整数类型存储

将 IPv4 地址转换为 32 位无符号整数进行存储，常用的数据类型有 `INT UNSIGNED`

- 优点：节省存储空间，整数比较操作的性能较高，适合进行范围查询。
- 缺点：需要进行额外的转换操作，不直观，不方便直接进行数据的插入、查询和显示。

```sql
CREATE TABLE ip_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip INT UNSIGNED
);

INSERT INTO ip_records (ip) VALUES (INET_ATON('192.168.1.1'));

SELECT INET_NTOA(ip) FROM ip_records;
```

## 外键约束

外键约束的作用是强制从表的关联字段值必须匹配主表的主键/唯一键值或为 NULL，以此保证表之间数据的一致性和完整性。

### 主表中删除一条记录对从表造成什么影响

这取决于外键设置的 `ON DELETE` 规则。

- 如果是 `RESTRICT` 或 `NO ACTION`，主表删除时会报错阻止；
- 如果是 `CASCADE`，主表删除后从表关联记录也会被删除；
- 如果是 `SET NULL`，主表删除后从表外键列会设为 `NULL`；
- 如果是 `SET DEFAULT`，会设为默认值。
- 默认规则通常是 `RESTRICT`，即不允许删除有从表关联的主表记录。

```sql
CREATE TABLE orders (
    user_id INT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

DELETE FROM users WHERE id = 1;
```

## in 和 exists 的区别

### in 原理

1. 数据库会先执行内表查询 `select id from B`，把结果存成一个临时的列表，比如 [1,2,3]。
2. 然后对外表 A 的每一行，检查它的 id 是否在这个列表里，在的话就保留这行数据。

因为列表会用 hash 结构存储，查值的时候很快，所以如果 B 的数据少，列表小，这个过程就很高效。但如果 B 的数据特别多，列表会很大，hash 连接的开销就会增加。

```sql
select * from A where id in (select id from B);
```

### exists 原理

1. 数据库会先取外表 A 的第一行记录，假设 A.id 是 1
2. 然后带着这个 1 去内表 B 里执行 `select 1 from B where B.id=1`，如果 B 里有 `id=1` 的记录，不管有多少条，只要找到第一条就立刻停止查询 B，返回 “存在”，于是 A 的这行记录会被保留。
3. 接着取 A 的第二行，重复这个过程，直到 A 的所有行都检查完。

所以如果 A 的数据量小，需要检查的次数少，exists 就很快；如果 A 很大，但内表 B 的 id 有索引，每次查 B 也能快速找到，效率也不会差。

```sql
select * from A where exists (select 1 from B where B.id = A.id);
```

### 选择与比较

- 性能差异：内表小用 `IN`，外表小用 `EXISTS`；内表大且关联字段有索引，优先 `EXISTS`。
- NULL 值处理：`IN` 会把 `NULL` 值包含在子查询结果里，但 `“字段 IN (NULL)”` 的结果永远是 `NULL`，不会匹配任何行；`EXISTS` 子查询里如果出现 `NULL`，只要子查询能返回行，就会认为“存在”，比如 `“EXISTS (SELECT NULL)”` 会返回 `TRUE`，导致主查询所有行都被选中。

## 查询语句的执行顺序

先执行 `FROM` 子句确定查询的表，然后 `JOIN` 子句进行表连接，接着 `WHERE` 子句过滤行，再 `GROUP BY` 子句分组，之后 `HAVING` 子句过滤分组，然后 `SELECT` 子句选择列，再 `ORDER BY` 子句排序，最后 `LIMIT` 子句限制结果行数。

## 实现可重入的锁

> [!NOTE] 什么是可重入的锁
> 可重入锁简单说就是一个线程获取锁后，再次请求同一把锁时可以直接获取，不会被自己持有的锁阻塞。比如一个线程执行方法 A 时加了锁，方法 A 里又调用需要同一把锁的方法 B，可重入锁会允许这种情况，避免死锁。

```sql
CREATE TABLE `lock_table` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,

    // 用于存储锁的名称，作为锁的唯一标识
    `lock_name` VARCHAR(255) NOT NULL, 

    // 用于存储持有锁的线程 ID，表示当前锁被哪个线程持有
    `holder_thread_id` BIGINT NOT NULL,

    // 用于存储当前锁的重入次数，表示当前锁被同一个线程重入的次数
    `reentry_count` INT NOT NULL DEFAULT 0,
)
```

### 加锁逻辑

1. 开启事务
2. 执行 `SELECT * FROM lock_table WHERE lock_name = ? FOR UPDATE` 查询记录是否存在
    - 如果记录不存在，则直接加锁。执行 `INSERT INTO lock_table (lock_name, holder_thread_id, reentry_count) VALUES (?, ?, 1)`
    - 如果记录存在，且持有者是同一个线程，则可重入，增加重入次数。执行 `UPDATE lock_table SET reentry_count = reentry_count + 1 WHERE lock_name = ? AND holder_thread_id = ?`
3. 提交事务

### 解锁逻辑

1. 开启事务
2. 执行 `SELECT * FROM lock_table WHERE lock_name = ? FOR UPDATE` 查询记录是否存在
    - 如果记录存在，且持有者是同一个线程，且可重入次数大于 1，则减少重入次数。执行 `UPDATE lock_table SET reentry_count = reentry_count - 1 WHERE lock_name = ? AND holder_thread_id = ?`
    - 如果记录存在，且持有者是同一个线程，且可重入次数为 1，则释放锁。执行 `DELETE FROM lock_table WHERE lock_name = ? AND holder_thread_id = ?`
3. 提交事务