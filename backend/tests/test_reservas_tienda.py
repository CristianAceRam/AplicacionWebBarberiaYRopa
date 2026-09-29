"""Tests para las reservas de tienda (Fase 3)."""
from unittest.mock import patch

import pytest


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Crear reserva
# ---------------------------------------------------------------------------

def test_cliente_reserva_talla_disponible(client, cliente_token, prenda):
    with patch("app.routers.reservas_tienda.enviar_aviso_peluquero") as mock_tg:
        r = client.post(
            "/reservas",
            json={"prenda_id": prenda.id, "talla": "M"},
            headers=_auth(cliente_token),
        )
    assert r.status_code == 201
    data = r.json()
    assert data["talla"] == "M"
    assert data["estado"] == "pendiente"
    mock_tg.assert_called_once()


def test_mensaje_telegram_contiene_datos(client, cliente_token, prenda):
    with patch("app.routers.reservas_tienda.enviar_aviso_peluquero") as mock_tg:
        r = client.post(
            "/reservas",
            json={"prenda_id": prenda.id, "talla": "M"},
            headers=_auth(cliente_token),
        )
    assert r.status_code == 201
    mensaje = mock_tg.call_args[0][0]
    assert "Camiseta πίστη" in mensaje
    assert "M" in mensaje
    # El teléfono del cliente del fixture es 600000001
    assert "600000001" in mensaje


def test_dos_clientes_reservan_misma_talla(client, cliente_token, cliente2_token, prenda):
    with patch("app.routers.reservas_tienda.enviar_aviso_peluquero"):
        r1 = client.post("/reservas", json={"prenda_id": prenda.id, "talla": "M"}, headers=_auth(cliente_token))
        r2 = client.post("/reservas", json={"prenda_id": prenda.id, "talla": "M"}, headers=_auth(cliente2_token))
    assert r1.status_code == 201
    assert r2.status_code == 201  # Lead — sin bloqueo de talla


def test_reservar_talla_no_disponible_422(client, cliente_token, admin_token, prenda):
    talla_id = prenda.tallas[0].id
    client.patch(
        f"/prendas/{prenda.id}/tallas/{talla_id}",
        json={"disponible": False},
        headers=_auth(admin_token),
    )
    r = client.post(
        "/reservas",
        json={"prenda_id": prenda.id, "talla": "M"},
        headers=_auth(cliente_token),
    )
    assert r.status_code == 422


def test_reservar_prenda_inactiva_404(client, cliente_token, prenda, admin_token):
    client.delete(f"/prendas/{prenda.id}", headers=_auth(admin_token))
    r = client.post(
        "/reservas",
        json={"prenda_id": prenda.id, "talla": "M"},
        headers=_auth(cliente_token),
    )
    assert r.status_code == 404


def test_cliente_id_del_token_no_del_body(client, cliente_token, prenda, db_session):
    from app.models import ReservaPrenda
    from app.security import decode_access_token
    payload = decode_access_token(cliente_token)
    expected_cliente_id = int(payload["sub"])

    with patch("app.routers.reservas_tienda.enviar_aviso_peluquero"):
        r = client.post(
            "/reservas",
            json={"prenda_id": prenda.id, "talla": "M"},
            headers=_auth(cliente_token),
        )
    assert r.status_code == 201
    reserva_id = r.json()["id"]
    reserva = db_session.get(ReservaPrenda, reserva_id)
    assert reserva.cliente_id == expected_cliente_id


def test_cliente_bloqueado_no_puede_reservar(client, cliente_bloqueado_token, prenda):
    r = client.post(
        "/reservas",
        json={"prenda_id": prenda.id, "talla": "M"},
        headers=_auth(cliente_bloqueado_token),
    )
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Mis reservas
# ---------------------------------------------------------------------------

def test_mis_reservas_solo_propias(client, cliente_token, cliente2_token, prenda):
    with patch("app.routers.reservas_tienda.enviar_aviso_peluquero"):
        client.post("/reservas", json={"prenda_id": prenda.id, "talla": "M"}, headers=_auth(cliente_token))
        client.post("/reservas", json={"prenda_id": prenda.id, "talla": "M"}, headers=_auth(cliente2_token))

    r = client.get("/reservas/mias", headers=_auth(cliente_token))
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_mis_reservas_sin_telefono(client, cliente_token, prenda):
    with patch("app.routers.reservas_tienda.enviar_aviso_peluquero"):
        client.post("/reservas", json={"prenda_id": prenda.id, "talla": "M"}, headers=_auth(cliente_token))

    r = client.get("/reservas/mias", headers=_auth(cliente_token))
    assert r.status_code == 200
    datos = r.json()[0]
    assert "telefono" not in datos
    assert "cliente" not in datos


# ---------------------------------------------------------------------------
# Cancelar reserva
# ---------------------------------------------------------------------------

def test_cancelar_propia_reserva_pendiente(client, cliente_token, prenda):
    with patch("app.routers.reservas_tienda.enviar_aviso_peluquero"):
        r_crear = client.post(
            "/reservas", json={"prenda_id": prenda.id, "talla": "M"}, headers=_auth(cliente_token)
        )
    reserva_id = r_crear.json()["id"]

    r = client.patch(f"/reservas/{reserva_id}/cancelar", headers=_auth(cliente_token))
    assert r.status_code == 200
    assert r.json()["estado"] == "cancelada"


