import { useMemo, useState } from 'react'
import { Plus, Trash2, Pencil, Check, Circle } from 'lucide-react'
import styles from './DiarioList.module.css'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function thisMonthISO() {
  return todayISO().slice(0, 7)
}

function formatDateHeader(dateStr) {
  const today = todayISO()
  if (dateStr === today) return 'Hoje'
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (dateStr === tomorrow.toISOString().slice(0, 10)) return 'Amanhã'
  const d = new Date(`${dateStr}T00:00:00`)
  const label = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function isOverdue(activity) {
  return activity.status !== 'concluido' && activity.activity_date < todayISO()
}

const FILTER_MODES = [
  { value: 'dia',       label: 'Dia' },
  { value: 'intervalo', label: 'Intervalo' },
  { value: 'mes',       label: 'Mês' },
]

export default function DiarioList({ store }) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState(todayISO())
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')

  const [filterMode, setFilterMode] = useState('dia')
  const [filterDate, setFilterDate] = useState(todayISO())
  const [rangeStart, setRangeStart] = useState(todayISO())
  const [rangeEnd, setRangeEnd] = useState(todayISO())
  const [filterMonth, setFilterMonth] = useState(thisMonthISO())

  function goToday() {
    setFilterMode('dia')
    setFilterDate(todayISO())
  }

  const filtered = useMemo(() => {
    return store.dailyActivities.filter(a => {
      if (filterMode === 'dia') return a.activity_date === filterDate
      if (filterMode === 'intervalo') {
        const start = rangeStart <= rangeEnd ? rangeStart : rangeEnd
        const end = rangeStart <= rangeEnd ? rangeEnd : rangeStart
        return a.activity_date >= start && a.activity_date <= end
      }
      // mes
      return a.activity_date.slice(0, 7) === filterMonth
    })
  }, [store.dailyActivities, filterMode, filterDate, rangeStart, rangeEnd, filterMonth])

  const groups = useMemo(() => {
    const byDate = {}
    for (const a of filtered) {
      if (!byDate[a.activity_date]) byDate[a.activity_date] = []
      byDate[a.activity_date].push(a)
    }
    return Object.keys(byDate).sort().map(date => ({ date, items: byDate[date] }))
  }, [filtered])

  async function submitAdd() {
    if (!newTitle.trim()) return
    await store.addActivity(newTitle.trim(), newDate)
    setNewTitle('')
    setNewDate(todayISO())
    setAdding(false)
  }

  function startEdit(a) {
    setEditingId(a.id)
    setEditTitle(a.title)
  }

  async function submitEdit(a) {
    if (editTitle.trim() && editTitle.trim() !== a.title) {
      await store.updateActivity(a.id, { title: editTitle.trim() })
    }
    setEditingId(null)
  }

  function toggleStatus(a) {
    store.updateActivity(a.id, { status: a.status === 'concluido' ? 'em_progresso' : 'concluido' })
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.title}>Diário</h1>
          <span className={styles.subtitle}>
            {filtered.length} atividade{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button className={styles.addBtn} onClick={() => setAdding(true)}>
          <Plus size={15} /> Nova atividade
        </button>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterModes}>
          {FILTER_MODES.map(m => (
            <button
              key={m.value}
              className={`${styles.filterModeBtn} ${filterMode === m.value ? styles.filterModeBtnActive : ''}`}
              onClick={() => setFilterMode(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {filterMode === 'dia' && (
          <input type="date" className={styles.filterInput} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        )}
        {filterMode === 'intervalo' && (
          <div className={styles.filterRange}>
            <input type="date" className={styles.filterInput} value={rangeStart} onChange={e => setRangeStart(e.target.value)} />
            <span className={styles.filterRangeSep}>até</span>
            <input type="date" className={styles.filterInput} value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} />
          </div>
        )}
        {filterMode === 'mes' && (
          <input type="month" className={styles.filterInput} value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
        )}

        <button className={styles.todayBtn} onClick={goToday}>Hoje</button>
      </div>

      {adding && (
        <div className={styles.addForm}>
          <input
            autoFocus
            className={styles.addInput}
            placeholder="Título da atividade"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitAdd() }}
          />
          <input
            type="date"
            className={styles.addDateInput}
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
          />
          <button className={styles.addConfirm} onClick={submitAdd}>Adicionar</button>
          <button className={styles.addCancel} onClick={() => { setAdding(false); setNewTitle('') }}>Cancelar</button>
        </div>
      )}

      <div className={styles.list}>
        {groups.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>◆</div>
            <p>Nenhuma atividade neste período</p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.date} className={styles.group}>
              <div className={`${styles.groupHeader} ${group.date === todayISO() ? styles.groupHeaderToday : ''}`}>
                {formatDateHeader(group.date)}
              </div>
              {group.items.map(a => {
                const overdue = isOverdue(a)
                return (
                  <div key={a.id} className={`${styles.item} ${a.status === 'concluido' ? styles.itemDone : ''}`}>
                    <button
                      className={`${styles.checkBtn} ${a.status === 'concluido' ? styles.checkBtnDone : ''}`}
                      onClick={() => toggleStatus(a)}
                      title={a.status === 'concluido' ? 'Marcar como em progresso' : 'Marcar como concluído'}
                    >
                      {a.status === 'concluido' ? <Check size={14} /> : <Circle size={14} />}
                    </button>

                    <div className={styles.itemMain}>
                      {editingId === a.id ? (
                        <input
                          autoFocus
                          className={styles.editInput}
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') submitEdit(a)
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                          onBlur={() => submitEdit(a)}
                        />
                      ) : (
                        <span className={styles.itemTitle}>{a.title}</span>
                      )}
                    </div>

                    <span
                      className={`${styles.statusBadge} ${
                        overdue ? styles.statusOverdue : a.status === 'concluido' ? styles.statusDone : styles.statusProgress
                      }`}
                    >
                      {overdue ? 'Atrasado' : a.status === 'concluido' ? 'Concluído' : 'Em progresso'}
                    </span>

                    <input
                      type="date"
                      className={styles.dateInput}
                      value={a.activity_date}
                      onChange={e => store.updateActivity(a.id, { activity_date: e.target.value })}
                      title="Mudar data"
                    />

                    <button className={styles.iconBtn} onClick={() => startEdit(a)} title="Editar">
                      <Pencil size={13} />
                    </button>
                    <button
                      className={`${styles.iconBtn} ${styles.danger}`}
                      onClick={() => { if (confirm('Excluir atividade?')) store.deleteActivity(a.id) }}
                      title="Excluir"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
