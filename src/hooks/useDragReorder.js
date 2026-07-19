import { useCallback, useState } from 'react'

// Generic native-HTML5-DnD reordering helper shared by every sidebar-style
// nav list (Sidebar categories/subcategories, Biblioteca/Cinemateca category
// lists). One instance can drive multiple independent lists at once because
// the list + callback are only resolved at drop time, not at hook-creation
// time — dragging an id that isn't part of the list being dropped onto is
// simply a no-op.
export function useDragReorder() {
  const [draggingId, setDraggingId] = useState(null)
  const [overId, setOverId] = useState(null)

  const dragStart = useCallback((e, id) => {
    e.stopPropagation()
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const dragOver = useCallback((e, id) => {
    e.preventDefault()
    e.stopPropagation()
    setOverId(prev => (prev === id ? prev : id))
  }, [])

  const dragEnd = useCallback((e) => {
    e?.stopPropagation()
    setDraggingId(null)
    setOverId(null)
  }, [])

  const drop = useCallback((e, id, ids, onReorder) => {
    e.preventDefault()
    e.stopPropagation()
    setDraggingId(current => {
      if (current && current !== id) {
        const from = ids.indexOf(current)
        const to = ids.indexOf(id)
        if (from !== -1 && to !== -1 && from !== to) {
          const next = [...ids]
          next.splice(from, 1)
          next.splice(to, 0, current)
          onReorder(next)
        }
      }
      return null
    })
    setOverId(null)
  }, [])

  return { draggingId, overId, dragStart, dragOver, dragEnd, drop }
}
