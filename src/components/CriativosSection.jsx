import { useState, useMemo, useEffect, useRef } from 'react'
import { Plus, Settings, ArrowLeft, Pencil, Trash2, Trophy, List, TrendingUp } from 'lucide-react'
import { useCriativosStore } from '../hooks/useCriativosStore'
import {
  summarize, dailyMetrics, computeVerdict,
  currency, percent, multiplier, decimal, integer,
} from '../lib/criativosMetrics'
import Modal from './Modal'
import styles from './CriativosSection.module.css'

const FASES = [
  { id: 'teste',      label: 'Teste' },
  { id: 'pre_escala', label: 'Pré-escala' },
  { id: 'escala',     label: 'Escala' },
  { id: 'pausado',    label: 'Pausado' },
  { id: 'cortado',    label: 'Cortado' },
]
const FASE_LABEL = Object.fromEntries(FASES.map(f => [f.id, f.label]))

const FORMATOS = [
  { id: 'video',     label: 'Vídeo' },
  { id: 'imagem',    label: 'Imagem' },
  { id: 'carrossel', label: 'Carrossel' },
]
const FORMATO_LABEL = Object.fromEntries(FORMATOS.map(f => [f.id, f.label]))

const METRIC_FIELDS = [
  { key: 'gasto',            label: 'Gasto (R$)',          decimal: true },
  { key: 'impressoes',       label: 'Impressões' },
  { key: 'alcance',          label: 'Alcance' },
  { key: 'cliques_link',     label: 'Cliques no link' },
  { key: 'conversas',        label: 'Conversas' },
  { key: 'vendas',           label: 'Vendas' },
  { key: 'faturamento',      label: 'Faturamento (R$)',    decimal: true, optional: true },
  { key: 'orcamento_diario', label: 'Orçamento diário (R$)', decimal: true, optional: true },
]

function todayISO() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// Accepts "1.234,50" (pt-BR) as well as "1234.50"; empty → null. Integer
// fields treat any dot/comma as a thousands separator ("12.345" impressões).
function parseNum(v, isDecimal = true) {
  const s = String(v ?? '').trim()
  if (!s) return null
  const n = Number(!isDecimal ? s.replace(/[.,\s]/g, '') : s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s)
  return Number.isFinite(n) ? n : null
}

function Field({ label, children }) {
  return <div className={styles.field}><label className={styles.fieldLabel}>{label}</label>{children}</div>
}

function FaseBadge({ fase }) {
  return <span className={`${styles.faseBadge} ${styles[`fase_${fase}`]}`}>{FASE_LABEL[fase]}</span>
}

function VerdictLine({ verdict, big = false }) {
  return (
    <div className={`${styles.verdict} ${styles[`verdict_${verdict.level}`]} ${big ? styles.verdictBig : ''}`}>
      <span className={styles.verdictEmoji}>{verdict.emoji}</span>
      <span>{verdict.text}</span>
    </div>
  )
}

// ── Modais ────────────────────────────────────────────────────────────────────

