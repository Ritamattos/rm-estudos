// Pure helpers for the Rotina tab (no Supabase, no React).

// ── Refeições ────────────────────────────────────────────────────────────────
export const MEALS = [
  { key: 'cafe',         label: 'Café da manhã',   main: true },
  { key: 'lanche_manha', label: 'Lanche',          main: false },
  { key: 'almoco',       label: 'Almoço',          main: true },
  { key: 'lanche_tarde', label: 'Lanche da tarde', main: false },
  { key: 'janta',        label: 'Janta',           main: true },
  { key: 'lanche_noite', label: 'Lanche da noite', main: false },
]
export const SNACK_SLOTS = MEALS.filter(m => m.key.startsWith('lanche_'))

export const MEAL_STATUS = [
  { key: 'comi',  label: 'Comi' },
  { key: 'pulei', label: 'Pulei' },
  { key: 'subst', label: 'Substituí' },
]

export const WATER_STEPS = [200, 300, 500]

// ── Datas (sempre no fuso local, chave "AAAA-MM-DD") ──────────────────────────
const pad = n => String(n).padStart(2, '0')
export const toKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
export const todayKey = () => toKey(new Date())
export const addDays = (key, n) => { const d = fromKey(key); d.setDate(d.getDate() + n); return toKey(d) }
export const nowHHMM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }

// Semana de segunda a domingo.
export function weekStart(key) {
  const d = fromKey(key)
  const dow = (d.getDay() + 6) % 7 // seg = 0
  d.setDate(d.getDate() - dow)
  return toKey(d)
}
export const weekDays = startKey => Array.from({ length: 7 }, (_, i) => addDays(startKey, i))

export const WEEKDAYS = [
  { key: 'seg', short: 'Seg', label: 'Segunda' },
  { key: 'ter', short: 'Ter', label: 'Terça' },
  { key: 'qua', short: 'Qua', label: 'Quarta' },
  { key: 'qui', short: 'Qui', label: 'Quinta' },
  { key: 'sex', short: 'Sex', label: 'Sexta' },
  { key: 'sab', short: 'Sáb', label: 'Sábado' },
  { key: 'dom', short: 'Dom', label: 'Domingo' },
]
export const weekdayOf = key => WEEKDAYS[(fromKey(key).getDay() + 6) % 7]

export function formatDay(key, opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
  return fromKey(key).toLocaleDateString('pt-BR', opts)
}

// "07:30" ↔ minutos
export const toMinutes = hhmm => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}
export const fromMinutes = min => `${pad(Math.floor(min / 60) % 24)}:${pad(Math.round(min % 60))}`

// ── Água ─────────────────────────────────────────────────────────────────────
export const waterTotal = day => (day?.agua_log || []).reduce((a, ml) => a + (Number(ml) || 0), 0)
export const formatMl = ml => (ml >= 1000 ? `${(ml / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} L` : `${ml} ml`)

// ── Lanches que já vêm no banco ──────────────────────────────────────────────
export const SEED_SNACKS = [
  {
    nome: 'Vitamina de banana',
    ingredientes: 'banana, leite, aveia, pasta de amendoim',
    preparo: 'Bata 1 banana, 1 copo de leite, 2 colheres de aveia e 1 colher de pasta de amendoim no liquidificador.',
  },
  {
    nome: 'Pão com ovo',
    ingredientes: 'pão francês, ovo',
    preparo: 'Frite ou mexa 1–2 ovos com um fio de óleo e coloque no pão.',
  },
  {
    nome: 'Pão com pasta de amendoim e banana',
    ingredientes: 'pão francês, pasta de amendoim, banana',
    preparo: 'Passe pasta de amendoim no pão e cubra com rodelas de banana.',
  },
  {
    nome: 'Cuscuz com ovo',
    ingredientes: 'flocão de milho, ovo, sal',
    preparo: 'Hidrate o flocão com água e sal, cozinhe no vapor por ~8 min e sirva com ovo mexido ou frito.',
  },
  {
    nome: 'Mingau de aveia com banana',
    ingredientes: 'aveia, leite, banana',
    preparo: 'Cozinhe 3 colheres de aveia em 1 copo de leite, mexendo, por ~3 min. Junte a banana amassada.',
  },
  {
    nome: 'Tapioca com queijo',
    ingredientes: 'goma de tapioca, queijo',
    preparo: 'Espalhe a goma na frigideira quente, espere firmar, recheie com queijo e dobre.',
  },
  {
    nome: 'Iogurte com aveia e mel',
    ingredientes: 'iogurte natural, aveia, mel',
    preparo: 'Misture 1 pote de iogurte com 2 colheres de aveia e um fio de mel.',
  },
  {
    nome: 'Leite com achocolatado e aveia',
    ingredientes: 'leite, achocolatado, aveia',
    preparo: 'Misture 1 copo de leite com 2 colheres de achocolatado e 2 de aveia.',
  },
  {
    nome: 'Batata-doce com ovo',
    ingredientes: 'batata-doce, ovo',
    preparo: 'Cozinhe a batata-doce (ou asse) e sirva com 1–2 ovos cozidos ou mexidos.',
  },
  {
    nome: 'Bolo de caneca de banana e aveia',
    ingredientes: 'banana, ovo, aveia, fermento',
    preparo: 'Amasse 1 banana, misture 1 ovo, 3 colheres de aveia e 1 pitada de fermento. Micro-ondas por ~2 min.',
  },
]

