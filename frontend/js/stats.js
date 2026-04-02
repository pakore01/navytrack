/* ============================================================
   STATS.JS — Statistics panel
   ============================================================ */

'use strict';

const Stats = (() => {

  function open() {
    render();
    document.getElementById('statsModal')?.classList.add('visible');
  }

  function close() {
    document.getElementById('statsModal')?.classList.remove('visible');
  }

  function render() {
    const body = document.getElementById('statsBody');
    if (!body) return;

    const flights = STATE.raw.flights || [];
    const carriers = STATE.raw.carriers || [];
    const all = [...flights, ...carriers];

    if (!all.length) {
      body.innerHTML = '<div class="history-empty">No data available yet</div>';
      return;
    }

    // By country flag
    const byCountry = {};
    flights.forEach(f => {
      const flag = getFlag(f.icao, f.registration || '');
      byCountry[flag] = (byCountry[flag] || 0) + 1;
    });

    // By aircraft type
    const byType = {};
    flights.forEach(f => {
      const type = f.aircraft || 'Unknown';
      byType[type] = (byType[type] || 0) + 1;
    });

    // By status
    const airborne = flights.filter(f => !f.on_ground).length;
    const ground   = flights.filter(f => f.on_ground).length;
    const usNavy   = flights.filter(f => {
      const hex = (f.icao || '').toUpperCase();
      return hex.startsWith('AE') || hex.startsWith('ADF');
    }).length;

    // Top types sorted
    const topTypes = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Top countries sorted
    const topCountries = Object.entries(byCountry)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const maxType    = topTypes[0]?.[1]    || 1;
    const maxCountry = topCountries[0]?.[1] || 1;

    body.innerHTML = `
      <div class="stats-grid">
        <div class="stat-block">
          <div class="stat-block-value">${flights.length}</div>
          <div class="stat-block-label">Total Flights</div>
        </div>
        <div class="stat-block">
          <div class="stat-block-value" style="color:var(--color-accent)">${airborne}</div>
          <div class="stat-block-label">Airborne</div>
        </div>
        <div class="stat-block">
          <div class="stat-block-value" style="color:var(--color-text-muted)">${ground}</div>
          <div class="stat-block-label">On Ground</div>
        </div>
        <div class="stat-block">
          <div class="stat-block-value" style="color:var(--color-blue)">${usNavy}</div>
          <div class="stat-block-label">US Navy</div>
        </div>
      </div>

      <div class="stats-section">
        <div class="stats-section-title">By Aircraft Type</div>
        ${topTypes.map(([type, count]) => `
          <div class="stats-bar-row">
            <div class="stats-bar-label">${escHtml(type)}</div>
            <div class="stats-bar-track">
              <div class="stats-bar-fill" style="width:${Math.round(count/maxType*100)}%"></div>
            </div>
            <div class="stats-bar-count">${count}</div>
          </div>
        `).join('')}
      </div>

      <div class="stats-section">
        <div class="stats-section-title">By Country</div>
        ${topCountries.map(([flag, count]) => `
          <div class="stats-bar-row">
            <div class="stats-bar-label" style="font-size:1.2rem">${flag}</div>
            <div class="stats-bar-track">
              <div class="stats-bar-fill" style="width:${Math.round(count/maxCountry*100)}%;background:var(--color-blue)"></div>
            </div>
            <div class="stats-bar-count">${count}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function getFlag(icao, registration) {
    const hex = (icao || '').toUpperCase();
    const reg = (registration || '').toUpperCase();
    if (hex.startsWith('AE') || hex.startsWith('ADF') || reg.startsWith('16')) return '🇺🇸';
    if (hex.startsWith('3F') || reg.startsWith('15+')) return '🇩🇪';
    if (hex.startsWith('43')) return '🇫🇷';
    if (hex.startsWith('40')) return '🇬🇧';
    if (hex.startsWith('48')) return '🇮🇹';
    if (hex.startsWith('34')) return '🇪🇸';
    if (hex.startsWith('38')) return '🇳🇱';
    if (hex.startsWith('71')) return '🇹🇷';
    if (hex.startsWith('74')) return '🇸🇦';
    if (hex.startsWith('70')) return '🇮🇱';
    if (hex.startsWith('89')) return '🇯🇵';
    if (hex.startsWith('78')) return '🇦🇪';
    if (hex.startsWith('50')) return '🇵🇱';
    if (hex.startsWith('4B')) return '🇬🇷';
    return '🌍';
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function init() {
    document.getElementById('statsBtn')?.addEventListener('click', open);
    document.getElementById('closeStatsBtn')?.addEventListener('click', close);
    document.getElementById('statsModal')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) close();
    });
  }

  return { init, render, open, close };
})();
