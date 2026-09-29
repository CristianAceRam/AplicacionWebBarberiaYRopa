"""
Tests de la feature de aperturas excepcionales (ExcepcionFecha tipo='abierto').

Cubre:
- Creación y validación de input (tramos, solape, múltiplos, unicidad)
- Disponibilidad con apertura (tramos propios, precedencia sobre semanal, FranjaOcupada)
- Test de zona horaria OBLIGATORIO ("para HOY", Europe/Madrid)
- POST /citas en fecha con apertura excepcional
- DELETE apertura con/sin citas activas
- GET /excepciones (admin) devuelve tramos
- GET /excepciones/proximas incluye aperturas
- Servicio que no cabe en tramo corto (límite de _calcular_disponibles)
"""
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest

from app.models import (
    Cita,
    EstadoCita,
    ExcepcionFecha,
    FranjaOcupada,
    HorarioPeluquero,
    Rol,
    Servicio,
    TipoExcepcion,
    TramoApertura,
    Usuario,
)
from app.security import create_access_token, hash_password

_MADRID = ZoneInfo("Europe/Madrid")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _hoy_madrid() -> date:
    return datetime.now(_MADRID).date()


def _tramo_payload(h_ap: str, h_ci: str) -> dict:
    return {"hora_apertura": h_ap, "hora_cierre": h_ci}


def _crear_apertura_db(db_session, fecha: date, tramos: list[tuple[time, time]]) -> ExcepcionFecha:
    """Crea una apertura excepcional directamente en BD (sin pasar por el endpoint)."""
    exc = ExcepcionFecha(fecha=fecha, tipo=TipoExcepcion.abierto)
    db_session.add(exc)
    db_session.flush()
    for ap, ci in tramos:
        db_session.add(TramoApertura(excepcion_id=exc.id, hora_apertura=ap, hora_cierre=ci))
    db_session.commit()
    db_session.refresh(exc)
    return exc


def _crear_cierre_db(db_session, fecha: date) -> ExcepcionFecha:
    exc = ExcepcionFecha(fecha=fecha, tipo=TipoExcepcion.cerrado)
    db_session.add(exc)
    db_session.commit()
    db_session.refresh(exc)
    return exc


def _servicio(db_session, duracion: int = 30) -> Servicio:
    s = Servicio(
        nombre=f"Servicio {duracion}min",
        duracion_minutos=duracion,
        precio=Decimal("15.00"),
        activo=True,
    )
    db_session.add(s)
    db_session.commit()
    db_session.refresh(s)
    return s


def _usuario_cliente(db_session, suffix: str = "") -> tuple[Usuario, str]:
    u = Usuario(
        email=f"cli{suffix}@ap.test",
        password_hash=hash_password("x"),
        telefono="600000099",
        nombre_completo="Cliente Apertura",
        rol=Rol.cliente,
    )
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u, create_access_token(u.id, u.rol.value)


def _fecha_futura(dias: int = 5) -> date:
    """Fecha futura garantizada dentro de la ventana de 30 días."""
    return _hoy_madrid() + timedelta(days=dias)


# ---------------------------------------------------------------------------
# 1–9 · Creación y validación de input
# ---------------------------------------------------------------------------

def test_crear_apertura_201(client, admin_token):
    """POST tipo='abierto' + tramo válido → 201 con tipo y tramo en respuesta."""
    fecha = str(_fecha_futura(3))
    r = client.post(
        "/excepciones",
        json={
            "fecha": fecha,
            "tipo": "abierto",
            "tramos": [_tramo_payload("20:00:00", "22:00:00")],
        },
        headers=_auth(admin_token),
    )
    assert r.status_code == 201
    data = r.json()
    assert data["tipo"] == "abierto"
    assert len(data["tramos"]) == 1
    assert data["tramos"][0]["hora_apertura"] == "20:00:00"
    assert data["tramos"][0]["hora_cierre"] == "22:00:00"


def test_crear_apertura_jornada_partida_201(client, admin_token):
    """Dos tramos sin solape → 201 con dos tramos en respuesta."""
    fecha = str(_fecha_futura(4))
    r = client.post(
        "/excepciones",
        json={
            "fecha": fecha,
            "tipo": "abierto",
            "tramos": [
                _tramo_payload("10:00:00", "14:00:00"),
                _tramo_payload("17:00:00", "21:00:00"),
            ],
        },
        headers=_auth(admin_token),
    )
    assert r.status_code == 201
    data = r.json()
    assert len(data["tramos"]) == 2


