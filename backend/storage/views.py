from pathlib import Path

from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import StoredFile
from .serializers import StoredFileSerializer
from .services import absolute_storage_path, delete_physical_file, save_uploaded_file


class FileListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        files = StoredFile.objects.filter(owner=request.user)
        serializer = StoredFileSerializer(files, many=True)
        return Response(serializer.data)

    def post(self, request):
        uploaded_file = request.FILES.get("file")
        if uploaded_file is None:
            return Response(
                {"file": ["This field is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        original_name = Path(uploaded_file.name).name or "uploaded-file"
        storage_path = save_uploaded_file(request.user, uploaded_file)
        stored_file = StoredFile.objects.create(
            owner=request.user,
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
        try:
            return StoredFile.objects.get(id=file_id, owner=request.user)
        except StoredFile.DoesNotExist as exc:
            raise Http404 from exc

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
        try:
            stored_file = StoredFile.objects.get(id=file_id, owner=request.user)
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
