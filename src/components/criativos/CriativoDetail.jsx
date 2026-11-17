import { useState, useMemo, useEffect, useRef } from 'react'
import { Pencil, Trash2, TrendingUp, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import {
  summarize, computeVerdict, todayISO, tipoOf,
  moedaContaOf, rowGasto, gastoEmReais, acrescimoNaData, cotacaoAtual, cotacaoQuando,
  currency, percent, multiplier, decimal, integer,
} from '../../lib/criativosMetrics'
import {
  FASES, FORMATOS, Field, DriveThumb, InfoTip, SumInput, parseNum, numToInput, formatDate,
} from './shared'
import { metricCols } from './metricCols'
import styles from './Criativos.module.css'

// Fields typed per day, per criativo. `tipos` limits a field to one offer
// type; fields of the other type stay saved in the database, just hidden
// (and never sent, so switching the offer type loses nothing).
// `extra` fields live in the collapsed "Mais dados" block.
const METRIC_FIELDS = [
  // Gasto is typed in the ad account currency and converted (see below).
  { key: 'gasto',            label: 'Gasto',               decimal: true, info: 'gasto', special: true, sum: true },
  { key: 'vendas',           label: 'Vendas',              info: 'vendas', sum: true },
  { key: 'conversas',        label: 'Conversas iniciadas', tipos: ['whatsapp'], info: 'conversas' },
  { key: 'checkouts',        label: 'Checkouts iniciados', tipos: ['direta'], optional: true, info: 'checkouts' },
  { key: 'impressoes',       label: 'Impressões',          info: 'cpm' },
  { key: 'ctr',              label: 'CTR (%)',             decimal: true, optional: true, info: 'ctr', pct: true },
  { key: 'faturamento',      label: 'Faturamento',         decimal: true, optional: true, extra: true, money: true, info: 'faturamento', sum: true },
  { key: 'frequencia',       label: 'Frequência',          decimal: true, optional: true, extra: true, info: 'frequencia' },
  { key: 'cliques_link',     label: 'Cliques no link',     tipos: ['direta'], optional: true, extra: true, info: 'cliques' },
  { key: 'orcamento_diario', label: 'Orçamento diário',    decimal: true, optional: true, extra: true, money: true, sum: true },
]

const fieldsFor = tipo => METRIC_FIELDS.filter(f => !f.tipos || f.tipos.includes(tipo))

// A new day uses the offer's account currency, rate and acréscimo.
function emptyDayForm(date, oferta) {
  const moeda = moedaContaOf(oferta)
  return {
    data: date,
    ...Object.fromEntries(METRIC_FIELDS.map(m => [m.key, ''])),
    moeda_gasto: moeda,
    cotacao: moeda === 'USD' ? numToInput(oferta.cotacao ?? null) : '1',
    acrescimo: numToInput(acrescimoNaData(oferta, date)),
  }
}

// A saved day keeps the currency, rate and acréscimo it was saved with, so
// editing it (or changing the offer later) never re-converts the past.
function rowToForm(row) {
  const g = rowGasto(row)
  return {
    data: row.data,
    ...Object.fromEntries(METRIC_FIELDS.map(m => [m.key, numToInput(row[m.key])])),
    gasto: numToInput(g.original),
    moeda_gasto: g.moeda,
    cotacao: numToInput(g.cotacao),
    acrescimo: numToInput(g.acrescimo),
  }
}

// Gasto em reais for the form as typed (null when the rate is missing).
function formGastoReais(form) {
  const original = parseNum(form.gasto) ?? 0
  const cotacao = form.moeda_gasto === 'USD' ? parseNum(form.cotacao) : 1
  if (!(cotacao > 0)) return null
  return gastoEmReais(original, cotacao, parseNum(form.acrescimo) ?? 0)
}

// Only the fields of the offer's type are sent: an upsert updates just the
// columns it receives, so hidden fields keep their saved values.
function formToPayload(form, tipo) {
  const payload = { data: form.data }
  const usd = form.moeda_gasto === 'USD'
  payload.gasto_original = parseNum(form.gasto) ?? 0
  payload.moeda_gasto = usd ? 'USD' : 'BRL'
  payload.cotacao = usd ? parseNum(form.cotacao) : 1
  payload.acrescimo = parseNum(form.acrescimo) ?? 0
  payload.gasto = formGastoReais(form) // always in reais: used by every calculation
  fieldsFor(tipo).filter(m => !m.special).forEach(m => {
    const n = parseNum(form[m.key], m.decimal)
    payload[m.key] = m.optional ? n : (n ?? 0)
  })
  return payload
}

function saveErrorMessage(error) {
  if (error.code === '23505') return 'Já existe um lançamento nessa data.'
  return `Não foi possível salvar${error.message ? `: ${error.message}` : ''}. Verifique a conexão e tente de novo.`
}

// ── Gráfico de linha simples ─────────────────────────────────────────────────

function MiniLineChart({ label, points, format, color = 'var(--accent)' }) {
  const valid = points.filter(p => p.value != null)
  if (valid.length === 0) {
    return (
      <div className={styles.chartCard}>
        <span className={styles.chartLabel}>{label}</span>
        <p className={styles.hint}>Sem dados suficientes.</p>
      </div>
    )
  }
  const values = valid.map(p => p.value)
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const W = 100
  const H = 60
  const stepX = points.length > 1 ? W / (points.length - 1) : 0
  const coords = points.map((p, i) => ({
    ...p,
    x: points.length > 1 ? i * stepX : W / 2,
    y: p.value == null ? null : H - ((p.value - min) / range) * H,
  }))
  // Days without a value (e.g. CPA with zero sales) break the line.
  const segments = []
  let current = []
  coords.forEach(c => {
    if (c.y == null) { if (current.length) segments.push(current); current = [] }
    else current.push(c)
  })
  if (current.length) segments.push(current)

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <span className={styles.chartLabel}>{label}</span>
        <span className={styles.chartLast}>{format(valid[valid.length - 1].value)}</span>
      </div>
      <svg viewBox={`-2 -6 ${W + 4} ${H + 12}`} preserveAspectRatio="none" className={styles.chartSvg}>
        {segments.map((seg, i) => (
          <polyline
            key={i}
            points={seg.map(c => `${c.x},${c.y}`).join(' ')}
            fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke"
          />
        ))}
        {coords.filter(c => c.y != null).map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="1.8" fill={color}>
            <title>{`${formatDate(c.date)}: ${format(c.value)}`}</title>
          </circle>
        ))}
      </svg>
      <div className={styles.chartLabels}>
        <span>{formatDate(points[0].date)}</span>
        {points.length > 1 && <span>{formatDate(points[points.length - 1].date)}</span>}
      </div>
    </div>
  )
}

