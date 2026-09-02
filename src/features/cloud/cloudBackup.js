import { db } from '../../db/database.js'
import { exportPortableBackup, restorePortableBackup } from '../backup/backupService.js'
import { isCloudConfigured, supabase } from './supabaseClient.js'

const BUCKET = 'one-little-teacher-backups'
const APP_NAMESPACE = 'little-stories'
const FILE_NAME = 'latest.littlestories.zip'

export async function getCloudSession() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session ?? null
}

export async function sendMagicLink(email) {
  if (!isCloudConfigured) throw new Error('One Little Teacher Cloud is not configured yet.')
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: window.location.href.split('#')[0] },
  })
  if (error) throw error
}

export async function signOutCloud() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

function backupPath(userId) {
  return `${userId}/${APP_NAMESPACE}/${FILE_NAME}`
}

export async function uploadCloudBackup() {
  const session = await getCloudSession()
  if (!session?.user) throw new Error('Sign in to One Little Teacher Cloud before backing up online.')

  const { blob, manifest } = await exportPortableBackup()
  const path = backupPath(session.user.id)
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'application/zip',
    upsert: true,
    cacheControl: '0',
  })
  if (error) throw error

  const backedUpAt = new Date().toISOString()
  await db.backupMetadata.put({
    id: 'little-stories-cloud', bookId: null, status: 'backed-up',
    provider: 'one-little-teacher-cloud', appNamespace: APP_NAMESPACE,
    lastBackedUpAt: backedUpAt, userId: session.user.id,
    bookCount: manifest.counts.books, photoCount: manifest.counts.photos,
  })
  return { backedUpAt, manifest }
}

export async function autoCloudBackupIfNeeded() {
  const session = await getCloudSession()
  if (!session?.user || !navigator.onLine) return { skipped: true }
  const status = await db.backupMetadata.get('little-stories-cloud')
  const books = await db.books.toArray()
  const newest = books.reduce((value, book) => Math.max(value, Date.parse(book.updatedAt || 0) || 0), 0)
  const last = Date.parse(status?.lastBackedUpAt || 0) || 0
  if (!newest || newest <= last) return { skipped: true }
  return uploadCloudBackup()
}

export async function restoreLatestCloudBackup() {
  const session = await getCloudSession()
  if (!session?.user) throw new Error('Sign in to One Little Teacher Cloud before restoring.')
  const { data, error } = await supabase.storage.from(BUCKET).download(backupPath(session.user.id))
  if (error) throw error
  const file = new File([data], FILE_NAME, { type: 'application/zip' })
  return restorePortableBackup(file)
}

export async function getCloudStatus() {
  const session = await getCloudSession()
  const metadata = await db.backupMetadata.get('little-stories-cloud')
  return {
    configured: isCloudConfigured,
    signedIn: Boolean(session?.user),
    email: session?.user?.email ?? null,
    lastBackedUpAt: metadata?.lastBackedUpAt ?? null,
    status: metadata?.status ?? (session?.user ? 'connected' : 'signed-out'),
  }
}
