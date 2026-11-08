import { createContext, useContext, useId } from 'react'
import { Sun, Moon } from 'lucide-react'
import { ACCENTS } from '../lib/theme'
import styles from './ThemeSettings.module.css'

// { isDark, onToggleTheme, accent, onAccentChange }, provided by App.
export const ThemeContext = createContext(null)

// "Aparência" block (Modo + Cor) at the foot of every side list. SideDrawer
// renders it, so each tab's menu gets the same controls from one place.
export default function ThemeSettings() {
  const theme = useContext(ThemeContext)
  const id = useId()
  if (!theme) return null
  const { isDark, onToggleTheme, accent, onAccentChange } = theme
  const setDark = dark => { if (dark !== isDark) onToggleTheme() }

  return (
    <div className={styles.wrap} onClick={e => e.stopPropagation()}>
      <span className={styles.heading}>Aparência</span>

      <div className={styles.row}>
        <span className={styles.label} id={`${id}-mode`}>Modo</span>
        <div className={styles.segmented} role="radiogroup" aria-labelledby={`${id}-mode`}>
          <button
            type="button" role="radio" aria-checked={!isDark}
            className={`${styles.option} ${!isDark ? styles.active : ''}`}
            onClick={() => setDark(false)}
          >
            <Sun size={14} /> Claro
          </button>
          <button
            type="button" role="radio" aria-checked={isDark}
            className={`${styles.option} ${isDark ? styles.active : ''}`}
            onClick={() => setDark(true)}
          >
            <Moon size={14} /> Escuro
          </button>
        </div>
      </div>

      <div className={styles.row}>
        <span className={styles.label} id={`${id}-accent`}>Cor</span>
        <div className={styles.segmented} role="radiogroup" aria-labelledby={`${id}-accent`}>
          {ACCENTS.map(a => (
            <button
              key={a.id}
              type="button" role="radio" aria-checked={accent === a.id}
              className={`${styles.option} ${accent === a.id ? styles.active : ''}`}
              onClick={() => onAccentChange(a.id)}
            >
              <span className={styles.swatch} style={{ background: a.swatch }} /> {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
