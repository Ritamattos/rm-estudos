import { useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import {
  ArrowLeft, Check, Bold, Italic, Heading1, Heading2, Heading3,
  List, ListOrdered, Link as LinkIcon, Image as ImageIcon,
} from 'lucide-react'
import ResizableImage from './ResizableImage'
import Modal from './Modal'
import styles from './NoteFullEditor.module.css'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function NoteFullEditor({ note, store, onClose }) {
  const [title, setTitle] = useState(note.title || '')
  const [date, setDate] = useState(note.note_date || todayISO())
  const [saving, setSaving] = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)
  const [linkModal, setLinkModal] = useState(null)
  const imgInputRef = useRef()

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: true,
        autolink: true,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      ResizableImage,
    ],
    content: note.content || '',
  })

  function openLinkModal() {
    if (!editor) return
    // If the cursor sits inside an existing link with no active selection,
    // expand the selection to the whole link so we update it in place
    // instead of inserting new text next to it.
    if (editor.isActive('link')) {
      editor.chain().extendMarkRange('link').run()
    }
    const { from, to, empty } = editor.state.selection
    const selectedText = empty ? '' : editor.state.doc.textBetween(from, to, ' ')
    const prevHref = editor.getAttributes('link').href || ''
    setLinkModal({ hasSelection: !empty, text: selectedText, url: prevHref || 'https://' })
  }

  function applyLink() {
    if (!editor || !linkModal) return
    const url = linkModal.url.trim()
    if (!url) {
      if (linkModal.hasSelection) editor.chain().focus().extendMarkRange('link').unsetLink().run()
      setLinkModal(null)
      return
    }
    const finalUrl = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`
    if (linkModal.hasSelection) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: finalUrl }).run()
    } else {
      const text = linkModal.text.trim() || finalUrl
      editor.chain().focus().insertContent({
        type: 'text',
        text,
        marks: [{ type: 'link', attrs: { href: finalUrl } }],
      }).run()
    }
    setLinkModal(null)
  }

  async function handleImagePick(e) {
    const file = e.target.files[0]
    if (!file || !editor) return
    setUploadingImg(true)
    const url = await store.uploadFile(file)
    if (url) editor.chain().focus().setImage({ src: url }).run()
    setUploadingImg(false)
    e.target.value = ''
  }

  async function handleSave() {
    setSaving(true)
    await store.updateNote(note.id, {
      title: title.trim() || 'Sem título',
      note_date: date,
      content: editor ? editor.getHTML() : note.content || '',
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={handleSave} disabled={saving} title="Salvar e voltar">
          <ArrowLeft size={16} /> Voltar
        </button>
        <input
          className={styles.titleInput}
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Título da nota"
        />
        <input
          type="date"
          className={styles.dateInput}
          value={date}
          onChange={e => setDate(e.target.value)}
        />
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          <Check size={15} /> {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      <div className={styles.toolbar}>
        <button
          type="button"
          className={editor?.isActive('bold') ? styles.active : ''}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Negrito"
        ><Bold size={15} /></button>
        <button
          type="button"
          className={editor?.isActive('italic') ? styles.active : ''}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Itálico"
        ><Italic size={15} /></button>
        <div className={styles.sep} />
        <button
          type="button"
          className={editor?.isActive('heading', { level: 1 }) ? styles.active : ''}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Título 1"
        ><Heading1 size={15} /></button>
        <button
          type="button"
          className={editor?.isActive('heading', { level: 2 }) ? styles.active : ''}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Título 2"
        ><Heading2 size={15} /></button>
        <button
          type="button"
          className={editor?.isActive('heading', { level: 3 }) ? styles.active : ''}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Título 3"
        ><Heading3 size={15} /></button>
        <div className={styles.sep} />
        <button
          type="button"
          className={editor?.isActive('bulletList') ? styles.active : ''}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Lista com marcadores"
        ><List size={15} /></button>
        <button
          type="button"
          className={editor?.isActive('orderedList') ? styles.active : ''}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Lista numerada"
        ><ListOrdered size={15} /></button>
        <div className={styles.sep} />
        <button
          type="button"
          className={editor?.isActive('link') ? styles.active : ''}
          onClick={openLinkModal}
          title="Link"
        ><LinkIcon size={15} /></button>
        <button
          type="button"
          onClick={() => imgInputRef.current?.click()}
          disabled={uploadingImg}
          title="Imagem"
        ><ImageIcon size={15} /></button>
        <input
          ref={imgInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImagePick}
        />
      </div>

      <div className={styles.contentArea}>
        <EditorContent editor={editor} className={styles.editor} />
      </div>

      {linkModal && (
        <Modal
          title={linkModal.hasSelection ? 'Editar link' : 'Inserir link'}
          onClose={() => setLinkModal(null)}
          onSave={applyLink}
          saveLabel="Inserir"
        >
          {!linkModal.hasSelection && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Texto do link</label>
              <input
                autoFocus
                placeholder="Nome que vai aparecer"
                value={linkModal.text}
                onChange={e => setLinkModal(m => ({ ...m, text: e.target.value }))}
              />
            </div>
          )}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>URL</label>
            <input
              autoFocus={linkModal.hasSelection}
              placeholder="https://..."
              value={linkModal.url}
              onChange={e => setLinkModal(m => ({ ...m, url: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') applyLink() }}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
