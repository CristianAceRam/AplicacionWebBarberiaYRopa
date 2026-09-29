"""Tests para el endpoint de firma de Cloudinary (Fase 3)."""
from unittest.mock import patch


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _mock_settings():
    """Context manager que inyecta credenciales Cloudinary falsas."""
    return patch(
        "app.routers.cloudinary_router.settings",
        cloudinary_cloud_name="test_cloud",
        cloudinary_api_key="test_api_key",
        cloudinary_api_secret="test_api_secret",
    )


def test_admin_obtiene_firma(client, admin_token):
    with _mock_settings(), patch(
        "app.routers.cloudinary_router.cloudinary.utils.api_sign_request",
        return_value="fakesignature",
    ) as mock_sign:
        r = client.post(
            "/cloudinary/firma",
            json={"folder": "pistia/prendas"},
            headers=_auth(admin_token),
        )
    assert r.status_code == 200
    data = r.json()
    assert data["signature"] == "fakesignature"
    assert data["cloud_name"] == "test_cloud"
    assert data["api_key"] == "test_api_key"
    assert data["folder"] == "pistia/prendas"
    assert "allowed_formats" in data
    assert "max_file_size" in data


def test_firma_incluye_allowed_formats_y_no_max_file_size(client, admin_token):
    """allowed_formats va firmado; max_file_size no (no es param de Upload API directa)."""
    with _mock_settings(), patch(
        "app.routers.cloudinary_router.cloudinary.utils.api_sign_request",
        return_value="fakesig",
    ) as mock_sign:
        client.post(
            "/cloudinary/firma",
            json={"folder": "pistia/galeria"},
            headers=_auth(admin_token),
        )
    signed_params = mock_sign.call_args[0][0]
    assert "allowed_formats" in signed_params
    assert signed_params["allowed_formats"] == "jpg,png,webp"
    assert "max_file_size" not in signed_params


def test_cliente_no_puede_pedir_firma(client, cliente_token):
    with _mock_settings():
        r = client.post(
            "/cloudinary/firma",
            json={"folder": "pistia/prendas"},
            headers=_auth(cliente_token),
        )
    assert r.status_code == 403


def test_anonimo_no_puede_pedir_firma(client):
    with _mock_settings():
        r = client.post("/cloudinary/firma", json={"folder": "pistia/prendas"})
    assert r.status_code == 401
