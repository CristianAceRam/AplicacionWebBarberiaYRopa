import CtaPrimary from '../CtaPrimary/CtaPrimary.jsx'
import styles from './EstadoError.module.css'

export default function EstadoError({ mensaje = 'No se pudo cargar el catálogo.', onReintentar }) {
  return (
    <div className={styles.wrap} role="alert">
      <p className={styles.titulo}>{mensaje}</p>
      <p className={styles.subtexto}>Inténtalo de nuevo.</p>
      <CtaPrimary onClick={onReintentar}>Reintentar</CtaPrimary>
    </div>
  )
}
