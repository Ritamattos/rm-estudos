import { useState, useEffect, useMemo } from 'react'
import { RefreshCw, TrendingUp } from 'lucide-react'
import { useFinancialStore } from '../hooks/useFinancialStore'
import styles from './DadosSection.module.css'

function currency(v) {
  return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function percent(v) {
  return v == null ? '—' : `${(v * 100).toFixed(1)}%`
}
function multiplier(v) {
  return v == null ? '—' : `${v.toFixed(2)}x`
}

// % change vs the previous month in the selection. null when there's no
// previous value to compare against (first column, or a zero baseline).
function computeChange(curr, prev) {
  if (prev == null || prev === 0) return null
  return (((curr ?? 0) - prev) / Math.abs(prev)) * 100
}

// For most metrics, going up is good (green). For expenses it's the
// opposite: spending more is bad (red), spending less is good (green).
function changeClass(change, invert) {
  if (change == null || change === 0) return styles.changeNeutral
  const isGrowth = change > 0
  const isGood = invert ? !isGrowth : isGrowth
  return isGood ? styles.changeGood : styles.changeBad
}

const CHART_METRICS = [
  { key: 'receita_total', label: 'Receita Total', format: currency },
  { key: 'lucro_liquido', label: 'Lucro Líquido', format: currency },
  { key: 'roi', label: 'ROI', format: percent },
  { key: 'roas', label: 'ROAS', format: multiplier },
  { key: 'investido_ads', label: 'Investido em Ads', format: currency },
]

const TABLE_METRICS = [
  { key: 'receita_total', label: 'Receita Total', format: currency, invert: false },
  { key: 'lucro_bruto', label: 'Lucro Bruto', format: currency, invert: false },
  { key: 'lucro_liquido', label: 'Lucro Líquido', format: currency, invert: false },
  { key: 'investido_ads', label: 'Investido em Ads', format: currency, invert: false },
  { key: 'roi', label: 'ROI', format: percent, invert: false },
  { key: 'roas', label: 'ROAS', format: multiplier, invert: false },
  { key: 'despesas_fixas', label: 'Despesas Fixas', format: currency, invert: true },
  { key: 'despesas_variaveis', label: 'Despesas Variáveis', format: currency, invert: true },
]

function LineChartCard({ metric, months }) {
  const points = months.map(m => ({ label: m.month_name, value: metric.key === 'roi' ? (m[metric.key] ?? 0) * 100 : (m[metric.key] ?? 0) }))
  const values = points.map(p => p.value)
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const W = 100
  const H = 60
  const stepX = points.length > 1 ? W / (points.length - 1) : 0
  const coords = points.map((p, i) => ({
    ...p,
    x: points.length > 1 ? i * stepX : W / 2,
    y: H - ((p.value - min) / range) * H,
  }))
  const path = coords.map(c => `${c.x},${c.y}`).join(' ')

  return (
    <div className={styles.lineCard}>
      <span className={styles.chartLabel}>{metric.label}</span>
      <svg viewBox={`-2 -6 ${W + 4} ${H + 12}`} preserveAspectRatio="none" className={styles.lineSvg}>
        <polyline points={path} fill="none" stroke="var(--purple)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="2" fill="var(--purple)">
            <title>{`${c.label}: ${metric.format(months[i][metric.key])}`}</title>
          </circle>
        ))}
      </svg>
      <div className={styles.lineLabels}>
        {points.map((p, i) => <span key={i}>{p.label.slice(0, 3)}</span>)}
      </div>
    </div>
  )
}

