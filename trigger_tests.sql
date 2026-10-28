USE library_management_system;

DROP PROCEDURE IF EXISTS RUN_TRIGGER_VALIDATION_TESTS;

DELIMITER //

CREATE PROCEDURE RUN_TRIGGER_VALIDATION_TESTS ()
test_main: BEGIN
    DECLARE v_active_seed INT DEFAULT 0;
    DECLARE v_duplicate_rejected BOOLEAN DEFAULT FALSE;
    DECLARE v_bad_return_rejected BOOLEAN DEFAULT FALSE;
    DECLARE v_bad_year_rejected BOOLEAN DEFAULT FALSE;
    DECLARE v_blank_name_rejected BOOLEAN DEFAULT FALSE;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SELECT 'FAIL: Trigger test setup or execution raised an unexpected SQL error.' AS Result;
    END;

    SELECT COUNT(*) INTO v_active_seed
    FROM BORROW
    WHERE BORROWID = 26
      AND BOOKID = 2
      AND RETURNDATE IS NULL;

    IF v_active_seed = 0 THEN
        SELECT 'SKIP: Expected seed loan BORROWID 26 / BOOKID 2 was not found.' AS Result;
        LEAVE test_main;
    END IF;

    START TRANSACTION;

    -- The generated-column unique key must reject another active loan for BOOKID 2.
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
            SET v_duplicate_rejected = TRUE;

        INSERT INTO BORROW (BORROWDATE, DUE_DATE, RETURNDATE, STUDENTID, BOOKID)
        VALUES (CURDATE(), DATE_ADD(CURDATE(), INTERVAL 14 DAY), NULL, 2, 2);

    END;

    -- A return date before the seeded loan's borrow date must be rejected.
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
            SET v_bad_return_rejected = TRUE;

        UPDATE BORROW
        SET RETURNDATE = DATE_SUB(CURDATE(), INTERVAL 11 DAY)
        WHERE BORROWID = 26;
    END;

    -- Invalid publication year and blank student name are trigger rejections.
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
            SET v_bad_year_rejected = TRUE;

        INSERT INTO BOOKS
            (TITLE, CATEGORY, PUBLICATIONYEAR, PUBLISHERID, LIBRARYID)
        VALUES ('Trigger Test Invalid Year', 'Test', YEAR(CURDATE()) + 2, 1, 1);
    END;

    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
            SET v_blank_name_rejected = TRUE;

        INSERT INTO STUDENT
            (USERID, STUDENTNAME, STUDENTEMAIL, STUDENTPHONENUMBER, BRANCH, SEMESTER)
        VALUES
            (CONCAT('TT', REPLACE(UUID(), '-', '')), '',
             CONCAT(REPLACE(UUID(), '-', ''), '@example.invalid'),
             '9000000099', 'CSE', 1);
    END;

    SELECT 'Duplicate active loan rejected by unique key' AS Test,
           IF(v_duplicate_rejected, 'PASS', 'FAIL') AS Result
    UNION ALL
    SELECT 'Return date before borrow date rejected',
           IF(v_bad_return_rejected, 'PASS', 'FAIL')
    UNION ALL
    SELECT 'Unrealistic publication year rejected',
           IF(v_bad_year_rejected, 'PASS', 'FAIL')
    UNION ALL
    SELECT 'Blank student name rejected',
           IF(v_blank_name_rejected, 'PASS', 'FAIL');

    ROLLBACK;
END test_main //

DELIMITER ;

CALL RUN_TRIGGER_VALIDATION_TESTS();
DROP PROCEDURE RUN_TRIGGER_VALIDATION_TESTS;
