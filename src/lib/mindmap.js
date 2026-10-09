// Mind map model + tree layout.
//
// A map is stored in rm_notes.content as JSON:
//   { version: 1, root: Node }
//   Node = {
//     id, text, children: Node[],
//     color: string|null     — null = inherit from parent
//     collapsed: boolean
//     textColor?: 'auto'|'light'|'dark'   (default 'auto')
//     link?: string                       (default none)
//   }
//   stickyNotes?: [{ id, x, y, width, height, text, color }]   (default [])
// Optional fields were added later; older maps simply lack them and fall
// back to the defaults wherever they're read.

export const MINDMAP_COLORS = [
  { label: 'Roxo', value: '#8b5cf6' },
  { label: 'Azul', value: '#3b82f6' },
  { label: 'Ciano', value: '#06b6d4' },
  { label: 'Verde', value: '#10b981' },
  { label: 'Lima', value: '#84cc16' },
  { label: 'Amarelo', value: '#f59e0b' },
  { label: 'Laranja', value: '#f97316' },
  { label: 'Vermelho', value: '#ef4444' },
  { label: 'Rosa', value: '#ec4899' },
  { label: 'Cinza', value: '#64748b' },
]

const DEFAULT_COLOR = MINDMAP_COLORS[0].value

export const TEXT_DARK = '#1e1b2e'
export const TEXT_LIGHT = '#ffffff'

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function createNode(text = 'Novo tópico', color = null) {
  return { id: newId(), text, color, collapsed: false, children: [] }
}

export function emptyMap(title) {
  return { version: 1, root: { ...createNode(title || 'Mapa mental', DEFAULT_COLOR) }, stickyNotes: [] }
}

// Emojis used to live in a separate `emoji` field rendered before the text.
// They now live inside the text (so they can sit anywhere in it); fold the
// old field into the start of the text, which is where it used to show.
function migrateNode(n) {
  const { emoji, ...rest } = n
  const text = emoji ? `${emoji} ${n.text || ''}`.trim() : n.text
  return { ...rest, text, children: (n.children || []).map(migrateNode) }
}

export function parseMap(content, title) {
  try {
    const parsed = JSON.parse(content)
    if (parsed && parsed.root && typeof parsed.root.id === 'string') {
      return {
        ...parsed,
        root: migrateNode(parsed.root),
        stickyNotes: Array.isArray(parsed.stickyNotes) ? parsed.stickyNotes : [],
      }
    }
  } catch { /* empty or legacy content → start fresh */ }
  return emptyMap(title)
}

// Free-floating "post-it" boxes. They live outside the tree and the auto
// layout; x/y/width/height are in canvas (flow) coordinates.
export const STICKY_DEFAULT = { width: 220, height: 150, color: '#f59e0b' }

export function createSticky(x, y) {
  return { id: newId(), x, y, width: STICKY_DEFAULT.width, height: STICKY_DEFAULT.height, text: '', color: STICKY_DEFAULT.color }
}

const EMOJI_RE = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*/gu

export function hasEmoji(text) {
  EMOJI_RE.lastIndex = 0
  return EMOJI_RE.test(text || '')
}

export function stripEmojis(text) {
  return (text || '').replace(EMOJI_RE, '').replace(/[ \t]{2,}/g, ' ').replace(/^ +| +$/gm, '')
}

export function serializeMap(map) {
  return JSON.stringify(map)
}

// ── Colors ──────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  let h = (hex || '').replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h, 16)
  if (Number.isNaN(n) || h.length !== 6) return null
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance([r, g, b]) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

// Text color for a solid background. Prefers white (the established look on
// saturated fills) as long as it reaches 3:1 — the WCAG bar for large/bold
// text — and switches to dark on light fills like yellow or lime.
export function readableOn(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return TEXT_LIGHT
  const contrastWithWhite = 1.05 / (luminance(rgb) + 0.05)
  return contrastWithWhite >= 3 ? TEXT_LIGHT : TEXT_DARK
}

// ── Tree helpers (all immutable) ────────────────────────────────────────────

export function findNode(root, id) {
  if (root.id === id) return root
  for (const c of root.children) {
    const hit = findNode(c, id)
    if (hit) return hit
  }
  return null
}

export function findParent(root, id) {
  for (const c of root.children) {
    if (c.id === id) return root
    const hit = findParent(c, id)
    if (hit) return hit
  }
  return null
}

export function updateNode(root, id, fn) {
  if (root.id === id) return fn(root)
  let changed = false
  const children = root.children.map(c => {
    const next = updateNode(c, id, fn)
    if (next !== c) changed = true
    return next
  })
  return changed ? { ...root, children } : root
}

export function removeNode(root, id) {
  const idx = root.children.findIndex(c => c.id === id)
  if (idx !== -1) return { ...root, children: root.children.filter(c => c.id !== id) }
  let changed = false
  const children = root.children.map(c => {
    const next = removeNode(c, id)
    if (next !== c) changed = true
    return next
  })
  return changed ? { ...root, children } : root
}

export function insertChild(root, parentId, node, index) {
  return updateNode(root, parentId, p => {
    const children = [...p.children]
    children.splice(index ?? children.length, 0, node)
    return { ...p, collapsed: false, children }
  })
}

export function countDescendants(node) {
  return node.children.reduce((n, c) => n + 1 + countDescendants(c), 0)
}

