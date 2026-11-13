import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { SEED_SNACKS } from '../lib/rotina'

const SAVE_DELAY = 500 // ms; typing in a field becomes one save, taps feel instant

const emptyDay = data => ({ data, acordou: '', dormiu: '', treino: false, refeicoes: {}, agua_log: [] })

// Everything the Rotina tab stores. Changes show up immediately (local state)
// and are written to Supabase a moment later; a failed write is logged and
// surfaced through `saveError`.
export function useRotinaStore(user) {
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(() => new Map())     // data → row
  const [config, setConfig] = useState(null)
  const [snacks, setSnacks] = useState([])
  const [shopping, setShopping] = useState([])
  const [weights, setWeights] = useState([])
  const [saveError, setSaveError] = useState(null)

  const daysRef = useRef(days)
  daysRef.current = days
  const configRef = useRef(config)
  configRef.current = config
  const timers = useRef(new Map())
  const seeding = useRef(false)

  const fail = (where, error) => {
    console.error(`[rotina ${where}]`, error)
    setSaveError('Não foi possível salvar. Verifique a conexão e tente de novo.')
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [d, c, s, sh, w] = await Promise.all([
        supabase.from('rm_rotina_dias').select('*').eq('user_id', user.id),
        supabase.from('rm_rotina_config').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('rm_rotina_lanches').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('rm_rotina_compras').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('rm_rotina_peso').select('*').eq('user_id', user.id).order('data'),
      ])
      for (const [name, r] of Object.entries({ d, c, s, sh, w })) if (r.error) console.error(`[rotina load ${name}]`, r.error)
      if (cancelled) return

      let cfg = c.data
      let snackRows = s.data || []
      // First visit: create the config row and fill the snack bank. The
      // config insert doubles as the "already seeded" flag, so deleting
      // every snack later doesn't bring them back.
      if (!cfg && !c.error && !seeding.current) {
        seeding.current = true
        const ins = await supabase.from('rm_rotina_config').insert({ user_id: user.id }).select().single()
        if (!ins.error) {
          cfg = ins.data
          const seeded = await supabase.from('rm_rotina_lanches')
            .insert(SEED_SNACKS.map(x => ({ ...x, user_id: user.id }))).select()
          if (seeded.error) console.error('[rotina seed]', seeded.error)
          else snackRows = [...snackRows, ...seeded.data]
        } else {
          console.error('[rotina config insert]', ins.error)
          const again = await supabase.from('rm_rotina_config').select('*').eq('user_id', user.id).maybeSingle()
          cfg = again.data
        }
      }
      if (cancelled) return

      setDays(new Map((d.data || []).map(r => [r.data, r])))
      setConfig(cfg)
      setSnacks(snackRows)
      setShopping(sh.data || [])
      setWeights(w.data || [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [user])

  // Flush pending saves when leaving the tab.
  useEffect(() => () => { for (const fn of timers.current.values()) fn.flush() }, [])

  function schedule(key, run) {
    const prev = timers.current.get(key)
    if (prev) clearTimeout(prev.id)
    const entry = {
      id: setTimeout(() => { timers.current.delete(key); run() }, SAVE_DELAY),
      flush: () => { clearTimeout(entry.id); timers.current.delete(key); run() },
    }
    timers.current.set(key, entry)
  }

  // ── Dias ───────────────────────────────────────────────────────────────────
  const getDay = useCallback(key => days.get(key) ?? emptyDay(key), [days])

  // patch: object or (day → object)
  const updateDay = useCallback((key, patch) => {
    const current = daysRef.current.get(key) ?? emptyDay(key)
    const next = { ...current, ...(typeof patch === 'function' ? patch(current) : patch) }
    const map = new Map(daysRef.current)
    map.set(key, next)
    daysRef.current = map
    setDays(map)
    schedule(`day:${key}`, async () => {
      const row = daysRef.current.get(key)
      const { error } = await supabase.from('rm_rotina_dias').upsert({
        user_id: user.id,
        data: key,
        acordou: row.acordou || '',
        dormiu: row.dormiu || '',
        treino: !!row.treino,
        refeicoes: row.refeicoes || {},
        agua_log: row.agua_log || [],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,data' })
      if (error) fail('dia', error)
    })
  }, [user])

  // ── Config (metas + cardápio) ──────────────────────────────────────────────
  const updateConfig = useCallback(patch => {
    const next = { ...(configRef.current || { user_id: user.id }), ...patch }
    configRef.current = next
    setConfig(next)
    schedule('config', async () => {
      // eslint-disable-next-line no-unused-vars
      const { updated_at, ...row } = configRef.current
      const { error } = await supabase.from('rm_rotina_config')
        .upsert({ ...row, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      if (error) fail('config', error)
    })
  }, [user])

  // ── Lanches ────────────────────────────────────────────────────────────────
  const addSnack = useCallback(async snack => {
    const { data, error } = await supabase.from('rm_rotina_lanches').insert({ ...snack, user_id: user.id }).select().single()
    if (error) return fail('lanche add', error)
    setSnacks(prev => [...prev, data])
  }, [user])

  const updateSnack = useCallback(async (id, fields) => {
    setSnacks(prev => prev.map(s => (s.id === id ? { ...s, ...fields } : s)))
    const { error } = await supabase.from('rm_rotina_lanches').update(fields).eq('id', id)
    if (error) fail('lanche update', error)
  }, [])

  const deleteSnack = useCallback(async id => {
    setSnacks(prev => prev.filter(s => s.id !== id))
    const { error } = await supabase.from('rm_rotina_lanches').delete().eq('id', id)
    if (error) fail('lanche delete', error)
  }, [])

  // ── Lista de compras ───────────────────────────────────────────────────────
  const addShoppingItems = useCallback(async items => {
    if (!items.length) return
    const { data, error } = await supabase.from('rm_rotina_compras')
      .insert(items.map(i => ({ origem: 'manual', ...i, user_id: user.id }))).select()
    if (error) return fail('compras add', error)
    setShopping(prev => [...prev, ...data])
  }, [user])

  const updateShoppingItem = useCallback(async (id, fields) => {
    setShopping(prev => prev.map(i => (i.id === id ? { ...i, ...fields } : i)))
    const { error } = await supabase.from('rm_rotina_compras').update(fields).eq('id', id)
    if (error) fail('compras update', error)
  }, [])

  const deleteShoppingItems = useCallback(async ids => {
    if (!ids.length) return
    setShopping(prev => prev.filter(i => !ids.includes(i.id)))
    const { error } = await supabase.from('rm_rotina_compras').delete().in('id', ids)
    if (error) fail('compras delete', error)
  }, [])

  // ── Peso ───────────────────────────────────────────────────────────────────
  const saveWeight = useCallback(async (data, kg) => {
    const { data: row, error } = await supabase.from('rm_rotina_peso')
      .upsert({ user_id: user.id, data, kg }, { onConflict: 'user_id,data' }).select().single()
    if (error) return fail('peso', error)
    setWeights(prev => [...prev.filter(w => w.data !== data), row].sort((a, b) => a.data.localeCompare(b.data)))
  }, [user])

  const deleteWeight = useCallback(async id => {
    setWeights(prev => prev.filter(w => w.id !== id))
    const { error } = await supabase.from('rm_rotina_peso').delete().eq('id', id)
    if (error) fail('peso delete', error)
  }, [])

  return {
    loading, saveError, clearSaveError: () => setSaveError(null),
    days, getDay, updateDay,
    config, updateConfig,
    snacks, addSnack, updateSnack, deleteSnack,
    shopping, addShoppingItems, updateShoppingItem, deleteShoppingItems,
    weights, saveWeight, deleteWeight,
  }
}
