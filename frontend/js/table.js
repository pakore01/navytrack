/* ============================================================
   TABLE.JS — Table rendering, sorting, row detail panel
   ============================================================ */

'use strict';

const Table = (() => {

  let sortCol = 'callsign';
  let sortDir = 'asc';
  let knownICAOs = new Set();
  const detectionTimes = new Map();
  // Load trail from localStorage
  const trailData = new Map();
  try {
    const saved = JSON.parse(localStorage.getItem('navytrack_trails') || '{}');
    Object.entries(saved).forEach(([icao, trail]) => trailData.set(icao, trail));
  } catch {}

  function saveTrails() {
    try {
      const obj = {};
      trailData.forEach((trail, icao) => { obj[icao] = trail.slice(-30); });
      localStorage.setItem('navytrack_trails', JSON.stringify(obj));
    } catch {}
  }
  let history = [];
  try { history = JSON.parse(localStorage.getItem('navytrack_history') || '[]'); } catch {}

  // ── SQUAWK EMERGENCY DETECTION ──
  const EMERGENCY_SQUAWKS = {
    '7700': { label: 'EMERGENCY', color: '#EF4444', icon: '🆘' },
    '7600': { label: 'RADIO FAILURE', color: '#F59E0B', icon: '📻' },
    '7500': { label: 'HIJACK', color: '#DC2626', icon: '⚠️' },
  };

  function getSquawkInfo(squawk) {
    if (!squawk) return null;
    return EMERGENCY_SQUAWKS[String(squawk).trim()] || null;
  }

  function isEmergencySquawk(squawk) {
    return !!getSquawkInfo(squawk);
  }

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

  function timeInZone(icao) {
    const start = detectionTimes.get(icao);
    if (!start) return 'new';
    const diff = Math.floor((Date.now() - start) / 1000);
    if (diff < 60)   return diff + 's';
    if (diff === 0)   return '<1s';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ' + (diff % 60) + 's';
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    return h + 'h ' + m + 'm';
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

  function classifyMission(aircraft, callsign, heading) {
    const a = (aircraft || '').toUpperCase();
    const c = (callsign  || '').toUpperCase();

    if (a.includes('KC-135') || a.includes('KC-10') || a.includes('STRATOTANKER') ||
        a.includes('TANKER') || a.includes('VOYAGER') || a.includes('A330 MRTT'))
      return { label: 'AERIAL REFUELING', icon: '⛽', color: '#F59E0B' };

    if (a.includes('P-8') || a.includes('POSEIDON') || a.includes('P-3') || a.includes('ORION') ||
        a.includes('ATLANTIC') || a.includes('MARTIME PATROL'))
      return { label: 'MARITIME PATROL', icon: '🔍', color: '#3B82F6' };

    if (a.includes('E-2') || a.includes('HAWKEYE') || a.includes('E-3') || a.includes('SENTRY') ||
        a.includes('AWACS') || a.includes('AEW') || a.includes('WEDGETAIL'))
      return { label: 'AEW&C', icon: '📡', color: '#8B5CF6' };

    if (a.includes('EA-18') || a.includes('GROWLER') || a.includes('EA-6') ||
        a.includes('ELECTRONIC') || a.includes('RIVET'))
      return { label: 'ELECTRONIC WARFARE', icon: '⚡', color: '#EF4444' };

    if (a.includes('RC-135') || a.includes('U-2') || a.includes('RQ') ||
        a.includes('GLOBAL HAWK') || a.includes('SENTINEL') || a.includes('RECON'))
      return { label: 'RECONNAISSANCE', icon: '👁', color: '#EC4899' };

    if (a.includes('E-6') || a.includes('MERCURY') || a.includes('COMMAND') ||
        a.includes('E-4') || a.includes('NIGHTWATCH'))
      return { label: 'COMMAND & CONTROL', icon: '📻', color: '#10B981' };

    if (a.includes('C-130') || a.includes('C-17') || a.includes('C-5') || a.includes('C-2') ||
        a.includes('HERCULES') || a.includes('GLOBEMASTER') || a.includes('GALAXY') ||
        a.includes('GREYHOUND') || a.includes('ATLAS') || a.includes('A400'))
      return { label: 'TRANSPORT', icon: '📦', color: '#6366F1' };

    if (a.includes('MH-60') || a.includes('SEAHAWK') || a.includes('BLACK HAWK') ||
        a.includes('CHINOOK') || a.includes('CH-47') || a.includes('MH-53'))
      return { label: 'ROTARY WING', icon: '🚁', color: '#14B8A6' };

    if (a.includes('F-16') || a.includes('F-18') || a.includes('F-35') || a.includes('F-15') ||
        a.includes('HORNET') || a.includes('FALCON') || a.includes('TYPHOON') ||
        a.includes('RAFALE') || a.includes('GRIPEN'))
      return { label: 'COMBAT AIR PATROL', icon: '🚀', color: '#EF4444' };

    if (a.includes('T-38') || a.includes('T-6') || a.includes('TEXAN') ||
        a.includes('TALON') || a.includes('HAWK') || a.includes('TRAINING'))
      return { label: 'TRAINING', icon: '🎓', color: '#94A3B8' };

    if (a.includes('BEECH') || a.includes('KING AIR') || a.includes('CITATION') ||
        a.includes('CESSNA') || a.includes('DORNIER'))
      return { label: 'LIAISON / SURVEY', icon: '✈', color: '#64748B' };

    if (c.startsWith('RCH'))  return { label: 'TRANSPORT', icon: '📦', color: '#6366F1' };
    if (c.startsWith('NAVY')) return { label: 'NAVAL OPS', icon: '⚓', color: '#3B82F6' };
    if (c.startsWith('JAKE')) return { label: 'MARITIME PATROL', icon: '🔍', color: '#3B82F6' };
    if (c.startsWith('REACH'))return { label: 'TRANSPORT', icon: '📦', color: '#6366F1' };
    if (c.startsWith('COBRA'))return { label: 'TRAINING', icon: '🎓', color: '#94A3B8' };

    return { label: 'MILITARY OPS', icon: '✈', color: '#00D478' };
  }

  function inferDestination(heading, lat, lon) {
    if (heading == null) return '—';
    const h = parseFloat(heading);
    if (lat > 35 && lon > 25 && lon < 65) {
      if (h >= 45  && h < 135) return 'Persian Gulf / Arabian Sea';
      if (h >= 135 && h < 225) return 'Red Sea / Horn of Africa';
      if (h >= 225 && h < 315) return 'Mediterranean';
      return 'Middle East region';
    }
    if (lat > 35 && lon < 25) {
      if (h >= 45  && h < 180) return 'Middle East';
      if (h >= 180 && h < 270) return 'Africa';
      return 'Europe';
    }
    if (lat > 15 && lat < 35) {
      if (h >= 45  && h < 135) return 'Arabian Sea';
      if (h >= 225 && h < 315) return 'Red Sea';
      return 'Middle East';
    }
    if (lon < -50) {
      if (h >= 45  && h < 135) return 'Atlantic / Europe';
      if (h >= 225 && h < 315) return 'Pacific';
      if (h >= 135 && h < 225) return 'South America';
      return 'North America';
    }
    return 'Transit';
  }

  async function fetchNearestBase(lat, lon) {
    if (!lat || !lon) return null;
    try {
      const res = await fetch(CONFIG.BACKEND_URL + '/api/bases/nearest', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({lat: lat, lon: lon, radius_km: 300})
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.found ? data : null;
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

  // ── EMERGENCY SQUAWK ALERT ──
  function notifyEmergency(row, squawkInfo) {
    Utils.toast(
      squawkInfo.icon + ' SQUAWK ' + row.squawk + ' — ' + squawkInfo.label +
      ': ' + (row.callsign || row.icao),
      'error', 10000
    );
  }

  const originData = new Map();
  try {
    const saved = JSON.parse(localStorage.getItem('navytrack_origins') || '{}');
    Object.entries(saved).forEach(function(e) { originData.set(e[0], e[1]); });
  } catch {}

  function saveOrigins() {
    try {
      var obj = {};
      originData.forEach(function(v, k) { obj[k] = v; });
      localStorage.setItem('navytrack_origins', JSON.stringify(obj));
    } catch {}
  }

  function fetchAndCacheOrigin(row) {
    if (!row.lat || !row.lon || originData.has(row.icao)) return;
    originData.set(row.icao, 'Detecting...');
    fetchNearestBase(row.lat, row.lon).then(function(base) {
      if (base) {
        var val = base.flag + ' ' + base.name;
        originData.set(row.icao, val);
        saveOrigins();
      } else {
        originData.set(row.icao, '—');
      }
    });
  }

  // Track already-alerted emergency squawks to avoid spam
  const alertedEmergencies = new Set();

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

      // ── EMERGENCY SQUAWK CHECK ──
      const squawkInfo = getSquawkInfo(row.squawk);
      if (squawkInfo) {
        const alertKey = row.icao + '_' + row.squawk;
        if (!alertedEmergencies.has(alertKey)) {
          alertedEmergencies.add(alertKey);
          notifyEmergency(row, squawkInfo);
        }
        // Red pulsing row for emergency
        tr.style.cssText = 'background:rgba(239,68,68,0.12);animation:emergencyPulse 2s ease-in-out infinite;';
      }

      if (!knownICAOs.has(row.icao) && knownICAOs.size > 0) {
        if (newCount < 3) { notifyNew(row); newCount++; }
        saveToHistory(row);
      }
      History.add(row);
      fetchAndCacheOrigin(row);
      if (!detectionTimes.has(row.icao)) {
        detectionTimes.set(row.icao, Date.now());
      }
      // Record trail position
      if (row.lat && row.lon) {
        const trail = trailData.get(row.icao) || [];
        const last = trail[trail.length - 1];
        if (!last || Math.abs(last.lat - row.lat) > 0.01 || Math.abs(last.lon - row.lon) > 0.01) {
          trail.push({ lat: row.lat, lon: row.lon, ts: Date.now(), heading: row.heading });
          if (trail.length > 50) trail.shift();
          trailData.set(row.icao, trail);
          saveTrails();
        }
      }
      knownICAOs.add(row.icao);
      const inZone  = timeInZone(row.icao);
      const originCache = originData.get(row.icao) || '—';
      const mission = classifyMission(row.aircraft, row.callsign, row.heading);

      const heading = row.heading != null ? Math.round(row.heading) : null;
      const headingCell = heading != null
        ? '<span class="heading-arrow"><span class="heading-dial"><svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform:rotate(' + heading + 'deg)"><path d="M10 2L13 14H10V18H10L7 14H10V2Z" fill="#0057FF" opacity="0.9"/><circle cx="10" cy="10" r="9" stroke="#E2E5EA" stroke-width="1" fill="none"/></svg></span><span class="cell-mono">' + heading + '°</span></span>'
        : '—';

      // Squawk cell — highlight emergencies
      const squawkCell = squawkInfo
        ? '<span style="color:' + squawkInfo.color + ';font-weight:700;font-family:var(--font-mono)">' + squawkInfo.icon + ' ' + row.squawk + '</span>'
        : escHtml(row.squawk || '—');

      tr.innerHTML =
        '<td><span class="type-badge ' + row.type + '">' + (row.type === 'carrier' ? '⚓ Carrier' : '✈ Flight') + '</span></td>' +
        '<td class="cell-callsign">' + flag + ' ' + escHtml(row.callsign || '—') + navyBadge + '</td>' +
        '<td class="cell-mono cell-muted">' + escHtml(row.icao) + '</td>' +
        '<td>' + getAircraftIcon(row.aircraft) + ' ' + escHtml(row.aircraft || '—') +
        '<br><span style="font-family:var(--font-mono);font-size:0.6rem;color:' + mission.color + ';letter-spacing:0.06em">' + mission.icon + ' ' + mission.label + '</span>' +
        '</td>' +
        '<td class="cell-muted" style="font-size:0.72rem">' + escHtml(originCache) + '</td>' +
        '<td class="cell-muted">' + escHtml(row.destination || inferDestination(row.heading, row.lat, row.lon)) + '</td>' +
        '<td class="cell-mono">' + (isCarrier ? '—' : Utils.formatAlt(row.altitude)) + '</td>' +
        '<td class="cell-mono">' + Utils.formatSpeed(row.speed) + '</td>' +
        '<td>' + headingCell + '</td>' +
        '<td class="cell-mono">' + Utils.formatCoords(row.lat, row.lon) + '</td>' +
        '<td><span class="status-badge ' + statusClass + '">' + statusLabel + '</span></td>' +
        '<td class="cell-muted">' + Utils.timeAgo(row.last_seen) + '</td>' +
        '<td class="cell-mono" style="color:var(--color-accent);font-size:0.72rem">' + inZone + '</td>';

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
    const mission   = classifyMission(row.aircraft, row.callsign, row.heading);
    const squawkInfo = getSquawkInfo(row.squawk);

    title.textContent = flag + ' ' + (row.callsign || row.icao || '—');

    // Squawk section — emergency banner if needed
    const squawkBanner = squawkInfo
      ? '<div style="background:' + squawkInfo.color + '22;border:1px solid ' + squawkInfo.color + ';border-radius:8px;padding:10px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px">' +
        '<span style="font-size:1.4rem">' + squawkInfo.icon + '</span>' +
        '<div><div style="color:' + squawkInfo.color + ';font-weight:700;font-size:0.85rem">SQUAWK ' + row.squawk + ' — ' + squawkInfo.label + '</div>' +
        '<div style="font-size:0.75rem;color:var(--color-text-muted);margin-top:2px">Emergency transponder code detected</div></div></div>'
      : '';

    body.innerHTML =
      squawkBanner +
      '<div class="detail-photo-wrap" id="photoWrap"><div class="detail-photo-loading">Loading photo…</div></div>' +
      (navy ? '<div class="detail-navy-banner">🇺🇸 US Navy Aircraft</div>' : '') +
      '<div class="detail-section"><div class="detail-section-title">Identification</div>' +
      detailRow('Type', isCarrier ? '⚓ Carrier' : '✈ Military Flight') +
      '<div class="detail-row"><span class="detail-key">MISSION</span><span class="detail-val" style="color:' + mission.color + ';font-weight:700">' + mission.icon + ' ' + mission.label + '</span></div>' +
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
      '<div class="detail-row"><span class="detail-key">Squawk</span><span class="detail-val">' +
      (squawkInfo
        ? '<span style="color:' + squawkInfo.color + ';font-weight:700">' + squawkInfo.icon + ' ' + row.squawk + ' — ' + squawkInfo.label + '</span>'
        : escHtml(row.squawk || '—')) +
      '</span></div>' +
      '</div>' +
      '<div class="detail-section"><div class="detail-section-title">Route</div>' +
      detailRow('Origin', row.origin || 'Detecting...', true, 'origin') +
      detailRow('Destination', (row.destination && row.destination !== '—') ? row.destination : inferDestination(row.heading, row.lat, row.lon), true) +
      detailRow('Time in Zone', timeInZone(row.icao), true) +
      detailRow('Last Update', row.last_seen ? new Date(row.last_seen).toUTCString() : '—', true) +
      '</div>' +
      (row.lat && row.lon ?
        '<div class="detail-section"><div class="detail-section-title">Live Position & Trail</div>' +
        '<div class="detail-map-wrap" id="trailMapWrap" style="height:220px;background:#0D1421;border-radius:8px;overflow:hidden;position:relative">' +
        '<div id="trailMap" style="width:100%;height:100%"></div>' +
        '</div>' +
        '<a class="btn-secondary" style="margin-top:8px;justify-content:center;display:flex" href="https://www.openstreetmap.org/?mlat=' + row.lat + '&mlon=' + row.lon + '&zoom=7" target="_blank" rel="noopener">Open full map ↗</a>' +
        '<a class="btn-secondary" style="margin-top:6px;justify-content:center;display:flex" href="https://globe.adsbexchange.com/?icao=' + row.icao.toLowerCase() + '" target="_blank" rel="noopener">Track on ADS-B Exchange ↗</a>' +
        '</div>' : '');

    panel.classList.add('open');
    overlay.classList.add('visible');

    // Initialize trail map with Leaflet + direction arrows
    if (row.lat && row.lon) {
      setTimeout(function() {
        const mapEl = document.getElementById('trailMap');
        if (!mapEl) return;

        if (window._navyMap) {
          window._navyMap.remove();
          window._navyMap = null;
        }

        const map = L.map('trailMap', {
          center: [row.lat, row.lon],
          zoom: 6,
          zoomControl: true,
          attributionControl: false
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19
        }).addTo(map);

        // Draw trail with direction arrows
        const trail = trailData.get(row.icao) || [];
        if (trail.length > 1) {
          const latlngs = trail.map(p => [p.lat, p.lon]);

          // Main trail line
          L.polyline(latlngs, {
            color: '#00D478',
            weight: 2,
            opacity: 0.8,
            dashArray: '4 4'
          }).addTo(map);

          // Direction arrows on trail segments
          trail.forEach(function(p, i) {
            if (i < trail.length - 1) {
              const next = trail[i + 1];
              // Trail dot
              L.circleMarker([p.lat, p.lon], {
                radius: 2,
                fillColor: '#00D478',
                fillOpacity: 0.5,
                color: 'transparent'
              }).addTo(map);

              // Arrow every 3 points
              if (i % 3 === 0 && i > 0) {
                const midLat = (p.lat + next.lat) / 2;
                const midLon = (p.lon + next.lon) / 2;
                const dLat = next.lat - p.lat;
                const dLon = next.lon - p.lon;
                const angle = Math.atan2(dLon, dLat) * 180 / Math.PI;
                const arrowIcon = L.divIcon({
                  html: '<div style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:8px solid #00D478;transform:rotate(' + angle + 'deg);opacity:0.8"></div>',
                  iconSize: [8, 8],
                  iconAnchor: [4, 4],
                  className: ''
                });
                L.marker([midLat, midLon], { icon: arrowIcon }).addTo(map);
              }
            }
          });
        }

        // Current position marker with heading
        const headingDeg = row.heading || 0;
        const icon = L.divIcon({
          html: '<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:16px solid #00D478;transform:rotate(' + headingDeg + 'deg);filter:drop-shadow(0 0 4px #00D478)"></div>',
          iconSize: [12, 16],
          iconAnchor: [6, 8],
          className: ''
        });
        L.marker([row.lat, row.lon], { icon: icon }).addTo(map);

        window._navyMap = map;
      }, 100);
    }

    // Fetch nearest base
    if (row.lat && row.lon) {
      fetchNearestBase(row.lat, row.lon).then(function(base) {
        const originEl = body.querySelector('[data-key="origin"]');
        if (base && originEl) {
          originEl.textContent = base.flag + ' ' + base.name + ' (' + base.distance_km + ' km)';
          originEl.style.color = 'var(--color-accent)';
        }
      });
    }

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

  function detailRow(key, val, plain, dataKey) {
    const dk = dataKey ? ' data-key="' + dataKey + '"' : '';
    return '<div class="detail-row"><span class="detail-key">' + escHtml(key) + '</span><span class="detail-val' + (plain ? ' plain' : '') + '"' + dk + '>' + escHtml(String(val != null ? val : '—')) + '</span></div>';
  }

  function escHtml(str) {
    return String(str != null ? str : '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function init() {
    // Inject emergency pulse animation
    if (!document.getElementById('emergencyStyle')) {
      const style = document.createElement('style');
      style.id = 'emergencyStyle';
      style.textContent = '@keyframes emergencyPulse { 0%,100%{background:rgba(239,68,68,0.12)} 50%{background:rgba(239,68,68,0.25)} }';
      document.head.appendChild(style);
    }
    bindSort();
    document.getElementById('closeDetail') && document.getElementById('closeDetail').addEventListener('click', closeDetail);
    document.getElementById('detailOverlay') && document.getElementById('detailOverlay').addEventListener('click', closeDetail);
  }

  return { render: render, sort: sort, init: init };
})();
