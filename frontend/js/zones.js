/* ============================================================
   ZONES.JS — Geographic alert zones
   ============================================================ */

'use strict';

const Zones = (() => {

  const STORAGE_KEY = 'navytrack_zones';
  let zones = [];
  let triggered = new Map(); // zoneId -> Set of ICAOs

  function load() {
    try { zones = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { zones = []; }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(zones)); } catch {}
  }

  function add(name, lat, lon, radiusKm) {
    const zone = {
      id:       Date.now(),
      name:     name.trim(),
      lat:      parseFloat(lat),
      lon:      parseFloat(lon),
      radius:   parseFloat(radiusKm),
      active:   true,
      created:  Date.now(),
    };
    zones.push(zone);
    triggered.set(zone.id, new Set());
    save();
    renderList();
    Utils.toast('Zone "' + zone.name + '" created', 'success', 3000);
  }

  function remove(id) {
    zones = zones.filter(z => z.id !== id);
    triggered.delete(id);
    save();
    renderList();
  }

  function toggle(id) {
    const zone = zones.find(z => z.id === id);
    if (zone) {
      zone.active = !zone.active;
      if (!zone.active) triggered.set(id, new Set());
      save();
      renderList();
    }
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dlat = (lat2 - lat1) * Math.PI / 180;
    const dlon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dlat/2)**2 +
              Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dlon/2)**2;
    return R * 2 * Math.asin(Math.sqrt(a));
  }

  function check(flights) {
    load();
    if (!zones.length) return;

    flights.forEach(function(row) {
      if (!row.lat || !row.lon) return;

      zones.forEach(function(zone) {
        if (!zone.active) return;

        const dist = haversine(row.lat, row.lon, zone.lat, zone.lon);
        const t = triggered.get(zone.id) || new Set();

        if (dist <= zone.radius && !t.has(row.icao)) {
          t.add(row.icao);
          triggered.set(zone.id, t);
          fireZoneAlert(row, zone, dist);
        } else if (dist > zone.radius * 1.2 && t.has(row.icao)) {
          t.delete(row.icao);
        }
      });
    });
  }

  function fireZoneAlert(row, zone, dist) {
    const msg = '🔴 ZONE ALERT: ' + (row.callsign || row.icao) +
                ' entered "' + zone.name + '" (' + Math.round(dist) + ' km from center)';
    Utils.toast(msg, 'error', 8000);

    // Telegram via backend
    fetch(CONFIG.BACKEND_URL + '/api/zone-alert', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        zone:     zone.name,
        icao:     row.icao,
        callsign: row.callsign || row.icao,
        aircraft: row.aircraft || 'Military',
        lat:      row.lat,
        lon:      row.lon,
        dist_km:  Math.round(dist),
      })
    }).catch(() => {});
  }

  function renderList() {
    load();
    const container = document.getElementById('zonesList');
    if (!container) return;

    if (!zones.length) {
      container.innerHTML = '<div class="history-empty">No zones defined</div>';
      return;
    }

    container.innerHTML = zones.map(z => `
      <div class="zone-item ${z.active ? 'active' : 'inactive'}">
        <div class="zone-info">
          <div class="zone-name">${escHtml(z.name)}</div>
          <div class="zone-meta">${z.lat.toFixed(3)}°N ${z.lon.toFixed(3)}°E · ${z.radius} km radius</div>
        </div>
        <div class="zone-actions">
          <button class="zone-toggle" onclick="Zones.toggle(${z.id})">${z.active ? '⏸ Pause' : '▶ Activate'}</button>
          <button class="zone-delete" onclick="Zones.remove(${z.id})">✕</button>
        </div>
      </div>
    `).join('');
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function open() {
    renderList();
    document.getElementById('zonesModal')?.classList.add('visible');
  }

  function close() {
    document.getElementById('zonesModal')?.classList.remove('visible');
  }

  function init() {
    load();
    zones.forEach(z => triggered.set(z.id, new Set()));

    document.getElementById('zonesBtn')?.addEventListener('click', open);
    document.getElementById('closeZonesBtn')?.addEventListener('click', close);
    document.getElementById('zonesModal')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) close();
    });

    document.getElementById('addZoneBtn')?.addEventListener('click', () => {
      const name   = document.getElementById('zoneName')?.value.trim();
      const lat    = document.getElementById('zoneLat')?.value.trim();
      const lon    = document.getElementById('zoneLon')?.value.trim();
      const radius = document.getElementById('zoneRadius')?.value.trim();

      if (!name || !lat || !lon || !radius) {
        Utils.toast('Fill all zone fields', 'warning'); return;
      }
      add(name, lat, lon, radius);
      document.getElementById('zoneName').value  = '';
      document.getElementById('zoneLat').value   = '';
      document.getElementById('zoneLon').value   = '';
      document.getElementById('zoneRadius').value = '100';
    });

    // Preset zones
    document.querySelectorAll('.zone-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const d = btn.dataset;
        document.getElementById('zoneName').value   = d.name;
        document.getElementById('zoneLat').value    = d.lat;
        document.getElementById('zoneLon').value    = d.lon;
        document.getElementById('zoneRadius').value = d.radius;
      });
    });
  }

  return { init, check, add, remove, toggle, renderList, open };
})();
