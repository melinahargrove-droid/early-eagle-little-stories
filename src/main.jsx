import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './AppClean.jsx'
import DataSafetyGuard from './features/safety/DataSafetyGuard.jsx'
import './app-clean.css'
import './asset-crops.css'
import './ux-fixes.css'
import './home-fade-fix.css'
import './everyday-cover.css'
import './features/backup/backup.css'
import './features/safety/data-safety.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <DataSafetyGuard />
  </React.StrictMode>,
)
