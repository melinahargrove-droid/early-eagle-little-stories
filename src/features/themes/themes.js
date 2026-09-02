export const THEMES = [
  {
    id: 'classroom-keepsake', name: 'Classroom Keepsake', category: 'Classroom',
    description: 'Warm paper, gingham, school-day details, and quiet keepsake styling.',
    accent: '#6f86a8', ink: '#213a61', paper: '#fbf6ea', soft: '#dce5ef', secondary: '#b9c99f', motif: '✎', pattern: 'gingham',
    titleFont: "Georgia, 'Times New Roman', serif", bodyFont: "Arial, sans-serif", captionFont: "'Segoe Print', 'Bradley Hand', cursive",
  },
  {
    id: 'family-gathering', name: 'Family Gathering', category: 'Celebrations',
    description: 'Cozy ivory paper, soft florals, tiny hearts, and sentimental photo framing.',
    accent: '#a77f8f', ink: '#4e3b54', paper: '#fff8ee', soft: '#eddde0', secondary: '#b9c6a3', motif: '♡', pattern: 'floral',
    titleFont: "Georgia, 'Times New Roman', serif", bodyFont: "Arial, sans-serif", captionFont: "'Segoe Print', 'Bradley Hand', cursive",
  },
  {
    id: 'little-explorer', name: 'Little Explorer', category: 'Nature',
    description: 'Field-journal paper, pressed leaves, specimen labels, and hand-drawn details.',
    accent: '#72896f', ink: '#34483b', paper: '#f6f1df', soft: '#dfe6d4', secondary: '#aa8d68', motif: '⌕', pattern: 'field-notes',
    titleFont: "Georgia, 'Times New Roman', serif", bodyFont: "Arial, sans-serif", captionFont: "'Segoe Print', 'Bradley Hand', cursive",
  },
  {
    id: 'building-big-ideas', name: 'Building Big Ideas', category: 'Classroom',
    description: 'Blueprint details, graph paper, measuring marks, and subtle construction textures.',
    accent: '#587da1', ink: '#203e61', paper: '#f7f4e9', soft: '#dce8f2', secondary: '#d1ad67', motif: '⌑', pattern: 'blueprint',
    titleFont: "Georgia, 'Times New Roman', serif", bodyFont: "Arial, sans-serif", captionFont: "'Segoe Print', 'Bradley Hand', cursive",
  },
  {
    id: 'spooky-sweet', name: 'Spooky Sweet', category: 'Holidays',
    description: 'Dusty lavender, faded orange, watercolor pumpkins, moons, and tiny ink stars.',
    accent: '#806a92', ink: '#3f334e', paper: '#fbf4e8', soft: '#e8ddec', secondary: '#c8845d', motif: '✦', pattern: 'night-sky',
    titleFont: "Georgia, 'Times New Roman', serif", bodyFont: "Arial, sans-serif", captionFont: "'Segoe Print', 'Bradley Hand', cursive",
  },
  {
    id: 'christmas-magic', name: 'Christmas Magic', category: 'Holidays',
    description: 'Warm storybook Christmas with evergreen, muted cranberry, gold stars, and cream paper.',
    accent: '#6f8470', ink: '#314b3a', paper: '#fbf5e8', soft: '#dfe7db', secondary: '#a65f61', motif: '✧', pattern: 'evergreen',
    titleFont: "Georgia, 'Times New Roman', serif", bodyFont: "Arial, sans-serif", captionFont: "'Segoe Print', 'Bradley Hand', cursive",
  },
]

export function getTheme(themeId) {
  return THEMES.find((theme) => theme.id === themeId) ?? THEMES[0]
}

export function themeVars(themeId) {
  const theme = getTheme(themeId)
  return {
    '--book-accent': theme.accent,
    '--book-ink': theme.ink,
    '--book-paper': theme.paper,
    '--book-soft': theme.soft,
    '--book-secondary': theme.secondary,
    '--book-title-font': theme.titleFont,
    '--book-body-font': theme.bodyFont,
    '--book-caption-font': theme.captionFont,
  }
}

export function suggestThemes(title = '') {
  const normalized = title.toLowerCase()
  const preferredIds = []
  if (/halloween|costume|pumpkin|spooky/.test(normalized)) preferredIds.push('spooky-sweet')
  if (/christmas|holiday|winter|santa/.test(normalized)) preferredIds.push('christmas-magic')
  if (/build|block|tower|bridge|construction/.test(normalized)) preferredIds.push('building-big-ideas')
  if (/outside|nature|field trip|garden|bug|leaf|leaves|found/.test(normalized)) preferredIds.push('little-explorer')
  if (/family|family night|families/.test(normalized)) preferredIds.push('family-gathering')
  if (/first week|school|classroom|our class|first day/.test(normalized)) preferredIds.push('classroom-keepsake')
  const suggested = preferredIds.map((id) => THEMES.find((theme) => theme.id === id)).filter(Boolean)
  for (const theme of THEMES) {
    if (suggested.length >= 3) break
    if (!suggested.some((item) => item.id === theme.id)) suggested.push(theme)
  }
  return suggested.slice(0, 3)
}
