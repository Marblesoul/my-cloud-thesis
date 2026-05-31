# My Cloud

Diploma project: a simplified cloud file storage service with a Django REST API
and a React single-page application served by the same Django server.

## Project Structure

```text
backend/
  accounts/      Custom user model foundation
  config/        Django settings, URLs, ASGI/WSGI
  core/          Phase 0 health, CSRF, and SPA views
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
