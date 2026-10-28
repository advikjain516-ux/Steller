/**
 * Library Management System - API Client
 * Automatically connects to backend REST server.
 * Fallback to in-browser storage if server is offline or opened via file://
 */

const API = (() => {
  let isServerConnected = false;
  let localDb = null;

  async function checkServer() {
    try {
      const baseUrl = window.location.protocol === 'file:' ? 'http://localhost:8000' : '';
      const res = await fetch(`${baseUrl}/api/health`, { method: 'GET', headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        isServerConnected = true;
        console.log("Connected to Python backend REST server.");
        return true;
      }
    } catch (e) {
      // Server not reachable
    }
    isServerConnected = false;
    console.warn("Backend server not detected. Operating in standalone client mode.");
    await initLocalFallback();
    return false;
  }

  async function initLocalFallback() {
    if (localDb) return;
    const stored = localStorage.getItem("LMS_LOCAL_DB");
    if (stored) {
      try {
        localDb = JSON.parse(stored);
        return;
      } catch (e) {}
    }
    try {
      const res = await fetch('data/seed_data.json');
      if (res.ok) {
        localDb = await res.json();
        saveLocal();
        return;
      }
    } catch (e) {}
    // Minimal fallback if seed file fails
    localDb = {
      BOOKS: [],
      STUDENT: [],
      AUTHOR: [],
      PUBLISHER: [],
      LIBRARY: [],
      BORROW: [],
      WRITTEN_BY: []
    };
  }

  function saveLocal() {
    if (localDb) {
      localStorage.setItem("LMS_LOCAL_DB", JSON.stringify(localDb));
    }
  }

  function getBaseUrl() {
    return window.location.protocol === 'file:' ? 'http://localhost:8000' : '';
  }

  // --- Core API Methods ---
  return {
    isServer: () => isServerConnected,
    init: checkServer,

    // 1. Stats
    async getStats() {
      if (isServerConnected) {
        const res = await fetch(`${getBaseUrl()}/api/stats`);
        return await res.json();
      }

      // Standalone Fallback calculation
      await initLocalFallback();
      const totalBooks = localDb.BOOKS.length;
      const activeBorrows = localDb.BORROW.filter(b => !b.RETURNDATE);
      const activeCount = activeBorrows.length;
      const today = new Date().toISOString().split('T')[0];
      const overdueCount = activeBorrows.filter(b => b.DUE_DATE < today).length;

      // Category breakdown
      const catMap = {};
      localDb.BOOKS.forEach(b => {
        catMap[b.CATEGORY] = (catMap[b.CATEGORY] || 0) + 1;
      });
      const category_distribution = Object.keys(catMap).map(k => ({ CATEGORY: k, count: catMap[k] }));

      // Library breakdown
      const library_stats = localDb.LIBRARY.map(l => {
        const booksInLib = localDb.BOOKS.filter(b => b.LIBRARYID === l.LIBRARYID);
        const borrowed = booksInLib.filter(b => activeBorrows.some(ab => ab.BOOKID === b.BOOKID)).length;
        return {
          library_name: l.NAME,
          total: booksInLib.length,
          borrowed: borrowed,
          available: booksInLib.length - borrowed
        };
      });

      return {
        total_books: totalBooks,
        available_books: totalBooks - activeCount,
        active_loans: activeCount,
        overdue_loans: overdueCount,
        total_students: localDb.STUDENT.length,
        total_authors: localDb.AUTHOR.length,
        total_publishers: localDb.PUBLISHER.length,
        total_libraries: localDb.LIBRARY.length,
        category_distribution,
        library_stats
      };
    },

    // 2. Books
    async getBooks(filters = {}) {
      if (isServerConnected) {
        const params = new URLSearchParams();
        if (filters.q) params.set('q', filters.q);
        if (filters.category) params.set('category', filters.category);
        if (filters.status) params.set('status', filters.status);
        if (filters.library_id) params.set('library_id', filters.library_id);
        const res = await fetch(`${getBaseUrl()}/api/books?${params.toString()}`);
        return await res.json();
      }

      // Standalone Fallback
      await initLocalFallback();
      const activeBookIds = new Set(localDb.BORROW.filter(b => !b.RETURNDATE).map(b => b.BOOKID));
      const currentYear = new Date().getFullYear();

      let results = localDb.BOOKS.map(b => {
        const pub = localDb.PUBLISHER.find(p => p.PUBLISHERID === b.PUBLISHERID) || { NAME: 'Unknown' };
        const lib = localDb.LIBRARY.find(l => l.LIBRARYID === b.LIBRARYID) || { NAME: 'Unknown' };
        const authorLinks = localDb.WRITTEN_BY.filter(wb => wb.BOOKID === b.BOOKID);
        const authors = authorLinks.map(wb => {
          const a = localDb.AUTHOR.find(auth => auth.AUTHORID === wb.AUTHORID);
          return a ? a.NAME : null;
        }).filter(Boolean).join(', ') || 'No author';

        const isBorrowed = activeBookIds.has(b.BOOKID);
        return {
          BOOKID: b.BOOKID,
          TITLE: b.TITLE,
          ISBN: b.ISBN,
          CATEGORY: b.CATEGORY,
          PUBLICATIONYEAR: b.PUBLICATIONYEAR,
          PUBLISHERID: b.PUBLISHERID,
          PUBLISHER: pub.NAME,
          LIBRARYID: b.LIBRARYID,
          LIBRARY: lib.NAME,
          AUTHORS: authors,
          STATUS: isBorrowed ? 'Borrowed' : 'Available',
          AGE: currentYear - b.PUBLICATIONYEAR
        };
      });

      if (filters.category) results = results.filter(b => b.CATEGORY === filters.category);
      if (filters.library_id) results = results.filter(b => String(b.LIBRARYID) === String(filters.library_id));
      if (filters.status) results = results.filter(b => b.STATUS === filters.status);
      if (filters.q) {
        const q = filters.q.toLowerCase();
        results = results.filter(b => b.TITLE.toLowerCase().includes(q) || b.AUTHORS.toLowerCase().includes(q) || (b.ISBN && b.ISBN.toLowerCase().includes(q)));
      }
      return results;
    },

    // 3. Add Book
    async addBook(bookData) {
      if (isServerConnected) {
        const res = await fetch(`${getBaseUrl()}/api/books`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookData)
        });
        return await res.json();
      }

      await initLocalFallback();
      const currentYear = new Date().getFullYear();
      if (!bookData.title || !bookData.title.trim()) {
        return { success: false, message: "TRG_BEFORE_INSERT_BOOKS: BOOKS.TITLE cannot be blank." };
      }
      if (bookData.publication_year < 1800 || bookData.publication_year > currentYear + 1) {
        return { success: false, message: "TRG_BEFORE_INSERT_BOOKS: PUBLICATIONYEAR must be between 1800 and next year." };
      }

      const nextId = Math.max(0, ...localDb.BOOKS.map(b => b.BOOKID)) + 1;
      const newBook = {
        BOOKID: nextId,
        TITLE: bookData.title.trim(),
        ISBN: bookData.isbn || null,
        CATEGORY: bookData.category,
        PUBLICATIONYEAR: parseInt(bookData.publication_year),
        PUBLISHERID: parseInt(bookData.publisher_id),
        LIBRARYID: parseInt(bookData.library_id)
      };
      localDb.BOOKS.push(newBook);
      if (bookData.author_ids && Array.isArray(bookData.author_ids)) {
        bookData.author_ids.forEach(aId => {
          localDb.WRITTEN_BY.push({ AUTHORID: parseInt(aId), BOOKID: nextId });
        });
      }
      saveLocal();
      return { success: true, book_id: nextId, message: "Book added successfully." };
    },

    // 4. Students
    async getStudents() {
      if (isServerConnected) {
        const res = await fetch(`${getBaseUrl()}/api/students`);
        return await res.json();
      }

      await initLocalFallback();
      return localDb.STUDENT.map(s => {
        const borrows = localDb.BORROW.filter(b => b.STUDENTID === s.STUDENTID);
        const active = borrows.filter(b => !b.RETURNDATE).length;
        return {
          STUDENTID: s.STUDENTID,
          USERID: s.USERID,
          STUDENTNAME: s.STUDENTNAME,
          STUDENTEMAIL: s.STUDENTEMAIL,
          STUDENTPHONENUMBER: s.STUDENTPHONENUMBER,
          BRANCH: s.BRANCH,
          SEMESTER: s.SEMESTER,
          TOTAL_BORROWS: borrows.length,
          ACTIVE_LOANS: active
        };
      });
    },

    // 5. Add Student
    async addStudent(studentData) {
      if (isServerConnected) {
        const res = await fetch(`${getBaseUrl()}/api/students`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(studentData)
        });
        return await res.json();
      }

      await initLocalFallback();
      if (!studentData.name || !studentData.name.trim()) {
        return { success: false, message: "TRG_BEFORE_INSERT_STUDENT: STUDENTNAME cannot be blank." };
      }
      if (!studentData.userid || studentData.userid.trim().length < 5) {
        return { success: false, message: "TRG_BEFORE_INSERT_STUDENT: USERID must be at least five characters long." };
      }

      const nextId = Math.max(0, ...localDb.STUDENT.map(s => s.STUDENTID)) + 1;
      const newStudent = {
        STUDENTID: nextId,
        USERID: studentData.userid.trim(),
        STUDENTNAME: studentData.name.trim(),
        STUDENTEMAIL: studentData.email.trim(),
        STUDENTPHONENUMBER: studentData.phone || '',
        BRANCH: studentData.branch,
        SEMESTER: parseInt(studentData.semester) || 1
      };
      localDb.STUDENT.push(newStudent);
      saveLocal();
      return { success: true, student_id: nextId, message: "Student created successfully." };
    },

    // 6. Student History (GET_STUDENT_BORROW_HISTORY)
    async getStudentHistory(studentId) {
      if (isServerConnected) {
        const res = await fetch(`${getBaseUrl()}/api/students/${studentId}/history`);
        return await res.json();
      }

      await initLocalFallback();
      const sId = parseInt(studentId);
      const borrows = localDb.BORROW.filter(b => b.STUDENTID === sId);
      const today = new Date().toISOString().split('T')[0];

      return borrows.map(br => {
        const book = localDb.BOOKS.find(b => b.BOOKID === br.BOOKID) || { TITLE: 'Unknown', CATEGORY: 'Unknown' };
        let status = 'Active';
        if (br.RETURNDATE) status = 'Returned';
        else if (br.DUE_DATE < today) status = 'OVERDUE';

        const daysOverdue = br.DUE_DATE < today && !br.RETURNDATE 
          ? Math.floor((new Date() - new Date(br.DUE_DATE)) / (1000 * 60 * 60 * 24)) 
          : 0;

        return {
          BORROWID: br.BORROWID,
          BOOKID: br.BOOKID,
          TITLE: book.TITLE,
          CATEGORY: book.CATEGORY,
          BORROWDATE: br.BORROWDATE,
          DUE_DATE: br.DUE_DATE,
          RETURNDATE: br.RETURNDATE || 'Not Returned',
          STATUS: status,
          DAYS_OVERDUE: daysOverdue
        };
      }).sort((a, b) => b.BORROWID - a.BORROWID);
    },

    // 7. Active Borrowings (LIST_ALL_ACTIVE_BORROWINGS)
    async getActiveBorrowings() {
      if (isServerConnected) {
        const res = await fetch(`${getBaseUrl()}/api/borrowings/active`);
        return await res.json();
      }

      await initLocalFallback();
      const today = new Date().toISOString().split('T')[0];
      return localDb.BORROW.filter(b => !b.RETURNDATE).map(br => {
        const student = localDb.STUDENT.find(s => s.STUDENTID === br.STUDENTID) || {};
        const book = localDb.BOOKS.find(b => b.BOOKID === br.BOOKID) || {};
        const lib = localDb.LIBRARY.find(l => l.LIBRARYID === book.LIBRARYID) || {};
        const isOverdue = br.DUE_DATE < today;
        const daysOverdue = isOverdue ? Math.floor((new Date() - new Date(br.DUE_DATE)) / (1000 * 60 * 60 * 24)) : 0;

        return {
          BORROWID: br.BORROWID,
          STUDENTID: br.STUDENTID,
          STUDENTNAME: student.STUDENTNAME || 'Unknown',
          STUDENTEMAIL: student.STUDENTEMAIL || '',
          BRANCH: student.BRANCH || '',
          BOOKID: br.BOOKID,
          TITLE: book.TITLE || 'Unknown',
          LIBRARY: lib.NAME || 'Main',
          BORROWDATE: br.BORROWDATE,
          DUE_DATE: br.DUE_DATE,
          DAYS_OVERDUE: daysOverdue,
          STATUS: isOverdue ? 'OVERDUE' : 'On Time'
        };
      }).sort((a, b) => (a.DUE_DATE > b.DUE_DATE ? 1 : -1));
    },

    // 8. Overdue Books (OVERDUE_BOOKS View)
    async getOverdueBooks() {
      if (isServerConnected) {
        const res = await fetch(`${getBaseUrl()}/api/borrowings/overdue`);
        return await res.json();
      }

      const active = await this.getActiveBorrowings();
      return active.filter(b => b.DAYS_OVERDUE > 0).sort((a, b) => b.DAYS_OVERDUE - a.DAYS_OVERDUE);
    },

    // 9. Borrow Book Procedure (BORROW_BOOK)
    async borrowBook(payload) {
      if (isServerConnected) {
        const res = await fetch(`${getBaseUrl()}/api/borrow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        return await res.json();
      }

      await initLocalFallback();
      const sId = parseInt(payload.student_id);
      const bId = parseInt(payload.book_id);
      const borrowDate = payload.borrow_date || new Date().toISOString().split('T')[0];
      const dueDate = payload.due_date;

      const today = new Date().toISOString().split('T')[0];
      if (borrowDate > today) {
        return { success: false, message: "ERROR: Borrow date must not be future-dated." };
      }
      if (dueDate <= borrowDate) {
        return { success: false, message: "ERROR: Due date must be later than borrow date." };
      }
      if (!localDb.STUDENT.some(s => s.STUDENTID === sId)) {
        return { success: false, message: `ERROR: Student ID ${sId} does not exist.` };
      }
      if (!localDb.BOOKS.some(b => b.BOOKID === bId)) {
        return { success: false, message: `ERROR: Book ID ${bId} does not exist.` };
      }
      if (localDb.BORROW.some(br => br.BOOKID === bId && !br.RETURNDATE)) {
        return { success: false, message: `ERROR: Book ID ${bId} is currently borrowed.` };
      }

      const nextId = Math.max(0, ...localDb.BORROW.map(b => b.BORROWID)) + 1;
      localDb.BORROW.push({
        BORROWID: nextId,
        BORROWDATE: borrowDate,
        DUE_DATE: dueDate,
        RETURNDATE: null,
        STUDENTID: sId,
        BOOKID: bId
      });
      saveLocal();

      return {
        success: true,
        message: `SUCCESS: Book borrowed. BORROWID = ${nextId}. Due: ${dueDate}`,
        borrow_id: nextId
      };
    },

    // 10. Return Book Procedure (RETURN_BOOK)
    async returnBook(payload) {
      if (isServerConnected) {
        const res = await fetch(`${getBaseUrl()}/api/return`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        return await res.json();
      }

      await initLocalFallback();
      const borrowId = parseInt(payload.borrow_id);
      const returnDate = payload.return_date || new Date().toISOString().split('T')[0];

      const record = localDb.BORROW.find(b => b.BORROWID === borrowId);
      if (!record) {
        return { success: false, message: `ERROR: Borrow ID ${borrowId} does not exist.` };
      }
      if (record.RETURNDATE) {
        return { success: false, message: `ERROR: Borrow ID ${borrowId} was already returned.` };
      }
      if (returnDate < record.BORROWDATE) {
        return { success: false, message: "ERROR: Return date cannot be before borrow date." };
      }

      record.RETURNDATE = returnDate;
      saveLocal();

      return {
        success: true,
        message: `SUCCESS: Book returned for BORROWID = ${borrowId} on ${returnDate}.`
      };
    },

    // 11. Libraries, Authors, Publishers
    async getLibraries() {
      if (isServerConnected) {
        const res = await fetch(`${getBaseUrl()}/api/libraries`);
        return await res.json();
      }
      await initLocalFallback();
      return localDb.LIBRARY.map(l => ({
        LIBRARYID: l.LIBRARYID,
        NAME: l.NAME,
        TOTAL_BOOKS: localDb.BOOKS.filter(b => b.LIBRARYID === l.LIBRARYID).length
      }));
    },

    async getAuthors() {
      if (isServerConnected) {
        const res = await fetch(`${getBaseUrl()}/api/authors`);
        return await res.json();
      }
      await initLocalFallback();
      return localDb.AUTHOR.map(a => ({
        AUTHORID: a.AUTHORID,
        NAME: a.NAME,
        EMAIL: a.EMAIL,
        NATIONALITY: a.NATIONALITY,
        BOOKS_COUNT: localDb.WRITTEN_BY.filter(wb => wb.AUTHORID === a.AUTHORID).length
      }));
    },

    async getPublishers() {
      if (isServerConnected) {
        const res = await fetch(`${getBaseUrl()}/api/publishers`);
        return await res.json();
      }
      await initLocalFallback();
      return localDb.PUBLISHER.map(p => ({
        PUBLISHERID: p.PUBLISHERID,
        NAME: p.NAME,
        NATIONALITY: p.NATIONALITY,
        BOOKS_COUNT: localDb.BOOKS.filter(b => b.PUBLISHERID === p.PUBLISHERID).length
      }));
    },

    // 12. Run Stored Procedure / Function
    async runProcedure(procedureName, params = {}) {
      if (isServerConnected) {
        const res = await fetch(`${getBaseUrl()}/api/procedures/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ procedure: procedureName, params })
        });
        return await res.json();
      }

      // Standalone simulation of functions & procedures
      await initLocalFallback();
      const currentYear = new Date().getFullYear();

      if (procedureName === "GET_BOOK_AGE") {
        const book = localDb.BOOKS.find(b => b.BOOKID === parseInt(params.book_id));
        return {
          procedure: procedureName,
          input: params.book_id,
          result: book ? currentYear - book.PUBLICATIONYEAR : -1
        };
      }
      if (procedureName === "GET_STUDENT_BORROW_COUNT") {
        const sId = parseInt(params.student_id);
        const count = localDb.BORROW.filter(b => b.STUDENTID === sId).length;
        return { procedure: procedureName, input: sId, result: count };
      }
      if (procedureName === "GET_ACTIVE_BORROW_COUNT") {
        const sId = parseInt(params.student_id);
        const count = localDb.BORROW.filter(b => b.STUDENTID === sId && !b.RETURNDATE).length;
        return { procedure: procedureName, input: sId, result: count };
      }
      if (procedureName === "IS_BOOK_AVAILABLE") {
        const bId = parseInt(params.book_id);
        const exists = localDb.BOOKS.some(b => b.BOOKID === bId);
        if (!exists) return { procedure: procedureName, input: bId, result: -1, status: "Not Found" };
        const isBorrowed = localDb.BORROW.some(b => b.BOOKID === bId && !b.RETURNDATE);
        return { procedure: procedureName, input: bId, result: isBorrowed ? 0 : 1, status: isBorrowed ? "Borrowed" : "Available" };
      }
      if (procedureName === "GENERATE_LIBRARY_STATS") {
        const stats = localDb.LIBRARY.map(l => {
          const total = localDb.BOOKS.filter(b => b.LIBRARYID === l.LIBRARYID).length;
          const borrowed = localDb.BOOKS.filter(b => b.LIBRARYID === l.LIBRARYID && localDb.BORROW.some(br => br.BOOKID === b.BOOKID && !br.RETURNDATE)).length;
          return {
            LibraryID: l.LIBRARYID,
            LibraryName: l.NAME,
            TotalBooks: total,
            CurrentlyBorrowed: borrowed,
            Available: total - borrowed
          };
        });
        return { procedure: procedureName, results: stats };
      }

      return { success: false, message: "Procedure simulation not implemented in offline mode." };
    },

    // 13. Interactive SQL Runner
    async runQuery(sql) {
      if (isServerConnected) {
        const res = await fetch(`${getBaseUrl()}/api/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql })
        });
        return await res.json();
      }

      return {
        success: false,
        message: "Live SQL query execution requires running the server (`python3 server.py`). Please start the backend server to execute dynamic queries against the database."
      };
    }
  };
})();
