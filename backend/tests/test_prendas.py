"""Tests para el catálogo de prendas (Fase 3)."""
from decimal import Decimal
from unittest.mock import patch

import pytest


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# CRUD de prendas
# ---------------------------------------------------------------------------

def test_admin_crea_prenda(client, admin_token):
    r = client.post(
        "/prendas",
        json={"nombre": "Sudadera", "descripcion": "Sudadera oversize", "precio": "49.99"},
        headers=_auth(admin_token),
    )
    assert r.status_code == 201
    data = r.json()
    assert data["nombre"] == "Sudadera"
    assert data["activo"] is True
    assert data["tallas"] == []
    assert data["imagenes"] == []


def test_cliente_no_puede_crear_prenda(client, cliente_token):
    r = client.post(
        "/prendas",
        json={"nombre": "X", "descripcion": "X", "precio": "10.00"},
        headers=_auth(cliente_token),
    )
    assert r.status_code == 403


def test_anonimo_no_puede_crear_prenda(client):
    r = client.post("/prendas", json={"nombre": "X", "descripcion": "X", "precio": "10.00"})
    assert r.status_code == 401


def test_listar_prendas_solo_activas(client, admin_token, db_session):
    from app.models import Prenda
    p_activa = Prenda(nombre="Activa", descripcion="desc", precio=Decimal("10.00"), activo=True)
    p_inactiva = Prenda(nombre="Inactiva", descripcion="desc", precio=Decimal("10.00"), activo=False)
    db_session.add_all([p_activa, p_inactiva])
    db_session.commit()

    r = client.get("/prendas")
    assert r.status_code == 200
    nombres = [p["nombre"] for p in r.json()]
    assert "Activa" in nombres
    assert "Inactiva" not in nombres


def test_obtener_prenda_activa_publico(client, prenda):
    r = client.get(f"/prendas/{prenda.id}")
    assert r.status_code == 200
    assert r.json()["nombre"] == "Camiseta πίστη"


def test_obtener_prenda_inactiva_publico_404(client, db_session):
    from app.models import Prenda
    p = Prenda(nombre="Oculta", descripcion="desc", precio=Decimal("10.00"), activo=False)
    db_session.add(p)
    db_session.commit()

    r = client.get(f"/prendas/{p.id}")
    assert r.status_code == 404


def test_obtener_prenda_inactiva_admin_200(client, admin_token, db_session):
    from app.models import Prenda
    p = Prenda(nombre="Oculta", descripcion="desc", precio=Decimal("10.00"), activo=False)
    db_session.add(p)
    db_session.commit()

    r = client.get(f"/prendas/{p.id}", headers=_auth(admin_token))
    assert r.status_code == 200


def test_borrado_logico_prenda(client, admin_token, prenda):
    r = client.delete(f"/prendas/{prenda.id}", headers=_auth(admin_token))
    assert r.status_code == 204

    # Ya no aparece en el catálogo público
    r2 = client.get(f"/prendas/{prenda.id}")
    assert r2.status_code == 404


def test_reactivar_prenda(client, admin_token, db_session):
    from app.models import Prenda
    p = Prenda(nombre="Baja", descripcion="desc", precio=Decimal("10.00"), activo=False)
    db_session.add(p)
    db_session.commit()

    r = client.put(f"/prendas/{p.id}", json={"activo": True}, headers=_auth(admin_token))
    assert r.status_code == 200
    assert r.json()["activo"] is True


# ---------------------------------------------------------------------------
# Tallas — todas deben aparecer (disponible o no)
# ---------------------------------------------------------------------------

def test_talla_no_disponible_aparece_en_respuesta(client, admin_token, prenda):
    # Añadir talla XL con disponible=False
    r = client.post(
        f"/prendas/{prenda.id}/tallas",
        json={"talla": "XL", "disponible": False},
        headers=_auth(admin_token),
    )
    assert r.status_code == 201

    r2 = client.get(f"/prendas/{prenda.id}")
    tallas = {t["talla"]: t["disponible"] for t in r2.json()["tallas"]}
    assert "XL" in tallas
    assert tallas["XL"] is False  # Aparece como agotada, no desaparece


