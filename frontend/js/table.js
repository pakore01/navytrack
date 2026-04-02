/* ============================================================
   TABLE.JS — Table rendering, sorting, row detail panel
   ============================================================ */

'use strict';

const Table = (() => {

  let sortCol = 'callsign';
  let sortDir = 'asc';
  let knownICAOs = new Set();
  let history = [];
  try { history = JSON.parse(localStorage.getItem('navytrack_history') || '[]'); } catch {}

  // ── AIRCRAFT TYPE ICON ──
  function getAircraftIcon(aircraft) {
    if (!aircraft) return '✈';
    const a = aircraft.toUpperCase();
    if (a.includes('HELICOPTER') || a.includes('SEAHAWK') || a.includes('BLACK HAWK') ||
        a.includes('CHINOOK') || a.includes('APACHE') || a.includes('MH-60') ||
        a.includes('UH-60') || a.includes('CH-47') || a.includes('AW-') ||
        a.includes('AGUSTA') || a.includes('SIKORSKY') || a.includes('EC-135')) return '🚁';
    if (a.includes('PREDATOR') || a.includes('REAPER') || a.includes('GLOBAL HAWK') ||
        a.includes('UAV') || a.includes('DRONE')) return '🛸';
    if (a.includes('TANKER') || a.includes('KC-135') || a.includes('KC-10') ||
        a.includes('STRATOTANKER')) return '⛽';
    if (a.includes('C-130') || a.includes('C-17') || a.includes('C-5') ||
        a.includes('HERCULES') || a.includes('GLOBEMASTER') || a.includes('GALAXY') ||
        a.includes('TRANSPORT') || a.includes('C-2') || a.includes('C-40')) return '📦';
    if (a.includes('P-8') || a.includes('POSEIDON') || a.includes('ORION') ||
        a.includes('MARITIME') || a.includes('PATROL')) return '🔍';
    if (a.includes('E-2') || a.includes('HAWKEYE') || a.includes('AWACS') ||
        a.includes('SENTRY') || a.includes('E-3') || a.includes('AEW')) return '📡';
    if (a.includes('EA-18') || a.includes('GROWLER') || a.includes('ELECTRONIC')) return '⚡';
    if (a.includes('F-16') || a.includes('F-18') || a.includes('F-35') ||
        a.includes('F-15') || a.includes('HORNET') || a.includes('FALCON') ||
        a.includes('FIGHTER') || a.includes('STRIKE')) return '🚀';
    if (a.includes('E-6') || a.includes('MERCURY') || a.includes('COMMAND')) return '📻';
    if (a.includes('OSPREY') || a.includes('V-22')) return '🔄';
    if (a.includes('DORNIER') || a.includes('BEECH') || a.includes('CESSNA') ||
        a.includes('KING AIR')) return '✈';
    return '✈';
  }

  function getFlag(icao, registration) {
    const hex = (icao || '').toUpperCase();
    const reg = (registration || '').toUpperCase();
    if (hex.startsWith('AE') || hex.startsWith('ADF') || reg.startsWith('16')) return '🇺🇸';
    if (hex.startsWith('3F') || reg.startsWith('15+') || reg.startsWith('16+')) return '🇩🇪';
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
    if (hex.startsWith('4B')) return '🇬🇷';
    if (hex.startsWith('33')) return '🇮🇹';
    if (hex.startsWith('50')) return '🇵🇱';
    return '🌍';
  }

  function isUSNavy(row) {
    const hex  = (row.icao      || '').toUpperCase();
    const call = (row.callsign  || '').toUpperCase();
    const reg  = (row.registration || '').toUpperCase();
    return hex.startsWith('AE') || hex.startsWith('ADF') ||
           call.startsWith('NAVY') || call.startsWith('RCH') ||
           call.startsWith('CNV')  || call.startsWith('VXS') ||
           reg.startsWith('16');
  }

  async function fetchPhoto(icao) {
    if (!icao || icao === '—') return null;
    try {
      const res = await fetch('https://api.planespotters.net/pub/photos/hex/' + icao);
      if (!res.ok) return null;
      const data = await res.json();
      const photo = data.photos && data.photos[0];
      if (!photo) return null;
      return {
        url: (photo.thumbnail_large && photo.thumbnail_large.src) || (photo.thumbnail && photo.thumbnail.src),
        photographer: photo.photographer || '',
        link: photo.link || '',
      };
    } catch { return null; }
  }

  function saveToHistory(row) {
    const entry = { icao: row.icao, callsign: row.callsign, aircraft: row.aircraft, lat: row.lat, lon: row.lon, seen: Date.now() };
    history.unshift(entry);
    if (history.length > 200) history = history.slice(0, 200);
    try { localStorage.setItem('navytrack_history', JSON.stringify(history)); } catch {}
  }

  function notifyNew(row) {
    const flag = getFlag(row.icao, row.registration);
    const navy = isUSNavy(row) ? ' 🇺🇸 US NAVY' : '';
    Utils.toast(flag + navy + ' New: ' + (row.callsign || row.icao) + ' — ' + (row.aircraft || 'Military'), 'info', 5000);
  }

  function render(data) {
    data = data || [];
    const tbody = document.getElementById('tableBody');
    const count = document.getElementById('tableCount');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!data.length) {
      if (count) count.textContent = '0 results';
      return;
    }

    if (count) count.textContent = data.length + ' result' + (data.length !== 1 ? 's' : '');

    const fragment = document.createDocumentFragment();
    let newCount = 0;

    data.forEach(function(row) {
      const tr = document.createElement('tr');
      const isCarrier   = row.type === 'carrier';
      const navy        = isUSNavy(row);
      const statusClass = isCarrier ? 'at-sea' : (row.on_ground ? 'ground' : 'airborne');
      const statusLabel = isCarrier ? 'At Sea' : (row.on_ground ? 'On Ground' : 'Airborne');
      const flag        = getFlag(row.icao, row.registration || '');
      const navyBadge   = navy ? '<span class="navy-badge">US NAVY</span>' : '';

      if (!knownICAOs.has(row.icao) && knownICAOs.size > 0) {
        if (newCount < 3) { notifyNew(row); newCount++; }
        saveToHistory(row);
      }
      History.add(row);
      knownICAOs.add(row.icao);

      const heading = row.heading != null ? Math.round(row.heading) : null;
      const headingCell = heading != null
        ? '<span class="heading-arrow"><span class="heading-dial"><svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform:rotate(' + heading + 'deg)"><path d="M10 2L13 14H10V18H10L7 14H10V2Z" fill="#0057FF" opacity="0.9"/><circle cx="10" cy="10" r="9" stroke="#E2E5EA" stroke-width="1" fill="none"/></svg></span><span class="cell-mono">' + heading + '°</span></span>'
        : '—';

      tr.innerHTML =
        '<td><span class="type-badge ' + row.type + '">' + (row.type === 'carrier' ? '⚓ Carrier' : '✈ Flight') + '</span></td>' +
        '<td class="cell-callsign">' + flag + ' ' + escHtml(row.callsign || '—') + navyBadge + '</td>' +
        '<td class="cell-mono cell-muted">' + escHtml(row.icao) + '</td>' +
        '<td>' + getAircraftIcon(row.aircraft) + ' ' + escHtml(row.aircraft || '—') + '</td>' +
        '<td class="cell-muted">' + escHtml(row.origin || '—') + '</td>' +
        '<td class="cell-muted">' + escHtml(row.destination || '—') + '</td>' +
        '<td class="cell-mono">' + (isCarrier ? '—' : Utils.formatAlt(row.altitude)) + '</td>' +
        '<td class="cell-mono">' + Utils.formatSpeed(row.speed) + '</td>' +
        '<td>' + headingCell + '</td>' +
        '<td class="cell-mono">' + Utils.formatCoords(row.lat, row.lon) + '</td>' +
        '<td><span class="status-badge ' + statusClass + '">' + statusLabel + '</span></td>' +
        '<td class="cell-muted">' + Utils.timeAgo(row.last_seen) + '</td>';

      tr.addEventListener('click', function() { openDetail(row); });
      fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
  }

  function sort(data, col, dir) {
    const mult = dir === 'asc' ? 1 : -1;
    return [].concat(data).sort(function(a, b) {
      var va = a[col] != null ? a[col] : '';
      var vb = b[col] != null ? b[col] : '';
      if (typeof va === 'number' && typeof vb === 'number') return mult * (va - vb);
      return mult * String(va).localeCompare(String(vb));
    });
  }

  function bindSort() {
    document.querySelectorAll('.data-table th.sortable').forEach(function(th) {
      th.addEventListener('click', function() {
        const col = th.dataset.col;
        if (sortCol === col) {
          sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          sortCol = col;
          sortDir = 'asc';
        }
        STATE.sort.col = sortCol;
        STATE.sort.dir = sortDir;
        document.querySelectorAll('.data-table th.sortable').forEach(function(h) {
          h.classList.remove('sorted');
          h.querySelector('.sort-icon').textContent = '↕';
        });
        th.classList.add('sorted');
        th.querySelector('.sort-icon').textContent = sortDir === 'asc' ? '↑' : '↓';
        Filters.apply();
      });
    });
  }

  async function openDetail(row) {
    const panel   = document.getElementById('detailPanel');
    const overlay = document.getElementById('detailOverlay');
    const title   = document.getElementById('detailTitle');
    const body    = document.getElementById('detailBody');
    if (!panel || !body) return;

    const isCarrier = row.type === 'carrier';
    const navy      = isUSNavy(row);
    const flag      = getFlag(row.icao, row.registration || '');

    title.textContent = flag + ' ' + (row.callsign || row.icao || '—');

    body.innerHTML =
      '<div class="detail-photo-wrap" id="photoWrap"><div class="detail-photo-loading">Loading photo…</div></div>' +
      (navy ? '<div class="detail-navy-banner">🇺🇸 US Navy Aircraft</div>' : '') +
      '<div class="detail-section"><div class="detail-section-title">Identification</div>' +
      detailRow('Type', isCarrier ? '⚓ Carrier' : '✈ Military Flight') +
      detailRow('Callsign', row.callsign) +
      detailRow(isCarrier ? 'MMSI' : 'ICAO Hex', row.icao) +
      detailRow(isCarrier ? 'Hull Number' : 'Registration', row.registration || '—') +
      detailRow(isCarrier ? 'Vessel Class' : 'Aircraft Type', row.aircraft || '—') +
      detailRow('Country', flag) +
      detailRow('Data Source', row.source || '—') +
      '</div>' +
      '<div class="detail-section"><div class="detail-section-title">Navigation</div>' +
      detailRow('Coordinates', Utils.formatCoords(row.lat, row.lon)) +
      (!isCarrier ? detailRow('Altitude', Utils.formatAlt(row.altitude)) : '') +
      detailRow('Speed', Utils.formatSpeed(row.speed)) +
      detailRow('Heading', Utils.formatHeading(row.heading)) +
      detailRow('Status', isCarrier ? 'At Sea' : (row.on_ground ? 'On Ground' : 'Airborne')) +
      detailRow('Squawk', row.squawk || '—') +
      '</div>' +
      '<div class="detail-section"><div class="detail-section-title">Route</div>' +
      detailRow('Origin', row.origin || '—', true) +
      detailRow('Destination', row.destination || '—', true) +
      detailRow('Last Update', row.last_seen ? new Date(row.last_seen).toUTCString() : '—', true) +
      '</div>' +
      (row.lat && row.lon ?
        '<div class="detail-section"><div class="detail-section-title">Live Position</div>' +
        '<div class="detail-map-wrap"><iframe src="https://www.openstreetmap.org/export/embed.html?bbox=' +
        (row.lon - 3) + '%2C' + (row.lat - 3) + '%2C' + (row.lon + 3) + '%2C' + (row.lat + 3) +
        '&layer=mapnik&marker=' + row.lat + '%2C' + row.lon +
        '" class="detail-map" loading="lazy"></iframe></div>' +
        '<a class="btn-secondary" style="margin-top:8px;justify-content:center;display:flex" href="https://www.openstreetmap.org/?mlat=' + row.lat + '&mlon=' + row.lon + '&zoom=7" target="_blank" rel="noopener">Open full map ↗</a>' +
        '</div>' : '');

    panel.classList.add('open');
    overlay.classList.add('visible');

    if (!isCarrier) {
      fetchPhoto(row.icao).then(function(photo) {
        const wrap = document.getElementById('photoWrap');
        if (!wrap) return;
        if (photo && photo.url) {
          wrap.innerHTML =
            '<a href="' + photo.link + '" target="_blank" rel="noopener">' +
            '<img src="' + photo.url + '" class="detail-photo" alt="' + escHtml(row.aircraft || row.icao) + '" loading="lazy"/></a>' +
            '<div class="detail-photo-credit">📷 ' + escHtml(photo.photographer) + '</div>';
        } else {
          wrap.innerHTML = '<div class="detail-photo-none">No photo available</div>';
        }
      });
    } else {
      const wrap = document.getElementById('photoWrap');
      if (wrap) wrap.innerHTML = '';
    }
  }

  function closeDetail() {
    document.getElementById('detailPanel') && document.getElementById('detailPanel').classList.remove('open');
    document.getElementById('detailOverlay') && document.getElementById('detailOverlay').classList.remove('visible');
  }

  function detailRow(key, val, plain) {
    return '<div class="detail-row"><span class="detail-key">' + escHtml(key) + '</span><span class="detail-val' + (plain ? ' plain' : '') + '">' + escHtml(String(val != null ? val : '—')) + '</span></div>';
  }

  function escHtml(str) {
    return String(str != null ? str : '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function init() {
    bindSort();
    document.getElementById('closeDetail') && document.getElementById('closeDetail').addEventListener('click', closeDetail);
    document.getElementById('detailOverlay') && document.getElementById('detailOverlay').addEventListener('click', closeDetail);
  }

  return { render: render, sort: sort, init: init };
})();
