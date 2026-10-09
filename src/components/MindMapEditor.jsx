import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Handle, NodeResizer, Panel, Position, useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowLeft, Check, Plus, CornerDownRight, Pencil, Trash2, ZoomIn, ZoomOut, Maximize,
  Image as ImageIcon, FileDown, ExternalLink, Smile, Link2, StickyNote,
} from 'lucide-react'
import Modal from './Modal'
import {
  MINDMAP_COLORS, createNode, parseMap, serializeMap, findNode, findParent,
  updateNode, removeNode, insertChild, countDescendants, layoutMap, toFlow,
  recolorBranch, levelOf, moveNode, createSticky, stripEmojis,
} from '../lib/mindmap'
import { exportMindMapPng, exportMindMapPdf } from '../lib/exportMindMap'
import styles from './MindMapEditor.module.css'

const MapCtx = createContext(null)

const FIT_OPTIONS = { padding: 0.2, maxZoom: 1 }

// Shared behavior of the inline text editors (tree nodes and sticky notes):
// focusing, committing on blur/unmount, and an API the emoji picker uses to
// insert at the caret. Clicks inside [data-keep-edit] (the editing toolbar
// and emoji popover) don't count as leaving the editor.
function useInlineEditor({ initial, caret, onCommit, registerEditor }) {
  const [value, setValue] = useState(initial)
  const ref = useRef()
  const done = useRef(false)
  const sel = useRef(null)
  const valueRef = useRef(value)
  valueRef.current = value
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit

  const trackSel = () => {
    const el = ref.current
    if (el) sel.current = { start: el.selectionStart, end: el.selectionEnd }
  }

  useEffect(() => {
    // A brand-new node stays visibility:hidden until React Flow measures it,
    // and hidden elements can't take focus — retry for a few frames.
    let frame, tries = 0
    function focus() {
      const el = ref.current
      if (!el) return
      el.focus()
      if (document.activeElement === el) {
        if (caret === 'end') el.setSelectionRange(el.value.length, el.value.length)
        else el.select()
        trackSel()
      } else if (tries++ < 20) frame = requestAnimationFrame(focus)
    }
    focus()

    function setAndPlace(next, pos) {
      valueRef.current = next
      setValue(next)
      sel.current = { start: pos, end: pos }
      requestAnimationFrame(() => {
        const el = ref.current
        if (!el) return
        el.focus()
        el.setSelectionRange(pos, pos)
      })
    }
    registerEditor({
      insert(str) {
        const v = valueRef.current
        const { start, end } = sel.current || { start: v.length, end: v.length }
        setAndPlace(v.slice(0, start) + str + v.slice(end), start + str.length)
      },
      transform(fn) {
        const next = fn(valueRef.current)
        setAndPlace(next, next.length)
      },
    })

    return () => {
      cancelAnimationFrame(frame)
      registerEditor(null)
      // Unmounted without a blur (e.g. another node selected via keyboard,
      // or "Concluir" pressed): keep what was typed instead of dropping it.
      if (!done.current) commitRef.current(valueRef.current)
    }
  }, [])

  function finish(commit, onCancel) {
    if (done.current) return
    done.current = true
    commit ? commitRef.current(valueRef.current) : onCancel()
  }

  const bind = {
    ref,
    value,
    onChange: e => { setValue(e.target.value); trackSel() },
    onSelect: trackSel,
    onKeyUp: trackSel,
    onClick: trackSel,
    onBlur: e => {
      trackSel()
      if (e.relatedTarget?.closest?.('[data-keep-edit]')) return
      finish(true)
    },
  }
  return { value, bind, finish }
}

// Auto-growing textarea: the hidden ::after copy of the text sizes the grid
// cell, and the textarea stretches to fill it.
function NodeTextInput({ initial, caret, onCommit, onCancel, onTab, registerEditor }) {
  const { value, bind, finish } = useInlineEditor({ initial, caret, onCommit, registerEditor })
  return (
    <div className={styles.inputGrow} data-value={value}>
      <textarea
        {...bind}
        rows={1}
        className={`${styles.nodeInput} nodrag nopan nowheel`}
        onKeyDown={e => {
          e.stopPropagation()
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true) }
          else if (e.key === 'Escape') { e.preventDefault(); finish(false, onCancel) }
          else if (e.key === 'Tab') { e.preventDefault(); finish(true); onTab() }
        }}
      />
    </div>
  )
}

function StickyTextInput({ initial, caret, onCommit, registerEditor }) {
  const { bind, finish } = useInlineEditor({ initial, caret, onCommit, registerEditor })
  return (
    <textarea
      {...bind}
      className={`${styles.stickyInput} nodrag nopan nowheel`}
      placeholder="Escreva aqui..."
      onKeyDown={e => {
        e.stopPropagation()
        // Enter is a plain line break here; Esc (or Ctrl+Enter) finishes.
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); finish(true) }
      }}
    />
  )
}

