import { useEffect, useState } from 'react'
import { getThumbnailUrl, releaseObjectUrl } from '../photos/photoUrls.js'
import { getTheme, themeVars } from '../themes/themes.js'

function PreviewPage({ page, themeId }) {
  const [urls, setUrls] = useState([])
  const theme = getTheme(themeId)

  useEffect(() => {
    let alive = true
    const made = []
    ;(async () => {
      const next = []
      for (const id of page.photoIds ?? []) {
        const url = await getThumbnailUrl(id)
        if (url) { made.push(url); next.push(url) }
      }
      if (alive) setUrls(next)
    })()
    return () => { alive = false; made.forEach(releaseObjectUrl) }
  }, [page.id, page.photoIds])

  return (
    <article className={`print-page preview-letter-page themed-page theme-${theme.id} layout-${page.layoutId}`} style={themeVars(themeId)}>
      <div className="theme-decoration theme-decoration-a" aria-hidden="true">{theme.motif}</div>
      <div className="theme-decoration theme-decoration-b" aria-hidden="true">{theme.motif}</div>
      <div className="print-safe-zone">
        {page.layoutId === 'the-end' ? (
          <div className="end-title">The End</div>
        ) : (
          <>
            {page.title && <div className="page-title">{page.title}</div>}
            <div className="photo-slots">
              {urls.map((url, index) => <img src={url} alt="" key={`${page.id}-${index}`} />)}
            </div>
            {page.caption && <p className="page-caption">{page.caption}</p>}
            {page.quote && <figure className="page-quote"><blockquote>“{page.quote}”</blockquote>{page.speaker && <figcaption>— {page.speaker}</figcaption>}</figure>}
          </>
        )}
      </div>
    </article>
  )
}

export default function BookPreview({ book, pages, onClose }) {
  const theme = getTheme(book.themeId)
  return (
    <>
      <main className="app-shell preview-shell">
        <section className="preview-screen">
          <header className="preview-header">
            <button className="close-button" type="button" onClick={onClose}>×</button>
            <div><strong>{book.title}</strong><span>{pages.length} pages • {theme.name} • Letter 8.5 × 11 portrait</span></div>
            <button className="preview-button" type="button" onClick={() => window.print()}>Print / Save PDF</button>
          </header>
          <div className="print-check">✓ Theme applied • Printer-safe layout • Exact Letter page proportions</div>
          <div className="preview-page-stack">
            {pages.map((page) => <PreviewPage page={page} themeId={book.themeId} key={page.id} />)}
          </div>
        </section>
      </main>
      <section className="print-document" aria-hidden="true">
        {pages.map((page) => <PreviewPage page={page} themeId={book.themeId} key={`print-${page.id}`} />)}
      </section>
    </>
  )
}
