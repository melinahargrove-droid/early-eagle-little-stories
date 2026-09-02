import { useEffect, useState } from 'react'
import { db, ensurePersistentStorage } from './db/database.js'

export default function App() {
  const [storageState, setStorageState] = useState('Checking storage…')

  useEffect(() => {
    let mounted = true

    async function initialize() {
      try {
        await db.open()
        const persistent = await ensurePersistentStorage()
        if (mounted) {
          setStorageState(
            persistent
              ? 'Saved on this device • persistent storage enabled'
              : 'Saved on this device • persistent storage not yet confirmed',
          )
        }
      } catch (error) {
        console.error(error)
        if (mounted) setStorageState('Storage needs attention')
      }
    }

    initialize()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <main className="app-shell">
      <section className="home-screen">
        <header className="brand-header">
          <p className="eyebrow">Early Eagle Academy</p>
          <h1>Little Stories</h1>
          <p className="tagline">Classroom memories made into books.</p>
        </header>

        <button className="primary-action" type="button">
          <span aria-hidden="true">＋</span>
          Create a Book
        </button>

        <section className="library-section" aria-labelledby="books-heading">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Your classroom bookshelf</p>
              <h2 id="books-heading">Your Books</h2>
            </div>
            <button className="icon-button" type="button" aria-label="Search books">
              ⌕
            </button>
          </div>

          <div className="empty-state">
            <div className="book-placeholder" aria-hidden="true">
              <span>Little<br />Stories</span>
            </div>
            <h3>Your first story starts here.</h3>
            <p>
              Choose a title, pick a theme, add your classroom photos, and Little Stories will build the pages for you.
            </p>
          </div>
        </section>

        <footer className="backup-bar">
          <div className="backup-icon" aria-hidden="true">☁</div>
          <div>
            <strong>Automatic saving is on.</strong>
            <span>{storageState}</span>
          </div>
        </footer>
      </section>
    </main>
  )
}
