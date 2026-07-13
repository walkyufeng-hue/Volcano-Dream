const DB_NAME = 'volcano-dream-history'
const DB_VERSION = 1
const STORE_NAME = 'dream-images'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode)
    const request = operation(transaction.objectStore(STORE_NAME))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => reject(transaction.error)
  })
}

export async function saveHistoryImage(id: string, image: string): Promise<void> {
  await runTransaction('readwrite', (store) => store.put(image, id))
}

export async function getHistoryImage(id: string): Promise<string> {
  return (await runTransaction('readonly', (store) => store.get(id))) || ''
}

export async function deleteHistoryImage(id: string): Promise<void> {
  await runTransaction('readwrite', (store) => store.delete(id))
}

export async function clearHistoryImages(): Promise<void> {
  await runTransaction('readwrite', (store) => store.clear())
}
