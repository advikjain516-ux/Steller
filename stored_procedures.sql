USE library_management_system;

DROP PROCEDURE IF EXISTS BORROW_BOOK;
DROP PROCEDURE IF EXISTS RETURN_BOOK;
DROP PROCEDURE IF EXISTS GET_STUDENT_BORROW_HISTORY;
DROP PROCEDURE IF EXISTS GET_BOOKS_BY_LIBRARY;

DELIMITER //

CREATE PROCEDURE BORROW_BOOK (
    IN  p_student_id  INT,
    IN  p_book_id     INT,
    IN  p_borrow_date DATE,
    IN  p_due_date    DATE,
    OUT p_result      VARCHAR(300)
)
borrow_main: BEGIN
    DECLARE v_student_exists INT DEFAULT 0;
    DECLARE v_locked_book_id INT DEFAULT NULL;
    DECLARE v_active_count   INT DEFAULT 0;
    DECLARE v_new_borrow_id  INT DEFAULT 0;
    DECLARE v_error_message  VARCHAR(300) DEFAULT '';

    DECLARE CONTINUE HANDLER FOR NOT FOUND
        SET v_locked_book_id = NULL;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1 v_error_message = MESSAGE_TEXT;
        ROLLBACK;
        SET p_result = CONCAT('ERROR: ', LEFT(v_error_message, 240),
                              ' Transaction rolled back.');
    END;

    SET p_result = 'ERROR: Borrowing was not completed.';

    IF p_borrow_date IS NULL OR p_due_date IS NULL
       OR p_borrow_date > CURDATE()
       OR p_due_date <= p_borrow_date THEN
        SET p_result = 'ERROR: Borrow date must not be future-dated and due date must be later.';
        LEAVE borrow_main;
    END IF;

    START TRANSACTION;

    SELECT COUNT(*) INTO v_student_exists
    FROM STUDENT
    WHERE STUDENTID = p_student_id;

    IF v_student_exists = 0 THEN
        ROLLBACK;
        SET p_result = CONCAT('ERROR: Student ID ', p_student_id, ' does not exist.');
        LEAVE borrow_main;
    END IF;

    -- Serializes attempts for this physical copy. The generated unique key
    -- ACTIVE_BOOKID independently enforces one active loan for all write paths.
    SELECT BOOKID INTO v_locked_book_id
    FROM BOOKS
    WHERE BOOKID = p_book_id
    FOR UPDATE;

    IF v_locked_book_id IS NULL THEN
        ROLLBACK;
        SET p_result = CONCAT('ERROR: Book ID ', p_book_id, ' does not exist.');
        LEAVE borrow_main;
    END IF;

    SELECT COUNT(*) INTO v_active_count
    FROM BORROW
    WHERE BOOKID = p_book_id
      AND RETURNDATE IS NULL;

    IF v_active_count > 0 THEN
        ROLLBACK;
        SET p_result = CONCAT('ERROR: Book ID ', p_book_id, ' is currently borrowed.');
        LEAVE borrow_main;
    END IF;

    INSERT INTO BORROW (BORROWDATE, DUE_DATE, RETURNDATE, STUDENTID, BOOKID)
    VALUES (p_borrow_date, p_due_date, NULL, p_student_id, p_book_id);

    SET v_new_borrow_id = LAST_INSERT_ID();
    COMMIT;
    SET p_result = CONCAT('SUCCESS: Book borrowed. BORROWID = ', v_new_borrow_id,
                          '. Due: ', p_due_date);
END borrow_main //

