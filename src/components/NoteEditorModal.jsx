import { useRef, useEffect } from 'react'
import { Bold, Italic, List, ListOrdered, Heading2, X } from 'lucide-react'
import styles from './NoteEditorModal.module.css'

export default function NoteEditorModal({ title, initial, onClose, onSave }) {
  const editorRef = useRef()

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initial || ''
      editorRef.current.focus()
    }
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  function cmd(command, value) {
    document.execCommand(command, false, value ?? null)
    editorRef.current.focus()
  }

  return (
    <div className={styles.bg} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.box}>
        <div className={styles.header}>
          <span className={styles.title}>📌 {title || 'Nota rápida'}</span>
          <button className={styles.closeBtn} onClick={onClose}><X size={15} /></button>
        </div>
        <div className={styles.toolbar}>
          <button type="button" onMouseDown={e => { e.preventDefault(); cmd('bold') }} title="Negrito"><Bold size={14} /></button>
          <button type="button" onMouseDown={e => { e.preventDefault(); cmd('italic') }} title="Itálico"><Italic size={14} /></button>
          <div className={styles.sep} />
          <button type="button" onMouseDown={e => { e.preventDefault(); cmd('formatBlock', 'h2') }} title="Título H2"><Heading2 size={14} /></button>
          <div className={styles.sep} />
          <button type="button" onMouseDown={e => { e.preventDefault(); cmd('insertUnorderedList') }} title="Lista"><List size={14} /></button>
          <button type="button" onMouseDown={e => { e.preventDefault(); cmd('insertOrderedList') }} title="Lista numerada"><ListOrdered size={14} /></button>
        </div>
        <div
          ref={editorRef}
          className={styles.editor}
          contentEditable
          suppressContentEditableWarning
        />
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
          <button className={styles.saveBtn} onClick={() => onSave(editorRef.current.innerHTML)}>Salvar nota</button>
        </div>
      </div>
    </div>
  )
}
