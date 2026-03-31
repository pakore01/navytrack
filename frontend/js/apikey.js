/* ============================================================
   APIKEY.JS — API key input, storage and retrieval
   ============================================================ */

'use strict';

const ApiKey = (() => {

  // ── LOAD KEYS FROM LOCAL STORAGE INTO STATE ──
  function load() {
    STATE.keys.adsb        = Utils.lsGet(CONFIG.STORAGE_KEYS.ADSB_KEY)      || null;
    STATE.keys.openskyUser = Utils.lsGet(CONFIG.STORAGE_KEYS.OPENSKY_USER)  || null;
    STATE.keys.openskyPass = Utils.lsGet(CONFIG.STORAGE_KEYS.OPENSKY_PASS)  || null;
    STATE.keys.marine      = Utils.lsGet(CONFIG.STORAGE_KEYS.MARINE_KEY)    || null;
  }

  // ── SAVE KEYS FROM MODAL INPUTS TO LOCAL STORAGE + STATE ──
  function saveFromModal() {
    const adsb        = document.getElementById('adsbKey')?.value.trim()      || '';
    const openskyUser = document.getElementById('openskyUser')?.value.trim()  || '';
    const openskyPass = document.getElementById('openskyPass')?.value.trim()  || '';
    const marine      = document.getElementById('marineKey')?.value.trim()    || '';

    STATE.keys.adsb        = adsb        || null;
    STATE.keys.openskyUser = openskyUser || null;
    STATE.keys.openskyPass = openskyPass || null;
    STATE.keys.marine      = marine      || null;

    if (adsb)        Utils.lsSet(CONFIG.STORAGE_KEYS.ADSB_KEY,      adsb);
    if (openskyUser) Utils.lsSet(CONFIG.STORAGE_KEYS.OPENSKY_USER,  openskyUser);
    if (openskyPass) Utils.lsSet(CONFIG.STORAGE_KEYS.OPENSKY_PASS,  openskyPass);
    if (marine)      Utils.lsSet(CONFIG.STORAGE_KEYS.MARINE_KEY,    marine);
  }

  // ── POPULATE MODAL INPUTS FROM SAVED STATE ──
  function populateModal() {
    const f = (id, val) => {
      const el = document.getElementById(id);
      if (el && val) el.value = val;
    };
    f('adsbKey',     STATE.keys.adsb);
    f('openskyUser', STATE.keys.openskyUser);
    f('openskyPass', STATE.keys.openskyPass);
    f('marineKey',   STATE.keys.marine);
  }

  // ── CHECK IF ANY KEY IS CONFIGURED ──
  function hasAnyKey() {
    return !!(STATE.keys.adsb || STATE.keys.openskyUser || STATE.keys.marine);
  }

  // ── OPEN / CLOSE MODAL ──
  function openModal() {
    populateModal();
    document.getElementById('apiModal')?.classList.add('visible');
  }

  function closeModal() {
    document.getElementById('apiModal')?.classList.remove('visible');
  }

  // ── INIT ──
  function init() {
    load();

    // Settings button → open modal
    document.getElementById('settingsBtn')?.addEventListener('click', openModal);

    // Empty state config button → open modal
    document.getElementById('emptyConfigBtn')?.addEventListener('click', openModal);

    // Cancel
    document.getElementById('cancelApiBtn')?.addEventListener('click', closeModal);

    // Save & Connect
    document.getElementById('saveApiBtn')?.addEventListener('click', () => {
      saveFromModal();
      closeModal();

      if (hasAnyKey()) {
        Utils.toast('API keys saved. Fetching data…', 'success');
        // Trigger first fetch via App
        window.App?.refresh();
      } else {
        Utils.toast('No API keys provided. Enter at least one key.', 'warning');
      }
    });

    // Close modal on overlay click
    document.getElementById('apiModal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal();
    });
  }

  return { init, load, hasAnyKey, openModal, closeModal };
})();
