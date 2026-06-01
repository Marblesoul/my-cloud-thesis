import json
import uuid
from urllib.parse import urlparse

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client


pytestmark = pytest.mark.django_db


def create_user(username: str, email: str):
    user = get_user_model().objects.create_user(
        username=username,
        email=email,
        password="Secret1!",
        full_name=f"{username} Example",
    )
    user.storage_path = str(user.id)
    user.save(update_fields=["storage_path"])
    return user


def create_admin(username: str = "AdminUser", email: str = "admin-file@example.com"):
    user = create_user(username, email)
    user.is_admin = True
    user.save(update_fields=["is_admin"])
    return user


def csrf_client_for(user) -> Client:
    client = Client(enforce_csrf_checks=True)
    csrf_response = client.get("/api/csrf/")
    assert csrf_response.status_code == 200
    assert client.login(username=user.username, password="Secret1!")
    return client


def csrf_header(client: Client) -> dict:
    return {"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value}


def upload_file(
    client: Client,
    name: str = "report.txt",
    content: bytes = b"file-content",
    comment: str = "Initial comment",
):
    return client.post(
        "/api/files/",
        {
            "file": SimpleUploadedFile(name, content, content_type="text/plain"),
            "comment": comment,
        },
        **csrf_header(client),
    )


def patch_json(client: Client, path: str, payload: dict):
    return client.patch(
        path,
        json.dumps(payload),
        content_type="application/json",
        **csrf_header(client),
    )


def response_bytes(response) -> bytes:
    if getattr(response, "streaming", False):
        return b"".join(response.streaming_content)
    return response.content


@pytest.fixture(autouse=True)
def storage_root(tmp_path, settings):
    settings.STORAGE_ROOT = tmp_path
    return tmp_path


def test_upload_stores_file_under_user_directory_and_returns_metadata(storage_root):
    user = create_user("FileUser", "file@example.com")
    client = csrf_client_for(user)

    response = upload_file(client, content=b"hello cloud")

    assert response.status_code == 201
    body = response.json()
    assert body["id"]
    assert body["original_name"] == "report.txt"
    assert body["size"] == len(b"hello cloud")
    assert body["comment"] == "Initial comment"
    assert body["uploaded_at"]
    assert body["last_download_at"] is None

    stored_files = list((storage_root / str(user.id)).iterdir())
    assert len(stored_files) == 1
    assert stored_files[0].read_bytes() == b"hello cloud"
    uuid.UUID(stored_files[0].name)


def test_list_returns_only_current_users_files():
    owner = create_user("Owner1", "owner1@example.com")
    other = create_user("Owner2", "owner2@example.com")
    owner_client = csrf_client_for(owner)
    other_client = csrf_client_for(other)
    owner_upload = upload_file(owner_client, name="mine.txt")
    other_upload = upload_file(other_client, name="other.txt")
    assert owner_upload.status_code == 201
    assert other_upload.status_code == 201

    response = owner_client.get("/api/files/")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [owner_upload.json()["id"]]


def test_download_returns_original_name_and_updates_last_download_at():
    user = create_user("DownloadUser", "download@example.com")
    client = csrf_client_for(user)
    upload_response = upload_file(client, name="download.txt", content=b"download me")
    assert upload_response.status_code == 201
    file_id = upload_response.json()["id"]

    response = client.get(f"/api/files/{file_id}/download/")

    assert response.status_code == 200
    assert response_bytes(response) == b"download me"
    assert response["Content-Disposition"] == 'attachment; filename="download.txt"'

    list_response = client.get("/api/files/")
    assert list_response.status_code == 200
    assert list_response.json()[0]["last_download_at"] is not None


def test_share_endpoint_returns_pii_free_public_download_url():
    user = create_user("ShareOwner", "share-owner@example.com")
    client = csrf_client_for(user)
    upload_response = upload_file(
        client,
        name="private-report.txt",
        content=b"public by token",
    )
    assert upload_response.status_code == 201
    file_id = upload_response.json()["id"]

    share_response = client.post(
        f"/api/files/{file_id}/share/",
        **csrf_header(client),
    )

    assert share_response.status_code == 200
    share_url = share_response.json()["shared_url"]
    share_path = urlparse(share_url).path
    assert share_path.startswith("/api/shared/")
    assert user.username not in share_url
    assert "private-report.txt" not in share_url
    assert str(user.id) not in share_path

    public_response = Client().get(share_path)

    assert public_response.status_code == 200
    assert response_bytes(public_response) == b"public by token"
    assert (
        public_response["Content-Disposition"]
        == 'attachment; filename="private-report.txt"'
    )
    list_response = client.get("/api/files/")
    assert list_response.status_code == 200
    assert list_response.json()[0]["last_download_at"] is not None


def test_admin_can_view_and_manage_another_users_storage():
    owner = create_user("ManagedOwner", "managed-owner@example.com")
    other = create_user("ManagedOther", "managed-other@example.com")
    admin = create_admin()
    owner_client = csrf_client_for(owner)
    other_client = csrf_client_for(other)
    admin_client = csrf_client_for(admin)
    owner_upload = upload_file(owner_client, name="owner.txt")
    other_upload = upload_file(other_client, name="other.txt")
    assert owner_upload.status_code == 201
    assert other_upload.status_code == 201
    owner_file_id = owner_upload.json()["id"]

    list_response = admin_client.get(f"/api/files/?user_id={owner.id}")
    patch_response = patch_json(
        admin_client,
        f"/api/files/{owner_file_id}/",
        {"comment": "Reviewed by admin"},
    )
    download_response = admin_client.get(f"/api/files/{owner_file_id}/download/")
    delete_response = admin_client.delete(
        f"/api/files/{owner_file_id}/",
        **csrf_header(admin_client),
    )

    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()] == [owner_file_id]
    assert patch_response.status_code == 200
    assert patch_response.json()["comment"] == "Reviewed by admin"
    assert download_response.status_code == 200
    assert response_bytes(download_response) == b"file-content"
    assert delete_response.status_code == 204
    assert admin_client.get(f"/api/files/?user_id={owner.id}").json() == []