def test_crear_apertura_sin_tramos_422(client, admin_token):
    """tipo='abierto' con tramos=[] → 422 Pydantic (debe tener al menos un tramo)."""
    fecha = str(_fecha_futura(5))
    r = client.post(
        "/excepciones",
        json={"fecha": fecha, "tipo": "abierto", "tramos": []},
        headers=_auth(admin_token),
    )
    assert r.status_code == 422


def test_crear_cierre_con_tramos_422(client, admin_token):
    """tipo='cerrado' con tramos → 422 Pydantic (cierre no admite tramos)."""
    fecha = str(_fecha_futura(6))
    r = client.post(
        "/excepciones",
        json={
            "fecha": fecha,
            "tipo": "cerrado",
            "tramos": [_tramo_payload("10:00:00", "14:00:00")],
        },
        headers=_auth(admin_token),
    )
    assert r.status_code == 422


def test_crear_apertura_tramos_solapados_422(client, admin_token):
    """Dos tramos solapados → 422 Pydantic."""
    fecha = str(_fecha_futura(7))
    r = client.post(
        "/excepciones",
        json={
            "fecha": fecha,
            "tipo": "abierto",
            "tramos": [
                _tramo_payload("10:00:00", "14:00:00"),
                _tramo_payload("13:00:00", "18:00:00"),  # solape con el anterior
            ],
        },
        headers=_auth(admin_token),
    )
    assert r.status_code == 422


def test_crear_apertura_hora_no_multiplo_422(client, admin_token):
    """hora_apertura=10:15 (no múltiplo de 30) → 422 Pydantic."""
    fecha = str(_fecha_futura(8))
    r = client.post(
        "/excepciones",
        json={
            "fecha": fecha,
            "tipo": "abierto",
            "tramos": [_tramo_payload("10:15:00", "14:00:00")],
        },
        headers=_auth(admin_token),
    )
    assert r.status_code == 422


def test_unique_apertura_sobre_cierre_409(client, admin_token, db_session):
    """Cierre existente → POST apertura misma fecha → 409."""
    fecha = _fecha_futura(9)
    _crear_cierre_db(db_session, fecha)

    r = client.post(
        "/excepciones",
        json={
            "fecha": str(fecha),
            "tipo": "abierto",
            "tramos": [_tramo_payload("20:00:00", "22:00:00")],
        },
        headers=_auth(admin_token),
    )
    assert r.status_code == 409


def test_unique_cierre_sobre_apertura_409(client, admin_token, db_session):
    """Apertura existente → POST cierre misma fecha → 409."""
    fecha = _fecha_futura(10)
    _crear_apertura_db(db_session, fecha, [(time(20, 0), time(22, 0))])

    r = client.post(
        "/excepciones",
        json={"fecha": str(fecha)},  # tipo por defecto 'cerrado'
        headers=_auth(admin_token),
    )
    assert r.status_code == 409


def test_backward_compat_solo_fecha(client, admin_token):
    """POST {'fecha': ...} sin tipo → 201, tipo='cerrado' (compat. backward)."""
    fecha = str(_fecha_futura(11))
    r = client.post("/excepciones", json={"fecha": fecha}, headers=_auth(admin_token))
    assert r.status_code == 201
    data = r.json()
    assert data["tipo"] == "cerrado"
    assert data["tramos"] == []


# ---------------------------------------------------------------------------
# 10–13 · Disponibilidad con apertura excepcional
# ---------------------------------------------------------------------------

def test_disponibilidad_apertura_usa_tramos_propios(client, cliente_token, db_session):
    """
    Apertura excepcional para un día sin horario semanal ese día de la semana.
    GET /disponibilidad debe devolver horas basadas en el tramo de apertura.
    """
    fecha = _fecha_futura(3)
    _crear_apertura_db(db_session, fecha, [(time(20, 0), time(22, 0))])
    s = _servicio(db_session, 30)

    r = client.get(
        "/disponibilidad",
        params={"fecha": str(fecha), "servicio_id": s.id},
        headers=_auth(cliente_token),
    )
    assert r.status_code == 200
    horas = r.json()["horas_disponibles"]
    # Tramo 20:00-22:00, servicio 30min: slots 20:00, 20:30, 21:00, 21:30
    assert "20:00:00" in horas
    assert "21:30:00" in horas
    assert "22:00:00" not in horas  # 22:00+30min > cierre
    assert len(horas) == 4


