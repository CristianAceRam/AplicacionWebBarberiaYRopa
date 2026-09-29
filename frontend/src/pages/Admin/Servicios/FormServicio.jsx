import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext.jsx'
import { ApiError } from '../../../api/api.js'
import EstadoCargando from '../../../components/ui/EstadoCargando.jsx'
import CtaSecondary from '../../../components/CtaSecondary/CtaSecondary.jsx'
import AnimatedContent from '../../../components/AnimatedContent/AnimatedContent.jsx'
import styles from './FormServicio.module.css'

const FRANJA_MIN = 30   // sincronizado con backend constants.py
const MAX_MIN    = 300

function formatDuracion(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

const OPCIONES_DURACION = (() => {
  const opts = []
  for (let m = FRANJA_MIN; m <= MAX_MIN; m += FRANJA_MIN)
    opts.push({ value: m, label: formatDuracion(m) })
  return opts
})()

const CAMPO_VACIO = { nombre: '', duracion_minutos: 30, precio: '' }

function datosIguales(a, b) {
  return (
    a.nombre           === b.nombre &&
    a.duracion_minutos === b.duracion_minutos &&
    a.precio           === b.precio &&
    a.activo           === b.activo
  )
}

export default function FormServicio() {
  const { servicioId } = useParams()
  const navigate       = useNavigate()
  const location       = useLocation()
  const { fetchWithAuth } = useAuth()

  const modoEditar  = !!servicioId
  const recienCreado = location.state?.nuevo === true

  const [campos,       setCampos]       = useState(CAMPO_VACIO)
  const [original,     setOriginal]     = useState(CAMPO_VACIO)
  const [cargando,     setCargando]     = useState(modoEditar)
  const [errores,      setErrores]      = useState({})
  const [guardando,    setGuardando]    = useState(false)
  const [exito,        setExito]        = useState(recienCreado ? 'Servicio creado.' : null)
  const [errorGeneral, setErrorGeneral] = useState(null)

  useEffect(() => {
    if (!modoEditar) return
    fetchWithAuth(`/servicios/${servicioId}`)
      .then(s => {
        const datos = {
          nombre:           s.nombre,
          duracion_minutos: s.duracion_minutos,
          precio:           String(parseFloat(s.precio).toFixed(2)),
          activo:           s.activo,
        }
        setCampos(datos)
        setOriginal(datos)
        setCargando(false)
      })
      .catch(() => {
        setErrorGeneral('No se pudo cargar el servicio.')
        setCargando(false)
      })
  }, [servicioId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (cargando) return <EstadoCargando mensaje="Cargando servicio…" />

  const sinCambios = modoEditar && datosIguales(campos, original)

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    let val
    if (type === 'checkbox')          val = checked
    else if (name === 'duracion_minutos') val = parseInt(value, 10)
    else                              val = value
    setCampos(prev => ({ ...prev, [name]: val }))
    setExito(null)
    if (errores[name]) setErrores(prev => ({ ...prev, [name]: undefined }))
  }

  function validar() {
    const errs = {}
    if (!campos.nombre.trim())        errs.nombre = 'El nombre no puede estar vacío.'
    const p = parseFloat(campos.precio)
    if (isNaN(p) || p < 0)           errs.precio = 'Introduce un precio válido (≥ 0).'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validar()
    if (Object.keys(errs).length) { setErrores(errs); return }

    setGuardando(true)
    setErrorGeneral(null)
    setErrores({})

    const body = {
      nombre:           campos.nombre.trim(),
      duracion_minutos: Number(campos.duracion_minutos),
      precio:           parseFloat(campos.precio),
    }
    if (modoEditar) body.activo = campos.activo

    try {
      if (modoEditar) {
        await fetchWithAuth(`/servicios/${servicioId}`, {
          method: 'PUT',
          body,
        })
        setOriginal(campos)
        setExito('Cambios guardados.')
      } else {
        const nuevo = await fetchWithAuth('/servicios', {
          method: 'POST',
          body,
        })
        navigate(`/admin/servicios/${nuevo.id}`, { state: { nuevo: true } })
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && Array.isArray(err.data?.detail)) {
        const errs = {}
        for (const item of err.data.detail) {
          const clave = item.loc?.join(' ') ?? ''
          if (clave.includes('nombre'))           errs.nombre = item.msg
          else if (clave.includes('duracion_minutos')) errs.duracion_minutos = item.msg
          else if (clave.includes('precio'))      errs.precio = item.msg
          else                                    errs.general = item.msg
        }
        setErrores(errs)
      } else {
        setErrorGeneral('No se pudo guardar el servicio. Inténtalo de nuevo.')
      }
    } finally {
      setGuardando(false)
    }
  }

  return (
    <AnimatedContent>
    <div className={styles.wrap}>

      <button
        type="button"
        className={styles.btnVolver}
        onClick={() => navigate('/admin/servicios')}
      >
        ← Servicios
      </button>

      <h2 className={styles.titulo}>
        {modoEditar ? 'Editar servicio' : 'Nuevo servicio'}
      </h2>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>

        <div className={styles.campo}>
          <label className={styles.label} htmlFor="nombre">Nombre</label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            maxLength={100}
            value={campos.nombre}
            onChange={handleChange}
            className={`${styles.input} ${errores.nombre ? styles.inputError : ''}`}
            autoComplete="off"
          />
          {errores.nombre && (
            <span role="alert" className={styles.fieldError}>{errores.nombre}</span>
          )}
        </div>

        <div className={styles.campo}>
          <label className={styles.label} htmlFor="duracion_minutos">Duración</label>
          <select
            id="duracion_minutos"
            name="duracion_minutos"
            value={campos.duracion_minutos}
            onChange={handleChange}
            className={`${styles.input} ${styles.select} ${errores.duracion_minutos ? styles.inputError : ''}`}
          >
            {OPCIONES_DURACION.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {errores.duracion_minutos && (
            <span role="alert" className={styles.fieldError}>{errores.duracion_minutos}</span>
          )}
        </div>

        <div className={styles.campo}>
          <label className={styles.label} htmlFor="precio">Precio (€)</label>
          <input
            id="precio"
            name="precio"
            type="number"
            step="0.01"
            min="0"
            value={campos.precio}
            onChange={handleChange}
            className={`${styles.input} ${styles.inputMono} ${errores.precio ? styles.inputError : ''}`}
          />
          {errores.precio && (
            <span role="alert" className={styles.fieldError}>{errores.precio}</span>
          )}
        </div>

        {modoEditar && (
          <div className={styles.campoCheck}>
            <input
              id="activo"
              name="activo"
              type="checkbox"
              checked={!!campos.activo}
              onChange={handleChange}
              className={styles.checkbox}
            />
            <label htmlFor="activo" className={styles.checkLabel}>
              Visible en el catálogo (activo)
            </label>
          </div>
        )}

        {errores.general && (
          <p role="alert" className={styles.errorGeneral}>{errores.general}</p>
        )}
        {errorGeneral && (
          <p role="alert" className={styles.errorGeneral}>{errorGeneral}</p>
        )}
        {exito && (
          <p role="status" className={styles.exitoMsg}>{exito}</p>
        )}

        <div className={styles.botonSubmit}>
          <CtaSecondary
            type="submit"
            disabled={guardando || sinCambios}
          >
            {guardando ? 'Guardando…' : modoEditar ? 'Guardar cambios' : 'Crear servicio'}
          </CtaSecondary>
        </div>

      </form>

    </div>
    </AnimatedContent>
  )
}
