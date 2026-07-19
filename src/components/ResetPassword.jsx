import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import styles from './Login.module.css'

export default function ResetPassword() {
  const [phase, setPhase] = useState('checking') // checking | ready | invalid | success
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // A link with error=... in the hash means it already expired or was
    // used before — no session will ever show up for it.
    if (window.location.hash.includes('error=')) {
      setPhase('invalid')
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setPhase('ready')
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setPhase('ready')
    })

    // Supabase parses the recovery token from the URL asynchronously on
    // load; if nothing showed up after a few seconds the link is dead.
    const timeout = setTimeout(() => {
      setPhase(prev => prev === 'checking' ? 'invalid' : prev)
    }, 4000)

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  async function handleSubmit() {
    setError(null)
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não coincidem.'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) { setError(error.message); return }
    setPhase('success')
    setTimeout(() => { window.location.href = '/' }, 1500)
  }

  return (
    <div className={styles.page}>
      <div className={styles.glow} />
      <div className={styles.box}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>◆</span>
          <span className={styles.logoText}>RM Estudos</span>
        </div>
        <p className={styles.sub}>Definir nova senha</p>

        {phase === 'checking' && (
          <p className={styles.sub}>Validando o link...</p>
        )}

        {phase === 'invalid' && (
          <>
            <div className={styles.error}>
              Este link expirou ou já foi usado. Solicite um novo link em "Esqueci minha senha" na tela de login.
            </div>
            <button className={styles.btn} onClick={() => { window.location.href = '/' }}>
              Voltar para o login
            </button>
          </>
        )}

        {phase === 'success' && (
          <div className={styles.success}>Senha redefinida com sucesso! Entrando...</div>
        )}

        {phase === 'ready' && (
          <>
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.fields}>
              <div className={styles.field}>
                <label>Nova senha</label>
                <input type="password" placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()} autoFocus />
              </div>
              <div className={styles.field}>
                <label>Confirmar nova senha</label>
                <input type="password" placeholder="••••••••" value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
              </div>
            </div>
            <button className={styles.btn} onClick={handleSubmit} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
