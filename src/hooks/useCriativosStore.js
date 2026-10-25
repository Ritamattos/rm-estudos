import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useCriativosStore(user) {
  const [pastas, setPastas] = useState([])
  const [ofertas, setOfertas] = useState([])
  const [criativos, setCriativos] = useState([])
  const [metricas, setMetricas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadAll()
  }, [user])

  async function loadAll() {
    setLoading(true)
    const [{ data: ps }, { data: os }, { data: cs }, { data: ms }] = await Promise.all([
      supabase.from('criativos_pastas').select('*').eq('user_id', user.id).order('ordem').order('created_at'),
      supabase.from('criativos_ofertas').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('criativos').select('*').eq('user_id', user.id).order('numero'),
      supabase.from('criativos_metricas').select('*').eq('user_id', user.id).order('data'),
    ])
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
      ...fields, oferta_id: ofertaId, numero, nome: `AD ${numero}`, user_id: user.id,
    }).select().single()
    if (data) setCriativos(prev => [...prev, data])
    return data
  }, [user, criativos])

  const updateCriativo = useCallback(async (id, fields) => {
    await supabase.from('criativos').update(fields).eq('id', id)
    setCriativos(prev => prev.map(c => c.id === id ? { ...c, ...fields } : c))
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

  return {
    pastas, ofertas, criativos, metricas, loading,
    addPasta, updatePasta, deletePasta,
    addOferta, updateOferta, deleteOferta,
    addCriativo, updateCriativo, deleteCriativo,
    saveMetrica, updateMetrica, deleteMetrica,
    reload: loadAll,
  }
}
