/* ============================================================
   CONFIG.JS — Constants, STATE, app-level data
   ============================================================ */

'use strict';

const CONFIG = {
  APP_NAME: 'NavyTrack',
  VERSION:  '1.0.0',

  // Backend API base URL (FastAPI)
  // In production: change to your deployed URL
  // In local dev:  http://localhost:8000
  BACKEND_URL: 'http://148.230.122.187',

  // Auto-refresh default interval (seconds, 0 = off)
  DEFAULT_REFRESH: 30,

  // Middle East bounding box for filtering
  MIDDLE_EAST_BOUNDS: {
    lat_min: 12.0,
    lat_max: 42.0,
    lon_min: 25.0,
    lon_max: 65.0,
  },

  // Known US Navy ICAO hex prefixes (non-exhaustive, for client-side filtering)
  // Source: public OSINT / ADS-B tracking communities
  NAVY_ICAO_PREFIXES: ['AE', 'ADF', 'A', 'AF'],

  // Known US Navy carrier names for MarineTraffic filtering
  CARRIERS: [
    { name: 'USS Gerald R. Ford',       class: 'Ford-class',    hull: 'CVN-78', mmsi: '338335808' },
    { name: 'USS George Washington',    class: 'Nimitz-class',  hull: 'CVN-73', mmsi: '338708532' },
    { name: 'USS Abraham Lincoln',      class: 'Nimitz-class',  hull: 'CVN-72', mmsi: '338334431' },
    { name: 'USS Harry S. Truman',      class: 'Nimitz-class',  hull: 'CVN-75', mmsi: '338228814' },
    { name: 'USS Ronald Reagan',        class: 'Nimitz-class',  hull: 'CVN-76', mmsi: '338335765' },
    { name: 'USS Dwight D. Eisenhower', class: 'Nimitz-class',  hull: 'CVN-69', mmsi: '338225562' },
    { name: 'USS Carl Vinson',          class: 'Nimitz-class',  hull: 'CVN-70', mmsi: '338225563' },
    { name: 'USS John C. Stennis',      class: 'Nimitz-class',  hull: 'CVN-74', mmsi: '338335784' },
    { name: 'USS Theodore Roosevelt',   class: 'Nimitz-class',  hull: 'CVN-71', mmsi: '338225564' },
    { name: 'USS Nimitz',               class: 'Nimitz-class',  hull: 'CVN-68', mmsi: '338225561' },
    { name: 'USS John F. Kennedy',      class: 'Ford-class',    hull: 'CVN-79', mmsi: '338335809' },
  ],

  // Known aircraft type patterns for label resolution
  AIRCRAFT_TYPES: {
    'P-8':    { label: 'P-8 Poseidon',       role: 'Maritime Patrol',       icon: '✈' },
    'E-2':    { label: 'E-2 Hawkeye',         role: 'AEW&C',                 icon: '✈' },
    'EA-18':  { label: 'EA-18G Growler',      role: 'Electronic Warfare',    icon: '✈' },
    'F/A-18': { label: 'F/A-18 Hornet',       role: 'Strike Fighter',        icon: '✈' },
    'C-130':  { label: 'C-130 Hercules',      role: 'Transport',             icon: '✈' },
    'KC-135': { label: 'KC-135 Stratotanker', role: 'Aerial Refueling',      icon: '✈' },
    'E-6':    { label: 'E-6 Mercury',          role: 'Command & Control',     icon: '✈' },
    'MH-60':  { label: 'MH-60 Seahawk',       role: 'Helicopter',            icon: '🚁' },
    'V-22':   { label: 'V-22 Osprey',          role: 'Tiltrotor Transport',   icon: '✈' },
    'C-2':    { label: 'C-2 Greyhound',        role: 'COD Transport',         icon: '✈' },
  },

  // Local storage keys
  STORAGE_KEYS: {
    ADSB_KEY:      'navytrack_adsb_key',
    OPENSKY_USER:  'navytrack_opensky_user',
    OPENSKY_PASS:  'navytrack_opensky_pass',
    MARINE_KEY:    'navytrack_marine_key',
    REFRESH_INT:   'navytrack_refresh_int',
  },
};

// ── APPLICATION STATE ──
const STATE = {
  // API keys
  keys: {
    adsb:        null,
    openskyUser: null,
    openskyPass: null,
    marine:      null,
  },

  // Raw data from APIs
  raw: {
    flights:  [],
    carriers: [],
  },

  // Filtered + merged display data
  display: [],

  // Filters
  filters: {
    type:     'all',   // 'all' | 'flight' | 'carrier'
    aircraft: '',
    status:   '',
    search:   '',
  },

  // Sort
  sort: {
    col: 'callsign',
    dir: 'asc',      // 'asc' | 'desc'
  },

  // Status
  status:      'idle',  // 'idle' | 'loading' | 'online' | 'error'
  lastUpdate:  null,
  refreshTimer: null,
};
