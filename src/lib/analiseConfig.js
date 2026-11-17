// Rules of the "Análise" tab (the paid-traffic analyst). Every limit lives
// here, with its default. The offer can override them (criativos_ofertas.
// analise_config, edited in "Como a análise é calculada"); whatever it
// doesn't set falls back to these defaults.
//
// tipo: 'pct' = fraction shown as % (0.5 → 50%) · 'x' = multiplier · 'n' = count

export const REGRAS_PADRAO = {
  // Coletando dados
  coletaGastoXCpa: 2,
  coletaMinVendas: 5,
  // Escalar
  escalarRoiMin: 0.5,
  escalarCpaFator: 0.8,
  escalarEficMin: 1.3,
  escalarMinVendas: 10,
  escalarQuedaRoiMax: 0.25,
  // Isolar e escalar
  isolarConcentracao: 0.5,
  isolarEficMax: 0.8,
  // Manter
  manterRoiMin: 0.2,
  // Reduzir
  reduzirQuedaRoi: 0.3,
  roiAlvo: 0.5,
  reduzirCorte: 0.3,
  // Pausar
  pausarSemVendaXCpa: 3,
  // Alertas
  dependenciaGasto: 0.5,
  dependenciaEficMax: 0.8,
  renovacaoQueda: 0.25,
  funilFator: 1.5,
  // Confiança (vendas do criativo)
  confMedia: 10,
  confAlta: 30,
  // Diagnóstico da campanha
  lucrandoBemRoi: 0.3,
  tendenciaFaixa: 0.1,
  // Escala e simulador
  escalaPasso: 0.2,
  simQueda1: 0.2,
  simQueda2: 0.4,
}

// Panel "Como a análise é calculada": one block per rule, with the sentence
// (built from the current values) and its editable limits.
const pct = v => `${Math.round(v * 1000) / 10}%`.replace('.', ',')
const x = v => String(v).replace('.', ',')

