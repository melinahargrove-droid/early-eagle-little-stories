import { useEffect, useState } from 'react'
import { db, ensurePersistentStorage } from '../../db/database.js'
import { autoCloudBackupIfNeeded, getCloudStatus, listCloudRecoveryPoints, restoreLatestCloudBackup } from '../cloud/cloudBackup.js'

const CHECK_INTERVAL_MS = 120000

export default function DataSafetyGuard() {
  const [message,setMessage]=useState('Checking book safety…')
  const [kind,setKind]=useState('checking')

  useEffect(()=>{
    let cancelled=false
    let intervalId

    async function updateHomeStatus(text, tone='device') {
      if (cancelled) return
      setMessage(text)
      setKind(tone)
      const pill=document.querySelector('.saved-pill')
      if (!pill) return
      const strong=pill.querySelector('strong')
      const small=pill.querySelector('small')
      if (strong) strong.textContent = tone==='cloud' ? 'Backed up to One Little Teacher Cloud' : tone==='warning' ? 'Saved on this device only' : 'Saved on this device'
      if (small) small.textContent = text
    }

    async function runSafetyCheck({allowRestore=true}={}) {
      try {
        const persistent=await ensurePersistentStorage()
        const localBooks=await db.books.filter(book=>!book.deletedAt&&book.title?.trim()).count()
        const cloud=await getCloudStatus()

        if (cloud?.signedIn && allowRestore && localBooks===0 && navigator.onLine) {
          try {
            const points=await listCloudRecoveryPoints()
            if (points.length) {
              await updateHomeStatus('Restoring your books from cloud backup…','cloud')
              await restoreLatestCloudBackup()
              if (!cancelled) window.location.reload()
              return
            }
          } catch (error) {
            console.warn('Automatic cloud recovery was not available',error)
          }
        }

        if (cloud?.signedIn) {
          if (navigator.onLine) {
            try { await autoCloudBackupIfNeeded() } catch (error) { console.warn('Automatic cloud backup was not available',error) }
          }
          const refreshed=await getCloudStatus()
          const stamp=refreshed?.lastBackedUpAt ? new Date(refreshed.lastBackedUpAt).toLocaleString() : 'Cloud connected; first backup pending'
          await updateHomeStatus(stamp,'cloud')
          return
        }

        if (!persistent) {
          await updateHomeStatus('Browser storage is not protected. Keep a backup copy of important books.','warning')
        } else {
          await updateHomeStatus('Protected in persistent storage on this device.','device')
        }
      } catch (error) {
        console.warn('Book safety check failed',error)
        await updateHomeStatus('Could not verify backup status.','warning')
      }
    }

    runSafetyCheck()
    const onOnline=()=>runSafetyCheck({allowRestore:true})
    const onVisible=()=>{ if(document.visibilityState==='visible') runSafetyCheck({allowRestore:true}) }
    window.addEventListener('online',onOnline)
    document.addEventListener('visibilitychange',onVisible)
    intervalId=window.setInterval(()=>runSafetyCheck({allowRestore:false}),CHECK_INTERVAL_MS)

    return()=>{
      cancelled=true
      window.removeEventListener('online',onOnline)
      document.removeEventListener('visibilitychange',onVisible)
      window.clearInterval(intervalId)
    }
  },[])

  return <div className={`data-safety-status data-safety-${kind}`} aria-live="polite">{message}</div>
}
