/**
 * Library Management System - Chart.js Visualizations
 */

const AppCharts = (() => {
  let categoryChartInstance = null;
  let libraryChartInstance = null;

  function renderCategoryChart(data) {
    const canvas = document.getElementById('categoryChart');
    if (!canvas) return;

    if (categoryChartInstance) {
      categoryChartInstance.destroy();
    }

    const labels = data.map(d => d.CATEGORY);
    const counts = data.map(d => d.count);

    const colors = [
      '#4f46e5', '#06b6d4', '#10b981', '#f59e0b',
      '#ec4899', '#8b5cf6', '#64748b', '#14b8a6'
    ];

    categoryChartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: counts,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 12,
              font: { family: 'Plus Jakarta Sans', size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const total = counts.reduce((a, b) => a + b, 0);
                const val = context.raw || 0;
                const pct = Math.round((val / total) * 100);
                return ` ${context.label}: ${val} books (${pct}%)`;
              }
            }
          }
        },
        cutout: '65%'
      }
    });
  }

  function renderLibraryChart(data) {
    const canvas = document.getElementById('libraryChart');
    if (!canvas) return;

    if (libraryChartInstance) {
      libraryChartInstance.destroy();
    }

    const labels = data.map(d => d.library_name.replace(' Library', ''));
    const totalBooks = data.map(d => d.total);
    const borrowedBooks = data.map(d => d.borrowed);
    const availableBooks = data.map(d => d.available);

    libraryChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Available',
            data: availableBooks,
            backgroundColor: '#10b981',
            borderRadius: 4
          },
          {
            label: 'Borrowed',
            data: borrowedBooks,
            backgroundColor: '#f43f5e',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            grid: { display: false }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: { precision: 0 }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, font: { family: 'Plus Jakarta Sans', size: 12 } }
          }
        }
      }
    });
  }

  return {
    renderCategoryChart,
    renderLibraryChart
  };
})();
