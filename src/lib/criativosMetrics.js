import { hojeSP } from './periodo'
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

// ── Tipo da oferta ───────────────────────────────────────────────────────────
// WhatsApp: o anúncio leva para uma conversa. Direta: leva para página de
// venda / checkout (site, Hotmart…). Ofertas antigas (sem tipo) = WhatsApp.
export const TIPOS_OFERTA = [
  { id: 'whatsapp', label: 'WhatsApp', hint: 'O anúncio leva para uma conversa no WhatsApp.' },
  { id: 'direta',   label: 'Direta',   hint: 'O anúncio leva para página de venda ou checkout (site, Hotmart…).' },
]
export const tipoOf = oferta => (oferta?.tipo === 'direta' ? 'direta' : 'whatsapp')

const has = v => v != null && v !== ''
const num = v => Number(v) || 0

// ── Gasto: moeda da conta de anúncios → reais ──────────────────────────────
// gasto em reais = gasto digitado × cotação × (1 + acréscimo%), em centavos.
// Real: cotação 1. Ex: US$ 10 × 5,00 × 1,0764 = R$ 53,82.
export const MOEDAS_CONTA = [
  { id: 'BRL', label: 'Real (R$)', symbol: 'R$' },
  { id: 'USD', label: 'Dólar (US$)', symbol: 'US$' },
]
export const ACRESCIMO_PADRAO = { USD: 7.64, BRL: 0 }
export const moedaContaOf = oferta => (oferta?.moeda_conta === 'USD' ? 'USD' : 'BRL')

// Acréscimo that applies to a day: 0 before the offer's "acrescimo_desde"
// date (e.g. IOF only from day 6), the configured % from it on.
export function acrescimoNaData(oferta, data) {
  if (oferta?.acrescimo_desde && data && data < oferta.acrescimo_desde) return 0
  return Number(oferta?.acrescimo_gasto ?? 0) || 0
}

export function gastoEmReais(original, cotacao, acrescimo) {
  const v = num(original) * (num(cotacao) || 1) * (1 + num(acrescimo) / 100)
  return Math.round(v * 100) / 100
}

// How a saved day's spend was entered. Days saved before the conversion
// existed have no original/currency: they are reais, cotação 1, acréscimo 0.
export function rowGasto(row) {
  if (!has(row.gasto_original)) return { original: num(row.gasto), moeda: 'BRL', cotacao: 1, acrescimo: 0, reais: num(row.gasto) }
  return {
    original: num(row.gasto_original),
    moeda: row.moeda_gasto === 'USD' ? 'USD' : 'BRL',
    cotacao: row.moeda_gasto === 'USD' ? num(row.cotacao) : 1,
    acrescimo: num(row.acrescimo),
    reais: num(row.gasto),
  }
}

// Today's USD→BRL rate from a free public source (AwesomeAPI). Returns a
// number, or null if it fails (manual typing keeps working).
export async function fetchCotacaoHoje() {
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL')
    if (!res.ok) return null
    const v = Number((await res.json())?.USDBRL?.bid)
    return v > 0 ? Math.round(v * 10000) / 10000 : null
  } catch {
    return null
  }
}

// Cliques de um dia: o valor informado; se vazio, impressões × CTR do dia.
// → { value, estimated } ou null quando não dá para saber.
export function rowCliques(row) {
  if (has(row.cliques_link)) return { value: num(row.cliques_link), estimated: false }
  if (num(row.impressoes) > 0 && has(row.ctr)) return { value: num(row.impressoes) * num(row.ctr) / 100, estimated: true }
  return null
}

// Frequência de um dia: a digitada; em lançamentos antigos, impressões ÷ alcance.
function rowFrequencia(row) {
  if (has(row.frequencia)) return num(row.frequencia)
  if (num(row.alcance) > 0) return num(row.impressoes) / num(row.alcance)
  return null
}

