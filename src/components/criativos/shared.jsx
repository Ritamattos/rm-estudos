import { useState, useEffect, useRef, useId } from 'react'
import { Play, ImageOff, Link2, Info } from 'lucide-react'
import { driveThumbUrl, METRIC_INFO } from '../../lib/criativosMetrics'
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
//
// Like a spreadsheet, a sum can be typed: "50+30+20" or "=50+30+20" → 100
// (also "100-20"). Each part is read with the rules above; if any part
// isn't a number, the whole thing is null.
export function parseNum(v, isDecimal = true) {
  const raw = String(v ?? '').trim().replace(/^=/, '')
  // "+" anywhere, or "-" after the first character, means an expression.
  if (/\+/.test(raw) || /.-/.test(raw.replace(/\s/g, ''))) {
    const parts = raw.replace(/\s/g, '').split(/(?=[+-])/).filter(p => p !== '+' && p !== '-')
    if (!parts.length) return null
    let total = 0
    for (const p of parts) {
      const sign = p.startsWith('-') ? -1 : 1
      const n = parseSingle(p.replace(/^[+-]/, ''), isDecimal)
      if (n == null) return null
      total += sign * n
    }
    return Math.round(total * 1e6) / 1e6
  }
  return parseSingle(raw, isDecimal)
}

// True when the text is a sum/subtraction (so the UI can show its total).
// ("47+abc" counts too, so the field can say the sum is invalid.)
export const isExpression = v => /\d\s*[+-]/.test(String(v ?? '').replace(/^=/, ''))

function parseSingle(v, isDecimal) {
  let s = String(v ?? '').replace(/[^\d.,-]/g, '')
  if (!s || !/\d/.test(s)) return null
  if (!isDecimal) s = s.replace(/[.,]/g, '')
  else if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')        // 1.234,56
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')         // 1.500 → 1500
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

// Number input that also takes a sum, like a spreadsheet ("50+30+20").
// The total shows below while it's a sum.
export function SumInput({ value, onChange, isDecimal = true, format = n => String(n), className = '', placeholder, ...rest }) {
  const expr = isExpression(value)
  const total = expr ? parseNum(value, isDecimal) : null
  return (
    <>
      <input
        className={className}
        inputMode={isDecimal ? 'decimal' : 'numeric'}
        value={value}
        placeholder={placeholder}
        title="Aceita soma, como na planilha: 50+30+20"
        onChange={e => onChange(e.target.value)}
        {...rest}
      />
      {expr && (
        <span className={total == null ? styles.sumBad : styles.sumTotal} aria-live="polite">
          {total == null ? 'Conta inválida' : `= ${format(total)}`}
        </span>
      )}
    </>
  )
}

export function numToInput(v) {
  return v == null ? '' : String(v).replace('.', ',')
}

export function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function Field({ label, children, info }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabelRow}>
        <label className={styles.fieldLabel}>{label}</label>
        {info && <InfoTip info={info} title={typeof label === 'string' ? label : ''} />}
      </span>
      {children}
    </div>
  )
}

// ⓘ — explains a metric: what it is, formula, example and when to act.
// `info` is a METRIC_INFO key or an { oque, formula, exemplo, mexer } object.
// Opens on tap (works on phones); closes on outside tap, Esc or scroll.
// `children` replaces the ⓘ trigger (e.g. a change marker); `label` its aria-label.
export function InfoTip({ info, title = '', children, className, label }) {
  const data = typeof info === 'string' ? METRIC_INFO[info] : info
  const [pos, setPos] = useState(null)
  const btn = useRef(null)
  const id = useId()

  useEffect(() => {
    if (!pos) return
    const close = e => { if (!btn.current?.contains(e.target) && !e.target.closest?.(`[data-tip="${id}"]`)) setPos(null) }
    const esc = e => { if (e.key === 'Escape') setPos(null) }
    const off = () => setPos(null)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    window.addEventListener('scroll', off, true)
    window.addEventListener('resize', off)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', esc)
      window.removeEventListener('scroll', off, true)
      window.removeEventListener('resize', off)
    }
  }, [pos, id])

  if (!data) return null
  function toggle(e) {
    e.preventDefault(); e.stopPropagation()
    if (pos) return setPos(null)
    const r = btn.current.getBoundingClientRect()
    const width = Math.min(290, window.innerWidth - 24)
    const left = Math.max(12, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 12))
    const below = r.bottom + 8
    const top = below + 230 > window.innerHeight && r.top > 260 ? null : below
    setPos({ left, width, top, bottom: top == null ? window.innerHeight - r.top + 8 : null })
  }

  return (
    <>
      <button
        type="button"
        ref={btn}
        className={className || styles.infoBtn}
        onClick={toggle}
        aria-label={label || `O que é ${title || 'esta métrica'}?`}
        aria-expanded={!!pos}
        aria-describedby={pos ? id : undefined}
      >
        {children || <Info size={13} />}
      </button>
      {pos && (
        <div
          id={id}
          data-tip={id}
          role="tooltip"
          className={styles.infoPop}
          style={{ left: pos.left, width: pos.width, top: pos.top ?? 'auto', bottom: pos.bottom ?? 'auto' }}
        >
          {title && <strong className={styles.infoTitle}>{title}</strong>}
          <p>{data.oque}</p>
          {data.formula && <p><b>Fórmula:</b> {data.formula}</p>}
          {data.exemplo && <p><b>Exemplo:</b> {data.exemplo}</p>}
          {data.mexer && <p><b>Quando mexer:</b> {data.mexer}</p>}
        </div>
      )}
    </>
  )
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