// ── Calendário do mês ────────────────────────────────────────────────────────
// Every past day can be picked to fill in or fix its numbers; days that
// already have data show the spend and sales. Future days are disabled.

const WEEK_HEAD = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const pad2 = n => String(n).padStart(2, '0')
const isoOf = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`

function MonthCalendar({ selected, onSelect, rowsByDate, money }) {
  const today = todayISO()
  const [view, setView] = useState(() => {
    const [y, m] = (selected || today).split('-').map(Number)
    return { y, m: m - 1 }
  })
  // Follow the selection when it moves to another month.
  useEffect(() => {
    if (!selected) return
    const [y, m] = selected.split('-').map(Number)
    setView(v => (v.y === y && v.m === m - 1 ? v : { y, m: m - 1 }))
  }, [selected])

  const first = new Date(view.y, view.m, 1)
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const lead = (first.getDay() + 6) % 7 // segunda = 0
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const rawLabel = first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const monthLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1)
  const isCurrentMonth = isoOf(view.y, view.m, 1) === today.slice(0, 8) + '01'
  const shift = n => setView(v => {
    const d = new Date(v.y, v.m + n, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const filledThisMonth = cells.filter(d => d && rowsByDate.has(isoOf(view.y, view.m, d))).length

  return (
    <div className={styles.cal}>
      <div className={styles.calHead}>
        <button type="button" className={styles.iconBtnLg} onClick={() => shift(-1)} aria-label="Mês anterior"><ChevronLeft size={16} /></button>
        <div className={styles.calTitle}>
          <span>{monthLabel}</span>
          <small>{filledThisMonth} {filledThisMonth === 1 ? 'dia lançado' : 'dias lançados'}</small>
        </div>
        <button type="button" className={styles.iconBtnLg} onClick={() => shift(1)} disabled={isCurrentMonth} aria-label="Próximo mês"><ChevronRight size={16} /></button>
      </div>
      <div className={styles.calGrid} role="grid">
        {WEEK_HEAD.map(w => <span key={w} className={styles.calWeek}>{w}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />
          const iso = isoOf(view.y, view.m, d)
          const row = rowsByDate.get(iso)
          const future = iso > today
          return (
            <button
              type="button"
              key={iso}
              disabled={future}
              onClick={() => onSelect(iso)}
              aria-pressed={iso === selected}
              aria-label={`${d}${row ? `: gasto ${money(row.gasto)}, ${row.vendas} vendas` : ': sem dados'}`}
              className={[
                styles.calDay,
                row ? styles.calDayFilled : '',
                iso === selected ? styles.calDaySelected : '',
                iso === today ? styles.calDayToday : '',
              ].join(' ')}
            >
              <span className={styles.calNum}>{d}</span>
              {row && (
                <>
                  <span className={styles.calGasto}>{money(row.gasto)}</span>
                  <span className={styles.calVendas}>{Number(row.vendas) || 0} v</span>
                </>
              )}
            </button>
          )
        })}
      </div>
      <p className={styles.hint}>Toque em um dia para lançar ou corrigir os dados. Dias marcados já têm lançamento.</p>
    </div>
  )
}

// ── Lançar dia ───────────────────────────────────────────────────────────────

function LancarDia({ criativoId, rows, store, oferta, date, onDateChange }) {
  const moeda = oferta.moeda || 'BRL'
  const tipo = tipoOf(oferta)
  const fields = fieldsFor(tipo)
  const loadForm = d => {
    const existing = rows.find(r => r.data === d)
    return existing ? rowToForm(existing) : emptyDayForm(d, oferta)
  }
  const [form, setForm] = useState(() => loadForm(date))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [flash, setFlash] = useState(false)
  const hasExtra = f => fields.some(m => m.extra && String(f[m.key] ?? '').trim())
  const [moreOpen, setMoreOpen] = useState(() => hasExtra(form))
  const symbol = currency(0, moeda).replace(/[\d\s.,]/g, '')

  // Picking a date (calendar or history) loads that day; saving the same day
  // or deleting it in the history keeps the form in sync.
  // Cotação: a new day gets today's rate (the day you're typing it in, like
  // the sheet), whatever date it is for. A saved day keeps its own rate.
  // cotInfo.tipo: carregando | hoje | salva | manual | falha
  const [cotInfo, setCotInfo] = useState(null)
  const cotEditada = useRef(false)
  useEffect(() => {
    const next = loadForm(date)
    setForm(next)
    setError(null)
    if (hasExtra(next)) setMoreOpen(true)
    cotEditada.current = false
    const saved = rows.some(r => r.data === date)
    if (saved || next.moeda_gasto !== 'USD') { setCotInfo(saved ? { tipo: 'salva' } : null); return }
    let cancel = false
    setCotInfo({ tipo: 'carregando' })
    cotacaoAtual().then(r => {
      if (cancel) return
      if (!r) { setCotInfo({ tipo: 'falha' }); return }
      if (!cotEditada.current) setForm(prev => (prev.data === date ? { ...prev, cotacao: numToInput(r.valor) } : prev))
      setCotInfo(cotEditada.current ? { tipo: 'manual' } : { tipo: 'hoje', ...r })
    })
    return () => { cancel = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, rows])

  async function usarCotacaoHoje() {
    setCotInfo({ tipo: 'carregando' })
    const r = await cotacaoAtual({ force: true })
    if (!r) { setCotInfo({ tipo: 'falha', manter: true }); return }
    cotEditada.current = false
    setForm(prev => ({ ...prev, cotacao: numToInput(r.valor) }))
    setCotInfo({ tipo: 'hoje', ...r })
  }

  const existingForDate = rows.some(r => r.data === form.data)
  const rowsByDate = useMemo(() => new Map(rows.map(r => [r.data, r])), [rows])
  const money = v => currency(v, moeda)

  async function save(e) {
    e.preventDefault()
    if (!form.data) return
    // Something typed that isn't a number would silently become 0 — flag it.
    const bad = fields.find(m => String(form[m.key] ?? '').trim() && parseNum(form[m.key], m.decimal) == null)
    if (bad) { setError(`"${form[bad.key]}" não é um número válido em ${bad.label}.`); if (bad.extra) setMoreOpen(true); return }
    if (form.moeda_gasto === 'USD' && !(parseNum(form.cotacao) > 0)) {
      setError('Informe a cotação do dia (R$ por US$) em “Mais dados”.'); setMoreOpen(true); return
    }
    setSaving(true)
    setError(null)
    const res = await store.saveMetrica(criativoId, formToPayload(form, tipo))
    setSaving(false)
    if (res.error) { console.error('[saveMetrica]', res.error); setError(saveErrorMessage(res.error)); return }
    // The rate typed for a day becomes the default for the next days.
    const cot = parseNum(form.cotacao)
    if (form.moeda_gasto === 'USD' && cot > 0 && cot !== Number(oferta.cotacao)) store.updateOferta(oferta.id, { cotacao: cot })
    setFlash(true)
    setTimeout(() => setFlash(false), 2200)
  }

  const dayTitle = new Date(`${form.data}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  const usd = form.moeda_gasto === 'USD'
  const reais = formGastoReais(form)
  const gastoHint = usd
    ? (reais == null
      ? 'Informe a cotação em “Mais dados” para converter.'
      : `= ${money(reais)}  (US$ ${numToInput(parseNum(form.gasto) ?? 0)} × ${form.cotacao} × (1 + ${form.acrescimo || 0}%))`)
    : (parseNum(form.acrescimo) ? `= ${money(reais)} com acréscimo de ${form.acrescimo}%` : null)
  const gastoSymbol = usd ? 'US$' : 'R$'
  // A day saved in a currency other than the offer's (e.g. the offer was
  // switched to dollars later): one tap re-labels it before "Atualizar dia".
  const moedaOferta = moedaContaOf(oferta)
  const diaEmOutraMoeda = existingForDate && form.moeda_gasto !== moedaOferta
  function usarMoedaDaOferta() {
    setForm(prev => ({
      ...prev,
      moeda_gasto: moedaOferta,
      cotacao: moedaOferta === 'USD' ? numToInput(oferta.cotacao ?? null) : '1',
      acrescimo: numToInput(acrescimoNaData(oferta, prev.data)),
    }))
    if (moedaOferta === 'USD' && !(Number(oferta.cotacao) > 0)) setMoreOpen(true)
  }

  // Gasto takes two columns so its live conversion line doesn't push the
  // neighbouring field out of line.
  const input = m => m.key === 'gasto'
    ? <div key="gasto" className={styles.gastoCell}>{field(m)}</div>
    : field(m)

  const field = m => (
    <Field
      key={m.key}
      label={`${m.label}${m.key === 'gasto' ? ` (${gastoSymbol})` : m.money ? ` (${symbol})` : ''}${m.optional ? ' · opcional' : ''}`}
      info={m.info}
    >
      {m.sum ? (
        <SumInput
          className={styles.bigInput}
          isDecimal={!!m.decimal}
          value={form[m.key]}
          onChange={v => setForm(prev => ({ ...prev, [m.key]: v }))}
          // gasto shows its own line (sum + conversion) below
          format={m.key === 'gasto' ? (usd ? n => `US$ ${numToInput(n)}` : money) : m.decimal ? money : n => String(n)}
          placeholder={m.key === 'faturamento' ? 'vendas × ticket' : m.optional ? 'ex: 50+30' : '0'}
        />
      ) : (
        <input
          className={styles.bigInput}
          inputMode={m.decimal ? 'decimal' : 'numeric'}
          value={form[m.key]}
          onChange={e => setForm(prev => ({ ...prev, [m.key]: e.target.value }))}
          placeholder={
            m.key === 'cliques_link' ? 'impr. × CTR'
              : m.pct ? 'ex: 1,8' : m.optional ? '' : '0'
          }
        />
      )}
      {m.key === 'gasto' && gastoHint && <span className={styles.gastoReais} aria-live="polite">{gastoHint}</span>}
    </Field>
  )

  // Acréscimo of this day: editable, and shows what the offer's rule would use.
  const acrescimoRegra = acrescimoNaData(oferta, form.data)
  const acrescimoAtual = parseNum(form.acrescimo) ?? 0
  const acrescimoField = (
    <Field key="acrescimo" label="Acréscimo deste dia (%)" info="acrescimoDia">
      <input
        className={styles.bigInput}
        inputMode="decimal"
        value={form.acrescimo}
        onChange={e => setForm(prev => ({ ...prev, acrescimo: e.target.value }))}
        placeholder="0"
      />
      <span className={styles.gastoReais}>
        Aplicado: {numToInput(acrescimoAtual)}%
        {acrescimoAtual !== acrescimoRegra && <> · pela oferta seria {numToInput(acrescimoRegra)}%{' '}
          <button type="button" className={styles.linkBtn} onClick={() => setForm(prev => ({ ...prev, acrescimo: numToInput(acrescimoRegra) }))}>usar</button></>}
        {acrescimoAtual === acrescimoRegra && oferta.acrescimo_desde && form.data < oferta.acrescimo_desde && <> (antes do início do acréscimo)</>}
      </span>
    </Field>
  )

  const ultimaCotacao = Number(oferta.cotacao) > 0 ? numToInput(oferta.cotacao) : null
  const cotTexto = {
    carregando: 'Buscando a cotação de hoje…',
    hoje: cotInfo?.quando && `Cotação de hoje, ${cotacaoQuando(cotInfo.quando)} · ${cotInfo.fonte}`,
    salva: 'Cotação gravada neste dia',
    manual: 'Ajustada manualmente',
    falha: cotInfo?.manter
      ? 'Não foi possível buscar a cotação de hoje agora. A cotação do campo foi mantida.'
      : `Não foi possível buscar a cotação de hoje. Usando a última cotação usada${ultimaCotacao ? ` (R$ ${ultimaCotacao})` : ''}: ela não é a de hoje, confira.`,
  }[cotInfo?.tipo] || ''
  const cotacaoField = usd && (
    <Field key="cotacao" label="Cotação (R$ por US$)" info="cotacao">
      <input
        className={styles.bigInput}
        inputMode="decimal"
        value={form.cotacao}
        onChange={e => {
          cotEditada.current = true
          setForm(prev => ({ ...prev, cotacao: e.target.value }))
          setCotInfo({ tipo: 'manual' })
        }}
        placeholder="ex: 5,40"
      />
      {cotTexto && <span className={`${styles.gastoReais} ${cotInfo?.tipo === 'falha' ? styles.cotFalha : ''}`} aria-live="polite">{cotTexto}</span>}
      {cotInfo?.tipo !== 'hoje' && cotInfo?.tipo !== 'carregando' && (
        <button type="button" className={styles.linkBtn} onClick={usarCotacaoHoje}>Usar cotação de hoje</button>
      )}
    </Field>
  )

  return (
    <form className={styles.dayForm} onSubmit={save}>
      <div className={styles.dayFormHeader}>
        <h2 className={styles.sectionTitle}>Lançar dia</h2>
        {flash && <span className={styles.flash}>Salvo ✓</span>}
      </div>
      <MonthCalendar selected={form.data} onSelect={onDateChange} rowsByDate={rowsByDate} money={money} />
      <div className={styles.dayEditing}>
        <span>{existingForDate ? 'Editando' : 'Lançando'}: <strong>{dayTitle}</strong></span>
        {existingForDate && <small>Esse dia já tem dados — altere e toque em “Atualizar dia”.</small>}
      </div>
      {diaEmOutraMoeda && (
        <div className={styles.convertBox}>
          <p>
            Este dia foi salvo com o gasto em <strong>{form.moeda_gasto === 'USD' ? 'dólar' : 'reais'}</strong>, mas a oferta agora é em{' '}
            <strong>{moedaOferta === 'USD' ? 'dólar' : 'reais'}</strong>.
          </p>
          <button type="button" className={styles.editBtn} onClick={usarMoedaDaOferta}>
            O valor era em {moedaOferta === 'USD' ? 'dólar' : 'reais'} — usar {moedaOferta === 'USD' ? 'US$' : 'R$'} neste dia
          </button>
          <small>Depois toque em “Atualizar dia”. Para converter todos os dias de uma vez, use a engrenagem ⚙ da oferta.</small>
        </div>
      )}
      <div className={styles.dayGrid}>
        {fields.filter(m => !m.extra).map(input)}
      </div>
      <div className={styles.moreBox}>
        <button type="button" className={styles.moreToggle} aria-expanded={moreOpen} onClick={() => setMoreOpen(o => !o)}>
          <ChevronDown size={15} className={moreOpen ? styles.moreIconOpen : ''} />
          Mais dados
          <span>{[...(usd ? [`cotação ${form.cotacao || '?'}${cotInfo?.tipo === 'hoje' ? ' (hoje)' : ''}`] : []), `acréscimo ${numToInput(acrescimoAtual)}%`, ...fields.filter(m => m.extra).map(m => m.label.toLowerCase())].join(', ')}</span>
        </button>
        {moreOpen && <div className={styles.dayGrid}>{cotacaoField}{acrescimoField}{fields.filter(m => m.extra).map(input)}</div>}
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.dayActions}>
        <button type="submit" className={styles.primaryBtn} disabled={saving}>
          {saving ? 'Salvando...' : existingForDate ? 'Atualizar dia' : 'Salvar dia'}
        </button>
      </div>
    </form>
  )
}

