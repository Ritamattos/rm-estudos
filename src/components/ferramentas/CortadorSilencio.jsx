// Ferramentas › Cortador de silêncio. Ported from the reference page
// (cortador-silencio-referencia.html): the algorithms live in
// lib/cortadorSilencio.js and the heavy part (cut + speed + WAV) runs in a
// Web Worker. Everything stays in the browser: nothing is uploaded.
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Upload, Play, Square, Download, Wand2, AudioLines } from 'lucide-react'
import {
  PREDEFINICOES, CONFIG_PADRAO, analisar, detectar, limiteAuto, segundosFinais,
} from '../../lib/cortadorSilencio'
import { criarProcessador } from '../../lib/cortadorSilencioProcessador'
import styles from './CortadorSilencio.module.css'

const STORAGE_KEY = 'rm-cortador-silencio'
const VELOCIDADES = [0.8, 1, 1.15, 1.25, 1.5, 2]
const PRESET_LABEL = { natural: 'Natural', vsl: 'Narração / VSL', agressivo: 'Agressivo' }

const num = (x, d = 1) => x.toFixed(d).replace('.', ',')
const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')},${Math.floor(t * 10 % 10)}`

function lerConfig() {
  try {
    const salvo = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    const c = { ...CONFIG_PADRAO }
    for (const k of Object.keys(CONFIG_PADRAO)) if (typeof salvo[k] === typeof CONFIG_PADRAO[k]) c[k] = salvo[k]
    return c
  } catch {
    return { ...CONFIG_PADRAO }
  }
}

const cssVar = (nome, fallback) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim() || fallback

