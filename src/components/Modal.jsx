import { useEffect } from 'react'
import styles from './Modal.module.css'

export default function Modal({ title, onClose, onSave, children, saveLabel = 'Salvar' }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className={styles.bg} onClick={e => { if (e.target.classList.contains(styles.bg)) onClose() }}>
      <div className={styles.box}>
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>{children}</div>
        <div className={styles.footer}>
          <button className={styles.cancel} onClick={onClose}>Cancelar</button>
          <button className={styles.save} onClick={onSave}>{saveLabel}</button>
        </div>
      </div>
    </div>
  )
}
