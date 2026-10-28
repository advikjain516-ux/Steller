# 📚 Library Management System (DBMS & Full-Stack Web Platform)

A full-stack, enterprise-grade **Library Management System (`library_management_system`)** built with a normalized relational database backend, stored routines, triggers, relational views, and an interactive web dashboard.

---

## 📑 Table of Contents
1. [Project Overview](#-project-overview)
2. [Entity-Relationship & Architecture Design](#-entity-relationship--architecture-design)
3. [Database Schema & Base Tables](#-database-schema--base-tables)
4. [Relational Views](#-relational-views)
5. [Stored Procedures](#-stored-procedures)
6. [Stored Functions](#-stored-functions)
7. [Integrity Triggers](#-integrity-triggers)
8. [Cursor Implementations](#-cursor-implementations)
9. [Frontend Web Platform & Features](#-frontend-web-platform--features)
10. [Localhost Running Instructions](#-localhost-running-instructions)
11. [Vercel Cloud Deployment Guide](#-vercel-cloud-deployment-guide)
12. [Verification & Test Results](#-verification--test-results)

---

## 🎯 Project Overview

This project implements an end-to-end institutional library management platform that bridges raw relational algebra and database management theory with modern full-stack web engineering. 

### Core Capabilities:
- **Relational Integrity**: Enforces strict referential integrity across 7 normalized tables (3NF/BCNF) with composite keys, cascade rules, and check constraints.
- **Transactional Safety & Concurrency**: Features ACID-compliant transaction blocks with row-level pessimistic locking (`FOR UPDATE`) to prevent race conditions during book checkout.
- **Routines & Programmability**: Employs stored procedures, custom scalar functions, cursor-based iterative batch processing, and triggers.
- **Interactive Web Interface**: Single-page architecture with live Chart.js analytics, real-time search/filtering, modal workflows for loan issuance and returns, and an interactive DBMS query runner.

---

## 🏛️ Entity-Relationship & Architecture Design

```
                      +-------------------+
                      |      LIBRARY      |
                      +-------------------+
                                | 1
                                |
                                | M
+-------------------+ 1       M +-------------------+ M       1 +-------------------+
|     PUBLISHER     |-----------|       BOOKS       |-----------|      AUTHOR       |
+-------------------+           +-------------------+           +-------------------+
                                        | 1                               |
                                        |                                 | M (WRITTEN_BY)
                                        | M                               |
                                +-------------------+                     |
                                |      BORROW       |                     |
                                +-------------------+                     |
                                        | M                               |
                                        |                                 |
                                        | 1                               |
                                +-------------------+                     |
                                |      STUDENT      |                     |
                                +-------------------+                     +
```

---

## 🗄️ Database Schema & Base Tables

The system comprises **7 base relational tables** engineered for MySQL (InnoDB Engine) with full foreign key constraints and secondary performance indexes:

### 1. `LIBRARY`
Holds information about physical library campuses.
- `LIBRARYID` (INT, Primary Key, Auto Increment)
- `NAME` (VARCHAR(150), NOT NULL)

### 2. `PUBLISHER`
Tracks book publishing organizations.
- `PUBLISHERID` (INT, Primary Key, Auto Increment)
- `NAME` (VARCHAR(150), NOT NULL)
- `NATIONALITY` (VARCHAR(100), Default 'International')

### 3. `AUTHOR`
Catalog of book writers and co-contributors.
- `AUTHORID` (INT, Primary Key, Auto Increment)
- `NAME` (VARCHAR(150), NOT NULL)
- `EMAIL` (VARCHAR(150), UNIQUE)
- `NATIONALITY` (VARCHAR(100))

### 4. `STUDENT`
Institutional members eligible for circulation services.
- `STUDENTID` (INT, Primary Key, Auto Increment)
- `USERID` (VARCHAR(50), UNIQUE, NOT NULL) — *Minimum length 5 enforced by trigger*
- `STUDENTNAME` (VARCHAR(150), NOT NULL)
- `STUDENTEMAIL` (VARCHAR(150), UNIQUE, NOT NULL)
- `STUDENTPHONENUMBER` (VARCHAR(20))
- `BRANCH` (VARCHAR(50), NOT NULL) — *CSE, IT, AIML, AIDS, ECE*
- `SEMESTER` (INT, NOT NULL) — *Semesters 1 through 8*

### 5. `BOOKS`
Physical volume inventory across all campuses.
- `BOOKID` (INT, Primary Key, Auto Increment)
- `TITLE` (VARCHAR(300), NOT NULL)
- `ISBN` (VARCHAR(30))
- `CATEGORY` (VARCHAR(100), NOT NULL) — *Constraint: `CK_BOOKS_CATEGORY CHECK (TRIM(CATEGORY) <> '')`*
- `PUBLICATIONYEAR` (SMALLINT, NOT NULL) — *Range: 1800 to Next Year*
- `PUBLISHERID` (INT, FK -> `PUBLISHER.PUBLISHERID`)
- `LIBRARYID` (INT, FK -> `LIBRARY.LIBRARYID`)

### 6. `BORROW`
Transactional circulation log for checkouts and returns.
- `BORROWID` (INT, Primary Key, Auto Increment)
- `BORROWDATE` (DATE, NOT NULL)
- `DUE_DATE` (DATE, NOT NULL)
- `RETURNDATE` (DATE, NULLABLE)
- `STUDENTID` (INT, FK -> `STUDENT.STUDENTID`)
- `BOOKID` (INT, FK -> `BOOKS.BOOKID`)
- `ACTIVE_BOOKID` (INT, GENERATED ALWAYS AS `(CASE WHEN RETURNDATE IS NULL THEN BOOKID ELSE NULL END)` STORED)
- **Constraint**: `UNIQUE KEY UQ_BORROW_ONE_ACTIVE_BOOK (ACTIVE_BOOKID)` — *Guarantees at the database engine level that no single physical book can be actively loaned to more than one student simultaneously!*

### 7. `WRITTEN_BY`
Decomposed many-to-many junction table between `AUTHOR` and `BOOKS`.
- `AUTHORID` (INT, FK -> `AUTHOR.AUTHORID` ON DELETE CASCADE)
- `BOOKID` (INT, FK -> `BOOKS.BOOKID` ON DELETE CASCADE)
- **Primary Key**: Composite `(AUTHORID, BOOKID)`

### Performance Secondary Indexes:
- `IDX_BOOKS_TITLE` on `BOOKS(TITLE)`
- `IDX_BOOKS_YEAR` on `BOOKS(PUBLICATIONYEAR)`
- `IDX_STUDENT_BRANCH` on `STUDENT(BRANCH)`
- `IDX_BORROW_BORROWDATE` on `BORROW(BORROWDATE)`
- `IDX_BORROW_BOOK_RETURN` on `BORROW(BOOKID, RETURNDATE)`

---

## 🔍 Relational Views

The database defines **5 persistent views** providing abstracted access:

| View Name | Source Definition | Purpose |
| :--- | :--- | :--- |
| `AVAILABLE_BOOKS` | `BOOKS B JOIN PUBLISHER JOIN LIBRARY WHERE NOT EXISTS (SELECT 1 FROM BORROW WHERE RETURNDATE IS NULL)` | Filters only titles currently sitting on shelves available for checkout. |
| `CURRENT_BORROWINGS` | `BORROW BR JOIN STUDENT JOIN BOOKS JOIN LIBRARY WHERE RETURNDATE IS NULL` | Lists ongoing loans with real-time `DAYS_PAST_DUE` calculation. |
| `STUDENT_BORROWING_HISTORY` | `BORROW BR JOIN STUDENT JOIN BOOKS` | Full circulation ledger with status flags: `Returned`, `Overdue`, `Active`. |
| `BOOK_DETAILS` | `BOOKS B LEFT JOIN WRITTEN_BY LEFT JOIN AUTHOR JOIN PUBLISHER JOIN LIBRARY GROUP BY BOOKID` | Aggregates multiple co-authors into a formatted string (`GROUP_CONCAT`). |
| `OVERDUE_BOOKS` | `BORROW BR JOIN STUDENT JOIN BOOKS WHERE RETURNDATE IS NULL AND DUE_DATE < CURDATE()` | Isolates delinquent loans sorted descending by days overdue for penalty tracking. |

---

## ⚙️ Stored Procedures

All stored procedures feature structured error handlers (`SQLEXCEPTION`), automated rollbacks, and validation logic:

1. **`BORROW_BOOK(p_student_id, p_book_id, p_borrow_date, p_due_date, OUT p_result)`**
   - Validates student existence and book availability.
   - Applies row-level lock `FOR UPDATE` on target book record.
   - Enforces `borrow_date <= CURDATE()` and `due_date > borrow_date`.
   - Inserts record into `BORROW` and returns formatted success string with `BORROWID`.

2. **`RETURN_BOOK(p_borrow_id, p_return_date, OUT p_result)`**
   - Locks the loan record `FOR UPDATE`.
   - Validates that the loan exists and has not already been closed (`RETURNDATE IS NOT NULL`).
   - Ensures `return_date >= borrow_date`.
   - Sets `RETURNDATE` and commits transaction.

3. **`GET_STUDENT_BORROW_HISTORY(p_student_id)`**
   - Queries student history, calculating dynamic loan statuses and overdue status.

4. **`GET_BOOKS_BY_LIBRARY(p_library_id)`**
   - Retrieves full catalog inventory for a given branch with co-author aggregation and availability status.

5. **`LIST_ALL_ACTIVE_BORROWINGS()`**
   - Cursor-driven routine reporting active loans, days overdue, and loan counts.

6. **`GENERATE_LIBRARY_STATS()`**
   - Cursor-driven aggregation calculating total books, currently borrowed copies, and available stock per library.

---

## 📐 Stored Functions

1. **`GET_BOOK_AGE(p_book_id INT) RETURNS INT`**
   - Reads `PUBLICATIONYEAR` and computes `YEAR(CURDATE()) - PUBLICATIONYEAR`. Returns `-1` if book is not found.

2. **`GET_STUDENT_BORROW_COUNT(p_student_id INT) RETURNS INT`**
   - Computes total lifetime loans (returned + active) recorded for a given student ID.

3. **`GET_ACTIVE_BORROW_COUNT(p_student_id INT) RETURNS INT`**
   - Counts currently unreturned loans (`RETURNDATE IS NULL`) for a student.

4. **`IS_BOOK_AVAILABLE(p_book_id INT) RETURNS TINYINT`**
   - Returns `1` (Available), `0` (Borrowed), or `-1` (Not Found).

---

## 🛡️ Integrity Triggers

Four database triggers prevent invalid state transitions before write commits:

- **`TRG_BEFORE_INSERT_BORROW`**:
  Rejects future-dated borrow dates (`BORROWDATE > CURDATE()`) and enforces `DUE_DATE > BORROWDATE` with `SIGNAL SQLSTATE '45000'`.
- **`TRG_BEFORE_UPDATE_BORROW`**:
  Guarantees that `BORROWDATE` and `DUE_DATE` cannot be tampered with after initial loan creation. Rejects reopenings of completed returns and invalid return dates.
- **`TRG_BEFORE_INSERT_BOOKS`**:
  Validates that publication year falls within `[1800, YEAR(CURDATE()) + 1]` and prevents blank titles.
- **`TRG_BEFORE_INSERT_STUDENT`**:
  Validates that `STUDENTNAME` is not empty and that `USERID` is at least 5 characters.

---

## 🔄 Cursor Implementations

The system utilizes explicit MySQL cursors (`DECLARE ... CURSOR FOR`, `OPEN`, `FETCH`, `NOT FOUND` handler, `CLOSE`) in [`cursors.sql`](cursors.sql):
- **Cursor 1 (`LIST_ALL_ACTIVE_BORROWINGS`)**: Iterates through active loan tuples, maintains running totals of on-time versus overdue transactions, and returns an itemized report.
- **Cursor 2 (`GENERATE_LIBRARY_STATS`)**: Loops through each campus library entity, performs per-library inventory calculations, and returns an aggregated status summary.

---

## 💻 Frontend Web Platform & Features

The web client is built with **HTML5, Tailwind CSS, Lucide Icons, and Chart.js**:

1. **Dashboard & KPIs**:
   - Live KPI counters (Total Books, Available Copies, Active Borrowings, Overdue Count, Students, Libraries).
   - Category distribution doughnut chart & Library status bar chart.
2. **Books Catalog**:
   - Filter by Category, Library Campus, and Availability Status.
   - Search across Title, Author names, and ISBN numbers.
   - Card Grid and High-Density Table view toggles.
   - Book details modal showing calculated book age.
3. **Circulation Desk**:
   - Issue book modal validating students and available books.
   - Active loans list with quick return buttons and overdue indicators.
   - Return book modal with late fee calculations.
4. **Students Directory**:
   - Search by roll number or branch with semester tags.
   - Full history modal executing `GET_STUDENT_BORROW_HISTORY()`.
5. **Overdue Tracker**:
   - Isolated view of overdue items with days late and reminder action simulator.
6. **DBMS Lab & Dynamic SQL Runner**:
   - 1-click execution for all stored procedures and functions.
   - Live trigger validation tester.
   - Interactive SQL playground pre-loaded with queries from `select.sql` and `views_indexes.sql`.

---

## 🚀 Localhost Running Instructions

### Option 1: 1-Click Startup Script (macOS / Linux)
```bash
./start_server.sh
```

### Option 2: Direct Python Command
```bash
python3 server.py
```

Open your browser and navigate to:
👉 **`http://localhost:8000`**

*Note: The Python backend (`server.py`) uses the Python standard library with zero external pip dependencies. It connects to MySQL or automatically initializes the embedded SQLite database (`library.db`) seeded with all project data.*

---

## ☁️ Vercel Cloud Deployment Guide

The repository includes a production-ready [`vercel.json`](vercel.json) configuration.

### Deploy in 30 Seconds via GitHub:
1. Push this repository to your GitHub account:
   ```bash
   git remote add origin https://github.com/advikjain516-ux/Steller.git
   git branch -M main
   git push -u origin main
   ```
2. Log in to [Vercel](https://vercel.com/new).
3. Select and import the `Steller` repository.
4. Click **Deploy**. Vercel will build and host your application with a public `https://*.vercel.app` URL.

---

## 🧪 Verification & Test Results

The backend has been verified against [`verification queries.sql`](verification%20queries.sql):

```sql
+--------------------------------------------------------------+--------+
| Test                                                         | Result |
+--------------------------------------------------------------+--------+
| Exactly seven required base tables exist                     | PASS   |
| Seeded sample row counts are present (35+ books, 20+ students)| PASS   |
| Seven primary keys are defined                               | PASS   |
| WRITTEN_BY has ordered composite primary key (AUTHORID,BOOKID)| PASS   |
| Six foreign key relationships are defined                    | PASS   |
| All seeded foreign key references resolve                    | PASS   |
| Every seeded book has at least one author                    | PASS   |
| At most one active loan exists per physical book             | PASS   |
| Active-loan generated column and unique key exist            | PASS   |
| Borrow and return date relationships are valid               | PASS   |
| Five expected views exist                                    | PASS   |
| Six expected procedures exist                                | PASS   |
| Four expected stored functions exist                         | PASS   |
| Four expected triggers exist                                 | PASS   |
| Useful secondary indexes exist                               | PASS   |
+--------------------------------------------------------------+--------+
```