// Totais e métricas de um conjunto de dias. Tudo é calculado a partir das
// somas do período (nunca média de médias). Quando um dado só existe em
// alguns dias (checkouts, cliques), a taxa usa só esses dias, para não
// misturar dias com e sem a informação.
export function summarize(rows, ticketMedio) {
  const sum = (key, list = rows) => list.reduce((acc, r) => acc + num(r[key]), 0)
  const gasto = sum('gasto')
  const impressoes = sum('impressoes')
  const alcance = sum('alcance')
  const conversas = sum('conversas')
  const vendas = sum('vendas')
  const faturamento = rows.reduce((acc, r) => acc + rowFaturamento(r, ticketMedio), 0)
  const lucro = faturamento - gasto

  // Cliques (informados ou impressões × CTR).
  const withClicks = rows.map(r => ({ r, c: rowCliques(r) })).filter(x => x.c)
  const cliques = withClicks.length ? withClicks.reduce((a, x) => a + x.c.value, 0) : null
  const cliquesAprox = withClicks.some(x => x.c.estimated)
  const clickRows = withClicks.map(x => x.r)

  // CTR do período = cliques ÷ impressões (dias que têm os dois). Sem
  // impressões, média simples dos CTRs digitados, marcada como aproximada.
  let ctr = null
  let ctrAprox = false
  const ctrRows = withClicks.filter(x => num(x.r.impressoes) > 0)
  if (ctrRows.length) {
    ctr = ctrRows.reduce((a, x) => a + x.c.value, 0) / ctrRows.reduce((a, x) => a + num(x.r.impressoes), 0)
  } else {
    const typed = rows.filter(r => has(r.ctr))
    if (typed.length) { ctr = typed.reduce((a, r) => a + num(r.ctr), 0) / typed.length / 100; ctrAprox = true }
  }

  // Frequência: média dos dias ponderada pelas impressões (o alcance não
  // soma entre dias), por isso "aproximada" quando há mais de um dia.
  const freqRows = rows.map(r => ({ f: rowFrequencia(r), w: num(r.impressoes) })).filter(x => x.f != null)
  let frequencia = null
  if (freqRows.length) {
    const w = freqRows.reduce((a, x) => a + x.w, 0)
    frequencia = w > 0
      ? freqRows.reduce((a, x) => a + x.f * x.w, 0) / w
      : freqRows.reduce((a, x) => a + x.f, 0) / freqRows.length
  }
  const freqAprox = freqRows.length > 1

  // Checkouts (direta, opcional).
  const checkoutRows = rows.filter(r => has(r.checkouts))
  const checkouts = checkoutRows.length ? sum('checkouts', checkoutRows) : null

  // Part of the spend entered in dollars (shown as detail next to R$).
  const usdRows = rows.map(rowGasto).filter(g => g.moeda === 'USD')
  const gastoUSD = usdRows.length ? usdRows.reduce((a, g) => a + g.original, 0) : null

  return {
    dias: rows.length,
    gasto, gastoUSD, impressoes, alcance, conversas, vendas, faturamento, lucro,
    cliques, cliquesAprox, checkouts,
    // compat: quem lê cliques_link continua funcionando
    cliques_link: cliques ?? 0,
    ctr, ctrAprox, frequencia, freqAprox,
    cpm: impressoes ? (gasto / impressoes) * 1000 : null,
    cpa: div(gasto, vendas),
    roi: div(lucro, gasto),
    roas: div(faturamento, gasto),
    // WhatsApp
    custoConversa: div(gasto, conversas),
    taxaConversaVenda: div(vendas, conversas),
    // Direta
    cpc: cliques ? sum('gasto', clickRows) / cliques : null,
    taxaCliqueVenda: cliques ? sum('vendas', clickRows) / cliques : null,
    custoCheckout: checkouts ? sum('gasto', checkoutRows) / checkouts : null,
    taxaCheckoutVenda: checkouts ? sum('vendas', checkoutRows) / checkouts : null,
  }
}

