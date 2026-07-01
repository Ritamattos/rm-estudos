import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useAtividadesStore(user) {
  const [testOffers, setTestOffers] = useState([])
  const [dailyActivities, setDailyActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadAll()
  }, [user])

  async function loadAll() {
    setLoading(true)
    const [{ data: offers }, { data: activities }] = await Promise.all([
      supabase.from('rm_test_offers').select('*').eq('user_id', user.id).order('sort_order'),
      supabase.from('rm_daily_activities').select('*').eq('user_id', user.id).order('activity_date'),
    ])
    setTestOffers(offers || [])
    setDailyActivities(activities || [])
    setLoading(false)
  }

  // ── Test offers (Trello board) ──────────────────────────────────────────────

  const addTestOffer = useCallback(async (title, status = 'para_testar') => {
    const colCards = testOffers.filter(o => o.status === status)
    const { data } = await supabase.from('rm_test_offers').insert({
      user_id: user.id, title, status, sort_order: colCards.length,
    }).select().single()
    if (data) setTestOffers(prev => [...prev, data])
    return data
  }, [user, testOffers])

  const updateTestOffer = useCallback(async (id, fields) => {
    const payload = { ...fields, updated_at: new Date().toISOString() }
    await supabase.from('rm_test_offers').update(payload).eq('id', id)
    setTestOffers(prev => prev.map(o => o.id === id ? { ...o, ...payload } : o))
  }, [])

  const deleteTestOffer = useCallback(async (id) => {
    await supabase.from('rm_test_offers').delete().eq('id', id)
    setTestOffers(prev => prev.filter(o => o.id !== id))
  }, [])

  // Moves a card to `status` at position `index` within that column, and
  // reindexes both the destination and (if different) source columns so
  // sort_order stays contiguous per status.
  const moveTestOffer = useCallback(async (id, status, index) => {
    setTestOffers(prev => {
      const moving = prev.find(o => o.id === id)
      if (!moving) return prev
      const rest = prev.filter(o => o.id !== id)
      const destCards = rest.filter(o => o.status === status).sort((a, b) => a.sort_order - b.sort_order)
      destCards.splice(index, 0, { ...moving, status })
      const otherCards = rest.filter(o => o.status !== status)
      const updated = [
        ...otherCards,
        ...destCards.map((o, i) => ({ ...o, sort_order: i })),
      ]

      const changes = updated.filter(o => {
        const before = prev.find(p => p.id === o.id)
        return !before || before.status !== o.status || before.sort_order !== o.sort_order
      })
      Promise.all(changes.map(o =>
        supabase.from('rm_test_offers').update({ status: o.status, sort_order: o.sort_order }).eq('id', o.id)
      ))

      return updated
    })
  }, [])

  // ── Daily activities (Diário) ───────────────────────────────────────────────

  const addActivity = useCallback(async (title, activityDate) => {
    const { data } = await supabase.from('rm_daily_activities').insert({
      user_id: user.id, title, activity_date: activityDate, status: 'em_progresso',
    }).select().single()
    if (data) setDailyActivities(prev => [...prev, data])
    return data
  }, [user])

  const updateActivity = useCallback(async (id, fields) => {
    const payload = { ...fields, updated_at: new Date().toISOString() }
    await supabase.from('rm_daily_activities').update(payload).eq('id', id)
    setDailyActivities(prev => prev.map(a => a.id === id ? { ...a, ...payload } : a))
  }, [])

  const deleteActivity = useCallback(async (id) => {
    await supabase.from('rm_daily_activities').delete().eq('id', id)
    setDailyActivities(prev => prev.filter(a => a.id !== id))
  }, [])

  return {
    testOffers, dailyActivities, loading,
    addTestOffer, updateTestOffer, deleteTestOffer, moveTestOffer,
    addActivity, updateActivity, deleteActivity,
    reload: loadAll,
  }
}
