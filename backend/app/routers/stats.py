from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import solo_admin
from app.models import Cita, EstadoCita, EstadoReservaPrenda, ReservaPrenda, Rol, Usuario
from app.schemas import AdminStats

_MADRID = ZoneInfo("Europe/Madrid")

router = APIRouter(tags=["admin"])


@router.get("/admin/stats", response_model=AdminStats)
def get_admin_stats(
    _: Usuario = Depends(solo_admin),
    db: Session = Depends(get_db),
):
    now_madrid     = datetime.now(_MADRID)
    today_madrid   = now_madrid.date()
    lunes          = today_madrid - timedelta(days=today_madrid.weekday())
    domingo        = lunes + timedelta(days=6)
    lunes_dt       = datetime(lunes.year, lunes.month, lunes.day, tzinfo=_MADRID)
    domingo_fin_dt = lunes_dt + timedelta(days=7)   # exclusivo

    citas_hoy = db.query(func.count(Cita.id)).filter(
        Cita.fecha == today_madrid,
        Cita.estado == EstadoCita.activa,
    ).scalar() or 0

    citas_semana = db.query(func.count(Cita.id)).filter(
        Cita.fecha >= lunes,
        Cita.fecha <= domingo,
        Cita.estado == EstadoCita.activa,
    ).scalar() or 0

    clientes_atencion = db.query(func.count(Usuario.id)).filter(
        Usuario.rol == Rol.cliente,
        or_(Usuario.inasistencias >= 3, Usuario.bloqueado == True),  # noqa: E712
    ).scalar() or 0

    reservas_pendientes = db.query(func.count(ReservaPrenda.id)).filter(
        ReservaPrenda.estado == EstadoReservaPrenda.pendiente,
    ).scalar() or 0

    reservas_semana = db.query(func.count(ReservaPrenda.id)).filter(
        ReservaPrenda.creada_en >= lunes_dt,
        ReservaPrenda.creada_en < domingo_fin_dt,
    ).scalar() or 0

    return AdminStats(
        citas_hoy=citas_hoy,
        citas_semana=citas_semana,
        clientes_atencion=clientes_atencion,
        reservas_pendientes=reservas_pendientes,
        reservas_semana=reservas_semana,
        pendientes_atencion=clientes_atencion + reservas_pendientes,
    )
