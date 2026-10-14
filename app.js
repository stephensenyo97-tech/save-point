'use strict';
/* Save Point – personal gaming journal. No libraries, no network calls, no accounts.
 * Data lives in IndexedDB on this device (plus a localStorage mirror as a second copy).
 * Backups are plain JSON files you export yourself. */
(() => {
  // ───────────────────────── constants ─────────────────────────
  const DB_NAME = 'save-point', STORE = 'kv', KEY = 'state', UNDO_KEY = 'undo';
  const LS_MIRROR = 'savepoint.mirror.v1', LS_UNDO = 'savepoint.undo.v1', LS_DRAFT = 'savepoint.draft.';
  const FORMAT = 1;
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
    const rec = { at: Date.now(), label, state: JSON.parse(JSON.stringify(state)) };
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
  const notesOf = (id) => state.notes.filter((n) => n.gameId === id);
  const byNewestNote = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt);

  // ───────────────────────── backup / import ─────────────────────────
  function buildBackup() {
    return { app: 'save-point', format: FORMAT, exportedAt: new Date().toISOString(), counts: { games: state.games.length, notes: state.notes.length }, games: state.games, notes: state.notes };
  }
  const backupFilename = () => `save-point-backup-${todayStr()}.json`;
  async function markBackedUp() { state.meta.lastBackupAt = Date.now(); state.meta.changes = 0; render(); try { await save(); } catch (e) { /* ignore */ } renderBanners(); }

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
    const games = obj.games.map(cleanGame).filter(Boolean);
    const ids = new Set(games.map((g) => g.id));
    const notes = obj.notes.map(cleanNote).filter((n) => n && ids.has(n.gameId));
    const skipped = (obj.games.length - games.length) + (obj.notes.length - notes.length);
    return { games, notes, skipped, exportedAt: obj.exportedAt || null };
  }
  function showImport(parsed) {
    const ts = Date.parse(parsed.exportedAt || ''); const when = ts ? fmtDateTime(ts) : 'an unknown date';
    openSheet(`<h2>Import backup</h2>
      <p class="muted">Backup made ${esc(when)}: <b>${plural(parsed.games.length, 'game')}</b> and <b>${plural(parsed.notes.length, 'note')}</b>${parsed.skipped ? ` (${parsed.skipped} unreadable item${parsed.skipped === 1 ? '' : 's'} skipped)` : ''}.</p>
      <p class="muted small" style="margin-top:10px">Right now you have ${plural(state.games.length, 'game')} and ${plural(state.notes.length, 'note')}. Either choice can be undone from the Backup tab.</p>
      <div class="actions col">
        <button class="btn primary" data-act="do-import" data-mode="merge">Merge with what I have</button>
        <button class="btn danger" data-act="do-import" data-mode="replace">Replace everything with this backup</button>
        <button class="btn" data-act="close-sheet">Cancel</button>
      </div>`);
    pendingImport = parsed;
  }
  let pendingImport = null;
  async function applyImport(mode) {
    const p = pendingImport; if (!p) return;
    pendingImport = null; closeSheet();
    const stashed = await stashUndo(mode === 'replace' ? 'import (replace)' : 'import (merge)');
    let added = 0, updated = 0;
    await mutate((s) => {
      if (mode === 'replace') { s.games = p.games; s.notes = p.notes; added = p.games.length; }
      else {
        const gi = new Map(s.games.map((g) => [g.id, g]));
        p.games.forEach((g) => { const cur = gi.get(g.id); if (!cur) { s.games.push(g); added++; } else if (g.updatedAt > cur.updatedAt) { Object.assign(cur, g); updated++; } });
        const ni = new Map(s.notes.map((n) => [n.id, n]));
        p.notes.forEach((n) => { const cur = ni.get(n.id); if (!cur) { s.notes.push(n); } else if (n.updatedAt > cur.updatedAt) { Object.assign(cur, n); } });
      }
    });
    if (mode === 'replace') { state.meta.changes = 0; try { await save(); } catch (e) { /* reported by next save */ } }
    renderBanners(); render();
    toast(`Imported ${plural(p.games.length, 'game')} and ${plural(p.notes.length, 'note')}${stashed ? '' : ' (undo not available)'}`);
  }
  async function undoLast() {
    const rec = await readUndo(); if (!rec) return toast('Nothing to undo');
    const ok = await confirmBox({ title: 'Undo last import / erase?', message: `This puts your journal back how it was on ${fmtDateTime(rec.at)} (${rec.label}). Anything added since then will be lost.`, okLabel: 'Undo', danger: true });
    if (!ok) return;
    state = normalizeState(rec.state);
    try { await save(); await clearUndo(); toast('Journal restored'); } catch (e) { toast('⚠ Could not save restored data', true); }
    render(); renderBanners();
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
      const cur = map.get(key) || { title, key, plats: [] };
      plats.forEach((p) => { if (!cur.plats.includes(p)) cur.plats.push(p); });
      map.set(key, cur);
    });
    return [...map.values()];
  })();
  function searchCatalog(q) {
    const k = normKey(q); if (k.length < 2) return [];
    const words = k.split(' ');
    const scored = [];
    for (const g of CATALOG) {
      let score;
      if (g.key.startsWith(k)) score = 0;
      else if (g.key.split(' ').some((w) => w.startsWith(words[0])) && words.every((w) => g.key.includes(w))) score = 1;
      else if (words.every((w) => g.key.includes(w))) score = 2;
      else continue;
      if (g.key === k) continue; // already typed in full
      scored.push([score, g.key.length, g]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return scored.slice(0, 6).map((x) => x[2]);
  }
  function showSuggestions(form) {
    const box = $('#sugg'); if (!box) return;
    const hits = searchCatalog(form.elements.title.value);
    box.innerHTML = hits.map((g) => `<button type="button" class="sugg-item" data-act="pick-sugg" data-t="${esc(g.title)}" data-p="${esc(g.plats.join(','))}"><span>${esc(g.title)}</span><small>${esc(g.plats.join(' · '))}</small></button>`).join('');
  }

  // ───────────────────────── UI plumbing ─────────────────────────
  const ui = { libQ: '', libStatus: 'all', libPlat: 'all', libSort: 'recent', jQ: '', jType: 'all', gType: 'all' };
  let toastTimer = null;
  function toast(msg, isErr) {
    const t = $('#toast'); t.textContent = msg; t.className = 'show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = ''; }, isErr ? 6000 : 2800);
  }
  function openSheet(html) {
    closeSheet();
    const bd = document.createElement('div'); bd.className = 'sheet-backdrop'; bd.id = 'sheet';
    bd.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
    bd.addEventListener('click', (e) => { if (e.target === bd) closeSheet(); });
    document.body.appendChild(bd); document.body.classList.add('noscroll');
    requestAnimationFrame(() => bd.classList.add('open'));
    return bd;
  }
  function closeSheet() { const s = $('#sheet'); if (s) s.remove(); document.body.classList.remove('noscroll'); }
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
    if (['library', 'journal', 'backup'].includes(a)) return { name: a, key: a };
    return { name: 'home', key: 'home' };
  }

  function gameCard(g) {
    const n = notesOf(g.id).length;
    return `<a class="card game" href="#/game/${encodeURIComponent(g.id)}">
      <div class="g-top"><h3>${esc(g.title)}</h3><span class="pill st-${g.status}">${esc(statusLabel(g.status))}</span></div>
      <div class="g-meta"><span class="plat">${esc(g.platform)}</span><span>${plural(n, 'note')}</span></div>
      <div class="bar"><i style="width:${g.progress}%"></i></div><div class="pct">${g.progress}%</div></a>`;
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
      <div class="substats">${c('want')} want to play · ${c('paused')} paused · ${plural(state.notes.length, 'note')}</div>
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
    if (ui.libStatus !== 'all') list = list.filter((g) => g.status === ui.libStatus);
    if (ui.libPlat !== 'all') list = list.filter((g) => g.platform === ui.libPlat);
    const sorters = { recent: (a, b) => b.updatedAt - a.updatedAt, title: (a, b) => a.title.localeCompare(b.title), progress: (a, b) => b.progress - a.progress };
    list.sort(sorters[ui.libSort] || sorters.recent);
    if (!list.length) return emptyState('library', state.games.length ? 'No matches' : 'No games yet', state.games.length ? 'Try a different search or filter.' : 'Tap “Game” to add one.');
    return `<p class="muted small" style="margin:8px 4px">${plural(list.length, 'game')}</p>` + list.map(gameCard).join('');
  }
  function viewLibrary() {
    const plats = [...new Set(state.games.map((g) => g.platform))].sort();
    const chips = [{ id: 'all', label: 'All' }, ...STATUSES].map((s) => `<button class="chip ${ui.libStatus === s.id ? 'on' : ''}" data-act="set-ui" data-k="libStatus" data-v="${s.id}">${esc(s.label)}</button>`).join('');
    return {
      title: 'Library', fab: { label: 'Game', act: 'add-game' }, html: `
      <input type="search" placeholder="Search games…" value="${esc(ui.libQ)}" data-bind="libQ" aria-label="Search games" enterkeyhint="search">
      <div class="chips" style="margin-top:10px">${chips}</div>
      <div class="filters">
        <select data-bind="libPlat" aria-label="Platform"><option value="all">All platforms</option>${plats.map((p) => `<option ${ui.libPlat === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
        <select data-bind="libSort" aria-label="Sort"><option value="recent" ${ui.libSort === 'recent' ? 'selected' : ''}>Recently active</option><option value="title" ${ui.libSort === 'title' ? 'selected' : ''}>Title A–Z</option><option value="progress" ${ui.libSort === 'progress' ? 'selected' : ''}>Most complete</option></select>
      </div>
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
        <div class="g-meta" style="margin-top:0"><span class="plat">${esc(g.platform)}</span><span>Added ${esc(fmtDate(dateStr(new Date(g.createdAt))))}</span></div>
        <div class="seg" role="group" aria-label="Status">${STATUSES.map((s) => `<button class="${g.status === s.id ? 'on' : ''}" data-act="quick-status" data-id="${g.id}" data-v="${s.id}">${esc(s.label)}</button>`).join('')}</div>
        <label class="f" for="prog">COMPLETION</label>
        <div class="range-row"><input id="prog" type="range" min="0" max="100" step="1" value="${g.progress}" data-progress="${esc(g.id)}"><output id="progOut">${g.progress}%</output></div>
        <div class="row" style="margin-top:14px"><button class="btn" data-act="edit-game" data-id="${esc(g.id)}">${icon('edit')}Edit</button><button class="btn danger" data-act="del-game" data-id="${esc(g.id)}">${icon('trash')}Delete</button></div>
      </div>
      <div class="section-title">Notes</div>
      ${all.length ? `<div class="chips">${chips}</div>` : ''}
      ${list.length ? list.map((n) => noteCard(n, { actions: true })).join('') : emptyState('journal', 'No notes yet', 'Missions, boss tips, codes, builds, locations… tap “Note”.')}`
    };
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
        <div class="kv"><span>Contents</span><span>${plural(state.games.length, 'game')}, ${plural(state.notes.length, 'note')}</span></div>
        <div class="kv"><span>Last backup</span>${backupLine}</div>
        <div class="kv"><span>Changes since then</span><span class="${m.changes ? 'warn' : ''}">${m.changes}</span></div>
        <div class="stack" style="margin-top:14px">
          <button class="btn primary block" data-act="export" ${total ? '' : 'disabled'}>${icon('share')}Save backup file</button>
          <p class="muted small">On iPhone this opens the share sheet. Choose <b>Save to Files</b> (iCloud Drive keeps it off the phone too).</p>
        </div>
      </div>
      <div class="card">
        <h3 class="ct">Restore from a backup</h3>
        <p class="sub">Pick a Save Point backup file. You can merge it with what’s here or replace everything, and undo either.</p>
        <div class="stack">
          <button class="btn block" data-act="pick-file">${icon('upload')}Import backup file</button>
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
    if (r.name === 'game') v = viewGame(r.id); else v = { home: viewHome, library: viewLibrary, journal: viewJournal, backup: viewBackup }[r.name]();
    $('#title').innerHTML = v.title;
    const back = $('#backBtn');
    if (v.back) { back.hidden = false; back.innerHTML = icon('back'); back.dataset.href = v.back; } else back.hidden = true;
    $('#view').innerHTML = v.html;
    const fab = $('#fab');
    if (v.fab) { fab.hidden = false; fab.innerHTML = `${icon('plus')}${esc(v.fab.label)}`; fab.dataset.act = v.fab.act; fab.dataset.id = v.fab.id || ''; } else fab.hidden = true;
    $('#tabs').innerHTML = `<div class="inner">${[['home', 'Home', '#/'], ['library', 'Library', '#/library'], ['journal', 'Journal', '#/journal'], ['backup', 'Backup', '#/backup']]
      .map(([k, l, h]) => `<a href="${h}" class="${(r.name === k || (r.name === 'game' && k === 'library')) ? 'active' : ''}" ${r.name === k ? 'aria-current="page"' : ''}>${icon(k === 'home' ? 'home' : k)}${l}</a>`).join('')}</div>`;
    if (r.key !== lastRouteKey) { window.scrollTo(0, 0); lastRouteKey = r.key; }
    if (r.name === 'backup') afterBackupView();
  }
  function renderBanners() {
    const el = $('#banners'); const out = [];
    const total = state.games.length + state.notes.length;
    if (storage.mode !== 'indexeddb') out.push(`<div class="banner err"><p><b>Storage warning:</b> this browser blocked IndexedDB, so Save Point is using a smaller fallback. Export backups often.</p></div>`);
    if (total && !state.meta.lastBackupAt) out.push(`<div class="banner"><p><b>No backup yet.</b> Your journal only exists on this phone.</p><button class="btn sm" data-act="export">Back up</button></div>`);
    else if (total && state.meta.changes >= 10) out.push(`<div class="banner"><p><b>${plural(state.meta.changes, 'change')}</b> since your last backup.</p><button class="btn sm" data-act="export">Back up</button></div>`);
    el.innerHTML = out.join('');
  }

  // ───────────────────────── forms ─────────────────────────
  function gameForm(g) {
    const isEdit = !!g; g = g || { title: '', platform: 'PS5', status: 'want', progress: 0 };
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
      const status = F.status.value, progress = +F.progress.value;
      closeSheet();
      if (isEdit) mutate((s) => { Object.assign(gameById2(s, g.id), { title, platform, status, progress, updatedAt: Date.now() }); }, 'Game updated');
      else { const ng = { id: uid(), title, platform, status, progress, createdAt: Date.now(), updatedAt: Date.now() }; mutate((s) => { s.games.push(ng); }, 'Game added').then(() => { location.hash = '#/game/' + encodeURIComponent(ng.id); }); }
    });
    if (!isEdit) setTimeout(() => F.title.focus(), 300);
  }
  const gameById2 = (s, id) => s.games.find((x) => x.id === id);

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
    'add-game': () => gameForm(),
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
        location.hash = '#/library'; await mutate((s) => { s.games = s.games.filter((x) => x.id !== g.id); s.notes = s.notes.filter((x) => x.gameId !== g.id); }, 'Game deleted');
      }
    },
    'add-note': (t) => noteForm(t.dataset.id),
    'edit-note': (t) => { const n = state.notes.find((x) => x.id === t.dataset.id); if (n) noteForm(n.gameId, n); },
    'del-note': async (t) => { const id = t.dataset.id; if (await confirmBox({ title: 'Delete this note?', message: 'This can’t be undone unless you have a backup.', okLabel: 'Delete', danger: true })) mutate((s) => { s.notes = s.notes.filter((x) => x.id !== id); }, 'Note deleted'); },
    'copy-note': async (t) => { const n = state.notes.find((x) => x.id === t.dataset.id); if (!n) return; try { await navigator.clipboard.writeText(n.body); toast('Copied'); } catch (e) { toast('Copy was blocked by the browser', true); } },
    'quick-status': (t) => { const id = t.dataset.id, v = t.dataset.v; mutate((s) => { const g = gameById2(s, id); g.status = v; if (v === 'finished') g.progress = 100; g.updatedAt = Date.now(); }); },
    'set-ui': (t) => { ui[t.dataset.k] = t.dataset.v; render(); },
    'export': () => exportBackup(),
    'copy-backup': () => copyBackup(),
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
    if (t.dataset && t.dataset.bind) { ui[t.dataset.bind] = t.value; const lb = $('#listBox'); if (lb && t.type === 'search') lb.innerHTML = route().name === 'journal' ? journalList() : libraryList(); }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.progress) { const id = t.dataset.progress, v = Math.round(+t.value); mutate((s) => { const g = gameById2(s, id); g.progress = v; g.updatedAt = Date.now(); }); return; }
    if (t.dataset && t.dataset.bind && t.tagName === 'SELECT') { ui[t.dataset.bind] = t.value; const lb = $('#listBox'); if (lb) lb.innerHTML = libraryList(); return; }
    if (t.id === 'fileIn' && t.files && t.files[0]) {
      const f = t.files[0]; t.value = '';
      f.text().then((txt) => showImport(parseBackup(txt))).catch((err) => toast(err.message || 'Could not read that file', true));
    }
  });
  window.addEventListener('hashchange', () => { closeSheet(); render(); });

  // ───────────────────────── boot ─────────────────────────
  async function boot() {
    await loadState();
    render(); renderBanners();
    if (storage.recovered) toast('Restored your journal from the safety copy');
    askPersist().then(() => { if (route().name === 'backup') render(); });
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker not registered:', e));
    }
  }
  // test hook (read-only helpers, harmless in production)
  window.__savePoint = { get state() { return state; }, storage, parseBackup };
  boot();
})();
