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
  return {
    dias: rows.length,
    gasto, impressoes, alcance, cliques_link, conversas, vendas, faturamento,
    ctr: div(cliques_link, impressoes),
    cpm: impressoes ? (gasto / impressoes) * 1000 : null,
    frequencia: div(impressoes, alcance),
    custoConversa: div(gasto, conversas),
    taxaConversaVenda: div(vendas, conversas),
    cpa: div(gasto, vendas),
    roas: div(faturamento, gasto),
  }
}

// Per-day derived values for charts and the history table.
export function dailyMetrics(row, ticketMedio) {
  return summarize([row], ticketMedio)
}

const V = {
  sem_config: { level: 'gray',   emoji: '⚙️', text: 'Configure o CPA máximo na engrenagem' },
  sem_dados:  { level: 'gray',   emoji: '⏳', text: 'Coletando dados' },
  pausado:    { level: 'gray',   emoji: '⏸️', text: 'Pausado' },
  cortado:    { level: 'gray',   emoji: '✂️', text: 'Cortado' },
}

function verdict(level, emoji, text) {
  return { level, emoji, text }
}

// `rows` must be sorted by date ascending.
export function computeVerdict(criativo, rows, config) {
  if (criativo.fase === 'pausado') return V.pausado
  if (criativo.fase === 'cortado') return V.cortado

  const cpaMax = Number(config.cpa_maximo) || 0
  if (!cpaMax) return V.sem_config
  if (rows.length === 0) return V.sem_dados

  const ticket = config.ticket_medio
  const ctrMin = Number(config.ctr_minimo ?? 1) / 100

  if (criativo.fase === 'teste') {
    const t = summarize(rows, ticket)
    if (t.gasto < 2 * cpaMax) return verdict('gray', '⏳', 'Coletando dados')
    if (t.cpa != null && t.cpa <= cpaMax) return verdict('green', '🟢', 'Vende — mover para pré-escala')
    if (t.vendas > 0 && t.cpa <= 1.5 * cpaMax && !(t.ctr != null && t.ctr < ctrMin)) {
      return verdict('yellow', '🟡', 'Observar mais 1–2 dias')
    }
    return verdict('red', '🔴', 'Cortar')
  }

  if (criativo.fase === 'pre_escala') {
    const r = summarize(rows.slice(-3), ticket)
    const freqMax = Number(config.freq_max_pre_escala ?? 2)
    if (r.cpa != null && r.cpa <= cpaMax && (r.frequencia == null || r.frequencia < freqMax)) {
      return verdict('green', '🟢', 'Pronto para escalar')
    }
    if (r.cpa != null && r.cpa <= 1.3 * cpaMax) return verdict('yellow', '🟡', 'Ainda instável, segurar')
    return verdict('red', '🔴', 'Não sustentou, voltar para teste ou cortar')
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
      return verdict('green', '🟢', 'Aguenta escala — pode subir 20–30%')
    }
    if (ctrCaiu) return verdict('red', '🔴', 'Saturou — reduzir orçamento ou trocar criativo')
    if (recent.cpa != null && recent.cpa <= 1.5 * cpaMax) return verdict('yellow', '🟡', 'Segurar orçamento')
    return verdict('red', '🔴', 'Saturou — reduzir orçamento ou trocar criativo')
  }

  return V.sem_dados
}

// ── Formatação ────────────────────────────────────────────────────────────────

export function currency(v) {
  return v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
export function percent(v) {
  return v == null ? '—' : `${(v * 100).toFixed(2).replace('.', ',')}%`
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
