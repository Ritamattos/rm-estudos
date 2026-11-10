import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { BookOpen, Briefcase, Library, Clapperboard, ClipboardList, BarChart3, Building2, User, Menu, Download } from 'lucide-react'
import { supabase } from './lib/supabase'
import { useStore } from './hooks/useStore'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import Login from './components/Login'
import ResetPassword from './components/ResetPassword'
import Sidebar from './components/Sidebar'
import KanbanBoard from './components/KanbanBoard'
import Modal from './components/Modal'
import NotesSection from './components/NotesSection'
import BibliotecaSection from './components/BibliotecaSection'
import TelaSection from './components/TelaSection'
import AtividadesSection from './components/AtividadesSection'
import DadosWorkspace from './components/DadosWorkspace'
import ProfileSwitcher from './components/ProfileSwitcher'
import { ThemeContext } from './components/ThemeSettings'
import { readIsDark, readAccent, applyTheme } from './lib/theme'
import styles from './App.module.css'

const WORKSPACES = [
  // Dados comes first: it's where the Empresa profile opens.
  // To rename this tab, change only `label` (the id stays 'dados').
  { id: 'dados',       label: 'Dados',       icon: <BarChart3 size={15} />,     profile: 'empresa' },
  { id: 'atividades',  label: 'Atividades',  icon: <ClipboardList size={15} />, profile: 'empresa' },
  { id: 'marketing',   label: 'Marketing',   icon: <Briefcase size={15} />,     profile: 'empresa' },
  { id: 'pessoal',     label: 'Pessoal',     icon: <BookOpen size={15} />,      profile: 'pessoal' },
  { id: 'biblioteca',  label: 'Biblioteca',  icon: <Library size={15} />,       profile: 'pessoal' },
  { id: 'tela',        label: 'Cinemateca',  icon: <Clapperboard size={15} />,  profile: 'pessoal' },
]

// Profiles are a UI-only grouping of workspaces: same Supabase account,
// same data. The first workspace listed for a profile is where it opens.
const PROFILES = {
  empresa: { label: 'Empresa', icon: <Building2 size={18} />, next: 'pessoal' },
  pessoal: { label: 'Pessoal', icon: <User size={18} />,      next: 'empresa' },
}
const DEFAULT_PROFILE = 'empresa'
const firstWorkspaceOf = profile => WORKSPACES.find(w => w.profile === profile).id

// The current tab survives a page reload (sessionStorage), but a fresh
// visit or a new login always starts on the Empresa profile.
const WORKSPACE_SESSION_KEY = 'rm-estudos-workspace'

function readSessionWorkspace() {
  try {
    const saved = sessionStorage.getItem(WORKSPACE_SESSION_KEY)
    if (WORKSPACES.some(w => w.id === saved)) return saved
  } catch { /* storage unavailable */ }
  return firstWorkspaceOf(DEFAULT_PROFILE)
}

function writeSessionWorkspace(id) {
  try {
    if (id) sessionStorage.setItem(WORKSPACE_SESSION_KEY, id)
    else sessionStorage.removeItem(WORKSPACE_SESSION_KEY)
  } catch { /* storage unavailable */ }
}

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


