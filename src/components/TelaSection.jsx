import { useState, useRef, useEffect } from 'react'
import { Plus, Search, LayoutGrid, List, Star, Pencil, Trash2, ExternalLink, X } from 'lucide-react'
import { useMediaStore } from '../hooks/useMediaStore'
import styles from './TelaSection.module.css'

const STATUS_OPTS = [
  { value: 'quero_assistir', label: 'Quero assistir', color: '#94a3b8' },
  { value: 'assistindo',     label: 'Assistindo',     color: '#f59e0b' },
  { value: 'assistido',      label: 'Assistido',      color: '#4ade80' },
]

const TYPE_OPTS = [
  { value: 'filme',   label: 'Filme',   icon: '🎬' },
  { value: 'serie',   label: 'Série',   icon: '📺' },
  { value: 'desenho', label: 'Desenho', icon: '🎨' },
  { value: 'anime',   label: 'Anime',   icon: '⛩️' },
]

const PLATFORM_OPTS = [
  'Netflix', 'Prime Video', 'Disney+', 'HBO Max', 'Apple TV+',
  'Globoplay', 'YouTube', 'Crunchyroll', 'Paramount+', 'Star+', 'Mubi', 'Outro',
]

const GENRE_SUGGESTIONS = [
  'Ação', 'Aventura', 'Comédia', 'Drama', 'Terror', 'Suspense',
  'Ficção Científica', 'Fantasia', 'Romance', 'Animação', 'Documentário',
  'Crime', 'Mistério', 'Musical', 'Biografia', 'Esporte', 'Guerra',
]

function StarRating({ value, onChange, size = 18 }) {
  const [hover, setHover] = useState(0)
  return (
    <div className={styles.starRow}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          className={`${styles.starBtn} ${n <= (hover || value || 0) ? styles.starOn : ''}`}
          style={{ '--sz': `${size}px` }}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange && onChange(n === value ? null : n)}
        >
          <Star size={size} />
        </button>
      ))}
    </div>
  )
}

function StarDisplay({ value, size = 13 }) {
  if (!value) return null
  return (
    <div className={styles.starRow}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className={`${styles.starBtn} ${styles.starStatic} ${n <= value ? styles.starOn : ''}`}>
          <Star size={size} />
        </span>
      ))}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}

