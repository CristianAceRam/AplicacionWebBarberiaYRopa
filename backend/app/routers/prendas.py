from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_usuario_opcional, solo_admin
from app.models import (
    EstadoReservaPrenda,
    ImagenPrenda,
    Prenda,
    ReservaPrenda,
    Rol,
    TallaPrenda,
    Usuario,
)
from app.notificaciones.cloudinary import borrar_imagen
from app.schemas import (
    ImagenCreate,
    ImagenOrdenItem,
    ImagenRead,
    ImagenUpdate,
    PrendaCreate,
    PrendaDetalleRead,
    PrendaListaRead,
    PrendaUpdate,
    TallaCreate,
    TallaRead,
    TallaUpdate,
)

router = APIRouter(tags=["tienda-prendas"])

MAX_IMAGENES_PRENDA = 8


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_prenda_or_404(prenda_id: int, db: Session) -> Prenda:
    p = db.get(Prenda, prenda_id)
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prenda no encontrada")
    return p


def _to_lista_read(p: Prenda) -> PrendaListaRead:
    return PrendaListaRead.model_validate({
        "id":             p.id,
        "nombre":         p.nombre,
        "precio":         p.precio,
        "categoria":      p.categoria,
        "activo":         p.activo,
        "primera_imagen": p.imagenes[0] if p.imagenes else None,
        "tallas":         p.tallas,
    })


def _to_detalle_read(p: Prenda) -> PrendaDetalleRead:
    return PrendaDetalleRead.model_validate({
        "id":             p.id,
        "nombre":         p.nombre,
        "descripcion":    p.descripcion,
        "precio":         p.precio,
        "categoria":      p.categoria,
        "activo":         p.activo,
        "primera_imagen": p.imagenes[0] if p.imagenes else None,
        "imagenes":       p.imagenes,
        "tallas":         p.tallas,
    })


# ---------------------------------------------------------------------------
# Catálogo — rutas literales antes que rutas con parámetro
# ---------------------------------------------------------------------------

@router.get("/prendas", response_model=list[PrendaListaRead])
def listar_prendas(
    incluir_inactivas: bool = False,
    usuario: Usuario | None = Depends(get_usuario_opcional),
    db: Session = Depends(get_db),
):
    es_admin = usuario is not None and usuario.rol == Rol.admin
    q = db.query(Prenda)
    if not (incluir_inactivas and es_admin):
        q = q.filter(Prenda.activo == True)
    return [_to_lista_read(p) for p in q.all()]


@router.post("/prendas", response_model=PrendaDetalleRead, status_code=status.HTTP_201_CREATED)
def crear_prenda(
    body: PrendaCreate,
    _: Usuario = Depends(solo_admin),
    db: Session = Depends(get_db),
):
    prenda = Prenda(**body.model_dump())
    db.add(prenda)
    db.commit()
    db.refresh(prenda)
    return _to_detalle_read(prenda)


@router.get("/prendas/{prenda_id}", response_model=PrendaDetalleRead)
def obtener_prenda(
    prenda_id: int,
    usuario: Usuario | None = Depends(get_usuario_opcional),
    db: Session = Depends(get_db),
):
    p = _get_prenda_or_404(prenda_id, db)
    es_admin = usuario is not None and usuario.rol == Rol.admin
    if not p.activo and not es_admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prenda no encontrada")
    return _to_detalle_read(p)


@router.put("/prendas/{prenda_id}", response_model=PrendaDetalleRead)
def actualizar_prenda(
    prenda_id: int,
    body: PrendaUpdate,
    _: Usuario = Depends(solo_admin),
    db: Session = Depends(get_db),
):
    p = _get_prenda_or_404(prenda_id, db)
    for campo, valor in body.model_dump(exclude_unset=True).items():
        setattr(p, campo, valor)
    db.commit()
    db.refresh(p)
    return _to_detalle_read(p)


@router.delete(
    "/prendas/{prenda_id}/permanente",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(solo_admin)],
)
def borrar_prenda_permanente(
    prenda_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    p = _get_prenda_or_404(prenda_id, db)

    n_pendientes = (
        db.query(ReservaPrenda)
        .filter(
            ReservaPrenda.prenda_id == prenda_id,
            ReservaPrenda.estado == EstadoReservaPrenda.pendiente,
        )
        .count()
    )
    if n_pendientes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Esta prenda tiene {n_pendientes} reserva(s) pendiente(s). "
                   "Atiéndelas o cancélalas antes de borrar.",
        )

    # Capturar public_ids antes del borrado — el cascade los elimina de BD
    public_ids = [img.public_id for img in p.imagenes if img.public_id]

    # ReservaPrenda.prenda_id no tiene cascade; borrado explícito e intencional
    # (reservas históricas se pierden a propósito — para conservar historial existe desactivar)
    db.query(ReservaPrenda).filter(ReservaPrenda.prenda_id == prenda_id).delete()

    # cascade "all, delete-orphan" en tallas e imagenes → se borran automáticamente
    db.delete(p)
    db.commit()

    for public_id in public_ids:
        background_tasks.add_task(borrar_imagen, public_id)


@router.delete("/prendas/{prenda_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_prenda(
    prenda_id: int,
    _: Usuario = Depends(solo_admin),
    db: Session = Depends(get_db),
):
    # TODO: purga_prendas — imágenes de esta prenda permanecen en Cloudinary (puede reactivarse)
    p = _get_prenda_or_404(prenda_id, db)
    p.activo = False
    db.commit()


