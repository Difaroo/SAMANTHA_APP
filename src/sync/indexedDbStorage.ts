import type { StateStorage } from 'zustand/middleware';

const DB_NAME = 'samantha-sync';
const STORE_NAME = 'state';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

export const indexedDbStorage: StateStorage = {
  async getItem(name) {
    if (hasIndexedDb()) {
      try {
        const value = await transact<string | undefined>('readonly', (store) => store.get(name));
        if (value != null) return value;
      } catch {
        // Fall through to the rollback mirror.
      }
    }
    return localStorage.getItem(name);
  },
  async setItem(name, value) {
    if (hasIndexedDb()) {
      try {
        await transact('readwrite', (store) => store.put(value, name));
      } catch {
        // The localStorage mirror still preserves the outbox if IndexedDB is unavailable.
      }
    }
    localStorage.setItem(name, value);
  },
  async removeItem(name) {
    if (hasIndexedDb()) {
      try {
        await transact('readwrite', (store) => store.delete(name));
      } catch {
        // Continue with mirror cleanup.
      }
    }
    localStorage.removeItem(name);
  },
};
