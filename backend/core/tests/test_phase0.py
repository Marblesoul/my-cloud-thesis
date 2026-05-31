from pathlib import Path

from django.test import override_settings


def test_health_endpoint_returns_ok_json(client):
    response = client.get("/api/health/")

    assert response.status_code == 200
    assert response["Content-Type"].startswith("application/json")
    assert response.json() == {"status": "ok"}


def test_csrf_endpoint_sets_csrf_cookie(client):
    response = client.get("/api/csrf/")

    assert response.status_code == 200
    assert response.json() == {"detail": "CSRF cookie set"}
    assert "csrftoken" in response.cookies


def test_root_serves_react_index(client, tmp_path):
    dist_dir = Path(tmp_path) / "dist"
    dist_dir.mkdir()
    (dist_dir / "index.html").write_text(
        "<!doctype html><div id=\"root\">My Cloud shell</div>",
        encoding="utf-8",
    )

    with override_settings(FRONTEND_DIST=dist_dir):
        response = client.get("/")

    assert response.status_code == 200
    assert b"My Cloud shell" in response.content
