import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext.jsx'
import { useAdminPrendas } from '../../../hooks/useAdminPrendas.js'
import { cloudinaryUrl } from '../../../utils/cloudinary.js'
import { ApiError } from '../../../api/api.js'
import EstadoCargando from '../../../components/ui/EstadoCargando.jsx'
import EstadoError from '../../../components/ui/EstadoError.jsx'
import CtaSecondary from '../../../components/CtaSecondary/CtaSecondary.jsx'
import AnimatedContent from '../../../components/AnimatedContent/AnimatedContent.jsx'
import styles from './AdminPrendas.module.css'

const FILTROS = [
  { id: 'todas',    label: 'Todas'    },
  { id: 'visibles', label: 'Visibles' },
  { id: 'ocultas',  label: 'Ocultas'  },
]

function formatPrecio(precio) {
  return parseFloat(precio).toFixed(2) + ' €'
}

export default function AdminPrendas() {
  const navigate = useNavigate()
  const { fetchWithAuth } = useAuth()
  const { prendas, setPrendas, cargando, error, recargar } = useAdminPrendas()

  const [filtro, setFiltro]                           = useState('todas')
  const [confirmandoBorradoId, setConfirmandoBorradoId] = useState(null)
  const [errorBorrado, setErrorBorrado]               = useState(null)
  const [toggling, setToggling]                       = useState(null)
  const [borrando, setBorrando]                       = useState(false)

  if (cargando) return <EstadoCargando mensaje="Cargando prendas…" />
  if (error)    return <AnimatedContent><EstadoError mensaje="No se pudieron cargar las prendas." onReintentar={recargar} /></AnimatedContent>

  const prendasFiltradas = prendas.filter(p => {
    if (filtro === 'visibles') return p.activo
    if (filtro === 'ocultas')  return !p.activo
    return true
  })

  const contadores = {
    todas:    prendas.length,
    visibles: prendas.filter(p => p.activo).length,
    ocultas:  prendas.filter(p => !p.activo).length,
  }

  async function handleToggleActivo(prenda) {
    const nuevo = !prenda.activo
    setPrendas(prev => prev.map(p => p.id === prenda.id ? { ...p, activo: nuevo } : p))
    setToggling(prenda.id)
    try {
      await fetchWithAuth(`/prendas/${prenda.id}`, {
        method: 'PUT',
        body: { activo: nuevo },
      })
    } catch {
      setPrendas(prev => prev.map(p => p.id === prenda.id ? { ...p, activo: prenda.activo } : p))
    } finally {
      setToggling(null)
    }
  }

  async function handleBorrarPermanente(prenda) {
    setBorrando(true)
    setErrorBorrado(null)
    try {
      await fetchWithAuth(`/prendas/${prenda.id}/permanente`, { method: 'DELETE' })
      setPrendas(prev => prev.filter(p => p.id !== prenda.id))
      setConfirmandoBorradoId(null)
    } catch (err) {
      const msg = err instanceof ApiError && err.data?.detail
        ? err.data.detail
        : 'Error al borrar. Inténtalo de nuevo.'
      setErrorBorrado({ id: prenda.id, msg })
      setConfirmandoBorradoId(null)
    } finally {
      setBorrando(false)
    }
  }

  return (
    <AnimatedContent>
    <div className={styles.wrap}>
      <div className={styles.cabecera}>
        <h2 className={styles.titulo}>Catálogo</h2>
        <CtaSecondary onClick={() => navigate('/admin/prendas/nueva')}>
          + Nueva prenda
        </CtaSecondary>
      </div>

      {/* Filtros */}
      <div className={styles.filtros} role="group" aria-label="Filtrar prendas">
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

      {/* Vacío */}
      {!prendas.length && (
        <p className={styles.vacio}>No hay prendas todavía. Crea la primera.</p>
      )}
      {prendas.length > 0 && !prendasFiltradas.length && (
        <p className={styles.vacio}>No hay prendas en este filtro.</p>
      )}

      {/* Lista */}
      <ul className={styles.lista}>
        {prendasFiltradas.map(prenda => (
          <li key={prenda.id} className={`${styles.tarjeta} ${!prenda.activo ? styles.tarjetaInactiva : ''}`}>

            {/* Fila principal */}
            <div className={styles.tarjetaInfo}>
              {prenda.primera_imagen ? (
                <img
                  src={cloudinaryUrl(prenda.primera_imagen.url, { width: 96 })}
                  alt=""
                  className={styles.prendaImg}
                  onError={e => {
                    if (e.currentTarget.dataset.fallback) return
                    e.currentTarget.dataset.fallback = '1'
                    e.currentTarget.src = prenda.primera_imagen.url
                  }}
                />
              ) : (
                <div className={styles.imgPlaceholder} aria-hidden="true" />
              )}

              <div className={styles.infoTexto}>
                <div className={styles.infoFila}>
                  <span className={styles.nombre}>{prenda.nombre}</span>
                  <span className={styles.precio}>{formatPrecio(prenda.precio)}</span>
                </div>
                {prenda.categoria && (
                  <span className={styles.categoria}>{prenda.categoria}</span>
                )}
                <span className={`${styles.badge} ${prenda.activo ? styles.badgeVisible : styles.badgeOculta}`}>
                  {prenda.activo ? 'Visible' : 'Oculta'}
                </span>
              </div>
            </div>

            {/* Acciones */}
            <div className={styles.acciones}>
              <div className={styles.accionesIzq}>
                <CtaSecondary size="sm" onClick={() => navigate(`/admin/prendas/${prenda.id}`)}>
                  Editar
                </CtaSecondary>
                <CtaSecondary
                  size="sm"
                  disabled={toggling === prenda.id}
                  onClick={() => handleToggleActivo(prenda)}
                >
                  {toggling === prenda.id
                    ? '…'
                    : prenda.activo ? 'Desactivar' : 'Activar'}
                </CtaSecondary>
              </div>
              <CtaSecondary
                size="sm"
                danger
                onClick={() => { setConfirmandoBorradoId(prenda.id); setErrorBorrado(null) }}
              >
                Borrar
              </CtaSecondary>
            </div>

            {/* Error de borrado para esta tarjeta */}
            {errorBorrado?.id === prenda.id && (
              <p role="alert" className={styles.errorBorrado}>{errorBorrado.msg}</p>
            )}

            {/* Panel de confirmación inline */}
            {confirmandoBorradoId === prenda.id && (
              <div className={styles.confirmPanel} role="alert">
                <p className={styles.confirmMsg}>
                  Borrar «{prenda.nombre}» permanentemente. Esta acción no se puede deshacer — la prenda, sus tallas y todo su historial desaparecerán para siempre.
                </p>
                <div className={styles.confirmAcciones}>
                  <CtaSecondary size="sm" onClick={() => setConfirmandoBorradoId(null)} disabled={borrando}>
                    Cancelar
                  </CtaSecondary>
                  <CtaSecondary
                    size="sm"
                    danger
                    disabled={borrando}
                    onClick={() => handleBorrarPermanente(prenda)}
                  >
                    {borrando ? 'Borrando…' : 'Sí, borrar para siempre'}
                  </CtaSecondary>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
    </AnimatedContent>
  )
}
