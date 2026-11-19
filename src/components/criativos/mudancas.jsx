// Changes typed for an offer ("Mudanças registradas"): colors, icons,
// markers, the create/edit form, the per-criativo timeline and the
// missing-migration notice. Used by the criativo detail, the offer table,
// the period calendar and the "Análise" tab.
// Dates are "YYYY-MM-DD" in America/Sao_Paulo (see lib/periodo).
import { useState } from 'react'
import {
  Split, TrendingUp, TrendingDown, Pause, Play, Sparkles, CircleDot,
  Pencil, Trash2, Plus, Copy, Check, AlertTriangle, ChevronDown,
} from 'lucide-react'
import { TIPOS_EVENTO, TIPO_EVENTO_LABEL } from '../../lib/analiseConfig'
import { hojeSP, addDays, ddmm } from '../../lib/periodo'
import { Field, InfoTip, parseNum, numToInput } from './shared'
import sqlMigracao from '../../../supabase/migrations/022_criativos_eventos_orcamento.sql?raw'
import styles from './Criativos.module.css'

// ── Tipos: cor (CSS var por tema, em index.css) + ícone ─────────────────────

export const EVENTO_ICON = {
  separou: Split,
  aumentou: TrendingUp,
  reduziu: TrendingDown,
  pausou: Pause,
  reativou: Play,
  novo: Sparkles,
  outro: CircleDot,
}
export const evCor = tipo => `var(--ev-${EVENTO_ICON[tipo] ? tipo : 'outro'})`
export const tipoLabel = tipo => TIPO_EVENTO_LABEL[tipo] || tipo
// Budget fields make sense for these types.
const TIPOS_COM_ORCAMENTO = new Set(['aumentou', 'reduziu', 'separou', 'novo', 'outro'])

export function EventoIcon({ tipo, size = 12 }) {
  const Icon = EVENTO_ICON[tipo] || CircleDot
  return (
    <span className={styles.evIcon} style={{ '--ev': evCor(tipo) }} aria-hidden="true">
      <Icon size={size} strokeWidth={2.4} />
    </span>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export const ordenarEventos = evs => [...evs].sort(
  (a, b) => b.data.localeCompare(a.data) || String(b.created_at).localeCompare(String(a.created_at)),
)

// Map "YYYY-MM-DD" → [eventos] (in the order they were created).
export function eventosPorData(evs) {
  const m = new Map()
  for (const e of [...evs].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
    if (!m.has(e.data)) m.set(e.data, [])
    m.get(e.data).push(e)
  }
  return m
}

// Changes from the last 7 days (today included), newest first.
export function eventosRecentes(evs, dias = 7) {
  const hoje = hojeSP()
  const desde = addDays(hoje, -(dias - 1))
  return ordenarEventos(evs.filter(e => e.data >= desde && e.data <= hoje))
}

export function orcamentoTexto(ev, money) {
  const a = ev.orcamento_anterior, n = ev.orcamento_novo
  if (a == null && n == null) return null
  if (a != null && n != null) return `${money(a)} → ${money(n)}/dia`
  return a != null ? `antes ${money(a)}/dia` : `novo ${money(n)}/dia`
}

// One line of text: "Separou em campanha própria · nota (R$ 30 → R$ 50/dia)".
export function eventoTexto(ev, money, nome) {
  const orc = money ? orcamentoTexto(ev, money) : null
  return `${nome ? `${nome}: ` : ''}${tipoLabel(ev.tipo)}${ev.nota ? ` · ${ev.nota}` : ''}${orc ? ` (${orc})` : ''}`
}

// ── Marcador com tooltip (toque ou mouse) ───────────────────────────────────
// Shows every change of the day; the native title covers mouse hover and
// the tap opens the same popover used by the ⓘ buttons.

// maxIcones: icons shown on the trigger (the tooltip always lists them all).
// comData: prefixes each line with its date (lists spanning several days).
export function EventoMarcador({ eventos, money, nomeDe, titulo, size = 11, maxIcones = 9, comData = false }) {
  if (!eventos?.length) return null
  const linhas = eventos.map(e => `${comData ? `${ddmm(e.data)} · ` : ''}${eventoTexto(e, money, nomeDe?.(e))}`)
  const info = {
    oque: (
      <span className={styles.evTipList}>
        {eventos.map((e, i) => (
          <span key={e.id} className={styles.evTipItem}>
            <EventoIcon tipo={e.tipo} size={11} />
            <span>{linhas[i]}</span>
          </span>
        ))}
      </span>
    ),
  }
  return (
    <span className={styles.evMarcadorWrap} title={linhas.join('\n')}>
      <InfoTip
        info={info}
        title={titulo || (eventos.length > 1 ? `${eventos.length} mudanças em ${ddmm(eventos[0].data)}` : `Mudança em ${ddmm(eventos[0].data)}`)}
        className={styles.evMarcador}
        label={`Mudança: ${linhas.join('; ')}`}
      >
        {eventos.slice(0, maxIcones).map(e => <EventoIcon key={e.id} tipo={e.tipo} size={size} />)}
      </InfoTip>
    </span>
  )
}

export function LegendaEventos({ tipos }) {
  const lista = TIPOS_EVENTO.filter(t => !tipos || tipos.includes(t.id))
  if (!lista.length) return null
  return (
    <div className={styles.evLegenda}>
      {lista.map(t => (
        <span key={t.id} className={styles.evLegendaItem}>
          <EventoIcon tipo={t.id} size={10} /> {t.label}
        </span>
      ))}
    </div>
  )
}

// ── Aviso de migration faltando ─────────────────────────────────────────────

export async function copiarTexto(texto) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(texto); return true }
  } catch { /* falls back below */ }
  // Older phones / non-secure contexts.
  const ta = document.createElement('textarea')
  ta.value = texto
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px'
  document.body.appendChild(ta)
  ta.select()
  ta.setSelectionRange(0, texto.length)
  let ok = false
  try { ok = document.execCommand('copy') } catch { ok = false }
  ta.remove()
  return ok
}

