import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_TAGS = [
  { name: 'Importante', color: '#ef4444' },
  { name: 'Referência', color: '#3b82f6' },
  { name: 'Em estudo',  color: '#f59e0b' },
  { name: 'Concluído',  color: '#4ade80' },
  { name: 'Favorito',   color: '#a78bfa' },
]

export function useStore(user) {
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [items, setItems] = useState([])
  const [kanbanCards, setKanbanCards] = useState([])
  const [tags, setTags] = useState([])
  const [itemTags, setItemTags] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadAll()
  }, [user])

  async function loadAll() {
    setLoading(true)
    const [
      { data: cats },
      { data: subs },
      { data: its },
      { data: kards },
      { data: tgs },
      { data: itgs },
    ] = await Promise.all([
      supabase.from('rm_categories').select('*').eq('user_id', user.id).order('sort_order'),
      supabase.from('rm_subcategories').select('*').eq('user_id', user.id).order('sort_order'),
      supabase.from('rm_items').select('*').eq('user_id', user.id).order('sort_order'),
      supabase.from('rm_kanban_cards').select('*').eq('user_id', user.id).order('sort_order'),
      supabase.from('rm_tags').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('rm_item_tags').select('*'),
    ])
    setCategories(cats || [])
    setSubcategories(subs || [])
    setItems(its || [])
    setKanbanCards(kards || [])
    setTags(tgs || [])
    setItemTags(itgs || [])
    setLoading(false)
  }

  // ── Categories ──────────────────────────────────────────────────────────────

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
    setSubcategories(prev => prev.filter(s => s.cat_id !== id))
    setItems(prev => prev.filter(i => i.cat_id !== id))
    setKanbanCards(prev => prev.filter(k => k.category_id !== id))
  }, [])

  // ── Subcategories ────────────────────────────────────────────────────────────

  const addSubcategory = useCallback(async (name, icon, type, catId) => {
    const catSubs = subcategories.filter(s => s.cat_id === catId)
    const { data } = await supabase.from('rm_subcategories').insert({
      user_id: user.id, cat_id: catId, name, icon: icon || '📁', type: type || 'notes', sort_order: catSubs.length
    }).select().single()
    if (data) setSubcategories(prev => [...prev, data])
  }, [user, subcategories])

  const updateSubcategory = useCallback(async (id, fields) => {
    await supabase.from('rm_subcategories').update(fields).eq('id', id)
    setSubcategories(prev => prev.map(s => s.id === id ? { ...s, ...fields } : s))
  }, [])

  const deleteSubcategory = useCallback(async (id) => {
    await supabase.from('rm_subcategories').delete().eq('id', id)
    setSubcategories(prev => prev.filter(s => s.id !== id))
    setItems(prev => prev.map(i => i.sub_id === id ? { ...i, sub_id: null } : i))
  }, [])

  // ── Items ────────────────────────────────────────────────────────────────────

  const addItem = useCallback(async (item) => {
    const { data } = await supabase.from('rm_items').insert({
      user_id: user.id, sort_order: items.length, ...item
    }).select().single()
    if (data) setItems(prev => [...prev, data])
    return data
  }, [user, items])

  const updateItem = useCallback(async (id, fields) => {
    await supabase.from('rm_items').update(fields).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...fields } : i))
  }, [])

  const deleteItem = useCallback(async (id) => {
    await supabase.from('rm_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    setItemTags(prev => prev.filter(it => it.item_id !== id))
  }, [])

  // ── Kanban Cards ─────────────────────────────────────────────────────────────

  const addKanbanCard = useCallback(async (categoryId, title, status) => {
    const colCards = kanbanCards.filter(c => c.category_id === categoryId && c.status === status)
    const { data } = await supabase.from('rm_kanban_cards').insert({
      user_id: user.id,
      category_id: categoryId,
      title,
      status: status || 'estudar',
      sort_order: colCards.length,
    }).select().single()
    if (data) setKanbanCards(prev => [...prev, data])
  }, [user, kanbanCards])

  const updateKanbanCard = useCallback(async (id, fields) => {
    await supabase.from('rm_kanban_cards').update(fields).eq('id', id)
    setKanbanCards(prev => prev.map(c => c.id === id ? { ...c, ...fields } : c))
  }, [])

  const deleteKanbanCard = useCallback(async (id) => {
    await supabase.from('rm_kanban_cards').delete().eq('id', id)
    setKanbanCards(prev => prev.filter(c => c.id !== id))
  }, [])

  // ── Tags ─────────────────────────────────────────────────────────────────────

  const addTag = useCallback(async (name, color, workspace) => {
    const { data } = await supabase.from('rm_tags').insert({
      user_id: user.id, name, color: color || '#6366f1', workspace,
    }).select().single()
    if (data) setTags(prev => [...prev, data])
    return data
  }, [user])

  const deleteTag = useCallback(async (id) => {
    await supabase.from('rm_tags').delete().eq('id', id)
    setTags(prev => prev.filter(t => t.id !== id))
    setItemTags(prev => prev.filter(it => it.tag_id !== id))
  }, [])

  const addItemTag = useCallback(async (itemId, tagId) => {
    const { data } = await supabase.from('rm_item_tags')
      .insert({ item_id: itemId, tag_id: tagId })
      .select().single()
    if (data) setItemTags(prev => [...prev, data])
  }, [])

  const removeItemTag = useCallback(async (itemId, tagId) => {
    await supabase.from('rm_item_tags').delete().eq('item_id', itemId).eq('tag_id', tagId)
    setItemTags(prev => prev.filter(it => !(it.item_id === itemId && it.tag_id === tagId)))
  }, [])

  const initDefaultTags = useCallback(async (workspace) => {
    const { data: existing } = await supabase.from('rm_tags')
      .select('id').eq('user_id', user.id).eq('workspace', workspace).limit(1)
    if (existing && existing.length > 0) return
    const inserts = DEFAULT_TAGS.map(t => ({ user_id: user.id, workspace, name: t.name, color: t.color }))
    const { data } = await supabase.from('rm_tags').insert(inserts).select()
    if (data) setTags(prev => [...prev, ...data])
  }, [user])

  // ── File upload ──────────────────────────────────────────────────────────────

  const uploadFile = useCallback(async (file, bucket = 'rm-files') => {
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from(bucket).upload(path, file)
    if (error) return null
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }, [user])

  return {
    categories, subcategories, items, kanbanCards, tags, itemTags, loading,
    addCategory, updateCategory, deleteCategory,
    addSubcategory, updateSubcategory, deleteSubcategory,
    addItem, updateItem, deleteItem,
    addKanbanCard, updateKanbanCard, deleteKanbanCard,
    addTag, deleteTag,
    addItemTag, removeItemTag,
    initDefaultTags,
    uploadFile, reload: loadAll,
  }
}
