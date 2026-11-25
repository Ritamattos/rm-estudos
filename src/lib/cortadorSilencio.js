// Cortador de silêncio: the audio algorithms, ported from the reference
// page (cortador-silencio-referencia.html) without changes to the math.
// Pure functions over Float32Array channels, so they run the same on the
// main thread and inside the Web Worker (cortadorSilencio.worker.js).
// Nothing here touches the network: the audio never leaves the browser.

export const PREDEFINICOES = {
  natural:   { thr: -45, min: 600, pad: 180 },
  vsl:       { thr: -40, min: 300, pad: 90 },
  agressivo: { thr: -35, min: 180, pad: 40 },
}
// autoThr: the silence threshold is measured from each audio (limiteAuto)
// instead of the fixed value of the preset — works with background noise.
export const CONFIG_PADRAO = { thr: -40, min: 300, pad: 90, speed: 1, pitch: true, mono: false, autoThr: true }

// Mono mix, loudness per 10 ms frame (dB) and the min/max envelope used to
// draw the waveform (up to 8000 buckets).
export function analisar(channels, sr) {
  const n = channels[0].length, C = channels.length, mix = new Float32Array(n)
  for (let c = 0; c < C; c++) { const d = channels[c]; for (let i = 0; i < n; i++) mix[i] += d[i] / C }
  const hop = Math.round(sr / 100), F = Math.ceil(n / hop), db = new Float32Array(F)
  for (let f = 0; f < F; f++) {
    const a = f * hop, e = Math.min(n, a + hop)
    let s = 0
    for (let i = a; i < e; i++) s += mix[i] * mix[i]
    db[f] = 10 * Math.log10(s / Math.max(1, e - a) + 1e-12)
  }
  const B = Math.min(8000, n), mn = new Float32Array(B), mx = new Float32Array(B)
  for (let b = 0; b < B; b++) {
    const a = Math.floor(b * n / B), e = Math.floor((b + 1) * n / B)
    let lo = 0, hi = 0
    for (let i = a; i < e; i++) { const v = mix[i]; if (v < lo) lo = v; if (v > hi) hi = v }
    mn[b] = lo; mx[b] = hi
  }
  return { n, sr, hop, db, mn, mx }
}

// Silent stretches to cut and the parts that stay, in samples.
// cfg: { thr (dB), min (ms), pad (ms) }
export function detectar(an, cfg) {
  const { db, hop, sr, n } = an, F = db.length, v = new Uint8Array(F)
  for (let f = 0; f < F; f++) v[f] = db[f] > cfg.thr ? 1 : 0
  for (let i = 0; i < F;) { if (v[i]) { let j = i; while (j < F && v[j]) j++; if (j - i < 3) v.fill(0, i, j); i = j } else i++ }
  const minF = Math.round(cfg.min / 10), pad = Math.round(cfg.pad / 1000 * sr), cuts = []
  for (let i = 0; i < F;) {
    if (!v[i]) {
      let j = i; while (j < F && !v[j]) j++
      const st = i === 0, en = j === F
      if (j - i >= minF || st || en) {
        let a = st ? 0 : i * hop + pad, b = en ? n : Math.min(n, j * hop) - pad
        if (st && en) { a = 0; b = n }
        if (b - a > hop) cuts.push([a, b])
      }
      i = j
    } else i++
  }
  const keeps = []
  let p = 0
  for (const [a, b] of cuts) { if (a > p) keeps.push([p, a]); p = b }
  if (p < n) keeps.push([p, n])
  return { cuts, keeps }
}

// Auto threshold: 30% of the way from the quiet floor (10th percentile)
// to the loud parts (95th percentile), clamped to the slider range.
export function limiteAuto(an) {
  const s = Array.from(an.db).sort((a, b) => a - b), lo = s[Math.floor(s.length * 0.1)], hi = s[Math.floor(s.length * 0.95)]
  return Math.round(Math.max(-65, Math.min(-15, lo + (hi - lo) * 0.3)))
}

export const segundosFinais = (keeps, sr, speed) => keeps.reduce((s, [a, b]) => s + b - a, 0) / sr / speed

export function resample(X, sp) {
  const n = X[0].length, L = Math.floor(n / sp)
  return X.map(x => {
    const y = new Float32Array(L)
    for (let i = 0; i < L; i++) { const p = i * sp, i0 = p | 0, f = p - i0; y[i] = x[i0] * (1 - f) + (i0 + 1 < n ? x[i0 + 1] : 0) * f }
    return y
  })
}

