import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useMediaStore(user) {
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadMedia()
  }, [user])

  async function loadMedia() {
    setLoading(true)
    const { data } = await supabase
      .from('rm_media')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order')
    setMedia(data || [])
    setLoading(false)
  }

  const addMedia = useCallback(async (item) => {
    await supabase.from('rm_media').insert({
      user_id: user.id,
      sort_order: media.length,
      ...item,
    })
    const { data: refreshed } = await supabase.from('rm_media').select('*').eq('user_id', user.id).order('sort_order')
    setMedia(refreshed || [])
  }, [user, media])

  const updateMedia = useCallback(async (id, fields) => {
    await supabase.from('rm_media').update(fields).eq('id', id)
    const { data: refreshed } = await supabase.from('rm_media').select('*').eq('user_id', user.id).order('sort_order')
    setMedia(refreshed || [])
  }, [user])

  const deleteMedia = useCallback(async (id) => {
    await supabase.from('rm_media').delete().eq('id', id)
    setMedia(prev => prev.filter(m => m.id !== id))
  }, [])

  const uploadCover = useCallback(async (file) => {
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('rm-files').upload(path, file)
    if (error) return null
    const { data } = supabase.storage.from('rm-files').getPublicUrl(path)
    return data.publicUrl
  }, [user])

  return { media, loading, addMedia, updateMedia, deleteMedia, uploadCover }
}
