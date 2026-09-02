import JSZip from 'jszip'
import { db, SCHEMA_VERSION } from '../../db/database.js'

const BACKUP_FORMAT = 'little-stories-backup'
const BACKUP_VERSION = 1

function safeFileName(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'little-stories'
}

function dateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

async function sha256(blob) {
  if (!crypto.subtle) return null
  const buffer = await blob.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function getBackupStatus() {
  const record = await db.backupMetadata.get('portable-backup')
  return record ?? null
}

export async function exportPortableBackup() {
  const createdAt = new Date().toISOString()
  const [books, pages, photos, thumbnails, settings, snapshots] = await Promise.all([
    db.books.toArray(),
    db.pages.toArray(),
    db.photos.toArray(),
    db.thumbnails.toArray(),
    db.settings.toArray(),
    db.snapshots.toArray(),
  ])

  const zip = new JSZip()
  const photoRecords = []
  const thumbnailRecords = []

  for (const photo of photos) {
    const { blob, ...record } = photo
    const path = `photos/${photo.id}.bin`
    zip.file(path, blob)
    photoRecords.push({ ...record, assetPath: path })
  }

  for (const thumb of thumbnails) {
    const { blob, ...record } = thumb
    const path = `thumbnails/${thumb.id}.bin`
    zip.file(path, blob)
    thumbnailRecords.push({ ...record, assetPath: path, mimeType: blob?.type || 'image/jpeg' })
  }

  const manifest = {
    format: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    createdAt,
    appName: 'Little Stories',
    counts: {
      books: books.length,
      pages: pages.length,
      photos: photos.length,
      thumbnails: thumbnails.length,
      snapshots: snapshots.length,
    },
    data: {
      books,
      pages,
      photos: photoRecords,
      thumbnails: thumbnailRecords,
      settings,
      snapshots,
    },
  }

  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })

  await db.backupMetadata.put({
    id: 'portable-backup',
    bookId: null,
    lastBackedUpAt: createdAt,
    status: 'exported',
    bookCount: books.length,
    photoCount: photos.length,
  })

  return {
    blob,
    filename: `little-stories-backup-${dateStamp()}.littlestories.zip`,
    manifest,
  }
}

function validateManifest(manifest) {
  if (!manifest || manifest.format !== BACKUP_FORMAT) throw new Error('This is not a Little Stories backup file.')
  if (manifest.backupVersion !== BACKUP_VERSION) throw new Error('This backup format is not supported by this version of Little Stories.')
  if (manifest.schemaVersion > SCHEMA_VERSION) throw new Error('This backup was created by a newer version of Little Stories. Update the app before restoring it.')
  if (!manifest.data?.books || !manifest.data?.pages || !manifest.data?.photos || !manifest.data?.thumbnails) throw new Error('The backup file is incomplete.')
}

export async function inspectPortableBackup(file) {
  const zip = await JSZip.loadAsync(file)
  const manifestFile = zip.file('manifest.json')
  if (!manifestFile) throw new Error('The backup file is missing its manifest.')
  const manifest = JSON.parse(await manifestFile.async('string'))
  validateManifest(manifest)
  return manifest
}

export async function restorePortableBackup(file) {
  const zip = await JSZip.loadAsync(file)
  const manifestFile = zip.file('manifest.json')
  if (!manifestFile) throw new Error('The backup file is missing its manifest.')

  const manifest = JSON.parse(await manifestFile.async('string'))
  validateManifest(manifest)

  const restoredPhotos = []
  for (const record of manifest.data.photos) {
    const entry = zip.file(record.assetPath)
    if (!entry) throw new Error(`A photo is missing from the backup: ${record.id}`)
    const bytes = await entry.async('uint8array')
    const blob = new Blob([bytes], { type: record.mimeType || 'image/jpeg' })
    if (record.checksum && crypto.subtle) {
      const actual = await sha256(blob)
      if (actual !== record.checksum) throw new Error(`A photo failed its integrity check: ${record.filename || record.id}`)
    }
    const { assetPath, ...clean } = record
    restoredPhotos.push({ ...clean, blob })
  }

  const restoredThumbs = []
  for (const record of manifest.data.thumbnails) {
    const entry = zip.file(record.assetPath)
    if (!entry) throw new Error(`A thumbnail is missing from the backup: ${record.id}`)
    const bytes = await entry.async('uint8array')
    const blob = new Blob([bytes], { type: record.mimeType || 'image/jpeg' })
    const { assetPath, ...clean } = record
    restoredThumbs.push({ ...clean, blob })
  }

  const restoredAt = new Date().toISOString()

  await db.transaction('rw', db.books, db.pages, db.photos, db.thumbnails, db.settings, db.backupMetadata, db.snapshots, async () => {
    await Promise.all([
      db.books.clear(), db.pages.clear(), db.photos.clear(), db.thumbnails.clear(),
      db.settings.clear(), db.backupMetadata.clear(), db.snapshots.clear(),
    ])

    if (manifest.data.books.length) await db.books.bulkPut(manifest.data.books)
    if (manifest.data.pages.length) await db.pages.bulkPut(manifest.data.pages)
    if (restoredPhotos.length) await db.photos.bulkPut(restoredPhotos)
    if (restoredThumbs.length) await db.thumbnails.bulkPut(restoredThumbs)
    if (manifest.data.settings?.length) await db.settings.bulkPut(manifest.data.settings)
    if (manifest.data.snapshots?.length) await db.snapshots.bulkPut(manifest.data.snapshots)

    await db.backupMetadata.put({
      id: 'portable-backup',
      bookId: null,
      lastBackedUpAt: manifest.createdAt,
      lastRestoredAt: restoredAt,
      status: 'restored',
      bookCount: manifest.data.books.length,
      photoCount: restoredPhotos.length,
    })
  })

  return {
    restoredAt,
    bookCount: manifest.data.books.length,
    photoCount: restoredPhotos.length,
    createdAt: manifest.createdAt,
  }
}

export function downloadBackup(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