# ---------------------------------------------------------------------------
# Tallas
# ---------------------------------------------------------------------------

def _get_talla_or_404(prenda_id: int, talla_id: int, db: Session) -> TallaPrenda:
    t = db.query(TallaPrenda).filter(
        TallaPrenda.id == talla_id, TallaPrenda.prenda_id == prenda_id
    ).first()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Talla no encontrada")
    return t


@router.post(
    "/prendas/{prenda_id}/tallas",
    response_model=TallaRead,
    status_code=status.HTTP_201_CREATED,
)
def añadir_talla(
    prenda_id: int,
    body: TallaCreate,
    _: Usuario = Depends(solo_admin),
    db: Session = Depends(get_db),
):
    _get_prenda_or_404(prenda_id, db)
    talla = TallaPrenda(prenda_id=prenda_id, **body.model_dump())
    db.add(talla)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La talla '{body.talla}' ya existe para esta prenda",
        )
    db.refresh(talla)
    return talla


@router.patch("/prendas/{prenda_id}/tallas/{talla_id}", response_model=TallaRead)
def actualizar_talla(
    prenda_id: int,
    talla_id: int,
    body: TallaUpdate,
    _: Usuario = Depends(solo_admin),
    db: Session = Depends(get_db),
):
    talla = _get_talla_or_404(prenda_id, talla_id, db)
    talla.disponible = body.disponible
    db.commit()
    db.refresh(talla)
    return talla


@router.delete("/prendas/{prenda_id}/tallas/{talla_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_talla(
    prenda_id: int,
    talla_id: int,
    _: Usuario = Depends(solo_admin),
    db: Session = Depends(get_db),
):
    talla = _get_talla_or_404(prenda_id, talla_id, db)
    tiene_pendientes = (
        db.query(ReservaPrenda)
        .filter(
            ReservaPrenda.prenda_id == prenda_id,
            ReservaPrenda.talla == talla.talla,
            ReservaPrenda.estado == EstadoReservaPrenda.pendiente,
        )
        .count() > 0
    )
    if tiene_pendientes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar la talla: tiene reservas pendientes",
        )
    db.delete(talla)
    db.commit()


# ---------------------------------------------------------------------------
# Imágenes
# ---------------------------------------------------------------------------

@router.put(
    "/prendas/{prenda_id}/imagenes/orden",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(solo_admin)],
)
def reordenar_imagenes_prenda(
    prenda_id: int,
    items: list[ImagenOrdenItem],
    db: Session = Depends(get_db),
):
    _get_prenda_or_404(prenda_id, db)
    ids = [i.id for i in items]
    imagenes = db.query(ImagenPrenda).filter(
        ImagenPrenda.id.in_(ids),
        ImagenPrenda.prenda_id == prenda_id,
    ).all()
    img_map = {img.id: img for img in imagenes}
    for item in items:
        if item.id not in img_map:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Imagen {item.id} no encontrada en esta prenda",
            )
        img_map[item.id].posicion = item.posicion
    db.commit()
    return {"updated": len(items)}


def _get_imagen_or_404(prenda_id: int, imagen_id: int, db: Session) -> ImagenPrenda:
    img = db.query(ImagenPrenda).filter(
        ImagenPrenda.id == imagen_id, ImagenPrenda.prenda_id == prenda_id
    ).first()
    if not img:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imagen no encontrada")
    return img


@router.post(
    "/prendas/{prenda_id}/imagenes",
    response_model=ImagenRead,
    status_code=status.HTTP_201_CREATED,
)
def añadir_imagen(
    prenda_id: int,
    body: ImagenCreate,
    _: Usuario = Depends(solo_admin),
    db: Session = Depends(get_db),
):
    _get_prenda_or_404(prenda_id, db)
    n_imagenes = db.query(ImagenPrenda).filter(ImagenPrenda.prenda_id == prenda_id).count()
    if n_imagenes >= MAX_IMAGENES_PRENDA:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Esta prenda ya tiene el máximo de {MAX_IMAGENES_PRENDA} imágenes.",
        )
    if body.posicion is None:
        posicion = n_imagenes * 10
    else:
        posicion = body.posicion
    imagen = ImagenPrenda(
        prenda_id=prenda_id, url=body.url, public_id=body.public_id, posicion=posicion
    )
    db.add(imagen)
    db.commit()
    db.refresh(imagen)
    return imagen


@router.patch("/prendas/{prenda_id}/imagenes/{imagen_id}", response_model=ImagenRead)
def actualizar_imagen(
    prenda_id: int,
    imagen_id: int,
    body: ImagenUpdate,
    _: Usuario = Depends(solo_admin),
    db: Session = Depends(get_db),
):
    img = _get_imagen_or_404(prenda_id, imagen_id, db)
    img.posicion = body.posicion
    db.commit()
    db.refresh(img)
    return img


@router.delete(
    "/prendas/{prenda_id}/imagenes/{imagen_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def borrar_imagen_prenda(
    prenda_id: int,
    imagen_id: int,
    background_tasks: BackgroundTasks,
    _: Usuario = Depends(solo_admin),
    db: Session = Depends(get_db),
):
    img = _get_imagen_or_404(prenda_id, imagen_id, db)
    public_id = img.public_id
    db.delete(img)
    db.commit()
    background_tasks.add_task(borrar_imagen, public_id)
