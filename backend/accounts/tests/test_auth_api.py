import re

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from storage.models import StoredFile


pytestmark = pytest.mark.django_db


REGISTER_PAYLOAD = {
    "username": "User123",
    "full_name": "User Example",
    "email": "user@example.com",
    "password": "Secret1!",
}


def csrf_client() -> Client:
    client = Client(enforce_csrf_checks=True)
    response = client.get("/api/csrf/")
    assert response.status_code == 200
    return client


def create_user(username: str, email: str, is_admin: bool = False):
    user = get_user_model().objects.create_user(
        username=username,
        email=email,
        password="Secret1!",
        full_name=f"{username} Example",
        is_admin=is_admin,
    )
    user.storage_path = str(user.id)
    user.save(update_fields=["storage_path"])
    return user


def csrf_client_for(user) -> Client:
    client = csrf_client()
    assert client.login(username=user.username, password="Secret1!")
    return client


def post_json(client: Client, path: str, payload: dict, csrf: bool = True):
    headers = {}
    if csrf:
        headers["HTTP_X_CSRFTOKEN"] = client.cookies["csrftoken"].value
    return client.post(path, payload, content_type="application/json", **headers)


def test_register_creates_user_with_storage_path_and_bcrypt_password():
    response = post_json(csrf_client(), "/api/register/", REGISTER_PAYLOAD)

    assert response.status_code == 201
    assert response.json() == {
        "id": response.json()["id"],
        "username": "User123",
        "full_name": "User Example",
        "email": "user@example.com",
        "is_admin": False,
    }

    user = get_user_model().objects.get(username="User123")
    assert user.storage_path == str(user.id)
    assert user.password != "Secret1!"
    assert user.password.startswith("bcrypt_sha256$")


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("username", "1bad"),
        ("username", "bad_name"),
        ("username", "abc"),
        ("username", "a" * 21),
        ("email", "not-an-email"),
        ("password", "short"),
        ("password", "lowercase1!"),
        ("password", "NoDigit!"),
        ("password", "NoSpecial1"),
        ("full_name", ""),
    ],
)
def test_register_rejects_invalid_fields(field, value):
    payload = REGISTER_PAYLOAD | {field: value}

    response = post_json(csrf_client(), "/api/register/", payload)

    assert response.status_code == 400
    assert field in response.json()


def test_register_rejects_duplicate_username_and_email():
    user_model = get_user_model()
    user_model.objects.create_user(
        username="User123",
        email="user@example.com",
        password="Secret1!",
        full_name="Existing User",
    )

    response = post_json(csrf_client(), "/api/register/", REGISTER_PAYLOAD)

    assert response.status_code == 400
    body = response.json()
    assert "username" in body
    assert "email" in body


def test_login_with_valid_credentials_sets_session_cookie():
    get_user_model().objects.create_user(
        username="LoginUser",
        email="login@example.com",
        password="Secret1!",
        full_name="Login User",
        storage_path="1",
    )

    response = post_json(
        csrf_client(),
        "/api/login/",
        {"username": "LoginUser", "password": "Secret1!"},
    )

    assert response.status_code == 200
    assert response.json()["username"] == "LoginUser"
    assert "sessionid" in response.cookies


