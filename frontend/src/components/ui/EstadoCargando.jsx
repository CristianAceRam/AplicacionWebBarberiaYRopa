import styles from './EstadoCargando.module.css'

export default function EstadoCargando({ mensaje = 'Cargando…' }) {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div className={styles.bar} aria-hidden="true" />
      <p className={styles.texto}>{mensaje}</p>
    </div>
  )
}
