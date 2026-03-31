/* ============================================================
   TABLE.JS — Table rendering, sorting, row detail panel
   ============================================================ */

'use strict';

const Table = (() => {

  let sortCol = 'callsign';
  let sortDir = 'asc';

  // ── RENDER TABLE ──
  function render(data = []) {
    const tbody = document.getElementById('tableBody');
    const count = document.getElementById('tableCount');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!data.length) {
      if (count) count.textContent = '0 results';
      return;
    }

    if (count) count.textContent = `${data.length} result${data.length !== 1 ? 's' : ''}`;

    const fragment = document.createDocumentFragment();

    data.forEach((row, idx) => {
      const tr = document.createElement('tr');
      tr.dataset.idx = idx;

      const isCarrier   = row.type === 'carrier';
      const statusClass = isCarrier ? 'at-sea' : (row.on_ground ? 'ground' : 'airborne');
      const statusLabel = isCarrier ? 'At Sea'  : (row.on_ground ? 'On Ground' : 'Airborne');

      tr.innerHTML = `
        <td>
          <span class="type-badge ${row.type}">
            ${row.type === 'carrier' ? '⚓' : '✈'} ${row.type === 'carrier' ? 'Carrier' : 'Flight'}
          </span>
        </td>
        <td class="cell-callsign">${escHtml(row.callsign)}</td>
        <td class="cell-mono cell-muted">${escHtml(row.icao)}</td>
        <td>${escHtml(row.aircraft || '—')}</td>
        <td class="cell-muted">${escHtml(row.origin || '—')}</td>
        <td class="cell-muted">${escHtml(row.destination || '—')}</td>
        <td class="cell-mono">${isCarrier ? '—' : Utils.formatAlt(row.altitude)}</td>
        <td class="cell-mono">${Utils.formatSpeed(row.speed)}</td>
        <td class="cell-mono">${Utils.formatHeading(row.heading)}</td>
        <td class="cell-mono">${Utils.formatCoords(row.lat, row.lon)}</td>
        <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
        <td class="cell-muted">${Utils.timeAgo(row.last_seen)}</td>
      `;

      tr.addEventListener('click', () => openDetail(row));
      fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
  }

  // ── SORT ──
  function sort(data, col, dir) {
    const mult = dir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      let va = a[col] ?? '';
      let vb = b[col] ?? '';
      if (typeof va === 'number' && typeof vb === 'number') return mult * (va - vb);
      return mult * String(va).localeCompare(String(vb));
    });
  }

  // ── BIND SORT HEADERS ──
  function bindSort() {
    document.querySelectorAll('.data-table th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (sortCol === col) {
          sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          sortCol = col;
          sortDir = 'asc';
        }

        STATE.sort.col = sortCol;
        STATE.sort.dir = sortDir;

        // Update header classes
        document.querySelectorAll('.data-table th.sortable').forEach(h => {
          h.classList.remove('sorted');
          h.querySelector('.sort-icon').textContent = '↕';
        });
        th.classList.add('sorted');
        th.querySelector('.sort-icon').textContent = sortDir === 'asc' ? '↑' : '↓';

        Filters.apply();
      });
    });
  }

  // ── OPEN DETAIL PANEL ──
  function openDetail(row) {
    const panel   = document.getElementById('detailPanel');
    const overlay = document.getElementById('detailOverlay');
    const title   = document.getElementById('detailTitle');
    const body    = document.getElementById('detailBody');

    if (!panel || !body) return;

    title.textContent = row.callsign || row.icao || '—';

    const isCarrier = row.type === 'carrier';

    body.innerHTML = `
      <div class="detail-section">
        <div class="detail-section-title">Identification</div>
        ${detailRow('Type',         isCarrier ? '⚓ Carrier' : '✈ Military Flight')}
        ${detailRow('Callsign',     row.callsign)}
        ${detailRow(isCarrier ? 'MMSI' : 'ICAO Hex', row.icao)}
        ${detailRow(isCarrier ? 'Hull Number' : 'Registration', row.registration || '—')}
        ${detailRow(isCarrier ? 'Vessel Class' : 'Aircraft Type', row.aircraft || '—')}
        ${detailRow('Data Source',  row.source || '—')}
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Navigation</div>
        ${detailRow('Latitude',     row.lat  != null ? row.lat.toFixed(5) + '° N/S' : '—')}
        ${detailRow('Longitude',    row.lon  != null ? row.lon.toFixed(5) + '° E/W' : '—')}
        ${detailRow('Coordinates',  Utils.formatCoords(row.lat, row.lon))}
        ${!isCarrier ? detailRow('Altitude', Utils.formatAlt(row.altitude)) : ''}
        ${detailRow('Speed',        Utils.formatSpeed(row.speed))}
        ${detailRow('Heading',      Utils.formatHeading(row.heading))}
        ${detailRow('Status',       isCarrier ? 'At Sea' : (row.on_ground ? 'On Ground' : 'Airborne'))}
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Route</div>
        ${detailRow('Origin',       row.origin      || '—', true)}
        ${detailRow('Destination',  row.destination || '—', true)}
        ${!isCarrier ? detailRow('Squawk', row.squawk || '—') : ''}
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Tracking</div>
        ${detailRow('Last Update',  row.last_seen ? new Date(row.last_seen).toUTCString() : '—', true)}
      </div>

      ${row.lat && row.lon ? `
      <a class="btn-primary" 
         href="https://www.openstreetmap.org/?mlat=${row.lat}&mlon=${row.lon}&zoom=6"
         target="_blank" rel="noopener" style="justify-content:center">
        View on Map ↗
      </a>` : ''}
    `;

    panel.classList.add('open');
    overlay.classList.add('visible');
  }

  // ── CLOSE DETAIL PANEL ──
  function closeDetail() {
    document.getElementById('detailPanel')?.classList.remove('open');
    document.getElementById('detailOverlay')?.classList.remove('visible');
  }

  // ── DETAIL ROW HELPER ──
  function detailRow(key, val, plain = false) {
    return `
      <div class="detail-row">
        <span class="detail-key">${escHtml(key)}</span>
        <span class="detail-val${plain ? ' plain' : ''}">${escHtml(String(val ?? '—'))}</span>
      </div>`;
  }

  // ── ESCAPE HTML ──
  function escHtml(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── INIT ──
  function init() {
    bindSort();

    document.getElementById('closeDetail')?.addEventListener('click', closeDetail);
    document.getElementById('detailOverlay')?.addEventListener('click', closeDetail);
  }

  return { render, sort, init };
})();
