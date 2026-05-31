from rest_framework import serializers

from .models import StoredFile


class StoredFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoredFile
        fields = (
            "id",
            "original_name",
            "size",
            "comment",
            "uploaded_at",
            "last_download_at",
        )
        read_only_fields = ("id", "size", "uploaded_at", "last_download_at")

    def validate_original_name(self, value: str) -> str:
        if not value.strip():
            raise serializers.ValidationError("File name cannot be blank.")
        return value
