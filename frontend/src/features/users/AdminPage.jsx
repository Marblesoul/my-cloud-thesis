import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import { deleteUser, fetchUsers, updateUserAdmin } from "./usersSlice";

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

export function AdminPage() {
  const dispatch = useDispatch();
  const currentUser = useSelector((state) => state.auth.user);
  const { action, error, items, status } = useSelector((state) => state.users);
  const isLoadingList = status === "loading" && action === "list";
  const isBusy = status === "loading";

  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  async function handleAdminToggle(user, isAdmin) {
    try {
      await dispatch(updateUserAdmin({ isAdmin, userId: user.id })).unwrap();
    } catch {
      // Store state renders the API error.
    }
  }

  async function handleDelete(user) {
    if (user.id === currentUser?.id) {
      return;
    }

    const confirmed = window.confirm(`Удалить пользователя "${user.username}" и его файлы?`);
    if (!confirmed) {
      return;
    }

    try {
      await dispatch(deleteUser(user.id)).unwrap();
    } catch {
      // Store state renders the API error.
    }
  }

  return (
    <main className="page wide-page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Администрирование</p>
          <h1>Пользователи</h1>
          <p>
            Управляйте ролями, удаляйте учетные записи и открывайте хранилища
            пользователей из общего списка.
          </p>
        </div>
        <button
          className="button secondary"
          disabled={isLoadingList}
          onClick={() => dispatch(fetchUsers())}
          type="button"
        >
          {isLoadingList ? "Обновляем..." : "Обновить"}
        </button>
      </section>

      {error ? <p className="form-alert error">{error}</p> : null}

      <section className="panel stack-panel">
        {isLoadingList ? <p className="empty-state">Загружаем пользователей...</p> : null}
        {!isLoadingList && items.length === 0 ? (
          <p className="empty-state">Пользователи не найдены.</p>
        ) : null}
        {items.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Логин</th>
                  <th>Имя</th>
                  <th>Email</th>
                  <th>Admin</th>
                  <th>Файлы</th>
                  <th>Размер</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {items.map((user) => {
                  const isSelf = user.id === currentUser?.id;
                  return (
                    <tr key={user.id}>
                      <td>
                        <span className="strong-text">{user.username}</span>
                      </td>
                      <td>{user.full_name || "Не указано"}</td>
                      <td>{user.email}</td>
                      <td>
                        <label className="toggle-field">
                          <input
                            checked={user.is_admin}
                            disabled={isBusy || isSelf}
                            onChange={(event) =>
                              handleAdminToggle(user, event.target.checked)
                            }
                            type="checkbox"
                          />
                          <span>{user.is_admin ? "Да" : "Нет"}</span>
                        </label>
                      </td>
                      <td>{user.file_count}</td>
                      <td>{formatBytes(user.storage_size)}</td>
                      <td>
                        <div className="row-actions">
                          <Link
                            className="button secondary small"
                            to={`/storage?user_id=${user.id}`}
                          >
                            Файлы
                          </Link>
                          <button
                            className="button danger small"
                            disabled={isBusy || isSelf}
                            onClick={() => handleDelete(user)}
                            type="button"
                          >
                            Удалить
                          </button>
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