export const isErroMigracao = error => /criativos_eventos|orcamento_(anterior|novo)|relation|schema cache|column/i.test(error?.message || '')

export function AvisoMigracao({ schema }) {
  const [copiado, setCopiado] = useState(null)
  if (schema !== 'sem021' && schema !== 'sem022') return null
  async function copiar() {
    const ok = await copiarTexto(sqlMigracao)
    setCopiado(ok ? 'ok' : 'erro')
    setTimeout(() => setCopiado(null), 2500)
  }
  return (
    <div className={styles.evAviso} role="alert">
      <p>
        <AlertTriangle size={15} />{' '}
        <strong>Falta rodar a migration 022 no Supabase.</strong>{' '}
        {schema === 'sem021'
          ? 'Sem ela não dá para registrar mudanças.'
          : 'As mudanças funcionam, mas o orçamento anterior e o novo só são salvos depois dela.'}
      </p>
      <p className={styles.hint}>Abra o Supabase › SQL Editor, cole o SQL abaixo e toque em Run. Depois recarregue o app.</p>
      <div className={styles.anAvisoBtns}>
        <button type="button" className={styles.primaryBtn} onClick={copiar} aria-live="polite">
          {copiado === 'ok' ? <><Check size={15} /> SQL copiado!</> : <><Copy size={15} /> Copiar SQL</>}
        </button>
        {copiado === 'erro' && <span className={styles.fieldError}>Não deu para copiar neste aparelho: selecione o texto abaixo.</span>}
      </div>
      <details className={styles.anComo}>
        <summary>Ver o SQL completo <ChevronDown size={14} /></summary>
        <pre className={styles.evSql}>{sqlMigracao}</pre>
      </details>
    </div>
  )
}

// ── Formulário (registrar ou editar) ────────────────────────────────────────
// `criativoFixo`: opened inside a criativo, so there's no criativo picker.