// ── O que significa cada métrica (ícones ⓘ) ─────────────────────────────────
// { oque, formula, exemplo, mexer }
export const METRIC_INFO = {
  vendas: { oque: 'Quantas vendas esse criativo trouxe.', formula: 'Soma das vendas lançadas nos dias.', exemplo: '3 + 2 + 0 = 5 vendas.', mexer: 'É o que decide o ranking: mais vendas primeiro; no empate, o menor CPA.' },
  gasto: { oque: 'Quanto foi investido em anúncio, em reais (já com cotação e acréscimo do cartão).', formula: 'Soma do gasto em reais dos dias. Cada dia: gasto digitado × cotação × (1 + acréscimo%).', exemplo: 'US$ 10 × 5,00 × 1,0764 = R$ 53,82.', mexer: 'Na fase de teste, só julgue depois de gastar pelo menos 2× o CPA máximo (em reais).' },
  moedaConta: { oque: 'Em que moeda a conta de anúncios cobra (o que aparece no Gerenciador). A "Moeda" da oferta continua sendo a da venda.', formula: 'Real: o gasto digitado já é em reais. Dólar: o gasto é convertido pela cotação.', exemplo: 'Conta em dólar: você digita US$ 10 e o app usa R$ 53,82.', mexer: 'Mude só se a conta de anúncios mudar de moeda; os dias já lançados não mudam.' },
  cotacao: { oque: 'Quantos reais custa 1 dólar.', formula: 'Gasto em reais = gasto em US$ × cotação × (1 + acréscimo%).', exemplo: 'Cotação 5,00: US$ 10 → R$ 50 antes do acréscimo.', mexer: 'Atualize quando o dólar mudar (ou use "cotação de hoje"). Cada dia guarda a cotação usada, então mudar depois não altera o passado.' },
  acrescimoDesde: { oque: 'Data em que o acréscimo (IOF + spread ou imposto) começou a ser cobrado. Antes dela o gasto entra sem acréscimo; a partir dela, com o percentual acima.', formula: 'Dia antes da data → gasto × cotação. Dia na data ou depois → gasto × cotação × (1 + acréscimo ÷ 100).', exemplo: 'Na planilha “IOF desde dia 6”: escolha 06/11. Dias 1 a 5 ficam sem acréscimo e do dia 6 em diante com 7,64%.', mexer: 'Deixe vazio se o acréscimo vale para todos os dias.' },
  acrescimoDia: { oque: 'Acréscimo aplicado ao gasto deste dia. Vem da configuração da oferta (0% antes da data de início do acréscimo), mas pode ser mudado só para este dia.', formula: 'Gasto em reais = gasto × cotação × (1 + acréscimo ÷ 100).', exemplo: 'US$ 10 × 5,40 × (1 + 7,64%) = R$ 58,13. Com 0%: R$ 54,00.', mexer: 'Mude só se neste dia o banco cobrou diferente.' },
  acrescimoGasto: { oque: 'O que o cartão ou a conta cobra a mais sobre o gasto: IOF + spread no dólar, ou impostos numa conta em real.', formula: 'Gasto em reais = gasto × cotação × (1 + acréscimo ÷ 100).', exemplo: 'Dólar: 7,64% (IOF + spread). Conta em real com imposto: 12,15%. Sem acréscimo: 0.', mexer: 'Ajuste se o banco ou o imposto mudar. Cada dia guarda o acréscimo usado.' },
  faturamento: { oque: 'Quanto entrou com as vendas.', formula: 'Valor lançado; se o dia ficou vazio, vendas × ticket médio.', exemplo: '3 vendas × R$ 47 = R$ 141.', mexer: 'Preencha quando o valor real for diferente do ticket médio (upsell, desconto).' },
  lucro: { oque: 'O que sobra depois de pagar os anúncios.', formula: 'Faturamento − gasto.', exemplo: 'R$ 141 − R$ 110 = R$ 31.', mexer: 'Negativo por vários dias com gasto suficiente: hora de cortar ou mexer no funil.' },
  cpa: { oque: 'Custo por venda.', formula: 'Gasto ÷ vendas.', exemplo: 'R$ 110 ÷ 5 = R$ 22.', mexer: 'Compare com o CPA máximo da oferta: abaixo dele o criativo se paga.' },
  roas: { oque: 'Quanto volta para cada real investido.', formula: 'Faturamento ÷ gasto.', exemplo: 'R$ 141 ÷ R$ 110 = 1,28x.', mexer: 'Abaixo de 1x você perde dinheiro em anúncio.' },
  roi: { oque: 'Retorno sobre o investimento, em %.', formula: 'Lucro ÷ gasto.', exemplo: 'R$ 31 ÷ R$ 110 = 28%.', mexer: 'Negativo = prejuízo no período.' },
  cpm: { oque: 'Custo para aparecer 1.000 vezes.', formula: 'Gasto ÷ impressões × 1.000.', exemplo: 'R$ 110 ÷ 10.000 × 1.000 = R$ 11.', mexer: 'CPM subindo muito costuma ser público saturado ou leilão caro; troque público ou criativo.' },
  ctr: { oque: 'De quem viu o anúncio, quantos % clicaram.', formula: 'Cliques ÷ impressões do período (cliques informados, ou impressões × CTR do dia).', exemplo: '180 cliques ÷ 10.000 impressões = 1,8%.', mexer: 'Abaixo do CTR mínimo da oferta, o problema é o criativo (gancho, primeira cena, imagem).' },
  frequencia: { oque: 'Quantas vezes, em média, a mesma pessoa viu o anúncio (impressões ÷ alcance).', formula: 'Digitada por dia, como no Gerenciador. No período: média dos dias ponderada pelas impressões — aproximada, porque o alcance não soma entre dias.', exemplo: 'Dia 1: 1,2 com 5.000 impr.; dia 2: 1,6 com 5.000 → 1,4.', mexer: 'Na fase de teste não decide nada; só importa ao escalar (acima do limite da oferta = saturando).' },
  campanha: { oque: 'Resultado só dos criativos (anúncios): vendas atribuídas a eles, gasto e faturamento.', formula: 'Soma dos lançamentos diários de todos os criativos da oferta.', exemplo: '3 criativos: R$ 150 de gasto, 4 vendas → CPA R$ 37,50.', mexer: 'É esta linha que decide escalar, segurar ou pausar — as vendas fora da campanha não entram aqui.' },
  totalOferta: { oque: 'Tudo o que a oferta vendeu: campanha + vendas fora da campanha (indicação, orgânico, cliente que passou o contato).', formula: 'Vendas e faturamento da campanha + os de fora. O gasto é só o da campanha. CPA, ROI e ROAS recalculados com esse total.', exemplo: 'Campanha: R$ 141 de faturamento, gasto R$ 150 (prejuízo R$ 9). + R$ 20 fora da campanha = R$ 161 → lucro R$ 11.', mexer: 'Use para conferir com a planilha de controle. Não use para decidir criativos: a campanha sozinha é que mostra se o anúncio se paga.' },
  vendasFora: { oque: 'Vendas que não vieram de nenhum anúncio: indicação, orgânico, cliente que passou o contato.', formula: 'Lançadas por dia na oferta. Faturamento vazio = vendas × ticket médio.', exemplo: '1 venda por indicação no dia 07 = R$ 47 (ticket médio).', mexer: 'Lance aqui, e não num criativo, para não inflar o resultado dos anúncios.' },
  conversas: { oque: 'Conversas iniciadas no WhatsApp.', formula: 'Soma das conversas lançadas.', exemplo: '12 + 8 = 20 conversas.', mexer: 'Muitas conversas e poucas vendas: o problema está no atendimento ou na oferta, não no criativo.' },
  custoConversa: { oque: 'Quanto custa cada conversa iniciada.', formula: 'Gasto ÷ conversas.', exemplo: 'R$ 110 ÷ 20 = R$ 5,50.', mexer: 'Caro com CTR baixo: o criativo atrai pouco. Barato e sem vendas: olhe o atendimento.' },
  taxaConversaVenda: { oque: 'De cada 100 conversas, quantas viram venda.', formula: 'Vendas ÷ conversas.', exemplo: '5 ÷ 20 = 25%.', mexer: 'Baixa: revise script de atendimento, tempo de resposta, preço e prova.' },
  cliques: { oque: 'Cliques no link do anúncio.', formula: 'Valor informado; se vazio, impressões × CTR do dia (aproximado).', exemplo: '10.000 × 1,8% = 180 cliques.', mexer: 'Poucos cliques com CTR baixo: problema no criativo.' },
  cpc: { oque: 'Custo por clique no link.', formula: 'Gasto ÷ cliques.', exemplo: 'R$ 110 ÷ 180 = R$ 0,61.', mexer: 'CPC alto com CTR baixo: o criativo chama pouca atenção.' },
  checkouts: { oque: 'Checkouts iniciados (pessoa chegou a abrir o pagamento).', formula: 'Soma dos checkouts lançados.', exemplo: '6 + 4 = 10 checkouts.', mexer: 'Muitos checkouts e poucas vendas: problema no checkout, preço ou forma de pagamento.' },
  custoCheckout: { oque: 'Quanto custa cada checkout iniciado.', formula: 'Gasto ÷ checkouts.', exemplo: 'R$ 110 ÷ 10 = R$ 11.', mexer: 'Barato e sem vendas: o problema está no checkout. Caro: página ou criativo.' },
  taxaCheckoutVenda: { oque: 'De cada 100 checkouts, quantos viram venda.', formula: 'Vendas ÷ checkouts.', exemplo: '5 ÷ 10 = 50%.', mexer: 'Baixa: revise o checkout (campos, Pix/cartão, parcelamento, confiança).' },
  taxaCliqueVenda: { oque: 'De cada 100 cliques, quantos viram venda.', formula: 'Vendas ÷ cliques.', exemplo: '5 ÷ 180 = 2,8%.', mexer: 'Baixa com CTR bom: o problema está na página de venda ou na oferta.' },
}

