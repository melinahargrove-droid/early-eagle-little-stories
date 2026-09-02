import { db } from '../../db/database.js'

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`
}

const FLOW = [
  { layoutId: 'two-equal', count: 2 },
  { layoutId: 'one-photo', count: 1 },
  { layoutId: 'four-grid', count: 4 },
  { layoutId: 'one-large-one-small', count: 2 },
  { layoutId: 'one-photo', count: 1 },
  { layoutId: 'three-story', count: 3 },
]

export async function buildBookPages(bookId) {
  const book = await db.books.get(bookId)
  if (!book) throw new Error('Book not found')
  const photoIds = book.photoIds ?? []
  const now = new Date().toISOString()
  const pages = []
  let order = 0

  pages.push({ id: makeId('page'), bookId, order: order++, layoutId: 'cover', photoIds: photoIds.length ? [photoIds[0]] : [], title: book.title, caption: '', quote: '', speaker: '', createdAt: now, updatedAt: now })
  let cursor = 0
  let flowIndex = 0
  while (cursor < photoIds.length) {
    const pattern = FLOW[flowIndex % FLOW.length]
    const remaining = photoIds.length - cursor
    const count = Math.min(pattern.count, remaining)
    const layoutId = count === 1 ? 'one-photo' : count === 2 && pattern.count > 2 ? 'two-equal' : pattern.layoutId
    pages.push({ id: makeId('page'), bookId, order: order++, layoutId, photoIds: photoIds.slice(cursor, cursor + count), title: '', caption: '', quote: '', speaker: '', createdAt: now, updatedAt: now })
    cursor += count
    flowIndex += 1
  }
  pages.push({ id: makeId('page'), bookId, order: order++, layoutId: 'the-end', photoIds: [], title: 'The End', caption: '', quote: '', speaker: '', createdAt: now, updatedAt: now })

  await db.transaction('rw', db.pages, db.books, async () => {
    await db.pages.where('bookId').equals(bookId).delete()
    await db.pages.bulkAdd(pages)
    await db.books.update(bookId, { pageIds: pages.map((page) => page.id), status: 'built', updatedAt: now })
  })
  return pages
}

export async function getBookPages(bookId) { return db.pages.where('bookId').equals(bookId).sortBy('order') }
export async function updatePageLayout(pageId, layoutId) { await db.pages.update(pageId, { layoutId, updatedAt: new Date().toISOString() }); return db.pages.get(pageId) }

export async function updatePageText(pageId, changes) {
  const allowed = ['caption', 'quote', 'speaker', 'title']
  const safe = Object.fromEntries(Object.entries(changes).filter(([key]) => allowed.includes(key)))
  safe.updatedAt = new Date().toISOString()
  await db.pages.update(pageId, safe)
  return db.pages.get(pageId)
}

export async function updatePagePhotos(pageId, photoIds) {
  await db.pages.update(pageId, { photoIds, updatedAt: new Date().toISOString() })
  return db.pages.get(pageId)
}

export async function reorderPages(bookId, orderedIds) {
  const now = new Date().toISOString()
  await db.transaction('rw', db.pages, db.books, async () => {
    await Promise.all(orderedIds.map((id, order) => db.pages.update(id, { order, updatedAt: now })))
    await db.books.update(bookId, { pageIds: orderedIds, updatedAt: now })
  })
  return getBookPages(bookId)
}

export async function tryAnotherLook(pageId) {
  const page = await db.pages.get(pageId)
  if (!page || ['cover', 'the-end'].includes(page.layoutId)) return page
  const count = page.photoIds?.length ?? 0
  const options = count <= 1 ? ['one-photo', 'photo-caption', 'photo-quote'] : count === 2 ? ['two-equal', 'one-large-one-small', 'two-stacked'] : count === 3 ? ['three-story', 'collage-3'] : ['four-grid', 'collage-4']
  const current = Math.max(0, options.indexOf(page.layoutId))
  return updatePageLayout(pageId, options[(current + 1) % options.length])
}
