import { ACCENTS } from '../lib/theme'
import styles from './AccentPicker.module.css'

// Two small color dots (Roxo / Verde). The active one gets a ring.
// Used next to the light/dark toggle in the sidebar, the tab bar and the
// login screen.
export default function AccentPicker({ accent, onChange, className = '' }) {
  return (
    <div className={`${styles.picker} ${className}`} role="radiogroup" aria-label="Cor de destaque">
      {ACCENTS.map(a => (
        <button
          key={a.id}
          type="button"
          role="radio"
          aria-checked={accent === a.id}
          aria-label={a.label}
          title={`Cor: ${a.label}`}
          className={`${styles.option} ${accent === a.id ? styles.active : ''}`}
          style={{ '--swatch': a.swatch }}
          onClick={e => { e.stopPropagation(); onChange(a.id) }}
        >
          <span className={styles.dot} />
        </button>
      ))}
    </div>
  )
}
