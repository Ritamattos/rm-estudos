import { useState, useMemo } from 'react'
import { Plus, Settings } from 'lucide-react'
import {
  summarize, computeVerdict, rankCompare, filterByPeriodo, PERIODOS,
  currency, percent, multiplier, decimal, integer,
} from '../../lib/criativosMetrics'
import { FaseBadge, DriveThumb } from './shared'
import styles from './Criativos.module.css'

function signClass(v) {
  if (v == null || v === 0) return ''
  return v > 0 ? styles.positive : styles.negative
}

export default function OfertaTabela({ oferta, criativos, rowsByCriativo, onOpen, onNew, onConfig }) {
  const [periodo, setPeriodo] = useState('total')
  const moeda = oferta.moeda || 'BRL'
  const money = v => currency(v, moeda)

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
                <th className={styles.num}>Vendas</th>
                <th className={styles.num}>Gasto</th>
                <th className={styles.num}>Faturamento</th>
                <th className={styles.num}>Lucro</th>
                <th className={styles.num}>CPA</th>
                <th className={styles.num}>ROI</th>
                <th className={styles.num}>ROAS</th>
                <th className={styles.num}>CTR</th>
                <th className={styles.num}>Freq.</th>
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
                    {criativo.angulo && <span className={styles.nameSub}>{criativo.angulo}</span>}
                  </td>
                  <td>
                    <FaseBadge fase={criativo.fase} />
                    {verdict.text && (
                      <span className={`${styles.suggestion} ${styles[`sug_${verdict.level}`]}`}>{verdict.text}</span>
                    )}
                  </td>
                  <td className={`${styles.num} ${styles.strong}`}>{integer(totals.vendas)}</td>
                  <td className={styles.num}>{money(totals.gasto)}</td>
                  <td className={styles.num}>{money(totals.faturamento)}</td>
                  <td className={`${styles.num} ${signClass(totals.lucro)}`}>{money(totals.lucro)}</td>
                  <td className={styles.num}>{money(totals.cpa)}</td>
                  <td className={`${styles.num} ${signClass(totals.roi)}`}>{percent(totals.roi, 1)}</td>
                  <td className={styles.num}>{multiplier(totals.roas)}</td>
                  <td className={styles.num}>{percent(totals.ctr)}</td>
                  <td className={styles.num}>{decimal(totals.frequencia)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className={styles.stickyPos}></td>
                <td className={styles.stickyThumb}></td>
                <td className={styles.stickyName}>Total</td>
                <td></td>
                <td className={styles.num}>{integer(total.vendas)}</td>
                <td className={styles.num}>{money(total.gasto)}</td>
                <td className={styles.num}>{money(total.faturamento)}</td>
                <td className={`${styles.num} ${signClass(total.lucro)}`}>{money(total.lucro)}</td>
                <td className={styles.num}>{money(total.cpa)}</td>
                <td className={`${styles.num} ${signClass(total.roi)}`}>{percent(total.roi, 1)}</td>
                <td className={styles.num}>{multiplier(total.roas)}</td>
                <td className={styles.num}>{percent(total.ctr)}</td>
                <td className={styles.num}>{decimal(total.frequencia)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