// ── Diagnóstico do funil (motivo do veredito) ───────────────────────────────
// Só aponta onde provavelmente está o problema; não muda a cor do veredito.
export function diagnose(t, oferta) {
  const cpaMax = Number(oferta.cpa_maximo) || 0
  if (!cpaMax || t.gasto <= 0) return ''
  const ctrMin = Number(oferta.ctr_minimo ?? 1) / 100
  const ctrLow = t.ctr != null && t.ctr < ctrMin
  const sellsWell = t.cpa != null && t.cpa <= cpaMax
  if (sellsWell) return ''

  if (tipoOf(oferta) === 'whatsapp') {
    // "Muitas" conversas = cada conversa custa até 30% do CPA máximo
    // (bastaria ~1 venda a cada 3 conversas para ficar no alvo).
    const manyConvs = t.conversas > 0 && t.custoConversa <= 0.3 * cpaMax
    if (manyConvs) return 'Muitas conversas e poucas vendas — o problema parece estar no atendimento ou na oferta, não no criativo.'
    if (ctrLow) return 'Poucas conversas e CTR baixo — o problema parece estar no criativo (gancho, primeira cena).'
    if (t.conversas === 0 || t.custoConversa > 0.3 * cpaMax) return 'Conversas caras — teste outro gancho ou público.'
    return ''
  }

  // Direta
  const manyCheckouts = t.checkouts > 0 && t.custoCheckout <= 0.5 * cpaMax
  if (manyCheckouts) return 'Muitos checkouts e poucas vendas — o problema parece estar no checkout (preço, pagamento, confiança).'
  if (ctrLow) return 'Poucos cliques e CTR baixo — o problema parece estar no criativo.'
  if (t.cliques && t.taxaCliqueVenda != null) return 'Cliques bons e poucas vendas — o problema parece estar na página de venda ou na oferta.'
  return ''
}

