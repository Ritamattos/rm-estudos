import { useState } from 'react'
import { FlaskConical, CalendarCheck } from 'lucide-react'
import { useAtividadesStore } from '../hooks/useAtividadesStore'
import TestesBoard from './TestesBoard'
import DiarioList from './DiarioList'
import styles from './AtividadesSection.module.css'

const SECTIONS = [
  { id: 'testes', label: 'Testes', icon: <FlaskConical size={15} /> },
  { id: 'diario', label: 'Diário', icon: <CalendarCheck size={15} /> },
]

export default function AtividadesSection({ user }) {
  const store = useAtividadesStore(user)
  const [section, setSection] = useState('testes')

  return (
    <div className={styles.wrapper}>
      <aside className={styles.nav}>
        <span className={styles.navTitle}>Atividades</span>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            className={`${styles.navItem} ${section === s.id ? styles.navItemActive : ''}`}
            onClick={() => setSection(s.id)}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </aside>

      <div className={styles.content}>
        {store.loading ? (
          <div className={styles.empty}><span className={styles.loadingIcon}>◆</span></div>
        ) : section === 'testes' ? (
          <TestesBoard store={store} />
        ) : (
          <DiarioList store={store} />
        )}
      </div>
    </div>
  )
}
