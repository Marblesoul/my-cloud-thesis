import json
import uuid

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
