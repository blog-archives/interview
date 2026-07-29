---
title: SQL 题
order:
---

## 给学生表、课程成绩表，求不存在于 01 课程但存在于 02 课程的学生成绩

假设我们有以下两张表：

1. `student` 表，其中包含学生的 sid 和其他信息
2. `score` 表，其中包含 sid, cid 和 score

### LEFT JOIN 和 IS NULL

```sql
SELECT s.sid, s.sname, sc2.cid, sc2.score
FROM student s
LEFT JOIN score sc1 ON s.sid = sc1.sid AND sc1.cid = '01'
LEFT JOIN score sc2 ON s.sid = sc2.sid AND sc2.cid = '02'
WHERE sc1.sid IS NULL AND sc2.sid IS NOT NULL;
```

### NOT EXISTS

```sql
SELECT s.sid, s.sname, sc.cid, sc.score
FROM student s
JOIN score sc ON s.sid = sc.sid AND sc.cid = '02'
WHERE NOT EXISTS (
    SELECT 1 FROM score sc1 WHERE sc1.sid = s.sid AND sc1.cid = '01'
);
```

## 在学生成绩表里查询总分排名 5-10 的学生 id 以及总分

```sql
SELECT student_id, SUM(score) AS total_score
FROM scores
GROUP BY student_id
ORDER BY total_score DESC
LIMIT 6 OFFSET 4;
```