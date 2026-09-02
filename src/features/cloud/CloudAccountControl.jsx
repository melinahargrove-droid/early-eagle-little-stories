import { useEffect, useState } from 'react'
import { autoCloudBackupIfNeeded, getCloudStatus, restoreLatestCloudBackup, sendMagicLink, signOutCloud, uploadCloudBackup } from './cloudBackup.js'
import { supabase } from './supabaseClient.js'

function when(value) {
  if (!value) return 'Not backed up yet'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function CloudAccountControl() {
  const [status, setStatus] = useState(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function refresh() { setStatus(await getCloudStatus()) }

  useEffect(() => {
    refresh()
    if (!supabase) return undefined
    const { data } = supabase.auth.onAuthStateChange(() => { refresh(); setTimeout(() => autoCloudBackupIfNeeded().then(refresh).catch(() => {}), 250) })
    const sync = () => autoCloudBackupIfNeeded().then(refresh).catch(() => {})
    window.addEventListener('online', sync)
    document.addEventListener('visibilitychange', sync)
    const timer = window.setInterval(sync, 5 * 60 * 1000)
    return () => { data.subscription.unsubscribe(); window.removeEventListener('online', sync); document.removeEventListener('visibilitychange', sync); clearInterval(timer) }
  }, [])

  if (!status) return <div className="cloud-status">Checking Little Stories Cloud…</div>
  if (!status.configured) return <div className="cloud-status cloud-warning"><strong>Cloud setup pending</strong><span>Add the Supabase project URL and publishable key when the backend is created.</span></div>

  async function magicLink() {
    if (!email.trim()) return
    setBusy(true); setMessage('')
    try { await sendMagicLink(email); setMessage('Check your email for your Little Stories sign-in link.') }
    catch (error) { setMessage(error.message || 'Could not send the sign-in link.') }
    finally { setBusy(false) }
  }

  async function backupNow() {
    setBusy(true); setMessage('')
    try { await uploadCloudBackup(); await refresh(); setMessage('Online backup complete ✓') }
    catch (error) { setMessage(error.message || 'Online backup failed. Your device copy is still safe.') }
    finally { setBusy(false) }
  }

  async function restoreCloud() {
    if (!window.confirm('Restore your latest online backup? This replaces the Little Stories data currently on this device.')) return
    setBusy(true); setMessage('')
    try { await restoreLatestCloudBackup(); setMessage('Online backup restored. Reloading…'); setTimeout(() => location.reload(), 700) }
    catch (error) { setMessage(error.message || 'Online restore failed.') ; setBusy(false) }
  }

  if (!status.signedIn) return <div className="cloud-control"><div className="cloud-status"><strong>Little Stories Cloud</strong><span>Sign in once on this device for automatic private backup.</span></div><input className="cloud-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email address"/><button className="backup-primary" type="button" onClick={magicLink} disabled={busy || !email.trim()}>{busy ? 'Sending…' : 'Email Me a Sign-In Link'}</button>{message && <div className="backup-message">{message}</div>}</div>

  return <div className="cloud-control"><div className="cloud-status cloud-good"><strong>Saved & backed up ✓</strong><span>{status.email}</span><span>Last online backup: {when(status.lastBackedUpAt)}</span></div><button className="backup-primary" type="button" onClick={backupNow} disabled={busy}>{busy ? 'Backing up…' : 'Back Up Now'}</button><button className="backup-secondary" type="button" onClick={restoreCloud} disabled={busy}>Restore Latest Online Backup</button><button className="cloud-link" type="button" onClick={async () => { await signOutCloud(); await refresh() }}>Sign out on this device</button>{message && <div className="backup-message">{message}</div>}</div>
}
