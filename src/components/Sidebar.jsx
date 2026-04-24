import { useState } from 'react'
import { Plus, MoreHorizontal, Pencil, Trash2, LogOut, Sun, Moon } from 'lucide-react'
import styles from './Sidebar.module.css'

export default function Sidebar({ categories, workspace, selectedCat, onSelectCat, onAddCat, onEditCat, onDeleteCat, onLogout, isDark, onToggleTheme }) {
  const [menu, setMenu] = useState(null)

  const cats = categories.filter(c => c.workspace === workspace)
  const allCount = cats.reduce((acc, c) => acc, 0)

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>◆</span>
        <span className={styles.logoText}>RM Estudos</span>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Categorias</span>
          <button className={styles.addBtn} onClick={onAddCat}><Plus size={12} /></button>
        </div>

        <div className={`${styles.item} ${!selectedCat ? styles.active : ''}`} onClick={() => onSelectCat(null)}>
          <span className={styles.itemIcon}>◈</span>
          <span className={styles.itemName}>Todos</span>
        </div>

        {cats.map(cat => (
          <div key={cat.id} className={`${styles.item} ${selectedCat === cat.id ? styles.active : ''}`}
            onClick={() => onSelectCat(cat.id)}>
            <span className={styles.itemIcon}>{cat.icon}</span>
            <span className={styles.itemName}>{cat.name}</span>
            <button className={styles.menuBtn} onClick={e => { e.stopPropagation(); setMenu(menu === cat.id ? null : cat.id) }}>
              <MoreHorizontal size={14} />
            </button>
            {menu === cat.id && (
              <div className={styles.dropdown}>
                <button onClick={e => { e.stopPropagation(); onEditCat(cat); setMenu(null) }}>
                  <Pencil size={12} /> Editar
                </button>
                <button className={styles.danger} onClick={e => { e.stopPropagation(); onDeleteCat(cat.id); setMenu(null) }}>
                  <Trash2 size={12} /> Excluir
                </button>
              </div>
            )}
          </div>
        ))}
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
