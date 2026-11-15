import { useState, useMemo } from 'react'
import { Plus, Settings, Pencil } from 'lucide-react'
import {
  summarize, computeVerdict, rankCompare, filterByPeriodo, PERIODOS,

} from '../../lib/criativosMetrics'
import { FaseBadge, DriveThumb, InfoTip } from './shared'
import { metricCols } from './metricCols'
import styles from './Criativos.module.css'

function signClass(v) {
  if (v == null || v === 0) return ''
  return v > 0 ? styles.positive : styles.negative
}

export default function OfertaTabela({ oferta, criativos, rowsByCriativo, onOpen, onEdit, onNew, onConfig }) {
  const [periodo, setPeriodo] = useState('total')
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
    const rows = filterByPeriodo(all, periodo)
    return {
      criativo: c,
      totals: summarize(rows, oferta.ticket_medio),
      // A sugestão usa sempre o histórico completo: cada fase já define a
      // própria janela (acumulado, últimos 3 dias, etc).
      verdict: computeVerdict(c, all, oferta),
    }
  }).sort(rankCompare), [criativos, rowsByCriativo, periodo, oferta])

  const total = useMemo(() => {
    const rows = criativos.flatMap(c => filterByPeriodo(rowsByCriativo[c.id] || [], periodo))
    return summarize(rows, oferta.ticket_medio)
  }, [criativos, rowsByCriativo, periodo, oferta.ticket_medio])

  return (
    <div className={styles.content}>
      <div className={styles.tableToolbar}>
        <div className={styles.viewToggle}>
          {PERIODOS.map(p => (
            <button
              key={p.id}
              className={periodo === p.id ? styles.viewToggleActive : ''}
              onClick={() => setPeriodo(p.id)}
            >{p.label}</button>
          ))}
        </div>
        <div className={styles.controls}>
          <button className={styles.iconBtnLg} onClick={onConfig} title="Configurações da oferta">
            <Settings size={17} />
          </button>
          <button className={styles.primaryBtn} onClick={onNew}>
            <Plus size={15} /> Novo criativo
          </button>
        </div>
      </div>

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
                  </td>
                  {cols.map(c => cell(c, totals))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className={styles.stickyPos}></td>
                <td className={styles.stickyThumb}></td>
                <td className={styles.stickyName}>Total</td>
                <td></td>
                {cols.map(c => cell(c, total))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