def test_disponibilidad_apertura_precedencia_semanal(client, cliente_token, db_session):
    """
    Fecha con horario semanal 9-18 Y apertura excepcional 20-22.
    Los tramos de la apertura sustituyen al semanal: solo aparecen horas 20-21:30.
    """
    fecha = _fecha_futura(4)

    # Horario semanal para ese día (añadir para confirmar que se ignora)
    h = HorarioPeluquero(
        dia_semana=fecha.weekday(),
        hora_apertura=time(9, 0),
        hora_cierre=time(18, 0),
    )
    db_session.add(h)
    db_session.commit()

    _crear_apertura_db(db_session, fecha, [(time(20, 0), time(22, 0))])
    s = _servicio(db_session, 30)

    r = client.get(
        "/disponibilidad",
        params={"fecha": str(fecha), "servicio_id": s.id},
        headers=_auth(cliente_token),
    )
    assert r.status_code == 200
    horas = r.json()["horas_disponibles"]
    # Solo horas del tramo de apertura
    assert "09:00:00" not in horas
    assert "17:30:00" not in horas
    assert "20:00:00" in horas
    assert "21:30:00" in horas


def test_disponibilidad_apertura_con_franja_ocupada(client, cliente_token, db_session):
    """Apertura + FranjaOcupada → hora ocupada excluida del resultado."""
    fecha = _fecha_futura(5)
    _crear_apertura_db(db_session, fecha, [(time(20, 0), time(22, 0))])
    s = _servicio(db_session, 30)

    # Necesitamos una cita como FK para la FranjaOcupada
    u, _ = _usuario_cliente(db_session)
    cita = Cita(
        cliente_id=u.id,
        servicio_id=s.id,
        fecha=fecha,
        hora_inicio=time(20, 0),
        hora_fin=time(20, 30),
        estado=EstadoCita.activa,
    )
    db_session.add(cita)
    db_session.flush()
    db_session.add(FranjaOcupada(cita_id=cita.id, fecha=fecha, hora=time(20, 0)))
    db_session.commit()

    r = client.get(
        "/disponibilidad",
        params={"fecha": str(fecha), "servicio_id": s.id},
        headers=_auth(cliente_token),
    )
    assert r.status_code == 200
    horas = r.json()["horas_disponibles"]
    assert "20:00:00" not in horas   # franja ocupada
    assert "20:30:00" in horas       # slot siguiente libre
    assert "21:30:00" in horas       # último slot libre


def test_disponibilidad_apertura_hoy_tz(client, cliente_token, db_session):
    """
    OBLIGATORIO — zona horaria Europe/Madrid:
    Apertura excepcional para HOY, tramo 00:00-23:30, servicio 30 min.
    - "23:00:00" DEBE aparecer (siempre es una hora futura).
    - No debe haber horas anteriores a ahora (now_madrid).
    """
    hoy = _hoy_madrid()
    _crear_apertura_db(db_session, hoy, [(time(0, 0), time(23, 30))])
    s = _servicio(db_session, 30)

    r = client.get(
        "/disponibilidad",
        params={"fecha": str(hoy), "servicio_id": s.id},
        headers=_auth(cliente_token),
    )
    assert r.status_code == 200
    horas = r.json()["horas_disponibles"]

    # 23:00 siempre es futuro en el día de hoy
    assert "23:00:00" in horas

    # Ninguna hora devuelta debe ser anterior o igual a la hora actual de Madrid
    ahora = datetime.now(_MADRID).time()
    for h_str in horas:
        partes = [int(p) for p in h_str.split(":")]
        h = time(*partes)
        assert h > ahora, f"Hora {h_str} es pasada; ahora={ahora}"


# ---------------------------------------------------------------------------
# 14–15 · POST /citas con apertura excepcional
# ---------------------------------------------------------------------------

def test_cita_apertura_dentro_tramo_201(client, cliente_token, db_session):
    """
    Día sin horario semanal + apertura excepcional con tramo 20:00-22:00.
    POST /citas con hora 20:00 → 201.
    """
    fecha = _fecha_futura(6)
    _crear_apertura_db(db_session, fecha, [(time(20, 0), time(22, 0))])
    s = _servicio(db_session, 30)

    r = client.post(
        "/citas",
        json={"servicio_id": s.id, "fecha": str(fecha), "hora_inicio": "20:00:00"},
        headers=_auth(cliente_token),
    )
    assert r.status_code == 201
    data = r.json()
    assert data["hora_inicio"] == "20:00:00"
    assert data["hora_fin"] == "20:30:00"


