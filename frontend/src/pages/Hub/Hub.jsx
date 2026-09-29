import { Link } from 'react-router-dom'
import Logo from '../../components/Logo/Logo.jsx'
import Banner from '../../components/Banner/Banner.jsx'
import SesionChip from '../../components/SesionChip/SesionChip.jsx'
import { IconScissors, IconShirt } from '../../components/Nav/NavIcons.jsx'
import styles from './Hub.module.css'

export default function Hub() {
  return (
    <main className={styles.hub}>
      <header className={styles.hubHeader}>
        {/* Columna izquierda: spacer para centrar el wordmark */}
        <div aria-hidden="true" className={styles.hubHeaderSpacer} />

        <Logo variant="wordmark" size="lg" />

        {/* Columna derecha: indicador de sesión */}
        <div className={styles.chipSlot}>
          <SesionChip />
        </div>
      </header>

      <section className={styles.worlds} aria-label="Mundos">
        <Link to="/barberia" className={styles.worldEntry}>
          <span className={styles.worldIcon} aria-hidden="true">
            <IconScissors />
          </span>
          <h2 className={styles.worldTitle}>Barbería</h2>
          <p className={styles.worldSub}>Reserva tu cita</p>
        </Link>

        <Link to="/tienda" className={styles.worldEntry}>
          <span className={styles.worldIcon} aria-hidden="true">
            <IconShirt />
          </span>
          <h2 className={styles.worldTitle}>Tienda</h2>
          <p className={styles.worldSub}>Marca πίστη</p>
        </Link>
      </section>

      <Banner />
    </main>
  )
}
