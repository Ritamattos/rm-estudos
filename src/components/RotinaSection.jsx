import { useMemo, useState } from 'react'
import {
  Sun, Droplets, Cookie, CalendarDays, ShoppingCart, Scale, ClipboardCheck,
  ChevronLeft, ChevronRight, Dumbbell, Undo2, Shuffle, Star, Pencil, Trash2, Plus, Check, AlertTriangle,
} from 'lucide-react'
import SideDrawer, { DrawerCloseButton } from './SideDrawer'
import Modal from './Modal'
import { useRotinaStore } from '../hooks/useRotinaStore'
import {
  MEALS, MEAL_STATUS, SNACK_SLOTS, WATER_STEPS, WEEKDAYS,
  todayKey, addDays, weekStart, weekDays, weekdayOf, formatDay, fromKey, nowHHMM,
  waterTotal, formatMl, shoppingFromMenu, weekSummary, pickRandom,
} from '../lib/rotina'
// Same side-nav look as Atividades / Dados.
import nav from './AtividadesSection.module.css'
import styles from './RotinaSection.module.css'

const SECTIONS = [
  { id: 'hoje',     label: 'Hoje',               icon: <Sun size={15} /> },
  { id: 'agua',     label: 'Água',               icon: <Droplets size={15} /> },
  { id: 'lanches',  label: 'Lanches',            icon: <Cookie size={15} /> },
  { id: 'cardapio', label: 'Cardápio da semana', icon: <CalendarDays size={15} /> },
  { id: 'compras',  label: 'Lista de compras',   icon: <ShoppingCart size={15} /> },
  { id: 'peso',     label: 'Peso',               icon: <Scale size={15} /> },
  { id: 'resumo',   label: 'Resumo da semana',   icon: <ClipboardCheck size={15} /> },
]

const kgFmt = kg => `${Number(kg).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`

