'use strict';
/* Save Point – personal gaming journal. No libraries, no network calls, no accounts.
 * Data lives in IndexedDB on this device (plus a localStorage mirror as a second copy).
 * Backups are plain JSON files you export yourself. */
(() => {
  // ───────────────────────── constants ─────────────────────────
  const DB_NAME = 'save-point', STORE = 'kv', KEY = 'state', UNDO_KEY = 'undo';
  const LS_MIRROR = 'savepoint.mirror.v1', LS_UNDO = 'savepoint.undo.v1', LS_DRAFT = 'savepoint.draft.';
  const FORMAT = 2;
  const APP_VERSION = 'v4.7';
  const COVERS_KEY = 'covers';
  const LS_PREF = 'savepoint.pickplat', LS_AUTOCOVER = 'savepoint.autocover', LS_CONFIRM = 'savepoint.confirmcovers', LS_REMIND = 'savepoint.remind';
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
      played: Math.min(600000, Math.max(0, Math.round(num(g.played, 0)))),
      plays: Array.isArray(g.plays) ? g.plays.map((p) => (p && /^\d{4}-\d{2}-\d{2}$/.test(p.d || '') && Math.round(num(p.m, 0)) > 0 ? { d: p.d, m: Math.min(1440, Math.round(num(p.m, 0))) } : null)).filter(Boolean).slice(-300) : [],
      sessionAt: num(g.sessionAt, 0) > 0 && num(g.sessionAt, 0) <= Date.now() + 60000 ? Math.round(num(g.sessionAt, 0)) : 0,
      createdAt: num(g.createdAt, Date.now()), updatedAt: num(g.updatedAt, Date.now())
    };
  }
  function cleanNote(n) {
    if (!n || typeof n !== 'object') return null;
    const gameId = cid(n.gameId);
    const body = str(n.body, 200000), title = str(n.title, 200).trim();
    if (!gameId || (!body.trim() && !title)) return null;
    const createdAt = num(n.createdAt, Date.now());
    return {
      id: cid(n.id) || uid(), gameId, title, body,
      type: NOTE_TYPES.some((t) => t.id === n.type) ? n.type : 'general',
      date: /^\d{4}-\d{2}-\d{2}$/.test(n.date || '') ? n.date : dateStr(new Date(createdAt)),
      createdAt, updatedAt: num(n.updatedAt, createdAt)
    };
  }
  function freshState() { return { games: [], notes: [], meta: { createdAt: Date.now(), lastBackupAt: null, changes: 0 } }; }
  function normalizeState(raw) {
    const s = freshState();
    if (!raw || typeof raw !== 'object') return s;
    s.games = (Array.isArray(raw.games) ? raw.games : []).map(cleanGame).filter(Boolean);
    const ids = new Set(s.games.map((g) => g.id));
    s.notes = (Array.isArray(raw.notes) ? raw.notes : []).map(cleanNote).filter((n) => n && ids.has(n.gameId));
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
    ls = lsSet(LS_MIRROR, JSON.stringify(state));
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
    return { app: 'save-point', format: FORMAT, exportedAt: new Date().toISOString(), counts: { games: state.games.length, notes: state.notes.length, photos: Object.keys(covers).length }, games: state.games, notes: state.notes, covers: Object.assign({}, covers) };
  }
  const backupFilename = () => `save-point-backup-${todayStr()}.json`;
  async function markBackedUp() { state.meta.lastBackupAt = Date.now(); state.meta.changes = 0; render(); try { await save(); } catch (e) { /* ignore */ } renderBanners(); }

  /** How many days between backup reminders: 7, 14 or 30 (0 = never remind). */
  const remindDays = () => { const v = lsGet(LS_REMIND); return v === null ? 14 : [0, 7, 14, 30].includes(+v) ? +v : 14; };
  const daysSince = (ts) => Math.max(0, Math.floor((Date.now() - ts) / 86400000));
  const agoText = (ts) => { const d = daysSince(ts); return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; };
  /** Reminder is due when there are unsaved changes and the last backup is older than the chosen interval. */
  const backupStale = () => { const m = state.meta, r = remindDays(); return !!(r && m.lastBackupAt && m.changes > 0 && daysSince(m.lastBackupAt) >= r); };

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
    return { games, notes, covers: cleanCovers(obj.covers, ids), skipped, exportedAt: obj.exportedAt || null };
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
      if (mode === 'replace') { s.games = p.games; s.notes = p.notes; added = p.games.length; covers = Object.assign(Object.create(null), p.covers); }
      else {
        const gi = new Map(s.games.map((g) => [g.id, g]));
        p.games.forEach((g) => { const cur = gi.get(g.id); if (!cur) { s.games.push(g); added++; if (p.covers[g.id]) covers[g.id] = p.covers[g.id]; } else if (g.updatedAt > cur.updatedAt) { Object.assign(cur, g); updated++; if (p.covers[g.id]) covers[g.id] = p.covers[g.id]; } });
        const ni = new Map(s.notes.map((n) => [n.id, n]));
        p.notes.forEach((n) => { const cur = ni.get(n.id); if (!cur) { s.notes.push(n); } else if (n.updatedAt > cur.updatedAt) { Object.assign(cur, n); } });
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
  /** Release info for a catalog entry: label shown to the user, whether it is still to come, and a sortable number. */
  function relInfo(g) {
    const d = g.date, today = todayStr();
    if (!d) return { label: '', upcoming: false, sort: 0 };
    if (d === 'TBA') return { label: 'TBA', upcoming: true, sort: 99999999 };
    if (d.length === 10) { const up = d > today; return { label: up ? 'Out ' + fmtDate(d) : fmtDate(d), upcoming: up, sort: +d.replace(/-/g, '') }; }
    const up = +d > +today.slice(0, 4);
    return { label: up ? 'Expected ' + d : d, upcoming: up, sort: +d * 10000 + 615 };
  }
  // Short names people actually type → words used in the real titles.
  const ALIASES = { gta: 'grand theft auto', cod: 'call of duty', mw: 'modern warfare', bo: 'black ops', rdr: 'red dead redemption', re: 'resident evil', ff: 'final fantasy', dq: 'dragon quest', gow: 'god of war', tlou: 'the last of us', nfs: 'need for speed', pes: 'pro evolution soccer', mgs: 'metal gear solid', ac: 'assassin s creed', dmc: 'devil may cry', botw: 'breath of the wild', totk: 'tears of the kingdom', sf: 'street fighter', mk: 'mortal kombat', cs: 'counter strike', lol: 'league of legends', fh: 'forza horizon', tw: 'total war', sm: 'super mario', ds: 'dark souls', er: 'elden ring', hzd: 'horizon zero dawn', nba: 'nba', ufc: 'ufc' };
  function expandQuery(q) {
    return normKey(q).split(' ').map((w) => {
      const m = /^([a-z]+?)(\d+)$/.exec(w);
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
      else if (words.every((w) => g.key.includes(w))) score = 2;
      else continue;
      if (g.key === k && !keepExact) continue; // already typed in full
      scored.push([score, g.key.length, g]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return scored.slice(0, limit).map((x) => x[2]);
  }
  function showSuggestions(form) {
    const box = $('#sugg'); if (!box) return;
    const hits = searchCatalog(form.elements.title.value);
    box.innerHTML = hits.map((g) => `<button type="button" class="sugg-item" data-act="pick-sugg" data-t="${esc(g.title)}" data-p="${esc(g.plats.join(','))}"><span>${esc(g.title)}</span><small>${esc(g.plats.join(' · '))}</small></button>`).join('');
  }

  // ───────────────────────── UI plumbing ─────────────────────────
  const ui = { libQ: '', libStatus: 'all', libPlat: 'all', libSort: 'recent', updated: false, jQ: '', jType: 'all', gType: 'all' };
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
    if (['library', 'journal', 'backup', 'stats'].includes(a)) return { name: a, key: a };
    return { name: 'home', key: 'home' };
  }

  function gameCard(g) {
    const n = notesOf(g.id).length;
    return `<a class="card game withcover" href="#/game/${encodeURIComponent(g.id)}"><div class="gc-cover" data-ck="${esc(normKey(g.title))}">${coverHTML(g, 'thumb')}</div><div class="gc-body">
      <div class="g-top"><h3>${g.fav ? '<span class="heart" aria-label="Favorite">♥</span> ' : ''}${esc(g.title)}</h3><span class="pill st-${g.status}">${esc(statusLabel(g.status))}</span></div>
      <div class="g-meta"><span class="plat">${esc(g.platform)}</span><span>${plural(n, 'note')}</span>${g.played ? `<span>${fmtHours(g.played)}</span>` : ''}${g.sessionAt ? '<span class="live-badge">● Playing</span>' : ''}${g.rating ? `<span class="rate-badge">★ ${g.rating}/10</span>` : ''}${g.queue ? '<span class="queue-badge">Up next</span>' : ''}</div>
      <div class="bar"><i style="width:${g.progress}%"></i></div><div class="pct">${g.progress}%</div></div></a>`;
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
      ${n.body ? `<div class="n-body">${esc(n.body)}</div>` : ''}
      ${actions ? `<div class="n-actions">
        <button class="btn sm" data-act="edit-note" data-id="${esc(n.id)}">${icon('edit')}Edit</button>
        ${n.type === 'code' ? `<button class="btn sm" data-act="copy-note" data-id="${esc(n.id)}">${icon('copy')}Copy</button>` : ''}
        <button class="btn sm danger" data-act="del-note" data-id="${esc(n.id)}">${icon('trash')}Delete</button></div>` : ''}
    </div>`;
  }
  const emptyState = (ic, h, p, btn) => `<div class="empty">${icon(ic)}<h3>${esc(h)}</h3><p>${esc(p)}</p>${btn || ''}</div>`;

  function viewHome() {
    const c = (s) => state.games.filter((g) => g.status === s).length;
    const playing = state.games.filter((g) => g.status === 'playing').sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
    const recent = state.notes.slice().sort(byNewestNote).slice(0, 4);
    const queued = state.games.filter((g) => g.queue).sort((a, b) => a.queue - b.queue).slice(0, 5);
    if (!state.games.length) {
      return { title: LOGO + 'Save Point', fab: null, html: emptyState('pad', 'Your journal is empty', 'Add the first game you’re playing, then jot down missions, boss tips, codes and builds as you go.', `<button class="btn primary" data-act="add-game">${icon('plus')}Add your first game</button>`) };
    }
    return {
      title: LOGO + 'Save Point', fab: { label: 'Game', act: 'add-game' }, html: `
      <div class="stats">
        <div class="stat"><b>${state.games.length}</b><span>Games added</span></div>
        <div class="stat accent"><b>${c('playing')}</b><span>Playing now</span></div>
        <div class="stat good"><b>${c('finished')}</b><span>Completed</span></div>
      </div>
      <div class="substats">${c('want')} want to play · ${c('paused')} paused · ${plural(state.notes.length, 'note')}${state.games.some((g) => g.fav) ? ` · <span class="heart">♥</span> ${state.games.filter((g) => g.fav).length}` : ''}${totalPlayed() ? ` · ${fmtHours(totalPlayed())} played` : ''}</div>
      ${queued.length ? `<div class="section-title">Up next <a href="#/library" data-act="open-queue">See all</a></div>${queued.map(queueCard).join('')}` : ''}
      <div class="section-title">Continue playing <a href="#/library">All games</a></div>
      ${playing.length ? playing.map(gameCard).join('') : '<p class="muted card">Nothing marked “Playing” right now.</p>'}
      <div class="section-title">Recent notes <a href="#/journal">All notes</a></div>
      ${recent.length ? recent.map((n) => noteCard(n, { showGame: true })).join('') : '<p class="muted card">No notes yet. Open a game and add one.</p>'}`
    };
  }

  function libraryList() {
    let list = state.games.slice();
    const q = ui.libQ.trim().toLowerCase();
    if (q) list = list.filter((g) => g.title.toLowerCase().includes(q) || g.platform.toLowerCase().includes(q));
    if (ui.libStatus === 'fav') list = list.filter((g) => g.fav);
    else if (ui.libStatus === 'queue') list = list.filter((g) => g.queue);
    else if (ui.libStatus !== 'all') list = list.filter((g) => g.status === ui.libStatus);
    if (ui.libPlat !== 'all') list = list.filter((g) => g.platform === ui.libPlat);
    const sorters = { recent: (a, b) => b.updatedAt - a.updatedAt, title: (a, b) => a.title.localeCompare(b.title), progress: (a, b) => b.progress - a.progress, rating: (a, b) => b.rating - a.rating || a.title.localeCompare(b.title), played: (a, b) => (b.played || 0) - (a.played || 0) || a.title.localeCompare(b.title) };
    list.sort(sorters[ui.libSort] || sorters.recent);
    if (ui.libStatus === 'queue') list.sort((a, b) => a.queue - b.queue);
    if (!list.length) return emptyState('library', state.games.length ? 'No matches' : 'No games yet', state.games.length ? 'Try a different search or filter.' : 'Tap “Game” to add one.');
    return `<p class="muted small" style="margin:8px 4px">${plural(list.length, 'game')}</p>` + list.map(gameCard).join('');
  }
  function viewLibrary() {
    const plats = [...new Set(state.games.map((g) => g.platform))].sort();
    const chips = [{ id: 'all', label: 'All' }, ...STATUSES, { id: 'fav', label: '♥ Favorites' }, { id: 'queue', label: 'Up next' }].map((s) => `<button class="chip ${ui.libStatus === s.id ? 'on' : ''}" data-act="set-ui" data-k="libStatus" data-v="${s.id}">${esc(s.label)}</button>`).join('');
    return {
      title: 'Library', fab: { label: 'Game', act: 'add-game' }, html: `
      <input type="search" placeholder="Search games…" value="${esc(ui.libQ)}" data-bind="libQ" aria-label="Search games" enterkeyhint="search">
      <div class="chips" style="margin-top:10px">${chips}</div>
      <div class="filters">
        <select data-bind="libPlat" aria-label="Platform"><option value="all">All platforms</option>${plats.map((p) => `<option ${ui.libPlat === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
        <select data-bind="libSort" aria-label="Sort"><option value="recent" ${ui.libSort === 'recent' ? 'selected' : ''}>Recently active</option><option value="title" ${ui.libSort === 'title' ? 'selected' : ''}>Title A–Z</option><option value="progress" ${ui.libSort === 'progress' ? 'selected' : ''}>Most complete</option><option value="rating" ${ui.libSort === 'rating' ? 'selected' : ''}>Highest rated</option><option value="played" ${ui.libSort === 'played' ? 'selected' : ''}>Most hours played</option></select>
      </div>
      ${state.games.some((g) => !covers[g.id]) ? `<button class="btn sm block" data-act="fetch-all-covers" style="margin-top:12px">Find covers for my games</button>` : ''}
      <div id="listBox">${libraryList()}</div>`
    };
  }

  function journalList() {
    let list = state.notes.slice().sort(byNewestNote);
    const q = ui.jQ.trim().toLowerCase();
    if (ui.jType !== 'all') list = list.filter((n) => n.type === ui.jType);
    if (q) list = list.filter((n) => { const g = gameById(n.gameId); return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || (g && g.title.toLowerCase().includes(q)); });
    if (!list.length) return emptyState('journal', state.notes.length ? 'No matching notes' : 'No notes yet', state.notes.length ? 'Try a different search or type.' : 'Open a game and tap “Note” to start your journal.');
    let html = `<p class="muted small" style="margin:8px 4px">${plural(list.length, 'note')}</p>`, last = '';
    list.forEach((n) => {
      const ym = n.date.slice(0, 7);
      if (ym !== last) { last = ym; html += `<div class="section-title">${esc(MONTHS[+ym.slice(5) - 1] + ' ' + ym.slice(0, 4))}</div>`; }
      html += noteCard(n, { showGame: true });
    });
    return html;
  }
  function viewJournal() {
    const chips = [{ id: 'all', label: 'All' }, ...NOTE_TYPES].map((t) => `<button class="chip ${ui.jType === t.id ? 'on' : ''}" data-act="set-ui" data-k="jType" data-v="${t.id}">${esc(t.label)}</button>`).join('');
    return { title: 'Journal', fab: null, html: `<input type="search" placeholder="Search all notes…" value="${esc(ui.jQ)}" data-bind="jQ" aria-label="Search notes" enterkeyhint="search"><div class="chips" style="margin-top:10px">${chips}</div><div id="listBox">${journalList()}</div>` };
  }

  function viewGame(id) {
    const g = gameById(id);
    if (!g) return { title: 'Not found', back: '#/library', fab: null, html: emptyState('library', 'Game not found', 'It may have been deleted.', '<a class="btn primary" href="#/library">Back to library</a>') };
    const all = notesOf(g.id).sort(byNewestNote);
    const list = ui.gType === 'all' ? all : all.filter((n) => n.type === ui.gType);
    const counts = (t) => all.filter((n) => n.type === t).length;
    const chips = [{ id: 'all', label: `All ${all.length}` }, ...NOTE_TYPES.filter((t) => counts(t.id)).map((t) => ({ id: t.id, label: `${t.label} ${counts(t.id)}` }))]
      .map((t) => `<button class="chip ${ui.gType === t.id ? 'on' : ''}" data-act="set-ui" data-k="gType" data-v="${t.id}">${esc(t.label)}</button>`).join('');
    return {
      title: esc(g.title), back: '#/library', fab: { label: 'Note', act: 'add-note', id: g.id }, html: `
      <div class="card">
        <div class="hero"><div class="hero-cv" data-ck="${esc(normKey(g.title))}">${coverHTML(g, 'full')}</div><div class="hero-side">
          <span class="plat">${esc(g.platform)}</span><span class="muted small">Added ${esc(fmtDate(dateStr(new Date(g.createdAt))))}</span>
          <button class="btn sm" data-act="find-cover" data-id="${esc(g.id)}">${icon('share')}Find cover online</button>
          <button class="btn sm" data-act="pick-cover">${icon('upload')}${covers[g.id] ? 'Change photo' : 'Use my photo'}</button>
          ${covers[g.id] ? `<button class="btn sm" data-act="clear-cover" data-id="${esc(g.id)}">Use generated cover</button>` : ''}
          <input id="coverIn" type="file" accept="image/*" data-cover="${esc(g.id)}" hidden>
        </div></div>
        <div class="seg" role="group" aria-label="Status">${STATUSES.map((s) => `<button class="${g.status === s.id ? 'on' : ''}" data-act="quick-status" data-id="${g.id}" data-v="${s.id}">${esc(s.label)}</button>`).join('')}</div>
        <div class="row tog">
          <button class="btn ${g.fav ? 'on fav' : ''}" data-act="toggle-fav" data-id="${esc(g.id)}" aria-pressed="${g.fav}">${icon('heart')}${g.fav ? 'Favorite' : 'Add to favorites'}</button>
          ${g.status === 'playing' || g.status === 'finished' ? '' : `<button class="btn ${g.queue ? 'on' : ''}" data-act="toggle-queue" data-id="${esc(g.id)}" aria-pressed="${!!g.queue}">${icon('next')}${g.queue ? 'In Up next' : 'Up next'}</button>`}
        </div>
        <label class="f">YOUR RATING <b class="rate-val">${g.rating ? g.rating + ' / 10' : 'not rated'}</b></label>
        <div class="rate" role="group" aria-label="Rating out of 10">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => `<button class="${g.rating === v ? 'on' : ''}" data-act="set-rating" data-id="${esc(g.id)}" data-v="${v}" aria-pressed="${g.rating === v}">${v}</button>`).join('')}</div>
        <label class="f" for="prog">COMPLETION</label>
        <div class="range-row"><input id="prog" type="range" min="0" max="100" step="1" value="${g.progress}" data-progress="${esc(g.id)}"><output id="progOut">${g.progress}%</output></div>
        <label class="f">HOURS PLAYED <b class="rate-val">${esc(fmtHours(g.played))}</b></label>
        ${g.sessionAt ? `<div class="sess"><b>Session running</b><span data-sess="${esc(g.id)}">${esc(fmtHours(sessionMin(g)))}</span><small class="muted">since ${esc(fmtTime(g.sessionAt))}</small></div>
        <div class="row"><button class="btn primary" data-act="end-session" data-id="${esc(g.id)}">End session &amp; add hours</button><button class="btn" data-act="cancel-session" data-id="${esc(g.id)}">Discard</button></div>`
        : `<div class="row"><button class="btn primary" data-act="start-session" data-id="${esc(g.id)}">▶ Start session</button><button class="btn" data-act="add-hours" data-id="${esc(g.id)}">Add hours</button></div>`}
        ${g.played || (g.plays || []).length ? `<button class="btn sm" data-act="edit-hours" data-id="${esc(g.id)}" style="margin-top:8px">Edit total hours</button>` : ''}
        <div class="dates">
          <label class="f" for="dStart">STARTED</label><label class="f" for="dEnd">FINISHED</label>
          <div class="dwrap"><input id="dStart" type="date" data-date="startedAt" data-id="${esc(g.id)}" value="${esc(g.startedAt)}">${g.startedAt ? `<button class="x" data-act="clear-date" data-k="startedAt" data-id="${esc(g.id)}" aria-label="Clear start date">✕</button>` : ''}</div>
          <div class="dwrap"><input id="dEnd" type="date" data-date="finishedAt" data-id="${esc(g.id)}" value="${esc(g.finishedAt)}">${g.finishedAt ? `<button class="x" data-act="clear-date" data-k="finishedAt" data-id="${esc(g.id)}" aria-label="Clear finish date">✕</button>` : ''}</div>
        </div>
        ${g.startedAt && g.finishedAt && g.finishedAt >= g.startedAt ? `<p class="muted small" style="margin-top:8px">Finished in ${plural(daysBetween(g.startedAt, g.finishedAt) + 1, 'day')}.</p>` : ''}
        <div class="row" style="margin-top:14px"><button class="btn" data-act="edit-game" data-id="${esc(g.id)}">${icon('edit')}Edit</button><button class="btn" data-act="share-card" data-id="${esc(g.id)}">${icon('share')}Share</button><button class="btn danger" data-act="del-game" data-id="${esc(g.id)}">${icon('trash')}Delete</button></div>
      </div>
      <div class="section-title">Notes</div>
      ${all.length ? `<div class="chips">${chips}</div>` : ''}
      ${list.length ? list.map((n) => noteCard(n, { actions: true })).join('') : emptyState('journal', 'No notes yet', 'Missions, boss tips, codes, builds, locations… tap “Note”.')}`
    };
  }


  // ───────────────────────── stats ─────────────────────────
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
      ${hoursCard()}
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
      <div class="card">
        <h3 class="ct">Back up your journal</h3>
        <p class="sub">Your data exists only on this phone. A backup file is your protection against clearing Safari data, deleting the app, or changing phones.</p>
        <div class="kv"><span>Contents</span><span>${plural(state.games.length, 'game')}, ${plural(state.notes.length, 'note')}${Object.keys(covers).length ? `, ${plural(Object.keys(covers).length, 'photo')}` : ''}</span></div>
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
    if (r.name === 'game') v = viewGame(r.id); else v = { home: viewHome, library: viewLibrary, stats: viewStats, journal: viewJournal, backup: viewBackup }[r.name]();
    $('#title').innerHTML = v.title;
    const back = $('#backBtn');
    if (v.back) { back.hidden = false; back.innerHTML = icon('back'); back.dataset.href = v.back; } else back.hidden = true;
    $('#view').innerHTML = v.html;
    const fab = $('#fab');
    if (v.fab) { fab.hidden = false; fab.innerHTML = `${icon('plus')}${esc(v.fab.label)}`; fab.dataset.act = v.fab.act; fab.dataset.id = v.fab.id || ''; } else fab.hidden = true;
    $('#tabs').innerHTML = `<div class="inner">${[['home', 'Home', '#/'], ['library', 'Library', '#/library'], ['stats', 'Stats', '#/stats'], ['journal', 'Journal', '#/journal'], ['backup', 'Backup', '#/backup']]
      .map(([k, l, h]) => `<a href="${h}" class="${(r.name === k || (r.name === 'game' && k === 'library')) ? 'active' : ''}" ${r.name === k ? 'aria-current="page"' : ''}>${icon(k === 'home' ? 'home' : k)}${l}</a>`).join('')}</div>`;
    if (r.key !== lastRouteKey) { window.scrollTo(0, 0); lastRouteKey = r.key; }
    if (r.name === 'backup') afterBackupView();
  }
  function renderBanners() {
    const el = $('#banners'); const out = [];
    const total = state.games.length + state.notes.length;
    if (storage.mode !== 'indexeddb') out.push(`<div class="banner err"><p><b>Storage warning:</b> this browser blocked IndexedDB, so Save Point is using a smaller fallback. Export backups often.</p></div>`);
    if (total && !state.meta.lastBackupAt) out.push(`<div class="banner"><p><b>No backup yet.</b> Your journal only exists on this phone.</p><button class="btn sm" data-act="export">Back up</button></div>`);
    else if (total && backupStale()) out.push(`<div class="banner"><p><b>Last backup: ${esc(agoText(state.meta.lastBackupAt))}.</b> ${plural(state.meta.changes, 'change')} since then.</p><button class="btn sm" data-act="export">Back up</button></div>`);
    else if (total && state.meta.changes >= 10) out.push(`<div class="banner"><p><b>${plural(state.meta.changes, 'change')}</b> since your last backup.</p><button class="btn sm" data-act="export">Back up</button></div>`);
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
      const meta = [g.plats.join(' · '), r.label].filter(Boolean).join(' · ');
      return `<button type="button" class="pick ${on ? 'on' : ''}" data-act="toggle-pick" data-k="${esc(g.key)}" ${inLib ? 'disabled' : ''} aria-pressed="${on}"><span class="tick">${CHECK}</span><span class="gc-cover xs" data-ck="${esc(g.key)}">${thumbFor(g.title)}</span><span class="pk-main"><b>${esc(g.title)}</b><small>${esc(meta) || '&nbsp;'}</small></span>${inLib ? '<em>In library</em>' : r.upcoming ? '<em class="soon">Soon</em>' : ''}</button>`;
    }).join('');
    if (all.length > slice.length) html += `<button type="button" class="btn block" data-act="pick-more" style="margin:8px 0">Show more (${all.length - slice.length} left)</button>`;
    if (!all.length) html += `<p class="muted pick-none">${searching ? 'No match in the built-in list.' : 'Nothing here yet.'}</p>`;
    html += `<button type="button" class="pick-custom" data-act="add-custom">${searching ? `Add “${esc(multi.q.trim())}” myself` : 'Can’t find it? Add a game myself'}</button>`;
    return html;
  }
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
    $('#pickChips').innerHTML = pickChips(); pickFoot();
    enqueueCovers(multiEntries().slice(0, multi.shown).map((g) => entryOf(g.title, g.date)));
  }
  function multiAdd() {
    multi.q = ''; multi.mode = 'new'; multi.sel = new Map(); multi.shown = 60;
    openSheet(`<div class="pk-head"><h2>Add games</h2><button type="button" class="btn sm" data-act="add-custom">Type my own</button></div>
      <input id="pickQ" type="search" placeholder="Search ${CATALOG.length} games…" data-multiq="1" aria-label="Search games" enterkeyhint="search" autocomplete="off" autocapitalize="off">
      <div class="chips" id="pickChips" style="margin-top:8px"></div>
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
        <label class="f" for="nBody">NOTE</label>
        <textarea id="nBody" name="body" maxlength="200000" placeholder="What do you want to remember?">${esc(n.body || '')}</textarea>
        ${draft ? '<p class="draft-note">Restored your unsaved draft.</p>' : ''}
        <div class="actions"><button type="button" class="btn" data-act="close-sheet">Cancel</button><button type="submit" class="btn primary">Save note</button></div>
      </form>`);
    const form = $('#noteForm', sh), F = form.elements;
    if (!isEdit) form.addEventListener('input', () => { lsSet(draftKey, JSON.stringify({ type: F.type.value, date: F.date.value, title: F.title.value, body: F.body.value })); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const type = F.type.value, date = F.date.value || todayStr(), title = F.title.value.trim(), body = F.body.value;
      if (!title && !body.trim()) { F.body.focus(); return toast('Write something first'); }
      closeSheet();
      if (isEdit) mutate((s) => { const x = s.notes.find((q) => q.id === note.id); Object.assign(x, { type, date, title, body, updatedAt: Date.now() }); gameById2(s, gameId).updatedAt = Date.now(); }, 'Note updated');
      else mutate((s) => { s.notes.push({ id: uid(), gameId, type, date, title, body, createdAt: Date.now(), updatedAt: Date.now() }); gameById2(s, gameId).updatedAt = Date.now(); }, 'Note saved').then(() => { if (storage.idbOk || storage.lsOk) lsDel(draftKey); });
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
    'pick-mode': (t) => { multi.mode = t.dataset.v; multi.shown = 60; refreshMulti(); },
    'add-picked': () => addPicked(),
    'set-rating': (t) => { const id = t.dataset.id, v = +t.dataset.v; mutate((s) => { const g = gameById2(s, id); g.rating = g.rating === v ? 0 : v; g.updatedAt = Date.now(); }); },
    'toggle-fav': (t) => { const id = t.dataset.id; mutate((s) => { const g = gameById2(s, id); g.fav = !g.fav; g.updatedAt = Date.now(); }); },
    'toggle-queue': (t) => { const id = t.dataset.id; mutate((s) => { const g = gameById2(s, id); g.queue = g.queue ? 0 : Date.now(); g.updatedAt = Date.now(); }, null); },
    'start-session': (t) => { const id = t.dataset.id; if (state.games.some((x) => x.sessionAt && x.id !== id)) return toast('Another game already has a session running. End it first.', true); mutate((s) => { const g = gameById2(s, id); if (g.status !== 'playing' && g.status !== 'finished') applyStatus(g, 'playing'); g.sessionAt = Date.now(); g.updatedAt = Date.now(); }, 'Session started – have fun!'); },
    'end-session': (t) => { const id = t.dataset.id, g0 = gameById(id), raw = g0 ? sessionMin(g0) : 0, m = Math.min(MAX_SESSION_MIN, raw); mutate((s) => { const g = gameById2(s, id); g.sessionAt = 0; if (m >= 1) addPlay(g, m); g.updatedAt = Date.now(); }, m >= 1 ? `Added ${fmtHours(m)}${raw > MAX_SESSION_MIN ? ' (capped at 12 h – use Edit total if needed)' : ''}` : 'Session was under a minute, nothing added'); },
    'cancel-session': (t) => { const id = t.dataset.id; mutate((s) => { const g = gameById2(s, id); g.sessionAt = 0; g.updatedAt = Date.now(); }, 'Session discarded'); },
    'add-hours': (t) => { const id = t.dataset.id; openSheet(`<h2>Add hours played</h2><p class="muted small" style="margin:6px 0">How long did you play? Use hours, like 1.5 for an hour and a half.</p>
      <input id="hrIn" type="number" inputmode="decimal" min="0" max="24" step="0.25" placeholder="Hours, e.g. 2" aria-label="Hours played">
      <div class="chips" style="margin-top:10px">${[0.5, 1, 2, 3].map((v) => `<button class="chip" data-act="hr-fill" data-v="${v}">${v} h</button>`).join('')}</div>
      <div class="actions"><button class="btn" data-act="close-sheet">Cancel</button><button class="btn primary" data-act="do-add-hours" data-id="${esc(id)}">Add</button></div>`); const i = $('#hrIn'); if (i) i.focus(); },
    'hr-fill': (t) => { const i = $('#hrIn'); if (i) i.value = t.dataset.v; },
    'do-add-hours': (t) => { const id = t.dataset.id, h = parseFloat(($('#hrIn') || {}).value), m = Math.round(h * 60); if (!(h > 0) || m < 1) return toast('Enter the hours you played, like 1.5', true); if (h > 24) return toast('Add up to 24 hours at a time', true); closeSheet(); mutate((s) => addPlay(gameById2(s, id), m), `Added ${fmtHours(m)}`); },
    'edit-hours': (t) => { const g = gameById(t.dataset.id); if (!g) return; openSheet(`<h2>Edit total hours</h2><p class="muted small" style="margin:6px 0">Set the total for ${esc(g.title)} in hours. This fixes the total only; the weekly chart keeps what was logged.</p>
      <input id="hrIn" type="number" inputmode="decimal" min="0" max="10000" step="0.1" value="${Math.round((g.played / 60) * 100) / 100}" aria-label="Total hours played">
      <div class="actions"><button class="btn" data-act="close-sheet">Cancel</button><button class="btn primary" data-act="do-edit-hours" data-id="${esc(g.id)}">Save</button></div>`); },
    'do-edit-hours': (t) => { const id = t.dataset.id, h = parseFloat(($('#hrIn') || {}).value); if (!(h >= 0) || h > 10000) return toast('Enter a number of hours, like 12.5', true); closeSheet(); mutate((s) => { const g = gameById2(s, id); g.played = Math.round(h * 60); g.updatedAt = Date.now(); }, 'Total hours updated'); },
    'start-game': (t) => { const id = t.dataset.id; mutate((s) => { applyStatus(gameById2(s, id), 'playing'); }, 'Started – have fun!'); },
    'open-queue': () => { ui.libStatus = 'queue'; },
    'clear-date': (t) => { const id = t.dataset.id, k = t.dataset.k; mutate((s) => { const g = gameById2(s, id); g[k] = ''; g.updatedAt = Date.now(); }); },
    'share-card': (t) => openShareCard(t.dataset.id),
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
        location.hash = '#/library'; if (covers[g.id]) { delete covers[g.id]; saveCovers(); } await mutate((s) => { s.games = s.games.filter((x) => x.id !== g.id); s.notes = s.notes.filter((x) => x.gameId !== g.id); }, 'Game deleted');
      }
    },
    'add-note': (t) => noteForm(t.dataset.id),
    'edit-note': (t) => { const n = state.notes.find((x) => x.id === t.dataset.id); if (n) noteForm(n.gameId, n); },
    'del-note': async (t) => { const id = t.dataset.id; if (await confirmBox({ title: 'Delete this note?', message: 'This can’t be undone unless you have a backup.', okLabel: 'Delete', danger: true })) mutate((s) => { s.notes = s.notes.filter((x) => x.id !== id); }, 'Note deleted'); },
    'copy-note': async (t) => { const n = state.notes.find((x) => x.id === t.dataset.id); if (!n) return; try { await navigator.clipboard.writeText(n.body); toast('Copied'); } catch (e) { toast('Copy was blocked by the browser', true); } },
    'quick-status': (t) => { const id = t.dataset.id, v = t.dataset.v; mutate((s) => { applyStatus(gameById2(s, id), v); }); },
    'set-ui': (t) => { ui[t.dataset.k] = t.dataset.v; render(); },
    'export': () => exportBackup(),
    'copy-backup': () => copyBackup(),
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
      await mutate((s) => { s.games = []; s.notes = []; }, 'Everything erased – you can undo from this page');
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
    if (t.dataset && t.dataset.bind) { ui[t.dataset.bind] = t.value; const lb = $('#listBox'); if (lb && t.type === 'search') lb.innerHTML = route().name === 'journal' ? journalList() : libraryList(); }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.progress) { const id = t.dataset.progress, v = Math.round(+t.value); mutate((s) => { const g = gameById2(s, id); g.progress = v; g.updatedAt = Date.now(); }); return; }
    if (t.dataset && t.dataset.date) { const id = t.dataset.id, k = t.dataset.date, v = /^\d{4}-\d{2}-\d{2}$/.test(t.value) ? t.value : ''; mutate((s) => { const g = gameById2(s, id); g[k] = v; g.updatedAt = Date.now(); }); return; }
    if (t.dataset && t.dataset.pickopt) { if (t.dataset.pickopt === 'plat') { multi.pref = t.value; lsSet(LS_PREF, t.value); } else multi.status = t.value; return; }
    if (t.dataset && t.dataset.bind && t.tagName === 'SELECT') { ui[t.dataset.bind] = t.value; const lb = $('#listBox'); if (lb) lb.innerHTML = libraryList(); return; }
    if (t.dataset && t.dataset.rvphoto && t.files && t.files[0]) { const f = t.files[0]; t.value = ''; rvPhoto(f); return; }
    if (t.dataset && t.dataset.remind) { lsSet(LS_REMIND, t.value); renderBanners(); toast(+t.value ? 'Backup reminders: every ' + (+t.value === 7 ? 'week' : +t.value === 14 ? '2 weeks' : 'month') : 'Backup reminders off'); return; }
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
  window.__savePoint = { get state() { return state; }, get covers() { return covers; }, storage, parseBackup, CATALOG, APP_VERSION, covq, cat, catMiss, titleVariants };
  boot();
})();
