import re

from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator


USERNAME_REGEX = r"^[A-Za-z][A-Za-z0-9]{3,19}$"

username_validator = RegexValidator(
    regex=USERNAME_REGEX,
    message=(
        "Username must start with a Latin letter and contain only Latin "
        "letters and digits, 4-20 characters total."
    ),
    code="invalid_username",
)


def validate_password_strength(value: str) -> None:
    errors = []
    if len(value) < 6:
        errors.append("Password must contain at least 6 characters.")
    if not re.search(r"[A-Z]", value):
        errors.append("Password must contain at least one uppercase letter.")
    if not re.search(r"\d", value):
        errors.append("Password must contain at least one digit.")
    if not re.search(r"[^A-Za-z0-9]", value):
        errors.append("Password must contain at least one special character.")

    if errors:
        raise ValidationError(errors)