def test_cancelar_reserva_ajena_403(client, cliente_token, cliente2_token, prenda):
    with patch("app.routers.reservas_tienda.enviar_aviso_peluquero"):
        r_crear = client.post(
            "/reservas", json={"prenda_id": prenda.id, "talla": "M"}, headers=_auth(cliente_token)
        )
    reserva_id = r_crear.json()["id"]

    r = client.patch(f"/reservas/{reserva_id}/cancelar", headers=_auth(cliente2_token))
    assert r.status_code == 403


def test_cancelar_reserva_atendida_422(client, cliente_token, admin_token, prenda):
    with patch("app.routers.reservas_tienda.enviar_aviso_peluquero"):
        r_crear = client.post(
            "/reservas", json={"prenda_id": prenda.id, "talla": "M"}, headers=_auth(cliente_token)
        )
    reserva_id = r_crear.json()["id"]
    client.patch(f"/reservas/{reserva_id}/atender", headers=_auth(admin_token))

    r = client.patch(f"/reservas/{reserva_id}/cancelar", headers=_auth(cliente_token))
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# Gestión admin
# ---------------------------------------------------------------------------

def test_admin_marca_atendida(client, admin_token, cliente_token, prenda):
    with patch("app.routers.reservas_tienda.enviar_aviso_peluquero"):
        r_crear = client.post(
            "/reservas", json={"prenda_id": prenda.id, "talla": "M"}, headers=_auth(cliente_token)
        )
    reserva_id = r_crear.json()["id"]

    r = client.patch(f"/reservas/{reserva_id}/atender", headers=_auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert data["estado"] == "atendida"
    assert "telefono" in data["cliente"]


def test_admin_listar_reservas(client, admin_token, cliente_token, prenda):
    with patch("app.routers.reservas_tienda.enviar_aviso_peluquero"):
        client.post("/reservas", json={"prenda_id": prenda.id, "talla": "M"}, headers=_auth(cliente_token))

    r = client.get("/reservas", headers=_auth(admin_token))
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_admin_listar_reservas_con_filtro(client, admin_token, cliente_token, prenda):
    with patch("app.routers.reservas_tienda.enviar_aviso_peluquero"):
        r_crear = client.post(
            "/reservas", json={"prenda_id": prenda.id, "talla": "M"}, headers=_auth(cliente_token)
        )
    reserva_id = r_crear.json()["id"]
    client.patch(f"/reservas/{reserva_id}/atender", headers=_auth(admin_token))

    r = client.get("/reservas?estado=atendida", headers=_auth(admin_token))
    assert r.status_code == 200
    assert all(rv["estado"] == "atendida" for rv in r.json())


def test_admin_cancela_reserva_de_cliente(client, admin_token, cliente_token, prenda):
    with patch("app.routers.reservas_tienda.enviar_aviso_peluquero"):
        r_crear = client.post(
            "/reservas", json={"prenda_id": prenda.id, "talla": "M"}, headers=_auth(cliente_token)
        )
    reserva_id = r_crear.json()["id"]

    r = client.patch(f"/reservas/{reserva_id}/cancelar", headers=_auth(admin_token))
    assert r.status_code == 200
    assert r.json()["estado"] == "cancelada"


def test_admin_desatiende_reserva(client, admin_token, cliente_token, prenda):
    with patch("app.routers.reservas_tienda.enviar_aviso_peluquero"):
        r_crear = client.post(
            "/reservas", json={"prenda_id": prenda.id, "talla": "M"}, headers=_auth(cliente_token)
        )
    reserva_id = r_crear.json()["id"]
    client.patch(f"/reservas/{reserva_id}/atender", headers=_auth(admin_token))

    r = client.patch(f"/reservas/{reserva_id}/desatender", headers=_auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert data["estado"] == "pendiente"
    assert "telefono" in data["cliente"]


def test_desatender_no_atendida_422(client, admin_token, cliente_token, prenda):
    with patch("app.routers.reservas_tienda.enviar_aviso_peluquero"):
        r_crear = client.post(
            "/reservas", json={"prenda_id": prenda.id, "talla": "M"}, headers=_auth(cliente_token)
        )
    reserva_id = r_crear.json()["id"]

    r = client.patch(f"/reservas/{reserva_id}/desatender", headers=_auth(admin_token))
    assert r.status_code == 422


def test_desatender_cliente_403(client, admin_token, cliente_token, prenda):
    with patch("app.routers.reservas_tienda.enviar_aviso_peluquero"):
        r_crear = client.post(
            "/reservas", json={"prenda_id": prenda.id, "talla": "M"}, headers=_auth(cliente_token)
        )
    reserva_id = r_crear.json()["id"]
    client.patch(f"/reservas/{reserva_id}/atender", headers=_auth(admin_token))

    r = client.patch(f"/reservas/{reserva_id}/desatender", headers=_auth(cliente_token))
    assert r.status_code == 403
