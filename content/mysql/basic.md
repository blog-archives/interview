---
title: MySQL 基础
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