def test_anadir_talla(client, admin_token, prenda):
    r = client.post(
        f"/prendas/{prenda.id}/tallas",
        json={"talla": "L", "disponible": True},
        headers=_auth(admin_token),
    )
    assert r.status_code == 201
    assert r.json()["talla"] == "L"


def test_anadir_talla_duplicada_409(client, admin_token, prenda):
    # 'M' ya existe en el fixture
    r = client.post(
        f"/prendas/{prenda.id}/tallas",
        json={"talla": "M"},
        headers=_auth(admin_token),
    )
    assert r.status_code == 409


def test_actualizar_disponible_talla(client, admin_token, prenda):
    talla_id = prenda.tallas[0].id
    r = client.patch(
        f"/prendas/{prenda.id}/tallas/{talla_id}",
        json={"disponible": False},
        headers=_auth(admin_token),
    )
    assert r.status_code == 200
    assert r.json()["disponible"] is False


def test_borrar_talla_sin_reservas(client, admin_token, prenda):
    talla_id = prenda.tallas[0].id
    r = client.delete(
        f"/prendas/{prenda.id}/tallas/{talla_id}",
        headers=_auth(admin_token),
    )
    assert r.status_code == 204


def test_borrar_talla_con_reserva_pendiente_409(client, admin_token, cliente_token, prenda, db_session):
    from app.models import ReservaPrenda
    from app.security import decode_access_token
    payload = decode_access_token(cliente_token)
    reserva = ReservaPrenda(
        cliente_id=int(payload["sub"]),
        prenda_id=prenda.id,
        talla="M",
    )
    db_session.add(reserva)
    db_session.commit()

    talla_id = prenda.tallas[0].id
    r = client.delete(
        f"/prendas/{prenda.id}/tallas/{talla_id}",
        headers=_auth(admin_token),
    )
    assert r.status_code == 409


# ---------------------------------------------------------------------------
# Imágenes
# ---------------------------------------------------------------------------

def test_anadir_imagen(client, admin_token, prenda):
    r = client.post(
        f"/prendas/{prenda.id}/imagenes",
        json={"url": "https://res.cloudinary.com/test/image/upload/v2/new.jpg", "public_id": "test/new"},
        headers=_auth(admin_token),
    )
    assert r.status_code == 201
    assert r.json()["url"].endswith("new.jpg")


def test_reordenar_imagen(client, admin_token, prenda):
    imagen_id = prenda.imagenes[0].id
    r = client.patch(
        f"/prendas/{prenda.id}/imagenes/{imagen_id}",
        json={"posicion": 50},
        headers=_auth(admin_token),
    )
    assert r.status_code == 200
    assert r.json()["posicion"] == 50


def test_borrar_imagen_llama_destroy(client, admin_token, prenda):
    imagen_id = prenda.imagenes[0].id
    public_id = prenda.imagenes[0].public_id

    with patch("app.notificaciones.cloudinary.cloudinary.uploader.destroy") as mock_destroy:
        r = client.delete(
            f"/prendas/{prenda.id}/imagenes/{imagen_id}",
            headers=_auth(admin_token),
        )
    assert r.status_code == 204
    mock_destroy.assert_called_once_with(public_id)


def test_primera_imagen_en_lista_prendas(client, prenda):
    r = client.get("/prendas")
    assert r.status_code == 200
    items = r.json()
    found = next((p for p in items if p["id"] == prenda.id), None)
    assert found is not None
    assert found["primera_imagen"] is not None
    assert found["primera_imagen"]["url"] == prenda.imagenes[0].url


def test_listar_prendas_incluir_inactivas_admin(client, admin_token, db_session):
    from app.models import Prenda
    p_inactiva = Prenda(nombre="InactivaVis", descripcion="desc", precio=Decimal("10.00"), activo=False)
    db_session.add(p_inactiva)
    db_session.commit()

    r = client.get("/prendas?incluir_inactivas=true", headers=_auth(admin_token))
    assert r.status_code == 200
    nombres = [p["nombre"] for p in r.json()]
    assert "InactivaVis" in nombres


