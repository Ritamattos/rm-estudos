// Reads every monthly spreadsheet in GOOGLE_SHEETS_FOLDER_ID (named e.g.
// "6 - Junho"), parses the "Consolidado" tab, and mirrors it into
// rm_financial_data / rm_financial_offers / rm_financial_expenses for the
// calling user. Pass { month: <number> } in the body to sync just one month
// instead of the whole folder.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { getGoogleAccessToken } from '../_shared/google-auth.ts'

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

Deno.serve(async (req) => {
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
        headers: { 'Content-Type': 'application/json' },
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

      const monthNumber = file.parsed.number
      const monthName = file.parsed.name
      const syncedAt = new Date().toISOString()

      await admin.from('rm_financial_data').upsert(
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
          synced_at: syncedAt,
        },
        { onConflict: 'user_id,month_number' },
      )

      await admin.from('rm_financial_offers').delete().eq('user_id', userId).eq('month_number', monthNumber)
      if (offers.length > 0) {
        await admin.from('rm_financial_offers').insert(
          offers.map((o) => ({ ...o, user_id: userId, month_number: monthNumber, synced_at: syncedAt })),
        )
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

      results.push({ month: monthNumber, name: monthName, offers: offers.length })
    }

    return new Response(JSON.stringify({ synced: results }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
