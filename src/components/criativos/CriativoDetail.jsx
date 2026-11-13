import { useState, useMemo, useEffect } from 'react'
import { Pencil, Trash2, TrendingUp, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  summarize, computeVerdict, todayISO,
  currency, percent, multiplier, decimal, integer,
} from '../../lib/criativosMetrics'
import {
  FASES, FORMATOS, Field, DriveThumb, parseNum, numToInput, formatDate,
} from './shared'
import styles from './Criativos.module.css'

const METRIC_FIELDS = [
  { key: 'gasto',            label: 'Gasto',            decimal: true },
  { key: 'impressoes',       label: 'Impressões' },
  { key: 'alcance',          label: 'Alcance' },
  { key: 'cliques_link',     label: 'Cliques no link' },
  { key: 'conversas',        label: 'Conversas' },
  { key: 'vendas',           label: 'Vendas' },
  { key: 'faturamento',      label: 'Faturamento',      decimal: true, optional: true },
  { key: 'orcamento_diario', label: 'Orçamento diário', decimal: true, optional: true },
]

function emptyDayForm(date = todayISO()) {
  return { data: date, ...Object.fromEntries(METRIC_FIELDS.map(m => [m.key, ''])) }
}

function rowToForm(row) {
  return { data: row.data, ...Object.fromEntries(METRIC_FIELDS.map(m => [m.key, numToInput(row[m.key])])) }
}

