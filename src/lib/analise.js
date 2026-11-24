// "Análise" tab: a rule-based paid-traffic analyst. Reads the days already
// typed and says what to scale, keep, reduce or pause to raise profit.
// No AI and no API: everything is computed here from the same sums as the
// table (summarize), so numbers always match it.
//
// Uses the Campanha (criativos only), all days, never the "Total da oferta".
// Trend = last 7 days (ending on the latest day typed) × the 7 before.
import { summarize, tipoOf, currency, percent, decimal, moedaContaOf } from './criativosMetrics'
import { addDays, diffDays, ddmm } from './periodo'
import { regrasDaOferta, TIPO_EVENTO_LABEL } from './analiseConfig'

const div = (a, b) => (b ? a / b : null)
const inWin = (rows, from, to) => rows.filter(r => r.data >= from && r.data <= to)
const diasCom = rows => new Set(rows.map(r => r.data)).size
const FASE_NOME = { teste: 'Teste', pre_escala: 'Pré-escala', escala: 'Escala', pausado: 'Pausado', reprovado: 'Reprovado' }
export const ativo = c => c.fase !== 'pausado' && c.fase !== 'reprovado'

export const ACOES = {
  isolar:    { label: 'Isolar e escalar', nivel: 'green',  ordem: 1 },
  escalar:   { label: 'Escalar',          nivel: 'green',  ordem: 2 },
  pausar:    { label: 'Pausar',           nivel: 'red',    ordem: 3 },
  reduzir:   { label: 'Reduzir',          nivel: 'yellow', ordem: 4 },
  manter:    { label: 'Manter',           nivel: 'blue',   ordem: 5 },
  coletando: { label: 'Coletando dados',  nivel: 'gray',   ordem: 6 },
}

export const VEREDITOS = {
  bem:         { label: 'Lucrando bem',        nivel: 'green' },
  limite:      { label: 'No limite',           nivel: 'yellow' },
  prejuizo:    { label: 'Em prejuízo',         nivel: 'red' },
  insuficiente:{ label: 'Dados insuficientes', nivel: 'gray' },
}

// "56%" / "–"
export const pl = (n, um, varios) => `${n} ${n === 1 ? um : varios}`
export const P = (v, d = 0) => (v == null || !Number.isFinite(v) ? '–' : percent(v, d))
export const X = (v, d = 2) => (v == null || !Number.isFinite(v) ? '–' : decimal(v, d))

export function confianca(vendas, cfg) {
  if (vendas >= cfg.confAlta) return 'alta'
  if (vendas >= cfg.confMedia) return 'média'
  return 'baixa'
}

// ROI → arrow comparing two values (null when not comparable).
function seta(a, b, faixa) {
  if (a == null || b == null) return null
  if (Math.abs(a - b) <= faixa * Math.abs(b) || (a === 0 && b === 0)) return '→'
  return a > b ? '↑' : '↓'
}

// Projected profit per day for a new budget, in 3 scenarios.
export function simular({ roi, atual, novo, cfg }) {
  if (roi == null || !(novo > 0)) return null
  const hoje = atual > 0 ? atual * roi : null
  const cen = [
    { label: 'ROI mantido', roi },
    { label: `ROI −${P(cfg.simQueda1)}`, roi: roi - Math.abs(roi) * cfg.simQueda1 },
    { label: `ROI −${P(cfg.simQueda2)}`, roi: roi - Math.abs(roi) * cfg.simQueda2 },
  ].map(c => ({ ...c, lucroDia: novo * c.roi, diff: hoje == null ? null : novo * c.roi - hoje }))
  return { hoje, cenarios: cen }
}

