import { useState, useEffect } from 'react'
import { Play, ImageOff, Link2 } from 'lucide-react'
import { driveThumbUrl } from '../../lib/criativosMetrics'
import styles from './Criativos.module.css'

export const FASES = [
  { id: 'teste',      label: 'Teste' },
  { id: 'pre_escala', label: 'Pré-escala' },
  { id: 'escala',     label: 'Escala' },
  { id: 'pausado',    label: 'Pausado' },
  { id: 'reprovado',  label: 'Reprovado' },
]
export const FASE_LABEL = Object.fromEntries(FASES.map(f => [f.id, f.label]))

export const FORMATOS = [
  { id: 'video',     label: 'Vídeo' },
  { id: 'imagem',    label: 'Imagem' },
  { id: 'carrossel', label: 'Carrossel' },
]
export const FORMATO_LABEL = Object.fromEntries(FORMATOS.map(f => [f.id, f.label]))

export const IDIOMAS = [
  { id: 'pt', label: 'Português' },
  { id: 'es', label: 'Espanhol' },
  { id: 'en', label: 'Inglês' },
]
export const MOEDAS = [
  { id: 'BRL', label: 'Real (R$)' },
  { id: 'USD', label: 'Dólar (US$)' },
  { id: 'EUR', label: 'Euro (€)' },
]

// Accepts "1.234,50" (pt-BR) as well as "1234.50"; empty → null. Integer
// fields treat any dot/comma as a thousands separator ("12.345" impressões).
// Reads what people type in Brazil: "50", "50,90", "R$ 1.234,56", "1.500"
// (thousands), "US$ 12.50". Currency symbols and spaces are ignored.
// Returns null when there's no number at all (so it can be flagged).
export function parseNum(v, isDecimal = true) {
  let s = String(v ?? '').replace(/[^\d.,-]/g, '')
  if (!s || !/\d/.test(s)) return null
  if (!isDecimal) s = s.replace(/[.,]/g, '')
  else if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')        // 1.234,56
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')         // 1.500 → 1500
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function numToInput(v) {
  return v == null ? '' : String(v).replace('.', ',')
}

export function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function Field({ label, children }) {
  return <div className={styles.field}><label className={styles.fieldLabel}>{label}</label>{children}</div>
}

export function FaseBadge({ fase }) {
  return <span className={`${styles.faseBadge} ${styles[`fase_${fase}`]}`}>{FASE_LABEL[fase] || fase}</span>
}

export function Breadcrumb({ items }) {
  return (
    <nav className={styles.breadcrumb}>
      {items.map((it, i) => (
        <span key={i} className={styles.crumbWrap}>
          {i > 0 && <span className={styles.crumbSep}>›</span>}
          {it.onClick
            ? <button className={styles.crumb} onClick={it.onClick}>{it.label}</button>
            : <span className={styles.crumbCurrent}>{it.label}</span>}
        </span>
      ))}
    </nav>
  )
}

// Miniatura do Drive. Só carrega se o arquivo estiver compartilhado como
// "Qualquer pessoa com o link" (ou se o navegador estiver logado na conta
// dona do arquivo); caso contrário mostra o placeholder.
export function DriveThumb({ link, formato, size = 'sm' }) {
  const url = driveThumbUrl(link, size === 'lg' ? 600 : 200)
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [url])

  const cls = `${styles.thumb} ${size === 'lg' ? styles.thumbLg : ''}`
  const inner = url && !failed ? (
    <>
      <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      {formato === 'video' && <span className={styles.thumbPlay}><Play size={size === 'lg' ? 18 : 11} fill="currentColor" /></span>}
    </>
  ) : (
    <span className={styles.thumbPlaceholder}>
      {link ? <ImageOff size={size === 'lg' ? 28 : 16} /> : <Link2 size={size === 'lg' ? 28 : 16} />}
    </span>
  )

  return link ? (
    <a className={cls} href={link} target="_blank" rel="noopener noreferrer" title="Abrir no Drive" onClick={e => e.stopPropagation()}>
      {inner}
    </a>
  ) : (
    <span className={cls} title="Sem link do Drive">{inner}</span>
  )
}
