import { db } from '../../db/database.js'

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`
}

export async function createBookDraft(title) {
  const now = new Date().toISOString()
  const book = {
    id: makeId('book'),
    title: title.trim(),
    subtitle: '',
    themeId: null,
    status: 'draft',
    pageIds: [],
    photoIds: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    backupStatus: 'device-only',
    schemaVersion: 1,
  }

  await db.books.add(book)
  return book
}

export async function updateBookTheme(bookId, themeId) {
  await db.books.update(bookId, {
    themeId,
    updatedAt: new Date().toISOString(),
  })
  return db.books.get(bookId)
}

async function fileChecksum(file) {
  if (!crypto.subtle) return `${file.name}-${file.size}-${file.lastModified}`
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function makeThumbnailBlob(file) {
  if (!('createImageBitmap' in window)) return file

  const bitmap = await createImageBitmap(file)
  const maxEdge = 720
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: false })
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not create thumbnail'))),
      'image/jpeg',
      0.82,
    )
  })
}

export async function importPhotos(bookId, fileList, onProgress) {
  const files = [...fileList].filter((file) => file.type.startsWith('image/'))
  const importedIds = []

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    const photoId = makeId('photo')
    const thumbnailId = makeId('thumb')
    const createdAt = new Date().toISOString()
    const checksum = await fileChecksum(file)
    const thumbnailBlob = await makeThumbnailBlob(file)

    await db.transaction('rw', db.photos, db.thumbnails, db.books, async () => {
      await db.photos.add({
        id: photoId,
        bookId,
        blob: file,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        checksum,
        createdAt,
      })

      await db.thumbnails.add({
        id: thumbnailId,
        photoId,
        blob: thumbnailBlob,
      })

      const book = await db.books.get(bookId)
      const nextPhotoIds = [...(book?.photoIds ?? []), photoId]
      await db.books.update(bookId, {
        photoIds: nextPhotoIds,
        updatedAt: createdAt,
      })
    })

    importedIds.push(photoId)
    onProgress?.({ completed: index + 1, total: files.length })
  }

  return importedIds
}

export async function listBooks() {
  const books = await db.books.toArray()
  return books
    .filter((book) => !book.deletedAt)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}
