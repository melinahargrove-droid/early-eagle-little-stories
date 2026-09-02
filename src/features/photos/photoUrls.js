import { db } from '../../db/database.js'

export async function getThumbnailUrl(photoId) {
  if (!photoId) return null
  const thumb = await db.thumbnails.where('photoId').equals(photoId).first()
  if (!thumb?.blob) return null
  return URL.createObjectURL(thumb.blob)
}

// Printing must never rely on the lightweight editor thumbnail. Use the
// original stored image blob so Android print/PDF gets the best source we have.
export async function getOriginalPhotoUrl(photoId) {
  if (!photoId) return null
  const photo = await db.photos.get(photoId)
  if (!photo?.blob) return null
  return URL.createObjectURL(photo.blob)
}

export function releaseObjectUrl(url) {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
}
