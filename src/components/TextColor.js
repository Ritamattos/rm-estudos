import { Mark, mergeAttributes } from '@tiptap/react'

// Text color for notes. The note stores a color *name* (data-color="red"),
// never a fixed hex, and paints it with a CSS variable (--tc-red). Each
// theme defines its own shade of every variable in index.css, so the same
// note reads well in dark mode, light mode and the white PDF export.
export const TEXT_COLORS = [
  { key: 'red', label: 'Vermelho' },
  { key: 'orange', label: 'Laranja' },
  { key: 'yellow', label: 'Amarelo' },
  { key: 'green', label: 'Verde' },
  { key: 'blue', label: 'Azul' },
  { key: 'purple', label: 'Roxo' },
  { key: 'pink', label: 'Rosa' },
  { key: 'gray', label: 'Cinza' },
]

const KEYS = new Set(TEXT_COLORS.map(c => c.key))

const TextColor = Mark.create({
  name: 'textColor',

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: el => {
          const key = el.getAttribute('data-color')
          return KEYS.has(key) ? key : null
        },
        renderHTML: attrs => attrs.color
          ? { 'data-color': attrs.color, style: `color: var(--tc-${attrs.color})` }
          : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-color]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setTextColor: color => ({ commands }) => commands.setMark(this.name, { color }),
      unsetTextColor: () => ({ commands }) => commands.unsetMark(this.name),
    }
  },
})

export default TextColor
