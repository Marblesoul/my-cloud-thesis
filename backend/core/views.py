from pathlib import Path

from django.conf import settings
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request: HttpRequest) -> Response:
    return Response({"status": "ok"})


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf_cookie(request: HttpRequest) -> Response:
    get_token(request)
    return Response({"detail": "CSRF cookie set"})


def spa_index(request: HttpRequest) -> HttpResponse:
    index_path = Path(settings.FRONTEND_DIST) / "index.html"
    if not index_path.exists():
        return JsonResponse(
            {"detail": "Frontend build not found. Run `npm run build --prefix frontend`."},
            status=503,
        )

    return HttpResponse(index_path.read_text(encoding="utf-8"), content_type="text/html")
