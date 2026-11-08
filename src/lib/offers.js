// Offer rows come from rm_financial_offers, one per offer per month, named
// as in the sheet: "1 - Casal Arte". The leading number is just the row's
// position that month and can change, so the same offer is matched across
// months by its name without that prefix, ignoring case.

// "1 - Casal Arte", "2- casal arte", "3) Casal Arte" → "Casal Arte".
// A separator is required, so a name that merely starts with a number
// ("300 Cards") is left alone.
const PREFIX_RE = /^\s*\d+\s*[-–—.:)]\s*/

export function offerDisplayName(name) {
  return String(name ?? '').replace(PREFIX_RE, '').replace(/\s+/g, ' ').trim()
}

export function offerKey(name) {
  return offerDisplayName(name).toLocaleLowerCase('pt-BR')
}

const n = v => Number(v) || 0

// Sums a set of offer rows. ROI and ROAS are recalculated from the summed
// totals (never an average of per-row ROIs). When the set is a single sheet
// row, that row's own ROI is kept so it matches the spreadsheet exactly.
export function aggregateOffers(rows) {
  const investido = rows.reduce((a, r) => a + n(r.investido), 0)
  const vendas = rows.reduce((a, r) => a + n(r.vendas), 0)
  const receita_total = rows.reduce((a, r) => a + n(r.receita_total), 0)
  const lucro_bruto = rows.reduce((a, r) => a + n(r.lucro_bruto), 0)
  const roi = rows.length === 1 && rows[0].roi != null
    ? Number(rows[0].roi)
    : (investido ? lucro_bruto / investido : null)
  const roas = investido ? receita_total / investido : null
  return { investido, vendas, receita_total, lucro_bruto, roi, roas, rowCount: rows.length }
}

// Distinct offers across all synced months, as [{ key, name }] sorted by
// name. The name shown is the spelling used most often; on a tie, one in
// normal mixed case ("Casal Arte" over "CASAL ARTE"/"casal arte"), then the
// one from the most recent month.
export function offerCatalog(offers) {
  const spellings = new Map() // key → Map(displayName → { count, month })
  for (const o of offers) {
    const key = offerKey(o.offer_name)
    if (!key) continue
    const name = offerDisplayName(o.offer_name)
    if (!spellings.has(key)) spellings.set(key, new Map())
    const s = spellings.get(key).get(name) ?? { count: 0, month: -Infinity }
    spellings.get(key).set(name, { count: s.count + 1, month: Math.max(s.month, o.month_number) })
  }
  return [...spellings.entries()]
    .map(([key, names]) => {
      const mixed = s => (s !== s.toUpperCase() && s !== s.toLowerCase() ? 1 : 0)
      const [name] = [...names.entries()].sort((a, b) =>
        b[1].count - a[1].count || mixed(b[0]) - mixed(a[0]) || b[1].month - a[1].month)[0]
      return { key, name }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

// Groups rows by offer and aggregates each group:
// [{ key, name, ...aggregateOffers }], sorted by Lucro Bruto, best first.
export function rankOffers(rows, catalog) {
  const names = new Map(catalog.map(c => [c.key, c.name]))
  const groups = new Map()
  for (const r of rows) {
    const key = offerKey(r.offer_name)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  }
  return [...groups.entries()]
    .map(([key, rs]) => ({ key, name: names.get(key) ?? offerDisplayName(rs[0].offer_name), ...aggregateOffers(rs) }))
    .sort((a, b) => b.lucro_bruto - a.lucro_bruto)
}
