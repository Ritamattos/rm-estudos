// "Análise" tab of the offer screen: a rule-based paid-traffic analyst.
// All the logic is in lib/analise.js (rules in lib/analiseConfig.js); this
// file only shows it. Uses every day typed — the period filter of the
// table doesn't apply here.
import { useState, useMemo, useEffect } from 'react'
import { Copy, Check, Plus, Trash2, Pencil, ChevronDown } from 'lucide-react'
import { analisarOferta, resumoParaClaude, simular, VEREDITOS, P, X, pl } from '../../lib/analise'
import { REGRAS_INFO, REGRAS_PADRAO, regrasDaOferta } from '../../lib/analiseConfig'
import { MudancaForm, AvisoMigracao, EventoIcon, evCor, orcamentoTexto, copiarTexto } from './mudancas'
import { moedaContaOf } from '../../lib/criativosMetrics'
import { ddmm } from '../../lib/periodo'
import { InfoTip, Field, parseNum, numToInput } from './shared'
import styles from './Criativos.module.css'

const regraInfo = (id, cfg) => {
  const r = REGRAS_INFO.find(x => x.id === id)
  return r ? { oque: r.texto(cfg) } : null
}
const ACAO_REGRA = { isolar: 'isolar', escalar: 'escalar', pausar: 'pausar', reduzir: 'reduzir', manter: 'manter', coletando: 'coletando' }

function Secao({ letra, titulo, info, children, extra }) {
  return (
    <section className={styles.anSecao}>
      <div className={styles.anSecaoHead}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.anLetra}>{letra}</span>{titulo}
          {info && <InfoTip info={info} title={titulo} />}
        </h3>
        {extra}
      </div>
      {children}
    </section>
  )
}


