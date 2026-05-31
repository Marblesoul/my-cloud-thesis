from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from .validators import username_validator, validate_password_strength


User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "full_name", "email", "is_admin")
        read_only_fields = fields


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
