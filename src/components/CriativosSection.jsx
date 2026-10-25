import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Folder, ArrowLeft } from 'lucide-react'
import { useCriativosStore } from '../hooks/useCriativosStore'
import { summarize, currency, integer } from '../lib/criativosMetrics'
import Modal from './Modal'
import {
  FORMATOS, IDIOMAS, MOEDAS, Field, Breadcrumb, parseNum, numToInput,
} from './criativos/shared'
import OfertaTabela from './criativos/OfertaTabela'
import CriativoDetail from './criativos/CriativoDetail'
import styles from './criativos/Criativos.module.css'

// Stable fallback so effects keyed on a criativo's rows don't re-run every
// render for criativos that have no data yet.
const NO_ROWS = []

const IDIOMA_SHORT = { pt: 'PT', es: 'ES', en: 'EN' }

// ── Modais ────────────────────────────────────────────────────────────────────

function PastaModal({ pasta, onClose, onSave }) {
  const [nome, setNome] = useState(pasta?.nome || '')
  async function save() {
    if (!nome.trim()) return
    await onSave(nome.trim())
    onClose()
  }
  return (
    <Modal title={pasta ? 'Renomear pasta' : 'Nova pasta'} onClose={onClose} onSave={save}>
      <Field label="Nome da pasta">
        <input
          value={nome}
          onChange={e => setNome(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save() }}
          placeholder="Ex: Relacionamento"
          autoFocus
        />
      </Field>
    </Modal>
  )
}

const OFERTA_NUM_FIELDS = [
  { key: 'ticket_medio',        label: 'Ticket médio' },
  { key: 'cpa_maximo',          label: 'CPA máximo' },
  { key: 'ctr_minimo',          label: 'CTR mínimo (%)',               fallback: 1 },
  { key: 'freq_max_pre_escala', label: 'Frequência máx. — pré-escala', fallback: 2 },
  { key: 'freq_max_escala',     label: 'Frequência máx. — escala',     fallback: 3 },
]

function OfertaModal({ oferta, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    nome: oferta?.nome || '',
    idioma: oferta?.idioma || 'pt',
    moeda: oferta?.moeda || 'BRL',
    ...Object.fromEntries(OFERTA_NUM_FIELDS.map(f => [
      f.key, numToInput(oferta ? oferta[f.key] : f.fallback ?? null),
    ])),
  }))
  const f = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }))

  async function save() {
    if (!form.nome.trim()) return
    const payload = { nome: form.nome.trim(), idioma: form.idioma, moeda: form.moeda }
    OFERTA_NUM_FIELDS.forEach(c => { payload[c.key] = parseNum(form[c.key]) ?? c.fallback ?? null })
    await onSave(payload)
    onClose()
  }

  return (
    <Modal title={oferta ? 'Configurações da oferta' : 'Nova oferta'} onClose={onClose} onSave={save}>
      <Field label="Nome da oferta">
        <input value={form.nome} onChange={f('nome')} placeholder="Ex: Baralho da Ousadia — PT" autoFocus={!oferta} />
      </Field>
      <div className={styles.fieldRow}>
        <Field label="Idioma">
          <select value={form.idioma} onChange={f('idioma')}>
            {IDIOMAS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Moeda">
          <select value={form.moeda} onChange={f('moeda')}>
            {MOEDAS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <div className={styles.fieldRow}>
        {OFERTA_NUM_FIELDS.map(c => (
          <Field key={c.key} label={c.label}>
            <input inputMode="decimal" value={form[c.key]} onChange={f(c.key)} />
          </Field>
        ))}
      </div>
      <p className={styles.hint}>
        O CPA máximo é a base das sugestões. Se o faturamento de um dia ficar vazio, usa vendas × ticket médio.
      </p>
    </Modal>
  )
}

function NovoCriativoModal({ onClose, onSave }) {
  const [form, setForm] = useState({ link_drive: '', formato: 'video', angulo: '' })
  const f = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }))
  async function save() {
    await onSave({ link_drive: form.link_drive.trim(), formato: form.formato, angulo: form.angulo.trim() })
    onClose()
  }
  return (
    <Modal title="Novo criativo" onClose={onClose} onSave={save} saveLabel="Criar">
      <Field label="Link do Google Drive · opcional">
        <input value={form.link_drive} onChange={f('link_drive')} placeholder="https://drive.google.com/file/d/..." autoFocus />
      </Field>
      <Field label="Formato">
        <select value={form.formato} onChange={f('formato')}>
          {FORMATOS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="Ângulo / gancho da copy">
        <input value={form.angulo} onChange={f('angulo')} placeholder="Ex: Dor de não ter tempo" />
      </Field>
      <p className={styles.hint}>O nome (AD 1, AD 2…) é gerado automaticamente e pode ser editado depois.</p>
    </Modal>
  )
}

