// Reads every monthly spreadsheet in GOOGLE_SHEETS_FOLDER_ID (named e.g.
// "6 - Junho"), parses the "Consolidado" tab, and mirrors it into
// rm_financial_data / rm_financial_offers / rm_financial_expenses for the
// calling user. Pass { month: <number> } in the body to sync just one month
// instead of the whole folder.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { getGoogleAccessToken } from '../_shared/google-auth.ts'
import { corsHeaders } from '../_shared/cors.ts'

const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
]

function num(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.trim() !== '') return Number(v.replace(',', '.')) || 0
  return 0
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function parseMonthFile(name: string): { number: number; name: string } | null {
  const m = name.match(/^(\d+)\s*-\s*(.+)$/)
  if (!m) return null
  return { number: parseInt(m[1], 10), name: m[2].trim() }
}

// Scans every row for a row whose cell at labelCol equals `label`
// (case-insensitive), returns the cell at valueCol of that same row.
function findLabeled(rows: any[][], labelCol: number, label: string, valueCol: number): number | null {
  const target = label.trim().toUpperCase()
  for (const row of rows) {
    if (str(row?.[labelCol]).toUpperCase() === target) return num(row?.[valueCol])
  }
  return null
}

// Finds a section header row (col B contains `sectionLabel`), then the next
// row below it whose col B starts with "TOTAL" — returns that row's value col.
function findSectionTotal(rows: any[][], sectionLabel: string, valueCol: number): number {
  const idx = rows.findIndex((row) => str(row?.[1]).toUpperCase().includes(sectionLabel.toUpperCase()))
  if (idx === -1) return 0
  for (let i = idx + 1; i < rows.length && i - idx <= 40; i++) {
    if (str(rows[i]?.[1]).toUpperCase().startsWith('TOTAL')) return num(rows[i]?.[valueCol])
  }
  return 0
}

// Line items between a section header and its "TOTAL..." row (skips the
// column-header row right after the section title, and any blank rows).
function extractExpenseItems(rows: any[][], sectionLabel: string): { categoria: string; descricao: string; valor: number }[] {
  const idx = rows.findIndex((row) => str(row?.[1]).toUpperCase().includes(sectionLabel.toUpperCase()))
  if (idx === -1) return []
  const items = []
  for (let i = idx + 2; i < rows.length && i - idx <= 40; i++) {
    const categoria = str(rows[i]?.[1])
    if (categoria.toUpperCase().startsWith('TOTAL')) break
    if (categoria) items.push({ categoria, descricao: str(rows[i]?.[2]), valor: num(rows[i]?.[3]) })
  }
  return items
}

function parseConsolidado(rows: any[][]) {
  const headerIdx = rows.findIndex((row) => str(row?.[1]).toUpperCase() === 'OFERTA')
  const totalsIdx = rows.findIndex((row, i) => i > headerIdx && str(row?.[1]).toUpperCase() === 'TOTAL OFERTAS')

  const offers = []
  if (headerIdx !== -1 && totalsIdx !== -1) {
    for (let i = headerIdx + 1; i < totalsIdx; i++) {
      const row = rows[i]
      const name = str(row?.[1])
      if (!name) continue
      offers.push({
        offer_name: name,
        investido: num(row?.[2]),
        vendas: num(row?.[3]),
        receita_total: num(row?.[5]),
        lucro_bruto: num(row?.[6]),
        roi: num(row?.[7]),
        status: str(row?.[8]),
      })
    }
  }

  const totalsRow = totalsIdx !== -1 ? rows[totalsIdx] : []
  const investido_ads = num(totalsRow?.[2])
  const receita_total = num(totalsRow?.[5])
  const lucro_bruto = num(totalsRow?.[6])
  const roi = num(totalsRow?.[7])

  const despesas_fixas = findSectionTotal(rows, 'DESPESAS FIXAS', 3)
  const despesas_variaveis = findSectionTotal(rows, 'DESPESAS V', 3) // covers "VÁRIAVEIS"/"VARIÁVEIS" spelling
  const ativos = findLabeled(rows, 11, 'Ativos', 12) ?? despesas_variaveis
  const lucro_liquido = findLabeled(rows, 1, 'LUCRO LÍQUIDO', 3) ?? (lucro_bruto - despesas_fixas - despesas_variaveis)
  const roas = investido_ads > 0 ? receita_total / investido_ads : null

  const despesasFixasItems = extractExpenseItems(rows, 'DESPESAS FIXAS')
  const despesasVariaveisItems = extractExpenseItems(rows, 'DESPESAS V')

  return {
    summary: { investido_ads, receita_total, lucro_bruto, roi, despesas_fixas, despesas_variaveis, ativos, lucro_liquido, roas },
    offers,
    despesasFixasItems,
    despesasVariaveisItems,
  }
}