// ── Lista de compras a partir do cardápio ────────────────────────────────────
export function splitIngredients(text) {
  return String(text || '')
    .split(/[,;\n]/)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

const ingredientKey = s => s.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '')
const capitalize = s => s.charAt(0).toLocaleUpperCase('pt-BR') + s.slice(1)

// Junta os ingredientes do café (7 dias), da marmita da semana ativa e dos
// lanches planejados. Cada item diz de onde veio: "7× café · marmita · 3× lanche".
export function shoppingFromMenu(config, snacks) {
  const items = new Map() // key → { nome, cafe, marmita, lanche }
  const add = (text, field, times = 1) => {
    for (const ing of splitIngredients(text)) {
      const k = ingredientKey(ing)
      if (!items.has(k)) items.set(k, { nome: capitalize(ing), cafe: 0, marmita: 0, lanche: 0 })
      items.get(k)[field] += times
    }
  }
  if (!config) return []
  add(config.cafe_ingredientes, 'cafe', 7)
  add(config.semana_ativa === 'B' ? config.marmita_b_ingredientes : config.marmita_a_ingredientes, 'marmita', 1)
  const byId = new Map((snacks || []).map(s => [s.id, s]))
  for (const day of WEEKDAYS) {
    for (const slot of SNACK_SLOTS) {
      const snack = byId.get(config.plano_lanches?.[day.key]?.[slot.key])
      if (snack) add(snack.ingredientes, 'lanche', 1)
    }
  }
  return [...items.values()]
    .map(i => ({
      nome: i.nome,
      quantidade: [
        i.cafe && `${i.cafe}× café`,
        i.marmita && 'marmita',
        i.lanche && `${i.lanche}× lanche`,
      ].filter(Boolean).join(' · '),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

// ── Resumo da semana ─────────────────────────────────────────────────────────
// daysByKey: Map(key → day row). Only days up to `today` count for averages.
export function weekSummary(startKey, daysByKey, today = todayKey()) {
  const keys = weekDays(startKey).filter(k => k <= today)
  let feitas = 0, substituidas = 0, puladas = 0, principaisPuladas = 0, treinos = 0, agua = 0
  const wakes = []
  for (const k of keys) {
    const d = daysByKey.get(k)
    if (!d) continue
    for (const m of MEALS) {
      const st = d.refeicoes?.[m.key]?.status
      if (st === 'comi') feitas++
      else if (st === 'subst') { feitas++; substituidas++ }
      else if (st === 'pulei') { puladas++; if (m.main) principaisPuladas++ }
    }
    if (d.treino) treinos++
    agua += waterTotal(d)
    const w = toMinutes(d.acordou)
    if (w != null) wakes.push(w)
  }
  return {
    diasContados: keys.length,
    feitas, substituidas, puladas, principaisPuladas, treinos,
    aguaMedia: keys.length ? Math.round(agua / keys.length) : 0,
    acordarMedio: wakes.length ? fromMinutes(wakes.reduce((a, b) => a + b, 0) / wakes.length) : null,
  }
}

// ── Sorteio ──────────────────────────────────────────────────────────────────
// Escolhe um item ao acaso, evitando repetir `avoidId` quando houver opção.
export function pickRandom(list, avoidId) {
  if (!list.length) return null
  const pool = list.length > 1 ? list.filter(x => x.id !== avoidId) : list
  return pool[Math.floor(Math.random() * pool.length)]
}
