import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Handle, Panel, Position, useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowLeft, Check, Plus, CornerDownRight, Pencil, Trash2, ZoomIn, ZoomOut, Maximize,
  Image as ImageIcon, FileDown,
} from 'lucide-react'
import {
  MINDMAP_COLORS, createNode, parseMap, serializeMap, findNode, findParent,
  updateNode, removeNode, insertChild, countDescendants, layoutMap, toFlow,
  recolorBranch, levelOf,
} from '../lib/mindmap'
import { exportMindMapPng, exportMindMapPdf } from '../lib/exportMindMap'
import styles from './MindMapEditor.module.css'

const MapCtx = createContext(null)

const FIT_OPTIONS = { padding: 0.2, maxZoom: 1 }

// Auto-growing textarea: the hidden ::after copy of the text sizes the grid
// cell, and the textarea stretches to fill it.
function NodeTextInput({ initial, onCommit, onCancel, onTab }) {
  const [value, setValue] = useState(initial)
  const ref = useRef()
  const done = useRef(false)
  const valueRef = useRef(value)
  valueRef.current = value
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit

  useEffect(() => {
    // A brand-new node stays visibility:hidden until React Flow measures it,
    // and hidden elements can't take focus — retry for a few frames.
    let frame, tries = 0
    function focus() {
      const el = ref.current
      if (!el) return
      el.focus()
      if (document.activeElement === el) el.select()
      else if (tries++ < 20) frame = requestAnimationFrame(focus)
    }
    focus()
    return () => {
      cancelAnimationFrame(frame)
      // Unmounted without a blur (e.g. another node selected via keyboard):
      // keep what was typed instead of silently dropping it.
      if (!done.current) commitRef.current(valueRef.current)
    }
  }, [])

  function finish(commit) {
    if (done.current) return
    done.current = true
    commit ? onCommit(value) : onCancel()
  }

  return (
    <div className={styles.inputGrow} data-value={value}>
      <textarea
        ref={ref}
        rows={1}
        className={`${styles.nodeInput} nodrag nopan nowheel`}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={e => {
          e.stopPropagation()
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true) }
          else if (e.key === 'Escape') { e.preventDefault(); finish(false) }
          else if (e.key === 'Tab') { e.preventDefault(); finish(true); onTab() }
        }}
      />
    </div>
  )
}