export function MudancaForm({ oferta, criativos = [], criativoFixo, evento, orcamentoAtual, store, onClose }) {
  const schema = store.eventosSchema
  const semOrcamento = schema === 'sem022'
  const [form, setForm] = useState(() => (evento ? {
    data: evento.data,
    criativo_id: evento.criativo_id || '',
    tipo: evento.tipo,
    nota: evento.nota || '',
    orcamento_anterior: numToInput(evento.orcamento_anterior),
    orcamento_novo: numToInput(evento.orcamento_novo),
  } : {
    data: hojeSP(),
    criativo_id: criativoFixo?.id ?? criativos[0]?.id ?? '',
    tipo: 'separou',
    nota: '',
    orcamento_anterior: orcamentoAtual != null ? numToInput(orcamentoAtual) : '',
    orcamento_novo: '',
  }))
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const f = k => e => setForm(prev => ({ ...prev, [k]: e.target.value }))
  const comOrcamento = TIPOS_COM_ORCAMENTO.has(form.tipo)

  async function salvar() {
    if (!form.data) { setErro('Escolha a data da mudança.'); return }
    if (form.data > hojeSP()) { setErro('A data não pode ser no futuro.'); return }
    const payload = { data: form.data, criativo_id: form.criativo_id || null, tipo: form.tipo, nota: form.nota.trim() }
    if (!semOrcamento) {
      const ant = comOrcamento ? parseNum(form.orcamento_anterior) : null
      const novo = comOrcamento ? parseNum(form.orcamento_novo) : null
      if (comOrcamento && ((String(form.orcamento_anterior).trim() && ant == null) || (String(form.orcamento_novo).trim() && novo == null))) {
        setErro('Digite o orçamento só com números. Ex: 30 ou 30,50'); return
      }
      if (ant != null && novo != null) {
        if (form.tipo === 'aumentou' && novo < ant) { setErro('O novo orçamento é menor que o anterior: escolha “Reduziu orçamento”.'); return }
        if (form.tipo === 'reduziu' && novo > ant) { setErro('O novo orçamento é maior que o anterior: escolha “Aumentou orçamento”.'); return }
      }
      payload.orcamento_anterior = ant
      payload.orcamento_novo = novo
    }
    setSalvando(true)
    const res = evento ? await store.updateEvento(evento.id, payload) : await store.addEvento(oferta.id, payload)
    setSalvando(false)
    if (res?.error) {
      setErro(isErroMigracao(res.error)
        ? 'Para salvar mudanças, rode primeiro a migration 022 no Supabase (o SQL está no aviso acima).'
        : 'Não foi possível salvar. Verifique a conexão e tente de novo.')
      return
    }
    onClose()
  }

  return (
    <div className={styles.anForm}>
      <div className={styles.anFormGrid}>
        <Field label="Data">
          <input type="date" value={form.data} max={hojeSP()} onChange={f('data')} />
        </Field>
        {!criativoFixo && (
          <Field label="Criativo">
            <select value={form.criativo_id} onChange={f('criativo_id')}>
              {criativos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              <option value="">Campanha inteira</option>
            </select>
          </Field>
        )}
        <Field label="O que mudou">
          <select value={form.tipo} onChange={f('tipo')}>
            {TIPOS_EVENTO.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Nota · opcional">
          <input value={form.nota} onChange={f('nota')} placeholder="Ex: CBO própria com R$ 30/dia" />
        </Field>
        {comOrcamento && !semOrcamento && (
          <>
            <Field label="Orçamento anterior por dia · opcional">
              <input inputMode="decimal" value={form.orcamento_anterior} onChange={f('orcamento_anterior')} placeholder="Ex: 30" />
            </Field>
            <Field label="Orçamento novo por dia · opcional">
              <input inputMode="decimal" value={form.orcamento_novo} onChange={f('orcamento_novo')} placeholder="Ex: 45" />
            </Field>
          </>
        )}
      </div>
      {comOrcamento && semOrcamento && <p className={styles.hint}>O orçamento anterior e o novo aparecem aqui depois da migration 022.</p>}
      {erro && <p className={styles.fieldError}>{erro}</p>}
      <div className={styles.anFormBtns}>
        <button type="button" className={styles.linkBtn} onClick={onClose}>Cancelar</button>
        <button type="button" className={styles.primaryBtn} onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando…' : evento ? 'Salvar alterações' : 'Salvar mudança'}
        </button>
      </div>
    </div>
  )
}

// ── Seção "Mudanças" dentro do criativo ─────────────────────────────────────

export function MudancasCriativo({ criativo, oferta, eventos, store, money, orcamentoAtual }) {
  const [novaAberta, setNovaAberta] = useState(false)
  const [editando, setEditando] = useState(null)
  const lista = ordenarEventos(eventos)
  const semTabela = store.eventosSchema === 'sem021'

  async function apagar(ev) {
    if (!confirm(`Excluir a mudança de ${ddmm(ev.data)} (${tipoLabel(ev.tipo)})?`)) return
    const res = await store.deleteEvento(ev.id)
    if (res?.error) alert('Não foi possível excluir. Tente de novo.')
  }

  return (
    <div className={styles.section}>
      <div className={styles.anSecaoHead}>
        <h2 className={styles.sectionTitle}>Mudanças</h2>
        {!novaAberta && !semTabela && (
          <button type="button" className={styles.linkBtn} onClick={() => { setNovaAberta(true); setEditando(null) }}>
            <Plus size={13} /> Registrar mudança
          </button>
        )}
      </div>
      <AvisoMigracao schema={store.eventosSchema} />
      {novaAberta && (
        <MudancaForm oferta={oferta} criativoFixo={criativo} orcamentoAtual={orcamentoAtual} store={store} onClose={() => setNovaAberta(false)} />
      )}
      {lista.length === 0 && !novaAberta && (
        <p className={styles.hint}>
          Nenhuma mudança registrada neste criativo. Anote aqui o que você mudou no Gerenciador (orçamento, separou, pausou…):
          o dia ganha um marcador na tabela, no gráfico e no calendário.
        </p>
      )}
      {lista.length > 0 && (
        <ol className={styles.evTimeline}>
          {lista.map(ev => (
            <li key={ev.id} className={styles.evItem} style={{ '--ev': evCor(ev.tipo) }}>
              <EventoIcon tipo={ev.tipo} size={13} />
              {editando === ev.id ? (
                <MudancaForm oferta={oferta} criativoFixo={criativo} evento={ev} store={store} onClose={() => setEditando(null)} />
              ) : (
                <div className={styles.evItemBody}>
                  <div className={styles.anEventoHead}>
                    <span className={styles.anEventoData}>{ddmm(ev.data)}</span>
                    <span className={styles.evTag}>{tipoLabel(ev.tipo)}</span>
                    <span className={styles.evItemBtns}>
                      <button type="button" className={styles.iconBtn} onClick={() => { setEditando(ev.id); setNovaAberta(false) }} aria-label="Editar mudança" title="Editar"><Pencil size={13} /></button>
                      <button type="button" className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => apagar(ev)} aria-label="Excluir mudança" title="Excluir"><Trash2 size={13} /></button>
                    </span>
                  </div>
                  {orcamentoTexto(ev, money) && <span className={styles.evOrc}>Orçamento: {orcamentoTexto(ev, money)}</span>}
                  {ev.nota && <p className={styles.anEventoNota}>{ev.nota}</p>}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
