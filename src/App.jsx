import { useState, useEffect, useRef } from 'react'
import { Plus, Search, BookOpen, Briefcase } from 'lucide-react'
import { supabase } from './lib/supabase'
import { useStore } from './hooks/useStore'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import ItemCard from './components/ItemCard'
import Modal from './components/Modal'
import styles from './App.module.css'

const WORKSPACES = [
  { id: 'marketing', label: 'Marketing', icon: <Briefcase size={15} /> },
  { id: 'pessoal', label: 'Pessoal', icon: <BookOpen size={15} /> },
]

const ITEM_TYPES = [
  { value: 'note', label: '📝 Nota' },
  { value: 'link', label: '🔗 Link' },
  { value: 'pdf', label: '📄 PDF' },
]

const SUB_TYPES = [
  { value: 'notes', label: '📝 Notas' },
  { value: 'links', label: '🔗 Links' },
  { value: 'books', label: '📚 Livros' },
  { value: 'videos', label: '🎬 Vídeos' },
  { value: 'mixed', label: '📦 Misto' },
]

function Field({ label, children }) {
  return <div className={styles.field}><label className={styles.fieldLabel}>{label}</label>{children}</div>
}

export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isDark, setIsDark] = useState(true)
  const [workspace, setWorkspace] = useState('marketing')
  const [selectedCat, setSelectedCat] = useState(null)
  const [selectedSub, setSelectedSub] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

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
  }, [isDark])

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
    const payload = {
      cat_id: form.cat_id || null,
      sub_id: form.sub_id || null,
      workspace,
      type: form.type || 'note',
      title: form.title.trim(),
      description: form.description?.trim() || '',
      content: form.content?.trim() || '',
      url: form.url?.trim() || '',
      cover_url: form.cover_url?.trim() || '',
      author: form.author?.trim() || '',
      item_date: form.item_date?.trim() || '',
      source_url: form.source_url?.trim() || '',
    }
    if (form.editId) {
      await store.updateItem(form.editId, payload)
    } else {
      await store.addItem(payload)
    }
    closeModal()
  }

  async function handlePdfUpload(e) {
    const file = e.target.files[0]; if (!file) return
    setUploading(true)
    const url = await store.uploadFile(file)
    if (url) setForm(prev => ({ ...prev, url, title: prev.title || file.name.replace('.pdf', '') }))
    setUploading(false)
    e.target.value = ''
  }

  const cats = store.categories.filter(c => c.workspace === workspace)

  const filtered = store.items.filter(i => {
    if (i.workspace !== workspace) return false
    if (selectedCat && i.cat_id !== selectedCat) return false
    if (selectedSub && i.sub_id !== selectedSub) return false
    if (typeFilter !== 'all' && i.type !== typeFilter) return false
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

  if (authLoading) return <div className={styles.loading}><span className={styles.loadingIcon}>◆</span></div>
  if (!user) return <Login />

  return (
    <div className={styles.app}>
      <Sidebar
        categories={store.categories}
        subcategories={store.subcategories}
        workspace={workspace}
        selectedCat={selectedCat}
        selectedSub={selectedSub}
        onSelectCat={id => { setSelectedCat(id); setSelectedSub(null) }}
        onSelectSub={(catId, subId) => { setSelectedCat(catId); setSelectedSub(subId) }}
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

      <main className={styles.main}>
        <div className={styles.workspaceTabs}>
          {WORKSPACES.map(w => (
            <button key={w.id} className={`${styles.tab} ${workspace === w.id ? styles.tabActive : ''}`}
              onClick={() => { setWorkspace(w.id); setSelectedCat(null); setSelectedSub(null) }}>
              {w.icon} {w.label}
            </button>
          ))}
        </div>

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
              <option value="note">📝 Notas</option>
              <option value="link">🔗 Links</option>
              <option value="pdf">📄 PDFs</option>
            </select>
            <button className={styles.addBtn} onClick={() => openModal('item', { type: 'note', cat_id: selectedCat, sub_id: selectedSub })}>
              <Plus size={15} /> Novo item
            </button>
          </div>
        </div>

        {store.loading ? (
          <div className={styles.empty}><span className={styles.loadingIcon}>◆</span></div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>◆</div>
            <p>Nenhum item aqui ainda</p>
            <button className={styles.emptyBtn} onClick={() => openModal('item', { type: 'note', cat_id: selectedCat, sub_id: selectedSub })}>
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
                onEdit={item => openModal('item', { editId: item.id, ...item })}
                onDelete={id => { if (confirm('Excluir item?')) store.deleteItem(id) }}
              />
            ))}
          </div>
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
            <select value={form.type || 'note'} onChange={f('type')}>
              {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
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
          <Field label="Título"><input placeholder="Título do item" value={form.title || ''} onChange={f('title')} autoFocus={!form.editId} /></Field>
          <Field label="Descrição (opcional)"><input placeholder="Breve descrição" value={form.description || ''} onChange={f('description')} /></Field>

          {form.type === 'note' && (
            <Field label="Conteúdo">
              <textarea placeholder="Escreva sua nota aqui..." value={form.content || ''} onChange={f('content')} rows={6} />
            </Field>
          )}

          {form.type === 'link' && (
            <Field label="URL"><input placeholder="https://..." value={form.url || ''} onChange={f('url')} /></Field>
          )}

          {form.type === 'pdf' && (
            <Field label="PDF">
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handlePdfUpload} />
              {form.url
                ? <div className={styles.pdfUploaded}>✅ PDF enviado! <button onClick={() => setForm(p => ({ ...p, url: '' }))}>Trocar</button></div>
                : <button className={styles.uploadBtn} onClick={() => fileRef.current.click()} disabled={uploading}>
                    {uploading ? 'Enviando...' : '📄 Selecionar PDF'}
                  </button>
              }
              <input placeholder="Ou cole um link do PDF" value={form.url || ''} onChange={f('url')} style={{ marginTop: 8 }} />
            </Field>
          )}

          <Field label="Autor (opcional)"><input placeholder="Nome do autor" value={form.author || ''} onChange={f('author')} /></Field>
          <Field label="Data (opcional)"><input placeholder="Ex: 2024, Jan/2025..." value={form.item_date || ''} onChange={f('item_date')} /></Field>
          <Field label="URL da fonte (opcional)"><input placeholder="https://..." value={form.source_url || ''} onChange={f('source_url')} /></Field>
          <Field label="URL da capa (opcional)"><input placeholder="https://imagem.jpg" value={form.cover_url || ''} onChange={f('cover_url')} /></Field>
        </Modal>
      )}
    </div>
  )
}
