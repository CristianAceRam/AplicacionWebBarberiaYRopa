from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_usuario_actual, solo_admin
from app.models import EstadoReservaPrenda, Prenda, ReservaPrenda, TallaPrenda, Usuario
from app.notificaciones.telegram import enviar_aviso_peluquero
from app.rate_limit import get_real_ip, limiter
from app.schemas import ReservaCreate, ReservaReadAdmin, ReservaReadCliente
from app.security import decode_access_token

router = APIRouter(tags=["tienda-reservas"])


def _key_usuario(request: Request) -> str:
    """Rate-limit key por user_id del JWT; fallback a IP si el token no es válido."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            payload = decode_access_token(auth.split(" ")[1])
            return f"user:{payload['sub']}"
        except Exception:
            pass
    return get_real_ip(request)


# ---------------------------------------------------------------------------
# Rutas — literales antes que parámetros
# ---------------------------------------------------------------------------

@router.get("/reservas/mias", response_model=list[ReservaReadCliente])
def mis_reservas(
    usuario: Usuario = Depends(get_usuario_actual),
    db: Session = Depends(get_db),
):
    return (
        db.query(ReservaPrenda)
        .filter(ReservaPrenda.cliente_id == usuario.id)
        .order_by(ReservaPrenda.creada_en.desc())
        .all()
    )


@router.patch("/reservas/{reserva_id}/cancelar", response_model=ReservaReadCliente)
def cancelar_reserva(
    reserva_id: int,
    usuario: Usuario = Depends(get_usuario_actual),
    db: Session = Depends(get_db),
):
    reserva = db.get(ReservaPrenda, reserva_id)
    if not reserva:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reserva no encontrada")
    if usuario.rol != "admin" and reserva.cliente_id != usuario.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso sobre esta reserva")
    if reserva.estado != EstadoReservaPrenda.pendiente:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Solo se pueden cancelar reservas en estado 'pendiente'",
        )
    reserva.estado = EstadoReservaPrenda.cancelada
    db.commit()
    db.refresh(reserva)
    return reserva


@router.patch("/reservas/{reserva_id}/atender", response_model=ReservaReadAdmin)
def atender_reserva(
    reserva_id: int,
    _: Usuario = Depends(solo_admin),
    db: Session = Depends(get_db),
):
    reserva = db.get(ReservaPrenda, reserva_id)
    if not reserva:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reserva no encontrada")
    if reserva.estado == EstadoReservaPrenda.cancelada:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No se puede atender una reserva cancelada",
        )
    reserva.estado = EstadoReservaPrenda.atendida
    db.commit()
    db.refresh(reserva)
    return reserva


@router.patch("/reservas/{reserva_id}/desatender", response_model=ReservaReadAdmin)
def desatender_reserva(
    reserva_id: int,
    _: Usuario = Depends(solo_admin),
    db: Session = Depends(get_db),
):
    reserva = db.get(ReservaPrenda, reserva_id)
    if not reserva:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reserva no encontrada")
    if reserva.estado != EstadoReservaPrenda.atendida:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Solo se puede desatender una reserva atendida",
        )
    reserva.estado = EstadoReservaPrenda.pendiente
    db.commit()
    db.refresh(reserva)
    return reserva


@router.get("/reservas", response_model=list[ReservaReadAdmin])
def listar_reservas(
    estado: EstadoReservaPrenda | None = None,
    prenda_id: int | None = None,
    _: Usuario = Depends(solo_admin),
    db: Session = Depends(get_db),
):
    q = db.query(ReservaPrenda).order_by(ReservaPrenda.creada_en.desc())
    if estado is not None:
        q = q.filter(ReservaPrenda.estado == estado)
    if prenda_id is not None:
        q = q.filter(ReservaPrenda.prenda_id == prenda_id)
    return q.all()


@router.post("/reservas", response_model=ReservaReadCliente, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute", key_func=_key_usuario)
@limiter.limit("50/day", key_func=_key_usuario)
def crear_reserva(
    request: Request,
    background_tasks: BackgroundTasks,
    body: ReservaCreate,
    usuario: Usuario = Depends(get_usuario_actual),
    db: Session = Depends(get_db),
):
    if usuario.bloqueado:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu cuenta está bloqueada. Contacta con el administrador.",
        )

    prenda = db.get(Prenda, body.prenda_id)
    if not prenda or not prenda.activo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prenda no encontrada o inactiva")

    talla_obj = (
        db.query(TallaPrenda)
        .filter(TallaPrenda.prenda_id == body.prenda_id, TallaPrenda.talla == body.talla)
        .first()
    )
    if not talla_obj:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"La talla '{body.talla}' no existe para esta prenda",
        )
    if not talla_obj.disponible:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"La talla '{body.talla}' no está disponible actualmente",
        )

    reserva = ReservaPrenda(
        cliente_id=usuario.id,
        prenda_id=body.prenda_id,
        talla=body.talla,
    )
    db.add(reserva)
    db.commit()
    db.refresh(reserva)

    mensaje = (
        f"🛍️ Nueva reserva de prenda\n"
        f"Cliente: {usuario.nombre_completo} · {usuario.telefono}\n"
        f"Prenda: {prenda.nombre}\n"
        f"Talla: {body.talla}\n"
        f"Reserva #{reserva.id}"
    )
    background_tasks.add_task(enviar_aviso_peluquero, mensaje)

    return reserva
