// Mind map model + tree layout.
//
// A map is stored in rm_notes.content as JSON:
//   { version: 1, root: Node }
//   Node = { id, text, color|null, collapsed, children: Node[] }
// `color: null` means "inherit from parent", so recoloring a branch
// recolors every descendant that wasn't explicitly given its own color.

export const MINDMAP_COLORS = [
  { label: 'Roxo', value: '#8b5cf6' },
  { label: 'Azul', value: '#3b82f6' },
  { label: 'Verde', value: '#10b981' },
  { label: 'Amarelo', value: '#f59e0b' },
  { label: 'Vermelho', value: '#ef4444' },
  { label: 'Rosa', value: '#ec4899' },
]

const DEFAULT_COLOR = MINDMAP_COLORS[0].value

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function createNode(text = 'Novo tópico', color = null) {
  return { id: newId(), text, color, collapsed: false, children: [] }
}

export function emptyMap(title) {
  return { version: 1, root: { ...createNode(title || 'Mapa mental', DEFAULT_COLOR) } }
}

export function parseMap(content, title) {
  try {
    const parsed = JSON.parse(content)
    if (parsed && parsed.root && typeof parsed.root.id === 'string') return parsed
  } catch { /* empty or legacy content → start fresh */ }
  return emptyMap(title)
}

export function serializeMap(map) {
  return JSON.stringify(map)
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

// ── Layout ──────────────────────────────────────────────────────────────────
// Classic right-growing mind map: each node's children are stacked
// vertically and centered on the parent, so subtrees never overlap.
// `sizes` holds the real rendered size of each node (measured by React
// Flow); unknown nodes fall back to an estimate until they're measured.

const H_GAP = 64
const V_GAP = 14

let measureCtx = null
function estimateSize(text, isRoot) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')
  measureCtx.font = `${isRoot ? 600 : 500} ${isRoot ? 16 : 14}px Outfit, sans-serif`
  const w = Math.min(measureCtx.measureText(text || ' ').width, isRoot ? 280 : 240)
  return { width: Math.ceil(w) + (isRoot ? 44 : 36), height: isRoot ? 46 : 38 }
}

export function layoutMap(root, sizes) {
  const positions = new Map()

  const sizeOf = (n, isRoot) => sizes.get(n.id) || estimateSize(n.text, isRoot)
  const visibleChildren = n => (n.collapsed ? [] : n.children)

  const heights = new Map()
  function measure(n, isRoot) {
    const { height } = sizeOf(n, isRoot)
    const kids = visibleChildren(n)
    let kidsH = 0
    kids.forEach((c, i) => { kidsH += measure(c, false) + (i ? V_GAP : 0) })
    const h = Math.max(height, kidsH)
    heights.set(n.id, h)
    return h
  }

  function place(n, x, top, isRoot) {
    const { width, height } = sizeOf(n, isRoot)
    const h = heights.get(n.id)
    const cy = top + h / 2
    positions.set(n.id, { x, y: cy - height / 2, width, height })

    const kids = visibleChildren(n)
    let kidsH = 0
    kids.forEach((c, i) => { kidsH += heights.get(c.id) + (i ? V_GAP : 0) })
    let y = cy - kidsH / 2
    for (const c of kids) {
      place(c, x + width + H_GAP, y, false)
      y += heights.get(c.id) + V_GAP
    }
  }

  measure(root, true)
  place(root, 0, 0, true)
  return positions
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
      draggable: false,
      selectable: false,
      data: {
        text: n.text,
        color,
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
