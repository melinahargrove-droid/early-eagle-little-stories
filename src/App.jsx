import { useEffect, useMemo, useState } from 'react'
import { db, ensurePersistentStorage } from './db/database.js'
import { createBookDraft, importPhotos, listBooks, updateBookTheme } from './features/books/bookDraft.js'
import { buildBookPages, getBookPages, tryAnotherLook, updatePageLayout, updatePageText } from './features/books/bookBuilder.js'
import { getThumbnailUrl, releaseObjectUrl } from './features/photos/photoUrls.js'
import { THEMES, suggestThemes } from './features/themes/themes.js'

const STEPS = ['name', 'theme', 'photos', 'ready']
const LAYOUTS = ['one-photo', 'two-equal', 'one-large-one-small', 'two-stacked', 'three-story', 'four-grid', 'collage-4']

export default function App() {
  const [storageState, setStorageState] = useState('Checking storage…')
  const [books, setBooks] = useState([])
  const [step, setStep] = useState('home')
  const [title, setTitle] = useState('')
  const [activeBook, setActiveBook] = useState(null)
  const [selectedThemeId, setSelectedThemeId] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [importState, setImportState] = useState(null)
  const [pages, setPages] = useState([])
  const [pageIndex, setPageIndex] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const suggestedThemes = useMemo(() => suggestThemes(title), [title])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        await db.open()
        const persistent = await ensurePersistentStorage()
        const savedBooks = await listBooks()
        if (!mounted) return
        setBooks(savedBooks)
        setStorageState(persistent ? 'Saved on this device • persistent storage enabled' : 'Saved on this device • persistent storage not yet confirmed')
      } catch (error) {
        console.error(error)
        if (mounted) setStorageState('Storage needs attention')
      }
    })()
    return () => { mounted = false }
  }, [])

  function resetCreator() {
    setStep('home'); setTitle(''); setActiveBook(null); setSelectedThemeId(null); setSelectedFiles([]); setImportState(null); setPages([]); setPageIndex(0); setErrorMessage('')
  }

  async function refreshBook(bookId) {
    const book = await db.books.get(bookId)
    setActiveBook(book)
    setBooks(await listBooks())
    return book
  }

  async function handleNameContinue(event) {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) return
    try {
      const book = await createBookDraft(cleanTitle)
      setActiveBook(book); setTitle(cleanTitle); setStep('theme'); setBooks(await listBooks())
    } catch { setErrorMessage('We could not save this book yet. Please try again.') }
  }

  async function chooseTheme(themeId) {
    if (!activeBook) return
    try {
      const updatedBook = await updateBookTheme(activeBook.id, themeId)
      setSelectedThemeId(themeId); setActiveBook(updatedBook); setErrorMessage('')
    } catch { setErrorMessage('That theme was not saved. Please try again.') }
  }

  async function handleImport() {
    if (!activeBook || selectedFiles.length === 0) return
    setErrorMessage(''); setImportState({ completed: 0, total: selectedFiles.length })
    try {
      await importPhotos(activeBook.id, selectedFiles, setImportState)
      const builtPages = await buildBookPages(activeBook.id)
      await refreshBook(activeBook.id)
      setPages(builtPages); setPageIndex(0); setStep('ready')
    } catch (error) {
      console.error(error); setErrorMessage('Building stopped before it finished. Photos already saved remain safe; you can try again.'); setImportState(null)
    }
  }

  async function openBook(book) {
    const bookPages = await getBookPages(book.id)
    setActiveBook(book); setTitle(book.title); setSelectedThemeId(book.themeId); setPages(bookPages); setPageIndex(0)
    setStep(bookPages.length ? 'editor' : 'photos')
  }

  async function refreshPage(updated) {
    setPages((current) => current.map((page) => page.id === updated.id ? updated : page))
  }

  if (step === 'editor') {
    const page = pages[pageIndex]
    return <Editor book={activeBook} page={page} pageIndex={pageIndex} pageCount={pages.length} onClose={resetCreator} onPrev={() => setPageIndex((i) => Math.max(0, i - 1))} onNext={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))} onLayout={async (layout) => refreshPage(await updatePageLayout(page.id, layout))} onAnother={async () => refreshPage(await tryAnotherLook(page.id))} onCaption={async (caption) => refreshPage(await updatePageText(page.id, { caption }))} />
  }

  if (step !== 'home') return (
    <main className="app-shell"><section className="creator-screen"><CreatorHeader step={step} title={title} onClose={resetCreator} />
      {step === 'name' && <form className="creator-card name-step" onSubmit={handleNameContinue}><p className="section-kicker">Create a Book</p><h1 className="creator-title">What is this story about?</h1><p className="creator-copy">Give it the title you want to see on your classroom bookshelf.</p><label className="field-label" htmlFor="book-title">Book title</label><input id="book-title" className="title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Family Night" autoFocus maxLength={80}/>{errorMessage && <p className="error-message">{errorMessage}</p>}<button className="primary-action compact" type="submit" disabled={!title.trim()}>Continue to Themes</button></form>}
      {step === 'theme' && <section className="creator-card"><p className="section-kicker">Choose a Theme</p><h1 className="creator-title">A look for “{title}”</h1><p className="creator-copy">We put the most likely fits first. You can change the theme later without changing your photos.</p><div className="suggestion-heading"><strong>Suggested for your book</strong><button className="text-button" type="button" onClick={() => chooseTheme(suggestedThemes[0]?.id)}>✨ Surprise Me</button></div><div className="theme-grid">{THEMES.map((theme) => { const suggested = suggestedThemes.some((item) => item.id === theme.id); const selected = selectedThemeId === theme.id; return <button className={`theme-card ${selected ? 'selected' : ''}`} type="button" key={theme.id} onClick={() => chooseTheme(theme.id)}><div className="theme-cover" style={{ '--theme-accent': theme.accent }}><span className="theme-paper-detail"/><span>{title || 'Little Stories'}</span></div><div className="theme-card-copy"><strong>{theme.name}</strong><small>{theme.category}{suggested ? ' • Suggested' : ''}</small></div>{selected && <span className="selected-check">✓</span>}</button> })}</div><button className="primary-action compact" type="button" disabled={!selectedThemeId} onClick={() => setStep('photos')}>Continue with {THEMES.find((theme) => theme.id === selectedThemeId)?.name ?? 'Theme'}</button></section>}
      {step === 'photos' && <section className="creator-card"><p className="section-kicker">Add Photos</p><h1 className="creator-title">Choose the memories.</h1><p className="creator-copy">Select a whole group at once. Little Stories will arrange them into a varied first draft automatically.</p><label className="photo-picker"><span className="photo-picker-icon">＋</span><strong>{selectedFiles.length ? `${selectedFiles.length} photos selected` : 'Choose Photos'}</strong><small>From your phone or photo library</small><input type="file" accept="image/*" multiple onChange={(e) => setSelectedFiles([...e.target.files])}/></label>{importState && <div className="import-progress"><strong>Saving photos & building pages…</strong><span>{importState.completed} of {importState.total}</span><progress value={importState.completed} max={importState.total}/></div>}{errorMessage && <p className="error-message">{errorMessage}</p>}<button className="primary-action compact" type="button" disabled={!selectedFiles.length || Boolean(importState)} onClick={handleImport}>Save Photos & Build Book</button></section>}
      {step === 'ready' && <section className="creator-card ready-card"><div className="ready-book"><span>{activeBook?.title}</span></div><p className="section-kicker">Your Book Is Ready</p><h1 className="creator-title">We made {pages.length} pages.</h1><p className="creator-copy">Little Stories arranged {activeBook?.photoIds?.length ?? 0} photos into a varied first draft. Nothing is locked—you can change any page.</p><div className="safety-note">✓ Photos and book structure saved on this device</div><button className="primary-action compact" type="button" onClick={() => setStep('editor')}>Open Book</button><button className="text-button" type="button" onClick={resetCreator}>Back to Your Books</button></section>}
    </section></main>
  )

  return <main className="app-shell"><section className="home-screen"><header className="brand-header"><p className="eyebrow">Early Eagle Academy</p><h1>Little Stories</h1><p className="tagline">Classroom memories made into books.</p></header><button className="primary-action" type="button" onClick={() => setStep('name')}><span>＋</span>Create a Book</button><section className="library-section"><div className="section-heading-row"><div><p className="section-kicker">Your classroom bookshelf</p><h2>Your Books</h2></div></div>{books.length === 0 ? <div className="empty-state"><div className="book-placeholder"><span>Little<br/>Stories</span></div><h3>Your first story starts here.</h3><p>Choose a title, pick a theme, add your classroom photos, and Little Stories will build the pages for you.</p></div> : <div className="books-grid">{books.map((book) => <button className="book-card" key={book.id} type="button" onClick={() => openBook(book)}><div className="mini-book"><span>{book.title}</span></div><strong>{book.title}</strong><small>{book.photoIds?.length ?? 0} photos • {book.pageIds?.length ?? 0} pages</small><span className="device-safe">✓ Saved on device</span></button>)}</div>}</section><footer className="backup-bar"><div className="backup-icon">☁</div><div><strong>Automatic saving is on.</strong><span>{storageState}</span></div></footer></section></main>
}