function MediaDetailModal({ item, onClose, onEdit, onDelete }) {
  const status = STATUS_OPTS.find(s => s.value === item.status)
  const type = TYPE_OPTS.find(t => t.value === item.type)

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className={styles.detailBg} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.detailBox}>
        <button className={styles.detailClose} onClick={onClose}><X size={18} /></button>
        <div className={styles.detailInner}>
          <div className={styles.detailCoverWrap}>
            {item.cover_url
              ? <img src={item.cover_url} alt={item.title} className={styles.detailCover} />
              : <div className={styles.detailCoverPlaceholder}>{type?.icon || '🎬'}</div>
            }
          </div>
          <div className={styles.detailInfo}>
            <div className={styles.detailBadges}>
              <span className={styles.detailType}>{type?.icon} {type?.label}</span>
              <span className={styles.detailStatus} style={{ background: status?.color + '22', color: status?.color }}>
                {status?.label}
              </span>
            </div>
            <h2 className={styles.detailTitle}>{item.title}</h2>
            {item.genre    && <p className={styles.detailMeta}>🎭 {item.genre}</p>}
            {item.platform && <p className={styles.detailMeta}>📡 {item.platform}</p>}
            {item.rating   && <StarDisplay value={item.rating} size={16} />}
            {item.notes && (
              <div className={styles.detailNotes}>
                <span className={styles.detailNotesLabel}>Notas</span>
                <p>{item.notes}</p>
              </div>
            )}
            <div className={styles.detailActions}>
              {item.link && (
                <a href={item.link} target="_blank" rel="noopener noreferrer" className={styles.openBtn}>
                  <ExternalLink size={15} /> Assistir
                </a>
              )}
              <button className={styles.detailEditBtn} onClick={() => onEdit(item)}>
                <Pencil size={14} /> Editar
              </button>
              <button className={styles.detailDeleteBtn} onClick={() => onDelete(item.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MediaFormModal({ initial, onClose, onSave, uploadCover }) {
  const [form, setForm] = useState({
    title: '', type: 'filme', genre: '', platform: '',
    status: 'quero_assistir', link: '', rating: null, notes: '', cover_url: '',
    ...initial,
  })
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()
  const f = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }))

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  async function handleFile(e) {
    const file = e.target.files[0]; if (!file) return
    setUploading(true)
    const url = await uploadCover(file)
    if (url) setForm(p => ({ ...p, cover_url: url }))
    setUploading(false)
    e.target.value = ''
  }

  function handleSave() {
    if (!form.title.trim()) return
    onSave(form)
  }

  const isEdit = !!initial?.id

  return (
    <div className={styles.detailBg} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.formBox}>
        <div className={styles.formHeader}>
          <span className={styles.formTitle}>{isEdit ? 'Editar' : 'Adicionar'}</span>
          <button className={styles.detailClose} onClick={onClose}><X size={18} /></button>
        </div>
        <div className={styles.formBody}>
          <Field label="Título *">
            <input placeholder="Ex: Oppenheimer" value={form.title} onChange={f('title')} autoFocus />
          </Field>
          <div className={styles.formRow}>
            <Field label="Tipo">
              <select value={form.type} onChange={f('type')}>
                {TYPE_OPTS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={f('status')}>
                {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
          </div>
          <div className={styles.formRow}>
            <Field label="Gênero">
              <input
                list="media-genres"
                placeholder="Ex: Drama"
                value={form.genre}
                onChange={f('genre')}
              />
              <datalist id="media-genres">
                {GENRE_SUGGESTIONS.map(g => <option key={g} value={g} />)}
              </datalist>
            </Field>
            <Field label="Plataforma">
              <input
                list="media-platforms"
                placeholder="Ex: Netflix"
                value={form.platform}
                onChange={f('platform')}
              />
              <datalist id="media-platforms">
                {PLATFORM_OPTS.map(p => <option key={p} value={p} />)}
              </datalist>
            </Field>
          </div>
          <Field label="Link (opcional)">
            <input placeholder="https://..." value={form.link} onChange={f('link')} />
          </Field>
          <Field label="Avaliação">
            <StarRating value={form.rating} onChange={v => setForm(p => ({ ...p, rating: v }))} />
          </Field>
          <Field label="Notas (opcional)">
            <textarea placeholder="Seus comentários..." value={form.notes} onChange={f('notes')} rows={3} />
          </Field>
          <Field label="Capa (opcional)">
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
            {form.cover_url
              ? <div className={styles.coverPreview}>
                  <img src={form.cover_url} alt="capa" />
                  <button type="button" onClick={() => setForm(p => ({ ...p, cover_url: '' }))}>Remover</button>
                </div>
              : <button type="button" className={styles.uploadBtn} onClick={() => fileRef.current.click()} disabled={uploading}>
                  {uploading ? 'Enviando...' : '🖼️ Selecionar capa'}
                </button>
            }
          </Field>
        </div>
        <div className={styles.formFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
          <button className={styles.saveBtn} onClick={handleSave}>{isEdit ? 'Salvar' : 'Adicionar'}</button>
        </div>
      </div>
    </div>
  )
}

export default function TelaSection({ user }) {
  const store = useMediaStore(user)
  const [viewMode, setViewMode] = useState('grid')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [genreFilter, setGenreFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)

  const genres = [...new Set(store.media.map(m => m.genre).filter(Boolean))].sort()

  const filtered = store.media.filter(m => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false
    if (typeFilter !== 'all' && m.type !== typeFilter) return false
    if (genreFilter !== 'all' && m.genre !== genreFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return m.title.toLowerCase().includes(q) || m.genre?.toLowerCase().includes(q) || m.platform?.toLowerCase().includes(q)
    }
    return true
  })

  function openDetail(item) {
    setSelectedItem(item)
    setModal('detail')
  }

  function openEdit(item) {
    setSelectedItem(item)
    setModal('form')
  }

  function openAdd() {
    setSelectedItem(null)
    setModal('form')
  }

  function closeModal() {
    setModal(null)
    setSelectedItem(null)
  }

  async function handleSave(form) {
    const payload = {
      title: form.title.trim(),
      type: form.type,
      genre: form.genre?.trim() || '',
      platform: form.platform?.trim() || '',
      status: form.status,
      link: form.link?.trim() || '',
      rating: form.rating || null,
      notes: form.notes?.trim() || '',
      cover_url: form.cover_url?.trim() || '',
    }
    if (selectedItem?.id) {
      await store.updateMedia(selectedItem.id, payload)
    } else {
      await store.addMedia(payload)
    }
    closeModal()
  }

  async function handleDelete(id) {
    if (!confirm('Excluir?')) return
    await store.deleteMedia(id)
    closeModal()
  }

  const counts = {
    quero_assistir: store.media.filter(m => m.status === 'quero_assistir').length,
    assistindo:     store.media.filter(m => m.status === 'assistindo').length,
    assistido:      store.media.filter(m => m.status === 'assistido').length,
  }

  return (
    <div className={styles.section}>
      <div className={styles.topbar}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Cinemateca</h1>
          <div className={styles.statsRow}>
            {STATUS_OPTS.map(s => (
              <span key={s.value} className={styles.statBadge} style={{ color: s.color }}>
                {counts[s.value]} {s.label.toLowerCase()}
              </span>
            ))}
          </div>
        </div>
        <div className={styles.controls}>
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} />
            <input className={styles.search} placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Todos os status</option>
            {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className={styles.filterSelect} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">Todos os tipos</option>
            {TYPE_OPTS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
          </select>
          {genres.length > 0 && (
            <select className={styles.filterSelect} value={genreFilter} onChange={e => setGenreFilter(e.target.value)}>
              <option value="all">Todos os gêneros</option>
              {genres.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          )}
          <div className={styles.viewToggle}>
            <button className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewBtnActive : ''}`} onClick={() => setViewMode('grid')} title="Grade">
              <LayoutGrid size={16} />
            </button>
            <button className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`} onClick={() => setViewMode('list')} title="Lista">
              <List size={16} />
            </button>
          </div>
          <button className={styles.addBtn} onClick={openAdd}>
            <Plus size={15} /> Adicionar
          </button>
        </div>
      </div>

      {store.loading ? (
        <div className={styles.empty}><span className={styles.loadingIcon}>◆</span></div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🎬</div>
          <p>{store.media.length === 0 ? 'Sua lista está vazia' : 'Nenhum resultado encontrado'}</p>
          {store.media.length === 0 && (
            <button className={styles.emptyBtn} onClick={openAdd}>+ Adicionar primeiro</button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className={styles.grid}>
          {filtered.map(item => {
            const status = STATUS_OPTS.find(s => s.value === item.status)
            const type = TYPE_OPTS.find(t => t.value === item.type)
            return (
              <div key={item.id} className={styles.card} onClick={() => openDetail(item)}>
                <div className={styles.cardCover}>
                  {item.cover_url
                    ? <img src={item.cover_url} alt={item.title} />
                    : <div className={styles.cardCoverPlaceholder}>{type?.icon || '🎬'}</div>
                  }
                  <div className={styles.cardOverlay}>
                    <div className={styles.cardBadges}>
                      <span className={styles.cardType}>{type?.icon} {type?.label}</span>
                      <span className={styles.cardStatus} style={{ background: status?.color + '33', color: status?.color, border: `1px solid ${status?.color}55` }}>
                        {status?.label}
                      </span>
                    </div>
                    {item.rating && <StarDisplay value={item.rating} size={12} />}
                  </div>
                  {item.platform && (
                    <span className={styles.cardPlatform}>{item.platform}</span>
                  )}
                </div>
                <div className={styles.cardInfo}>
                  <p className={styles.cardTitle}>{item.title}</p>
                  {item.genre && <p className={styles.cardGenre}>{item.genre}</p>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className={styles.listView}>
          <div className={styles.listHeader}>
            <span>Capa</span><span>Título</span><span>Tipo</span><span>Gênero</span><span>Plataforma</span><span>Status</span><span>Avaliação</span><span></span>
          </div>
          {filtered.map(item => {
            const status = STATUS_OPTS.find(s => s.value === item.status)
            const type = TYPE_OPTS.find(t => t.value === item.type)
            return (
              <div key={item.id} className={styles.listRow}>
                <div className={styles.listCover} onClick={() => openDetail(item)}>
                  {item.cover_url
                    ? <img src={item.cover_url} alt={item.title} />
                    : <span>{type?.icon || '🎬'}</span>
                  }
                </div>
                <span className={styles.listTitle} onClick={() => openDetail(item)}>{item.title}</span>
                <span className={styles.listCell}>{type?.icon} {type?.label}</span>
                <span className={styles.listCell}>{item.genre || '—'}</span>
                <span className={styles.listCell}>{item.platform || '—'}</span>
                <span className={styles.listStatus} style={{ color: status?.color }}>{status?.label}</span>
                <span className={styles.listCell}><StarDisplay value={item.rating} size={12} /></span>
                <div className={styles.listActions}>
                  {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className={styles.listIconBtn}><ExternalLink size={13} /></a>}
                  <button className={styles.listIconBtn} onClick={() => openEdit(item)}><Pencil size={13} /></button>
                  <button className={`${styles.listIconBtn} ${styles.danger}`} onClick={() => handleDelete(item.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal === 'detail' && selectedItem && (
        <MediaDetailModal
          item={selectedItem}
          onClose={closeModal}
          onEdit={item => { setSelectedItem(item); setModal('form') }}
          onDelete={handleDelete}
        />
      )}

      {modal === 'form' && (
        <MediaFormModal
          initial={selectedItem}
          onClose={closeModal}
          onSave={handleSave}
          uploadCover={store.uploadCover}
        />
      )}
    </div>
  )
}
