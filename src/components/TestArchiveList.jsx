import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import TestArchiveModal from './TestArchiveModal'
import styles from './TestArchiveList.module.css'

const LABELS = { aprovado: 'Aprovados', reprovado: 'Reprovados' }

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function TestArchiveList({ store, status }) {
  const [activeId, setActiveId] = useState(null)

  const items = store.testArchive
    .filter(a => a.result_status === status)
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
  const active = activeId ? store.testArchive.find(a => a.id === activeId) : null

  return (
    <>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.viewTitle}>{LABELS[status]}</h1>
          <span className={styles.viewCount}>{items.length} teste{items.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>◆</div>
          <p>Nenhum teste {status === 'aprovado' ? 'aprovado' : 'reprovado'} ainda</p>
          <span className={styles.emptyHint}>
            Mova um cartão no Quadro Kanban para {LABELS[status]} para ele aparecer aqui.
          </span>
        </div>
      ) : (
        <div className={styles.list}>
          {items.map(item => (
            <div key={item.id} className={styles.row} onClick={() => setActiveId(item.id)}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>{item.title || 'Sem título'}</span>
                <span className={styles.rowDate}>{formatDate(item.updated_at)}</span>
              </div>
              <div className={styles.rowActions}>
                <button className={styles.iconBtn} onClick={e => { e.stopPropagation(); setActiveId(item.id) }} title="Editar">
                  <Pencil size={13} />
                </button>
                <button
                  className={`${styles.iconBtn} ${styles.danger}`}
                  onClick={e => { e.stopPropagation(); if (confirm('Excluir registro?')) store.deleteArchive(item.id) }}
                  title="Excluir"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {active && (
        <TestArchiveModal
          item={active}
          onClose={() => setActiveId(null)}
          onSave={fields => store.updateArchive(active.id, fields)}
          onDelete={() => { store.deleteArchive(active.id); setActiveId(null) }}
        />
      )}
    </>
  )
}
