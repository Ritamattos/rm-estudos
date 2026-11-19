import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { rowGasto, gastoEmReais } from '../lib/criativosMetrics'

export function useCriativosStore(user) {
  const [pastas, setPastas] = useState([])
  const [ofertas, setOfertas] = useState([])
  const [criativos, setCriativos] = useState([])
  const [metricas, setMetricas] = useState([])
  // Sales outside the campaign (referral, organic…): per offer, never per criativo.
  const [vendasFora, setVendasFora] = useState([])
  // Changes typed in the "Análise" tab (budget up, split, paused…).
  const [eventos, setEventos] = useState([])
  // Database schema for changes: 'ok' | 'sem021' (no table) | 'sem022'
  // (no budget columns) | null while unknown. Drives the on-screen notice.
  const [eventosSchema, setEventosSchema] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadAll()
  }, [user])

  async function loadAll() {
    setLoading(true)
    const [{ data: ps }, { data: os }, { data: cs }, { data: ms }, vf, ev, probe] = await Promise.all([
      supabase.from('criativos_pastas').select('*').eq('user_id', user.id).order('ordem').order('created_at'),
      supabase.from('criativos_ofertas').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('criativos').select('*').eq('user_id', user.id).order('numero'),
      supabase.from('criativos_metricas').select('*').eq('user_id', user.id).order('data'),
      supabase.from('criativos_vendas_fora').select('*').eq('user_id', user.id).order('data'),
      supabase.from('criativos_eventos').select('*').eq('user_id', user.id).order('data'),
      // Probes the budget columns of migration 022 (fails if they're missing).
      supabase.from('criativos_eventos').select('id, orcamento_anterior, orcamento_novo').limit(1),
    ])
    // Before migration 021 the table doesn't exist: just show none.
    if (ev.error) console.warn('[criativos_eventos]', ev.error.message)
    setEventos(ev.data || [])
    setEventosSchema(ev.error ? 'sem021' : probe.error ? 'sem022' : 'ok')
    // Before migration 019 the table doesn't exist: just show none.
    if (vf.error) console.warn('[criativos_vendas_fora]', vf.error.message)
    setVendasFora(vf.data || [])
    setPastas(ps || [])
    setOfertas(os || [])
    setCriativos(cs || [])
    setMetricas(ms || [])
    setLoading(false)
  }

  // ── Pastas ──────────────────────────────────────────────────────────────────

  const addPasta = useCallback(async (nome) => {
    const { data } = await supabase.from('criativos_pastas')
      .insert({ user_id: user.id, nome, ordem: pastas.length }).select().single()
    if (data) setPastas(prev => [...prev, data])
    return data
  }, [user, pastas])

  const updatePasta = useCallback(async (id, fields) => {
    await supabase.from('criativos_pastas').update(fields).eq('id', id)
    setPastas(prev => prev.map(p => p.id === id ? { ...p, ...fields } : p))
  }, [])

  // Deleting cascades in the database to its ofertas → criativos → métricas;
  // reloading is simpler than mirroring that cascade in local state.
  const deletePasta = useCallback(async (id) => {
    await supabase.from('criativos_pastas').delete().eq('id', id)
    await loadAll()
  }, [user])

  // ── Ofertas ─────────────────────────────────────────────────────────────────

  const addOferta = useCallback(async (pastaId, fields) => {
    const { data, error } = await supabase.from('criativos_ofertas')
      .insert({ ...fields, pasta_id: pastaId, user_id: user.id }).select().single()
    if (error) { console.error('[addOferta]', error); return { error } }
    if (data) setOfertas(prev => [...prev, data])
    return data
  }, [user])

  const updateOferta = useCallback(async (id, fields) => {
    const { error } = await supabase.from('criativos_ofertas').update(fields).eq('id', id)
    if (error) { console.error('[updateOferta]', error); return { error } }
    setOfertas(prev => prev.map(o => o.id === id ? { ...o, ...fields } : o))
    return {}
  }, [])

  const deleteOferta = useCallback(async (id) => {
    await supabase.from('criativos_ofertas').delete().eq('id', id)
    await loadAll()
  }, [user])

  // ── Criativos ───────────────────────────────────────────────────────────────

  // Numbered sequentially per oferta ("AD 1", "AD 2"…), continuing after the
  // highest number in use so deleting one never reuses an old name.
  const addCriativo = useCallback(async (ofertaId, fields) => {
    const numero = Math.max(0, ...criativos.filter(c => c.oferta_id === ofertaId).map(c => c.numero || 0)) + 1
    const { data, error } = await supabase.from('criativos').insert({
      // `numero` only orders the criativos; the name is the one the user typed.
      nome: `AD ${numero}`, ...fields, oferta_id: ofertaId, numero, user_id: user.id,
    }).select().single()
    if (error) { console.error('[addCriativo]', error); return { error } }
    if (data) setCriativos(prev => [...prev, data])
    return data
  }, [user, criativos])

  const updateCriativo = useCallback(async (id, fields) => {
    const { error } = await supabase.from('criativos').update(fields).eq('id', id)
    if (error) {
      console.error('[updateCriativo]', error)
      alert('Não foi possível salvar as alterações do criativo. Tente de novo.')
      return { error }
    }
    setCriativos(prev => prev.map(c => c.id === id ? { ...c, ...fields } : c))
    return {}
  }, [])

  const deleteCriativo = useCallback(async (id) => {
    await supabase.from('criativos').delete().eq('id', id)
    setCriativos(prev => prev.filter(c => c.id !== id))
    setMetricas(prev => prev.filter(m => m.criativo_id !== id))
  }, [])

  // ── Métricas diárias ────────────────────────────────────────────────────────
  //
  // One row per criativo per day: saving a date that already exists
  // overwrites it (upsert on the unique criativo_id + data pair).

  const saveMetrica = useCallback(async (criativoId, fields) => {
    const { data, error } = await supabase.from('criativos_metricas')
      .upsert({ ...fields, criativo_id: criativoId, user_id: user.id }, { onConflict: 'criativo_id,data' })
      .select().single()
    if (error) return { error }
    setMetricas(prev => {
      const rest = prev.filter(m => m.id !== data.id && !(m.criativo_id === criativoId && m.data === data.data))
      return [...rest, data].sort((a, b) => a.data.localeCompare(b.data))
    })
    return { data }
  }, [user])

  // Editing a row may change its date, which could collide with another
  // row of the same criativo — surfaced back to the caller as an error.
  const updateMetrica = useCallback(async (id, fields) => {
    const { data, error } = await supabase.from('criativos_metricas').update(fields).eq('id', id).select().single()
    if (error) return { error }
    setMetricas(prev => prev.map(m => m.id === id ? data : m).sort((a, b) => a.data.localeCompare(b.data)))
    return { data }
  }, [])

  const deleteMetrica = useCallback(async (id) => {
    await supabase.from('criativos_metricas').delete().eq('id', id)
    setMetricas(prev => prev.filter(m => m.id !== id))
  }, [])

  // Re-labels the spend of saved days in another account currency (e.g. the
  // offer was switched to dollars after days were typed as reais). The typed
  // number is kept; only its currency, rate, acréscimo and the reais value
  // change. `toReais(original)` returns the new gasto in reais.
  const convertGastoDias = useCallback(async (rows, { moeda, cotacao, acrescimo, toReais }) => {
    const updates = rows.map(r => {
      const original = r.gasto_original != null && r.gasto_original !== '' ? Number(r.gasto_original) : Number(r.gasto || 0)
      return {
        id: r.id,
        // `acrescimo` may be a function of the day's date (start date rule).
        fields: (() => {
          const ac = typeof acrescimo === 'function' ? acrescimo(r.data) : acrescimo
          return { gasto_original: original, moeda_gasto: moeda, cotacao, acrescimo: ac, gasto: toReais(original, ac) }
        })(),
      }
    })
    const results = await Promise.all(updates.map(u =>
      supabase.from('criativos_metricas').update(u.fields).eq('id', u.id).select().single()))
    const failed = results.filter(r => r.error)
    if (failed.length) console.error('[convertGastoDias]', failed.map(r => r.error))
    const ok = new Map(results.filter(r => !r.error).map(r => [r.data.id, r.data]))
    setMetricas(prev => prev.map(m => ok.get(m.id) ?? m))
    return { converted: ok.size, failed: failed.length }
  }, [])

  // Re-applies the acréscimo of saved days (e.g. 0% before the offer's start
  // date). The typed spend, currency and rate are kept.
  const recalcAcrescimoDias = useCallback(async (rows, acrescimoDe) => {
    const results = await Promise.all(rows.map(r => {
      const g = rowGasto(r)
      const ac = acrescimoDe(r.data)
      return supabase.from('criativos_metricas').update({
        gasto_original: g.original, moeda_gasto: g.moeda, cotacao: g.cotacao, acrescimo: ac,
        gasto: gastoEmReais(g.original, g.cotacao, ac),
      }).eq('id', r.id).select().single()
    }))
    const failed = results.filter(r => r.error)
    if (failed.length) console.error('[recalcAcrescimoDias]', failed.map(r => r.error))
    const ok = new Map(results.filter(r => !r.error).map(r => [r.data.id, r.data]))
    setMetricas(prev => prev.map(m => ok.get(m.id) ?? m))
    return { updated: ok.size, failed: failed.length }
  }, [])

  // ── Vendas fora da campanha ───────────────────────────────────────────────
  // One row per offer per day: saving a date that exists overwrites it.

  const sortByDate = list => [...list].sort((a, b) => a.data.localeCompare(b.data))

  const saveVendaFora = useCallback(async (ofertaId, fields) => {
    const { data, error } = await supabase.from('criativos_vendas_fora')
      .upsert({ ...fields, oferta_id: ofertaId, user_id: user.id }, { onConflict: 'oferta_id,data' })
      .select().single()
    if (error) return { error }
    setVendasFora(prev => sortByDate([...prev.filter(v => v.id !== data.id && !(v.oferta_id === ofertaId && v.data === data.data)), data]))
    return { data }
  }, [user])

  const updateVendaFora = useCallback(async (id, fields) => {
    const { data, error } = await supabase.from('criativos_vendas_fora').update(fields).eq('id', id).select().single()
    if (error) return { error }
    setVendasFora(prev => sortByDate(prev.map(v => (v.id === id ? data : v))))
    return { data }
  }, [])

  const deleteVendaFora = useCallback(async (id) => {
    const { error } = await supabase.from('criativos_vendas_fora').delete().eq('id', id)
    if (error) return { error }
    setVendasFora(prev => prev.filter(v => v.id !== id))
    return {}
  }, [])

  // ── Mudanças (aba Análise) ─────────────────────────────────────────────────

  const addEvento = useCallback(async (ofertaId, fields) => {
    const { data, error } = await supabase.from('criativos_eventos')
      .insert({ ...fields, oferta_id: ofertaId, user_id: user.id }).select().single()
    if (error) { console.error('[addEvento]', error); return { error } }
    setEventos(prev => sortByDate([...prev, data]))
    return { data }
  }, [user])

  const updateEvento = useCallback(async (id, fields) => {
    const { data, error } = await supabase.from('criativos_eventos').update(fields).eq('id', id).select().single()
    if (error) { console.error('[updateEvento]', error); return { error } }
    setEventos(prev => sortByDate(prev.map(e => (e.id === id ? data : e))))
    return { data }
  }, [])

  const deleteEvento = useCallback(async (id) => {
    const { error } = await supabase.from('criativos_eventos').delete().eq('id', id)
    if (error) return { error }
    setEventos(prev => prev.filter(e => e.id !== id))
    return {}
  }, [])

  return {
    eventos, eventosSchema, addEvento, updateEvento, deleteEvento,
    pastas, ofertas, criativos, metricas, vendasFora, loading,
    saveVendaFora, updateVendaFora, deleteVendaFora, convertGastoDias, recalcAcrescimoDias,
    addPasta, updatePasta, deletePasta,
    addOferta, updateOferta, deleteOferta,
    addCriativo, updateCriativo, deleteCriativo,
    saveMetrica, updateMetrica, deleteMetrica,
    reload: loadAll,
  }
}
