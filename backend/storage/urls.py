from django.urls import path

from .views import (
    FileDetailView,
    FileDownloadView,
    FileListCreateView,
    FileShareView,
    SharedFileDownloadView,
)


urlpatterns = [
    path("files/", FileListCreateView.as_view(), name="file-list"),
    path("files/<int:file_id>/", FileDetailView.as_view(), name="file-detail"),
    path(
        "files/<int:file_id>/download/",
        FileDownloadView.as_view(),
        name="file-download",
    ),
    path("files/<int:file_id>/share/", FileShareView.as_view(), name="file-share"),
    path("shared/<str:token>/", SharedFileDownloadView.as_view(), name="shared-file"),
]
