/* ============================================================
   THEME.JS — Light / Dark mode toggle
   ============================================================ */

'use strict';

const Theme = (() => {

  const STORAGE_KEY = 'navytrack_theme';

  function current() {
    return localStorage.getItem(STORAGE_KEY) || 'dark';
  }

  function apply(theme) {
    if (theme === 'light') {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
    localStorage.setItem(STORAGE_KEY, theme);
    updateIcon(theme);
  }

  function toggle() {
    const next = current() === 'dark' ? 'light' : 'dark';
    apply(next);
  }

  function updateIcon(theme) {
    const btn = document.getElementById('themeBtn');
    if (!btn) return;
    if (theme === 'light') {
      btn.innerHTML = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8">
        <circle cx="10" cy="10" r="4"/>
        <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke-linecap="round"/>
      </svg>`;
      btn.title = 'Switch to dark mode';
    } else {
      btn.innerHTML = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M10 2a8 8 0 1 0 8 8 6 6 0 0 1-8-8z" stroke-linecap="round"/>
      </svg>`;
      btn.title = 'Switch to light mode';
    }
  }

  function init() {
    apply(current());
    document.getElementById('themeBtn')?.addEventListener('click', toggle);
  }

  return { init, toggle, current };
})();
