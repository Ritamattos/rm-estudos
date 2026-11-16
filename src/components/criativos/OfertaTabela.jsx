import { useState, useMemo } from 'react'
import { Plus, Settings, Pencil } from 'lucide-react'
import {
  summarize, computeVerdict, rankCompare,
  summarizeFora, totalOferta, campanhaVerdict, currency,
} from '../../lib/criativosMetrics'
import { FaseBadge, DriveThumb, InfoTip } from './shared'
import { metricCols } from './metricCols'
import VendasFora from './VendasFora'
import PeriodoFiltro from './PeriodoFiltro'
import { filtrarPeriodo, periodoLabel, periodoFrase } from '../../lib/periodo'
import styles from './Criativos.module.css'

function signClass(v) {
  if (v == null || v === 0) return ''
  return v > 0 ? styles.positive : styles.negative
}

export default function OfertaTabela({ oferta, criativos, rowsByCriativo, vendasFora = [], store, onOpen, onEdit, onNew, onConfig }) {
  // null = "Todos" (always the default when the screen opens).
  const [periodo, setPeriodo] = useState(null)
  const datasComDados = useMemo(() => new Set([
    ...criativos.flatMap(c => (rowsByCriativo[c.id] || []).map(r => r.data)),
    ...vendasFora.map(v => v.data),
  ]), [criativos, rowsByCriativo, vendasFora])
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
  }).sort(rankCompare), [criativos, rowsByCriativo, periodo, oferta])

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
        <PeriodoFiltro periodo={periodo} onChange={setPeriodo} datasComDados={datasComDados} />
        <div className={styles.controls}>
          <button className={styles.iconBtnLg} onClick={onConfig} title="Configurações da oferta">
            <Settings size={17} />
          </button>
          <button className={styles.primaryBtn} onClick={onNew}>
            <Plus size={15} /> Novo criativo
          </button>
        </div>
      </div>

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
                {cols.map(c => (
                  <th key={c.key} className={styles.num}>
                    <span className={styles.thInfo}>{c.label}<InfoTip info={c.info} title={c.label} /></span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ criativo, totals, verdict }, i) => (
                <tr key={criativo.id} className={criativo.fase === 'reprovado' ? styles.rowReprovado : ''}>
                  <td className={`${styles.stickyPos} ${styles.num} ${styles.pos} ${i === 0 && totals.vendas > 0 && !['reprovado', 'pausado'].includes(criativo.fase) ? styles.posChampion : ''}`}>
                    {i + 1}º
                  </td>
                  <td className={styles.stickyThumb}>
                    <DriveThumb link={criativo.link_drive} formato={criativo.formato} />
                  </td>
                  <td className={styles.stickyName}>
                    <button className={styles.nameLink} onClick={() => onOpen(criativo.id)}>{criativo.nome}</button>
                    <button
                      className={`${styles.iconBtn} ${styles.rowEditBtn}`}
                      onClick={() => onEdit(criativo)}
                      title="Editar criativo"
                      aria-label={`Editar ${criativo.nome}`}
                    >
                      <Pencil size={13} />
                    </button>
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
    </div>
  )
}
