"""Tests para la galería del banner (Fase 3)."""
from unittest.mock import patch

import pytest


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def foto(client, admin_token):
    """Foto en galería creada vía API."""
    r = client.post(
        "/galeria",
        json={"url": "https://res.cloudinary.com/test/image/upload/v1/galeria.jpg", "public_id": "galeria/foto1", "posicion": 10, "titulo": "Foto 1"},
        headers=_auth(admin_token),
    )
    assert r.status_code == 201
    return r.json()


# ---------------------------------------------------------------------------
# Lectura pública
# ---------------------------------------------------------------------------

def test_listar_galeria_publico(client, foto):
    r = client.get("/galeria")
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_galeria_ordenada_por_posicion(client, admin_token):
    client.post("/galeria", json={"url": "u1", "public_id": "p1", "posicion": 20}, headers=_auth(admin_token))
    client.post("/galeria", json={"url": "u2", "public_id": "p2", "posicion": 5}, headers=_auth(admin_token))
    client.post("/galeria", json={"url": "u3", "public_id": "p3", "posicion": 15}, headers=_auth(admin_token))

    r = client.get("/galeria")
    posiciones = [f["posicion"] for f in r.json()]
    assert posiciones == sorted(posiciones)


# ---------------------------------------------------------------------------
# CRUD admin
# ---------------------------------------------------------------------------

def test_admin_anade_foto(client, admin_token):
    r = client.post(
        "/galeria",
        json={"url": "https://res.cloudinary.com/test/v1/nueva.jpg", "public_id": "galeria/nueva", "titulo": "Nueva"},
        headers=_auth(admin_token),
    )
    assert r.status_code == 201
    assert r.json()["titulo"] == "Nueva"


def test_admin_edita_foto(client, admin_token, foto):
    r = client.patch(
        f"/galeria/{foto['id']}",
        json={"titulo": "Foto editada", "posicion": 99},
        headers=_auth(admin_token),
    )
    assert r.status_code == 200
    data = r.json()
    assert data["titulo"] == "Foto editada"
    assert data["posicion"] == 99


def test_admin_borra_foto_llama_destroy(client, admin_token, foto):
    with patch("app.notificaciones.cloudinary.cloudinary.uploader.destroy") as mock_destroy:
        r = client.delete(f"/galeria/{foto['id']}", headers=_auth(admin_token))
    assert r.status_code == 204
    mock_destroy.assert_called_once_with("galeria/foto1")


def test_borra_foto_ya_no_aparece(client, admin_token, foto):
    with patch("app.notificaciones.cloudinary.cloudinary.uploader.destroy"):
        client.delete(f"/galeria/{foto['id']}", headers=_auth(admin_token))
    r = client.get("/galeria")
    ids = [f["id"] for f in r.json()]
    assert foto["id"] not in ids


# ---------------------------------------------------------------------------
# Reordenar
# ---------------------------------------------------------------------------

def test_reordenar_galeria(client, admin_token):
    r1 = client.post("/galeria", json={"url": "u1", "public_id": "p1", "posicion": 10}, headers=_auth(admin_token))
    r2 = client.post("/galeria", json={"url": "u2", "public_id": "p2", "posicion": 20}, headers=_auth(admin_token))
    id1, id2 = r1.json()["id"], r2.json()["id"]

    r = client.put(
        "/galeria/orden",
        json=[{"id": id1, "posicion": 50}, {"id": id2, "posicion": 5}],
        headers=_auth(admin_token),
    )
    assert r.status_code == 200

    galeria = client.get("/galeria").json()
    orden = [(f["id"], f["posicion"]) for f in galeria if f["id"] in (id1, id2)]
    posiciones = {fid: pos for fid, pos in orden}
    assert posiciones[id1] == 50
    assert posiciones[id2] == 5


# ---------------------------------------------------------------------------
# Control de acceso
# ---------------------------------------------------------------------------

def test_cliente_no_puede_anadir_foto(client, cliente_token):
    r = client.post(
        "/galeria",
        json={"url": "u", "public_id": "p"},
        headers=_auth(cliente_token),
    )
    assert r.status_code == 403


def test_anonimo_no_puede_borrar_foto(client, foto):
    r = client.delete(f"/galeria/{foto['id']}")
    assert r.status_code == 401
