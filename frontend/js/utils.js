/* ============================================================
   UTILS.JS — Shared helper functions
   ============================================================ */

'use strict';

const Utils = (() => {

  // ── FORMAT UTC TIME ──
  function formatUTC(date = new Date()) {
    return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  }

  // ── FORMAT TIME SHORT ──
  function formatTimeShort(date = new Date()) {
    return date.toUTCString().substring(17, 25) + ' UTC';
  }

  // ── ELAPSED SINCE ──
  function timeAgo(timestamp) {
    if (!timestamp) return '—';
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60)  return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }

  // ── FORMAT ALTITUDE ──
  function formatAlt(ft) {
    if (ft == null || ft === '') return '—';
    return `${Number(ft).toLocaleString()} ft`;
  }

  // ── FORMAT SPEED ──
  function formatSpeed(kts) {
    if (kts == null || kts === '') return '—';
    return `${Math.round(kts)} kts`;
  }

  // ── FORMAT HEADING ──
  function formatHeading(deg) {
    if (deg == null || deg === '') return '—';
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    const idx = Math.round(deg / 22.5) % 16;
    return `${Math.round(deg)}° ${dirs[idx]}`;
  }

  // ── FORMAT COORDINATES ──
  function formatCoords(lat, lon) {
    if (lat == null || lon == null) return '—';
    const la = parseFloat(lat).toFixed(4);
    const lo = parseFloat(lon).toFixed(4);
    const latD = la >= 0 ? 'N' : 'S';
    const lonD = lo >= 0 ? 'E' : 'W';
    return `${Math.abs(la)}°${latD} ${Math.abs(lo)}°${lonD}`;
  }

  // ── IDENTIFY AIRCRAFT TYPE FROM REGISTRATION / MODEL ──
  function resolveAircraftType(model = '', registration = '') {
    const str = `${model} ${registration}`.toUpperCase();
    for (const [key, val] of Object.entries(CONFIG.AIRCRAFT_TYPES)) {
      if (str.includes(key.toUpperCase())) return val;
    }
    return null;
  }

  // ── IS IN MIDDLE EAST BOUNDS ──
  function isInMiddleEast(lat, lon) {
    const b = CONFIG.MIDDLE_EAST_BOUNDS;
    return lat >= b.lat_min && lat <= b.lat_max &&
           lon >= b.lon_min && lon <= b.lon_max;
  }

  // ── SAFE GET FROM LOCAL STORAGE ──
  function lsGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  // ── SAFE SET TO LOCAL STORAGE ──
  function lsSet(key, val) {
    try { localStorage.setItem(key, val); return true; } catch { return false; }
  }

  // ── DEBOUNCE ──
  function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // ── SHOW TOAST ──
  function toast(msg, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  // ── EXPORT TABLE DATA AS CSV ──
  function exportCSV(data, filename = 'navytrack-export.csv') {
    if (!data || !data.length) { toast('No data to export', 'warning'); return; }
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row =>
      Object.values(row).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast('Export complete', 'success');
  }

  // ── GET CARRIER BY MMSI ──
  function getCarrierByMMSI(mmsi) {
    return CONFIG.CARRIERS.find(c => c.mmsi === String(mmsi)) || null;
  }

  // ── HEADING TO COMPASS ARROW ──
  function headingArrow(deg) {
    if (deg == null) return '→';
    const arrows = ['↑','↗','→','↘','↓','↙','←','↖'];
    return arrows[Math.round(deg / 45) % 8];
  }

  return {
    formatUTC, formatTimeShort, timeAgo,
    formatAlt, formatSpeed, formatHeading, formatCoords,
    resolveAircraftType, isInMiddleEast,
    lsGet, lsSet, debounce,
    toast, exportCSV,
    getCarrierByMMSI, headingArrow,
  };
})();
