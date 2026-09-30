import type { Anchor } from "./types.js";

export type QueuedNote = {
  operation: string;
  scope: string;
  page: string;
  anchor: Anchor;
  body: string;
  handoff?: { endpoint: string; branch: string; thread: string };
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(Error("Browser storage is unavailable. Keep this comment open and enable site storage."));
    const request = indexedDB.open("komo-agent-outbox", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("notes", { keyPath: "operation" });
    request.onerror = () => reject(Error("Browser storage is unavailable. Keep this comment open and enable site storage."));
    request.onsuccess = () => resolve(request.result);
  });
}

async function transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore, done: (value: T) => void) => void) {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction("notes", mode);
    let result: T;
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(Error("Could not save the comment in this browser. Keep it open and try again.")); };
    tx.onabort = tx.onerror;
    work(tx.objectStore("notes"), (value) => { result = value; });
  });
}

export const putNote = (note: QueuedNote) => transaction<void>("readwrite", (store) => { store.put(note); });
export const removeNote = (operation: string) => transaction<void>("readwrite", (store) => { store.delete(operation); });
export const listNotes = (scope: string) => transaction<QueuedNote[]>("readonly", (store, done) => {
  const request = store.getAll();
  request.onsuccess = () => done((request.result as QueuedNote[]).filter((note) => note.scope === scope));
});