// ── Impostos (IOF + Spread / imposto 12,15%) ──────────────────────────────────
// Each offer has its own tab in the month's spreadsheet. Layout (Nov/2026):
//
//   TAXA IMPOSTO 12.15%   TAXA IOF + SPREAD 7.64%   IOF DESDE DIA 10
//   ADS | IOF + SPREAD (or IMPOSTO) | VENDAS | …       ← summary
//   Dia | INVESTIDO | IOF + SPREAD (or IMPOSTO) | VENDAS R$ | …
//   1   | R$106.98  | -        | …
//   6   | R$58.19   | R$4.45   | …
//
// The daily tax column holds what was actually paid each day. Its header
// says which tax it is:
//   - "IOF + SPREAD" / "IOF" / "SPREAD"      → IOF
//   - "PIS", "COFINS", "ISS"                  → imposto 12,15%
//   - plain "IMPOSTO" (both taxes mixed)      → split by "IOF DESDE DIA N":
//       days before N are the 12,15% imposto, day N onward is IOF.
//       Without that cell it's all 12,15% imposto (or all IOF if the tab
//       only has a "TAXA IOF" rate).
// We only sum the R$ amounts the sheet shows; no rate is ever applied.
// The summary row (IOF + SPREAD / IMPOSTO under ADS) holds the same total,
// so it's not added again. Tabs without a tax column (older months) → 0.

// Same matching as the app (src/lib/offers.js): "1 - Casal Arte" → "casal arte".
function offerKey(name: string): string {
  return String(name ?? '').replace(/^\s*\d+\s*[-–—.:)]\s*/, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR')
}

const IOF_RE = /\bIOF\b|SPREAD/i
const PIS_RE = /\bPIS\b|COFINS|\bISS\b/i
type TaxKind = 'iof' | 'imposto' | 'mixed'
function taxColumnKind(header: string): TaxKind | null {
  if (/DESDE/i.test(header) || /^\s*TAXA/i.test(header)) return null
  if (PIS_RE.test(header)) return 'imposto'
  if (IOF_RE.test(header)) return 'iof'
  if (/IMPOSTO/i.test(header)) return 'mixed'
  return null
}

type Grid = { raw: any[][]; fmt: any[][] }