function CriativoModal({ criativo, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    nome: criativo?.nome || '',
    angulo: criativo?.angulo || '',
    formato: criativo?.formato || 'video',
    fase: criativo?.fase || 'teste',
    data_inicio: criativo?.data_inicio || todayISO(),
    observacoes: criativo?.observacoes || '',
  }))
  const f = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }))

  async function save() {
    if (!form.nome.trim()) return
    await onSave({ ...form, nome: form.nome.trim() })
    onClose()
  }

  return (
    <Modal title={criativo ? 'Editar criativo' : 'Novo criativo'} onClose={onClose} onSave={save}>
      <Field label="Nome">
        <input value={form.nome} onChange={f('nome')} placeholder="Ex: Vídeo depoimento Ana" autoFocus />
      </Field>
      <Field label="Ângulo / gancho da copy">
        <input value={form.angulo} onChange={f('angulo')} placeholder="Ex: Dor de não ter tempo" />
      </Field>
      <div className={styles.fieldRow}>
        <Field label="Formato">
          <select value={form.formato} onChange={f('formato')}>
            {FORMATOS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Fase">
          <select value={form.fase} onChange={f('fase')}>
            {FASES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Data de início">
        <input type="date" value={form.data_inicio} onChange={f('data_inicio')} />
      </Field>
      <Field label="Observações">
        <textarea value={form.observacoes} onChange={f('observacoes')} />
      </Field>
    </Modal>
  )
}

const CONFIG_FIELDS = [
  { key: 'ticket_medio',        label: 'Ticket médio (R$)' },
  { key: 'cpa_maximo',          label: 'CPA máximo (R$)' },
  { key: 'ctr_minimo',          label: 'CTR mínimo (%)' },
  { key: 'freq_max_pre_escala', label: 'Frequência máx. — pré-escala' },
  { key: 'freq_max_escala',     label: 'Frequência máx. — escala' },
]

function ConfigModal({ config, onClose, onSave }) {
  const [form, setForm] = useState(() =>
    Object.fromEntries(CONFIG_FIELDS.map(c => [c.key, config[c.key] == null ? '' : String(config[c.key]).replace('.', ',')])),
  )

  async function save() {
    const payload = Object.fromEntries(CONFIG_FIELDS.map(c => [c.key, parseNum(form[c.key])]))
    if (payload.ctr_minimo == null) payload.ctr_minimo = 1
    if (payload.freq_max_pre_escala == null) payload.freq_max_pre_escala = 2
    if (payload.freq_max_escala == null) payload.freq_max_escala = 3
    await onSave(payload)
    onClose()
  }

  return (
    <Modal title="Configurações dos criativos" onClose={onClose} onSave={save}>
      {CONFIG_FIELDS.map(c => (
        <Field key={c.key} label={c.label}>
          <input
            className={styles.bigInput}
            inputMode="decimal"
            value={form[c.key]}
            onChange={e => setForm(prev => ({ ...prev, [c.key]: e.target.value }))}
          />
        </Field>
      ))}
      <p className={styles.hint}>
        O CPA máximo é a base do semáforo. Se o faturamento de um dia ficar vazio, o ROAS usa vendas × ticket médio.
      </p>
    </Modal>
  )
}

// ── Gráfico de linha simples ─────────────────────────────────────────────────

function MiniLineChart({ label, points, format, color = 'var(--purple)' }) {
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

  const last = valid[valid.length - 1]

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <span className={styles.chartLabel}>{label}</span>
        <span className={styles.chartLast}>{format(last.value)}</span>
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

// ── Lançar dia ───────────────────────────────────────────────────────────────

function emptyDayForm(date = todayISO()) {
  return { data: date, ...Object.fromEntries(METRIC_FIELDS.map(m => [m.key, ''])) }
}

function rowToForm(row) {
  return {
    data: row.data,
    ...Object.fromEntries(METRIC_FIELDS.map(m => [
      m.key, row[m.key] == null ? '' : String(row[m.key]).replace('.', ','),
    ])),
  }
}

function LancarDia({ criativoId, rows, store, editing, onDoneEditing, formRef }) {
  const [form, setForm] = useState(() => emptyDayForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (editing) { setForm(rowToForm(editing)); setError(null) }
  }, [editing])

  // Picking a date that already has data loads it, so saving overwrites
  // that day instead of silently creating a confusing duplicate.
  function changeDate(date) {
    if (editing) { setForm(prev => ({ ...prev, data: date })); return }
    const existing = rows.find(r => r.data === date)
    setForm(existing ? rowToForm(existing) : { ...form, data: date })
  }

  const existingForDate = !editing && rows.some(r => r.data === form.data)

  async function save(e) {
    e.preventDefault()
    if (!form.data) return
    setSaving(true)
    setError(null)
    const payload = { data: form.data }
    METRIC_FIELDS.forEach(m => {
      const n = parseNum(form[m.key], m.decimal)
      payload[m.key] = m.optional ? n : (n ?? 0)
    })
    const res = editing
      ? await store.updateMetrica(editing.id, payload)
      : await store.saveMetrica(criativoId, payload)
    setSaving(false)
    if (res.error) {
      setError(res.error.code === '23505' ? 'Já existe um lançamento nessa data.' : 'Não foi possível salvar.')
      return
    }
    setForm(emptyDayForm())
    setFlash(true)
    setTimeout(() => setFlash(false), 1600)
    if (editing) onDoneEditing()
  }

  function cancelEdit() {
    setForm(emptyDayForm())
    onDoneEditing()
  }

  return (
    <form ref={formRef} className={styles.dayForm} onSubmit={save}>
      <div className={styles.dayFormHeader}>
        <h2 className={styles.sectionTitle}>{editing ? 'Editar lançamento' : 'Lançar dia'}</h2>
        {flash && <span className={styles.flash}>Salvo ✓</span>}
      </div>
      <Field label="Data">
        <input className={styles.bigInput} type="date" value={form.data} onChange={e => changeDate(e.target.value)} />
      </Field>
      {existingForDate && <p className={styles.hint}>Esse dia já tem dados — salvar vai substituir.</p>}
      <div className={styles.dayGrid}>
        {METRIC_FIELDS.map(m => (
          <Field key={m.key} label={m.optional ? `${m.label} · opcional` : m.label}>
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
        {editing && <button type="button" className={styles.secondaryBtn} onClick={cancelEdit}>Cancelar</button>}
        <button type="submit" className={styles.primaryBtn} disabled={saving}>
          {saving ? 'Salvando...' : editing || existingForDate ? 'Atualizar dia' : 'Salvar dia'}
        </button>
      </div>
    </form>
  )
}

// ── Detalhe ──────────────────────────────────────────────────────────────────

function CriativoDetail({ criativo, rows, store, onBack, onEdit }) {
  const { config } = store
  const [editingRow, setEditingRow] = useState(null)
  const formRef = useRef(null)

  const totals = useMemo(() => summarize(rows, config.ticket_medio), [rows, config.ticket_medio])
  const verdict = computeVerdict(criativo, rows, config)
  const daily = useMemo(
    () => rows.map(r => ({ row: r, m: dailyMetrics(r, config.ticket_medio) })),
    [rows, config.ticket_medio],
  )
  const lastBudget = [...rows].reverse().find(r => r.orcamento_diario != null)?.orcamento_diario

  function startEdit(row) {
    setEditingRow(row)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function removeRow(row) {
    if (!confirm(`Excluir o lançamento de ${formatDate(row.data)}?`)) return
    if (editingRow?.id === row.id) setEditingRow(null)
    await store.deleteMetrica(row.id)
  }

  async function removeCriativo() {
    if (!confirm(`Excluir o criativo "${criativo.nome}" e todos os lançamentos?`)) return
    await store.deleteCriativo(criativo.id)
    onBack()
  }

  const cards = [
    { label: 'Vendas',          value: integer(totals.vendas), highlight: true },
    { label: 'CPA',             value: currency(totals.cpa), highlight: true },
    { label: 'ROAS',            value: multiplier(totals.roas), highlight: true },
    { label: 'Gasto',           value: currency(totals.gasto) },
    { label: 'Faturamento',     value: currency(totals.faturamento) },
    { label: 'CTR',             value: percent(totals.ctr) },
    { label: 'CPM',             value: currency(totals.cpm) },
    { label: 'Frequência',      value: decimal(totals.frequencia) },
    { label: 'Conversas',       value: integer(totals.conversas) },
    { label: 'Custo/conversa',  value: currency(totals.custoConversa) },
    { label: 'Conversa→venda',  value: percent(totals.taxaConversaVenda) },
    { label: 'Orçamento atual', value: currency(lastBudget) },
  ]

  return (
    <div className={styles.wrap}>
      <div className={styles.detailTop}>
        <button className={styles.backBtn} onClick={onBack}><ArrowLeft size={15} /> Criativos</button>
        <div className={styles.detailTopActions}>
          <button className={styles.iconBtn} onClick={onEdit} title="Editar criativo"><Pencil size={15} /></button>
          <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={removeCriativo} title="Excluir criativo">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.detailHead}>
          <h1 className={styles.title}>{criativo.nome}</h1>
          <div className={styles.metaRow}>
            <FaseBadge fase={criativo.fase} />
            <span className={styles.metaText}>{FORMATO_LABEL[criativo.formato]}</span>
            <span className={styles.metaText}>desde {formatDate(criativo.data_inicio)}</span>
            <span className={styles.metaText}>{totals.dias} {totals.dias === 1 ? 'dia' : 'dias'} de dados</span>
          </div>
          {criativo.angulo && <p className={styles.angulo}>“{criativo.angulo}”</p>}
          {criativo.observacoes && <p className={styles.obs}>{criativo.observacoes}</p>}
        </div>

        <VerdictLine verdict={verdict} big />

        <div className={styles.section}>
          <span className={styles.fieldLabel}>Mudar fase</span>
          <div className={styles.faseButtons}>
            {FASES.map(f => (
              <button
                key={f.id}
                className={`${styles.faseBtn} ${criativo.fase === f.id ? styles.faseBtnActive : ''}`}
                onClick={() => criativo.fase !== f.id && store.updateCriativo(criativo.id, { fase: f.id })}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <LancarDia
          criativoId={criativo.id}
          rows={rows}
          store={store}
          editing={editingRow}
          onDoneEditing={() => setEditingRow(null)}
          formRef={formRef}
        />

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Resumo acumulado</h2>
          <div className={styles.cards}>
            {cards.map(c => (
              <div key={c.label} className={`${styles.card} ${c.highlight ? styles.cardHighlight : ''}`}>
                <span className={styles.cardLabel}>{c.label}</span>
                <span className={styles.cardValue}>{c.value}</span>
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
                points={daily.map(d => ({ date: d.row.data, value: d.m.cpa }))}
                format={currency}
              />
              <MiniLineChart
                label="Vendas por dia"
                points={daily.map(d => ({ date: d.row.data, value: d.m.vendas }))}
                format={integer}
                color="#4ade80"
              />
            </div>
          </div>
        )}

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Histórico</h2>
          {rows.length === 0 ? (
            <p className={styles.hint}>Nenhum dia lançado ainda.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Data</th><th>Gasto</th><th>Vendas</th><th>CPA</th><th>ROAS</th>
                    <th>CTR</th><th>CPM</th><th>Freq.</th><th>Conv.</th><th>Custo/conv.</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {[...daily].reverse().map(({ row, m }) => (
                    <tr key={row.id} className={editingRow?.id === row.id ? styles.rowEditing : ''}>
                      <td className={styles.strong}>{formatDate(row.data)}</td>
                      <td>{currency(m.gasto)}</td>
                      <td className={styles.strong}>{integer(m.vendas)}</td>
                      <td>{currency(m.cpa)}</td>
                      <td>{multiplier(m.roas)}</td>
                      <td>{percent(m.ctr)}</td>
                      <td>{currency(m.cpm)}</td>
                      <td>{decimal(m.frequencia)}</td>
                      <td>{integer(m.conversas)}</td>
                      <td>{currency(m.custoConversa)}</td>
                      <td>
                        <div className={styles.rowActions}>
                          <button className={styles.iconBtn} onClick={() => startEdit(row)} title="Editar"><Pencil size={13} /></button>
                          <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => removeRow(row)} title="Excluir">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Seção principal ──────────────────────────────────────────────────────────

export default function CriativosSection({ user }) {
  const store = useCriativosStore(user)
  const { criativos, metricas, config, loading } = store
  const [view, setView] = useState('lista')
  const [faseFilter, setFaseFilter] = useState('todas')
  const [selectedId, setSelectedId] = useState(null)
  const [modal, setModal] = useState(null)

  const rowsByCriativo = useMemo(() => {
    const map = {}
    metricas.forEach(m => { (map[m.criativo_id] ||= []).push(m) })
    return map
  }, [metricas])

  const enriched = useMemo(() => criativos.map(c => {
    const rows = rowsByCriativo[c.id] || []
    return { criativo: c, rows, totals: summarize(rows, config.ticket_medio), verdict: computeVerdict(c, rows, config) }
  }), [criativos, rowsByCriativo, config])

  const filtered = faseFilter === 'todas' ? enriched : enriched.filter(e => e.criativo.fase === faseFilter)
  const ranking = useMemo(
    () => [...enriched].sort((a, b) => b.totals.vendas - a.totals.vendas || (a.totals.cpa ?? Infinity) - (b.totals.cpa ?? Infinity)),
    [enriched],
  )

  const selected = criativos.find(c => c.id === selectedId)

  if (loading) {
    return <div className={styles.empty}><span className={styles.loadingIcon}>◆</span></div>
  }

  const modals = (
    <>
      {modal === 'novo' && (
        <CriativoModal
          onClose={() => setModal(null)}
          onSave={async fields => { const c = await store.addCriativo(fields); if (c) setSelectedId(c.id) }}
        />
      )}
      {modal === 'editar' && selected && (
        <CriativoModal
          criativo={selected}
          onClose={() => setModal(null)}
          onSave={fields => store.updateCriativo(selected.id, fields)}
        />
      )}
      {modal === 'config' && (
        <ConfigModal config={config} onClose={() => setModal(null)} onSave={store.saveConfig} />
      )}
    </>
  )

  if (selected) {
    return (
      <>
        <CriativoDetail
          key={selected.id}
          criativo={selected}
          rows={rowsByCriativo[selected.id] || []}
          store={store}
          onBack={() => setSelectedId(null)}
          onEdit={() => setModal('editar')}
        />
        {modals}
      </>
    )
  }

  const champion = ranking[0]?.totals.vendas > 0 ? ranking[0] : null

  return (
    <div className={styles.wrap}>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.title}>Criativos</h1>
          <span className={styles.subtitle}>
            {config.cpa_maximo
              ? `CPA máximo ${currency(config.cpa_maximo)} · Ticket ${currency(config.ticket_medio)}`
              : 'Defina o CPA máximo na engrenagem para ativar o semáforo'}
          </span>
        </div>
        <div className={styles.controls}>
          <button className={styles.iconBtnLg} onClick={() => setModal('config')} title="Configurações">
            <Settings size={17} />
          </button>
          <button className={styles.primaryBtn} onClick={() => setModal('novo')}>
            <Plus size={15} /> Novo criativo
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.viewToggle}>
          <button className={view === 'lista' ? styles.viewToggleActive : ''} onClick={() => setView('lista')}>
            <List size={14} /> Lista
          </button>
          <button className={view === 'ranking' ? styles.viewToggleActive : ''} onClick={() => setView('ranking')}>
            <Trophy size={14} /> Ranking
          </button>
        </div>

        {criativos.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>◆</div>
            <p>Nenhum criativo ainda. Toque em “Novo criativo” para começar.</p>
          </div>
        ) : view === 'lista' ? (
          <>
            <div className={styles.filterRow}>
              {[{ id: 'todas', label: 'Todas' }, ...FASES].map(f => {
                const count = f.id === 'todas' ? enriched.length : enriched.filter(e => e.criativo.fase === f.id).length
                return (
                  <button
                    key={f.id}
                    className={`${styles.pill} ${faseFilter === f.id ? styles.pillActive : ''}`}
                    onClick={() => setFaseFilter(f.id)}
                  >
                    {f.label} <span className={styles.pillCount}>{count}</span>
                  </button>
                )
              })}
            </div>

            {filtered.length === 0 ? (
              <p className={styles.hint}>Nenhum criativo nesta fase.</p>
            ) : (
              <div className={styles.list}>
                {filtered.map(({ criativo, totals, verdict }) => (
                  <button key={criativo.id} className={styles.criativoCard} onClick={() => setSelectedId(criativo.id)}>
                    <div className={styles.cardTop}>
                      <span className={styles.cardName}>{criativo.nome}</span>
                      <FaseBadge fase={criativo.fase} />
                    </div>
                    {criativo.angulo && <span className={styles.cardAngulo}>{criativo.angulo}</span>}
                    <VerdictLine verdict={verdict} />
                    <div className={styles.cardStats}>
                      <div><span className={styles.statLabel}>Vendas</span><span className={styles.statValue}>{integer(totals.vendas)}</span></div>
                      <div><span className={styles.statLabel}>CPA</span><span className={styles.statValue}>{currency(totals.cpa)}</span></div>
                      <div><span className={styles.statLabel}>ROAS</span><span className={styles.statValue}>{multiplier(totals.roas)}</span></div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className={styles.ranking}>
            {ranking.map(({ criativo, totals }, i) => {
              const isChampion = champion && champion.criativo.id === criativo.id
              return (
                <button
                  key={criativo.id}
                  className={`${styles.rankRow} ${isChampion ? styles.rankChampion : ''}`}
                  onClick={() => setSelectedId(criativo.id)}
                >
                  <span className={styles.rankPos}>{isChampion ? <Trophy size={16} /> : `${i + 1}º`}</span>
                  <div className={styles.rankMain}>
                    <span className={styles.cardName}>{criativo.nome}</span>
                    <FaseBadge fase={criativo.fase} />
                  </div>
                  <div className={styles.rankStats}>
                    <div><span className={styles.statLabel}>Vendas</span><span className={styles.statValue}>{integer(totals.vendas)}</span></div>
                    <div><span className={styles.statLabel}>CPA</span><span className={styles.statValue}>{currency(totals.cpa)}</span></div>
                    <div><span className={styles.statLabel}>ROAS</span><span className={styles.statValue}>{multiplier(totals.roas)}</span></div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
      {modals}
    </div>
  )
}
