USE library_management_system;

SELECT 'Exactly seven required base tables exist' AS Test,
       IF(
           (SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_TYPE = 'BASE TABLE') = 7
           AND
           (SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_TYPE = 'BASE TABLE'
              AND TABLE_NAME IN
                  ('AUTHOR','PUBLISHER','LIBRARY','STUDENT','BOOKS','BORROW','WRITTEN_BY')) = 7,
           'PASS', 'FAIL') AS Result
UNION ALL
SELECT 'Seeded sample row counts are present',
       IF((SELECT COUNT(*) FROM AUTHOR) >= 30
          AND (SELECT COUNT(*) FROM PUBLISHER) >= 6
          AND (SELECT COUNT(*) FROM LIBRARY) >= 3
          AND (SELECT COUNT(*) FROM STUDENT) >= 20
          AND (SELECT COUNT(*) FROM BOOKS) >= 35
          AND (SELECT COUNT(*) FROM BORROW) >= 40
          AND (SELECT COUNT(*) FROM WRITTEN_BY) >= 46,
          'PASS', 'FAIL')
UNION ALL
SELECT 'Seven primary keys are defined',
       IF((SELECT COUNT(*)
           FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
           WHERE CONSTRAINT_SCHEMA = DATABASE()
             AND CONSTRAINT_TYPE = 'PRIMARY KEY') = 7,
          'PASS', 'FAIL')
UNION ALL
SELECT 'WRITTEN_BY has the ordered two-column composite primary key',
       IF((SELECT COUNT(*)
           FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'WRITTEN_BY'
             AND CONSTRAINT_NAME = 'PRIMARY'
             AND ((COLUMN_NAME = 'AUTHORID' AND ORDINAL_POSITION = 1)
               OR (COLUMN_NAME = 'BOOKID' AND ORDINAL_POSITION = 2))) = 2,
          'PASS', 'FAIL')
UNION ALL
SELECT 'Six foreign key relationships are defined',
       IF((SELECT COUNT(*)
           FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
           WHERE TABLE_SCHEMA = DATABASE()
             AND REFERENCED_TABLE_NAME IS NOT NULL) = 6,
          'PASS', 'FAIL')
UNION ALL
SELECT 'All seeded foreign key references resolve',
       IF(
           (SELECT COUNT(*) FROM BOOKS B
            LEFT JOIN PUBLISHER P ON P.PUBLISHERID = B.PUBLISHERID
            LEFT JOIN LIBRARY L ON L.LIBRARYID = B.LIBRARYID
            WHERE P.PUBLISHERID IS NULL OR L.LIBRARYID IS NULL)
         + (SELECT COUNT(*) FROM BORROW BR
            LEFT JOIN STUDENT S ON S.STUDENTID = BR.STUDENTID
            LEFT JOIN BOOKS B ON B.BOOKID = BR.BOOKID
            WHERE S.STUDENTID IS NULL OR B.BOOKID IS NULL)
         + (SELECT COUNT(*) FROM WRITTEN_BY WB
            LEFT JOIN AUTHOR A ON A.AUTHORID = WB.AUTHORID
            LEFT JOIN BOOKS B ON B.BOOKID = WB.BOOKID
            WHERE A.AUTHORID IS NULL OR B.BOOKID IS NULL) = 0,
          'PASS', 'FAIL')
UNION ALL
SELECT 'Every seeded book has at least one author',
       IF((SELECT COUNT(*)
           FROM BOOKS B
           WHERE NOT EXISTS
               (SELECT 1 FROM WRITTEN_BY WB WHERE WB.BOOKID = B.BOOKID)) = 0,
          'PASS', 'FAIL')
UNION ALL
SELECT 'At most one active loan exists per physical book',
       IF((SELECT COUNT(*)
           FROM (SELECT BOOKID
                 FROM BORROW
                 WHERE RETURNDATE IS NULL
                 GROUP BY BOOKID
                 HAVING COUNT(*) > 1) AS active_conflicts) = 0,
          'PASS', 'FAIL')
