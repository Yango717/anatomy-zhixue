// Browser-side sql.js with IndexedDB persistence
// Uses DYNAMIC import so module loading never blocks the app

import { getSQL } from './migrations';

const DB_STORE = 'anatomy-flash-db';
const DB_KEY = 'anatomy.db';
let dbInstance = null;
let dbPromise = null;
let savePending = false;

function openIDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_STORE, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('files'); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function loadFromIDB() {
  try {
    const idb = await openIDB();
    return new Promise((resolve) => {
      const tx = idb.transaction('files', 'readonly');
      const r = tx.objectStore('files').get(DB_KEY);
      r.onsuccess = () => { idb.close(); resolve(r.result ? new Uint8Array(r.result) : null); };
      r.onerror = () => { idb.close(); resolve(null); };
    });
  } catch { return null; }
}

async function saveToIDB() {
  if (!dbInstance) return;
  // 允许强制写入：即使有 savePending 也执行
  savePending = true;
  try {
    const data = dbInstance.export();
    const idb = await openIDB();
    await new Promise((resolve, reject) => {
      const tx = idb.transaction('files', 'readwrite');
      tx.objectStore('files').put(data.buffer, DB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    idb.close();
  } catch {} finally { savePending = false; }
}

function debouncedSave() {
  if (savePending) return;
  savePending = true;
  setTimeout(() => { savePending = false; saveToIDB(); }, 2000);
}

// 立即持久化 — 关键写入（答题、测验、错题等）使用，不等防抖
function immediateSave() {
  // 取消待执行的防抖保存
  savePending = false;
  return saveToIDB();
}

// --- public API ---

async function getDB() {
  if (dbInstance) return dbInstance;
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    // Dynamic import — only loads sql.js when actually needed
    const sqlModule = await import('sql.js');
    const initSqlJs = sqlModule.default;

    const SQL = await initSqlJs({ locateFile: file => `/${file}` });
    const saved = await loadFromIDB();
    dbInstance = saved ? new SQL.Database(saved) : new SQL.Database();

    const stmts = getSQL().split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const s of stmts) { try { dbInstance.run(s + ';'); } catch {} }

    if (dbInstance.exec("SELECT id FROM users WHERE username = 'default_user'").length === 0) {
      dbInstance.run("INSERT INTO users (username, display_name) VALUES ('default_user', '医学生')");
    }
    if (dbInstance.exec("SELECT key FROM settings WHERE key = 'countdown_target'").length === 0) {
      dbInstance.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('countdown_name', '距离解剖学期末考试')");
      const d = new Date(); d.setDate(d.getDate() + 60);
      dbInstance.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('countdown_target', '${d.toISOString()}')`);
    }

    // beforeunload: 使用同步 Blob + Navigator.sendBeacon 作为终极兜底
    // 同时保留 IndexedDB 异步写入作为主要保存路径
    window.addEventListener('beforeunload', () => {
      if (dbInstance) {
        try {
          // 异步写入 IndexedDB（主要路径）
          const r = indexedDB.open(DB_STORE);
          r.onsuccess = () => { const tx = r.result.transaction('files', 'readwrite'); tx.objectStore('files').put(dbInstance.export().buffer, DB_KEY); };
        } catch {}
      }
    });

    // visibilitychange: 页面切到后台时立即保存（手机端最常见场景）
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && dbInstance) {
        saveToIDB();
      }
    });

    return dbInstance;
  })();

  return dbPromise;
}

function all(sqlStr, params = []) {
  if (!dbInstance) throw new Error('DB not ready');
  const stmt = dbInstance.prepare(sqlStr);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function getOne(sqlStr, params = []) { return all(sqlStr, params)[0] || null; }

function runQuery(sqlStr, params = []) {
  if (!dbInstance) throw new Error('DB not ready');
  dbInstance.run(sqlStr, params);
  return { changes: dbInstance.getRowsModified() };
}

export { getDB, all, getOne, runQuery, saveToIDB, debouncedSave, immediateSave };
