import { useState } from 'react'
import { FlaskConical, CalendarCheck, LayoutGrid, CheckCircle2, XCircle } from 'lucide-react'
import { useAtividadesStore } from '../hooks/useAtividadesStore'
import TestesBoard from './TestesBoard'
import TestArchiveList from './TestArchiveList'
import DiarioList from './DiarioList'
import styles from './AtividadesSection.module.css'

const TESTES_VIEWS = [
  { id: 'board',      label: 'Quadro Kanban', icon: <LayoutGrid size={13} /> },
  { id: 'aprovados',  label: 'Aprovados',     icon: <CheckCircle2 size={13} /> },
  { id: 'reprovados', label: 'Reprovados',    icon: <XCircle size={13} /> },
]

export default function AtividadesSection({ user }) {
  const store = useAtividadesStore(user)
  const [section, setSection] = useState('testes')
  const [testesView, setTestesView] = useState('board')

  return (
    <div className={styles.wrapper}>
      <aside className={styles.nav}>
        <span className={styles.navTitle}>Atividades</span>

        <button
          className={`${styles.navItem} ${section === 'testes' ? styles.navItemActive : ''}`}
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
                onClick={() => setTestesView(v.id)}
              >
                {v.icon} {v.label}
              </button>
            ))}
          </div>
        )}

        <button
          className={`${styles.navItem} ${section === 'diario' ? styles.navItemActive : ''}`}
          onClick={() => setSection('diario')}
        >
          <CalendarCheck size={15} /> Diário
        </button>
      </aside>

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
