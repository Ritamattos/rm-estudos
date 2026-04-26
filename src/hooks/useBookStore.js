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
    const { data } = await supabase
      .from('rm_books')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order')
    setBooks(data || [])
    setLoading(false)
  }

  const addBook = useCallback(async (book) => {
    const { data } = await supabase.from('rm_books').insert({
      user_id: user.id,
      sort_order: books.length,
      ...book,
    }).select().single()
    if (data) setBooks(prev => [data, ...prev])
  }, [user, books])

  const updateBook = useCallback(async (id, fields) => {
    await supabase.from('rm_books').update(fields).eq('id', id)
    setBooks(prev => prev.map(b => b.id === id ? { ...b, ...fields } : b))
  }, [])

  const deleteBook = useCallback(async (id) => {
    await supabase.from('rm_books').delete().eq('id', id)
    setBooks(prev => prev.filter(b => b.id !== id))
  }, [])

  const uploadCover = useCallback(async (file) => {
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('rm-files').upload(path, file)
    if (error) return null
    const { data } = supabase.storage.from('rm-files').getPublicUrl(path)
    return data.publicUrl
  }, [user])

  return { books, loading, addBook, updateBook, deleteBook, uploadCover }
}
