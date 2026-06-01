import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import {
  clearFilesError,
  deleteFile,
  fetchFiles,
  shareFile,
  updateFile,
  uploadFile as uploadStoredFile,
} from "./filesSlice";

function formatBytes(value) {
  if (!Number.isFinite(value)) {
    return "0 Б";
  }

  if (value < 1024) {
    return `${value} Б`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} КБ`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} МБ`;
}

function formatDate(value) {
  if (!value) {
    return "Не скачивался";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function StoragePage() {
  const dispatch = useDispatch();
  const fileInputRef = useRef(null);
  const [searchParams] = useSearchParams();
  const { user } = useSelector((state) => state.auth);
  const { action, error, fieldErrors, items, sharedUrls, status } = useSelector(
    (state) => state.files,
  );
  const requestedUserId = searchParams.get("user_id");
  const targetUserId = user?.is_admin && requestedUserId ? requestedUserId : null;
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadComment, setUploadComment] = useState("");
  const [localUploadError, setLocalUploadError] = useState(null);
  const [editingFileId, setEditingFileId] = useState(null);
  const [editValues, setEditValues] = useState({ comment: "", originalName: "" });
  const [editError, setEditError] = useState(null);
  const [notice, setNotice] = useState(null);
  const isLoadingList = status === "loading" && action === "list";
  const isBusy = status === "loading";

  useEffect(() => {
    dispatch(fetchFiles({ userId: targetUserId }));
  }, [dispatch, targetUserId]);

  useEffect(() => {
    setEditingFileId(null);
    setNotice(null);
  }, [targetUserId]);

  function handleFileChange(event) {
    setSelectedFile(event.target.files?.[0] || null);
    setLocalUploadError(null);
    if (error || Object.keys(fieldErrors).length) {
      dispatch(clearFilesError());
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    setNotice(null);

    if (!selectedFile) {
      setLocalUploadError("Выберите файл для загрузки.");
      return;
    }

    try {
      await dispatch(
        uploadStoredFile({
          comment: uploadComment.trim(),
          file: selectedFile,
          userId: targetUserId,
        }),
      ).unwrap();
      setSelectedFile(null);
      setUploadComment("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setNotice("Файл загружен.");
    } catch {
      // Store state renders the API error.
    }
  }

  function startEditing(file) {
    setEditingFileId(file.id);
    setEditValues({
      comment: file.comment || "",
      originalName: file.original_name,
    });
    setEditError(null);
    setNotice(null);
  }

  async function handleSaveEdit(fileId) {
    const originalName = editValues.originalName.trim();
    if (!originalName) {
      setEditError("Имя файла не может быть пустым.");
      return;
    }

    try {
      await dispatch(
        updateFile({
          comment: editValues.comment.trim(),
          fileId,
          originalName,
        }),
      ).unwrap();
      setEditingFileId(null);
      setNotice("Файл обновлен.");
    } catch {
      // Store state renders the API error.
    }
  }

  async function handleDelete(file) {
    const confirmed = window.confirm(`Удалить файл "${file.original_name}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await dispatch(deleteFile(file.id)).unwrap();
      setNotice("Файл удален.");
    } catch {
      // Store state renders the API error.
    }
  }

  async function handleShare(file) {
    setNotice(null);

    try {
      const result = await dispatch(shareFile(file.id)).unwrap();
      const sharedUrl = result.share.shared_url;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(sharedUrl);
          setNotice("Публичная ссылка скопирована.");
          return;
        } catch {
          // Fall through to the visible link.
        }
      }
      setNotice("Ссылка создана. Скопируйте ее из поля под файлом.");
    } catch {
      // Store state renders the API error.
    }
  }

  return (
    <main className="page wide-page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Файлы</p>
          <h1>{targetUserId ? `Хранилище пользователя #${targetUserId}` : "Мое хранилище"}</h1>
          <p>
            Загружайте файлы, обновляйте имена и комментарии, скачивайте и создавайте
            публичные ссылки.
          </p>
        </div>
        {user?.is_admin ? (
          <Link className="button secondary" to="/admin">
            К админке
          </Link>
        ) : null}
      </section>

      {notice ? <p className="form-alert success">{notice}</p> : null}
      {error ? <p className="form-alert error">{error}</p> : null}

      <section className="panel stack-panel" aria-labelledby="upload-title">
        <h2 id="upload-title">Загрузка файла</h2>
        <form className="upload-form" onSubmit={handleUpload}>
          <div className="field">
            <label htmlFor="file-input">Файл</label>
            <input
              id="file-input"
              name="file"
              onChange={handleFileChange}
              ref={fileInputRef}
              type="file"
            />
            {localUploadError || fieldErrors.file ? (
              <span className="field-error">{localUploadError || fieldErrors.file}</span>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="comment-input">Комментарий</label>
            <textarea
              id="comment-input"
              name="comment"
              onChange={(event) => setUploadComment(event.target.value)}
              rows="3"
              value={uploadComment}
            />
            {fieldErrors.comment ? (
              <span className="field-error">{fieldErrors.comment}</span>
            ) : null}
          </div>
          <button className="button primary" disabled={isBusy} type="submit">
            {action === "upload" ? "Загружаем..." : "Загрузить"}
          </button>
        </form>
      </section>

      <section className="panel stack-panel" aria-labelledby="files-title">
        <div className="section-heading">
          <div>
            <h2 id="files-title">Список файлов</h2>
            <p>{items.length ? `Файлов: ${items.length}` : "Пока нет загруженных файлов."}</p>
          </div>
          <button
            className="button secondary"
            disabled={isLoadingList}
            onClick={() => dispatch(fetchFiles({ userId: targetUserId }))}
            type="button"
          >
            {isLoadingList ? "Обновляем..." : "Обновить"}
          </button>
        </div>

        {isLoadingList ? <p className="empty-state">Загружаем список файлов...</p> : null}
        {!isLoadingList && items.length === 0 ? (
          <p className="empty-state">Загрузите первый файл через форму выше.</p>
        ) : null}
        {items.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Комментарий</th>
                  <th>Размер</th>
                  <th>Загружен</th>
                  <th>Последнее скачивание</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {items.map((file) => {
                  const isEditing = editingFileId === file.id;
                  return (
                    <tr key={file.id}>
                      <td>
                        {isEditing ? (
                          <input
                            className="table-input"
                            onChange={(event) =>
                              setEditValues((current) => ({
                                ...current,
                                originalName: event.target.value,
                              }))
                            }
                            value={editValues.originalName}
                          />
                        ) : (
                          <span className="strong-text">{file.original_name}</span>
                        )}
                        {isEditing && editError ? (
                          <span className="field-error block-error">{editError}</span>
                        ) : null}
                        {sharedUrls[file.id] ? (
                          <input
                            className="share-link"
                            onFocus={(event) => event.target.select()}
                            readOnly
                            value={sharedUrls[file.id]}
                          />
                        ) : null}
                      </td>
                      <td>
                        {isEditing ? (
                          <textarea
                            className="table-input"
                            onChange={(event) =>
                              setEditValues((current) => ({
                                ...current,
                                comment: event.target.value,
                              }))
                            }
                            rows="3"
                            value={editValues.comment}
                          />
                        ) : (
                          file.comment || "Без комментария"
                        )}
                      </td>
                      <td>{formatBytes(file.size)}</td>
                      <td>{formatDate(file.uploaded_at)}</td>
                      <td>{formatDate(file.last_download_at)}</td>
                      <td>
                        <div className="row-actions">
                          {isEditing ? (
                            <>
                              <button
                                className="button primary small"
                                disabled={isBusy}
                                onClick={() => handleSaveEdit(file.id)}
                                type="button"
                              >
                                Сохранить
                              </button>
                              <button
                                className="button secondary small"
                                onClick={() => setEditingFileId(null)}
                                type="button"
                              >
                                Отмена
                              </button>
                            </>
                          ) : (
                            <>
                              <a
                                className="button secondary small"
                                href={`/api/files/${file.id}/download/`}
                              >
                                Скачать
                              </a>
                              <button
                                className="button secondary small"
                                onClick={() => startEditing(file)}
                                type="button"
                              >
                                Изменить
                              </button>
                              <button
                                className="button secondary small"
                                disabled={isBusy}
                                onClick={() => handleShare(file)}
                                type="button"
                              >
                                Ссылка
                              </button>
                              <button
                                className="button danger small"
                                disabled={isBusy}
                                onClick={() => handleDelete(file)}
                                type="button"
                              >
                                Удалить
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}
