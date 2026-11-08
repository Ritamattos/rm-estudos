import { X } from 'lucide-react'
import ThemeSettings from './ThemeSettings'
import styles from './SideDrawer.module.css'

// Side list that stays docked on desktop and becomes a slide-in drawer on
// phones (≤768px), opened by the ☰ button in the workspace tab bar.
// Each section keeps its own look via `className`; this adds the drawer
// behavior and the "Aparência" block (mode + color) at the foot, so every
// tab's menu opens the same way and carries the same theme controls.
//
// belowTabs: the list lives inside a tab's content, under the tab bar
//   (Atividades, Dados, Biblioteca, Cinemateca). On desktop it's pinned to
//   the viewport below the bar so its footer is always on screen.
// footer: extra items after the theme block (e.g. Instalar / Sair).
export default function SideDrawer({
  open = false, onClose, className = '', belowTabs = false, footer = null, children, ...rest
}) {
  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <aside
        className={`${className} ${styles.drawer} ${belowTabs ? styles.belowTabs : ''} ${open ? styles.open : ''}`}
        {...rest}
      >
        {children}
        <ThemeSettings />
        {footer}
      </aside>
    </>
  )
}

// The drawer's ✕ button, placed by each section in its own header row.
// Hidden on desktop, where the side list is always visible.
export function DrawerCloseButton({ onClose, className = '' }) {
  return (
    <button
      type="button"
      className={`${styles.closeBtn} ${className}`}
      onClick={e => { e.stopPropagation(); onClose?.() }}
      aria-label="Fechar menu"
    >
      <X size={18} />
    </button>
  )
}
