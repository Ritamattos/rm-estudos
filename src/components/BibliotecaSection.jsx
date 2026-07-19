import { useState, useRef, useEffect } from 'react'
import { Plus, Search, LayoutGrid, List, Star, Pencil, Trash2, ExternalLink, X, MoreHorizontal, BookOpen, ShoppingCart } from 'lucide-react'
import { useBookStore } from '../hooks/useBookStore'
import { useDragReorder } from '../hooks/useDragReorder'
import styles from './BibliotecaSection.module.css'

const STATUS_OPTS = [
  { value: 'quero_ler', label: 'Quero ler',  color: '#94a3b8' },
  { value: 'lendo',     label: 'Lendo',       color: '#f59e0b' },
  { value: 'lido',      label: 'Lido',        color: '#4ade80' },
]

function StarRating({ value, onChange, size = 18 }) {
  const [hover, setHover] = useState(0)
  return (
    <div className={styles.starRow}>
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button"
          className={`${styles.starBtn} ${n <= (hover || value || 0) ? styles.starOn : ''}`}
          style={{'--sz': `${size}px`}}
          onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
          onClick={() => onChange && onChange(n === value ? null : n)}>
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
      {[1,2,3,4,5].map(n => (
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
            {book.author   && <p className={styles.detailAuthor}>✍️ {book.author}</p>}
            {book.category && <p className={styles.detailCategory}>🏷️ {book.category}</p>}
            {book.rating   && <StarDisplay value={book.rating} size={16} />}
            {book.notes && (
              <div className={styles.detailNotes}>
                <span className={styles.detailNotesLabel}>Notas</span>
                <p>{book.notes}</p>
              </div>
            )}
            <div className={styles.detailActions}>
              {book.link_read && (
                <a href={book.link_read} target="_blank" rel="noopener noreferrer" className={styles.readBtn}>
                  <BookOpen size={15} /> Ler Agora
                </a>
              )}
              {book.link_buy && (
                <a href={book.link_buy} target="_blank" rel="noopener noreferrer" className={styles.buyBtn}>
                  <ShoppingCart size={15} /> Comprar Agora
                </a>
              )}
              {!book.link_read && !book.link_buy && book.link && (
                <a href={book.link} target="_blank" rel="noopener noreferrer" className={styles.openBtn}>
                  <ExternalLink size={15} /> Abrir
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

function BookFormModal({ initial, onClose, onSave, uploadCover, categories }) {
  const [form, setForm] = useState({
    title: '', author: '', category: '',
    status: 'quero_ler', link: '', link_read: '', link_buy: '', rating: null, notes: '', cover_url: '',
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
              <select value={form.category || ''} onChange={f('category')}>
                <option value="">— Sem categoria —</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={f('status')}>
                {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Link para leitura (Google Drive, site de leitura...)">
            <input placeholder="https://..." value={form.link_read} onChange={f('link_read')} />
          </Field>
          <Field label="Link para compra (Amazon, livraria...)">
            <input placeholder="https://..." value={form.link_buy} onChange={f('link_buy')} />
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

export default function BibliotecaSection({ user, store: appStore }) {
  const store = useBookStore(user)
  const libCats = appStore
    ? appStore.categories.filter(c => c.workspace === 'biblioteca').sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    : []
  const libCatIds = libCats.map(c => c.id)
  const { draggingId, overId, dragStart, dragOver, dragEnd, drop } = useDragReorder()

  const [selectedLibCat, setSelectedLibCat] = useState(null)
  const [catMenu, setCatMenu] = useState(null)
  const [catModal, setCatModal] = useState(null)
  const [catForm, setCatForm] = useState({ name: '', icon: '' })
  const [viewMode, setViewMode] = useState('grid')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [selectedBook, setSelectedBook] = useState(null)
  const [ctxMenu, setCtxMenu] = useState(null)

  // No more "show everything" view: always resolve to a real category.
  const effectiveLibCat = selectedLibCat && libCats.some(c => c.id === selectedLibCat.id)
    ? selectedLibCat
    : (libCats[0] || null)

  useEffect(() => {
    if ((effectiveLibCat?.id || null) !== (selectedLibCat?.id || null)) {
      setSelectedLibCat(effectiveLibCat)
    }
  }, [effectiveLibCat?.id])

  // Books with no category (or a category that no longer matches any
  // real category) would become invisible now that there's no "Todos"
  // view — fold them into the first category so they stay reachable.
  useEffect(() => {
    if (!libCats.length) return
    const validNames = new Set(libCats.map(c => c.name))
    const orphans = store.books.filter(b => !b.category || !validNames.has(b.category))
    orphans.forEach(b => store.updateBook(b.id, { category: libCats[0].name }))
  }, [libCats.length, store.books])

  const filtered = store.books.filter(b => {
    if (effectiveLibCat && b.category !== effectiveLibCat.name) return false
    if (statusFilter !== 'all' && b.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return b.title.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q) || b.category?.toLowerCase().includes(q)
    }
    return true
  })

  function openDetail(book) { setSelectedBook(book); setModal('detail') }
  function openEdit(book) { setSelectedBook(book); setModal('form') }
  function openAdd() { setSelectedBook(null); setModal('form') }
  function closeModal() { setModal(null); setSelectedBook(null) }

  async function handleSave(form) {
    const payload = {
      title: form.title.trim(),
      author: form.author?.trim() || '',
      category: form.category?.trim() || '',
      status: form.status,
      link: form.link?.trim() || '',
      link_read: form.link_read?.trim() || '',
      link_buy: form.link_buy?.trim() || '',
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

  async function saveCat() {
    if (!catForm.name.trim() || !appStore) return
    if (catModal === 'add') {
      await appStore.addCategory(catForm.name.trim(), catForm.icon || '📁', 'biblioteca')
    } else if (catModal?.id) {
      await appStore.updateCategory(catModal.id, { name: catForm.name.trim(), icon: catForm.icon || '📁' })
    }
    setCatModal(null)
    setCatForm({ name: '', icon: '' })
  }

  async function deleteCat(cat) {
    if (!confirm(`Excluir categoria "${cat.name}"?`) || !appStore) return
    await appStore.deleteCategory(cat.id)
    if (selectedLibCat?.id === cat.id) setSelectedLibCat(null)
    setCatMenu(null)
  }

  function handleContextMenu(e, book) {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, item: book })
  }

  async function handlePin(book) {
    await store.updateBook(book.id, { pinned: !book.pinned })
  }

  const counts = {
    quero_ler: store.books.filter(b => b.status === 'quero_ler').length,
    lendo:     store.books.filter(b => b.status === 'lendo').length,
    lido:      store.books.filter(b => b.status === 'lido').length,
  }

  const sorted = [...filtered].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))

  return (
    <div className={styles.wrapper} onClick={() => { setCatMenu(null); setCtxMenu(null) }}>

      <aside className={styles.libSidebar}>
        <div className={styles.libSidebarHeader}>
          <span className={styles.libSidebarTitle}>Biblioteca</span>
          {appStore && (
            <button className={styles.libAddCatBtn} title="Nova categoria"
              onClick={e => { e.stopPropagation(); setCatModal('add'); setCatForm({ name: '', icon: '' }) }}>
              <Plus size={12} />
            </button>
          )}
        </div>

        <nav className={styles.libNavList}>
          {libCats.map(cat => (
            <div key={cat.id}
              className={`${styles.libNavItemWrap} ${draggingId === cat.id ? styles.dragging : ''} ${overId === cat.id ? styles.dragOver : ''}`}
              draggable
              onDragStart={e => dragStart(e, cat.id)}
              onDragOver={e => dragOver(e, cat.id)}
              onDrop={e => drop(e, cat.id, libCatIds, appStore?.reorderCategories)}
              onDragEnd={dragEnd}>
              <button className={`${styles.libNavItem} ${effectiveLibCat?.id === cat.id ? styles.libNavActive : ''}`}
                onClick={() => setSelectedLibCat(cat)}>
                <span className={styles.libNavIcon}>{cat.icon}</span>
                <span className={styles.libNavName}>{cat.name}</span>
                <span className={styles.libMenuBtn}
                  onClick={e => { e.stopPropagation(); setCatMenu(catMenu === cat.id ? null : cat.id) }}>
                  <MoreHorizontal size={13} />
                </span>
              </button>
              {catMenu === cat.id && (
                <div className={styles.libDropdown}>
                  <button onClick={e => { e.stopPropagation(); setCatModal(cat); setCatForm({ name: cat.name, icon: cat.icon || '📁' }); setCatMenu(null) }}>
                    <Pencil size={12} /> Editar
                  </button>
                  <button className={styles.danger} onClick={e => { e.stopPropagation(); deleteCat(cat) }}>
                    <Trash2 size={12} /> Excluir
                  </button>
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className={styles.libSidebarStats}>
          {STATUS_OPTS.map(s => (
            <span key={s.value} style={{ color: s.color }} className={styles.libStatItem}>
              {counts[s.value]} {s.label.toLowerCase()}
            </span>
          ))}
        </div>
      </aside>

      <div className={styles.libMain}>
        <div className={styles.section}>
          {libCats.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📚</div>
              <p>Crie uma categoria para começar</p>
              {appStore && (
                <button className={styles.emptyBtn} onClick={() => { setCatModal('add'); setCatForm({ name: '', icon: '' }) }}>
                  + Nova categoria
                </button>
              )}
            </div>
          ) : (
          <>
          <div className={styles.topbar}>
            <div className={styles.titleArea}>
              <h1 className={styles.title}>
                {effectiveLibCat?.icon} {effectiveLibCat?.name}
              </h1>
              <span className={styles.viewCount}>{filtered.length} livro{filtered.length !== 1 ? 's' : ''}</span>
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
              <div className={styles.viewToggle}>
                <button className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewBtnActive : ''}`} onClick={() => setViewMode('grid')} title="Grade"><LayoutGrid size={16} /></button>
                <button className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`} onClick={() => setViewMode('list')} title="Lista"><List size={16} /></button>
              </div>
              <button className={styles.addBtn} onClick={openAdd}><Plus size={15} /> Adicionar livro</button>
            </div>
          </div>

          {store.loading ? (
            <div className={styles.empty}><span className={styles.loadingIcon}>◆</span></div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📚</div>
              <p>{store.books.length === 0 ? 'Sua biblioteca está vazia' : 'Nenhum livro encontrado'}</p>
              {store.books.length === 0 && <button className={styles.emptyBtn} onClick={openAdd}>+ Adicionar primeiro livro</button>}
            </div>
          ) : viewMode === 'grid' ? (
            <div className={styles.grid}>
              {sorted.map(book => {
                const status = STATUS_OPTS.find(s => s.value === book.status)
                return (
                  <div key={book.id} className={styles.card}
                    onClick={() => openDetail(book)}
                    onContextMenu={e => handleContextMenu(e, book)}>
                    <div className={`${styles.cardCover} ${book.pinned ? styles.cardCoverPinned : ''}`}>
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
                      {(book.link_read || book.link_buy) && (
                        <div className={styles.cardLinkBtns}>
                          {book.link_read && (
                            <a href={book.link_read} target="_blank" rel="noopener noreferrer"
                              className={styles.cardReadBtn} onClick={e => e.stopPropagation()}>
                              <BookOpen size={10} /> Ler Agora
                            </a>
                          )}
                          {book.link_buy && (
                            <a href={book.link_buy} target="_blank" rel="noopener noreferrer"
                              className={styles.cardBuyBtn} onClick={e => e.stopPropagation()}>
                              <ShoppingCart size={10} /> Comprar
                            </a>
                          )}
                        </div>
                      )}
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
              {sorted.map(book => {
                const status = STATUS_OPTS.find(s => s.value === book.status)
                return (
                  <div key={book.id} className={styles.listRow}>
                    <div className={styles.listCover} onClick={() => openDetail(book)}>
                      {book.cover_url ? <img src={book.cover_url} alt={book.title} /> : <span>📚</span>}
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
          </>
          )}
        </div>
      </div>

      {catModal && (
        <div className={styles.detailBg} onClick={e => { if (e.target === e.currentTarget) setCatModal(null) }}>
          <div className={styles.catModalBox}>
            <div className={styles.formHeader}>
              <span className={styles.formTitle}>{catModal === 'add' ? 'Nova categoria' : 'Editar categoria'}</span>
              <button className={styles.detailClose} onClick={() => setCatModal(null)}><X size={18} /></button>
            </div>
            <div className={styles.formBody}>
              <Field label="Nome">
                <input placeholder="Ex: Romance, Terror, GL..." value={catForm.name}
                  onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))} autoFocus
                  onKeyDown={e => e.key === 'Enter' && saveCat()} />
              </Field>
              <Field label="Ícone (emoji)">
                <input placeholder="Ex: 📚" value={catForm.icon}
                  onChange={e => setCatForm(p => ({ ...p, icon: e.target.value }))} maxLength={2} />
              </Field>
            </div>
            <div className={styles.formFooter}>
              <button className={styles.cancelBtn} onClick={() => setCatModal(null)}>Cancelar</button>
              <button className={styles.saveBtn} onClick={saveCat}>{catModal === 'add' ? 'Criar' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'detail' && selectedBook && (
        <BookDetailModal book={selectedBook} onClose={closeModal}
          onEdit={book => { setSelectedBook(book); setModal('form') }} onDelete={handleDelete} />
      )}
      {modal === 'form' && (
        <BookFormModal initial={selectedBook} onClose={closeModal}
          onSave={handleSave} uploadCover={store.uploadCover} categories={libCats} />
      )}

      {ctxMenu && (
        <>
          <div className={styles.ctxOverlay} onClick={() => setCtxMenu(null)} />
          <div className={styles.ctxMenu} style={{ top: ctxMenu.y, left: ctxMenu.x }}>
            <button onClick={() => { handlePin(ctxMenu.item); setCtxMenu(null) }}>
              {ctxMenu.item.pinned ? '📌 Desafixar' : '📌 Fixar'}
            </button>
            <button onClick={() => { openEdit(ctxMenu.item); setCtxMenu(null) }}>
              ✏️ Editar
            </button>
            <button className={styles.ctxDanger} onClick={() => { handleDelete(ctxMenu.item.id); setCtxMenu(null) }}>
              🗑️ Excluir
            </button>
          </div>
        </>
      )}
    </div>
  )
}