UNION ALL
SELECT 'Active-loan generated column and unique key exist',
       IF((SELECT COUNT(*)
           FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'BORROW'
             AND COLUMN_NAME = 'ACTIVE_BOOKID'
             AND EXTRA LIKE '%STORED GENERATED%') = 1
          AND (SELECT COUNT(*)
               FROM INFORMATION_SCHEMA.STATISTICS
               WHERE TABLE_SCHEMA = DATABASE()
                 AND TABLE_NAME = 'BORROW'
                 AND INDEX_NAME = 'UQ_BORROW_ONE_ACTIVE_BOOK') = 1,
          'PASS', 'FAIL')
UNION ALL
SELECT 'Borrow and return date relationships are valid',
       IF((SELECT COUNT(*)
           FROM BORROW
           WHERE DUE_DATE <= BORROWDATE
              OR (RETURNDATE IS NOT NULL AND RETURNDATE < BORROWDATE)) = 0,
          'PASS', 'FAIL')
UNION ALL
SELECT 'Five expected views exist',
       IF((SELECT COUNT(*)
           FROM INFORMATION_SCHEMA.VIEWS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME IN
                 ('AVAILABLE_BOOKS','CURRENT_BORROWINGS',
                  'STUDENT_BORROWING_HISTORY','BOOK_DETAILS','OVERDUE_BOOKS')) = 5,
          'PASS', 'FAIL')
UNION ALL
SELECT 'Six expected procedures exist',
       IF((SELECT COUNT(*)
           FROM INFORMATION_SCHEMA.ROUTINES
           WHERE ROUTINE_SCHEMA = DATABASE()
             AND ROUTINE_TYPE = 'PROCEDURE'
             AND ROUTINE_NAME IN
                 ('BORROW_BOOK','RETURN_BOOK','GET_STUDENT_BORROW_HISTORY',
                  'GET_BOOKS_BY_LIBRARY','LIST_ALL_ACTIVE_BORROWINGS',
                  'GENERATE_LIBRARY_STATS')) = 6,
          'PASS', 'FAIL')
UNION ALL
SELECT 'Four expected stored functions exist',
       IF((SELECT COUNT(*)
           FROM INFORMATION_SCHEMA.ROUTINES
           WHERE ROUTINE_SCHEMA = DATABASE()
             AND ROUTINE_TYPE = 'FUNCTION'
             AND ROUTINE_NAME IN
                 ('GET_BOOK_AGE','GET_STUDENT_BORROW_COUNT',
                  'GET_ACTIVE_BORROW_COUNT','IS_BOOK_AVAILABLE')) = 4,
          'PASS', 'FAIL')
UNION ALL
SELECT 'Four expected triggers exist',
       IF((SELECT COUNT(*)
           FROM INFORMATION_SCHEMA.TRIGGERS
           WHERE TRIGGER_SCHEMA = DATABASE()
             AND TRIGGER_NAME IN
                 ('TRG_BEFORE_INSERT_BORROW','TRG_BEFORE_UPDATE_BORROW',
                  'TRG_BEFORE_INSERT_BOOKS','TRG_BEFORE_INSERT_STUDENT')) = 4,
          'PASS', 'FAIL')
UNION ALL
SELECT 'Useful secondary indexes exist',
       IF((SELECT COUNT(DISTINCT INDEX_NAME)
           FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE()
             AND INDEX_NAME IN
                 ('IDX_BOOKS_TITLE','IDX_BOOKS_YEAR','IDX_STUDENT_BRANCH',
                  'IDX_BORROW_BORROWDATE','IDX_BORROW_BOOK_RETURN')) = 5,
          'PASS', 'FAIL');

-- Inspect records and actual object definitions separately when a check fails.
SELECT TABLE_NAME, TABLE_ROWS
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

SELECT * FROM AVAILABLE_BOOKS ORDER BY TITLE LIMIT 10;
SELECT * FROM CURRENT_BORROWINGS ORDER BY DUE_DATE;
SELECT * FROM OVERDUE_BOOKS ORDER BY DAYS_OVERDUE DESC;
