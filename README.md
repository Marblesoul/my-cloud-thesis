# My Cloud

Diploma project: a simplified cloud file storage service with a Django REST API
and a React single-page application served by the same Django server.

## Project Structure

```text
backend/
  accounts/      Custom user model foundation
  config/        Django settings, URLs, ASGI/WSGI
  core/          Phase 0 health, CSRF, and SPA views
  storage/       File metadata, upload, download, and deletion API
frontend/
  src/           React app, Redux store, API helper
  webpack.config.cjs
SPEC.md
IMPLEMENTATION_PLAN.md
```

## Phase 0 Local Setup

The backend expects PostgreSQL. With Postgres.app running locally, create the
development database once:

```bash
rtk proxy createdb my_cloud
```

Create local environment settings:

```bash
cp .env.example .env
```

Set `INITIAL_ADMIN_PASSWORD` in `.env` before running migrations if you want
the bootstrap `admin` user to be immediately usable. If it is omitted, the
admin account is still created with `is_admin`, `is_staff`, and `is_superuser`,
but its password is unusable until you change it manually.

Install backend dependencies:

```bash
rtk proxy python3 -m venv backend/.venv
rtk proxy backend/.venv/bin/python -m pip install -r backend/requirements.txt
```

Install frontend dependencies and build the SPA:

```bash
rtk npm install --prefix frontend
rtk npm run build --prefix frontend
```

Run migrations and checks:

```bash
rtk proxy backend/.venv/bin/python backend/manage.py check
rtk proxy backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
rtk proxy backend/.venv/bin/python backend/manage.py migrate
rtk proxy backend/.venv/bin/python -m pytest backend
```

Start the Django server:

```bash
rtk proxy backend/.venv/bin/python backend/manage.py runserver
```

Smoke-check endpoints:

```bash
curl http://127.0.0.1:8000/api/health/
curl -i http://127.0.0.1:8000/api/csrf/
curl http://127.0.0.1:8000/
```

Expected Phase 0 result:

- `/api/health/` returns `{"status":"ok"}`.
- `/api/csrf/` returns JSON and sets the `csrftoken` cookie.
- `/` serves the built React page from `frontend/dist/index.html`.

## Phase 1 Backend Auth

Phase 1 adds session-based auth endpoints:

- `POST /api/register/`
- `POST /api/login/`
- `POST /api/logout/`
- `GET /api/me/`

Unsafe requests use Django sessions and CSRF. First request a token:

```bash
curl -c cookies.txt http://127.0.0.1:8000/api/csrf/
```

Then send the `csrftoken` cookie value as `X-CSRFToken` with credentials:

```bash
curl -b cookies.txt -c cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: <csrftoken>" \
  -d '{"username":"User123","full_name":"User Example","email":"user@example.com","password":"Secret1!"}' \
  http://127.0.0.1:8000/api/register/
```

Run Phase 1 checks:

```bash
rtk proxy backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
rtk proxy backend/.venv/bin/python backend/manage.py migrate
rtk proxy backend/.venv/bin/python -m pytest backend
```

## Phase 2 Backend File Storage

Phase 2 adds authenticated file storage endpoints for the current user's own
files:

- `GET /api/files/`
- `POST /api/files/`
- `PATCH /api/files/<id>/`
- `DELETE /api/files/<id>/`
- `GET /api/files/<id>/download/`

Uploaded files are stored under `STORAGE_ROOT/<user_id>/<uuid>`. The original
file name is kept in the database and returned as the download filename.

Example upload after logging in and obtaining a CSRF cookie:

```bash
curl -b cookies.txt -c cookies.txt \
  -H "X-CSRFToken: <csrftoken>" \
  -F "file=@./README.md" \
  -F "comment=Example upload" \
  http://127.0.0.1:8000/api/files/
```

Download a file by id:

```bash
curl -b cookies.txt \
  -o downloaded-file \
  http://127.0.0.1:8000/api/files/<id>/download/
```

Run Phase 2 checks:

```bash
rtk proxy backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
rtk proxy backend/.venv/bin/python backend/manage.py migrate
rtk proxy backend/.venv/bin/python -m pytest backend
```
