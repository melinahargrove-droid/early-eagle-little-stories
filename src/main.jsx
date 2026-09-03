import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './AppClean.jsx'
import BackupDock from './features/backup/BackupDock.jsx'
import './app-clean.css'
import './features/backup/backup.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <BackupDock />
  </React.StrictMode>,
)
