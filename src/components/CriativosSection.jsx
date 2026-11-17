import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Folder, ArrowLeft } from 'lucide-react'
import { useCriativosStore } from '../hooks/useCriativosStore'
import {
  summarize, currency, integer, TIPOS_OFERTA, tipoOf,
  MOEDAS_CONTA, ACRESCIMO_PADRAO, moedaContaOf, gastoEmReais, acrescimoNaData, fetchCotacaoHoje,
  summarizeFora, totalOferta, rowGasto,
} from '../lib/criativosMetrics'
import Modal from './Modal'
import {
  FORMATOS, IDIOMAS, MOEDAS, Field, Breadcrumb, parseNum, numToInput, formatDate,
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

// `dias`: the saved days of this offer (all its criativos), so a currency
// switch can offer to convert the ones typed in the other currency.
function OfertaModal({ oferta, dias = [], defaultTipo = 'whatsapp', onClose, onSave, onConvert, onRecalcAcrescimo }) {
  const [form, setForm] = useState(() => ({
    tipo: oferta ? tipoOf(oferta) : defaultTipo,
    nome: oferta?.nome || '',
    idioma: oferta?.idioma || 'pt',
    moeda: oferta?.moeda || 'BRL',
    moeda_conta: moedaContaOf(oferta),
    cotacao: numToInput(oferta?.cotacao ?? null),
    acrescimo_gasto: numToInput(oferta ? Number(oferta.acrescimo_gasto ?? 0) : ACRESCIMO_PADRAO.BRL),
    acrescimo_desde: oferta?.acrescimo_desde || '',
    ...Object.fromEntries(OFERTA_NUM_FIELDS.map(f => [
      f.key, numToInput(oferta ? oferta[f.key] : f.fallback ?? null),
    ])),
  }))
  const f = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }))
  const [cotacaoMsg, setCotacaoMsg] = useState(null)
  const [erro, setErro] = useState(null)
  // Days saved in a currency other than the one chosen now.
  const diasOutraMoeda = dias.filter(d => rowGasto(d).moeda !== form.moeda_conta)
  const mudouMoeda = oferta && moedaContaOf(oferta) !== form.moeda_conta
  const [converter, setConverter] = useState(null) // null = not chosen yet
  const converterEfetivo = converter ?? !!mudouMoeda
  // Acréscimo the new settings give a day (0 before "acrescimo_desde").
  const regra = { acrescimo_gasto: parseNum(form.acrescimo_gasto) ?? 0, acrescimo_desde: form.acrescimo_desde || null }
  // Days saved before the start date that still carry an acréscimo — only
  // recalculated if confirmed below. (Days being converted get it anyway.)
  const diasAntesDesde = oferta && form.acrescimo_desde
    ? dias.filter(d => d.data < form.acrescimo_desde && Number(rowGasto(d).acrescimo) !== 0
      && !(converterEfetivo && diasOutraMoeda.includes(d)))
    : []
  const [recalcular, setRecalcular] = useState(false)

  // Switching the account currency swaps the acréscimo to the new default
  // only if it was still the old default (a typed value is kept).
  function setMoedaConta(m) {
    setForm(prev => {
      const cur = parseNum(prev.acrescimo_gasto)
      const other = ACRESCIMO_PADRAO[prev.moeda_conta]
      const acrescimo_gasto = cur == null || cur === other ? numToInput(ACRESCIMO_PADRAO[m]) : prev.acrescimo_gasto
      return { ...prev, moeda_conta: m, acrescimo_gasto }
    })
    setErro(null)
  }

  async function usarCotacaoHoje() {
    setCotacaoMsg('Buscando…')
    const v = await fetchCotacaoHoje()
    if (v == null) { setCotacaoMsg('Não foi possível buscar agora. Digite a cotação.'); return }
    setForm(prev => ({ ...prev, cotacao: numToInput(v) }))
    setCotacaoMsg(`Cotação de hoje: R$ ${numToInput(v)}`)
  }

  const exemplo = form.moeda_conta === 'USD'
    ? gastoEmReais(10, parseNum(form.cotacao), parseNum(form.acrescimo_gasto))
    : gastoEmReais(100, 1, parseNum(form.acrescimo_gasto))

  async function save() {
    if (!form.nome.trim()) return
    const cotacao = parseNum(form.cotacao)
    if (form.moeda_conta === 'USD' && !(cotacao > 0)) { setErro('Informe a cotação (R$ por US$).'); return }
    const payload = {
      nome: form.nome.trim(), idioma: form.idioma, moeda: form.moeda, tipo: form.tipo,
      moeda_conta: form.moeda_conta,
      cotacao: form.moeda_conta === 'USD' ? cotacao : (oferta?.cotacao ?? null),
      acrescimo_gasto: parseNum(form.acrescimo_gasto) ?? 0,
      acrescimo_desde: form.acrescimo_desde || null,
    }
    OFERTA_NUM_FIELDS.forEach(c => { payload[c.key] = parseNum(form[c.key]) ?? c.fallback ?? null })
    const saved = await onSave(payload)
    if (saved?.error) {
      setErro(/acrescimo_desde/.test(saved.error.message || '')
        ? 'Falta rodar o SQL da migração 020 no Supabase (coluna “acrescimo_desde”).'
        : `Não foi possível salvar: ${saved.error.message || 'erro'}.`)
      return
    }
    if (oferta && converterEfetivo && diasOutraMoeda.length) {
      const usd = form.moeda_conta === 'USD'
      const res = await onConvert(diasOutraMoeda, {
        moeda: form.moeda_conta,
        cotacao: usd ? cotacao : 1,
        acrescimo: data => acrescimoNaData(regra, data),
        toReais: (original, acrescimo) => gastoEmReais(original, usd ? cotacao : 1, acrescimo),
      })
      if (res?.failed) { setErro(`${res.failed} dia(s) não puderam ser convertidos. Tente salvar de novo.`); return }
    }
    if (oferta && recalcular && diasAntesDesde.length) {
      const res = await onRecalcAcrescimo(diasAntesDesde, () => 0)
      if (res?.failed) { setErro(`${res.failed} dia(s) não puderam ser recalculados. Tente salvar de novo.`); return }
    }
    onClose()
  }

  return (
    <Modal title={oferta ? 'Configurações da oferta' : 'Nova oferta'} onClose={onClose} onSave={save}>
      <Field label="Nome da oferta">
        <input value={form.nome} onChange={f('nome')} placeholder="Ex: Baralho da Ousadia — PT" autoFocus={!oferta} />
      </Field>
      <Field label="Tipo de oferta">
        <div className={styles.tipoChoice} role="radiogroup" aria-label="Tipo de oferta">
          {TIPOS_OFERTA.map(t => (
            <button
              type="button"
              key={t.id}
              role="radio"
              aria-checked={form.tipo === t.id}
              className={`${styles.tipoOption} ${form.tipo === t.id ? styles.tipoOptionOn : ''}`}
              onClick={() => setForm(prev => ({ ...prev, tipo: t.id }))}
            >
              <strong>{t.label}</strong>
              <span>{t.hint}</span>
            </button>
          ))}
        </div>
      </Field>
      {oferta && tipoOf(oferta) !== form.tipo && (
        <p className={styles.hint}>
          Nenhum lançamento é perdido: os campos que não se aplicam ao novo tipo ficam guardados, só ocultos.
        </p>
      )}
      <div className={styles.fieldRow}>
        <Field label="Idioma">
          <select value={form.idioma} onChange={f('idioma')}>
            {IDIOMAS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Moeda da venda">
          <select value={form.moeda} onChange={f('moeda')}>
            {MOEDAS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <div className={styles.gastoBox}>
        <Field label="Moeda da conta de anúncios" info="moedaConta">
          <div className={styles.segmented} role="radiogroup" aria-label="Moeda da conta de anúncios">
            {MOEDAS_CONTA.map(m => (
              <button
                type="button"
                key={m.id}
                role="radio"
                aria-checked={form.moeda_conta === m.id}
                className={form.moeda_conta === m.id ? styles.segmentedOn : ''}
                onClick={() => setMoedaConta(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </Field>
        <div className={styles.fieldRow}>
          {form.moeda_conta === 'USD' && (
            <Field label="Cotação (R$ por US$)" info="cotacao">
              <input inputMode="decimal" value={form.cotacao} onChange={f('cotacao')} placeholder="ex: 5,40" />
            </Field>
          )}
          <Field label="Acréscimo sobre o gasto (%)" info="acrescimoGasto">
            <input inputMode="decimal" value={form.acrescimo_gasto} onChange={f('acrescimo_gasto')} placeholder="0" />
          </Field>
        </div>
        <Field label="Aplicar o acréscimo a partir de · opcional" info="acrescimoDesde">
          <div className={styles.cotacaoRow}>
            <input type="date" value={form.acrescimo_desde} onChange={e => { setForm(prev => ({ ...prev, acrescimo_desde: e.target.value })); setRecalcular(false) }} />
            {form.acrescimo_desde && <button type="button" className={styles.linkBtn} onClick={() => setForm(prev => ({ ...prev, acrescimo_desde: '' }))}>Limpar</button>}
          </div>
          <span className={styles.hint}>
            {form.acrescimo_desde
              ? `Antes de ${formatDate(form.acrescimo_desde)} o gasto entra sem acréscimo; a partir dessa data, com ${form.acrescimo_gasto || 0}%.`
              : 'Vazio = o acréscimo vale para todos os dias.'}
          </span>
        </Field>
        {diasAntesDesde.length > 0 && (
          <div className={styles.convertBox}>
            <p>
              <strong>{diasAntesDesde.length} {diasAntesDesde.length === 1 ? 'lançamento antes' : 'lançamentos antes'} de {formatDate(form.acrescimo_desde)}</strong>
              {' '}{diasAntesDesde.length === 1 ? 'está' : 'estão'} com acréscimo. Recalcular sem acréscimo (0%)?
            </p>
            <label className={styles.convertOption}>
              <input type="radio" name="recalcular" checked={recalcular} onChange={() => setRecalcular(true)} />
              <span>Sim, recalcular {diasAntesDesde.length} {diasAntesDesde.length === 1 ? 'dia' : 'dias'}<small>O gasto digitado não muda; só o valor em reais, sem o acréscimo.</small></span>
            </label>
            <label className={styles.convertOption}>
              <input type="radio" name="recalcular" checked={!recalcular} onChange={() => setRecalcular(false)} />
              <span>Não, manter como estão</span>
            </label>
          </div>
        )}
        {form.moeda_conta === 'USD' && (
          <div className={styles.cotacaoRow}>
            <button type="button" className={styles.linkBtn} onClick={usarCotacaoHoje}>Usar cotação de hoje</button>
            {cotacaoMsg && <span className={styles.hint}>{cotacaoMsg}</span>}
          </div>
        )}
        <p className={styles.hint}>
          {form.moeda_conta === 'USD'
            ? (parseNum(form.cotacao) > 0
              ? `Exemplo: US$ 10 viram ${currency(exemplo)} (US$ 10 × ${form.cotacao} × (1 + ${form.acrescimo_gasto || 0}%)).`
              : 'Informe a cotação para ver o exemplo.')
            : `Exemplo: R$ 100 de gasto viram ${currency(exemplo)} com o acréscimo.`}
          {' '}Mudar a cotação ou o acréscimo não altera os dias já lançados.
        </p>
        {oferta && diasOutraMoeda.length > 0 && (
          <div className={styles.convertBox}>
            <p>
              <strong>{diasOutraMoeda.length} {diasOutraMoeda.length === 1 ? 'dia foi lançado' : 'dias foram lançados'} em {form.moeda_conta === 'USD' ? 'reais' : 'dólar'}.</strong>
              {' '}Os valores que você digitou {form.moeda_conta === 'USD' ? 'eram em dólar' : 'eram em reais'}?
            </p>
            <label className={styles.convertOption}>
              <input type="radio" name="converter" checked={converterEfetivo} onChange={() => setConverter(true)} />
              <span>
                Sim, converter para {form.moeda_conta === 'USD' ? 'dólar' : 'reais'}
                <small>
                  {form.moeda_conta === 'USD'
                    ? 'O número digitado vira US$ e o gasto em reais é recalculado com a cotação e o acréscimo acima.'
                    : 'O número digitado vira R$ (cotação 1) com o acréscimo acima.'}
                </small>
              </span>
            </label>
            <label className={styles.convertOption}>
              <input type="radio" name="converter" checked={!converterEfetivo} onChange={() => setConverter(false)} />
              <span>Não, manter esses dias como estão</span>
            </label>
          </div>
        )}
        {erro && <p className={styles.fieldError}>{erro}</p>}
      </div>
      <div className={styles.fieldRow}>
        {OFERTA_NUM_FIELDS.map(c => (
          <Field key={c.key} label={c.label}>
            <input inputMode="decimal" value={form[c.key]} onChange={f(c.key)} />
          </Field>
        ))}
      </div>
      <p className={styles.hint}>
        Ticket médio e CPA máximo em reais. O CPA máximo é a base das sugestões. Se o faturamento de um dia ficar vazio, usa vendas × ticket médio.
      </p>
    </Modal>
  )
}

// Creates a criativo, or edits one already saved (`criativo` given).
function CriativoModal({ criativo, onClose, onSave }) {
  const [form, setForm] = useState({
    nome: criativo?.nome ?? '',
    link_drive: criativo?.link_drive ?? '',
    formato: criativo?.formato ?? 'video',
    angulo: criativo?.angulo ?? '',
    observacoes: criativo?.observacoes ?? '',
  })
  const [nomeError, setNomeError] = useState(false)
  const f = key => e => {
    setForm(prev => ({ ...prev, [key]: e.target.value }))
    if (key === 'nome') setNomeError(false)
  }
  async function save() {
    // The name is always chosen by the user — never generated.
    const nome = form.nome.trim()
    if (!nome) { setNomeError(true); return }
    await onSave({
      nome,
      link_drive: form.link_drive.trim(), formato: form.formato, angulo: form.angulo.trim(),
      observacoes: form.observacoes.trim(),
    })
    onClose()
  }
  return (
    <Modal title={criativo ? 'Editar criativo' : 'Novo criativo'} onClose={onClose} onSave={save} saveLabel={criativo ? 'Salvar' : 'Criar'}>
      <Field label="Nome do criativo">
        <input
          value={form.nome}
          onChange={f('nome')}
          placeholder="Ex: Antes e depois — vídeo 1"
          autoFocus
          aria-invalid={nomeError}
          className={nomeError ? styles.inputError : ''}
        />
      </Field>
      {nomeError && <p className={styles.fieldError}>Dê um nome para o criativo.</p>}
      <Field label="Link do criativo no Google Drive · opcional">
        <input value={form.link_drive} onChange={f('link_drive')} placeholder="https://drive.google.com/file/d/..." />
      </Field>
      <Field label="Formato">
        <select value={form.formato} onChange={f('formato')}>
          {FORMATOS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="Ângulo / gancho da copy">
        <input value={form.angulo} onChange={f('angulo')} placeholder="Ex: Dor de não ter tempo" />
      </Field>
      <Field label="Descrição · opcional">
        <textarea
          value={form.observacoes}
          onChange={f('observacoes')}
          rows={3}
          placeholder="Informações importantes. Ex: criativos salvos no e-mail fulano@gmail.com"
        />
      </Field>
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
  // É o "Total da oferta": campanha + vendas fora da campanha, que bate com
  // a planilha de controle.
  const ofertaTotals = useMemo(() => {
    const map = {}
    ofertas.forEach(o => {
      const rows = criativos.filter(c => c.oferta_id === o.id).flatMap(c => rowsByCriativo[c.id] || [])
      const fora = summarizeFora(store.vendasFora.filter(v => v.oferta_id === o.id), o.ticket_medio)
      map[o.id] = totalOferta(summarize(rows, o.ticket_medio), fora)
    })
    return map
  }, [ofertas, criativos, rowsByCriativo, store.vendasFora])

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
        onEdit={() => setModal({ type: 'criativo', target: criativo })}
      />
    )
  } else if (oferta) {
    body = (
      <OfertaTabela
        oferta={oferta}
        criativos={criativos.filter(c => c.oferta_id === oferta.id)}
        rowsByCriativo={rowsByCriativo}
        vendasFora={store.vendasFora.filter(v => v.oferta_id === oferta.id)}
        store={store}
        onOpen={setCriativoId}
        onEdit={c => setModal({ type: 'criativo', target: c })}
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
                <div
                  key={o.id}
                  className={`${styles.folderCard} ${t.lucro > 0 ? styles.cardLucro : t.lucro < 0 ? styles.cardPrejuizo : ''}`}
                  onClick={() => setOfertaId(o.id)}
                >
                  <div className={styles.folderTop}>
                    <span className={styles.folderName}>{o.nome}</span>
                    <span className={styles.langBadge}>{IDIOMA_SHORT[o.idioma]} · {o.moeda}</span>
                    <span className={`${styles.tipoBadge} ${styles[`tipo_${tipoOf(o)}`]}`}>{tipoOf(o) === 'direta' ? 'Direta' : 'WhatsApp'}</span>
                  </div>
                  <div className={styles.cardStats}>
                    <div><span className={styles.statLabel}>Vendas</span><span className={styles.statValue}>{integer(t.vendas)}</span></div>
                    <div><span className={styles.statLabel}>Gasto</span><span className={styles.statValue}>{money(t.gasto)}</span></div>
                    <div>
                      <span className={styles.statLabel}>{t.lucro < 0 ? 'Prejuízo' : 'Lucro'}</span>
                      <span className={`${styles.statValue} ${t.lucro > 0 ? styles.positive : t.lucro < 0 ? styles.negative : ''}`}>{money(Math.abs(t.lucro))}</span>
                    </div>
                  </div>
                  {t.faturamentoFora > 0 && (
                    <span className={styles.cardForaNote}>inclui {money(t.faturamentoFora)} de vendas fora da campanha</span>
                  )}
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
          dias={modal.target ? criativos.filter(c => c.oferta_id === modal.target.id).flatMap(c => rowsByCriativo[c.id] || []) : []}
          onConvert={store.convertGastoDias}
          onRecalcAcrescimo={store.recalcAcrescimoDias}
          // A new offer starts with the type of the latest offer in this pasta.
          defaultTipo={tipoOf([...ofertas].reverse().find(o => o.pasta_id === pasta?.id))}
          onClose={closeModal}
          onSave={fields => modal.target ? store.updateOferta(modal.target.id, fields) : store.addOferta(pasta.id, fields)}
        />
      )}
      {modal?.type === 'criativo' && oferta && (
        <CriativoModal
          criativo={modal.target}
          onClose={closeModal}
          onSave={fields => modal.target ? store.updateCriativo(modal.target.id, fields) : store.addCriativo(oferta.id, fields)}
        />
      )}
    </div>
  )
}
