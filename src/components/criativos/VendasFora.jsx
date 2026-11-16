// "Vendas fora da campanha" of one offer: referral, organic, a customer who
// passed the contact on… They belong to the OFFER, never to a criativo, so
// they only show up in the "Total da oferta" line — never in the ranking,
// CPA, ROAS, ROI, per-criativo profit or the verdicts.
import { useEffect, useRef, useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { todayISO, currency, integer } from '../../lib/criativosMetrics'
import { Field, InfoTip, SumInput, parseNum, numToInput, formatDate } from './shared'
import styles from './Criativos.module.css'

const empty = data => ({ data, vendas: '', faturamento: '', observacao: '' })
const toForm = r => ({ data: r.data, vendas: numToInput(r.vendas), faturamento: numToInput(r.faturamento), observacao: r.observacao || '' })

export default function VendasFora({ oferta, rows, store }) {
  const money = v => currency(v, oferta.moeda || 'BRL')
  const ticket = Number(oferta.ticket_medio) || 0
  const byDate = new Map(rows.map(r => [r.data, r]))
  const [form, setForm] = useState(() => (byDate.get(todayISO()) ? toForm(byDate.get(todayISO())) : empty(todayISO())))
  const [error, setError] = useState(null)
  const [flash, setFlash] = useState('')
  const [saving, setSaving] = useState(false)
  const formRef = useRef(null)
  const existing = byDate.get(form.data)

  // Picking a date that already has a row loads it, so saving edits it.
  function pickDate(d) {
    setForm(byDate.get(d) ? toForm(byDate.get(d)) : empty(d))
    setError(null)
  }
  // Keep the form in sync when the same day is changed or deleted below.
  useEffect(() => {
    const r = rows.find(x => x.data === form.data)
    setForm(r ? toForm(r) : f => ({ ...empty(f.data) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  const vendasN = parseNum(form.vendas, false)
  const fatN = parseNum(form.faturamento)
  const fatPreview = String(form.faturamento).trim() ? fatN : (vendasN ?? 0) * ticket

  async function save(e) {
    e.preventDefault()
    if (!form.data) return
    if (String(form.vendas).trim() && vendasN == null) return setError(`"${form.vendas}" não é um número válido em Vendas.`)
    if (String(form.faturamento).trim() && fatN == null) return setError(`"${form.faturamento}" não é um número válido em Faturamento.`)
    if (!vendasN && !fatN) return setError('Informe as vendas (e, se quiser, o faturamento).')
    setSaving(true)
    setError(null)
    const res = await store.saveVendaFora(oferta.id, {
      data: form.data,
      vendas: vendasN ?? 0,
      faturamento: String(form.faturamento).trim() ? fatN : null,
      observacao: form.observacao.trim(),
    })
    setSaving(false)
    if (res.error) {
      console.error('[saveVendaFora]', res.error)
      return setError(/relation|does not exist|schema cache/i.test(res.error.message || '')
        ? 'A tabela de vendas fora da campanha ainda não existe: rode o SQL da migração 019 no Supabase.'
        : `Não foi possível salvar: ${res.error.message || 'erro'}.`)
    }
    setFlash(existing ? 'Atualizado ✓' : 'Salvo ✓')
    setTimeout(() => setFlash(''), 2000)
  }

  async function remove(r) {
    if (!confirm(`Excluir as vendas fora da campanha de ${formatDate(r.data)}?`)) return
    const res = await store.deleteVendaFora(r.id)
    if (res?.error) alert('Não foi possível excluir. Tente de novo.')
  }

  function edit(r) {
    pickDate(r.data)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>
        Vendas fora da campanha
        <InfoTip info="vendasFora" title="Vendas fora da campanha" />
      </h2>
      <p className={styles.hint}>
        Indicação, orgânico, cliente que passou o contato. Não são de nenhum criativo: entram só no “Total da oferta”.
      </p>

      <form ref={formRef} className={styles.foraForm} onSubmit={save}>
        <div className={styles.foraGrid}>
          <Field label="Data">
            <input type="date" value={form.data} max={todayISO()} onChange={e => e.target.value && pickDate(e.target.value)} />
          </Field>
          <Field label="Vendas">
            <SumInput isDecimal={false} value={form.vendas} placeholder="0"
              onChange={v => setForm(p => ({ ...p, vendas: v }))} />
          </Field>
          <Field label={`Faturamento (${money(0).replace(/[\d\s.,]/g, '')}) · opcional`} info="faturamento">
            <SumInput value={form.faturamento} placeholder="vendas × ticket" format={money}
              onChange={v => setForm(p => ({ ...p, faturamento: v }))} />
          </Field>
          <Field label="Observação · opcional">
            <input value={form.observacao} placeholder="Ex: indicação da Ana" maxLength={120}
              onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))} />
          </Field>
        </div>
        <div className={styles.foraActions}>
          <span className={styles.hint}>
            {existing ? <>Editando <strong>{formatDate(form.data)}</strong> · </> : null}
            Faturamento: <strong>{money(fatPreview)}</strong>
            {!String(form.faturamento).trim() && vendasN ? ' (vendas × ticket médio)' : ''}
          </span>
          {flash && <span className={styles.flash}>{flash}</span>}
          <button type="submit" className={styles.primaryBtn} disabled={saving}>
            <Plus size={15} /> {saving ? 'Salvando…' : existing ? 'Atualizar' : 'Lançar'}
          </button>
        </div>
        {error && <div className={styles.error}>{error}</div>}
      </form>

      {rows.length === 0 ? (
        <p className={styles.hint}>Nenhuma venda fora da campanha lançada.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Data</th><th className={styles.num}>Vendas</th><th className={styles.num}>Faturamento</th><th>Observação</th><th></th></tr>
            </thead>
            <tbody>
              {[...rows].reverse().map(r => (
                <tr key={r.id} className={r.data === form.data ? styles.foraRowActive : ''}>
                  <td className={styles.strong}>{formatDate(r.data)}</td>
                  <td className={styles.num}>{integer(r.vendas)}</td>
                  <td className={styles.num}>
                    {r.faturamento == null
                      ? <span className={styles.muted} title="vendas × ticket médio">{money(Number(r.vendas || 0) * ticket)}</span>
                      : money(r.faturamento)}
                  </td>
                  <td className={styles.foraObs}>{r.observacao || '—'}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <button className={styles.iconBtn} onClick={() => edit(r)} title="Editar" aria-label={`Editar ${formatDate(r.data)}`}><Pencil size={13} /></button>
                      <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => remove(r)} title="Excluir" aria-label={`Excluir ${formatDate(r.data)}`}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
