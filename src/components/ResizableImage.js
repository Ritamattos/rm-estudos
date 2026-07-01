import Image from '@tiptap/extension-image'

const MIN_WIDTH = 80
const DEFAULT_WIDTH = '400px'

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: DEFAULT_WIDTH,
        parseHTML: element => element.style.width || element.getAttribute('width') || DEFAULT_WIDTH,
        renderHTML: attrs => (attrs.width ? { style: `width: ${attrs.width}` } : {}),
      },
    }
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const container = document.createElement('div')
      container.classList.add('rm-resizable-image')

      const img = document.createElement('img')
      img.src = node.attrs.src
      if (node.attrs.alt) img.alt = node.attrs.alt
      if (node.attrs.title) img.title = node.attrs.title
      img.style.width = node.attrs.width || DEFAULT_WIDTH
      container.appendChild(img)

      const handle = document.createElement('span')
      handle.classList.add('rm-resize-handle')
      container.appendChild(handle)

      function persistWidth(width) {
        if (typeof getPos !== 'function') return
        editor.commands.command(({ tr }) => {
          const pos = getPos()
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, width })
          return true
        })
      }

      let startX = 0
      let startWidth = 0

      function onMouseMove(e) {
        const delta = e.clientX - startX
        const newWidth = Math.max(MIN_WIDTH, Math.round(startWidth + delta))
        img.style.width = `${newWidth}px`
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        persistWidth(img.style.width)
      }

      handle.addEventListener('mousedown', e => {
        e.preventDefault()
        e.stopPropagation()
        startX = e.clientX
        startWidth = img.getBoundingClientRect().width
        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', onMouseUp)
      })

      return {
        dom: container,
        update(updatedNode) {
          if (updatedNode.type.name !== 'image') return false
          img.src = updatedNode.attrs.src
          img.style.width = updatedNode.attrs.width || DEFAULT_WIDTH
          return true
        },
        stopEvent: event => event.target === handle,
        ignoreMutation: () => true,
      }
    }
  },
})

export default ResizableImage
