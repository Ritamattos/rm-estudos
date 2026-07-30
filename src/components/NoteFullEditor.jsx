import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Highlight from '@tiptap/extension-highlight'
import {
  ArrowLeft, Check, Bold, Italic, Heading1, Heading2, Heading3,
  List, ListOrdered, Link as LinkIcon, Image as ImageIcon,
  Highlighter, FileDown,
} from 'lucide-react'
import ResizableImage from './ResizableImage'
import Modal from './Modal'
import styles from './NoteFullEditor.module.css'
import { exportNoteToPdf } from '../lib/exportNotePdf'

const HIGHLIGHT_COLORS = [
  { label: 'Amarelo', value: '#fef08a' },
  { label: 'Verde', value: '#bbf7d0' },
  { label: 'Azul', value: '#bfdbfe' },
  { label: 'Rosa', value: '#fbcfe8' },
  { label: 'Laranja', value: '#fed7aa' },
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// TipTap's Link mark becomes "inclusive" whenever autolink is on, meaning
// text typed right after a link silently keeps inheriting the link mark.
// Force it back off so finishing a link and continuing to type produces
// plain text again.
const NonBleedingLink = Link.extend({
  inclusive() {
    return false
  },
})

export default function NoteFullEditor({ note, store, onClose }) {
  const [title, setTitle] = useState(note.title || '')
  const [date, setDate] = useState(note.note_date || todayISO())
  const [saving, setSaving] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)
  const [linkModal, setLinkModal] = useState(null)
  const [highlightOpen, setHighlightOpen] = useState(false)
  const imgInputRef = useRef()
  const highlightRef = useRef()
  const contentAreaRef = useRef()

  const editor = useEditor({
    extensions: [
      StarterKit,
      NonBleedingLink.configure({
        openOnClick: true,
        autolink: true,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      ResizableImage,
      Highlight.configure({ multicolor: true }),
    ],
    content: note.content || '',
  })

  useEffect(() => {
    if (!highlightOpen) return
    function handleClick(e) {
      if (highlightRef.current && !highlightRef.current.contains(e.target)) {
        setHighlightOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [highlightOpen])

  function openLinkModal() {
    if (!editor) return
    const isEditingLink = editor.isActive('link')
    // A manual selection of plain (non-link) text means the user picked
    // the exact text they want as the label — keep it as-is and only ask
    // for the URL. Editing an existing link always shows both fields
    // (whether the cursor was just placed inside it or part of it was
    // selected) so the name can be changed too, not just the URL.
    const hideNameField = !editor.state.selection.empty && !isEditingLink

    if (isEditingLink) {
      // Expand to cover the whole link so applying the modal replaces
      // its text+href together, instead of inserting new text next to it
      // (which duplicated the URL) or leaving it unrenameable.
      editor.chain().extendMarkRange('link').run()
    }

    const { from, to, empty } = editor.state.selection
    const selectedText = empty ? '' : editor.state.doc.textBetween(from, to, ' ')
    const prevHref = editor.getAttributes('link').href || ''
    setLinkModal({ isEditingLink, hideNameField, text: selectedText, url: prevHref })
  }

  function applyLink() {
    if (!editor || !linkModal) return
    const { from, to } = editor.state.selection
    const url = linkModal.url.trim()
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      setLinkModal(null)
      return
    }
    const finalUrl = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`
    if (linkModal.hideNameField) {
      // Keep the exact text the user selected; just (re)apply the mark.
      editor.chain().focus().extendMarkRange('link').setLink({ href: finalUrl }).run()
    } else {
      // Fresh insert at the cursor, or replacing an existing link's
      // text+href together (range covers the whole link in that case).
      const text = linkModal.text.trim() || finalUrl
      editor.chain().focus().insertContentAt({ from, to }, {
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

  async function handleExportPdf() {
    if (!contentAreaRef.current || exportingPdf) return
    setExportingPdf(true)
    try {
      // contentAreaRef itself scrolls (overflow-y: auto) and is clipped to the
      // viewport, so capturing it would only grab what's visible on screen.
      // Its .editor child has no height constraint and lays out to the note's
      // full content height, so that's the node html2canvas needs to capture.
      const captureTarget = contentAreaRef.current.querySelector(`.${styles.editor}`) || contentAreaRef.current
      await exportNoteToPdf(captureTarget, title.trim() || 'Sem título')
    } finally {
      setExportingPdf(false)
    }
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
        <button className={styles.pdfBtn} onClick={handleExportPdf} disabled={exportingPdf} title="Exportar PDF">
          <FileDown size={15} /> {exportingPdf ? 'Exportando...' : 'Exportar PDF'}
        </button>
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
        <div className={styles.highlightWrap} ref={highlightRef}>
          <button
            type="button"
            className={editor?.isActive('highlight') ? styles.active : ''}
            onClick={() => setHighlightOpen(o => !o)}
            title="Marca-texto"
          ><Highlighter size={15} /></button>
          {highlightOpen && (
            <div className={styles.highlightPopover}>
              {HIGHLIGHT_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  className={styles.colorSwatch}
                  style={{ background: c.value }}
                  title={c.label}
                  onClick={() => {
                    editor.chain().focus().setHighlight({ color: c.value }).run()
                    setHighlightOpen(false)
                  }}
                />
              ))}
              <button
                type="button"
                className={styles.colorSwatchClear}
                title="Remover destaque"
                onClick={() => {
                  editor.chain().focus().unsetHighlight().run()
                  setHighlightOpen(false)
                }}
              >✕</button>
            </div>
          )}
        </div>
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

      <div className={styles.contentArea} ref={contentAreaRef}>
        <EditorContent editor={editor} className={styles.editor} />
      </div>

      {linkModal && (
        <Modal
          title={linkModal.isEditingLink || linkModal.hideNameField ? 'Editar link' : 'Inserir link'}
          onClose={() => setLinkModal(null)}
          onSave={applyLink}
          saveLabel={linkModal.isEditingLink || linkModal.hideNameField ? 'Salvar' : 'Inserir'}
        >
          {!linkModal.hideNameField && (
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
              autoFocus={linkModal.hideNameField}
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
