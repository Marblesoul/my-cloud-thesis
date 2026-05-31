import uuid
from pathlib import Path

from django.conf import settings


def user_storage_dir(user) -> Path:
    return Path(settings.STORAGE_ROOT) / str(user.id)


def absolute_storage_path(stored_file) -> Path:
    return Path(settings.STORAGE_ROOT) / stored_file.storage_path


def save_uploaded_file(user, uploaded_file) -> str:
    storage_dir = user_storage_dir(user)
    storage_dir.mkdir(parents=True, exist_ok=True)

    storage_name = str(uuid.uuid4())
    destination = storage_dir / storage_name
    with destination.open("wb") as handle:
        for chunk in uploaded_file.chunks():
            handle.write(chunk)

    return f"{user.id}/{storage_name}"


def delete_physical_file(stored_file) -> None:
    try:
        absolute_storage_path(stored_file).unlink()
    except FileNotFoundError:
        pass
