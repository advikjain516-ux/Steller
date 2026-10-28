USE library_management_system;

DROP FUNCTION IF EXISTS GET_BOOK_AGE;
DROP FUNCTION IF EXISTS GET_STUDENT_BORROW_COUNT;
DROP FUNCTION IF EXISTS GET_ACTIVE_BORROW_COUNT;
DROP FUNCTION IF EXISTS IS_BOOK_AVAILABLE;

-- =============================================================================
-- FUNCTION 1: GET_BOOK_AGE
-- Calculates the approximate age of a book in years based on its
-- publication year. Returns -1 if the book ID does not exist.
-- INPUTS:  p_book_id INT
-- RETURNS: INT (age in years)
-- READS SQL DATA: this function reads from BOOKS table
-- NOT DETERMINISTIC: result changes each year
-- =============================================================================
DELIMITER //

CREATE FUNCTION GET_BOOK_AGE (
    p_book_id INT
)
RETURNS INT
READS SQL DATA
NOT DETERMINISTIC
COMMENT 'Returns the age of a book (years since publication). Returns -1 if not found.'
BEGIN
    DECLARE v_pub_year  SMALLINT;
    DECLARE v_age       INT;

    SELECT PUBLICATIONYEAR INTO v_pub_year
    FROM BOOKS
    WHERE BOOKID = p_book_id
    LIMIT 1;

    -- If no book found, PUBLICATIONYEAR will be NULL
    IF v_pub_year IS NULL THEN
        RETURN -1;
    END IF;

    SET v_age = YEAR(CURDATE()) - v_pub_year;
    RETURN v_age;
END //

DELIMITER ;

-- Test GET_BOOK_AGE
SELECT
    BOOKID,
    TITLE,
    PUBLICATIONYEAR,
    GET_BOOK_AGE(BOOKID) AS AgeInYears
FROM BOOKS
ORDER BY AgeInYears DESC
LIMIT 10;

-- Test with invalid book ID
SELECT GET_BOOK_AGE(9999) AS ResultForInvalidBook;


-- =============================================================================
-- FUNCTION 2: GET_STUDENT_BORROW_COUNT
-- Returns the total number of borrowing transactions (all time, including
-- returned books) for a given student.
-- Returns 0 if student has no borrowings or does not exist.
-- INPUTS:  p_student_id INT
-- RETURNS: INT
-- =============================================================================
DELIMITER //

CREATE FUNCTION GET_STUDENT_BORROW_COUNT (
    p_student_id INT
)
RETURNS INT
READS SQL DATA
NOT DETERMINISTIC
COMMENT 'Returns total borrow count (active + historical) for a student.'
BEGIN
    DECLARE v_count INT DEFAULT 0;

    SELECT COUNT(*) INTO v_count
    FROM BORROW
    WHERE STUDENTID = p_student_id;

    RETURN v_count;
END //

DELIMITER ;

-- Test GET_STUDENT_BORROW_COUNT
SELECT
    S.STUDENTID,
    S.STUDENTNAME,
    S.BRANCH,
    GET_STUDENT_BORROW_COUNT(S.STUDENTID) AS TotalBorrowings
FROM STUDENT S
ORDER BY TotalBorrowings DESC;

-- For a specific student
SELECT GET_STUDENT_BORROW_COUNT(1) AS Student1_TotalBorrowings;


-- =============================================================================
-- FUNCTION 3: GET_ACTIVE_BORROW_COUNT
-- Returns the number of CURRENTLY active (unreturned) loans for a student.
-- Returns 0 if no active loans or student does not exist.
-- INPUTS:  p_student_id INT
-- RETURNS: INT
-- =============================================================================
DELIMITER //

CREATE FUNCTION GET_ACTIVE_BORROW_COUNT (
    p_student_id INT
)
RETURNS INT
READS SQL DATA
NOT DETERMINISTIC
COMMENT 'Returns number of currently active (unreturned) loans for a student.'
BEGIN
    DECLARE v_count INT DEFAULT 0;

    SELECT COUNT(*) INTO v_count
    FROM BORROW
    WHERE STUDENTID = p_student_id
      AND RETURNDATE IS NULL;

    RETURN v_count;
END //

DELIMITER ;

-- Test GET_ACTIVE_BORROW_COUNT
SELECT
    S.STUDENTID,
    S.STUDENTNAME,
    GET_ACTIVE_BORROW_COUNT(S.STUDENTID) AS ActiveLoans,
    GET_STUDENT_BORROW_COUNT(S.STUDENTID) AS TotalLoans
FROM STUDENT S
WHERE GET_ACTIVE_BORROW_COUNT(S.STUDENTID) > 0
ORDER BY ActiveLoans DESC;


-- =============================================================================
-- FUNCTION 4: IS_BOOK_AVAILABLE
-- Returns 1 (TRUE) if the book is currently available, 0 (FALSE) if borrowed.
-- Returns -1 if the book ID does not exist.
-- INPUTS:  p_book_id INT
-- RETURNS: TINYINT  (1=Available, 0=Borrowed, -1=Not Found)
-- =============================================================================
DELIMITER //

CREATE FUNCTION IS_BOOK_AVAILABLE (
    p_book_id INT
)
RETURNS TINYINT
READS SQL DATA
NOT DETERMINISTIC
COMMENT 'Returns 1 if book is available, 0 if borrowed, -1 if book ID not found.'
BEGIN
    DECLARE v_book_exists   INT DEFAULT 0;
    DECLARE v_active_loans  INT DEFAULT 0;

    -- Check book exists
    SELECT COUNT(*) INTO v_book_exists FROM BOOKS WHERE BOOKID = p_book_id;

    IF v_book_exists = 0 THEN
        RETURN -1;
    END IF;

    -- Check for active loan
    SELECT COUNT(*) INTO v_active_loans
    FROM BORROW
    WHERE BOOKID = p_book_id AND RETURNDATE IS NULL;

    IF v_active_loans > 0 THEN
        RETURN 0;  -- Borrowed
    ELSE
        RETURN 1;  -- Available
    END IF;
END //

DELIMITER ;

-- Test IS_BOOK_AVAILABLE
SELECT
    B.BOOKID,
    B.TITLE,
    IS_BOOK_AVAILABLE(B.BOOKID) AS IsAvailable,
    CASE IS_BOOK_AVAILABLE(B.BOOKID)
        WHEN  1 THEN 'Available'
        WHEN  0 THEN 'Currently Borrowed'
        WHEN -1 THEN 'Book Not Found'
    END AS AvailabilityText
FROM BOOKS B
ORDER BY IsAvailable DESC, B.TITLE
LIMIT 15;