def test_login_with_invalid_credentials_returns_401():
    get_user_model().objects.create_user(
        username="LoginUser",
        email="login@example.com",
        password="Secret1!",
        full_name="Login User",
        storage_path="1",
    )

    response = post_json(
        csrf_client(),
        "/api/login/",
        {"username": "LoginUser", "password": "wrong"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid username or password."}


def test_me_requires_session_and_returns_current_user_when_authenticated():
    user = get_user_model().objects.create_user(
        username="MeUser",
        email="me@example.com",
        password="Secret1!",
        full_name="Me User",
        is_admin=True,
        storage_path="1",
    )
    anonymous = Client()

    anonymous_response = anonymous.get("/api/me/")

    assert anonymous_response.status_code == 403

    client = Client()
    assert client.login(username="MeUser", password="Secret1!")

    response = client.get("/api/me/")

    assert response.status_code == 200
    assert response.json() == {
        "id": user.id,
        "username": "MeUser",
        "full_name": "Me User",
        "email": "me@example.com",
        "is_admin": True,
    }


def test_logout_clears_session():
    get_user_model().objects.create_user(
        username="LogoutUser",
        email="logout@example.com",
        password="Secret1!",
        full_name="Logout User",
        storage_path="1",
    )
    client = csrf_client()
    login_response = post_json(
        client,
        "/api/login/",
        {"username": "LogoutUser", "password": "Secret1!"},
    )
    assert login_response.status_code == 200

    logout_response = post_json(client, "/api/logout/", {})

    assert logout_response.status_code == 200
    assert logout_response.json() == {"detail": "Logged out."}
    assert client.get("/api/me/").status_code == 403


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        ("/api/register/", REGISTER_PAYLOAD),
        ("/api/login/", {"username": "NoUser", "password": "Secret1!"}),
    ],
)
def test_unsafe_public_auth_endpoints_require_csrf(path, payload):
    response = Client(enforce_csrf_checks=True).post(
        path,
        payload,
        content_type="application/json",
    )

    assert response.status_code == 403
    assert response["Content-Type"].startswith("application/json")
    assert re.match(r"^CSRF Failed:", response.json()["detail"])


def test_csrf_cookie_flow_allows_unsafe_post():
    response = post_json(csrf_client(), "/api/register/", REGISTER_PAYLOAD)

    assert response.status_code == 201


def test_bootstrap_admin_exists_with_required_flags():
    admin = get_user_model().objects.get(username="admin")

    assert admin.email == "admin@example.local"
    assert admin.is_admin is True
    assert admin.is_staff is True
    assert admin.is_superuser is True
    assert admin.storage_path == str(admin.id)


def test_admin_users_list_returns_storage_statistics():
    admin = create_user("UsersAdmin", "users-admin@example.com", is_admin=True)
    user = create_user("StatsUser", "stats-user@example.com")
    StoredFile.objects.create(
        owner=user,
        original_name="one.txt",
        size=10,
        storage_path=f"{user.id}/one",
    )
    StoredFile.objects.create(
        owner=user,
        original_name="two.txt",
        size=15,
        storage_path=f"{user.id}/two",
    )
    client = csrf_client_for(admin)

    response = client.get("/api/users/")

    assert response.status_code == 200
    users = {item["username"]: item for item in response.json()}
    assert users["StatsUser"]["file_count"] == 2
    assert users["StatsUser"]["storage_size"] == 25


def test_users_endpoint_rejects_non_admin_users():
    user = create_user("PlainUser", "plain@example.com")
    client = csrf_client_for(user)

    response = client.get("/api/users/")

    assert response.status_code == 403


def test_admin_can_update_is_admin_flag():
    admin = create_user("PatchAdmin", "patch-admin@example.com", is_admin=True)
    user = create_user("PromotedUser", "promoted@example.com")
    client = csrf_client_for(admin)

    response = client.patch(
        f"/api/users/{user.id}/",
        {"is_admin": True},
        content_type="application/json",
        **{"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value},
    )

    assert response.status_code == 200
    assert response.json()["is_admin"] is True
    user.refresh_from_db()
    assert user.is_admin is True


def test_admin_can_delete_user_record_and_physical_files(tmp_path, settings):
    settings.STORAGE_ROOT = tmp_path
    admin = create_user("DeleteAdmin", "delete-admin@example.com", is_admin=True)
    user = create_user("DeletedUser", "deleted@example.com")
    user_dir = tmp_path / str(user.id)
    user_dir.mkdir()
    stored_path = user_dir / "stored-file"
    stored_path.write_bytes(b"to be removed")
    StoredFile.objects.create(
        owner=user,
        original_name="removed.txt",
        size=13,
        storage_path=f"{user.id}/stored-file",
    )
    client = csrf_client_for(admin)

    response = client.delete(
        f"/api/users/{user.id}/",
        **{"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value},
    )

    assert response.status_code == 204
    assert not get_user_model().objects.filter(id=user.id).exists()
    assert not stored_path.exists()
