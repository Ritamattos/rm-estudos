import { useState, useEffect, useRef } from 'react'
import { Plus, Search, BookOpen, Briefcase, Library, Clapperboard, Tag } from 'lucide-react'
import { supabase } from './lib/supabase'
import { useStore } from './hooks/useStore'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import ItemCard from './components/ItemCard'
import KanbanBoard from './components/KanbanBoard'
import Modal from './components/Modal'
import NoteEditorModal from './components/NoteEditorModal'
import NotesSection from './components/NotesSection'
import BibliotecaSection from './components/BibliotecaSection'
import TelaSection from './components/TelaSection'
import styles from './App.module.css'

const WORKSPACES = [
  { id: 'marketing',  label: 'Marketing',  icon: <Briefcase size={15} /> },
  { id: 'pessoal',    label: 'Pessoal',    icon: <BookOpen size={15} /> },
  { id: 'biblioteca', label: 'Biblioteca', icon: <Library size={15} /> },
  { id: 'tela',       label: 'Cinemateca', icon: <Clapperboard size={15} /> },
]

const ITEM_TYPES = [
  { value: 'jogo',      label: '🎮 Jogo' },
  { value: 'link',      label: '🔗 Link' },
  { value: 'pdf',       label: '📄 PDF' },
  { value: 'video',     label: '🎥 Vídeo' },
  { value: 'nota',      label: '📝 Nota' },
  { value: 'documento', label: '📋 Documento Google' },
]

const STATUS_OPTS = [
  { value: 'quero_comecar', label: '📌 Quero começar', color: '#60a5fa' },
  { value: 'em_andamento',  label: '🔄 Em andamento',  color: '#f59e0b' },
  { value: 'concluido',     label: '✅ Concluído',      color: '#4ade80' },
]

const SUB_TYPES = [
  { value: 'notes',  label: '📝 Notas' },
  { value: 'links',  label: '🔗 Links' },
  { value: 'books',  label: '📚 Livros' },
  { value: 'videos', label: '🎬 Vídeos' },
  { value: 'mixed',  label: '📦 Misto' },
]

const TIPO_TO_TYPE = { video: 'link', pdf: 'pdf', link: 'link', jogo: 'link', documento: 'link', nota: 'note' }

function resolveEditTipo(item) {
  if (item.tipo) return item.tipo
  if (item.type === 'note') return 'nota'
  if (item.type === 'pdf')  return 'pdf'
  return 'link'
}

function Field({ label, children }) {
  return <div className={styles.field}><label className={styles.fieldLabel}>{label}</label>{children}</div>
}

const THEME_KEY = 'rm-estudos-theme'