export default function DadosSection({ user }) {
  const { months, offers, expenses, loading, syncing, syncError, sync } = useFinancialStore(user)
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [compareSelected, setCompareSelected] = useState([])
  const [viewAll, setViewAll] = useState(false)

  const sortedMonths = useMemo(() => [...months].sort((a, b) => a.month_number - b.month_number), [months])

  // Totals across every synced month. ROI/ROAS are recalculated from the
  // summed values (not averaged per-month), per how the business defines
  // an overall ROI/ROAS.
  const totals = useMemo(() => {
    if (sortedMonths.length === 0) return null
    const sum = key => sortedMonths.reduce((acc, m) => acc + (m[key] || 0), 0)
    const receita_total = sum('receita_total')
    const investido_ads = sum('investido_ads')
    const lucro_bruto = sum('lucro_bruto')
    const lucro_liquido = sum('lucro_liquido')
    const despesas_fixas = sum('despesas_fixas')
    const despesas_variaveis = sum('despesas_variaveis')
    return {
      receita_total, investido_ads, lucro_bruto, lucro_liquido, despesas_fixas, despesas_variaveis,
      roi: investido_ads ? lucro_bruto / investido_ads : null,
      roas: investido_ads ? receita_total / investido_ads : null,
    }
  }, [sortedMonths])

  const compareMonths = useMemo(
    () => sortedMonths.filter(m => compareSelected.includes(m.month_number)),
    [sortedMonths, compareSelected],
  )

  // In "Total Geral" mode the evolution charts/table reuse all synced
  // months automatically instead of the manual month-picker selection.
  const effectiveCompareMonths = viewAll ? sortedMonths : compareMonths

  function toggleCompareMonth(monthNumber) {
    setCompareSelected(sel =>
      sel.includes(monthNumber) ? sel.filter(n => n !== monthNumber) : [...sel, monthNumber],
    )
  }

  function toggleCompareAll() {
    setCompareSelected(sel =>
      sel.length === sortedMonths.length ? [] : sortedMonths.map(m => m.month_number),
    )
  }

  useEffect(() => {
    if (sortedMonths.length === 0) return
    if (selectedMonth == null || !sortedMonths.some(m => m.month_number === selectedMonth)) {
      setSelectedMonth(sortedMonths[sortedMonths.length - 1].month_number)
    }
  }, [sortedMonths, selectedMonth])

  const current = sortedMonths.find(m => m.month_number === selectedMonth)
  const monthOffers = offers.filter(o => o.month_number === selectedMonth)
  const despesasFixas = expenses.filter(e => e.month_number === selectedMonth && e.tipo === 'fixa')
  const despesasVariaveis = expenses.filter(e => e.month_number === selectedMonth && e.tipo === 'variavel')

  const maxLucro = Math.max(1, ...sortedMonths.map(m => Math.abs(m.lucro_liquido || 0)))
  const maxRoi = Math.max(1, ...sortedMonths.map(m => Math.abs(m.roi || 0)))

  if (loading) {
    return <div className={styles.empty}><span className={styles.loadingIcon}>◆</span></div>
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.title}>Dados</h1>
          <span className={styles.subtitle}>
            {viewAll
              ? (sortedMonths.length > 0
                ? `Total acumulado de ${sortedMonths.length} ${sortedMonths.length === 1 ? 'mês sincronizado' : 'meses sincronizados'}`
                : 'Nenhum mês sincronizado ainda')
              : (current ? `Sincronizado ${new Date(current.synced_at).toLocaleString('pt-BR')}` : 'Nenhum mês sincronizado ainda')}
          </span>
        </div>
        <div className={styles.controls}>
          <div className={styles.viewToggle}>
            <button
              type="button"
              className={!viewAll ? styles.viewToggleActive : ''}
              onClick={() => setViewAll(false)}
            >Mês</button>
            <button
              type="button"
              className={viewAll ? styles.viewToggleActive : ''}
              onClick={() => setViewAll(true)}
            >Ver todos os meses</button>
          </div>
          {!viewAll && sortedMonths.length > 0 && (
            <select
              className={styles.monthSelect}
              value={selectedMonth ?? ''}
              onChange={e => setSelectedMonth(Number(e.target.value))}
            >
              {sortedMonths.map(m => (
                <option key={m.month_number} value={m.month_number}>{m.month_name}</option>
              ))}
            </select>
          )}
          <button className={styles.syncBtn} onClick={sync} disabled={syncing}>
            <RefreshCw size={14} className={syncing ? styles.spin : ''} />
            {syncing ? 'Sincronizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {syncError && <div className={styles.syncError}>Erro ao sincronizar: {syncError}</div>}

      {(viewAll ? sortedMonths.length === 0 : !current) ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>◆</div>
          <p>Nenhum dado sincronizado ainda. Verifique se há planilhas na pasta configurada.</p>
        </div>
      ) : (
        <div className={styles.content}>
          {viewAll ? (
            <div className={styles.cards}>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Receita Total</span>
                <span className={styles.cardValue}>{currency(totals.receita_total)}</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Lucro Bruto</span>
                <span className={styles.cardValue}>{currency(totals.lucro_bruto)}</span>
              </div>
              <div className={`${styles.card} ${styles.cardHighlight}`}>
                <span className={styles.cardLabel}>Lucro Líquido</span>
                <span className={styles.cardValue}>{currency(totals.lucro_liquido)}</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Investido em Ads</span>
                <span className={styles.cardValue}>{currency(totals.investido_ads)}</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Despesas Fixas</span>
                <span className={styles.cardValue}>{currency(totals.despesas_fixas)}</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Despesas Variáveis</span>
                <span className={styles.cardValue}>{currency(totals.despesas_variaveis)}</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>ROI Geral</span>
                <span className={styles.cardValue}>{percent(totals.roi)}</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>ROAS Geral</span>
                <span className={styles.cardValue}>{multiplier(totals.roas)}</span>
              </div>
            </div>
          ) : (
            <div className={styles.cards}>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Receita Total</span>
                <span className={styles.cardValue}>{currency(current.receita_total)}</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Lucro Bruto</span>
                <span className={styles.cardValue}>{currency(current.lucro_bruto)}</span>
              </div>
              <div className={`${styles.card} ${styles.cardHighlight}`}>
                <span className={styles.cardLabel}>Lucro Líquido</span>
                <span className={styles.cardValue}>{currency(current.lucro_liquido)}</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>Investido em Ads</span>
                <span className={styles.cardValue}>{currency(current.investido_ads)}</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>ROI</span>
                <span className={styles.cardValue}>{percent(current.roi)}</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>ROAS</span>
                <span className={styles.cardValue}>{multiplier(current.roas)}</span>
              </div>
            </div>
          )}

          {sortedMonths.length > 1 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}><TrendingUp size={15} /> Comparação entre meses</h2>
              <div className={styles.chartRow}>
                <div className={styles.chart}>
                  <span className={styles.chartLabel}>Lucro Líquido</span>
                  <div className={styles.bars}>
                    {sortedMonths.map(m => (
                      <div
                        key={m.month_number}
                        className={styles.barCol}
                        title={`${m.month_name}: ${currency(m.lucro_liquido)}`}
                        onClick={() => { setSelectedMonth(m.month_number); setViewAll(false) }}
                      >
                        <div
                          className={`${styles.bar} ${m.month_number === selectedMonth ? styles.barActive : ''}`}
                          style={{ height: `${Math.max(4, (Math.abs(m.lucro_liquido || 0) / maxLucro) * 100)}%` }}
                        />
                        <span className={styles.barLabel}>{m.month_name.slice(0, 3)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={styles.chart}>
                  <span className={styles.chartLabel}>ROI</span>
                  <div className={styles.bars}>
                    {sortedMonths.map(m => (
                      <div
                        key={m.month_number}
                        className={styles.barCol}
                        title={`${m.month_name}: ${percent(m.roi)}`}
                        onClick={() => { setSelectedMonth(m.month_number); setViewAll(false) }}
                      >
                        <div
                          className={`${styles.bar} ${styles.barAlt} ${m.month_number === selectedMonth ? styles.barActive : ''}`}
                          style={{ height: `${Math.max(4, (Math.abs(m.roi || 0) / maxRoi) * 100)}%` }}
                        />
                        <span className={styles.barLabel}>{m.month_name.slice(0, 3)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {sortedMonths.length > 1 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}><TrendingUp size={15} /> Comparação detalhada</h2>

              {viewAll ? (
                <p className={styles.emptyHint}>Mostrando a evolução de todos os {sortedMonths.length} meses sincronizados.</p>
              ) : (
                <div className={styles.monthPicker}>
                  {sortedMonths.map(m => (
                    <button
                      key={m.month_number}
                      className={`${styles.monthPill} ${compareSelected.includes(m.month_number) ? styles.monthPillActive : ''}`}
                      onClick={() => toggleCompareMonth(m.month_number)}
                    >
                      {m.month_name}
                    </button>
                  ))}
                  <button className={styles.monthPickerAction} onClick={toggleCompareAll}>
                    {compareSelected.length === sortedMonths.length ? 'Limpar seleção' : 'Selecionar todos'}
                  </button>
                </div>
              )}

              {effectiveCompareMonths.length < 2 ? (
                <p className={styles.emptyHint}>Selecione 2 ou mais meses acima para comparar a evolução em detalhe.</p>
              ) : (
                <>
                  <div className={styles.lineChartsGrid}>
                    {CHART_METRICS.map(metric => (
                      <LineChartCard key={metric.key} metric={metric} months={effectiveCompareMonths} />
                    ))}
                  </div>

                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Métrica</th>
                          {effectiveCompareMonths.map(m => <th key={m.month_number}>{m.month_name}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {TABLE_METRICS.map(metric => (
                          <tr key={metric.key}>
                            <td className={styles.metricName}>{metric.label}</td>
                            {effectiveCompareMonths.map((m, i) => {
                              const curr = m[metric.key]
                              const prev = i > 0 ? effectiveCompareMonths[i - 1][metric.key] : null
                              const change = i > 0 ? computeChange(curr, prev) : null
                              return (
                                <td key={m.month_number}>
                                  <div className={styles.cellValue}>{metric.format(curr)}</div>
                                  {i > 0 && (
                                    <div className={changeClass(change, metric.invert)}>
                                      {change == null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`}
                                    </div>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {!viewAll && current && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Ofertas — {current.month_name}</h2>
            {monthOffers.length === 0 ? (
              <p className={styles.emptyHint}>Nenhuma oferta neste mês.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Oferta</th><th>Investido</th><th>Vendas</th><th>Receita</th><th>Lucro</th><th>ROI</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthOffers.map(o => (
                      <tr key={o.id}>
                        <td>{o.offer_name}</td>
                        <td>{currency(o.investido)}</td>
                        <td>{currency(o.vendas)}</td>
                        <td>{currency(o.receita_total)}</td>
                        <td>{currency(o.lucro_bruto)}</td>
                        <td>{percent(o.roi)}</td>
                        <td>{o.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}

          {!viewAll && current && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Despesas — {current.month_name}</h2>
            <div className={styles.expensesRow}>
              <div className={styles.expensesCol}>
                <div className={styles.expensesHeader}>
                  <span>Fixas</span><span>{currency(current.despesas_fixas)}</span>
                </div>
                {despesasFixas.length === 0 ? (
                  <p className={styles.emptyHint}>Nenhum lançamento.</p>
                ) : (
                  <table className={styles.table}>
                    <tbody>
                      {despesasFixas.map(e => (
                        <tr key={e.id}>
                          <td>{e.categoria}</td>
                          <td className={styles.expDesc}>{e.descricao}</td>
                          <td className={styles.expVal}>{currency(e.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className={styles.expensesCol}>
                <div className={styles.expensesHeader}>
                  <span>Variáveis</span><span>{currency(current.despesas_variaveis)}</span>
                </div>
                {despesasVariaveis.length === 0 ? (
                  <p className={styles.emptyHint}>Nenhum lançamento.</p>
                ) : (
                  <table className={styles.table}>
                    <tbody>
                      {despesasVariaveis.map(e => (
                        <tr key={e.id}>
                          <td>{e.categoria}</td>
                          <td className={styles.expDesc}>{e.descricao}</td>
                          <td className={styles.expVal}>{currency(e.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  )
}
