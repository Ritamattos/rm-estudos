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

export default function DadosSection({ user }) {
  const { months, offers, expenses, loading, syncing, syncError, sync } = useFinancialStore(user)
  const [selectedMonth, setSelectedMonth] = useState(null)

  const sortedMonths = useMemo(() => [...months].sort((a, b) => a.month_number - b.month_number), [months])

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
            {current ? `Sincronizado ${new Date(current.synced_at).toLocaleString('pt-BR')}` : 'Nenhum mês sincronizado ainda'}
          </span>
        </div>
        <div className={styles.controls}>
          {sortedMonths.length > 0 && (
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

      {!current ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>◆</div>
          <p>Nenhum dado sincronizado ainda. Verifique se há planilhas na pasta configurada.</p>
        </div>
      ) : (
        <div className={styles.content}>
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
                        onClick={() => setSelectedMonth(m.month_number)}
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
                        onClick={() => setSelectedMonth(m.month_number)}
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
        </div>
      )}
    </div>
  )
}
