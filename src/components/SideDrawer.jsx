import { X } from 'lucide-react'
import styles from './SideDrawer.module.css'

// Side list that stays docked on desktop and becomes a slide-in drawer on
// phones (≤768px), opened by the ☰ button in the workspace tab bar.
// Each section keeps its own look via `className`; this only adds the
// drawer behavior, so every side list opens and closes the same way.
export default function SideDrawer({ open = false, onClose, className = '', children, ...rest }) {
  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <aside className={`${className} ${styles.drawer} ${open ? styles.open : ''}`} {...rest}>
        {children}
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
