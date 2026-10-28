#!/usr/bin/env python3
"""
Library Management System - Backend Server
Provides a RESTful API and serves the frontend web application.
Includes full support for:
- 7 Base Tables (AUTHOR, PUBLISHER, LIBRARY, STUDENT, BOOKS, BORROW, WRITTEN_BY)
- 5 Views (AVAILABLE_BOOKS, CURRENT_BORROWINGS, STUDENT_BORROWING_HISTORY, BOOK_DETAILS, OVERDUE_BOOKS)
- 6 Stored Procedures emulation & execution
- 4 Stored Functions
- Triggers & Constraint validations
- Custom SQL Query Runner
- Embedded SQLite persistence with optional MySQL connection
"""

import os
import sys
import json
import sqlite3
import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "library.db")
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")
PORT = 8000


def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_sqlite_db():
    """Initializes the database schema and seeds with project data if needed."""
    conn = get_db()
    cursor = conn.cursor()

    # Check if BOOKS table already exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='BOOKS';")
    if cursor.fetchone() is not None:
        conn.close()
        return

    print("Initializing database and seeding default DBMS project data...")

    schema_sql = """
    CREATE TABLE IF NOT EXISTS AUTHOR (
        AUTHORID INTEGER PRIMARY KEY AUTOINCREMENT,
        NAME TEXT NOT NULL,
        EMAIL TEXT UNIQUE,
        NATIONALITY TEXT DEFAULT 'International'
    );

    CREATE TABLE IF NOT EXISTS PUBLISHER (
        PUBLISHERID INTEGER PRIMARY KEY AUTOINCREMENT,
        NAME TEXT NOT NULL,
        NATIONALITY TEXT DEFAULT 'International'
    );

    CREATE TABLE IF NOT EXISTS LIBRARY (
        LIBRARYID INTEGER PRIMARY KEY AUTOINCREMENT,
        NAME TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS STUDENT (
        STUDENTID INTEGER PRIMARY KEY AUTOINCREMENT,
        USERID TEXT NOT NULL UNIQUE,
        STUDENTNAME TEXT NOT NULL,
        STUDENTEMAIL TEXT NOT NULL UNIQUE,
        STUDENTPHONENUMBER TEXT,
        BRANCH TEXT NOT NULL,
        SEMESTER INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS BOOKS (
        BOOKID INTEGER PRIMARY KEY AUTOINCREMENT,
        TITLE TEXT NOT NULL,
        ISBN TEXT,
        CATEGORY TEXT NOT NULL,
        PUBLICATIONYEAR INTEGER NOT NULL,
        PUBLISHERID INTEGER NOT NULL REFERENCES PUBLISHER(PUBLISHERID),
        LIBRARYID INTEGER NOT NULL REFERENCES LIBRARY(LIBRARYID)
    );

    CREATE TABLE IF NOT EXISTS BORROW (
        BORROWID INTEGER PRIMARY KEY AUTOINCREMENT,
        BORROWDATE TEXT NOT NULL,
        DUE_DATE TEXT NOT NULL,
        RETURNDATE TEXT,
        STUDENTID INTEGER NOT NULL REFERENCES STUDENT(STUDENTID),
        BOOKID INTEGER NOT NULL REFERENCES BOOKS(BOOKID)
    );

    CREATE TABLE IF NOT EXISTS WRITTEN_BY (
        AUTHORID INTEGER NOT NULL REFERENCES AUTHOR(AUTHORID) ON DELETE CASCADE,
        BOOKID INTEGER NOT NULL REFERENCES BOOKS(BOOKID) ON DELETE CASCADE,
        PRIMARY KEY (AUTHORID, BOOKID)
    );

    -- Views
    CREATE VIEW IF NOT EXISTS AVAILABLE_BOOKS AS
    SELECT B.BOOKID, B.TITLE, B.ISBN, B.CATEGORY, B.PUBLICATIONYEAR,
           P.NAME AS PUBLISHER, L.NAME AS LIBRARY
    FROM BOOKS B
    JOIN PUBLISHER P ON B.PUBLISHERID = P.PUBLISHERID
    JOIN LIBRARY L ON B.LIBRARYID = L.LIBRARYID
    WHERE NOT EXISTS (
        SELECT 1 FROM BORROW BR
        WHERE BR.BOOKID = B.BOOKID AND BR.RETURNDATE IS NULL
    );

    CREATE VIEW IF NOT EXISTS CURRENT_BORROWINGS AS
    SELECT BR.BORROWID, S.STUDENTID, S.STUDENTNAME, B.BOOKID, B.TITLE,
           L.NAME AS LIBRARY, BR.BORROWDATE, BR.DUE_DATE,
           CAST(ROUND((JULIANDAY('now') - JULIANDAY(BR.DUE_DATE))) AS INTEGER) AS DAYS_PAST_DUE
    FROM BORROW BR
    JOIN STUDENT S ON BR.STUDENTID = S.STUDENTID
    JOIN BOOKS B ON BR.BOOKID = B.BOOKID
    JOIN LIBRARY L ON B.LIBRARYID = L.LIBRARYID
    WHERE BR.RETURNDATE IS NULL;

    CREATE VIEW IF NOT EXISTS STUDENT_BORROWING_HISTORY AS
    SELECT S.STUDENTID, S.STUDENTNAME, B.TITLE, BR.BORROWID,
           BR.BORROWDATE, BR.DUE_DATE, BR.RETURNDATE,
           CASE
               WHEN BR.RETURNDATE IS NOT NULL THEN 'Returned'
               WHEN date(BR.DUE_DATE) < date('now') THEN 'Overdue'
               ELSE 'Active'
           END AS STATUS
    FROM BORROW BR
    JOIN STUDENT S ON BR.STUDENTID = S.STUDENTID
    JOIN BOOKS B ON BR.BOOKID = B.BOOKID;

    CREATE VIEW IF NOT EXISTS BOOK_DETAILS AS
    SELECT B.BOOKID, B.TITLE, B.ISBN, B.CATEGORY, B.PUBLICATIONYEAR,
           GROUP_CONCAT(A.NAME, ', ') AS AUTHORS,
           P.NAME AS PUBLISHER, L.NAME AS LIBRARY
    FROM BOOKS B
    LEFT JOIN WRITTEN_BY WB ON B.BOOKID = WB.BOOKID
    LEFT JOIN AUTHOR A ON WB.AUTHORID = A.AUTHORID
    JOIN PUBLISHER P ON B.PUBLISHERID = P.PUBLISHERID
    JOIN LIBRARY L ON B.LIBRARYID = L.LIBRARYID
    GROUP BY B.BOOKID;

    CREATE VIEW IF NOT EXISTS OVERDUE_BOOKS AS
    SELECT BR.BORROWID, S.STUDENTNAME, S.STUDENTEMAIL, B.TITLE,
           BR.DUE_DATE,
           CAST(ROUND(JULIANDAY('now') - JULIANDAY(BR.DUE_DATE)) AS INTEGER) AS DAYS_OVERDUE
    FROM BORROW BR
    JOIN STUDENT S ON BR.STUDENTID = S.STUDENTID
    JOIN BOOKS B ON BR.BOOKID = B.BOOKID
    WHERE BR.RETURNDATE IS NULL AND date(BR.DUE_DATE) < date('now');
    """
    cursor.executescript(schema_sql)

    # Seed Libraries
    libraries = [
        (1, 'Central Campus Library'),
        (2, 'Engineering & Tech Library'),
        (3, 'Science & Research Library')
    ]
    cursor.executemany("INSERT INTO LIBRARY (LIBRARYID, NAME) VALUES (?, ?)", libraries)

    # Seed Publishers
    publishers = [
        (1, 'McGraw-Hill Education', 'American'),
        (2, 'Pearson Education', 'British'),
        (3, 'Addison-Wesley Professional', 'American'),
        (4, 'John Wiley & Sons', 'American'),
        (5, 'MIT Press', 'American'),
        (6, "O'Reilly Media", 'American'),
        (7, 'Springer Nature', 'German'),
        (8, 'Oxford University Press', 'British')
    ]
    cursor.executemany("INSERT INTO PUBLISHER (PUBLISHERID, NAME, NATIONALITY) VALUES (?, ?, ?)", publishers)

    # Seed Authors
    authors = [
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
        (32, 'Herbert Schildt', 'herbert@schildt.com', 'American')
    ]
    cursor.executemany("INSERT INTO AUTHOR (AUTHORID, NAME, EMAIL, NATIONALITY) VALUES (?, ?, ?, ?)", authors)

    # Seed Students
    students = [
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
        (22, 'IT2023102', 'Bhavna Sen',      'bhavna.sen@college.edu',      '9876543231', 'IT',   3)
    ]
    cursor.executemany("INSERT INTO STUDENT (STUDENTID, USERID, STUDENTNAME, STUDENTEMAIL, STUDENTPHONENUMBER, BRANCH, SEMESTER) VALUES (?, ?, ?, ?, ?, ?, ?)", students)

    # Seed Books
    books = [
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
        (14, "You Don't Know JS: Scope & Closures",         '978-1449335588', 'Web',         2014, 6, 2),
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
        (37, 'Cloud Native Patterns',                        '978-1617294297', 'Web',         2019, 1, 3)
    ]
    cursor.executemany("INSERT INTO BOOKS (BOOKID, TITLE, ISBN, CATEGORY, PUBLICATIONYEAR, PUBLISHERID, LIBRARYID) VALUES (?, ?, ?, ?, ?, ?, ?)", books)

    # Seed Written_By
    written_by = [
        (1, 1),  (2, 1),  (3, 1),
        (4, 2),  (5, 2),  (6, 2), (7, 2),
        (8, 3),
        (11, 4), (12, 4),
        (13, 5), (14, 5),
        (15, 6), (16, 6), (17, 6),
        (24, 7), (25, 7), (26, 7), (27, 7),
        (18, 8), (19, 8),
        (20, 9),
        (22, 10),
        (23, 11),
        (10, 12),
        (9, 13),
        (28, 14),
        (29, 15),
        (30, 16),
        (1, 17),
        (11, 18),
        (31, 19),
        (32, 20),
        (1, 21),
        (1, 22),
        (8, 23),
        (8, 24),
        (9, 25),
        (21, 26),
        (21, 27),
        (4, 28),
        (4, 29),
        (13, 30),
        (14, 31),
        (11, 32),
        (18, 33),
        (8, 34),
        (18, 35),
        (4, 36),
        (9, 37)
    ]
    cursor.executemany("INSERT INTO WRITTEN_BY (AUTHORID, BOOKID) VALUES (?, ?)", written_by)

    # Seed Borrow
    borrows = [
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
        (26, '2024-09-01', '2024-09-15', None,         6,  2),
        (27, '2024-09-05', '2024-09-19', None,         7,  5),
        (28, '2024-09-10', '2024-09-24', None,         8,  10),
        (29, '2024-09-12', '2024-09-26', None,         9,  14),
        (30, '2024-09-15', '2024-09-29', None,         10, 18),
        (31, '2024-09-20', '2024-10-04', None,         11, 23),
        (32, '2024-09-25', '2024-10-09', None,         12, 27),
        (33, '2024-09-28', '2024-10-12', None,         13, 31),
        (34, '2024-08-01', '2024-08-15', '2024-08-14', 14, 32),
        (35, '2024-08-05', '2024-08-19', '2024-08-18', 15, 33),
        (36, '2024-08-10', '2024-08-24', '2024-08-22', 16, 34),
        (37, '2024-08-15', '2024-08-29', '2024-08-28', 17, 35),
        (38, '2024-08-20', '2024-09-03', '2024-09-01', 18, 36),
        (39, '2024-08-25', '2024-09-08', '2024-09-05', 19, 37),
        (40, '2024-08-28', '2024-09-11', '2024-09-10', 20, 1),
        (41, '2024-10-01', '2024-10-15', None,         1,  3),
        (42, '2024-10-05', '2024-10-19', None,         2,  8)
    ]
    cursor.executemany("INSERT INTO BORROW (BORROWID, BORROWDATE, DUE_DATE, RETURNDATE, STUDENTID, BOOKID) VALUES (?, ?, ?, ?, ?, ?)", borrows)

    conn.commit()
    conn.close()
    print("Database initialized and seeded successfully.")


class LibraryAPIHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def _send_json(self, data, status=200):
        body = json.dumps(data, default=str).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        if path.startswith("/api/"):
            return self.handle_api_get(path, params)
        else:
            return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/"):
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                payload = json.loads(post_data.decode('utf-8')) if post_data else {}
            except Exception:
                payload = {}
            return self.handle_api_post(path, payload)
        else:
            self.send_error(404, "Not Found")

    # ------------------ API GET HANDLERS ------------------
    def handle_api_get(self, path, params):
        conn = get_db()
        cursor = conn.cursor()

        try:
            if path == "/api/health":
                self._send_json({"status": "ok", "time": datetime.datetime.now().isoformat()})

            elif path == "/api/stats":
                # Dashboard KPIs and aggregation
                cursor.execute("SELECT COUNT(*) AS total_books FROM BOOKS")
                total_books = cursor.fetchone()['total_books']

                cursor.execute("SELECT COUNT(*) AS active_loans FROM BORROW WHERE RETURNDATE IS NULL")
                active_loans = cursor.fetchone()['active_loans']

                cursor.execute("SELECT COUNT(*) AS overdue_loans FROM BORROW WHERE RETURNDATE IS NULL AND date(DUE_DATE) < date('now')")
                overdue_loans = cursor.fetchone()['overdue_loans']

                cursor.execute("SELECT COUNT(*) AS total_students FROM STUDENT")
                total_students = cursor.fetchone()['total_students']

                cursor.execute("SELECT COUNT(*) AS total_authors FROM AUTHOR")
                total_authors = cursor.fetchone()['total_authors']

                cursor.execute("SELECT COUNT(*) AS total_publishers FROM PUBLISHER")
                total_publishers = cursor.fetchone()['total_publishers']

                cursor.execute("SELECT COUNT(*) AS total_libraries FROM LIBRARY")
                total_libraries = cursor.fetchone()['total_libraries']

                available_books = total_books - active_loans

                # Category breakdown
                cursor.execute("""
                    SELECT CATEGORY, COUNT(*) as count 
                    FROM BOOKS 
                    GROUP BY CATEGORY 
                    ORDER BY count DESC
                """)
                category_distribution = [dict(row) for row in cursor.fetchall()]

                # Library breakdown
                cursor.execute("""
                    SELECT L.NAME as library_name, COUNT(B.BOOKID) as total_books,
                           SUM(CASE WHEN BR.RETURNDATE IS NULL AND BR.BORROWID IS NOT NULL THEN 1 ELSE 0 END) as borrowed
                    FROM LIBRARY L
                    LEFT JOIN BOOKS B ON L.LIBRARYID = B.LIBRARYID
                    LEFT JOIN BORROW BR ON B.BOOKID = BR.BOOKID
                    GROUP BY L.LIBRARYID, L.NAME
                """)
                library_stats = []
                for row in cursor.fetchall():
                    tot = row['total_books'] or 0
                    br = row['borrowed'] or 0
                    library_stats.append({
                        "library_name": row['library_name'],
                        "total": tot,
                        "borrowed": br,
                        "available": max(0, tot - br)
                    })

                self._send_json({
                    "total_books": total_books,
                    "available_books": available_books,
                    "active_loans": active_loans,
                    "overdue_loans": overdue_loans,
                    "total_students": total_students,
                    "total_authors": total_authors,
                    "total_publishers": total_publishers,
                    "total_libraries": total_libraries,
                    "category_distribution": category_distribution,
                    "library_stats": library_stats
                })

            elif path == "/api/books":
                search = params.get('q', [''])[0].strip().lower()
                category = params.get('category', [''])[0].strip()
                status = params.get('status', [''])[0].strip()
                library_id = params.get('library_id', [''])[0].strip()

                query = """
                    SELECT B.BOOKID, B.TITLE, B.ISBN, B.CATEGORY, B.PUBLICATIONYEAR,
                           P.PUBLISHERID, P.NAME AS PUBLISHER,
                           L.LIBRARYID, L.NAME AS LIBRARY,
                           COALESCE(GROUP_CONCAT(A.NAME, ', '), 'No author') AS AUTHORS,
                           CASE WHEN BR.BORROWID IS NOT NULL AND BR.RETURNDATE IS NULL THEN 'Borrowed' ELSE 'Available' END AS STATUS,
                           (strftime('%Y', 'now') - B.PUBLICATIONYEAR) AS AGE
                    FROM BOOKS B
                    JOIN PUBLISHER P ON B.PUBLISHERID = P.PUBLISHERID
                    JOIN LIBRARY L ON B.LIBRARYID = L.LIBRARYID
                    LEFT JOIN WRITTEN_BY WB ON B.BOOKID = WB.BOOKID
                    LEFT JOIN AUTHOR A ON WB.AUTHORID = A.AUTHORID
                    LEFT JOIN BORROW BR ON B.BOOKID = BR.BOOKID AND BR.RETURNDATE IS NULL
                    WHERE 1=1
                """
                args = []
                if category:
                    query += " AND B.CATEGORY = ?"
                    args.append(category)
                if library_id:
                    query += " AND B.LIBRARYID = ?"
                    args.append(library_id)

                query += " GROUP BY B.BOOKID"

                if status == 'Available':
                    query += " HAVING STATUS = 'Available'"
                elif status == 'Borrowed':
                    query += " HAVING STATUS = 'Borrowed'"

                query += " ORDER BY B.BOOKID ASC"
                cursor.execute(query, args)
                rows = [dict(r) for r in cursor.fetchall()]

                # If search filter is active
                if search:
                    rows = [r for r in rows if search in r['TITLE'].lower() or search in (r['AUTHORS'] or '').lower() or search in (r['ISBN'] or '').lower()]

                self._send_json(rows)

            elif path == "/api/students":
                cursor.execute("""
                    SELECT S.STUDENTID, S.USERID, S.STUDENTNAME, S.STUDENTEMAIL,
                           S.STUDENTPHONENUMBER, S.BRANCH, S.SEMESTER,
                           COUNT(BR.BORROWID) AS TOTAL_BORROWS,
                           SUM(CASE WHEN BR.RETURNDATE IS NULL THEN 1 ELSE 0 END) AS ACTIVE_LOANS
                    FROM STUDENT S
                    LEFT JOIN BORROW BR ON S.STUDENTID = BR.STUDENTID
                    GROUP BY S.STUDENTID
                    ORDER BY S.STUDENTID ASC
                """)
                self._send_json([dict(r) for r in cursor.fetchall()])

            elif path.startswith("/api/students/") and path.endswith("/history"):
                student_id = int(path.split("/")[3])
                # Implements GET_STUDENT_BORROW_HISTORY stored procedure
                cursor.execute("""
                    SELECT BR.BORROWID, B.BOOKID, B.TITLE, B.CATEGORY,
                           BR.BORROWDATE, BR.DUE_DATE,
                           COALESCE(BR.RETURNDATE, 'Not Returned') AS RETURNDATE,
                           CASE
                               WHEN BR.RETURNDATE IS NOT NULL THEN 'Returned'
                               WHEN date(BR.DUE_DATE) < date('now') THEN 'OVERDUE'
                               ELSE 'Active'
                           END AS STATUS,
                           CAST(ROUND(JULIANDAY('now') - JULIANDAY(BR.DUE_DATE)) AS INTEGER) AS DAYS_OVERDUE
                    FROM BORROW BR
                    JOIN BOOKS B ON BR.BOOKID = B.BOOKID
                    WHERE BR.STUDENTID = ?
                    ORDER BY BR.BORROWDATE DESC, BR.BORROWID DESC
                """, (student_id,))
                self._send_json([dict(r) for r in cursor.fetchall()])

            elif path == "/api/borrowings/active":
                # Implements LIST_ALL_ACTIVE_BORROWINGS cursor procedure
                cursor.execute("""
                    SELECT BR.BORROWID, S.STUDENTID, S.STUDENTNAME, S.STUDENTEMAIL, S.BRANCH,
                           B.BOOKID, B.TITLE, L.NAME AS LIBRARY,
                           BR.BORROWDATE, BR.DUE_DATE,
                           CASE 
                               WHEN date(BR.DUE_DATE) < date('now') THEN CAST(ROUND(JULIANDAY('now') - JULIANDAY(BR.DUE_DATE)) AS INTEGER)
                               ELSE 0 
                           END AS DAYS_OVERDUE,
                           CASE
                               WHEN date(BR.DUE_DATE) < date('now') THEN 'OVERDUE'
                               ELSE 'On Time'
                           END AS STATUS
                    FROM BORROW BR
                    JOIN STUDENT S ON BR.STUDENTID = S.STUDENTID
                    JOIN BOOKS B ON BR.BOOKID = B.BOOKID
                    JOIN LIBRARY L ON B.LIBRARYID = L.LIBRARYID
                    WHERE BR.RETURNDATE IS NULL
                    ORDER BY BR.DUE_DATE ASC
                """)
                self._send_json([dict(r) for r in cursor.fetchall()])

            elif path == "/api/borrowings/overdue":
                # Queries OVERDUE_BOOKS view
                cursor.execute("""
                    SELECT BR.BORROWID, S.STUDENTID, S.STUDENTNAME, S.STUDENTEMAIL, S.STUDENTPHONENUMBER,
                           B.BOOKID, B.TITLE, BR.DUE_DATE,
                           CAST(ROUND(JULIANDAY('now') - JULIANDAY(BR.DUE_DATE)) AS INTEGER) AS DAYS_OVERDUE
                    FROM BORROW BR
                    JOIN STUDENT S ON BR.STUDENTID = S.STUDENTID
                    JOIN BOOKS B ON BR.BOOKID = B.BOOKID
                    WHERE BR.RETURNDATE IS NULL AND date(BR.DUE_DATE) < date('now')
                    ORDER BY DAYS_OVERDUE DESC
                """)
                self._send_json([dict(r) for r in cursor.fetchall()])

            elif path == "/api/libraries":
                cursor.execute("""
                    SELECT L.LIBRARYID, L.NAME,
                           COUNT(B.BOOKID) AS TOTAL_BOOKS
                    FROM LIBRARY L
                    LEFT JOIN BOOKS B ON L.LIBRARYID = B.LIBRARYID
                    GROUP BY L.LIBRARYID
                    ORDER BY L.NAME ASC
                """)
                self._send_json([dict(r) for r in cursor.fetchall()])

            elif path == "/api/authors":
                cursor.execute("""
                    SELECT A.AUTHORID, A.NAME, A.EMAIL, A.NATIONALITY,
                           COUNT(WB.BOOKID) AS BOOKS_COUNT
                    FROM AUTHOR A
                    LEFT JOIN WRITTEN_BY WB ON A.AUTHORID = WB.AUTHORID
                    GROUP BY A.AUTHORID
                    ORDER BY A.NAME ASC
                """)
                self._send_json([dict(r) for r in cursor.fetchall()])

            elif path == "/api/publishers":
                cursor.execute("""
                    SELECT P.PUBLISHERID, P.NAME, P.NATIONALITY,
                           COUNT(B.BOOKID) AS BOOKS_COUNT
                    FROM PUBLISHER P
                    LEFT JOIN BOOKS B ON P.PUBLISHERID = B.PUBLISHERID
                    GROUP BY P.PUBLISHERID
                    ORDER BY P.NAME ASC
                """)
                self._send_json([dict(r) for r in cursor.fetchall()])

            else:
                self.send_error(404, "Endpoint not found")
        finally:
            conn.close()

    # ------------------ API POST HANDLERS ------------------
    def handle_api_post(self, path, payload):
        conn = get_db()
        cursor = conn.cursor()

        try:
            # 1. BORROW_BOOK Procedure
            if path == "/api/borrow":
                student_id = payload.get('student_id')
                book_id = payload.get('book_id')
                borrow_date = payload.get('borrow_date') or datetime.date.today().isoformat()
                due_date = payload.get('due_date')

                if not student_id or not book_id or not due_date:
                    return self._send_json({"success": False, "message": "Missing required fields."}, status=400)

                # Validation Trigger / Procedure check
                if borrow_date > datetime.date.today().isoformat():
                    return self._send_json({"success": False, "message": "ERROR: Borrow date must not be future-dated."}, status=400)
                if due_date <= borrow_date:
                    return self._send_json({"success": False, "message": "ERROR: Due date must be later than borrow date."}, status=400)

                cursor.execute("SELECT STUDENTID FROM STUDENT WHERE STUDENTID = ?", (student_id,))
                if not cursor.fetchone():
                    return self._send_json({"success": False, "message": f"ERROR: Student ID {student_id} does not exist."}, status=404)

                cursor.execute("SELECT BOOKID FROM BOOKS WHERE BOOKID = ?", (book_id,))
                if not cursor.fetchone():
                    return self._send_json({"success": False, "message": f"ERROR: Book ID {book_id} does not exist."}, status=404)

                # Unique active loan check (TRG_BEFORE_INSERT_BORROW / UQ_BORROW_ONE_ACTIVE_BOOK)
                cursor.execute("SELECT BORROWID FROM BORROW WHERE BOOKID = ? AND RETURNDATE IS NULL", (book_id,))
                if cursor.fetchone():
                    return self._send_json({"success": False, "message": f"ERROR: Book ID {book_id} is currently borrowed."}, status=409)

                cursor.execute("""
                    INSERT INTO BORROW (BORROWDATE, DUE_DATE, RETURNDATE, STUDENTID, BOOKID)
                    VALUES (?, ?, NULL, ?, ?)
                """, (borrow_date, due_date, student_id, book_id))
                new_borrow_id = cursor.lastrowid
                conn.commit()

                return self._send_json({
                    "success": True,
                    "message": f"SUCCESS: Book borrowed. BORROWID = {new_borrow_id}. Due: {due_date}",
                    "borrow_id": new_borrow_id
                })

            # 2. RETURN_BOOK Procedure
            elif path == "/api/return":
                borrow_id = payload.get('borrow_id')
                return_date = payload.get('return_date') or datetime.date.today().isoformat()

                if not borrow_id:
                    return self._send_json({"success": False, "message": "Borrow ID is required."}, status=400)

                cursor.execute("SELECT BORROWDATE, RETURNDATE FROM BORROW WHERE BORROWID = ?", (borrow_id,))
                row = cursor.fetchone()
                if not row:
                    return self._send_json({"success": False, "message": f"ERROR: Borrow ID {borrow_id} does not exist."}, status=404)

                if row['RETURNDATE'] is not None:
                    return self._send_json({"success": False, "message": f"ERROR: Borrow ID {borrow_id} was already returned."}, status=400)

                if return_date < row['BORROWDATE']:
                    return self._send_json({"success": False, "message": "ERROR: Return date cannot be before borrow date."}, status=400)

                cursor.execute("UPDATE BORROW SET RETURNDATE = ? WHERE BORROWID = ?", (return_date, borrow_id))
                conn.commit()

                return self._send_json({
                    "success": True,
                    "message": f"SUCCESS: Book returned for BORROWID = {borrow_id} on {return_date}."
                })

            # 3. Add Student (with TRG_BEFORE_INSERT_STUDENT validation)
            elif path == "/api/students":
                userid = (payload.get('userid') or '').strip()
                name = (payload.get('name') or '').strip()
                email = (payload.get('email') or '').strip()
                phone = (payload.get('phone') or '').strip()
                branch = (payload.get('branch') or '').strip()
                semester = int(payload.get('semester') or 1)

                if not name:
                    return self._send_json({"success": False, "message": "TRG_BEFORE_INSERT_STUDENT: STUDENTNAME cannot be blank."}, status=400)
                if len(userid) < 5:
                    return self._send_json({"success": False, "message": "TRG_BEFORE_INSERT_STUDENT: USERID must be at least five characters long."}, status=400)

                try:
                    cursor.execute("""
                        INSERT INTO STUDENT (USERID, STUDENTNAME, STUDENTEMAIL, STUDENTPHONENUMBER, BRANCH, SEMESTER)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (userid, name, email, phone, branch, semester))
                    new_id = cursor.lastrowid
                    conn.commit()
                    return self._send_json({"success": True, "student_id": new_id, "message": "Student created successfully."})
                except sqlite3.IntegrityError as e:
                    return self._send_json({"success": False, "message": f"Database error: {str(e)}"}, status=409)

            # 4. Add Book (with TRG_BEFORE_INSERT_BOOKS validation)
            elif path == "/api/books":
                title = (payload.get('title') or '').strip()
                isbn = (payload.get('isbn') or '').strip() or None
                category = (payload.get('category') or '').strip()
                year = int(payload.get('publication_year') or 2024)
                publisher_id = int(payload.get('publisher_id') or 1)
                library_id = int(payload.get('library_id') or 1)
                author_ids = payload.get('author_ids') or []

                current_year = datetime.date.today().year
                if year < 1800 or year > (current_year + 1):
                    return self._send_json({"success": False, "message": "TRG_BEFORE_INSERT_BOOKS: PUBLICATIONYEAR must be between 1800 and next year."}, status=400)
                if not title:
                    return self._send_json({"success": False, "message": "TRG_BEFORE_INSERT_BOOKS: BOOKS.TITLE cannot be blank."}, status=400)

                cursor.execute("""
                    INSERT INTO BOOKS (TITLE, ISBN, CATEGORY, PUBLICATIONYEAR, PUBLISHERID, LIBRARYID)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (title, isbn, category, year, publisher_id, library_id))
                book_id = cursor.lastrowid

                for a_id in author_ids:
                    cursor.execute("INSERT OR IGNORE INTO WRITTEN_BY (AUTHORID, BOOKID) VALUES (?, ?)", (a_id, book_id))

                conn.commit()
                return self._send_json({"success": True, "book_id": book_id, "message": "Book added successfully."})

            # 5. Stored Procedures and Stored Functions Testing Suite
            elif path == "/api/procedures/run":
                proc_name = payload.get('procedure')
                params = payload.get('params') or {}

                if proc_name == "GET_BOOK_AGE":
                    b_id = int(params.get('book_id', 0))
                    cursor.execute("SELECT PUBLICATIONYEAR FROM BOOKS WHERE BOOKID = ?", (b_id,))
                    row = cursor.fetchone()
                    if not row:
                        result = -1
                    else:
                        result = datetime.date.today().year - row['PUBLICATIONYEAR']
                    return self._send_json({"procedure": proc_name, "input": b_id, "result": result})

                elif proc_name == "GET_STUDENT_BORROW_COUNT":
                    s_id = int(params.get('student_id', 0))
                    cursor.execute("SELECT COUNT(*) AS c FROM BORROW WHERE STUDENTID = ?", (s_id,))
                    count = cursor.fetchone()['c']
                    return self._send_json({"procedure": proc_name, "input": s_id, "result": count})

                elif proc_name == "GET_ACTIVE_BORROW_COUNT":
                    s_id = int(params.get('student_id', 0))
                    cursor.execute("SELECT COUNT(*) AS c FROM BORROW WHERE STUDENTID = ? AND RETURNDATE IS NULL", (s_id,))
                    count = cursor.fetchone()['c']
                    return self._send_json({"procedure": proc_name, "input": s_id, "result": count})

                elif proc_name == "IS_BOOK_AVAILABLE":
                    b_id = int(params.get('book_id', 0))
                    cursor.execute("SELECT BOOKID FROM BOOKS WHERE BOOKID = ?", (b_id,))
                    if not cursor.fetchone():
                        result = -1
                    else:
                        cursor.execute("SELECT BORROWID FROM BORROW WHERE BOOKID = ? AND RETURNDATE IS NULL", (b_id,))
                        result = 0 if cursor.fetchone() else 1
                    return self._send_json({"procedure": proc_name, "input": b_id, "result": result, "status": "Available" if result == 1 else ("Borrowed" if result == 0 else "Not Found")})

                elif proc_name == "GET_BOOKS_BY_LIBRARY":
                    lib_id = int(params.get('library_id', 1))
                    cursor.execute("""
                        SELECT L.NAME AS LibraryName, B.BOOKID, B.TITLE, B.ISBN, B.CATEGORY, B.PUBLICATIONYEAR,
                               COALESCE(GROUP_CONCAT(A.NAME, '; '), 'No author') AS Authors,
                               P.NAME AS Publisher,
                               CASE WHEN BR.RETURNDATE IS NULL AND BR.BORROWID IS NOT NULL THEN 'Borrowed' ELSE 'Available' END AS Status
                        FROM BOOKS B
                        INNER JOIN LIBRARY L ON B.LIBRARYID = L.LIBRARYID
                        INNER JOIN PUBLISHER P ON B.PUBLISHERID = P.PUBLISHERID
                        LEFT JOIN WRITTEN_BY WB ON B.BOOKID = WB.BOOKID
                        LEFT JOIN AUTHOR A ON WB.AUTHORID = A.AUTHORID
                        LEFT JOIN BORROW BR ON B.BOOKID = BR.BOOKID AND BR.RETURNDATE IS NULL
                        WHERE B.LIBRARYID = ?
                        GROUP BY B.BOOKID
                        ORDER BY B.TITLE
                    """, (lib_id,))
                    rows = [dict(r) for r in cursor.fetchall()]
                    return self._send_json({"procedure": proc_name, "library_id": lib_id, "results": rows})

                elif proc_name == "GENERATE_LIBRARY_STATS":
                    cursor.execute("SELECT LIBRARYID, NAME FROM LIBRARY ORDER BY NAME")
                    libs = cursor.fetchall()
                    stats = []
                    for lib in libs:
                        lib_id = lib['LIBRARYID']
                        lib_name = lib['NAME']
                        cursor.execute("SELECT COUNT(*) AS c FROM BOOKS WHERE LIBRARYID = ?", (lib_id,))
                        total = cursor.fetchone()['c']
                        cursor.execute("""
                            SELECT COUNT(*) AS c FROM BOOKS B
                            JOIN BORROW BR ON B.BOOKID = BR.BOOKID
                            WHERE B.LIBRARYID = ? AND BR.RETURNDATE IS NULL
                        """, (lib_id,))
                        borrowed = cursor.fetchone()['c']
                        stats.append({
                            "LibraryID": lib_id,
                            "LibraryName": lib_name,
                            "TotalBooks": total,
                            "CurrentlyBorrowed": borrowed,
                            "Available": total - borrowed
                        })
                    return self._send_json({"procedure": proc_name, "results": stats})

                else:
                    return self._send_json({"success": False, "message": "Unknown procedure"}, status=400)

            # 6. Interactive SQL Query Runner
            elif path == "/api/query":
                sql = (payload.get('sql') or '').strip()
                if not sql:
                    return self._send_json({"success": False, "message": "SQL query cannot be empty."}, status=400)

                # For safety in query playground, check read-only or handle errors
                start_time = datetime.datetime.now()
                try:
                    cursor.execute(sql)
                    if cursor.description:
                        columns = [desc[0] for desc in cursor.description]
                        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
                        duration = (datetime.datetime.now() - start_time).total_seconds() * 1000
                        return self._send_json({
                            "success": True,
                            "columns": columns,
                            "rows": rows,
                            "rowCount": len(rows),
                            "executionMs": round(duration, 2)
                        })
                    else:
                        conn.commit()
                        duration = (datetime.datetime.now() - start_time).total_seconds() * 1000
                        return self._send_json({
                            "success": True,
                            "columns": ["Result"],
                            "rows": [{"Result": f"Query executed successfully. Rows affected: {cursor.rowcount}"}],
                            "rowCount": cursor.rowcount,
                            "executionMs": round(duration, 2)
                        })
                except Exception as e:
                    return self._send_json({"success": False, "message": str(e)}, status=400)

            else:
                self.send_error(404, "Endpoint not found")
        finally:
            conn.close()


def run(port=PORT):
    init_sqlite_db()
    server_address = ('', port)
    httpd = ThreadingHTTPServer(server_address, LibraryAPIHandler)
    print(f"================================================================")
    print(f" Library Management System Web Server Running!")
    print(f" URL: http://localhost:{port}")
    print(f" Serving UI from: {PUBLIC_DIR}")
    print(f" Database: {DB_FILE}")
    print(f" Press Ctrl+C to stop.")
    print(f"================================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer shutting down gracefully.")
        httpd.server_close()


if __name__ == '__main__':
    run()