export function analisarOferta({ oferta, criativos, rowsByCriativo, eventos = [] }) {
  const cfg = regrasDaOferta(oferta)
  const tipo = tipoOf(oferta)
  const ticket = oferta.ticket_medio
  const money = v => (v == null || !Number.isFinite(v) ? '–' : currency(v, oferta.moeda || 'BRL'))
  const cpaOferta = Number(oferta.cpa_maximo) || 0
  const cpaMax = cpaOferta || Number(ticket) || 0
  const cpaFonte = cpaOferta ? 'oferta' : cpaMax ? 'ticket' : null

  const rowsOf = c => rowsByCriativo[c.id] || []
  const all = criativos.flatMap(rowsOf)
  const base = { cfg, tipo, money, cpaMax, cpaFonte }
  if (!all.length) return { ...base, vazio: true, itens: [], acoes: [], alertas: [], eventos: [] }

  const datas = all.map(r => r.data).sort()
  const inicio = datas[0]
  const ref = datas[datas.length - 1]
  const diasPeriodo = diffDays(inicio, ref) + 1
  const A = { from: addDays(ref, -6), to: ref }
  const B = { from: addDays(ref, -13), to: addDays(ref, -7) }
  const temTendencia = diasPeriodo >= 14

  // ── Campaign ──
  const camp = summarize(all, ticket)
  const rowsA = inWin(all, A.from, A.to)
  const rowsB = inWin(all, B.from, B.to)
  const campA = summarize(rowsA, ticket)
  const campB = summarize(rowsB, ticket)
  const lucroDiaA = div(campA.lucro, diasCom(rowsA))
  const lucroDiaB = temTendencia ? div(campB.lucro, diasCom(rowsB)) : null

  // ── Per criativo ──
  const itens = criativos.map(c => {
    const rows = rowsOf(c)
    const t = summarize(rows, ticket)
    const tA = summarize(inWin(rows, A.from, A.to), ticket)
    const tB = summarize(inWin(rows, B.from, B.to), ticket)
    const primeiro = rows.length ? rows.reduce((m, r) => (r.data < m ? r.data : m), rows[0].data) : null
    const tendencia = !!primeiro && primeiro <= B.from && tA.gasto > 0 && tB.gasto > 0
    const shareGasto = div(t.gasto, camp.gasto)
    const shareLucro = camp.lucro > 0 ? t.lucro / camp.lucro : null
    const efic = shareLucro != null && shareGasto ? shareLucro / shareGasto : null
    const gastoDia = tA.dias ? tA.gasto / tA.dias : t.dias ? t.gasto / t.dias : 0
    const ultOrc = [...rows].sort((a, b) => b.data.localeCompare(a.data)).find(r => r.orcamento_diario != null && r.orcamento_diario !== '')
    const orcamento = ultOrc ? Number(ultOrc.orcamento_diario) : null
    const quedaRoi = tendencia && tB.roi > 0 && tA.roi != null ? (tB.roi - tA.roi) / tB.roi : null
    return {
      c, rows, t, tA, tB, tendencia, shareGasto, shareLucro, efic, gastoDia, orcamento,
      base: orcamento || gastoDia,
      roiRef: tA.vendas >= cfg.coletaMinVendas && tA.roi != null ? tA.roi : t.roi,
      quedaRoi, conf: confianca(t.vendas, cfg), ativo: ativo(c),
      grupo: (c.grupo_meta || '').trim(),
      lucroDiaA: div(tA.lucro, tA.dias), lucroDiaB: tendencia ? div(tB.lucro, tB.dias) : null,
    }
  })
  const byId = Object.fromEntries(itens.map(i => [i.c.id, i]))

  // Groups (campanha / CBO na Meta).
  const grupos = {}
  itens.forEach(i => { if (i.grupo) (grupos[i.grupo] ||= []).push(i) })
  const grupoInfo = Object.fromEntries(Object.entries(grupos).map(([nome, membros]) => {
    const gasto = membros.reduce((a, m) => a + m.t.gasto, 0)
    const orc = membros.flatMap(m => m.rows).filter(r => r.orcamento_diario != null && r.orcamento_diario !== '')
      .sort((a, b) => b.data.localeCompare(a.data))[0]
    const gastoDia = membros.reduce((a, m) => a + m.gastoDia, 0)
    return [nome, { nome, membros, gasto, orcamento: orc ? Number(orc.orcamento_diario) : null, base: orc ? Number(orc.orcamento_diario) : gastoDia }]
  }))
  const shareNoGrupo = i => (i.grupo ? div(i.t.gasto, grupoInfo[i.grupo].gasto) : null)

  const ativos = itens.filter(i => i.ativo)
  const melhor = [...ativos].filter(i => i.t.vendas >= cfg.coletaMinVendas && i.t.roi != null)
    .sort((a, b) => b.t.roi - a.t.roi)[0]

  // ── Classification ──
  function classificar(i) {
    const { c, t, tA, tB } = i
    const nome = c.nome
    const out = (acao, motivo, passos, impacto = 0, extra = {}) => ({
      item: i, acao, ...ACOES[acao], motivo, passos: passos.filter(Boolean), impacto, ...extra,
    })

    if (cpaMax && t.vendas === 0 && t.gasto >= cfg.pausarSemVendaXCpa * cpaMax) {
      return out('pausar',
        `Gastou ${money(t.gasto)} sem nenhuma venda: mais de ${X(cfg.pausarSemVendaXCpa, 0)}× o CPA máximo (${money(cpaMax)}).`,
        ['Pause o anúncio no Gerenciador (não exclua, para manter o histórico).',
          i.grupo && `Ele está no grupo ${i.grupo}: o orçamento passa para os outros do grupo.`,
          'Registre a mudança aqui (“Pausou”).'],
        i.gastoDia)
    }
    const gastoColeta = cpaMax ? cfg.coletaGastoXCpa * cpaMax : 0
    if (t.gasto < gastoColeta || t.vendas < cfg.coletaMinVendas) {
      const falta = []
      if (t.gasto < gastoColeta) falta.push(`mais ${money(gastoColeta - t.gasto)} de gasto`)
      if (t.vendas < cfg.coletaMinVendas) falta.push(`mais ${pl(cfg.coletaMinVendas - t.vendas, "venda", "vendas")}`)
      return out('coletando',
        `Gastou ${money(t.gasto)} e fez ${pl(t.vendas, "venda", "vendas")}. Ainda é cedo: faltam ${falta.join(' e ')} para analisar.`,
        ['Deixe rodar sem mexer no orçamento.', 'Volte aqui quando ele tiver mais dados.'])
    }
    if (i.tendencia && tA.lucro < 0 && tB.lucro < 0) {
      return out('pausar',
        `Prejuízo nas duas últimas semanas: ${money(-tA.lucro)} nos últimos 7 dias e ${money(-tB.lucro)} nos 7 anteriores (ROI ${P(tA.roi)} e ${P(tB.roi)}).`,
        ['Pause o anúncio no Gerenciador (não exclua).',
          i.grupo && `Ele está no grupo ${i.grupo}: confira se o orçamento do grupo ainda faz sentido sem ele.`,
          'Prepare um criativo novo para o lugar dele.',
          'Registre a mudança aqui (“Pausou”).'],
        Math.max(0, -(i.lucroDiaA ?? 0)))
    }

    const roi = t.roi
    const corte = i.base * cfg.reduzirCorte
    const passosReduzir = [
      `Reduza o orçamento em ${P(cfg.reduzirCorte)} (de ${money(i.base)} para ${money(i.base - corte)} por dia).`,
      i.grupo && `No grupo ${i.grupo} (CBO) a Meta divide o orçamento: reduza o do grupo ou separe os criativos melhores.`,
      melhor && melhor !== i && `Se puder, coloque esse valor no ${melhor.c.nome} (ROI ${P(melhor.t.roi)}).`,
      'Reavalie em 3 dias.',
      'Registre a mudança aqui (“Reduziu orçamento”).',
    ]
    const impactoReduzir = roi < 0 ? corte * -roi : melhor && melhor !== i ? corte * Math.max(0, melhor.t.roi - roi) : 0
    if (roi < 0) {
      return out('reduzir', `ROI de ${P(roi)}: prejuízo de ${money(-t.lucro)} em ${money(t.gasto)} gastos. Ainda não fecha a regra de pausar (prejuízo nas duas últimas semanas).`, passosReduzir, impactoReduzir)
    }
    if (roi < cfg.manterRoiMin) {
      return out('reduzir', `ROI de ${P(roi)}: cada R$ 100 gastos deixam ${money(roi * 100)} de lucro, abaixo do mínimo de ${P(cfg.manterRoiMin)}.`, passosReduzir, impactoReduzir)
    }
    if (i.quedaRoi != null && i.quedaRoi > cfg.reduzirQuedaRoi && tA.roi < cfg.roiAlvo) {
      return out('reduzir', `O ROI caiu de ${P(tB.roi)} para ${P(tA.roi)} nos últimos 7 dias (queda de ${P(i.quedaRoi)}), abaixo do ROI alvo de ${P(cfg.roiAlvo)}.`, passosReduzir, impactoReduzir)
    }

    // Escalar?
    const falhas = []
    if (roi < cfg.escalarRoiMin) falhas.push(`ROI abaixo dos ${P(cfg.escalarRoiMin)} para escalar`)
    if (cpaMax && t.cpa > cfg.escalarCpaFator * cpaMax) falhas.push(`CPA de ${money(t.cpa)}, acima de ${X(cfg.escalarCpaFator, 1)}× o CPA máximo (${money(cfg.escalarCpaFator * cpaMax)})`)
    if (i.efic != null && i.efic < cfg.escalarEficMin) falhas.push(`fica com ${P(i.shareGasto)} do gasto e traz ${P(i.shareLucro)} do lucro (eficiência ${X(i.efic)})`)
    if (t.vendas < cfg.escalarMinVendas) falhas.push(`só ${t.vendas} vendas (o mínimo para escalar é ${cfg.escalarMinVendas})`)
    if (i.quedaRoi != null && i.quedaRoi > cfg.escalarQuedaRoiMax) falhas.push(`ROI caiu ${P(i.quedaRoi)} nos últimos 7 dias`)

    const numeros = `ROI de ${P(roi)} (lucro de ${money(t.lucro)} sobre ${money(t.gasto)} gastos), CPA de ${money(t.cpa)}${cpaMax ? ` contra o máximo de ${money(cpaMax)}` : ''}`
    if (!falhas.length) {
      const extra = i.base * cfg.escalaPasso
      const impacto = extra * i.roiRef * (1 - cfg.simQueda1)
      const efTxt = i.efic != null ? ` e ${P(i.shareLucro)} do lucro com só ${P(i.shareGasto)} do gasto (eficiência ${X(i.efic)})` : ''
      const tendTxt = i.tendencia ? ` Nos últimos 7 dias o ROI foi ${P(tA.roi)}.` : ''
      // Shares a group with a criativo that takes most of the budget and returns less?
      const vilao = i.grupo && grupoInfo[i.grupo].membros
        .filter(o => o !== i && o.ativo && shareNoGrupo(o) >= cfg.isolarConcentracao && o.efic != null && o.efic <= cfg.isolarEficMax)
        .sort((a, b) => b.t.gasto - a.t.gasto)[0]
      if (vilao) {
        const g = grupoInfo[i.grupo]
        const parte = shareNoGrupo(i)
        const novoGrupo = g.base * (1 - parte)
        return out('isolar',
          `${numeros}${efTxt}.${tendTxt} No grupo ${i.grupo}, ${vilao.c.nome} fica com ${P(shareNoGrupo(vilao))} do gasto do grupo e devolve menos (eficiência ${X(vilao.efic)}): a Meta está dando o orçamento para o criativo de menor retorno.`,
          [`Crie uma campanha própria para o ${c.nome}, de preferência duplicando o anúncio (não mexa no que já está rodando).`,
            `Comece com orçamento próprio de cerca de ${money(i.base)} por dia (o que ele já gastava).`,
            `Aumente ${P(cfg.escalaPasso)} a cada 2 ou 3 dias enquanto o ROI dos últimos 3 dias ficar acima de ${P(cfg.manterRoiMin)}.`,
            `Reduza o orçamento do grupo ${i.grupo} em ${P(parte)} (de ${money(g.base)} para ${money(novoGrupo)} por dia), o que o ${c.nome} recebia.`,
            'Registre a mudança aqui (“Separou em campanha própria”) para comparar antes × depois.'],
          impacto,
          { estrutura: { grupo: i.grupo, vilao, parte, de: g.base, para: novoGrupo, orcamentoLancado: g.orcamento != null } })
      }
      return out('escalar', `${numeros}${efTxt}.${tendTxt}`,
        [i.grupo
          ? `Ele está no grupo ${i.grupo}: aumente o orçamento do grupo em ${P(cfg.escalaPasso)}, ou separe-o numa campanha própria.`
          : `Aumente o orçamento em ${P(cfg.escalaPasso)} (de ${money(i.base)} para ${money(i.base * (1 + cfg.escalaPasso))} por dia).`,
          'Espere 2 ou 3 dias antes do próximo aumento.',
          `Continue enquanto o ROI dos últimos 3 dias ficar acima de ${P(cfg.manterRoiMin)}; se cair, volte ao orçamento anterior.`,
          'Registre a mudança aqui (“Aumentou orçamento”).'],
        impacto)
    }

    const naoAumente = i.efic != null && i.efic < 1
    return out('manter',
      `${numeros}. Não escala porque ${falhas.join('; ')}.`,
      [naoAumente ? 'Mantenha o orçamento, não aumente.' : 'Não mexa no orçamento agora.',
        naoAumente && `Ele recebe ${P(i.shareGasto)} do gasto e devolve ${P(i.shareLucro)} do lucro: dinheiro novo rende mais em outro criativo.`,
        'Reavalie quando tiver mais dias de dados.'],
      0, { naoAumente })
  }

  const acoes = ativos.map(classificar)
    .sort((a, b) => b.impacto - a.impacto || a.ordem - b.ordem || b.item.t.gasto - a.item.t.gasto)
  const acaoDe = Object.fromEntries(acoes.map(a => [a.item.c.id, a]))

  // ── Alerts ──
  const alertas = []
  for (const i of ativos) {
    if (i.shareGasto >= cfg.dependenciaGasto && i.efic != null && i.efic < cfg.dependenciaEficMax) {
      alertas.push({
        id: `dep-${i.c.id}`, regra: 'dependencia', nivel: 'red', titulo: `Dependência do ${i.c.nome}`,
        texto: `${i.c.nome} concentra ${P(i.shareGasto)} do gasto e traz ${P(i.shareLucro)} do lucro (eficiência ${X(i.efic)}). A campanha depende dele e boa parte do orçamento vai para quem devolve menos.`,
      })
    }
  }
  const topo = [...ativos].sort((a, b) => b.t.gasto - a.t.gasto)[0]
  if (topo?.tendencia && topo.tB.roi > 0 && topo.tA.roi != null && topo.tA.roi <= topo.tB.roi * (1 - cfg.renovacaoQueda)) {
    const temTeste = criativos.some(c => c.fase === 'teste')
    alertas.push({
      id: 'renovacao', regra: 'renovacao', nivel: 'yellow', titulo: 'Hora de renovar',
      texto: `O criativo de maior gasto, ${topo.c.nome}, caiu de ROI ${P(topo.tB.roi)} para ${P(topo.tA.roi)} nos últimos 7 dias.${temTeste ? '' : ' Não há nenhum criativo em teste: prepare um novo agora, antes que ele canse de vez.'}`,
    })
  }
  for (const a of acoes) {
    if (a.estrutura) {
      const e = a.estrutura
      const resto = grupoInfo[e.grupo].membros.filter(m => m !== a.item).map(m => m.c.nome).join(', ')
      alertas.push({
        id: `est-${a.item.c.id}`, regra: 'isolar', nivel: 'yellow', titulo: `Estrutura do grupo ${e.grupo}`,
        texto: `Ao tirar ${a.item.c.nome} do grupo ${e.grupo}, o orçamento do grupo passa para ${resto}, que tem menor retorno. Reduza o orçamento do grupo na proporção do que ${a.item.c.nome} recebia (${P(e.parte)}: de ${money(e.de)} para ${money(e.para)} por dia${e.orcamentoLancado ? '' : ', pelo gasto médio dos últimos 7 dias'}).`,
      })
    }
  }
  // Funnel: A has the dearer conversation/click but converts ≥ fator× more.
  const funil = tipo === 'direta'
    ? { custo: 'cpc', taxa: 'taxaCliqueVenda', nomeCusto: 'clique', otimiza: 'clique' }
    : { custo: 'custoConversa', taxa: 'taxaConversaVenda', nomeCusto: 'conversa', otimiza: 'conversa' }
  const comFunil = ativos.filter(i => i.t[funil.custo] != null && i.t[funil.taxa] > 0 && i.t.vendas >= cfg.coletaMinVendas)
  for (const a of comFunil) for (const b of comFunil) {
    if (a === b) continue
    const fator = a.t[funil.taxa] / b.t[funil.taxa]
    if (a.t[funil.custo] > b.t[funil.custo] && fator >= cfg.funilFator) {
      alertas.push({
        id: `fun-${a.c.id}-${b.c.id}`, regra: 'funil', nivel: 'blue', titulo: `Funil: ${a.c.nome} × ${b.c.nome}`,
        texto: `${a.c.nome} traz ${funil.nomeCusto} mais cara (${money(a.t[funil.custo])} contra ${money(b.t[funil.custo])}), mas converte ${X(fator, 1)} vezes mais em venda (${P(a.t[funil.taxa], 1)} contra ${P(b.t[funil.taxa], 1)}). Se a campanha otimiza por ${funil.otimiza}, a Meta tende a favorecer ${b.c.nome}.`,
      })
    }
  }
  for (const i of ativos) {
    const lim = Number(i.c.fase === 'pre_escala' ? oferta.freq_max_pre_escala ?? 2 : oferta.freq_max_escala ?? 3)
    if (i.tA.frequencia != null && lim > 0 && i.tA.frequencia > lim) {
      alertas.push({
        id: `freq-${i.c.id}`, regra: 'frequencia', nivel: 'yellow', titulo: `Saturação do ${i.c.nome}`,
        texto: `Frequência de ${X(i.tA.frequencia)} nos últimos 7 dias, acima do limite de ${X(lim, 1)} da oferta: o mesmo público está vendo o anúncio vezes demais. Teste um público novo ou um criativo novo.`,
      })
    }
  }

  // ── Diagnosis ──
  let veredito
  if (camp.vendas < cfg.coletaMinVendas || (cpaMax && camp.gasto < cfg.coletaGastoXCpa * cpaMax)) veredito = 'insuficiente'
  else if (camp.lucro < 0) veredito = 'prejuizo'
  else if (camp.roi >= cfg.lucrandoBemRoi && (!cpaMax || camp.cpa <= cpaMax)) veredito = 'bem'
  else veredito = 'limite'
  const tendCamp = temTendencia ? seta(lucroDiaA, lucroDiaB, cfg.tendenciaFaixa) : null
  const frase = (() => {
    const p1 = `A campanha ${camp.lucro >= 0 ? 'lucrou' : 'teve prejuízo de'} ${money(Math.abs(camp.lucro))} em ${pl(diasPeriodo, "dia", "dias")}, com ROI de ${P(camp.roi)} e CPA de ${money(camp.cpa)}${cpaMax ? ` (máximo ${money(cpaMax)})` : ''}.`
    const p2 = lucroDiaA == null ? '' : ` Nos últimos 7 dias, ${lucroDiaA >= 0 ? 'lucro' : 'prejuízo'} de ${money(Math.abs(lucroDiaA))} por dia`
    const p3 = lucroDiaB == null ? (p2 ? '.' : '') : `, ${tendCamp === '↑' ? 'subindo' : tendCamp === '↓' ? 'caindo' : 'estável'} contra ${money(lucroDiaB)} por dia nos 7 anteriores.`
    return p1 + p2 + p3
  })()

  // ── Changes: before × after ──
  const evs = [...eventos].sort((a, b) => b.data.localeCompare(a.data) || String(b.created_at).localeCompare(String(a.created_at)))
    .map(e => {
      const i = e.criativo_id ? byId[e.criativo_id] : null
      const rows = e.criativo_id ? (i?.rows || []) : all
      const rA = inWin(rows, addDays(e.data, -7), addDays(e.data, -1))
      const rD = inWin(rows, e.data, ref)
      const resumo = rs => {
        const s = summarize(rs, ticket)
        return { ...s, lucroDia: div(s.lucro, diasCom(rs)), taxa: tipo === 'direta' ? s.taxaCliqueVenda : s.taxaConversaVenda }
      }
      return { ev: e, nome: e.criativo_id ? (i?.c.nome || 'Criativo excluído') : 'Campanha inteira', tipoLabel: TIPO_EVENTO_LABEL[e.tipo] || e.tipo, antes: resumo(rA), depois: resumo(rD) }
    })

  return {
    ...base, vazio: false, inicio, ref, diasPeriodo, A, B, temTendencia,
    camp, campA, campB, lucroDiaA, lucroDiaB, tendCamp, veredito, frase,
    itens, byId, grupoInfo, acoes, acaoDe, alertas, eventos: evs, melhor,
  }
}

