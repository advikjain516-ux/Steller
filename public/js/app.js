/**
 * Library Management System - Main App Orchestrator
 */

const App = (() => {
  let currentTab = 'dashboard';

  async function init() {
    // 1. Initialize API and detect server connection
    const serverOnline = await API.init();
    updateConnectionBadge(serverOnline);

    // 2. Initialize modules
    await Promise.all([
      refreshDashboardStats(),
      BooksModule.init(),
      CirculationModule.init(),
      StudentsModule.init(),
      DbmsLabModule.init(),
      loadLibrariesTab()
    ]);

    // 3. Setup Navigation & Modals
    setupNavigation();
    setupModals();

    lucide.createIcons();
    console.log("Library Management System initialized successfully.");
  }

  function updateConnectionBadge(isOnline) {
    const badge = document.getElementById('connectionBadge');
    if (!badge) return;

    if (isOnline) {
      badge.className = "flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold";
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> REST Server Online`;
    } else {
      badge.className = "flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold";
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span> Standalone Mode (Client DB)`;
    }
  }

  function setupNavigation() {
    const navItems = document.querySelectorAll('[data-tab-target]');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const target = item.getAttribute('data-tab-target');
        switchTab(target);
      });
    });
  }

  function switchTab(tabId) {
    currentTab = tabId;

    // Update nav links styling
    document.querySelectorAll('[data-tab-target]').forEach(el => {
      const target = el.getAttribute('data-tab-target');
      if (target === tabId) {
        el.className = "flex items-center gap-3 px-4 py-2.5 rounded-xl font-semibold text-sm transition nav-pill-active";
      } else {
        el.className = "flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition";
      }
    });

    // Update visible view sections
    document.querySelectorAll('.tab-content-panel').forEach(panel => {
      if (panel.id === `tab-${tabId}`) {
        panel.classList.remove('hidden');
        panel.classList.add('animate-fade-in');
      } else {
        panel.classList.add('hidden');
        panel.classList.remove('animate-fade-in');
      }
    });

    // Sub-module refreshes if needed
    if (tabId === 'dashboard') refreshDashboardStats();
    if (tabId === 'books') BooksModule.loadBooks();
    if (tabId === 'circulation') CirculationModule.loadActiveLoans();
    if (tabId === 'overdue') CirculationModule.loadOverdueLoans();
    if (tabId === 'students') StudentsModule.loadStudents();

    lucide.createIcons();
  }

  async function refreshDashboardStats() {
    const stats = await API.getStats();

    // Populate KPI numbers
    setText('statTotalBooks', stats.total_books);
    setText('statAvailableBooks', stats.available_books);
    setText('statActiveLoans', stats.active_loans);
    setText('statOverdueLoans', stats.overdue_loans);
    setText('statTotalStudents', stats.total_students);
    setText('statTotalLibraries', stats.total_libraries);

    // Overdue Alert Banner
    const banner = document.getElementById('dashboardOverdueBanner');
    if (banner) {
      if (stats.overdue_loans > 0) {
        banner.classList.remove('hidden');
        setText('overdueBannerCount', `${stats.overdue_loans} book${stats.overdue_loans > 1 ? 's are' : ' is'} currently past due date.`);
      } else {
        banner.classList.add('hidden');
      }
    }

    // Render Charts
    AppCharts.renderCategoryChart(stats.category_distribution || []);
    AppCharts.renderLibraryChart(stats.library_stats || []);
  }

  async function loadLibrariesTab() {
    const container = document.getElementById('librariesTabContainer');
    if (!container) return;

    const [libraries, authors, publishers] = await Promise.all([
      API.getLibraries(),
      API.getAuthors(),
      API.getPublishers()
    ]);

    container.innerHTML = `
      <!-- Libraries Section -->
      <div>
        <h3 class="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <i data-lucide="building-2" class="w-5 h-5 text-indigo-600"></i> Campus Libraries
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          ${libraries.map(lib => `
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm card-hover-effect">
              <div class="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                <i data-lucide="library" class="w-6 h-6"></i>
              </div>
              <h4 class="text-lg font-bold text-slate-900">${lib.NAME}</h4>
              <p class="text-xs font-mono text-slate-400 mt-1">LIBRARYID: #${lib.LIBRARYID}</p>
              <div class="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span class="text-xs text-slate-500 font-medium">Catalog Holdings</span>
                <span class="text-sm font-bold text-slate-900">${lib.TOTAL_BOOKS} Books</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Publishers Section -->
      <div class="mt-10">
        <h3 class="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <i data-lucide="printer" class="w-5 h-5 text-indigo-600"></i> Registered Publishers
        </h3>
        <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div class="overflow-x-auto">
            <table class="w-full text-left custom-table">
              <thead>
                <tr>
                  <th class="py-3 px-4">Publisher ID</th>
                  <th class="py-3 px-4">Publisher Name</th>
                  <th class="py-3 px-4">Nationality</th>
                  <th class="py-3 px-4 text-right">Published Titles</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-sm">
                ${publishers.map(p => `
                  <tr class="hover:bg-slate-50">
                    <td class="py-2.5 px-4 font-mono text-xs text-slate-500">#${p.PUBLISHERID}</td>
                    <td class="py-2.5 px-4 font-semibold text-slate-900">${p.NAME}</td>
                    <td class="py-2.5 px-4 text-slate-600">${p.NATIONALITY}</td>
                    <td class="py-2.5 px-4 text-right font-bold text-slate-800">${p.BOOKS_COUNT}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Authors Section Preview -->
      <div class="mt-10">
        <h3 class="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <i data-lucide="feather" class="w-5 h-5 text-indigo-600"></i> Seeded Authors (${authors.length})
        </h3>
        <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div class="overflow-x-auto max-h-72">
            <table class="w-full text-left custom-table">
              <thead class="sticky top-0 bg-slate-50">
                <tr>
                  <th class="py-3 px-4">Author ID</th>
                  <th class="py-3 px-4">Author Name</th>
                  <th class="py-3 px-4">Email Address</th>
                  <th class="py-3 px-4">Nationality</th>
                  <th class="py-3 px-4 text-right">Books</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-sm">
                ${authors.map(a => `
                  <tr class="hover:bg-slate-50">
                    <td class="py-2 px-4 font-mono text-xs text-slate-500">#${a.AUTHORID}</td>
                    <td class="py-2 px-4 font-semibold text-slate-900">${a.NAME}</td>
                    <td class="py-2 px-4 text-xs font-mono text-slate-500">${a.EMAIL || 'N/A'}</td>
                    <td class="py-2 px-4 text-slate-600">${a.NATIONALITY}</td>
                    <td class="py-2 px-4 text-right font-bold text-slate-800">${a.BOOKS_COUNT}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    lucide.createIcons();
  }

  function setText(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) el.innerText = text;
  }

  function setupModals() {
    // Backdrop click close
    document.querySelectorAll('.modal-wrapper').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeModal(modal.id);
        }
      });
    });
  }

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const colors = {
      success: 'bg-emerald-600 text-white',
      error: 'bg-rose-600 text-white',
      warning: 'bg-amber-500 text-slate-950',
      info: 'bg-slate-900 text-white'
    };
    const icons = {
      success: 'check-circle-2',
      error: 'alert-triangle',
      warning: 'alert-circle',
      info: 'info'
    };

    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium animate-slide-down ${colors[type] || colors.info}`;
    toast.innerHTML = `
      <i data-lucide="${icons[type] || 'info'}" class="w-5 h-5 flex-shrink-0"></i>
      <span class="flex-1">${message}</span>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  return {
    init,
    switchTab,
    openModal,
    closeModal,
    showToast,
    refreshDashboardStats
  };
})();

// Auto-run on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
