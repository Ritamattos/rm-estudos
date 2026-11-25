// Talks to the Cortador de silêncio worker. If the browser can't start the
// worker, the same functions run on the main thread (slower on long audio,
// but it still works).
import { processar, wav } from './cortadorSilencio'

export function criarProcessador() {
  let worker = null
  try {
    worker = new Worker(new URL('./cortadorSilencio.worker.js', import.meta.url), { type: 'module' })
  } catch {
    worker = null
  }
  let seq = 0
  const pendentes = new Map()
  let local = null // fallback: { channels, sr }

  if (worker) {
    worker.onmessage = e => {
      const p = pendentes.get(e.data.id)
      if (!p) return
      pendentes.delete(e.data.id)
      if (e.data.erro) p.reject(new Error(e.data.erro))
      else p.resolve(e.data)
    }
    worker.onerror = () => {
      // Worker failed to load: answer what's pending on the main thread.
      worker = null
      for (const [, p] of pendentes) p.retry()
      pendentes.clear()
    }
  }

  function noMain(msg) {
    const X = processar(local.channels, local.sr, msg.keeps, msg.speed, msg.pitch)
    return msg.type === 'ouvir' ? { X } : { wav: wav(X, local.sr, msg.mono) }
  }

  function pedir(msg) {
    if (!worker) {
      // Let the "Processando…" message paint before the heavy work.
      return new Promise(r => setTimeout(r, 30)).then(() => noMain(msg))
    }
    const id = ++seq
    return new Promise((resolve, reject) => {
      pendentes.set(id, { resolve, reject, retry: () => setTimeout(() => { try { resolve(noMain(msg)) } catch (err) { reject(err) } }, 30) })
      worker.postMessage({ ...msg, id })
    })
  }

  return {
    // channels: Float32Array per channel (copied to the worker).
    carregar(channels, sr) {
      local = { channels, sr }
      worker?.postMessage({ type: 'carregar', channels, sr })
    },
    ouvir: (keeps, speed, pitch) => pedir({ type: 'ouvir', keeps, speed, pitch }).then(r => r.X),
    wav: (keeps, speed, pitch, mono) => pedir({ type: 'wav', keeps, speed, pitch, mono }).then(r => r.wav),
    encerrar() {
      worker?.terminate()
      worker = null
      pendentes.clear()
    },
  }
}
