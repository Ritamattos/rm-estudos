import { useState } from 'react'
import { ExternalLink, FileText, Pencil, Trash2, ChevronDown, ChevronUp, NotebookPen } from 'lucide-react'
import styles from './ItemCard.module.css'

const TYPE_ICONS = {
  jogo: '🎮', link: '🔗', pdf: '📄', video: '🎥', nota: '📝', documento: '📋',
  note: '📝',
}

const STATUS_OPTS = [
  { value: 'quero_comecar', label: '📌 Quero começar', color: '#60a5fa' },
  { value: 'em_andamento',  label: '🔄 Em andamento',  color: '#f59e0b' },
  { value: 'concluido',     label: '✅ Concluído',      color: '#4ade80' },
]
const STATUS_VALUES = STATUS_OPTS.map(s => s.value)

export default function ItemCard({ item, cat, sub, onEdit, onDelete, onStatusChange, onOpenNote }) {
  const [expanded, setExpanded] = useState(false)

  const effectiveType = item.tipo || item.type
  const statusObj = STATUS_OPTS.find(s => s.value === (item.status || 'quero_comecar')) || STATUS_OPTS[0]

  function cycleStatus(e) {
    e.stopPropagation()
    const idx = STATUS_VALUES.indexOf(item.status || 'quero_comecar')
    const next = STATUS_VALUES[(idx + 1) % STATUS_VALUES.length]
    onStatusChange && onStatusChange(item.id, next)
  }

  const isNota  = effectiveType === 'nota' || effectiveType === 'note'
  const isPdf   = effectiveType === 'pdf'
  const isDoc   = effectiveType === 'documento'
  const isLink  = effectiveType === 'link' || effectiveType === 'video' || effectiveType === 'jogo'

  const noteHtml = item.conteudo_nota
  const notePlain = item.content

  return (
    <div className={`${styles.card} ${styles[effectiveType] || ''}`}>
      {item.cover_url && (
        <div className={styles.coverArea}>
          <img src={item.cover_url} alt={item.title} className={styles.cover} />
        </div>
      )}

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.typeIcon}>{TYPE_ICONS[effectiveType] || '📌'}</span>
          <div>
            <div className={styles.title}>{item.title}</div>
            <div className={styles.tags}>
              {cat && <span className={styles.catTag}>{cat.icon} {cat.name}</span>}
              {sub && <span className={styles.subTag}>{sub.icon} {sub.name}</span>}
            </div>
          </div>
        </div>
        <div className={styles.actions}>
          {isNota && (noteHtml || notePlain) && (
            <button className={styles.expandBtn} onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.linkBtn}>
              <ExternalLink size={14} />
            </a>
          )}
          <button className={styles.iconBtn} onClick={() => onEdit(item)}><Pencil size={13} /></button>
          <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => onDelete(item.id)}><Trash2 size={13} /></button>
        </div>
      </div>

      {item.status && (
        <button
          className={styles.statusBadge}
          style={{ background: statusObj.color + '22', color: statusObj.color, borderColor: statusObj.color + '44' }}
          onClick={cycleStatus}
          title="Clique para mudar status"
        >
          {statusObj.label}
        </button>
      )}

      {item.description && <p className={styles.desc}>{item.description}</p>}

      {(item.author || item.item_date) && (
        <div className={styles.meta}>
          {item.author && <span className={styles.metaItem}>✍️ {item.author}</span>}
          {item.item_date && <span className={styles.metaItem}>📅 {item.item_date}</span>}
        </div>
      )}

      {isNota && (
        <>
          {noteHtml ? (
            <div className={`${styles.noteContent} ${expanded ? styles.expanded : ''}`}>
              <div className={styles.noteText} dangerouslySetInnerHTML={{ __html: noteHtml }} />
              {!expanded && noteHtml.length > 300 && (
                <button className={styles.readMore} onClick={() => setExpanded(true)}>Ler mais</button>
              )}
            </div>
          ) : notePlain ? (
            <div className={`${styles.noteContent} ${expanded ? styles.expanded : ''}`}>
              <div className={styles.noteText}>{notePlain}</div>
              {!expanded && notePlain.length > 200 && (
                <button className={styles.readMore} onClick={() => setExpanded(true)}>Ler mais</button>
              )}
            </div>
          ) : null}
          <button className={styles.editNoteBtn} onClick={() => onOpenNote && onOpenNote(item)}>
            <NotebookPen size={13} /> Abrir editor de nota
          </button>
        </>
      )}

      {isPdf && item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.pdfBtn}>
          <FileText size={14} /> Abrir PDF
        </a>
      )}

      {isDoc && item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className={`${styles.pdfBtn} ${styles.docBtn}`}>
          <ExternalLink size={14} /> Abrir documento
        </a>
      )}

      {isLink && item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.openLinkBtn}>
          <ExternalLink size={14} /> Abrir Link
        </a>
      )}

      {item.source_url && (
        <a href={item.source_url} target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>
          🔍 Ver fonte
        </a>
      )}
    </div>
  )
}
