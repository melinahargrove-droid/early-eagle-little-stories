import { useEffect, useState } from 'react'
import { autoBackUpIfNeeded, backUpToGoogleDrive, connectGoogleDrive, getCloudBackupStatus, hasActiveDriveAuthorization, isGoogleDriveConfigured } from './googleDriveBackup.js'

function label(status) {
  if (!isGoogleDriveConfigured()) return 'Drive setup needed'
  if (!hasActiveDriveAuthorization()) return status?.lastBackedUpAt ? 'Reconnect Drive' : 'Connect Google Drive'
  if (status?.status === 'backed-up') return 'Backed up to Drive ✓'
  return 'Back up to Drive'
}

export default function CloudBackupControl() {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function refresh() { setStatus(await getCloudBackupStatus()) }

  useEffect(() => {
    refresh()
    const run = async () => {
      try { await autoBackUpIfNeeded(); await refresh() } catch { /* keep local data safe; UI remains reconnectable */ }
    }
    const interval = setInterval(run, 5 * 60 * 1000)
    const foreground = () => { if (document.visibilityState === 'visible') run() }
    window.addEventListener('online', run)
    document.addEventListener('visibilitychange', foreground)
    return () => { clearInterval(interval); window.removeEventListener('online', run); document.removeEventListener('visibilitychange', foreground) }
  }, [])

  async function handleClick() {
    if (!isGoogleDriveConfigured()) {
      setMessage('Add VITE_GOOGLE_CLIENT_ID to enable Google Drive backup.')
      return
    }
    setBusy(true); setMessage('')
    try {
      if (!hasActiveDriveAuthorization()) await connectGoogleDrive()
      const result = await backUpToGoogleDrive()
      setMessage(`Safe in Google Drive • ${result.manifest.counts.books} books • ${result.manifest.counts.photos} photos`)
      await refresh()
    } catch (error) {
      setMessage(error.message || 'Google Drive backup needs attention.')
    } finally { setBusy(false) }
  }

  return (
    <aside className="cloud-backup-control" aria-live="polite">
      <button type="button" disabled={busy} onClick={handleClick}>{busy ? 'Backing up…' : label(status)}</button>
      {status?.lastBackedUpAt && <span>Last Drive backup: {new Date(status.lastBackedUpAt).toLocaleString()}</span>}
      {message && <small>{message}</small>}
    </aside>
  )
}
