import { useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from './Login.module.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [error, setError] = useState(null)

  async function handleSubmit() {
    setLoading(true); setError(null); setMsg(null)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMsg('Conta criada! Verifique seu email para confirmar.')
    }
    setLoading(false)
  }

  return (
    <div className={styles.page}>
      <div className={styles.glow} />
      <div className={styles.box}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>◆</span>
          <span className={styles.logoText}>RM Estudos</span>
        </div>
        <p className={styles.sub}>{mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}</p>

        {error && <div className={styles.error}>{error}</div>}
        {msg && <div className={styles.success}>{msg}</div>}

        <div className={styles.fields}>
          <div className={styles.field}>
            <label>E-mail</label>
            <input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Senha</label>
            <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>
        </div>

        <button className={styles.btn} onClick={handleSubmit} disabled={loading}>
          {loading ? 'Carregando...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>

        <p className={styles.toggle}>
          {mode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}
          <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setMsg(null) }}>
            {mode === 'login' ? ' Criar conta' : ' Entrar'}
          </button>
        </p>
      </div>
    </div>
  )
}
