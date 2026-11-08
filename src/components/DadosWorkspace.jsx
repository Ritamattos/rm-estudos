import { useState } from 'react'
import { BarChart3, Megaphone } from 'lucide-react'
import DadosSection from './DadosSection'
import CriativosSection from './CriativosSection'
import SideDrawer, { DrawerCloseButton } from './SideDrawer'
// Same side-nav look as Atividades.
import styles from './AtividadesSection.module.css'

// Sections of the Dados workspace (the future creative-analysis tool).
// Add a section here and it shows up in the side list; the first one is
// where the workspace opens.
const SECTIONS = [
  { id: 'dados',     label: 'Dados',     icon: <BarChart3 size={15} />, render: user => <DadosSection user={user} /> },
  { id: 'criativos', label: 'Criativos', icon: <Megaphone size={15} />, render: user => <CriativosSection user={user} /> },
]

export default function DadosWorkspace({ user, title, navOpen = false, onCloseNav }) {
  const [sectionId, setSectionId] = useState(SECTIONS[0].id)
  const section = SECTIONS.find(s => s.id === sectionId) ?? SECTIONS[0]

  return (
    <div className={styles.wrapper}>
      <SideDrawer className={styles.nav} open={navOpen} onClose={onCloseNav} belowTabs>
        <div className={styles.navHeader}>
          <span className={styles.navTitle}>{title}</span>
          <DrawerCloseButton onClose={onCloseNav} />
        </div>

        {SECTIONS.map(s => (
          <button
            key={s.id}
            className={`${styles.navItem} ${s.id === section.id ? styles.navItemActive : ''}`}
            onClick={() => { setSectionId(s.id); onCloseNav?.() }}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </SideDrawer>

      <div className={styles.content}>
        {section.render(user)}
      </div>
    </div>
  )
}
