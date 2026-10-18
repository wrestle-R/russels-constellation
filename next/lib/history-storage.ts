import type { Collection } from "./music";

function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("play-it-back-local", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("collection");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function saveImport(collection: Collection | null) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("collection", "readwrite");
      const store = tx.objectStore("collection");
      if (collection) store.put(collection, "history");
      else store.delete("history");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function loadImport(): Promise<Collection | null> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("collection")
      .objectStore("collection")
      .get("history");
    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}
