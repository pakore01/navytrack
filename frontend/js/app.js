/* ============================================================
   APP.JS — App initialization, routing, bootstrap
   ============================================================ */

'use strict';

const App = (() => {

  let refreshTimer = null;

  // ── START AUTO-REFRESH ──
  function startRefresh(seconds) {
    stopRefresh();
    if (!seconds || seconds <= 0) return;
    refreshTimer = setInterval(() => Api.fetchAll(), seconds * 1000);
  }

  // ── STOP AUTO-REFRESH ──
  function stopRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  // ── MANUAL REFRESH ──
  async function refresh() {
    await Api.fetchAll();

    // Restart interval after manual refresh
    const sel = document.getElementById('refreshInterval');
    const val = parseInt(sel?.value || '0');
    startRefresh(val);
  }

  // ── MOBILE DROPDOWN MENU ──
  function initMobileMenu() {
    const menuBtn  = document.getElementById('mobileMenuBtn');
    const dropdown = document.getElementById('mobileDropdown');
    const overlay  = document.getElementById('mobileDropdownOverlay');

    if (!menuBtn || !dropdown || !overlay) return;

    function openMenu() {
      dropdown.classList.add('open');
      overlay.classList.add('open');
    }

    function closeMenu() {
      dropdown.classList.remove('open');
      overlay.classList.remove('open');
    }

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.contains('open') ? closeMenu() : openMenu();
    });

    overlay.addEventListener('click', closeMenu);

    // Conectar items del dropdown con los botones reales
    const map = {
      'dd-zones':   'zonesBtn',
      'dd-stats':   'statsBtn',
      'dd-alerts':  'alertsHistoryBtn',
      'dd-history': 'historyBtn',
      'dd-theme':   'themeBtn',
      'dd-export':  'exportBtn',
    };

    Object.entries(map).forEach(([ddId, btnId]) => {
      const ddItem = document.getElementById(ddId);
      if (ddItem) {
        ddItem.addEventListener('click', () => {
          closeMenu();
          document.getElementById(btnId)?.click();
        });
      }
    });
  }

  // ── BIND GLOBAL EVENTS ──
  function bindEvents() {
    // Manual refresh button
    document.getElementById('refreshBtn')?.addEventListener('click', refresh);

    // Export CSV
    document.getElementById('exportBtn')?.addEventListener('click', () => {
      Utils.exportCSV(STATE.display, 'navytrack-export.csv');
    });

    // Auto-refresh interval select
    document.getElementById('refreshInterval')?.addEventListener('change', (e) => {
      const val = parseInt(e.target.value);
      Utils.lsSet(CONFIG.STORAGE_KEYS.REFRESH_INT, val);
      startRefresh(val);
      Utils.toast(val > 0 ? `Auto-refresh set to ${val}s` : 'Auto-refresh disabled', 'info', 2000);
    });

    // Keyboard: Escape closes detail panel / modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.getElementById('detailPanel')?.classList.remove('open');
        document.getElementById('detailOverlay')?.classList.remove('visible');
        document.getElementById('apiModal')?.classList.remove('visible');
      }
    });
  }

  // ── RESTORE SAVED SETTINGS ──
  function restoreSettings() {
    const savedInterval = Utils.lsGet(CONFIG.STORAGE_KEYS.REFRESH_INT);
    if (savedInterval !== null) {
      const sel = document.getElementById('refreshInterval');
      if (sel) sel.value = savedInterval;
    }
  }

  // ── REGISTER SERVICE WORKER ──
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(() => console.log('[SW] Service worker registered'))
        .catch(err => console.warn('[SW] Registration failed:', err));
    }
  }

  // ── BOOT ──
  async function init() {
    console.log(`[App] ${CONFIG.APP_NAME} v${CONFIG.VERSION} starting…`);

    // Initialize modules
    ApiKey.init();
    Table.init();
    Filters.init();
    bindEvents();
    initMobileMenu();
    restoreSettings();
    registerSW();

    // Set initial UTC time
    document.getElementById('lastUpdate').textContent = Utils.formatTimeShort();

    // If keys already saved → fetch immediately
    if (ApiKey.hasAnyKey()) {
      await Api.fetchAll();
      const interval = parseInt(Utils.lsGet(CONFIG.STORAGE_KEYS.REFRESH_INT) || '30');
      startRefresh(interval);
    } else {
      Api.setStatus('idle', 'No API configured');
      // Show empty state
      const empty = document.getElementById('emptyState');
      if (empty) empty.classList.add('visible');
      const scroll = document.querySelector('.table-scroll');
      if (scroll) scroll.style.display = 'none';
    }

    console.log('[App] Ready.');
  }

  return { init, refresh, startRefresh, stopRefresh };
})();

// ── EXPOSE App globally for cross-module use ──
window.App = App;

// ── BOOT ON DOM READY ──
document.addEventListener('DOMContentLoaded', () => App.init());
