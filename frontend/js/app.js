// ── MOBILE DROPDOWN MENU ──
(function initMobileMenu() {
  const menuBtn  = document.getElementById('mobileMenuBtn');
  const dropdown = document.getElementById('mobileDropdown');
  const overlay  = document.getElementById('mobileDropdownOverlay');

  function openMenu() {
    dropdown.classList.add('open');
    overlay.classList.add('open');
  }

  function closeMenu() {
    dropdown.classList.remove('open');
    overlay.classList.remove('open');
  }

  menuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.contains('open') ? closeMenu() : openMenu();
  });

  overlay?.addEventListener('click', closeMenu);

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
    document.getElementById(ddId)?.addEventListener('click', () => {
      closeMenu();
      document.getElementById(btnId)?.click();
    });
  });
})();
