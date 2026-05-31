from django.conf import settings
from django.db import models


class StoredFile(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="stored_files",
    )
    original_name = models.CharField(max_length=255)
    size = models.PositiveBigIntegerField()
    comment = models.TextField(blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    last_download_at = models.DateTimeField(null=True, blank=True)
    storage_path = models.CharField(max_length=512)
    shared_token = models.CharField(
        max_length=128,
        unique=True,
        db_index=True,
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-uploaded_at", "-id"]

    def __str__(self) -> str:
        return self.original_name
