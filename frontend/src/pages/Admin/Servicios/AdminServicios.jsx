import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext.jsx'
import { useAdminServicios } from '../../../hooks/useAdminServicios.js'
import EstadoCargando from '../../../components/ui/EstadoCargando.jsx'
import EstadoError from '../../../components/ui/EstadoError.jsx'
import CtaSecondary from '../../../components/CtaSecondary/CtaSecondary.jsx'
import AnimatedContent from '../../../components/AnimatedContent/AnimatedContent.jsx'
import styles from './AdminServicios.module.css'

const FILTROS = [
  { id: 'todos',     label: 'Todos'     },
  { id: 'activos',   label: 'Activos'   },
  { id: 'inactivos', label: 'Inactivos' },
]

function formatDuracion(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

function formatPrecio(precio) {
  return `${parseFloat(precio).toFixed(2)} €`
}

export default function AdminServicios() {
  const navigate = useNavigate()
  const { fetchWithAuth } = useAuth()
  const { servicios, setServicios, cargando, error, recargar } = useAdminServicios()

  const [filtro,      setFiltro]      = useState('todos')
  const [toggling,    setToggling]    = useState(null)
  const [errorToggle, setErrorToggle] = useState(null) // { id, msg }

  if (cargando) return <EstadoCargando mensaje="Cargando servicios…" />
  if (error)    return <AnimatedContent><EstadoError mensaje="No se pudieron cargar los servicios." onReintentar={recargar} /></AnimatedContent>

  const serviciosFiltrados = servicios.filter(s => {
    if (filtro === 'activos')   return s.activo
    if (filtro === 'inactivos') return !s.activo
    return true
  })

  const contadores = {
    todos:     servicios.length,
    activos:   servicios.filter(s => s.activo).length,
    inactivos: servicios.filter(s => !s.activo).length,
  }

  async function handleToggle(servicio) {
    const nuevo = !servicio.activo
    setServicios(prev => prev.map(s => s.id === servicio.id ? { ...s, activo: nuevo } : s))
    setToggling(servicio.id)
    setErrorToggle(null)
    try {
      await fetchWithAuth(`/servicios/${servicio.id}`, {
        method: 'PUT',
        body: { activo: nuevo },
      })
    } catch {
      setServicios(prev => prev.map(s => s.id === servicio.id ? { ...s, activo: !nuevo } : s))
      setErrorToggle({ id: servicio.id, msg: 'No se pudo cambiar el estado. Inténtalo de nuevo.' })
    } finally {
      setToggling(null)
    }
  }

  return (
    <AnimatedContent>
    <div className={styles.wrap}>

      <div className={styles.cabecera}>
        <h2 className={styles.titulo}>Servicios</h2>
        <CtaSecondary size="sm" onClick={() => navigate('/admin/servicios/nuevo')}>
          Nuevo servicio
        </CtaSecondary>
      </div>

      <div className={styles.filtros} role="group" aria-label="Filtrar servicios">
        {FILTROS.map(f => (
          <button
            key={f.id}
            className={`${styles.pill} ${filtro === f.id ? styles.pillActivo : ''}`}
            onClick={() => setFiltro(f.id)}
            aria-pressed={filtro === f.id}
          >
            {f.label} ({contadores[f.id]})
          </button>
        ))}
      </div>

      {serviciosFiltrados.length === 0 && (
        <p className={styles.vacio}>
          {servicios.length === 0
            ? 'No hay servicios todavía.'
            : 'No hay servicios en este filtro.'}
        </p>
      )}

      <ul className={styles.lista}>
        {serviciosFiltrados.map(servicio => {
          const inactiva = !servicio.activo
          const enToggle = errorToggle?.id === servicio.id

          return (
            <li
              key={servicio.id}
              className={`${styles.tarjeta} ${inactiva ? styles.tarjetaInactiva : ''}`}
            >
              <div className={styles.infoTexto}>
                <div className={styles.infoFila}>
                  <span className={styles.nombre}>{servicio.nombre}</span>
                  <span className={inactiva ? styles.badgeInactivo : styles.badgeActivo}>
                    {inactiva ? 'Inactivo' : 'Activo'}
                  </span>
                </div>
                <div className={styles.metaFila}>
                  <span className={styles.duracion}>{formatDuracion(servicio.duracion_minutos)}</span>
                  <span className={styles.precio}>{formatPrecio(servicio.precio)}</span>
                </div>
              </div>

              <div className={styles.acciones}>
                <CtaSecondary
                  size="sm"
                  disabled={toggling !== null}
                  onClick={() => navigate(`/admin/servicios/${servicio.id}`)}
                >
                  Editar
                </CtaSecondary>
                <CtaSecondary
                  size="sm"
                  danger={servicio.activo}
                  disabled={toggling !== null}
                  onClick={() => handleToggle(servicio)}
                >
                  {toggling === servicio.id
                    ? '…'
                    : servicio.activo ? 'Desactivar' : 'Activar'}
                </CtaSecondary>
              </div>

              {enToggle && (
                <p role="alert" className={styles.errorToggle}>{errorToggle.msg}</p>
              )}
            </li>
          )
        })}
      </ul>

    </div>
    </AnimatedContent>
  )
}
