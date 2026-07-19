import { useState } from 'react'
import { supabase } from '../lib/supabase'
import styles from './Login.module.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login') // login | signup | forgot
  const [loginMethod, setLoginMethod] = useState('password') // password | magic
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [error, setError] = useState(null)

  function switchMode(next) {
    setMode(next); setError(null); setMsg(null)
  }

  async function handleSubmit() {
    setLoading(true); setError(null); setMsg(null)

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) setError(error.message)
      else setMsg('Se esse e-mail existir, você vai receber um link para redefinir a senha.')
      setLoading(false)
      return
    }

    if (mode === 'login' && loginMethod === 'magic') {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) setError(error.message)
      else setMsg('Verifique seu e-mail para o link de acesso.')
      setLoading(false)
      return
    }

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

  const title = mode === 'login' ? 'Entre na sua conta' : mode === 'signup' ? 'Crie sua conta' : 'Redefinir senha'

  return (
    <div className={styles.page}>
      <div className={styles.glow} />
      <div className={styles.box}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>◆</span>
          <span className={styles.logoText}>RM Estudos</span>
        </div>
        <p className={styles.sub}>{title}</p>

        {mode === 'login' && (
          <div className={styles.methodToggle}>
            <button
              className={loginMethod === 'password' ? styles.methodActive : ''}
              onClick={() => { setLoginMethod('password'); setError(null); setMsg(null) }}
            >
              Senha
            </button>
            <button
              className={loginMethod === 'magic' ? styles.methodActive : ''}
              onClick={() => { setLoginMethod('magic'); setError(null); setMsg(null) }}
            >
              Link mágico
            </button>
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}
        {msg && <div className={styles.success}>{msg}</div>}

        <div className={styles.fields}>
          <div className={styles.field}>
            <label>E-mail</label>
            <input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>
          {mode !== 'forgot' && !(mode === 'login' && loginMethod === 'magic') && (
            <div className={styles.field}>
              <label>Senha</label>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>
          )}
        </div>

        <button className={styles.btn} onClick={handleSubmit} disabled={loading}>
          {loading ? 'Carregando...'
            : mode === 'forgot' ? 'Enviar link de redefinição'
            : mode === 'signup' ? 'Criar conta'
            : loginMethod === 'magic' ? 'Enviar link de acesso'
            : 'Entrar'}
        </button>

        {mode === 'login' && loginMethod === 'password' && (
          <p className={styles.toggle}>
            <button onClick={() => switchMode('forgot')}>Esqueci minha senha</button>
          </p>
        )}

        {mode === 'forgot' ? (
          <p className={styles.toggle}>
            <button onClick={() => switchMode('login')}>Voltar para o login</button>
          </p>
        ) : (
          <p className={styles.toggle}>
            {mode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}
            <button onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
              {mode === 'login' ? ' Criar conta' : ' Entrar'}
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
