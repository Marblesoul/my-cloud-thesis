from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    full_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(unique=True)
    is_admin = models.BooleanField(default=False)
    storage_path = models.CharField(max_length=512, blank=True)

    def __str__(self) -> str:
        return self.username
