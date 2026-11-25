// "Ferramentas" tab: side menu with every tool + a grid of cards; clicking
// a card opens the tool. Tools are registered in ferramentas.js.
import { useState, Suspense } from 'react'
import { LayoutGrid, ArrowLeft } from 'lucide-react'
import SideDrawer, { DrawerCloseButton } from '../SideDrawer'
import { FERRAMENTAS } from './ferramentas'
import styles from './FerramentasSection.module.css'

// The open tool survives a page reload in the same session.
const SESSION_KEY = 'rm-ferramenta'
function lerAberta() {
  try {
    const id = sessionStorage.getItem(SESSION_KEY)
    return FERRAMENTAS.some(f => f.id === id) ? id : null
  } catch { return null }
}

export default function FerramentasSection({ navOpen = false, onCloseNav }) {
  const [aberta, setAberta] = useState(lerAberta)
  const ferramenta = FERRAMENTAS.find(f => f.id === aberta)

  function abrir(id) {
    setAberta(id)
    try { id ? sessionStorage.setItem(SESSION_KEY, id) : sessionStorage.removeItem(SESSION_KEY) } catch { /* storage unavailable */ }
    onCloseNav?.()
  }

  return (
    <div className={styles.wrapper}>
      <SideDrawer className={styles.nav} open={navOpen} onClose={onCloseNav} belowTabs>
        <div className={styles.navHeader}>
          <span className={styles.navTitle}>Ferramentas</span>
          <DrawerCloseButton onClose={onCloseNav} />
        </div>
        <button className={`${styles.navItem} ${!ferramenta ? styles.navItemActive : ''}`} onClick={() => abrir(null)}>
          <LayoutGrid size={15} /> Todas
        </button>
        {FERRAMENTAS.map(f => (
          <button
            key={f.id}
            className={`${styles.navItem} ${aberta === f.id ? styles.navItemActive : ''}`}
            onClick={() => abrir(f.id)}
          >
            <f.Icon size={15} /> {f.nome}
          </button>
        ))}
      </SideDrawer>

      <div className={styles.content}>
        {ferramenta ? (
          <>
            <div className={styles.topbar}>
              <button className={styles.backBtn} onClick={() => abrir(null)} title="Voltar para as ferramentas" aria-label="Voltar para as ferramentas">
                <ArrowLeft size={18} />
              </button>
              <div className={styles.topbarText}>
                <h1 className={styles.title}>{ferramenta.nome}</h1>
                <p className={styles.subtitle}>{ferramenta.descricao}</p>
              </div>
            </div>
            <div className={styles.body}>
              <Suspense fallback={<div className={styles.empty}><span className={styles.loadingIcon}>◆</span></div>}>
                <ferramenta.Componente />
              </Suspense>
            </div>
          </>
        ) : (
          <>
            <div className={styles.topbar}>
              <div className={styles.topbarText}>
                <h1 className={styles.title}>Ferramentas</h1>
                <p className={styles.subtitle}>Utilitários que rodam direto no navegador.</p>
              </div>
            </div>
            <div className={styles.body}>
              <div className={styles.grid}>
                {FERRAMENTAS.map(f => (
                  <button key={f.id} type="button" className={styles.card} onClick={() => abrir(f.id)}>
                    <span className={styles.cardIcon}><f.Icon size={20} /></span>
                    <span className={styles.cardName}>{f.nome}</span>
                    <span className={styles.cardDesc}>{f.descricao}</span>
                    {f.tags?.length > 0 && (
                      <span className={styles.tags}>{f.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
