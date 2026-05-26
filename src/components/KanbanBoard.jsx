import { useState } from 'react'
import styles from './KanbanBoard.module.css'

const COLS = [
  { id: 'estudar',   label: 'Estudar',   color: '#60a5fa' },
  { id: 'estudando', label: 'Estudando', color: '#f59e0b' },
  { id: 'estudado',  label: 'Estudado',  color: '#4ade80' },
]

export default function KanbanBoard({ categoryId, cards, onAdd, onMove, onDelete }) {
  const [dragId, setDragId] = useState(null)
  const [addingCol, setAddingCol] = useState(null)
  const [newTitle, setNewTitle] = useState('')
  const [dragOverCol, setDragOverCol] = useState(null)

  function handleDragStart(e, cardId) {
    setDragId(cardId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, colId) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(colId)
  }

  function handleDrop(e, targetStatus) {
    e.preventDefault()
    setDragOverCol(null)
    if (!dragId) return
    const card = cards.find(c => c.id === dragId)
    if (card && card.status !== targetStatus) onMove(dragId, targetStatus)
    setDragId(null)
  }

  function handleDragEnd() {
    setDragId(null)
    setDragOverCol(null)
  }

  async function submitAdd(colId) {
    if (!newTitle.trim()) return
    await onAdd(categoryId, newTitle.trim(), colId)
    setNewTitle('')
    setAddingCol(null)
  }

  return (
    <div className={styles.board}>
      {COLS.map(col => {
        const colCards = cards.filter(c => c.status === col.id)
        const isOver = dragOverCol === col.id
        return (
          <div
            key={col.id}
            className={`${styles.col} ${isOver ? styles.colOver : ''}`}
            onDragOver={e => handleDragOver(e, col.id)}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={e => handleDrop(e, col.id)}
          >
            <div className={styles.colHeader}>
              <div className={styles.colDot} style={{ background: col.color }} />
              <span className={styles.colTitle}>{col.label}</span>
              <span className={styles.colCount}>{colCards.length}</span>
            </div>

            <div className={styles.colCards}>
              {colCards.map(card => (
                <div
                  key={card.id}
                  className={`${styles.kCard} ${dragId === card.id ? styles.kCardDragging : ''}`}
                  draggable
                  onDragStart={e => handleDragStart(e, card.id)}
                  onDragEnd={handleDragEnd}
                >
                  <span className={styles.kCardTitle}>{card.title}</span>
                  <button
                    className={styles.kCardDelete}
                    onClick={() => {
                      if (confirm('Remover este card?')) onDelete(card.id)
                    }}
                    title="Remover"
                  >
                    ×
                  </button>
                </div>
              ))}

              {addingCol === col.id ? (
                <div className={styles.addForm}>
                  <input
                    autoFocus
                    className={styles.addInput}
                    placeholder="Título do card..."
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') submitAdd(col.id)
                      if (e.key === 'Escape') { setAddingCol(null); setNewTitle('') }
                    }}
                  />
                  <div className={styles.addActions}>
                    <button className={styles.addConfirm} onClick={() => submitAdd(col.id)}>
                      Adicionar
                    </button>
                    <button
                      className={styles.addCancel}
                      onClick={() => { setAddingCol(null); setNewTitle('') }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className={styles.colAddBtn}
                  onClick={() => { setAddingCol(col.id); setNewTitle('') }}
                >
                  + Adicionar card
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