function clearColors(node) {
  return { ...node, color: null, children: node.children.map(clearColors) }
}

// Recoloring a branch makes the whole branch (descendants + their links)
// follow the new color, dropping any per-node colors below it. Recoloring a
// descendant afterwards still works and, in turn, carries its own branch.
// The central node is the exception: its first-level branches keep their
// own colors, as in Whimsical.
export function recolorBranch(root, id, color) {
  if (id === root.id) return { ...root, color }
  return updateNode(root, id, n => ({ ...clearColors(n), color }))
}

// Moves a node (with its subtree) to the end of another parent's children.
// No-op when the target is the node itself or inside its own subtree.
export function moveNode(root, id, newParentId, color) {
  if (id === root.id) return root
  const node = findNode(root, id)
  if (!node || findNode(node, newParentId)) return root
  return insertChild(removeNode(root, id), newParentId, { ...node, color })
}

// ── Layout ──────────────────────────────────────────────────────────────────
// Classic right-growing mind map: each node's children are stacked
// vertically and centered on the parent, so subtrees never overlap.
// `sizes` holds the real rendered size of each node (measured by React
// Flow); unknown nodes fall back to an estimate until they're measured.

const H_GAP = 64
const V_GAP = 14

// Mirrors the per-level typography in MindMapEditor.module.css; only used to
// estimate a node's size before it's rendered and measured.
const LEVELS = [
  { font: 20, weight: 600, padX: 26, padY: 13, max: 340 },
  { font: 17, weight: 700, padX: 20, padY: 10, max: 300 },
  { font: 16, weight: 500, padX: 17, padY: 8, max: 280 },
  { font: 15, weight: 500, padX: 15, padY: 7, max: 280 },
  { font: 14.5, weight: 500, padX: 14, padY: 6, max: 280 },
]
export const levelOf = depth => Math.min(depth, LEVELS.length - 1)

let measureCtx = null
function estimateSize(n, depth) {
  const lv = LEVELS[levelOf(depth)]
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')
  measureCtx.font = `${lv.weight} ${lv.font}px Outfit, sans-serif`
  let w = measureCtx.measureText(n.text || ' ').width
  if (n.link) w += 24
  w = Math.min(w, lv.max - lv.padX * 2)
  return { width: Math.ceil(w) + lv.padX * 2 + 4, height: Math.ceil(lv.font * 1.35) + lv.padY * 2 + 4 }
}

export function layoutMap(root, sizes) {
  const positions = new Map()

  const sizeOf = (n, depth) => sizes.get(n.id) || estimateSize(n, depth)
  const visibleChildren = n => (n.collapsed ? [] : n.children)

  const heights = new Map()
  function measure(n, depth) {
    const { height } = sizeOf(n, depth)
    const kids = visibleChildren(n)
    let kidsH = 0
    kids.forEach((c, i) => { kidsH += measure(c, depth + 1) + (i ? V_GAP : 0) })
    const h = Math.max(height, kidsH)
    heights.set(n.id, h)
    return h
  }

  function place(n, x, top, depth) {
    const { width, height } = sizeOf(n, depth)
    const h = heights.get(n.id)
    const cy = top + h / 2
    positions.set(n.id, { x, y: cy - height / 2, width, height })

    const kids = visibleChildren(n)
    let kidsH = 0
    kids.forEach((c, i) => { kidsH += heights.get(c.id) + (i ? V_GAP : 0) })
    let y = cy - kidsH / 2
    for (const c of kids) {
      place(c, x + width + H_GAP, y, depth + 1)
      y += heights.get(c.id) + V_GAP
    }
  }

  measure(root, 0)
  place(root, 0, 0, 0)
  return positions
}

function resolveTextColor(n, color, isRoot) {
  if (n.textColor === 'light') return TEXT_LIGHT
  if (n.textColor === 'dark') return TEXT_DARK
  // 'auto': the root sits on a solid fill; other nodes use the theme's text
  // color over their pastel fill (handled in CSS).
  return isRoot ? readableOn(color) : null
}

// Walks the visible tree producing React Flow nodes/edges.
export function toFlow(root, positions) {
  const nodes = []
  const edges = []
  function walk(n, parent, inheritedColor, depth) {
    const color = n.color || inheritedColor
    const pos = positions.get(n.id)
    nodes.push({
      id: n.id,
      type: 'mind',
      position: { x: pos.x, y: pos.y },
      draggable: depth > 0,
      selectable: false,
      data: {
        text: n.text,
        color,
        onColor: readableOn(color),
        textColor: resolveTextColor(n, color, depth === 0),
        textColorMode: n.textColor || 'auto',
        link: n.link || '',
        depth,
        isRoot: depth === 0,
        childCount: n.children.length,
        hiddenCount: n.collapsed ? countDescendants(n) : 0,
        collapsed: n.collapsed,
      },
    })
    if (parent) {
      edges.push({
        id: `${parent.id}-${n.id}`,
        source: parent.id,
        target: n.id,
        type: 'default',
        style: { stroke: color, strokeWidth: 2 },
      })
    }
    if (!n.collapsed) n.children.forEach(c => walk(c, n, color, depth + 1))
  }
  walk(root, null, root.color || DEFAULT_COLOR, 0)
  return { nodes, edges }
}
