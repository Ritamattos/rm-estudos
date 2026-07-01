import { useCallback, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import {
  ArrowLeft, Check, Bold, Italic, Heading1, Heading2, Heading3,
  List, ListOrdered, Link as LinkIcon, Image as ImageIcon,
} from 'lucide-react'
import styles from './NoteFullEditor.module.css'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function NoteFullEditor({ note, store, onClose }) {
  const [title, setTitle] = useState(note.title || '')
  const [date, setDate] = useState(note.note_date || todayISO())
  const [saving, setSaving] = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)
  const imgInputRef = useRef()

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      Image,
    ],
    content: note.content || '',
  })

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href
    const url = window.prompt('URL do link', prev || 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

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
          onClick={setLink}
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
    </div>
  )
}
