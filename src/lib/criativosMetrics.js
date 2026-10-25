// Cálculos e veredito (semáforo) dos criativos do Meta Ads.
// Todos os derivados retornam null quando o denominador é zero — a UI
// mostra "—" nesses casos.

function div(a, b) {
  return b ? a / b : null
}

// Faturamento de uma linha: o valor informado, ou vendas × ticket médio
// quando o campo ficou vazio.
function rowFaturamento(row, ticketMedio) {
  if (row.faturamento != null && row.faturamento !== '') return Number(row.faturamento)
  return ticketMedio ? Number(row.vendas || 0) * Number(ticketMedio) : 0
}

export function summarize(rows, ticketMedio) {
  const sum = key => rows.reduce((acc, r) => acc + Number(r[key] || 0), 0)
  const gasto = sum('gasto')
  const impressoes = sum('impressoes')
  const alcance = sum('alcance')
  const cliques_link = sum('cliques_link')
  const conversas = sum('conversas')
  const vendas = sum('vendas')
  const faturamento = rows.reduce((acc, r) => acc + rowFaturamento(r, ticketMedio), 0)
  const lucro = faturamento - gasto
  return {
    dias: rows.length,
    gasto, impressoes, alcance, cliques_link, conversas, vendas, faturamento, lucro,
    ctr: div(cliques_link, impressoes),
    cpm: impressoes ? (gasto / impressoes) * 1000 : null,
    frequencia: div(impressoes, alcance),
    custoConversa: div(gasto, conversas),
    taxaConversaVenda: div(vendas, conversas),
    cpa: div(gasto, vendas),
    roi: div(lucro, gasto),
    roas: div(faturamento, gasto),
  }
}

// ── Período ───────────────────────────────────────────────────────────────────

export function todayISO() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

function daysAgoISO(n) {
  const d = new Date(`${todayISO()}T00:00:00`)
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const PERIODOS = [
  { id: 'hoje',  label: 'Hoje' },
  { id: '7d',    label: '7 dias' },
  { id: '30d',   label: '30 dias' },
  { id: 'total', label: 'Total' },
]

// "7 dias" = hoje + os 6 dias anteriores.
export function filterByPeriodo(rows, periodo) {
  if (periodo === 'total') return rows
  const from = periodo === 'hoje' ? todayISO() : daysAgoISO(periodo === '7d' ? 6 : 29)
  return rows.filter(r => r.data >= from)
}

// ── Veredito ──────────────────────────────────────────────────────────────────

const NONE = { level: 'gray', text: '' }

function verdict(level, text) {
  return { level, text }
}

// `rows` must be sorted by date ascending; `config` is the oferta.
export function computeVerdict(criativo, rows, config) {
  if (criativo.fase === 'pausado' || criativo.fase === 'reprovado') return NONE

  const cpaMax = Number(config.cpa_maximo) || 0
  if (!cpaMax) return NONE
  if (rows.length === 0) return verdict('gray', 'Coletando dados')

  const ticket = config.ticket_medio
  const ctrMin = Number(config.ctr_minimo ?? 1) / 100

  if (criativo.fase === 'teste') {
    const t = summarize(rows, ticket)
    if (t.gasto < 2 * cpaMax) return verdict('gray', 'Coletando dados')
    if (t.cpa != null && t.cpa <= cpaMax) return verdict('green', 'Vende — mover para pré-escala')
    if (t.vendas > 0 && t.cpa <= 1.5 * cpaMax && !(t.ctr != null && t.ctr < ctrMin)) {
      return verdict('yellow', 'Observar mais 1–2 dias')
    }
    return verdict('red', 'Cortar')
  }

  if (criativo.fase === 'pre_escala') {
    const r = summarize(rows.slice(-3), ticket)
    const freqMax = Number(config.freq_max_pre_escala ?? 2)
    if (r.cpa != null && r.cpa <= cpaMax && (r.frequencia == null || r.frequencia < freqMax)) {
      return verdict('green', 'Pronto para escalar')
    }
    if (r.cpa != null && r.cpa <= 1.3 * cpaMax) return verdict('yellow', 'Ainda instável, segurar')
    return verdict('red', 'Não sustentou, voltar para teste ou cortar')
  }

  if (criativo.fase === 'escala') {
    const recent = summarize(rows.slice(-3), ticket)
    const before = summarize(rows.slice(-10, -3), ticket)
    const freqMax = Number(config.freq_max_escala ?? 3)
    // Sem histórico anterior (ou CTR anterior zerado) não dá para medir queda.
    const ctrRatio = before.ctr ? (recent.ctr ?? 0) / before.ctr : null
    const ctrCaiu = ctrRatio != null && ctrRatio < 0.7
    const freqOk = recent.frequencia == null || recent.frequencia < freqMax

    if (recent.cpa != null && recent.cpa <= 1.2 * cpaMax && freqOk && !ctrCaiu) {
      return verdict('green', 'Aguenta escala — pode subir 20–30%')
    }
    if (ctrCaiu) return verdict('red', 'Saturou — reduzir orçamento ou trocar criativo')
    if (recent.cpa != null && recent.cpa <= 1.5 * cpaMax) return verdict('yellow', 'Segurar orçamento')
    return verdict('red', 'Saturou — reduzir orçamento ou trocar criativo')
  }

  return NONE
}

// ── Ranking ───────────────────────────────────────────────────────────────────

// Mais vendas primeiro; empate → menor CPA (sem CPA vai depois). Reprovados
// e pausados sempre no final, com a mesma regra entre eles.
export function rankCompare(a, b) {
  const inactive = c => (c.criativo.fase === 'reprovado' || c.criativo.fase === 'pausado') ? 1 : 0
  return inactive(a) - inactive(b)
    || b.totals.vendas - a.totals.vendas
    || (a.totals.cpa ?? Infinity) - (b.totals.cpa ?? Infinity)
    || (a.criativo.numero ?? 0) - (b.criativo.numero ?? 0)
}

// ── Google Drive ──────────────────────────────────────────────────────────────

// Aceita .../file/d/ID/..., ...?id=ID e ...&id=ID.
export function driveFileId(link) {
  if (!link) return null
  const m = link.match(/\/d\/([\w-]{10,})/) || link.match(/[?&]id=([\w-]{10,})/)
  return m ? m[1] : null
}

export function driveThumbUrl(link, size = 200) {
  const id = driveFileId(link)
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${size}` : null
}

// ── Formatação ────────────────────────────────────────────────────────────────

const LOCALES = { BRL: 'pt-BR', USD: 'en-US', EUR: 'de-DE' }

export function currency(v, moeda = 'BRL') {
  return v == null ? '—' : Number(v).toLocaleString(LOCALES[moeda] || 'pt-BR', { style: 'currency', currency: moeda })
}
export function percent(v, digits = 2) {
  return v == null ? '—' : `${(v * 100).toFixed(digits).replace('.', ',')}%`
}
export function multiplier(v) {
  return v == null ? '—' : `${v.toFixed(2).replace('.', ',')}x`
}
export function decimal(v, digits = 2) {
  return v == null ? '—' : v.toFixed(digits).replace('.', ',')
}
export function integer(v) {
  return v == null ? '—' : Number(v).toLocaleString('pt-BR')
}
