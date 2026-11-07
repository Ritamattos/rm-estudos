import { useState, useEffect, useRef } from 'react'
import { Camera, ImagePlus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import styles from './ProfileSwitcher.module.css'

// Profile photos live in the existing 'rm-files' bucket and their URLs in
// the auth user's metadata (profile_photos: { empresa, pessoal }), so there
// is no table or migration involved and the photo follows the account
// across devices.
const BUCKET = 'rm-files'
const PHOTO_SIZE = 256

// Center-crops to a square and downsizes, so a 10 MB phone photo becomes a
// ~20 KB JPEG before it's uploaded.
function toSquareJpeg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight)
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = PHOTO_SIZE
      canvas.getContext('2d').drawImage(
        img,
        (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side,
        0, 0, PHOTO_SIZE, PHOTO_SIZE,
      )
      URL.revokeObjectURL(url)
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.85)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida')) }
    img.src = url
  })
}

function storagePathFromUrl(publicUrl) {
  const marker = `/object/public/${BUCKET}/`
  const i = publicUrl?.indexOf(marker) ?? -1
  return i >= 0 ? decodeURIComponent(publicUrl.slice(i + marker.length)) : null
}

export default function ProfileSwitcher({ user, profile, profiles, onSwitch }) {
  const [photos, setPhotos] = useState(() => user?.user_metadata?.profile_photos || {})
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const rootRef = useRef(null)

  useEffect(() => { setPhotos(user?.user_metadata?.profile_photos || {}) }, [user])

  useEffect(() => {
    if (!menuOpen) return
    const close = e => { if (!rootRef.current?.contains(e.target)) setMenuOpen(false) }
    const onKey = e => { if (e.key === 'Escape') setMenuOpen(false) }
    const dismiss = () => setMenuOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', dismiss)
    window.addEventListener('scroll', dismiss, true)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('scroll', dismiss, true)
    }
  }, [menuOpen])

  const current = profiles[profile]
  const next = profiles[current.next]
  const photo = photos[profile]

  async function savePhotoUrl(url) {
    const nextPhotos = { ...photos, [profile]: url }
    const { data, error } = await supabase.auth.updateUser({ data: { profile_photos: nextPhotos } })
    if (error) throw error
    setPhotos(data.user?.user_metadata?.profile_photos || nextPhotos)
    // Best-effort cleanup of the replaced file; a leftover file is harmless.
    const oldPath = storagePathFromUrl(photo)
    if (oldPath) supabase.storage.from(BUCKET).remove([oldPath]).catch(() => {})
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setMenuOpen(false)
    setBusy(true)
    try {
      const blob = await toSquareJpeg(file)
      const path = `${user.id}/profile-${profile}-${Date.now()}.jpg`
      const { error } = await supabase.storage.from(BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
      await savePhotoUrl(data.publicUrl)
    } catch (err) {
      console.error('[profile photo] upload error:', err)
      alert('Não foi possível salvar a foto. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  async function removePhoto() {
    setMenuOpen(false)
    setBusy(true)
    try { await savePhotoUrl(null) }
    catch (err) {
      console.error('[profile photo] remove error:', err)
      alert('Não foi possível remover a foto.')
    } finally { setBusy(false) }
  }

  function onEditClick() {
    // Without a photo there's nothing to choose between: go straight to
    // the file picker.
    if (!photo) { fileRef.current?.click(); return }
    if (menuOpen) { setMenuOpen(false); return }
    // Fixed positioning: the tab bar scrolls horizontally on phones, which
    // would clip an absolutely positioned menu.
    const r = rootRef.current.getBoundingClientRect()
    setMenuPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) })
    setMenuOpen(true)
  }

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${profile === 'pessoal' ? styles.pessoal : styles.empresa}`}
    >
      <button
        type="button"
        className={styles.switchBtn}
        onClick={onSwitch}
        title={`Perfil ${current.label} · trocar para ${next.label}`}
        aria-label={`Perfil ativo: ${current.label}. Trocar para ${next.label}`}
      >
        <span className={styles.label}>{current.label}</span>
        <span className={`${styles.avatar} ${busy ? styles.avatarBusy : ''}`}>
          {photo ? <img src={photo} alt="" className={styles.photo} draggable={false} /> : current.icon}
        </span>
      </button>

      <button
        type="button"
        className={styles.editBtn}
        onClick={onEditClick}
        disabled={busy}
        title={`Foto do perfil ${current.label}`}
        aria-label={`Alterar foto do perfil ${current.label}`}
        aria-haspopup={photo ? 'menu' : undefined}
        aria-expanded={photo ? menuOpen : undefined}
      >
        <Camera size={11} strokeWidth={2.5} />
      </button>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />

      {menuOpen && (
        <div className={styles.menu} role="menu" style={menuPos}>
          <button type="button" role="menuitem" className={styles.menuItem} onClick={() => fileRef.current?.click()}>
            <ImagePlus size={15} /> Trocar foto
          </button>
          <button type="button" role="menuitem" className={`${styles.menuItem} ${styles.menuDanger}`} onClick={removePhoto}>
            <Trash2 size={15} /> Remover foto
          </button>
        </div>
      )}
    </div>
  )
}
