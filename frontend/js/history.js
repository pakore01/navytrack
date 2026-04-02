/* ============================================================
   HISTORY.JS — Flight history panel
   ============================================================ */

'use strict';

const History = (() => {

  const STORAGE_KEY = 'navytrack_history';
  let entries = [];

  function load() {
    try { entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { entries = []; }
  }

  function add(row) {
    load();
    const exists = entries.find(e => e.icao === row.icao && (Date.now() - e.seen) < 60000);
    if (exists) return;
    entries.unshift({
      icao:     row.icao,
      callsign: row.callsign || '—',
      aircraft: row.aircraft || '—',
      lat:      row.lat,
      lon:      row.lon,
      altitude: row.altitude,
      speed:    row.speed,
      source:   row.source,
      seen:     Date.now(),
    });
    if (entries.length > 500) entries = entries.slice(0, 500);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch {}
  }

  function clear() {
    entries = [];
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    render();
  }

  function render() {
    load();
    const body = document.getElementById('historyBody');
    if (!body) return;

    if (!entries.length) {
      body.innerHTML = '<div class="history-empty">No aircraft detected yet</div>';
      return;
    }

    body.innerHTML = '<table class="data-table" style="width:100%">' +
      '<thead><tr>' +
      '<th>Time</th>' +
      '<th>Callsign</th>' +
      '<th>ICAO</th>' +
      '<th>Aircraft</th>' +
      '<th>Altitude</th>' +
      '<th>Speed</th>' +
      '<th>Source</th>' +
      '</tr></thead>' +
      '<tbody>' +
      entries.map(e => {
        const time = new Date(e.seen).toUTCString().substring(17, 25) + ' UTC';
        return '<tr>' +
          '<td class="cell-mono" style="white-space:nowrap">' + time + '</td>' +
          '<td class="cell-callsign">' + escHtml(e.callsign) + '</td>' +
          '<td class="cell-mono cell-muted">' + escHtml(e.icao) + '</td>' +
          '<td class="cell-muted">' + escHtml(e.aircraft) + '</td>' +
          '<td class="cell-mono">' + (e.altitude ? e.altitude.toLocaleString() + ' ft' : '—') + '</td>' +
          '<td class="cell-mono">' + (e.speed ? Math.round(e.speed) + ' kts' : '—') + '</td>' +
          '<td class="cell-muted" style="font-size:0.65rem">' + escHtml(e.source || '—') + '</td>' +
          '</tr>';
      }).join('') +
      '</tbody></table>';
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function open() {
    render();
    document.getElementById('historyModal')?.classList.add('visible');
  }

  function close() {
    document.getElementById('historyModal')?.classList.remove('visible');
  }

  function init() {
    load();
    document.getElementById('historyBtn')?.addEventListener('click', open);
    document.getElementById('closeHistoryBtn')?.addEventListener('click', close);
    document.getElementById('clearHistoryBtn')?.addEventListener('click', () => {
      clear();
      Utils.toast('History cleared', 'info', 2000);
    });
    document.getElementById('historyModal')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) close();
    });
  }

  return { init, add, clear, render, open };
})();
