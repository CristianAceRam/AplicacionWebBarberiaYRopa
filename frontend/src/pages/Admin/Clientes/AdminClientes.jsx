import { useState } from 'react'
import { useAuth } from '../../../context/AuthContext.jsx'
import { ApiError } from '../../../api/api.js'
import { useAdminClientes } from '../../../hooks/useAdminClientes.js'
import EstadoCargando from '../../../components/ui/EstadoCargando.jsx'
import EstadoError from '../../../components/ui/EstadoError.jsx'
import CtaSecondary from '../../../components/CtaSecondary/CtaSecondary.jsx'
import AnimatedContent from '../../../components/AnimatedContent/AnimatedContent.jsx'
import ConfirmInline from '../../../components/ui/ConfirmInline.jsx'
import styles from './AdminClientes.module.css'

function formatTel(t) {
  return t.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')
}

export default function AdminClientes() {
  const { fetchWithAuth } = useAuth()
  const { clientes, setClientes, cargando, error, recargar } = useAdminClientes()

  const [confirmandoId, setConfirmandoId] = useState(null)
  const [procesandoId,  setProcesandoId]  = useState(null)
  const [errorCliente,  setErrorCliente]  = useState(null)

  if (cargando) return <EstadoCargando mensaje="Cargando clientes…" />
  if (error)    return <AnimatedContent><EstadoError mensaje="No se pudo cargar la lista de clientes." onReintentar={recargar} /></AnimatedContent>

  const clientesOrdenados = [...clientes].sort((a, b) => {
    if (a.bloqueado !== b.bloqueado) return a.bloqueado ? -1 : 1
    if (b.inasistencias !== a.inasistencias) return b.inasistencias - a.inasistencias
    return a.nombre_completo.localeCompare(b.nombre_completo, 'es')
  })

  async function handleToggleBloquear(cliente) {
    const accion = cliente.bloqueado ? 'desbloquear' : 'bloquear'
    setProcesandoId(cliente.id)
    setConfirmandoId(null)
    setErrorCliente(null)

    setClientes(prev => prev.map(c =>
      c.id === cliente.id ? { ...c, bloqueado: !c.bloqueado } : c
    ))

    try {
      const data = await fetchWithAuth(`/usuarios/${cliente.id}/${accion}`, { method: 'PATCH' })
      setClientes(prev => prev.map(c => c.id === data.id ? data : c))
    } catch (err) {
      setClientes(prev => prev.map(c => c.id === cliente.id ? cliente : c))
      let msg = 'No se pudo completar la acción. Inténtalo de nuevo.'
      if (err instanceof ApiError && err.data?.detail) {
        msg = err.data.detail
      }
      setErrorCliente({ id: cliente.id, msg })
    } finally {
      setProcesandoId(null)
    }
  }

  const ocupado = procesandoId !== null

  return (
    <AnimatedContent>
    <div className={styles.wrap}>
      <h2 className={styles.titulo}>Clientes</h2>

      {clientesOrdenados.length === 0 ? (
        <p className={styles.vacio}>No hay clientes registrados todavía.</p>
      ) : (
        <ul className={styles.lista}>
          {clientesOrdenados.map(cliente => (
            <li
              key={cliente.id}
              className={`${styles.clienteItem} ${cliente.bloqueado ? styles.clienteItemBloqueado : ''}`}
            >
              <div className={styles.clienteMain}>
                <div className={styles.clienteCabecera}>
                  <span className={styles.clienteNombre}>{cliente.nombre_completo}</span>
                  {cliente.bloqueado
                    ? <span className={styles.badgeBloqueado}>Bloqueado</span>
                    : <span className={styles.badgeActivo}>Activo</span>}
                </div>

                <span className={styles.clienteInfoLinea}>{cliente.email}</span>

                <a
                  href={`tel:${cliente.telefono}`}
                  className={styles.telLink}
                  aria-label={`Llamar a ${cliente.nombre_completo}: ${formatTel(cliente.telefono)}`}
                >
                  {formatTel(cliente.telefono)}
                </a>

                <div className={styles.inasistenciasWrap}>
                  <span className={styles.clienteInfoLinea}>Inasistencias:</span>
                  <span className={`${styles.inasistenciasNum} ${cliente.inasistencias >= 3 ? styles.numAlto : ''}`}>
                    {cliente.inasistencias}
                  </span>
                </div>
              </div>

              <div className={styles.clienteFooter}>
                {confirmandoId !== cliente.id && (
                  <CtaSecondary
                    size="sm"
                    danger={!cliente.bloqueado}
                    disabled={ocupado}
                    onClick={() => { setErrorCliente(null); setConfirmandoId(cliente.id) }}
                  >
                    {cliente.bloqueado ? 'Desbloquear' : 'Bloquear'}
                  </CtaSecondary>
                )}
              </div>

              {confirmandoId === cliente.id && (
                <ConfirmInline
                  msg={cliente.bloqueado
                    ? `¿Desbloquear a ${cliente.nombre_completo}?`
                    : `¿Bloquear a ${cliente.nombre_completo}? No podrá hacer reservas.`}
                  labelSi={procesandoId === cliente.id ? '…' : (cliente.bloqueado ? 'Sí, desbloquear' : 'Sí, bloquear')}
                  onNo={() => setConfirmandoId(null)}
                  onSi={() => handleToggleBloquear(cliente)}
                  disabled={ocupado}
                  peligro={!cliente.bloqueado}
                />
              )}

              {errorCliente?.id === cliente.id && (
                <p role="alert" className={styles.errorClienteItem}>{errorCliente.msg}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
    </AnimatedContent>
  )
}
