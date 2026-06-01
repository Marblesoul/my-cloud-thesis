from django.contrib.auth import get_user_model
from django.db.models import Sum
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from .validators import username_validator, validate_password_strength


User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "full_name", "email", "is_admin")
        read_only_fields = fields


class AdminUserSerializer(serializers.ModelSerializer):
    file_count = serializers.SerializerMethodField()
    storage_size = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "full_name",
            "email",
            "is_admin",
            "file_count",
            "storage_size",
        )
        read_only_fields = fields

    def get_file_count(self, user) -> int:
        annotated_count = getattr(user, "file_count", None)
        if annotated_count is not None:
            return annotated_count
        return user.stored_files.count()

    def get_storage_size(self, user) -> int:
        annotated_size = getattr(user, "storage_size", None)
        if annotated_size is not None:
            return annotated_size
        return user.stored_files.aggregate(total=Sum("size"))["total"] or 0


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("is_admin",)


class RegisterSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        max_length=20,
        validators=[
            username_validator,
            UniqueValidator(queryset=User.objects.all()),
        ],
    )
    full_name = serializers.CharField(max_length=255, allow_blank=False)
    email = serializers.EmailField(
        validators=[
            UniqueValidator(queryset=User.objects.all()),
        ],
    )
    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        validators=[validate_password_strength],
    )

    class Meta:
        model = User
        fields = ("id", "username", "full_name", "email", "password")
        read_only_fields = ("id",)

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        user.storage_path = str(user.id)
        user.save(update_fields=["storage_path"])
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
