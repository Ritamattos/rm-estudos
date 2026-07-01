import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useFinancialStore(user) {
  const [months, setMonths] = useState([])
  const [offers, setOffers] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState(null)

  const loadAll = useCallback(async () => {
    const [{ data: monthRows }, { data: offerRows }, { data: expenseRows }] = await Promise.all([
      supabase.from('rm_financial_data').select('*').eq('user_id', user.id).order('month_number'),
      supabase.from('rm_financial_offers').select('*').eq('user_id', user.id).order('month_number'),
      supabase.from('rm_financial_expenses').select('*').eq('user_id', user.id).order('month_number'),
    ])
    setMonths(monthRows || [])
    setOffers(offerRows || [])
    setExpenses(expenseRows || [])
  }, [user])

  const sync = useCallback(async () => {
    setSyncing(true)
    setSyncError(null)
    const { error } = await supabase.functions.invoke('sync-financial-data', { body: {} })
    if (error) setSyncError(error.message || 'Falha ao sincronizar com a planilha')
    await loadAll()
    setSyncing(false)
  }, [loadAll])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      setLoading(true)
      await loadAll()
      setLoading(false)
      await sync()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  return {
    months, offers, expenses, loading, syncing, syncError,
    reload: loadAll, sync,
  }
}
