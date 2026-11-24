import { useState, useMemo } from 'react'
import { Plus, Settings, Pencil, ArrowDown, ArrowUp, ArrowUpDown, Trophy, ShoppingCart } from 'lucide-react'
import {
  summarize, computeVerdict, rankCompare, RANK_SORTS, RANK_DEFAULT, moedaContaOf,
  summarizeFora, totalOferta, campanhaVerdict, currency,
} from '../../lib/criativosMetrics'
import { FaseBadge, DriveThumb, InfoTip } from './shared'
import { metricCols } from './metricCols'
import VendasFora from './VendasFora'
import PeriodoFiltro from './PeriodoFiltro'
import AnaliseOferta from './AnaliseOferta'
import { EventoMarcador, eventosPorData, eventosRecentes } from './mudancas'
import { filtrarPeriodo, periodoLabel, periodoFrase } from '../../lib/periodo'
import styles from './Criativos.module.css'

function signClass(v) {
  if (v == null || v === 0) return ''
  return v > 0 ? styles.positive : styles.negative
}

export default function OfertaTabela({ oferta, criativos, rowsByCriativo, vendasFora = [], eventos = [], store, onOpen, onEdit, onNew, onConfig }) {
  // null = "Todos" (always the default when the screen opens).
  const [periodo, setPeriodo] = useState(null)
  // Tabela | Análise
  const [aba, setAba] = useState('tabela')
  // Ranking order: lucro (R$) first by default, every time the screen opens.
  const [sort, setSort] = useState(RANK_DEFAULT)
  const ordenarPor = key => setSort(s => (s.key === key
    ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' }
    : { key, dir: RANK_SORTS[key] }))
  const datasComDados = useMemo(() => new Set([
    ...criativos.flatMap(c => (rowsByCriativo[c.id] || []).map(r => r.data)),
    ...vendasFora.map(v => v.data),
  ]), [criativos, rowsByCriativo, vendasFora])
  const mudancasPorData = useMemo(() => eventosPorData(eventos), [eventos])
  const nomeDe = e => (e.criativo_id ? (criativos.find(c => c.id === e.criativo_id)?.nome || 'Criativo excluído') : 'Campanha inteira')
  // Changes of the last 7 days per criativo (icon next to the name).
  const recentesPorCriativo = useMemo(() => {
    const m = {}
    for (const e of eventosRecentes(eventos)) if (e.criativo_id) (m[e.criativo_id] ||= []).push(e)
    return m
  }, [eventos])
  const cols = useMemo(() => metricCols(oferta), [oferta])
  const cell = (c, t) => {
    const sg = c.sign?.(t)
    return (
      <td key={c.key} className={`${styles.num} ${c.strong ? styles.strong : ''} ${sg ? signClass(sg) : ''}`} title={c.detail?.(t) || undefined}>
        {c.fmt(t)}{c.aprox?.(t) && <small className={styles.approx}> aprox.</small>}
      </td>
    )
  }

  const ranked = useMemo(() => criativos.map(c => {
    const all = rowsByCriativo[c.id] || []
    const rows = filtrarPeriodo(all, periodo)
    return {
      criativo: c,
      totals: summarize(rows, oferta.ticket_medio),
      // A sugestão usa sempre o histórico completo: cada fase já define a
      // própria janela (acumulado, últimos 3 dias, etc).
      verdict: computeVerdict(c, all, oferta),
    }
  }).sort((a, b) => rankCompare(a, b, sort)), [criativos, rowsByCriativo, periodo, oferta, sort])

  // Badges for the period shown: highest profit and most sales (can be the
  // same criativo). Only when the value is above zero; ties go to the one
  // ranked higher.
  const destaques = useMemo(() => {
    const melhor = key => ranked.reduce((best, r) => (r.totals[key] > 0 && (!best || r.totals[key] > best.totals[key]) ? r : best), null)?.criativo.id
    return { lucro: melhor('lucro'), vendas: melhor('vendas') }
  }, [ranked])

  const total = useMemo(() => {
    const rows = criativos.flatMap(c => filtrarPeriodo(rowsByCriativo[c.id] || [], periodo))
    return summarize(rows, oferta.ticket_medio)
  }, [criativos, rowsByCriativo, periodo, oferta.ticket_medio])

  // "Campanha" = only criativos (decides what to scale or pause).
  // "Total da oferta" = campanha + vendas fora da campanha (matches the sheet).
  const fora = useMemo(
    () => summarizeFora(filtrarPeriodo(vendasFora, periodo), oferta.ticket_medio),
    [vendasFora, periodo, oferta.ticket_medio],
  )
  const totalOf = useMemo(() => totalOferta(total, fora), [total, fora])
  const money = v => currency(v, oferta.moeda || 'BRL')
  const campVerdict = campanhaVerdict(total, totalOf, oferta, money)
  const vazio = total.dias === 0 && fora.dias === 0

  return (
    <div className={styles.content}>
      <div className={styles.tableToolbar}>
        <div className={`${styles.viewToggle} ${styles.abas}`} role="tablist" aria-label="Visão da oferta">
          <button role="tab" aria-selected={aba === 'tabela'} className={aba === 'tabela' ? styles.viewToggleActive : ''} onClick={() => setAba('tabela')}>Tabela</button>
          <button role="tab" aria-selected={aba === 'analise'} className={aba === 'analise' ? styles.viewToggleActive : ''} onClick={() => setAba('analise')}>Análise</button>
        </div>
        {aba === 'tabela' && <PeriodoFiltro periodo={periodo} onChange={setPeriodo} datasComDados={datasComDados} mudancasPorData={mudancasPorData} nomeDe={nomeDe} />}
        <div className={styles.controls}>
          <button className={styles.iconBtnLg} onClick={onConfig} title="Configurações da oferta">
            <Settings size={17} />
          </button>
          <button className={styles.primaryBtn} onClick={onNew}>
            <Plus size={15} /> Novo criativo
          </button>
        </div>
      </div>

      {aba === 'analise' && (
        <AnaliseOferta oferta={oferta} criativos={criativos} rowsByCriativo={rowsByCriativo} eventos={eventos} store={store} />
      )}

      {aba === 'tabela' && <>
      {periodo && (
        <div className={styles.periodoResumo} aria-live="polite">
          <span className={styles.periodoResumoTitle}>{periodoLabel(periodo)}</span>
          {vazio ? (
            <p className={styles.hint}>Sem lançamentos neste período.</p>
          ) : (
            <div className={styles.periodoResumoGrid}>
              <div><small>Gasto</small><strong>{money(totalOf.gasto)}</strong></div>
              <div><small>Vendas</small><strong>{totalOf.vendas}</strong></div>
              <div><small>Faturamento</small><strong>{money(totalOf.faturamento)}</strong></div>
              <div>
                <small>{totalOf.lucro < 0 ? 'Prejuízo' : 'Lucro'}</small>
                <strong className={totalOf.lucro < 0 ? styles.negative : totalOf.lucro > 0 ? styles.positive : ''}>{money(Math.abs(totalOf.lucro))}</strong>
              </div>
            </div>
          )}
          {!vazio && fora.vendas > 0 && <span className={styles.hint}>inclui {fora.vendas} venda(s) fora da campanha ({money(fora.faturamento)})</span>}
        </div>
      )}

      {(criativos.length > 0 || vendasFora.length > 0) && !(periodo && vazio) && (
        <div className={`${styles.verdict} ${styles[`verdict_${campVerdict.level}`]} ${styles.campVerdict}`}>
          <span className={styles.campVerdictHead}>
            <strong>Campanha{periodo ? ` ${periodoFrase(periodo)}` : ''}:</strong> {campVerdict.text}
            {total.dias > 0 && <> · {total.lucro >= 0 ? 'lucro' : 'prejuízo'} de {money(Math.abs(total.lucro))}</>}
            <InfoTip info="campanha" title="Campanha" />
          </span>
          {campVerdict.reason && <span className={styles.verdictReason}>{campVerdict.reason}</span>}
        </div>
      )}

      {criativos.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>◆</div>
          <p>Nenhum criativo nesta oferta. Toque em “Novo criativo” para começar.</p>
        </div>
      ) : (
        <div className={styles.sheetWrap}>
          <table className={styles.sheet}>
            <thead>
              <tr>
                <th className={`${styles.stickyPos} ${styles.num}`}>#</th>
                <th className={styles.stickyThumb}></th>
                <th className={styles.stickyName}>Nome</th>
                <th>Status</th>
                {cols.map(c => {
                  const ordenavel = c.key in RANK_SORTS
                  const ativo = sort.key === c.key
                  const Seta = !ativo ? ArrowUpDown : sort.dir === 'desc' ? ArrowDown : ArrowUp
                  return (
                    <th
                      key={c.key}
                      className={`${styles.num} ${ativo ? styles.thSortActive : ''}`}
                      aria-sort={ativo ? (sort.dir === 'desc' ? 'descending' : 'ascending') : undefined}
                    >
                      <span className={styles.thInfo}>
                        {ordenavel ? (
                          <button
                            type="button"
                            className={styles.thSortBtn}
                            onClick={() => ordenarPor(c.key)}
                            title={ativo
                              ? `Ordenado por ${c.label} (${sort.dir === 'desc' ? 'maior para o menor' : 'menor para o maior'}). Toque para inverter.`
                              : `Ordenar por ${c.label}`}
                          >
                            {c.label}
                            <Seta size={12} className={ativo ? '' : styles.thSortIdle} aria-hidden="true" />
                          </button>
                        ) : c.label}
                        <InfoTip info={c.info} title={c.label} />
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ criativo, totals, verdict }, i) => (
                <tr key={criativo.id} className={criativo.fase === 'reprovado' ? styles.rowReprovado : ''}>
                  <td className={`${styles.stickyPos} ${styles.num} ${styles.pos} ${i === 0 && !['reprovado', 'pausado'].includes(criativo.fase) && (totals[sort.key] != null) ? styles.posChampion : ''}`}>
                    {i + 1}º
                  </td>
                  <td className={styles.stickyThumb}>
                    <DriveThumb link={criativo.link_drive} formato={criativo.formato} />
                  </td>
                  <td className={styles.stickyName}>
                    <button className={styles.nameLink} onClick={() => onOpen(criativo.id)}>{criativo.nome}</button>
                    {recentesPorCriativo[criativo.id] && (
                      <EventoMarcador
                        eventos={recentesPorCriativo[criativo.id]}
                        maxIcones={1}
                        comData
                        moeda={moedaContaOf(oferta)}
                        titulo={`Mudanças nos últimos 7 dias (${recentesPorCriativo[criativo.id].length})`}
                      />
                    )}
                    <button
                      className={`${styles.iconBtn} ${styles.rowEditBtn}`}
                      onClick={() => onEdit(criativo)}
                      title="Editar criativo"
                      aria-label={`Editar ${criativo.nome}`}
                    >
                      <Pencil size={13} />
                    </button>
                    {(destaques.lucro === criativo.id || destaques.vendas === criativo.id) && (
                      <span className={styles.seloRow}>
                        {destaques.lucro === criativo.id && (
                          <span className={`${styles.selo} ${styles.seloLucro}`} title={`Mais lucrativo${periodo ? ' no período' : ''}: ${money(totals.lucro)}`}>
                            <Trophy size={10} aria-hidden="true" /> Mais lucro
                          </span>
                        )}
                        {destaques.vendas === criativo.id && (
                          <span className={`${styles.selo} ${styles.seloVendas}`} title={`Mais vendas${periodo ? ' no período' : ''}: ${totals.vendas}`}>
                            <ShoppingCart size={10} aria-hidden="true" /> Mais vendas
                          </span>
                        )}
                      </span>
                    )}
                    {criativo.angulo && <span className={styles.nameSub}>{criativo.angulo}</span>}
                  </td>
                  <td>
                    <FaseBadge fase={criativo.fase} />
                    {verdict.text && (
                      <span className={`${styles.suggestion} ${styles[`sug_${verdict.level}`]}`}>{verdict.text}</span>
                    )}
                    {verdict.reason && <span className={styles.suggestionReason}>{verdict.reason}</span>}
                    {periodo && <span className={styles.statusAcumulado}>baseado em todos os dias</span>}
                  </td>
                  {cols.map(c => cell(c, totals))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className={styles.stickyPos}></td>
                <td className={styles.stickyThumb}></td>
                <td className={styles.stickyName}>
                  <span className={styles.thInfo}>Campanha<InfoTip info="campanha" title="Campanha" /></span>
                  <span className={styles.nameSub}>só criativos</span>
                </td>
                <td></td>
                {cols.map(c => cell(c, total))}
              </tr>
              <tr className={styles.totalOfertaRow}>
                <td className={styles.stickyPos}></td>
                <td className={styles.stickyThumb}></td>
                <td className={styles.stickyName}>
                  <span className={styles.thInfo}>Total da oferta<InfoTip info="totalOferta" title="Total da oferta" /></span>
                  <span
                    className={styles.nameSub}
                    title={fora.vendas || fora.faturamento ? `${fora.vendas} venda(s) fora da campanha: ${money(fora.faturamento)}` : undefined}
                  >
                    {fora.vendas || fora.faturamento
                      ? `+ ${fora.vendas} fora · ${money(fora.faturamento)}`
                      : 'campanha + vendas fora'}
                  </span>
                </td>
                <td></td>
                {cols.map(c => cell(c, totalOf))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {store && <VendasFora oferta={oferta} rows={vendasFora} store={store} periodo={periodo} />}
      </>}
    </div>
  )
}