function formToPayload(form) {
  const payload = { data: form.data }
  METRIC_FIELDS.forEach(m => {
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

function LancarDia({ criativoId, rows, store, moeda }) {
  const [form, setForm] = useState(() => {
    const existing = rows.find(r => r.data === todayISO())
    return existing ? rowToForm(existing) : emptyDayForm()
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [flash, setFlash] = useState(false)
  const symbol = currency(0, moeda).replace(/[\d\s.,]/g, '')

  // Keep the form in sync when the same day is edited/deleted in the history.
  useEffect(() => {
    const existing = rows.find(r => r.data === form.data)
    setForm(existing ? rowToForm(existing) : emptyDayForm(form.data))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  // Picking a date that already has data loads it for editing, so saving
  // overwrites that day instead of creating a duplicate.
  function changeDate(date) {
    const existing = rows.find(r => r.data === date)
    setForm(existing ? rowToForm(existing) : { ...emptyDayForm(date) })
    setError(null)
  }

  const existingForDate = rows.some(r => r.data === form.data)
  const rowsByDate = useMemo(() => new Map(rows.map(r => [r.data, r])), [rows])
  const money = v => currency(v, moeda)

  async function save(e) {
    e.preventDefault()
    if (!form.data) return
    // Something typed that isn't a number would silently become 0 — flag it.
    const bad = METRIC_FIELDS.find(m => String(form[m.key] ?? '').trim() && parseNum(form[m.key], m.decimal) == null)
    if (bad) { setError(`"${form[bad.key]}" não é um número válido em ${bad.label}.`); return }
    setSaving(true)
    setError(null)
    const res = await store.saveMetrica(criativoId, formToPayload(form))
    setSaving(false)
    if (res.error) { console.error('[saveMetrica]', res.error); setError(saveErrorMessage(res.error)); return }
    setFlash(true)
    setTimeout(() => setFlash(false), 2200)
  }

  const dayTitle = new Date(`${form.data}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <form className={styles.dayForm} onSubmit={save}>
      <div className={styles.dayFormHeader}>
        <h2 className={styles.sectionTitle}>Lançar dia</h2>
        {flash && <span className={styles.flash}>Salvo ✓</span>}
      </div>
      <MonthCalendar selected={form.data} onSelect={changeDate} rowsByDate={rowsByDate} money={money} />
      <div className={styles.dayEditing}>
        <span>{existingForDate ? 'Editando' : 'Lançando'}: <strong>{dayTitle}</strong></span>
        {existingForDate && <small>Esse dia já tem dados — altere e toque em “Atualizar dia”.</small>}
      </div>
      <div className={styles.dayGrid}>
        {METRIC_FIELDS.map(m => (
          <Field key={m.key} label={`${m.label}${m.decimal ? ` (${symbol})` : ''}${m.optional ? ' · opcional' : ''}`}>
            <input
              className={styles.bigInput}
              inputMode={m.decimal ? 'decimal' : 'numeric'}
              value={form[m.key]}
              onChange={e => setForm(prev => ({ ...prev, [m.key]: e.target.value }))}
              placeholder="0"
            />
          </Field>
        ))}
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

// ── Histórico: cada linha edita no lugar ─────────────────────────────────────

const HISTORY_COLS = ['data', 'gasto', 'impressoes', 'alcance', 'cliques_link', 'conversas', 'vendas', 'faturamento', 'orcamento_diario']

function HistoryRow({ row, oferta, store }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => rowToForm(row))
  const [error, setError] = useState(null)
  const money = v => currency(v, oferta.moeda)
  const m = summarize([row], oferta.ticket_medio)

  useEffect(() => { if (!editing) setForm(rowToForm(row)) }, [row, editing])

  async function save() {
    const res = await store.updateMetrica(row.id, formToPayload(form))
    if (res.error) { setError(saveErrorMessage(res.error)); return }
    setError(null)
    setEditing(false)
  }

  async function remove() {
    if (!confirm(`Excluir o lançamento de ${formatDate(row.data)}?`)) return
    await store.deleteMetrica(row.id)
  }

  if (editing) {
    return (
      <tr className={styles.rowEditing}>
        {HISTORY_COLS.map(key => {
          const field = METRIC_FIELDS.find(f => f.key === key)
          return (
            <td key={key}>
              <input
                className={styles.cellInput}
                type={key === 'data' ? 'date' : 'text'}
                inputMode={key === 'data' ? undefined : field?.decimal ? 'decimal' : 'numeric'}
                value={form[key]}
                onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
                title={error || undefined}
              />
            </td>
          )
        })}
        <td colSpan={4} className={styles.hintCell}>{error || ''}</td>
        <td>
          <div className={styles.rowActions}>
            <button className={styles.iconBtn} onClick={save} title="Salvar"><Check size={14} /></button>
            <button className={styles.iconBtn} onClick={() => { setEditing(false); setError(null) }} title="Cancelar"><X size={14} /></button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td className={styles.strong}>{formatDate(row.data)}</td>
      <td className={styles.num}>{money(row.gasto)}</td>
      <td className={styles.num}>{integer(row.impressoes)}</td>
      <td className={styles.num}>{integer(row.alcance)}</td>
      <td className={styles.num}>{integer(row.cliques_link)}</td>
      <td className={styles.num}>{integer(row.conversas)}</td>
      <td className={`${styles.num} ${styles.strong}`}>{integer(row.vendas)}</td>
      <td className={styles.num}>{row.faturamento == null ? <span className={styles.muted}>{money(m.faturamento)}</span> : money(row.faturamento)}</td>
      <td className={styles.num}>{money(row.orcamento_diario)}</td>
      <td className={styles.num}>{money(m.cpa)}</td>
      <td className={styles.num}>{multiplier(m.roas)}</td>
      <td className={styles.num}>{percent(m.ctr)}</td>
      <td className={styles.num}>{decimal(m.frequencia)}</td>
      <td>
        <div className={styles.rowActions}>
          <button className={styles.iconBtn} onClick={() => setEditing(true)} title="Editar"><Pencil size={13} /></button>
          <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={remove} title="Excluir"><Trash2 size={13} /></button>
        </div>
      </td>
    </tr>
  )
}

// ── Campo de texto que salva ao sair ─────────────────────────────────────────

function InlineInput({ value, onSave, className, placeholder }) {
  const [v, setV] = useState(value || '')
  useEffect(() => { setV(value || '') }, [value])
  function commit() { if (v.trim() !== (value || '')) onSave(v.trim()) }
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

  const cards = [
    { label: 'Vendas',          value: integer(totals.vendas), highlight: true },
    { label: 'CPA',             value: money(totals.cpa), highlight: true },
    { label: 'ROAS',            value: multiplier(totals.roas), highlight: true },
    { label: 'Lucro',           value: money(totals.lucro), sign: totals.lucro },
    { label: 'ROI',             value: percent(totals.roi, 1), sign: totals.roi },
    { label: 'Gasto',           value: money(totals.gasto) },
    { label: 'Faturamento',     value: money(totals.faturamento) },
    { label: 'CTR',             value: percent(totals.ctr) },
    { label: 'CPM',             value: money(totals.cpm) },
    { label: 'Frequência',      value: decimal(totals.frequencia) },
    { label: 'Conversas',       value: integer(totals.conversas) },
    { label: 'Custo/conversa',  value: money(totals.custoConversa) },
    { label: 'Conversa→venda',  value: percent(totals.taxaConversaVenda) },
    { label: 'Orçamento atual', value: money(lastBudget) },
  ]

  return (
    <div className={styles.content}>
      <div className={styles.detailHero}>
        <DriveThumb link={criativo.link_drive} formato={criativo.formato} size="lg" />
        <div className={styles.detailHeroMain}>
          <div className={styles.detailNameRow}>
            <InlineInput
              className={styles.nameInput}
              value={criativo.nome}
              onSave={v => update({ nome: v || `AD ${criativo.numero}` })}
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
          {criativo.observacoes && <p className={styles.detailNotes}>{criativo.observacoes}</p>}
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
          <div className={`${styles.verdict} ${styles[`verdict_${verdict.level}`]}`}>{verdict.text}</div>
        )}
      </div>

      <LancarDia key={criativo.id} criativoId={criativo.id} rows={rows} store={store} moeda={moeda} />

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Histórico diário</h2>
        {rows.length === 0 ? (
          <p className={styles.hint}>Nenhum dia lançado ainda.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Data</th><th className={styles.num}>Gasto</th><th className={styles.num}>Impr.</th>
                  <th className={styles.num}>Alcance</th><th className={styles.num}>Cliques</th>
                  <th className={styles.num}>Conv.</th><th className={styles.num}>Vendas</th>
                  <th className={styles.num}>Faturam.</th><th className={styles.num}>Orçam.</th>
                  <th className={styles.num}>CPA</th><th className={styles.num}>ROAS</th>
                  <th className={styles.num}>CTR</th><th className={styles.num}>Freq.</th><th></th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map(row => (
                  <HistoryRow key={row.id} row={row} oferta={oferta} store={store} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Resumo acumulado</h2>
        <div className={styles.cards}>
          {cards.map(c => (
            <div key={c.label} className={`${styles.card} ${c.highlight ? styles.cardHighlight : ''}`}>
              <span className={styles.cardLabel}>{c.label}</span>
              <span className={`${styles.cardValue} ${c.sign > 0 ? styles.positive : c.sign < 0 ? styles.negative : ''}`}>{c.value}</span>
            </div>
          ))}
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
