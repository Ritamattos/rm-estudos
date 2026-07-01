import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useAtividadesStore(user) {
  const [testOffers, setTestOffers] = useState([])
  const [testArchive, setTestArchive] = useState([])
  const [dailyActivities, setDailyActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadAll()
  }, [user])

  async function loadAll() {
    setLoading(true)
    const [{ data: offers }, { data: archive }, { data: activities }] = await Promise.all([
      supabase.from('rm_test_offers').select('*').eq('user_id', user.id).order('sort_order'),
      supabase.from('rm_test_offers_archive').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
      supabase.from('rm_daily_activities').select('*').eq('user_id', user.id).order('activity_date'),
    ])
    setTestOffers(offers || [])
    setTestArchive(archive || [])
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

  // ── Test result archive (Aprovados / Reprovados subcategories) ─────────────
  //
  // Independent, permanent records: created/updated whenever a Kanban card
  // enters "aprovado" or "reprovado", but never touched by deleting or
  // moving the original card back out of those columns.

  const archiveCardResult = useCallback(async (card, resultStatus) => {
    const existing = testArchive.find(a => a.source_card_id === card.id)
    if (existing) {
      const payload = {
        title: card.title,
        description: card.description || '',
        result_status: resultStatus,
        updated_at: new Date().toISOString(),
      }
      await supabase.from('rm_test_offers_archive').update(payload).eq('id', existing.id)
      setTestArchive(prev => prev.map(a => a.id === existing.id ? { ...a, ...payload } : a))
    } else {
      const { data } = await supabase.from('rm_test_offers_archive').insert({
        user_id: user.id,
        source_card_id: card.id,
        title: card.title,
        description: card.description || '',
        result_status: resultStatus,
      }).select().single()
      if (data) setTestArchive(prev => [data, ...prev])
    }
  }, [user, testArchive])

  const updateArchive = useCallback(async (id, fields) => {
    const payload = { ...fields, updated_at: new Date().toISOString() }
    await supabase.from('rm_test_offers_archive').update(payload).eq('id', id)
    setTestArchive(prev => prev.map(a => a.id === id ? { ...a, ...payload } : a))
  }, [])

  const deleteArchive = useCallback(async (id) => {
    await supabase.from('rm_test_offers_archive').delete().eq('id', id)
    setTestArchive(prev => prev.filter(a => a.id !== id))
  }, [])

  // Moves a card to `status` at position `index` within that column, and
  // reindexes both the destination and (if different) source columns so
  // sort_order stays contiguous per status. Entering "aprovado"/"reprovado"
  // also creates or updates the archived copy.
  const moveTestOffer = useCallback(async (id, status, index) => {
    let movedCard = null

    setTestOffers(prev => {
      const moving = prev.find(o => o.id === id)
      if (!moving) return prev
      movedCard = { ...moving, status }
      const rest = prev.filter(o => o.id !== id)
      const destCards = rest.filter(o => o.status === status).sort((a, b) => a.sort_order - b.sort_order)
      destCards.splice(index, 0, movedCard)
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

    if (movedCard && (status === 'aprovado' || status === 'reprovado')) {
      await archiveCardResult(movedCard, status)
    }
  }, [archiveCardResult])

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
    testOffers, testArchive, dailyActivities, loading,
    addTestOffer, updateTestOffer, deleteTestOffer, moveTestOffer,
    updateArchive, deleteArchive,
    addActivity, updateActivity, deleteActivity,
    reload: loadAll,
  }
}
