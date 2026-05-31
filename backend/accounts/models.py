from django.contrib.auth.models import AbstractUser
from django.db import models

from .validators import username_validator


class User(AbstractUser):
    username = models.CharField(
        error_messages={
            "unique": "A user with that username already exists.",
        },
        max_length=20,
        unique=True,
        validators=[username_validator],
    )
    full_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(unique=True)
    is_admin = models.BooleanField(default=False)
    storage_path = models.CharField(max_length=512, blank=True)

    def __str__(self) -> str:
        return self.username
