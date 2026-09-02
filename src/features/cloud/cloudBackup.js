import { db } from '../../db/database.js'
import { exportPortableBackup, restorePortableBackup } from '../backup/backupService.js'
import { isCloudConfigured, supabase } from './supabaseClient.js'

const BUCKET = 'one-little-teacher-backups'
const APP_NAMESPACE = 'little-stories'
const LATEST_FILE = 'latest.littlestories.zip'
const VERSION_FOLDER = 'versions'
const KEEP_VERSIONS = 5

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

function rootPath(userId) {
  return `${userId}/${APP_NAMESPACE}`
}

function latestPath(userId) {
  return `${rootPath(userId)}/${LATEST_FILE}`
}

function versionPath(userId, createdAt) {
  const stamp = createdAt.replace(/[:.]/g, '-')
  return `${rootPath(userId)}/${VERSION_FOLDER}/${stamp}.littlestories.zip`
}

async function pruneOldVersions(userId) {
  const folder = `${rootPath(userId)}/${VERSION_FOLDER}`
  const { data, error } = await supabase.storage.from(BUCKET).list(folder, {
    limit: 100,
    sortBy: { column: 'created_at', order: 'desc' },
  })
  if (error) throw error
  const extras = (data ?? []).slice(KEEP_VERSIONS)
  if (!extras.length) return
  const paths = extras.map((item) => `${folder}/${item.name}`)
  const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths)
  if (removeError) throw removeError
}

export async function uploadCloudBackup() {
  const session = await getCloudSession()
  if (!session?.user) throw new Error('Sign in to One Little Teacher Cloud before backing up online.')

  const { blob, manifest } = await exportPortableBackup()
  const createdAt = manifest.createdAt || new Date().toISOString()
  const versionedPath = versionPath(session.user.id, createdAt)

  const { error: versionError } = await supabase.storage.from(BUCKET).upload(versionedPath, blob, {
    contentType: 'application/zip',
    upsert: false,
    cacheControl: '0',
  })
  if (versionError) throw versionError

  const { error: latestError } = await supabase.storage.from(BUCKET).upload(latestPath(session.user.id), blob, {
    contentType: 'application/zip',
    upsert: true,
    cacheControl: '0',
  })
  if (latestError) throw latestError

  await pruneOldVersions(session.user.id)

  const backedUpAt = new Date().toISOString()
  await db.backupMetadata.put({
    id: 'little-stories-cloud', bookId: null, status: 'backed-up',
    provider: 'one-little-teacher-cloud', appNamespace: APP_NAMESPACE,
    lastBackedUpAt: backedUpAt, lastVersionCreatedAt: createdAt,
    userId: session.user.id, bookCount: manifest.counts.books,
    photoCount: manifest.counts.photos,
  })
  return { backedUpAt, createdAt, manifest }
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

async function downloadAndRestore(path, filename) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error) throw error
  const file = new File([data], filename, { type: 'application/zip' })
  return restorePortableBackup(file)
}

export async function restoreLatestCloudBackup() {
  const session = await getCloudSession()
  if (!session?.user) throw new Error('Sign in to One Little Teacher Cloud before restoring.')
  return downloadAndRestore(latestPath(session.user.id), LATEST_FILE)
}

export async function listCloudRecoveryPoints() {
  const session = await getCloudSession()
  if (!session?.user) throw new Error('Sign in to One Little Teacher Cloud before viewing recovery points.')
  const folder = `${rootPath(session.user.id)}/${VERSION_FOLDER}`
  const { data, error } = await supabase.storage.from(BUCKET).list(folder, {
    limit: KEEP_VERSIONS,
    sortBy: { column: 'created_at', order: 'desc' },
  })
  if (error) throw error
  const versions = (data ?? []).map((item) => ({
    id: item.id || item.name,
    name: item.name,
    path: `${folder}/${item.name}`,
    createdAt: item.created_at || item.updated_at || null,
    updatedAt: item.updated_at || null,
    size: Number(item.metadata?.size || 0),
    kind: 'version',
  }))

  if (versions.length) return versions

  // Compatibility for the first-generation single-file backup created before
  // version history existed. It remains restorable until a new backup creates versions.
  const { data: legacy, error: legacyError } = await supabase.storage.from(BUCKET).list(rootPath(session.user.id), {
    limit: 20,
    sortBy: { column: 'updated_at', order: 'desc' },
  })
  if (legacyError) throw legacyError
  const latest = (legacy ?? []).find((item) => item.name === LATEST_FILE)
  return latest ? [{
    id: latest.id || LATEST_FILE,
    name: LATEST_FILE,
    path: latestPath(session.user.id),
    createdAt: latest.updated_at || latest.created_at || null,
    updatedAt: latest.updated_at || null,
    size: Number(latest.metadata?.size || 0),
    kind: 'legacy-latest',
  }] : []
}

export async function restoreCloudRecoveryPoint(point) {
  const session = await getCloudSession()
  if (!session?.user) throw new Error('Sign in to One Little Teacher Cloud before restoring.')
  if (!point?.path || !point.path.startsWith(`${rootPath(session.user.id)}/`)) throw new Error('That recovery point is not valid for this account.')
  return downloadAndRestore(point.path, point.name || 'little-stories-recovery.littlestories.zip')
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