// ── "Copiar resumo para o Claude" ────────────────────────────────────────────
// Plain text in Portuguese. Only campaign numbers and the user's own notes:
// no customer data (vendas fora and their notes are not included).
export function resumoParaClaude(an, oferta) {
  const { money, cfg, tipo } = an
  // Budget of a change in the currency it was typed in (US$ or R$).
  const orcTxt = (ev, v) => {
    if (v == null) return '–'
    const usd = (ev.orcamento_moeda || moedaContaOf(oferta)) === 'USD'
    return `${usd ? 'US$' : 'R$'} ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  const L = []
  L.push(`Oferta: ${oferta.nome}`)
  L.push(`Tipo: ${tipo === 'direta' ? 'Direta (anúncio leva para página de venda / checkout)' : 'WhatsApp (anúncio leva para conversa)'}`)
  if (an.vazio) { L.push('Ainda não há dias lançados.'); return L.join('\n') }
  L.push(`Período dos dados: ${ddmm(an.inicio)} a ${ddmm(an.ref)} (${an.diasPeriodo} dias)`)
  L.push(`Ticket médio: ${money(Number(oferta.ticket_medio) || null)} · CPA máximo: ${an.cpaFonte === 'oferta' ? money(an.cpaMax) : an.cpaFonte === 'ticket' ? `não definido (usando o ticket, ${money(an.cpaMax)})` : 'não definido'}`)
  L.push('Valores em reais, gasto já com cotação e acréscimo. Só a campanha (criativos), sem vendas fora da campanha.')
  L.push('')
  L.push(`Campanha: gasto ${money(an.camp.gasto)}, ${an.camp.vendas} vendas, faturamento ${money(an.camp.faturamento)}, lucro ${money(an.camp.lucro)}, ROI ${P(an.camp.roi)}, CPA ${money(an.camp.cpa)}. Diagnóstico: ${VEREDITOS[an.veredito].label}.`)
  L.push('')
  const direta = tipo === 'direta'
  L.push('## Por criativo')
  L.push(direta
    ? '| Criativo | Status | Grupo na Meta | Orçamento/dia | Vendas | Gasto | Faturamento | Lucro | ROI | CPA | Cliques | CPC | Clique→venda | CTR | % gasto | % lucro |'
    : '| Criativo | Status | Grupo na Meta | Orçamento/dia | Vendas | Gasto | Faturamento | Lucro | ROI | CPA | Conversas | Custo/conversa | Conversa→venda | CTR | % gasto | % lucro |')
  L.push(`|${' --- |'.repeat(16)}`)
  for (const i of [...an.itens].sort((a, b) => b.t.gasto - a.t.gasto)) {
    const t = i.t
    const funil = direta
      ? [t.cliques == null ? '–' : Math.round(t.cliques), money(t.cpc), P(t.taxaCliqueVenda, 1)]
      : [t.conversas, money(t.custoConversa), P(t.taxaConversaVenda, 1)]
    L.push(`| ${[i.c.nome, FASE_NOME[i.c.fase] || i.c.fase, i.grupo || '–', i.orcamento != null ? money(i.orcamento) : '–', t.vendas, money(t.gasto), money(t.faturamento), money(t.lucro), P(t.roi), money(t.cpa), ...funil, P(t.ctr, 2), P(i.shareGasto), P(i.shareLucro)].join(' | ')} |`)
  }
  L.push('')
  L.push(`## Tendência (últimos 7 dias, ${ddmm(an.A.from)} a ${ddmm(an.A.to)}, contra os 7 anteriores, ${ddmm(an.B.from)} a ${ddmm(an.B.to)})`)
  if (!an.temTendencia) L.push('Dados insuficientes para tendência (menos de 14 dias).')
  else {
    L.push(`Campanha: lucro por dia ${money(an.lucroDiaA)} contra ${money(an.lucroDiaB)}.`)
    for (const i of an.itens) {
      L.push(i.tendencia
        ? `- ${i.c.nome}: ROI ${P(i.tA.roi)} contra ${P(i.tB.roi)}; lucro por dia ${money(i.lucroDiaA)} contra ${money(i.lucroDiaB)}; CPA ${money(i.tA.cpa)} contra ${money(i.tB.cpa)}`
        : `- ${i.c.nome}: dados insuficientes para tendência`)
    }
  }
  if (an.eventos.length) {
    L.push('')
    L.push('## Mudanças registradas (7 dias antes × desde a mudança)')
    for (const e of an.eventos) {
      L.push(`- ${ddmm(e.ev.data)} · ${e.nome} · ${e.tipoLabel}${e.ev.nota ? ` · “${e.ev.nota}”` : ''}${e.ev.orcamento_anterior != null || e.ev.orcamento_novo != null ? ` · orçamento ${orcTxt(e.ev, e.ev.orcamento_anterior)} → ${orcTxt(e.ev, e.ev.orcamento_novo)}/dia` : ''}: lucro/dia ${money(e.antes.lucroDia)} → ${money(e.depois.lucroDia)}; ROI ${P(e.antes.roi)} → ${P(e.depois.roi)}; CPA ${money(e.antes.cpa)} → ${money(e.depois.cpa)}`)
    }
  }
  L.push('')
  L.push('## Recomendações das regras da ferramenta')
  for (const a of an.acoes) {
    L.push(`- ${a.item.c.nome}: ${a.label}${a.naoAumente ? ' (sem aumentar)' : ''}. ${a.motivo} Confiança ${a.item.conf} (${pl(a.item.t.vendas, "venda", "vendas")}).${a.impacto > 0 ? ` Impacto estimado: +${money(a.impacto)} por dia.` : ''}`)
  }
  if (an.alertas.length) {
    L.push('')
    L.push('## Alertas')
    for (const al of an.alertas) L.push(`- ${al.titulo}: ${al.texto}`)
  }
  L.push('')
  L.push(`(Regras: escalar com ROI ≥ ${P(cfg.escalarRoiMin)}, CPA ≤ ${X(cfg.escalarCpaFator, 1)}× o máximo, eficiência ≥ ${X(cfg.escalarEficMin, 1)} e ${cfg.escalarMinVendas}+ vendas; manter com ROI ≥ ${P(cfg.manterRoiMin)}. Eficiência = % do lucro ÷ % do gasto.)`)
  L.push('')
  L.push('Atue como especialista em tráfego pago. Com base nesses dados, o que devo escalar, manter, reduzir ou pausar para aumentar meu lucro? Justifique com os números e diga o que testar a seguir.')
  return L.join('\n')
}
