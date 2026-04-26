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
    const { data, error } = await supabase
      .from('rm_media')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order')
    if (error) console.error('[loadMedia] error:', error)
    setMedia(data || [])
    setLoading(false)
  }

  const addMedia = useCallback(async (item) => {
    const { error: insertErr } = await supabase.from('rm_media').insert({
      user_id: user.id,
      sort_order: media.length,
      ...item,
    })
    if (insertErr) { console.error('[addMedia] insert error:', insertErr); return }
    const { data: refreshed, error: loadErr } = await supabase.from('rm_media').select('*').eq('user_id', user.id).order('sort_order')
    if (loadErr) console.error('[addMedia] load error:', loadErr)
    setMedia(refreshed || [])
  }, [user, media])

  const updateMedia = useCallback(async (id, fields) => {
    const { error: updateErr } = await supabase.from('rm_media').update(fields).eq('id', id)
    if (updateErr) { console.error('[updateMedia] update error:', updateErr); return }
    const { data: refreshed, error: loadErr } = await supabase.from('rm_media').select('*').eq('user_id', user.id).order('sort_order')
    if (loadErr) console.error('[updateMedia] load error:', loadErr)
    setMedia(refreshed || [])
  }, [user])

  const deleteMedia = useCallback(async (id) => {
    const { error } = await supabase.from('rm_media').delete().eq('id', id)
    if (error) console.error('[deleteMedia] error:', error)
    setMedia(prev => prev.filter(m => m.id !== id))
  }, [])

  const uploadCover = useCallback(async (file) => {
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('rm-files')
      .upload(path, file, { contentType: file.type, upsert: true })
    if (error) { console.error('[uploadCover media] storage error:', error); return null }
    const { data } = supabase.storage.from('rm-files').getPublicUrl(path)
    return data.publicUrl
  }, [user])

  return { media, loading, addMedia, updateMedia, deleteMedia, uploadCover }
}
