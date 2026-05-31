from django.contrib import admin
from django.urls import path, re_path

from core import views

urlpatterns = [
    path("api/health/", views.health_check, name="health-check"),
    path("api/csrf/", views.csrf_cookie, name="csrf-cookie"),
    path("django-admin/", admin.site.urls),
    re_path(r"^(?!api/|django-admin/).*", views.spa_index, name="spa-index"),
]
