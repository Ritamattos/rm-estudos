// Period filter of the offer screen: "Todos" or a day / week / range picked
// on a calendar. Days with entries get a dot.
import { useState, useEffect, useRef } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  hojeSP, isoOf, semanaDe, diaPeriodo, intervalo, deslocar, periodoLabel, ddmm,
} from '../../lib/periodo'
import styles from './Criativos.module.css'

const WEEK_HEAD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function PeriodoFiltro({ periodo, onChange, datasComDados }) {
  const [open, setOpen] = useState(false)
  // First tap of a range (the second tap closes it).
  const [anchor, setAnchor] = useState(null)
  const hoje = hojeSP()
  const wrap = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = e => { if (!wrap.current?.contains(e.target)) setOpen(false) }
    const esc = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  function abrir() {
    setAnchor(null)
    setOpen(o => !o)
  }

  function tocar(iso) {
    if (anchor && anchor !== iso) {
      onChange(intervalo(anchor, iso))
      setAnchor(null)
    } else {
      onChange(diaPeriodo(iso))
      setAnchor(iso)
    }
  }

  const proximoBloqueado = periodo && deslocar(periodo, 1).from > hoje

  return (
    <div className={styles.periodoBar} ref={wrap}>
      <div className={styles.viewToggle}>
        <button className={!periodo ? styles.viewToggleActive : ''} onClick={() => { onChange(null); setOpen(false) }}>
          Todos
        </button>
        <button
          className={periodo ? styles.viewToggleActive : ''}
          onClick={abrir}
          aria-expanded={open}
          aria-label="Escolher dia ou semana no calendário"
          title="Filtrar por dia ou semana"
        >
          <CalendarDays size={15} />
        </button>
      </div>

      {periodo && (
        <div className={styles.periodoAtivo}>
          <button className={styles.iconBtn} onClick={() => onChange(deslocar(periodo, -1))} aria-label="Período anterior">
            <ChevronLeft size={16} />
          </button>
          <button className={styles.periodoLabel} onClick={abrir} title="Mudar no calendário">{periodoLabel(periodo)}</button>
          <button className={styles.iconBtn} onClick={() => onChange(deslocar(periodo, 1))} disabled={proximoBloqueado} aria-label="Próximo período">
            <ChevronRight size={16} />
          </button>
          <button className={styles.iconBtn} onClick={() => { onChange(null); setOpen(false) }} aria-label="Voltar para Todos" title="Voltar para Todos">
            <X size={14} />
          </button>
        </div>
      )}

      {open && (
        <div className={styles.periodoPop} role="dialog" aria-label="Escolher período">
          <Calendario
            periodo={periodo}
            anchor={anchor}
            hoje={hoje}
            datasComDados={datasComDados}
            onTap={tocar}
          />
          <div className={styles.periodoPopFoot}>
            {periodo?.tipo === 'dia' && (
              <button
                type="button"
                className={styles.editBtn}
                onClick={() => { onChange(semanaDe(periodo.from)); setAnchor(null); setOpen(false) }}
              >
                Semana inteira ({ddmm(semanaDe(periodo.from).from)} a {ddmm(semanaDe(periodo.from).to)})
              </button>
            )}
            <button type="button" className={styles.primaryBtn} onClick={() => setOpen(false)}>Pronto</button>
          </div>
          <p className={styles.hint}>
            {anchor
              ? `Filtrando ${ddmm(anchor)}. Toque em outro dia para escolher um intervalo.`
              : 'Toque em um dia. Toque em um segundo dia para filtrar o intervalo.'}
            {' '}• = dia com lançamento.
          </p>
        </div>
      )}
    </div>
  )
}

function Calendario({ periodo, anchor, hoje, datasComDados, onTap }) {
  const [view, setView] = useState(() => {
    const [y, m] = (periodo?.to || hoje).split('-').map(Number)
    return { y, m: m - 1 }
  })
  const first = new Date(view.y, view.m, 1)
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const lead = first.getDay() // domingo = 0
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const raw = first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const isCurrentMonth = isoOf(view.y, view.m, 1) === `${hoje.slice(0, 8)}01`
  const shift = n => setView(v => {
    const d = new Date(v.y, v.m + n, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })

  return (
    <div className={styles.cal}>
      <div className={styles.calHead}>
        <button type="button" className={styles.iconBtnLg} onClick={() => shift(-1)} aria-label="Mês anterior"><ChevronLeft size={16} /></button>
        <div className={styles.calTitle}><span>{raw.charAt(0).toUpperCase() + raw.slice(1)}</span></div>
        <button type="button" className={styles.iconBtnLg} onClick={() => shift(1)} disabled={isCurrentMonth} aria-label="Próximo mês"><ChevronRight size={16} /></button>
      </div>
      <div className={styles.calGrid}>
        {WEEK_HEAD.map(w => <span key={w} className={styles.calWeek}>{w}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />
          const iso = isoOf(view.y, view.m, d)
          const inRange = periodo && iso >= periodo.from && iso <= periodo.to
          const edge = periodo && (iso === periodo.from || iso === periodo.to)
          const temDados = datasComDados.has(iso)
          return (
            <button
              type="button"
              key={iso}
              disabled={iso > hoje}
              onClick={() => onTap(iso)}
              aria-pressed={!!inRange}
              aria-label={`${ddmm(iso)}${temDados ? ', tem lançamento' : ''}`}
              className={[
                styles.pDay,
                inRange ? styles.pDayIn : '',
                edge || iso === anchor ? styles.pDayEdge : '',
                iso === hoje ? styles.calDayToday : '',
              ].join(' ')}
            >
              <span className={styles.calNum}>{d}</span>
              <span className={temDados ? styles.pDot : styles.pDotEmpty} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