// ── Seção principal ──────────────────────────────────────────────────────────

export default function CriativosSection({ user }) {
  const store = useCriativosStore(user)
  const { pastas, ofertas, criativos, metricas, loading } = store
  const [pastaId, setPastaId] = useState(null)
  const [ofertaId, setOfertaId] = useState(null)
  const [criativoId, setCriativoId] = useState(null)
  const [modal, setModal] = useState(null) // { type, target? }

  const rowsByCriativo = useMemo(() => {
    const map = {}
    metricas.forEach(m => { (map[m.criativo_id] ||= []).push(m) })
    return map
  }, [metricas])

  // Totais por oferta (todo o período), usados nos cards de pasta e oferta.
  const ofertaTotals = useMemo(() => {
    const map = {}
    ofertas.forEach(o => {
      const rows = criativos.filter(c => c.oferta_id === o.id).flatMap(c => rowsByCriativo[c.id] || [])
      map[o.id] = summarize(rows, o.ticket_medio)
    })
    return map
  }, [ofertas, criativos, rowsByCriativo])

  const pasta = pastas.find(p => p.id === pastaId)
  const oferta = ofertas.find(o => o.id === ofertaId && o.pasta_id === pastaId)
  const criativo = criativos.find(c => c.id === criativoId && c.oferta_id === ofertaId)

  const goRoot = () => { setPastaId(null); setOfertaId(null); setCriativoId(null) }
  const goPasta = () => { setOfertaId(null); setCriativoId(null) }
  const goOferta = () => setCriativoId(null)
  const closeModal = () => setModal(null)

  if (loading) {
    return <div className={styles.empty}><span className={styles.loadingIcon}>◆</span></div>
  }

  async function removePasta(p) {
    const n = ofertas.filter(o => o.pasta_id === p.id).length
    if (!confirm(`Excluir a pasta "${p.nome}"${n ? ` e as ${n} ofertas dentro dela (com todos os criativos)` : ''}?`)) return
    await store.deletePasta(p.id)
  }

  async function removeOferta(o) {
    const n = criativos.filter(c => c.oferta_id === o.id).length
    if (!confirm(`Excluir a oferta "${o.nome}"${n ? ` e os ${n} criativos dela` : ''}?`)) return
    await store.deleteOferta(o.id)
  }

  // Breadcrumb: Criativos › Pasta › Oferta › AD n
  const crumbs = [{ label: 'Criativos', onClick: pasta ? goRoot : null }]
  if (pasta) crumbs.push({ label: pasta.nome, onClick: oferta ? goPasta : null })
  if (oferta) crumbs.push({ label: oferta.nome, onClick: criativo ? goOferta : null })
  if (criativo) crumbs.push({ label: criativo.nome })
  const goBack = criativo ? goOferta : oferta ? goPasta : goRoot

  let body
  let action = null

  if (criativo) {
    body = (
      <CriativoDetail
        key={criativo.id}
        criativo={criativo}
        oferta={oferta}
        rows={rowsByCriativo[criativo.id] || NO_ROWS}
        store={store}
        onDeleted={goOferta}
      />
    )
  } else if (oferta) {
    body = (
      <OfertaTabela
        oferta={oferta}
        criativos={criativos.filter(c => c.oferta_id === oferta.id)}
        rowsByCriativo={rowsByCriativo}
        onOpen={setCriativoId}
        onNew={() => setModal({ type: 'criativo' })}
        onConfig={() => setModal({ type: 'oferta', target: oferta })}
      />
    )
  } else if (pasta) {
    const lista = ofertas.filter(o => o.pasta_id === pasta.id)
    action = (
      <button className={styles.primaryBtn} onClick={() => setModal({ type: 'oferta' })}>
        <Plus size={15} /> Nova oferta
      </button>
    )
    body = (
      <div className={styles.content}>
        {lista.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>◆</div>
            <p>Nenhuma oferta nesta pasta. Toque em “Nova oferta”.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {lista.map(o => {
              const t = ofertaTotals[o.id]
              const money = v => currency(v, o.moeda)
              return (
                <div key={o.id} className={styles.folderCard} onClick={() => setOfertaId(o.id)}>
                  <div className={styles.folderTop}>
                    <span className={styles.folderName}>{o.nome}</span>
                    <span className={styles.langBadge}>{IDIOMA_SHORT[o.idioma]} · {o.moeda}</span>
                  </div>
                  <div className={styles.cardStats}>
                    <div><span className={styles.statLabel}>Vendas</span><span className={styles.statValue}>{integer(t.vendas)}</span></div>
                    <div><span className={styles.statLabel}>Gasto</span><span className={styles.statValue}>{money(t.gasto)}</span></div>
                    <div>
                      <span className={styles.statLabel}>Lucro</span>
                      <span className={`${styles.statValue} ${t.lucro > 0 ? styles.positive : t.lucro < 0 ? styles.negative : ''}`}>{money(t.lucro)}</span>
                    </div>
                  </div>
                  <div className={styles.folderActions} onClick={e => e.stopPropagation()}>
                    <button className={styles.iconBtn} onClick={() => setModal({ type: 'oferta', target: o })} title="Editar oferta"><Pencil size={14} /></button>
                    <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => removeOferta(o)} title="Excluir oferta"><Trash2 size={14} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  } else {
    action = (
      <button className={styles.primaryBtn} onClick={() => setModal({ type: 'pasta' })}>
        <Plus size={15} /> Nova pasta
      </button>
    )
    body = (
      <div className={styles.content}>
        {pastas.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>◆</div>
            <p>Crie uma pasta (ex: “Relacionamento”) para organizar suas ofertas.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {pastas.map(p => {
              const lista = ofertas.filter(o => o.pasta_id === p.id)
              const vendas = lista.reduce((acc, o) => acc + ofertaTotals[o.id].vendas, 0)
              return (
                <div key={p.id} className={styles.folderCard} onClick={() => setPastaId(p.id)}>
                  <div className={styles.folderTop}>
                    <span className={styles.folderIcon}><Folder size={18} /></span>
                    <span className={styles.folderName}>{p.nome}</span>
                  </div>
                  <div className={styles.cardStats}>
                    <div><span className={styles.statLabel}>Ofertas</span><span className={styles.statValue}>{lista.length}</span></div>
                    <div><span className={styles.statLabel}>Vendas</span><span className={styles.statValue}>{integer(vendas)}</span></div>
                  </div>
                  <div className={styles.folderActions} onClick={e => e.stopPropagation()}>
                    <button className={styles.iconBtn} onClick={() => setModal({ type: 'pasta', target: p })} title="Renomear pasta"><Pencil size={14} /></button>
                    <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => removePasta(p)} title="Excluir pasta"><Trash2 size={14} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.topbar}>
        <div className={styles.topbarMain}>
          {pasta && (
            <button className={styles.backBtn} onClick={goBack} title="Voltar"><ArrowLeft size={16} /></button>
          )}
          <Breadcrumb items={crumbs} />
        </div>
        {action}
      </div>

      {body}

      {modal?.type === 'pasta' && (
        <PastaModal
          pasta={modal.target}
          onClose={closeModal}
          onSave={nome => modal.target ? store.updatePasta(modal.target.id, { nome }) : store.addPasta(nome)}
        />
      )}
      {modal?.type === 'oferta' && (
        <OfertaModal
          oferta={modal.target}
          onClose={closeModal}
          onSave={fields => modal.target ? store.updateOferta(modal.target.id, fields) : store.addOferta(pasta.id, fields)}
        />
      )}
      {modal?.type === 'criativo' && oferta && (
        <NovoCriativoModal onClose={closeModal} onSave={fields => store.addCriativo(oferta.id, fields)} />
      )}
    </div>
  )
}
