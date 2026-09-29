import { useState } from 'react'
import { useAuth } from '../../../context/AuthContext.jsx'
import { useAdminGaleria } from '../../../hooks/useAdminGaleria.js'
import { cloudinaryUrl } from '../../../utils/cloudinary.js'
import EstadoCargando from '../../../components/ui/EstadoCargando.jsx'
import EstadoError from '../../../components/ui/EstadoError.jsx'
import AnimatedContent from '../../../components/AnimatedContent/AnimatedContent.jsx'
import styles from './AdminGaleria.module.css'

const FOLDER_GALERIA   = 'pistia/galeria'
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES        = 5_000_000
const MAX_FOTOS        = 12  // guard solo-frontend: galería gestionada únicamente por el admin, sin concurrencia

export default function AdminGaleria() {
  const { fetchWithAuth } = useAuth()
  const { fotos, setFotos, cargando, error, recargar } = useAdminGaleria()

  const [subiendo,             setSubiendo]             = useState(false)
  const [errorSubida,          setErrorSubida]          = useState(null)
  const [reordenando,          setReordenando]          = useState(false)
  const [errorReorden,         setErrorReorden]         = useState(null)
  const [confirmandoBorradoId, setConfirmandoBorradoId] = useState(null)
  const [borrandoId,           setBorrandoId]           = useState(null)
  const [errorBorrado,         setErrorBorrado]         = useState({})

  const topeAlcanzado = fotos.length >= MAX_FOTOS
  const ocupado       = reordenando || borrandoId !== null

  if (cargando) return <EstadoCargando mensaje="Cargando galería…" />
  if (error)    return <AnimatedContent><EstadoError mensaje="No se pudo cargar la galería." onReintentar={recargar} /></AnimatedContent>

  // ── Subida ─────────────────────────────────────────────────────────────────

  async function handleSubirFoto(e) {
    const fichero = e.target.files[0]
    e.target.value = ''
    if (!fichero) return

    if (!TIPOS_PERMITIDOS.includes(fichero.type)) {
      setErrorSubida('Solo se permiten imágenes JPEG, PNG o WebP.')
      return
    }
    if (fichero.size > MAX_BYTES) {
      setErrorSubida('El archivo supera el límite de 5 MB.')
      return
    }

    setSubiendo(true)
    setErrorSubida(null)

    let firma
    try {
      firma = await fetchWithAuth('/cloudinary/firma', {
        method: 'POST',
        body: { folder: FOLDER_GALERIA },
      })
    } catch {
      setErrorSubida('No se pudo obtener la firma. Inténtalo de nuevo.')
      setSubiendo(false)
      return
    }

    const fd = new FormData()
    fd.append('file',            fichero)
    fd.append('api_key',         firma.api_key)
    fd.append('signature',       firma.signature)
    fd.append('timestamp',       String(firma.timestamp))
    fd.append('folder',          firma.folder)
    fd.append('allowed_formats', firma.allowed_formats)

    let cloudRes
    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${firma.cloud_name}/image/upload`,
        { method: 'POST', body: fd },
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'Error Cloudinary')
      }
      cloudRes = await res.json()
    } catch (err) {
      setErrorSubida(`Error al subir la imagen: ${err.message ?? 'Inténtalo de nuevo.'}`)
      setSubiendo(false)
      return
    }

    try {
      const nueva = await fetchWithAuth('/galeria', {
        method: 'POST',
        body: { url: cloudRes.secure_url, public_id: cloudRes.public_id },
      })
      setFotos(prev => [...prev, nueva])
    } catch {
      setErrorSubida('No se pudo guardar la foto en la galería.')
    } finally {
      setSubiendo(false)
    }
  }

  // ── Reordenación (bulk, optimista) ─────────────────────────────────────────

  async function handleReorden(nuevoOrden) {
    const prevFotos = fotos
    const reordenadas = nuevoOrden.map((f, i) => ({ ...f, posicion: i * 10 }))
    setFotos(reordenadas)
    setReordenando(true)
    setErrorReorden(null)
    try {
      await fetchWithAuth('/galeria/orden', {
        method: 'PUT',
        body: reordenadas.map(f => ({ id: f.id, posicion: f.posicion })),
      })
    } catch {
      setFotos(prevFotos)
      setErrorReorden('No se pudo guardar el orden. Inténtalo de nuevo.')
    } finally {
      setReordenando(false)
    }
  }

  function handleSubir(foto) {
    const idx = fotos.findIndex(f => f.id === foto.id)
    if (idx <= 0) return
    const nuevas = [...fotos]
    ;[nuevas[idx - 1], nuevas[idx]] = [nuevas[idx], nuevas[idx - 1]]
    handleReorden(nuevas)
  }

  function handleBajar(foto) {
    const idx = fotos.findIndex(f => f.id === foto.id)
    if (idx >= fotos.length - 1) return
    const nuevas = [...fotos]
    ;[nuevas[idx], nuevas[idx + 1]] = [nuevas[idx + 1], nuevas[idx]]
    handleReorden(nuevas)
  }

  // ── Borrado (dos pasos) ────────────────────────────────────────────────────

  async function handleBorrar(foto) {
    setBorrandoId(foto.id)
    setErrorBorrado(prev => { const n = { ...prev }; delete n[foto.id]; return n })
    try {
      await fetchWithAuth(`/galeria/${foto.id}`, { method: 'DELETE' })
      setFotos(prev => prev.filter(f => f.id !== foto.id))
      setConfirmandoBorradoId(null)
    } catch {
      setErrorBorrado(prev => ({ ...prev, [foto.id]: 'No se pudo borrar.' }))
    } finally {
      setBorrandoId(null)
    }
  }

  function handleCancelarBorrado(foto) {
    setConfirmandoBorradoId(null)
    setErrorBorrado(prev => { const n = { ...prev }; delete n[foto.id]; return n })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AnimatedContent>
    <div className={styles.wrap}>
      <div className={styles.cabecera}>
        <h2 className={styles.titulo}>Galería del banner</h2>
        <label className={`${styles.fileLabel} ${(subiendo || topeAlcanzado) ? styles.fileLabelDisabled : ''}`}>
          {subiendo && <span className={styles.ledIndicador} aria-hidden="true" />}
          {subiendo ? 'Subiendo…' : '+ Añadir foto'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg"
            disabled={subiendo || topeAlcanzado}
            onChange={handleSubirFoto}
            className={styles.fileInput}
            aria-label="Añadir foto a la galería del banner"
          />
        </label>
      </div>

      {errorSubida && (
        <p role="alert" className={styles.errorSubida}>{errorSubida}</p>
      )}

      {topeAlcanzado && (
        <p className={styles.topeMsg}>
          Has llegado al máximo de {MAX_FOTOS} fotos. Borra una para añadir otra.
        </p>
      )}

      {fotos.length === 0 && (
        <div className={styles.estadoVacio}>
          <p>Aún no hay fotos en la galería.</p>
          <p>Añade la primera foto que aparecerá en el banner del inicio.</p>
        </div>
      )}

      {errorReorden && (
        <p role="alert" className={styles.errorReorden}>{errorReorden}</p>
      )}

      {fotos.length > 0 && (
        <div className={styles.fotosGrid}>
          {fotos.map((foto, idx) => (
            <div key={foto.id} className={styles.fotoItem}>
              <div className={styles.fotoThumb}>
                <img
                  src={cloudinaryUrl(foto.url, { width: 240 })}
                  alt=""
                  onError={e => {
                    if (e.currentTarget.dataset.fallback) return
                    e.currentTarget.dataset.fallback = '1'
                    e.currentTarget.src = foto.url
                  }}
                  className={styles.fotoMiniatura}
                />
              </div>

              {confirmandoBorradoId === foto.id ? (
                <div className={styles.fotoControles}>
                  <button
                    type="button"
                    className={`${styles.btnControl} ${styles.btnCancelarBorrar}`}
                    onClick={() => handleCancelarBorrado(foto)}
                    disabled={borrandoId === foto.id}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className={`${styles.btnControl} ${styles.btnConfirmarBorrar}`}
                    onClick={() => handleBorrar(foto)}
                    disabled={borrandoId === foto.id}
                  >
                    {borrandoId === foto.id ? '…' : 'Borrar'}
                  </button>
                </div>
              ) : (
                <div className={styles.fotoControles}>
                  <button
                    type="button"
                    className={styles.btnControl}
                    onClick={() => handleSubir(foto)}
                    disabled={ocupado || idx === 0}
                    aria-label="Mover foto hacia arriba"
                    title="Subir"
                  >↑</button>
                  <button
                    type="button"
                    className={styles.btnControl}
                    onClick={() => handleBajar(foto)}
                    disabled={ocupado || idx === fotos.length - 1}
                    aria-label="Mover foto hacia abajo"
                    title="Bajar"
                  >↓</button>
                  <button
                    type="button"
                    className={`${styles.btnControl} ${styles.btnBorrar}`}
                    onClick={() => setConfirmandoBorradoId(foto.id)}
                    disabled={ocupado}
                    aria-label="Borrar foto"
                    title="Borrar"
                  >✕</button>
                </div>
              )}

              {errorBorrado[foto.id] && (
                <p role="alert" className={styles.errorBorradoItem}>{errorBorrado[foto.id]}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
    </AnimatedContent>
  )
}
