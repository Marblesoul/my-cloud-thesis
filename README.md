# My Cloud

Diploma project: a simplified cloud file storage service with a Django REST API
and a React single-page application served by the same Django server.

## Project Structure

```text
backend/
  accounts/      Custom user model, auth API, and admin user API
  config/        Django settings, URLs, ASGI/WSGI
  core/          Health, CSRF, and SPA views
  storage/       File metadata, upload, download, sharing, and deletion API
deploy/
  env.production.example
  nginx/my-cloud.conf
  systemd/my-cloud.service
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

## Phase 3 Backend Sharing And Admin API

Phase 3 adds public token downloads and administrator controls:

- `POST /api/files/<id>/share/`
- `GET /api/shared/<token>/`
- `GET /api/users/`
- `PATCH /api/users/<id>/`
- `DELETE /api/users/<id>/`
- `GET /api/files/?user_id=<id>` for admins managing another user's storage

The shared link is token-based and does not include the username, storage path,
or original file name. Downloads through both authenticated and public links
return the original file name and update `last_download_at`.

For direct file access by id, a file owned by another user is returned as
`404 Not Found`. This keeps enumerable file ids from revealing that another
user's file exists. A regular user explicitly requesting another user's storage
with `?user_id=` receives `403 Forbidden`.

Example share request after logging in:

```bash
curl -b cookies.txt -c cookies.txt \
  -H "X-CSRFToken: <csrftoken>" \
  -X POST \
  http://127.0.0.1:8000/api/files/<id>/share/
```

Example public download:

```bash
curl -o shared-file \
  http://127.0.0.1:8000/api/shared/<token>/
```

Admin examples:

```bash
curl -b admin-cookies.txt http://127.0.0.1:8000/api/users/

curl -b admin-cookies.txt -c admin-cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: <csrftoken>" \
  -X PATCH \
  -d '{"is_admin":true}' \
  http://127.0.0.1:8000/api/users/<id>/

curl -b admin-cookies.txt \
  http://127.0.0.1:8000/api/files/?user_id=<id>
```

Run Phase 3 checks:

```bash
rtk proxy backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
rtk proxy backend/.venv/bin/python backend/manage.py migrate
rtk proxy backend/.venv/bin/python -m pytest backend
```

## Phase 4-5 Frontend UI

Phase 4 and Phase 5 add the React SPA routes:

- `/` - home page
- `/register` - registration form with client validation hints
- `/login` - login form
- `/storage` - file list, upload, rename, comment edit, delete, download, and public link copy
- `/storage?user_id=<id>` - admin view of a selected user's storage
- `/admin` - admin-only user list, statistics, admin flag update, deletion, and storage link

Run frontend checks:

```bash
rtk npm test --prefix frontend
rtk npm run build --prefix frontend
```

Run the full local verification set:

```bash
rtk proxy backend/.venv/bin/python backend/manage.py check
rtk proxy backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
rtk proxy backend/.venv/bin/python backend/manage.py migrate
rtk proxy backend/.venv/bin/python -m pytest backend
rtk npm test --prefix frontend
rtk npm run build --prefix frontend
```

## Phase 6 Deployment On reg.ru Ubuntu VPS

These steps describe a clean deployment to an Ubuntu 24.04 VPS. Replace
`example.com`, `www.example.com`, `203.0.113.10`, repository URL, and passwords
with real values. Point the domain DNS A record to the VPS before issuing TLS.

### 1. Install System Packages

```bash
sudo apt update
sudo apt install -y git nginx postgresql postgresql-contrib python3 python3-venv python3-pip nodejs npm certbot python3-certbot-nginx
```

### 2. Create PostgreSQL Database

```bash
sudo -u postgres psql
```

Inside `psql`:

```sql
CREATE DATABASE my_cloud;
CREATE USER my_cloud WITH PASSWORD 'replace-db-password';
GRANT ALL PRIVILEGES ON DATABASE my_cloud TO my_cloud;
\c my_cloud
GRANT ALL ON SCHEMA public TO my_cloud;
\q
```

### 3. Create Application User And Clone Repository

```bash
sudo adduser --system --group --home /var/www/my-cloud --shell /bin/bash mycloud
sudo install -d -o mycloud -g www-data /var/www/my-cloud
sudo -u mycloud git clone https://github.com/<owner>/<repo>.git /var/www/my-cloud
```

### 4. Configure Production Environment

Generate a Django secret:

```bash
sudo -u mycloud /usr/bin/python3 - <<'PY'
import secrets

print(secrets.token_urlsafe(50))
PY
```

Create and edit the production env file:

```bash
sudo -u mycloud cp /var/www/my-cloud/deploy/env.production.example /var/www/my-cloud/.env
sudo -u mycloud nano /var/www/my-cloud/.env
```

Required values:

- `DJANGO_SECRET_KEY` - generated secret, never committed.
- `DJANGO_DEBUG=False`.
- `DJANGO_ALLOWED_HOSTS=example.com,www.example.com,203.0.113.10`.
- `DJANGO_CSRF_TRUSTED_ORIGINS=https://example.com,https://www.example.com`.
- `DATABASE_URL=postgres://my_cloud:replace-db-password@127.0.0.1:5432/my_cloud`.
- `STORAGE_ROOT=/var/www/my-cloud/storage`.
- `INITIAL_ADMIN_PASSWORD` - set only for first migration/bootstrap, then remove or rotate it.

