import { usePrendas } from '../../hooks/usePrendas.js'
import EstadoCargando from '../../components/ui/EstadoCargando.jsx'
import EstadoError from '../../components/ui/EstadoError.jsx'
import EstadoVacio from '../../components/ui/EstadoVacio.jsx'
import PrendaCard from '../../components/PrendaCard/PrendaCard.jsx'
import styles from './Catalogo.module.css'
import AnimatedContent from '../../components/AnimatedContent/AnimatedContent.jsx'

function normKey(cat) {
  return (cat ?? '').trim().toLowerCase()
}

function headingLabel(cat) {
  const s = (cat ?? '').trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Otros'
}

function agruparPrendas(prendas) {
  // TODO: categorías controladas (constante o tabla) pendiente de confirmar con Alex
  //       Hoy string libre → riesgo de duplicados por "Sudadera" vs "Sudaderas"
  const map = new Map()
  for (const p of prendas) {
    const key = normKey(p.categoria) || '__otros'
    if (!map.has(key)) map.set(key, { label: headingLabel(p.categoria), items: [] })
    map.get(key).items.push(p)
  }
  // 'Otros' siempre al final
  const entries = [...map.entries()]
  const otrosIdx = entries.findIndex(([k]) => k === '__otros')
  if (otrosIdx > 0) {
    const [otros] = entries.splice(otrosIdx, 1)
    entries.push(otros)
  }
  return entries.map(([, v]) => v)
}

export default function Catalogo() {
  const { prendas, cargando, error, recargar } = usePrendas()

  if (cargando) return <EstadoCargando />
  if (error)    return <AnimatedContent><EstadoError onReintentar={recargar} /></AnimatedContent>
  if (!prendas.length) return <AnimatedContent><EstadoVacio /></AnimatedContent>

  const todasSinCategoria = prendas.every(p => !p.categoria?.trim())
  const grupos = agruparPrendas(prendas)

  return (
    <AnimatedContent>
      {todasSinCategoria ? (
        <div className={styles.grid}>
          {prendas.map(p => <PrendaCard key={p.id} prenda={p} />)}
        </div>
      ) : (
        <div className={styles.catalogo}>
          {grupos.map(g => (
            <section key={g.label} className={styles.seccion}>
              <h2 className={styles.seccionTitulo}>{g.label}</h2>
              <div className={styles.rail}>
                {g.items.map(p => <PrendaCard key={p.id} prenda={p} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </AnimatedContent>
  )
}