// Speed change that keeps the pitch (WSOLA).
export function wsola(X, sr, sp) {
  const n = X[0].length, N = 2 * Math.round(sr * 0.025), H = N / 2, Ha = H * sp, tol = Math.round(sr * 0.012), D = 4, L = H, Ld = Math.floor(L / D)
  if (n < N * 3) return resample(X, sp)
  const outLen = Math.floor(n / sp), mix = new Float32Array(n)
  X.forEach(d => { for (let i = 0; i < n; i++) mix[i] += d[i] })
  const m = Math.floor(n / D), md = new Float32Array(m)
  for (let i = 0; i < m; i++) { let s = 0; for (let k = 0; k < D; k++) s += mix[i * D + k]; md[i] = s }
  const w = new Float32Array(N)
  for (let i = 0; i < N; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)
  const Y = X.map(() => new Float32Array(outLen + N))
  let prev = 0
  for (let k = 0; k * H < outLen; k++) {
    const nom = Math.round(k * Ha)
    let pos
    if (k === 0) pos = 0
    else {
      const t = prev + H, lo = Math.max(0, nom - tol), hi = Math.min(n - N, nom + tol)
      if (hi < lo || t + L + D > n) pos = Math.max(0, Math.min(nom, n - N))
      else {
        const td = Math.floor(t / D)
        let best = lo, bv = -Infinity
        for (let c = Math.floor(lo / D); c * D <= hi; c++) {
          let s = 0, e = 0
          for (let j = 0; j < Ld; j++) { const y = md[c + j]; s += md[td + j] * y; e += y * y }
          const q = s / Math.sqrt(e + 1e-9)
          if (q > bv) { bv = q; best = c * D }
        }
        let fb = Math.max(lo, Math.min(hi, best))
        bv = -Infinity
        for (let c = Math.max(lo, best - D); c <= Math.min(hi, best + D); c++) {
          let s = 0, e = 0
          for (let j = 0; j < L; j += 2) { const y = mix[c + j]; s += mix[t + j] * y; e += y * y }
          const q = s / Math.sqrt(e + 1e-9)
          if (q > bv) { bv = q; fb = c }
        }
        pos = fb
      }
    }
    const o = k * H
    for (let c = 0; c < X.length; c++) {
      const x = X[c], y = Y[c]
      for (let j = 0; j < N && pos + j < n; j++) y[o + j] += x[pos + j] * (k === 0 && j < H ? 1 : w[j])
    }
    prev = pos
  }
  return Y.map(y => y.subarray(0, outLen))
}

// Joins the kept parts (4 ms fades at each cut so there are no clicks),
// then changes the speed: WSOLA when the pitch is kept, plain resampling
// otherwise.
export function processar(channels, sr, keeps, speed, pitch) {
  const C = channels.length, n = channels[0].length
  const tot = keeps.reduce((s, [a, b]) => s + b - a, 0), fd = Math.round(sr * 0.004)
  let X = Array.from({ length: C }, () => new Float32Array(tot))
  for (let c = 0; c < C; c++) {
    const d = channels[c], y = X[c]
    let o = 0
    for (const [a, b] of keeps) {
      const len = b - a
      y.set(d.subarray(a, b), o)
      for (let k = 0; k < fd && k < len / 2; k++) { const g = k / fd; if (a > 0) y[o + k] *= g; if (b < n) y[o + len - 1 - k] *= g }
      o += len
    }
  }
  if (speed !== 1 && tot > 0) X = pitch ? wsola(X, sr, speed) : resample(X, speed)
  return X
}

// 16-bit PCM WAV (mono mixes the channels down).
export function wav(X, sr, mono) {
  const C = mono ? 1 : X.length, n = X[0].length, buf = new ArrayBuffer(44 + n * C * 2), v = new DataView(buf)
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  ws(0, 'RIFF'); v.setUint32(4, 36 + n * C * 2, true); ws(8, 'WAVE'); ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, C, true)
  v.setUint32(24, sr, true); v.setUint32(28, sr * C * 2, true); v.setUint16(32, C * 2, true); v.setUint16(34, 16, true); ws(36, 'data'); v.setUint32(40, n * C * 2, true)
  let o = 44
  const K = X.length
  for (let i = 0; i < n; i++) {
    if (mono) {
      let s = 0
      for (let c = 0; c < K; c++) s += X[c][i]
      s = Math.max(-1, Math.min(1, s / K))
      v.setInt16(o, s < 0 ? s * 32768 : s * 32767, true); o += 2
    } else {
      for (let c = 0; c < K; c++) { const s = Math.max(-1, Math.min(1, X[c][i])); v.setInt16(o, s < 0 ? s * 32768 : s * 32767, true); o += 2 }
    }
  }
  return buf
}
