import Dexie from 'dexie'

export const DB_NAME = 'little-stories-db'
export const SCHEMA_VERSION = 1

export const db = new Dexie(DB_NAME)

db.version(SCHEMA_VERSION).stores({
  books: 'id, title, themeId, createdAt, updatedAt, deletedAt, backupStatus',
  pages: 'id, bookId, order, layoutId, createdAt, updatedAt',
  photos: 'id, bookId, createdAt, checksum',
  thumbnails: 'id, photoId',
  settings: 'key',
  backupMetadata: 'id, bookId, lastBackedUpAt, status',
  snapshots: 'id, bookId, createdAt, kind',
})

export async function ensurePersistentStorage() {
  if (!navigator.storage?.persist) return false

  try {
    const alreadyPersistent = await navigator.storage.persisted?.()
    if (alreadyPersistent) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function getStorageEstimate() {
  if (!navigator.storage?.estimate) return null
  const estimate = await navigator.storage.estimate()
  return {
    usage: estimate.usage ?? 0,
    quota: estimate.quota ?? 0,
  }
}
