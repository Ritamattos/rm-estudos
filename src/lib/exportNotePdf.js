import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

function sanitizeFilename(name) {
  const clean = name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[\\/:*?"<>|]+/g, '')
    .trim()
  return clean.slice(0, 80) || 'nota'
}

// Renders the note's live DOM (kept visually identical to the editor —
// bold/italic/lists/links/images/highlights all come from the same markup)
// into a canvas, then slices that canvas across as many A4 pages as needed.
export async function exportNoteToPdf(element, title) {
  element.classList.add('rm-pdf-export')
  // Neutralize any height/overflow constraint the element (or an inline style)
  // might carry, so html2canvas measures and renders the note's full content
  // height instead of whatever fits in the on-screen viewport.
  const prevOverflow = element.style.overflow
  const prevHeight = element.style.height
  const prevMaxHeight = element.style.maxHeight
  element.style.overflow = 'visible'
  element.style.height = 'auto'
  element.style.maxHeight = 'none'
  try {
    const fullHeight = element.scrollHeight
    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      height: fullHeight,
      windowHeight: fullHeight,
    })

    const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 40

    pdf.setTextColor('#111827')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(18)
    const titleLines = pdf.splitTextToSize(title, pageWidth - margin * 2)
    pdf.text(titleLines, margin, margin)
    const cursorY = margin + titleLines.length * 22 + 12

    const imgWidth = pageWidth - margin * 2
    const pxPerPt = canvas.width / imgWidth
    const totalHeightPx = canvas.height

    // A hard pixel-height slice can land inside a text line's ascender/descender,
    // cutting it in half across the page break. Rows between lines (and between
    // paragraphs) render as flat background color, so before committing to a cut
    // we scan a small window just above the ideal boundary for the nearest such
    // blank row and break there instead.
    const sourceCtx = canvas.getContext('2d')
    const bg = [255, 255, 255]
    const bgTolerance = 8
    const maxBackScanPx = Math.round(pxPerPt * 48) // ~48pt: comfortably more than one line + paragraph gap

    function isRowBlank(y) {
      const row = sourceCtx.getImageData(0, y, canvas.width, 1).data
      for (let i = 0; i < row.length; i += 16) { // sample every 4th pixel — plenty to catch any glyph
        if (
          Math.abs(row[i] - bg[0]) > bgTolerance ||
          Math.abs(row[i + 1] - bg[1]) > bgTolerance ||
          Math.abs(row[i + 2] - bg[2]) > bgTolerance
        ) return false
      }
      return true
    }

    function findSafeCutPx(idealEndPx, rangeStartPx) {
      const start = Math.min(totalHeightPx, Math.round(idealEndPx))
      const limit = Math.max(rangeStartPx + 1, start - maxBackScanPx)
      for (let y = start; y >= limit; y--) {
        if (isRowBlank(y)) return y
      }
      return start // no blank row nearby (e.g. inside an image) — fall back to the hard cut
    }

    let renderedPx = 0
    let firstSlice = true
    while (renderedPx < totalHeightPx - 0.5) {
      const availablePt = firstSlice ? pageHeight - cursorY - margin : pageHeight - margin * 2
      const availablePx = availablePt * pxPerPt
      const remainingPx = totalHeightPx - renderedPx

      const sliceEndPx = availablePx >= remainingPx
        ? totalHeightPx // last page: take the rest as-is, nothing to protect against
        : findSafeCutPx(renderedPx + availablePx, renderedPx)

      const sliceHeightPx = sliceEndPx - renderedPx
      if (sliceHeightPx <= 0) break

      const sliceCanvas = document.createElement('canvas')
      sliceCanvas.width = canvas.width
      sliceCanvas.height = sliceHeightPx
      sliceCanvas.getContext('2d').drawImage(
        canvas,
        0, renderedPx, canvas.width, sliceHeightPx,
        0, 0, canvas.width, sliceHeightPx,
      )

      if (!firstSlice) pdf.addPage()
      const y = firstSlice ? cursorY : margin
      const sliceHeightPt = sliceHeightPx / pxPerPt
      pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, y, imgWidth, sliceHeightPt)

      renderedPx = sliceEndPx
      firstSlice = false
    }

    pdf.save(`${sanitizeFilename(title)}.pdf`)
  } finally {
    element.style.overflow = prevOverflow
    element.style.height = prevHeight
    element.style.maxHeight = prevMaxHeight
    element.classList.remove('rm-pdf-export')
  }
}