const MindNode = memo(function MindNode({ id, data }) {
  const ctx = useContext(MapCtx)
  const selected = ctx.selectedId === id
  const editing = ctx.editingId === id
  const { text, color, onColor, textColor, depth, isRoot, childCount, hiddenCount, collapsed } = data

  return (
    <div
      className={`${styles.node} ${LEVEL_CLASS[levelOf(depth)]} ${selected ? styles.nodeSelected : ''}`}
      style={{ '--node-color': color, '--node-on': onColor, ...(textColor ? { color: textColor } : null) }}
      onDoubleClick={e => { e.stopPropagation(); ctx.startEdit(id) }}
    >
      <Handle type="target" position={Position.Left} className={styles.handle} isConnectable={false} />
      {editing ? (
        <NodeTextInput
          initial={text}
          onCommit={v => ctx.commitEdit(id, v)}
          onCancel={ctx.cancelEdit}
          onTab={() => ctx.addChild(id)}
        />
      ) : (
        <span className={styles.nodeText}>{text || ' '}</span>
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

const nodeTypes = { mind: MindNode }

const LEVEL_CLASS = [styles.rootNode, styles.level1, styles.level2, styles.level3, styles.level4]

const isPhone = () => window.innerWidth < 640

// On phones, fitting a whole map on open shrinks the text to illegible
// sizes, so the map opens at a readable zoom anchored on the central node
// instead ("Ajustar à tela" still shows everything on demand).
const PHONE_ZOOM = 0.8

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
}

function MindMapCanvas({ note, store, onClose }) {
  const rf = useReactFlow()
  const [map, setMap] = useState(() => parseMap(note.content, note.title))
  const [sizes, setSizes] = useState(() => new Map())
  const [selectedId, setSelectedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [exporting, setExporting] = useState(null)
  const [panel, setPanel] = useState(null) // open toolbar popover: 'color' | null
  const wrapRef = useRef()
  const mapRef = useRef(map)
  mapRef.current = map

  const root = map.root
  const setRoot = useCallback(fn => {
    setMap(m => ({ ...m, root: fn(m.root) }))
  }, [])

  const positions = useMemo(() => layoutMap(root, sizes), [root, sizes])
  const { nodes, edges } = useMemo(() => {
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
    })
    return flow
  }, [root, positions, sizes])

  const onNodesChange = useCallback(changes => {
    setSizes(prev => {
      let next = prev
      for (const ch of changes) {
        if (ch.type !== 'dimensions' || !ch.dimensions) continue
        const old = prev.get(ch.id)
        const { width, height } = ch.dimensions
        if (old && Math.abs(old.width - width) < 0.5 && Math.abs(old.height - height) < 0.5) continue
        if (next === prev) next = new Map(prev)
        next.set(ch.id, { width, height })
      }
      return next
    })
  }, [])

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
    setRoot(r => recolorBranch(r, id, color))
  }, [setRoot])

  const setTextColor = useCallback((id, mode) => {
    setRoot(r => updateNode(r, id, n => ({ ...n, textColor: mode })))
  }, [setRoot])

  const startEdit = useCallback(id => {
    setSelectedId(id)
    setEditingId(id)
  }, [])

  const commitEdit = useCallback((id, value) => {
    const text = value.trim()
    if (text) setRoot(r => updateNode(r, id, n => ({ ...n, text })))
    setEditingId(cur => (cur === id ? null : cur))
  }, [setRoot])

  const cancelEdit = useCallback(() => setEditingId(null), [])

  const ctx = useMemo(() => ({
    selectedId, editingId, addChild, addSibling, toggleCollapse, startEdit, commitEdit, cancelEdit,
  }), [selectedId, editingId, addChild, addSibling, toggleCollapse, startEdit, commitEdit, cancelEdit])

  // ── Keyboard ──────────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e) {
      if (editingId) {
        if (e.key === 'Tab') e.preventDefault() // don't let focus wander to the node buttons
        return
      }
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return
      if (!selectedId) return
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
  }, [selectedId, editingId, addChild, addSibling, deleteNode, startEdit])

  useEffect(() => {
    if (!selectedId) setPanel(null)
  }, [selectedId])

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

  const selectedNode = selectedId ? findNode(root, selectedId) : null
  const selectedData = selectedNode ? nodes.find(n => n.id === selectedId)?.data : null
  const selectedColor = selectedData?.color || null
  const selectedTextMode = selectedData?.textColorMode || 'auto'

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
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={22} size={1.2} />
            <Panel position="top-right" className={styles.zoomPanel}>
              <button type="button" onClick={() => rf.zoomOut({ duration: 150 })} title="Diminuir zoom"><ZoomOut size={16} /></button>
              <button type="button" onClick={() => rf.zoomIn({ duration: 150 })} title="Aumentar zoom"><ZoomIn size={16} /></button>
              <button type="button" onClick={() => rf.fitView({ ...FIT_OPTIONS, duration: 300 })} title="Ajustar à tela"><Maximize size={16} /></button>
            </Panel>
            {!selectedNode && (
              <Panel position="bottom-left" className={styles.hint}>
                Clique num tópico para selecionar · Tab: filho · Enter: irmão · Duplo clique: editar · Del: excluir
              </Panel>
            )}
          </ReactFlow>
        </MapCtx.Provider>

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

        {selectedNode && !editingId && panel === 'color' && (
          <div className={styles.popover} onPointerDown={e => e.stopPropagation()}>
            <div className={styles.popoverLabel}>Cor do ramo</div>
            <div className={styles.swatchGrid}>
              {MINDMAP_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  className={`${styles.swatch} ${selectedColor === c.value ? styles.swatchActive : ''}`}
                  style={{ background: c.value }}
                  title={c.label}
                  onClick={() => setColor(selectedNode.id, c.value)}
                />
              ))}
            </div>
            <label className={styles.customColor} title="Escolher qualquer cor">
              <input
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(selectedColor || '') ? selectedColor : '#8b5cf6'}
                onChange={e => setColor(selectedNode.id, e.target.value)}
              />
              <span>Cor personalizada</span>
              {!MINDMAP_COLORS.some(c => c.value === selectedColor) && (
                <span className={styles.customValue}>{selectedColor}</span>
              )}
            </label>
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
          </div>
        )}
      </div>
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
