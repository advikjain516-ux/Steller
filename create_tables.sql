USE library_management_system;

-- =============================================================================
-- LIBRARY MANAGEMENT SYSTEM - TABLE CREATION & SEEDING DDL
-- =============================================================================

-- Drop tables in reverse order of foreign key dependency
DROP TABLE IF EXISTS WRITTEN_BY;
DROP TABLE IF EXISTS BORROW;
DROP TABLE IF EXISTS BOOKS;
DROP TABLE IF EXISTS STUDENT;
DROP TABLE IF EXISTS LIBRARY;
DROP TABLE IF EXISTS PUBLISHER;
DROP TABLE IF EXISTS AUTHOR;

-- -----------------------------------------------------------------------------
-- 1. AUTHOR TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE AUTHOR (
    AUTHORID     INT AUTO_INCREMENT PRIMARY KEY,
    NAME         VARCHAR(150) NOT NULL,
    EMAIL        VARCHAR(150) UNIQUE,
    NATIONALITY  VARCHAR(100) DEFAULT 'International'
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 2. PUBLISHER TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE PUBLISHER (
    PUBLISHERID  INT AUTO_INCREMENT PRIMARY KEY,
    NAME         VARCHAR(150) NOT NULL,
    NATIONALITY  VARCHAR(100) DEFAULT 'International'
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 3. LIBRARY TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE LIBRARY (
    LIBRARYID    INT AUTO_INCREMENT PRIMARY KEY,
    NAME         VARCHAR(150) NOT NULL
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 4. STUDENT TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE STUDENT (
    STUDENTID          INT AUTO_INCREMENT PRIMARY KEY,
    USERID             VARCHAR(50) NOT NULL UNIQUE,
    STUDENTNAME        VARCHAR(150) NOT NULL,
    STUDENTEMAIL       VARCHAR(150) NOT NULL UNIQUE,
    STUDENTPHONENUMBER VARCHAR(20),
    BRANCH             VARCHAR(50) NOT NULL,
    SEMESTER           INT NOT NULL
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 5. BOOKS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE BOOKS (
    BOOKID          INT AUTO_INCREMENT PRIMARY KEY,
    TITLE           VARCHAR(300) NOT NULL,
    ISBN            VARCHAR(30) NULL,
    CATEGORY        VARCHAR(100) NOT NULL,
    PUBLICATIONYEAR SMALLINT NOT NULL,
    PUBLISHERID     INT NOT NULL,
    LIBRARYID       INT NOT NULL,
    CONSTRAINT CK_BOOKS_CATEGORY CHECK (TRIM(CATEGORY) <> ''),
    CONSTRAINT FK_BOOKS_PUBLISHER FOREIGN KEY (PUBLISHERID) REFERENCES PUBLISHER(PUBLISHERID) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT FK_BOOKS_LIBRARY FOREIGN KEY (LIBRARYID) REFERENCES LIBRARY(LIBRARYID) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 6. BORROW TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE BORROW (
    BORROWID       INT AUTO_INCREMENT PRIMARY KEY,
    BORROWDATE     DATE NOT NULL,
    DUE_DATE       DATE NOT NULL,
    RETURNDATE     DATE NULL,
    STUDENTID      INT NOT NULL,
    BOOKID         INT NOT NULL,
    ACTIVE_BOOKID  INT GENERATED ALWAYS AS (
        CASE WHEN RETURNDATE IS NULL THEN BOOKID ELSE NULL END
    ) STORED,
    CONSTRAINT FK_BORROW_STUDENT FOREIGN KEY (STUDENTID) REFERENCES STUDENT(STUDENTID) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT FK_BORROW_BOOK FOREIGN KEY (BOOKID) REFERENCES BOOKS(BOOKID) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT UQ_BORROW_ONE_ACTIVE_BOOK UNIQUE (ACTIVE_BOOKID)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 7. WRITTEN_BY TABLE (Composite Primary Key & Junction Table)
-- -----------------------------------------------------------------------------
CREATE TABLE WRITTEN_BY (
    AUTHORID INT NOT NULL,
    BOOKID   INT NOT NULL,
    PRIMARY KEY (AUTHORID, BOOKID),
    CONSTRAINT FK_WRITTENBY_AUTHOR FOREIGN KEY (AUTHORID) REFERENCES AUTHOR(AUTHORID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_WRITTENBY_BOOK FOREIGN KEY (BOOKID) REFERENCES BOOKS(BOOKID) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- Secondary Indexes for performance
-- -----------------------------------------------------------------------------
CREATE INDEX IDX_BOOKS_TITLE ON BOOKS(TITLE);
CREATE INDEX IDX_BOOKS_YEAR ON BOOKS(PUBLICATIONYEAR);
CREATE INDEX IDX_STUDENT_BRANCH ON STUDENT(BRANCH);
CREATE INDEX IDX_BORROW_BORROWDATE ON BORROW(BORROWDATE);
CREATE INDEX IDX_BORROW_BOOK_RETURN ON BORROW(BOOKID, RETURNDATE);


-- =============================================================================
-- SEED DATA
-- =============================================================================

-- 1. Seed Libraries (>= 3)
INSERT INTO LIBRARY (LIBRARYID, NAME) VALUES
(1, 'Central Campus Library'),
(2, 'Engineering & Tech Library'),
(3, 'Science & Research Library');

-- 2. Seed Publishers (>= 6)
INSERT INTO PUBLISHER (PUBLISHERID, NAME, NATIONALITY) VALUES
(1, 'McGraw-Hill Education', 'American'),
(2, 'Pearson Education', 'British'),
(3, 'Addison-Wesley Professional', 'American'),
(4, 'John Wiley & Sons', 'American'),
(5, 'MIT Press', 'American'),
(6, 'O''Reilly Media', 'American'),
(7, 'Springer Nature', 'German'),
(8, 'Oxford University Press', 'British');

-- 3. Seed Authors (>= 30)
INSERT INTO AUTHOR (AUTHORID, NAME, EMAIL, NATIONALITY) VALUES
(1, 'Abraham Silberschatz', 'silberschatz@yale.edu', 'American'),
(2, 'Henry F. Korth', 'korth@lehigh.edu', 'American'),
(3, 'S. Sudarshan', 'sudarsha@iitb.ac.in', 'Indian'),
(4, 'Thomas H. Cormen', 'thc@cs.dartmouth.edu', 'American'),
(5, 'Charles E. Leiserson', 'cel@mit.edu', 'American'),
(6, 'Ronald L. Rivest', 'rivest@mit.edu', 'American'),
(7, 'Clifford Stein', 'cliff@columbia.edu', 'American'),
(8, 'Robert C. Martin', 'unclebob@cleancoder.com', 'American'),
(9, 'Martin Fowler', 'fowler@thoughtworks.com', 'British'),
(10, 'Donald E. Knuth', 'knuth@cs.stanford.edu', 'American'),
(11, 'Andrew S. Tanenbaum', 'ast@cs.vu.nl', 'Dutch'),
(12, 'David J. Wetherall', 'djw@cs.washington.edu', 'American'),
(13, 'Stuart Russell', 'russell@berkeley.edu', 'British'),
(14, 'Peter Norvig', 'norvig@google.com', 'American'),
(15, 'Ian Goodfellow', 'ian.goodfellow@deepmind.com', 'American'),
(16, 'Yoshua Bengio', 'yoshua.bengio@mila.quebec', 'Canadian'),
(17, 'Aaron Courville', 'aaron.courville@umontreal.ca', 'Canadian'),
(18, 'Brian W. Kernighan', 'bwk@cs.princeton.edu', 'Canadian'),
(19, 'Dennis M. Ritchie', 'dmr@bell-labs.com', 'American'),
(20, 'Bjarne Stroustrup', 'bjarne@stroustrup.com', 'Danish'),
(21, 'Guido van Rossum', 'guido@python.org', 'Dutch'),
(22, 'Joshua Bloch', 'joshua.bloch@cmu.edu', 'American'),
(23, 'Jon Bentley', 'jbentley@alumni.cmu.edu', 'American'),
(24, 'Erich Gamma', 'gamma@acm.org', 'Swiss'),
(25, 'Richard Helm', 'helm@acm.org', 'Australian'),
(26, 'Ralph Johnson', 'johnson@cs.uiuc.edu', 'American'),
(27, 'John Vlissides', 'vlissides@watson.ibm.com', 'American'),
(28, 'Kyle Simpson', 'getify@gmail.com', 'American'),
(29, 'Addy Osmani', 'addyosmani@gmail.com', 'British'),
(30, 'Marijn Haverbeke', 'marijnh@gmail.com', 'Dutch'),
(31, 'Yashavant Kanetkar', 'y.kanetkar@kicit.com', 'Indian'),
(32, 'Herbert Schildt', 'herbert@schildt.com', 'American');

-- 4. Seed Students (>= 20)
INSERT INTO STUDENT (STUDENTID, USERID, STUDENTNAME, STUDENTEMAIL, STUDENTPHONENUMBER, BRANCH, SEMESTER) VALUES
(1,  'CS2023001', 'Aarav Sharma',    'aarav.sharma@college.edu',    '9876543210', 'CSE',  5),
(2,  'CS2023002', 'Diya Patel',      'diya.patel@college.edu',      '9876543211', 'CSE',  5),
(3,  'IT2023010', 'Rohan Mehta',     'rohan.mehta@college.edu',     '9876543212', 'IT',   5),
(4,  'AI2023005', 'Ananya Iyer',     'ananya.iyer@college.edu',     '9876543213', 'AIML', 3),
(5,  'DS2023008', 'Kavya Nair',      'kavya.nair@college.edu',      '9876543214', 'AIDS', 3),
(6,  'EC2022015', 'Aditya Verma',    'aditya.verma@college.edu',    '9876543215', 'ECE',  7),
(7,  'CS2024021', 'Ishaan Gupta',    'ishaan.gupta@college.edu',    '9876543216', 'CSE',  1),
(8,  'IT2024032', 'Meera Joshi',     'meera.joshi@college.edu',     '9876543217', 'IT',   1),
(9,  'AI2022012', 'Siddharth Rao',   'siddharth.rao@college.edu',   '9876543218', 'AIML', 7),
(10, 'CS2022045', 'Pooja Reddy',     'pooja.reddy@college.edu',     '9876543219', 'CSE',  7),
(11, 'EC2023023', 'Varun Malhotra',  'varun.malhotra@college.edu',  '9876543220', 'ECE',  5),
(12, 'DS2024011', 'Sneha Kulkarni',  'sneha.kulkarni@college.edu',  '9876543221', 'AIDS', 1),
(13, 'CS2023067', 'Nikhil Saxena',   'nikhil.saxena@college.edu',   '9876543222', 'CSE',  5),
(14, 'IT2022055', 'Priya Deshmukh',  'priya.deshmukh@college.edu',  '9876543223', 'IT',   7),
(15, 'AI2024018', 'Karan Chopra',    'karan.chopra@college.edu',    '9876543224', 'AIML', 1),
(16, 'CS2024089', 'Tanvi Bansal',    'tanvi.bansal@college.edu',    '9876543225', 'CSE',  1),
(17, 'EC2024031', 'Gaurav Bhatt',    'gaurav.bhatt@college.edu',    '9876543226', 'ECE',  1),
(18, 'DS2023044', 'Simran Kaur',     'simran.kaur@college.edu',     '9876543227', 'AIDS', 3),
(19, 'IT2023078', 'Rahul Singhania', 'rahul.singhania@college.edu', '9876543228', 'IT',   5),
(20, 'CS2023099', 'Neha Choudhary',  'neha.choudhary@college.edu',  '9876543229', 'CSE',  5),
(21, 'CS2023101', 'Arjun Nambiar',   'arjun.nambiar@college.edu',   '9876543230', 'CSE',  3),
(22, 'IT2023102', 'Bhavna Sen',      'bhavna.sen@college.edu',      '9876543231', 'IT',   3);

-- 5. Seed Books (>= 35)
INSERT INTO BOOKS (BOOKID, TITLE, ISBN, CATEGORY, PUBLICATIONYEAR, PUBLISHERID, LIBRARYID) VALUES
(1,  'Database System Concepts',                     '978-0073523323', 'Database',    2019, 1, 1),
(2,  'Introduction to Algorithms',                   '978-0262033848', 'Algorithms',  2009, 5, 1),
(3,  'Clean Code',                                   '978-0132350884', 'Programming', 2008, 2, 2),
(4,  'Computer Networks',                            '978-0132126953', 'Systems',     2010, 2, 1),
(5,  'Artificial Intelligence: A Modern Approach',   '978-0136042594', 'AI',          2020, 2, 3),
(6,  'Deep Learning',                                '978-0262035613', 'AI',          2016, 5, 3),
(7,  'Design Patterns: Elements of Reusable Object', '978-0201633610', 'Software',    1994, 3, 2),
(8,  'The C Programming Language',                   '978-0131103627', 'Programming', 1988, 2, 1),
(9,  'The C++ Programming Language',                 '978-0321563842', 'Programming', 2013, 3, 2),
(10, 'Effective Java',                               '978-0134685991', 'Programming', 2017, 3, 2),
(11, 'Programming Pearls',                           '978-0201657882', 'Algorithms',  1999, 3, 1),
(12, 'The Art of Computer Programming, Vol 1',       '978-0201896831', 'Algorithms',  1997, 3, 1),
(13, 'Refactoring: Improving the Design of Code',    '978-0134757599', 'Software',    2018, 3, 2),
(14, 'You Don''t Know JS: Scope & Closures',         '978-1449335588', 'Web',         2014, 6, 2),
(15, 'Learning JavaScript Design Patterns',          '978-1449331818', 'Web',         2012, 6, 2),
(16, 'Eloquent JavaScript',                          '978-1593279509', 'Web',         2018, 6, 2),
(17, 'Operating System Concepts',                    '978-1118063330', 'Systems',     2018, 4, 1),
(18, 'Modern Operating Systems',                     '978-0133591620', 'Systems',     2014, 2, 1),
(19, 'Let Us C',                                     '978-8183331630', 'Programming', 2016, 1, 1),
(20, 'Java: The Complete Reference',                 '978-1260440232', 'Programming', 2021, 1, 2),
(21, 'Fundamentals of Database Systems',             '978-0133970777', 'Database',    2015, 2, 1),
(22, 'Database Management Systems (Ramakrishnan)',   '978-0072465631', 'Database',    2002, 1, 1),
(23, 'High Performance MySQL',                       '978-1492080510', 'Database',    2021, 6, 1),
(24, 'SQL Antipatterns',                             '978-1934356555', 'Database',    2010, 6, 1),
(25, 'Designing Data-Intensive Applications',        '978-1449373320', 'Database',    2017, 6, 3),
(26, 'Python Crash Course',                          '978-1593279288', 'Programming', 2019, 6, 2),
(27, 'Fluent Python',                                '978-1491946008', 'Programming', 2015, 6, 2),
(28, 'Data Structures and Algorithms in Python',     '978-1118290279', 'Algorithms',  2013, 4, 3),
(29, 'Grokking Algorithms',                          '978-1617292231', 'Algorithms',  2016, 1, 2),
(30, 'Pattern Recognition and Machine Learning',     '978-0387310732', 'AI',          2006, 7, 3),
(31, 'Hands-On Machine Learning with Scikit-Learn',  '978-1492032649', 'AI',          2019, 6, 3),
(32, 'Computer Architecture: A Quantitative Appr.',  '978-0128119051', 'Systems',     2017, 1, 1),
(33, 'The Linux Programming Interface',              '978-1593272203', 'Systems',     2010, 6, 1),
(34, 'Clean Architecture',                           '978-0134494166', 'Software',    2017, 2, 2),
(35, 'Compilers: Principles, Techniques, & Tools',   '978-0321486813', 'Systems',     2006, 2, 1),
(36, 'Introduction to the Theory of Computation',    '978-1133187790', 'Algorithms',  2012, 4, 1),
(37, 'Cloud Native Patterns',                        '978-1617294297', 'Web',         2019, 1, 3);

-- 6. Seed Written_By (Authors to Books link, >= 46 rows, every book has >=1 author)
INSERT INTO WRITTEN_BY (AUTHORID, BOOKID) VALUES
(1, 1),  (2, 1),  (3, 1),   -- Database System Concepts
(4, 2),  (5, 2),  (6, 2), (7, 2), -- Introduction to Algorithms
(8, 3),                    -- Clean Code
(11, 4), (12, 4),          -- Computer Networks
(13, 5), (14, 5),          -- AI Modern Approach
(15, 6), (16, 6), (17, 6), -- Deep Learning
(24, 7), (25, 7), (26, 7), (27, 7), -- Design Patterns GoF
(18, 8), (19, 8),          -- The C Programming Language
(20, 9),                   -- C++
(22, 10),                  -- Effective Java
(23, 11),                  -- Programming Pearls
(10, 12),                  -- TAOCP
(9, 13),                   -- Refactoring
(28, 14),                  -- YDKJS
(29, 15),                  -- Learning JS Design Patterns
(30, 16),                  -- Eloquent JS
(1, 17),                   -- OS Concepts
(11, 18),                  -- Modern OS
(31, 19),                  -- Let Us C
(32, 20),                  -- Java Complete Ref
(1, 21),                   -- Fundamentals of DB
(1, 22),                   -- DBMS Ramakrishnan
(8, 23),                   -- High Perf MySQL
(8, 24),                   -- SQL Antipatterns
(9, 25),                   -- DDIA
(21, 26),                  -- Python Crash Course
(21, 27),                  -- Fluent Python
(4, 28),                   -- DSA in Python
(4, 29),                   -- Grokking Algorithms
(13, 30),                  -- PRML
(14, 31),                  -- Hands-On ML
(11, 32),                  -- Comp Arch
(18, 33),                  -- Linux Programming Interface
(8, 34),                   -- Clean Architecture
(18, 35),                  -- Compilers
(4, 36),                   -- Theory of Computation
(9, 37);                   -- Cloud Native

-- 7. Seed Borrow (>= 40 rows, BORROWID 26 is active for BOOKID 2, date constraints met)
INSERT INTO BORROW (BORROWID, BORROWDATE, DUE_DATE, RETURNDATE, STUDENTID, BOOKID) VALUES
(1,  '2024-01-10', '2024-01-24', '2024-01-20', 1,  1),
(2,  '2024-01-12', '2024-01-26', '2024-01-25', 2,  3),
(3,  '2024-01-15', '2024-01-29', '2024-02-02', 3,  4),
(4,  '2024-01-18', '2024-02-01', '2024-01-30', 4,  5),
(5,  '2024-01-20', '2024-02-03', '2024-02-01', 5,  6),
(6,  '2024-01-22', '2024-02-05', '2024-02-04', 6,  7),
(7,  '2024-01-25', '2024-02-08', '2024-02-07', 7,  8),
(8,  '2024-01-28', '2024-02-11', '2024-02-10', 8,  9),
(9,  '2024-02-01', '2024-02-15', '2024-02-14', 9,  10),
(10, '2024-02-03', '2024-02-17', '2024-02-16', 10, 11),
(11, '2024-02-05', '2024-02-19', '2024-02-18', 11, 12),
(12, '2024-02-08', '2024-02-22', '2024-02-20', 12, 13),
(13, '2024-02-10', '2024-02-24', '2024-02-22', 13, 14),
(14, '2024-02-12', '2024-02-26', '2024-02-25', 14, 15),
(15, '2024-02-15', '2024-03-01', '2024-02-28', 15, 16),
(16, '2024-02-18', '2024-03-03', '2024-03-01', 16, 17),
(17, '2024-02-20', '2024-03-05', '2024-03-04', 17, 18),
(18, '2024-02-22', '2024-03-07', '2024-03-06', 18, 19),
(19, '2024-02-25', '2024-03-10', '2024-03-08', 19, 20),
(20, '2024-02-28', '2024-03-13', '2024-03-12', 20, 21),
(21, '2024-03-01', '2024-03-15', '2024-03-14', 1,  22),
(22, '2024-03-03', '2024-03-17', '2024-03-16', 2,  23),
(23, '2024-03-05', '2024-03-19', '2024-03-18', 3,  24),
(24, '2024-03-08', '2024-03-22', '2024-03-20', 4,  25),
(25, '2024-03-10', '2024-03-24', '2024-03-22', 5,  26),
-- Important: BORROWID 26 is specifically verified in trigger_tests.sql as active for BOOKID 2
(26, '2024-09-01', '2024-09-15', NULL,         6,  2),
(27, '2024-09-05', '2024-09-19', NULL,         7,  5),
(28, '2024-09-10', '2024-09-24', NULL,         8,  10),
(29, '2024-09-12', '2024-09-26', NULL,         9,  14),
(30, '2024-09-15', '2024-09-29', NULL,         10, 18),
(31, '2024-09-20', '2024-10-04', NULL,         11, 23),
(32, '2024-09-25', '2024-10-09', NULL,         12, 27),
(33, '2024-09-28', '2024-10-12', NULL,         13, 31),
(34, '2024-08-01', '2024-08-15', '2024-08-14', 14, 32),
(35, '2024-08-05', '2024-08-19', '2024-08-18', 15, 33),
(36, '2024-08-10', '2024-08-24', '2024-08-22', 16, 34),
(37, '2024-08-15', '2024-08-29', '2024-08-28', 17, 35),
(38, '2024-08-20', '2024-09-03', '2024-09-01', 18, 36),
(39, '2024-08-25', '2024-09-08', '2024-09-05', 19, 37),
(40, '2024-08-28', '2024-09-11', '2024-09-10', 20, 1),
(41, '2024-10-01', '2024-10-15', NULL,         1,  3),
(42, '2024-10-05', '2024-10-19', NULL,         2,  8);
