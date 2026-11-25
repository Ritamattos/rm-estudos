// Web Worker of the Cortador de silêncio: joins the kept parts, changes
// the speed (WSOLA) and builds the WAV off the main thread, so long audio
// doesn't freeze the screen. Keeps the last result to reuse between
// "Ouvir resultado" and "Baixar WAV".
import { processar, wav } from './cortadorSilencio'

let audio = null // { channels, sr }
let cache = null // { key, X }

function resultado(keeps, speed, pitch) {
  const key = `${speed}|${pitch}|${keeps.length}|${keeps.flat().join(',')}`
  if (!cache || cache.key !== key) cache = { key, X: processar(audio.channels, audio.sr, keeps, speed, pitch) }
  return cache.X
}

self.onmessage = e => {
  const msg = e.data
  try {
    if (msg.type === 'carregar') {
      audio = { channels: msg.channels, sr: msg.sr }
      cache = null
      return
    }
    if (!audio) throw new Error('sem áudio')
    const X = resultado(msg.keeps, msg.speed, msg.pitch)
    if (msg.type === 'ouvir') {
      // Copies (not transferred): the cache keeps its own buffers.
      self.postMessage({ id: msg.id, X: X.map(x => x.slice()) })
    } else if (msg.type === 'wav') {
      const buf = wav(X, audio.sr, msg.mono)
      self.postMessage({ id: msg.id, wav: buf }, [buf])
    }
  } catch (err) {
    self.postMessage({ id: msg.id, erro: String(err?.message || err) })
  }
}
