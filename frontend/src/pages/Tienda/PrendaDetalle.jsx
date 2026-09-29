import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { usePrenda } from '../../hooks/usePrenda.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { ApiError } from '../../api/api.js'
import Carousel from '../../components/Carousel/Carousel.jsx'
import EstadoCargando from '../../components/ui/EstadoCargando.jsx'
import EstadoError from '../../components/ui/EstadoError.jsx'
import CtaPrimary from '../../components/CtaPrimary/CtaPrimary.jsx'
import styles from './PrendaDetalle.module.css'
import AnimatedContent from '../../components/AnimatedContent/AnimatedContent.jsx'

const formatPrecio = (precio) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(precio))

export default function PrendaDetalle() {
  const { id } = useParams()
  const { prenda, cargando, error, recargar } = usePrenda(id)
  const { usuario, fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [tallaSeleccionada, setTalla] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [errorReserva, setErrorReserva] = useState(null)
  const [confirmada, setConfirmada] = useState(false)

  if (cargando) return <EstadoCargando />

  if (error === 'not_found') return (
    <AnimatedContent>
    <div className={styles.noDisponible}>
      <p className={styles.noDisponibleTexto}>Esta prenda no está disponible.</p>
      <Link to="/tienda" className={styles.vuelta}>← Catálogo</Link>
    </div>
    </AnimatedContent>
  )

  if (error === 'error') return <AnimatedContent><EstadoError onReintentar={recargar} /></AnimatedContent>

  async function handleReservar() {
    if (!usuario) {
      navigate('/login', { state: { from: location } })
      return
    }
    setEnviando(true)
    setErrorReserva(null)
    try {
      await fetchWithAuth('/reservas', {
        method: 'POST',
        body: { prenda_id: prenda.id, talla: tallaSeleccionada },
      })
      setConfirmada(true)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403)      setErrorReserva('Tu cuenta está bloqueada. Contacta con πίστη.')
        else if (err.status === 422) { setErrorReserva('Esta talla ya no está disponible.'); recargar() }
        else if (err.status === 429) setErrorReserva('Demasiadas reservas seguidas. Espera un momento.')
        else                         setErrorReserva('No se pudo registrar la reserva.')
      } else {
        setErrorReserva('No se pudo registrar la reserva.')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <AnimatedContent>
    <article className={styles.detalle}>
      <div className={styles.carouselWrap}>
        <Carousel imagenes={prenda.imagenes ?? []} nombre={prenda.nombre} />
      </div>

      <div className={styles.info}>
        {prenda.categoria && (
          <p className={styles.categoria}>{prenda.categoria.toUpperCase()}</p>
        )}

        <h1 className={styles.nombre}>{prenda.nombre}</h1>
        <p className={styles.precio}>{formatPrecio(prenda.precio)}</p>

        {prenda.descripcion && (
          <p className={styles.descripcion}>{prenda.descripcion}</p>
        )}

        {prenda.tallas.length > 0 && (
          <div className={styles.tallasWrap} role="group" aria-label="Talla">
            <p className={styles.tallasLabel}>Talla</p>
            <div className={styles.tallas}>
              {prenda.tallas.map(t => (
                <button
                  key={t.id}
                  className={[
                    styles.tallaChip,
                    !t.disponible ? styles.tallaAgotada : '',
                    tallaSeleccionada === t.talla ? styles.tallaSeleccionada : '',
                  ].join(' ')}
                  disabled={!t.disponible}
                  aria-pressed={t.disponible ? tallaSeleccionada === t.talla : undefined}
                  aria-disabled={!t.disponible || undefined}
                  onClick={() => {
                    setTalla(t.talla)
                    setConfirmada(false)
                  }}
                >
                  {t.talla}
                </button>
              ))}
            </div>
          </div>
        )}

        {confirmada ? (
          <div className={styles.confirmacion}>
            <p className={styles.confirmacionTitulo}>Reserva registrada.</p>
            <p className={styles.confirmacionCuerpo}>
              Te contactaremos para cerrar la reserva.
            </p>
            <div className={styles.confirmacionLinks}>
              <Link to="/tienda/reservas" className={styles.linkReservas}>Ver mis reservas</Link>
              <Link to="/tienda" className={styles.linkCatalogo}>Al catálogo</Link>
            </div>
          </div>
        ) : (
          <div className={styles.accion}>
            {errorReserva && (
              <p className={styles.errorReserva} role="alert">{errorReserva}</p>
            )}
            <CtaPrimary
              onClick={handleReservar}
              disabled={tallaSeleccionada === null || enviando}
            >
              {enviando ? 'Reservando…' : 'Reservar'}
            </CtaPrimary>
            {!usuario && tallaSeleccionada && (
              <p className={styles.loginHint}>Necesitas iniciar sesión para reservar.</p>
            )}
          </div>
        )}
      </div>
    </article>
    </AnimatedContent>
  )
}
