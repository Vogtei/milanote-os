// Local-only safety net for board state — lets a board keep working (and
// reload cleanly) while genuinely offline. Payload-agnostic on purpose: it
// stores whatever the caller hands it, currently a board Doc.
const DB_NAME = "vellum-offline";
const STORE_NAME = "board-snapshots";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export type CachedSnapshot = { snapshot: unknown; savedAt: number };

export async function saveSnapshot(boardId: string, snapshot: unknown): Promise<void> {
  const db = await openDb();
  const entry: CachedSnapshot = { snapshot, savedAt: Date.now() };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(entry, boardId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadSnapshot(boardId: string): Promise<CachedSnapshot | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(boardId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function clearSnapshot(boardId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(boardId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
