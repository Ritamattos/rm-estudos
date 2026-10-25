import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export const DEFAULT_CONFIG = {
  ticket_medio: null,
  cpa_maximo: null,
  ctr_minimo: 1,
  freq_max_pre_escala: 2,
  freq_max_escala: 3,
}

export function useCriativosStore(user) {
  const [criativos, setCriativos] = useState([])
  const [metricas, setMetricas] = useState([])
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadAll()
  }, [user])

  async function loadAll() {
    setLoading(true)
    const [{ data: cs }, { data: ms }, { data: cfg }] = await Promise.all([
      supabase.from('criativos').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('criativos_metricas').select('*').eq('user_id', user.id).order('data'),
      supabase.from('criativos_config').select('*').eq('user_id', user.id).maybeSingle(),
    ])
    setCriativos(cs || [])
    setMetricas(ms || [])
    setConfig(cfg ? { ...DEFAULT_CONFIG, ...cfg } : DEFAULT_CONFIG)
    setLoading(false)
  }

  // ── Criativos ───────────────────────────────────────────────────────────────

  const addCriativo = useCallback(async (fields) => {
    const { data } = await supabase.from('criativos').insert({ ...fields, user_id: user.id }).select().single()
    if (data) setCriativos(prev => [data, ...prev])
    return data
  }, [user])

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

  // ── Config ──────────────────────────────────────────────────────────────────

  const saveConfig = useCallback(async (fields) => {
    const payload = { ...fields, user_id: user.id, updated_at: new Date().toISOString() }
    const { data } = await supabase.from('criativos_config').upsert(payload, { onConflict: 'user_id' }).select().single()
    setConfig({ ...DEFAULT_CONFIG, ...(data || payload) })
  }, [user])

  return {
    criativos, metricas, config, loading,
    addCriativo, updateCriativo, deleteCriativo,
    saveMetrica, updateMetrica, deleteMetrica,
    saveConfig,
    reload: loadAll,
  }
}
