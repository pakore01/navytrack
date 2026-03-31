/* ============================================================
   API.JS — All data fetching from backend or directly
   ============================================================ */

'use strict';

const Api = (() => {

  function setStatus(status, label) {
    STATE.status = status;
    const dot   = document.getElementById('statusDot');
    const lbl   = document.getElementById('statusLabel');
    const badge = document.getElementById('dataSourceBadge');
    if (dot)   dot.className = `status-dot ${status}`;
    if (lbl)   lbl.textContent = label;
    if (badge) {
      badge.textContent = status === 'online' ? '● Live data' : 'No live data';
      badge.className   = `data-source-badge${status === 'online' ? ' live' : ''}`;
    }
  }

  async function fetchWithTimeout(url, options = {}, timeout = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  async function fetchFlights() {
    try {
      const res = await fetchWithTimeout(`${CONFIG.BACKEND_URL}/api/flights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.flights || [];
    } catch (err) {
      console.warn('[API] Flights fetch failed:', err.message);
      return [];
    }
  }

  async function fetchOpenSky() {
    if (!STATE.keys.openskyUser || !STATE.keys.openskyPass) return [];
    const b = CONFIG.MIDDLE_EAST_BOUNDS;
    const url = `https://opensky-network.org/api/states/all?lamin=${b.lat_min}&lomin=${b.lon_min}&lamax=${b.lat_max}&lomax=${b.lon_max}`;
    try {
      const headers = {
        'Authorization': 'Basic ' + btoa(`${STATE.keys.openskyUser}:${STATE.keys.openskyPass}`)
      };
      const res = await fetchWithTimeout(url, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      const states = data.states || [];
      return states
        .filter(s => s[2] === 'United States')
        .map(s => ({
          type:        'flight',
          source:      'OpenSky',
          icao:        (s[0] || '').toUpperCase(),
          callsign:    (s[1] || '').trim() || '—',
          aircraft:    null,
          registration: null,
          origin:      s[2] || '—',
          destination: 'Middle East region',
          lat:         s[6],
          lon:         s[5],
          altitude:    s[7] != null ? Math.round(s[7] * 3.28084) : null,
          speed:       s[9] != null ? Math.round(s[9] * 1.94384) : null,
          heading:     s[10],
          on_ground:   s[8],
          squawk:      s[14] || '—',
          last_seen:   s[4] ? new Date(s[4] * 1000) : null,
        }));
    } catch (err) {
      console.warn('[API] OpenSky fetch failed:', err.message);
      return [];
    }
  }

  async function fetchCarriers() {
    if (!STATE.keys.marine) return [];
    try {
      const res = await fetchWithTimeout(`${CONFIG.BACKEND_URL}/api/carriers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: STATE.keys.marine }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.vessels || [];
    } catch (err) {
      console.warn('[API] Carriers fetch failed:', err.message);
      return [];
    }
  }

  async function fetchAll() {
    setStatus('loading', 'Fetching…');
    document.getElementById('refreshBtn')?.classList.add('loading');

    try {
      const [milFlights, openskyFlights, carriers] = await Promise.all([
        fetchFlights(),
        fetchOpenSky(),
        fetchCarriers(),
      ]);

      const flightMap = new Map();
      [...milFlights, ...openskyFlights].forEach(f => {
        const key = f.icao || Math.random();
        if (!flightMap.has(key) || f.source === 'airplanes.live') {
          flightMap.set(key, { ...f, type: 'flight', last_seen: f.last_seen || new Date() });
        }
      });

      STATE.raw.flights  = Array.from(flightMap.values());
      STATE.raw.carriers = Array.isArray(carriers) ? carriers.map(v => ({ ...v, type: 'carrier' })) : [];
      STATE.lastUpdate   = Date.now();

      const total = STATE.raw.flights.length + STATE.raw.carriers.length;
      setStatus('online', total > 0 ? 'Live' : 'Connected — no data in region');

      document.getElementById('lastUpdate').textContent = Utils.formatTimeShort();
      updateStats();
      updateEmptyState();
      Filters.apply();

    } catch (err) {
      console.error('[API] fetchAll error:', err);
      setStatus('error', 'Error fetching data');
      Utils.toast('Error fetching data.', 'error');
    } finally {
      document.getElementById('refreshBtn')?.classList.remove('loading');
    }
  }

  function updateStats() {
    const types = new Set(STATE.raw.flights.map(f => f.aircraft).filter(Boolean));
    document.getElementById('statFlights').textContent  = STATE.raw.flights.length  || '0';
    document.getElementById('statCarriers').textContent = STATE.raw.carriers.length || '0';
    document.getElementById('statAircraft').textContent = types.size || '0';
  }

  function updateEmptyState() {
    const empty  = document.getElementById('emptyState');
    const scroll = document.querySelector('.table-scroll');
    if (!empty) return;
    const hasData = (STATE.raw.flights.length + STATE.raw.carriers.length) > 0;
    if (!hasData) {
      empty.classList.add('visible');
      document.getElementById('emptyTitle').textContent = 'No data in region right now';
      document.getElementById('emptyMsg').textContent   = 'No military flights detected in the Middle East region at this moment. Data refreshes automatically.';
      document.getElementById('emptyConfigBtn').style.display = 'none';
      if (scroll) scroll.style.display = 'none';
    } else {
      empty.classList.remove('visible');
      if (scroll) scroll.style.display = '';
    }
  }

  return { fetchAll, setStatus };
})();