def test_listar_prendas_incluir_inactivas_ignorado_por_cliente(client, cliente_token, db_session):
    from app.models import Prenda
    p_inactiva = Prenda(nombre="InactivaOculta", descripcion="desc", precio=Decimal("10.00"), activo=False)
    db_session.add(p_inactiva)
    db_session.commit()

    r = client.get("/prendas?incluir_inactivas=true", headers=_auth(cliente_token))
    assert r.status_code == 200
    nombres = [p["nombre"] for p in r.json()]
    assert "InactivaOculta" not in nombres


# ---------------------------------------------------------------------------
# Borrado permanente
# ---------------------------------------------------------------------------

def test_borrado_permanente_sin_reservas(client, admin_token, prenda, db_session):
    prenda_id = prenda.id
    talla_id  = prenda.tallas[0].id
    imagen_id = prenda.imagenes[0].id

    r = client.delete(f"/prendas/{prenda_id}/permanente", headers=_auth(admin_token))
    assert r.status_code == 204

    from app.models import Prenda, TallaPrenda, ImagenPrenda
    assert db_session.get(Prenda,      prenda_id) is None
    assert db_session.get(TallaPrenda, talla_id)  is None
    assert db_session.get(ImagenPrenda, imagen_id) is None


def test_borrado_permanente_con_reservas_historicas(client, admin_token, cliente_token, prenda, db_session):
    from app.models import EstadoReservaPrenda, ReservaPrenda
    from app.security import decode_access_token
    payload = decode_access_token(cliente_token)
    reserva = ReservaPrenda(
        cliente_id=int(payload["sub"]),
        prenda_id=prenda.id,
        talla="M",
        estado=EstadoReservaPrenda.atendida,
    )
    db_session.add(reserva)
    db_session.commit()
    reserva_id = reserva.id

    r = client.delete(f"/prendas/{prenda.id}/permanente", headers=_auth(admin_token))
    assert r.status_code == 204

    from app.models import Prenda
    assert db_session.get(Prenda, prenda.id) is None
    assert db_session.get(ReservaPrenda, reserva_id) is None


def test_borrado_permanente_con_reservas_pendientes_409(client, admin_token, cliente_token, prenda, db_session):
    from app.models import ReservaPrenda
    from app.security import decode_access_token
    payload = decode_access_token(cliente_token)
    reserva = ReservaPrenda(
        cliente_id=int(payload["sub"]),
        prenda_id=prenda.id,
        talla="M",
    )
    db_session.add(reserva)
    db_session.commit()

    r = client.delete(f"/prendas/{prenda.id}/permanente", headers=_auth(admin_token))
    assert r.status_code == 409
    assert "pendiente" in r.json()["detail"].lower()


def test_borrado_permanente_prenda_inexistente_404(client, admin_token):
    r = client.delete("/prendas/99999/permanente", headers=_auth(admin_token))
    assert r.status_code == 404


def test_borrado_permanente_cliente_403(client, cliente_token, prenda):
    r = client.delete(f"/prendas/{prenda.id}/permanente", headers=_auth(cliente_token))
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Límite de imágenes por prenda
# ---------------------------------------------------------------------------

def test_octava_imagen_entra(client, admin_token, prenda, db_session):
    from app.models import ImagenPrenda
    # Hay 1 imagen en el fixture; añadir 6 más para llegar a 7
    for i in range(6):
        db_session.add(ImagenPrenda(
            prenda_id=prenda.id,
            url=f"https://res.cloudinary.com/test/image/upload/v1/extra{i}.jpg",
            public_id=f"test/extra{i}",
            posicion=(i + 1) * 10,
        ))
    db_session.commit()

    # La 8ª (la siguiente) debe entrar con 201
    r = client.post(
        f"/prendas/{prenda.id}/imagenes",
        json={"url": "https://res.cloudinary.com/test/image/upload/v1/octava.jpg", "public_id": "test/octava"},
        headers=_auth(admin_token),
    )
    assert r.status_code == 201


