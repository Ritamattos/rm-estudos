// Theme = two independent choices, both kept in localStorage:
//   mode   → <html data-theme="dark|light">
//   accent → <html data-accent="purple|green">
// All colors come from CSS variables in index.css keyed on those two
// attributes. index.html applies the saved values before the first paint
// (no flash of the wrong theme); keep its inline script in sync with the
// keys and defaults below.

export const THEME_KEY = 'rm-estudos-theme'
export const ACCENT_KEY = 'rm-estudos-accent'

export const ACCENTS = [
  { id: 'purple', label: 'Roxo',  swatch: '#8b5cf6' },
  { id: 'green',  label: 'Verde', swatch: '#059669' },
]
export const DEFAULT_ACCENT = 'purple'

function read(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function write(key, value) {
  try { localStorage.setItem(key, value) } catch { /* storage unavailable */ }
}

// Dark is the default for anyone who never picked a mode (as before).
export function readIsDark() {
  return read(THEME_KEY) !== 'light'
}

export function readAccent() {
  const saved = read(ACCENT_KEY)
  return ACCENTS.some(a => a.id === saved) ? saved : DEFAULT_ACCENT
}

export function applyTheme(isDark, accent) {
  const root = document.documentElement
  root.setAttribute('data-theme', isDark ? 'dark' : 'light')
  root.setAttribute('data-accent', accent)
  write(THEME_KEY, isDark ? 'dark' : 'light')
  write(ACCENT_KEY, accent)
  // Phone status bar / installed-app title bar follows the page background.
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
  if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
}