export const REGRAS_INFO = [
  {
    id: 'base',
    titulo: 'Como cada criativo é medido',
    texto: () => 'Tudo usa o gasto em reais já com cotação e acréscimo, e só a Campanha (os criativos). ROI = lucro ÷ gasto. Participação no gasto = gasto do criativo ÷ gasto da campanha. Participação no lucro = lucro do criativo ÷ lucro da campanha (só quando a campanha tem lucro). Eficiência = participação no lucro ÷ participação no gasto: acima de 1, o criativo devolve mais do que recebe.',
    campos: [],
  },
  {
    id: 'coletando',
    titulo: 'Coletando dados (sem ação)',
    texto: c => `Gasto abaixo de ${x(c.coletaGastoXCpa)}× o CPA máximo ou menos de ${c.coletaMinVendas} vendas. Ainda é cedo para decidir.`,
    campos: [
      { key: 'coletaGastoXCpa', label: 'Gasto mínimo (× CPA máximo)', tipo: 'x' },
      { key: 'coletaMinVendas', label: 'Vendas mínimas', tipo: 'n' },
    ],
  },
  {
    id: 'escalar',
    titulo: 'Escalar',
    texto: c => `ROI de ${pct(c.escalarRoiMin)} ou mais, CPA até ${x(c.escalarCpaFator)}× o CPA máximo, eficiência de ${x(c.escalarEficMin)} ou mais, pelo menos ${c.escalarMinVendas} vendas e o ROI dos últimos 7 dias sem cair mais de ${pct(c.escalarQuedaRoiMax)} contra os 7 anteriores. Se a campanha estiver no prejuízo, a eficiência não é usada.`,
    campos: [
      { key: 'escalarRoiMin', label: 'ROI mínimo', tipo: 'pct' },
      { key: 'escalarCpaFator', label: 'CPA até (× CPA máximo)', tipo: 'x' },
      { key: 'escalarEficMin', label: 'Eficiência mínima', tipo: 'x' },
      { key: 'escalarMinVendas', label: 'Vendas mínimas', tipo: 'n' },
      { key: 'escalarQuedaRoiMax', label: 'Queda de ROI tolerada', tipo: 'pct' },
    ],
  },
  {
    id: 'isolar',
    titulo: 'Isolar e escalar',
    texto: c => `Atende “Escalar” e está no mesmo grupo da Meta (CBO) que um criativo com ${pct(c.isolarConcentracao)} ou mais do gasto do grupo e eficiência de ${x(c.isolarEficMax)} ou menos. Num CBO a Meta divide o orçamento sozinha; tirando o bom do grupo ele ganha orçamento próprio.`,
    campos: [
      { key: 'isolarConcentracao', label: 'Gasto do outro no grupo', tipo: 'pct' },
      { key: 'isolarEficMax', label: 'Eficiência do outro até', tipo: 'x' },
    ],
  },
  {
    id: 'manter',
    titulo: 'Manter',
    texto: c => `ROI de ${pct(c.manterRoiMin)} ou mais sem atender “Escalar”. Com eficiência abaixo de 1 a sugestão vira “mantenha o orçamento, não aumente”.`,
    campos: [{ key: 'manterRoiMin', label: 'ROI mínimo', tipo: 'pct' }],
  },
  {
    id: 'reduzir',
    titulo: 'Reduzir',
    texto: c => `ROI entre 0 e ${pct(c.manterRoiMin)}, ou ROI dos últimos 7 dias caindo mais de ${pct(c.reduzirQuedaRoi)} contra os 7 anteriores e abaixo do ROI alvo (${pct(c.roiAlvo)}). Também entra aqui um ROI negativo que ainda não fecha a regra de pausar. A sugestão é cortar ${pct(c.reduzirCorte)} do orçamento.`,
    campos: [
      { key: 'reduzirQuedaRoi', label: 'Queda de ROI', tipo: 'pct' },
      { key: 'roiAlvo', label: 'ROI alvo', tipo: 'pct' },
      { key: 'reduzirCorte', label: 'Corte sugerido', tipo: 'pct' },
    ],
  },
  {
    id: 'pausar',
    titulo: 'Pausar',
    texto: c => `Dados suficientes e prejuízo nas duas últimas janelas de 7 dias, ou ${x(c.pausarSemVendaXCpa)}× o CPA máximo gasto sem nenhuma venda.`,
    campos: [{ key: 'pausarSemVendaXCpa', label: 'Gasto sem venda (× CPA máximo)', tipo: 'x' }],
  },
  {
    id: 'dependencia',
    titulo: 'Alerta de dependência',
    texto: c => `Um criativo com ${pct(c.dependenciaGasto)} ou mais do gasto da campanha e eficiência abaixo de ${x(c.dependenciaEficMax)}: a campanha depende dele e ele devolve menos do que recebe.`,
    campos: [
      { key: 'dependenciaGasto', label: 'Participação no gasto', tipo: 'pct' },
      { key: 'dependenciaEficMax', label: 'Eficiência abaixo de', tipo: 'x' },
    ],
  },
  {
    id: 'renovacao',
    titulo: 'Alerta de renovação',
    texto: c => `O criativo de maior gasto com o ROI dos últimos 7 dias ${pct(c.renovacaoQueda)} ou mais abaixo do ROI dos 7 anteriores. Se não houver criativo em “Teste”, a sugestão é preparar um novo.`,
    campos: [{ key: 'renovacaoQueda', label: 'Queda de ROI', tipo: 'pct' }],
  },
  {
    id: 'funil',
    titulo: 'Insight de funil',
    texto: c => `Quando um criativo traz conversa (ou clique) mais cara, mas converte ${x(c.funilFator)} vezes ou mais em venda do que outro. Uma campanha que otimiza por conversa tende a favorecer o de conversa barata, mesmo vendendo menos.`,
    campos: [{ key: 'funilFator', label: 'Conversão mínima (× a do outro)', tipo: 'x' }],
  },
  {
    id: 'frequencia',
    titulo: 'Alerta de saturação',
    texto: () => 'Frequência dos últimos 7 dias acima do limite da oferta (frequência máxima de escala, ou de pré-escala para criativos em pré-escala). O mesmo público está vendo o anúncio vezes demais.',
    campos: [],
  },
  {
    id: 'confianca',
    titulo: 'Confiança',
    texto: c => `Pelo número de vendas do criativo: baixa com menos de ${c.confMedia}, média de ${c.confMedia} a ${c.confAlta - 1} e alta com ${c.confAlta} ou mais.`,
    campos: [
      { key: 'confMedia', label: 'Média a partir de (vendas)', tipo: 'n' },
      { key: 'confAlta', label: 'Alta a partir de (vendas)', tipo: 'n' },
    ],
  },
  {
    id: 'diagnostico',
    titulo: 'Diagnóstico da campanha',
    texto: c => `Dados insuficientes: gasto abaixo de ${x(c.coletaGastoXCpa)}× o CPA máximo ou menos de ${c.coletaMinVendas} vendas. Em prejuízo: lucro total negativo. Lucrando bem: ROI de ${pct(c.lucrandoBemRoi)} ou mais e CPA dentro do máximo. No limite: o resto. Tendência: lucro por dia dos últimos 7 dias contra os 7 anteriores; variação de até ${pct(c.tendenciaFaixa)} conta como estável (→).`,
    campos: [
      { key: 'lucrandoBemRoi', label: 'ROI para “Lucrando bem”', tipo: 'pct' },
      { key: 'tendenciaFaixa', label: 'Faixa de estabilidade', tipo: 'pct' },
    ],
  },
  {
    id: 'escala',
    titulo: 'Escala e impacto estimado',
    texto: c => `Escalar = aumentar ${pct(c.escalaPasso)} a cada 2 ou 3 dias. O impacto de escalar supõe que o ROI cai ${pct(c.simQueda1)} no dinheiro novo. O simulador mostra o ROI mantido, −${pct(c.simQueda1)} e −${pct(c.simQueda2)}. O orçamento base é o orçamento diário lançado mais recente ou, sem ele, o gasto médio por dia dos últimos 7 dias.`,
    campos: [
      { key: 'escalaPasso', label: 'Aumento por passo', tipo: 'pct' },
      { key: 'simQueda1', label: 'Queda de ROI (cenário 2)', tipo: 'pct' },
      { key: 'simQueda2', label: 'Queda de ROI (cenário 3)', tipo: 'pct' },
    ],
  },
]

// Offer overrides on top of the defaults (ignores junk values).
export function regrasDaOferta(oferta) {
  const saved = oferta?.analise_config && typeof oferta.analise_config === 'object' ? oferta.analise_config : {}
  const out = { ...REGRAS_PADRAO }
  for (const k of Object.keys(REGRAS_PADRAO)) {
    const v = Number(saved[k])
    if (saved[k] != null && Number.isFinite(v) && v >= 0) out[k] = v
  }
  return out
}

export const TIPOS_EVENTO = [
  { id: 'separou',  label: 'Separou em campanha própria' },
  { id: 'aumentou', label: 'Aumentou orçamento' },
  { id: 'reduziu',  label: 'Reduziu orçamento' },
  { id: 'pausou',   label: 'Pausou' },
  { id: 'reativou', label: 'Reativou' },
  { id: 'novo',     label: 'Novo criativo' },
  { id: 'outro',    label: 'Outro' },
]
export const TIPO_EVENTO_LABEL = Object.fromEntries(TIPOS_EVENTO.map(t => [t.id, t.label]))