If TLS is not issued yet, temporarily set:

```env
DJANGO_SECURE_SSL_REDIRECT=False
DJANGO_SESSION_COOKIE_SECURE=False
DJANGO_CSRF_COOKIE_SECURE=False
```

After `certbot` succeeds, set all three back to `True` and restart gunicorn.
Keep `DJANGO_SECURE_HSTS_SECONDS=3600` at first; increase it only after HTTPS
has been stable for the whole domain.

### 5. Install Python And Frontend Dependencies

```bash
sudo -u mycloud python3 -m venv /var/www/my-cloud/backend/.venv
sudo -u mycloud /var/www/my-cloud/backend/.venv/bin/python -m pip install --upgrade pip
sudo -u mycloud /var/www/my-cloud/backend/.venv/bin/python -m pip install -r /var/www/my-cloud/backend/requirements.txt
sudo -u mycloud npm ci --prefix /var/www/my-cloud/frontend
```

### 6. Build, Migrate, And Collect Static Files

```bash
sudo -u mycloud mkdir -p /var/www/my-cloud/storage /var/www/my-cloud/backend/staticfiles
sudo -u mycloud npm run build --prefix /var/www/my-cloud/frontend
sudo -u mycloud /var/www/my-cloud/backend/.venv/bin/python /var/www/my-cloud/backend/manage.py check
sudo -u mycloud /var/www/my-cloud/backend/.venv/bin/python /var/www/my-cloud/backend/manage.py migrate
sudo -u mycloud /var/www/my-cloud/backend/.venv/bin/python /var/www/my-cloud/backend/manage.py collectstatic --noinput
```

### 7. Configure gunicorn systemd Service

```bash
sudo cp /var/www/my-cloud/deploy/systemd/my-cloud.service /etc/systemd/system/my-cloud.service
sudo systemctl daemon-reload
sudo systemctl enable --now my-cloud
sudo systemctl status my-cloud
```

Useful logs:

```bash
sudo journalctl -u my-cloud -n 100 --no-pager
```

### 8. Configure nginx

```bash
sudo cp /var/www/my-cloud/deploy/nginx/my-cloud.conf /etc/nginx/sites-available/my-cloud
sudo nano /etc/nginx/sites-available/my-cloud
sudo ln -s /etc/nginx/sites-available/my-cloud /etc/nginx/sites-enabled/my-cloud
sudo nginx -t
sudo systemctl reload nginx
```

In `/etc/nginx/sites-available/my-cloud`, replace:

```nginx
server_name example.com www.example.com;
```

with the real domain names. If deploying by IP only, use:

```nginx
server_name 203.0.113.10;
```

### 9. Issue HTTPS Certificate

```bash
sudo certbot --nginx -d example.com -d www.example.com
```

After TLS is active, edit `/var/www/my-cloud/.env`, enable secure cookie and
redirect flags, then restart:

```bash
sudo -u mycloud nano /var/www/my-cloud/.env
sudo systemctl restart my-cloud
sudo nginx -t
sudo systemctl reload nginx
```

### 10. Smoke Test Production

```bash
curl -i https://example.com/api/health/
curl -i -c cookies.txt https://example.com/api/csrf/
curl -i https://example.com/
```

Expected results:

- `/api/health/` returns `{"status":"ok"}`.
- `/api/csrf/` returns JSON and sets `csrftoken`.
- `/` returns the React SPA.
- Login, registration, file upload/download, public links, and admin pages work through the browser.

### 11. Repeatable Update Procedure

```bash
sudo -u mycloud git -C /var/www/my-cloud pull --ff-only
sudo -u mycloud /var/www/my-cloud/backend/.venv/bin/python -m pip install -r /var/www/my-cloud/backend/requirements.txt
sudo -u mycloud npm ci --prefix /var/www/my-cloud/frontend
sudo -u mycloud npm run build --prefix /var/www/my-cloud/frontend
sudo -u mycloud /var/www/my-cloud/backend/.venv/bin/python /var/www/my-cloud/backend/manage.py migrate
sudo -u mycloud /var/www/my-cloud/backend/.venv/bin/python /var/www/my-cloud/backend/manage.py collectstatic --noinput
sudo systemctl restart my-cloud
sudo nginx -t
sudo systemctl reload nginx
```

### 12. Deployment Troubleshooting

- `502 Bad Gateway`: check `sudo systemctl status my-cloud` and `sudo journalctl -u my-cloud -n 100 --no-pager`.
- Static files missing: rerun frontend build and `collectstatic`, then verify `/var/www/my-cloud/backend/staticfiles/`.
- CSRF failures: verify `DJANGO_CSRF_TRUSTED_ORIGINS` includes the exact `https://` origins and browser requests use the same domain.
- Public links fail: verify nginx proxies `/api/shared/<token>/` to Django and that `STORAGE_ROOT` is readable by the `mycloud` service user.
