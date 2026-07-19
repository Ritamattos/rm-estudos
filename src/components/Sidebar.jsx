import { useState } from 'react'
import { Plus, MoreHorizontal, Pencil, Trash2, LogOut, Sun, Moon, ChevronRight } from 'lucide-react'
import { useDragReorder } from '../hooks/useDragReorder'
import styles from './Sidebar.module.css'

export default function Sidebar({
  categories, subcategories, workspace,
  selectedCat, selectedSub,
  onSelectCat, onSelectSub,
  onAddCat, onEditCat, onDeleteCat,
  onAddSub, onEditSub, onDeleteSub,
  onReorderCategories, onReorderSubcategories,
  onLogout, isDark, onToggleTheme
}) {
  const [menu, setMenu] = useState(null)
  const [subMenu, setSubMenu] = useState(null)
  const [expanded, setExpanded] = useState({})
  const { draggingId, overId, dragStart, dragOver, dragEnd, drop } = useDragReorder()

  const byOrder = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  const cats = categories.filter(c => c.workspace === workspace).sort(byOrder)
  const catIds = cats.map(c => c.id)

  function toggleExpand(catId, e) {
    e.stopPropagation()
    setExpanded(prev => ({ ...prev, [catId]: !prev[catId] }))
  }

  function getSubs(catId) {
    return subcategories.filter(s => s.cat_id === catId).sort(byOrder)
  }

  function closeMenus() { setMenu(null); setSubMenu(null) }

  return (
    <aside className={styles.sidebar} onClick={closeMenus}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>◆</span>
        <span className={styles.logoText}>RM Estudos</span>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Categorias</span>
          <button className={styles.addBtn} onClick={e => { e.stopPropagation(); onAddCat() }}><Plus size={12} /></button>
        </div>

        {cats.map(cat => {
          const subs = getSubs(cat.id)
          const subIds = subs.map(s => s.id)
          const isExpanded = expanded[cat.id]
          const isActive = selectedCat === cat.id && !selectedSub

          return (
            <div key={cat.id}>
              <div className={`${styles.item} ${isActive ? styles.active : ''} ${draggingId === cat.id ? styles.dragging : ''} ${overId === cat.id ? styles.dragOver : ''}`}
                draggable
                onDragStart={e => dragStart(e, cat.id)}
                onDragOver={e => dragOver(e, cat.id)}
                onDrop={e => drop(e, cat.id, catIds, onReorderCategories)}
                onDragEnd={dragEnd}
                onClick={e => { e.stopPropagation(); onSelectCat(cat.id) }}>
                <button
                  className={`${styles.chevronBtn} ${isExpanded ? styles.chevronOpen : ''} ${subs.length === 0 ? styles.chevronHidden : ''}`}
                  onClick={e => toggleExpand(cat.id, e)}>
                  <ChevronRight size={11} />
                </button>
                <span className={styles.itemIcon}>{cat.icon}</span>
                <span className={styles.itemName}>{cat.name}</span>
                <button className={styles.menuBtn} onClick={e => { e.stopPropagation(); setMenu(menu === cat.id ? null : cat.id) }}>
                  <MoreHorizontal size={14} />
                </button>
                {menu === cat.id && (
                  <div className={styles.dropdown}>
                    <button onClick={e => { e.stopPropagation(); onAddSub(cat.id); closeMenus() }}>
                      <Plus size={12} /> Add subcategoria
                    </button>
                    <button onClick={e => { e.stopPropagation(); onEditCat(cat); closeMenus() }}>
                      <Pencil size={12} /> Editar
                    </button>
                    <button className={styles.danger} onClick={e => { e.stopPropagation(); onDeleteCat(cat.id); closeMenus() }}>
                      <Trash2 size={12} /> Excluir
                    </button>
                  </div>
                )}
              </div>

              {isExpanded && (
                <div className={styles.subGroup}>
                  {subs.map(sub => (
                    <div key={sub.id}
                      className={`${styles.subItem} ${selectedSub === sub.id ? styles.active : ''} ${draggingId === sub.id ? styles.dragging : ''} ${overId === sub.id ? styles.dragOver : ''}`}
                      draggable
                      onDragStart={e => dragStart(e, sub.id)}
                      onDragOver={e => dragOver(e, sub.id)}
                      onDrop={e => drop(e, sub.id, subIds, ids => onReorderSubcategories(cat.id, ids))}
                      onDragEnd={dragEnd}
                      onClick={e => { e.stopPropagation(); onSelectSub(cat.id, sub.id) }}>
                      <span className={styles.itemIcon}>{sub.icon}</span>
                      <span className={styles.itemName}>{sub.name}</span>
                      <button className={styles.menuBtn} onClick={e => { e.stopPropagation(); setSubMenu(subMenu === sub.id ? null : sub.id) }}>
                        <MoreHorizontal size={14} />
                      </button>
                      {subMenu === sub.id && (
                        <div className={styles.dropdown}>
                          <button onClick={e => { e.stopPropagation(); onEditSub(sub); closeMenus() }}>
                            <Pencil size={12} /> Editar
                          </button>
                          <button className={styles.danger} onClick={e => { e.stopPropagation(); onDeleteSub(sub.id); closeMenus() }}>
                            <Trash2 size={12} /> Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className={styles.bottom}>
        <button className={styles.themeBtn} onClick={onToggleTheme}>
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
          {isDark ? 'Modo claro' : 'Modo escuro'}
        </button>
        <button className={styles.logoutBtn} onClick={onLogout}>
          <LogOut size={14} /> Sair
        </button>
      </div>
    </aside>
  )
}
