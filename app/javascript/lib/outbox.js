// Edits that couldn't reach the server, kept in IndexedDB until they can.
// One entry per URL: autosave always sends the whole record, so only the latest edit matters.
const DB_NAME = "notes_app"
const STORE = "outbox"

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "url" })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transaction(mode, work) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    let result
    work(tx.objectStore(STORE), (value) => { result = value })
    tx.oncomplete = () => { db.close(); resolve(result) }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

const read = (mode, call) =>
  transaction(mode, (store, done) => { call(store).onsuccess = (event) => done(event.target.result) })

export const outbox = {
  // fields: [[name, value], ...] from a FormData
  put: (url, fields) => read("readwrite", (store) => store.put({ url, fields, queuedAt: Date.now() })),
  get: (url) => read("readonly", (store) => store.get(url)),
  all: () => read("readonly", (store) => store.getAll()),
  count: () => read("readonly", (store) => store.count()),

  // remove an entry, but only if it hasn't been replaced by a newer edit since `queuedAt`
  delete: (url, queuedAt = null) =>
    transaction("readwrite", (store) => {
      store.get(url).onsuccess = (event) => {
        const entry = event.target.result
        if (entry && (queuedAt === null || entry.queuedAt === queuedAt)) store.delete(url)
      }
    })
}
