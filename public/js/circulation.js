/**
 * Library Management System - Circulation Controller (Issue, Return & Overdue)
 */

const CirculationModule = (() => {
  let activeLoans = [];
  let overdueLoans = [];

  async function init() {
    await Promise.all([loadActiveLoans(), loadOverdueLoans()]);
    setupEventListeners();
  }

  async function loadActiveLoans() {
    const container = document.getElementById('activeLoansTableBody');
    if (container) {
      container.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">Loading active loans...</td></tr>`;
    }

    activeLoans = await API.getActiveBorrowings();
    renderActiveLoans();
  }

  async function loadOverdueLoans() {
    const container = document.getElementById('overdueTableBody');
    if (container) {
      container.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400">Loading overdue records...</td></tr>`;
    }

    overdueLoans = await API.getOverdueBooks();
    renderOverdueLoans();
  }

  function renderActiveLoans() {
    const badge = document.getElementById('activeLoansCountBadge');
    if (badge) badge.innerText = `${activeLoans.length} Active Loans`;

    const container = document.getElementById('activeLoansTableBody');
    if (!container) return;

    if (activeLoans.length === 0) {
      container.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-slate-400">No active loans found. All books are in stock!</td></tr>`;
      return;
    }

    container.innerHTML = activeLoans.map(loan => {
      const isOverdue = loan.DAYS_OVERDUE > 0;
      return `
        <tr class="hover:bg-slate-50 transition">
          <td class="py-3 px-4 font-mono text-xs font-semibold text-slate-500">#${loan.BORROWID}</td>
          <td class="py-3 px-4">
            <div class="font-bold text-slate-900 text-sm">${loan.STUDENTNAME}</div>
            <div class="text-[11px] text-slate-400">${loan.BRANCH} • ${loan.STUDENTEMAIL}</div>
          </td>
          <td class="py-3 px-4">
            <div class="font-semibold text-slate-800 text-sm">${loan.TITLE}</div>
            <div class="text-[11px] text-slate-400">${loan.LIBRARY}</div>
          </td>
          <td class="py-3 px-4 text-xs font-mono text-slate-600">${loan.BORROWDATE}</td>
          <td class="py-3 px-4 text-xs font-mono font-medium ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'}">
            ${loan.DUE_DATE}
          </td>
          <td class="py-3 px-4">
            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full ${isOverdue ? 'badge-overdue' : 'badge-ontime'}">
              ${isOverdue ? `${loan.DAYS_OVERDUE}d Overdue` : 'On Time'}
            </span>
          </td>
          <td class="py-3 px-4 text-right">
            <button onclick="CirculationModule.openReturnModal(${loan.BORROWID}, '${escapeQuotes(loan.TITLE)}', '${escapeQuotes(loan.STUDENTNAME)}', '${loan.BORROWDATE}', '${loan.DUE_DATE}')" class="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition shadow-sm">
              Return
            </button>
          </td>
        </tr>
      `;
    }).join('');

    lucide.createIcons();
  }

  function renderOverdueLoans() {
    const badge = document.getElementById('overdueCountBadge');
    if (badge) badge.innerText = `${overdueLoans.length} Overdue`;

    const container = document.getElementById('overdueTableBody');
    if (!container) return;

    if (overdueLoans.length === 0) {
      container.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-slate-400">Great news! No loans are currently overdue.</td></tr>`;
      return;
    }

    container.innerHTML = overdueLoans.map(loan => {
      const fine = loan.DAYS_OVERDUE * 2; // e.g. $2 / ₹2 per day fine
      return `
        <tr class="hover:bg-slate-50 transition">
          <td class="py-3 px-4 font-mono text-xs font-semibold text-slate-500">#${loan.BORROWID}</td>
          <td class="py-3 px-4">
            <div class="font-bold text-slate-900 text-sm">${loan.STUDENTNAME}</div>
            <div class="text-[11px] text-slate-400">${loan.STUDENTEMAIL}</div>
          </td>
          <td class="py-3 px-4 font-semibold text-slate-800 text-sm">${loan.TITLE}</td>
          <td class="py-3 px-4 text-xs font-mono text-slate-600">${loan.DUE_DATE}</td>
          <td class="py-3 px-4">
            <span class="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
              ${loan.DAYS_OVERDUE} Days Late (Est. Fine: ₹${fine})
            </span>
          </td>
          <td class="py-3 px-4 text-right">
            <div class="flex items-center justify-end gap-2">
              <button onclick="CirculationModule.sendReminder('${escapeQuotes(loan.STUDENTNAME)}', '${loan.STUDENTEMAIL}')" class="text-xs font-semibold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 rounded-lg transition">
                Send Notice
              </button>
              <button onclick="CirculationModule.openReturnModal(${loan.BORROWID}, '${escapeQuotes(loan.TITLE)}', '${escapeQuotes(loan.STUDENTNAME)}', '', '${loan.DUE_DATE}')" class="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition shadow-sm">
                Return
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    lucide.createIcons();
  }

  async function openIssueModal() {
    // Populate students & available books
    const [students, books] = await Promise.all([
      API.getStudents(),
      API.getBooks({ status: 'Available' })
    ]);

    const studentSelect = document.getElementById('issueStudentSelect');
    if (studentSelect) {
      studentSelect.innerHTML = '<option value="">-- Choose Student --</option>' +
        students.map(s => `<option value="${s.STUDENTID}">${s.STUDENTNAME} (${s.USERID} - ${s.BRANCH}) [Active: ${s.ACTIVE_LOANS}]</option>`).join('');
    }

    const bookSelect = document.getElementById('issueBookSelect');
    if (bookSelect) {
      bookSelect.innerHTML = '<option value="">-- Choose Available Book --</option>' +
        books.map(b => `<option value="${b.BOOKID}">#${b.BOOKID} - ${b.TITLE} (${b.LIBRARY})</option>`).join('');
    }

    const today = new Date().toISOString().split('T')[0];
    const dueDateObj = new Date();
    dueDateObj.setDate(dueDateObj.getDate() + 14);
    const dueDate = dueDateObj.toISOString().split('T')[0];

    document.getElementById('issueBorrowDate').value = today;
    document.getElementById('issueDueDate').value = dueDate;

    App.openModal('issueBookModal');
  }

  async function openIssueModalForBook(bookId, bookTitle) {
    await openIssueModal();
    const bookSelect = document.getElementById('issueBookSelect');
    if (bookSelect) bookSelect.value = bookId;
  }

  function openReturnModal(borrowId, bookTitle, studentName, borrowDate, dueDate) {
    document.getElementById('returnBorrowId').value = borrowId;
    document.getElementById('returnBookTitle').innerText = bookTitle;
    document.getElementById('returnStudentName').innerText = studentName;

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('returnDate').value = today;

    // Check overdue
    const diff = Math.floor((new Date(today) - new Date(dueDate)) / (1000 * 60 * 60 * 24));
    const fineEl = document.getElementById('returnFineNotice');
    if (fineEl) {
      if (diff > 0) {
        fineEl.className = "p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 block";
        fineEl.innerHTML = `<strong>Attention:</strong> This book is <strong>${diff} days overdue</strong>. Calculated fine: ₹${diff * 2}.`;
      } else {
        fineEl.className = "hidden";
      }
    }

    App.openModal('returnBookModal');
  }

  function sendReminder(name, email) {
    App.showToast(`Overdue reminder email simulated to ${name} (${email}).`, 'info');
  }

  function setupEventListeners() {
    // Issue form submit
    const issueForm = document.getElementById('issueBookForm');
    if (issueForm) {
      issueForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = issueForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerText = "Executing BORROW_BOOK()...";

        const payload = {
          student_id: parseInt(document.getElementById('issueStudentSelect').value),
          book_id: parseInt(document.getElementById('issueBookSelect').value),
          borrow_date: document.getElementById('issueBorrowDate').value,
          due_date: document.getElementById('issueDueDate').value
        };

        const res = await API.borrowBook(payload);
        submitBtn.disabled = false;
        submitBtn.innerText = "Confirm Issue";

        if (res.success) {
          App.showToast(res.message, 'success');
          App.closeModal('issueBookModal');
          issueForm.reset();
          await Promise.all([loadActiveLoans(), loadOverdueLoans(), BooksModule.loadBooks()]);
          App.refreshDashboardStats();
        } else {
          App.showToast(res.message, 'error');
        }
      });
    }

    // Return form submit
    const returnForm = document.getElementById('returnBookForm');
    if (returnForm) {
      returnForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = returnForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerText = "Executing RETURN_BOOK()...";

        const payload = {
          borrow_id: parseInt(document.getElementById('returnBorrowId').value),
          return_date: document.getElementById('returnDate').value
        };

        const res = await API.returnBook(payload);
        submitBtn.disabled = false;
        submitBtn.innerText = "Confirm Return";

        if (res.success) {
          App.showToast(res.message, 'success');
          App.closeModal('returnBookModal');
          await Promise.all([loadActiveLoans(), loadOverdueLoans(), BooksModule.loadBooks()]);
          App.refreshDashboardStats();
        } else {
          App.showToast(res.message, 'error');
        }
      });
    }
  }

  function escapeQuotes(str) {
    return (str || '').replace(/'/g, "\\'");
  }

  return {
    init,
    loadActiveLoans,
    loadOverdueLoans,
    openIssueModal,
    openIssueModalForBook,
    openReturnModal,
    sendReminder
  };
})();