// ── Histórico: uma linha por dia; editar abre o dia no formulário ───────────

function HistoryRow({ row, oferta, store, onEdit }) {
  const money = v => currency(v, oferta.moeda)
  const m = summarize([row], oferta.ticket_medio)
  const direta = tipoOf(oferta) === 'direta'
  const g = rowGasto(row)
  const gastoTitle = g.moeda === 'USD'
    ? `US$ ${numToInput(g.original)} × ${numToInput(g.cotacao)} × (1 + ${numToInput(g.acrescimo)}%)`
    : g.acrescimo ? `R$ ${numToInput(g.original)} + ${numToInput(g.acrescimo)}%` : undefined

  async function remove() {
    if (!confirm(`Excluir o lançamento de ${formatDate(row.data)}?`)) return
    await store.deleteMetrica(row.id)
  }

  return (
    <tr>
      <td className={styles.strong}>{formatDate(row.data)}</td>
      <td className={styles.num} title={gastoTitle}>
        {money(row.gasto)}
        {g.moeda === 'USD' && <small className={styles.cellSub}>US$ {numToInput(g.original)}</small>}
      </td>
      <td className={`${styles.num} ${styles.strong}`}>{integer(row.vendas)}</td>
      {/* Lucro do dia = faturamento − gasto em reais: verde lucro, vermelho prejuízo.
          Fica perto do início para aparecer no celular sem rolar a tabela. */}
      <td
        className={`${styles.num} ${styles.bold} ${m.lucro > 0 ? styles.positive : m.lucro < 0 ? styles.negative : ''}`}
        title={m.lucro > 0 ? 'Lucro no dia' : m.lucro < 0 ? 'Prejuízo no dia' : undefined}
      >
        {money(m.lucro)}
      </td>
      {direta ? (
        <>
          <td className={styles.num}>{row.checkouts == null ? '—' : integer(row.checkouts)}</td>
          <td className={styles.num}>
            {m.cliques == null ? '—' : integer(Math.round(m.cliques))}
            {m.cliquesAprox && <small className={styles.approx}> aprox.</small>}
          </td>
        </>
      ) : (
        <td className={styles.num}>{integer(row.conversas)}</td>
      )}
      <td className={styles.num}>{integer(row.impressoes)}</td>
      <td className={styles.num}>{percent(m.ctr)}</td>
      <td className={styles.num}>{decimal(m.frequencia)}</td>
      <td className={styles.num}>{row.faturamento == null ? <span className={styles.muted}>{money(m.faturamento)}</span> : money(row.faturamento)}</td>
      <td className={styles.num}>{money(m.cpa)}</td>
      <td className={styles.num}>{multiplier(m.roas)}</td>
      <td>
        <div className={styles.rowActions}>
          <button className={styles.iconBtn} onClick={() => onEdit(row.data)} title="Editar este dia" aria-label={`Editar ${formatDate(row.data)}`}><Pencil size={13} /></button>
          <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={remove} title="Excluir" aria-label={`Excluir ${formatDate(row.data)}`}><Trash2 size={13} /></button>
        </div>
      </td>
    </tr>
  )
}

