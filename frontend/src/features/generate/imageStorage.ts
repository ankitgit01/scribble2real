const DATABASE = 'scribble2real-images'
const STORE = 'results'
function openImageDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Image storage is unavailable')); return }
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE) }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open image storage'))
  })
}
export async function saveResultImage(id: string, blob: Blob): Promise<void> {
  const db = await openImageDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite')
      transaction.objectStore(STORE).put(blob, id)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not save the image'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Image save was cancelled'))
    })
  } finally { db.close() }
}
export async function readResultImage(id: string): Promise<Blob | null> {
  const db = await openImageDatabase()
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readonly')
      const request = transaction.objectStore(STORE).get(id) as IDBRequest<Blob | undefined>
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => reject(request.error ?? new Error('Could not read the image'))
    })
  } finally { db.close() }
}
export async function clearResultImages(): Promise<void> {
  try {
    const db = await openImageDatabase()
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE, 'readwrite')
        transaction.objectStore(STORE).clear()
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error ?? new Error('Could not clear saved images'))
      })
    } finally { db.close() }
  } catch { /* Browsers without IndexedDB can still load recent server images and thumbnails. */ }
}
