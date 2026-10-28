# 📚 Library Management System (DBMS Project)

An enterprise-grade, modern Web Application and Relational Database backend for the **Library Management System** (`library_management_system`).

Built to seamlessly demonstrate all Core DBMS concepts:
- **7 Relational Base Tables** with primary keys, foreign key constraints, check constraints, and composite keys
- **5 Relational Views** (`AVAILABLE_BOOKS`, `CURRENT_BORROWINGS`, `STUDENT_BORROWING_HISTORY`, `BOOK_DETAILS`, `OVERDUE_BOOKS`)
- **6 Stored Procedures** (`BORROW_BOOK`, `RETURN_BOOK`, `GET_STUDENT_BORROW_HISTORY`, `GET_BOOKS_BY_LIBRARY`, `LIST_ALL_ACTIVE_BORROWINGS`, `GENERATE_LIBRARY_STATS`)
- **4 Stored Functions** (`GET_BOOK_AGE`, `GET_STUDENT_BORROW_COUNT`, `GET_ACTIVE_BORROW_COUNT`, `IS_BOOK_AVAILABLE`)
- **4 Database Triggers** enforcing strict domain integrity and concurrency rules
- **Interactive DBMS Evaluation Lab & SQL Console** built right into the frontend!

---

## 🚀 Quick Start (Running the Website)

