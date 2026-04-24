import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useStore(user) {
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const uid = () => Math.random().toString(36).slice(2, 9)

  useEffect(() => {
    if (!user) return
    loadAll()
  }, [user])

  async function loadAll() {
    setLoading(true)
    const [{ data: cats }, { data: its }] = await Promise.all([
      supabase.from('rm_categories').select('*').eq('user_id', user.id).order('sort_order'),
      supabase.from('rm_items').select('*').eq('user_id', user.id).order('sort_order'),
    ])
    setCategories(cats || [])
    setItems(its || [])
    setLoading(false)
  }

  const addCategory = useCallback(async (name, icon, workspace) => {
    const { data } = await supabase.from('rm_categories').insert({
      user_id: user.id, name, icon: icon || '📁', workspace, sort_order: categories.length
    }).select().single()
    if (data) setCategories(prev => [...prev, data])
  }, [user, categories])

  const updateCategory = useCallback(async (id, fields) => {
    await supabase.from('rm_categories').update(fields).eq('id', id)
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...fields } : c))
  }, [])

  const deleteCategory = useCallback(async (id) => {
    await supabase.from('rm_categories').delete().eq('id', id)
    setCategories(prev => prev.filter(c => c.id !== id))
    setItems(prev => prev.filter(i => i.cat_id !== id))
  }, [])

  const addItem = useCallback(async (item) => {
    const { data } = await supabase.from('rm_items').insert({
      user_id: user.id, sort_order: items.length, ...item
    }).select().single()
    if (data) setItems(prev => [...prev, data])
  }, [user, items])

  const updateItem = useCallback(async (id, fields) => {
    await supabase.from('rm_items').update(fields).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...fields } : i))
  }, [])

  const deleteItem = useCallback(async (id) => {
    await supabase.from('rm_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }, [])

  const uploadFile = useCallback(async (file, bucket = 'rm-files') => {
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from(bucket).upload(path, file)
    if (error) return null
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }, [user])

  return { categories, items, loading, addCategory, updateCategory, deleteCategory, addItem, updateItem, deleteItem, uploadFile, reload: loadAll }
}