// ── Campo de texto que salva ao sair ─────────────────────────────────────────

function InlineInput({ value, onSave, className, placeholder, required = false }) {
  const [v, setV] = useState(value || '')
  useEffect(() => { setV(value || '') }, [value])
  function commit() {
    if (required && !v.trim()) { setV(value || ''); return } // empty → keep the previous value
    if (v.trim() !== (value || '')) onSave(v.trim())
  }
  return (
    <input
      className={className}
      value={v}
      placeholder={placeholder}
      onChange={e => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
    />
  )
}

// ── Descrição: texto livre do criativo, salva ao sair do campo ──────────────
// (guardada na coluna `observacoes`).

function DescricaoField({ value, onSave }) {
  const [v, setV] = useState(value || '')
  const [saved, setSaved] = useState(false)
  useEffect(() => { setV(value || '') }, [value])
  async function commit() {
    if (v.trim() === (value || '').trim()) return
    const res = await onSave(v.trim())
    if (res?.error) return
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabelRow}>
        <label className={styles.fieldLabel} htmlFor="criativo-descricao">Descrição</label>
        {saved && <span className={styles.flash}>Salvo ✓</span>}
      </span>
      <textarea
        id="criativo-descricao"
        className={styles.descricao}
        value={v}
        rows={2}
        placeholder="Informações importantes. Ex: criativos salvos no e-mail fulano@gmail.com"
        onChange={e => setV(e.target.value)}
        onBlur={commit}
      />
    </div>
  )
}

