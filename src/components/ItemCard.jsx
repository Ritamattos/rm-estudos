import { useState } from 'react'
import { ExternalLink, FileText, Link2, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import styles from './ItemCard.module.css'

const TYPE_ICONS = { note: '📝', link: '🔗', pdf: '📄' }
const TYPE_LABELS = { note: 'Nota', link: 'Link', pdf: 'PDF' }

export default function ItemCard({ item, cat, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`${styles.card} ${styles[item.type]}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.typeIcon}>{TYPE_ICONS[item.type]}</span>
          <div>
            <div className={styles.title}>{item.title}</div>
            {cat && <div className={styles.catTag}>{cat.icon} {cat.name}</div>}
          </div>
        </div>
        <div className={styles.actions}>
          {item.type === 'note' && item.content && (
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

      {item.description && <p className={styles.desc}>{item.description}</p>}

      {item.type === 'note' && item.content && (
        <div className={`${styles.noteContent} ${expanded ? styles.expanded : ''}`}>
          <div className={styles.noteText}>{item.content}</div>
          {!expanded && item.content.length > 200 && (
            <button className={styles.readMore} onClick={() => setExpanded(true)}>Ler mais</button>
          )}
        </div>
      )}

      {item.type === 'pdf' && item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.pdfBtn}>
          <FileText size={14} /> Abrir PDF
        </a>
      )}

      {item.type === 'link' && item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.urlPreview}>
          <Link2 size={12} />
          <span>{item.url}</span>
        </a>
      )}
    </div>
  )
}