export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isRecovery, setIsRecovery] = useState(false)
  const [isDark, setIsDark] = useState(readIsDark)
  const [accent, setAccent] = useState(readAccent)
  const [workspace, setWorkspace] = useState(readSessionWorkspace)
  const [selectedCat, setSelectedCat] = useState(null)
  const [selectedSub, setSelectedSub] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [navOpen, setNavOpen] = useState(false)
  const install = useInstallPrompt()

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // A recovery link normally redirects straight to /reset-password,
      // but if that redirect ever falls back to the bare site root (e.g.
      // a misconfigured Supabase redirect allow-list), this still catches
      // the recovery session before it silently logs the user into the
      // app without making them set a new password.
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true)
      setUser(prev => {
        const nextId = session?.user?.id ?? null
        const prevId = prev?.id ?? null
        return nextId === prevId ? prev : (session?.user ?? null)
      })
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { writeSessionWorkspace(workspace) }, [workspace])

  const profile = WORKSPACES.find(w => w.id === workspace).profile
  const profileTabs = WORKSPACES.filter(w => w.profile === profile)

  function goToWorkspace(id) {
    setNavOpen(false)
    setWorkspace(id)
    setSelectedCat(null)
    setSelectedSub(null)
  }

  const closeNav = () => setNavOpen(false)

  function switchProfile() {
    goToWorkspace(firstWorkspaceOf(PROFILES[profile].next))
  }

  // Covers sign-outs that don't go through the button (expired session,
  // logout in another tab): whoever logs in next starts on Empresa.
  useEffect(() => {
    if (!authLoading && !user) goToWorkspace(firstWorkspaceOf(DEFAULT_PROFILE))
  }, [authLoading, user])

  async function logout() {
    // The next login must open on Empresa, not wherever this session ended.
    goToWorkspace(firstWorkspaceOf(DEFAULT_PROFILE))
    await supabase.auth.signOut()
  }

  // Applies and saves mode + accent. The first paint is already right
  // thanks to the inline script in index.html; this keeps it in sync after.
  useLayoutEffect(() => { applyTheme(isDark, accent) }, [isDark, accent])

  const themeControls = {
    isDark,
    onToggleTheme: () => setIsDark(d => !d),
    accent,
    onAccentChange: setAccent,
  }

  // Publishes the tab bar's height as --tabbar-h so side lists under it can
  // be pinned right below it (see SideDrawer's belowTabs).
  const tabBarRef = useRef(null)
  useLayoutEffect(() => {
    const el = tabBarRef.current
    if (!el) return
    const publish = () => document.documentElement.style.setProperty('--tabbar-h', `${el.offsetHeight}px`)
    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => ro.disconnect()
  }, [user, authLoading])

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
  const isSpecialSection = workspace === 'biblioteca' || workspace === 'tela' || workspace === 'atividades' || workspace === 'dados'

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

  if (window.location.pathname === '/reset-password' || isRecovery) return <ResetPassword />
  if (authLoading) return <div className={styles.loading}><span className={styles.loadingIcon}>◆</span></div>
  if (!user) return <Login {...themeControls} />

  return (
    // Theme controls live in every side menu (ThemeSettings via SideDrawer).
    <ThemeContext.Provider value={themeControls}>
    <div className={styles.app}>
      {!isSpecialSection && (
        <Sidebar
          categories={store.categories}
          subcategories={store.subcategories}
          workspace={workspace}
          selectedCat={effectiveCat}
          selectedSub={selectedSub}
          onSelectCat={id => { setSelectedCat(id); setSelectedSub(null); setNavOpen(false) }}
          onSelectSub={(catId, subId) => { setSelectedCat(catId); setSelectedSub(subId); setNavOpen(false) }}
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
          onReorderCategories={store.reorderCategories}
          onReorderSubcategories={(catId, ids) => store.reorderSubcategories(ids)}
          onLogout={logout}
          mobileOpen={navOpen}
          onCloseMobile={() => setNavOpen(false)}
          install={install}
        />
      )}

      <main className={`${styles.main} ${isSpecialSection ? styles.mainFull : ''}`}>
        <div className={styles.workspaceTabs} ref={tabBarRef}>
          {/* Every workspace has a side list; on phones this ☰ opens it as
              a drawer (SideDrawer). Hidden on desktop. */}
          <button
            type="button"
            className={styles.menuBtn}
            onClick={() => setNavOpen(true)}
            aria-label="Abrir menu lateral"
          >
            <Menu size={20} />
          </button>

          {profileTabs.map(w => (
            <button
              key={w.id}
              className={`${styles.tab} ${workspace === w.id ? styles.tabActive : ''}`}
              onClick={() => goToWorkspace(w.id)}
            >
              {w.icon} {w.label}
            </button>
          ))}

          <div className={styles.tabsEnd}>
            {isSpecialSection && (
              <>
                {install.canInstall && (
                  <button className={styles.installTabBtn} onClick={install.prompt} title="Instalar app">
                    <Download size={14} /> <span>Instalar</span>
                  </button>
                )}
                <button className={styles.logoutTabBtn} onClick={logout}>
                  Sair
                </button>
              </>
            )}
            <ProfileSwitcher
              user={user}
              profile={profile}
              profiles={PROFILES}
              onSwitch={switchProfile}
            />
          </div>
        </div>

        {workspace === 'biblioteca' ? (
          <BibliotecaSection user={user} store={store} navOpen={navOpen} onCloseNav={closeNav} />
        ) : workspace === 'tela' ? (
          <TelaSection user={user} store={store} navOpen={navOpen} onCloseNav={closeNav} />
        ) : workspace === 'atividades' ? (
          <AtividadesSection user={user} navOpen={navOpen} onCloseNav={closeNav} />
        ) : workspace === 'dados' ? (
          <DadosWorkspace
            user={user}
            title={WORKSPACES.find(w => w.id === 'dados').label}
            navOpen={navOpen}
            onCloseNav={closeNav}
          />
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
    </ThemeContext.Provider>
  )
}
