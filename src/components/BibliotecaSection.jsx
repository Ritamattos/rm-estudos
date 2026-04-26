import { useState, useRef, useEffect } from 'react'
import { Plus, Search, LayoutGrid, List, Star, Pencil, Trash2, ExternalLink, X } from 'lucide-react'
import { useBookStore } from '../hooks/useBookStore'
import styles from './BibliotecaSection.module.css'

const STATUS_OPTS = [
  { value: 'quero_ler',  label: 'Quero ler',  color: '#94a3b8' },
  { value: 'lendo',      label: 'Lendo',       color: '#f59e0b' },
  { value: 'lido',       label: 'Lido',        color: '#4ade80' },
]

const CATEGORY_SUGGESTIONS = [
  'Romance', 'Ficção Científica', 'Fantasia', 'Terror', 'Suspense',
  'Biografia', 'Marketing', 'Negócios', 'Autoajuda', 'Filosofia',
  'História', 'Ciência', 'Tecnologia', 'Arte', 'Poesia',
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

function BookDetailModal({ book, onClose, onEdit, onDelete }) {
  const status = STATUS_OPTS.find(s => s.value === book.status)
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
            {book.cover_url
              ? <img src={book.cover_url} alt={book.title} className={styles.detailCover} />
              : <div className={styles.detailCoverPlaceholder}>📚</div>
            }
          </div>
          <div className={styles.detailInfo}>
            <span className={styles.detailStatus} style={{ background: status?.color + '22', color: status?.color }}>
              {status?.label}
            </span>
            <h2 className={styles.detailTitle}>{book.title}</h2>
            {book.author && <p className={styles.detailAuthor}>✍️ {book.author}</p>}
            {book.category && <p className={styles.detailCategory}>🏷️ {book.category}</p>}
            {book.rating && <StarDisplay value={book.rating} size={16} />}
            {book.notes && (
              <div className={styles.detailNotes}>
                <span className={styles.detailNotesLabel}>Notas</span>
                <p>{book.notes}</p>
              </div>
            )}
            <div className={styles.detailActions}>
              {book.link && (
                <a href={book.link} target="_blank" rel="noopener noreferrer" className={styles.openBtn}>
                  <ExternalLink size={15} /> Abrir livro
                </a>
              )}
              <button className={styles.detailEditBtn} onClick={() => onEdit(book)}>
                <Pencil size={14} /> Editar
              </button>
              <button className={styles.detailDeleteBtn} onClick={() => onDelete(book.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BookFormModal({ initial, onClose, onSave, uploadCover }) {
  const [form, setForm] = useState({
    title: '', author: '', category: '', status: 'quero_ler',
    link: '', rating: null, notes: '', cover_url: '',
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
          <span className={styles.formTitle}>{isEdit ? 'Editar livro' : 'Adicionar livro'}</span>
          <button className={styles.detailClose} onClick={onClose}><X size={18} /></button>
        </div>
        <div className={styles.formBody}>
          <Field label="Título *">
            <input placeholder="Ex: O Poder do Hábito" value={form.title} onChange={f('title')} autoFocus />
          </Field>
          <Field label="Autor">
            <input placeholder="Ex: Charles Duhigg" value={form.author} onChange={f('author')} />
          </Field>
          <div className={styles.formRow}>
            <Field label="Categoria">
              <input
                list="book-categories"
                placeholder="Ex: Autoajuda"
                value={form.category}
                onChange={f('category')}
              />
              <datalist id="book-categories">
                {CATEGORY_SUGGESTIONS.map(c => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={f('status')}>
                {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Link (Google Drive ou URL)">
            <input placeholder="https://..." value={form.link} onChange={f('link')} />
          </Field>
          <Field label="Avaliação">
            <StarRating value={form.rating} onChange={v => setForm(p => ({ ...p, rating: v }))} />
          </Field>
          <Field label="Notas (opcional)">
            <textarea placeholder="Seus comentários sobre o livro..." value={form.notes} onChange={f('notes')} rows={3} />
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

export default function BibliotecaSection({ user }) {
  const store = useBookStore(user)
  const [viewMode, setViewMode] = useState('grid')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [selectedBook, setSelectedBook] = useState(null)

  const categories = [...new Set(store.books.map(b => b.category).filter(Boolean))].sort()

  const filtered = store.books.filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false
    if (categoryFilter !== 'all' && b.category !== categoryFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return b.title.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q) || b.category?.toLowerCase().includes(q)
    }
    return true
  })

  function openDetail(book) {
    setSelectedBook(book)
    setModal('detail')
  }

  function openEdit(book) {
    setSelectedBook(book)
    setModal('form')
  }

  function openAdd() {
    setSelectedBook(null)
    setModal('form')
  }

  function closeModal() {
    setModal(null)
    setSelectedBook(null)
  }

  async function handleSave(form) {
    const payload = {
      title: form.title.trim(),
      author: form.author?.trim() || '',
      category: form.category?.trim() || '',
      status: form.status,
      link: form.link?.trim() || '',
      rating: form.rating || null,
      notes: form.notes?.trim() || '',
      cover_url: form.cover_url?.trim() || '',
    }
    if (selectedBook?.id) {
      await store.updateBook(selectedBook.id, payload)
    } else {
      await store.addBook(payload)
    }
    closeModal()
  }

  async function handleDelete(id) {
    if (!confirm('Excluir livro?')) return
    await store.deleteBook(id)
    closeModal()
  }

  const counts = {
    quero_ler: store.books.filter(b => b.status === 'quero_ler').length,
    lendo:     store.books.filter(b => b.status === 'lendo').length,
    lido:      store.books.filter(b => b.status === 'lido').length,
  }

  return (
    <div className={styles.section}>
      <div className={styles.topbar}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Biblioteca</h1>
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
            <input className={styles.search} placeholder="Buscar livros..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Todos os status</option>
            {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className={styles.filterSelect} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="all">Todas as categorias</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className={styles.viewToggle}>
            <button className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewBtnActive : ''}`} onClick={() => setViewMode('grid')} title="Grade">
              <LayoutGrid size={16} />
            </button>
            <button className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`} onClick={() => setViewMode('list')} title="Lista">
              <List size={16} />
            </button>
          </div>
          <button className={styles.addBtn} onClick={openAdd}>
            <Plus size={15} /> Adicionar livro
          </button>
        </div>
      </div>

      {store.loading ? (
        <div className={styles.empty}><span className={styles.loadingIcon}>◆</span></div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📚</div>
          <p>{store.books.length === 0 ? 'Sua biblioteca está vazia' : 'Nenhum livro encontrado'}</p>
          {store.books.length === 0 && (
            <button className={styles.emptyBtn} onClick={openAdd}>+ Adicionar primeiro livro</button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className={styles.grid}>
          {filtered.map(book => {
            const status = STATUS_OPTS.find(s => s.value === book.status)
            return (
              <div key={book.id} className={styles.card} onClick={() => openDetail(book)}>
                <div className={styles.cardCover}>
                  {book.cover_url
                    ? <img src={book.cover_url} alt={book.title} />
                    : <div className={styles.cardCoverPlaceholder}>📚</div>
                  }
                  <div className={styles.cardOverlay}>
                    <span className={styles.cardStatus} style={{ background: status?.color + '33', color: status?.color, border: `1px solid ${status?.color}55` }}>
                      {status?.label}
                    </span>
                    {book.rating && <StarDisplay value={book.rating} size={12} />}
                  </div>
                </div>
                <div className={styles.cardInfo}>
                  <p className={styles.cardTitle}>{book.title}</p>
                  {book.author && <p className={styles.cardAuthor}>{book.author}</p>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className={styles.listView}>
          <div className={styles.listHeader}>
            <span>Capa</span><span>Título</span><span>Autor</span><span>Categoria</span><span>Status</span><span>Avaliação</span><span></span>
          </div>
          {filtered.map(book => {
            const status = STATUS_OPTS.find(s => s.value === book.status)
            return (
              <div key={book.id} className={styles.listRow}>
                <div className={styles.listCover} onClick={() => openDetail(book)}>
                  {book.cover_url
                    ? <img src={book.cover_url} alt={book.title} />
                    : <span>📚</span>
                  }
                </div>
                <span className={styles.listTitle} onClick={() => openDetail(book)}>{book.title}</span>
                <span className={styles.listCell}>{book.author || '—'}</span>
                <span className={styles.listCell}>{book.category || '—'}</span>
                <span className={styles.listStatus} style={{ color: status?.color }}>{status?.label}</span>
                <span className={styles.listCell}><StarDisplay value={book.rating} size={12} /></span>
                <div className={styles.listActions}>
                  {book.link && <a href={book.link} target="_blank" rel="noopener noreferrer" className={styles.listIconBtn}><ExternalLink size={13} /></a>}
                  <button className={styles.listIconBtn} onClick={() => openEdit(book)}><Pencil size={13} /></button>
                  <button className={`${styles.listIconBtn} ${styles.danger}`} onClick={() => handleDelete(book.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal === 'detail' && selectedBook && (
        <BookDetailModal
          book={selectedBook}
          onClose={closeModal}
          onEdit={book => { setSelectedBook(book); setModal('form') }}
          onDelete={handleDelete}
        />
      )}

      {modal === 'form' && (
        <BookFormModal
          initial={selectedBook}
          onClose={closeModal}
          onSave={handleSave}
          uploadCover={store.uploadCover}
        />
      )}
    </div>
  )
}