// ── Período ───────────────────────────────────────────────────────────────────

// Today in America/Sao_Paulo as "YYYY-MM-DD" (never toISOString()).
export const todayISO = hojeSP

// ── Veredito ──────────────────────────────────────────────────────────────────

const NONE = { level: 'gray', text: '' }

function verdict(level, text, reason = '') {
  return { level, text, reason }
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
      return verdict('yellow', 'Observar mais 1–2 dias', diagnose(t, config))
    }
    return verdict('red', 'Cortar', diagnose(t, config))
  }

  if (criativo.fase === 'pre_escala') {
    const r = summarize(rows.slice(-3), ticket)
    const freqMax = Number(config.freq_max_pre_escala ?? 2)
    if (r.cpa != null && r.cpa <= cpaMax && (r.frequencia == null || r.frequencia < freqMax)) {
      return verdict('green', 'Pronto para escalar')
    }
    if (r.cpa != null && r.cpa <= 1.3 * cpaMax) return verdict('yellow', 'Ainda instável, segurar', diagnose(r, config))
    return verdict('red', 'Não sustentou, voltar para teste ou cortar', diagnose(r, config))
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

// ── Campanha × Total da oferta ───────────────────────────────────────────────
// "Campanha" = só os criativos (é o que decide escalar ou pausar).
// "Total da oferta" = campanha + vendas fora da campanha (indicação, orgânico)
// — é o que bate com a planilha de controle. As vendas fora da campanha não
// têm gasto: só somam vendas e faturamento.

// Totals of the outside-campaign rows: { vendas, faturamento, dias }.
export function summarizeFora(rows, ticketMedio) {
  return {
    dias: rows.length,
    vendas: rows.reduce((a, r) => a + num(r.vendas), 0),
    faturamento: rows.reduce((a, r) => a + rowFaturamento(r, ticketMedio), 0),
  }
}

// Campaign totals (from summarize) + outside sales → offer total.
export function totalOferta(campanha, fora) {
  const vendas = campanha.vendas + fora.vendas
  const faturamento = campanha.faturamento + fora.faturamento
  const gasto = campanha.gasto
  const lucro = faturamento - gasto
  return {
    ...campanha,
    vendas, faturamento, lucro,
    vendasFora: fora.vendas, faturamentoFora: fora.faturamento,
    cpa: div(gasto, vendas),
    roi: div(lucro, gasto),
    roas: div(faturamento, gasto),
    // Funnel rates only make sense for the campaign; not for the total.
    custoConversa: null, taxaConversaVenda: null, cpc: null, taxaCliqueVenda: null,
    custoCheckout: null, taxaCheckoutVenda: null,
  }
}

// Verdict of the whole campaign (criativos only), with a note when the
// outside sales turn a campaign loss into a profit for the offer.
export function campanhaVerdict(campanha, total, oferta, money = v => v.toFixed(2)) {
  const cpaMax = Number(oferta.cpa_maximo) || 0
  let level = 'gray'
  let text = ''
  if (campanha.dias === 0) text = 'Sem lançamentos no período'
  else if (!cpaMax) text = campanha.lucro >= 0 ? 'Campanha no lucro' : 'Campanha no prejuízo'
  else if (campanha.gasto < 2 * cpaMax) text = 'Coletando dados — gasto ainda abaixo de 2× o CPA máximo'
  else if (campanha.cpa != null && campanha.cpa <= cpaMax) { level = 'green'; text = 'Campanha dentro do CPA máximo' }
  else { level = 'red'; text = 'Campanha acima do CPA máximo' }

  let reason = ''
  if (campanha.lucro < 0 && total.faturamentoFora > 0 && total.lucro >= 0) {
    reason = `No total da oferta, com ${money(total.faturamentoFora)} de vendas fora da campanha, o resultado é lucro (${money(total.lucro)}).`
  } else if (campanha.lucro < 0 && total.faturamentoFora > 0) {
    reason = `Mesmo com ${money(total.faturamentoFora)} de vendas fora da campanha, o total da oferta ainda é prejuízo (${money(total.lucro)}).`
  }
  return { level, text, reason }
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
