// Date-range filter for the offer screen. Dates are always local text
// "YYYY-MM-DD" in America/Sao_Paulo; arithmetic is done on the calendar
// numbers (UTC noon), never through toISOString().

const pad2 = n => String(n).padStart(2, '0')
export const isoOf = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}` // m is 0-based

const parts = iso => iso.split('-').map(Number)

// Today in São Paulo, whatever the device timezone is.
export function hojeSP() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).map(x => [x.type, x.value]),
  )
  return `${p.year}-${p.month}-${p.day}`
}

function asDate(iso) {
  const [y, m, d] = parts(iso)
  return new Date(Date.UTC(y, m - 1, d, 12))
}
function fromDate(dt) {
  return isoOf(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())
}

export function addDays(iso, n) {
  const dt = asDate(iso)
  dt.setUTCDate(dt.getUTCDate() + n)
  return fromDate(dt)
}

export const weekday = iso => asDate(iso).getUTCDay() // 0 = domingo

export function diffDays(a, b) {
  return Math.round((asDate(b) - asDate(a)) / 86400000)
}

// Sunday → Saturday of the week that contains `iso`.
export function semanaDe(iso) {
  const from = addDays(iso, -weekday(iso))
  return { tipo: 'semana', from, to: addDays(from, 6) }
}

export const diaPeriodo = iso => ({ tipo: 'dia', from: iso, to: iso })

export function intervalo(a, b) {
  const [from, to] = a <= b ? [a, b] : [b, a]
  return from === to ? diaPeriodo(from) : { tipo: 'intervalo', from, to }
}

// periodo = null means "Todos".
export function filtrarPeriodo(rows, periodo) {
  if (!periodo) return rows
  return rows.filter(r => r.data >= periodo.from && r.data <= periodo.to)
}

// Same length, moved one step back (-1) or forward (+1).
export function deslocar(periodo, dir) {
  const len = diffDays(periodo.from, periodo.to) + 1
  return { ...periodo, from: addDays(periodo.from, dir * len), to: addDays(periodo.to, dir * len) }
}

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export const ddmm = iso => { const [, m, d] = parts(iso); return `${pad2(d)}/${pad2(m)}` }

// "Domingo, 09/11" · "Semana 09/11 a 15/11" · "03/11 a 12/11"
export function periodoLabel(periodo) {
  if (!periodo) return 'Todos'
  if (periodo.tipo === 'dia') return `${DIAS[weekday(periodo.from)]}, ${ddmm(periodo.from)}`
  const range = `${ddmm(periodo.from)} a ${ddmm(periodo.to)}`
  return periodo.tipo === 'semana' ? `Semana ${range}` : range
}

// Short form for sentences: "em 09/11" · "de 03/11 a 09/11"
export function periodoFrase(periodo) {
  if (!periodo) return ''
  return periodo.from === periodo.to ? `em ${ddmm(periodo.from)}` : `de ${ddmm(periodo.from)} a ${ddmm(periodo.to)}`
}
