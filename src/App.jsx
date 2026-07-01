import { useState, useEffect } from 'react'
import { BookOpen, Briefcase, Library, Clapperboard, ClipboardList } from 'lucide-react'
import { supabase } from './lib/supabase'
import { useStore } from './hooks/useStore'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import KanbanBoard from './components/KanbanBoard'
import Modal from './components/Modal'
import NotesSection from './components/NotesSection'
import BibliotecaSection from './components/BibliotecaSection'
import TelaSection from './components/TelaSection'
import AtividadesSection from './components/AtividadesSection'
import styles from './App.module.css'

const WORKSPACES = [
  { id: 'marketing',   label: 'Marketing',   icon: <Briefcase size={15} /> },
  { id: 'pessoal',     label: 'Pessoal',     icon: <BookOpen size={15} /> },
  { id: 'biblioteca',  label: 'Biblioteca',  icon: <Library size={15} /> },
  { id: 'tela',        label: 'Cinemateca',  icon: <Clapperboard size={15} /> },
  { id: 'atividades',  label: 'Atividades',  icon: <ClipboardList size={15} /> },
]

const SUB_TYPES = [
  { value: 'notes',  label: '📝 Notas' },
  { value: 'links',  label: '🔗 Links' },
  { value: 'books',  label: '📚 Livros' },
  { value: 'videos', label: '🎬 Vídeos' },
  { value: 'mixed',  label: '📦 Misto' },
]

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
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})

  const store = useStore(user)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    // Supabase re-validates the session (and fires this callback with a
    // brand-new user object) every time the tab regains visibility, even
    // when it's still the same user. Only update state when the user
    // actually changes, so that doesn't cascade into a full data reload
    // and unmount whatever's currently open (e.g. a note being edited).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(prev => {
        const nextId = session?.user?.id ?? null
        const prevId = prev?.id ?? null
        return nextId === prevId ? prev : (session?.user ?? null)
      })
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light')
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

  const cats = store.categories.filter(c => c.workspace === workspace)
  const isSpecialSection = workspace === 'biblioteca' || workspace === 'tela' || workspace === 'atividades'

  // No more "show everything" view: always resolve to a real category so
  // the workspace never lands in an unfiltered state. Falls back to null
  // only when the workspace has no categories yet.
  const effectiveCat = !isSpecialSection && selectedCat && cats.some(c => c.id === selectedCat)
    ? selectedCat
    : (!isSpecialSection && cats.length > 0 ? cats[0].id : null)

  useEffect(() => {
    if (isSpecialSection) return
    if (effectiveCat !== selectedCat) {
      setSelectedCat(effectiveCat)
      setSelectedSub(null)
    }
  }, [isSpecialSection, effectiveCat])

  const isKanbanView = !isSpecialSection && !!effectiveCat && !selectedSub

  const viewTitle = selectedSub
    ? store.subcategories.find(s => s.id === selectedSub)?.name
    : cats.find(c => c.id === effectiveCat)?.name

  if (authLoading) return <div className={styles.loading}><span className={styles.loadingIcon}>◆</span></div>
  if (!user) return <Login />

  return (
    <div className={styles.app}>
      {!isSpecialSection && (
        <Sidebar
          categories={store.categories}
          subcategories={store.subcategories}
          workspace={workspace}
          selectedCat={effectiveCat}
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
        ) : workspace === 'atividades' ? (
          <AtividadesSection user={user} />
        ) : store.loading ? (
          <div className={styles.empty}><span className={styles.loadingIcon}>◆</span></div>
        ) : cats.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>◆</div>
            <p>Crie uma categoria para começar</p>
            <button className={styles.emptyBtn} onClick={() => openModal('cat', { workspace })}>
              + Nova categoria
            </button>
          </div>
        ) : isKanbanView ? (
          <>
            <div className={styles.topbar}>
              <div>
                <h1 className={styles.viewTitle}>{viewTitle}</h1>
                <span className={styles.viewCount}>Quadro Kanban</span>
              </div>
            </div>
            <KanbanBoard
              categoryId={effectiveCat}
              cards={store.kanbanCards.filter(k => k.category_id === effectiveCat)}
              onAdd={store.addKanbanCard}
              onMove={(id, status) => store.updateKanbanCard(id, { status })}
              onEdit={(id, title) => store.updateKanbanCard(id, { title })}
              onDelete={store.deleteKanbanCard}
            />
          </>
        ) : (
          <NotesSection
            store={store}
            workspace={workspace}
            catId={effectiveCat}
            subId={selectedSub}
            title={viewTitle}
          />
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

    </div>
  )
}