export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isDark, setIsDark] = useState(() => localStorage.getItem(THEME_KEY) !== 'light')
  const [workspace, setWorkspace] = useState('marketing')
  const [selectedCat, setSelectedCat] = useState(null)
  const [selectedSub, setSelectedSub] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [coverUploading, setCoverUploading] = useState(false)
  const [noteItem, setNoteItem] = useState(null)
  const coverFileRef = useRef()

  const store = useStore(user)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light')
  }, [isDark])

  useEffect(() => {
    if (user && !isSpecialSection) {
      store.initDefaultTags(workspace)
    }
  }, [user, workspace])

  const f = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }))

  function openModal(type, extra = {}) { setModal(type); setForm(extra) }
  function closeModal() { setModal(null); setForm({}) }

  async function saveCategory() {
    if (!form.name?.trim()) return
    if (form.editId) {
      await store.updateCategory(form.editId, { name: form.name.trim(), icon: form.icon || '📁' })
    } else {
      await store.addCategory(form.name.trim(), form.icon, workspace)
    }
    closeModal()
  }

  async function saveSubcategory() {
    if (!form.name?.trim()) return
    if (form.editId) {
      await store.updateSubcategory(form.editId, { name: form.name.trim(), icon: form.icon || '📁', type: form.type || 'notes' })
    } else {
      await store.addSubcategory(form.name.trim(), form.icon, form.type, form.catId)
    }
    closeModal()
  }

  async function saveItem() {
    if (!form.title?.trim()) return
    const tipo = form.tipo || 'nota'
    const payload = {
      cat_id: form.cat_id || null,
      sub_id: form.sub_id || null,
      workspace,
      tipo,
      type: TIPO_TO_TYPE[tipo] || 'note',
      status: form.status || null,
      proporcao_capa: form.proporcao_capa || '16:9',
      title: form.title.trim(),
      description: form.description?.trim() || '',
      content: '',
      url: form.url?.trim() || '',
      cover_url: form.cover_url?.trim() || '',
      author: form.author?.trim() || '',
      item_date: form.item_date?.trim() || '',
      source_url: form.source_url?.trim() || '',
    }

    let itemId
    if (form.editId) {
      await store.updateItem(form.editId, payload)
      itemId = form.editId
    } else {
      const newItem = await store.addItem(payload)
      itemId = newItem?.id
    }

    if (itemId) {
      const currentTagIds = store.itemTags.filter(it => it.item_id === itemId).map(it => it.tag_id)
      const newTagIds = form.selectedTags || []
      const toAdd = newTagIds.filter(tid => !currentTagIds.includes(tid))
      const toRemove = currentTagIds.filter(tid => !newTagIds.includes(tid))
      await Promise.all([
        ...toAdd.map(tid => store.addItemTag(itemId, tid)),
        ...toRemove.map(tid => store.removeItemTag(itemId, tid)),
      ])
    }

    closeModal()
  }

  async function saveNote(html) {
    if (!noteItem) return
    await store.updateItem(noteItem.id, { conteudo_nota: html })
    setNoteItem(null)
  }

  function convertGDriveLink(url) {
    const m1 = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/)
    if (m1) return `https://drive.google.com/file/d/${m1[1]}/view`
    const m2 = url.match(/drive\.google\.com\/open\?(?:.*&)?id=([^&]+)/)
    if (m2) return `https://drive.google.com/file/d/${m2[1]}/view`
    return url
  }

  async function handleCoverUpload(e) {
    const file = e.target.files[0]; if (!file) return
    setCoverUploading(true)
    const url = await store.uploadFile(file)
    if (url) setForm(prev => ({ ...prev, cover_url: url }))
    setCoverUploading(false)
    e.target.value = ''
  }

  function toggleTagFilter(tagId) {
    setTagFilter(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    )
  }

  const cats = store.categories.filter(c => c.workspace === workspace)
  const isSpecialSection = workspace === 'biblioteca' || workspace === 'tela'
  const isKanbanView = !isSpecialSection && !!selectedCat && !selectedSub
  const isNotesView = !isSpecialSection && !!selectedSub
  const workspaceTags = store.tags.filter(t => t.workspace === workspace)

  const filtered = store.items.filter(i => {
    if (i.workspace !== workspace) return false
    if (selectedCat && i.cat_id !== selectedCat) return false
    if (selectedSub && i.sub_id !== selectedSub) return false
    if (statusFilter !== 'all' && i.status !== statusFilter) return false
    if (typeFilter !== 'all') {
      const eff = i.tipo || i.type
      if (typeFilter === 'nota') { if (eff !== 'nota' && eff !== 'note') return false }
      else if (eff !== typeFilter) return false
    }
    if (tagFilter.length > 0) {
      const tagsForItem = store.itemTags.filter(it => it.item_id === i.id).map(it => it.tag_id)
      if (!tagFilter.some(tid => tagsForItem.includes(tid))) return false
    }
    if (search) {
      const q = search.toLowerCase()
      return (
        i.title.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.content?.toLowerCase().includes(q) ||
        i.author?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const viewTitle = selectedSub
    ? store.subcategories.find(s => s.id === selectedSub)?.name
    : selectedCat
      ? cats.find(c => c.id === selectedCat)?.name
      : 'Todos'

  const subsForCat = store.subcategories.filter(s => s.cat_id === form.cat_id)
  const currentTipo = form.tipo || 'nota'

  if (authLoading) return <div className={styles.loading}><span className={styles.loadingIcon}>◆</span></div>
  if (!user) return <Login />

  return (
    <div className={styles.app}>
      {!isSpecialSection && (
        <Sidebar
          categories={store.categories}
          subcategories={store.subcategories}
          workspace={workspace}
          selectedCat={selectedCat}
          selectedSub={selectedSub}
          onSelectCat={id => { setSelectedCat(id); setSelectedSub(null); setTagFilter([]) }}
          onSelectSub={(catId, subId) => { setSelectedCat(catId); setSelectedSub(subId); setTagFilter([]) }}
          onAddCat={() => openModal('cat', { workspace })}
          onEditCat={cat => openModal('cat', { editId: cat.id, name: cat.name, icon: cat.icon })}
          onDeleteCat={id => {
            if (confirm('Excluir categoria e todas as subcategorias?')) {
              store.deleteCategory(id)
              if (selectedCat === id) { setSelectedCat(null); setSelectedSub(null) }
            }
          }}
          onAddSub={catId => openModal('sub', { catId })}
          onEditSub={sub => openModal('sub', { editId: sub.id, name: sub.name, icon: sub.icon, type: sub.type })}
          onDeleteSub={id => {
            if (confirm('Excluir subcategoria?')) {
              store.deleteSubcategory(id)
              if (selectedSub === id) setSelectedSub(null)
            }
          }}
          onLogout={() => supabase.auth.signOut()}
          isDark={isDark}
          onToggleTheme={() => setIsDark(!isDark)}
        />
      )}

      <main className={`${styles.main} ${isSpecialSection ? styles.mainFull : ''}`}>
        <div className={styles.workspaceTabs}>
          {WORKSPACES.map(w => (
            <button
              key={w.id}
              className={`${styles.tab} ${workspace === w.id ? styles.tabActive : ''}`}
              onClick={() => {
                setWorkspace(w.id)
                setSelectedCat(null)
                setSelectedSub(null)
                setStatusFilter('all')
                setTypeFilter('all')
                setTagFilter([])
              }}
            >
              {w.icon} {w.label}
            </button>
          ))}

          {isSpecialSection && (
            <div className={styles.tabsEnd}>
              <button className={styles.themeTabBtn} onClick={() => setIsDark(!isDark)}>
                {isDark ? '☀️' : '🌙'}
              </button>
              <button className={styles.logoutTabBtn} onClick={() => supabase.auth.signOut()}>
                Sair
              </button>
            </div>
          )}
        </div>

        {workspace === 'biblioteca' ? (
          <BibliotecaSection user={user} store={store} />
        ) : workspace === 'tela' ? (
          <TelaSection user={user} store={store} />
        ) : isKanbanView ? (
          <>
            <div className={styles.topbar}>
              <div>
                <h1 className={styles.viewTitle}>{viewTitle}</h1>
                <span className={styles.viewCount}>Quadro Kanban</span>
              </div>
            </div>
            <KanbanBoard
              categoryId={selectedCat}
              cards={store.kanbanCards.filter(k => k.category_id === selectedCat)}
              onAdd={store.addKanbanCard}
              onMove={(id, status) => store.updateKanbanCard(id, { status })}
              onEdit={(id, title) => store.updateKanbanCard(id, { title })}
              onDelete={store.deleteKanbanCard}
            />
          </>
        ) : isNotesView ? (
          <NotesSection
            store={store}
            workspace={workspace}
            catId={selectedCat}
            subId={selectedSub}
            title={viewTitle}
          />
        ) : (
          <>
            <div className={styles.topbar}>
              <div>
                <h1 className={styles.viewTitle}>{viewTitle}</h1>
                <span className={styles.viewCount}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
              </div>
              <div className={styles.actions}>
                <div className={styles.searchWrap}>
                  <Search size={14} className={styles.searchIcon} />
                  <input className={styles.search} placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className={styles.typeSelect} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                  <option value="all">Todos os tipos</option>
                  {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {workspaceTags.length > 0 && (
                  <button className={styles.tagsManageBtn} onClick={() => openModal('tags')}>
                    <Tag size={13} /> Tags
                  </button>
                )}
                <button className={styles.addBtn} onClick={() => openModal('item', { tipo: 'nota', status: null, proporcao_capa: '16:9', cat_id: selectedCat, sub_id: selectedSub })}>
                  <Plus size={15} /> Novo item
                </button>
              </div>
            </div>

            <div className={styles.statusFilter}>
              <button
                className={`${styles.statusBtn} ${statusFilter === 'all' ? styles.statusBtnActive : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                Todos
              </button>
              {STATUS_OPTS.map(s => (
                <button
                  key={s.value}
                  className={`${styles.statusBtn} ${statusFilter === s.value ? styles.statusBtnActive : ''}`}
                  style={statusFilter === s.value ? { background: s.color + '22', color: s.color, borderColor: s.color + '55' } : {}}
                  onClick={() => setStatusFilter(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {workspaceTags.length > 0 && (
              <div className={styles.tagFilterBar}>
                {workspaceTags.map(tag => {
                  const active = tagFilter.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      className={`${styles.tagFilterBtn} ${active ? styles.tagFilterBtnActive : ''}`}
                      style={active ? { background: tag.color + '22', color: tag.color, borderColor: tag.color + '55' } : {}}
                      onClick={() => toggleTagFilter(tag.id)}
                    >
                      {tag.name}
                    </button>
                  )
                })}
                {tagFilter.length > 0 && (
                  <button className={styles.tagFilterClear} onClick={() => setTagFilter([])}>
                    Limpar filtro
                  </button>
                )}
              </div>
            )}

            {store.loading ? (
              <div className={styles.empty}><span className={styles.loadingIcon}>◆</span></div>
            ) : filtered.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>◆</div>
                <p>Nenhum item aqui ainda</p>
                <button className={styles.emptyBtn} onClick={() => openModal('item', { tipo: 'nota', status: null, proporcao_capa: '16:9', cat_id: selectedCat, sub_id: selectedSub })}>
                  + Adicionar primeiro item
                </button>
              </div>
            ) : (
              <div className={styles.grid}>
                {filtered.map(item => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    cat={store.categories.find(c => c.id === item.cat_id)}
                    sub={store.subcategories.find(s => s.id === item.sub_id)}
                    itemTags={
                      store.itemTags
                        .filter(it => it.item_id === item.id)
                        .map(it => store.tags.find(t => t.id === it.tag_id))
                        .filter(Boolean)
                    }
                    onEdit={item => openModal('item', {
                      editId: item.id,
                      ...item,
                      tipo: resolveEditTipo(item),
                      selectedTags: store.itemTags.filter(it => it.item_id === item.id).map(it => it.tag_id),
                    })}
                    onDelete={id => { if (confirm('Excluir item?')) store.deleteItem(id) }}
                    onStatusChange={(id, status) => store.updateItem(id, { status })}
                    onOpenNote={item => setNoteItem(item)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {modal === 'cat' && (
        <Modal title={form.editId ? 'Editar categoria' : 'Nova categoria'} onClose={closeModal} onSave={saveCategory}>
          <Field label="Nome"><input placeholder="Ex: Tráfego Pago" value={form.name || ''} onChange={f('name')} autoFocus /></Field>
          <Field label="Ícone (emoji)"><input placeholder="Ex: 📊" value={form.icon || ''} onChange={f('icon')} maxLength={2} /></Field>
        </Modal>
      )}

      {modal === 'sub' && (
        <Modal title={form.editId ? 'Editar subcategoria' : 'Nova subcategoria'} onClose={closeModal} onSave={saveSubcategory}>
          <Field label="Nome"><input placeholder="Ex: Artigos" value={form.name || ''} onChange={f('name')} autoFocus /></Field>
          <Field label="Ícone (emoji)"><input placeholder="Ex: 📰" value={form.icon || ''} onChange={f('icon')} maxLength={2} /></Field>
          <Field label="Tipo">
            <select value={form.type || 'notes'} onChange={f('type')}>
              {SUB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
        </Modal>
      )}

      {modal === 'item' && (
        <Modal title={form.editId ? 'Editar item' : 'Novo item'} onClose={closeModal} onSave={saveItem} saveLabel={form.editId ? 'Salvar' : 'Adicionar'}>
          <Field label="Tipo">
            <select value={currentTipo} onChange={f('tipo')}>
              {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status || ''} onChange={f('status')}>
              <option value="">— Sem status —</option>
              {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Categoria">
            <select value={form.cat_id || ''} onChange={e => { f('cat_id')(e); setForm(prev => ({ ...prev, sub_id: '' })) }}>
              <option value="">— Sem categoria —</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </Field>
          {form.cat_id && subsForCat.length > 0 && (
            <Field label="Subcategoria">
              <select value={form.sub_id || ''} onChange={f('sub_id')}>
                <option value="">— Sem subcategoria —</option>
                {subsForCat.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Título *">
            <input placeholder="Título do item" value={form.title || ''} onChange={f('title')} autoFocus={!form.editId} />
          </Field>
          <Field label="Descrição (opcional)">
            <input placeholder="Breve descrição" value={form.description || ''} onChange={f('description')} />
          </Field>

          {currentTipo === 'nota' && (
            <div className={styles.noteHint}>
              📌 O conteúdo da nota é editado diretamente no card após criar.
            </div>
          )}

          {currentTipo === 'pdf' && (
            <Field label="Link do PDF (Google Drive)">
              <input
                placeholder="Cole o link do Google Drive aqui..."
                value={form.url || ''}
                onChange={e => setForm(prev => ({ ...prev, url: convertGDriveLink(e.target.value) }))}
              />
              <span className={styles.fieldHint}>📋 No Google Drive: Compartilhar → "Qualquer pessoa com o link" → copiar</span>
            </Field>
          )}

          {currentTipo === 'documento' && (
            <Field label="Link do Google Docs">
              <input placeholder="https://docs.google.com/..." value={form.url || ''} onChange={f('url')} />
            </Field>
          )}

          {(currentTipo === 'link' || currentTipo === 'video' || currentTipo === 'jogo') && (
            <Field label="URL">
              <input placeholder="https://..." value={form.url || ''} onChange={f('url')} />
            </Field>
          )}

          {currentTipo === 'livro' && (
            <Field label="Autor (opcional)">
              <input placeholder="Nome do autor" value={form.author || ''} onChange={f('author')} />
            </Field>
          )}
          {(currentTipo === 'nota' || currentTipo === 'documento') && (
            <Field label="Data (opcional)">
              <input placeholder="Ex: 2024, Jan/2025..." value={form.item_date || ''} onChange={f('item_date')} />
            </Field>
          )}
          <Field label="URL da fonte (opcional)">
            <input placeholder="https://..." value={form.source_url || ''} onChange={f('source_url')} />
          </Field>

          <Field label="Capa (opcional)">
            <div className={styles.coverRow}>
              <span className={styles.coverRatioLabel}>Proporção:</span>
              <button
                type="button"
                className={`${styles.ratioBtn} ${(form.proporcao_capa || '16:9') === '16:9' ? styles.ratioBtnActive : ''}`}
                onClick={() => setForm(p => ({ ...p, proporcao_capa: '16:9' }))}
              >16:9</button>
              <button
                type="button"
                className={`${styles.ratioBtn} ${form.proporcao_capa === '1:1' ? styles.ratioBtnActive : ''}`}
                onClick={() => setForm(p => ({ ...p, proporcao_capa: '1:1' }))}
              >1:1</button>
            </div>
            <input ref={coverFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverUpload} />
            {form.cover_url
              ? <div className={styles.coverPreview}>
                  <img src={form.cover_url} alt="capa" />
                  <button onClick={() => setForm(p => ({ ...p, cover_url: '' }))}>Remover</button>
                </div>
              : <button className={styles.uploadBtn} onClick={() => coverFileRef.current.click()} disabled={coverUploading}>
                  {coverUploading ? 'Enviando...' : '🖼️ Selecionar imagem de capa'}
                </button>
            }
          </Field>

          {workspaceTags.length > 0 && (
            <Field label="Tags">
              <div className={styles.tagToggleRow}>
                {workspaceTags.map(tag => {
                  const isSelected = (form.selectedTags || []).includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      className={`${styles.tagToggleBtn} ${isSelected ? styles.tagToggleBtnActive : ''}`}
                      style={isSelected ? { background: tag.color + '33', color: tag.color, borderColor: tag.color + '66' } : {}}
                      onClick={() => {
                        const current = form.selectedTags || []
                        setForm(prev => ({
                          ...prev,
                          selectedTags: isSelected
                            ? current.filter(id => id !== tag.id)
                            : [...current, tag.id],
                        }))
                      }}
                    >
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            </Field>
          )}
        </Modal>
      )}

      {modal === 'tags' && (
        <Modal title="Gerenciar Tags" onClose={closeModal} noFooter>
          <div className={styles.tagsModalBody}>
            {workspaceTags.length === 0 ? (
              <p className={styles.tagsEmpty}>Nenhuma tag criada ainda.</p>
            ) : (
              <div className={styles.tagsList}>
                {workspaceTags.map(tag => (
                  <div key={tag.id} className={styles.tagsListItem}>
                    <span
                      className={styles.tagsListPill}
                      style={{ background: tag.color + '22', color: tag.color, border: `1px solid ${tag.color}44` }}
                    >
                      {tag.name}
                    </span>
                    <button
                      className={styles.tagsDeleteBtn}
                      onClick={() => { if (confirm(`Excluir tag "${tag.name}"?`)) store.deleteTag(tag.id) }}
                    >
                      Excluir
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.tagAddSection}>
              <span className={styles.fieldLabel}>Nova tag</span>
              <div className={styles.tagAddRow}>
                <input
                  className={styles.tagNameInput}
                  placeholder="Nome da tag"
                  value={form.tagName || ''}
                  onChange={f('tagName')}
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && form.tagName?.trim()) {
                      await store.addTag(form.tagName.trim(), form.tagColor || '#6366f1', workspace)
                      setForm(p => ({ ...p, tagName: '' }))
                    }
                  }}
                />
                <input
                  type="color"
                  className={styles.tagColorInput}
                  value={form.tagColor || '#6366f1'}
                  onChange={f('tagColor')}
                />
                <button
                  className={styles.tagAddBtn}
                  onClick={async () => {
                    if (!form.tagName?.trim()) return
                    await store.addTag(form.tagName.trim(), form.tagColor || '#6366f1', workspace)
                    setForm(p => ({ ...p, tagName: '' }))
                  }}
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {noteItem && (
        <NoteEditorModal
          title={noteItem.title}
          initial={noteItem.conteudo_nota || ''}
          onClose={() => setNoteItem(null)}
          onSave={saveNote}
        />
      )}
    </div>
  )
}
