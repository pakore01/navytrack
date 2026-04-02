/* ============================================================
   ALERTS_HISTORY.JS — Telegram alerts history panel
   ============================================================ */

'use strict';

const AlertsHistory = (() => {

  async function load() {
    const body = document.getElementById('alertsHistoryBody');
    if (!body) return;
    body.innerHTML = '<div class="history-empty">Loading...</div>';

    try {
      const res = await fetch(CONFIG.BACKEND_URL + '/api/alerts-history');
      const data = await res.json();
      const alerts = data.alerts || [];

      if (!alerts.length) {
        body.innerHTML = '<div class="history-empty">No alerts sent yet</div>';
        return;
      }

      body.innerHTML = '<table class="data-table" style="width:100%">' +
        '<thead><tr>' +
        '<th>Time</th><th>Callsign</th><th>ICAO</th><th>Aircraft</th><th>Region</th><th>Matched</th>' +
        '</tr></thead><tbody>' +
        alerts.map(a => {
          const time = a.time ? new Date(a.time).toUTCString().substring(0,25) : '—';
          const mapsUrl = a.lat && a.lon
            ? `https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lon}&zoom=7`
            : null;
          return '<tr>' +
            '<td class="cell-mono" style="font-size:0.68rem;white-space:nowrap">' + escHtml(time) + '</td>' +
            '<td class="cell-callsign">' + (mapsUrl ? '<a href="' + mapsUrl + '" target="_blank" style="color:var(--color-accent)">' + escHtml(a.callsign || '—') + '</a>' : escHtml(a.callsign || '—')) + '</td>' +
            '<td class="cell-mono cell-muted">' + escHtml(a.icao || '—') + '</td>' +
            '<td class="cell-muted" style="font-size:0.72rem">' + escHtml(a.aircraft || '—') + '</td>' +
            '<td><span style="font-size:0.68rem;color:var(--color-accent);font-family:var(--font-mono)">' + escHtml(a.region || '—') + '</span></td>' +
            '<td><span style="font-size:0.68rem;color:var(--color-danger);font-family:var(--font-mono);background:var(--color-danger-bg);padding:2px 6px;border-radius:3px">' + escHtml(a.matched || '—') + '</span></td>' +
            '</tr>';
        }).join('') +
        '</tbody></table>';

    } catch {
      body.innerHTML = '<div class="history-empty">Error loading alerts history</div>';
    }
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function open() {
    load();
    document.getElementById('alertsHistoryModal')?.classList.add('visible');
  }

  function close() {
    document.getElementById('alertsHistoryModal')?.classList.remove('visible');
  }

  function init() {
    document.getElementById('alertsHistoryBtn')?.addEventListener('click', open);
    document.getElementById('closeAlertsHistoryBtn')?.addEventListener('click', close);
    document.getElementById('alertsHistoryModal')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) close();
    });
  }

  return { init, open };
})();
