import logging
import os

import accounts.validators
from django.contrib.auth.hashers import make_password
from django.db import migrations, models


logger = logging.getLogger(__name__)


def bootstrap_admin(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    password = os.environ.get("INITIAL_ADMIN_PASSWORD")

    admin, created = User.objects.get_or_create(
        username="admin",
        defaults={
            "email": "admin@example.local",
            "full_name": "System Administrator",
            "is_admin": True,
            "is_staff": True,
            "is_superuser": True,
        },
    )

    fields_to_update = []
    for field, value in (
        ("email", "admin@example.local"),
        ("full_name", "System Administrator"),
        ("is_admin", True),
        ("is_staff", True),
        ("is_superuser", True),
    ):
        if getattr(admin, field) != value:
            setattr(admin, field, value)
            fields_to_update.append(field)

    if created:
        if password:
            admin.password = make_password(password)
        else:
            logger.warning(
                "INITIAL_ADMIN_PASSWORD is not set; bootstrap admin will have an unusable password."
            )
            admin.password = make_password(None)
        fields_to_update.append("password")

    if not admin.storage_path:
        admin.storage_path = str(admin.id)
        fields_to_update.append("storage_path")

    if fields_to_update:
        admin.save(update_fields=fields_to_update)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="username",
            field=models.CharField(
                error_messages={"unique": "A user with that username already exists."},
                max_length=20,
                unique=True,
                validators=[accounts.validators.username_validator],
            ),
        ),
        migrations.RunPython(bootstrap_admin, migrations.RunPython.noop),
    ]
