/* ============================================================
   FILTERS.JS — Filter and search logic
   ============================================================ */

'use strict';

const Filters = (() => {

  // ── APPLY ALL FILTERS + SORT → RENDER ──
  function apply() {
    const all = [
      ...STATE.raw.flights,
      ...STATE.raw.carriers,
    ];

    let result = all;

    // Type filter
    const type = STATE.filters.type;
    if (type && type !== 'all') {
      result = result.filter(r => r.type === type);
    }

    // Aircraft filter
    const aircraft = STATE.filters.aircraft;
    if (aircraft) {
      result = result.filter(r =>
        (r.aircraft || '').toLowerCase().includes(aircraft.toLowerCase())
      );
    }

    // Status filter
    const status = STATE.filters.status;
    if (status) {
      if (status === 'airborne') {
        result = result.filter(r => r.type === 'flight' && !r.on_ground);
      } else if (status === 'ground') {
        result = result.filter(r => r.type === 'flight' && r.on_ground);
      }
    }

    // Search filter
    const search = STATE.filters.search.toLowerCase().trim();
    if (search) {
      result = result.filter(r =>
        (r.callsign     || '').toLowerCase().includes(search) ||
        (r.icao         || '').toLowerCase().includes(search) ||
        (r.aircraft     || '').toLowerCase().includes(search) ||
        (r.origin       || '').toLowerCase().includes(search) ||
        (r.destination  || '').toLowerCase().includes(search)
      );
    }

    // Sort
    result = Table.sort(result, STATE.sort.col, STATE.sort.dir);

    STATE.display = result;
    Table.render(result);
  }

  // ── INIT ──
  function init() {
    // Type chips
    document.getElementById('typeFilter')?.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      document.querySelectorAll('#typeFilter .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      STATE.filters.type = chip.dataset.filter;
      apply();
    });

    // Aircraft select
    document.getElementById('aircraftFilter')?.addEventListener('change', (e) => {
      STATE.filters.aircraft = e.target.value;
      apply();
    });

    // Status select
    document.getElementById('statusFilter')?.addEventListener('change', (e) => {
      STATE.filters.status = e.target.value;
      apply();
    });

    // Search input (debounced)
    document.getElementById('searchInput')?.addEventListener('input',
      Utils.debounce((e) => {
        STATE.filters.search = e.target.value;
        apply();
      }, 250)
    );
  }

  return { apply, init };
})();