const MindNode = memo(function MindNode({ id, data }) {
  const ctx = useContext(MapCtx)
  const selected = ctx.selectedId === id
  const editing = ctx.editingId === id
  const { text, color, onColor, textColor, link, depth, isRoot, childCount, hiddenCount, collapsed } = data
  const dropTarget = ctx.dropTargetId === id

  return (
    <div
      className={`${styles.node} ${LEVEL_CLASS[levelOf(depth)]} ${selected ? styles.nodeSelected : ''} ${dropTarget ? styles.dropTarget : ''}`}
      style={{ '--node-color': color, '--node-on': onColor, ...(textColor ? { color: textColor } : null) }}
      onDoubleClick={e => { e.stopPropagation(); ctx.startEdit(id) }}
    >
      <Handle type="target" position={Position.Left} className={styles.handle} isConnectable={false} />
      {editing ? (
        <NodeTextInput
          initial={text}
          caret={ctx.editCaret}
          onCommit={v => ctx.commitEdit(id, v)}
          onCancel={ctx.cancelEdit}
          onTab={() => ctx.addChild(id)}
          registerEditor={ctx.registerEditor}
        />
      ) : (
        <span className={styles.nodeText}>{text || ' '}</span>
      )}
      {link && !editing && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.nodeLink} nodrag nopan`}
          title={link}
          onClick={e => e.stopPropagation()}
          onDoubleClick={e => e.stopPropagation()}
        ><ExternalLink size={14} /></a>
      )}
      <Handle type="source" position={Position.Right} className={styles.handle} isConnectable={false} />

      {childCount > 0 && (
        <button
          type="button"
          className={`${styles.toggle} ${collapsed ? styles.toggleCollapsed : ''} nodrag nopan ${collapsed ? '' : 'mm-export-hide'}`}
          onClick={e => { e.stopPropagation(); ctx.toggleCollapse(id) }}
          title={collapsed ? 'Expandir' : 'Recolher'}
        >
          {collapsed ? hiddenCount : '−'}
        </button>
      )}

      {selected && !editing && (
        <>
          <button
            type="button"
            className={`${styles.addBtn} ${styles.addChild} ${childCount > 0 ? styles.addChildFar : ''} nodrag nopan mm-export-hide`}
            onClick={e => { e.stopPropagation(); ctx.addChild(id) }}
            title="Adicionar filho (Tab)"
          ><Plus size={13} /></button>
          {!isRoot && (
            <button
              type="button"
              className={`${styles.addBtn} ${styles.addSibling} nodrag nopan mm-export-hide`}
              onClick={e => { e.stopPropagation(); ctx.addSibling(id) }}
              title="Adicionar irmão (Enter)"
            ><Plus size={13} /></button>
          )}
        </>
      )}
    </div>
  )
})

const StickyNoteNode = memo(function StickyNoteNode({ id, data }) {
  const ctx = useContext(MapCtx)
  const selected = ctx.selectedId === id
  const editing = ctx.editingId === id
  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={70}
        handleClassName={styles.resizeHandle}
        lineClassName={styles.resizeLine}
      />
      <div
        className={`${styles.sticky} ${selected ? styles.stickySelected : ''}`}
        style={{ '--node-color': data.color }}
        onPointerDown={e => ctx.grabSticky(id, e)}
        onDoubleClick={e => { e.stopPropagation(); ctx.startEdit(id, 'end') }}
      >
        {editing ? (
          <StickyTextInput
            initial={data.text}
            caret={ctx.editCaret}
            onCommit={v => ctx.commitEdit(id, v)}
            registerEditor={ctx.registerEditor}
          />
        ) : data.text ? (
          <div className={`${styles.stickyText} nowheel`}>{data.text}</div>
        ) : (
          <div className={`${styles.stickyText} ${styles.stickyPlaceholder} mm-export-hide`}>Duplo clique para escrever</div>
        )}
      </div>
    </>
  )
})

const nodeTypes = { mind: MindNode, sticky: StickyNoteNode }

const LEVEL_CLASS = [styles.rootNode, styles.level1, styles.level2, styles.level3, styles.level4]

const EMOJIS = [
  '💡', '⭐', '🔥', '✅', '❌', '⚠️', '❓', '❗', '📌', '🎯',
  '🚀', '🧠', '📚', '📝', '💬', '📣', '📅', '⏰', '💰', '📈',
  '📉', '🛒', '🤝', '👥', '❤️', '🎉', '🏆', '🎨', '📷', '🎬',
  '🌱', '🔒', '⚙️', '🔗', '📍', '😀', '🤔', '👀', '🙌', '✨',
]

function firstGrapheme(s) {
  if (!s) return ''
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const first = new Intl.Segmenter().segment(s)[Symbol.iterator]().next().value
    return first ? first.segment : ''
  }
  return Array.from(s)[0] || ''
}

const isPhone = () => window.innerWidth < 640

// On phones, fitting a whole map on open shrinks the text to illegible
// sizes, so the map opens at a readable zoom anchored on the central node
// instead ("Ajustar à tela" still shows everything on demand).
const PHONE_ZOOM = 0.8

// Mouse-downs inside these containers must not steal focus from the text
// being edited (so emoji buttons insert at the caret); text inputs inside
// them still take focus normally.
const keepEditFocus = e => {
  if (e.target.tagName !== 'INPUT') e.preventDefault()
}

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
}

function MindMapCanvas({ note, store, onClose }) {
  const rf = useReactFlow()
  const [map, setMap] = useState(() => parseMap(note.content, note.title))
  const [sizes, setSizes] = useState(() => new Map())
  const [selectedId, setSelectedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editCaret, setEditCaret] = useState('all') // where the caret lands when editing starts
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [exporting, setExporting] = useState(null)
  const [panel, setPanel] = useState(null) // open toolbar popover: 'color' | 'emoji' | null
  const [linkModal, setLinkModal] = useState(null) // { id, url }
  // Branch being dragged: its visible subtree moves with the pointer, and
  // `target` is the node it would be re-parented under on drop.
  const [drag, setDrag] = useState(null) // { id, ids: Set, dx, dy, target }
  const dragRef = useRef(null)
  dragRef.current = drag
  const editorRef = useRef(null) // API of the text editor currently open, if any
  const wrapRef = useRef()
  const mapRef = useRef(map)
  mapRef.current = map

  const root = map.root
  const stickies = map.stickyNotes
  const setRoot = useCallback(fn => {
    setMap(m => ({ ...m, root: fn(m.root) }))
  }, [])
  const updateSticky = useCallback((id, fields) => {
    setMap(m => ({ ...m, stickyNotes: m.stickyNotes.map(s => (s.id === id ? { ...s, ...fields } : s)) }))
  }, [])
  const isSticky = id => mapRef.current.stickyNotes.some(s => s.id === id)

  const positions = useMemo(() => layoutMap(root, sizes), [root, sizes])
  const treeFlow = useMemo(() => {
    const flow = toFlow(root, positions)
    flow.nodes.forEach(n => {
      const s = sizes.get(n.id)
      if (s) n.measured = s
      // Without a size React Flow renders new nodes visibility:hidden until
      // measured, which would delay focusing the inline editor (and eat the
      // first keystrokes). The layout's estimate is close enough to show it.
      const p = positions.get(n.id)
      n.initialWidth = p.width
      n.initialHeight = p.height
      // Tree nodes stay above sticky notes so notes never block selecting them.
      n.zIndex = 2
      if (drag?.ids.has(n.id)) {
        n.position = { x: p.x + drag.dx, y: p.y + drag.dy }
        n.zIndex = 1000
      }
    })
    return flow
  }, [root, positions, sizes, drag])

  // Sticky notes: free-floating, never touched by the layout.
  const stickyNodes = useMemo(() => stickies.map(s => ({
    id: s.id,
    type: 'sticky',
    position: { x: s.x, y: s.y },
    width: s.width,
    height: s.height,
    measured: { width: s.width, height: s.height },
    draggable: editingId !== s.id,
    selectable: false,
    zIndex: 1,
    data: { text: s.text, color: s.color },
  })), [stickies, editingId])

  const nodes = useMemo(() => [...stickyNodes, ...treeFlow.nodes], [stickyNodes, treeFlow])
  const edges = treeFlow.edges

  // ── Drag a branch onto another node to re-parent it ──────────────────────

  const onNodeDragStart = useCallback((_, node) => {
    setSelectedId(node.id)
    setEditingId(null)
    setPanel(null)
    if (node.type === 'sticky') return // moved through position changes
    const sub = findNode(mapRef.current.root, node.id)
    if (!sub) return
    const ids = new Set()
    ;(function walk(n) { ids.add(n.id); if (!n.collapsed) n.children.forEach(walk) })(sub)
    setDrag({ id: node.id, ids, dx: 0, dy: 0, target: null })
  }, [])

  // React Flow only starts a drag past a threshold measured in canvas units,
  // so at low zoom (phones) a note would trail well behind the finger. Notes
  // instead track the pointer from the exact spot where they were grabbed.
  const stickyGrab = useRef(null) // { id, dx, dy } — pointer offset inside the note
  const pointerFlow = useCallback(e => {
    const src = e?.touches?.[0] || e?.changedTouches?.[0] || e
    return src && src.clientX != null ? rf.screenToFlowPosition({ x: src.clientX, y: src.clientY }) : null
  }, [rf])
  const grabSticky = useCallback((id, e) => {
    const s = mapRef.current.stickyNotes.find(n => n.id === id)
    const pt = pointerFlow(e)
    stickyGrab.current = s && pt ? { id, dx: pt.x - s.x, dy: pt.y - s.y } : null
  }, [pointerFlow])

  const onNodeDrag = useCallback((e, node) => {
    if (node.type === 'sticky') {
      const g = stickyGrab.current
      const pt = pointerFlow(e)
      if (g?.id === node.id && pt) updateSticky(node.id, { x: Math.round(pt.x - g.dx), y: Math.round(pt.y - g.dy) })
      return
    }
    const d = dragRef.current
    const start = positions.get(node.id)
    if (!d || !start) return
    // Hit-test what's under the finger/cursor; fall back to the node center.
    const src = e?.touches?.[0] || e?.changedTouches?.[0] || e
    const pt = src && src.clientX != null
      ? rf.screenToFlowPosition({ x: src.clientX, y: src.clientY })
      : { x: node.position.x + start.width / 2, y: node.position.y + start.height / 2 }
    let target = null
    for (const [id, p] of positions) {
      if (d.ids.has(id)) continue
      if (pt.x >= p.x - 6 && pt.x <= p.x + p.width + 6 && pt.y >= p.y - 6 && pt.y <= p.y + p.height + 6) {
        target = id
        break
      }
    }
    setDrag({ ...d, dx: node.position.x - start.x, dy: node.position.y - start.y, target })
  }, [positions, rf, pointerFlow, updateSticky])

  const onNodeDragStop = useCallback(() => {
    stickyGrab.current = null
    const d = dragRef.current
    setDrag(null)
    if (!d?.target) return // dropped on empty canvas: the layout snaps it back
    const r = mapRef.current.root
    if (findParent(r, d.id)?.id === d.target) return
    // Under another branch the moved node adopts that branch's color; moved
    // up to the central node it keeps the color it already showed.
    const shown = treeFlow.nodes.find(n => n.id === d.id)?.data.color ?? null
    setRoot(rt => moveNode(rt, d.id, d.target, d.target === r.id ? shown : null))
  }, [treeFlow, setRoot])

  const onNodesChange = useCallback(changes => {
    const treeSizes = []
    for (const ch of changes) {
      if (isSticky(ch.id)) {
        // Sticky notes own their geometry: drags are tracked in onNodeDrag,
        // the resizer moves (top/left edges) and resizes (setAttributes) them;
        // plain measurements are ignored.
        if (ch.type === 'position' && ch.position) {
          if (typeof ch.dragging === 'boolean' && stickyGrab.current?.id === ch.id) continue
          updateSticky(ch.id, { x: ch.position.x, y: ch.position.y })
        }
        else if (ch.type === 'dimensions' && ch.setAttributes && ch.dimensions) {
          updateSticky(ch.id, { width: Math.round(ch.dimensions.width), height: Math.round(ch.dimensions.height) })
        }
      } else if (ch.type === 'dimensions' && ch.dimensions) {
        treeSizes.push(ch)
      }
    }
    if (!treeSizes.length) return
    setSizes(prev => {
      let next = prev
      for (const ch of treeSizes) {
        const old = prev.get(ch.id)
        const { width, height } = ch.dimensions
        if (old && Math.abs(old.width - width) < 0.5 && Math.abs(old.height - height) < 0.5) continue
        if (next === prev) next = new Map(prev)
        next.set(ch.id, { width, height })
      }
      return next
    })
  }, [updateSticky])

  // ── Tree actions ──────────────────────────────────────────────────────────

  const branchColorFor = useCallback((parentId, index) => {
    // First-level branches each get their own palette color (like Whimsical);
    // deeper nodes inherit from their branch.
    if (parentId !== mapRef.current.root.id) return null
    return MINDMAP_COLORS[(index + 1) % MINDMAP_COLORS.length].value
  }, [])

  const addChild = useCallback(parentId => {
    const parent = findNode(mapRef.current.root, parentId)
    if (!parent) return
    const node = createNode('Novo tópico', branchColorFor(parentId, parent.children.length))
    setRoot(r => insertChild(r, parentId, node))
    setSelectedId(node.id)
    setEditCaret('all')
    setEditingId(node.id)
  }, [setRoot, branchColorFor])

  const addSibling = useCallback(id => {
    const r = mapRef.current.root
    if (id === r.id) { addChild(id); return }
    const parent = findParent(r, id)
    if (!parent) return
    const index = parent.children.findIndex(c => c.id === id) + 1
    const node = createNode('Novo tópico', branchColorFor(parent.id, parent.children.length))
    setRoot(rt => insertChild(rt, parent.id, node, index))
    setSelectedId(node.id)
    setEditCaret('all')
    setEditingId(node.id)
  }, [setRoot, addChild, branchColorFor])

  const deleteNode = useCallback(id => {
    const r = mapRef.current.root
    if (id === r.id) return
    const node = findNode(r, id)
    if (!node) return
    const n = countDescendants(node)
    if (n > 0 && !confirm(`Excluir "${node.text}" e ${n} subtópico${n !== 1 ? 's' : ''}?`)) return
    const parent = findParent(r, id)
    const idx = parent.children.findIndex(c => c.id === id)
    const next = parent.children[idx + 1] || parent.children[idx - 1] || parent
    setRoot(rt => removeNode(rt, id))
    setSelectedId(next.id)
    setEditingId(null)
  }, [setRoot])

  const toggleCollapse = useCallback(id => {
    const node = findNode(mapRef.current.root, id)
    if (!node) return
    // Collapsing a branch that contains the selection moves it to the branch.
    if (!node.collapsed && selectedId && selectedId !== id && findNode(node, selectedId)) {
      setSelectedId(id)
    }
    setRoot(r => updateNode(r, id, n => ({ ...n, collapsed: !n.collapsed })))
  }, [setRoot, selectedId])

  const setColor = useCallback((id, color) => {
    if (isSticky(id)) updateSticky(id, { color })
    else setRoot(r => recolorBranch(r, id, color))
  }, [setRoot, updateSticky])

  const setTextColor = useCallback((id, mode) => {
    setRoot(r => updateNode(r, id, n => ({ ...n, textColor: mode })))
  }, [setRoot])

  function applyLink() {
    if (!linkModal) return
    const url = linkModal.url.trim()
    const href = !url ? '' : /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`
    setRoot(r => updateNode(r, linkModal.id, n => ({ ...n, link: href })))
    setLinkModal(null)
  }

  // ── Sticky notes ──────────────────────────────────────────────────────────

  const addSticky = useCallback(() => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const c = rf.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    // Cascade a little so several new notes don't stack exactly on top of each other.
    const k = (mapRef.current.stickyNotes.length % 6) * 18
    const s = createSticky(0, 0)
    s.x = Math.round(c.x - s.width / 2 + k)
    s.y = Math.round(c.y - s.height / 2 + k)
    setMap(m => ({ ...m, stickyNotes: [...m.stickyNotes, s] }))
    setSelectedId(s.id)
    setEditCaret('end')
    setEditingId(s.id)
    setPanel(null)
  }, [rf])

  const deleteSticky = useCallback(id => {
    setMap(m => ({ ...m, stickyNotes: m.stickyNotes.filter(s => s.id !== id) }))
    setSelectedId(null)
    setEditingId(null)
  }, [])

  // ── Editing ───────────────────────────────────────────────────────────────

  const startEdit = useCallback((id, caret = 'all') => {
    setSelectedId(id)
    setEditCaret(caret)
    setEditingId(id)
  }, [])

  const commitEdit = useCallback((id, value) => {
    if (isSticky(id)) updateSticky(id, { text: value })
    else {
      const text = value.trim()
      if (text) setRoot(r => updateNode(r, id, n => ({ ...n, text })))
    }
    setEditingId(cur => (cur === id ? null : cur))
  }, [setRoot, updateSticky])

  const cancelEdit = useCallback(() => setEditingId(null), [])

  const registerEditor = useCallback(api => { editorRef.current = api }, [])

  // Emoji goes in at the caret of the text being edited; from a selected
  // (not editing) item, editing starts with the caret at the end first.
  function openEmoji(id) {
    if (editingId !== id) startEdit(id, 'end')
    setPanel(p => (p === 'emoji' ? null : 'emoji'))
  }
  function insertEmoji(em) {
    editorRef.current?.insert(em)
  }

  const dropTargetId = drag?.target || null
  const ctx = useMemo(() => ({
    selectedId, editingId, editCaret, dropTargetId,
    addChild, addSibling, toggleCollapse, startEdit, commitEdit, cancelEdit, registerEditor, grabSticky,
  }), [selectedId, editingId, editCaret, dropTargetId, addChild, addSibling, toggleCollapse, startEdit, commitEdit, cancelEdit, registerEditor, grabSticky])

  // ── Keyboard ──────────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e) {
      if (linkModal) return
      if (editingId) {
        if (e.key === 'Tab') e.preventDefault() // don't let focus wander to the node buttons
        return
      }
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return
      if (!selectedId) return

      if (isSticky(selectedId)) {
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSticky(selectedId) }
        else if (e.key === 'F2' || e.key === 'Enter') { e.preventDefault(); startEdit(selectedId, 'end') }
        else if (e.key === 'Escape') { setSelectedId(null); setPanel(null) }
        return
      }

      const r = mapRef.current.root
      const node = findNode(r, selectedId)
      if (!node) return

      if (e.key === 'Tab') { e.preventDefault(); addChild(selectedId) }
      else if (e.key === 'Enter') { e.preventDefault(); addSibling(selectedId) }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteNode(selectedId) }
      else if (e.key === 'F2' || e.key === ' ') { e.preventDefault(); startEdit(selectedId) }
      else if (e.key === 'Escape') { setSelectedId(null); setPanel(null) }
      else if (e.key === 'ArrowLeft') {
        const p = findParent(r, selectedId)
        if (p) { e.preventDefault(); setSelectedId(p.id) }
      } else if (e.key === 'ArrowRight') {
        if (node.children.length && !node.collapsed) { e.preventDefault(); setSelectedId(node.children[0].id) }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const p = findParent(r, selectedId)
        if (!p) return
        const i = p.children.findIndex(c => c.id === selectedId)
        const sib = p.children[i + (e.key === 'ArrowUp' ? -1 : 1)]
        if (sib) { e.preventDefault(); setSelectedId(sib.id) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, editingId, linkModal, addChild, addSibling, deleteNode, deleteSticky, startEdit])

  useEffect(() => {
    if (!selectedId) setPanel(null)
  }, [selectedId])

  // The emoji picker only works on text being edited.
  useEffect(() => {
    if (!editingId) setPanel(p => (p === 'emoji' ? null : p))
  }, [editingId])

  const didInitView = useRef(false)
  useEffect(() => {
    if (didInitView.current || !isPhone() || !wrapRef.current || !sizes.has(root.id)) return
    didInitView.current = true
    const p = positions.get(root.id)
    const h = wrapRef.current.clientHeight
    rf.setViewport({ x: 16 - p.x * PHONE_ZOOM, y: h / 2 - (p.y + p.height / 2) * PHONE_ZOOM, zoom: PHONE_ZOOM })
  }, [positions, sizes, root.id, rf])

  // Keep the node being edited on screen (new nodes can land off-canvas).
  useEffect(() => {
    if (!editingId || !wrapRef.current) return
    const pos = positions.get(editingId)
    if (!pos) return
    const rect = wrapRef.current.getBoundingClientRect()
    const tl = rf.flowToScreenPosition({ x: pos.x, y: pos.y })
    const br = rf.flowToScreenPosition({ x: pos.x + pos.width, y: pos.y + pos.height })
    const margin = 40
    if (tl.x < rect.left + margin || br.x > rect.right - margin ||
        tl.y < rect.top + margin || br.y > rect.bottom - margin) {
      rf.setCenter(pos.x + pos.width / 2, pos.y + pos.height / 2, { zoom: rf.getZoom(), duration: 200 })
    }
  }, [editingId, positions, rf])

  // ── Save ──────────────────────────────────────────────────────────────────

  async function save(close) {
    setSaving(true)
    const m = mapRef.current
    await store.updateNote(note.id, {
      title: m.root.text.trim() || 'Mapa mental',
      content: serializeMap(m),
    })
    setSaving(false)
    if (close) { onClose(); return }
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }

  async function handleExport(kind) {
    if (exporting || !wrapRef.current) return
    setExporting(kind)
    // Drop selection first so its ring and + buttons don't end up in the file.
    setSelectedId(null)
    setEditingId(null)
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    const fileTitle = mapRef.current.root.text.trim() || 'Mapa mental'
    try {
      if (kind === 'png') await exportMindMapPng(rf, wrapRef.current, fileTitle)
      else await exportMindMapPdf(rf, wrapRef.current, fileTitle)
    } catch (err) {
      console.error(err)
      alert('Não foi possível exportar o mapa.')
    } finally {
      setExporting(null)
    }
  }

  const selectedSticky = selectedId ? stickies.find(s => s.id === selectedId) : null
  const selectedNode = selectedId && !selectedSticky ? findNode(root, selectedId) : null
  const selectedData = selectedNode ? treeFlow.nodes.find(n => n.id === selectedId)?.data : null
  const selectedColor = selectedSticky ? selectedSticky.color : selectedData?.color || null
  const selectedTextMode = selectedData?.textColorMode || 'auto'
  const hasSelection = !!(selectedNode || selectedSticky)

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => save(true)} disabled={saving} title="Salvar e voltar">
          <ArrowLeft size={16} /> <span className={styles.btnLabel}>Voltar</span>
        </button>
        <input
          className={styles.titleInput}
          value={root.text}
          onChange={e => {
            const text = e.target.value
            setRoot(r => ({ ...r, text }))
          }}
          placeholder="Título do mapa"
        />
        <button className={styles.exportBtn} onClick={() => handleExport('png')} disabled={!!exporting} title="Exportar como imagem PNG">
          <ImageIcon size={15} /> <span className={styles.btnLabel}>{exporting === 'png' ? 'Exportando...' : 'PNG'}</span>
        </button>
        <button className={styles.exportBtn} onClick={() => handleExport('pdf')} disabled={!!exporting} title="Exportar como PDF">
          <FileDown size={15} /> <span className={styles.btnLabel}>{exporting === 'pdf' ? 'Exportando...' : 'PDF'}</span>
        </button>
        <button className={styles.saveBtn} onClick={() => save(false)} disabled={saving}>
          <Check size={15} /> {saving ? 'Salvando...' : savedFlash ? 'Salvo!' : 'Salvar'}
        </button>
      </div>

      <div className={styles.canvas} ref={wrapRef}>
        <MapCtx.Provider value={ctx}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeClick={(_, n) => { if (n.id !== editingId) setEditingId(null); setSelectedId(n.id) }}
            onPaneClick={() => { setSelectedId(null); setEditingId(null) }}
            colorMode={currentTheme()}
            fitView={!isPhone()}
            fitViewOptions={FIT_OPTIONS}
            minZoom={0.1}
            maxZoom={2.5}
            zoomOnDoubleClick={false}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            nodeDragThreshold={6}
            nodesConnectable={false}
            elementsSelectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={22} size={1.2} />
            <Panel position="top-left" className={styles.zoomPanel}>
              <button type="button" className={styles.panelLabelBtn} onClick={addSticky} title="Bloco de notas">
                <StickyNote size={16} /> <span className={styles.btnLabel}>Bloco de notas</span>
              </button>
            </Panel>
            <Panel position="top-right" className={styles.zoomPanel}>
              <button type="button" onClick={() => rf.zoomOut({ duration: 150 })} title="Diminuir zoom"><ZoomOut size={16} /></button>
              <button type="button" onClick={() => rf.zoomIn({ duration: 150 })} title="Aumentar zoom"><ZoomIn size={16} /></button>
              <button type="button" onClick={() => rf.fitView({ ...FIT_OPTIONS, duration: 300 })} title="Ajustar à tela"><Maximize size={16} /></button>
            </Panel>
            {!hasSelection && (
              <Panel position="bottom-left" className={styles.hint}>
                Clique num tópico para selecionar · Tab: filho · Enter: irmão · Duplo clique: editar · Del: excluir · Arraste um tópico sobre outro para mudá-lo de lugar
              </Panel>
            )}
          </ReactFlow>
        </MapCtx.Provider>

        {/* While editing: emoji at the caret, and a way to finish on touch screens. */}
        {editingId && hasSelection && (
          <div className={styles.nodeToolbar} data-keep-edit onMouseDown={keepEditFocus}>
            <button
              type="button"
              className={panel === 'emoji' ? styles.toolActive : ''}
              onClick={() => setPanel(p => (p === 'emoji' ? null : 'emoji'))}
              title="Inserir emoji na posição do cursor"
            >
              <Smile size={15} /> <span className={styles.btnLabel}>Emoji</span>
            </button>
            <div className={styles.sep} />
            <button type="button" onClick={() => setEditingId(null)} title="Concluir edição">
              <Check size={15} /> <span className={styles.btnLabel}>Concluir</span>
            </button>
          </div>
        )}

        {selectedSticky && !editingId && (
          <div className={styles.nodeToolbar}>
            <button type="button" onClick={() => startEdit(selectedSticky.id, 'end')} title="Editar texto (duplo clique)">
              <Pencil size={14} /> <span className={styles.btnLabel}>Editar</span>
            </button>
            <div className={styles.sep} />
            <button
              type="button"
              className={panel === 'color' ? styles.toolActive : ''}
              onClick={() => setPanel(p => (p === 'color' ? null : 'color'))}
              title="Cor"
            >
              <span className={styles.colorDot} style={{ background: selectedColor }} />
              <span className={styles.btnLabel}>Cor</span>
            </button>
            <button type="button" onClick={() => openEmoji(selectedSticky.id)} title="Emoji">
              <Smile size={15} />
            </button>
            <div className={styles.sep} />
            <button
              type="button"
              className={styles.danger}
              onClick={() => deleteSticky(selectedSticky.id)}
              title="Excluir bloco (Del)"
            ><Trash2 size={14} /></button>
          </div>
        )}

        {selectedNode && !editingId && (
          <div className={styles.nodeToolbar}>
            <button type="button" onClick={() => addChild(selectedNode.id)} title="Adicionar filho (Tab)">
              <CornerDownRight size={15} /> <span className={styles.btnLabel}>Filho</span>
            </button>
            {selectedNode.id !== root.id && (
              <button type="button" onClick={() => addSibling(selectedNode.id)} title="Adicionar irmão (Enter)">
                <Plus size={15} /> <span className={styles.btnLabel}>Irmão</span>
              </button>
            )}
            <button type="button" onClick={() => startEdit(selectedNode.id)} title="Editar texto (duplo clique)">
              <Pencil size={14} />
            </button>
            <div className={styles.sep} />
            <button
              type="button"
              className={panel === 'color' ? styles.toolActive : ''}
              onClick={() => setPanel(p => (p === 'color' ? null : 'color'))}
              title="Cor"
            >
              <span className={styles.colorDot} style={{ background: selectedColor }} />
              <span className={styles.btnLabel}>Cor</span>
            </button>
            <button type="button" onClick={() => openEmoji(selectedNode.id)} title="Emoji">
              <Smile size={15} />
            </button>
            <button
              type="button"
              className={selectedNode.link ? styles.toolActive : ''}
              onClick={() => { setPanel(null); setLinkModal({ id: selectedNode.id, url: selectedNode.link || '' }) }}
              title="Link"
            >
              <Link2 size={15} />
            </button>
            {selectedNode.id !== root.id && (
              <>
                <div className={styles.sep} />
                <button
                  type="button"
                  className={styles.danger}
                  onClick={() => deleteNode(selectedNode.id)}
                  title="Excluir (Del)"
                ><Trash2 size={14} /></button>
              </>
            )}
          </div>
        )}

        {hasSelection && !editingId && panel === 'color' && (
          <div className={styles.popover} onPointerDown={e => e.stopPropagation()}>
            <div className={styles.popoverLabel}>{selectedSticky ? 'Cor do bloco' : 'Cor do ramo'}</div>
            <div className={styles.swatchGrid}>
              {MINDMAP_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  className={`${styles.swatch} ${selectedColor === c.value ? styles.swatchActive : ''}`}
                  style={{ background: c.value }}
                  title={c.label}
                  onClick={() => setColor(selectedId, c.value)}
                />
              ))}
            </div>
            <label className={styles.customColor} title="Escolher qualquer cor">
              <input
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(selectedColor || '') ? selectedColor : '#8b5cf6'}
                onChange={e => setColor(selectedId, e.target.value)}
              />
              <span>Cor personalizada</span>
              {!MINDMAP_COLORS.some(c => c.value === selectedColor) && (
                <span className={styles.customValue}>{selectedColor}</span>
              )}
            </label>
            {selectedNode && (
              <>
                <div className={styles.popoverLabel}>Cor do texto</div>
                <div className={styles.segmented}>
                  {[['auto', 'Automática'], ['dark', 'Escura'], ['light', 'Clara']].map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      className={selectedTextMode === mode ? styles.segActive : ''}
                      onClick={() => setTextColor(selectedNode.id, mode)}
                    >{label}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {editingId && panel === 'emoji' && (
          <div
            className={styles.popover}
            data-keep-edit
            onMouseDown={keepEditFocus}
            onPointerDown={e => e.stopPropagation()}
          >
            <div className={styles.popoverLabel}>Inserir emoji no cursor</div>
            <div className={styles.emojiGrid}>
              {EMOJIS.map(em => (
                <button key={em} type="button" onClick={() => insertEmoji(em)}>{em}</button>
              ))}
            </div>
            <div className={styles.emojiRow}>
              <input
                className={styles.emojiInput}
                placeholder="Ou digite/cole outro emoji"
                onKeyDown={e => e.stopPropagation()}
                onChange={e => {
                  const em = firstGrapheme(e.target.value.trim())
                  if (em) { e.target.value = ''; insertEmoji(em) }
                }}
              />
              <button
                type="button"
                className={styles.emojiRemove}
                onClick={() => editorRef.current?.transform(stripEmojis)}
                title="Remove todos os emojis deste texto"
              >
                Remover emojis
              </button>
            </div>
          </div>
        )}
      </div>

      {linkModal && (
        <Modal
          title={findNode(root, linkModal.id)?.link ? 'Editar link' : 'Adicionar link'}
          onClose={() => setLinkModal(null)}
          onSave={applyLink}
        >
          <div className={styles.linkField}>
            <label>URL (deixe vazio para remover)</label>
            <input
              autoFocus
              placeholder="https://..."
              value={linkModal.url}
              onChange={e => setLinkModal(m => ({ ...m, url: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') applyLink() }}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}

export default function MindMapEditor(props) {
  return (
    <ReactFlowProvider>
      <MindMapCanvas {...props} />
    </ReactFlowProvider>
  )
}
