import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react'
import NoteFullEditor from './NoteFullEditor'
import styles from './NotesSection.module.css'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(d) {
  if (!d) return ''
  const dt = new Date(`${d}T00:00:00`)
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function NotesSection({ store, workspace, catId, subId, title }) {
  const [activeNote, setActiveNote] = useState(null)
  const [dragId, setDragId] = useState(null)

  const notes = store.notes.filter(n => n.sub_id === subId)

  const sorted = useMemo(() => {
    return [...notes].sort((a, b) => a.sort_order - b.sort_order)
  }, [notes])

  function handleDragStart(e, id) {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDrop(e, targetId) {
    e.preventDefault()
    if (!dragId || dragId === targetId) { setDragId(null); return }
    const ids = sorted.map(n => n.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(targetId)
    ids.splice(from, 1)
    ids.splice(to, 0, dragId)
    store.reorderNotes(ids)
    setDragId(null)
  }

  async function createNote() {
    const note = await store.addNote({
      workspace, cat_id: catId, sub_id: subId,
      title: 'Nova nota', content: '', note_date: todayISO(),
    })
    if (note) setActiveNote(note)
  }

  if (activeNote) {
    return (
      <NoteFullEditor
        note={activeNote}
        store={store}
        onClose={() => setActiveNote(null)}
      />
    )
  }

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.viewTitle}>{title}</h1>
          <span className={styles.viewCount}>{notes.length} nota{notes.length !== 1 ? 's' : ''}</span>
        </div>
        <div className={styles.actions}>
          <button className={styles.addBtn} onClick={createNote}>
            <Plus size={15} /> Nova nota
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>◆</div>
          <p>Nenhuma nota aqui ainda</p>
          <button className={styles.emptyBtn} onClick={createNote}>+ Criar primeira nota</button>
        </div>
      ) : (
        <div className={styles.list}>
          {sorted.map(note => (
            <div
              key={note.id}
              className={`${styles.row} ${dragId === note.id ? styles.rowDragging : ''}`}
              draggable
              onDragStart={e => handleDragStart(e, note.id)}
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDrop(e, note.id)}
              onClick={() => setActiveNote(note)}
            >
              <GripVertical size={14} className={styles.grip} />
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>{note.title || 'Sem título'}</span>
                <span className={styles.rowDate}>{formatDate(note.note_date)}</span>
              </div>
              <div className={styles.rowActions}>
                <button className={styles.iconBtn} onClick={e => { e.stopPropagation(); setActiveNote(note) }} title="Editar">
                  <Pencil size={13} />
                </button>
                <button
                  className={`${styles.iconBtn} ${styles.danger}`}
                  onClick={e => { e.stopPropagation(); if (confirm('Excluir nota?')) store.deleteNote(note.id) }}
                  title="Excluir"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
