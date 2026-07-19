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

  async function handleGoogleLogin() {
    setLoading(true); setError(null); setMsg(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    // On success the browser navigates away to Google immediately, so
    // this only ever resolves (with an error) when something went wrong
    // before the redirect could happen.
    if (error) { setError(error.message); setLoading(false) }
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

        {mode !== 'forgot' && (
          <>
            <button type="button" className={styles.googleBtn} onClick={handleGoogleLogin} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.94v2.33A9 9 0 0 0 9 18Z"/>
                <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.27-1.7V4.97H.94A9 9 0 0 0 0 9c0 1.45.35 2.83.94 4.03l3.01-2.33Z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .94 4.97l3.01 2.33C4.66 5.17 6.65 3.58 9 3.58Z"/>
              </svg>
              Continuar com Google
            </button>
            <div className={styles.divider}><span>ou</span></div>
          </>
        )}

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
