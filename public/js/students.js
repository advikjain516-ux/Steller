/**
 * Library Management System - Students Directory Controller
 */

const StudentsModule = (() => {
  let studentsData = [];

  async function init() {
    await loadStudents();
    setupEventListeners();
  }

  async function loadStudents() {
    const container = document.getElementById('studentsTableBody');
    if (container) {
      container.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">Loading students directory...</td></tr>`;
    }

    studentsData = await API.getStudents();
    renderStudents();
  }

  function renderStudents() {
    const q = (document.getElementById('studentSearchInput')?.value || '').trim().toLowerCase();
    const branch = document.getElementById('studentBranchFilter')?.value || '';

    let filtered = studentsData;
    if (branch) {
      filtered = filtered.filter(s => s.BRANCH === branch);
    }
    if (q) {
      filtered = filtered.filter(s => 
        s.STUDENTNAME.toLowerCase().includes(q) ||
        s.USERID.toLowerCase().includes(q) ||
        s.STUDENTEMAIL.toLowerCase().includes(q) ||
        s.BRANCH.toLowerCase().includes(q)
      );
    }

    const badge = document.getElementById('studentsCountBadge');
    if (badge) badge.innerText = `${filtered.length} Students`;

    const container = document.getElementById('studentsTableBody');
    if (!container) return;

    if (filtered.length === 0) {
      container.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-slate-400">No students match your criteria.</td></tr>`;
      return;
    }

    container.innerHTML = filtered.map(student => {
      const hasActive = student.ACTIVE_LOANS > 0;
      return `
        <tr class="hover:bg-slate-50 transition">
          <td class="py-3 px-4 font-mono text-xs font-semibold text-slate-500">#${student.STUDENTID}</td>
          <td class="py-3 px-4 font-mono text-xs font-bold text-indigo-600">${student.USERID}</td>
          <td class="py-3 px-4">
            <div class="font-bold text-slate-900 text-sm hover:text-indigo-600 cursor-pointer" onclick="StudentsModule.openHistoryModal(${student.STUDENTID}, '${escapeQuotes(student.STUDENTNAME)}')">
              ${student.STUDENTNAME}
            </div>
            <div class="text-[11px] text-slate-400">${student.STUDENTEMAIL}</div>
          </td>
          <td class="py-3 px-4">
            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              ${student.BRANCH} • Sem ${student.SEMESTER}
            </span>
          </td>
          <td class="py-3 px-4 text-xs font-mono text-slate-600">${student.STUDENTPHONENUMBER || 'N/A'}</td>
          <td class="py-3 px-4">
            <span class="text-xs font-bold ${hasActive ? 'text-amber-600' : 'text-slate-500'}">
              ${student.ACTIVE_LOANS} Active / ${student.TOTAL_BORROWS} Total
            </span>
          </td>
          <td class="py-3 px-4 text-right">
            <button onclick="StudentsModule.openHistoryModal(${student.STUDENTID}, '${escapeQuotes(student.STUDENTNAME)}')" class="text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg transition">
              History
            </button>
          </td>
        </tr>
      `;
    }).join('');

    lucide.createIcons();
  }

  async function openHistoryModal(studentId, studentName) {
    const modal = document.getElementById('studentHistoryModal');
    const content = document.getElementById('studentHistoryContent');
    const titleEl = document.getElementById('studentHistoryTitle');
    if (!modal || !content) return;

    if (titleEl) titleEl.innerText = `${studentName}'s Borrowing History`;

    content.innerHTML = `<div class="py-12 text-center text-slate-400">Executing GET_STUDENT_BORROW_HISTORY(${studentId})...</div>`;
    App.openModal('studentHistoryModal');

    const history = await API.getStudentHistory(studentId);

    if (history.length === 0) {
      content.innerHTML = `
        <div class="py-12 text-center text-slate-400">
          <i data-lucide="book-open" class="w-12 h-12 text-slate-300 mx-auto mb-3"></i>
          <p class="text-sm font-medium">No borrowing records found for this student.</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    content.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse custom-table">
          <thead>
            <tr>
              <th class="py-3 px-3">Borrow ID</th>
              <th class="py-3 px-3">Book Title</th>
              <th class="py-3 px-3">Borrow Date</th>
              <th class="py-3 px-3">Due Date</th>
              <th class="py-3 px-3">Return Date</th>
              <th class="py-3 px-3">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-xs">
            ${history.map(item => {
              let statusBadge = 'badge-ontime';
              if (item.STATUS === 'OVERDUE') statusBadge = 'badge-overdue';
              else if (item.STATUS === 'Returned') statusBadge = 'badge-available';

              return `
                <tr class="hover:bg-slate-50">
                  <td class="py-2.5 px-3 font-mono font-semibold text-slate-500">#${item.BORROWID}</td>
                  <td class="py-2.5 px-3 font-semibold text-slate-800">${item.TITLE}</td>
                  <td class="py-2.5 px-3 font-mono text-slate-600">${item.BORROWDATE}</td>
                  <td class="py-2.5 px-3 font-mono text-slate-600">${item.DUE_DATE}</td>
                  <td class="py-2.5 px-3 font-mono text-slate-600">${item.RETURNDATE}</td>
                  <td class="py-2.5 px-3">
                    <span class="px-2 py-0.5 rounded-full font-bold ${statusBadge}">
                      ${item.STATUS}
                    </span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    lucide.createIcons();
  }

  function setupEventListeners() {
    const searchInput = document.getElementById('studentSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', renderStudents);
    }
    const branchFilter = document.getElementById('studentBranchFilter');
    if (branchFilter) {
      branchFilter.addEventListener('change', renderStudents);
    }

    // Add Student Form Submit
    const addStudentForm = document.getElementById('addStudentForm');
    if (addStudentForm) {
      addStudentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = addStudentForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerText = "Adding Student...";

        const payload = {
          userid: document.getElementById('newStudentUserId').value,
          name: document.getElementById('newStudentName').value,
          email: document.getElementById('newStudentEmail').value,
          phone: document.getElementById('newStudentPhone').value,
          branch: document.getElementById('newStudentBranch').value,
          semester: parseInt(document.getElementById('newStudentSemester').value)
        };

        const res = await API.addStudent(payload);
        submitBtn.disabled = false;
        submitBtn.innerText = "Add Student";

        if (res.success) {
          App.showToast(res.message, 'success');
          App.closeModal('addStudentModal');
          addStudentForm.reset();
          await loadStudents();
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
    loadStudents,
    openHistoryModal
  };
})();
