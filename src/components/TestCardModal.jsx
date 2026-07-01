import { useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { X, Trash2, Bold, Italic, List, ListOrdered } from 'lucide-react'
import styles from './TestCardModal.module.css'

export default function TestCardModal({ card, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(card.title || '')
  const [saving, setSaving] = useState(false)

  const editor = useEditor({
    extensions: [StarterKit],
    content: card.description || '',
  })

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') handleSave() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, editor])

  async function handleSave() {
    setSaving(true)
    await onSave({
      title: title.trim() || 'Sem título',
      description: editor ? editor.getHTML() : card.description || '',
    })
    setSaving(false)
    onClose()
  }

  function handleDelete() {
    if (confirm('Excluir este cartão?')) onDelete()
  }

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) handleSave() }}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <input
            className={styles.titleInput}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título do cartão"
            autoFocus
          />
          <button className={styles.closeBtn} onClick={handleSave} title="Salvar e fechar">
            <X size={16} />
          </button>
        </div>

        <div className={styles.toolbar}>
          <button
            type="button"
            className={editor?.isActive('bold') ? styles.active : ''}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Negrito"
          ><Bold size={14} /></button>
          <button
            type="button"
            className={editor?.isActive('italic') ? styles.active : ''}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Itálico"
          ><Italic size={14} /></button>
          <div className={styles.sep} />
          <button
            type="button"
            className={editor?.isActive('bulletList') ? styles.active : ''}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Lista com marcadores"
          ><List size={14} /></button>
          <button
            type="button"
            className={editor?.isActive('orderedList') ? styles.active : ''}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Lista numerada"
          ><ListOrdered size={14} /></button>
        </div>

        <div className={styles.body}>
          <label className={styles.fieldLabel}>Descrição</label>
          <EditorContent editor={editor} className={styles.editor} />
        </div>

        <div className={styles.footer}>
          <button className={styles.deleteBtn} onClick={handleDelete}>
            <Trash2 size={14} /> Excluir
          </button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