def test_cita_apertura_fuera_tramo_422(client, cliente_token, db_session):
    """Hora fuera del tramo de apertura → 422."""
    fecha = _fecha_futura(7)
    _crear_apertura_db(db_session, fecha, [(time(20, 0), time(22, 0))])
    s = _servicio(db_session, 30)

    r = client.post(
        "/citas",
        json={"servicio_id": s.id, "fecha": str(fecha), "hora_inicio": "10:00:00"},
        headers=_auth(cliente_token),
    )
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# 16–17 · DELETE apertura con/sin citas activas
# ---------------------------------------------------------------------------

def test_borrar_apertura_con_citas_409(client, admin_token, db_session):
    """Apertura con cita activa ese día → DELETE → 409."""
    fecha = _fecha_futura(8)
    exc = _crear_apertura_db(db_session, fecha, [(time(20, 0), time(22, 0))])
    s = _servicio(db_session)
    u, _ = _usuario_cliente(db_session, "b1")
    cita = Cita(
        cliente_id=u.id,
        servicio_id=s.id,
        fecha=fecha,
        hora_inicio=time(20, 0),
        hora_fin=time(20, 30),
        estado=EstadoCita.activa,
    )
    db_session.add(cita)
    db_session.commit()

    r = client.delete(f"/excepciones/{exc.id}", headers=_auth(admin_token))
    assert r.status_code == 409
    assert "cita" in r.json()["detail"].lower()


def test_borrar_apertura_sin_citas_200(client, admin_token, db_session):
    """Apertura sin citas activas → DELETE → 200."""
    fecha = _fecha_futura(9)
    exc = _crear_apertura_db(db_session, fecha, [(time(20, 0), time(22, 0))])

    r = client.delete(f"/excepciones/{exc.id}", headers=_auth(admin_token))
    assert r.status_code == 200
    assert r.json()["id"] == exc.id


# ---------------------------------------------------------------------------
# 18 · GET /excepciones (admin) devuelve tramos
# ---------------------------------------------------------------------------

def test_listar_excepciones_incluye_tramos(client, admin_token, db_session):
    """GET /excepciones devuelve los tramos de las aperturas en la respuesta."""
    fecha = _fecha_futura(10)
    _crear_apertura_db(
        db_session, fecha, [(time(10, 0), time(14, 0)), (time(17, 0), time(21, 0))]
    )

    r = client.get("/excepciones", headers=_auth(admin_token))
    assert r.status_code == 200
    excepciones = r.json()
    apertura = next((e for e in excepciones if e["tipo"] == "abierto"), None)
    assert apertura is not None
    assert len(apertura["tramos"]) == 2
    horas_ap = {t["hora_apertura"] for t in apertura["tramos"]}
    assert "10:00:00" in horas_ap
    assert "17:00:00" in horas_ap


# ---------------------------------------------------------------------------
# 19 · GET /excepciones/proximas incluye aperturas
# ---------------------------------------------------------------------------

def test_proximas_incluye_aperturas(client, cliente_token, db_session):
    """Apertura dentro de la ventana → aparece en /excepciones/proximas con tramos."""
    fecha = _fecha_futura(3)
    _crear_apertura_db(db_session, fecha, [(time(20, 0), time(22, 0))])

    r = client.get("/excepciones/proximas", headers=_auth(cliente_token))
    assert r.status_code == 200
    excepciones = r.json()
    apertura = next(
        (e for e in excepciones if e["tipo"] == "abierto" and e["fecha"] == str(fecha)),
        None,
    )
    assert apertura is not None, "La apertura no apareció en /excepciones/proximas"
    assert len(apertura["tramos"]) == 1
    assert apertura["tramos"][0]["hora_apertura"] == "20:00:00"


# ---------------------------------------------------------------------------
# 20 · Servicio que no cabe en tramo corto
# ---------------------------------------------------------------------------

def test_disponibilidad_apertura_servicio_no_cabe(client, cliente_token, db_session):
    """
    Tramo 20:00-21:00 (2 franjas de 30min) + servicio 90min (3 franjas).
    El servicio no cabe en el tramo → horas_disponibles vacías.
    Verifica que _calcular_disponibles aplica "N franjas consecutivas" también para aperturas.
    """
    fecha = _fecha_futura(4)
    _crear_apertura_db(db_session, fecha, [(time(20, 0), time(21, 0))])
    s = _servicio(db_session, 90)  # 3 franjas

    r = client.get(
        "/disponibilidad",
        params={"fecha": str(fecha), "servicio_id": s.id},
        headers=_auth(cliente_token),
    )
    assert r.status_code == 200
    assert r.json()["horas_disponibles"] == []
