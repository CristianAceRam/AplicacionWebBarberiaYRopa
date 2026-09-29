import styles from './Contacto.module.css'

export default function Contacto() {
  return (
    <div className={styles.wrap}>
      <h2 className={styles.titulo}>Contacto</h2>
      <p className={styles.descripcion}>
        Los datos de Alex — teléfono, dirección, horario y redes sociales —
        estarán disponibles próximamente.
      </p>
    </div>
  )
}