function Editor({ book, page, pageIndex, pageCount, onClose, onPrev, onNext, onLayout, onAnother, onCaption }) {
  const [urls, setUrls] = useState([])
  const [showLayouts, setShowLayouts] = useState(false)
  useEffect(() => {
    let alive = true; const made = []
    ;(async () => { const next = []; for (const id of page?.photoIds ?? []) { const url = await getThumbnailUrl(id); if (url) { made.push(url); next.push(url) } } if (alive) setUrls(next) })()
    return () => { alive = false; made.forEach(releaseObjectUrl) }
  }, [page?.id])
  if (!page) return null
  return <main className="app-shell"><section className="editor-screen"><header className="editor-header"><button className="close-button" onClick={onClose}>×</button><div><strong>{book.title}</strong><span>Page {pageIndex + 1} of {pageCount} • Saved</span></div><button className="preview-button" type="button">Preview</button></header><div className={`page-canvas layout-${page.layoutId}`}><div className="page-title">{page.title}</div><div className="photo-slots">{urls.map((url, index) => <img src={url} alt="" key={url + index}/>)}</div>{page.caption && <p className="page-caption">{page.caption}</p>}{page.layoutId === 'the-end' && <div className="end-title">The End</div>}</div><div className="page-nav"><button onClick={onPrev} disabled={pageIndex === 0}>← Previous</button><strong>Page {pageIndex + 1}</strong><button onClick={onNext} disabled={pageIndex === pageCount - 1}>Next →</button></div><div className="editor-tools"><button type="button">Photos</button><button type="button" onClick={() => setShowLayouts((v) => !v)}>Layout</button><button type="button" onClick={() => { const value = window.prompt('Add a short caption', page.caption || ''); if (value !== null) onCaption(value) }}>Caption</button><button type="button">More</button></div>{showLayouts && <div className="layout-sheet"><strong>Change Layout</strong><div>{LAYOUTS.map((layout) => <button type="button" key={layout} onClick={() => { onLayout(layout); setShowLayouts(false) }}>{layout.replaceAll('-', ' ')}</button>)}</div></div>} {!['cover','the-end'].includes(page.layoutId) && <button className="another-look" type="button" onClick={onAnother}>✨ Try Another Look</button>}</section></main>
}

function CreatorHeader({ step, title, onClose }) { const currentIndex = Math.max(0, STEPS.indexOf(step)); return <header className="creator-header"><button className="close-button" type="button" onClick={onClose}>×</button><div><strong>{title || 'New Book'}</strong><span>{step === 'ready' ? 'Saved' : `Step ${currentIndex + 1} of 3`}</span></div><div className="step-dots">{[0,1,2].map((index) => <i className={index <= currentIndex ? 'active' : ''} key={index}/>)}</div></header> }
