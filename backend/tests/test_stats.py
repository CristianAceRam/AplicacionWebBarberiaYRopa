"""Tests del endpoint GET /admin/stats."""
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest

from app.models import Cita, EstadoCita, EstadoReservaPrenda, Prenda, ReservaPrenda, Rol, Servicio, TallaPrenda, Usuario
from app.security import hash_password

_MADRID = ZoneInfo("Europe/Madrid")


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Helpers para construir datos de prueba
# ---------------------------------------------------------------------------

def _cita(db, cliente_id: int, servicio_id: int, fecha: date, estado: EstadoCita = EstadoCita.activa) -> Cita:
    c = Cita(
        cliente_id=cliente_id,
        servicio_id=servicio_id,
        fecha=fecha,
        hora_inicio=time(10, 0),
        hora_fin=time(10, 30),
        estado=estado,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def _prenda(db) -> Prenda:
    p = Prenda(
        nombre="Camiseta test",
        descripcion="desc",
        precio=Decimal("20.00"),
        activo=True,
    )
    db.add(p)
    db.flush()
    t = TallaPrenda(prenda_id=p.id, talla="M", disponible=True)
    db.add(t)
    db.commit()
    db.refresh(p)
    return p


def _reserva(db, cliente_id: int, prenda_id: int, creada_en: datetime,
             estado: EstadoReservaPrenda = EstadoReservaPrenda.pendiente) -> ReservaPrenda:
    r = ReservaPrenda(
        cliente_id=cliente_id,
        prenda_id=prenda_id,
        talla="M",
        estado=estado,
        creada_en=creada_en,  # inyectado explícito — server_default no porta tz en SQLite
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def _cliente(db, email: str, inasistencias: int = 0, bloqueado: bool = False) -> Usuario:
    u = Usuario(
        email=email,
        password_hash=hash_password("pass12345"),
        telefono="600000099",
        nombre_completo="Cliente Stats",
        rol=Rol.cliente,
        inasistencias=inasistencias,
        bloqueado=bloqueado,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _servicio(db) -> Servicio:
    s = Servicio(nombre="Corte stats", duracion_minutos=30, precio=Decimal("15.00"), activo=True)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


# Semana actual (lunes–domingo) según Europe/Madrid, calculada igual que en el endpoint
def _semana_madrid():
    today = datetime.now(_MADRID).date()
    lunes = today - timedelta(days=today.weekday())
    domingo = lunes + timedelta(days=6)
    return lunes, domingo


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestStats:
    def test_sin_datos(self, client, admin_token):
        r = client.get("/admin/stats", headers=_auth(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert data["citas_hoy"] == 0
        assert data["citas_semana"] == 0
        assert data["clientes_atencion"] == 0
        assert data["reservas_pendientes"] == 0
        assert data["reservas_semana"] == 0
        assert data["pendientes_atencion"] == 0

    def test_citas_hoy(self, client, db_session, admin_token):
        today = datetime.now(_MADRID).date()
        ayer = today - timedelta(days=1)
        srv = _servicio(db_session)
        cli = _cliente(db_session, "cli_hoy@t.com")

        _cita(db_session, cli.id, srv.id, today, EstadoCita.activa)    # cuenta
        _cita(db_session, cli.id, srv.id, today, EstadoCita.cancelada) # no cuenta (estado)
        _cita(db_session, cli.id, srv.id, ayer, EstadoCita.activa)     # no cuenta (fecha)

        r = client.get("/admin/stats", headers=_auth(admin_token))
        assert r.status_code == 200
        assert r.json()["citas_hoy"] == 1

    def test_citas_semana(self, client, db_session, admin_token):
        lunes, domingo = _semana_madrid()
        semana_pasada_lunes = lunes - timedelta(days=7)
        srv = _servicio(db_session)
        cli = _cliente(db_session, "cli_sem@t.com")

        _cita(db_session, cli.id, srv.id, lunes, EstadoCita.activa)              # cuenta (lunes)
        _cita(db_session, cli.id, srv.id, domingo, EstadoCita.activa)            # cuenta (domingo)
        _cita(db_session, cli.id, srv.id, semana_pasada_lunes, EstadoCita.activa) # no cuenta

        r = client.get("/admin/stats", headers=_auth(admin_token))
        assert r.status_code == 200
        assert r.json()["citas_semana"] == 2

    def test_citas_semana_estado_no_activa_no_cuenta(self, client, db_session, admin_token):
        lunes, _ = _semana_madrid()
        srv = _servicio(db_session)
        cli = _cliente(db_session, "cli_sem2@t.com")

        _cita(db_session, cli.id, srv.id, lunes, EstadoCita.cancelada)
        _cita(db_session, cli.id, srv.id, lunes, EstadoCita.no_asistida)

        r = client.get("/admin/stats", headers=_auth(admin_token))
        assert r.json()["citas_semana"] == 0

    def test_clientes_atencion_inasistencias(self, client, db_session, admin_token):
        _cliente(db_session, "ins3@t.com", inasistencias=3, bloqueado=False)  # cuenta (≥3)
        _cliente(db_session, "ins2@t.com", inasistencias=2, bloqueado=False)  # no cuenta (<3)

        r = client.get("/admin/stats", headers=_auth(admin_token))
        assert r.json()["clientes_atencion"] == 1

    def test_clientes_atencion_bloqueado(self, client, db_session, admin_token):
        _cliente(db_session, "bloq@t.com", inasistencias=0, bloqueado=True)   # cuenta
        _cliente(db_session, "norm@t.com", inasistencias=0, bloqueado=False)  # no cuenta

        r = client.get("/admin/stats", headers=_auth(admin_token))
        assert r.json()["clientes_atencion"] == 1

    def test_clientes_atencion_ambos_condiciones_una_vez(self, client, db_session, admin_token):
        # Un mismo cliente con AMBAS condiciones → cuenta UNA vez (no duplicado)
        _cliente(db_session, "ambos@t.com", inasistencias=5, bloqueado=True)

        r = client.get("/admin/stats", headers=_auth(admin_token))
        assert r.json()["clientes_atencion"] == 1

    def test_reservas_pendientes(self, client, db_session, admin_token):
        ahora = datetime.now(_MADRID)
        cli = _cliente(db_session, "cli_res@t.com")
        p = _prenda(db_session)

        _reserva(db_session, cli.id, p.id, ahora, EstadoReservaPrenda.pendiente)  # cuenta
        _reserva(db_session, cli.id, p.id, ahora, EstadoReservaPrenda.atendida)   # no cuenta
        _reserva(db_session, cli.id, p.id, ahora, EstadoReservaPrenda.cancelada)  # no cuenta

        r = client.get("/admin/stats", headers=_auth(admin_token))
        assert r.json()["reservas_pendientes"] == 1

    def test_reservas_semana(self, client, db_session, admin_token):
        ahora = datetime.now(_MADRID)
        semana_pasada = ahora - timedelta(days=7)
        cli = _cliente(db_session, "cli_rsem@t.com")
        p = _prenda(db_session)

        _reserva(db_session, cli.id, p.id, ahora, EstadoReservaPrenda.pendiente)         # cuenta (esta semana)
        _reserva(db_session, cli.id, p.id, semana_pasada, EstadoReservaPrenda.pendiente) # no cuenta (semana pasada)

        r = client.get("/admin/stats", headers=_auth(admin_token))
        assert r.json()["reservas_semana"] == 1

    def test_pendientes_atencion_es_suma(self, client, db_session, admin_token):
        ahora = datetime.now(_MADRID)
        cli = _cliente(db_session, "cli_pa@t.com", inasistencias=3)
        p = _prenda(db_session)
        _reserva(db_session, cli.id, p.id, ahora, EstadoReservaPrenda.pendiente)
        _reserva(db_session, cli.id, p.id, ahora, EstadoReservaPrenda.pendiente)

        r = client.get("/admin/stats", headers=_auth(admin_token))
        data = r.json()
        assert data["pendientes_atencion"] == data["clientes_atencion"] + data["reservas_pendientes"]

    def test_cliente_no_puede_acceder(self, client, cliente_token):
        r = client.get("/admin/stats", headers=_auth(cliente_token))
        assert r.status_code == 403

    def test_sin_token_401(self, client):
        r = client.get("/admin/stats")
        assert r.status_code == 401