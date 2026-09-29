import { useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Logo from '../../components/Logo/Logo.jsx'
import CtaPrimary from '../../components/CtaPrimary/CtaPrimary.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { ApiError } from '../../api/api.js'
import styles from './Login.module.css'

const AUTH_ROUTES = ['/login', '/registro']

function errorMessage(err) {
  if (!err) return null
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Email o contraseña incorrectos'
    if (err.status === 429) return 'Demasiados intentos. Espera un minuto.'
  }
  return 'Error de conexión, inténtalo de nuevo'
}

export default function Login() {
  const { usuario, cargando, login } = useAuth()
  const location  = useLocation()
  const navigate  = useNavigate()
  const formRef   = useRef(null)
  const [error,      setError]      = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [showPass,   setShowPass]   = useState(false)

  // Si ya está logueado, redirige directo
  if (!cargando && usuario) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    const { email, password } = e.target.elements
    setError(null)
    setSubmitting(true)
    try {
      await login(email.value.trim(), password.value)
      const from = location.state?.from?.pathname
      const dest  = from && !AUTH_ROUTES.includes(from) ? from : '/'
      navigate(dest, { replace: true })
    } catch (err) {
      setError(err)
      setSubmitting(false)
    }
  }

  return (
    <main className={styles.page}>
      <Link to="/" className={styles.backLink} aria-label="Volver al inicio">
        ← Inicio
      </Link>

      <header className={styles.logoArea}>
        <Logo variant="wordmark" size="lg" />
      </header>

      <section className={styles.card}>
        <h1 className={styles.heading}>Bienvenido</h1>

        <form
          ref={formRef}
          className={styles.form}
          onSubmit={handleSubmit}
          noValidate
        >
          <div className={`${styles.fieldGroup} ${styles.fadeUp}`}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={`${styles.input} ${error ? styles['input--error'] : ''}`}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-password">
                Contraseña
              </label>
              <div className={styles.passwordWrap}>
                <input
                  id="login-password"
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className={`${styles.input} ${styles['input--password']} ${error ? styles['input--error'] : ''}`}
                />
                <button
                  type="button"
                  className={styles.showPassBtn}
                  onClick={() => setShowPass(v => !v)}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPass ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div role="alert" className={styles.errorMsg}>
              {errorMessage(error)}
            </div>
          )}

          <div className={styles.submitWrap}>
            <CtaPrimary type="submit" disabled={submitting}>
              {submitting ? 'Entrando…' : 'Entrar'}
            </CtaPrimary>
          </div>
        </form>

        <p className={styles.footer}>
          ¿Sin cuenta?{' '}
          <Link to="/registro" className={styles.footerLink}>
            Regístrate
          </Link>
        </p>
      </section>
    </main>
  )
}