// "R$ 1.234,56", "-R$ 12,30", "(12,30)" → number; anything else → null.
function parseMoneyText(s: string): number | null {
  const t = s.replace(/\s/g, '')
  if (!/^[-(]?(R\$)?-?\(?[\d.]+(,\d+)?\)?$/.test(t)) return null
  const v = Number(t.replace(/[R$()\-]/g, '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(v) ? v : null
}

// A numeric (or R$ text) cell not shown as a percentage; "-" / blank → null.
function amountAt(g: Grid, r: number, c: number): number | null {
  const raw = g.raw[r]?.[c]
  const shown = String(g.fmt[r]?.[c] ?? '').trim()
  if (shown.endsWith('%')) return null
  if (typeof raw === 'number') return Math.abs(raw)
  if (typeof raw === 'string') {
    const v = parseMoneyText(raw)
    return v == null ? null : Math.abs(v)
  }
  return null
}

const cellText = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

// First number to the right of a label cell matching `re` (e.g. the 10 in
// "IOF DESDE DIA | 10"), or null when the label isn't in the tab.
function numberAfterLabel(g: Grid, re: RegExp): number | null {
  for (let r = 0; r < g.raw.length; r++) {
    const row = g.raw[r] || []
    for (let c = 0; c < row.length; c++) {
      if (!re.test(cellText(row[c]))) continue
      for (let k = c + 1; k <= c + 4; k++) {
        const v = row[k]
        if (typeof v === 'number') return v
        if (typeof v === 'string' && /^\s*\d+\s*$/.test(v)) return Number(v)
      }
    }
  }
  return null
}
const hasLabel = (g: Grid, re: RegExp) => g.raw.some((row) => (row || []).some((v: unknown) => re.test(cellText(v))))

function readOfferTaxes(g: Grid): { iof: number; imposto: number } {
  const out = { iof: 0, imposto: 0 }
  // Daily table header: the row with a "Dia" cell.
  const hr = g.raw.findIndex((row) => (row || []).some((v: unknown) => /^dia$/i.test(cellText(v))))
  if (hr === -1) return out
  const header = g.raw[hr] || []
  const dayCol = header.findIndex((v: unknown) => /^dia$/i.test(cellText(v)))
  const cols = header
    .map((v: unknown, c: number) => ({ c, kind: taxColumnKind(cellText(v)) }))
    .filter((x: { kind: TaxKind | null }) => x.kind) as { c: number; kind: TaxKind }[]
  if (cols.length === 0) return out

  const iofFrom = numberAfterLabel(g, /IOF.*DESDE/i)
  const mixedDefault: 'iof' | 'imposto' =
    !hasLabel(g, /TAXA\s+IMPOSTO/i) && hasLabel(g, /TAXA\s+IOF/i) ? 'iof' : 'imposto'

  let started = false
  for (let r = hr + 1; r < g.raw.length; r++) {
    const dayRaw = g.raw[r]?.[dayCol]
    const day = typeof dayRaw === 'number' ? dayRaw : /^\s*\d+\s*$/.test(cellText(dayRaw)) ? Number(dayRaw) : null
    if (day == null || day < 1 || day > 31) { if (started) break; else continue }
    started = true
    for (const { c, kind } of cols) {
      const a = amountAt(g, r, c)
      if (!a) continue
      const target = kind !== 'mixed' ? kind
        : iofFrom != null ? (day >= iofFrom ? 'iof' : 'imposto')
        : mixedDefault
      out[target] += a
    }
  }
  // Cents rounding so sums like 31.869999 read as 31.87.
  out.iof = Math.round(out.iof * 100) / 100
  out.imposto = Math.round(out.imposto * 100) / 100
  return out
}

// Picks the offer tab for an offer: exact name match first, then a tab whose
// name contains the offer's (or vice versa), e.g. tab "Casal" ↔ "Casal Arte".
function matchTab(offerName: string, tabs: { title: string; key: string }[]) {
  const key = offerKey(offerName)
  if (!key) return null
  return tabs.find((t) => t.key === key)
    ?? tabs.find((t) => t.key.length >= 3 && (key.includes(t.key) || t.key.includes(key)))
    ?? null
}

async function readTabs(fileId: string, titles: string[], gHeaders: Record<string, string>): Promise<Map<string, Grid>> {
  const out = new Map<string, Grid>()
  if (titles.length === 0) return out
  const ranges = titles.map((t) => `ranges=${encodeURIComponent(`'${t.replace(/'/g, "''")}'!A1:AZ1000`)}`).join('&')
  const get = async (render: string) => {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values:batchGet?${ranges}&valueRenderOption=${render}`,
      { headers: gHeaders },
    )
    const data = await res.json()
    if (!res.ok) throw new Error('Sheets batchGet error: ' + JSON.stringify(data))
    return (data.valueRanges || []).map((v: any) => v.values || [])
  }
  const [raw, fmt] = await Promise.all([get('UNFORMATTED_VALUE'), get('FORMATTED_VALUE')])
  titles.forEach((t, i) => out.set(t, { raw: raw[i] || [], fmt: fmt[i] || [] }))
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userId = userData.user.id

    const admin = createClient(supabaseUrl, serviceKey)

    let body: { month?: number } = {}
    try { body = await req.json() } catch { /* no body sent */ }

    const sa = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')!)
    const folderId = Deno.env.get('GOOGLE_SHEETS_FOLDER_ID')!
    const token = await getGoogleAccessToken(sa, SCOPES)
    const gHeaders = { Authorization: `Bearer ${token}` }

    const listRes = await fetch(
      'https://www.googleapis.com/drive/v3/files?' +
        new URLSearchParams({
          q: `'${folderId}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.spreadsheet'`,
          fields: 'files(id,name)',
          pageSize: '200',
        }),
      { headers: gHeaders },
    )
    const listData = await listRes.json()
    if (!listRes.ok) throw new Error('Drive list error: ' + JSON.stringify(listData))

    let files = (listData.files || [])
      .map((f: any) => ({ ...f, parsed: parseMonthFile(f.name) }))
      .filter((f: any) => f.parsed)

    if (body.month) files = files.filter((f: any) => f.parsed.number === body.month)

    const results = []
    for (const file of files) {
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${file.id}?fields=sheets.properties`,
        { headers: gHeaders },
      )
      const meta = await metaRes.json()
      const tabs = meta.sheets?.map((s: any) => s.properties) || []
      const consolidado = tabs.find((t: any) => t.title.includes('Consolidado'))
      if (!consolidado) continue

      const range = encodeURIComponent(`'${consolidado.title}'!A1:Z500`)
      const valRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${file.id}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`,
        { headers: gHeaders },
      )
      const valData = await valRes.json()
      const rows = valData.values || []
      const { summary, offers, despesasFixasItems, despesasVariaveisItems } = parseConsolidado(rows)

      // Taxes from each offer's own tab (0 when the tab or label is missing,
      // which is the case for every month before taxes were added).
      const offerTabs = tabs
        .filter((t: any) => t.title !== consolidado.title)
        .map((t: any) => ({ title: t.title as string, key: offerKey(t.title) }))
      const tabFor = new Map(offers.map((o) => [o.offer_name, matchTab(o.offer_name, offerTabs)]))
      const neededTitles = [...new Set([...tabFor.values()].filter(Boolean).map((t) => t!.title))]
      const grids = await readTabs(file.id, neededTitles, gHeaders)
      const offersWithTax = offers.map((o) => {
        const tab = tabFor.get(o.offer_name)
        const g = tab ? grids.get(tab.title) : null
        return { ...o, ...(g ? readOfferTaxes(g) : { iof: 0, imposto: 0 }) }
      })
      const iof = Math.round(offersWithTax.reduce((a, o) => a + o.iof, 0) * 100) / 100
      const imposto = Math.round(offersWithTax.reduce((a, o) => a + o.imposto, 0) * 100) / 100

      const monthNumber = file.parsed.number
      const monthName = file.parsed.name
      const syncedAt = new Date().toISOString()

      // Checked before anything is deleted: if this fails (e.g. the iof /
      // imposto columns don't exist yet) the month is left untouched.
      const { error: monthErr } = await admin.from('rm_financial_data').upsert(
        {
          user_id: userId,
          month_number: monthNumber,
          month_name: monthName,
          receita_total: summary.receita_total,
          lucro_bruto: summary.lucro_bruto,
          lucro_liquido: summary.lucro_liquido,
          investido_ads: summary.investido_ads,
          ativos: summary.ativos,
          despesas_fixas: summary.despesas_fixas,
          despesas_variaveis: summary.despesas_variaveis,
          roi: summary.roi,
          roas: summary.roas,
          iof,
          imposto,
          synced_at: syncedAt,
        },
        { onConflict: 'user_id,month_number' },
      )
      if (monthErr) throw new Error(`Falha ao gravar ${monthName}: ${monthErr.message}`)

      await admin.from('rm_financial_offers').delete().eq('user_id', userId).eq('month_number', monthNumber)
      if (offersWithTax.length > 0) {
        const { error: offersErr } = await admin.from('rm_financial_offers').insert(
          offersWithTax.map((o) => ({ ...o, user_id: userId, month_number: monthNumber, synced_at: syncedAt })),
        )
        if (offersErr) throw new Error(`Falha ao gravar ofertas de ${monthName}: ${offersErr.message}`)
      }

      await admin.from('rm_financial_expenses').delete().eq('user_id', userId).eq('month_number', monthNumber)
      const expenseRows = [
        ...despesasFixasItems.map((e) => ({ ...e, tipo: 'fixa' })),
        ...despesasVariaveisItems.map((e) => ({ ...e, tipo: 'variavel' })),
      ]
      if (expenseRows.length > 0) {
        await admin.from('rm_financial_expenses').insert(
          expenseRows.map((e) => ({ ...e, user_id: userId, month_number: monthNumber, synced_at: syncedAt })),
        )
      }

      results.push({
        month: monthNumber,
        name: monthName,
        offers: offers.length,
        iof,
        imposto,
        // Which tab each offer's taxes were read from (null = no tab found).
        taxTabs: Object.fromEntries([...tabFor.entries()].map(([name, t]) => [name, t?.title ?? null])),
      })
    }

    return new Response(JSON.stringify({ synced: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
