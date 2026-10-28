/**
 * Library Management System - Interactive DBMS Lab
 * Stored Procedures, Stored Functions, Trigger Validation & SQL Console
 */

const DbmsLabModule = (() => {
  const PRELOADED_QUERIES = [
    {
      title: "View 1: AVAILABLE_BOOKS",
      sql: "SELECT * FROM AVAILABLE_BOOKS ORDER BY TITLE LIMIT 10;"
    },
    {
      title: "View 2: CURRENT_BORROWINGS",
      sql: "SELECT * FROM CURRENT_BORROWINGS LIMIT 10;"
    },
    {
      title: "View 4: BOOK_DETAILS (Group Concat Authors)",
      sql: "SELECT * FROM BOOK_DETAILS ORDER BY TITLE LIMIT 10;"
    },
    {
      title: "View 5: OVERDUE_BOOKS",
      sql: "SELECT * FROM OVERDUE_BOOKS ORDER BY DAYS_OVERDUE DESC;"
    },
    {
      title: "Q24: Books Count in each Library (GROUP BY)",
      sql: "SELECT L.NAME, COUNT(B.BOOKID) AS total_books\nFROM LIBRARY L\nJOIN BOOKS B ON L.LIBRARYID = B.LIBRARYID\nGROUP BY L.LIBRARYID, L.NAME;"
    },
    {
      title: "Q28: Students with > 1 Borrowing (HAVING)",
      sql: "SELECT S.STUDENTID, S.STUDENTNAME, COUNT(BR.BORROWID) AS times_borrowed\nFROM STUDENT S\nJOIN BORROW BR ON S.STUDENTID = BR.STUDENTID\nGROUP BY S.STUDENTID, S.STUDENTNAME\nHAVING COUNT(BR.BORROWID) > 1;"
    },
    {
      title: "J3: Books with Authors (INNER JOIN via WRITTEN_BY)",
      sql: "SELECT B.BOOKID, B.TITLE, A.NAME AS author\nFROM BOOKS B\nINNER JOIN WRITTEN_BY WB ON B.BOOKID = WB.BOOKID\nINNER JOIN AUTHOR A ON WB.AUTHORID = A.AUTHORID\nORDER BY B.TITLE, A.NAME LIMIT 12;"
    },
    {
      title: "J5: Students who never borrowed (LEFT JOIN + IS NULL)",
      sql: "SELECT S.STUDENTID, S.STUDENTNAME, S.BRANCH\nFROM STUDENT S\nLEFT JOIN BORROW BR ON S.STUDENTID = BR.STUDENTID\nWHERE BR.BORROWID IS NULL;"
    },
    {
      title: "Aggregates: Oldest, Newest Year & Total Books",
      sql: "SELECT COUNT(*) AS total_books, MIN(PUBLICATIONYEAR) AS oldest_year, MAX(PUBLICATIONYEAR) AS newest_year FROM BOOKS;"
    }
  ];

  function init() {
    setupPreloadedQueries();
    setupEventListeners();
  }

  function setupPreloadedQueries() {
    const select = document.getElementById('preloadedQuerySelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- Select a Preloaded DBMS Query --</option>' +
      PRELOADED_QUERIES.map((q, idx) => `<option value="${idx}">${q.title}</option>`).join('');

    select.addEventListener('change', () => {
      const idx = select.value;
      if (idx !== "") {
        const editor = document.getElementById('sqlEditor');
        if (editor) editor.value = PRELOADED_QUERIES[idx].sql;
      }
    });

    // Default query
    const editor = document.getElementById('sqlEditor');
    if (editor && !editor.value) {
      editor.value = PRELOADED_QUERIES[0].sql;
    }
  }

  async function executeProcedure(procName) {
    const resultBox = document.getElementById('procOutputBox');
    if (resultBox) {
      resultBox.innerHTML = `<span class="text-indigo-400">Executing procedure ${procName}...</span>`;
    }

    let params = {};
    if (procName === 'GET_BOOK_AGE' || procName === 'IS_BOOK_AVAILABLE') {
      const bId = document.getElementById('procInputBookId')?.value || 1;
      params.book_id = bId;
    } else if (procName === 'GET_STUDENT_BORROW_COUNT' || procName === 'GET_ACTIVE_BORROW_COUNT') {
      const sId = document.getElementById('procInputStudentId')?.value || 1;
      params.student_id = sId;
    } else if (procName === 'GET_BOOKS_BY_LIBRARY') {
      const lId = document.getElementById('procInputLibraryId')?.value || 1;
      params.library_id = lId;
    }

    const res = await API.runProcedure(procName, params);
    if (!resultBox) return;

    resultBox.innerHTML = `
      <div class="mb-2 text-xs text-slate-400 font-mono">Routine: <strong class="text-indigo-300">${procName}</strong></div>
      <pre class="text-emerald-400 text-xs overflow-x-auto">${JSON.stringify(res, null, 2)}</pre>
    `;
  }

  async function testTrigger(testType) {
    const box = document.getElementById('triggerTestResult');
    if (box) {
      box.innerHTML = `<span class="text-slate-400">Simulating trigger constraint test: ${testType}...</span>`;
    }

    let payload = {};
    let testName = "";

    if (testType === 'duplicate_loan') {
      testName = "Unique Active Loan Violation (UQ_BORROW_ONE_ACTIVE_BOOK)";
      // Attempt to borrow book 2 which is already active for borrow 26
      const res = await API.borrowBook({
        student_id: 1,
        book_id: 2, // Book 2 is already checked out!
        borrow_date: new Date().toISOString().split('T')[0],
        due_date: '2026-12-31'
      });
      displayTriggerResult(box, testName, res, !res.success);
    }
    else if (testType === 'future_borrow_date') {
      testName = "Future Borrow Date (TRG_BEFORE_INSERT_BORROW)";
      const res = await API.borrowBook({
        student_id: 1,
        book_id: 1,
        borrow_date: '2099-01-01',
        due_date: '2099-01-15'
      });
      displayTriggerResult(box, testName, res, !res.success);
    }
    else if (testType === 'invalid_year') {
      testName = "Invalid Publication Year (TRG_BEFORE_INSERT_BOOKS)";
      const res = await API.addBook({
        title: "Test Future Tech Book",
        category: "AI",
        publication_year: 2999, // Way in the future
        publisher_id: 1,
        library_id: 1
      });
      displayTriggerResult(box, testName, res, !res.success);
    }
    else if (testType === 'short_userid') {
      testName = "Short User ID & Blank Name (TRG_BEFORE_INSERT_STUDENT)";
      const res = await API.addStudent({
        userid: "ab", // Length < 5
        name: "",    // Blank name
        email: "invalid@college.edu",
        branch: "CSE",
        semester: 1
      });
      displayTriggerResult(box, testName, res, !res.success);
    }
  }

  function displayTriggerResult(box, testName, res, expectedRejected) {
    if (!box) return;
    const isPass = expectedRejected;
    box.innerHTML = `
      <div class="p-4 rounded-xl border ${isPass ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200' : 'bg-rose-950/40 border-rose-800/80 text-rose-200'}">
        <div class="flex items-center justify-between mb-2">
          <span class="font-bold text-sm">${testName}</span>
          <span class="text-xs px-2.5 py-0.5 rounded-full font-bold ${isPass ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'}">
            ${isPass ? 'TEST PASSED (TRIGGER BLOCKED INVALID OP)' : 'UNEXPECTED OUTCOME'}
          </span>
        </div>
        <div class="text-xs font-mono text-slate-300">
          Message: ${res.message || (res.success ? 'Action unexpectedly succeeded' : 'Blocked')}
        </div>
      </div>
    `;
  }

  async function executeSqlQuery() {
    const editor = document.getElementById('sqlEditor');
    const outputContainer = document.getElementById('sqlQueryResults');
    if (!editor || !outputContainer) return;

    const sql = editor.value.trim();
    if (!sql) {
      App.showToast("Please enter an SQL query to execute.", "warning");
      return;
    }

    outputContainer.innerHTML = `
      <div class="py-12 text-center text-slate-400">
        <div class="inline-block animate-spin rounded-full h-6 w-6 border-2 border-indigo-500 border-t-transparent mb-2"></div>
        <p class="text-xs font-mono">Running query on database...</p>
      </div>
    `;

    const res = await API.runQuery(sql);

    if (!res.success) {
      outputContainer.innerHTML = `
        <div class="p-4 bg-rose-950/40 border border-rose-800/80 rounded-xl text-rose-300 text-xs font-mono">
          <div class="font-bold mb-1">SQL Execution Error:</div>
          <div>${res.message}</div>
        </div>
      `;
      return;
    }

    const cols = res.columns || [];
    const rows = res.rows || [];

    outputContainer.innerHTML = `
      <div class="flex items-center justify-between mb-3 text-xs text-slate-400 font-mono">
        <span>Rows returned: <strong class="text-slate-200">${res.rowCount}</strong></span>
        <span>Execution Time: <strong class="text-emerald-400">${res.executionMs} ms</strong></span>
      </div>

      <div class="overflow-x-auto max-h-96 rounded-lg border border-slate-700">
        <table class="w-full text-left text-xs font-mono border-collapse">
          <thead class="bg-slate-800 text-slate-300 sticky top-0">
            <tr>
              ${cols.map(c => `<th class="py-2.5 px-3 border-b border-slate-700">${c}</th>`).join('')}
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800 text-slate-300">
            ${rows.length === 0 ? `<tr><td colspan="${cols.length}" class="py-4 text-center text-slate-500">No rows returned.</td></tr>` : 
              rows.map(r => `
                <tr class="hover:bg-slate-800/50">
                  ${cols.map(c => `<td class="py-2 px-3 whitespace-nowrap">${r[c] !== null && r[c] !== undefined ? r[c] : '<span class="text-slate-600 italic">NULL</span>'}</td>`).join('')}
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    `;
  }

  function setupEventListeners() {
    const runBtn = document.getElementById('runSqlBtn');
    if (runBtn) {
      runBtn.addEventListener('click', executeSqlQuery);
    }
  }

  return {
    init,
    executeProcedure,
    testTrigger,
    executeSqlQuery
  };
})();
