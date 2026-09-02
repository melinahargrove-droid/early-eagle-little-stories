import { useEffect, useRef, useState } from 'react'
import { exportPortableBackup, downloadBackup, getBackupStatus, inspectPortableBackup, restorePortableBackup } from './backupService.js'
import CloudBackupControl from './CloudBackupControl.jsx'

function formatDate(value) {
  if (!value) return 'Never'
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
  catch { return value }
}

export default function BackupDock() {
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [pendingRestore, setPendingRestore] = useState(null)
  const [pendingManifest, setPendingManifest] = useState(null)

  async function refreshStatus() { setStatus(await getBackupStatus()) }
  useEffect(() => { refreshStatus() }, [])

  async function handleExport() {
    setBusy(true); setMessage('')
    try {
      const result = await exportPortableBackup()
      downloadBackup(result.blob, result.filename)
      setMessage(`Backup created: ${result.manifest.counts.books} books and ${result.manifest.counts.photos} photos.`)
      await refreshStatus()
    } catch (error) {
      console.error(error)
      setMessage('Backup could not be created. Nothing in Little Stories was changed.')
    } finally { setBusy(false) }
  }

  async function chooseRestore(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true); setMessage('')
    try {
      const manifest = await inspectPortableBackup(file)
      setPendingRestore(file); setPendingManifest(manifest)
    } catch (error) {
      console.error(error); setMessage(error.message || 'That backup could not be read.')
    } finally { setBusy(false) }
  }

  async function confirmRestore() {
    if (!pendingRestore) return
    setBusy(true); setMessage('')
    try {
      const result = await restorePortableBackup(pendingRestore)
      setPendingRestore(null); setPendingManifest(null)
      await refreshStatus()
      setMessage(`Restore complete: ${result.bookCount} books and ${result.photoCount} photos restored. Reloading Little Stories…`)
      setTimeout(() => window.location.reload(), 700)
    } catch (error) {
      console.error(error)
      setMessage(error.message || 'Restore failed. Your existing Little Stories data was left unchanged unless the final restore transaction completed.')
      setBusy(false)
    }
  }

  return (
    <>
      <button className="backup-fab" type="button" onClick={() => setOpen(true)} aria-label="Backup and recovery">☁</button>
      {open && <div className="backup-modal-backdrop" onClick={() => !busy && setOpen(false)}>
        <section className="backup-modal" onClick={(e) => e.stopPropagation()}>
          <div className="backup-modal-heading"><div><p className="backup-kicker">Data Safety</p><h2>Backup & Recovery</h2></div><button className="backup-close" type="button" onClick={() => setOpen(false)} disabled={busy}>×</button></div>

          <div className="backup-status-card"><strong>Portable backup</strong><span>Last exported: {formatDate(status?.lastBackedUpAt)}</span>{status?.lastRestoredAt && <span>Last restored: {formatDate(status.lastRestoredAt)}</span>}</div>

          <div className="cloud-backup-section">
            <p className="backup-kicker">Automatic Off-Device Backup</p>
            <h3>Google Drive</h3>
            <p className="backup-copy">Little Stories can keep one hidden recovery copy in your Google Drive app-data space. It is only accessible to Little Stories and uses the limited Drive app-data permission.</p>
            <CloudBackupControl />
            <p className="cloud-note">Google requires you to reconnect after browser authorization expires. Little Stories will never show “backed up” unless a Drive upload actually completed.</p>
          </div>

          <p className="backup-copy">A portable backup contains your books, pages, original photos, thumbnails, themes, and saved metadata. Save the downloaded file somewhere off your phone as an additional recovery copy.</p>
          <button className="backup-primary" type="button" onClick={handleExport} disabled={busy}>{busy ? 'Working…' : 'Export Complete Backup'}</button>
          <button className="backup-secondary" type="button" onClick={() => inputRef.current?.click()} disabled={busy}>Restore From Backup</button>
          <input ref={inputRef} className="backup-file-input" type="file" accept=".zip,.littlestories" onChange={chooseRestore} />

          <div className="backup-warning"><strong>Important:</strong> restoring a backup replaces the Little Stories data currently stored on this device. The file is checked before anything is replaced.</div>
          {message && <div className="backup-message">{message}</div>}
        </section>
      </div>}

      {pendingRestore && pendingManifest && <div className="backup-modal-backdrop"><section className="backup-modal confirm-restore"><p className="backup-kicker">Ready to Restore</p><h2>Replace local data?</h2><p className="backup-copy">This backup was created {formatDate(pendingManifest.createdAt)} and contains <strong>{pendingManifest.counts.books} books</strong> and <strong>{pendingManifest.counts.photos} photos</strong>.</p><div className="backup-warning"><strong>This will replace the books currently stored on this device.</strong> Little Stories verifies the backup file and photo checksums before the replacement transaction begins.</div><button className="backup-danger" type="button" onClick={confirmRestore} disabled={busy}>{busy ? 'Restoring…' : 'Yes, Restore This Backup'}</button><button className="backup-secondary" type="button" onClick={() => { setPendingRestore(null); setPendingManifest(null) }} disabled={busy}>Cancel</button></section></div>}
    </>
  )
}
