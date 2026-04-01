/* ============================================================
   ALERTS.JS — Callsign watchlist and notifications
   ============================================================ */

'use strict';

const Alerts = (() => {

  const STORAGE_KEY = 'navytrack_watchlist';
  let watchlist = [];
  let triggered = new Set();

  // ── LOAD FROM STORAGE ──
  function load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      watchlist = saved ? JSON.parse(saved) : [];
    } catch {
      watchlist = [];
    }
  }

  // ── SAVE TO STORAGE ──
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
    } catch {}
  }

  // ── ADD CALLSIGN ──
  function add(callsign) {
    const clean = callsign.trim().toUpperCase();
    if (!clean || watchlist.includes(clean)) return;
    watchlist.push(clean);
    save();
    renderList();
  }

  // ── REMOVE CALLSIGN ──
  function remove(callsign) {
    watchlist = watchlist.filter(c => c !== callsign);
    triggered.delete(callsign);
    save();
    renderList();
  }

  // ── CHECK FLIGHTS AGAINST WATCHLIST ──
  function check(flights = []) {
    if (!watchlist.length) return;

    flights.forEach(row => {
      const callsign = (row.callsign || '').trim().toUpperCase();
      const icao     = (row.icao     || '').trim().toUpperCase();

      const matched = watchlist.find(w =>
        callsign.includes(w) || icao.includes(w)
      );

      if (matched && !triggered.has(callsign + icao)) {
        triggered.add(callsign + icao);
        fireAlert(row, matched);
      }
    });

    // Reset triggered when aircraft disappears
    const activeKeys = new Set(
      flights.map(r => (r.callsign || '').toUpperCase() + (r.icao || '').toUpperCase())
    );
    for (const key of triggered) {
      if (!activeKeys.has(key)) triggered.delete(key);
    }
  }

  // ── FIRE ALERT ──
  function fireAlert(row, matched) {
    // Toast
    Utils.toast(
      `🚨 ALERT: ${row.callsign || row.icao} matched "${matched}" — ${row.aircraft || 'Military'} detected`,
      'error',
      8000
    );

    // Sound
    playAlertSound();

    // Browser notification if permitted
    if (Notification.permission === 'granted') {
      new Notification('NavyTrack Alert', {
        body: `${row.callsign || row.icao} — ${row.aircraft || 'Military aircraft'} detected in Middle East`,
        icon: '/icons/icon-192.png',
      });
    }
  }

  // ── PLAY ALERT SOUND ──
  function playAlertSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [440, 550, 660].forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.3);
      });
    } catch {}
  }

  // ── REQUEST NOTIFICATION PERMISSION ──
  function requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  // ── RENDER WATCHLIST UI ──
  function renderList() {
    const container = document.getElementById('watchlistItems');
    if (!container) return;

    if (!watchlist.length) {
      container.innerHTML = '<span class="watchlist-empty">No callsigns configured</span>';
      return;
    }

    container.innerHTML = watchlist.map(c => `
      <span class="watchlist-tag">
        ${c}
        <button onclick="Alerts.remove('${c}')" class="watchlist-remove">×</button>
      </span>
    `).join('');
  }

  // ── INIT ──
  function init() {
    load();
    requestPermission();

    // Add button
    document.getElementById('watchlistAdd')?.addEventListener('click', () => {
      const input = document.getElementById('watchlistInput');
      if (input?.value.trim()) {
        add(input.value);
        input.value = '';
      }
    });

    // Enter key
    document.getElementById('watchlistInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const input = e.target;
        if (input.value.trim()) {
          add(input.value);
          input.value = '';
        }
      }
    });

    renderList();
  }

  return { init, check, add, remove, renderList };
})();
