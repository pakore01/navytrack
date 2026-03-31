/* ============================================================
   API.JS — All data fetching from backend or directly
   ============================================================ */

'use strict';

const Api = (() => {

  // ── SET STATUS ──
  function setStatus(status, label) {
    STATE.status = status;
    const dot   = document.getElementById('statusDot');
    const lbl   = document.getElementById('statusLabel');
    const badge = document.getElementById('dataSourceBadge');

    if (dot) {
      dot.className = `status-dot ${status}`;
    }
    if (lbl) {
      lbl.textContent = label;
    }
    if (badge) {
      badge.textContent = status === 'online' ? '● Live data' : 'No live data';
      badge.className   = `data-source-badge${status === 'online' ? ' live' : ''}`;
    }
  }

  // ── FETCH WITH TIMEOUT ──
  async function fetchWithTimeout(url, options = {}, timeout = 10000) {
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

  // ── FETCH FLIGHTS (ADS-B Exchange via backend proxy) ──
  async function fetchFlights() {
    if (!STATE.keys.adsb) return [];

    try {
      const res = await fetchWithTimeout(`${CONFIG.BACKEND_URL}/api/flights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: STATE.keys.adsb }),
      });

      if (!res.ok) {
        console.warn('[API] Flights error:', res.status);
        return [];
      }

      const data = await res.json();
      return normalizeFlights(data.flights || []);

    } catch (err) {
      console.warn('[API] Flights fetch failed:', err.message);
      return [];
    }
  }

  // ── FETCH FLIGHTS DIRECTLY FROM OPENSKY (fallback) ──
  async function fetchOpenSky() {
    if (!STATE.keys.openskyUser || !STATE.keys.openskyPass) return [];

    // Middle East bounds
    const b = CONFIG.MIDDLE_EAST_BOUNDS;
    const url = `https://opensky-network.org/api/states/all?lamin=${b.lat_min}&lomin=${b.lon_min}&lamax=${b.lat_max}&lomax=${b.lon_max}`;

    try {
      const headers = {};
      if (STATE.keys.openskyUser) {
        headers['Authorization'] = 'Basic ' + btoa(`${STATE.keys.openskyUser}:${STATE.keys.openskyPass}`);
      }

      const res = await fetchWithTimeout(url, { headers });
      if (!res.ok) return [];
      const data = await res.json();

      // OpenSky state vector fields (by index):
      // 0: icao24, 1: callsign, 2: origin_country, 3: time_position, 4: last_contact,
      // 5: longitude, 6: latitude, 7: baro_altitude, 8: on_ground, 9: velocity,
      // 10: true_track, 11: vertical_rate, 12: sensors, 13: geo_altitude,
      // 14: squawk, 15: spi, 16: position_source

      const states = data.states || [];
      return states
        .filter(s => s[2] === 'United States')  // US origin only
        .map(s => ({
          type:        'flight',
          source:      'OpenSky',
          icao:        (s[0] || '').toUpperCase(),
          callsign:    (s[1] || '').trim() || '—',
          origin_country: s[2] || '—',
          lat:         s[6],
          lon:         s[5],
          altitude:    s[7] != null ? Math.round(s[7] * 3.28084) : null, // meters → ft
          speed:       s[9] != null ? Math.round(s[9] * 1.94384) : null, // m/s → kts
          heading:     s[10],
          on_ground:   s[8],
          squawk:      s[14] || '—',
          aircraft:    resolveFromICAO(s[0]),
          last_seen:   s[4] ? new Date(s[4] * 1000) : null,
          origin:      '—',
          destination: 'Middle East region',
        }));

    } catch (err) {
      console.warn('[API] OpenSky fetch failed:', err.message);
      return [];
    }
  }

  // ── FETCH CARRIERS (MarineTraffic via backend proxy) ──
  async function fetchCarriers() {
    if (!STATE.keys.marine) return [];

    try {
      const res = await fetchWithTimeout(`${CONFIG.BACKEND_URL}/api/carriers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: STATE.keys.marine }),
      });

      if (!res.ok) {
        console.warn('[API] Carriers error:', res.status);
        return [];
      }

      const data = await res.json();
      return normalizeCarriers(data.vessels || []);

    } catch (err) {
      console.warn('[API] Carriers fetch failed:', err.message);
      return [];
    }
  }

  // ── NORMALIZE FLIGHTS (from backend) ──
  function normalizeFlights(raw = []) {
    return raw.map(f => ({
      type:        'flight',
      source:      f.source || 'ADS-B Exchange',
      icao:        (f.icao || f.hex || '').toUpperCase(),
      callsign:    (f.callsign || f.flight || '').trim() || '—',
      aircraft:    f.t || f.type || resolveFromICAO(f.icao || ''),
      registration: f.r || '—',
      origin:      f.origin || f.dep || '—',
      destination: f.destination || f.dst || 'Middle East',
      lat:         parseFloat(f.lat) || null,
      lon:         parseFloat(f.lon) || null,
      altitude:    f.alt_baro != null ? parseInt(f.alt_baro) : null,
      speed:       f.gs != null ? Math.round(f.gs) : null,
      heading:     f.track != null ? parseFloat(f.track) : null,
      on_ground:   !!f.on_ground,
      squawk:      f.squawk || '—',
      last_seen:   new Date(),
    }));
  }

  // ── NORMALIZE CARRIERS (from backend) ──
  function normalizeCarriers(raw = []) {
    return raw.map(v => {
      const known = Utils.getCarrierByMMSI(v.mmsi);
      return {
        type:        'carrier',
        source:      'MarineTraffic',
        icao:        v.mmsi || '—',
        callsign:    known?.name || v.name || v.shipname || '—',
        aircraft:    known?.class || v.type || 'Aircraft Carrier',
        registration: known?.hull || v.imo || '—',
        origin:      v.last_port || '—',
        destination: v.destination || 'Middle East',
        lat:         parseFloat(v.lat) || null,
        lon:         parseFloat(v.lon) || null,
        altitude:    null,
        speed:       v.speed != null ? parseFloat(v.speed) : null,
        heading:     v.course != null ? parseFloat(v.course) : null,
        on_ground:   false,
        squawk:      '—',
        last_seen:   v.timestamp ? new Date(v.timestamp) : new Date(),
      };
    });
  }

  // ── RESOLVE AIRCRAFT LABEL FROM ICAO HEX ──
  function resolveFromICAO(icao = '') {
    // US military hex range: ADF7C5 - ADFFFF (approx)
    // This is a heuristic — real resolution needs a full hex database
    const upper = icao.toUpperCase();
    if (upper.startsWith('ADF') || upper.startsWith('AE0')) return 'US Navy / Military';
    return '—';
  }

  // ── MAIN FETCH: all sources combined ──
  async function fetchAll() {
    if (!ApiKey.hasAnyKey()) {
      setStatus('idle', 'No API configured');
      updateEmptyState();
      return;
    }

    setStatus('loading', 'Fetching…');
    document.getElementById('refreshBtn')?.classList.add('loading');

    try {
      const [backendFlights, openskyFlights, carriers] = await Promise.all([
        fetchFlights(),
        fetchOpenSky(),
        fetchCarriers(),
      ]);

      // Merge flights — deduplicate by ICAO
      const flightMap = new Map();
      [...backendFlights, ...openskyFlights].forEach(f => {
        if (!flightMap.has(f.icao) || f.source === 'ADS-B Exchange') {
          flightMap.set(f.icao, f);
        }
      });

      STATE.raw.flights  = Array.from(flightMap.values());
      STATE.raw.carriers = carriers;
      STATE.lastUpdate   = Date.now();

      const total = STATE.raw.flights.length + STATE.raw.carriers.length;

      if (total > 0) {
        setStatus('online', 'Live');
      } else {
        setStatus('online', 'Connected — no data in region');
      }

      // Update UI
      document.getElementById('lastUpdate').textContent = Utils.formatTimeShort();
      updateStats();
      updateEmptyState();
      Filters.apply();

    } catch (err) {
      console.error('[API] fetchAll error:', err);
      setStatus('error', 'Error fetching data');
      Utils.toast('Error fetching data. Check console.', 'error');

    } finally {
      document.getElementById('refreshBtn')?.classList.remove('loading');
    }
  }

  // ── UPDATE STATS BAR ──
  function updateStats() {
    const flights  = STATE.raw.flights;
    const carriers = STATE.raw.carriers;

    const types = new Set(flights.map(f => f.aircraft).filter(a => a && a !== '—'));

    document.getElementById('statFlights').textContent  = flights.length  || '0';
    document.getElementById('statCarriers').textContent = carriers.length || '0';
    document.getElementById('statAircraft').textContent = types.size      || '0';
  }

  // ── UPDATE EMPTY STATE VISIBILITY ──
  function updateEmptyState() {
    const empty  = document.getElementById('emptyState');
    const scroll = document.querySelector('.table-scroll');
    if (!empty) return;

    const hasData  = (STATE.raw.flights.length + STATE.raw.carriers.length) > 0;
    const hasKeys  = ApiKey.hasAnyKey();

    if (!hasKeys) {
      empty.classList.add('visible');
      document.getElementById('emptyTitle').textContent = 'Configure your API keys to start';
      document.getElementById('emptyMsg').textContent   = 'Click the settings button in the top right to enter your API keys.';
      document.getElementById('emptyConfigBtn').style.display = '';
      if (scroll) scroll.style.display = 'none';
    } else if (!hasData) {
      empty.classList.add('visible');
      document.getElementById('emptyTitle').textContent = 'No data available';
      document.getElementById('emptyMsg').textContent   = 'No flights or carriers found in the Middle East region. This may be due to API limits or no active broadcasts.';
      document.getElementById('emptyConfigBtn').style.display = 'none';
      if (scroll) scroll.style.display = 'none';
    } else {
      empty.classList.remove('visible');
      if (scroll) scroll.style.display = '';
    }
  }

  return { fetchAll, setStatus };
})();