def test_novena_imagen_409(client, admin_token, prenda, db_session):
    from app.models import ImagenPrenda
    # Hay 1 imagen en el fixture; añadir 7 más para llegar a 8
    for i in range(7):
        db_session.add(ImagenPrenda(
            prenda_id=prenda.id,
            url=f"https://res.cloudinary.com/test/image/upload/v1/fill{i}.jpg",
            public_id=f"test/fill{i}",
            posicion=(i + 1) * 10,
        ))
    db_session.commit()

    # La 9ª debe ser rechazada
    r = client.post(
        f"/prendas/{prenda.id}/imagenes",
        json={"url": "https://res.cloudinary.com/test/image/upload/v1/novena.jpg", "public_id": "test/novena"},
        headers=_auth(admin_token),
    )
    assert r.status_code == 409
    assert "máximo" in r.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Bulk reorder de imágenes
# ---------------------------------------------------------------------------

def test_reordenar_imagenes_prenda(client, admin_token, prenda, db_session):
    from app.models import ImagenPrenda
    # Añadir 2 imágenes más para tener 3 en total
    img2 = ImagenPrenda(prenda_id=prenda.id, url="https://res.cloudinary.com/test/image/upload/v1/b.jpg", public_id="test/b", posicion=10)
    img3 = ImagenPrenda(prenda_id=prenda.id, url="https://res.cloudinary.com/test/image/upload/v1/c.jpg", public_id="test/c", posicion=20)
    db_session.add_all([img2, img3])
    db_session.commit()
    db_session.refresh(img2)
    db_session.refresh(img3)

    id1 = prenda.imagenes[0].id
    id2 = img2.id
    id3 = img3.id

    # Invertir el orden: 3, 2, 1
    r = client.put(
        f"/prendas/{prenda.id}/imagenes/orden",
        json=[{"id": id3, "posicion": 0}, {"id": id2, "posicion": 10}, {"id": id1, "posicion": 20}],
        headers=_auth(admin_token),
    )
    assert r.status_code == 200
    assert r.json()["updated"] == 3

    db_session.expire_all()
    assert db_session.get(ImagenPrenda, id3).posicion == 0
    assert db_session.get(ImagenPrenda, id2).posicion == 10
    assert db_session.get(ImagenPrenda, id1).posicion == 20


def test_reordenar_imagen_de_otra_prenda_404(client, admin_token, prenda, db_session):
    from app.models import ImagenPrenda, Prenda
    from decimal import Decimal
    otra = Prenda(nombre="Otra", descripcion="desc", precio=Decimal("10.00"), activo=True)
    db_session.add(otra)
    db_session.flush()
    img_ajena = ImagenPrenda(prenda_id=otra.id, url="https://res.cloudinary.com/test/image/upload/v1/ajena.jpg", public_id="test/ajena", posicion=0)
    db_session.add(img_ajena)
    db_session.commit()
    db_session.refresh(img_ajena)

    # Intentar reordenar la imagen ajena usando el prenda_id de 'prenda'
    r = client.put(
        f"/prendas/{prenda.id}/imagenes/orden",
        json=[{"id": img_ajena.id, "posicion": 0}],
        headers=_auth(admin_token),
    )
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Borrado permanente — purga Cloudinary
# ---------------------------------------------------------------------------

def test_borrado_permanente_purga_cloudinary(client, admin_token, prenda):
    from unittest.mock import patch
    public_id = prenda.imagenes[0].public_id  # "test/test"

    with patch("app.routers.prendas.borrar_imagen") as mock_borrar:
        r = client.delete(f"/prendas/{prenda.id}/permanente", headers=_auth(admin_token))

    assert r.status_code == 204
    mock_borrar.assert_called_once_with(public_id)
