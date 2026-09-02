import { db } from '../../db/database.js'

export async function getThumbnailUrl(photoId) {
  if (!photoId) return null
  const thumb = await db.thumbnails.where('photoId').equals(photoId).first()
  if (!thumb?.blob) return null
  return URL.createObjectURL(thumb.blob)
}

export function releaseObjectUrl(url) {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
}