def test_regular_user_cannot_request_another_users_storage():
    owner = create_user("VisibleOwner", "visible-owner@example.com")
    other = create_user("VisibleOther", "visible-other@example.com")
    owner_client = csrf_client_for(owner)
    other_client = csrf_client_for(other)
    upload_response = upload_file(owner_client, name="owner.txt")
    assert upload_response.status_code == 201

    response = other_client.get(f"/api/files/?user_id={owner.id}")

    assert response.status_code == 403


def test_patch_updates_name_and_comment_without_touching_file(storage_root):
    user = create_user("PatchUser", "patch@example.com")
    client = csrf_client_for(user)
    upload_response = upload_file(client, name="before.txt")
    assert upload_response.status_code == 201
    file_id = upload_response.json()["id"]
    stored_path = next((storage_root / str(user.id)).iterdir())

    response = patch_json(
        client,
        f"/api/files/{file_id}/",
        {"original_name": "after.txt", "comment": "Updated comment"},
    )

    assert response.status_code == 200
    assert response.json()["original_name"] == "after.txt"
    assert response.json()["comment"] == "Updated comment"
    assert stored_path.exists()
    assert list((storage_root / str(user.id)).iterdir()) == [stored_path]


def test_delete_removes_record_and_physical_file(storage_root):
    user = create_user("DeleteUser", "delete@example.com")
    client = csrf_client_for(user)
    upload_response = upload_file(client)
    assert upload_response.status_code == 201
    file_id = upload_response.json()["id"]
    stored_path = next((storage_root / str(user.id)).iterdir())

    response = client.delete(f"/api/files/{file_id}/", **csrf_header(client))

    assert response.status_code == 204
    assert not stored_path.exists()
    list_response = client.get("/api/files/")
    assert list_response.status_code == 200
    assert list_response.json() == []


def test_foreign_file_is_hidden_from_other_users():
    owner = create_user("PrivateOwner", "private-owner@example.com")
    other = create_user("PrivateOther", "private-other@example.com")
    owner_client = csrf_client_for(owner)
    other_client = csrf_client_for(other)
    upload_response = upload_file(owner_client)
    assert upload_response.status_code == 201
    file_id = upload_response.json()["id"]

    list_response = other_client.get("/api/files/")
    download_response = other_client.get(f"/api/files/{file_id}/download/")
    patch_response = patch_json(
        other_client,
        f"/api/files/{file_id}/",
        {"comment": "stolen"},
    )
    delete_response = other_client.delete(
        f"/api/files/{file_id}/",
        **csrf_header(other_client),
    )

    assert list_response.status_code == 200
    assert list_response.json() == []
    assert download_response.status_code == 404
    assert patch_response.status_code == 404
    assert delete_response.status_code == 404


def test_files_endpoint_requires_authentication():
    response = Client().get("/api/files/")

    assert response.status_code == 403
