/* ============================================================
   REGIONS.JS — Monitor region selection and sync with bot
   ============================================================ */

'use strict';

const Regions = (() => {

  // ── LOAD REGIONS FROM SERVER ──
  async function load() {
    try {
      const res = await fetch(`${CONFIG.BACKEND_URL}/api/regions`);
      if (!res.ok) return;
      const data = await res.json();
      const active = data.regions || [];
      // Update checkboxes
      document.querySelectorAll('#regionsGrid input[type=checkbox]').forEach(cb => {
        cb.checked = active.includes(cb.value);
      });
    } catch {}
  }

  // ── SAVE REGIONS TO SERVER ──
  async function save() {
    const selected = [];
    document.querySelectorAll('#regionsGrid input[type=checkbox]').forEach(cb => {
      if (cb.checked) selected.push(cb.value);
    });

    if (!selected.length) {
      Utils.toast('Select at least one region', 'warning');
      return;
    }

    try {
      const res = await fetch(`${CONFIG.BACKEND_URL}/api/regions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regions: selected }),
      });
      if (res.ok) {
        Utils.toast(`✅ Regions updated — bot will use new regions in next poll`, 'success', 4000);
      }
    } catch {
      Utils.toast('Error updating regions', 'error');
    }
  }

  // ── INIT ──
  function init() {
    // Load current regions when modal opens
    document.getElementById('settingsBtn')?.addEventListener('click', () => setTimeout(load, 100));

    // Save regions when Save & Connect is clicked
    document.getElementById('saveApiBtn')?.addEventListener('click', save);
  }

  return { init, load, save };
})();