export default function AnaliseOferta({ oferta, criativos, rowsByCriativo, eventos = [], store }) {
  const an = useMemo(
    () => analisarOferta({ oferta, criativos, rowsByCriativo, eventos }),
    [oferta, criativos, rowsByCriativo, eventos],
  )
  const { money, cfg } = an
  const [copiado, setCopiado] = useState(null) // null | 'ok' | 'erro'
  const [mudancaAberta, setMudancaAberta] = useState(false)

  async function copiar() {
    const ok = await copiarTexto(resumoParaClaude(an, oferta))
    setCopiado(ok ? 'ok' : 'erro')
    setTimeout(() => setCopiado(null), 2500)
  }

  if (an.vazio) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>◆</div>
        <p>A análise aparece quando houver dias lançados nos criativos desta oferta.</p>
      </div>
    )
  }

  const direta = an.tipo === 'direta'
  const ver = VEREDITOS[an.veredito]
  const ativosComDados = an.itens.filter(i => i.ativo && i.t.gasto > 0)

  return (
    <div className={styles.analise}>
      <div className={styles.anAviso}>
        <p>
          Usa <strong>todos os dias lançados</strong> ({ddmm(an.inicio)} a {ddmm(an.ref)}, {an.diasPeriodo} dias), só da Campanha (criativos).
          O filtro de período da Tabela não muda esta aba.
        </p>
        <p>As ações são <strong>sugestões</strong> calculadas por regras, não ordens. Confira com o que você vê no Gerenciador.</p>
        <div className={styles.anAvisoBtns}>
          <button type="button" className={styles.primaryBtn} onClick={copiar} aria-live="polite">
            {copiado === 'ok' ? <><Check size={15} /> Copiado!</> : <><Copy size={15} /> Copiar resumo para o Claude</>}
          </button>
          {copiado === 'erro' && <span className={styles.fieldError}>Não deu para copiar neste aparelho.</span>}
        </div>
      </div>

      {an.cpaFonte !== 'oferta' && (
        <p className={styles.anNota}>
          {an.cpaFonte === 'ticket'
            ? <>CPA máximo não definido nesta oferta: a análise usa o ticket médio ({money(an.cpaMax)}) como limite, o ponto em que a venda empata com o gasto. Defina o CPA máximo na engrenagem para regras mais precisas.</>
            : <>Defina o ticket médio e o CPA máximo na engrenagem: sem eles, as regras de gasto mínimo e CPA não funcionam.</>}
        </p>
      )}

      {/* A. Diagnóstico */}
      <Secao letra="A" titulo="Diagnóstico da campanha" info={regraInfo('diagnostico', cfg)}>
        <div className={`${styles.verdict} ${styles[`verdict_${ver.nivel}`]}`}>
          <strong>{ver.label}.</strong> <span className={styles.anFrase}>{an.frase}</span>
        </div>
        <div className={styles.anStats}>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Lucro total</span>
            <span className={`${styles.cardValue} ${an.camp.lucro < 0 ? styles.negative : styles.positive}`}>{money(an.camp.lucro)}</span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardLabel}>Lucro por dia · 7 dias</span>
            <span className={`${styles.cardValue} ${an.lucroDiaA < 0 ? styles.negative : ''}`}>
              {money(an.lucroDiaA)} <span className={styles.anSeta} title="Contra os 7 dias anteriores">{an.tendCamp || ''}</span>
            </span>
            <span className={styles.cardSub}>{an.lucroDiaB != null ? `antes: ${money(an.lucroDiaB)}/dia` : 'sem tendência (menos de 14 dias)'}</span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardLabel}>ROI</span>
            <span className={`${styles.cardValue} ${an.camp.roi < 0 ? styles.negative : ''}`}>{P(an.camp.roi)}</span>
            <span className={styles.cardSub}>{money(an.camp.roi == null ? null : an.camp.roi * 100)} de lucro a cada R$ 100</span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardLabel}>CPA</span>
            <span className={`${styles.cardValue} ${an.cpaMax && an.camp.cpa != null ? (an.camp.cpa <= an.cpaMax ? styles.positive : styles.negative) : ''}`}>{money(an.camp.cpa)}</span>
            <span className={styles.cardSub}>{an.cpaMax ? `máximo ${money(an.cpaMax)}` : 'sem CPA máximo'}</span>
          </div>
        </div>
      </Secao>

      {/* B. Ações */}
      <Secao letra="B" titulo="Ações recomendadas" info={{ oque: 'Uma ação por criativo ativo, da que mais aumenta o lucro por dia para a que menos. Toque no ⓘ de cada cartão para ver a regra.', formula: 'Impacto de escalar: aumento de um passo no orçamento × ROI com a queda do cenário 2. Reduzir: valor cortado × prejuízo evitado (ou × a diferença para o melhor criativo). Pausar: prejuízo por dia evitado.', mexer: 'Confiança: baixa com menos de 10 vendas, média de 10 a 29, alta com 30 ou mais.' }}>
        {an.acoes.length === 0 && <p className={styles.hint}>Nenhum criativo ativo para analisar.</p>}
        <div className={styles.anAcoes}>
          {an.acoes.map(a => (
            <article key={a.item.c.id} className={`${styles.anAcao} ${styles[`anAcao_${a.nivel}`]}`}>
              <header className={styles.anAcaoHead}>
                <span className={styles.anAcaoNome}>{a.item.c.nome}</span>
                <span className={`${styles.anTag} ${styles[`anTag_${a.nivel}`]}`}>{a.label}{a.naoAumente ? ' · sem aumentar' : ''}</span>
                <InfoTip info={regraInfo(ACAO_REGRA[a.acao], cfg)} title={a.label} />
              </header>
              <p className={styles.anMotivo}>{a.motivo}</p>
              <div className={styles.anMeta}>
                <span>Confiança <strong>{a.item.conf}</strong> ({pl(a.item.t.vendas, "venda", "vendas")})</span>
                <span>{a.impacto > 0 ? <>Impacto estimado <strong className={styles.positive}>+{money(a.impacto)}/dia</strong></> : 'Sem mudança de lucro agora'}</span>
                {a.item.grupo && <span>Grupo {a.item.grupo}</span>}
              </div>
              <details className={styles.anComo}>
                <summary>Como fazer <ChevronDown size={14} /></summary>
                <ol>{a.passos.map((p, k) => <li key={k}>{p}</li>)}</ol>
              </details>
            </article>
          ))}
        </div>
      </Secao>

      {/* C. Gasto × lucro */}
      <Secao letra="C" titulo="Gasto × lucro por criativo" info={regraInfo('base', cfg)}>
        {an.camp.lucro <= 0 && <p className={styles.hint}>A campanha não tem lucro: a participação no lucro não se aplica.</p>}
        <div className={styles.anBarras}>
          {[...an.itens].filter(i => i.t.gasto > 0).sort((a, b) => b.t.gasto - a.t.gasto).map(i => (
            <div key={i.c.id} className={styles.anBarraLinha}>
              <div className={styles.anBarraNome}>
                <span>{i.c.nome}</span>
                <small>{money(i.t.roi == null ? null : i.t.roi * 100)} por R$ 100 gasto · eficiência {X(i.efic)}</small>
              </div>
              <div className={styles.anBarraPar}>
                <div className={styles.anBarra}>
                  <span className={styles.anBarraGasto} style={{ width: `${Math.min(100, (i.shareGasto || 0) * 100)}%` }} />
                  <em>Gasto {P(i.shareGasto)}</em>
                </div>
                <div className={styles.anBarra}>
                  <span className={`${styles.anBarraLucro} ${i.t.lucro < 0 ? styles.anBarraNeg : ''}`} style={{ width: `${Math.max(0, Math.min(100, (i.shareLucro || 0) * 100))}%` }} />
                  <em>Lucro {i.shareLucro == null ? '–' : P(i.shareLucro)}{i.t.lucro < 0 ? ` (prejuízo ${money(-i.t.lucro)})` : ''}</em>
                </div>
              </div>
            </div>
          ))}
        </div>
        <span className={styles.anLegenda}><i className={styles.anBarraGasto} /> % do gasto <i className={styles.anBarraLucro} /> % do lucro</span>
      </Secao>

      {/* D. Funil */}
      <Secao letra="D" titulo="Funil por criativo" info={direta ? 'taxaCliqueVenda' : 'taxaConversaVenda'}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Criativo</th>
                <th className={styles.num}>Gasto</th>
                {direta ? (
                  <>
                    <th className={styles.num}>CPC</th>
                    <th className={styles.num}>Checkouts</th>
                    <th className={styles.num}>Custo/checkout</th>
                    <th className={styles.num}>Clique→venda</th>
                  </>
                ) : (
                  <>
                    <th className={styles.num}>Conversas</th>
                    <th className={styles.num}>Custo/conversa</th>
                    <th className={styles.num}>Conversa→venda</th>
                  </>
                )}
                <th className={styles.num}>Vendas</th>
                <th className={styles.num}>CPA</th>
              </tr>
            </thead>
            <tbody>
              {an.itens.filter(i => i.t.gasto > 0).map(i => (
                <tr key={i.c.id}>
                  <td>{i.c.nome}</td>
                  <td className={styles.num}>{money(i.t.gasto)}</td>
                  {direta ? (
                    <>
                      <td className={styles.num}>{money(i.t.cpc)}</td>
                      <td className={styles.num}>{i.t.checkouts ?? '–'}</td>
                      <td className={styles.num}>{money(i.t.custoCheckout)}</td>
                      <td className={styles.num}>{P(i.t.taxaCliqueVenda, 1)}</td>
                    </>
                  ) : (
                    <>
                      <td className={styles.num}>{i.t.conversas}</td>
                      <td className={styles.num}>{money(i.t.custoConversa)}</td>
                      <td className={styles.num}>{P(i.t.taxaConversaVenda, 1)}</td>
                    </>
                  )}
                  <td className={styles.num}>{i.t.vendas}</td>
                  <td className={styles.num}>{money(i.t.cpa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>

      {/* E. Tendência */}
      <Secao letra="E" titulo="Tendência" info={{ oque: `Últimos 7 dias (${ddmm(an.A.from)} a ${ddmm(an.A.to)}) contra os 7 anteriores (${ddmm(an.B.from)} a ${ddmm(an.B.to)}), contando a partir do último dia lançado.`, formula: 'ROI, CPA e lucro por dia recalculados das somas de cada janela.', mexer: 'Precisa de 14 dias de dados do criativo.' }}>
        {!an.temTendencia ? (
          <p className={styles.hint}>Dados insuficientes para tendência: são {an.diasPeriodo} dias de dados e a comparação precisa de 14.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Criativo</th>
                  <th className={styles.num}>ROI 7 dias</th>
                  <th className={styles.num}>ROI antes</th>
                  <th className={styles.num}>Lucro/dia</th>
                  <th className={styles.num}>Lucro/dia antes</th>
                  <th className={styles.num}>CPA 7 dias</th>
                  <th className={styles.num}>CPA antes</th>
                </tr>
              </thead>
              <tbody>
                {an.itens.filter(i => i.t.gasto > 0).map(i => (
                  <tr key={i.c.id}>
                    <td>{i.c.nome}</td>
                    {i.tendencia ? (
                      <>
                        <td className={styles.num}>{P(i.tA.roi)} <span className={styles.anSeta}>{arrow(i.tA.roi, i.tB.roi, cfg)}</span></td>
                        <td className={styles.num}>{P(i.tB.roi)}</td>
                        <td className={`${styles.num} ${i.lucroDiaA < 0 ? styles.negative : ''}`}>{money(i.lucroDiaA)}</td>
                        <td className={`${styles.num} ${i.lucroDiaB < 0 ? styles.negative : ''}`}>{money(i.lucroDiaB)}</td>
                        <td className={styles.num}>{money(i.tA.cpa)}</td>
                        <td className={styles.num}>{money(i.tB.cpa)}</td>
                      </>
                    ) : (
                      <td colSpan={6} className={styles.hint}>dados insuficientes para tendência</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>

      {/* F. Alertas */}
      <Secao letra="F" titulo="Alertas do portfólio">
        {an.alertas.length === 0 ? (
          <p className={styles.hint}>Nenhum alerta agora.</p>
        ) : (
          <ul className={styles.anAlertas}>
            {an.alertas.map(al => (
              <li key={al.id} className={`${styles.anAlerta} ${styles[`anAcao_${al.nivel}`]}`}>
                <strong>{al.titulo}</strong>
                <InfoTip info={regraInfo(al.regra, cfg)} title={al.titulo} />
                <p>{al.texto}</p>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      {/* Mudanças */}
      <Secao
        letra="✎"
        titulo="Mudanças registradas"
        info={{ oque: 'Anote o que você mudou no Gerenciador (orçamento, separou, pausou…) para ver o efeito.', formula: 'Antes = 7 dias antes da mudança. Depois = do dia da mudança até o último dia lançado. Lucro por dia, ROI, CPA e conversão recalculados das somas.', mexer: 'Espere alguns dias depois da mudança antes de tirar conclusões.' }}
        extra={!mudancaAberta && (
          <button type="button" className={styles.linkBtn} onClick={() => setMudancaAberta(true)}><Plus size={13} /> Registrar mudança</button>
        )}
      >
        <AvisoMigracao schema={store.eventosSchema} />
        {mudancaAberta && <MudancaForm oferta={oferta} criativos={criativos} store={store} onClose={() => setMudancaAberta(false)} />}
        {an.eventos.length === 0 && !mudancaAberta && <p className={styles.hint}>Nenhuma mudança registrada. Sem elas a análise funciona igual; com elas você vê o antes × depois.</p>}
        {an.eventos.length > 0 && (
          <ol className={styles.anTimeline}>
            {an.eventos.map(e => <EventoItem key={e.ev.id} e={e} an={an} oferta={oferta} criativos={criativos} store={store} />)}
          </ol>
        )}
      </Secao>

      {/* G. Simulador */}
      <Secao letra="G" titulo="Simulador de escala" info={regraInfo('escala', cfg)}>
        <Simulador itens={ativosComDados} an={an} />
      </Secao>

      {/* H. Regras */}
      <Secao letra="H" titulo="Como a análise é calculada">
        <RegrasPainel oferta={oferta} store={store} />
      </Secao>
    </div>
  )
}

function arrow(a, b, cfg) {
  if (a == null || b == null) return ''
  if (Math.abs(a - b) <= cfg.tendenciaFaixa * Math.abs(b)) return '→'
  return a > b ? '↑' : '↓'
}


function EventoItem({ e, an, oferta, criativos, store }) {
  const { money } = an
  const [editando, setEditando] = useState(false)
  const taxaLabel = an.tipo === 'direta' ? 'Clique→venda' : 'Conversa→venda'
  const linhas = [
    { k: 'Lucro por dia', a: e.antes.lucroDia, d: e.depois.lucroDia, fmt: money, maior: true },
    { k: 'ROI', a: e.antes.roi, d: e.depois.roi, fmt: v => P(v), maior: true },
    { k: 'CPA', a: e.antes.cpa, d: e.depois.cpa, fmt: money, maior: false },
    { k: taxaLabel, a: e.antes.taxa, d: e.depois.taxa, fmt: v => P(v, 1), maior: true },
  ]
  async function apagar() {
    if (!confirm('Apagar esta mudança registrada?')) return
    await store.deleteEvento(e.ev.id)
  }
  const semDepois = e.depois.dias === 0
  const orc = orcamentoTexto(e.ev, moedaContaOf(oferta))
  if (editando) {
    return (
      <li className={styles.anEvento} style={{ '--ev': evCor(e.ev.tipo) }}>
        <MudancaForm oferta={oferta} criativos={criativos} evento={e.ev} store={store} onClose={() => setEditando(false)} />
      </li>
    )
  }
  return (
    <li className={styles.anEvento} style={{ '--ev': evCor(e.ev.tipo) }}>
      <div className={styles.anEventoHead}>
        <EventoIcon tipo={e.ev.tipo} size={12} />
        <span className={styles.anEventoData}>{ddmm(e.ev.data)}</span>
        <strong>{e.nome}</strong>
        <span className={styles.evTag}>{e.tipoLabel}</span>
        <span className={styles.evItemBtns}>
          <button type="button" className={styles.iconBtn} onClick={() => setEditando(true)} aria-label="Editar mudança" title="Editar mudança"><Pencil size={13} /></button>
          <button type="button" className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={apagar} aria-label="Apagar mudança" title="Apagar mudança"><Trash2 size={13} /></button>
        </span>
      </div>
      {orc && <span className={styles.evOrc}>Orçamento: {orc}</span>}
      {e.ev.nota && <p className={styles.anEventoNota}>{e.ev.nota}</p>}
      {semDepois ? (
        <p className={styles.hint}>Ainda não há dias lançados depois desta mudança.</p>
      ) : (
        <div className={styles.anAntesDepois}>
          <span className={styles.anADHead}></span>
          <span className={styles.anADHead}>7 dias antes</span>
          <span className={styles.anADHead}>Desde a mudança</span>
          {linhas.map(l => {
            const melhorou = l.a != null && l.d != null && l.a !== l.d ? (l.maior ? l.d > l.a : l.d < l.a) : null
            return [
              <span key={l.k + 'k'} className={styles.anADk}>{l.k}</span>,
              <span key={l.k + 'a'}>{e.antes.dias ? l.fmt(l.a) : '–'}</span>,
              <span key={l.k + 'd'} className={melhorou == null ? '' : melhorou ? styles.positive : styles.negative}>
                {l.fmt(l.d)} {melhorou == null ? '' : melhorou ? '↑' : '↓'}
              </span>,
            ]
          })}
        </div>
      )}
    </li>
  )
}

function Simulador({ itens, an }) {
  const { money, cfg } = an
  const padrao = [...itens].sort((a, b) => (b.t.roi ?? -9) - (a.t.roi ?? -9))[0]
  const [id, setId] = useState(padrao?.c.id || '')
  const item = itens.find(i => i.c.id === id) || padrao
  const [atual, setAtual] = useState('')
  const [novo, setNovo] = useState('')
  useEffect(() => {
    if (!item) return
    const b = Math.round(item.base * 100) / 100
    setAtual(numToInput(b))
    setNovo(numToInput(Math.round(b * (1 + cfg.escalaPasso) * 100) / 100))
  }, [item?.c.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!item) return <p className={styles.hint}>Sem criativo ativo com gasto para simular.</p>
  const sim = simular({ roi: item.roiRef, atual: parseNum(atual), novo: parseNum(novo), cfg })
  return (
    <div className={styles.anSim}>
      <div className={styles.anFormGrid}>
        <Field label="Criativo">
          <select value={item.c.id} onChange={e => setId(e.target.value)}>
            {itens.map(i => <option key={i.c.id} value={i.c.id}>{i.c.nome}</option>)}
          </select>
        </Field>
        <Field label="Orçamento atual por dia">
          <input inputMode="decimal" value={atual} onChange={e => setAtual(e.target.value)} />
        </Field>
        <Field label="Novo orçamento por dia">
          <input inputMode="decimal" value={novo} onChange={e => setNovo(e.target.value)} />
        </Field>
      </div>
      <p className={styles.hint}>
        ROI usado: {P(item.roiRef)} ({item.roiRef === item.tA.roi && item.tA.vendas >= cfg.coletaMinVendas ? 'últimos 7 dias' : 'todos os dias'}).
        {item.orcamento == null ? ' Sem orçamento diário lançado: o atual veio do gasto médio por dia.' : ''}
      </p>
      {sim ? (
        <div className={styles.anSimCen}>
          {sim.cenarios.map(c => (
            <div key={c.label} className={styles.card}>
              <span className={styles.cardLabel}>{c.label} ({P(c.roi)})</span>
              <span className={`${styles.cardValue} ${c.lucroDia < 0 ? styles.negative : ''}`}>{money(c.lucroDia)}/dia</span>
              {c.diff != null && (
                <span className={`${styles.cardSub} ${c.diff < 0 ? styles.negative : c.diff > 0 ? styles.positive : ''}`}>
                  {c.diff >= 0 ? '+' : '−'}{money(Math.abs(c.diff))}/dia contra hoje ({money(sim.hoje)})
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.hint}>Digite os orçamentos para ver a projeção.</p>
      )}
      <p className={styles.anNota}>
        O ROI costuma cair ao escalar: o público mais fácil já foi atingido. Aumente de {P(cfg.escalaPasso)} em {P(cfg.escalaPasso)} a cada 2 ou 3 dias e acompanhe o ROI dos últimos 3 dias.
      </p>
    </div>
  )
}

const toInput = (v, tipo) => numToInput(tipo === 'pct' ? Math.round(v * 1000) / 10 : v)
const fromInput = (s, tipo) => {
  const n = parseNum(s)
  if (n == null || n < 0) return null
  return tipo === 'pct' ? n / 100 : n
}

function RegrasPainel({ oferta, store }) {
  const salvo = useMemo(() => regrasDaOferta(oferta), [oferta])
  const campos = REGRAS_INFO.flatMap(r => r.campos)
  const inicial = () => Object.fromEntries(campos.map(c => [c.key, toInput(salvo[c.key], c.tipo)]))
  const [draft, setDraft] = useState(inicial)
  const [msg, setMsg] = useState(null)
  useEffect(() => { setDraft(inicial()) }, [salvo]) // eslint-disable-line react-hooks/exhaustive-deps

  const atual = { ...salvo }
  campos.forEach(c => { const v = fromInput(draft[c.key], c.tipo); if (v != null) atual[c.key] = v })
  const invalidos = campos.filter(c => fromInput(draft[c.key], c.tipo) == null)
  const mudou = campos.some(c => Math.abs((fromInput(draft[c.key], c.tipo) ?? -1) - salvo[c.key]) > 1e-9)

  async function salvar() {
    if (invalidos.length) return
    const diff = {}
    campos.forEach(c => { if (Math.abs(atual[c.key] - REGRAS_PADRAO[c.key]) > 1e-9) diff[c.key] = atual[c.key] })
    const res = await store.updateOferta(oferta.id, { analise_config: Object.keys(diff).length ? diff : null })
    setMsg(res?.error
      ? (/analise_config/.test(res.error.message || '') ? 'Para salvar as regras, rode primeiro a migration 021 no Supabase.' : 'Não foi possível salvar. Tente de novo.')
      : 'Regras salvas para esta oferta.')
  }
  function padroes() {
    setDraft(Object.fromEntries(campos.map(c => [c.key, toInput(REGRAS_PADRAO[c.key], c.tipo)])))
    setMsg('Padrões carregados. Toque em “Salvar regras” para usar.')
  }

  return (
    <details className={styles.anRegras}>
      <summary>Ver e ajustar as regras e limites <ChevronDown size={14} /></summary>
      <p className={styles.hint}>Os limites valem só para esta oferta. A análise é toda feita aqui na ferramenta, por regras, sem IA e sem custo.</p>
      {REGRAS_INFO.map(r => (
        <div key={r.id} className={styles.anRegra}>
          <strong>{r.titulo}</strong>
          <p>{r.texto(atual)}</p>
          {r.campos.length > 0 && (
            <div className={styles.anRegraCampos}>
              {r.campos.map(c => (
                <label key={c.key} className={styles.anRegraCampo}>
                  <span>{c.label}</span>
                  <span className={styles.anRegraInput}>
                    <input
                      inputMode="decimal"
                      value={draft[c.key]}
                      aria-invalid={fromInput(draft[c.key], c.tipo) == null}
                      className={fromInput(draft[c.key], c.tipo) == null ? styles.inputError : ''}
                      onChange={e => { setMsg(null); setDraft(prev => ({ ...prev, [c.key]: e.target.value })) }}
                    />
                    <small>{c.tipo === 'pct' ? '%' : c.tipo === 'x' ? '×' : ''}</small>
                  </span>
                  <small className={styles.anPadrao}>padrão {toInput(REGRAS_PADRAO[c.key], c.tipo)}{c.tipo === 'pct' ? '%' : ''}</small>
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
      {invalidos.length > 0 && <p className={styles.fieldError}>Corrija os campos em vermelho (números a partir de 0).</p>}
      {msg && <p className={styles.hint} aria-live="polite">{msg}</p>}
      <div className={styles.anFormBtns}>
        <button type="button" className={styles.linkBtn} onClick={padroes}>Restaurar padrões</button>
        <button type="button" className={styles.primaryBtn} onClick={salvar} disabled={!mudou || invalidos.length > 0}>Salvar regras</button>
      </div>
    </details>
  )
}
