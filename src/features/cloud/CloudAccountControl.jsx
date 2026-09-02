import { useEffect, useState } from 'react'
import { autoCloudBackupIfNeeded, getCloudStatus, listCloudRecoveryPoints, restoreCloudRecoveryPoint, sendMagicLink, signOutCloud, uploadCloudBackup } from './cloudBackup.js'
import { supabase } from './supabaseClient.js'

function when(value) {
  if (!value) return 'Not backed up yet'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function sizeLabel(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function CloudAccountControl() {
  const [status, setStatus] = useState(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState([])

  async function refresh() { setStatus(await getCloudStatus()) }

  async function refreshHistory() {
    const points = await listCloudRecoveryPoints()
    setHistory(points)
    return points
  }

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

  if (!status) return <div className="cloud-status">Checking One Little Teacher Cloud…</div>
  if (!status.configured) return <div className="cloud-status cloud-warning"><strong>Cloud setup pending</strong><span>Add the shared One Little Teacher Supabase URL and publishable key when the backend is created.</span></div>

  async function magicLink() {
    if (!email.trim()) return
    setBusy(true); setMessage('')
    try { await sendMagicLink(email); setMessage('Check your email for your One Little Teacher sign-in link.') }
    catch (error) { setMessage(error.message || 'Could not send the sign-in link.') }
    finally { setBusy(false) }
  }

  async function backupNow() {
    setBusy(true); setMessage('')
    try { await uploadCloudBackup(); await refresh(); if (showHistory) await refreshHistory(); setMessage('Online backup complete ✓') }
    catch (error) { setMessage(error.message || 'Online backup failed. Your device copy is still safe.') }
    finally { setBusy(false) }
  }

  async function openHistory() {
    setBusy(true); setMessage('')
    try { await refreshHistory(); setShowHistory(true) }
    catch (error) { setMessage(error.message || 'Could not load recovery history.') }
    finally { setBusy(false) }
  }

  async function restorePoint(point) {
    const label = when(point.createdAt)
    if (!window.confirm(`Restore the Little Stories backup from ${label}? This replaces the Little Stories data currently on this device.`)) return
    setBusy(true); setMessage('')
    try { await restoreCloudRecoveryPoint(point); setMessage('Online backup restored. Reloading…'); setTimeout(() => location.reload(), 700) }
    catch (error) { setMessage(error.message || 'Online restore failed.'); setBusy(false) }
  }

  if (!status.signedIn) return <div className="cloud-control"><div className="cloud-status"><strong>One Little Teacher Cloud</strong><span>One private account can protect your One Little Teacher apps. Sign in once on this device for automatic Little Stories backup.</span></div><input className="cloud-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email address"/><button className="backup-primary" type="button" onClick={magicLink} disabled={busy || !email.trim()}>{busy ? 'Sending…' : 'Email Me a Sign-In Link'}</button>{message && <div className="backup-message">{message}</div>}</div>

  return <div className="cloud-control"><div className="cloud-status cloud-good"><strong>Saved & backed up ✓</strong><span>{status.email}</span><span>Latest Little Stories backup: {when(status.lastBackedUpAt)}</span><span>Up to 5 recent recovery points are kept automatically.</span></div><button className="backup-primary" type="button" onClick={backupNow} disabled={busy}>{busy ? 'Backing up…' : 'Back Up Now'}</button><button className="backup-secondary" type="button" onClick={openHistory} disabled={busy}>{busy && !showHistory ? 'Loading…' : 'View Recovery History'}</button>{showHistory && <div className="cloud-history"><div className="cloud-history-heading"><strong>Recovery History</strong><button className="cloud-link" type="button" onClick={() => setShowHistory(false)}>Hide</button></div>{history.length === 0 ? <div className="backup-message">No cloud recovery points are available yet.</div> : history.map((point, index) => <button className="cloud-recovery-point" type="button" key={point.id || point.path} onClick={() => restorePoint(point)} disabled={busy}><span><strong>{index === 0 ? 'Newest recovery point' : `Previous recovery point ${index}`}</strong><small>{when(point.createdAt)}{point.size ? ` • ${sizeLabel(point.size)}` : ''}</small></span><span>Restore</span></button>)}</div>}<button className="cloud-link" type="button" onClick={async () => { await signOutCloud(); await refresh(); setShowHistory(false); setHistory([]) }}>Sign out on this device</button>{message && <div className="backup-message">{message}</div>}</div>
}
