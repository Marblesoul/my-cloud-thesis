from django.urls import path

from .views import FileDetailView, FileDownloadView, FileListCreateView


urlpatterns = [
    path("files/", FileListCreateView.as_view(), name="file-list"),
    path("files/<int:file_id>/", FileDetailView.as_view(), name="file-detail"),
    path(
        "files/<int:file_id>/download/",
        FileDownloadView.as_view(),
        name="file-download",
    ),
]
