from pathlib import Path

import environ
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent
FRONTEND_DIST = REPO_ROOT / "frontend" / "dist"

env = environ.Env(
    DJANGO_DEBUG=(bool, True),
    DJANGO_LOG_LEVEL=(str, "INFO"),
    DJANGO_SECURE_SSL_REDIRECT=(bool, False),
    DJANGO_SESSION_COOKIE_SECURE=(bool, False),
    DJANGO_CSRF_COOKIE_SECURE=(bool, False),
    DJANGO_SECURE_HSTS_SECONDS=(int, 0),
    DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=(bool, False),
    DJANGO_SECURE_HSTS_PRELOAD=(bool, False),
    DJANGO_USE_X_FORWARDED_PROTO=(bool, False),
)
environ.Env.read_env(REPO_ROOT / ".env")


def env_path(name: str, default: str) -> Path:
    value = Path(env(name, default=default))
    return value if value.is_absolute() else (REPO_ROOT / value).resolve()

SECRET_KEY = env(
    "DJANGO_SECRET_KEY",
    default="django-insecure-local-phase-0-change-me",
)
DEBUG = env("DJANGO_DEBUG")
if not DEBUG and SECRET_KEY == "django-insecure-local-phase-0-change-me":
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set when DJANGO_DEBUG=False.")

ALLOWED_HOSTS = [
    host for host in env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"]) if host
]
CSRF_TRUSTED_ORIGINS = [
    origin for origin in env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=[]) if origin
]
CSRF_FAILURE_VIEW = "core.views.csrf_failure"
SECURE_SSL_REDIRECT = env("DJANGO_SECURE_SSL_REDIRECT")
SESSION_COOKIE_SECURE = env("DJANGO_SESSION_COOKIE_SECURE")
CSRF_COOKIE_SECURE = env("DJANGO_CSRF_COOKIE_SECURE")
SECURE_HSTS_SECONDS = env("DJANGO_SECURE_HSTS_SECONDS")
SECURE_HSTS_INCLUDE_SUBDOMAINS = env("DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS")
SECURE_HSTS_PRELOAD = env("DJANGO_SECURE_HSTS_PRELOAD")
SECURE_PROXY_SSL_HEADER = (
    ("HTTP_X_FORWARDED_PROTO", "https") if env("DJANGO_USE_X_FORWARDED_PROTO") else None
)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "accounts",
    "storage",
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [FRONTEND_DIST],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": env.db(
        "DATABASE_URL",
        default="postgres://dmitry@localhost:5432/my_cloud",
    )
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]

LANGUAGE_CODE = "ru-ru"
TIME_ZONE = "Europe/Moscow"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = env_path("DJANGO_STATIC_ROOT", "backend/staticfiles")
STATICFILES_DIRS = [FRONTEND_DIST / "static"] if (FRONTEND_DIST / "static").exists() else []

STORAGE_ROOT = env_path("STORAGE_ROOT", "backend/storage_root")

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.FormParser",
        "rest_framework.parsers.MultiPartParser",
    ],
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "console": {
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "console",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": env("DJANGO_LOG_LEVEL"),
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