export default function RotinaSection({ user, navOpen = false, onCloseNav }) {
  const store = useRotinaStore(user)
  const [sectionId, setSectionId] = useState('hoje')
  const section = SECTIONS.find(s => s.id === sectionId)

  return (
    <div className={nav.wrapper}>
      <SideDrawer className={nav.nav} open={navOpen} onClose={onCloseNav} belowTabs>
        <div className={nav.navHeader}>
          <span className={nav.navTitle}>Rotina</span>
          <DrawerCloseButton onClose={onCloseNav} />
        </div>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            className={`${nav.navItem} ${s.id === sectionId ? nav.navItemActive : ''}`}
            onClick={() => { setSectionId(s.id); onCloseNav?.() }}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </SideDrawer>

      <div className={nav.content}>
        <div className={styles.wrap}>
          <div className={styles.topbar}>
            <h1 className={styles.title}>{section.label}</h1>
          </div>
          {store.saveError && (
            <div className={styles.error} role="alert">
              {store.saveError}
              <button onClick={store.clearSaveError} aria-label="Fechar aviso">✕</button>
            </div>
          )}
          {store.loading ? (
            <div className={styles.loading}><span>◆</span></div>
          ) : (
            <div className={styles.content}>
              {sectionId === 'hoje' && <Hoje store={store} />}
              {sectionId === 'agua' && <Agua store={store} />}
              {sectionId === 'lanches' && <Lanches store={store} />}
              {sectionId === 'cardapio' && <Cardapio store={store} />}
              {sectionId === 'compras' && <Compras store={store} />}
              {sectionId === 'peso' && <Peso store={store} />}
              {sectionId === 'resumo' && <Resumo store={store} />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── HOJE ─────────────────────────────────────────────────────────────────────
function DayNav({ dayKey, setDayKey }) {
  const today = todayKey()
  return (
    <div className={styles.dayNav}>
      <button className={styles.iconBtn} onClick={() => setDayKey(addDays(dayKey, -1))} aria-label="Dia anterior">
        <ChevronLeft size={18} />
      </button>
      <span className={styles.dayLabel}>
        {dayKey === today ? 'Hoje' : dayKey === addDays(today, -1) ? 'Ontem' : ''}
        <small>{formatDay(dayKey)}</small>
      </span>
      <button
        className={styles.iconBtn}
        onClick={() => setDayKey(addDays(dayKey, 1))}
        disabled={dayKey >= today}
        aria-label="Próximo dia"
      >
        <ChevronRight size={18} />
      </button>
      {dayKey !== today && <button className={styles.linkBtn} onClick={() => setDayKey(today)}>Voltar para hoje</button>}
    </div>
  )
}

function plannedFor(mealKey, dayKey, config, snacks) {
  if (!config) return ''
  if (mealKey === 'cafe') return config.cafe_padrao
  if (mealKey === 'almoco' || mealKey === 'janta') {
    return config.semana_ativa === 'B' ? config.marmita_b : config.marmita_a
  }
  const id = config.plano_lanches?.[weekdayOf(dayKey).key]?.[mealKey]
  return snacks.find(s => s.id === id)?.nome ?? ''
}

function Hoje({ store }) {
  const [dayKey, setDayKey] = useState(todayKey)
  const day = store.getDay(dayKey)
  const isToday = dayKey === todayKey()

  function setMeal(meal, status) {
    store.updateDay(dayKey, d => {
      const cur = d.refeicoes?.[meal] || {}
      const refeicoes = { ...d.refeicoes }
      if (cur.status === status) {
        delete refeicoes[meal] // tocar de novo desmarca
      } else {
        refeicoes[meal] = {
          ...cur,
          status,
          hora: status === 'pulei' ? '' : cur.hora || (isToday ? nowHHMM() : ''),
          nota: status === 'subst' ? cur.nota || '' : '',
        }
      }
      return { refeicoes }
    })
  }
  const setMealField = (meal, field, value) =>
    store.updateDay(dayKey, d => ({ refeicoes: { ...d.refeicoes, [meal]: { ...d.refeicoes?.[meal], [field]: value } } }))

  const skippedMain = MEALS.filter(m => m.main && day.refeicoes?.[m.key]?.status === 'pulei')

  return (
    <>
      <DayNav dayKey={dayKey} setDayKey={setDayKey} />

      {skippedMain.length > 0 && (
        <div className={styles.alert} role="status">
          <AlertTriangle size={16} />
          {skippedMain.length === 1
            ? `Você pulou o ${skippedMain[0].label.toLowerCase()}. Tente compensar com um lanche reforçado.`
            : `Você pulou ${skippedMain.length} refeições principais hoje. Tente compensar com lanches reforçados.`}
        </div>
      )}

      <div className={styles.meals}>
        {MEALS.map(m => {
          const r = day.refeicoes?.[m.key] || {}
          const skipped = r.status === 'pulei'
          const plan = plannedFor(m.key, dayKey, store.config, store.snacks)
          return (
            <div
              key={m.key}
              className={`${styles.meal} ${skipped && m.main ? styles.mealAlert : ''} ${skipped && !m.main ? styles.mealSkipped : ''} ${r.status && !skipped ? styles.mealDone : ''}`}
            >
              <div className={styles.mealHead}>
                <span className={styles.mealName}>
                  {m.label}
                  {m.main && <span className={styles.mainTag}>principal</span>}
                </span>
                {r.status && r.status !== 'pulei' && (
                  <input
                    type="time"
                    className={styles.timeInput}
                    value={r.hora || ''}
                    onChange={e => setMealField(m.key, 'hora', e.target.value)}
                    aria-label={`Horário — ${m.label}`}
                  />
                )}
              </div>
              {plan && <span className={styles.mealPlan}>Planejado: {plan}</span>}
              <div className={styles.statusRow} role="group" aria-label={m.label}>
                {MEAL_STATUS.map(s => (
                  <button
                    key={s.key}
                    className={`${styles.statusBtn} ${r.status === s.key ? styles[`status_${s.key}`] : ''}`}
                    aria-pressed={r.status === s.key}
                    onClick={() => setMeal(m.key, s.key)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {r.status === 'subst' && (
                <input
                  className={styles.noteInput}
                  placeholder="O que você comeu? Ex: pipoca"
                  maxLength={80}
                  value={r.nota || ''}
                  onChange={e => setMealField(m.key, 'nota', e.target.value)}
                  aria-label={`Substituição — ${m.label}`}
                />
              )}
            </div>
          )
        })}
      </div>

      <div className={styles.dayExtras}>
        <label className={styles.field}>
          <span>Acordei às</span>
          <input type="time" value={day.acordou || ''} onChange={e => store.updateDay(dayKey, { acordou: e.target.value })} />
        </label>
        <label className={styles.field}>
          <span>Dormi às</span>
          <input type="time" value={day.dormiu || ''} onChange={e => store.updateDay(dayKey, { dormiu: e.target.value })} />
        </label>
        <button
          className={`${styles.toggleBtn} ${day.treino ? styles.toggleOn : ''}`}
          aria-pressed={!!day.treino}
          onClick={() => store.updateDay(dayKey, { treino: !day.treino })}
        >
          <Dumbbell size={17} /> {day.treino ? 'Treinei hoje' : 'Dia de treino?'}
        </button>
      </div>

      <WaterCard store={store} dayKey={dayKey} compact />
    </>
  )
}

// ── ÁGUA ─────────────────────────────────────────────────────────────────────
function WaterCard({ store, dayKey, compact = false }) {
  const day = store.getDay(dayKey)
  const total = waterTotal(day)
  const goal = store.config?.meta_agua_ml || 2000
  const pct = Math.min(100, Math.round((total / goal) * 100))
  const log = day.agua_log || []

  return (
    <div className={styles.card}>
      <div className={styles.waterHead}>
        <span className={styles.cardTitle}><Droplets size={16} /> Água {compact ? '' : 'hoje'}</span>
        <span className={styles.waterTotal}>{formatMl(total)} <small>/ {formatMl(goal)}</small></span>
      </div>
      <div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={total} aria-label="Água bebida">
        <div className={`${styles.progressFill} ${pct >= 100 ? styles.progressDone : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.waterBtns}>
        {WATER_STEPS.map(ml => (
          <button key={ml} className={styles.bigBtn} onClick={() => store.updateDay(dayKey, d => ({ agua_log: [...(d.agua_log || []), ml] }))}>
            +{ml} ml
          </button>
        ))}
        <button
          className={`${styles.bigBtn} ${styles.ghostBtn}`}
          disabled={!log.length}
          onClick={() => store.updateDay(dayKey, d => ({ agua_log: (d.agua_log || []).slice(0, -1) }))}
          aria-label={log.length ? `Desfazer último (${log[log.length - 1]} ml)` : 'Desfazer último'}
        >
          <Undo2 size={16} /> Desfazer
        </button>
      </div>
      {pct >= 100 && <span className={styles.goodText}><Check size={14} /> Meta do dia batida!</span>}
    </div>
  )
}

function Agua({ store }) {
  const today = todayKey()
  const goal = store.config?.meta_agua_ml || 2000
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
  const values = last7.map(k => waterTotal(store.days.get(k)))
  const max = Math.max(goal, ...values) || 1

  return (
    <>
      <WaterCard store={store} dayKey={today} />

      <div className={styles.card}>
        <label className={styles.inlineField}>
          <span>Meta diária</span>
          <select
            value={goal}
            onChange={e => store.updateConfig({ meta_agua_ml: Number(e.target.value) })}
          >
            {[1500, 1750, 2000, 2250, 2500, 2750, 3000, 3500].map(ml => <option key={ml} value={ml}>{formatMl(ml)}</option>)}
          </select>
        </label>
      </div>

      <div className={styles.card}>
        <span className={styles.cardTitle}>Últimos 7 dias</span>
        <div className={styles.waterChart}>
          {last7.map((k, i) => (
            <div key={k} className={styles.waterCol} title={`${formatDay(k, { weekday: 'long', day: 'numeric', month: 'short' })}: ${formatMl(values[i])}`}>
              <span className={styles.waterVal}>{values[i] ? formatMl(values[i]) : '–'}</span>
              <div className={styles.waterBarTrack}>
                <div className={styles.trackGoal} style={{ bottom: `${(goal / max) * 100}%` }} />
                <div
                  className={`${styles.waterBar} ${values[i] >= goal ? styles.waterBarDone : ''}`}
                  style={{ height: `${(values[i] / max) * 100}%` }}
                />
              </div>
              <span className={styles.waterDay}>{k === today ? 'Hoje' : weekdayOf(k).short}</span>
            </div>
          ))}
        </div>
        <p className={styles.hint}>Linha tracejada = meta de {formatMl(goal)}. Barra verde = meta batida.</p>
      </div>
    </>
  )
}

// ── LANCHES ──────────────────────────────────────────────────────────────────
function SnackModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || { nome: '', ingredientes: '', preparo: '' })
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const save = () => { if (form.nome.trim()) onSave({ nome: form.nome.trim(), ingredientes: form.ingredientes.trim(), preparo: form.preparo.trim() }) }
  return (
    <Modal title={initial ? 'Editar lanche' : 'Novo lanche'} onClose={onClose} onSave={save}>
      <div className={styles.form}>
        <label className={styles.field}><span>Nome</span><input value={form.nome} onChange={set('nome')} autoFocus /></label>
        <label className={styles.field}>
          <span>Ingredientes <small>(separe por vírgula)</small></span>
          <input value={form.ingredientes} onChange={set('ingredientes')} placeholder="banana, leite, aveia" />
        </label>
        <label className={styles.field}><span>Modo de preparo</span><textarea value={form.preparo} onChange={set('preparo')} rows={3} /></label>
      </div>
    </Modal>
  )
}

function SnackCard({ snack, store, onEdit, highlight }) {
  return (
    <div className={`${styles.snack} ${highlight ? styles.snackPicked : ''}`}>
      <div className={styles.snackHead}>
        <span className={styles.snackName}>{snack.nome}</span>
        <div className={styles.snackActions}>
          <button
            className={`${styles.iconBtn} ${snack.favorito ? styles.favOn : ''}`}
            onClick={() => store.updateSnack(snack.id, { favorito: !snack.favorito })}
            aria-pressed={snack.favorito}
            aria-label={snack.favorito ? 'Tirar dos favoritos' : 'Favoritar'}
          >
            <Star size={16} fill={snack.favorito ? 'currentColor' : 'none'} />
          </button>
          <button className={styles.iconBtn} onClick={onEdit} aria-label="Editar"><Pencil size={15} /></button>
          <button
            className={styles.iconBtn}
            onClick={() => { if (confirm(`Excluir "${snack.nome}"?`)) store.deleteSnack(snack.id) }}
            aria-label="Excluir"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      {snack.ingredientes && <span className={styles.snackIng}>{snack.ingredientes}</span>}
      {snack.preparo && <p className={styles.snackPrep}>{snack.preparo}</p>}
    </div>
  )
}

function Lanches({ store }) {
  const [onlyFav, setOnlyFav] = useState(false)
  const [picked, setPicked] = useState(null)
  const [modal, setModal] = useState(null) // null | 'new' | snack
  const list = onlyFav ? store.snacks.filter(s => s.favorito) : store.snacks
  const pickedSnack = store.snacks.find(s => s.id === picked)

  const sortear = () => setPicked(pickRandom(list, picked)?.id ?? null)

  return (
    <>
      <div className={styles.toolbar}>
        <button className={styles.primaryBtn} onClick={sortear} disabled={!list.length}><Shuffle size={16} /> Sortear lanche</button>
        <button
          className={`${styles.toggleBtn} ${onlyFav ? styles.toggleOn : ''}`}
          aria-pressed={onlyFav}
          onClick={() => setOnlyFav(v => !v)}
        >
          <Star size={15} fill={onlyFav ? 'currentColor' : 'none'} /> Só favoritos
        </button>
        <button className={styles.secondaryBtn} onClick={() => setModal('new')}><Plus size={16} /> Adicionar</button>
      </div>

      {pickedSnack && (
        <div className={styles.pickedBox}>
          <span className={styles.pickedLabel}>Sorteado</span>
          <SnackCard snack={pickedSnack} store={store} onEdit={() => setModal(pickedSnack)} highlight />
        </div>
      )}

      {list.length === 0 ? (
        <p className={styles.hint}>{onlyFav ? 'Nenhum favorito ainda — toque na estrela de um lanche.' : 'Nenhum lanche cadastrado.'}</p>
      ) : (
        <div className={styles.snackGrid}>
          {list.map(s => <SnackCard key={s.id} snack={s} store={store} onEdit={() => setModal(s)} />)}
        </div>
      )}

      {modal && (
        <SnackModal
          initial={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={fields => {
            if (modal === 'new') store.addSnack(fields)
            else store.updateSnack(modal.id, fields)
            setModal(null)
          }}
        />
      )}
    </>
  )
}

// ── CARDÁPIO ─────────────────────────────────────────────────────────────────
function Cardapio({ store }) {
  const cfg = store.config || {}
  const week = cfg.semana_ativa === 'B' ? 'B' : 'A'
  const [editing, setEditing] = useState(week)
  const plano = cfg.plano_lanches || {}
  const snacks = store.snacks

  const setPlan = (day, slot, id) => {
    const next = { ...plano, [day]: { ...plano[day], [slot]: id || undefined } }
    if (!id) delete next[day][slot]
    store.updateConfig({ plano_lanches: next })
  }
  const sortearSemana = () => {
    const pool = snacks.some(s => s.favorito) ? snacks.filter(s => s.favorito) : snacks
    const next = {}
    let last = null
    for (const d of WEEKDAYS) {
      next[d.key] = {}
      for (const slot of SNACK_SLOTS) {
        const s = pickRandom(pool, last)
        if (s) { next[d.key][slot.key] = s.id; last = s.id }
      }
    }
    store.updateConfig({ plano_lanches: next })
  }

  const mKey = editing === 'B' ? 'marmita_b' : 'marmita_a'

  return (
    <>
      <div className={styles.card}>
        <span className={styles.cardTitle}><Sun size={16} /> Café da manhã padrão</span>
        <label className={styles.field}>
          <span>O que é</span>
          <input value={cfg.cafe_padrao || ''} onChange={e => store.updateConfig({ cafe_padrao: e.target.value })} placeholder="Ex: pão com ovo e café com leite" />
        </label>
        <label className={styles.field}>
          <span>Ingredientes <small>(vírgula; vão para a lista de compras)</small></span>
          <input value={cfg.cafe_ingredientes || ''} onChange={e => store.updateConfig({ cafe_ingredientes: e.target.value })} placeholder="pão francês, ovo, leite, café" />
        </label>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeadRow}>
          <span className={styles.cardTitle}>Marmita da semana</span>
          <div className={styles.segmented} role="group" aria-label="Semana em uso">
            {['A', 'B'].map(w => (
              <button key={w} aria-pressed={week === w} className={week === w ? styles.segOn : ''} onClick={() => { store.updateConfig({ semana_ativa: w }); setEditing(w) }}>
                Semana {w}
              </button>
            ))}
          </div>
        </div>
        <p className={styles.hint}>A semana marcada é a que vale agora (almoço e janta). {editing !== week && 'Você está editando a outra.'}</p>
        <div className={styles.tabsSmall}>
          {['A', 'B'].map(w => (
            <button key={w} className={editing === w ? styles.tabSmallOn : ''} onClick={() => setEditing(w)}>
              Editar Semana {w}{w === week ? ' (em uso)' : ''}
            </button>
          ))}
        </div>
        <label className={styles.field}>
          <span>Marmita — Semana {editing}</span>
          <input value={cfg[mKey] || ''} onChange={e => store.updateConfig({ [mKey]: e.target.value })} placeholder="Ex: arroz, feijão, frango e legumes" />
        </label>
        <label className={styles.field}>
          <span>Ingredientes <small>(vírgula)</small></span>
          <input value={cfg[`${mKey}_ingredientes`] || ''} onChange={e => store.updateConfig({ [`${mKey}_ingredientes`]: e.target.value })} placeholder="arroz, feijão, frango, cenoura" />
        </label>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeadRow}>
          <span className={styles.cardTitle}><Cookie size={16} /> Lanches planejados</span>
          <button className={styles.secondaryBtn} onClick={sortearSemana} disabled={!snacks.length}>
            <Shuffle size={15} /> Sortear semana
          </button>
        </div>
        <p className={styles.hint}>O sorteio usa seus favoritos (ou todos, se não houver favoritos).</p>
        <div className={styles.planGrid}>
          {WEEKDAYS.map(d => (
            <div key={d.key} className={styles.planDay}>
              <span className={styles.planDayName}>{d.label}</span>
              {SNACK_SLOTS.map(slot => (
                <label key={slot.key} className={styles.planSlot}>
                  <span>{slot.label}</span>
                  <select value={plano[d.key]?.[slot.key] || ''} onChange={e => setPlan(d.key, slot.key, e.target.value)}>
                    <option value="">—</option>
                    {snacks.map(s => <option key={s.id} value={s.id}>{s.favorito ? '★ ' : ''}{s.nome}</option>)}
                  </select>
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── LISTA DE COMPRAS ─────────────────────────────────────────────────────────
function Compras({ store }) {
  const [nome, setNome] = useState('')
  const [qtd, setQtd] = useState('')
  const items = [...store.shopping].sort((a, b) => Number(!!a.comprado) - Number(!!b.comprado) || a.nome.localeCompare(b.nome, 'pt-BR'))
  const bought = store.shopping.filter(i => i.comprado)

  const add = e => {
    e.preventDefault()
    if (!nome.trim()) return
    store.addShoppingItems([{ nome: nome.trim(), quantidade: qtd.trim() }])
    setNome(''); setQtd('')
  }

  const gerar = async () => {
    const generated = shoppingFromMenu(store.config, store.snacks)
    if (!generated.length) {
      alert('O cardápio ainda não tem ingredientes. Preencha os ingredientes do café, da marmita ou planeje lanches.')
      return
    }
    // Substitui só os itens gerados antes e ainda não comprados; os manuais
    // ficam, e um ingrediente que já está na lista (a comprar) não é repetido.
    const old = store.shopping.filter(i => i.origem === 'cardapio' && !i.comprado)
    const norm = s => s.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
    const pending = new Set(store.shopping.filter(i => !i.comprado && i.origem !== 'cardapio').map(i => norm(i.nome)))
    await store.deleteShoppingItems(old.map(i => i.id))
    await store.addShoppingItems(generated.filter(g => !pending.has(norm(g.nome))).map(g => ({ ...g, origem: 'cardapio' })))
  }

  return (
    <>
      <div className={styles.toolbar}>
        <button className={styles.primaryBtn} onClick={gerar}><CalendarDays size={16} /> Gerar do cardápio</button>
        <button
          className={styles.secondaryBtn}
          disabled={!bought.length}
          onClick={() => { if (confirm(`Remover ${bought.length} item(ns) comprado(s)?`)) store.deleteShoppingItems(bought.map(i => i.id)) }}
        >
          <Trash2 size={15} /> Limpar comprados
        </button>
      </div>

      <form className={styles.addRow} onSubmit={add}>
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Item (ex: banana)" aria-label="Item" />
        <input value={qtd} onChange={e => setQtd(e.target.value)} placeholder="Qtd (ex: 1 dúzia)" aria-label="Quantidade" className={styles.qtyInput} />
        <button type="submit" className={styles.primaryBtn} aria-label="Adicionar item"><Plus size={18} /></button>
      </form>

      {items.length === 0 ? (
        <p className={styles.hint}>Lista vazia. Gere a partir do cardápio ou adicione itens.</p>
      ) : (
        <ul className={styles.shopList}>
          {items.map(i => (
            <li key={i.id} className={`${styles.shopItem} ${i.comprado ? styles.shopDone : ''}`}>
              <label className={styles.shopCheck}>
                <input type="checkbox" checked={i.comprado} onChange={() => store.updateShoppingItem(i.id, { comprado: !i.comprado })} />
                <span className={styles.shopName}>{i.nome}</span>
              </label>
              {i.quantidade && <span className={styles.shopQty}>{i.quantidade}</span>}
              <button className={styles.iconBtn} onClick={() => store.deleteShoppingItems([i.id])} aria-label={`Remover ${i.nome}`}>
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

// ── PESO ─────────────────────────────────────────────────────────────────────
function WeightChart({ weights, goalKg, goalDate }) {
  const [hover, setHover] = useState(null)
  const W = 640, H = 240, P = { l: 40, r: 16, t: 16, b: 28 }
  const t = k => fromKey(k).getTime()
  const first = weights[0].data
  const last = weights[weights.length - 1]
  const xMin = t(first)
  const xMax = Math.max(t(goalDate), t(last.data), xMin + 7 * 864e5)
  const kgs = weights.map(w => Number(w.kg))
  const yMin = Math.floor(Math.min(...kgs, goalKg) - 1)
  const yMax = Math.ceil(Math.max(...kgs, goalKg) + 1)
  const x = k => P.l + ((t(k) - xMin) / (xMax - xMin)) * (W - P.l - P.r)
  const y = kg => P.t + (1 - (kg - yMin) / (yMax - yMin)) * (H - P.t - P.b)
  const ticks = []
  const step = yMax - yMin > 8 ? 2 : 1
  for (let v = yMin; v <= yMax; v += step) ticks.push(v)
  const path = weights.map((w, i) => `${i ? 'L' : 'M'}${x(w.data).toFixed(1)},${y(w.kg).toFixed(1)}`).join(' ')
  const lastKg = Number(last.kg)
  const h = hover != null ? weights[hover] : null

  return (
    <div className={styles.chartBox}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.weightSvg} role="img"
        aria-label={`Peso de ${kgFmt(kgs[0])} para ${kgFmt(lastKg)}; meta ${kgFmt(goalKg)}`}>
        {ticks.map(v => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} className={styles.gridLine} />
            <text x={P.l - 8} y={y(v) + 4} textAnchor="end" className={styles.axisText}>{v}</text>
          </g>
        ))}
        {/* meta */}
        <line x1={P.l} x2={W - P.r} y1={y(goalKg)} y2={y(goalKg)} className={styles.goalSvgLine} />
        <text x={W - P.r} y={y(goalKg) - 6} textAnchor="end" className={styles.goalSvgText}>Meta {kgFmt(goalKg)}</text>
        {/* caminho que falta: do último registro até a meta na data limite */}
        {lastKg < goalKg && (
          <line x1={x(last.data)} y1={y(lastKg)} x2={x(goalDate)} y2={y(goalKg)} className={styles.pathSvgLine} />
        )}
        <path d={path} className={styles.weightLine} />
        {weights.map((w, i) => (
          <g key={w.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}>
            <circle cx={x(w.data)} cy={y(w.kg)} r={14} fill="transparent" />
            <circle cx={x(w.data)} cy={y(w.kg)} r={hover === i ? 6 : 4.5} className={styles.weightDot} />
          </g>
        ))}
        <text x={x(last.data)} y={y(lastKg) - 12} textAnchor="middle" className={styles.lastLabel}>{kgFmt(lastKg)}</text>
        <text x={P.l} y={H - 8} className={styles.axisText}>{formatDay(first, { day: 'numeric', month: 'short' })}</text>
        <text x={W - P.r} y={H - 8} textAnchor="end" className={styles.axisText}>{formatDay(goalDate, { day: 'numeric', month: 'short' })}</text>
      </svg>
      {h && (
        <div className={styles.tooltip}>
          {formatDay(h.data, { day: 'numeric', month: 'short', year: 'numeric' })}: <strong>{kgFmt(h.kg)}</strong>
        </div>
      )}
    </div>
  )
}

function Peso({ store }) {
  const cfg = store.config || {}
  const goalKg = Number(cfg.meta_peso) || 48
  const goalDate = cfg.meta_data || '2027-02-28'
  const [data, setData] = useState(todayKey)
  const [kg, setKg] = useState('')
  const weights = store.weights
  const last = weights[weights.length - 1]
  const falta = last ? Math.max(0, goalKg - Number(last.kg)) : null
  const weeksLeft = Math.max(0, (fromKey(goalDate) - fromKey(todayKey())) / (7 * 864e5))
  const perWeek = falta != null && weeksLeft > 0 ? falta / weeksLeft : null

  const save = e => {
    e.preventDefault()
    const v = Number(String(kg).replace(',', '.'))
    if (!v || v < 20 || v > 200) return
    store.saveWeight(data, v)
    setKg('')
  }

  return (
    <>
      <div className={styles.statGrid}>
        <div className={styles.stat}><span>Peso atual</span><strong>{last ? kgFmt(last.kg) : '–'}</strong></div>
        <div className={styles.stat}><span>Meta</span><strong>{kgFmt(goalKg)}</strong></div>
        <div className={`${styles.stat} ${styles.statAccent}`}>
          <span>Falta</span>
          <strong>{falta == null ? '–' : falta === 0 ? 'Meta batida!' : kgFmt(falta)}</strong>
        </div>
        <div className={styles.stat}>
          <span>Ritmo necessário</span>
          <strong>{perWeek ? `${perWeek.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg/sem` : '–'}</strong>
        </div>
      </div>

      <form className={styles.card} onSubmit={save}>
        <span className={styles.cardTitle}><Scale size={16} /> Registrar peso</span>
        <div className={styles.addRow}>
          <input type="date" value={data} max={todayKey()} onChange={e => setData(e.target.value)} aria-label="Data" />
          <input inputMode="decimal" value={kg} onChange={e => setKg(e.target.value)} placeholder="kg (ex: 39,4)" aria-label="Peso em kg" className={styles.qtyInput} />
          <button type="submit" className={styles.primaryBtn}>Salvar</button>
        </div>
        <p className={styles.hint}>Uma vez por semana, de preferência no mesmo dia e horário (ex: segunda de manhã, em jejum).</p>
      </form>

      <div className={styles.card}>
        <span className={styles.cardTitle}>Evolução até a meta</span>
        {weights.length === 0
          ? <p className={styles.hint}>Registre seu primeiro peso para ver o gráfico.</p>
          : <WeightChart weights={weights} goalKg={goalKg} goalDate={goalDate} />}
        {weights.length > 0 && (
          <p className={styles.hint}>Linha tracejada: o caminho até {kgFmt(goalKg)} em {formatDay(goalDate, { day: 'numeric', month: 'long' })}.</p>
        )}
      </div>

      {weights.length > 0 && (
        <div className={styles.card}>
          <span className={styles.cardTitle}>Registros</span>
          <table className={styles.table}>
            <thead><tr><th>Data</th><th>Peso</th><th>Variação</th><th /></tr></thead>
            <tbody>
              {[...weights].reverse().map((w, i, arr) => {
                const prev = arr[i + 1]
                const diff = prev ? Number(w.kg) - Number(prev.kg) : null
                return (
                  <tr key={w.id}>
                    <td>{formatDay(w.data, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td>{kgFmt(w.kg)}</td>
                    <td className={diff > 0 ? styles.upCell : diff < 0 ? styles.badText : ''}>
                      {diff == null ? '–' : `${diff > 0 ? '+' : ''}${diff.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`}
                    </td>
                    <td>
                      <button className={styles.iconBtn} onClick={() => { if (confirm('Excluir este registro?')) store.deleteWeight(w.id) }} aria-label="Excluir registro">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.card}>
        <span className={styles.cardTitle}>Meta</span>
        <div className={styles.addRow}>
          <label className={styles.field}>
            <span>Peso meta (kg)</span>
            <input inputMode="decimal" defaultValue={goalKg} onBlur={e => { const v = Number(e.target.value.replace(',', '.')); if (v > 0) store.updateConfig({ meta_peso: v }) }} />
          </label>
          <label className={styles.field}>
            <span>Até</span>
            <input type="date" value={goalDate} onChange={e => e.target.value && store.updateConfig({ meta_data: e.target.value })} />
          </label>
        </div>
      </div>
    </>
  )
}

// ── RESUMO ───────────────────────────────────────────────────────────────────
function Resumo({ store }) {
  const today = todayKey()
  const [start, setStart] = useState(() => weekStart(today))
  const s = useMemo(() => weekSummary(start, store.days, today), [start, store.days, today])
  const days = weekDays(start)
  const goal = store.config?.meta_agua_ml || 2000
  const isCurrent = start === weekStart(today)

  return (
    <>
      <div className={styles.dayNav}>
        <button className={styles.iconBtn} onClick={() => setStart(addDays(start, -7))} aria-label="Semana anterior"><ChevronLeft size={18} /></button>
        <span className={styles.dayLabel}>
          {isCurrent ? 'Esta semana' : 'Semana'}
          <small>{formatDay(days[0], { day: 'numeric', month: 'short' })} – {formatDay(days[6], { day: 'numeric', month: 'short' })}</small>
        </span>
        <button className={styles.iconBtn} onClick={() => setStart(addDays(start, 7))} disabled={isCurrent} aria-label="Próxima semana"><ChevronRight size={18} /></button>
      </div>

      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <span>Refeições feitas</span>
          <strong>{s.feitas}</strong>
          {s.substituidas > 0 && <small>{s.substituidas} substituída(s)</small>}
        </div>
        <div className={`${styles.stat} ${s.puladas ? styles.statAlert : ''}`}>
          <span>Puladas</span>
          <strong>{s.puladas}</strong>
          {s.principaisPuladas > 0 && <small>{s.principaisPuladas} principal(is)</small>}
        </div>
        <div className={styles.stat}>
          <span>Água / dia (média)</span>
          <strong>{formatMl(s.aguaMedia)}</strong>
          <small>meta {formatMl(goal)}</small>
        </div>
        <div className={styles.stat}><span>Dias de treino</span><strong>{s.treinos}</strong></div>
        <div className={styles.stat}><span>Acordou (média)</span><strong>{s.acordarMedio ?? '–'}</strong></div>
      </div>

      <div className={styles.card}>
        <span className={styles.cardTitle}>Dia a dia</span>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Dia</th><th>Feitas</th><th>Puladas</th><th>Água</th><th>Treino</th><th>Acordou</th><th>Dormiu</th></tr></thead>
            <tbody>
              {days.map(k => {
                const d = store.days.get(k)
                const future = k > today
                const st = st2 => MEALS.filter(m => d?.refeicoes?.[m.key]?.status === st2).length
                const feitas = d ? st('comi') + st('subst') : 0
                const pul = d ? st('pulei') : 0
                const mainSkip = d && MEALS.some(m => m.main && d.refeicoes?.[m.key]?.status === 'pulei')
                return (
                  <tr key={k} className={future ? styles.rowFuture : ''}>
                    <td>{weekdayOf(k).short} {fromKey(k).getDate()}</td>
                    <td>{future ? '' : `${feitas}/6`}</td>
                    <td className={mainSkip ? styles.badText : ''}>{future ? '' : pul}</td>
                    <td>{future ? '' : formatMl(waterTotal(d))}</td>
                    <td>{d?.treino ? <Dumbbell size={14} aria-label="Treinou" /> : ''}</td>
                    <td>{d?.acordou || ''}</td>
                    <td>{d?.dormiu || ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
