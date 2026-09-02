import { db } from '../../db/database.js'
import { exportPortableBackup } from './backupService.js'

const GIS_URL = 'https://accounts.google.com/gsi/client'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const CLOUD_FILE_NAME = 'little-stories-automatic-backup.littlestories.zip'
let tokenClient = null
let tokenResponse = null
let scriptPromise = null

function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_URL
    script.async = true
    script.defer = true
    script.onload = resolve
    script.onerror = () => reject(new Error('Could not load Google authorization.'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

function clientId() { return import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || '' }
export function isGoogleDriveConfigured() { return Boolean(clientId()) }
export function hasActiveDriveAuthorization() { return Boolean(tokenResponse?.access_token) }

export async function getCloudBackupStatus() {
  return (await db.backupMetadata.get('google-drive-backup')) ?? { id:'google-drive-backup', status:isGoogleDriveConfigured() ? 'not-connected' : 'not-configured' }
}

export async function connectGoogleDrive() {
  if (!isGoogleDriveConfigured()) throw new Error('Google Drive backup is not configured yet.')
  await loadGoogleIdentity()
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId(), scope: DRIVE_SCOPE,
      callback: async (response) => {
        if (response.error) return reject(new Error(response.error_description || response.error))
        tokenResponse = response
        const expiresAt = Date.now() + Number(response.expires_in || 3600) * 1000
        await db.backupMetadata.put({ id:'google-drive-backup', bookId:null, status:'connected', connectedAt:new Date().toISOString(), tokenExpiresAt:new Date(expiresAt).toISOString() })
        resolve(response)
      },
      error_callback: () => reject(new Error('Google Drive authorization was closed or blocked.')),
    })
    tokenClient.requestAccessToken({ prompt: '' })
  })
}

function accessToken() {
  if (!tokenResponse?.access_token) throw new Error('Google Drive needs to be reconnected before backing up.')
  return tokenResponse.access_token
}

async function findExistingBackup(token) {
  const params = new URLSearchParams({ spaces:'appDataFolder', pageSize:'10', fields:'files(id,name,modifiedTime,size)' })
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers:{ Authorization:`Bearer ${token}` } })
  if (!response.ok) throw new Error(`Google Drive lookup failed (${response.status}).`)
  const data = await response.json()
  return (data.files ?? []).find((file) => file.name === CLOUD_FILE_NAME) ?? null
}

async function createDriveFile(blob, token) {
  const boundary = `little_stories_${crypto.randomUUID()}`
  const metadata = JSON.stringify({ name:CLOUD_FILE_NAME, parents:['appDataFolder'], mimeType:'application/zip' })
  const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,`--${boundary}\r\nContent-Type: application/zip\r\n\r\n`,blob,`\r\n--${boundary}--`], { type:`multipart/related; boundary=${boundary}` })
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size', { method:'POST', headers:{ Authorization:`Bearer ${token}`,'Content-Type':`multipart/related; boundary=${boundary}` }, body })
  if (!response.ok) throw new Error(`Google Drive upload failed (${response.status}).`)
  return response.json()
}

async function replaceDriveFile(fileId, blob, token) {
  const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,name,modifiedTime,size`, { method:'PATCH', headers:{ Authorization:`Bearer ${token}`,'Content-Type':'application/zip' }, body:blob })
  if (!response.ok) throw new Error(`Google Drive update failed (${response.status}).`)
  return response.json()
}

export async function backUpToGoogleDrive() {
  const token = accessToken()
  const { blob, manifest } = await exportPortableBackup()
  const existing = await findExistingBackup(token)
  const remote = existing ? await replaceDriveFile(existing.id, blob, token) : await createDriveFile(blob, token)
  const backedUpAt = new Date().toISOString()
  await db.backupMetadata.put({ id:'google-drive-backup', bookId:null, status:'backed-up', lastBackedUpAt:backedUpAt, remoteFileId:remote.id, remoteModifiedTime:remote.modifiedTime ?? null, bookCount:manifest.counts.books, photoCount:manifest.counts.photos })
  return { backedUpAt, remote, manifest }
}

export async function autoBackUpIfNeeded() {
  if (!tokenResponse?.access_token) return { skipped:true, reason:'authorization-required' }
  const status = await getCloudBackupStatus()
  const [books, pages, photos] = await Promise.all([db.books.toArray(), db.pages.toArray(), db.photos.toArray()])
  const newest = [...books, ...pages, ...photos].reduce((latest, item) => Math.max(latest, Date.parse(item.updatedAt || item.createdAt || 0) || 0), 0)
  const last = Date.parse(status.lastBackedUpAt || 0) || 0
  if (!newest || newest <= last) return { skipped:true, reason:'up-to-date' }
  return backUpToGoogleDrive()
}

export async function disconnectGoogleDrive() {
  tokenResponse = null
  await db.backupMetadata.put({ id:'google-drive-backup', bookId:null, status:'not-connected' })
}
