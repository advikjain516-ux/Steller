/**
 * Library Management System - Books Catalog Controller
 */

const BooksModule = (() => {
  let booksData = [];
  let currentView = 'grid'; // 'grid' or 'table'
  let cachedLibraries = [];
  let cachedPublishers = [];
  let cachedAuthors = [];

  async function init() {
    [cachedLibraries, cachedPublishers, cachedAuthors] = await Promise.all([
      API.getLibraries(),
      API.getPublishers(),
      API.getAuthors()
    ]);
    populateFilterDropdowns();
    await loadBooks();
    setupEventListeners();
  }

  function populateFilterDropdowns() {
    const libSelect = document.getElementById('bookLibraryFilter');
    if (libSelect) {
      libSelect.innerHTML = '<option value="">All Libraries</option>' +
        cachedLibraries.map(l => `<option value="${l.LIBRARYID}">${l.NAME}</option>`).join('');
    }

    const modalLibSelect = document.getElementById('newBookLibrary');
    if (modalLibSelect) {
      modalLibSelect.innerHTML = cachedLibraries.map(l => `<option value="${l.LIBRARYID}">${l.NAME}</option>`).join('');
    }

    const modalPubSelect = document.getElementById('newBookPublisher');
    if (modalPubSelect) {
      modalPubSelect.innerHTML = cachedPublishers.map(p => `<option value="${p.PUBLISHERID}">${p.NAME} (${p.NATIONALITY})</option>`).join('');
    }

    const modalAuthorSelect = document.getElementById('newBookAuthors');
    if (modalAuthorSelect) {
      modalAuthorSelect.innerHTML = cachedAuthors.map(a => `<option value="${a.AUTHORID}">${a.NAME}</option>`).join('');
    }
  }

  async function loadBooks() {
    const q = (document.getElementById('bookSearchInput')?.value || '').trim();
    const category = document.getElementById('bookCategoryFilter')?.value || '';
    const library_id = document.getElementById('bookLibraryFilter')?.value || '';
    const status = document.getElementById('bookStatusFilter')?.value || '';

    const container = document.getElementById('booksContainer');
    if (container) {
      container.innerHTML = `
        <div class="col-span-full py-16 text-center text-slate-400">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent mb-3"></div>
          <p class="text-sm">Fetching catalog from database...</p>
        </div>
      `;
    }

    booksData = await API.getBooks({ q, category, library_id, status });
    renderBooks();
  }

  function renderBooks() {
    const countEl = document.getElementById('booksCountBadge');
    if (countEl) countEl.innerText = `${booksData.length} Books Found`;

    const container = document.getElementById('booksContainer');
    if (!container) return;

    if (booksData.length === 0) {
      container.innerHTML = `
        <div class="col-span-full bg-white rounded-2xl p-12 text-center border border-slate-200">
          <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
            <i data-lucide="book-x" class="w-8 h-8"></i>
          </div>
          <h3 class="text-lg font-bold text-slate-800">No books found</h3>
          <p class="text-slate-500 text-sm mt-1">Try adjusting your search keywords or filter settings.</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    if (currentView === 'grid') {
      renderGridView(container);
    } else {
      renderTableView(container);
    }

    lucide.createIcons();
  }

  function getCategoryColor(cat) {
    const map = {
      'Database': 'bg-blue-50 text-blue-700 border-blue-200',
      'Algorithms': 'bg-purple-50 text-purple-700 border-purple-200',
      'Programming': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'AI': 'bg-amber-50 text-amber-700 border-amber-200',
      'Web': 'bg-cyan-50 text-cyan-700 border-cyan-200',
      'Systems': 'bg-rose-50 text-rose-700 border-rose-200',
      'Software': 'bg-indigo-50 text-indigo-700 border-indigo-200'
    };
    return map[cat] || 'bg-slate-50 text-slate-700 border-slate-200';
  }

  function renderGridView(container) {
    container.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in";
    container.innerHTML = booksData.map(book => {
      const isAvailable = book.STATUS === 'Available';
      return `
        <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between card-hover-effect">
          <div class="p-5">
            <div class="flex items-start justify-between gap-2 mb-3">
              <span class="text-xs font-semibold px-2.5 py-1 rounded-full border ${getCategoryColor(book.CATEGORY)}">
                ${book.CATEGORY}
              </span>
              <span class="text-xs font-semibold px-2.5 py-1 rounded-full ${isAvailable ? 'badge-available' : 'badge-borrowed'}">
                ${book.STATUS}
              </span>
            </div>

            <h3 class="text-base font-bold text-slate-900 leading-snug line-clamp-2 hover:text-indigo-600 cursor-pointer" onclick="BooksModule.openBookDetail(${book.BOOKID})">
              ${book.TITLE}
            </h3>

            <p class="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <i data-lucide="users" class="w-3.5 h-3.5 text-slate-400"></i>
              <span class="line-clamp-1">${book.AUTHORS || 'Unknown Author'}</span>
            </p>

            <div class="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-500">
              <div>
                <span class="block text-[10px] uppercase font-bold text-slate-400">Publisher</span>
                <span class="font-medium text-slate-700 truncate block">${book.PUBLISHER}</span>
              </div>
              <div>
                <span class="block text-[10px] uppercase font-bold text-slate-400">Year / Age</span>
                <span class="font-medium text-slate-700">${book.PUBLICATIONYEAR} (${book.AGE} yrs)</span>
              </div>
            </div>

            <div class="mt-2 text-xs text-slate-500">
              <span class="block text-[10px] uppercase font-bold text-slate-400">Location</span>
              <span class="font-medium text-slate-700 flex items-center gap-1">
                <i data-lucide="map-pin" class="w-3 h-3 text-slate-400"></i> ${book.LIBRARY}
              </span>
            </div>
          </div>

          <div class="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-between">
            <span class="text-[11px] font-mono text-slate-400">ID: #${book.BOOKID}</span>
            <div class="flex gap-2">
              <button onclick="BooksModule.openBookDetail(${book.BOOKID})" class="text-xs font-semibold text-slate-600 hover:text-indigo-600 px-2 py-1 rounded transition">
                Details
              </button>
              ${isAvailable ? `
                <button onclick="CirculationModule.openIssueModalForBook(${book.BOOKID}, '${escapeQuotes(book.TITLE)}')" class="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg transition shadow-sm">
                  Issue
                </button>
              ` : `
                <button disabled class="text-xs font-semibold bg-slate-200 text-slate-400 px-3 py-1 rounded-lg cursor-not-allowed">
                  Borrowed
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderTableView(container) {
    container.className = "bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in";
    container.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse custom-table">
          <thead>
            <tr>
              <th class="py-3.5 px-4">Book ID</th>
              <th class="py-3.5 px-4">Title & ISBN</th>
              <th class="py-3.5 px-4">Category</th>
              <th class="py-3.5 px-4">Author(s)</th>
              <th class="py-3.5 px-4">Library</th>
              <th class="py-3.5 px-4">Year</th>
              <th class="py-3.5 px-4">Status</th>
              <th class="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${booksData.map(book => {
              const isAvailable = book.STATUS === 'Available';
              return `
                <tr class="hover:bg-slate-50 transition">
                  <td class="py-3 px-4 font-mono text-xs font-semibold text-slate-500">#${book.BOOKID}</td>
                  <td class="py-3 px-4">
                    <div class="font-bold text-slate-900 hover:text-indigo-600 cursor-pointer text-sm" onclick="BooksModule.openBookDetail(${book.BOOKID})">
                      ${book.TITLE}
                    </div>
                    <div class="text-[11px] font-mono text-slate-400">${book.ISBN || 'No ISBN'}</div>
                  </td>
                  <td class="py-3 px-4">
                    <span class="text-xs font-semibold px-2 py-0.5 rounded-full border ${getCategoryColor(book.CATEGORY)}">
                      ${book.CATEGORY}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-xs text-slate-600 max-w-[200px] truncate">
                    ${book.AUTHORS}
                  </td>
                  <td class="py-3 px-4 text-xs text-slate-600 font-medium">
                    ${book.LIBRARY}
                  </td>
                  <td class="py-3 px-4 text-xs text-slate-600">
                    ${book.PUBLICATIONYEAR}
                  </td>
                  <td class="py-3 px-4">
                    <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${isAvailable ? 'badge-available' : 'badge-borrowed'}">
                      ${book.STATUS}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button onclick="BooksModule.openBookDetail(${book.BOOKID})" class="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition" title="Details">
                        <i data-lucide="info" class="w-4 h-4"></i>
                      </button>
                      ${isAvailable ? `
                        <button onclick="CirculationModule.openIssueModalForBook(${book.BOOKID}, '${escapeQuotes(book.TITLE)}')" class="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-md transition shadow-sm">
                          Issue
                        </button>
                      ` : `
                        <span class="text-xs text-slate-400 px-2 py-1 font-medium">On Loan</span>
                      `}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function setView(view) {
    currentView = view;
    const gridBtn = document.getElementById('viewGridBtn');
    const tableBtn = document.getElementById('viewTableBtn');
    if (gridBtn && tableBtn) {
      if (view === 'grid') {
        gridBtn.className = "p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 transition";
        tableBtn.className = "p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition";
      } else {
        tableBtn.className = "p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 transition";
        gridBtn.className = "p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition";
      }
    }
    renderBooks();
  }

  function openBookDetail(bookId) {
    const book = booksData.find(b => b.BOOKID === bookId);
    if (!book) return;

    const modal = document.getElementById('bookDetailModal');
    const content = document.getElementById('bookDetailContent');
    if (!modal || !content) return;

    const isAvailable = book.STATUS === 'Available';

    content.innerHTML = `
      <div class="flex items-start justify-between border-b border-slate-100 pb-4">
        <div>
          <span class="text-xs font-semibold px-2.5 py-1 rounded-full border ${getCategoryColor(book.CATEGORY)}">
            ${book.CATEGORY}
          </span>
          <h2 class="text-xl font-bold text-slate-900 mt-2">${book.TITLE}</h2>
          <p class="text-xs font-mono text-slate-400 mt-0.5">ISBN: ${book.ISBN || 'N/A'} • Book ID: #${book.BOOKID}</p>
        </div>
        <span class="text-xs font-semibold px-3 py-1 rounded-full ${isAvailable ? 'badge-available' : 'badge-borrowed'}">
          ${book.STATUS}
        </span>
      </div>

      <div class="grid grid-cols-2 gap-4 py-4 border-b border-slate-100 text-sm">
        <div>
          <span class="block text-xs font-bold uppercase text-slate-400">Author(s)</span>
          <span class="font-semibold text-slate-800">${book.AUTHORS}</span>
        </div>
        <div>
          <span class="block text-xs font-bold uppercase text-slate-400">Publisher</span>
          <span class="font-semibold text-slate-800">${book.PUBLISHER}</span>
        </div>
        <div>
          <span class="block text-xs font-bold uppercase text-slate-400">Library Location</span>
          <span class="font-semibold text-slate-800">${book.LIBRARY}</span>
        </div>
        <div>
          <span class="block text-xs font-bold uppercase text-slate-400">Publication Year / Age</span>
          <span class="font-semibold text-slate-800">${book.PUBLICATIONYEAR} (${book.AGE} years old)</span>
        </div>
      </div>

      <div class="pt-4 flex items-center justify-between">
        <button onclick="App.closeModal('bookDetailModal')" class="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition">
          Close
        </button>
        ${isAvailable ? `
          <button onclick="App.closeModal('bookDetailModal'); CirculationModule.openIssueModalForBook(${book.BOOKID}, '${escapeQuotes(book.TITLE)}')" class="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition">
            Issue This Book
          </button>
        ` : `
          <span class="text-xs font-medium text-slate-500">Currently borrowed by a student</span>
        `}
      </div>
    `;

    App.openModal('bookDetailModal');
    lucide.createIcons();
  }

  function setupEventListeners() {
    const searchInput = document.getElementById('bookSearchInput');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(loadBooks, 250);
      });
    }

    ['bookCategoryFilter', 'bookLibraryFilter', 'bookStatusFilter'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', loadBooks);
    });

    // Add Book Form Submission
    const addBookForm = document.getElementById('addBookForm');
    if (addBookForm) {
      addBookForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = addBookForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerText = "Adding Book...";

        const authorSelect = document.getElementById('newBookAuthors');
        const selectedAuthors = Array.from(authorSelect.selectedOptions).map(opt => opt.value);

        const payload = {
          title: document.getElementById('newBookTitle').value,
          isbn: document.getElementById('newBookISBN').value,
          category: document.getElementById('newBookCategory').value,
          publication_year: parseInt(document.getElementById('newBookYear').value),
          publisher_id: parseInt(document.getElementById('newBookPublisher').value),
          library_id: parseInt(document.getElementById('newBookLibrary').value),
          author_ids: selectedAuthors
        };

        const res = await API.addBook(payload);
        submitBtn.disabled = false;
        submitBtn.innerText = "Add Book";

        if (res.success) {
          App.showToast(res.message, 'success');
          App.closeModal('addBookModal');
          addBookForm.reset();
          await loadBooks();
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
    loadBooks,
    setView,
    openBookDetail
  };
})();