// ── Detalhe ──────────────────────────────────────────────────────────────────

export default function CriativoDetail({ criativo, oferta, rows, store, onDeleted, onEdit }) {
  const moeda = oferta.moeda || 'BRL'
  const money = v => currency(v, moeda)
  const totals = useMemo(() => summarize(rows, oferta.ticket_medio), [rows, oferta.ticket_medio])
  const verdict = computeVerdict(criativo, rows, oferta)
  const lastBudget = [...rows].reverse().find(r => r.orcamento_diario != null)?.orcamento_diario
  const update = fields => store.updateCriativo(criativo.id, fields)

  async function removeCriativo() {
    if (!confirm(`Excluir o criativo "${criativo.nome}" e todos os lançamentos?`)) return
    await store.deleteCriativo(criativo.id)
    onDeleted()
  }

  const [dayDate, setDayDate] = useState(todayISO)
  const formRef = useRef(null)
  const editDay = d => { setDayDate(d); formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }) }
  const cpaMax = Number(oferta.cpa_maximo) || null
  // Only the metrics of the offer type; highlight the ones that decide.
  const cards = metricCols(oferta).map(c => ({ ...c, highlight: ["vendas", "cpa", "roas"].includes(c.key) }))

  return (
    <div className={styles.content}>
      <div className={styles.detailHero}>
        <DriveThumb link={criativo.link_drive} formato={criativo.formato} size="lg" />
        <div className={styles.detailHeroMain}>
          <div className={styles.detailNameRow}>
            <InlineInput
              className={styles.nameInput}
              value={criativo.nome}
              required
              onSave={v => update({ nome: v })}
            />
            <button className={styles.editBtn} onClick={onEdit} title="Editar criativo">
              <Pencil size={14} /> Editar
            </button>
            <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={removeCriativo} title="Excluir criativo">
              <Trash2 size={15} />
            </button>
          </div>
          <Field label="Link do Drive">
            <InlineInput value={criativo.link_drive} onSave={v => update({ link_drive: v })} placeholder="https://drive.google.com/file/d/..." />
          </Field>
          <div className={styles.fieldRow}>
            <Field label="Formato">
              <select value={criativo.formato} onChange={e => update({ formato: e.target.value })}>
                {FORMATOS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Ângulo">
              <InlineInput value={criativo.angulo} onSave={v => update({ angulo: v })} placeholder="Gancho da copy" />
            </Field>
          </div>
          <DescricaoField value={criativo.observacoes} onSave={v => update({ observacoes: v })} />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.faseButtons}>
          {FASES.map(f => (
            <button
              key={f.id}
              className={`${styles.faseBtn} ${styles[`faseBtn_${f.id}`]} ${criativo.fase === f.id ? styles.faseBtnActive : ''}`}
              onClick={() => criativo.fase !== f.id && update({ fase: f.id })}
            >
              {f.label}
            </button>
          ))}
        </div>
        {verdict.text && (
          <div className={`${styles.verdict} ${styles[`verdict_${verdict.level}`]}`}>
            {verdict.text}
            {verdict.reason && <span className={styles.verdictReason}>{verdict.reason}</span>}
          </div>
        )}
      </div>

      <div ref={formRef}>
        <LancarDia
          key={criativo.id}
          criativoId={criativo.id}
          rows={rows}
          store={store}
          oferta={oferta}
          date={dayDate}
          onDateChange={setDayDate}
        />
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Histórico diário</h2>
        {rows.length === 0 ? (
          <p className={styles.hint}>Nenhum dia lançado ainda.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Data</th><th className={styles.num}>Gasto</th><th className={styles.num}>Vendas</th>
                  <th className={styles.num}><span className={styles.thInfo}>Lucro<InfoTip info="lucro" title="Lucro do dia" /></span></th>
                  {tipoOf(oferta) === "direta"
                    ? <><th className={styles.num}>Checkouts</th><th className={styles.num}>Cliques</th></>
                    : <th className={styles.num}>Conversas</th>}
                  <th className={styles.num}>Impr.</th><th className={styles.num}>CTR</th><th className={styles.num}>Freq.</th>
                  <th className={styles.num}>Faturam.</th>
                  <th className={styles.num}>CPA</th><th className={styles.num}>ROAS</th><th></th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map(row => (
                  <HistoryRow key={row.id} row={row} oferta={oferta} store={store} onEdit={editDay} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Resumo acumulado</h2>
        <div className={styles.cards}>
          {cards.map(c => {
            const sg = c.sign?.(totals)
            return (
              <div key={c.key} className={`${styles.card} ${c.highlight ? styles.cardHighlight : ""}`}>
                <span className={styles.cardLabelRow}>
                  <span className={styles.cardLabel}>{c.label}</span>
                  <InfoTip info={c.info} title={c.label} />
                </span>
                <span className={`${styles.cardValue} ${sg > 0 ? styles.positive : sg < 0 ? styles.negative : ""}`}>
                  {c.fmt(totals)}
                </span>
                {c.aprox?.(totals) && <span className={styles.cardSub}>aproximado</span>}
                {c.detail?.(totals) && <span className={styles.cardSub}>{c.detail(totals)}</span>}
                {c.key === "cpa" && cpaMax && <span className={styles.cardSub}>máx. {money(cpaMax)}</span>}
              </div>
            )
          })}
          <div className={styles.card}>
            <span className={styles.cardLabel}>Orçamento atual</span>
            <span className={styles.cardValue}>{money(lastBudget)}</span>
          </div>
        </div>
      </div>

      {rows.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}><TrendingUp size={15} /> Evolução diária</h2>
          <div className={styles.chartsGrid}>
            <MiniLineChart
              label="CPA por dia"
              points={rows.map(r => ({ date: r.data, value: summarize([r], oferta.ticket_medio).cpa }))}
              format={money}
            />
            <MiniLineChart
              label="Vendas por dia"
              points={rows.map(r => ({ date: r.data, value: Number(r.vendas || 0) }))}
              format={integer}
              color="#4ade80"
            />
          </div>
        </div>
      )}
    </div>
  )
}
