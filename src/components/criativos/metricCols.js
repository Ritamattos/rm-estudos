// Which calculated metrics each offer type shows, in order, and how to
// format them. Used by the offer ranking table and the criativo cards, so
// both always show the same set. `info` is the METRIC_INFO key (ⓘ).
import { tipoOf, currency, percent, multiplier, decimal, integer } from '../../lib/criativosMetrics'

const C = (key, label, fmt, extra = {}) => ({ key, label, info: key, fmt, ...extra })

const money = (t, m) => v => currency(v, m)

export function metricCols(oferta) {
  const m = oferta.moeda || 'BRL'
  const cur = money(null, m)
  const head = [
    C('vendas', 'Vendas', t => integer(t.vendas), { strong: true }),
    // Always in reais; the part typed in dollars shows as detail.
    C('gasto', 'Gasto', t => cur(t.gasto), {
      detail: t => (t.gastoUSD != null ? `US$ ${t.gastoUSD.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lançados em dólar` : null),
    }),
    C('faturamento', 'Faturamento', t => cur(t.faturamento)),
    C('lucro', 'Lucro', t => cur(t.lucro), { sign: t => t.lucro }),
    C('cpa', 'CPA', t => cur(t.cpa), {
      sign: t => (t.cpa == null || !Number(oferta.cpa_maximo) ? 0 : t.cpa <= Number(oferta.cpa_maximo) ? 1 : -1),
    }),
    C('roi', 'ROI', t => percent(t.roi, 1), { sign: t => t.roi }),
    C('roas', 'ROAS', t => multiplier(t.roas)),
  ]
  const byTipo = tipoOf(oferta) === 'direta'
    ? [
        C('cliques', 'Cliques', t => (t.cliques == null ? '—' : integer(Math.round(t.cliques))), { aprox: t => t.cliquesAprox }),
        C('cpc', 'CPC', t => cur(t.cpc), { aprox: t => t.cliquesAprox }),
        C('checkouts', 'Checkouts', t => integer(t.checkouts)),
        C('custoCheckout', 'Custo/checkout', t => cur(t.custoCheckout)),
        C('taxaCheckoutVenda', 'Checkout→venda', t => percent(t.taxaCheckoutVenda, 1)),
        C('taxaCliqueVenda', 'Clique→venda', t => percent(t.taxaCliqueVenda, 1), { aprox: t => t.cliquesAprox }),
      ]
    : [
        C('conversas', 'Conversas', t => integer(t.conversas)),
        C('custoConversa', 'Custo/conversa', t => cur(t.custoConversa)),
        C('taxaConversaVenda', 'Conversa→venda', t => percent(t.taxaConversaVenda, 1)),
      ]
  const tail = [
    C('ctr', 'CTR', t => percent(t.ctr), { aprox: t => t.ctrAprox }),
    C('cpm', 'CPM', t => cur(t.cpm)),
    C('frequencia', 'Frequência', t => decimal(t.frequencia), { aprox: t => t.freqAprox }),
  ]
  return [...head, ...byTipo, ...tail]
}
