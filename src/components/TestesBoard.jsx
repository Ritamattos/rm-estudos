import { useState } from 'react'
import { Plus } from 'lucide-react'
import TestCardModal from './TestCardModal'
import styles from './TestesBoard.module.css'

const COLS = [
  { id: 'para_testar', label: 'Para Testar', color: '#60a5fa' },
  { id: 'testando',    label: 'Testando',    color: '#f59e0b' },
  { id: 'aprovado',    label: 'Aprovado',    color: '#4ade80' },
  { id: 'reprovado',   label: 'Reprovado',   color: '#f87171' },
]

const BADGES = {
  aprovado:  { label: 'Aprovado',  className: 'badgeGreen' },
  reprovado: { label: 'Reprovado', className: 'badgeRed' },
}

export default function TestesBoard({ store }) {
  const [dragId, setDragId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null) // { status, index }
  const [addingCol, setAddingCol] = useState(null)
  const [newTitle, setNewTitle] = useState('')
  const [activeCardId, setActiveCardId] = useState(null)

  function cardsFor(status) {
    return store.testOffers.filter(o => o.status === status).sort((a, b) => a.sort_order - b.sort_order)
  }

  function handleDragStart(e, id) {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragEnd() {
    setDragId(null)
    setDropTarget(null)
  }

  function handleCardDragOver(e, status, index) {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const insertIndex = e.clientY < midY ? index : index + 1
    setDropTarget({ status, index: insertIndex })
  }

  function handleColDragOver(e, status) {
    e.preventDefault()
    if (!dropTarget || dropTarget.status !== status) {
      setDropTarget({ status, index: cardsFor(status).length })
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    if (!dragId || !dropTarget) { setDragId(null); setDropTarget(null); return }
    let { status, index } = dropTarget
    const draggingCard = store.testOffers.find(o => o.id === dragId)
    if (draggingCard?.status === status) {
      const fromIndex = cardsFor(status).findIndex(c => c.id === dragId)
      if (fromIndex !== -1 && fromIndex < index) index -= 1
    }
    store.moveTestOffer(dragId, status, index)
    setDragId(null)
    setDropTarget(null)
  }

  async function submitAdd(status) {
    if (!newTitle.trim()) return
    await store.addTestOffer(newTitle.trim(), status)
    setNewTitle('')
    setAddingCol(null)
  }

  const activeCard = activeCardId ? store.testOffers.find(o => o.id === activeCardId) : null

  return (
    <div className={styles.board}>
      {COLS.map(col => {
        const cards = cardsFor(col.id)
        const isOver = dropTarget?.status === col.id

        return (
          <div key={col.id} className={styles.col}>
            <div className={styles.colHeader}>
              <span className={styles.colDot} style={{ background: col.color }} />
              <span className={styles.colTitle}>{col.label}</span>
              <span className={styles.colCount}>({cards.length})</span>
            </div>

            <div
              className={styles.colCards}
              onDragOver={e => handleColDragOver(e, col.id)}
              onDrop={handleDrop}
            >
              {cards.map((card, i) => {
                const badge = BADGES[card.status]
                return (
                  <div key={card.id}>
                    {isOver && dropTarget.index === i && <div className={styles.dropLine} />}
                    <div
                      className={`${styles.card} ${dragId === card.id ? styles.cardDragging : ''}`}
                      draggable
                      onDragStart={e => handleDragStart(e, card.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={e => handleCardDragOver(e, col.id, i)}
                      onClick={() => setActiveCardId(card.id)}
                    >
                      {badge && (
                        <span className={`${styles.badge} ${styles[badge.className]}`}>{badge.label}</span>
                      )}
                      <p className={styles.cardTitle}>{card.title}</p>
                    </div>
                  </div>
                )
              })}
              {isOver && dropTarget.index === cards.length && <div className={styles.dropLine} />}
              {cards.length === 0 && !isOver && <div className={styles.colEmpty} />}
            </div>

            {addingCol === col.id ? (
              <div className={styles.addForm}>
                <input
                  autoFocus
                  className={styles.addInput}
                  placeholder="Título do cartão..."
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') submitAdd(col.id)
                    if (e.key === 'Escape') { setAddingCol(null); setNewTitle('') }
                  }}
                />
                <div className={styles.addActions}>
                  <button className={styles.addConfirm} onClick={() => submitAdd(col.id)}>Adicionar</button>
                  <button className={styles.addCancel} onClick={() => { setAddingCol(null); setNewTitle('') }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <button className={styles.colAddBtn} onClick={() => { setAddingCol(col.id); setNewTitle('') }}>
                <Plus size={14} /> Adicionar cartão
              </button>
            )}
          </div>
        )
      })}

      {activeCard && (
        <TestCardModal
          card={activeCard}
          onClose={() => setActiveCardId(null)}
          onSave={fields => store.updateTestOffer(activeCard.id, fields)}
          onDelete={() => { store.deleteTestOffer(activeCard.id); setActiveCardId(null) }}
        />
      )}
    </div>
  )
}
