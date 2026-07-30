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
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    const pxPerPt = canvas.width / imgWidth

    let renderedHeightPt = 0
    let firstSlice = true
    while (renderedHeightPt < imgHeight) {
      const availableHeightPt = firstSlice ? pageHeight - cursorY - margin : pageHeight - margin * 2
      const sliceHeightPt = Math.min(availableHeightPt, imgHeight - renderedHeightPt)
      const sliceHeightPx = sliceHeightPt * pxPerPt

      const sliceCanvas = document.createElement('canvas')
      sliceCanvas.width = canvas.width
      sliceCanvas.height = sliceHeightPx
      sliceCanvas.getContext('2d').drawImage(
        canvas,
        0, renderedHeightPt * pxPerPt, canvas.width, sliceHeightPx,
        0, 0, canvas.width, sliceHeightPx,
      )

      if (!firstSlice) pdf.addPage()
      const y = firstSlice ? cursorY : margin
      pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, y, imgWidth, sliceHeightPt)

      renderedHeightPt += sliceHeightPt
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
