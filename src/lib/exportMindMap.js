import { toPng } from 'html-to-image'
import { getNodesBounds } from '@xyflow/react'
import jsPDF from 'jspdf'
import { sanitizeFilename } from './exportNotePdf'

const PADDING = 48
const PIXEL_RATIO = 2

// html-to-image can't read cssRules from the cross-origin Google Fonts
// stylesheet, so it would render the export in a fallback font. Build the
// @font-face CSS ourselves (Outfit only — the map doesn't use Lora) with the
// font files inlined as data URLs. Cached for the session.
let fontCssPromise = null
function getFontEmbedCss() {
  if (!fontCssPromise) {
    fontCssPromise = (async () => {
      const link = document.querySelector('link[href*="fonts.googleapis.com/css"]')
      if (!link) return ''
      const css = await (await fetch(link.href)).text()
      const faces = css.match(/@font-face\s*{[^}]*}/g) || []
      const outfit = faces.filter(f => /font-family:\s*['"]?Outfit/.test(f))
      const inlined = await Promise.all(outfit.map(async face => {
        const url = face.match(/url\((['"]?)([^'")]+)\1\)/)?.[2]
        if (!url) return face
        const blob = await (await fetch(url)).blob()
        const dataUrl = await new Promise((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(r.result)
          r.onerror = reject
          r.readAsDataURL(blob)
        })
        return face.replace(url, dataUrl)
      }))
      return inlined.join('\n')
    })().catch(() => {
      fontCssPromise = null
      return ''
    })
  }
  return fontCssPromise
}

// Renders the whole map (not just what's on screen) by capturing React
// Flow's viewport element with a transform that frames every node.
async function renderMap(rf, container) {
  const bounds = getNodesBounds(rf.getNodes())
  const width = Math.ceil(bounds.width + PADDING * 2)
  const height = Math.ceil(bounds.height + PADDING * 2)
  const viewport = container.querySelector('.react-flow__viewport')
  const background = getComputedStyle(container).getPropertyValue('--bg').trim() || '#ffffff'

  const fontEmbedCSS = await getFontEmbedCss()

  const dataUrl = await toPng(viewport, {
    backgroundColor: background,
    // An empty string would make html-to-image fall back to scanning the
    // page's stylesheets (and hit the cross-origin error), so skip instead.
    ...(fontEmbedCSS ? { fontEmbedCSS } : { skipFonts: true }),
    width,
    height,
    pixelRatio: PIXEL_RATIO,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${PADDING - bounds.x}px, ${PADDING - bounds.y}px) scale(1)`,
    },
    // Editing affordances (+ buttons, expanded-branch "−" toggles) stay out
    // of the export; collapsed-branch counters are kept since they carry info.
    filter: el => !el.classList?.contains('mm-export-hide'),
  })
  return { dataUrl, width, height }
}

export async function exportMindMapPng(rf, container, title) {
  const { dataUrl } = await renderMap(rf, container)
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `${sanitizeFilename(title)}.png`
  a.click()
}

export async function exportMindMapPdf(rf, container, title) {
  const { dataUrl, width, height } = await renderMap(rf, container)
  // One page sized to the map (px → pt), so nothing is shrunk onto A4;
  // jsPDF caps page dimensions at 14400pt, so very large maps scale down.
  const MAX = 14400
  const scale = Math.min(0.75, MAX / width, MAX / height)
  const w = width * scale
  const h = height * scale
  const pdf = new jsPDF({ unit: 'pt', format: [w, h], orientation: w >= h ? 'landscape' : 'portrait' })
  pdf.addImage(dataUrl, 'PNG', 0, 0, w, h, undefined, 'FAST')
  pdf.save(`${sanitizeFilename(title)}.pdf`)
}
