import { Link } from 'react-router-dom'
import { cloudinaryUrl } from '../../utils/cloudinary.js'
import styles from './PrendaCard.module.css'

const formatPrecio = (precio) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(precio))

export default function PrendaCard({ prenda }) {
  const { id, nombre, precio, primera_imagen, tallas } = prenda

  return (
    <Link
      to={`/tienda/prenda/${id}`}
      className={styles.card}
      aria-label={`Ver ${nombre}`}
    >
      <div className={styles.imgWrap}>
        {primera_imagen ? (
          <img
            src={cloudinaryUrl(primera_imagen.url, { width: 400 })}
            alt={nombre}
            loading="lazy"
            className={styles.img}
            onError={(e) => { e.currentTarget.src = primera_imagen.url }}
          />
        ) : (
          <div className={styles.imgFallback} aria-hidden="true">
            <span className={styles.piSym}>π</span>
          </div>
        )}
      </div>

      <div className={styles.info}>
        <p className={styles.nombre}>{nombre}</p>
        <p className={styles.precio}>{formatPrecio(precio)}</p>
        {tallas.length > 0 && (
          <div className={styles.tallas}>
            {tallas.map(t => (
              <span
                key={t.id}
                className={`${styles.talla} ${!t.disponible ? styles.tallaAgotada : ''}`}
              >
                {t.talla}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