### Option 1: 1-Click Startup Script (Recommended)
Open your terminal in this folder and run:
```bash
./start_server.sh
```
Or directly with Python:
```bash
python3 server.py
```
Then open your web browser at:
👉 **[http://localhost:8000](http://localhost:8000)**

### Option 2: Standalone Offline Mode (Zero Setup)
If you don't have a terminal open, simply double-click or open:
```
public/index.html
```
in Google Chrome, Safari, Firefox, or Edge. The application includes a self-healing client-side database that loads the full seeded dataset so all features (Search, Issue Book, Return Book, View History, and Procedure simulators) work out of the box!

---

## 🌟 Key Frontend Website Features

### 1. 📊 Executive Dashboard & Analytics
- **Live KPI Badges**: Real-time counters for Total Books, Available Copies, Active Borrowings, Overdue Loans, Students, and Libraries.
- **Overdue Alert Banner**: Automatically flags overdue books with 1-click navigation to circulation desk.
- **Interactive Visualizations (Chart.js)**:
  - **Collection by Category**: Doughnut chart breaking down inventory by domain (Database, AI, Algorithms, Systems, Web, Programming, Software).
  - **Library Inventory Status**: Stacked bar chart showing Available vs. Borrowed copies per campus library.

### 2. 📖 Books Catalog (`BOOK_DETAILS` & `AVAILABLE_BOOKS`)
- **Dual Views**: Seamless toggle between responsive **Grid Cards** and high-density **Data Table**.
- **Live Search & Multi-Filters**: Instant search by Title, Author name, or ISBN; filter by Category, Library branch, or Availability.
- **Book Details & Age Inspection**: Modal inspecting author credits, publisher details, publication year, and live calculated age (`GET_BOOK_AGE`).
- **Add New Book**: Complete dialog with category, publisher, campus library, and multi-author link with trigger range validation.

### 3. 🔄 Circulation & Loans Desk (`BORROW_BOOK` & `RETURN_BOOK`)
- **Issue Book Form**:
  - Enforces `TRG_BEFORE_INSERT_BORROW`: rejects future borrow dates and due dates earlier than borrow date.
  - Enforces `UQ_BORROW_ONE_ACTIVE_BOOK`: prevents issuing a book that is already checked out.
- **Active Loans Table**:
  - Powered by cursor procedure `LIST_ALL_ACTIVE_BORROWINGS()`.
  - Displays borrower student details, issue date, due date, and dynamic overdue counter.
- **Quick Return Action**:
  - Calculates days overdue and estimated overdue fines.
  - Executes `RETURN_BOOK` with validation rejecting return dates earlier than borrow date.

### 4. 🎓 Students Directory & Loan History
- **Searchable Students Registry**: Filter by branch (CSE, IT, AIML, AIDS, ECE) and roll number.
- **Add Student Modal**: Enforces `TRG_BEFORE_INSERT_STUDENT` requiring non-empty name and roll/user ID of at least 5 characters.
- **Student Borrow History Modal**:
  - Executes `GET_STUDENT_BORROW_HISTORY(p_student_id)`.
  - Displays complete historical audit trail with loan status (`Returned`, `Active`, or `OVERDUE`).

### 5. ⚠️ Overdue Tracker (`OVERDUE_BOOKS`)
- Dedicated view of loans requiring immediate attention.
- Displays borrower contact details, days overdue, and simulated overdue reminder dispatch.

### 6. 🧪 Interactive DBMS Evaluation Lab & SQL Console
A dedicated tab designed specifically for lab evaluation and project presentation:
- **Stored Procedures & Functions Runner**: Live controls to test `GET_BOOK_AGE()`, `IS_BOOK_AVAILABLE()`, `GET_STUDENT_BORROW_COUNT()`, and `GENERATE_LIBRARY_STATS()`.
- **Trigger Validation Tester**: 1-click test suite verifying that database triggers block duplicate active loans, future borrow dates, out-of-range publication years, and short user IDs.
- **Dynamic SQL Console**: Pre-loaded with queries from `select.sql`, `subqueries.sql`, and `views_indexes.sql`. Allows writing and executing custom queries with sub-millisecond execution timers and tabular output!

---

## 🗄️ Relational Database Schema Overview

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

### Table Specifications:
1. `LIBRARY` (`LIBRARYID` PK, `NAME`)
2. `PUBLISHER` (`PUBLISHERID` PK, `NAME`, `NATIONALITY`)
3. `AUTHOR` (`AUTHORID` PK, `NAME`, `EMAIL` UNIQUE, `NATIONALITY`)
4. `STUDENT` (`STUDENTID` PK, `USERID` UNIQUE, `STUDENTNAME`, `STUDENTEMAIL` UNIQUE, `STUDENTPHONENUMBER`, `BRANCH`, `SEMESTER`)
5. `BOOKS` (`BOOKID` PK, `TITLE`, `ISBN`, `CATEGORY`, `PUBLICATIONYEAR`, `PUBLISHERID` FK, `LIBRARYID` FK)
6. `BORROW` (`BORROWID` PK, `BORROWDATE`, `DUE_DATE`, `RETURNDATE`, `STUDENTID` FK, `BOOKID` FK, `ACTIVE_BOOKID` GENERATED STORED UNIQUE)
7. `WRITTEN_BY` (`AUTHORID` FK, `BOOKID` FK, COMPOSITE PK `(AUTHORID, BOOKID)`)

---

## 📁 Project File Structure

```
dbms project/
├── public/                       # Frontend Web Application
│   ├── index.html                # Single Page Dashboard & UI
│   ├── css/
│   │   └── style.css             # Tailored UI styles, glassmorphism, animations
│   ├── js/
│   │   ├── api.js                # API Client + Standalone Client DB Fallback
│   │   ├── app.js                # Main Coordinator, Navigation, Modals & Toasts
│   │   ├── books.js              # Catalog Controller (Grid/Table view, Filters)
│   │   ├── circulation.js        # Circulation Desk (Issue & Return Book)
│   │   ├── students.js           # Students Directory & Borrow History
│   │   ├── dbms_lab.js           # Interactive Stored Procedures & SQL Console
│   │   └── charts.js             # Chart.js Visualizations (Category & Library)
│   └── data/
│       └── seed_data.json        # Pre-seeded JSON dataset for offline mode
│
├── server.py                     # Python Backend REST Server & SQLite/MySQL bridge
├── start_server.sh               # 1-Click Startup script
├── library.db                    # Pre-initialized & verified SQLite database
│
├── create_databases.sql          # Creates `library_management_system`
├── create_tables.sql             # Full DDL for 7 tables, constraints & seed dataset
├── views_indexes.sql             # 5 Relational Views and secondary indexes
├── stored_procedures.sql         # Stored Procedures (BORROW_BOOK, RETURN_BOOK, etc.)
├── stored_fucntions.sql          # Stored Functions (GET_BOOK_AGE, etc.)
├── TRIGGERS.sql                  # Before Insert / Update Triggers
├── cursors.sql                   # Cursors for active borrowings & library stats
├── ddl_dml.sql                   # Sample DDL & DML operations
├── select.sql                    # 39 SQL Queries (Aggregates, Group By, Having, Joins)
├── subqueries.sql                # Subqueries and Advanced Joins
├── trigger_tests.sql             # Automated Trigger verification tests
└── verification queries.sql      # Formal compliance verification queries
```

---

## 👨‍💻 Evaluation Checklist (All PASS)
- [x] Exactly 7 base tables with primary and foreign key constraints
- [x] Seed row counts exceed all verification requirements (32 authors, 8 publishers, 3 libraries, 22 students, 37 books, 42 borrows, 50 written_by links)
- [x] All 5 SQL views operational
- [x] All 6 Stored Procedures executable
- [x] All 4 Stored Functions testable
- [x] All 4 Triggers validated and blocking invalid transactions
- [x] Modern, responsive web interface accessible via browser
