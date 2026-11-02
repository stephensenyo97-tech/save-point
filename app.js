'use strict';
/* Save Point – personal gaming journal. No libraries, no network calls, no accounts.
 * Data lives in IndexedDB on this device (plus a localStorage mirror as a second copy).
 * Backups are plain JSON files you export yourself. */
(() => {
  // ───────────────────────── constants ─────────────────────────
  const DB_NAME = 'save-point', STORE = 'kv', KEY = 'state', UNDO_KEY = 'undo';
  const LS_MIRROR = 'savepoint.mirror.v1', LS_UNDO = 'savepoint.undo.v1', LS_DRAFT = 'savepoint.draft.', LS_HAD = 'savepoint.hadgames';
  const FORMAT = 2;
  const APP_VERSION = 'v6.5';
  const COVERS_KEY = 'covers';
  const LS_LIBVIEW = 'savepoint.libview', LS_PREF = 'savepoint.pickplat', LS_AUTOCOVER = 'savepoint.autocover', LS_CONFIRM = 'savepoint.confirmcovers', LS_REMIND = 'savepoint.remind';
  const PLATFORMS = ['PS5', 'PS4', 'PC', 'Xbox', 'Switch', 'Mobile', 'Other'];
  const STATUSES = [
    { id: 'want', label: 'Want to Play' }, { id: 'playing', label: 'Playing' },
    { id: 'paused', label: 'Paused' }, { id: 'finished', label: 'Finished' }
  ];
  const NOTE_TYPES = [
    { id: 'mission', label: 'Mission' }, { id: 'boss', label: 'Boss' }, { id: 'code', label: 'Codes' },
    { id: 'build', label: 'Build' }, { id: 'location', label: 'Location' }, { id: 'general', label: 'General' }
  ];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // ───────────────────────── helpers ─────────────────────────
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayStr = () => dateStr(new Date());
  const fmtDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : ''; };
  const fmtTime = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtDateTime = (ts) => { if (!ts) return 'never'; const d = new Date(ts); return `${fmtDate(dateStr(d))}, ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const statusLabel = (id) => (STATUSES.find((s) => s.id === id) || STATUSES[0]).label;
  const typeLabel = (id) => (NOTE_TYPES.find((t) => t.id === id) || NOTE_TYPES[5]).label;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } };

  const ICONS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    library: '<rect x="3" y="4" width="7" height="7" rx="2"/><rect x="14" y="4" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    journal: '<path d="M5 3h12a2 2 0 012 2v16H7a2 2 0 01-2-2V3z"/><path d="M9 8h6M9 12h6"/>',
    backup: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 19h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5z"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
    share: '<path d="M12 16V3"/><path d="M7 8l5-5 5 5"/><path d="M5 12v8h14v-8"/>',
    upload: '<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M4 19h16"/>',
    stats: '<path d="M5 20V11M12 20V4M19 20v-6"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/>',
    next: '<path d="M5 5l9 7-9 7z"/><path d="M19 5v14"/>',
    pad: '<path d="M6 8h12a4 4 0 014 4v2a3 3 0 01-5.4 1.8L15 14H9l-1.6 1.8A3 3 0 012 14v-2a4 4 0 014-4z"/><path d="M7 11v2M6 12h2M16 11.5h.01M18 12.5h.01"/>'
  };
  const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
  const LOGO = '<svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#3b82f6"/></linearGradient></defs><path d="M16 2l10 14-10 14L6 16z" fill="url(#lg)"/><path d="M16 2l10 14H6z" fill="#fff" opacity=".28"/></svg>';

  // ───────────────────────── data model / validation ─────────────────────────
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  const cid = (v) => str(v, 100).replace(/[^\w-]/g, '_');
  const num = (v, d) => (Number.isFinite(+v) && v !== null && v !== '' ? +v : d);

  function cleanGame(g) {
    if (!g || typeof g !== 'object') return null;
    const title = str(g.title, 200).trim();
    if (!title) return null;
    return {
      id: cid(g.id) || uid(), title,
      platform: str(g.platform, 40).trim() || 'Other',
      status: STATUSES.some((s) => s.id === g.status) ? g.status : 'want',
      progress: Math.min(100, Math.max(0, Math.round(num(g.progress, 0)))),
      rating: Math.min(10, Math.max(0, Math.round(num(g.rating, 0)))),
      fav: g.fav === true, queue: Math.max(0, num(g.queue === true ? Date.now() : g.queue, 0)),
      startedAt: /^\d{4}-\d{2}-\d{2}$/.test(g.startedAt || '') ? g.startedAt : '',
      finishedAt: /^\d{4}-\d{2}-\d{2}$/.test(g.finishedAt || '') ? g.finishedAt : '',
      leftOff: str(g.leftOff, 280).trim(),
      played: Math.min(600000, Math.max(0, Math.round(num(g.played, 0)))),
      plays: Array.isArray(g.plays) ? g.plays.map((p) => (p && /^\d{4}-\d{2}-\d{2}$/.test(p.d || '') && Math.round(num(p.m, 0)) > 0 ? { d: p.d, m: Math.min(1440, Math.round(num(p.m, 0))) } : null)).filter(Boolean).slice(-300) : [],
      sessionAt: num(g.sessionAt, 0) > 0 && num(g.sessionAt, 0) <= Date.now() + 60000 ? Math.round(num(g.sessionAt, 0)) : 0,
      createdAt: num(g.createdAt, Date.now()), updatedAt: num(g.updatedAt, Date.now())
    };
  }
  /** Tags: lowercase, no '#', up to 8 per note, 24 characters each. */
  function cleanTags(a) {
    const out = [];
    (Array.isArray(a) ? a : []).forEach((t) => { t = String(t == null ? '' : t).replace(/#/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 24).trim(); if (t && !out.includes(t) && out.length < 8) out.push(t); });
    return out;
  }
  /** "boss, missable #secret" → ['boss','missable','secret'] */
  const parseTags = (text) => cleanTags(String(text || '').split(/[,;\n#]+/));
  function cleanNote(n) {
    if (!n || typeof n !== 'object') return null;
    const gameId = cid(n.gameId);
    const body = str(n.body, 200000), title = str(n.title, 200).trim();
    if (!gameId || (!body.trim() && !title)) return null;
    const createdAt = num(n.createdAt, Date.now());
    return {
      id: cid(n.id) || uid(), gameId, title, body,
      type: NOTE_TYPES.some((t) => t.id === n.type) ? n.type : 'general', tags: cleanTags(n.tags),
      date: /^\d{4}-\d{2}-\d{2}$/.test(n.date || '') ? n.date : dateStr(new Date(createdAt)),
      createdAt, updatedAt: num(n.updatedAt, createdAt)
    };
  }
  // ── versus sessions: play with friends, log each game's score and winner ──
  const MAX_ROUNDS = 500;
  const cleanName = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 24);
  function cleanRound(r, players) {
    if (!r || typeof r !== 'object') return null;
    const scores = {};
    if (r.scores && typeof r.scores === 'object') players.forEach((p) => { const v = r.scores[p]; if (v !== undefined && v !== null && v !== '' && Number.isFinite(+v)) scores[p] = Math.max(-1e6, Math.min(1e6, Math.round(+v * 100) / 100)); });
    const winner = players.includes(r.winner) ? r.winner : '', res = r.res === 'win' || r.res === 'loss' ? r.res : '';
    if (!winner && !res && r.draw !== true) return null; // a game needs an outcome
    return { id: cid(r.id) || uid(), at: num(r.at, Date.now()), scores, winner, draw: !winner && !res && r.draw === true, res, note: str(r.note, 120).trim() };
  }
  /** Two teams of 1–4 names each, nobody on both. Anything else → no teams. */
  function cleanTeams(t) {
    if (!Array.isArray(t) || t.length !== 2) return [];
    const seen = new Set(), out = t.map((side) => { const a = []; (Array.isArray(side) ? side : []).forEach((p) => { const n = cleanName(p); if (n && !seen.has(n.toLowerCase()) && a.length < 4) { seen.add(n.toLowerCase()); a.push(n); } }); return a; });
    return out.every((a) => a.length) ? out : [];
  }
  const teamLabels = (teams) => { const l = teams.map((a) => a.join(' & ')); return l[0] !== l[1] && l.every((x) => x.length <= 24) ? l : ['Team A', 'Team B']; };
  function cleanMatch(m, gameIds) {
    if (!m || typeof m !== 'object') return null;
    const title = str(m.title, 200).trim(); if (!title) return null;
    const teams = cleanTeams(m.teams);
    const names = teams.length ? teamLabels(teams) : [];
    if (!teams.length) (Array.isArray(m.players) ? m.players : []).forEach((p) => { const n = cleanName(p); if (n && !names.some((x) => x.toLowerCase() === n.toLowerCase()) && names.length < 8) names.push(n); });
    if (!names.length) return null;
    const players = names, startedAt = num(m.startedAt, Date.now()), ended = num(m.endedAt, 0), gid = cid(m.gameId);
    return { id: cid(m.id) || uid(), gameId: gameIds && gameIds.has(gid) ? gid : '', title, platform: str(m.platform, 40).trim(), mode: m.mode === 'coop' && !teams.length ? 'coop' : 'versus', players, teams,
      startedAt, endedAt: ended > 0 ? Math.round(ended) : 0, rounds: (Array.isArray(m.rounds) ? m.rounds : []).slice(0, MAX_ROUNDS).map((r) => cleanRound(r, players)).filter(Boolean),
      note: str(m.note, 300).trim(), logged: Math.max(0, Math.round(num(m.logged, 0))), createdAt: num(m.createdAt, startedAt) };
  }
  /** Saved player names (most recently used first), kept even if sessions are deleted. */
  function cleanRoster(a) { const out = []; (Array.isArray(a) ? a : []).forEach((p) => { const n = cleanName(p); if (n && !out.some((x) => x.toLowerCase() === n.toLowerCase()) && out.length < 60) out.push(n); }); return out; }
  const rosterFromMatches = (ms) => { const seen = new Map(); (ms || []).slice().sort((a, b) => b.startedAt - a.startedAt).forEach((m) => (m.teams.length ? m.teams.flat() : m.players).forEach((n) => { if (!seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n); })); return [...seen.values()].slice(0, 60); };
  function freshState() { return { games: [], notes: [], matches: [], roster: [], meta: { createdAt: Date.now(), lastBackupAt: null, changes: 0 } }; }
  function normalizeState(raw) {
    const s = freshState();
    if (!raw || typeof raw !== 'object') return s;
    s.games = (Array.isArray(raw.games) ? raw.games : []).map(cleanGame).filter(Boolean);
    const ids = new Set(s.games.map((g) => g.id));
    s.notes = (Array.isArray(raw.notes) ? raw.notes : []).map(cleanNote).filter((n) => n && ids.has(n.gameId));
    s.matches = (Array.isArray(raw.matches) ? raw.matches : []).map((x) => cleanMatch(x, ids)).filter(Boolean).slice(0, 3000);
    s.roster = Array.isArray(raw.roster) ? cleanRoster(raw.roster) : rosterFromMatches(s.matches);
    const m = raw.meta || {};
    s.meta = { createdAt: num(m.createdAt, Date.now()), lastBackupAt: m.lastBackupAt ? num(m.lastBackupAt, null) : null, changes: Math.max(0, Math.round(num(m.changes, 0))) };
    return s;
  }

  // ───────────────────────── storage (IndexedDB + localStorage mirror) ─────────────────────────
  let db = null;
  const storage = { mode: 'none', idbOk: false, lsOk: false, lastSavedAt: null, persisted: null, lastError: '' };
  let state = freshState();
  const catDeep = new Set(), cat = new Map(), catMiss = new Map(); // cover cache for the built-in list: normalised title -> small JPEG data URL / time of last miss
  let covers = Object.create(null); // gameId -> small JPEG data URL (your own photos), kept in IndexedDB

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB unavailable'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
  }
  function idbGet(key) {
    return new Promise((resolve, reject) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
  }
  function idbPut(key, val) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(val, key);
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('aborted'));
    });
  }
  function idbDel(key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
  }
  function readMirror() { const t = lsGet(LS_MIRROR); if (!t) return null; try { return JSON.parse(t); } catch (e) { return null; } }

  async function loadState() {
    try {
      db = await openDB();
      storage.mode = 'indexeddb';
      try { covers = cleanCovers(await idbGet(COVERS_KEY)); } catch (e) { covers = Object.create(null); }
      const saved = await idbGet(KEY);
      if (saved) { state = normalizeState(saved); storage.idbOk = true; return; }
      const mirror = readMirror(); // IndexedDB empty but mirror exists → recover from it
      if (mirror) { state = normalizeState(mirror); storage.recovered = true; await save(); return; }
      storage.idbOk = true;
    } catch (e) {
      console.error('IndexedDB failed', e);
      db = null; storage.mode = 'localstorage'; storage.lastError = String(e && e.message || e);
      const mirror = readMirror();
      state = mirror ? normalizeState(mirror) : freshState();
    }
  }

  let saveChain = Promise.resolve();
  async function doSave() {
    let idb = false, ls = false;
    if (db) { try { await idbPut(KEY, state); idb = true; } catch (e) { console.error('IDB save failed', e); storage.lastError = String(e && e.message || e); } }
    ls = lsSet(LS_MIRROR, JSON.stringify(state)); lsSet(LS_HAD, String(state.games.length));
    storage.idbOk = idb; storage.lsOk = ls;
    if (idb || ls) storage.lastSavedAt = Date.now();
    if (!idb && !ls) throw new Error('Could not write to device storage');
  }
  function save() {
    const run = saveChain.then(doSave);
    saveChain = run.catch(() => {}); // a failed save must not block later saves
    return run;
  }
  async function stashUndo(label) {
    const rec = { at: Date.now(), label, state: JSON.parse(JSON.stringify(state)), covers: Object.assign({}, covers) };
    let ok = false;
    if (db) { try { await idbPut(UNDO_KEY, rec); ok = true; } catch (e) { /* fall through */ } }
    if (!ok) ok = lsSet(LS_UNDO, JSON.stringify(rec));
    return ok;
  }
  async function readUndo() {
    let rec = null;
    if (db) { try { rec = await idbGet(UNDO_KEY); } catch (e) { /* ignore */ } }
    if (!rec) { const t = lsGet(LS_UNDO); if (t) { try { rec = JSON.parse(t); } catch (e) { /* ignore */ } } }
    return rec && rec.state ? rec : null;
  }
  async function clearUndo() { if (db) { try { await idbDel(UNDO_KEY); } catch (e) { /* ignore */ } } lsDel(LS_UNDO); }

  async function askPersist() {
    try {
      if (navigator.storage && navigator.storage.persisted) {
        storage.persisted = await navigator.storage.persisted();
        if (!storage.persisted && navigator.storage.persist) storage.persisted = await navigator.storage.persist();
      }
    } catch (e) { /* unsupported */ }
  }

  /** Apply a change, then write to storage. Re-renders and reports failures loudly. */
  async function mutate(fn, okMsg) {
    fn(state);
    state.meta.changes += 1;
    render();
    try { await save(); if (okMsg) toast(okMsg); if (storage.persisted === null) askPersist(); }
    catch (e) { toast('⚠ Could not save! Export a backup now.', true); }
    renderBanners();
  }
  const gameById = (id) => state.games.find((g) => g.id === id);
  /** Change a game's status and keep the started/finished dates and Up-next list in step. */
  function applyStatus(g, v) {
    const prev = g.status, t = todayStr();
    g.status = v;
    if (v === 'playing' && !g.startedAt) g.startedAt = t;
    if (v === 'finished') { g.progress = 100; if (!g.finishedAt) g.finishedAt = t; } else if (prev === 'finished') g.finishedAt = '';
    if (v === 'playing' || v === 'finished') g.queue = 0;
    g.updatedAt = Date.now();
  }
  function newGame(base) {
    const g = Object.assign({ id: uid(), title: '', platform: 'Other', status: 'want', progress: 0, rating: 0, fav: false, queue: 0, startedAt: '', finishedAt: '', played: 0, plays: [], sessionAt: 0, createdAt: Date.now(), updatedAt: Date.now() }, base, { status: 'want' });
    applyStatus(g, base.status || 'want'); g.updatedAt = g.createdAt; return g;
  }
  // ── hours played: stored as whole minutes, always shown in hours ──
  const MAX_SESSION_MIN = 720;
  const fmtHours = (min) => { min = Math.max(0, Math.round(min || 0)); if (!min) return '0 h'; const h = min / 60; return h < 0.1 ? '<0.1 h' : (h >= 100 ? String(Math.round(h)) : String(Math.round(h * 10) / 10)) + ' h'; };
  function addPlay(g, minutes) { minutes = Math.round(minutes); if (!(minutes > 0)) return; g.played = Math.min(600000, (g.played || 0) + minutes); g.plays = (g.plays || []).concat({ d: todayStr(), m: Math.min(1440, minutes) }).slice(-300); g.updatedAt = Date.now(); }
  const sessionMin = (g) => (g.sessionAt ? Math.max(0, Math.floor((Date.now() - g.sessionAt) / 60000)) : 0);
  const totalPlayed = () => state.games.reduce((a, g) => a + (g.played || 0), 0);
  /** Minutes played in the last 7 days (today included) and per week for the last 8 weeks, from the dated log. */
  function weekly() {
    const t = todayStr(), w = new Array(8).fill(0);
    state.games.forEach((g) => (g.plays || []).forEach((p) => { const d = daysBetween(p.d, t); if (d >= 0 && d < 56) w[Math.floor(d / 7)] += p.m; }));
    return w;
  }
  const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
  const notesOf = (id) => state.notes.filter((n) => n.gameId === id);
  const byNewestNote = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt);

  // ───────────────────────── backup / import ─────────────────────────
  function buildBackup() {
    return { app: 'save-point', format: FORMAT, exportedAt: new Date().toISOString(), counts: { games: state.games.length, notes: state.notes.length, matches: state.matches.length, photos: Object.keys(covers).length }, games: state.games, notes: state.notes, matches: state.matches, roster: state.roster, covers: Object.assign({}, covers) };
  }
  const backupFilename = () => `save-point-backup-${todayStr()}.json`;
  async function markBackedUp() { state.meta.lastBackupAt = Date.now(); state.meta.changes = 0; render(); try { await save(); } catch (e) { /* ignore */ } renderBanners(); }

  /** How many days between backup reminders: 7, 14 or 30 (0 = never remind). */
  const remindDays = () => { const v = lsGet(LS_REMIND); return v === null ? 14 : [0, 7, 14, 30].includes(+v) ? +v : 14; };
  const daysSince = (ts) => Math.max(0, Math.floor((Date.now() - ts) / 86400000));
  const agoText = (ts) => { const d = daysSince(ts); return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; };
  /** Reminder is due when there are unsaved changes and the last backup is older than the chosen interval. */
  const backupStale = () => { const m = state.meta, r = remindDays(); return !!(r && m.lastBackupAt && m.changes > 0 && daysSince(m.lastBackupAt) >= r); };

  /** What the Backup tab should nag about, or null. (Shown on the Backup page and as a dot on its tab, not on every screen.) */
  function backupNeed() {
    const m = state.meta, total = state.games.length + state.notes.length; if (!total) return null;
    if (!m.lastBackupAt) return { head: 'No backup yet', text: 'Your journal only exists on this phone.' };
    if (backupStale()) return { head: `Last backup: ${agoText(m.lastBackupAt)}`, text: `${plural(m.changes, 'change')} since then.` };
    if (m.changes >= 10) return { head: `${plural(m.changes, 'change')} since your last backup`, text: 'A fresh backup keeps them safe.' };
    return null;
  }

  async function exportBackup() {
    const text = JSON.stringify(buildBackup(), null, 2);
    const file = new File([text], backupFilename(), { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Save Point backup' });
        await markBackedUp(); toast('Backup shared – choose “Save to Files” to keep it');
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') { toast('Backup cancelled – nothing was saved'); return; }
        // any other error: fall through to plain download
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    await markBackedUp(); toast('Backup file downloaded');
  }
  async function copyBackup() {
    const text = JSON.stringify(buildBackup());
    try { await navigator.clipboard.writeText(text); await markBackedUp(); toast('Backup copied – paste it into Notes or a message'); }
    catch (e) { toast('Copy was blocked. Use “Save backup file” instead.', true); }
  }

  function parseBackup(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { throw new Error('That is not a valid backup (could not read the data).'); }
    if (!obj || obj.app !== 'save-point' || !Array.isArray(obj.games) || !Array.isArray(obj.notes)) throw new Error('That file is not a Save Point backup.');
    if (num(obj.format, 1) > FORMAT) throw new Error('This backup was made by a newer version of Save Point. Update the app first (Backup tab → Check for update), then try again.');
    const games = obj.games.map(cleanGame).filter(Boolean);
    const ids = new Set(games.map((g) => g.id));
    const notes = obj.notes.map(cleanNote).filter((n) => n && ids.has(n.gameId));
    const skipped = (obj.games.length - games.length) + (obj.notes.length - notes.length);
    const matches = (Array.isArray(obj.matches) ? obj.matches : []).map((x) => cleanMatch(x, ids)).filter(Boolean).slice(0, 3000);
    const roster = Array.isArray(obj.roster) ? cleanRoster(obj.roster) : rosterFromMatches(matches);
    return { games, notes, matches, roster, covers: cleanCovers(obj.covers, ids), skipped, exportedAt: obj.exportedAt || null };
  }
  function showImport(parsed) {
    const ts = Date.parse(parsed.exportedAt || ''); const when = ts ? fmtDateTime(ts) : 'an unknown date';
    openSheet(`<h2>Import backup</h2>
      <p class="muted">Backup made ${esc(when)}: <b>${plural(parsed.games.length, 'game')}</b> and <b>${plural(parsed.notes.length, 'note')}</b>${Object.keys(parsed.covers).length ? ` and <b>${plural(Object.keys(parsed.covers).length, 'photo')}</b>` : ''}${parsed.skipped ? ` (${parsed.skipped} unreadable item${parsed.skipped === 1 ? '' : 's'} skipped)` : ''}.</p>
      <p class="muted small" style="margin-top:10px">Right now you have ${plural(state.games.length, 'game')} and ${plural(state.notes.length, 'note')}. Either choice can be undone from the Backup tab.</p>
      <div class="actions col">
        <button class="btn primary" data-act="do-import" data-mode="merge">Merge with what I have</button>
        <button class="btn danger" data-act="do-import" data-mode="replace">Replace everything with this backup</button>
        <button class="btn" data-act="close-sheet">Cancel</button>
      </div>`);
    pendingImport = parsed;
  }
  /** Read the saved copy back from storage and compare it with what the app is showing. */
  async function checkStorage() {
    const rows = [];
    const row = (l, ok, extra) => rows.push(`<div class="kv"><span>${esc(l)}</span><span class="${ok ? 'ok' : 'warn'}">${esc(extra)}</span></div>`);
    let idbState = null;
    if (db) { try { idbState = await idbGet(KEY); } catch (e) { /* reported below */ } }
    const mir = readMirror(), g = state.games.length, n = state.notes.length;
    if (db) row('Main storage (IndexedDB)', !!idbState && (idbState.games || []).length === g && (idbState.notes || []).length === n, idbState ? `${plural((idbState.games || []).length, 'game')}, ${plural((idbState.notes || []).length, 'note')}` : 'Nothing saved there');
    else row('Main storage (IndexedDB)', false, 'Blocked by this browser');
    row('Second copy (localStorage)', !!mir && (mir.games || []).length === g, mir ? `${plural((mir.games || []).length, 'game')}` : 'No copy found');
    row('Shown in the app now', true, `${plural(g, 'game')}, ${plural(n, 'note')}`);
    row('Photos saved', true, String(Object.keys(covers).length));
    if (navigator.storage && navigator.storage.persisted) { try { const p = await navigator.storage.persisted(); row('Protected from automatic cleanup', p, p ? 'Yes' : 'Not guaranteed'); } catch (e) { /* ignore */ } }
    const good = db && idbState && (idbState.games || []).length === g;
    openSheet(`<h2>${good ? 'Your data is saved' : 'Check this'}</h2><p class="muted small" style="margin:6px 0 10px">${good ? 'The saved copy matches what you see.' : 'The saved copy does not match what you see, or storage is unavailable. Make a backup now.'}</p>${rows.join('')}
      <div class="actions"><button class="btn" data-act="close-sheet">Close</button>${good ? '' : '<button class="btn primary" data-act="export">Back up now</button>'}</div>`);
  }
  /** Look inside a backup file without importing it, so you can be sure the file you saved is good. */
  function showCheck(parsed, name) {
    const ts = Date.parse(parsed.exportedAt || ''), np = Object.keys(parsed.covers).length;
    openSheet(`<h2>This backup is good</h2><p class="muted small" style="margin-top:4px">${esc(String(name || '').slice(0, 80))}</p>
      <div class="kv" style="margin-top:10px"><span>Made</span><span>${ts ? esc(fmtDateTime(ts)) : 'unknown date'}</span></div>
      <div class="kv"><span>Games</span><span>${parsed.games.length}</span></div>
      <div class="kv"><span>Notes</span><span>${parsed.notes.length}</span></div>
      <div class="kv"><span>Photos</span><span>${np}</span></div>
      ${parsed.skipped ? `<p class="warn small" style="margin-top:8px">${plural(parsed.skipped, 'entry')} in the file could not be read and would be skipped.</p>` : ''}
      <p class="muted small" style="margin-top:10px">Nothing was imported or changed. Right now you have ${plural(state.games.length, 'game')} and ${plural(state.notes.length, 'note')}.</p>
      <div class="actions"><button class="btn primary" data-act="close-sheet">Close</button></div>`);
  }
  let pendingImport = null;
  async function applyImport(mode) {
    const p = pendingImport; if (!p) return;
    pendingImport = null; closeSheet();
    const stashed = await stashUndo(mode === 'replace' ? 'import (replace)' : 'import (merge)');
    let added = 0, updated = 0;
    await mutate((s) => {
      if (mode === 'replace') { s.games = p.games; s.notes = p.notes; s.matches = p.matches || []; s.roster = p.roster || []; added = p.games.length; covers = Object.assign(Object.create(null), p.covers); }
      else {
        const gi = new Map(s.games.map((g) => [g.id, g]));
        p.games.forEach((g) => { const cur = gi.get(g.id); if (!cur) { s.games.push(g); added++; if (p.covers[g.id]) covers[g.id] = p.covers[g.id]; } else if (g.updatedAt > cur.updatedAt) { Object.assign(cur, g); updated++; if (p.covers[g.id]) covers[g.id] = p.covers[g.id]; } });
        const ni = new Map(s.notes.map((n) => [n.id, n]));
        p.notes.forEach((n) => { const cur = ni.get(n.id); if (!cur) { s.notes.push(n); } else if (n.updatedAt > cur.updatedAt) { Object.assign(cur, n); } });
        s.roster = cleanRoster([...(s.roster || []), ...(p.roster || [])]);
        const mi = new Set((s.matches || []).map((x) => x.id)); (p.matches || []).forEach((x) => { if (!mi.has(x.id)) (s.matches = s.matches || []).push(x); });
      }
    });
    await saveCovers();
    if (mode === 'replace') { state.meta.changes = 0; try { await save(); } catch (e) { /* reported by next save */ } }
    renderBanners(); render();
    toast(`Imported ${plural(p.games.length, 'game')} and ${plural(p.notes.length, 'note')}${stashed ? '' : ' (undo not available)'}`);
  }
  async function undoLast() {
    const rec = await readUndo(); if (!rec) return toast('Nothing to undo');
    const ok = await confirmBox({ title: 'Undo last import / erase?', message: `This puts your journal back how it was on ${fmtDateTime(rec.at)} (${rec.label}). Anything added since then will be lost.`, okLabel: 'Undo', danger: true });
    if (!ok) return;
    state = normalizeState(rec.state); covers = cleanCovers(rec.covers, new Set(state.games.map((g) => g.id))); await saveCovers();
    try { await save(); await clearUndo(); toast('Journal restored'); } catch (e) { toast('⚠ Could not save restored data', true); }
    render(); renderBanners();
  }


  // ───────────────────────── covers (generated, or your own photo) ─────────────────────────
  const PALETTES = [['#0ea5e9', '#4f46e5'], ['#22d3ee', '#2563eb'], ['#8b5cf6', '#db2777'], ['#14b8a6', '#0369a1'], ['#f59e0b', '#dc2626'], ['#10b981', '#1d4ed8'], ['#6366f1', '#0891b2'], ['#ec4899', '#d97706'], ['#06b6d4', '#7c3aed'], ['#ef4444', '#6d28d9'], ['#84cc16', '#0f766e'], ['#38bdf8', '#9333ea']];
  const hash32 = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const coverInitials = (title) => {
    const words = normKey(title).split(' ').filter((w) => w && !['the', 'of', 'a', 'an', 'and', 's'].includes(w));
    const pick = words.slice(0, 3).map((w) => (/^\d+$/.test(w) ? w.slice(0, 2) : w[0])).join('').toUpperCase();
    return pick.slice(0, 3) || '?';
  };
  function coverPattern(kind, m) {
    let o = '';
    if (kind === 0) for (let i = -400; i < 400; i += 30 * m) o += `<path d="M${i} 0L${i + 400} 400" stroke="#fff" stroke-width="${9 * m}"/>`;
    else if (kind === 1) for (let r = 40; r < 460; r += 46 * m) o += `<circle cx="250" cy="90" r="${r}" fill="none" stroke="#fff" stroke-width="${4 * m}"/>`;
    else if (kind === 2) for (let y = 20; y < 400; y += 34 * m) for (let x = 20; x < 300; x += 34 * m) o += `<circle cx="${x}" cy="${y}" r="${3.5 * m}" fill="#fff"/>`;
    else if (kind === 3) for (let y = -20; y < 420; y += 70 * m) o += `<path d="M0 ${y}L150 ${y + 60}L300 ${y}L300 ${y + 24 * m}L150 ${y + 84}L0 ${y + 24 * m}Z" fill="#fff"/>`;
    else if (kind === 4) o += '<path d="M0 250L300 110V400H0Z" fill="#fff" opacity=".7"/><path d="M0 200L300 60V90L0 230Z" fill="#fff"/>';
    else for (let y = 30; y < 420; y += 48 * m) o += `<path d="M0 ${y}Q75 ${y - 44} 150 ${y}T300 ${y}" fill="none" stroke="#fff" stroke-width="${5 * m}"/>`;
    return o;
  }
  function coverLines(title, fs, maxW) {
    const cw = fs * 0.6, per = Math.max(4, Math.floor(maxW / cw)), lines = []; let cur = '';
    String(title).split(/\s+/).forEach((w) => {
      while (w.length > per) { if (cur) { lines.push(cur); cur = ''; } lines.push(w.slice(0, per - 1) + '-'); w = w.slice(per - 1); }
      const t = cur ? cur + ' ' + w : w; if (t.length <= per) cur = t; else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur); return lines;
  }
  /** A clean generated cover. Same title → same cover, always. kind 'full' (title on it) or 'thumb' (initials only). */
  function coverSVG(title, platform, kind) {
    const SF = FONT.replace(/"/g, "'");
    const h = hash32(normKey(title)), pal = PALETTES[h % PALETTES.length], pat = (h >>> 8) % 6, rot = 25 + ((h >>> 16) % 70), id = 'cv' + h.toString(36);
    const full = kind === 'full', ini = coverInitials(title);
    let body = `<defs><linearGradient id="${id}" gradientTransform="rotate(${rot} .5 .5)"><stop offset="0" stop-color="${pal[0]}"/><stop offset="1" stop-color="${pal[1]}"/></linearGradient><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".72"/></linearGradient></defs>`;
    body += `<rect width="300" height="400" fill="url(#${id})"/><g opacity="${full ? .16 : .2}">${coverPattern(pat, full ? 1 : 2)}</g>`;
    if (full) {
      body += `<text x="150" y="238" text-anchor="middle" font-family="${SF}" font-weight="900" font-size="${ini.length > 2 ? 125 : 190}" fill="#fff" opacity=".14">${esc(ini)}</text><rect width="300" height="400" fill="url(#${id}s)"/>`;
      let fs = 36, lines = coverLines(title, fs, 252); while ((lines.length > 4 || lines.length * fs * 1.12 > 190) && fs > 20) { fs -= 2; lines = coverLines(title, fs, 252); }
      lines = lines.slice(0, 5); const y0 = 372 - (lines.length - 1) * fs * 1.12;
      body += lines.map((l, i) => `<text x="24" y="${(y0 + i * fs * 1.12).toFixed(1)}" font-family="${SF}" font-weight="800" font-size="${fs}" fill="#fff">${esc(l)}</text>`).join('');
      const plat = String(platform || '').toUpperCase().slice(0, 14);
      body += `<path d="M30 40l12 16-12 16-12-16z" fill="#fff" opacity=".9"/><text x="54" y="62" font-family="${SF}" font-weight="800" font-size="19" letter-spacing="3" fill="#fff" opacity=".9">${esc(plat)}</text>`;
    } else {
      body += `<text x="150" y="250" text-anchor="middle" font-family="${SF}" font-weight="900" font-size="${ini.length > 2 ? 88 : 140}" fill="#fff">${esc(ini)}</text>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(title)} cover" class="cv">${body}</svg>`;
  }
  const coverHTML = (g, kind) => { const u = covers[g.id] || cat.get(normKey(g.title)); return u ? `<img class="cv" src="${u}" alt="${esc(g.title)} cover">` : coverSVG(g.title, g.platform, kind); };
  const thumbFor = (title) => { const u = cat.get(normKey(title)); return u ? `<img class="cv" src="${u}" alt="">` : coverSVG(title, '', 'thumb'); };
  /** Swap generated covers for real art in place, as it arrives. */
  function refreshCoverEls() {
    document.querySelectorAll('[data-ck]').forEach((el) => { const u = cat.get(el.dataset.ck); if (u && el.querySelector('svg.cv')) el.innerHTML = `<img class="cv" src="${u}" alt="">`; });
  }
  const COVER_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
  function cleanCovers(raw, ids) {
    const out = Object.create(null); if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    Object.keys(raw).forEach((k) => { const id = cid(k), v = raw[k]; if ((!ids || ids.has(id)) && typeof v === 'string' && v.length < 700000 && COVER_RE.test(v)) out[id] = v; });
    return out;
  }
  async function saveCovers() {
    if (!db) return false;
    try { await idbPut(COVERS_KEY, Object.assign({}, covers)); return true; }
    catch (e) { toast('⚠ Could not save the photo (device storage full?)', true); return false; }
  }
  async function fileToCover(file, TW = 360, TH = 480, quality = 0.82) {
    if (file.size > 60 * 1024 * 1024) throw new Error('too big');
    let src, w, h;
    try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); w = src.width; h = src.height; }
    catch (e) {
      src = await new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { res(im); setTimeout(() => URL.revokeObjectURL(u), 5000); }; im.onerror = () => rej(new Error('bad image')); im.src = u; });
      w = src.naturalWidth; h = src.naturalHeight;
    }
    if (!w || !h) throw new Error('bad image');
    const c = document.createElement('canvas'); c.width = TW; c.height = TH;
    const x = c.getContext('2d'), sc = Math.max(TW / w, TH / h), dw = w * sc, dh = h * sc;
    x.fillStyle = '#0a1322'; x.fillRect(0, 0, TW, TH); x.drawImage(src, (TW - dw) / 2, (TH - dh) / 2, dw, dh);
    const url = c.toDataURL('image/jpeg', quality); if (!COVER_RE.test(url)) throw new Error('could not encode');
    return url;
  }
  async function setCoverFromFile(id, file) {
    if (!db) return toast('Photos need device storage, which this browser has blocked', true);
    try {
      const url = await fileToCover(file), prev = covers[id]; covers[id] = url;
      if (!(await saveCovers())) { if (prev) covers[id] = prev; else delete covers[id]; render(); return; }
      await mutate((s) => { gameById2(s, id).updatedAt = Date.now(); }, 'Cover updated');
    } catch (e) { toast('Could not use that picture. Try a different one.', true); }
  }
  async function clearCover(id) {
    delete covers[id]; await saveCovers();
    await mutate((s) => { gameById2(s, id).updatedAt = Date.now(); }, 'Using the generated cover');
  }
  function loadImg(url) { return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; }); }
  async function coverImageFor(g) {
    if (covers[g.id] || cat.get(normKey(g.title))) return loadImg(covers[g.id] || cat.get(normKey(g.title)));
    const svg = coverSVG(g.title, g.platform, 'full').replace('<svg ', '<svg width="600" height="800" ');
    return loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  }


  // ───────────────────────── real cover art, fetched by your phone (needs internet, then works offline) ─────────────────────────
  // The app ships no copyrighted art. Your phone asks Wikipedia for each game's article by its exact title
  // (several likely spellings per game, checked in ONE request for ~14 games), keeps only articles that are
  // described as games, downloads the cover thumbnail, shrinks it and stores it on the device.
  const WIKI = 'https://en.wikipedia.org/w/api.php?format=json&origin=*&action=query&redirects=1&prop=pageimages%7Cdescription&piprop=thumbnail&pilicense=any&';
  const wikiBase = (t) => normKey(String(t).replace(/\s*\([^)]*\)\s*$/, ''));
  const isGamePage = (t) => { const m = /\(([^)]*)\)\s*$/.exec(String(t)); return !m || /video game/i.test(m[1]); };
  const isGameDesc = (d) => !/\bseries\b|franchise|\b(company|developer|publisher|studio|soundtrack|album|film|television)\b/i.test(d) && (/video game|computer game|mobile game/i.test(d) || (/\bgame\b/i.test(d) && !/board game|card game|tabletop|party game|game show/i.test(d)));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const autoCovers = () => lsGet(LS_AUTOCOVER) !== '0';
  async function timedFetch(url, ms) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 15000);
    try { const r = await fetch(url, { signal: ctl.signal, referrerPolicy: 'no-referrer' }); if (!r.ok) throw new Error('HTTP ' + r.status); return r; }
    finally { clearTimeout(t); }
  }
  /** Download a thumbnail, backing off and retrying when Wikimedia says "slow down" (429) or hiccups (5xx). */
  async function fetchThumb(src) {
    let last;
    for (let i = 0; i < 3; i++) {
      try { return await (await timedFetch(src, 20000)).blob(); }
      catch (e) { last = e; covq.lastError = String((e && e.message) || e).slice(0, 80); if (!/HTTP (429|5\d\d)/.test(String(e && e.message)) && !(e && e.name === 'AbortError')) break; await sleep(i ? 4000 : 1500); }
    }
    throw last;
  }
  const okThumb = (src) => typeof src === 'string' && /^https:\/\/upload\.wikimedia\.org\//.test(src);

  /** Likely Wikipedia article titles for a game, best first. */
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const SMALL = /^(a|an|the|of|and|in|on|at|to|for|from|with|vs|or|de)$/i;
  /** Extra spellings for the "fix missing covers" pass: no subtitle, no edition words, Wikipedia-style capitals, number ↔ roman numeral. */
  function deepBases(t, risky) {
    const out = [];
    const add = (x) => { x = String(x || '').replace(/\s+/g, ' ').replace(/[\s:–-]+$/, '').trim(); if (x.length > 1 && x !== t && !out.includes(x)) out.push(x); };
    const noEdition = t.replace(/\b(the )?(remastered|remaster|definitive edition|complete edition|game of the year edition|goty edition|deluxe edition|director's cut|special edition|enhanced edition|anniversary edition|ultimate edition|legendary edition|gold edition|standard edition)\b/ig, '').replace(/\(\s*\)/g, '');
    add(noEdition);
    if (risky) { add(t.split(/\s*[:–—]\s*|\s+-\s+/)[0]); add(noEdition.split(/\s*[:–—]\s*|\s+-\s+/)[0]); } // may land on the series/first game, so only ever shown for you to confirm
    add(t.replace(/^the\s+/i, '')); if (!/^the\s/i.test(t)) add('The ' + t);
    add(t.split(' ').map((w, i) => (i && SMALL.test(w) ? w.toLowerCase() : w)).join(' '));
    const m = /^(.*\S)\s+(\d{1,2})$/.exec(t); if (m && +m[2] > 1 && +m[2] <= 10) add(m[1] + ' ' + ROMAN[+m[2]]);
    const r = /^(.*\S)\s+(II|III|IV|V|VI|VII|VIII|IX|X)$/.exec(t); if (r) add(r[1] + ' ' + ROMAN.indexOf(r[2]));
    if (/^marvel's /i.test(t)) add(t.replace(/^marvel's /i, '')); else if (/^(spider-man|wolverine|guardians of the galaxy|iron man|avengers)\b/i.test(t)) add("Marvel's " + t);
    return out;
  }
  function titleVariants(title, date, deep) { // deep: 1 = safe extra spellings (automatic), 2 = also subtitle-less (only for confirm screen)
    const t = String(title).replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim(), y = (/^(\d{4})/.exec(date || '') || [])[1] || '', out = [];
    const add = (x) => { if (x && x.length < 200 && !/[|<>#[\]{}]/.test(x) && !out.includes(x)) out.push(x); };
    const alt = /&/.test(t) ? t.replace(/\s*&\s*/g, ' and ') : /\band\b/.test(t) ? t.replace(/\band\b/g, '&') : '';
    [t, alt].forEach((b) => { if (!b) return; if (y) add(`${b} (${y} video game)`); add(`${b} (video game)`); add(b); });
    if (!deep) return out.slice(0, 6);
    deepBases(t, deep === 2).forEach((b) => { add(`${b} (video game)`); add(b); });
    return out.slice(0, 14);
  }
  /** One request for many games. Returns, for each entry, {src,title} or null. */
  async function wikiLookup(batch, wantAll) {
    const vars = batch.map((e) => titleVariants(e.title, e.date, e.deep)), all = [...new Set(vars.flat())];
    const url = WIKI + 'pithumbsize=330&titles=' + all.map(encodeURIComponent).join('%7C');
    const q = ((await (await timedFetch(url, 20000)).json()) || {}).query || {};
    const step = new Map(); (q.normalized || []).forEach((n) => step.set(n.from, n.to)); (q.redirects || []).forEach((r) => step.set(r.from, r.to));
    const resolve = (v) => { let c = v, n = 0; while (step.has(c) && n++ < 6) c = step.get(c); return c; };
    const byTitle = new Map(); Object.values(q.pages || {}).forEach((p) => { if (p && typeof p.title === 'string') byTitle.set(p.title, p); });
    return vars.map((vs) => {
      const hits = [];
      for (const v of vs) {
        const pg = byTitle.get(resolve(v));
        if (!pg || pg.missing !== undefined || !pg.thumbnail || !okThumb(pg.thumbnail.source)) continue;
        const ok = typeof pg.description === 'string' && pg.description ? isGameDesc(pg.description) : /video game/i.test(v);
        if (ok && !hits.some((h) => h.src === pg.thumbnail.source)) { hits.push({ src: pg.thumbnail.source, title: pg.title }); if (!wantAll) break; }
      }
      return wantAll ? hits : hits[0] || null;
    });
  }

  // cache of fetched covers: one IndexedDB entry per game ("cc:<title key>") in the existing store, so no schema change
  const CC = 'cc:';
  const idbReq = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function loadCoverCache() {
    if (!db) return;
    try {
      const range = IDBKeyRange.bound(CC, CC + '￿'), st = db.transaction(STORE, 'readonly').objectStore(STORE);
      const [keys, vals] = await Promise.all([idbReq(st.getAllKeys(range)), idbReq(st.getAll(range))]);
      keys.forEach((k, i) => { const key = String(k).slice(CC.length), v = vals[i]; if (v && typeof v.u === 'string' && COVER_RE.test(v.u)) cat.set(key, v.u); else if (v && v.m && v.v >= 2) { catMiss.set(key, +v.t || 0); if (v.d) catDeep.add(key); } });
    } catch (e) { console.warn('cover cache not loaded', e); }
    refreshCoverEls(); if (route().name === 'backup') render();
  }
  function ccPutMany(items) {
    if (!db || !items.length) return Promise.resolve();
    return new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'), st = tx.objectStore(STORE); items.forEach(([k, v]) => st.put(v, CC + k)); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('aborted')); });
  }
  async function clearCoverCache() {
    cat.clear(); catMiss.clear(); catDeep.clear();
    if (db) await new Promise((res) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(IDBKeyRange.bound(CC, CC + '￿')); tx.oncomplete = () => res(); tx.onerror = () => res(); });
    render(); toast('Cover cache cleared');
  }
  const cacheBytes = () => { let n = 0; cat.forEach((v) => { n += v.length; }); return n; };

  // background queue
  const covq = { queue: [], queued: new Set(), running: false, cancel: false, found: 0, missed: 0, failed: 0, total: 0, gap: 250, paused: '', lastError: '', onProgress: null };
  const needsCover = (key) => key && !cat.has(key) && !covq.queued.has(key) && !(catMiss.has(key) && Date.now() - catMiss.get(key) < 21 * 86400000);
  const entryOf = (title, date) => ({ key: normKey(title), title, date: date || '' });
  function enqueueCovers(entries, force) {
    if (!db || navigator.onLine === false || (!force && !autoCovers())) return 0;
    let n = 0;
    for (const e of entries) { if (e.deep ? (cat.has(e.key) || covq.queued.has(e.key)) : !needsCover(e.key)) continue; covq.queue.push(e); covq.queued.add(e.key); n++; }
    if (n) { if (!covq.running) { covq.found = covq.missed = covq.failed = 0; covq.paused = ''; covq.total = 0; } covq.total += n; runCovq(); }
    return n;
  }
  const libraryCoverEntries = () => state.games.filter((g) => !covers[g.id]).map((g) => { const c = CATALOG_BY_KEY.get(normKey(g.title)); return entryOf(g.title, c && c.date); });
  async function runCovq() {
    if (covq.running) return; covq.running = true; covq.cancel = false; let apiFails = 0;
    try {
      while (covq.queue.length && !covq.cancel) {
        if (navigator.onLine === false) { covq.paused = 'offline'; break; }
        const batch = []; let titles = 0;
        while (covq.queue.length && batch.length < 14) { const nt = titleVariants(covq.queue[0].title, covq.queue[0].date, covq.queue[0].deep).length; if (batch.length && titles + nt > 48) break; batch.push(covq.queue.shift()); titles += nt; }
        let results;
        try { results = await wikiLookup(batch); apiFails = 0; }
        catch (e) {
          apiFails++; covq.failed += batch.length; covq.lastError = String((e && e.message) || e).slice(0, 80); batch.forEach((x) => covq.queued.delete(x.key));
          if (apiFails >= 3) { covq.paused = 'unreachable'; break; }
          await sleep(1500); continue;
        }
        const puts = [];
        for (let i = 0; i < batch.length; i += 3) {
          await Promise.all(batch.slice(i, i + 3).map(async (e, j) => {
            const hit = results[i + j];
            try {
              if (hit) { const url = await fileToCover(await fetchThumb(hit.src), 240, 320, 0.72); cat.set(e.key, url); catMiss.delete(e.key); puts.push([e.key, { u: url, t: Date.now() }]); covq.found++; }
              else { catMiss.set(e.key, Date.now()); if (e.deep) catDeep.add(e.key); puts.push([e.key, e.deep ? { m: 1, v: 2, d: 1, t: Date.now() } : { m: 1, v: 2, t: Date.now() }]); covq.missed++; }
            } catch (err) { covq.failed++; covq.lastError = String((err && err.message) || err).slice(0, 80); }
            covq.queued.delete(e.key);
          }));
        }
        try { await ccPutMany(puts); } catch (e) { /* works this session, just won't persist */ }
        refreshCoverEls(); if (covq.onProgress) covq.onProgress(false);
        if (covq.gap) await sleep(covq.gap);
      }
    } finally {
      covq.queue.splice(0).forEach((x) => covq.queued.delete(x.key)); covq.running = false;
      if (covq.onProgress) covq.onProgress(true);
      if (route().name === 'backup') render();
    }
  }
  // "Fix missing covers": games that still have no real cover get a second, wider automatic try (safe spellings only),
  // then whatever is still missing is offered one by one for you to confirm.
  const missingCover = () => state.games.filter((g) => !covers[g.id] && !cat.has(normKey(g.title)));
  function startFixJob() {
    if (!db) return toast('Cover art needs device storage, which this browser has blocked', true);
    if (navigator.onLine === false) return toast('Connect to the internet first', true);
    const miss = missingCover(); if (!miss.length) return toast('Every game in your library already has a cover');
    const todo = miss.filter((g) => !catDeep.has(normKey(g.title)));
    if (!todo.length || covq.running) return startReview(miss.map(rvItem));
    const entries = todo.map((g) => { const c = CATALOG_BY_KEY.get(normKey(g.title)); return { ...entryOf(g.title, c && c.date), deep: 1 }; });
    openSheet('<h2>Fixing missing covers</h2><div id="cprog"></div><div class="actions" id="cacts"><button class="btn" data-act="stop-cover-job">Stop</button></div>');
    const paint = (done) => {
      const el = $('#cprog'); if (!el) { covq.cancel = true; return; }
      const checked = covq.found + covq.missed + covq.failed, pct = covq.total ? Math.min(100, Math.round((checked / covq.total) * 100)) : 100;
      el.innerHTML = `<div class="bar"><i style="width:${pct}%"></i></div><p style="margin:12px 0 4px"><b>${covq.found}</b> fixed · ${checked} of ${covq.total} checked</p>`
        + (done ? `<p class="muted small">${covq.paused === 'unreachable' ? 'Couldn’t reach Wikipedia, so this stopped. Try again later. ' : covq.cancel ? 'Stopped. ' : ''}${covq.failed ? `${plural(covq.failed, 'download')} failed${covq.lastError ? ` (last problem: ${esc(covq.lastError)})` : ''}. ` : ''}${plural(missingCover().length, 'game')} still ${missingCover().length === 1 ? 'has' : 'have'} no cover.</p>` : '<p class="muted small">Trying other spellings of each title. Keep this open.</p>');
      if (done) { const n = missingCover().length; $('#cacts').innerHTML = (n && covq.paused !== 'unreachable' ? '<button class="btn primary" data-act="fix-review">Review the rest one by one</button>' : '') + '<button class="btn" data-act="close-sheet">Done</button>'; }
    };
    covq.onProgress = paint; covq.found = covq.missed = covq.failed = 0; covq.total = 0; covq.paused = '';
    enqueueCovers(entries, true); paint(!covq.running);
  }
  /** Foreground job with a progress sheet: scope 'library' (your games) or 'all' (the whole built-in list). */
  function startCoverJob(scope) {
    if (!db) return toast('Cover art needs device storage, which this browser has blocked', true);
    if (navigator.onLine === false) return toast('Connect to the internet first', true);
    const entries = scope === 'all' ? CATALOG.map((g) => entryOf(g.title, g.date)) : libraryCoverEntries();
    const fresh = entries.filter((e) => needsCover(e.key)).length;
    if (!fresh && !covq.running) return toast(scope === 'all' ? 'Every game in the list has already been checked' : 'Your games have all been checked already');
    openSheet(`<h2>${scope === 'all' ? 'Covers for the whole list' : 'Covers for my games'}</h2><div id="cprog"></div><div class="actions"><button class="btn" id="cstop" data-act="stop-cover-job">Stop</button></div>`);
    const paint = (done) => {
      const el = $('#cprog'); if (!el) { covq.cancel = true; return; }
      const checked = covq.found + covq.missed + covq.failed, pct = covq.total ? Math.min(100, Math.round((checked / covq.total) * 100)) : 100;
      el.innerHTML = `<div class="bar"><i style="width:${pct}%"></i></div>
        <p style="margin:12px 0 4px"><b>${covq.found}</b> covers saved · ${checked} of ${covq.total} checked</p>
        ${done ? `<p class="muted small">${covq.paused === 'unreachable' ? 'Couldn’t reach Wikipedia, so this stopped. Try again later. ' : covq.paused === 'offline' ? 'You went offline. Run it again when you’re back online. ' : covq.cancel ? 'Stopped. Run it again to continue where it left off. ' : ''}${covq.missed ? `${plural(covq.missed, 'game')} had no clear article and keep the generated cover. ` : ''}${covq.failed ? `${plural(covq.failed, 'lookup/download')} failed${covq.lastError ? ` (last problem: ${esc(covq.lastError)})` : ''}; run it again to retry, or use “Review covers one by one”.` : ''}</p>` : '<p class="muted small">Keep this open. You can stop any time and continue later.</p>'}`;
      if (done) { const b = $('#cstop'); if (b) { b.textContent = 'Done'; b.dataset.act = 'close-sheet'; } }
    };
    covq.onProgress = paint;
    if (!covq.running) { covq.found = covq.missed = covq.failed = 0; covq.total = 0; covq.paused = ''; }
    enqueueCovers(entries, true); paint(!covq.running);
  }

  // ── confirm covers by eye: show the candidate, you say yes/no, only then it is downloaded and pinned to the game ──
  const WIKI_SEARCH = 'https://en.wikipedia.org/w/api.php?format=json&origin=*&action=query&redirects=1&generator=search&gsrlimit=6&prop=pageimages%7Cdescription&piprop=thumbnail&pilicense=any&pithumbsize=500&gsrsearch=';
  async function wikiSearch(title) {
    const j = await (await timedFetch(WIKI_SEARCH + encodeURIComponent(title + ' video game'), 12000)).json();
    const pages = Object.values((j && j.query && j.query.pages) || {}).filter((p) => p && p.thumbnail && okThumb(p.thumbnail.source));
    const rank = (p) => (typeof p.description === 'string' && isGameDesc(p.description) ? 0 : 1);
    return pages.sort((a, b) => rank(a) - rank(b) || (a.index || 0) - (b.index || 0)).map((p) => ({ title: String(p.title || '').slice(0, 120), src: p.thumbnail.source }));
  }
  async function fetchCoverFor(cand) {
    if (!okThumb(cand.src)) throw new Error('blocked source');
    return fileToCover(await fetchThumb(cand.src));
  }
  const wikiUrl = (t) => 'https://en.wikipedia.org/wiki/' + encodeURIComponent(String(t).replace(/ /g, '_'));
  /** Best guesses first (exact-title articles), then plain search results. */
  async function wikiCandidates(item) {
    const out = [], seen = new Set(), push = (c) => { const k = c && String(c.title).toLowerCase(); if (c && !seen.has(k) && !seen.has(c.src)) { seen.add(k); seen.add(c.src); out.push(c); } };
    let failed = false;
    try { (await wikiLookup([{ title: item.title, date: item.date, deep: 2 }], true))[0].forEach(push); } catch (e) { failed = true; }
    if (out.length < 3) { try { (await wikiSearch(item.title)).forEach(push); failed = false; } catch (e) { if (!out.length) failed = true; } }
    const head = item.title.split(/\s*[:–—]\s*|\s+-\s+/)[0];
    if (out.length < 3 && head !== item.title && head.length > 3) { try { (await wikiSearch(head)).forEach(push); failed = false; } catch (e) { /* keep what we have */ } }
    if (!out.length && failed) throw new Error('unreachable');
    return out.slice(0, 6);
  }
  const rv = { items: [], i: 0, saved: 0, cands: new Map() };
  const confirmAfterAdd = () => lsGet(LS_CONFIRM) !== '0';
  const rvItem = (g) => { const c = CATALOG_BY_KEY.get(normKey(g.title)); return { id: g.id, title: g.title, platform: g.platform, date: c ? c.date : '' }; };
  function startReview(items) {
    if (!db) return toast('Covers need device storage, which this browser has blocked', true);
    if (navigator.onLine === false) return toast('Connect to the internet first', true);
    if (!items.length) return toast('Nothing to review');
    rv.items = items; rv.i = 0; rv.saved = 0; rv.cands = new Map();
    openSheet('<div id="rvBox"></div>'); showReview();
  }
  function rvLoad(item) {
    if (!rv.cands.has(item.id)) rv.cands.set(item.id, wikiCandidates(item).then((list) => ({ list, ci: 0 })).catch(() => ({ list: [], ci: 0, err: true })));
    return rv.cands.get(item.id);
  }
  async function showReview() {
    const box = () => $('#rvBox'); if (!box()) return;
    const it = rv.items[rv.i], n = rv.items.length;
    if (!it) { box().innerHTML = `<h2>All done</h2><p class="muted" style="margin:10px 0">${rv.saved ? `${plural(rv.saved, 'cover')} saved to your games.` : 'No covers were saved.'}</p><div class="actions"><button class="btn primary" data-act="close-sheet">Close</button></div>`; if (rv.saved) toast(`Saved ${plural(rv.saved, 'cover')}`); return; }
    box().innerHTML = `<h2>Finding cover…</h2><p class="muted small">${rv.i + 1} of ${n} · ${esc(it.title)}</p><p class="muted" style="margin:24px 0">Searching Wikipedia…</p><div class="actions"><button class="btn" data-act="close-sheet">Stop</button></div>`;
    const st = await rvLoad(it); if (!box() || rv.items[rv.i] !== it) return;
    if (rv.items[rv.i + 1]) rvLoad(rv.items[rv.i + 1]);
    const c = st.list[st.ci], head = `<p class="muted small">${rv.i + 1} of ${n} · <b>${esc(it.title)}</b> · ${esc(it.platform || '')}</p>`;
    const imgSearch = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(it.title + ' video game cover')}`;
    if (!c) {
      box().innerHTML = `<h2>${st.err ? 'Couldn’t reach Wikipedia' : 'No cover found'}</h2>${head}
        <p class="muted small" style="margin:12px 0">${st.err ? 'Check your connection and try again later.' : 'You can search for the picture yourself, save it to your photos, then pick it here.'}</p>
        <div class="actions col"><a class="btn" href="${esc(imgSearch)}" target="_blank" rel="noopener noreferrer">Search images ↗</a><button class="btn" data-act="rv-photo">Pick a photo from my phone</button><button class="btn" data-act="rv-skip">Skip this game</button><button class="btn" data-act="close-sheet">Stop</button></div>
        <input id="rvFile" type="file" accept="image/*" hidden data-rvphoto="1">`;
      return;
    }
    box().innerHTML = `<h2>Is this the cover?</h2>${head}
      <div class="rv-img"><img src="${esc(c.src)}" alt="Candidate cover for ${esc(it.title)}" referrerpolicy="no-referrer"></div>
      <p class="muted small" style="text-align:center">Found: <a href="${esc(wikiUrl(c.title))}" target="_blank" rel="noopener noreferrer">${esc(c.title)} ↗</a></p>
      <div class="actions col"><button class="btn primary" data-act="rv-yes">Yes, use this cover</button>
      <button class="btn" data-act="rv-next" ${st.ci + 1 < st.list.length ? '' : 'disabled'}>Not this one${st.ci + 1 < st.list.length ? ` (${st.list.length - st.ci - 1} more)` : ''}</button>
      <div class="row"><button class="btn" data-act="rv-skip">Skip game</button><a class="btn" href="${esc(imgSearch)}" target="_blank" rel="noopener noreferrer">Search images ↗</a></div>
      <button class="btn" data-act="close-sheet">Stop</button></div>
      <input id="rvFile" type="file" accept="image/*" hidden data-rvphoto="1">`;
  }
  async function rvYes() {
    const it = rv.items[rv.i], st = it && (await rvLoad(it)), c = st && st.list[st.ci]; if (!c) return;
    const b = $('#rvBox'); if (b) b.querySelectorAll('button').forEach((x) => { x.disabled = true; });
    try {
      const url = await fetchCoverFor(c), prev = covers[it.id]; covers[it.id] = url;
      if (!(await saveCovers())) { if (prev) covers[it.id] = prev; else delete covers[it.id]; return showReview(); }
      rv.saved++; const ck = normKey(it.title); cat.set(ck, url); catMiss.delete(ck); try { await ccPutMany([[ck, { u: url, t: Date.now() }]]); } catch (e) { /* still saved on the game */ }
      await mutate((s) => { const g = gameById2(s, it.id); if (g) g.updatedAt = Date.now(); }, null);
      rv.i++; showReview();
    } catch (e) { toast('Couldn’t download that one. Try another.', true); st.list.splice(st.ci, 1); if (st.ci >= st.list.length) st.ci = 0; showReview(); }
  }
  async function rvPhoto(file) {
    const it = rv.items[rv.i]; if (!it) return;
    try { covers[it.id] = await fileToCover(file); await saveCovers(); rv.saved++; await mutate((s) => { const g = gameById2(s, it.id); if (g) g.updatedAt = Date.now(); }, null); rv.i++; showReview(); }
    catch (e) { toast('Could not use that picture. Try a different one.', true); }
  }

  // ───────────────────────── built-in game list (autocomplete) ─────────────────────────
  const normKey = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const CATALOG = (() => {
    const map = new Map();
    String(window.SP_CATALOG_TEXT || '').split('\n').forEach((line) => {
      line = line.trim(); if (!line || line[0] === '#') return;
      const i = line.indexOf('|'); const title = (i < 0 ? line : line.slice(0, i)).trim(); if (!title) return;
      const plats = (i < 0 ? '' : line.slice(i + 1)).split(/[\s,]+/).filter((p) => PLATFORMS.includes(p) && p !== 'Other');
      const key = normKey(title); if (!key) return;
      const cur = map.get(key) || { title, key, plats: [], date: '' };
      plats.forEach((p) => { if (!cur.plats.includes(p)) cur.plats.push(p); });
      const dm = (i < 0 ? '' : line.slice(i + 1)).match(/\b(\d{4}-\d{2}-\d{2}|\d{4}|TBA)\b/i);
      if (dm && !cur.date) cur.date = dm[1].toUpperCase();
      map.set(key, cur);
    });
    return [...map.values()];
  })();
  const CATALOG_BY_KEY = new Map(CATALOG.map((g) => [g.key, g]));
  // genres & studios (games-meta.js): searchable words per game = title tags + developer/publisher + platforms (+ short names people type)
  const STUDIO_NICK = [[/electronic arts|ea sports/i, 'ea'], [/sony interactive/i, 'sony playstation sie'], [/xbox game studios|microsoft/i, 'xbox microsoft'], [/warner bros/i, 'wb warner'], [/take-two/i, 'take two'], [/cd projekt/i, 'cdpr'], [/ubisoft/i, 'ubi'], [/fromsoftware/i, 'fromsoft'], [/bandai namco/i, 'bandai']];
  (() => {
    const map = new Map();
    String(window.SP_META_TEXT || '').split('\n').forEach((line) => {
      line = line.trim(); if (!line || line[0] === '#') return;
      const p = line.split('|').map((x) => x.trim()), key = normKey(p[0] || ''); if (!key) return;
      map.set(key, { tags: (p[1] || '').split(',').map((x) => x.trim()).filter(Boolean), studios: (p[2] || '').split(',').map((x) => x.trim()).filter(Boolean) });
    });
    CATALOG.forEach((g) => {
      const m = map.get(g.key); g.tags = m ? m.tags : []; g.studios = m ? m.studios : [];
      const extra = STUDIO_NICK.filter(([rx]) => g.studios.some((x) => rx.test(x))).map((x) => x[1]).join(' ');
      g.mw = [...new Set(normKey(g.tags.join(' ') + ' ' + g.studios.join(' ') + ' ' + extra + ' ' + g.plats.join(' ')).split(' ').filter(Boolean))];
    });
  })();
  const MAIN_GENRES = ['RPG', 'Action', 'Adventure', 'Shooter', 'Sports', 'Racing', 'Fighting', 'Horror', 'Platformer', 'Strategy', 'Simulation', 'Survival', 'Puzzle', 'Open world'];
  const PICK_GENRES = ['RPG', 'Shooter', 'Sports', 'Racing', 'Fighting', 'Horror', 'Adventure', 'Platformer', 'Strategy', 'Simulation', 'Survival', 'Puzzle', 'Open world', 'Co-op', 'Anime'];
  const GENRE_RX = { RPG: /rpg$/i, Shooter: /shooter$|^fps$/i };
  const hasGenre = (e, name) => e.tags.some((t) => (GENRE_RX[name] ? GENRE_RX[name].test(t) : t === name));
  const SYN = { coop: 'co op', scifi: 'sci fi', openworld: 'open world', battleroyale: 'battle royale', shooting: 'shooter', scary: 'horror', sim: 'simulation', sport: 'sports', souls: 'souls like', soulslike: 'souls like', beatemup: 'beat em up' };
  const wordHit = (key, kw, w) => (w.length >= 3 ? key.includes(w) : key.split(' ').some((x) => x.startsWith(w))) || kw.some((x) => x.startsWith(w));
  /** Does a typed search match this library game's title, genres or studios? (only games from the built-in list have genres/studios) */
  function libMatches(g, q) {
    const ql = q.toLowerCase(); if (g.title.toLowerCase().includes(ql) || g.platform.toLowerCase().includes(ql)) return true;
    const e = catOf(g); if (!e) return false;
    return normKey(expandQuery(q)).split(' ').every((w) => wordHit(e.key, e.mw, w));
  }
  /** Built-in list entry for a library game: exact title first, then short names ("FC 26"), then close titles ("Elden Ring Deluxe Edition"). Used for genres, studios and release dates only. */
  const catMemo = new Map();
  function catOf(g) {
    const k = normKey(g.title); if (!k) return undefined;
    if (catMemo.has(k) && catMemo.get(k) !== null) return catMemo.get(k) || undefined;
    let e = CATALOG_BY_KEY.get(k);
    if (!e) { const k2 = normKey(expandQuery(g.title)); if (k2 !== k) e = CATALOG_BY_KEY.get(k2); }
    if (!e) { const k3 = k.replace(/\b(deluxe|ultimate|standard|premium|digital|gold|goty|game of the year|collector s|anniversary|complete|definitive|launch|day one|special|limited|edition|bundle)\b/g, ' ').replace(/\s+/g, ' ').trim(); if (k3 && k3 !== k) e = CATALOG_BY_KEY.get(k3); }
    if (!e && k.length >= 5) {
      let best = null, bd = 1e9, tie = false;
      for (const c of CATALOG) {
        const a = c.key, b = k; if (!(a.startsWith(b + ' ') || b.startsWith(a + ' '))) continue;
        const sh = Math.min(a.length, b.length), lg = Math.max(a.length, b.length); if (sh < 5 || sh / lg < 0.6) continue;
        const d = lg - sh; if (d < bd) { bd = d; best = c; tie = false; } else if (d === bd) tie = true;
      }
      if (best && !tie) e = best;
    }
    catMemo.set(k, e || undefined); return e;
  }
  /** Release info for a catalog entry: label shown to the user, whether it is still to come, and a sortable number. */
  const dayNum = (str) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5) : 0; };
  /** Days until a YYYY-MM-DD date (0 = today, negative = already out). */
  const daysUntil = (d) => dayNum(d) - dayNum(todayStr());
  const countText = (n) => (n === 0 ? 'out today' : n === 1 ? 'out tomorrow' : n < 0 ? '' : n < 61 ? `out in ${n} days` : n < 365 ? `out in ${Math.round(n / 30.4)} months` : `out in ${(Math.round(n / 36.5) / 10).toString().replace(/\.0$/, '')} years`);
  /** Release info for a catalog entry: label shown to the user, whether it is still to come, a sortable number, and (exact dates only) days left + countdown text. */
  function relInfo(g) {
    const d = g.date, today = todayStr();
    if (!d) return { label: '', upcoming: false, sort: 0 };
    if (d === 'TBA') return { label: 'TBA', upcoming: true, sort: 99999999 };
    if (d.length === 10) { const days = daysUntil(d), up = d > today; return { label: up ? 'Out ' + fmtDate(d) : fmtDate(d), upcoming: up, sort: +d.replace(/-/g, ''), exact: true, days, count: up || days === 0 ? countText(days) : '' }; }
    const up = +d > +today.slice(0, 4);
    return { label: up ? 'Expected ' + d : d, upcoming: up, sort: +d * 10000 + 615 };
  }
  /** Release info for a library game, looked up in the built-in list (null if the game isn't in it or has no date). */
  function libRel(g) { const e = catOf(g); return e && e.date ? relInfo(e) : null; }
  // Short names people actually type → words used in the real titles.
  const ALIASES = { fc: 'ea sports fc', gta: 'grand theft auto', cod: 'call of duty', mw: 'modern warfare', bo: 'black ops', rdr: 'red dead redemption', re: 'resident evil', ff: 'final fantasy', dq: 'dragon quest', gow: 'god of war', tlou: 'the last of us', nfs: 'need for speed', pes: 'pro evolution soccer', mgs: 'metal gear solid', ac: 'assassin s creed', dmc: 'devil may cry', botw: 'breath of the wild', totk: 'tears of the kingdom', sf: 'street fighter', mk: 'mortal kombat', cs: 'counter strike', lol: 'league of legends', fh: 'forza horizon', tw: 'total war', sm: 'super mario', ds: 'dark souls', er: 'elden ring', hzd: 'horizon zero dawn', nba: 'nba', ufc: 'ufc' };
  function expandQuery(q) {
    return normKey(q).split(' ').map((w) => {
      const m = /^([a-z]+?)(\d+)$/.exec(w);
      if (SYN[w]) return SYN[w];
      if (ALIASES[w]) return ALIASES[w];
      if (m && ALIASES[m[1]]) return ALIASES[m[1]] + ' ' + m[2];
      return w;
    }).join(' ');
  }
  function searchCatalog(q, limit = 6, keepExact = false) {
    const k0 = normKey(q); if (k0.length < 2) return [];
    const k = normKey(expandQuery(q));
    const words = k.split(' ');
    const scored = [];
    for (const g of CATALOG) {
      let score;
      if (g.key.startsWith(k)) score = 0;
      else if (g.key.split(' ').some((w) => w.startsWith(words[0])) && words.every((w) => g.key.includes(w))) score = 1;
      else if (words.every((w) => (w.length >= 3 ? g.key.includes(w) : g.key.split(' ').some((x) => x.startsWith(w))))) score = 2;
      else if (words.every((w) => wordHit(g.key, g.mw, w))) score = 3; // matched through genre / studio / platform words
      else continue;
      if (g.key === k && !keepExact) continue; // already typed in full
      const rs = relInfo(g).sort;
      scored.push([score, score >= 3 ? -(rs >= 99999999 ? 0 : rs) : g.key.length, g]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1] - b[1] || (a[2].key < b[2].key ? -1 : 1));
    return scored.slice(0, limit).map((x) => x[2]);
  }
  function showSuggestions(form) {
    const box = $('#sugg'); if (!box) return;
    const hits = searchCatalog(form.elements.title.value);
    box.innerHTML = hits.map((g) => `<button type="button" class="sugg-item" data-act="pick-sugg" data-t="${esc(g.title)}" data-p="${esc(g.plats.join(','))}"><span>${esc(g.title)}</span><small>${esc(g.plats.join(' · '))}</small></button>`).join('');
  }

  // ───────────────────────── UI plumbing ─────────────────────────
  const ui = { libView: (() => { try { return localStorage.getItem('savepoint.libview') === 'grid' ? 'grid' : 'list'; } catch (e) { return 'list'; } })(), libFilters: false, acc: { prog: true, det: false }, libQ: '', libStatus: 'all', libPlat: 'all', libSort: 'recent', updated: false, libStudio: 'all', jQ: '', jType: 'all', jTag: '', gType: 'all', gQ: '', yearSel: 0, libGenre: 'all' };
  let toastTimer = null, shareUrl = null, shareState = null;
  function toast(msg, isErr) {
    const t = $('#toast'); t.textContent = msg; t.className = 'show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = ''; }, isErr ? 6000 : 2800);
  }
  function openSheet(html, cls) {
    closeSheet();
    const bd = document.createElement('div'); bd.className = 'sheet-backdrop'; bd.id = 'sheet';
    bd.innerHTML = `<div class="sheet ${cls || ''}" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
    bd.addEventListener('click', (e) => { if (e.target === bd) closeSheet(); });
    document.body.appendChild(bd); document.body.classList.add('noscroll');
    requestAnimationFrame(() => bd.classList.add('open'));
    return bd;
  }
  function closeSheet() { if (shareUrl) { URL.revokeObjectURL(shareUrl); shareUrl = null; } const s = $('#sheet'); if (s) s.remove(); document.body.classList.remove('noscroll'); }
  function confirmBox({ title, message, okLabel = 'OK', danger = false }) {
    return new Promise((resolve) => {
      const sh = openSheet(`<h2>${esc(title)}</h2><p class="muted" style="margin-top:6px">${esc(message)}</p>
        <div class="actions"><button class="btn" data-x="no">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-x="yes">${esc(okLabel)}</button></div>`);
      sh.addEventListener('click', (e) => { const b = e.target.closest('[data-x]'); if (b) { closeSheet(); resolve(b.dataset.x === 'yes'); } else if (e.target === sh) resolve(false); });
    });
  }

  // ───────────────────────── views ─────────────────────────
  function route() {
    const h = (location.hash || '#/').replace(/^#\/?/, '');
    const [a, b] = h.split('/');
    if (a === 'game' && b) return { name: 'game', id: decodeURIComponent(b), key: 'game/' + b };
    if (a === 'versus') return { name: 'versus', id: b ? decodeURIComponent(b) : '', key: 'versus' + (b ? '/' + b : '') };
    if (a === 'year') return { name: 'year', year: /^\d{4}$/.test(b || '') ? +b : 0, key: 'year' };
    if (['library', 'journal', 'backup', 'stats'].includes(a)) return { name: a, key: a };
    return { name: 'home', key: 'home' };
  }

  function gameCard(g) {
    const n = notesOf(g.id).length;
    return `<a class="card game withcover" href="#/game/${encodeURIComponent(g.id)}"><div class="gc-cover" data-ck="${esc(normKey(g.title))}">${coverHTML(g, 'thumb')}</div><div class="gc-body">
      <div class="g-top"><h3>${g.fav ? '<span class="heart" aria-label="Favorite">♥</span> ' : ''}${esc(g.title)}</h3><span class="pill st-${g.status}">${esc(statusLabel(g.status))}</span></div>
      <div class="g-meta"><span class="plat">${esc(g.platform)}</span><span>${plural(n, 'note')}</span>${g.played ? `<span>${fmtHours(g.played)}</span>` : ''}${g.sessionAt ? '<span class="live-badge">● Playing</span>' : ''}${g.rating ? `<span class="rate-badge">★ ${g.rating}/10</span>` : ''}${g.queue ? '<span class="queue-badge">Up next</span>' : ''}${soonBadge(g)}</div>
      ${g.status === 'want' && !g.progress ? '' : `<div class="bar"><i style="width:${g.progress}%"></i></div><div class="pct">${g.progress}%</div>`}</div></a>`;
  }
  function soonBadge(g) {
    if (g.status !== 'want') return '';
    const r = libRel(g); if (!r || !r.upcoming) return '';
    return `<span class="soon-badge">${esc(r.count ? r.count[0].toUpperCase() + r.count.slice(1) : r.label)}</span>`;
  }
  /** Home card: Want to play / Up next games with a release date coming up (or just out). */
  function soonList() {
    return state.games.filter((g) => g.status === 'want').map((g) => ({ g, r: libRel(g) })).filter((x) => x.r && x.r.exact && x.r.days <= 90 && x.r.days >= -7)
      .sort((a, b) => a.r.days - b.r.days || a.g.title.localeCompare(b.g.title));
  }
  function soonCard() {
    const list = soonList(); if (!list.length) return '';
    const row = ({ g, r }) => `<a class="soon-row" href="#/game/${encodeURIComponent(g.id)}"><div class="gc-cover xs" data-ck="${esc(normKey(g.title))}">${coverHTML(g, 'thumb')}</div><span class="sr-main"><b>${esc(g.title)}</b><small>${esc(g.platform)} · ${esc(fmtDate(catOf(g).date))}</small></span><span class="sr-when ${r.days <= 7 ? 'hot' : ''}">${r.days < 0 ? 'Out now' : esc(r.count[0].toUpperCase() + r.count.slice(1))}</span></a>`;
    return `<div class="section-title">Releasing soon</div><div class="card soon-card">${list.slice(0, 5).map(row).join('')}${list.length > 5 ? `<a class="muted small" href="#/library" data-act="open-soon" style="display:block;margin-top:8px">See all ${list.length}</a>` : ''}</div>`;
  }
  function queueCard(g) {
    return `<div class="card qcard"><div class="gc-cover sm" data-ck="${esc(normKey(g.title))}">${coverHTML(g, 'thumb')}</div><a href="#/game/${encodeURIComponent(g.id)}"><h3>${esc(g.title)}</h3><div class="g-meta" style="margin:4px 0 0"><span class="plat">${esc(g.platform)}</span></div></a><button class="btn sm primary" data-act="start-game" data-id="${esc(g.id)}">${icon('next')}Start</button></div>`;
  }
  function noteCard(n, { showGame = false, actions = false } = {}) {
    const g = gameById(n.gameId);
    return `<div class="card note t-${n.type}">
      ${showGame && g ? `<a class="n-game" href="#/game/${encodeURIComponent(g.id)}">${esc(g.title)} · ${esc(g.platform)}</a>` : ''}
      <div class="n-head"><span class="badge t-${n.type}">${esc(typeLabel(n.type))}</span><span class="n-date">${esc(fmtDate(n.date))}</span></div>
      ${n.title ? `<h4>${esc(n.title)}</h4>` : ''}
      ${(n.tags || []).length ? `<div class="n-tags">${n.tags.map((t) => `<button type="button" class="ntag" data-act="tag-filter" data-t="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}
      ${n.body ? `<div class="n-body">${esc(n.body)}</div>` : ''}
      ${actions ? `<div class="n-actions">
        <button class="btn sm" data-act="edit-note" data-id="${esc(n.id)}">${icon('edit')}Edit</button>
        ${n.type === 'code' ? `<button class="btn sm" data-act="copy-note" data-id="${esc(n.id)}">${icon('copy')}Copy</button>` : ''}
        <button class="btn sm danger" data-act="del-note" data-id="${esc(n.id)}">${icon('trash')}Delete</button></div>` : ''}
    </div>`;
  }
  const emptyState = (ic, h, p, btn) => `<div class="empty">${icon(ic)}<h3>${esc(h)}</h3><p>${esc(p)}</p>${btn || ''}</div>`;

  // ── "What should I play?": weighted random pick, from your backlog or from the built-in list (something new) ──
  /** Weight of a backlog game: Up next counts most, then favorites, then paused games you already started. */
  const pickWeight = (g) => 1 + (g.queue ? 3 : 0) + (g.fav ? 1.5 : 0) + (g.status === 'paused' ? 1 : 0);
  /** Pure picker: weighted random choice from pool, skipping ids in `seen` until every item has been shown. rnd() is injectable for tests.
   *  opts.id / opts.weight let it work on library games (id, pickWeight) or built-in list entries (key, equal weight). */
  function pickRandom(pool, rndFn, seen, opts) {
    const idOf = (opts && opts.id) || ((g) => g.id), wOf = (opts && opts.weight) || pickWeight; seen = seen || [];
    if (!pool.length) return null;
    let cand = pool.filter((g) => !seen.includes(idOf(g)));
    if (!cand.length) cand = pool.length > 1 ? pool.filter((g) => idOf(g) !== seen[seen.length - 1]) : pool;
    const total = cand.reduce((a, g) => a + wOf(g), 0); let r = (rndFn || Math.random)() * total;
    for (const g of cand) { r -= wOf(g); if (r < 0) return g; }
    return cand[cand.length - 1];
  }
  const RND_GENRES = [...MAIN_GENRES, 'Souls-like', 'Roguelike', 'Metroidvania', 'Stealth', 'Co-op', 'Party', 'Anime', 'Fantasy', 'Sci-fi', 'Superhero', 'Football', 'Basketball', 'Fitness'];
  const rnd = { mode: 'mine', plat: 'all', genre: 'all', paused: true, upcoming: false, seen: [], cur: null };
  const entryHasGenre = (e, n) => n === 'all' || hasGenre(e, n);
  function rndPool() {
    if (rnd.mode === 'new') {
      const lib = new Set(state.games.map((g) => normKey(g.title)));
      return CATALOG.filter((e) => !lib.has(e.key) && (rnd.upcoming || !relInfo(e).upcoming) && (rnd.plat === 'all' || e.plats.includes(rnd.plat)) && entryHasGenre(e, rnd.genre));
    }
    return state.games.filter((g) => (g.status === 'want' || (rnd.paused && g.status === 'paused')) && !g.sessionAt
      && (rnd.plat === 'all' || g.platform === rnd.plat)
      && (rnd.genre === 'all' || (() => { const e = catOf(g); return e && hasGenre(e, rnd.genre); })()));
  }
  const rndOpts = () => (rnd.mode === 'new' ? { id: (e) => e.key, weight: () => 1 } : null);
  function openRandom() {
    if (!state.games.length) return toast('Add some games first');
    rnd.mode = state.games.some((g) => g.status === 'want' || g.status === 'paused') ? 'mine' : 'new'; rnd.seen = []; rnd.cur = null; showRandom(true);
  }
  function showRandom(reroll) {
    const isNew = rnd.mode === 'new';
    if (reroll) { const g = pickRandom(rndPool(), Math.random, rnd.seen, rndOpts()); rnd.cur = g ? (isNew ? g.key : g.id) : null; if (g) rnd.seen.push(rnd.cur); }
    const backlog = state.games.filter((g) => g.status === 'want' || g.status === 'paused'), poolN = rndPool().length;
    const plats = isNew ? PLATFORMS.filter((p) => p !== 'Other') : [...new Set(backlog.map((x) => x.platform))].sort();
    const gc = {}; if (isNew) RND_GENRES.forEach((n) => { gc[n] = 1; }); else backlog.forEach((x) => { const e = CATALOG_BY_KEY.get(normKey(x.title)); if (e) RND_GENRES.forEach((n) => { if (hasGenre(e, n)) gc[n] = 1; }); });
    const genres = RND_GENRES.filter((n) => gc[n]);
    const tabs = `<div class="chips" style="margin:10px 0 0"><button type="button" class="chip ${isNew ? '' : 'on'}" data-act="rnd-mode" data-v="mine">From my list</button><button type="button" class="chip ${isNew ? 'on' : ''}" data-act="rnd-mode" data-v="new">Something new</button></div>`;
    const filters = `<p class="muted small" style="margin:12px 0 -4px">Pick a platform and/or genre, then it chooses for you:</p><div class="filters" style="margin-top:12px"><select data-rnd="plat" aria-label="Platform"><option value="all">Any platform</option>${plats.map((p) => `<option ${rnd.plat === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
      <select data-rnd="genre" aria-label="Genre"><option value="all">Any genre</option>${genres.map((n) => `<option ${rnd.genre === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
      <label class="check" style="margin-top:6px"><input type="checkbox" data-rnd="${isNew ? 'upcoming' : 'paused'}" ${(isNew ? rnd.upcoming : rnd.paused) ? 'checked' : ''}><span>${isNew ? 'Include upcoming games' : 'Include games I paused'}</span></label>`;
    let body;
    if (!isNew) {
      const g = rnd.cur && gameById(rnd.cur), e = g && catOf(g), info = g ? [g.platform, e && e.tags.slice(0, 3).join(', '), e && e.studios[0]].filter(Boolean).join(' · ') : '';
      body = g ? `<div class="rnd"><div class="hero-cv rnd-cv" data-ck="${esc(normKey(g.title))}">${coverHTML(g, 'full')}</div>
        <h3 class="rnd-t">${esc(g.title)}</h3><p class="muted small">${esc(info)}</p>
        <p class="muted small">${g.queue ? 'In your Up next list' : g.status === 'paused' ? 'Paused – you already started it' : 'In your Want to play list'}${poolN > 1 ? ` · 1 of ${poolN} possible` : ''}</p></div>
        <div class="actions col"><button class="btn primary" data-act="rnd-start" data-id="${esc(g.id)}">Play this next</button>
        <div class="row"><button class="btn" data-act="rnd-again">${icon('next')}Pick another</button><button class="btn" data-act="rnd-open" data-id="${esc(g.id)}">Open game</button></div></div>`
        : `<p class="muted" style="margin:14px 0">${backlog.length ? 'Nothing matches those filters.' : 'Nothing on your list to pick from yet. Try “Something new”, or add games as “Want to play” or “Up next”.'}</p>`;
    } else {
      const e = rnd.cur && CATALOG_BY_KEY.get(rnd.cur);
      if (e) enqueueCovers([entryOf(e.title, e.date)]);
      const r = e && relInfo(e), info = e ? [e.plats.join(' · '), r.label, r.upcoming && r.count, e.tags.slice(0, 3).join(', '), e.studios[0]].filter(Boolean).join(' · ') : '';
      body = e ? `<div class="rnd"><div class="hero-cv rnd-cv" data-ck="${esc(e.key)}">${coverHTML({ id: '__rnd', title: e.title, platform: e.plats[0] || 'Other' }, 'full')}</div>
        <h3 class="rnd-t">${esc(e.title)}</h3><p class="muted small">${esc(info)}</p>
        <p class="muted small">Not in your library yet${poolN > 1 ? ` · 1 of ${poolN} possible` : ''}</p></div>
        <div class="actions col"><button class="btn primary" data-act="rnd-add" data-k="${esc(e.key)}" data-as="playing">Start playing it</button>
        <div class="row"><button class="btn" data-act="rnd-add" data-k="${esc(e.key)}" data-as="want">Want to play</button><button class="btn" data-act="rnd-add" data-k="${esc(e.key)}" data-as="queue">Up next</button></div>
        <button class="btn" data-act="rnd-again">${icon('next')}Pick another</button></div>`
        : '<p class="muted" style="margin:14px 0">Nothing new matches those filters.</p>';
    }
    openSheet(`<h2>What should I play?</h2>${tabs}${filters}${body}<div class="actions"><button class="btn" data-act="close-sheet">Close</button></div>`);
  }
  function rndAdd(key, as) {
    const e = CATALOG_BY_KEY.get(key); if (!e) return;
    if (state.games.some((g) => normKey(g.title) === key)) return toast('That game is already in your library');
    const plat = rnd.plat !== 'all' && e.plats.includes(rnd.plat) ? rnd.plat : multi.pref && e.plats.includes(multi.pref) ? multi.pref : e.plats[0] || 'Other';
    const g = newGame({ title: e.title, platform: plat, status: as === 'playing' ? 'playing' : 'want' }); if (as === 'queue') g.queue = Date.now();
    closeSheet(); mutate((s) => { s.games.push(g); }, as === 'playing' ? 'Added and started – have fun!' : as === 'queue' ? 'Added to Up next' : 'Added to Want to play');
    enqueueCovers(libraryCoverEntries());
    if (as === 'playing') location.hash = '#/game/' + encodeURIComponent(g.id);
  }

  // ───────────────────────── versus sessions (UI) ─────────────────────────
  const fmtClock = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60; return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`; };
  const matchById = (id) => state.matches.find((m) => m.id === id);
  const dayOf = (ts) => fmtDate(dateStr(new Date(ts)));
  function matchStats(m) {
    const wins = {}, pts = {}; m.players.forEach((p) => { wins[p] = 0; pts[p] = 0; });
    let draws = 0, tw = 0, tl = 0;
    m.rounds.forEach((r) => { if (r.winner) wins[r.winner]++; else if (r.draw) draws++; if (r.res === 'win') tw++; if (r.res === 'loss') tl++; Object.entries(r.scores).forEach(([p, v]) => { pts[p] = (pts[p] || 0) + v; }); });
    const max = Math.max(0, ...Object.values(wins));
    return { wins, pts, draws, tw, tl, rounds: m.rounds.length, leaders: max > 0 ? m.players.filter((p) => wins[p] === max) : [], hasPts: m.rounds.some((r) => Object.keys(r.scores).length > 0) };
  }
  function matchLine(m) {
    const s = matchStats(m);
    if (!m.rounds.length) return 'No results yet';
    if (m.mode === 'coop') return `${s.tw} won · ${s.tl} lost`;
    if (m.players.length === 2) return `${m.players[0]} ${s.wins[m.players[0]]}–${s.wins[m.players[1]]} ${m.players[1]}${s.draws ? ` · ${plural(s.draws, 'draw')}` : ''}`;
    return s.leaders.length === 1 ? `${s.leaders[0]} leads · ${plural(s.wins[s.leaders[0]], 'win')}` : s.leaders.length ? 'Tied at the top' : plural(s.rounds, 'game');
  }
  /** Saved player names, most recently used first. */
  const rosterNames = () => state.roster.slice();
  /** Head-to-head record for every pair of players, across all versus sessions. */
  function pairsList() {
    const map = new Map();
    state.matches.forEach((m) => {
      if (m.mode === 'coop' || m.teams.length) return;
      for (let i = 0; i < m.players.length; i++) for (let j = i + 1; j < m.players.length; j++) {
        const a = m.players[i], b = m.players[j], ka = a.toLowerCase(), kb = b.toLowerCase(), key = ka < kb ? ka + '|' + kb : kb + '|' + ka;
        if (!map.has(key)) map.set(key, { a: ka < kb ? a : b, b: ka < kb ? b : a, aw: 0, bw: 0, draws: 0, last: 0 });
        const r = map.get(key), A = r.a.toLowerCase() === ka ? a : b;
        m.rounds.forEach((x) => { if (x.draw) { r.draws++; r.last = Math.max(r.last, x.at); } else if (x.winner === a || x.winner === b) { if (x.winner.toLowerCase() === r.a.toLowerCase()) r.aw++; else r.bw++; r.last = Math.max(r.last, x.at); } });
      }
    });
    return [...map.values()].filter((r) => r.aw + r.bw + r.draws > 0).sort((x, y) => (y.aw + y.bw + y.draws) - (x.aw + x.bw + x.draws) || y.last - x.last);
  }
  /** Everything we know about one player across all versus sessions. */
  function playerStats(name) {
    const k = name.toLowerCase(), isP = (n) => n.toLowerCase() === k, ev = [], games = new Map(), opps = new Map();
    let cw = 0, cl = 0, sessions = 0;
    state.matches.forEach((m) => {
      const side = m.teams.findIndex((t) => t.some(isP));
      if (m.teams.length ? side < 0 : !m.players.some(isP)) return; sessions++;
      if (m.teams.length) { m.rounds.forEach((r) => { const out = r.draw ? 'd' : r.winner === m.players[side] ? 'w' : 'l'; ev.push({ at: r.at, out }); const g = games.get(m.title + ' (2v2)') || { title: m.title + ' (2v2)', w: 0, l: 0, d: 0 }; g[out]++; games.set(m.title + ' (2v2)', g); }); return; }
      m.rounds.forEach((r) => {
        if (m.mode === 'coop') { if (r.res === 'win') cw++; else if (r.res === 'loss') cl++; return; }
        const out = r.draw ? 'd' : r.winner && isP(r.winner) ? 'w' : 'l';
        ev.push({ at: r.at, out });
        const g = games.get(m.title) || { title: m.title, w: 0, l: 0, d: 0 }; g[out]++; games.set(m.title, g);
        m.players.filter((n) => !isP(n)).forEach((o) => {
          const x = opps.get(o.toLowerCase()) || { name: o, w: 0, l: 0, d: 0 };
          if (r.draw) x.d++; else if (isP(r.winner)) x.w++; else if (r.winner && r.winner.toLowerCase() === o.toLowerCase()) x.l++;
          opps.set(o.toLowerCase(), x);
        });
      });
    });
    ev.sort((a, b) => a.at - b.at);
    let best = 0, run = 0; ev.forEach((e) => { run = e.out === 'w' ? run + 1 : 0; best = Math.max(best, run); });
    let cur = 0; const curKind = ev.length ? ev[ev.length - 1].out : ''; if (curKind === 'w' || curKind === 'l') for (let i = ev.length - 1; i >= 0 && ev[i].out === curKind; i--) cur++;
    const w = ev.filter((e) => e.out === 'w').length, l = ev.filter((e) => e.out === 'l').length, d = ev.length - w - l;
    return { name, w, l, d, n: ev.length, pct: ev.length ? Math.round((w / ev.length) * 100) : 0, best, cur, curKind, sessions, cw, cl, games: [...games.values()].sort((a, b) => b.w + b.l + b.d - (a.w + a.l + a.d)), opps: [...opps.values()].filter((o) => o.w + o.l + o.d).sort((a, b) => b.w + b.l + b.d - (a.w + a.l + a.d)) };
  }
  /** Leaderboard: everyone with at least one versus game, best win rate first. */
  function leaderboard() {
    const names = new Map(); state.matches.forEach((m) => (m.teams.length ? m.teams.flat() : m.players).forEach((n) => { if (!names.has(n.toLowerCase())) names.set(n.toLowerCase(), n); }));
    return [...names.values()].map(playerStats).filter((p) => p.n > 0).sort((a, b) => b.pct - a.pct || b.w - a.w || b.n - a.n);
  }
  const streakTxt = (p) => (p.cur >= 2 ? `${p.cur} ${p.curKind === 'w' ? 'win' : 'loss'} streak${p.curKind === 'w' ? ' 🔥' : ''}` : '');
  function playerSheet(name) {
    const p = playerStats(name), rec = (x) => `${x.w}–${x.l}${x.d ? `–${x.d}` : ''}`;
    openSheet(`<h2>${esc(p.name)}</h2><p class="muted small">${plural(p.sessions, 'session')}${p.cw + p.cl ? ` · Co-op ${p.cw}W ${p.cl}L` : ''}</p>
      <div class="vs-team" style="margin:12px 0"><div><b>${p.w}–${p.l}${p.d ? '–' + p.d : ''}</b><span>W–L${p.d ? '–D' : ''}</span></div><div><b>${p.n ? p.pct + '%' : '–'}</b><span>Win rate</span></div><div><b>${p.best}</b><span>Best streak</span></div></div>
      ${streakTxt(p) ? `<p class="small" style="text-align:center">${streakTxt(p)} right now</p>` : ''}
      ${p.opps.length ? `<label class="f">VS EACH PLAYER</label>${p.opps.map((o) => `<div class="rv"><b>${esc(o.name)}</b><span class="rv-rec"><span class="${o.w > o.l ? 'good' : o.w < o.l ? 'bad' : ''}">${rec(o)}</span></span></div>`).join('')}` : ''}
      ${p.games.length ? `<label class="f">BY GAME</label>${p.games.map((g) => `<div class="rv"><b>${esc(g.title)}</b><span class="rv-rec"><span class="${g.w > g.l ? 'good' : g.w < g.l ? 'bad' : ''}">${rec(g)}</span></span></div>`).join('')}` : ''}
      <div class="actions"><button type="button" class="btn primary" data-act="close-sheet">Done</button></div>`);
  }
  function matchRow(m) {
    const live = !m.endedAt;
    return `<a class="card vs-row" href="#/versus/${encodeURIComponent(m.id)}"><div class="vs-main"><b>${esc(m.title)}</b><small>${live ? `<span class="live-badge">● Live</span> <span data-since="${m.startedAt}">${fmtClock(Date.now() - m.startedAt)}</span>` : esc(dayOf(m.startedAt))} · ${esc(m.players.join(' vs '))}</small></div><div class="vs-res"><span class="pill ${m.mode === 'coop' ? 'st-finished' : 'st-playing'}">${m.mode === 'coop' ? 'Co-op' : 'Versus'}</span><span>${esc(matchLine(m))}</span></div></a>`;
  }
  function viewVersus() {
    const live = state.matches.filter((m) => !m.endedAt).sort((a, b) => b.startedAt - a.startedAt), done = state.matches.filter((m) => m.endedAt).sort((a, b) => b.startedAt - a.startedAt), pr = pairsList(), lb = leaderboard();
    const pair = (r) => `<div class="rv"><b>${esc(r.a)} <span class="muted">vs</span> ${esc(r.b)}</b><span class="rv-rec"><span class="${r.aw > r.bw ? 'good' : ''}">${r.aw}</span>–<span class="${r.bw > r.aw ? 'good' : ''}">${r.bw}</span>${r.draws ? `<br><span class="muted">${plural(r.draws, 'draw')}</span>` : ''}</span></div>`;
    const ros = rosterNames();
    return { title: '⚔️ Play with friends', back: '#/', fab: null, html: `
      <button class="btn primary block" data-act="versus-start" style="min-height:54px;font-size:17px">＋ Start a session</button>
      <p class="muted small" style="margin:10px 4px 0">Pick a game, tap the people playing, then tap a name each time they win. Names and records stay on this phone.</p>
      ${live.length ? `<div class="section-title">In progress</div>${live.map(matchRow).join('')}` : ''}
      ${lb.length ? `<div class="section-title">Leaderboard</div><div class="card rivals">${lb.slice(0, 12).map((p, i) => `<button type="button" class="rv lb" data-act="vs-player" data-n="${esc(p.name)}"><b>${i === 0 && lb.length > 1 ? '🏆 ' : ''}${esc(p.name)}</b><span class="rv-rec">${p.pct}% · ${p.w}–${p.l}${p.d ? '–' + p.d : ''}${streakTxt(p) ? `<br><span class="muted">${streakTxt(p)}</span>` : ''}</span></button>`).join('')}<p class="muted small" style="margin-top:8px">Tap a name for their full record.</p></div>` : ''}
      ${pr.length ? `<div class="section-title">Head to head</div><div class="card rivals">${pr.slice(0, 20).map(pair).join('')}</div>` : ''}
      ${ros.length ? `<div class="section-title">Saved players</div><div class="card"><div class="mchips">${ros.map((n) => `<button type="button" class="mchip studio" data-act="vs-forget" data-n="${esc(n)}" aria-label="Remove ${esc(n)} from saved players">${esc(n)} ✕</button>`).join('')}</div><p class="muted small" style="margin-top:8px">Removing a name only takes it off the quick-pick list. Past results are kept.</p></div>` : ''}
      <div class="section-title">History</div>
      ${done.length ? done.map(matchRow).join('') : `<div class="card muted">${live.length ? 'Finished sessions show up here.' : 'No sessions yet. Start one to track who wins.'}</div>`}` };
  }
  function viewMatch(id) {
    const m = matchById(id);
    if (!m) return { title: 'Not found', back: '#/versus', fab: null, html: emptyState('library', 'Session not found', 'It may have been deleted.', '<a class="btn primary" href="#/versus">Back</a>') };
    const s = matchStats(m), coop = m.mode === 'coop', live = !m.endedAt, mx = Math.max(1, ...Object.values(s.wins));
    const tap = coop
      ? `<div class="vs-tap two"><button class="vs-tile good" data-act="vs-res" data-id="${esc(m.id)}" data-v="win"><span>We won 🎉</span><b>${s.tw}</b></button><button class="vs-tile bad" data-act="vs-res" data-id="${esc(m.id)}" data-v="loss"><span>We lost</span><b>${s.tl}</b></button></div>`
      : `<div class="vs-tap ${m.players.length === 2 ? 'two' : ''}">${m.players.map((p, i) => `<button class="vs-tile ${s.leaders.length === 1 && s.leaders[0] === p ? 'lead' : ''}" data-act="vs-win" data-id="${esc(m.id)}" data-i="${i}" aria-label="${esc(p)} won a game"><span>${s.leaders.length === 1 && s.leaders[0] === p ? '👑 ' : ''}${esc(p)}</span><b>${s.wins[p]}</b><em>tap = win</em></button>`).join('')}</div><button class="btn block" data-act="vs-draw" data-id="${esc(m.id)}" style="margin-top:8px">＝ Draw</button>`;
    const board = coop ? `<p class="muted small" style="margin:8px 4px">Team: ${esc(m.players.join(', '))}${s.tw + s.tl ? ` · ${Math.round((s.tw / (s.tw + s.tl)) * 100)}% win rate` : ''}</p>` : (s.hasPts || s.draws ? `<p class="muted small" style="margin:8px 4px">${[s.draws ? plural(s.draws, 'draw') : '', s.hasPts ? m.players.map((p) => `${esc(p)} ${Math.round(s.pts[p] * 100) / 100} pts`).join(' · ') : ''].filter(Boolean).join(' · ')}</p>` : '');
    const rounds = m.rounds.map((r, i) => ({ r, n: i + 1 })).reverse().map(({ r, n }) => {
      const sc = m.players.filter((p) => r.scores[p] !== undefined).map((p) => `${esc(p)} ${r.scores[p]}`).join(' · ');
      const out = coop ? (r.res === 'win' ? 'Won 🎉' : 'Lost') : r.draw ? 'Draw' : `${esc(r.winner)} won`;
      return `<div class="card vs-round"><div class="vs-rh"><b>Game ${n}</b><span class="${r.res === 'loss' ? 'bad' : r.draw ? 'muted' : 'good'}">${out}</span></div>${sc ? `<div class="muted small">${sc}</div>` : ''}${r.note ? `<div class="small">${esc(r.note)}</div>` : ''}<div class="vs-ra"><button class="btn sm" data-act="vs-edit-round" data-id="${esc(m.id)}" data-r="${esc(r.id)}">${icon('edit')}Edit</button><button class="btn sm danger" data-act="vs-del-round" data-id="${esc(m.id)}" data-r="${esc(r.id)}">${icon('trash')}Delete</button></div></div>`;
    }).join('');
    return { title: esc(m.title), back: '#/versus', fab: null, html: `
      <div class="vs-head"><span class="pill ${coop ? 'st-finished' : 'st-playing'}">${coop ? 'Co-op' : 'Versus'}</span>${live ? `<span class="live-badge">● Live</span><span class="vs-clock" data-since="${m.startedAt}">${fmtClock(Date.now() - m.startedAt)}</span>` : `<span class="muted small">${esc(dayOf(m.startedAt))} · ${esc(fmtClock(m.endedAt - m.startedAt))}</span>`}${m.platform ? `<span class="plat">${esc(m.platform)}</span>` : ''}</div>
      ${tap}
      ${board}
      <div class="row" style="margin-top:10px"><button class="btn" data-act="vs-undo" data-id="${esc(m.id)}" ${m.rounds.length ? '' : 'disabled'}>↩ Undo last</button><button class="btn" data-act="vs-add-round" data-id="${esc(m.id)}">＋ With scores</button><button class="btn" data-act="vs-share" data-id="${esc(m.id)}">📤 Share</button></div>
      <div class="row" style="margin-top:10px">${live ? `<button class="btn" data-act="vs-end" data-id="${esc(m.id)}">■ End session</button>` : `<button class="btn" data-act="vs-resume" data-id="${esc(m.id)}">▶ Resume</button>`}${m.players.length < 8 && !m.teams.length ? `<button class="btn" data-act="vs-add-player" data-id="${esc(m.id)}">＋ Player</button>` : ''}<button class="btn danger" data-act="vs-del" data-id="${esc(m.id)}">${icon('trash')}</button></div>
      <div class="section-title">Games <span class="muted" style="text-transform:none;letter-spacing:0">${m.rounds.length || ''}</span></div>
      ${rounds || '<div class="card muted">Nothing yet. Tap a name when they win a game.</div>'}` };
  }
  /** Draw the scoreboard to a picture and share (or save) it. */
  async function shareMatch(id) {
    const m = matchById(id); if (!m) return;
    const s = matchStats(m), W = 1080, H = 1080, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
    const gr = x.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#0b1730'); gr.addColorStop(1, '#0a3a52'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
    x.textAlign = 'center'; x.fillStyle = '#22d3ee'; x.font = '700 40px system-ui, sans-serif'; x.fillText('SAVE POINT', W / 2, 110);
    x.fillStyle = '#fff'; x.font = '800 64px system-ui, sans-serif'; let t = m.title; while (x.measureText(t).width > W - 120 && t.length > 4) t = t.slice(0, -2); x.fillText(t === m.title ? t : t + '…', W / 2, 220);
    x.fillStyle = '#9fb3c8'; x.font = '500 34px system-ui, sans-serif'; x.fillText(`${m.mode === 'coop' ? 'Co-op' : m.teams.length ? '2v2' : 'Versus'} · ${dayOf(m.startedAt)}`, W / 2, 275);
    const cols = m.mode === 'coop' ? [['We won', s.tw], ['We lost', s.tl]] : m.players.map((p) => [p, s.wins[p]]);
    const n = cols.length, cell = Math.min(420, (W - 120) / Math.min(n, 2)), rows = Math.ceil(n / 2);
    cols.forEach(([label, val], i) => {
      const r = Math.floor(i / 2), per = Math.min(2, n - r * 2), cx = W / 2 + ((i % 2) - (per - 1) / 2) * (cell + 20), cy = 380 + r * 300 + (rows === 1 ? 120 : 0);
      x.fillStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.roundRect(cx - cell / 2, cy, cell, 260, 36); x.fill();
      const lead = m.mode !== 'coop' && s.leaders.length === 1 && s.leaders[0] === label; if (lead) { x.strokeStyle = '#22d3ee'; x.lineWidth = 4; x.stroke(); }
      x.fillStyle = '#fff'; x.font = '800 120px system-ui, sans-serif'; x.fillText(String(val), cx, cy + 150);
      x.font = '700 36px system-ui, sans-serif'; x.fillStyle = lead ? '#22d3ee' : '#cbd5e1'; let l = (lead ? '👑 ' : '') + label; while (x.measureText(l).width > cell - 30 && l.length > 3) l = l.slice(0, -2); x.fillText(l, cx, cy + 215);
    });
    x.fillStyle = '#9fb3c8'; x.font = '500 32px system-ui, sans-serif'; x.fillText(`${plural(m.rounds.length, 'game')}${s.draws ? ` · ${plural(s.draws, 'draw')}` : ''}`, W / 2, H - 70);
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png')); if (!blob) return toast('Couldn’t make the picture', true);
    const file = new File([blob], 'save-point-score.png', { type: 'image/png' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: m.title }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'save-point-score.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Score picture saved');
  }
  /** Quick one-tap result. */
  function quickRound(id, base, msg) {
    const m = matchById(id); if (!m || m.rounds.length >= MAX_ROUNDS) return toast('That session is full');
    const r = cleanRound({ id: uid(), at: Date.now(), scores: {}, ...base }, m.players); if (!r) return;
    mutate((st) => { const x = st.matches.find((q) => q.id === id); if (x && x.rounds.length < MAX_ROUNDS) x.rounds.push(r); }, typeof msg === 'function' ? msg(m, r) : msg);
  }
  function startVersus(gameId) {
    const games = state.games.slice().sort((a, b) => (b.status === 'playing') - (a.status === 'playing') || b.updatedAt - a.updatedAt);
    const sel = { game: gameId && gameById(gameId) ? gameId : (games[0] ? games[0].id : ''), mode: 'versus', players: [], extra: [] };
    const lastM = state.matches.slice().sort((a, b) => b.startedAt - a.startedAt)[0], last = lastM && lastM.players.length >= 2 ? lastM.players : null;
    const sh = openSheet(`<h2>Start a session</h2>
      <label class="f" for="vsGame">GAME</label>
      <select id="vsGame">${games.map((g) => `<option value="${esc(g.id)}" ${g.id === sel.game ? 'selected' : ''}>${esc(g.title)} · ${esc(g.platform)}</option>`).join('')}<option value="" ${sel.game ? '' : 'selected'}>Something else…</option></select>
      <input id="vsOther" type="text" maxlength="200" placeholder="Game name (e.g. Call of Duty)" style="margin-top:8px" ${sel.game ? 'hidden' : ''}>
      <label class="f">TYPE</label>
      <div class="seg three" role="group" aria-label="Session type"><button type="button" data-vs="mode" data-v="versus" class="on">⚔️ Versus</button><button type="button" data-vs="mode" data-v="coop">🤝 Co-op</button><button type="button" data-vs="mode" data-v="teams">👥 2v2</button></div>
      <p class="muted small" id="vsTeamHint" hidden style="margin:6px 2px 0">Tap 4 names. The first two are Team A, the next two are Team B.</p>
      <label class="f" for="vsName">WHO’S PLAYING? <span class="muted" style="text-transform:none;letter-spacing:0">(2 or more)</span></label>
      ${last ? `<div class="mchips" style="margin-bottom:8px"><button type="button" class="mchip" data-vs="last">↻ Same as last time: ${esc(last.join(' vs '))}</button></div>` : ''}
      <div class="mchips" id="vsSugg"></div>
      <div class="vs-add" style="margin-top:8px"><input id="vsName" type="text" maxlength="24" placeholder="Type a new name" autocomplete="off"><button type="button" class="btn" data-vs="add">Add</button></div>
      <div class="actions"><button type="button" class="btn" data-act="close-sheet">Cancel</button><button type="button" class="btn primary" data-vs="go" id="vsGo" disabled>Start</button></div>`);
    const $s = (q) => $(q, sh), saved = rosterNames();
    const has = (n) => sel.players.some((p) => p.toLowerCase() === n.toLowerCase());
    const paint = () => {
      const all = [...saved, ...sel.extra.filter((n) => !saved.some((x) => x.toLowerCase() === n.toLowerCase()))];
      $s('#vsSugg').innerHTML = all.length ? all.map((n) => `<button type="button" class="mchip ${has(n) ? 'studio on' : ''}" data-vs="tog" data-n="${esc(n)}" aria-pressed="${has(n)}">${has(n) ? '✓ ' : ''}${esc(n)}</button>`).join('') : '<span class="muted small">No saved names yet. Type one below; it’ll be here next time.</span>';
      const go = $s('#vsGo'), typed = cleanName($s('#vsName').value), count = sel.players.length + (typed && !has(typed) ? 1 : 0);
      const need = sel.mode === 'teams' ? 4 : 2, bad = sel.mode === 'teams' ? count !== 4 : count < 2; $s('#vsTeamHint').hidden = sel.mode !== 'teams';
      go.disabled = bad; go.textContent = bad ? (count < need ? `Pick ${need - count} more to start` : 'Teams need exactly 4 players') : 'Start';
    };
    const addName = (raw) => {
      const n = cleanName(raw); if (!n) return false;
      if (has(n)) return true;
      if (sel.players.length >= 8) { toast('Up to 8 players'); return false; }
      const known = saved.find((x) => x.toLowerCase() === n.toLowerCase()); sel.players.push(known || n); if (!known && !sel.extra.some((x) => x.toLowerCase() === n.toLowerCase())) sel.extra.push(n); return true;
    };
    $s('#vsGame').addEventListener('change', (e) => { sel.game = e.target.value; $s('#vsOther').hidden = !!sel.game; if (!sel.game) $s('#vsOther').focus(); });
    $s('#vsName').addEventListener('input', () => paint());
    $s('#vsName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (addName(e.target.value)) { e.target.value = ''; paint(); } } });
    sh.addEventListener('click', (e) => {
      const b = e.target.closest('[data-vs]'); if (!b) return; const k = b.dataset.vs;
      if (k === 'mode') { sel.mode = b.dataset.v; sh.querySelectorAll('[data-vs="mode"]').forEach((x) => x.classList.toggle('on', x === b)); paint(); }
      else if (k === 'tog') { if (has(b.dataset.n)) sel.players = sel.players.filter((p) => p.toLowerCase() !== b.dataset.n.toLowerCase()); else addName(b.dataset.n); paint(); }
      else if (k === 'last') { sel.players = []; last.forEach((n) => addName(n)); paint(); }
      else if (k === 'add') { const i = $s('#vsName'); if (addName(i.value)) { i.value = ''; paint(); } }
      else if (k === 'go') {
        const i = $s('#vsName'); if (i.value.trim()) { if (addName(i.value)) i.value = ''; }
        const g = sel.game ? gameById(sel.game) : null, title = g ? g.title : $s('#vsOther').value.trim();
        if (!title) { $s('#vsOther').hidden = false; $s('#vsOther').focus(); return toast('Which game are you playing?'); }
        if (sel.players.length < 2) return toast('Pick at least 2 players');
        if (sel.mode === 'teams' && sel.players.length !== 4) return toast('2v2 needs exactly 4 players');
        const id = uid(), match = cleanMatch({ id, gameId: g ? g.id : '', title, platform: g ? g.platform : '', mode: sel.mode === 'teams' ? 'versus' : sel.mode, players: sel.players, teams: sel.mode === 'teams' ? [sel.players.slice(0, 2), sel.players.slice(2)] : undefined, startedAt: Date.now(), rounds: [] }, new Set(state.games.map((x) => x.id)));
        if (!match) return;
        closeSheet(); mutate((st) => { st.matches.push(match); st.roster = cleanRoster([...(match.teams.length ? match.teams.flat() : match.players), ...st.roster]); }, 'Session started').then(() => { location.hash = '#/versus/' + id; });
      }
    });
    paint();
  }
  function roundForm(matchId, roundId) {
    const m = matchById(matchId); if (!m) return;
    const ex = roundId ? m.rounds.find((r) => r.id === roundId) : null, coop = m.mode === 'coop', no = (ex ? m.rounds.indexOf(ex) : m.rounds.length) + 1;
    let pick = ex ? (coop ? ex.res : ex.draw ? 'draw' : 'p' + m.players.indexOf(ex.winner)) : '', manual = !!ex;
    const chip = (v, label) => `<button type="button" class="chip" data-pk="${v}">${label}</button>`;
    const sh = openSheet(`<h2>${ex ? 'Edit' : 'Add'} game ${no}</h2><p class="muted small">${esc(m.title)}</p>
      <form id="rdForm" autocomplete="off">
      ${coop ? '' : `<label class="f">SCORES (OPTIONAL)</label><div class="vs-scores">${m.players.map((p, i) => `<label class="vs-sc"><span>${esc(p)}</span><input type="number" inputmode="decimal" step="any" data-sc="${i}" value="${ex && ex.scores[p] !== undefined ? ex.scores[p] : ''}" placeholder="–" aria-label="Score for ${esc(p)}"></label>`).join('')}</div>`}
      <label class="f">${coop ? 'RESULT' : 'WHO WON?'}</label>
      <div class="vs-pick" id="rdPick">${coop ? chip('win', 'Won 🎉') + chip('loss', 'Lost') : m.players.map((p, i) => chip('p' + i, esc(p))).join('') + chip('draw', 'Draw')}</div>
      <label class="f" for="rdNote">NOTE (OPTIONAL)</label><input id="rdNote" type="text" maxlength="120" value="${esc(ex ? ex.note : '')}" placeholder="e.g. overtime, rage quit">
      <div class="actions"><button type="button" class="btn" data-act="close-sheet">Cancel</button><button type="submit" class="btn primary">Save</button></div></form>`);
    const paint = () => sh.querySelectorAll('[data-pk]').forEach((b) => b.classList.toggle('on', b.dataset.pk === pick));
    const scoreVals = () => [...sh.querySelectorAll('[data-sc]')].map((i) => (i.value.trim() !== '' && Number.isFinite(+i.value) ? +i.value : null));
    sh.addEventListener('click', (e) => { const b = e.target.closest('[data-pk]'); if (b) { pick = b.dataset.pk; manual = true; paint(); } });
    sh.addEventListener('input', (e) => {
      if (manual || !e.target.dataset || e.target.dataset.sc === undefined) return;
      const v = scoreVals(), have = v.map((x, i) => [x, i]).filter((x) => x[0] !== null); if (have.length < 2) return;
      const top = Math.max(...have.map((x) => x[0])), w = have.filter((x) => x[0] === top); pick = w.length === 1 ? 'p' + w[0][1] : 'draw'; paint();
    });
    $('#rdForm', sh).addEventListener('submit', (e) => {
      e.preventDefault();
      if (!pick) return toast(coop ? 'Did you win or lose?' : 'Pick who won, or Draw');
      const scores = {}; if (!coop) scoreVals().forEach((v, i) => { if (v !== null) scores[m.players[i]] = v; });
      const note = $('#rdNote', sh).value.trim().slice(0, 120);
      const base = coop ? { res: pick } : pick === 'draw' ? { draw: true } : { winner: m.players[+pick.slice(1)] };
      const r = cleanRound({ id: ex ? ex.id : uid(), at: ex ? ex.at : Date.now(), scores, note, ...base }, m.players); if (!r) return toast('Pick a result first');
      closeSheet();
      mutate((st) => { const x = st.matches.find((q) => q.id === matchId); if (!x) return; if (ex) { const i = x.rounds.findIndex((q) => q.id === ex.id); if (i >= 0) x.rounds[i] = r; } else if (x.rounds.length < MAX_ROUNDS) x.rounds.push(r); }, ex ? 'Result updated' : 'Result saved');
    });
    paint();
  }
  function endSheet(m) {
    const g = m.gameId ? gameById(m.gameId) : null, mins = Math.min(MAX_SESSION_MIN, Math.max(0, Math.floor((Date.now() - m.startedAt) / 60000))), delta = Math.max(0, mins - m.logged);
    const sh = openSheet(`<h2>End this session?</h2><p class="muted">${esc(matchLine(m))} · ${esc(fmtClock(Date.now() - m.startedAt))}</p>
      ${g && delta >= 1 ? `<label class="check" style="margin-top:14px"><input type="checkbox" id="vsLog" checked><span>Add ${esc(fmtHours(delta))} to ${esc(g.title)}’s hours played</span></label>` : ''}
      <div class="actions"><button type="button" class="btn" data-act="close-sheet">Keep playing</button><button type="button" class="btn primary" id="vsEnd">End session</button></div>`);
    $('#vsEnd', sh).addEventListener('click', () => {
      const log = !!($('#vsLog', sh) && $('#vsLog', sh).checked); closeSheet();
      mutate((st) => { const x = st.matches.find((q) => q.id === m.id); if (!x) return; x.endedAt = Date.now(); const gg = x.gameId ? gameById2(st, x.gameId) : null; if (log && gg && delta >= 1) { addPlay(gg, delta); x.logged += delta; if (gg.status === 'want') applyStatus(gg, 'playing'); } }, 'Session ended');
    });
  }
  function playerForm(m) {
    const rest = rosterNames().filter((n) => !m.players.some((p) => p.toLowerCase() === n.toLowerCase()));
    const sh = openSheet(`<h2>Add a player</h2>${rest.length ? `<div class="mchips" style="margin-bottom:10px">${rest.map((n) => `<button type="button" class="mchip" data-pn="${esc(n)}">＋ ${esc(n)}</button>`).join('')}</div>` : ''}<form id="plForm" autocomplete="off"><label class="f" for="plName">NEW NAME</label><input id="plName" type="text" maxlength="24" placeholder="Friend's name"><div class="actions"><button type="button" class="btn" data-act="close-sheet">Cancel</button><button class="btn primary" type="submit">Add</button></div></form>`);
    const add = (raw) => {
      const n = cleanName(raw); if (!n) return;
      if (m.players.some((p) => p.toLowerCase() === n.toLowerCase())) return toast('Already in this session');
      closeSheet(); mutate((st) => { const x = st.matches.find((q) => q.id === m.id); if (x && x.players.length < 8) { x.players.push(n); st.roster = cleanRoster([n, ...st.roster]); } }, n + ' added');
    };
    sh.addEventListener('click', (e) => { const b = e.target.closest('[data-pn]'); if (b) add(b.dataset.pn); });
    $('#plForm', sh).addEventListener('submit', (e) => { e.preventDefault(); add($('#plName', sh).value); });
    setTimeout(() => { const f = $('#plName', sh); if (f) f.focus(); }, 300);
  }

  // ───────────────────────── glass tint + live countdown ─────────────────────────
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const tintCache = new Map();
  /** Tint the page background with the colours of a game's cover (generated cover → its palette; real art → its average colour). */
  function applyTint(g) {
    const root = document.documentElement.style;
    const set = (a, b) => { root.setProperty('--tint1', a); root.setProperty('--tint2', b); };
    if (!g) return set('rgba(34,211,238,.20)', 'rgba(59,130,246,.18)');
    const src = covers[g.id] || cat.get(normKey(g.title));
    if (!src) { const pal = PALETTES[hash32(normKey(g.title)) % PALETTES.length]; return set(hexA(pal[0], .34), hexA(pal[1], .30)); }
    if (tintCache.has(src)) { const t = tintCache.get(src); return set(t[0], t[1]); }
    set('rgba(34,211,238,.20)', 'rgba(59,130,246,.18)');
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 8, 8);
        const d = x.getImageData(0, 0, 8, 8).data; let r = 0, gg = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
        if (!n) return; r = Math.round(r / n); gg = Math.round(gg / n); b = Math.round(b / n);
        const t = [`rgba(${r},${gg},${b},.40)`, `rgba(${Math.round(r * .6 + 20)},${Math.round(gg * .6 + 40)},${Math.round(b * .6 + 90)},.30)`];
        tintCache.set(src, t); if (tintOwner === g.id) set(t[0], t[1]);
      } catch (e) { /* keep default */ }
    };
    img.src = src;
  }
  let tintOwner = null;
  /** Local midnight at the start of a release day (release dates have no clock time, so this is when the countdown ends). */
  const releaseTs = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : 0; };
  function cdText(ts) {
    const diff = ts - Date.now(); if (diff <= 0) return 'Out now';
    const t = Math.floor(diff / 1000), d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
    return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m ${pad(sec)}s` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
  }
  function tickCountdowns() {
    document.querySelectorAll('[data-since]').forEach((el) => { const t = fmtClock(Date.now() - +el.dataset.since); if (el.textContent !== t) el.textContent = t; });
    document.querySelectorAll('[data-cd]').forEach((el) => { const ts = +el.dataset.cd; if (!ts) return; const t = cdText(ts); if (el.textContent !== t) el.textContent = t; el.classList.toggle('now', ts - Date.now() <= 0); });
  }
  /** Minutes per day for the last 7 days (oldest first), plus the current streak of days with any logged play. */
  function weekDays() {
    const t = todayStr(), mins = new Array(7).fill(0), has = new Set();
    state.games.forEach((g) => (g.plays || []).forEach((p) => { has.add(p.d); const d = daysBetween(p.d, t); if (d >= 0 && d < 7) mins[6 - d] += p.m; }));
    let streak = 0, k = has.has(t) ? 0 : 1; while (k < 400) { const d = new Date(Date.parse(t + 'T00:00:00Z') - k * 864e5).toISOString().slice(0, 10); if (!has.has(d)) break; streak++; k++; }
    const labels = []; for (let i = 6; i >= 0; i--) labels.push('SMTWTFS'[new Date(Date.parse(t + 'T00:00:00Z') - i * 864e5).getUTCDay()]);
    return { mins, streak, labels, total: mins.reduce((a, b) => a + b, 0) };
  }
  function weekCard() {
    if (!state.games.some((g) => (g.plays || []).length)) return state.games.some((g) => g.status === 'playing') ? `<div class="card week"><h3 class="ct">This week</h3><p class="sub" style="margin:0">Start a session or add hours on a game and your week fills in here.</p></div>` : '';
    const w = weekDays(), max = Math.max(1, ...w.mins);
    return `<div class="card week"><div class="big"><div><h3 class="ct" style="margin:0">This week</h3></div><b>${esc(fmtHours(w.total))}</b></div>
      <div class="wk-bars">${w.mins.map((m, i) => `<div class="wk-col ${m ? 'on' : ''} ${i === 6 ? 'today' : ''}"><i style="height:${m ? Math.max(8, Math.round((m / max) * 100)) : 4}%" title="${esc(fmtHours(m))}"></i><small>${w.labels[i]}</small></div>`).join('')}</div>
      ${w.streak ? `<div class="streak">🔥 ${plural(w.streak, 'day')} in a row</div>` : ''}</div>`;
  }
  const STALE_MS = 30 * 864e5;
  /** Playing / Paused games nobody has touched for 30+ days. */
  const backlogList = () => state.games.filter((g) => (g.status === 'playing' || g.status === 'paused') && !g.sessionAt && Date.now() - g.updatedAt > STALE_MS).sort((a, b) => a.updatedAt - b.updatedAt).slice(0, 3);
  function nudgeCard() {
    const l = backlogList(); if (!l.length) return '';
    return `<div class="section-title">Still on your list</div><div class="card" style="padding:6px 14px">${l.map((g) => `<div class="nudge-row"><a class="gc-cover xs" href="#/game/${encodeURIComponent(g.id)}" data-ck="${esc(normKey(g.title))}">${coverHTML(g, 'thumb')}</a><a class="nr-main" href="#/game/${encodeURIComponent(g.id)}" style="color:inherit;text-decoration:none"><b>${esc(g.title)}</b><small>${esc(statusLabel(g.status))} · last touched ${daysSince(g.updatedAt)} days ago</small></a>${g.status === 'paused' ? `<button class="btn sm" data-act="quick-status" data-id="${esc(g.id)}" data-v="playing">Resume</button>` : `<button class="btn sm" data-act="quick-status" data-id="${esc(g.id)}" data-v="paused">Pause</button>`}</div>`).join('')}</div>`;
  }
  function heroCard(g, isQueue) {
    const live = g.sessionAt, cv = `<div class="hero-cv" data-ck="${esc(normKey(g.title))}">${coverHTML(g, 'full')}</div>`;
    return `<div class="hero-now"><div class="eyebrow">${isQueue ? 'Up next' : 'Continue playing'}</div>
      <a class="hero-row" href="#/game/${encodeURIComponent(g.id)}">${cv}<div class="hero-info"><h2>${esc(g.title)}</h2><span class="meta"><span class="plat">${esc(g.platform)}</span>${g.played ? ' · ' + esc(fmtHours(g.played)) : ''}${notesOf(g.id).length ? ' · ' + plural(notesOf(g.id).length, 'note') : ''}</span>${g.leftOff ? `<span class="meta leftoff-line">📍 ${esc(g.leftOff)}</span>` : ''}${isQueue ? '' : `<div class="bar"><i style="width:${g.progress}%"></i></div><span class="meta">${g.progress}% complete</span>`}</div></a>
      ${live ? `<div class="sess"><b>Session running</b><span data-sess="${esc(g.id)}">${esc(fmtHours(sessionMin(g)))}</span></div>` : ''}
      <div class="hero-act">${isQueue ? `<button class="btn primary" data-act="start-game" data-id="${esc(g.id)}">${icon('next')}Start</button>` : live ? `<button class="btn primary" data-act="end-session" data-id="${esc(g.id)}">■ End session</button>` : `<button class="btn primary" data-act="start-session" data-id="${esc(g.id)}">▶ Start session</button>`}<a class="btn" href="#/game/${encodeURIComponent(g.id)}">Open</a></div></div>`;
  }
  function releasingRow() {
    const list = soonList(); if (!list.length) return '';
    const items = list.slice(0, 8).map(({ g, r }) => { const e = catOf(g), ts = releaseTs(e.date); return `<a class="rel" href="#/game/${encodeURIComponent(g.id)}"><div class="cvbox" data-ck="${esc(normKey(g.title))}">${coverHTML(g, 'thumb')}</div><b>${esc(g.title)}</b><span class="cd ${r.days < 0 ? 'now' : ''}" data-cd="${ts}">${esc(cdText(ts))}</span><small>${esc(fmtDate(e.date))}</small></a>`; }).join('');
    return `<div class="section-title">Releasing soon <a href="#/library" data-act="open-soon">${list.length > 8 ? `See all ${list.length}` : 'Library'}</a></div><div class="soonrow">${items}</div><p class="rel-note">Counting down to 00:00 your time on release day.</p>`;
  }
  function viewHome() {
    const c = (s) => state.games.filter((g) => g.status === s).length;
    const playing = state.games.filter((g) => g.status === 'playing').sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
    const recent = state.notes.slice().sort(byNewestNote).slice(0, 4);
    const queued = state.games.filter((g) => g.queue).sort((a, b) => a.queue - b.queue).slice(0, 5);
    if (!state.games.length && !state.notes.length && +(lsGet(LS_HAD) || 0) > 0) {
      return { title: LOGO + 'Save Point', fab: null, html: `<div class="card attn"><h3 class="ct">Your library is empty</h3><p class="sub">This phone had ${plural(+lsGet(LS_HAD), 'game')} saved here before. If you didn’t clear it on purpose, the browser may have wiped the app’s storage. Restore your latest backup file to get everything back.</p>
        <div class="stack" style="margin-top:12px"><button class="btn primary block" data-act="pick-file">${icon('upload')}Restore from a backup file</button><input id="fileIn" type="file" accept=".json,application/json,text/plain" hidden>
        <button class="btn block" data-act="start-fresh">I cleared it on purpose – start fresh</button></div></div>` };
    }
    if (!state.games.length) {
      return { title: LOGO + 'Save Point', fab: null, html: emptyState('pad', 'Your journal is empty', 'Add the first game you’re playing, then jot down missions, boss tips, codes and builds as you go.', `<button class="btn primary" data-act="add-game">${icon('plus')}Add your first game</button>`) };
    }
    const hero = playing[0] || queued[0] || null, heroIsQueue = !playing[0] && !!queued[0];
    const others = state.games.filter((g) => g.status === 'playing' && (!hero || g.id !== hero.id)).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
    return {
      title: LOGO + 'Save Point', fab: { label: 'Game', act: 'add-game' }, tint: hero, html: `
      ${state.matches.filter((m) => !m.endedAt).slice(0, 2).map((m) => `<a class="card vs-live" href="#/versus/${encodeURIComponent(m.id)}"><b>⚔️ Session in progress</b><span>${esc(m.title)} · <span class="vs-clock" data-since="${m.startedAt}">${fmtClock(Date.now() - m.startedAt)}</span> · ${esc(matchLine(m))}</span></a>`).join('')}
      ${hero ? heroCard(hero, heroIsQueue) : ''}
      ${others.length ? `<div class="also" aria-label="Also playing">${others.map((g) => `<a href="#/game/${encodeURIComponent(g.id)}"><div class="cvbox" data-ck="${esc(normKey(g.title))}">${coverHTML(g, 'thumb')}</div><small>${esc(g.title)}</small></a>`).join('')}</div>` : ''}
      <div class="stats">
        <div class="stat"><b>${state.games.length}</b><span>Games added</span></div>
        <div class="stat accent"><b>${c('playing')}</b><span>Playing now</span></div>
        <div class="stat good"><b>${c('finished')}</b><span>Completed</span></div>
      </div>
      <div class="substats">${c('want')} want to play · ${c('paused')} paused · ${plural(state.notes.length, 'note')}${state.games.some((g) => g.fav) ? ` · <span class="heart">♥</span> ${state.games.filter((g) => g.fav).length}` : ''}${totalPlayed() ? ` · ${fmtHours(totalPlayed())} played` : ''}</div>
      <div class="row2"><button class="btn rnd-btn" data-act="random-game">🎲 What should I play?</button><a class="btn rnd-btn" href="#/versus">⚔️ Play with friends</a></div>
      ${weekCard()}
      ${releasingRow()}
      ${queued.length && !heroIsQueue ? `<div class="section-title">Up next <a href="#/library" data-act="open-queue">See all</a></div>${queued.map(queueCard).join('')}` : queued.length > 1 ? `<div class="section-title">Up next <a href="#/library" data-act="open-queue">See all</a></div>${queued.slice(1).map(queueCard).join('')}` : ''}
      ${nudgeCard()}
      <div class="section-title">Recent notes <a href="#/journal">All notes</a></div>
      ${recent.length ? recent.slice(0, 3).map((n) => noteCard(n, { showGame: true })).join('') : '<p class="muted card">No notes yet. Open a game and add one.</p>'}`
    };
  }

  function libraryList() {
    let list = state.games.slice();
    const q = ui.libQ.trim().toLowerCase();
    if (q) list = list.filter((g) => libMatches(g, q));
    if (ui.libStudio !== 'all') list = list.filter((g) => { const e = catOf(g); return e && e.studios.includes(ui.libStudio); });
    if (ui.libGenre !== 'all') list = list.filter((g) => { const e = catOf(g); return e && hasGenre(e, ui.libGenre); });
    if (ui.libStatus === 'fav') list = list.filter((g) => g.fav);
    else if (ui.libStatus === 'queue') list = list.filter((g) => g.queue);
    else if (ui.libStatus === 'soon') list = list.filter((g) => { const r = libRel(g); return r && r.upcoming; });
    else if (ui.libStatus !== 'all') list = list.filter((g) => g.status === ui.libStatus);
    if (ui.libPlat !== 'all') list = list.filter((g) => g.platform === ui.libPlat);
    const sorters = { recent: (a, b) => b.updatedAt - a.updatedAt, title: (a, b) => a.title.localeCompare(b.title), progress: (a, b) => b.progress - a.progress, rating: (a, b) => b.rating - a.rating || a.title.localeCompare(b.title), played: (a, b) => (b.played || 0) - (a.played || 0) || a.title.localeCompare(b.title) };
    list.sort(sorters[ui.libSort] || sorters.recent);
    if (ui.libStatus === 'queue') list.sort((a, b) => a.queue - b.queue);
    if (ui.libStatus === 'soon') list.sort((a, b) => libRel(a).sort - libRel(b).sort || a.title.localeCompare(b.title));
    if (!list.length) return emptyState('library', state.games.length ? 'No matches' : 'No games yet', state.games.length ? 'Try a different search or filter.' : 'Tap “Game” to add one.');
    return `<p class="muted small" style="margin:8px 4px">${plural(list.length, 'game')}</p>` + (ui.libView === 'grid' ? `<div class="grid3">${list.map(gameTile).join('')}</div>` : list.map(gameCard).join(''));
  }
  /** Cover-first tile for the Library grid: fav heart, rating, a progress ring, and a countdown for upcoming games. */
  function gameTile(g) {
    const R = 11, C = 2 * Math.PI * R, r = g.status === 'want' ? libRel(g) : null, soon = r && r.upcoming && r.exact ? (r.days <= 0 ? 'Out' : r.days + 'd') : '';
    const ring = g.status === 'finished' ? `<span class="ring done" aria-label="Finished"><svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="${R}"/><circle class="p" cx="14" cy="14" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg><i>✓</i></span>`
      : g.progress > 0 ? `<span class="ring" aria-label="${g.progress}% complete"><svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="${R}"/><circle class="p" cx="14" cy="14" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${(C * (1 - g.progress / 100)).toFixed(1)}"/></svg><i>${g.progress}</i></span>` : '';
    return `<a class="tile" href="#/game/${encodeURIComponent(g.id)}"><div class="tile-cv" data-ck="${esc(normKey(g.title))}">${coverHTML(g, 'thumb')}${g.fav ? '<span class="tb hrt">♥</span>' : ''}${g.rating ? `<span class="tb rt">★ ${g.rating}</span>` : ''}${g.sessionAt ? '<span class="tb live">●</span>' : ''}${ring}${soon ? `<span class="tb soon">${esc(soon)}</span>` : ''}</div><b>${esc(g.title)}</b><small><span class="dot st-${g.status}"></span>${esc(g.platform)}</small></a>`;
  }
  const filtersActive = () => (ui.libPlat !== 'all') + (ui.libStudio !== 'all') + (ui.libGenre !== 'all') + (ui.libSort !== 'recent');
  function viewLibrary() {
    const plats = [...new Set(state.games.map((g) => g.platform))].sort();
    const gcount = {}; state.games.forEach((g) => { const e = catOf(g); if (e) MAIN_GENRES.forEach((n) => { if (hasGenre(e, n)) gcount[n] = (gcount[n] || 0) + 1; }); });
    const scount = new Map(); state.games.forEach((g) => { const e = catOf(g); if (e) e.studios.forEach((x) => scount.set(x, (scount.get(x) || 0) + 1)); });
    const libStudios = [...scount.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 40).sort((a, b) => a[0].localeCompare(b[0]));
    const libGenres = MAIN_GENRES.filter((n) => gcount[n]).map((n) => [n, gcount[n]]);
    const chips = [{ id: 'all', label: 'All' }, ...STATUSES, { id: 'fav', label: '♥ Favorites' }, { id: 'queue', label: 'Up next' }, ...(state.games.some((g) => { const r = libRel(g); return r && r.upcoming; }) ? [{ id: 'soon', label: '📅 Upcoming' }] : [])].map((s) => `<button class="chip ${ui.libStatus === s.id ? 'on' : ''}" data-act="set-ui" data-k="libStatus" data-v="${s.id}">${esc(s.label)}</button>`).join('');
    return {
      title: 'Library', fab: { label: 'Game', act: 'add-game' }, html: `
      <div class="lib-bar"><div class="lb-row"><input type="search" placeholder="Search games, studios…" value="${esc(ui.libQ)}" data-bind="libQ" aria-label="Search games, genres or studios" enterkeyhint="search">
        <button class="icon-btn" data-act="lib-view" data-v="${ui.libView === 'grid' ? 'list' : 'grid'}" aria-label="${ui.libView === 'grid' ? 'Show as list' : 'Show as cover grid'}">${icon(ui.libView === 'grid' ? 'list' : 'library')}</button>
        <button class="icon-btn fbtn ${ui.libFilters ? 'on' : ''}" data-act="toggle-filters" aria-label="Filters" aria-expanded="${!!ui.libFilters}">${icon('filter')}<em id="fCount" ${filtersActive() ? '' : 'hidden'}>${filtersActive()}</em></button></div>
        <div class="chips">${chips}</div></div>
      <div class="filters libf ${ui.libFilters ? 'open' : ''}">
        <select data-bind="libPlat" aria-label="Platform"><option value="all">All platforms</option>${plats.map((p) => `<option ${ui.libPlat === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
        <select data-bind="libSort" aria-label="Sort"><option value="recent" ${ui.libSort === 'recent' ? 'selected' : ''}>Recently active</option><option value="title" ${ui.libSort === 'title' ? 'selected' : ''}>Title A–Z</option><option value="progress" ${ui.libSort === 'progress' ? 'selected' : ''}>Most complete</option><option value="rating" ${ui.libSort === 'rating' ? 'selected' : ''}>Highest rated</option><option value="played" ${ui.libSort === 'played' ? 'selected' : ''}>Most hours played</option></select>
        ${libStudios.length ? `<select data-bind="libStudio" aria-label="Studio" class="f-wide"><option value="all">All studios</option>${libStudios.map(([n, c]) => `<option value="${esc(n)}" ${ui.libStudio === n ? 'selected' : ''}>${esc(n)} (${c})</option>`).join('')}</select>` : ''}
        ${libGenres.length ? `<select data-bind="libGenre" aria-label="Genre" class="f-wide"><option value="all">All genres</option>${libGenres.map(([n, c]) => `<option value="${esc(n)}" ${ui.libGenre === n ? 'selected' : ''}>${esc(n)} (${c})</option>`).join('')}</select>` : ''}
      </div>
      ${state.games.some((g) => !covers[g.id]) ? `<button class="btn sm block" data-act="fetch-all-covers" style="margin-top:12px">Find covers for my games</button>` : ''}
      <div id="listBox">${libraryList()}</div>`
    };
  }

  /** Does a note match a typed search? Every word must appear in the title, text, tags or game name. */
  function noteMatches(n, q) {
    const g = gameById(n.gameId), hay = [n.title, n.body, (n.tags || []).join(' '), g ? g.title : ''].join(' \n ').toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w.replace(/^#/, '')));
  }
  function journalList() {
    let list = state.notes.slice().sort(byNewestNote);
    const q = ui.jQ.trim();
    if (ui.jType !== 'all') list = list.filter((n) => n.type === ui.jType);
    if (ui.jTag) list = list.filter((n) => (n.tags || []).includes(ui.jTag));
    if (q) list = list.filter((n) => noteMatches(n, q));
    if (!list.length) return emptyState('journal', state.notes.length ? 'No matching notes' : 'No notes yet', state.notes.length ? 'Try a different search, tag or type.' : 'Open a game and tap “Note” to start your journal.');
    let html = `<p class="muted small" style="margin:8px 4px">${plural(list.length, 'note')}</p>`, last = '';
    list.forEach((n) => {
      const ym = n.date.slice(0, 7);
      if (ym !== last) { last = ym; html += `<div class="section-title">${esc(MONTHS[+ym.slice(5) - 1] + ' ' + ym.slice(0, 4))}</div>`; }
      html += noteCard(n, { showGame: true });
    });
    return html;
  }
  /** All tags in use, most used first. */
  function tagCounts(notes) {
    const m = new Map(); (notes || state.notes).forEach((n) => (n.tags || []).forEach((t) => m.set(t, (m.get(t) || 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  }
  function viewJournal() {
    const chips = [{ id: 'all', label: 'All' }, ...NOTE_TYPES].map((t) => `<button class="chip ${ui.jType === t.id ? 'on' : ''}" data-act="set-ui" data-k="jType" data-v="${t.id}">${esc(t.label)}</button>`).join('');
    const tc = tagCounts().sort((x, y) => (y[0] === ui.jTag) - (x[0] === ui.jTag)), tagRow = tc.length ? `<div class="chips tagrow" aria-label="Tags">${tc.slice(0, 20).map(([t, c]) => `<button class="chip tg ${ui.jTag === t ? 'on' : ''}" data-act="tag-filter" data-t="${esc(t)}" ${ui.jTag === t ? 'data-off="1"' : ''}>#${esc(t)} ${c}</button>`).join('')}</div>` : '';
    return { title: 'Journal', fab: null, html: `<div class="lib-bar"><input type="search" placeholder="Search notes, tags, games…" value="${esc(ui.jQ)}" data-bind="jQ" aria-label="Search notes" enterkeyhint="search"><div class="chips" style="margin-top:10px">${chips}</div>${tagRow}</div><div id="listBox">${journalList()}</div>` };
  }

  /** Genre and studio chips for a game from the built-in list; tapping one searches your library for it. */
  function gameMetaChips(g) {
    const e = catOf(g); if (!e || (!e.tags.length && !e.studios.length)) return '';
    const chip = (t) => `<button type="button" class="mchip" data-act="search-lib" data-q="${esc(t)}">${esc(t)}</button>`;
    return `<div class="mchips">${e.tags.slice(0, 4).map(chip).join('')}${e.studios.slice(0, 2).map((x) => chip(x).replace('class="mchip"', 'class="mchip studio"')).join('')}</div>`;
  }
  function relLine(g) {
    const r = libRel(g); if (!r || !r.upcoming) return '';
    const e = catOf(g), ts = r.exact && e ? releaseTs(e.date) : 0;
    return `<p class="rel-line">📅 ${esc(r.label)}${ts ? ` · <span class="cd-line" data-cd="${ts}">${esc(cdText(ts))}</span>` : r.count ? ' · ' + esc(r.count) : ''}</p>`;
  }
  function gameNotesHTML(g) {
    const all = notesOf(g.id).sort(byNewestNote);
    let list = ui.gType === 'all' ? all : all.filter((n) => n.type === ui.gType);
    if (all.length >= 6 && ui.gQ.trim()) list = list.filter((n) => noteMatches(n, ui.gQ));
    if (!list.length) return all.length ? emptyState('journal', 'No matching notes', 'Try a different search or type.') : emptyState('journal', 'No notes yet', 'Missions, boss tips, codes, builds, locations… tap “Note”.');
    return list.map((n) => noteCard(n, { actions: true })).join('');
  }
  function viewGame(id) {
    const g = gameById(id);
    if (!g) return { title: 'Not found', back: '#/library', fab: null, html: emptyState('library', 'Game not found', 'It may have been deleted.', '<a class="btn primary" href="#/library">Back to library</a>') };
    const all = notesOf(g.id).sort(byNewestNote), hasRealCover = !!(covers[g.id] || cat.get(normKey(g.title))), notStarted = g.status === 'want' && !(g.rating || g.progress || g.played || g.startedAt || g.finishedAt);
    const counts = (t) => all.filter((n) => n.type === t).length;
    const chips = [{ id: 'all', label: `All ${all.length}` }, ...NOTE_TYPES.filter((t) => counts(t.id)).map((t) => ({ id: t.id, label: `${t.label} ${counts(t.id)}` }))]
      .map((t) => `<button class="chip ${ui.gType === t.id ? 'on' : ''}" data-act="set-ui" data-k="gType" data-v="${t.id}">${esc(t.label)}</button>`).join('');
    return {
      title: esc(g.title), back: '#/library', fab: { label: 'Note', act: 'add-note', id: g.id }, tint: g, html: `
      <div class="gp-hero"><div class="gp-bg" data-ck="${esc(normKey(g.title))}" aria-hidden="true">${coverHTML(g, 'full')}</div>
        <div class="gp-row"><div class="gp-cover" data-ck="${esc(normKey(g.title))}">${coverHTML(g, 'full')}</div>
          <div class="gp-side">
            <span class="pill st-${g.status}">${esc(statusLabel(g.status))}</span>
            <span class="plat">${esc(g.platform)}${g.rating ? ` · <span class="rate-badge">★ ${g.rating}/10</span>` : ''}</span>
            <span class="muted small">${g.played ? esc(fmtHours(g.played)) + ' played · ' : ''}Added ${esc(fmtDate(dateStr(new Date(g.createdAt))))}</span>
            ${g.sessionAt ? '<span class="live-badge">● Session running</span>' : ''}
            ${relLine(g)}
            ${hasRealCover ? '' : `<button class="btn sm" data-act="find-cover" data-id="${esc(g.id)}">${icon('share')}Find cover online</button>`}
          </div></div>
      </div>
      ${gameMetaChips(g)}
      <div class="seg" role="group" aria-label="Status">${STATUSES.map((s) => `<button class="${g.status === s.id ? 'on' : ''}" data-act="quick-status" data-id="${g.id}" data-v="${s.id}">${esc(s.label)}</button>`).join('')}</div>
      <div class="quick">
        <button class="qbtn ${g.fav ? 'on fav' : ''}" data-act="toggle-fav" data-id="${esc(g.id)}" aria-pressed="${g.fav}">${icon('heart')}<span>${g.fav ? 'Favorite' : 'Favorite'}</span></button>
        ${g.status === 'playing' || g.status === 'finished' ? '' : `<button class="qbtn ${g.queue ? 'on' : ''}" data-act="toggle-queue" data-id="${esc(g.id)}" aria-pressed="${!!g.queue}">${icon('next')}<span>${g.queue ? 'In Up next' : 'Up next'}</span></button>`}
        <button class="qbtn" data-act="share-card" data-id="${esc(g.id)}">${icon('share')}<span>Share</span></button>
        <button class="qbtn" data-act="edit-game" data-id="${esc(g.id)}">${icon('edit')}<span>Edit</span></button>
      </div>
      ${g.leftOff ? `<button class="leftoff" data-act="edit-leftoff" data-id="${esc(g.id)}"><small>📍 WHERE I LEFT OFF</small><span>${esc(g.leftOff)}</span></button>` : g.status === 'finished' ? '' : `<button class="leftoff empty" data-act="edit-leftoff" data-id="${esc(g.id)}"><span>📍 Add where you left off</span></button>`}
      ${notStarted ? `<div class="notstarted"><p><b>Not started yet.</b> Rating, completion and hours show up once you start playing.</p><button class="btn primary block" data-act="start-game" data-id="${esc(g.id)}">${icon('next')}Start playing</button><p class="muted small">Already finished it? Tap <b>Finished</b> above and you can rate it.</p></div>` : `
      <div class="acc ${ui.acc.prog ? 'open' : ''}"><button class="acc-h" data-act="toggle-acc" data-k="prog" aria-expanded="${!!ui.acc.prog}"><b>Progress &amp; hours</b><small>${g.progress}%${g.played ? ' · ' + esc(fmtHours(g.played)) : ''}${g.rating ? ' · ★ ' + g.rating : ''}</small><i aria-hidden="true">›</i></button>
        <div class="acc-b">
        <label class="f">YOUR RATING <b class="rate-val">${g.rating ? g.rating + ' / 10' : 'not rated'}</b></label>
        <div class="rate" role="group" aria-label="Rating out of 10">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => `<button class="${g.rating === v ? 'on' : ''}" data-act="set-rating" data-id="${esc(g.id)}" data-v="${v}" aria-pressed="${g.rating === v}">${v}</button>`).join('')}</div>
        <label class="f" for="prog">COMPLETION</label>
        <div class="range-row"><input id="prog" type="range" min="0" max="100" step="1" value="${g.progress}" data-progress="${esc(g.id)}"><output id="progOut">${g.progress}%</output></div>
        <div class="chips prog-chips" role="group" aria-label="Set completion">${[0, 25, 50, 75, 100].map((v) => `<button type="button" class="chip ${g.progress === v ? 'on' : ''}" data-act="set-progress" data-id="${esc(g.id)}" data-v="${v}">${v}%</button>`).join('')}</div>
        <label class="f" for="hrsIn">HOURS PLAYED <span class="muted small" style="text-transform:none;letter-spacing:0">hours so far, or the total it took to finish</span></label>
        <div class="hrs-row"><input id="hrsIn" type="number" inputmode="decimal" min="0" max="10000" step="0.1" placeholder="0" value="${g.played ? Math.round((g.played / 60) * 100) / 100 : ''}" data-hours="${esc(g.id)}" aria-label="Hours played"><span>h</span></div>
        ${g.sessionAt ? `<div class="sess"><b>Session running</b><span data-sess="${esc(g.id)}">${esc(fmtHours(sessionMin(g)))}</span><small class="muted">since ${esc(fmtTime(g.sessionAt))}</small></div>
        <div class="row"><button class="btn primary" data-act="end-session" data-id="${esc(g.id)}">End session &amp; add hours</button><button class="btn" data-act="cancel-session" data-id="${esc(g.id)}">Discard</button></div>`
        : `<div class="row"><button class="btn primary" data-act="start-session" data-id="${esc(g.id)}">▶ Start session</button><button class="btn" data-act="add-hours" data-id="${esc(g.id)}">+ Add hours</button></div>`}
        <div class="row" style="margin-top:8px"><button class="btn" data-act="versus-start" data-id="${esc(g.id)}">⚔️ Play with friends</button></div>
        <div class="dates">
          <label class="f" for="dStart">STARTED</label><label class="f" for="dEnd">FINISHED</label>
          <div class="dwrap"><input id="dStart" type="date" data-date="startedAt" data-id="${esc(g.id)}" value="${esc(g.startedAt)}">${g.startedAt ? `<button class="x" data-act="clear-date" data-k="startedAt" data-id="${esc(g.id)}" aria-label="Clear start date">✕</button>` : ''}</div>
          <div class="dwrap"><input id="dEnd" type="date" data-date="finishedAt" data-id="${esc(g.id)}" value="${esc(g.finishedAt)}">${g.finishedAt ? `<button class="x" data-act="clear-date" data-k="finishedAt" data-id="${esc(g.id)}" aria-label="Clear finish date">✕</button>` : ''}</div>
        </div>
        ${g.startedAt && g.finishedAt && g.finishedAt >= g.startedAt ? `<p class="muted small" style="margin-top:8px">Finished in ${plural(daysBetween(g.startedAt, g.finishedAt) + 1, 'day')}.</p>` : ''}
        </div></div>`}
      <div class="acc ${ui.acc.det ? 'open' : ''}"><button class="acc-h" data-act="toggle-acc" data-k="det" aria-expanded="${!!ui.acc.det}"><b>Cover &amp; more</b><small>cover, delete</small><i aria-hidden="true">›</i></button>
        <div class="acc-b">
          <div class="row">${hasRealCover ? `<button class="btn sm" data-act="find-cover" data-id="${esc(g.id)}">${icon('share')}Find cover online</button>` : ''}<button class="btn sm" data-act="pick-cover">${icon('upload')}${covers[g.id] ? 'Change photo' : 'Use my photo'}</button></div>
          ${covers[g.id] ? `<div class="row" style="margin-top:8px"><button class="btn sm" data-act="clear-cover" data-id="${esc(g.id)}">Use generated cover</button></div>` : ''}
          <input id="coverIn" type="file" accept="image/*" data-cover="${esc(g.id)}" hidden>
          <div class="row" style="margin-top:14px"><button class="btn danger" data-act="del-game" data-id="${esc(g.id)}">${icon('trash')}Delete game</button></div>
        </div></div>
      <div class="section-title">Notes <span class="muted" style="text-transform:none;letter-spacing:0">${all.length || ''}</span></div>
      ${all.length >= 6 ? `<input type="search" placeholder="Search this game’s notes…" value="${esc(ui.gQ)}" data-bind="gQ" aria-label="Search this game’s notes" enterkeyhint="search" style="margin-bottom:10px">` : ''}
      ${all.length ? `<div class="chips">${chips}</div>` : ''}
      <div id="listBox" class="timeline">${gameNotesHTML(g)}</div>`
    };
  }


  // ───────────────────────── stats ─────────────────────────
  function genreCard() {
    const cnt = {}; let known = 0;
    state.games.forEach((g) => { const e = catOf(g); if (!e || !e.tags.length) return; known++; MAIN_GENRES.forEach((n) => { if (hasGenre(e, n)) cnt[n] = (cnt[n] || 0) + 1; }); });
    const rows = Object.entries(cnt).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8), mx = rows.length ? rows[0][1] : 0;
    if (!rows.length) return '';
    return `<div class="card"><h3 class="ct">By genre</h3>${rows.map(([l, n]) => `<div class="hb"><span class="hb-l">${esc(l)}</span><div class="hb-t"><i style="width:${Math.max(4, Math.round((n / mx) * 100))}%"></i></div><span class="hb-n">${n}</span></div>`).join('')}<p class="muted small" style="margin-top:8px">A game can count under more than one genre. Only games from the built-in list have genres (${known} of ${state.games.length} here).</p></div>`;
  }
  function hoursCard() {
    const tot = totalPlayed(), w = weekly(), wMax = Math.max(...w);
    const top = state.games.filter((g) => g.played).sort((a, b) => b.played - a.played || a.title.localeCompare(b.title)).slice(0, 5), tMax = top.length ? top[0].played : 0;
    const hb = (label, min, max) => `<div class="hb wide"><span class="hb-l">${esc(label)}</span><div class="hb-t"><i style="width:${max ? Math.max(min ? 4 : 0, Math.round((min / max) * 100)) : 0}%"></i></div><span class="hb-n">${esc(fmtHours(min))}</span></div>`;
    if (!tot) return `<div class="card"><h3 class="ct">Hours played</h3><p class="sub">Open a game and tap “Start session”, or “Add hours”, to see your playtime here.</p></div>`;
    return `<div class="card"><h3 class="ct">Hours played</h3>
      <div class="kv"><span>Total</span><span><b>${esc(fmtHours(tot))}</b></span></div>
      <div class="kv"><span>Last 7 days</span><span>${esc(fmtHours(w[0]))}</span></div>
      <h4 class="sub" style="margin:12px 0 2px">Per week</h4>
      ${w.slice(0, 8).map((m, i) => hb(i === 0 ? 'This week' : i === 1 ? 'Last week' : i + ' wks ago', m, wMax)).join('')}
      <h4 class="sub" style="margin:12px 0 2px">Most played</h4>
      ${top.map((g) => hb(g.title.length > 14 ? g.title.slice(0, 13) + '…' : g.title, g.played, tMax)).join('')}
      <p class="muted small" style="margin-top:8px">Weeks cover the last 7 days, the 7 before that, and so on. Hours you set with “Edit total” count toward the total but not the weekly chart.</p></div>`;
  }
  function viewStats() {
    const gs = state.games;
    if (!gs.length) return { title: 'Stats', fab: null, html: emptyState('stats', 'No stats yet', 'Add some games, rate them and mark the ones you finish. Your numbers show up here.') };
    const rated = gs.filter((g) => g.rating), avg = rated.length ? rated.reduce((a, g) => a + g.rating, 0) / rated.length : 0;
    const fin = gs.filter((g) => g.status === 'finished');
    const spans = fin.filter((g) => g.startedAt && g.finishedAt && g.finishedAt >= g.startedAt).map((g) => daysBetween(g.startedAt, g.finishedAt) + 1);
    const avgDays = spans.length ? Math.round(spans.reduce((a, b) => a + b, 0) / spans.length) : 0;
    const hbar = (label, n, max, cls) => `<div class="hb"><span class="hb-l">${esc(label)}</span><div class="hb-t"><i class="${cls || ''}" style="width:${max ? Math.max(n ? 4 : 0, Math.round((n / max) * 100)) : 0}%"></i></div><span class="hb-n">${n}</span></div>`;
    const stCounts = STATUSES.map((st) => [st.label, gs.filter((g) => g.status === st.id).length, st.id]);
    const stMax = Math.max(...stCounts.map((x) => x[1]));
    const dist = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => rated.filter((g) => g.rating === v).length), dMax = Math.max(1, ...dist);
    const plats = {}; gs.forEach((g) => { plats[g.platform] = (plats[g.platform] || 0) + 1; });
    const pl = Object.entries(plats).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8), pMax = pl.length ? pl[0][1] : 0;
    const now = new Date(), months = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: MONTHS[d.getMonth()] }); }
    const perMonth = months.map((m) => [m.label, fin.filter((g) => (g.finishedAt || '').slice(0, 7) === m.key).length]), mMax = Math.max(...perMonth.map((x) => x[1]));
    const finDated = fin.filter((g) => g.finishedAt).length;
    const top = rated.slice().sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title)).slice(0, 5);
    return {
      title: 'Stats', fab: null, html: `
      <div class="stats">
        <div class="stat"><b>${gs.length}</b><span>Games</span></div>
        <div class="stat good"><b>${fin.length}</b><span>Finished</span></div>
        <div class="stat accent"><b>${rated.length ? avg.toFixed(1) : '–'}</b><span>Avg rating</span></div>
      </div>
      <div class="substats">${rated.length ? plural(rated.length, 'rated game') : 'No ratings yet'} · ${plural(state.notes.length, 'note')}${avgDays ? ` · finish in ~${plural(avgDays, 'day')}` : ''}</div>
      <a class="card yr-link" href="#/year"><b>📅 Your year in review</b><span class="muted small">Finished, started, top rated, hours and more →</span></a>
      ${hoursCard()}
      ${genreCard()}
      <div class="card"><h3 class="ct">By status</h3>${stCounts.map(([l, n, id]) => hbar(l, n, stMax, 'st-' + id)).join('')}</div>
      <div class="card"><h3 class="ct">Your ratings</h3>${rated.length ? `<div class="hist">${dist.map((n, i) => `<div class="hcol"><small>${n || ''}</small><div class="hc-t"><i style="height:${Math.round((n / dMax) * 100)}%"></i></div><b>${i + 1}</b></div>`).join('')}</div>` : '<p class="sub">Rate a game 1–10 to see how you score things.</p>'}</div>
      <div class="card"><h3 class="ct">By platform</h3>${pl.map(([l, n]) => hbar(l, n, pMax)).join('')}</div>
      <div class="card"><h3 class="ct">Finished per month</h3>${finDated ? perMonth.map(([l, n]) => hbar(l, n, mMax, 'st-finished')).join('') : '<p class="sub">Finished games with a finish date appear here (last 6 months).</p>'}</div>
      ${top.length ? `<div class="card"><h3 class="ct">Top rated</h3>${top.map((g, i) => `<a class="toprow" href="#/game/${encodeURIComponent(g.id)}"><span class="rk">${i + 1}</span><span class="tt">${esc(g.title)}</span><span class="rate-badge">★ ${g.rating}</span></a>`).join('')}</div>` : ''}`
    };
  }

  // ───────────────────────── share card ─────────────────────────
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  function rrect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  function wrapText(x, text, maxW, maxLines) {
    const words = String(text).split(/\s+/), lines = []; let cur = '';
    words.forEach((w) => { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } });
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { lines.length = maxLines; let l = lines[maxLines - 1]; while (l.length > 1 && x.measureText(l + '…').width > maxW) l = l.slice(0, -1); lines[maxLines - 1] = l + '…'; }
    return lines;
  }
  async function makeShareCard(g) {
    const coverImg = await coverImageFor(g);
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    let bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#060a13'); bg.addColorStop(1, '#10224a'); x.fillStyle = bg; x.fillRect(0, 0, W, H);
    const glow = x.createRadialGradient(W - 120, 160, 10, W - 120, 160, 700); glow.addColorStop(0, 'rgba(34,211,238,.32)'); glow.addColorStop(1, 'rgba(34,211,238,0)'); x.fillStyle = glow; x.fillRect(0, 0, W, H);
    const glow2 = x.createRadialGradient(120, H - 100, 10, 120, H - 100, 600); glow2.addColorStop(0, 'rgba(59,130,246,.28)'); glow2.addColorStop(1, 'rgba(59,130,246,0)'); x.fillStyle = glow2; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(34,211,238,.35)'; x.lineWidth = 3; rrect(x, 40, 40, W - 80, H - 80, 48); x.stroke();
    const pad = 100;
    // brand
    const lg = x.createLinearGradient(pad, 100, pad + 56, 170); lg.addColorStop(0, '#22d3ee'); lg.addColorStop(1, '#3b82f6');
    x.fillStyle = lg; x.beginPath(); x.moveTo(pad + 28, 100); x.lineTo(pad + 56, 138); x.lineTo(pad + 28, 176); x.lineTo(pad, 138); x.closePath(); x.fill();
    x.fillStyle = '#8aa0c4'; x.font = `800 38px ${FONT}`; x.textBaseline = 'middle'; if ('letterSpacing' in x) x.letterSpacing = '6px'; x.fillText('SAVE POINT', pad + 84, 140); if ('letterSpacing' in x) x.letterSpacing = '0px';
    // status pill
    const stColors = { want: '#8aa0c4', playing: '#22d3ee', paused: '#fbbf24', finished: '#34d399' };
    const stc = stColors[g.status] || '#8aa0c4', stl = statusLabel(g.status).toUpperCase();
    x.font = `800 34px ${FONT}`; const pw = x.measureText(stl).width + 64;
    x.fillStyle = 'rgba(255,255,255,.06)'; rrect(x, pad, 280, pw, 76, 38); x.fill(); x.strokeStyle = stc; x.lineWidth = 3; x.stroke();
    x.fillStyle = stc; x.fillText(stl, pad + 32, 319);
    // title
    x.fillStyle = '#e8f0ff'; x.textBaseline = 'alphabetic';
    let fs = 112, lines;
    for (; fs >= 64; fs -= 8) { x.font = `800 ${fs}px ${FONT}`; lines = wrapText(x, g.title, W - pad * 2, 4); if (lines.length <= 3 && !/…$/.test(lines[lines.length - 1])) break; }
    x.font = `800 ${fs}px ${FONT}`; lines = wrapText(x, g.title, W - pad * 2, 4);
    let y = 470; lines.forEach((l) => { x.fillText(l, pad, y); y += fs * 1.13; });
    const big = lines.length <= 2, cw = big ? 240 : 210, ch = cw * 4 / 3, cx = W - pad - cw, cy = big ? 620 : 660;
    x.fillStyle = '#22d3ee'; x.font = `700 44px ${FONT}`; x.fillText(g.platform, pad, y + 20); y += 120;
    // rating
    if (g.rating) {
      const rg = x.createLinearGradient(pad, y, pad + 400, y + 300); rg.addColorStop(0, '#fde68a'); rg.addColorStop(1, '#fbbf24');
      const rb = Math.min(940, Math.max(y + 230, 880));
      x.fillStyle = rg; x.font = `900 240px ${FONT}`; x.fillText(String(g.rating), pad - 6, rb);
      const nw = x.measureText(String(g.rating)).width;
      x.fillStyle = '#8aa0c4'; x.font = `800 80px ${FONT}`; x.fillText('/10', pad + nw + 6, rb);
    } else { x.fillStyle = '#8aa0c4'; x.font = `700 56px ${FONT}`; x.fillText('Not rated yet', pad, Math.min(y + 150, 900)); }
    if (coverImg) { x.save(); rrect(x, cx, cy, cw, ch, 22); x.clip(); x.drawImage(coverImg, cx, cy, cw, ch); x.restore(); x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 3; rrect(x, cx, cy, cw, ch, 22); x.stroke(); }
    // progress
    const by = 1030, bw = W - pad * 2;
    x.fillStyle = '#8aa0c4'; x.font = `700 36px ${FONT}`; x.fillText('COMPLETION', pad, by - 28);
    x.textAlign = 'right'; x.fillStyle = '#22d3ee'; x.font = `800 44px ${FONT}`; x.fillText(g.progress + '%', W - pad, by - 24); x.textAlign = 'left';
    x.fillStyle = 'rgba(255,255,255,.08)'; rrect(x, pad, by, bw, 34, 17); x.fill();
    if (g.progress > 0) { const pg = x.createLinearGradient(pad, 0, pad + bw, 0); pg.addColorStop(0, '#22d3ee'); pg.addColorStop(1, '#3b82f6'); x.fillStyle = pg; rrect(x, pad, by, Math.max(34, bw * g.progress / 100), 34, 17); x.fill(); }
    // dates + notes
    const bits = []; if (g.startedAt) bits.push('Started ' + fmtDate(g.startedAt)); if (g.finishedAt) bits.push('Finished ' + fmtDate(g.finishedAt));
    const nn = notesOf(g.id).length; if (nn) bits.push(plural(nn, 'note'));
    const line = bits.join('  ·  '); let lf = 36; x.fillStyle = '#b8c8e6'; for (; lf > 24; lf -= 2) { x.font = `600 ${lf}px ${FONT}`; if (x.measureText(line).width <= bw) break; }
    x.fillText(line, pad, by + 110);
    if (g.fav) { x.fillStyle = '#f472b6'; x.font = `800 44px ${FONT}`; x.textAlign = 'right'; x.fillText('♥ Favorite', W - pad, 140); x.textAlign = 'left'; }
    x.fillStyle = '#5b7099'; x.font = `600 32px ${FONT}`; x.fillText('My gaming journal · Save Point', pad, H - 96);
    return new Promise((res) => { if (c.toBlob) c.toBlob((b) => res(b), 'image/png'); else res(null); });
  }
  async function openShareCard(id) {
    const g = gameById(id); if (!g) return;
    let blob = null; try { blob = await makeShareCard(g); } catch (e) { /* handled below */ }
    if (!blob) return toast('Could not make the card on this browser', true);
    const slug = g.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'game';
    shareState = { blob, name: `save-point-${slug}.png`, title: g.title };
    openSheet(`<h2>Share card</h2><p class="muted small">Tap Share, then choose “Save Image” or send it to a friend.</p>`, '');
    shareUrl = URL.createObjectURL(blob);
    const sh = $('#sheet .sheet'); sh.insertAdjacentHTML('beforeend', `<img class="share-img" src="${shareUrl}" alt="Share card for ${esc(g.title)}"><div class="actions"><button class="btn" data-act="close-sheet">Close</button><button class="btn primary" data-act="do-share-card">${icon('share')}Share</button></div>`);
  }

  // ───────────────────────── year in review ─────────────────────────
  /** Everything for one calendar year, worked out from dates already stored on games and notes. */
  function yearData(y) {
    const ys = String(y), inY = (d) => typeof d === 'string' && d.slice(0, 4) === ys, gs = state.games;
    const finished = gs.filter((g) => g.status === 'finished' && inY(g.finishedAt)).sort((a, b) => (a.finishedAt < b.finishedAt ? -1 : a.finishedAt > b.finishedAt ? 1 : 0));
    const started = gs.filter((g) => inY(g.startedAt)), added = gs.filter((g) => inY(dateStr(new Date(g.createdAt))));
    const notes = state.notes.filter((n) => inY(n.date));
    const mins = new Map(); let minutes = 0;
    gs.forEach((g) => (g.plays || []).forEach((p) => { if (inY(p.d)) { minutes += p.m; mins.set(g.id, (mins.get(g.id) || 0) + p.m); } }));
    const mostPlayed = [...mins.entries()].map(([id, m]) => ({ g: gameById(id), m })).filter((x) => x.g).sort((a, b) => b.m - a.m || a.g.title.localeCompare(b.g.title)).slice(0, 3);
    const rated = finished.filter((g) => g.rating), avg = rated.length ? rated.reduce((a, g) => a + g.rating, 0) / rated.length : 0;
    const top = rated.slice().sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title)).slice(0, 5);
    const perMonth = MONTHS.map((l, i) => [l, finished.filter((g) => +g.finishedAt.slice(5, 7) === i + 1).length]);
    const best = perMonth.reduce((a, b) => (b[1] > a[1] ? b : a), ['', 0]);
    const count = (arr) => { const m = new Map(); arr.forEach((k) => m.set(k, (m.get(k) || 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)); };
    const plats = count(finished.map((g) => g.platform)).slice(0, 4);
    const genres = count([].concat(...finished.map((g) => { const e = catOf(g); return e ? MAIN_GENRES.filter((n) => hasGenre(e, n)).slice(0, 2) : []; }))).slice(0, 4);
    const tags = tagCounts(notes).slice(0, 5);
    return { y, finished, started, added, notes, minutes, mostPlayed, rated, avg, top, perMonth, best, plats, genres, tags, empty: !finished.length && !started.length && !added.length && !notes.length && !minutes };
  }
  function yearsWithData() {
    const set = new Set([new Date().getFullYear()]), add = (d) => { if (typeof d === 'string' && /^\d{4}/.test(d)) set.add(+d.slice(0, 4)); };
    state.games.forEach((g) => { add(g.finishedAt); add(g.startedAt); add(dateStr(new Date(g.createdAt))); (g.plays || []).forEach((p) => add(p.d)); });
    state.notes.forEach((n) => add(n.date));
    return [...set].filter((y) => y >= 1970 && y <= 2100).sort((a, b) => b - a);
  }
  function viewYear(want) {
    const years = yearsWithData(), y = years.includes(want) ? want : years[0], d = yearData(y);
    const chips = years.length > 1 ? `<div class="chips">${years.map((v) => `<a class="chip ${v === y ? 'on' : ''}" href="#/year/${v}">${v}</a>`).join('')}</div>` : '';
    const stat = (n, l, cls) => `<div class="stat ${cls || ''}"><b>${n}</b><span>${l}</span></div>`;
    const hbar = (label, n, max, cls) => `<div class="hb"><span class="hb-l">${esc(label)}</span><div class="hb-t"><i class="${cls || ''}" style="width:${max ? Math.max(n ? 4 : 0, Math.round((n / max) * 100)) : 0}%"></i></div><span class="hb-n">${n}</span></div>`;
    if (d.empty) return { title: y + ' in review', back: '#/stats', fab: null, html: `${chips}${emptyState('stats', 'Nothing in ' + y + ' yet', 'Games you add, start or finish, and notes you write, show up here.')}` };
    const mMax = Math.max(1, ...d.perMonth.map((x) => x[1]));
    const row = (g, i, badge) => `<a class="toprow" href="#/game/${encodeURIComponent(g.id)}"><span class="rk">${i + 1}</span><span class="tt">${esc(g.title)}</span>${badge}</a>`;
    return { title: y + ' in review', back: '#/stats', fab: null, html: `
      ${chips}
      <div class="stats">${stat(d.finished.length, 'Finished', 'good')}${stat(d.started.length, 'Started')}${stat(d.added.length, 'Added', 'accent')}</div>
      <div class="substats">${plural(d.notes.length, 'note')} written${d.minutes ? ` · ${fmtHours(d.minutes)} logged` : ''}${d.rated.length ? ` · avg rating ${d.avg.toFixed(1)}` : ''}</div>
      ${d.finished.length ? `<div class="card"><h3 class="ct">Finished per month</h3>${d.perMonth.map(([l, n]) => hbar(l, n, mMax, 'st-finished')).join('')}${d.best[1] > 1 ? `<p class="sub" style="margin-top:8px">Busiest month: ${esc(d.best[0])} (${d.best[1]} games).</p>` : ''}</div>` : '<div class="card"><p class="sub">No finished games with a finish date in ' + y + ' yet. Mark a game Finished and it shows up here.</p></div>'}
      ${d.top.length ? `<div class="card"><h3 class="ct">Top rated finishes</h3>${d.top.map((g, i) => row(g, i, `<span class="rate-badge">★ ${g.rating}</span>`)).join('')}</div>` : ''}
      ${d.finished.length ? `<div class="card"><h3 class="ct">Everything you finished</h3>${d.finished.map((g, i) => row(g, i, `<span class="muted small">${esc(fmtDate(g.finishedAt))}</span>`)).join('')}</div>` : ''}
      ${d.mostPlayed.length ? `<div class="card"><h3 class="ct">Most played</h3>${d.mostPlayed.map((x, i) => row(x.g, i, `<span class="rate-badge">${fmtHours(x.m)}</span>`)).join('')}<p class="sub" style="margin-top:8px">Counts only hours logged in the app (sessions and added hours).</p></div>` : ''}
      ${d.plats.length || d.genres.length ? `<div class="card"><h3 class="ct">What you finished</h3>${d.plats.length ? `<p class="sub">Platforms: ${d.plats.map(([k, n]) => `${esc(k)} ${n}`).join(' · ')}</p>` : ''}${d.genres.length ? `<p class="sub" style="margin-top:6px">Genres: ${d.genres.map(([k, n]) => `${esc(k)} ${n}`).join(' · ')}</p>` : ''}</div>` : ''}
      ${d.tags.length ? `<div class="card"><h3 class="ct">Most-used note tags</h3><div class="mchips">${d.tags.map(([t, c]) => `<button type="button" class="mchip" data-act="tag-filter" data-t="${esc(t)}">#${esc(t)} ${c}</button>`).join('')}</div></div>` : ''}
      <button class="btn primary block" data-act="year-card" data-y="${y}">${icon('share')}Share ${y} card</button>
      <p class="muted small" style="margin:10px 4px">Built only from dates saved on your games and notes. Games finished without a finish date aren't counted.</p>` };
  }
  async function makeYearCard(d) {
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), pad = 100;
    const bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#060a13'); bg.addColorStop(1, '#10224a'); x.fillStyle = bg; x.fillRect(0, 0, W, H);
    const glow = x.createRadialGradient(W - 120, 160, 10, W - 120, 160, 700); glow.addColorStop(0, 'rgba(34,211,238,.32)'); glow.addColorStop(1, 'rgba(34,211,238,0)'); x.fillStyle = glow; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(34,211,238,.35)'; x.lineWidth = 3; rrect(x, 40, 40, W - 80, H - 80, 48); x.stroke();
    x.textBaseline = 'alphabetic'; x.fillStyle = '#8aa0c4'; x.font = `800 38px ${FONT}`; if ('letterSpacing' in x) x.letterSpacing = '6px'; x.fillText('SAVE POINT', pad, 160); if ('letterSpacing' in x) x.letterSpacing = '0px';
    x.fillStyle = '#e8f0ff'; x.font = `900 150px ${FONT}`; x.fillText(String(d.y), pad, 330);
    x.fillStyle = '#22d3ee'; x.font = `800 52px ${FONT}`; x.fillText('in games', pad, 405);
    const big = [[d.finished.length, 'FINISHED', '#34d399'], [d.started.length, 'STARTED', '#22d3ee'], [d.notes.length, 'NOTES', '#fbbf24']];
    big.forEach(([n, l, col], i) => { const bx = pad + i * 300; x.fillStyle = col; x.font = `900 120px ${FONT}`; x.fillText(String(n), bx, 600); x.fillStyle = '#8aa0c4'; x.font = `800 32px ${FONT}`; x.fillText(l, bx, 650); });
    let y = 760; x.fillStyle = '#8aa0c4'; x.font = `800 34px ${FONT}`;
    const list = d.top.length ? d.top : d.finished.slice(0, 5);
    if (list.length) { x.fillText(d.top.length ? 'TOP RATED' : 'FINISHED', pad, y); y += 30; }
    list.slice(0, 5).forEach((g, i) => {
      y += 78; x.fillStyle = '#5b7099'; x.font = `800 44px ${FONT}`; x.fillText(String(i + 1), pad, y);
      x.fillStyle = '#e8f0ff'; x.font = `700 48px ${FONT}`; const t = wrapText(x, g.title, W - pad * 2 - 230, 1)[0]; x.fillText(t, pad + 70, y);
      if (g.rating) { x.fillStyle = '#fbbf24'; x.textAlign = 'right'; x.font = `800 48px ${FONT}`; x.fillText('★ ' + g.rating, W - pad, y); x.textAlign = 'left'; }
    });
    const bits = []; if (d.minutes) bits.push(fmtHours(d.minutes) + ' logged'); if (d.rated.length) bits.push('avg rating ' + d.avg.toFixed(1));
    if (bits.length) { x.fillStyle = '#b8c8e6'; x.font = `600 38px ${FONT}`; x.fillText(bits.join('  ·  '), pad, 1160); }
    x.fillStyle = '#5b7099'; x.font = `600 32px ${FONT}`; x.fillText('My gaming journal · Save Point', pad, H - 96);
    return new Promise((res) => { if (c.toBlob) c.toBlob((b) => res(b), 'image/png'); else res(null); });
  }
  async function openYearCard(y) {
    let blob = null; try { blob = await makeYearCard(yearData(y)); } catch (e) { /* handled below */ }
    if (!blob) return toast('Could not make the card on this browser', true);
    shareState = { blob, name: `save-point-${y}.png`, title: `My ${y} in games` };
    openSheet(`<h2>${y} card</h2><p class="muted small">Tap Share, then choose “Save Image” or send it to a friend.</p>`, '');
    shareUrl = URL.createObjectURL(blob);
    const sh = $('#sheet .sheet'); sh.insertAdjacentHTML('beforeend', `<img class="share-img" src="${shareUrl}" alt="Your ${y} in games card"><div class="actions"><button class="btn" data-act="close-sheet">Close</button><button class="btn primary" data-act="do-share-card">${icon('share')}Share</button></div>`);
  }
  async function doShareCard() {
    if (!shareState) return; const { blob, name, title } = shareState;
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000); toast('Image saved to your downloads');
  }

  function viewBackup() {
    const m = state.meta, total = state.games.length + state.notes.length;
    const backupLine = m.lastBackupAt ? `<span class="${m.changes ? 'warn' : 'ok'}">${esc(fmtDateTime(m.lastBackupAt))}</span>` : '<span class="warn">Never</span>';
    const modeText = storage.mode === 'indexeddb' ? 'IndexedDB (on this device)' : 'Fallback: localStorage only';
    const saved = storage.lastSavedAt ? `<span class="ok">${esc(fmtDateTime(storage.lastSavedAt))}</span>` : '<span class="muted">No changes saved this session</span>';
    const pers = storage.persisted === true ? '<span class="ok">Yes</span>' : storage.persisted === false ? '<span class="warn">Not guaranteed</span>' : 'Unknown';
    return {
      title: 'Backup', fab: null, html: `
      ${backupNeed() ? `<div class="card attn"><h3 class="ct">${esc(backupNeed().head)}</h3><p class="sub">${esc(backupNeed().text)}</p><button class="btn primary block" data-act="export" style="margin-top:10px">${icon('share')}Back up now</button></div>` : ''}
      <div class="card">
        <h3 class="ct">Back up your journal</h3>
        <p class="sub">Your data exists only on this phone. A backup file is your protection against clearing Safari data, deleting the app, or changing phones.</p>
        <div class="kv"><span>Contents</span><span>${plural(state.games.length, 'game')}, ${plural(state.notes.length, 'note')}${state.matches.length ? ', ' + plural(state.matches.length, 'versus session') : ''}${Object.keys(covers).length ? `, ${plural(Object.keys(covers).length, 'photo')}` : ''}</span></div>
        <div class="kv"><span>Last backup</span><span>${backupLine}${m.lastBackupAt ? ` <span class="muted">(${esc(agoText(m.lastBackupAt))})</span>` : ''}</span></div>
        <div class="kv"><span>Changes since then</span><span class="${m.changes ? 'warn' : ''}">${m.changes}</span></div>
        <div class="stack" style="margin-top:14px">
          <button class="btn primary block" data-act="export" ${total ? '' : 'disabled'}>${icon('share')}Save backup file</button>
          <p class="muted small">On iPhone this opens the share sheet. Choose <b>Save to Files</b> (iCloud Drive keeps it off the phone too). The app can’t see where you saved it, so it marks the backup as done once the share sheet closes without cancelling.</p>
          <label style="display:block;margin-top:10px"><span class="muted small" style="display:block;margin-bottom:4px">Remind me to back up</span>
            <select data-remind="1">${[[7, 'After 1 week with changes'], [14, 'After 2 weeks with changes'], [30, 'After 1 month with changes'], [0, 'Never (only the “no backup yet” notice)']].map(([v, l]) => `<option value="${v}" ${remindDays() === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        </div>
      </div>
      <div class="card">
        <h3 class="ct">Restore from a backup</h3>
        <p class="sub">Pick a Save Point backup file. You can merge it with what’s here or replace everything, and undo either.</p>
        <div class="stack">
          <button class="btn block" data-act="pick-file">${icon('upload')}Import backup file</button>
          <button class="btn block" data-act="check-backup">Check a backup file</button>
          <input id="chkIn" type="file" accept=".json,application/json,text/plain" hidden>
          <input id="fileIn" type="file" accept=".json,application/json,text/plain" hidden>
          <div class="row"><button class="btn sm" data-act="copy-backup" ${total ? '' : 'disabled'}>Copy as text</button><button class="btn sm" data-act="paste-import">Import pasted text</button></div>
          <button class="btn block" data-act="undo" id="undoBtn" hidden>Undo last import / erase</button>
        </div>
      </div>
      <div class="card">
        <h3 class="ct">Storage &amp; offline status</h3>
        <div class="kv"><span>Stored in</span><span>${esc(modeText)}</span></div>
        <div class="kv"><span>Last saved to storage</span>${saved}</div>
        <div class="kv"><span>Storage protected from cleanup</span>${pers}</div>
        <div class="kv"><span>Offline app files</span><span id="offlineStatus" class="muted">Checking…</span></div>
        <button class="btn sm" data-act="check-storage" style="margin:8px 0">Check that my data is saved</button>
        <div class="kv"><span>Running as installed app</span><span>${isStandalone() ? '<span class="ok">Yes</span>' : '<span class="warn">No – open from Home Screen icon</span>'}</span></div>
      </div>
      <div class="card">
        <h3 class="ct">Cover art</h3>
        <div class="kv"><span>Covers saved on this phone</span><span>${cat.size} <span class="muted">(${(cacheBytes() / 1048576).toFixed(1)} MB)</span></span></div>
        <label class="check"><input type="checkbox" data-confirmcovers="1" ${confirmAfterAdd() ? 'checked' : ''}><span>Ask me to confirm covers after adding games<small>Shows the cover Wikipedia has, with a link; it is only saved if you tap Yes.</small></span></label>
        <label class="check"><input type="checkbox" data-autocover="1" ${autoCovers() ? 'checked' : ''}><span>Load cover art automatically<small>Sends game titles to Wikipedia to find covers. Off = generated covers only.</small></span></label>
        <div class="stack" style="margin-top:12px">
          ${missingCover().length ? `<button class="btn primary block" data-act="fix-covers">Fix missing covers (${missingCover().length})</button>` : ''}
          <button class="btn block" data-act="review-covers" ${state.games.some((g) => !covers[g.id]) ? '' : 'disabled'}>Review covers for my games one by one</button>
          <button class="btn block" data-act="cover-job-all">Download covers for the whole game list</button>
          <button class="btn block" data-act="clear-cover-cache" ${cat.size || catMiss.size ? '' : 'disabled'}>Clear cover cache</button>
          <p class="muted small">Covers are fetched once, then work offline. They are not part of backup files (they can be downloaded again); photos you choose yourself are.</p>
        </div>
      </div>
      <div class="card">
        <h3 class="ct">App version &amp; updates</h3>
        <div class="kv"><span>App version</span><span>${esc(APP_VERSION)}</span></div>
        <div class="kv"><span>Built-in game list</span><span>${CATALOG.length} games</span></div>
        <div class="stack" style="margin-top:12px">
          <button class="btn block" data-act="check-update">Check for update</button>
          <p class="muted small">When you upload new files to GitHub, wait 2–3 minutes, then tap this while online. Your journal is never touched by an update.</p>
          <button class="btn block" data-act="force-refresh">Force refresh app files</button>
          <p class="muted small">Only if the check keeps saying you’re up to date but you know there’s a newer version. Re-downloads the app’s files; your journal stays.</p>
        </div>
      </div>
      <div class="card">
        <h3 class="ct">Danger zone</h3>
        <p class="sub">Erase every game and note on this device. Export a backup first. (An undo copy is kept until the next import or erase.)</p>
        <button class="btn danger block" data-act="erase">Erase all journal data</button>
      </div>
      <p class="muted small" style="text-align:center;margin:8px 0 0">Save Point · data never leaves this device unless you export it.<br>Backup files are plain text, not encrypted.</p>`
    };
  }
  const isStandalone = () => window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);

  async function afterBackupView() {
    const rec = await readUndo(); const b = $('#undoBtn'); if (b && rec) { b.hidden = false; b.textContent = `Undo last ${rec.label.split(' ')[0]} (${fmtDateTime(rec.at)})`; }
    const o = $('#offlineStatus'); if (!o) return;
    try {
      if (!('serviceWorker' in navigator) || !window.caches) { o.textContent = 'Not supported here'; o.className = 'bad'; return; }
      const hit = await caches.match('./index.html');
      const ctl = !!navigator.serviceWorker.controller;
      if (hit && ctl) { o.textContent = 'Cached – app opens offline'; o.className = 'ok'; }
      else if (hit) { o.textContent = 'Cached – reopen the app once to activate'; o.className = 'warn'; }
      else { o.textContent = 'Not cached yet – open once while online'; o.className = 'warn'; }
    } catch (e) { o.textContent = 'Unknown'; }
  }

  // ───────────────────────── rendering ─────────────────────────
  let lastRouteKey = null;
  function render() {
    const r = route();
    let v;
    if (r.name === 'game') v = viewGame(r.id); else if (r.name === 'year') v = viewYear(r.year); else if (r.name === 'versus') v = r.id ? viewMatch(r.id) : viewVersus(); else v = { home: viewHome, library: viewLibrary, stats: viewStats, journal: viewJournal, backup: viewBackup }[r.name]();
    $('#title').innerHTML = v.title;
    tintOwner = v.tint ? v.tint.id : null; applyTint(v.tint || null);
    const back = $('#backBtn');
    if (v.back) { back.hidden = false; back.innerHTML = icon('back'); back.dataset.href = v.back; } else back.hidden = true;
    $('#view').innerHTML = v.html;
    const fab = $('#fab');
    if (v.fab) { fab.hidden = false; fab.innerHTML = `${icon('plus')}${esc(v.fab.label)}`; fab.dataset.act = v.fab.act; fab.dataset.id = v.fab.id || ''; } else fab.hidden = true;
    $('#tabs').innerHTML = `<div class="inner">${[['home', 'Home', '#/'], ['library', 'Library', '#/library'], ['stats', 'Stats', '#/stats'], ['journal', 'Journal', '#/journal'], ['backup', 'Backup', '#/backup']]
      .map(([k, l, h]) => `<a href="${h}" class="${(r.name === k || (r.name === 'game' && k === 'library') || (r.name === 'year' && k === 'stats') || (r.name === 'versus' && k === 'home')) ? 'active' : ''}" ${r.name === k ? 'aria-current="page"' : ''}>${icon(k === 'home' ? 'home' : k)}${k === 'backup' && backupNeed() ? '<i class="tab-dot" role="img" aria-label="Backup needed"></i>' : ''}${l}</a>`).join('')}</div>`;
    if (r.key !== lastRouteKey) { window.scrollTo(0, 0); lastRouteKey = r.key; }
    if (r.name === 'backup') afterBackupView();
  }
  function renderBanners() {
    const el = $('#banners'); const out = [];
    if (storage.mode !== 'indexeddb') out.push(`<div class="banner err"><p><b>Storage warning:</b> this browser blocked IndexedDB, so Save Point is using a smaller fallback. Export backups often.</p></div>`);
    if (ui.updated) out.unshift(`<div class="banner"><p><b>Save Point was updated.</b> Reload to use the new version.</p><button class="btn sm" data-act="reload">Reload</button></div>`);
    el.innerHTML = out.join('');
  }

  // ───────────────────────── forms ─────────────────────────
  function gameForm(g, prefill) {
    const isEdit = !!g; g = g || { title: prefill || '', platform: multi.pref || 'PS5', status: 'want', progress: 0, rating: 0 };
    const known = PLATFORMS.includes(g.platform) && g.platform !== 'Other';
    const sel = known ? g.platform : 'Other';
    const radios = (name, items, cur) => `<div class="opts">${items.map((i) => `<label><input type="radio" name="${name}" value="${esc(i.id)}" ${cur === i.id ? 'checked' : ''}><span>${esc(i.label)}</span></label>`).join('')}</div>`;
    const sh = openSheet(`<h2>${isEdit ? 'Edit game' : 'Add game'}</h2>
      <form id="gameForm" autocomplete="off">
        <label class="f" for="gTitle">TITLE</label>
        <input id="gTitle" name="title" type="text" required maxlength="200" value="${esc(g.title)}" placeholder="Type to search popular games…" autocapitalize="words" enterkeyhint="done">
        <div id="sugg" class="sugg"></div>
        <label class="f">PLATFORM</label>
        ${radios('platform', PLATFORMS.map((p) => ({ id: p, label: p })), sel)}
        <input id="gOther" name="other" type="text" maxlength="40" placeholder="Which platform?" value="${known ? '' : esc(g.platform === 'Other' ? '' : g.platform)}" style="margin-top:10px" ${sel === 'Other' ? '' : 'hidden'}>
        <label class="f">STATUS</label>
        ${radios('status', STATUSES, g.status)}
 <label class="f">YOUR RATING (OPTIONAL)</label>
        <div class="opts rates">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => `<label><input type="radio" name="rating" value="${v}" ${(g.rating || 0) === v ? 'checked' : ''}><span>${v === 0 ? 'None' : v}</span></label>`).join('')}</div>
        <label class="f" for="gProg">COMPLETION</label>
        <div class="range-row"><input id="gProg" name="progress" type="range" min="0" max="100" step="1" value="${g.progress}"><output id="gProgOut">${g.progress}%</output></div>
        <div class="actions"><button type="button" class="btn" data-act="close-sheet">Cancel</button><button type="submit" class="btn primary">${isEdit ? 'Save' : 'Add game'}</button></div>
      </form>`);
    const form = $('#gameForm', sh), F = form.elements;
    form.addEventListener('input', (e) => {
      if (e.target.name === 'title') showSuggestions(form);
      if (e.target.name === 'progress') $('#gProgOut', sh).textContent = e.target.value + '%';
      if (e.target.name === 'platform') $('#gOther', sh).hidden = e.target.value !== 'Other';
    });
    form.addEventListener('change', (e) => {
      if (e.target.name === 'status' && e.target.value === 'finished') { F.progress.value = 100; $('#gProgOut', sh).textContent = '100%'; }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = F.title.value.trim(); if (!title) return F.title.focus();
      let platform = F.platform.value; if (platform === 'Other') platform = F.other.value.trim() || 'Other';
      const status = F.status.value, progress = +F.progress.value, rating = +F.rating.value || 0;
      closeSheet();
      if (isEdit) mutate((s) => { const x = gameById2(s, g.id); Object.assign(x, { title, platform, progress, rating, updatedAt: Date.now() }); if (x.status !== status) { applyStatus(x, status); x.progress = progress; if (status === 'finished') x.progress = 100; } }, 'Game updated');
      else { const ng = newGame({ title, platform, status, progress, rating }); if (status === 'finished') ng.progress = 100; mutate((s) => { s.games.push(ng); }, 'Game added').then(() => { location.hash = '#/game/' + encodeURIComponent(ng.id); }); }
    });
    if (!isEdit) setTimeout(() => F.title.focus(), 300);
  }
  const gameById2 = (s, id) => s.games.find((x) => x.id === id);


  // ───────────────────────── add many games at once ─────────────────────────
  const multi = { q: '', mode: 'new', sel: new Map(), shown: 60, pref: lsGet(LS_PREF) || '', status: 'want' };
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
  function multiEntries() {
    if (normKey(multi.q).length >= 2) return searchCatalog(multi.q, 500, true);
    const byTitle = (a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
    if (multi.mode === 'az') return CATALOG.slice().sort(byTitle);
    let list = CATALOG.filter((g) => g.date);
    if (multi.mode === 'upcoming') return list.filter((g) => relInfo(g).upcoming).sort((a, b) => relInfo(a).sort - relInfo(b).sort || byTitle(a, b));
    return list.sort((a, b) => relInfo(b).sort - relInfo(a).sort || byTitle(a, b));
  }
  function pickRows() {
    const all = multiEntries(), lib = new Set(state.games.map((g) => normKey(g.title))), slice = all.slice(0, multi.shown);
    const searching = normKey(multi.q).length >= 2;
    let html = slice.map((g) => {
      const on = multi.sel.has(g.key), inLib = lib.has(g.key), r = relInfo(g);
      const meta = [g.plats.join(' · '), r.label, r.upcoming && r.count].filter(Boolean).join(' · '), meta2 = [g.tags.slice(0, 3).join(', '), g.studios[0]].filter(Boolean).join(' · ');
      return `<button type="button" class="pick ${on ? 'on' : ''}" data-act="toggle-pick" data-k="${esc(g.key)}" ${inLib ? 'disabled' : ''} aria-pressed="${on}"><span class="tick">${CHECK}</span><span class="gc-cover xs" data-ck="${esc(g.key)}">${thumbFor(g.title)}</span><span class="pk-main"><b>${esc(g.title)}</b><small>${esc(meta) || '&nbsp;'}</small>${meta2 ? `<small class="pk-tags">${esc(meta2)}</small>` : ''}</span>${inLib ? '<em>In library</em>' : r.upcoming ? '<em class="soon">Soon</em>' : ''}</button>`;
    }).join('');
    if (all.length > slice.length) html += `<button type="button" class="btn block" data-act="pick-more" style="margin:8px 0">Show more (${all.length - slice.length} left)</button>`;
    if (!all.length) html += `<p class="muted pick-none">${searching ? 'No match in the built-in list.' : 'Nothing here yet.'}</p>`;
    html += `<button type="button" class="pick-custom" data-act="add-custom">${searching ? `Add “${esc(multi.q.trim())}” myself` : 'Can’t find it? Add a game myself'}</button>`;
    return html;
  }
  const PICK_STUDIOS = ['EA', 'Nintendo', 'Sony', 'Xbox', 'Ubisoft', 'Capcom', 'Square Enix', 'Bandai Namco', 'Rockstar', 'FromSoftware', 'Konami', 'Sega', 'Activision', 'Bethesda', 'Take-Two'];
  const pickStudioChips = () => PICK_STUDIOS.map((v) => `<button type="button" class="chip studio ${multi.q.trim().toLowerCase() === v.toLowerCase() ? 'on' : ''}" data-act="pick-genre" data-v="${esc(v)}">${esc(v)}</button>`).join('');
  const pickGenreChips = () => PICK_GENRES.map((v) => `<button type="button" class="chip ${multi.q.trim().toLowerCase() === v.toLowerCase() ? 'on' : ''}" data-act="pick-genre" data-v="${esc(v)}">${esc(v)}</button>`).join('');
  function pickChips() {
    const searching = normKey(multi.q).length >= 2;
    if (searching) return `<span class="muted small" style="padding:0 2px">${plural(multiEntries().length, 'result')}</span>`;
    return [['new', 'New & upcoming'], ['upcoming', 'Only upcoming'], ['az', 'A–Z']].map(([id, l]) => `<button type="button" class="chip ${multi.mode === id ? 'on' : ''}" data-act="pick-mode" data-v="${id}">${l}</button>`).join('');
  }
  function pickFoot() {
    const n = multi.sel.size, b = $('#pickGo'); if (!b) return;
    b.disabled = !n; b.textContent = n ? `Add ${plural(n, 'game')}` : 'Tap games to select them';
  }
  function refreshMulti(keepScroll) {
    const list = $('#pickList'); if (!list) return;
    const top = list.scrollTop;
    list.innerHTML = pickRows(); list.scrollTop = keepScroll ? top : 0;
    $('#pickChips').innerHTML = pickChips(); const gc = $('#pickGenres'); if (gc) gc.innerHTML = pickGenreChips(); const sc = $('#pickStudios'); if (sc) sc.innerHTML = pickStudioChips(); pickFoot();
    enqueueCovers(multiEntries().slice(0, multi.shown).map((g) => entryOf(g.title, g.date)));
  }
  function multiAdd() {
    multi.q = ''; multi.mode = 'new'; multi.sel = new Map(); multi.shown = 60;
    openSheet(`<div class="pk-head"><h2>Add games</h2><button type="button" class="btn sm" data-act="add-custom">Type my own</button></div>
      <input id="pickQ" type="search" placeholder="Search games, genres or studios…" data-multiq="1" aria-label="Search games, genres or studios" enterkeyhint="search" autocomplete="off" autocapitalize="off">
      <div class="chips" id="pickGenres" style="margin-top:8px"></div>
      <div class="chips" id="pickStudios" aria-label="Studios and publishers"></div>
      <div class="chips" id="pickChips"></div>
      <div id="pickList" class="pick-list"></div>
      <div class="pick-foot">
        <div class="pf-row">
          <label>Platform<select id="pickPlat" data-pickopt="plat"><option value="">Best match</option>${PLATFORMS.filter((p) => p !== 'Other').map((p) => `<option ${multi.pref === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
          <label>Add as<select id="pickStatus" data-pickopt="status">${STATUSES.map((s) => `<option value="${s.id}" ${multi.status === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}<option value="queue" ${multi.status === 'queue' ? 'selected' : ''}>Up next</option></select></label>
        </div>
        <button id="pickGo" type="button" class="btn primary block" data-act="add-picked" disabled>Tap games to select them</button>
      </div>`, 'tall');
    refreshMulti();
  }
  const pickPlatform = (e) => (multi.pref && e.plats.includes(multi.pref) ? multi.pref : e.plats[0] || 'Other');
  async function addPicked() {
    const picks = [...multi.sel.values()]; if (!picks.length) return;
    const now = Date.now(), status = multi.status;
    const asQueue = status === 'queue';
    const games = picks.map((e, i) => { const g = newGame({ title: e.title, platform: pickPlatform(e), status: asQueue ? 'want' : status }); if (asQueue) g.queue = now + i; return g; });
    closeSheet();
    ui.libStatus = 'all'; ui.libQ = ''; ui.libPlat = 'all'; ui.libSort = 'recent';
    await mutate((s) => { games.forEach((g) => s.games.push(g)); }, `Added ${plural(games.length, 'game')}`);
    multi.sel = new Map();
    enqueueCovers(libraryCoverEntries());
    location.hash = '#/library';
    if (confirmAfterAdd() && db && navigator.onLine !== false) { await sleep(150); if (!$('#sheet')) startReview(games.map(rvItem)); }
  }

  function noteForm(gameId, note) {
    const isEdit = !!note;
    const draftKey = LS_DRAFT + gameId;
    let draft = null; if (!isEdit) { const t = lsGet(draftKey); if (t) { try { draft = JSON.parse(t); } catch (e) { /* ignore */ } } }
    const n = note || draft || { type: 'general', date: todayStr(), title: '', body: '' };
    const g = gameById(gameId);
    const sh = openSheet(`<h2>${isEdit ? 'Edit note' : 'New note'}</h2><p class="muted small">${esc(g ? g.title : '')}</p>
      <form id="noteForm" autocomplete="off">
        <label class="f">TYPE</label>
        <div class="opts">${NOTE_TYPES.map((t) => `<label><input type="radio" name="type" value="${t.id}" ${n.type === t.id ? 'checked' : ''}><span>${t.label}</span></label>`).join('')}</div>
        <label class="f" for="nDate">DATE</label>
        <input id="nDate" name="date" type="date" required value="${esc(n.date || todayStr())}">
        <label class="f" for="nTitle">TITLE (OPTIONAL)</label>
        <input id="nTitle" name="title" type="text" maxlength="200" value="${esc(n.title || '')}" placeholder="e.g. Safe in the basement">
        <label class="f" for="nTags">TAGS (OPTIONAL, SEPARATED BY COMMAS)</label>
        <input id="nTags" name="tags" type="text" maxlength="200" value="${esc((n.tags || []).join(', '))}" placeholder="e.g. boss, missable, secret" autocapitalize="none" autocorrect="off">
        ${tagCounts().length ? `<div class="mchips tagsugg">${tagCounts().slice(0, 8).map(([t]) => `<button type="button" class="mchip" data-act="tag-add" data-t="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}
        <label class="f" for="nBody">NOTE</label>
        <textarea id="nBody" name="body" maxlength="200000" placeholder="What do you want to remember?">${esc(n.body || '')}</textarea>
        ${draft ? '<p class="draft-note">Restored your unsaved draft.</p>' : ''}
        <div class="actions"><button type="button" class="btn" data-act="close-sheet">Cancel</button><button type="submit" class="btn primary">Save note</button></div>
      </form>`);
    const form = $('#noteForm', sh), F = form.elements;
    if (!isEdit) form.addEventListener('input', () => { lsSet(draftKey, JSON.stringify({ type: F.type.value, date: F.date.value, title: F.title.value, tags: parseTags(F.tags.value), body: F.body.value })); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const type = F.type.value, date = F.date.value || todayStr(), title = F.title.value.trim(), body = F.body.value, tags = parseTags(F.tags.value);
      if (!title && !body.trim()) { F.body.focus(); return toast('Write something first'); }
      closeSheet();
      if (isEdit) mutate((s) => { const x = s.notes.find((q) => q.id === note.id); Object.assign(x, { type, date, title, body, tags, updatedAt: Date.now() }); gameById2(s, gameId).updatedAt = Date.now(); }, 'Note updated');
      else mutate((s) => { s.notes.push({ id: uid(), gameId, type, date, title, body, tags, createdAt: Date.now(), updatedAt: Date.now() }); gameById2(s, gameId).updatedAt = Date.now(); }, 'Note saved').then(() => { if (storage.idbOk || storage.lsOk) lsDel(draftKey); });
    });
    if (!isEdit && !draft) setTimeout(() => F.body.focus(), 300);
  }

  // ───────────────────────── events ─────────────────────────
  const actions = {
    'close-sheet': () => closeSheet(),
    'add-game': () => multiAdd(),
    'add-custom': () => { const q = multi.q.trim(); closeSheet(); gameForm(null, q); },
    'toggle-pick': (t) => {
      const e = CATALOG_BY_KEY.get(t.dataset.k); if (!e) return;
      if (multi.sel.has(e.key)) multi.sel.delete(e.key); else multi.sel.set(e.key, e);
      t.classList.toggle('on', multi.sel.has(e.key)); t.setAttribute('aria-pressed', multi.sel.has(e.key)); pickFoot();
    },
    'pick-more': () => { multi.shown += 80; refreshMulti(true); },
    'pick-genre': (t) => { const v = t.dataset.v, inp = $('#pickQ'); multi.q = multi.q.trim().toLowerCase() === v.toLowerCase() ? '' : v; if (inp) inp.value = multi.q; multi.shown = 60; refreshMulti(); },
    'search-lib': (t) => { ui.libQ = t.dataset.q || ''; ui.libStatus = 'all'; ui.libPlat = 'all'; ui.libGenre = 'all'; ui.libStudio = 'all'; location.hash = '#/library'; },
    'pick-mode': (t) => { multi.mode = t.dataset.v; multi.shown = 60; refreshMulti(); },
    'add-picked': () => addPicked(),
    'set-rating': (t) => { const id = t.dataset.id, v = +t.dataset.v; mutate((s) => { const g = gameById2(s, id); g.rating = g.rating === v ? 0 : v; g.updatedAt = Date.now(); }); },
    'toggle-fav': (t) => { const id = t.dataset.id; mutate((s) => { const g = gameById2(s, id); g.fav = !g.fav; g.updatedAt = Date.now(); }); },
    'toggle-queue': (t) => { const id = t.dataset.id; mutate((s) => { const g = gameById2(s, id); g.queue = g.queue ? 0 : Date.now(); g.updatedAt = Date.now(); }, null); },
    'set-progress': (t) => { const id = t.dataset.id, v = +t.dataset.v; mutate((s) => { const g = gameById2(s, id); g.progress = v; if (v > 0 && g.status === 'want') applyStatus(g, 'playing'); g.updatedAt = Date.now(); }, v > 0 && (gameById(id) || {}).status === 'want' ? 'Moved to Playing' : null); },
    'random-game': () => openRandom(),
    'rnd-again': () => showRandom(true),
    'rnd-mode': (t) => { rnd.mode = t.dataset.v; rnd.plat = 'all'; rnd.genre = 'all'; rnd.seen = []; showRandom(true); },
    'rnd-add': (t) => rndAdd(t.dataset.k, t.dataset.as),
    'rnd-open': (t) => { closeSheet(); location.hash = '#/game/' + encodeURIComponent(t.dataset.id); },
    'rnd-start': (t) => { const id = t.dataset.id; closeSheet(); mutate((s) => { applyStatus(gameById2(s, id), 'playing'); }, 'Started – have fun!'); location.hash = '#/game/' + encodeURIComponent(id); },
    'start-session': (t) => { const id = t.dataset.id; if (state.games.some((x) => x.sessionAt && x.id !== id)) return toast('Another game already has a session running. End it first.', true); mutate((s) => { const g = gameById2(s, id); if (g.status !== 'playing' && g.status !== 'finished') applyStatus(g, 'playing'); g.sessionAt = Date.now(); g.updatedAt = Date.now(); }, 'Session started – have fun!'); },
    'end-session': (t) => { const id = t.dataset.id, g0 = gameById(id), raw = g0 ? sessionMin(g0) : 0, m = Math.min(MAX_SESSION_MIN, raw); mutate((s) => { const g = gameById2(s, id); g.sessionAt = 0; if (m >= 1) addPlay(g, m); g.updatedAt = Date.now(); }, m >= 1 ? `Added ${fmtHours(m)}${raw > MAX_SESSION_MIN ? ' (capped at 12 h – use Edit total if needed)' : ''}` : 'Session was under a minute, nothing added'); },
    'cancel-session': (t) => { const id = t.dataset.id; mutate((s) => { const g = gameById2(s, id); g.sessionAt = 0; g.updatedAt = Date.now(); }, 'Session discarded'); },
    'add-hours': (t) => { const id = t.dataset.id; openSheet(`<h2>Add hours played</h2><p class="muted small" style="margin:6px 0">How long did you play? Use hours, like 1.5 for an hour and a half.</p>
      <input id="hrIn" type="number" inputmode="decimal" min="0" max="24" step="0.25" placeholder="Hours, e.g. 2" aria-label="Hours played">
      <div class="chips" style="margin-top:10px">${[0.5, 1, 2, 3].map((v) => `<button class="chip" data-act="hr-fill" data-v="${v}">${v} h</button>`).join('')}</div>
      <div class="actions"><button class="btn" data-act="close-sheet">Cancel</button><button class="btn primary" data-act="do-add-hours" data-id="${esc(id)}">Add</button></div>`); const i = $('#hrIn'); if (i) i.focus(); },
    'hr-fill': (t) => { const i = $('#hrIn'); if (i) i.value = t.dataset.v; },
    'do-add-hours': (t) => { const id = t.dataset.id, h = parseFloat(($('#hrIn') || {}).value), m = Math.round(h * 60); if (!(h > 0) || m < 1) return toast('Enter the hours you played, like 1.5', true); if (h > 24) return toast('Add up to 24 hours at a time', true); closeSheet(); mutate((s) => { const g = gameById2(s, id); addPlay(g, m); if (g.status === 'want') applyStatus(g, 'playing'); }, `Added ${fmtHours(m)}`); },
    'edit-hours': (t) => { const g = gameById(t.dataset.id); if (!g) return; openSheet(`<h2>Edit total hours</h2><p class="muted small" style="margin:6px 0">Set the total for ${esc(g.title)} in hours. This fixes the total only; the weekly chart keeps what was logged.</p>
      <input id="hrIn" type="number" inputmode="decimal" min="0" max="10000" step="0.1" value="${Math.round((g.played / 60) * 100) / 100}" aria-label="Total hours played">
      <div class="actions"><button class="btn" data-act="close-sheet">Cancel</button><button class="btn primary" data-act="do-edit-hours" data-id="${esc(g.id)}">Save</button></div>`); },
    'do-edit-hours': (t) => { const id = t.dataset.id, h = parseFloat(($('#hrIn') || {}).value); if (!(h >= 0) || h > 10000) return toast('Enter a number of hours, like 12.5', true); closeSheet(); mutate((s) => { const g = gameById2(s, id); g.played = Math.round(h * 60); g.updatedAt = Date.now(); }, 'Total hours updated'); },
    'start-game': (t) => { const id = t.dataset.id; mutate((s) => { applyStatus(gameById2(s, id), 'playing'); }, 'Started – have fun!'); },
    'open-queue': () => { ui.libStatus = 'queue'; },
    'open-soon': () => { ui.libStatus = 'soon'; },
    'clear-date': (t) => { const id = t.dataset.id, k = t.dataset.k; mutate((s) => { const g = gameById2(s, id); g[k] = ''; g.updatedAt = Date.now(); }); },
    'share-card': (t) => openShareCard(t.dataset.id),
    'year-card': (t) => openYearCard(+t.dataset.y),
    'do-share-card': () => doShareCard(),
    'find-cover': (t) => { const g = gameById(t.dataset.id); if (g) startReview([rvItem(g)]); },
    'fix-covers': () => startFixJob(),
    'fix-review': () => startReview(missingCover().map(rvItem)),
    'review-covers': () => startReview(state.games.filter((g) => !covers[g.id]).map(rvItem)),
    'rv-yes': () => rvYes(),
    'rv-next': async () => { const it = rv.items[rv.i], st = it && (await rvLoad(it)); if (st && st.ci + 1 < st.list.length) { st.ci++; showReview(); } },
    'rv-skip': () => { rv.i++; showReview(); },
    'rv-photo': () => { const f = $('#rvFile'); if (f) f.click(); },
    'fetch-all-covers': () => startCoverJob('library'),
    'cover-job-all': () => startCoverJob('all'),
    'stop-cover-job': () => { covq.cancel = true; const b = $('#cstop'); if (b) b.textContent = 'Stopping…'; },
    'clear-cover-cache': () => clearCoverCache(),
    'pick-cover': () => { const f = $('#coverIn'); if (f) f.click(); },
    'clear-cover': (t) => clearCover(t.dataset.id),
    'check-update': () => checkUpdate(),
    'force-refresh': () => forceRefreshFiles(),
    'reload': () => location.reload(),
    'pick-sugg': (t) => {
      const form = $('#gameForm'); if (!form) return; const F = form.elements;
      F.title.value = t.dataset.t; $('#sugg').innerHTML = '';
      const plats = (t.dataset.p || '').split(',').filter(Boolean);
      if (plats.length) {
        const cur = F.platform.value;
        const pick = plats.includes(cur) && cur !== 'Other' ? cur : plats[0];
        const r = [...F.platform].find((x) => x.value === pick); if (r) { r.checked = true; $('#gOther').hidden = true; }
      }
    },
    'edit-game': (t) => gameForm(gameById(t.dataset.id)),
    'del-game': async (t) => {
      const g = gameById(t.dataset.id); if (!g) return; const n = notesOf(g.id).length;
      if (await confirmBox({ title: `Delete “${g.title}”?`, message: n ? `This also deletes its ${plural(n, 'note')}. You can’t undo this unless you have a backup.` : 'This can’t be undone unless you have a backup.', okLabel: 'Delete', danger: true })) {
        location.hash = '#/library'; if (covers[g.id]) { delete covers[g.id]; saveCovers(); } await mutate((s) => { s.games = s.games.filter((x) => x.id !== g.id); s.notes = s.notes.filter((x) => x.gameId !== g.id); (s.matches || []).forEach((x) => { if (x.gameId === g.id) x.gameId = ''; }); }, 'Game deleted');
      }
    },
    'add-note': (t) => noteForm(t.dataset.id),
    'edit-note': (t) => { const n = state.notes.find((x) => x.id === t.dataset.id); if (n) noteForm(n.gameId, n); },
    'del-note': async (t) => { const id = t.dataset.id; if (await confirmBox({ title: 'Delete this note?', message: 'This can’t be undone unless you have a backup.', okLabel: 'Delete', danger: true })) mutate((s) => { s.notes = s.notes.filter((x) => x.id !== id); }, 'Note deleted'); },
    'copy-note': async (t) => { const n = state.notes.find((x) => x.id === t.dataset.id); if (!n) return; try { await navigator.clipboard.writeText(n.body); toast('Copied'); } catch (e) { toast('Copy was blocked by the browser', true); } },
    'quick-status': (t) => { const id = t.dataset.id, v = t.dataset.v; mutate((s) => { applyStatus(gameById2(s, id), v); }); },
    'versus-start': (t) => startVersus(t.dataset.id || ''),
    'vs-add-round': (t) => roundForm(t.dataset.id),
    'vs-win': (t) => quickRound(t.dataset.id, { winner: (matchById(t.dataset.id) || { players: [] }).players[+t.dataset.i] }, (m, r) => { const s = matchStats(m), w = r.winner; return m.players.length === 2 ? `${w} +1 · ${m.players[0]} ${s.wins[m.players[0]] + (w === m.players[0] ? 1 : 0)}–${s.wins[m.players[1]] + (w === m.players[1] ? 1 : 0)} ${m.players[1]}` : `${w} +1`; }),
    'vs-draw': (t) => quickRound(t.dataset.id, { draw: true }, 'Draw logged'),
    'vs-res': (t) => quickRound(t.dataset.id, { res: t.dataset.v }, t.dataset.v === 'win' ? 'Win logged 🎉' : 'Loss logged'),
    'vs-undo': (t) => { const id = t.dataset.id; if (!(matchById(id) || { rounds: [] }).rounds.length) return; mutate((st) => { const x = st.matches.find((q) => q.id === id); if (x) x.rounds.pop(); }, 'Last result undone'); },
    'vs-share': (t) => shareMatch(t.dataset.id),
    'vs-player': (t) => playerSheet(t.dataset.n),
    'vs-forget': (t) => { const n = t.dataset.n; mutate((st) => { st.roster = st.roster.filter((x) => x !== n); }, n + ' removed from saved players'); },
    'vs-edit-round': (t) => roundForm(t.dataset.id, t.dataset.r),
    'vs-del-round': async (t) => { const id = t.dataset.id, rid = t.dataset.r; if (await confirmBox({ title: 'Delete this game result?', message: 'The scoreboard will update.', okLabel: 'Delete', danger: true })) mutate((st) => { const x = st.matches.find((q) => q.id === id); if (x) x.rounds = x.rounds.filter((r) => r.id !== rid); }, 'Result deleted'); },
    'vs-end': (t) => { const m = matchById(t.dataset.id); if (m) endSheet(m); },
    'vs-resume': (t) => { const id = t.dataset.id; mutate((st) => { const x = st.matches.find((q) => q.id === id); if (x) x.endedAt = 0; }, 'Session resumed'); },
    'vs-add-player': (t) => { const m = matchById(t.dataset.id); if (m) playerForm(m); },
    'vs-del': async (t) => { const id = t.dataset.id; if (await confirmBox({ title: 'Delete this session?', message: 'All its results are removed. Hours already added to the game stay.', okLabel: 'Delete', danger: true })) { location.hash = '#/versus'; mutate((st) => { st.matches = st.matches.filter((q) => q.id !== id); }, 'Session deleted'); } },
    'toggle-acc': (t) => { ui.acc[t.dataset.k] = !ui.acc[t.dataset.k]; render(); },
    'edit-leftoff': (t) => {
      const id = t.dataset.id, g = gameById(id); if (!g) return;
      const sh = openSheet(`<h2>Where I left off</h2><p class="muted small">${esc(g.title)}</p>
        <form id="loForm" autocomplete="off"><label class="f" for="loIn">A short reminder for next time</label>
        <textarea id="loIn" name="lo" maxlength="280" style="min-height:110px" placeholder="e.g. Chapter 4, before the tower boss">${esc(g.leftOff || '')}</textarea>
        <div class="actions"><button type="button" class="btn" data-act="close-sheet">Cancel</button>${g.leftOff ? '<button type="button" class="btn danger" data-act="clear-leftoff" data-id="' + esc(id) + '">Clear</button>' : ''}<button type="submit" class="btn primary">Save</button></div></form>`);
      $('#loForm', sh).addEventListener('submit', (e) => { e.preventDefault(); const v = $('#loIn', sh).value.trim().slice(0, 280); closeSheet(); mutate((st) => { const x = gameById2(st, id); x.leftOff = v; x.updatedAt = Date.now(); }, v ? 'Saved' : 'Cleared'); });
      setTimeout(() => { const f = $('#loIn', sh); if (f) f.focus(); }, 300);
    },
    'clear-leftoff': (t) => { const id = t.dataset.id; closeSheet(); mutate((st) => { const x = gameById2(st, id); x.leftOff = ''; x.updatedAt = Date.now(); }, 'Cleared'); },
    'lib-view': (t) => { ui.libView = t.dataset.v === 'grid' ? 'grid' : 'list'; lsSet(LS_LIBVIEW, ui.libView); render(); },
    'toggle-filters': () => { ui.libFilters = !ui.libFilters; render(); },
    'set-ui': (t) => { ui[t.dataset.k] = t.dataset.v; render(); },
    'tag-filter': (t) => { const on = t.dataset.off === '1'; ui.jTag = on ? '' : t.dataset.t; ui.jQ = ''; ui.jType = 'all'; if (route().name === 'journal') render(); else location.hash = '#/journal'; },
    'tag-add': (t) => { const f = $('#nTags'); if (!f) return; const cur = parseTags(f.value); if (!cur.includes(t.dataset.t)) cur.push(t.dataset.t); f.value = cur.join(', '); f.dispatchEvent(new Event('input', { bubbles: true })); },
    'export': () => exportBackup(),
    'copy-backup': () => copyBackup(),
    'check-storage': () => checkStorage(),
    'start-fresh': () => { lsSet(LS_HAD, '0'); render(); },
    'check-backup': () => { const f = $('#chkIn'); if (f) f.click(); },
    'pick-file': () => { const f = $('#fileIn'); if (f) f.click(); },
    'paste-import': () => {
      const sh = openSheet(`<h2>Import pasted backup</h2><p class="muted small">Paste the full text you copied with “Copy as text”.</p>
        <textarea id="pasteBox" placeholder="{ &quot;app&quot;: &quot;save-point&quot; … }" style="margin-top:12px"></textarea>
        <div class="actions"><button class="btn" data-act="close-sheet">Cancel</button><button class="btn primary" data-act="paste-go">Continue</button></div>`);
      setTimeout(() => $('#pasteBox', sh).focus(), 300);
    },
    'paste-go': () => { const v = $('#pasteBox').value; try { const p = parseBackup(v); showImport(p); } catch (e) { toast(e.message, true); } },
    'do-import': (t) => applyImport(t.dataset.mode),
    'undo': () => undoLast(),
    'erase': async () => {
      if (!(await confirmBox({ title: 'Erase everything?', message: `This deletes ${plural(state.games.length, 'game')} and ${plural(state.notes.length, 'note')} from this device. Make sure you have a backup.`, okLabel: 'Erase all', danger: true }))) return;
      await stashUndo('erase');
      covers = Object.create(null); await saveCovers();
      await mutate((s) => { s.games = []; s.notes = []; s.matches = []; s.roster = []; }, 'Everything erased – you can undo from this page');
      state.meta.changes = 0; try { await save(); } catch (e) { /* ignore */ } render(); renderBanners();
    }
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('#backBtn');
    if (b) { location.hash = b.dataset.href || '#/'; return; }
    const t = e.target.closest('[data-act]'); if (!t) return;
    const fn = actions[t.dataset.act]; if (fn) fn(t, e);
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.progress) { const o = $('#progOut'); if (o) o.textContent = t.value + '%'; return; }
    if (t.dataset && t.dataset.multiq) { multi.q = t.value; multi.shown = 60; refreshMulti(); return; }
    if (t.dataset && t.dataset.bind) { ui[t.dataset.bind] = t.value; const lb = $('#listBox'); if (lb && t.type === 'search') lb.innerHTML = route().name === 'journal' ? journalList() : route().name === 'game' ? gameNotesHTML(gameById(route().id)) : libraryList(); }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.rnd) { const k = t.dataset.rnd; if (k === 'paused' || k === 'upcoming') rnd[k] = t.checked; else rnd[k] = t.value; rnd.seen = []; showRandom(true); return; }
    if (t.dataset && t.dataset.hours) { const id = t.dataset.hours, raw = String(t.value).trim(), h = raw === '' ? 0 : parseFloat(raw); if (!(h >= 0) || h > 10000) { toast('Enter the hours as a number, like 12.5', true); render(); return; } const m = Math.round(h * 60); mutate((s) => { const g = gameById2(s, id); g.played = m; if (m > 0 && g.status === 'want') applyStatus(g, 'playing'); g.updatedAt = Date.now(); }, m ? `Saved ${fmtHours(m)}` : 'Hours cleared'); return; }
    if (t.dataset && t.dataset.progress) { const id = t.dataset.progress, v = Math.round(+t.value); mutate((s) => { const g = gameById2(s, id); g.progress = v; if (v > 0 && g.status === 'want') applyStatus(g, 'playing'); g.updatedAt = Date.now(); }); return; }
    if (t.dataset && t.dataset.date) { const id = t.dataset.id, k = t.dataset.date, v = /^\d{4}-\d{2}-\d{2}$/.test(t.value) ? t.value : ''; mutate((s) => { const g = gameById2(s, id); g[k] = v; g.updatedAt = Date.now(); }); return; }
    if (t.dataset && t.dataset.pickopt) { if (t.dataset.pickopt === 'plat') { multi.pref = t.value; lsSet(LS_PREF, t.value); } else multi.status = t.value; return; }
    if (t.dataset && t.dataset.bind && t.tagName === 'SELECT') { ui[t.dataset.bind] = t.value; const lb = $('#listBox'); if (lb) lb.innerHTML = libraryList(); const fc = $('#fCount'); if (fc) { const n = filtersActive(); fc.textContent = n; fc.hidden = !n; } return; }
    if (t.dataset && t.dataset.rvphoto && t.files && t.files[0]) { const f = t.files[0]; t.value = ''; rvPhoto(f); return; }
    if (t.dataset && t.dataset.remind) { lsSet(LS_REMIND, t.value); render(); toast(+t.value ? 'Backup reminders: every ' + (+t.value === 7 ? 'week' : +t.value === 14 ? '2 weeks' : 'month') : 'Backup reminders off'); return; }
    if (t.id === 'chkIn' && t.files && t.files[0]) { const f = t.files[0]; t.value = ''; f.text().then((txt) => showCheck(parseBackup(txt), f.name)).catch((err) => openSheet(`<h2>Not a usable backup</h2><p class="muted" style="margin:10px 0">${esc(err.message || 'Could not read that file')}</p><div class="actions"><button class="btn primary" data-act="close-sheet">Close</button></div>`)); return; }
    if (t.dataset && t.dataset.confirmcovers) { lsSet(LS_CONFIRM, t.checked ? '1' : '0'); toast(t.checked ? 'You’ll be asked to confirm covers after adding games' : 'Covers will not be confirmed after adding'); return; }
    if (t.dataset && t.dataset.autocover) { lsSet(LS_AUTOCOVER, t.checked ? '1' : '0'); if (t.checked) enqueueCovers(libraryCoverEntries()); toast(t.checked ? 'Covers will load automatically' : 'Automatic cover loading is off'); return; }
    if (t.dataset && t.dataset.cover && t.files && t.files[0]) { const f = t.files[0], id = t.dataset.cover; t.value = ''; setCoverFromFile(id, f); return; }
    if (t.id === 'fileIn' && t.files && t.files[0]) {
      const f = t.files[0]; t.value = '';
      f.text().then((txt) => showImport(parseBackup(txt))).catch((err) => toast(err.message || 'Could not read that file', true));
    }
  });
  window.addEventListener('hashchange', () => { closeSheet(); render(); });
  setInterval(tickCountdowns, 1000);
  setInterval(() => { document.querySelectorAll('[data-sess]').forEach((el) => { const g = gameById(el.dataset.sess); if (g && g.sessionAt) el.textContent = fmtHours(sessionMin(g)); }); }, 20000);

  // ───────────────────────── updates ─────────────────────────
  let updateSeen = false;
  async function checkUpdate() {
    if (!('serviceWorker' in navigator)) return toast('Updates need the installed app', true);
    if (navigator.onLine === false) return toast('You’re offline – connect to the internet and try again', true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return toast('The app isn’t installed for offline use yet', true);
      toast('Checking for updates…'); updateSeen = false;
      let server = '';
      try { const r = await fetch('sw.js?check=' + Date.now(), { cache: 'no-store' }); const m = /VERSION\s*=\s*'([^']+)'/.exec(await r.text()); server = m ? m[1] : ''; }
      catch (e) { return toast('Couldn’t reach the server – check your connection', true); }
      if (server && server === APP_VERSION) { reg.update().catch(() => {}); return toast(`You have the latest version (${APP_VERSION}, ${CATALOG.length} games in the list). If you just uploaded files, GitHub can take a few minutes – try again shortly.`); }
      toast(server ? `New version ${server} found – downloading…` : 'Looking for a new version…');
      await reg.update();
      for (let i = 0; i < 45 && !updateSeen; i++) await sleep(1000);
      if (!updateSeen) toast(`Still on ${APP_VERSION}${server ? ` (server has ${server})` : ''}. Keep the app open and try again in a minute, or use “Force refresh app files”.`, true);
    } catch (e) { toast('Could not check for updates right now', true); }
  }
  /** Last resort when an update won't arrive: throw away the app's cached FILES (never the journal) and reload. */
  async function forceRefreshFiles() {
    if (navigator.onLine === false) return toast('Connect to the internet first', true);
    if (!(await confirmBox({ title: 'Force refresh app files?', message: 'This re-downloads the app’s own files from the internet and reloads. Your games, notes and photos are not touched.', okLabel: 'Refresh' }))) return;
    try {
      const r = await fetch('index.html?fresh=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status);
      const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map((x) => x.unregister()));
      const keys = await caches.keys(); await Promise.all(keys.filter((k) => k.startsWith('save-point-')).map((k) => caches.delete(k)));
      toast('Reloading with fresh files…'); setTimeout(() => location.reload(), 700);
    } catch (e) { toast('Couldn’t refresh – nothing was changed. Check your connection.', true); }
  }

  // ───────────────────────── boot ─────────────────────────
  async function boot() {
    await loadState();
    render(); renderBanners();
    loadCoverCache().then(() => enqueueCovers(libraryCoverEntries()));
    window.addEventListener('online', () => enqueueCovers(libraryCoverEntries()));
    if (storage.recovered) toast('Restored your journal from the safety copy');
    askPersist().then(() => { if (route().name === 'backup') render(); });
    if ('serviceWorker' in navigator) {
      let hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController) { hadController = true; return; } // first install, not an update
        updateSeen = true; ui.updated = true; renderBanners(); toast('Updated! Reload to use the new version');
      });
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch((e) => console.warn('Service worker not registered:', e));
    }
  }
  // test hook (read-only helpers, harmless in production)
  window.__savePoint = { matchStats, matchLine, pairsList, rosterNames, playerStats, leaderboard, cleanMatch, fmtClock, ui, gameTile, filtersActive, cdText, releaseTs, tickCountdowns, weekDays, backlogList, catOf, searchCatalog, yearData, parseTags, cleanTags, noteMatches, tagCounts, relInfo, libRel, soonList, daysUntil, pickRandom, pickWeight, rndPool, rnd, get state() { return state; }, get covers() { return covers; }, storage, parseBackup, CATALOG, APP_VERSION, covq, cat, catMiss, titleVariants };
  boot();
})();
