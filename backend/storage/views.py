import secrets
from pathlib import Path

from django.contrib.auth import get_user_model
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import StoredFile
from .serializers import StoredFileSerializer
from .services import absolute_storage_path, delete_physical_file, save_uploaded_file


User = get_user_model()


def is_app_admin(user) -> bool:
    return bool(user and user.is_authenticated and user.is_admin)


def storage_owner_from_request(request):
    user_id = request.query_params.get("user_id")
    if not user_id:
        return request.user

    if not is_app_admin(request.user):
        if str(request.user.id) == user_id:
            return request.user
        raise PermissionDenied("You do not have access to this storage.")

    try:
        return User.objects.get(id=user_id)
    except (ValueError, User.DoesNotExist) as exc:
        raise Http404 from exc


def get_accessible_file(request, file_id: int) -> StoredFile:
    try:
        stored_file = StoredFile.objects.get(id=file_id)
    except StoredFile.DoesNotExist as exc:
        raise Http404 from exc

    if stored_file.owner_id != request.user.id and not is_app_admin(request.user):
        raise Http404

    return stored_file


def ensure_shared_token(stored_file: StoredFile) -> str:
    if stored_file.shared_token:
        return stored_file.shared_token

    while True:
        token = secrets.token_urlsafe(32)
        if not StoredFile.objects.filter(shared_token=token).exists():
            stored_file.shared_token = token
            stored_file.save(update_fields=["shared_token"])
            return token


class FileListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        owner = storage_owner_from_request(request)
        files = StoredFile.objects.filter(owner=owner)
        serializer = StoredFileSerializer(files, many=True)
        return Response(serializer.data)

    def post(self, request):
        uploaded_file = request.FILES.get("file")
        if uploaded_file is None:
            return Response(
                {"file": ["This field is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        owner = storage_owner_from_request(request)
        original_name = Path(uploaded_file.name).name or "uploaded-file"
        storage_path = save_uploaded_file(owner, uploaded_file)
        stored_file = StoredFile.objects.create(
            owner=owner,
            original_name=original_name,
            size=uploaded_file.size,
            comment=request.data.get("comment", ""),
            storage_path=storage_path,
        )
        return Response(
            StoredFileSerializer(stored_file).data,
            status=status.HTTP_201_CREATED,
        )


class FileDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, file_id: int) -> StoredFile:
        return get_accessible_file(request, file_id)

    def patch(self, request, file_id: int):
        stored_file = self.get_object(request, file_id)
        serializer = StoredFileSerializer(
            stored_file,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, file_id: int):
        stored_file = self.get_object(request, file_id)
        delete_physical_file(stored_file)
        stored_file.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class FileDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, file_id: int):
        stored_file = get_accessible_file(request, file_id)

        path = absolute_storage_path(stored_file)
        if not path.exists():
            raise Http404

        stored_file.last_download_at = timezone.now()
        stored_file.save(update_fields=["last_download_at"])
        return FileResponse(
            path.open("rb"),
            as_attachment=True,
            filename=stored_file.original_name,
        )


class FileShareView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, file_id: int):
        stored_file = get_accessible_file(request, file_id)
        token = ensure_shared_token(stored_file)
        shared_path = f"/api/shared/{token}/"
        return Response(
            {
                "shared_token": token,
                "shared_path": shared_path,
                "shared_url": request.build_absolute_uri(shared_path),
            }
        )


class SharedFileDownloadView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token: str):
        try:
            stored_file = StoredFile.objects.get(shared_token=token)
        except StoredFile.DoesNotExist as exc:
            raise Http404 from exc

        path = absolute_storage_path(stored_file)
        if not path.exists():
            raise Http404

        stored_file.last_download_at = timezone.now()
        stored_file.save(update_fields=["last_download_at"])
        return FileResponse(
            path.open("rb"),
            as_attachment=True,
            filename=stored_file.original_name,
        )
