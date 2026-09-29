import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Logo from '../../components/Logo/Logo.jsx'
import CtaPrimary from '../../components/CtaPrimary/CtaPrimary.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { ApiError } from '../../api/api.js'
import styles from './Registro.module.css'

const AUTH_ROUTES = ['/login', '/registro']

// ── Stepper visual (CSS puro) ──────────────────────────────────────────────
function Stepper({ paso }) {
  return (
    <div className={styles.stepper} aria-hidden="true">
      <span className={`${styles.dot} ${styles['dot--active']}`} />
      <span className={`${styles.line} ${paso === 2 ? styles['line--active'] : ''}`} />
      <span className={`${styles.dot} ${paso === 2 ? styles['dot--active'] : ''}`} />
    </div>
  )
}

// ── Validaciones cliente ───────────────────────────────────────────────────
const NOMBRE_RE  = /^[A-Za-zÀ-ÿ\s'.\-]+$/
const TELEFONO_RE = /^(\+34|0034|34)?[\s\-]?[6789]\d{8}$/

function validarPaso1({ nombre_completo, telefono }) {
  const errs = {}
  const nombre = nombre_completo.trim()
  if (!nombre || !NOMBRE_RE.test(nombre) || nombre.split(/\s+/).filter(Boolean).length < 2) {
    errs.nombre_completo = 'Introduce nombre y apellido (solo letras)'
  }
  const tel = telefono.replace(/[\s\-]/g, '')
  if (!TELEFONO_RE.test(tel)) {
    errs.telefono = 'Teléfono español no válido (ej. 612 345 678)'
  }
  return errs
}

function validarPaso2({ email, password }) {
  const errs = {}
  if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errs.email = 'Email no válido'
  }
  if (password.length < 8) {
    errs.password = 'La contraseña debe tener al menos 8 caracteres'
  }
  return errs
}

// ── Mapeo de errores de backend ────────────────────────────────────────────
function mapearBackendError(err, setPaso) {
  if (!(err instanceof ApiError)) return { general: 'Error de conexión, inténtalo de nuevo' }
  if (err.status === 409) return { email: 'Este email ya está registrado' }
  if (err.status === 429) return { general: 'Demasiados intentos. Espera un minuto.' }
  if (err.status === 422 && Array.isArray(err.data?.detail)) {
    const errs = {}
    let necesitaPaso1 = false
    for (const item of err.data.detail) {
      const loc = item.loc?.join(' ') ?? ''
      if (loc.includes('nombre_completo')) { errs.nombre_completo = item.msg; necesitaPaso1 = true }
      else if (loc.includes('telefono'))   { errs.telefono = item.msg; necesitaPaso1 = true }
      else if (loc.includes('email'))      errs.email = item.msg
      else if (loc.includes('password'))   errs.password = item.msg
      else errs.general = item.msg
    }
    if (necesitaPaso1) setPaso(1)
    return errs
  }
  return { general: 'Error inesperado. Inténtalo de nuevo.' }
}

// ── Componente principal ───────────────────────────────────────────────────
export default function Registro() {
  const { usuario, cargando, register } = useAuth()
  const location  = useLocation()
  const navigate  = useNavigate()

  const [paso,   setPaso]   = useState(1)
  const [campos, setCampos] = useState({ nombre_completo: '', telefono: '', email: '', password: '' })
  const [errores, setErrores] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [showPass, setShowPass] = useState(false)

  if (!cargando && usuario) return <Navigate to="/" replace />

  function handleChange(e) {
    const { name, value } = e.target
    setCampos(prev => ({ ...prev, [name]: value }))
    // Limpia el error del campo en cuanto el usuario empieza a escribir
    if (errores[name]) setErrores(prev => ({ ...prev, [name]: '' }))
  }

  function handleSiguiente(e) {
    e.preventDefault()
    const errs = validarPaso1(campos)
    if (Object.keys(errs).length > 0) { setErrores(errs); return }
    setErrores({})
    setPaso(2)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validarPaso2(campos)
    if (Object.keys(errs).length > 0) { setErrores(errs); return }
    setErrores({})
    setSubmitting(true)
    try {
      await register(campos.nombre_completo, campos.telefono, campos.email, campos.password)
      const from = location.state?.from?.pathname
      const dest  = from && !AUTH_ROUTES.includes(from) ? from : '/'
      navigate(dest, { replace: true })
    } catch (err) {
      setErrores(mapearBackendError(err, setPaso))
      setSubmitting(false)
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <Link to="/" aria-label="Volver al inicio">
          <Logo variant="symbol" size="sm" />
        </Link>
      </header>

      <section className={styles.card}>
        <Stepper paso={paso} />

        {paso === 1 && (
          <form onSubmit={handleSiguiente} noValidate>
            <h1 className={styles.heading}>Crea tu cuenta</h1>
            <p className={styles.stepHint}>Paso 1 de 2 — Datos personales</p>

            <div className={styles.fieldGroup}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="reg-nombre">
                  Nombre completo
                </label>
                <input
                  id="reg-nombre"
                  name="nombre_completo"
                  type="text"
                  autoComplete="name"
                  value={campos.nombre_completo}
                  onChange={handleChange}
                  className={`${styles.input} ${errores.nombre_completo ? styles['input--error'] : ''}`}
                  placeholder="Pedro García"
                />
                {errores.nombre_completo && (
                  <span role="alert" className={styles.fieldError}>{errores.nombre_completo}</span>
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="reg-tel">
                  Teléfono
                </label>
                <input
                  id="reg-tel"
                  name="telefono"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={campos.telefono}
                  onChange={handleChange}
                  className={`${styles.input} ${errores.telefono ? styles['input--error'] : ''}`}
                  placeholder="612 345 678"
                />
                {errores.telefono && (
                  <span role="alert" className={styles.fieldError}>{errores.telefono}</span>
                )}
              </div>
            </div>

            <button type="submit" className={styles.btnSecondary}>
              Siguiente
            </button>
          </form>
        )}

        {paso === 2 && (
          <form onSubmit={handleSubmit} noValidate>
            <h1 className={styles.heading}>Acceso</h1>
            <p className={styles.stepHint}>Paso 2 de 2 — Tu cuenta</p>

            <div className={styles.fieldGroup}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="reg-email">
                  Email
                </label>
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={campos.email}
                  onChange={handleChange}
                  className={`${styles.input} ${errores.email ? styles['input--error'] : ''}`}
                />
                {errores.email && (
                  <span role="alert" className={styles.fieldError}>{errores.email}</span>
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="reg-password">
                  Contraseña
                </label>
                <div className={styles.passwordWrap}>
                  <input
                    id="reg-password"
                    name="password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={campos.password}
                    onChange={handleChange}
                    className={`${styles.input} ${styles['input--password']} ${errores.password ? styles['input--error'] : ''}`}
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
                {errores.password && (
                  <span role="alert" className={styles.fieldError}>{errores.password}</span>
                )}
              </div>
            </div>

            {errores.general && (
              <div role="alert" className={styles.generalError}>{errores.general}</div>
            )}

            <div className={styles.step2Actions}>
              <button
                type="button"
                className={styles.btnBack}
                onClick={() => { setPaso(1); setErrores({}) }}
              >
                ← Atrás
              </button>
              <CtaPrimary type="submit" disabled={submitting}>
                {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
              </CtaPrimary>
            </div>
          </form>
        )}

        <p className={styles.footer}>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className={styles.footerLink}>
            Inicia sesión
          </Link>
        </p>
      </section>
    </main>
  )
}
