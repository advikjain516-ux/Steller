USE library_management_system;

DROP PROCEDURE IF EXISTS LIST_ALL_ACTIVE_BORROWINGS;
DROP PROCEDURE IF EXISTS GENERATE_LIBRARY_STATS;

-- =============================================================================
-- CURSOR DEMONSTRATION 1: LIST_ALL_ACTIVE_BORROWINGS
-- Iterates through all active borrowing records using a cursor and
-- returns information about each active loan.
--
-- Cursor concepts demonstrated:
--   - DECLARE CURSOR
--   - OPEN CURSOR
--   - FETCH
--   - NOT FOUND handler (for loop termination)
--   - CLOSE CURSOR
-- =============================================================================
DELIMITER //

CREATE PROCEDURE LIST_ALL_ACTIVE_BORROWINGS ()
BEGIN
    -- ---- Variables to hold each fetched row ----
    DECLARE v_borrow_id     INT;
    DECLARE v_student_name  VARCHAR(150);
    DECLARE v_student_branch VARCHAR(50);
    DECLARE v_book_title    VARCHAR(300);
    DECLARE v_borrow_date   DATE;
    DECLARE v_due_date      DATE;
    DECLARE v_days_overdue  INT;

    -- ---- Loop control flag ----
    -- Set to TRUE by the NOT FOUND handler when cursor has no more rows
    DECLARE v_done BOOLEAN DEFAULT FALSE;

    -- ---- Counter for total active loans ----
    DECLARE v_total_active  INT DEFAULT 0;
    DECLARE v_total_overdue INT DEFAULT 0;

    -- ---- Declare the cursor ----
    -- The SELECT must be fully specified at declaration time
    DECLARE active_borrow_cursor CURSOR FOR
        SELECT
            BR.BORROWID,
            S.STUDENTNAME,
            S.BRANCH,
            B.TITLE,
            BR.BORROWDATE,
            BR.DUE_DATE,
            GREATEST(0, DATEDIFF(CURDATE(), BR.DUE_DATE)) AS DaysOverdue
        FROM BORROW BR
        INNER JOIN STUDENT S ON BR.STUDENTID = S.STUDENTID
        INNER JOIN BOOKS   B ON BR.BOOKID    = B.BOOKID
        WHERE BR.RETURNDATE IS NULL
        ORDER BY BR.DUE_DATE ASC;

    -- ---- NOT FOUND handler — must be declared AFTER the cursor ----
    -- When FETCH finds no more rows, it sets v_done = TRUE
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

    -- ---- Open the cursor (runs the SELECT) ----
    OPEN active_borrow_cursor;

    -- Print header information
    SELECT '=== ACTIVE BORROWINGS REPORT ===' AS CursorReport;

    -- ---- Fetch loop ----
    cursor_loop: LOOP
        -- Fetch one row into the declared variables
        FETCH active_borrow_cursor
            INTO v_borrow_id, v_student_name, v_student_branch,
                 v_book_title, v_borrow_date, v_due_date, v_days_overdue;

        -- Exit loop when no more rows
        IF v_done THEN
            LEAVE cursor_loop;
        END IF;

        -- Count totals
        SET v_total_active = v_total_active + 1;
        IF v_days_overdue > 0 THEN
            SET v_total_overdue = v_total_overdue + 1;
        END IF;

        -- Output each record
        SELECT
            v_borrow_id     AS BorrowID,
            v_student_name  AS StudentName,
            v_student_branch AS Branch,
            v_book_title    AS BookTitle,
            v_borrow_date   AS BorrowDate,
            v_due_date      AS DueDate,
            v_days_overdue  AS DaysOverdue,
            IF(v_days_overdue > 0, 'OVERDUE', 'On Time') AS Status;

    END LOOP cursor_loop;

    -- ---- Close the cursor to free resources ----
    CLOSE active_borrow_cursor;

    -- Summary
    SELECT
        v_total_active  AS TotalActiveLoans,
        v_total_overdue AS OverdueLoans,
        (v_total_active - v_total_overdue) AS OnTimeLoans;

END //

DELIMITER ;

-- Test Cursor Demo 1
CALL LIST_ALL_ACTIVE_BORROWINGS();


-- =============================================================================
-- CURSOR DEMONSTRATION 2: GENERATE_LIBRARY_STATS
-- Uses a cursor to iterate through each library and collect statistics:
-- total books, available books, borrowed books.
-- This demonstrates using a cursor to aggregate per-group statistics
-- that would normally be done in a single GROUP BY query.
-- =============================================================================
DELIMITER //

CREATE PROCEDURE GENERATE_LIBRARY_STATS ()
BEGIN
    -- Variables for cursor row
    DECLARE v_library_id    INT;
    DECLARE v_library_name  VARCHAR(200);
    DECLARE v_total_books   INT;
    DECLARE v_borrowed_books INT;
    DECLARE v_available_books INT;

    -- Loop control
    DECLARE v_done BOOLEAN DEFAULT FALSE;

    -- Declare cursor — iterate over libraries
    DECLARE library_cursor CURSOR FOR
        SELECT LIBRARYID, NAME FROM LIBRARY ORDER BY NAME;

    -- NOT FOUND handler
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

    -- Open cursor
    OPEN library_cursor;

    SELECT '=== LIBRARY STATISTICS REPORT ===' AS Report;

    stats_loop: LOOP
        -- Fetch next library
        FETCH library_cursor INTO v_library_id, v_library_name;

        IF v_done THEN
            LEAVE stats_loop;
        END IF;

        -- Count total books in this library
        SELECT COUNT(*)
        INTO v_total_books
        FROM BOOKS
        WHERE LIBRARYID = v_library_id;

        -- Count borrowed books in this library
        SELECT COUNT(*)
        INTO v_borrowed_books
        FROM BOOKS B
        INNER JOIN BORROW BR ON B.BOOKID = BR.BOOKID
        WHERE B.LIBRARYID = v_library_id
          AND BR.RETURNDATE IS NULL;

        -- Calculate available books
        SET v_available_books = v_total_books - v_borrowed_books;

        -- Output statistics for this library
        SELECT
            v_library_id       AS LibraryID,
            v_library_name     AS LibraryName,
            v_total_books      AS TotalBooks,
            v_borrowed_books   AS CurrentlyBorrowed,
            v_available_books  AS Available;

    END LOOP stats_loop;

    -- Close the cursor
    CLOSE library_cursor;

END //

DELIMITER ;

-- Test Cursor Demo 2
CALL GENERATE_LIBRARY_STATS();
