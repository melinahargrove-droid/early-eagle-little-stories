export const THEMES = [
  {
    id: 'classroom-keepsake',
    name: 'Classroom Keepsake',
    category: 'Classroom',
    description: 'Warm paper, gingham, school-day details, and quiet keepsake styling.',
    accent: '#6f86a8',
  },
  {
    id: 'family-gathering',
    name: 'Family Gathering',
    category: 'Celebrations',
    description: 'Cozy ivory paper, soft florals, tiny hearts, and sentimental photo framing.',
    accent: '#a77f8f',
  },
  {
    id: 'little-explorer',
    name: 'Little Explorer',
    category: 'Nature',
    description: 'Field-journal paper, pressed leaves, specimen labels, and hand-drawn details.',
    accent: '#72896f',
  },
  {
    id: 'building-big-ideas',
    name: 'Building Big Ideas',
    category: 'Classroom',
    description: 'Blueprint details, graph paper, measuring marks, and subtle construction textures.',
    accent: '#587da1',
  },
  {
    id: 'spooky-sweet',
    name: 'Spooky Sweet',
    category: 'Holidays',
    description: 'Dusty lavender, faded orange, watercolor pumpkins, moons, and tiny ink stars.',
    accent: '#806a92',
  },
  {
    id: 'christmas-magic',
    name: 'Christmas Magic',
    category: 'Holidays',
    description: 'Warm storybook Christmas with evergreen, muted cranberry, gold stars, and cream paper.',
    accent: '#6f8470',
  },
]

export function suggestThemes(title = '') {
  const normalized = title.toLowerCase()
  const preferredIds = []

  if (/halloween|costume|pumpkin|spooky/.test(normalized)) preferredIds.push('spooky-sweet')
  if (/christmas|holiday|winter|santa/.test(normalized)) preferredIds.push('christmas-magic')
  if (/build|block|tower|bridge|construction/.test(normalized)) preferredIds.push('building-big-ideas')
  if (/outside|nature|field trip|garden|bug|leaf|leaves|found/.test(normalized)) preferredIds.push('little-explorer')
  if (/family|family night|families/.test(normalized)) preferredIds.push('family-gathering')
  if (/first week|school|classroom|our class|first day/.test(normalized)) preferredIds.push('classroom-keepsake')

  const suggested = preferredIds
    .map((id) => THEMES.find((theme) => theme.id === id))
    .filter(Boolean)

  for (const theme of THEMES) {
    if (suggested.length >= 3) break
    if (!suggested.some((item) => item.id === theme.id)) suggested.push(theme)
  }

  return suggested.slice(0, 3)
}
