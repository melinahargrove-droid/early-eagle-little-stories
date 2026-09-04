import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './AppClean.jsx'
import './app-clean.css'
import './asset-crops.css'
import './ux-fixes.css'
import './home-fade-fix.css'
import './everyday-cover.css'
import './features/backup/backup.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