CREATE PROCEDURE RETURN_BOOK (
    IN  p_borrow_id   INT,
    IN  p_return_date DATE,
    OUT p_result      VARCHAR(300)
)
return_main: BEGIN
    DECLARE v_borrow_date  DATE DEFAULT NULL;
    DECLARE v_return_date  DATE DEFAULT NULL;
    DECLARE v_record_found BOOLEAN DEFAULT TRUE;
    DECLARE v_error_message VARCHAR(300) DEFAULT '';

    DECLARE CONTINUE HANDLER FOR NOT FOUND
        SET v_record_found = FALSE;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1 v_error_message = MESSAGE_TEXT;
        ROLLBACK;
        SET p_result = CONCAT('ERROR: ', LEFT(v_error_message, 240),
                              ' Transaction rolled back.');
    END;

    SET p_result = 'ERROR: Return was not completed.';

    IF p_return_date IS NULL THEN
        SET p_result = 'ERROR: Return date is required.';
        LEAVE return_main;
    END IF;

    START TRANSACTION;

    SELECT BORROWDATE, RETURNDATE
    INTO v_borrow_date, v_return_date
    FROM BORROW
    WHERE BORROWID = p_borrow_id
    FOR UPDATE;

    IF NOT v_record_found THEN
        ROLLBACK;
        SET p_result = CONCAT('ERROR: Borrow ID ', p_borrow_id, ' does not exist.');
        LEAVE return_main;
    END IF;

    IF v_return_date IS NOT NULL THEN
        ROLLBACK;
        SET p_result = CONCAT('ERROR: Borrow ID ', p_borrow_id, ' was already returned.');
        LEAVE return_main;
    END IF;

    IF p_return_date < v_borrow_date THEN
        ROLLBACK;
        SET p_result = 'ERROR: Return date cannot be before borrow date.';
        LEAVE return_main;
    END IF;

    UPDATE BORROW
    SET RETURNDATE = p_return_date
    WHERE BORROWID = p_borrow_id;

    COMMIT;
    SET p_result = CONCAT('SUCCESS: Book returned for BORROWID = ',
                          p_borrow_id, ' on ', p_return_date, '.');
END return_main //

CREATE PROCEDURE GET_STUDENT_BORROW_HISTORY (
    IN p_student_id INT
)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM STUDENT WHERE STUDENTID = p_student_id) THEN
        SELECT CONCAT('ERROR: Student ID ', p_student_id, ' not found.') AS Message;
    ELSE
        SELECT
            S.STUDENTNAME,
            S.BRANCH,
            B.TITLE,
            B.CATEGORY,
            BR.BORROWID,
            BR.BORROWDATE,
            BR.DUE_DATE,
            COALESCE(CAST(BR.RETURNDATE AS CHAR), 'Not Returned') AS ReturnDate,
            CASE
                WHEN BR.RETURNDATE IS NOT NULL THEN 'Returned'
                WHEN BR.DUE_DATE < CURDATE() THEN 'OVERDUE'
                ELSE 'Active'
            END AS Status
        FROM BORROW BR
        INNER JOIN STUDENT S ON BR.STUDENTID = S.STUDENTID
        INNER JOIN BOOKS B ON BR.BOOKID = B.BOOKID
        WHERE BR.STUDENTID = p_student_id
        ORDER BY BR.BORROWDATE DESC, BR.BORROWID DESC;
    END IF;
END //

CREATE PROCEDURE GET_BOOKS_BY_LIBRARY (
    IN p_library_id INT
)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM LIBRARY WHERE LIBRARYID = p_library_id) THEN
        SELECT CONCAT('ERROR: Library ID ', p_library_id, ' not found.') AS Message;
    ELSE
        SELECT
            L.NAME AS LibraryName,
            B.BOOKID,
            B.TITLE,
            B.ISBN,
            B.CATEGORY,
            B.PUBLICATIONYEAR,
            COALESCE(GROUP_CONCAT(DISTINCT A.NAME ORDER BY A.NAME SEPARATOR '; '),
                     'No author assigned') AS Authors,
            P.NAME AS Publisher,
            CASE
                WHEN B.BOOKID IN (
                    SELECT BOOKID FROM BORROW WHERE RETURNDATE IS NULL
                ) THEN 'Borrowed'
                ELSE 'Available'
            END AS Status
        FROM BOOKS B
        INNER JOIN LIBRARY L ON B.LIBRARYID = L.LIBRARYID
        INNER JOIN PUBLISHER P ON B.PUBLISHERID = P.PUBLISHERID
        LEFT JOIN WRITTEN_BY WB ON B.BOOKID = WB.BOOKID
        LEFT JOIN AUTHOR A ON WB.AUTHORID = A.AUTHORID
        WHERE B.LIBRARYID = p_library_id
        GROUP BY B.BOOKID, B.TITLE, B.ISBN, B.CATEGORY, B.PUBLICATIONYEAR,
                 L.NAME, P.NAME
        ORDER BY B.TITLE, B.BOOKID;
    END IF;
END //

DELIMITER ;
