import styles from './EstadoVacio.module.css'

export default function EstadoVacio({ mensaje = 'El catálogo está vacío por ahora.' }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.pis} aria-hidden="true">
        <span className={styles.pi1}>π</span>
        <span className={styles.pi2}>π</span>
        <span className={styles.pi3}>π</span>
      </div>
      <p className={styles.texto}>{mensaje}</p>
    </div>
  )
}