export default function CortadorSilencio() {
  const [S, setS] = useState(lerConfig)
  const [arquivo, setArquivo] = useState(null) // { nome, duracao }
  const [an, setAn] = useState(null) // analysis of the loaded audio
  const [status, setStatus] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [tocando, setTocando] = useState(null) // 'orig' | 'res' | null
  const [arrastando, setArrastando] = useState(false)
  const [temaTick, setTemaTick] = useState(0)

  const bufRef = useRef(null) // AudioBuffer
  const ctxRef = useRef(null)
  const procRef = useRef(null)
  const playRef = useRef(null) // { node, which, t0, keeps, speed }
  const canvasRef = useRef(null)
  const figRef = useRef(null)
  const fileRef = useRef(null)
  const patRef = useRef(null) // { cor, pattern }

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S)) } catch { /* storage unavailable */ }
  }, [S])

  const det = useMemo(() => (an ? detectar(an, S) : null), [an, S.thr, S.min, S.pad]) // eslint-disable-line react-hooks/exhaustive-deps

  function ac() {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume().catch(() => {})
    return ctxRef.current
  }
  const proc = () => (procRef.current ||= criarProcessador())

  // ── Desenho da onda ───────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const cv = canvasRef.current
    if (!cv) return
    const W = cv.clientWidth, H = cv.clientHeight, r = window.devicePixelRatio || 1
    if (cv.width !== Math.round(W * r) || cv.height !== Math.round(H * r)) { cv.width = Math.round(W * r); cv.height = Math.round(H * r) }
    const g = cv.getContext('2d')
    g.setTransform(r, 0, 0, r, 0, 0)
    g.clearRect(0, 0, W, H)
    if (!an || !det) return
    const claro = document.documentElement.dataset.theme === 'light'
    const ink = cssVar('--text', '#f0eeff'), mute = cssVar('--text3', '#5a546e')
    const acc = claro ? cssVar('--accent-strong', '#7c3aed') : cssVar('--accent-light', '#a78bfa')
    const hatch = cssVar('--bg4', '#22222f')
    if (!patRef.current || patRef.current.cor !== hatch) {
      const p = document.createElement('canvas'); p.width = p.height = 8
      const q = p.getContext('2d'); q.strokeStyle = hatch; q.lineWidth = 2; q.beginPath()
      q.moveTo(-2, 10); q.lineTo(10, -2); q.moveTo(6, 10); q.lineTo(10, 6); q.moveTo(-2, 2); q.lineTo(2, -2); q.stroke()
      patRef.current = { cor: hatch, pattern: g.createPattern(p, 'repeat') }
    }
    const { cuts, keeps } = det
    const n = an.n, RH = 22, h = H - RH, mid = h / 2, X = s => s / n * W, B = an.mn.length
    g.fillStyle = patRef.current.pattern
    for (const [a, b] of cuts) g.fillRect(X(a), 0, Math.max(1, X(b) - X(a)), h)
    let ci = 0
    for (let px = 0; px < W; px++) {
      const b0 = Math.floor(px / W * B), b1 = Math.max(b0 + 1, Math.floor((px + 1) / W * B))
      let lo = 0, hi = 0
      for (let b = b0; b < b1 && b < B; b++) { if (an.mn[b] < lo) lo = an.mn[b]; if (an.mx[b] > hi) hi = an.mx[b] }
      const s = (px + 0.5) / W * n
      while (ci < cuts.length && cuts[ci][1] < s) ci++
      const cut = ci < cuts.length && cuts[ci][0] <= s
      g.fillStyle = cut ? mute : ink
      const y0 = mid - hi * mid * 0.95, y1 = mid - lo * mid * 0.95
      g.fillRect(px, y0, 1, Math.max(1, y1 - y0))
    }
    // Silence threshold (dashed).
    const amp = Math.pow(10, S.thr / 20) * mid * 0.95 * 1.41
    g.strokeStyle = acc; g.setLineDash([5, 4]); g.lineWidth = 1; g.beginPath()
    g.moveTo(0, mid - amp); g.lineTo(W, mid - amp); g.moveTo(0, mid + amp); g.lineTo(W, mid + amp); g.stroke(); g.setLineDash([])
    // Time ruler.
    g.fillStyle = mute; g.fillRect(0, h, W, 1)
    g.font = '11px Inter, system-ui, sans-serif'; g.textBaseline = 'top'
    const dur = n / an.sr, st = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600].find(x => x / dur * W >= 70) || 1200
    for (let t = 0; t <= dur; t += st) {
      const x = t / dur * W
      g.fillRect(x, h, 1, 5)
      if (x < W - 30) g.fillText(t < 60 ? `${num(t, st < 1 ? 1 : 0)}s` : fmt(t).slice(0, -2), x + 3, h + 6)
    }
    // Playback line.
    const pl = playRef.current
    if (pl && ctxRef.current) {
      const el = ctxRef.current.currentTime - pl.t0
      let s
      if (pl.which === 'orig') s = el * an.sr
      else {
        let rem = el * pl.speed * an.sr
        s = n
        for (const [a, b] of pl.keeps) { if (rem <= b - a) { s = a + rem; break } rem -= b - a }
      }
      g.fillStyle = acc
      g.fillRect(Math.min(W - 2, X(s)), 0, 2, h)
    }
  }, [an, det, S.thr, temaTick]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { draw() }, [draw])

  useEffect(() => {
    const ro = new ResizeObserver(() => draw())
    if (figRef.current) ro.observe(figRef.current)
    return () => ro.disconnect()
  }, [draw])

  // Theme or accent changed: redraw with the new colors.
  useEffect(() => {
    const mo = new MutationObserver(() => setTemaTick(t => t + 1))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent'] })
    return () => mo.disconnect()
  }, [])

  // Leaving the tool: stop the sound and free the worker / audio context.
  useEffect(() => () => {
    try { playRef.current?.node.stop() } catch { /* already stopped */ }
    playRef.current = null
    procRef.current?.encerrar()
    ctxRef.current?.close?.().catch(() => {})
  }, [])

  // ── Arquivo ───────────────────────────────────────────────────────────────
  async function carregar(f) {
    if (!f) return
    parar()
    setOcupado(true)
    setStatus(`Lendo ${f.name}…`)
    try {
      const buf = await ac().decodeAudioData(await f.arrayBuffer())
      await new Promise(r => setTimeout(r, 30))
      const channels = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c))
      const analise = analisar(channels, buf.sampleRate)
      bufRef.current = buf
      proc().carregar(channels, buf.sampleRate)
      setArquivo({ nome: f.name, duracao: buf.length / buf.sampleRate })
      setAn(analise)
      setStatus('')
    } catch {
      setStatus('Não consegui ler esse arquivo. Tente MP3, WAV, M4A, OGG ou MP4.')
    } finally {
      setOcupado(false)
    }
  }

  // ── Reprodução ────────────────────────────────────────────────────────────
  function parar() {
    const pl = playRef.current
    playRef.current = null
    if (pl) { try { pl.node.stop() } catch { /* already stopped */ } }
    setTocando(null)
    draw()
  }

  async function ouvir(which) {
    if (!an || ocupado) return
    const estava = playRef.current?.which
    parar()
    if (estava === which) return
    const c = ac()
    let buf = bufRef.current
    if (which === 'res') {
      if (!det.keeps.length) { setStatus('Nada ficou acima do limite. Baixe o limite do silêncio.'); return }
      setOcupado(true)
      setStatus('Processando…')
      try {
        const X = await proc().ouvir(det.keeps, S.speed, S.pitch)
        buf = c.createBuffer(X.length, X[0].length, an.sr)
        X.forEach((x, i) => buf.copyToChannel(x, i))
        setStatus('')
      } catch {
        setStatus('Não foi possível processar este áudio.')
        return
      } finally {
        setOcupado(false)
      }
    }
    const node = c.createBufferSource()
    node.buffer = buf
    node.connect(c.destination)
    node.start()
    playRef.current = { node, which, t0: c.currentTime, keeps: det.keeps, speed: S.speed }
    node.onended = () => { if (playRef.current?.node === node) parar() }
    setTocando(which)
    const loop = () => { if (playRef.current?.node === node) { draw(); requestAnimationFrame(loop) } }
    loop()
  }

  async function baixar() {
    if (!an || ocupado) return
    if (!det.keeps.length) { setStatus('Nada ficou acima do limite. Baixe o limite do silêncio.'); return }
    setOcupado(true)
    setStatus('Processando…')
    try {
      const w = await proc().wav(det.keeps, S.speed, S.pitch, S.mono)
      const base = `${arquivo.nome.replace(/\.[^.]+$/, '') || 'audio'}_cortado`
      const url = URL.createObjectURL(new Blob([w], { type: 'audio/wav' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${base}.wav`
      document.body.append(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      setStatus('Download iniciado.')
    } catch {
      setStatus('Não foi possível gerar o arquivo.')
    } finally {
      setOcupado(false)
    }
  }

  // ── Controles ─────────────────────────────────────────────────────────────
  const set = patch => setS(prev => ({ ...prev, ...patch }))
  const presetAtivo = Object.keys(PREDEFINICOES).find(p => {
    const v = PREDEFINICOES[p]
    return v.thr === S.thr && v.min === S.min && v.pad === S.pad
  })

  function auto() {
    if (!an) return
    const thr = limiteAuto(an)
    set({ thr })
    setStatus(`Limite ajustado para ${thr} dB.`)
  }

  const original = arquivo?.duracao ?? 0
  const final = det ? segundosFinais(det.keeps, an.sr, S.speed) : 0
  const diff = original - final

  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        <div className={styles.fileInfo}>
          {arquivo ? (
            <><span className={styles.fname}>{arquivo.nome}</span> <span className={styles.note}>· {fmt(arquivo.duracao)}</span></>
          ) : (
            <span className={styles.note}>Nenhum áudio carregado</span>
          )}
        </div>
        <button type="button" className={styles.btn} onClick={() => fileRef.current?.click()} disabled={ocupado}>
          <Upload size={15} /> {arquivo ? 'Trocar áudio' : 'Escolher áudio'}
        </button>
      </div>

      <div
        ref={figRef}
        className={`${styles.fig} ${arrastando ? styles.figDrag : ''} ${!an ? styles.figVazia : ''}`}
        role="button"
        tabIndex={0}
        aria-label={an ? 'Forma de onda. Clique ou solte outro arquivo para trocar o áudio.' : 'Solte seu áudio aqui ou clique para escolher'}
        onClick={() => !ocupado && fileRef.current?.click()}
        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !ocupado) { e.preventDefault(); fileRef.current?.click() } }}
        onDragOver={e => { e.preventDefault(); setArrastando(true) }}
        onDragLeave={() => setArrastando(false)}
        onDrop={e => { e.preventDefault(); setArrastando(false); carregar(e.dataTransfer.files[0]) }}
      >
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
        {!an && (
          <div className={styles.vazio}>
            <AudioLines size={34} />
            <strong>{ocupado ? 'Lendo o áudio…' : 'Solte seu áudio aqui'}</strong>
            <span>ou clique para escolher · MP3, WAV, M4A, OGG ou o áudio de um MP4</span>
          </div>
        )}
        {arrastando && <div className={styles.drop}>Solte o arquivo</div>}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="audio/*,video/*"
        hidden
        onChange={e => { carregar(e.target.files[0]); e.target.value = '' }}
      />
      {an && (
        <div className={styles.legend}>
          <span><i className={styles.k1} />fica</span>
          <span><i className={styles.k2} />sai (silêncio)</span>
          <span><i className={styles.k3} />limite de silêncio</span>
        </div>
      )}

      <section className={styles.grid}>
        <div className={styles.res}>
          <div>
            <div className={styles.big}>{an ? `${diff >= 0 ? '−' : '+'}${num(Math.abs(diff))} s` : '0,0 s'}</div>
            <div className={styles.bigLab}>
              {!an || diff >= 0
                ? `tempo economizado${an && original ? ` (${Math.round(diff / original * 100)}% mais curto)` : ''}`
                : 'a mais (áudio mais lento)'}
            </div>
          </div>
          <dl className={styles.dl}>
            <dt>Original</dt><dd>{an ? fmt(original) : '–'}</dd>
            <dt>Final</dt><dd>{an ? fmt(final) : '–'}</dd>
            <dt>Cortes</dt><dd>{det ? det.cuts.length : '–'}</dd>
            <dt>Velocidade</dt><dd>{num(S.speed, 2)}×{S.speed !== 1 ? (S.pitch ? ' · tom mantido' : ' · tom muda') : ''}</dd>
          </dl>
          <div className={styles.acts}>
            <button type="button" className={styles.btn} onClick={() => ouvir('orig')} disabled={!an || (ocupado && tocando !== 'orig')}>
              {tocando === 'orig' ? <><Square size={14} /> Parar</> : <><Play size={14} /> Ouvir original</>}
            </button>
            <button type="button" className={styles.btn} onClick={() => ouvir('res')} disabled={!an || (ocupado && tocando !== 'res')}>
              {tocando === 'res' ? <><Square size={14} /> Parar</> : <><Play size={14} /> Ouvir resultado</>}
            </button>
            <button type="button" className={styles.primaryBtn} onClick={baixar} disabled={!an || ocupado}>
              <Download size={15} /> Baixar WAV
            </button>
          </div>
          <div className={styles.status} aria-live="polite">{status}</div>
        </div>

        <div className={styles.ctl}>
          <div>
            <div className={styles.lab}>Predefinição</div>
            <div className={styles.chips}>
              {Object.keys(PREDEFINICOES).map(p => (
                <button key={p} type="button" aria-pressed={presetAtivo === p} onClick={() => set(PREDEFINICOES[p])}>{PRESET_LABEL[p]}</button>
              ))}
            </div>
          </div>

          <div className={styles.row}>
            <label htmlFor="cs-thr">Limite do silêncio <output>{S.thr} dB</output></label>
            <input id="cs-thr" type="range" min="-65" max="-15" step="1" value={S.thr} onChange={e => set({ thr: +e.target.value })} />
            <div className={styles.rowFoot}>
              <p className={styles.note}>Tudo abaixo desse volume conta como silêncio. Com ruído de fundo, suba.</p>
              <button type="button" className={styles.btnSm} onClick={auto} disabled={!an}><Wand2 size={13} /> Auto</button>
            </div>
          </div>

          <div className={styles.row}>
            <label htmlFor="cs-min">Silêncio mínimo para cortar <output>{S.min} ms</output></label>
            <input id="cs-min" type="range" min="100" max="1500" step="10" value={S.min} onChange={e => set({ min: +e.target.value })} />
          </div>

          <div className={styles.row}>
            <label htmlFor="cs-pad">Respiro mantido <output>{S.pad} ms</output></label>
            <input id="cs-pad" type="range" min="0" max="400" step="10" value={S.pad} onChange={e => set({ pad: +e.target.value })} />
            <p className={styles.note}>Quanto de pausa sobra antes e depois de cada fala, para não ficar robótico.</p>
          </div>

          <div className={styles.row}>
            <label htmlFor="cs-speed">Velocidade <output>{num(S.speed, 2)}×</output></label>
            <input id="cs-speed" type="range" min="0.5" max="2" step="0.05" value={S.speed} onChange={e => set({ speed: +e.target.value })} />
            <div className={styles.chips}>
              {VELOCIDADES.map(v => (
                <button key={v} type="button" aria-pressed={S.speed === v} onClick={() => set({ speed: v })}>{num(v, v % 1 ? (v * 100 % 10 ? 2 : 1) : 0)}×</button>
              ))}
            </div>
          </div>

          <label className={styles.chk}>
            <input type="checkbox" checked={S.pitch} onChange={e => set({ pitch: e.target.checked })} /> Manter o tom da voz (sem voz de esquilo)
          </label>
          <label className={styles.chk}>
            <input type="checkbox" checked={S.mono} onChange={e => set({ mono: e.target.checked })} /> Salvar em mono (arquivo com metade do tamanho)
          </label>
        </div>
      </section>

      <div className={styles.foot}>
        <span>Tudo é processado no seu navegador: o áudio não é enviado para lugar nenhum.</span>
        <span>Aceita MP3, WAV, M4A, OGG e o áudio de vídeos MP4.</span>
      </div>
    </div>
  )
}
