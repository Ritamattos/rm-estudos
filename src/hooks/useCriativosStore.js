import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useCriativosStore(user) {
  const [pastas, setPastas] = useState([])
  const [ofertas, setOfertas] = useState([])
  const [criativos, setCriativos] = useState([])
  const [metricas, setMetricas] = useState([])
  // Sales outside the campaign (referral, organic…): per offer, never per criativo.
  const [vendasFora, setVendasFora] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadAll()
  }, [user])

  async function loadAll() {
    setLoading(true)
    const [{ data: ps }, { data: os }, { data: cs }, { data: ms }, vf] = await Promise.all([
      supabase.from('criativos_pastas').select('*').eq('user_id', user.id).order('ordem').order('created_at'),
      supabase.from('criativos_ofertas').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('criativos').select('*').eq('user_id', user.id).order('numero'),
      supabase.from('criativos_metricas').select('*').eq('user_id', user.id).order('data'),
      supabase.from('criativos_vendas_fora').select('*').eq('user_id', user.id).order('data'),
    ])
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
    const { data } = await supabase.from('criativos_ofertas')
      .insert({ ...fields, pasta_id: pastaId, user_id: user.id }).select().single()
    if (data) setOfertas(prev => [...prev, data])
    return data
  }, [user])

  const updateOferta = useCallback(async (id, fields) => {
    await supabase.from('criativos_ofertas').update(fields).eq('id', id)
    setOfertas(prev => prev.map(o => o.id === id ? { ...o, ...fields } : o))
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
    const { data } = await supabase.from('criativos').insert({
      // `numero` only orders the criativos; the name is the one the user typed.
      nome: `AD ${numero}`, ...fields, oferta_id: ofertaId, numero, user_id: user.id,
    }).select().single()
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
        fields: { gasto_original: original, moeda_gasto: moeda, cotacao, acrescimo, gasto: toReais(original) },
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

  return {
    pastas, ofertas, criativos, metricas, vendasFora, loading,
    saveVendaFora, updateVendaFora, deleteVendaFora, convertGastoDias,
    addPasta, updatePasta, deletePasta,
    addOferta, updateOferta, deleteOferta,
    addCriativo, updateCriativo, deleteCriativo,
    saveMetrica, updateMetrica, deleteMetrica,
    reload: loadAll,
  }
}
