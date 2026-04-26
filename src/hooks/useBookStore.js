import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useBookStore(user) {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadBooks()
  }, [user])

  async function loadBooks() {
    setLoading(true)
    const { data, error } = await supabase
      .from('rm_books')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order')
    if (error) console.error('[loadBooks] error:', error)
    setBooks(data || [])
    setLoading(false)
  }

  const addBook = useCallback(async (book) => {
    const { error: insertErr } = await supabase.from('rm_books').insert({
      user_id: user.id,
      sort_order: books.length,
      ...book,
    })
    if (insertErr) { console.error('[addBook] insert error:', insertErr); return }
    const { data: refreshed, error: loadErr } = await supabase.from('rm_books').select('*').eq('user_id', user.id).order('sort_order')
    if (loadErr) console.error('[addBook] load error:', loadErr)
    setBooks(refreshed || [])
  }, [user, books])

  const updateBook = useCallback(async (id, fields) => {
    const { error: updateErr } = await supabase.from('rm_books').update(fields).eq('id', id)
    if (updateErr) { console.error('[updateBook] update error:', updateErr); return }
    const { data: refreshed, error: loadErr } = await supabase.from('rm_books').select('*').eq('user_id', user.id).order('sort_order')
    if (loadErr) console.error('[updateBook] load error:', loadErr)
    setBooks(refreshed || [])
  }, [user])

  const deleteBook = useCallback(async (id) => {
    const { error } = await supabase.from('rm_books').delete().eq('id', id)
    if (error) console.error('[deleteBook] error:', error)
    setBooks(prev => prev.filter(b => b.id !== id))
  }, [])

  const uploadCover = useCallback(async (file) => {
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('rm-files')
      .upload(path, file, { contentType: file.type, upsert: true })
    if (error) { console.error('[uploadCover books] storage error:', error); return null }
    const { data } = supabase.storage.from('rm-files').getPublicUrl(path)
    return data.publicUrl
  }, [user])

  return { books, loading, addBook, updateBook, deleteBook, uploadCover }
}
