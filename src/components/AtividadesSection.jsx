import { useState } from 'react'
import { FlaskConical, CalendarCheck, LayoutGrid, CheckCircle2, XCircle } from 'lucide-react'
import { useAtividadesStore } from '../hooks/useAtividadesStore'
import TestesBoard from './TestesBoard'
import TestArchiveList from './TestArchiveList'
import DiarioList from './DiarioList'
import SideDrawer, { DrawerCloseButton } from './SideDrawer'
import styles from './AtividadesSection.module.css'

const TESTES_VIEWS = [
  { id: 'board',      label: 'Quadro Kanban', icon: <LayoutGrid size={13} /> },
  { id: 'aprovados',  label: 'Aprovados',     icon: <CheckCircle2 size={13} /> },
  { id: 'reprovados', label: 'Reprovados',    icon: <XCircle size={13} /> },
]

export default function AtividadesSection({ user, navOpen = false, onCloseNav }) {
  const store = useAtividadesStore(user)
  const [section, setSection] = useState('testes')
  const [testesView, setTestesView] = useState('board')

  return (
    <div className={styles.wrapper}>
      <SideDrawer className={styles.nav} open={navOpen} onClose={onCloseNav}>
        <div className={styles.navHeader}>
          <span className={styles.navTitle}>Atividades</span>
          <DrawerCloseButton onClose={onCloseNav} />
        </div>

        <button
          className={`${styles.navItem} ${section === 'testes' ? styles.navItemActive : ''}`}
          // Testes expands its sub-views, so the drawer stays open here.
          onClick={() => setSection('testes')}
        >
          <FlaskConical size={15} /> Testes
        </button>
        {section === 'testes' && (
          <div className={styles.subGroup}>
            {TESTES_VIEWS.map(v => (
              <button
                key={v.id}
                className={`${styles.subItem} ${testesView === v.id ? styles.subItemActive : ''}`}
                onClick={() => { setTestesView(v.id); onCloseNav?.() }}
              >
                {v.icon} {v.label}
              </button>
            ))}
          </div>
        )}

        <button
          className={`${styles.navItem} ${section === 'diario' ? styles.navItemActive : ''}`}
          onClick={() => { setSection('diario'); onCloseNav?.() }}
        >
          <CalendarCheck size={15} /> Diário
        </button>
      </SideDrawer>

      <div className={styles.content}>
        {store.loading ? (
          <div className={styles.empty}><span className={styles.loadingIcon}>◆</span></div>
        ) : section === 'testes' ? (
          testesView === 'board' ? (
            <TestesBoard store={store} />
          ) : (
            <TestArchiveList store={store} status={testesView === 'aprovados' ? 'aprovado' : 'reprovado'} />
          )
        ) : (
          <DiarioList store={store} />
        )}
      </div>
    </div>
  )
}
