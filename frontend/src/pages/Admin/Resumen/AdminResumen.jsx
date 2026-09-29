import { Link } from 'react-router-dom'
import { useAdminStats } from '../../../hooks/useAdminStats.js'
import EstadoCargando from '../../../components/ui/EstadoCargando.jsx'
import EstadoError    from '../../../components/ui/EstadoError.jsx'
import styles from './AdminResumen.module.css'
import AnimatedContent from '../../../components/AnimatedContent/AnimatedContent.jsx'

function TarjetaEstrella({ cifra, label, sublabel, to }) {
  return (
    <Link to={to} className={styles.tarjetaEstrella}>
      <span className={styles.estrellaCifra}>{cifra}</span>
      <span className={styles.estrellaLabel}>{label}</span>
      <span className={styles.estrellaSublabel}>{sublabel}</span>
    </Link>
  )
}

function TarjetaContexto({ cifra, label, to, colorAviso = false }) {
  return (
    <Link to={to} className={styles.tarjetaContexto}>
      <span className={`${styles.contextoCifra}${colorAviso ? ` ${styles.contextoCifraAviso}` : ''}`}>
        {cifra}
      </span>
      <span className={styles.contextoLabel}>{label}</span>
    </Link>
  )
}

export default function AdminResumen() {
  const { stats, cargando, error, recargar } = useAdminStats()

  if (cargando) return <EstadoCargando mensaje="Cargando resumen…" />
  if (error)    return <AnimatedContent><EstadoError mensaje="No se pudo cargar el resumen." onReintentar={recargar} /></AnimatedContent>

  const pendientes = stats.pendientes_atencion

  return (
    <AnimatedContent>
    <div className={styles.wrap}>

      {pendientes > 0 ? (
        <Link to="/admin/reservas-tienda" className={styles.alertaBanner}>
          <span className={styles.alertaCifra}>{pendientes}</span>
          <span className={styles.alertaTexto}>
            pendiente{pendientes !== 1 ? 's' : ''} de atención
          </span>
          <span className={styles.alertaFlecha} aria-hidden="true">›</span>
        </Link>
      ) : (
        <p className={styles.todoAlDia}>Sin pendientes de atención</p>
      )}

      <div className={styles.estrellas}>
        <TarjetaEstrella
          cifra={stats.citas_hoy}
          label="Citas hoy"
          sublabel="barbería"
          to="/admin/citas"
        />
        <TarjetaEstrella
          cifra={stats.reservas_pendientes}
          label="Reservas pendientes"
          sublabel="tienda"
          to="/admin/reservas-tienda"
        />
      </div>

      <div className={styles.contexto}>
        <TarjetaContexto
          cifra={stats.citas_semana}
          label="Citas esta semana"
          to="/admin/citas"
        />
        <TarjetaContexto
          cifra={stats.reservas_semana}
          label="Reservas esta semana"
          to="/admin/reservas-tienda"
        />
        <TarjetaContexto
          cifra={stats.clientes_atencion}
          label="Clientes a vigilar"
          to="/admin/clientes"
          colorAviso={stats.clientes_atencion > 0}
        />
      </div>

    </div>
    </AnimatedContent>
  )
}