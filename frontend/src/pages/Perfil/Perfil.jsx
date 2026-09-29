import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { ApiError } from '../../api/api.js'
import CtaSecondary from '../../components/CtaSecondary/CtaSecondary.jsx'
import styles from './Perfil.module.css'

const NOMBRE_RE   = /^[A-Za-zÀ-ÿ\s'.\-]+$/
const TELEFONO_RE = /^(\+34|0034|34)?[\s\-]?[6789]\d{8}$/

function validarDatos({ nombre_completo, telefono }) {
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

function validarPassword({ password_nueva, password_nueva_confirmacion }) {
  const errs = {}
  if (password_nueva.length < 8) errs.password_nueva = 'Mínimo 8 caracteres'
  if (password_nueva !== password_nueva_confirmacion) errs.password_nueva_confirmacion = 'Las contraseñas no coinciden'
  return errs
}

export default function Perfil() {
  const navigate = useNavigate()
  const { usuario, fetchWithAuth, setUsuario } = useAuth()

  // ── Sección: mis datos ────────────────────────────────────────────
  const [datos, setDatos] = useState({
    nombre_completo: usuario?.nombre_completo ?? '',
    telefono:        usuario?.telefono        ?? '',
  })
  const [erroresDatos, setErroresDatos] = useState({})
  const [guardandoDatos, setGuardandoDatos] = useState(false)
  const [exitoDatos, setExitoDatos] = useState(null)

  const datosIguales =
    datos.nombre_completo === (usuario?.nombre_completo ?? '') &&
    datos.telefono        === (usuario?.telefono        ?? '')

  function handleDatosChange(e) {
    const { name, value } = e.target
    setDatos(prev => ({ ...prev, [name]: value }))
    setExitoDatos(null)
    if (erroresDatos[name]) setErroresDatos(prev => ({ ...prev, [name]: '' }))
  }

  async function handleGuardarDatos(e) {
    e.preventDefault()
    const errs = validarDatos(datos)
    if (Object.keys(errs).length > 0) { setErroresDatos(errs); return }
    setGuardandoDatos(true); setExitoDatos(null); setErroresDatos({})
    try {
      const updated = await fetchWithAuth('/usuarios/me', {
        method: 'PATCH',
        body: { nombre_completo: datos.nombre_completo, telefono: datos.telefono },
      })
      setUsuario(updated)
      setExitoDatos('Datos actualizados.')
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && Array.isArray(err.data?.detail)) {
        const errs = {}
        for (const item of err.data.detail) {
          const loc = item.loc?.join(' ') ?? ''
          if (loc.includes('nombre_completo'))  errs.nombre_completo = item.msg
          else if (loc.includes('telefono'))     errs.telefono = item.msg
          else                                   errs.general = item.msg
        }
        setErroresDatos(errs)
      } else {
        setErroresDatos({ general: 'No se pudo guardar. Inténtalo de nuevo.' })
      }
    } finally {
      setGuardandoDatos(false)
    }
  }

  // ── Sección: contraseña ───────────────────────────────────────────
  const [pass, setPass] = useState({
    password_actual: '', password_nueva: '', password_nueva_confirmacion: '',
  })
  const [erroresPass, setErroresPass] = useState({})
  const [guardandoPass, setGuardandoPass] = useState(false)
  const [exitoPass, setExitoPass] = useState(false)
  const [showActual, setShowActual] = useState(false)
  const [showNueva, setShowNueva] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  function handlePassChange(e) {
    const { name, value } = e.target
    setPass(prev => ({ ...prev, [name]: value }))
    setExitoPass(false)
    if (erroresPass[name]) setErroresPass(prev => ({ ...prev, [name]: '' }))
  }

  async function handleCambiarPassword(e) {
    e.preventDefault()
    if (!pass.password_actual) {
      setErroresPass({ password_actual: 'Introduce la contraseña actual' })
      return
    }
    const errs = validarPassword(pass)
    if (Object.keys(errs).length > 0) { setErroresPass(errs); return }
    setGuardandoPass(true); setExitoPass(false); setErroresPass({})
    try {
      await fetchWithAuth('/usuarios/me/password', {
        method: 'PATCH',
        body: { password_actual: pass.password_actual, password_nueva: pass.password_nueva },
      })
      // JWT sigue válido (backend stateless, sin blacklist) — la sesión continúa
      setPass({ password_actual: '', password_nueva: '', password_nueva_confirmacion: '' })
      setExitoPass(true)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          setErroresPass({ password_actual: 'La contraseña actual no es correcta.' })
        } else if (err.status === 429) {
          setErroresPass({ general: 'Demasiados intentos. Espera un minuto.' })
        } else if (err.status === 422 && Array.isArray(err.data?.detail)) {
          const errs = {}
          for (const item of err.data.detail) {
            const loc = item.loc?.join(' ') ?? ''
            if (loc.includes('password_nueva'))      errs.password_nueva = item.msg
            else if (loc.includes('password_actual')) errs.password_actual = item.msg
            else                                      errs.general = item.msg
          }
          setErroresPass(errs)
        } else {
          setErroresPass({ general: 'No se pudo cambiar. Inténtalo de nuevo.' })
        }
      } else {
        setErroresPass({ general: 'Error de conexión. Inténtalo de nuevo.' })
      }
    } finally {
      setGuardandoPass(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.btnVolver}
        onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')}
      >
        ← Volver
      </button>
      <h1 className={styles.titulo}>Mi perfil</h1>

      {/* ── Mis datos ── */}
      <section className={styles.seccion}>
        <h2 className={styles.seccionTitulo}>Mis datos</h2>
        <form onSubmit={handleGuardarDatos} noValidate>
          <div className={styles.campo}>
            <span className={styles.label}>Email</span>
            <p className={styles.emailStatic}>{usuario?.email}</p>
            <p className={styles.labelHint}>El email no se puede cambiar — es tu identificador de acceso.</p>
          </div>

          <div className={styles.campo}>
            <label className={styles.label} htmlFor="pf-nombre">Nombre completo</label>
            <input
              id="pf-nombre"
              name="nombre_completo"
              type="text"
              autoComplete="name"
              value={datos.nombre_completo}
              onChange={handleDatosChange}
              className={`${styles.input} ${erroresDatos.nombre_completo ? styles.inputError : ''}`}
            />
            {erroresDatos.nombre_completo && (
              <span role="alert" className={styles.fieldError}>{erroresDatos.nombre_completo}</span>
            )}
          </div>

          <div className={styles.campo}>
            <label className={styles.label} htmlFor="pf-tel">Teléfono</label>
            <input
              id="pf-tel"
              name="telefono"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={datos.telefono}
              onChange={handleDatosChange}
              className={`${styles.input} ${erroresDatos.telefono ? styles.inputError : ''}`}
              placeholder="612 345 678"
            />
            {erroresDatos.telefono && (
              <span role="alert" className={styles.fieldError}>{erroresDatos.telefono}</span>
            )}
          </div>

          {erroresDatos.general && (
            <p role="alert" className={styles.errorGeneral}>{erroresDatos.general}</p>
          )}
          {exitoDatos && <p className={styles.exitoMsg}>{exitoDatos}</p>}

          <div className={styles.botonSubmit}>
            <CtaSecondary type="submit" disabled={guardandoDatos || datosIguales}>
              {guardandoDatos ? 'Guardando…' : 'Guardar'}
            </CtaSecondary>
          </div>
        </form>
      </section>

      <hr className={styles.divisor} />

      {/* ── Contraseña ── */}
      <section className={styles.seccion}>
        <h2 className={styles.seccionTitulo}>Contraseña</h2>
        <form onSubmit={handleCambiarPassword} noValidate>
          <div className={styles.campo}>
            <label className={styles.label} htmlFor="pf-pass-actual">Contraseña actual</label>
            <div className={styles.passWrap}>
              <input
                id="pf-pass-actual"
                name="password_actual"
                type={showActual ? 'text' : 'password'}
                autoComplete="current-password"
                value={pass.password_actual}
                onChange={handlePassChange}
                className={`${styles.input} ${styles.inputPass} ${erroresPass.password_actual ? styles.inputError : ''}`}
              />
              <button
                type="button"
                className={styles.showPassBtn}
                onClick={() => setShowActual(v => !v)}
                aria-label={showActual ? 'Ocultar contraseña actual' : 'Mostrar contraseña actual'}
              >
                {showActual ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            {erroresPass.password_actual && (
              <span role="alert" className={styles.fieldError}>{erroresPass.password_actual}</span>
            )}
          </div>

          <div className={styles.campo}>
            <label className={styles.label} htmlFor="pf-pass-nueva">Contraseña nueva</label>
            <div className={styles.passWrap}>
              <input
                id="pf-pass-nueva"
                name="password_nueva"
                type={showNueva ? 'text' : 'password'}
                autoComplete="new-password"
                value={pass.password_nueva}
                onChange={handlePassChange}
                className={`${styles.input} ${styles.inputPass} ${erroresPass.password_nueva ? styles.inputError : ''}`}
              />
              <button
                type="button"
                className={styles.showPassBtn}
                onClick={() => setShowNueva(v => !v)}
                aria-label={showNueva ? 'Ocultar contraseña nueva' : 'Mostrar contraseña nueva'}
              >
                {showNueva ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            {erroresPass.password_nueva && (
              <span role="alert" className={styles.fieldError}>{erroresPass.password_nueva}</span>
            )}
          </div>

          <div className={styles.campo}>
            <label className={styles.label} htmlFor="pf-pass-confirm">Repetir contraseña nueva</label>
            <div className={styles.passWrap}>
              <input
                id="pf-pass-confirm"
                name="password_nueva_confirmacion"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                value={pass.password_nueva_confirmacion}
                onChange={handlePassChange}
                className={`${styles.input} ${styles.inputPass} ${erroresPass.password_nueva_confirmacion ? styles.inputError : ''}`}
              />
              <button
                type="button"
                className={styles.showPassBtn}
                onClick={() => setShowConfirm(v => !v)}
                aria-label={showConfirm ? 'Ocultar repetición' : 'Mostrar repetición'}
              >
                {showConfirm ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            {erroresPass.password_nueva_confirmacion && (
              <span role="alert" className={styles.fieldError}>{erroresPass.password_nueva_confirmacion}</span>
            )}
          </div>

          {erroresPass.general && (
            <p role="alert" className={styles.errorGeneral}>{erroresPass.general}</p>
          )}
          {exitoPass && <p className={styles.exitoMsg}>Contraseña actualizada.</p>}

          <div className={styles.botonSubmit}>
            <CtaSecondary type="submit" disabled={guardandoPass}>
              {guardandoPass ? 'Cambiando…' : 'Cambiar contraseña'}
            </CtaSecondary>
          </div>
        </form>
      </section>
    </div>
  )
}
