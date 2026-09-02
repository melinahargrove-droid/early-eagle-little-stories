import { useEffect, useMemo, useState } from 'react'
import { db, ensurePersistentStorage } from './db/database.js'
import { createBookDraft, importPhotos, listBooks, updateBookTheme } from './features/books/bookDraft.js'
import { THEMES, suggestThemes } from './features/themes/themes.js'

const STEPS = ['name', 'theme', 'photos', 'ready']

export default function App() {
  const [storageState, setStorageState] = useState('Checking storage…')
  const [books, setBooks] = useState([])
  const [step, setStep] = useState('home')
  const [title, setTitle] = useState('')
  const [activeBook, setActiveBook] = useState(null)
  const [selectedThemeId, setSelectedThemeId] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [importState, setImportState] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const suggestedThemes = useMemo(() => suggestThemes(title), [title])

  useEffect(() => {
    let mounted = true

    async function initialize() {
      try {
        await db.open()
        const persistent = await ensurePersistentStorage()
        const savedBooks = await listBooks()
        if (!mounted) return
        setBooks(savedBooks)
        setStorageState(
          persistent
            ? 'Saved on this device • persistent storage enabled'
            : 'Saved on this device • persistent storage not yet confirmed',
        )
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

  function resetCreator() {
    setStep('home')
    setTitle('')
    setActiveBook(null)
    setSelectedThemeId(null)
    setSelectedFiles([])
    setImportState(null)
    setErrorMessage('')
  }

  async function handleNameContinue(event) {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) return

    try {
      const book = await createBookDraft(cleanTitle)
      setActiveBook(book)
      setTitle(cleanTitle)
      setStep('theme')
      setBooks(await listBooks())
    } catch (error) {
      console.error(error)
      setErrorMessage('We could not save this book yet. Please try again.')
    }
  }

  async function chooseTheme(themeId) {
    if (!activeBook) return
    try {
      const updatedBook = await updateBookTheme(activeBook.id, themeId)
      setSelectedThemeId(themeId)
      setActiveBook(updatedBook)
      setErrorMessage('')
    } catch (error) {
      console.error(error)
      setErrorMessage('That theme was not saved. Please try again.')
    }
  }

  async function handleThemeContinue() {
    if (!selectedThemeId) return
    setStep('photos')
  }

  async function handleImport() {
    if (!activeBook || selectedFiles.length === 0) return
    setErrorMessage('')
    setImportState({ completed: 0, total: selectedFiles.length })

    try {
      await importPhotos(activeBook.id, selectedFiles, setImportState)
      const updatedBook = await db.books.get(activeBook.id)
      setActiveBook(updatedBook)
      setBooks(await listBooks())
      setStep('ready')
    } catch (error) {
      console.error(error)
      setErrorMessage('Photo import stopped before it finished. Photos already saved remain safe; you can try again.')
      setImportState(null)
    }
  }

  if (step !== 'home') {
    return (
      <main className="app-shell">
        <section className="creator-screen">
          <CreatorHeader step={step} title={title} onClose={resetCreator} />

          {step === 'name' && (
            <form className="creator-card name-step" onSubmit={handleNameContinue}>
              <p className="section-kicker">Create a Book</p>
              <h1 className="creator-title">What is this story about?</h1>
              <p className="creator-copy">Give it the title you want to see on your classroom bookshelf.</p>
              <label className="field-label" htmlFor="book-title">Book title</label>
              <input
                id="book-title"
                className="title-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Family Night"
                autoFocus
                maxLength={80}
              />
              {errorMessage && <p className="error-message">{errorMessage}</p>}
              <button className="primary-action compact" type="submit" disabled={!title.trim()}>
                Continue to Themes
              </button>
            </form>
          )}

          {step === 'theme' && (
            <section className="creator-card">
              <p className="section-kicker">Choose a Theme</p>
              <h1 className="creator-title">A look for “{title}”</h1>
              <p className="creator-copy">We put the most likely fits first. You can change the theme later without changing your photos.</p>

              <div className="suggestion-heading">
                <strong>Suggested for your book</strong>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => chooseTheme(suggestedThemes[0]?.id)}
                >
                  ✨ Surprise Me
                </button>
              </div>

              <div className="theme-grid">
                {THEMES.map((theme) => {
                  const suggested = suggestedThemes.some((item) => item.id === theme.id)
                  const selected = selectedThemeId === theme.id
                  return (
                    <button
                      className={`theme-card ${selected ? 'selected' : ''}`}
                      type="button"
                      key={theme.id}
                      onClick={() => chooseTheme(theme.id)}
                    >
                      <div className="theme-cover" style={{ '--theme-accent': theme.accent }}>
                        <span className="theme-paper-detail" />
                        <span>{title || 'Little Stories'}</span>
                      </div>
                      <div className="theme-card-copy">
                        <strong>{theme.name}</strong>
                        <small>{theme.category}{suggested ? ' • Suggested' : ''}</small>
                      </div>
                      {selected && <span className="selected-check" aria-label="Selected">✓</span>}
                    </button>
                  )
                })}
              </div>

              {errorMessage && <p className="error-message">{errorMessage}</p>}
              <button className="primary-action compact" type="button" disabled={!selectedThemeId} onClick={handleThemeContinue}>
                Continue with {THEMES.find((theme) => theme.id === selectedThemeId)?.name ?? 'Theme'}
              </button>
            </section>
          )}

          {step === 'photos' && (
            <section className="creator-card">
              <p className="section-kicker">Add Photos</p>
              <h1 className="creator-title">Choose the memories.</h1>
              <p className="creator-copy">Select a whole group at once. Little Stories will keep the originals for printing and create lighter previews for editing.</p>

              <label className="photo-picker">
                <span className="photo-picker-icon">＋</span>
                <strong>{selectedFiles.length ? `${selectedFiles.length} photos selected` : 'Choose Photos'}</strong>
                <small>From your phone or photo library</small>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => setSelectedFiles([...event.target.files])}
                />
              </label>

              {selectedFiles.length > 0 && (
                <div className="file-preview-list" aria-label="Selected photos">
                  {selectedFiles.slice(0, 8).map((file) => (
                    <span key={`${file.name}-${file.lastModified}`}>{file.name}</span>
                  ))}
                  {selectedFiles.length > 8 && <span>+ {selectedFiles.length - 8} more</span>}
                </div>
              )}

              {importState && (
                <div className="import-progress">
                  <strong>Saving photos safely…</strong>
                  <span>{importState.completed} of {importState.total}</span>
                  <progress value={importState.completed} max={importState.total} />
                </div>
              )}

              {errorMessage && <p className="error-message">{errorMessage}</p>}
              <button
                className="primary-action compact"
                type="button"
                disabled={!selectedFiles.length || Boolean(importState)}
                onClick={handleImport}
              >
                Save Photos & Build Book
              </button>
            </section>
          )}

          {step === 'ready' && (
            <section className="creator-card ready-card">
              <div className="ready-book" aria-hidden="true">
                <span>{activeBook?.title}</span>
              </div>
              <p className="section-kicker">Your Book Is Ready to Build</p>
              <h1 className="creator-title">{activeBook?.title}</h1>
              <p className="creator-copy">
                {activeBook?.photoIds?.length ?? 0} photos are safely stored on this device with the {THEMES.find((theme) => theme.id === activeBook?.themeId)?.name} theme.
              </p>
              <div className="safety-note">✓ Book draft saved in Little Stories</div>
              <button className="primary-action compact" type="button" onClick={resetCreator}>Back to Your Books</button>
              <p className="coming-next">Next build slice: automatic page creation and the Book Editor.</p>
            </section>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <section className="home-screen">
        <header className="brand-header">
          <p className="eyebrow">Early Eagle Academy</p>
          <h1>Little Stories</h1>
          <p className="tagline">Classroom memories made into books.</p>
        </header>

        <button className="primary-action" type="button" onClick={() => setStep('name')}>
          <span aria-hidden="true">＋</span>
          Create a Book
        </button>

        <section className="library-section" aria-labelledby="books-heading">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Your classroom bookshelf</p>
              <h2 id="books-heading">Your Books</h2>
            </div>
            <button className="icon-button" type="button" aria-label="Search books">⌕</button>
          </div>

          {books.length === 0 ? (
            <div className="empty-state">
              <div className="book-placeholder" aria-hidden="true"><span>Little<br />Stories</span></div>
              <h3>Your first story starts here.</h3>
              <p>Choose a title, pick a theme, add your classroom photos, and Little Stories will build the pages for you.</p>
            </div>
          ) : (
            <div className="books-grid">
              {books.map((book) => (
                <article className="book-card" key={book.id}>
                  <div className="mini-book"><span>{book.title}</span></div>
                  <strong>{book.title}</strong>
                  <small>{book.photoIds?.length ?? 0} photos • {book.status === 'draft' ? 'Draft' : book.status}</small>
                  <span className="device-safe">✓ Saved on device</span>
                </article>
              ))}
            </div>
          )}
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

function CreatorHeader({ step, title, onClose }) {
  const currentIndex = Math.max(0, STEPS.indexOf(step))
  return (
    <header className="creator-header">
      <button className="close-button" type="button" onClick={onClose} aria-label="Close book creator">×</button>
      <div>
        <strong>{title || 'New Book'}</strong>
        <span>{step === 'ready' ? 'Saved' : `Step ${currentIndex + 1} of 3`}</span>
      </div>
      <div className="step-dots" aria-hidden="true">
        {[0, 1, 2].map((index) => <i className={index <= currentIndex ? 'active' : ''} key={index} />)}
      </div>
    </header>
  )
}
