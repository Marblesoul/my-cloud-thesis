# My Cloud

Дипломная работа — упрощённый сервис облачного хранения файлов. Бэкенд реализован
на Django REST Framework, фронтенд — на React (Redux Toolkit). React SPA собирается
Webpack и отдаётся тем же Django-сервером как статика.

Ключевые возможности: регистрация и вход, загрузка/скачивание/удаление файлов,
публичные ссылки на скачивание по токену, панель администратора для управления
пользователями и их файлами.

## Требования

- Python 3.11+
- Node.js 20+ и npm
- PostgreSQL 15+

## Структура проекта

```text
backend/
  accounts/      Кастомная модель пользователя, API авторизации и API администратора
  config/        Настройки Django, URLs, ASGI/WSGI
  core/          Health-check, CSRF и SPA-вьюха
  storage/       Метаданные файлов, загрузка, скачивание, шаринг и удаление
deploy/
  env.production.example   Шаблон .env для продакшена
  nginx/my-cloud.conf      Конфиг nginx
  systemd/my-cloud.service Юнит systemd для gunicorn
frontend/
  src/            React-приложение, Redux store, API-хелпер
  webpack.config.cjs
.env.example     Шаблон переменных окружения для локальной разработки
```

---

## Локальная установка и запуск

### 1. Создать базу данных PostgreSQL

```bash
createdb my_cloud
```

Если используется нестандартный пользователь или хост, создайте базу через `psql`:

```sql
CREATE DATABASE my_cloud;
```

### 2. Настроить переменные окружения

```bash
cp .env.example .env
```

Откройте `.env` и проверьте/заполните как минимум:

```env
# Строка подключения к БД — укажите своего пользователя и хост
DATABASE_URL=postgres://<user>@localhost:5432/my_cloud

# Пароль для первого администратора (создаётся при миграции)
INITIAL_ADMIN_PASSWORD=ChangeMe1!
```

Остальные переменные заполнять не нужно — для локальной разработки достаточно
значений по умолчанию (DEBUG=True, SQLite-like секрет и т. д.).

### 3. Установить зависимости бэкенда

Создайте виртуальное окружение и установите пакеты:

```bash
python3 -m venv backend/.venv
```

**macOS / Linux:**

```bash
source backend/.venv/bin/activate
```

**Windows:**

```bash
backend\.venv\Scripts\activate
```

```bash
pip install -r backend/requirements.txt
```

### 4. Применить миграции

```bash
python backend/manage.py migrate
```

При первой миграции автоматически создаётся пользователь `admin` (пароль из
`INITIAL_ADMIN_PASSWORD`).

### 5. Установить зависимости фронтенда и собрать SPA

```bash
npm install --prefix frontend
npm run build --prefix frontend
```

Собранное приложение попадает в `frontend/dist/` — Django будет раздавать его
как статику.

### 6. Запустить сервер

```bash
python backend/manage.py runserver
```

Сервер стартует на `http://127.0.0.1:8000`.

### 7. Проверка

```bash
curl http://127.0.0.1:8000/api/health/
# {"status":"ok"}

curl -i http://127.0.0.1:8000/api/csrf/
# JSON + устанавливает cookie csrftoken

curl http://127.0.0.1:8000/
# HTML React SPA
```

---

## Разработка фронтенда (режим watch)

Чтобы фронтенд пересобирался при изменении исходников, запустите в отдельном
терминале:

```bash
npm run dev --prefix frontend
```

Бэкенд при этом продолжает работать через `runserver` и автоматически отдаёт
свежие файлы из `frontend/dist/`.

---

## Тесты

**Бэкенд:**

```bash
python -m pytest backend
```

**Фронтенд:**

```bash
npm test --prefix frontend
```

**Полная проверка перед коммитом:**

```bash
python backend/manage.py check
python backend/manage.py makemigrations --check --dry-run
python -m pytest backend
npm test --prefix frontend
npm run build --prefix frontend
```

---

## Обзор API

### Авторизация

| Метод | Маршрут | Описание |
| ----- | ------- | -------- |
| `POST` | `/api/register/` | Регистрация нового пользователя |
| `POST` | `/api/login/` | Вход (сессия + CSRF) |
| `POST` | `/api/logout/` | Выход |
| `GET` | `/api/me/` | Данные текущего пользователя |

Небезопасные запросы требуют CSRF-токена. Получите его:

```bash
curl -c cookies.txt http://127.0.0.1:8000/api/csrf/
```

Пример регистрации:

```bash
curl -b cookies.txt -c cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: <csrftoken>" \
  -d '{"username":"User123","full_name":"User Example","email":"user@example.com","password":"Secret1!"}' \
  http://127.0.0.1:8000/api/register/
```

### Файлы

| Метод | Маршрут | Описание |
| ----- | ------- | -------- |
| `GET` | `/api/files/` | Список файлов текущего пользователя |
| `POST` | `/api/files/` | Загрузить файл |
| `PATCH` | `/api/files/<id>/` | Изменить имя или комментарий |
| `DELETE` | `/api/files/<id>/` | Удалить файл |
| `GET` | `/api/files/<id>/download/` | Скачать файл |

Файлы хранятся в `STORAGE_ROOT/<user_id>/<uuid>`. Оригинальное имя сохраняется
в БД и возвращается при скачивании.

Пример загрузки:

```bash
curl -b cookies.txt -c cookies.txt \
  -H "X-CSRFToken: <csrftoken>" \
  -F "file=@./README.md" \
  -F "comment=Пример загрузки" \
  http://127.0.0.1:8000/api/files/
```

Пример скачивания:

```bash
curl -b cookies.txt -o my-file http://127.0.0.1:8000/api/files/<id>/download/
```

### Публичные ссылки и администрирование

| Метод | Маршрут | Описание |
| ----- | ------- | -------- |
| `POST` | `/api/files/<id>/share/` | Создать публичный токен для файла |
| `GET` | `/api/shared/<token>/` | Скачать файл по токену (без авторизации) |
| `GET` | `/api/users/` | Список пользователей (только администратор) |
| `PATCH` | `/api/users/<id>/` | Изменить флаги пользователя (только администратор) |
| `DELETE` | `/api/users/<id>/` | Удалить пользователя (только администратор) |
| `GET` | `/api/files/?user_id=<id>` | Файлы выбранного пользователя (только администратор) |

Публичная ссылка не содержит имя пользователя, путь в хранилище или оригинальное
имя файла. Запрос к чужому файлу по `id` возвращает `404 Not Found` — чтобы
нумеруемые id не раскрывали существование чужих файлов. Обычный пользователь с
параметром `?user_id=` получает `403 Forbidden`.

Пример создания публичной ссылки:

```bash
curl -b cookies.txt -c cookies.txt \
  -H "X-CSRFToken: <csrftoken>" \
  -X POST \
  http://127.0.0.1:8000/api/files/<id>/share/
```

Публичное скачивание:

```bash
curl -o shared-file http://127.0.0.1:8000/api/shared/<token>/
```

### Маршруты SPA

| Маршрут | Описание |
| ------- | -------- |
| `/` | Главная страница |
| `/register` | Регистрация |
| `/login` | Вход |
| `/storage` | Список файлов пользователя |
| `/storage?user_id=<id>` | Просмотр файлов другого пользователя (только администратор) |
| `/admin` | Панель администратора |

---

## Деплой на Ubuntu VPS (reg.ru)

Инструкция рассчитана на Ubuntu 24.04. Замените `example.com`, `www.example.com`,
`203.0.113.10` и URL репозитория на реальные значения. DNS A-запись домена должна
указывать на VPS до получения TLS-сертификата.

### 1. Системные пакеты

```bash
sudo apt update
sudo apt install -y git nginx postgresql postgresql-contrib python3 python3-venv python3-pip nodejs npm certbot python3-certbot-nginx
```

### 2. База данных PostgreSQL

```bash
sudo -u postgres psql
```

В `psql`:

```sql
CREATE DATABASE my_cloud;
CREATE USER my_cloud WITH PASSWORD 'замените-на-пароль';
GRANT ALL PRIVILEGES ON DATABASE my_cloud TO my_cloud;
\c my_cloud
GRANT ALL ON SCHEMA public TO my_cloud;
\q
```

### 3. Пользователь системы и клонирование репозитория

```bash
sudo adduser --system --group --home /var/www/my-cloud --shell /bin/bash mycloud
sudo install -d -o mycloud -g www-data /var/www/my-cloud
sudo -u mycloud git clone https://github.com/<owner>/<repo>.git /var/www/my-cloud
```

### 4. Переменные окружения (продакшен)

Сгенерируйте секрет Django:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

Создайте и заполните `.env`:

```bash
sudo -u mycloud cp /var/www/my-cloud/deploy/env.production.example /var/www/my-cloud/.env
sudo -u mycloud nano /var/www/my-cloud/.env
```

Обязательные значения:

- `DJANGO_SECRET_KEY` — сгенерированный секрет, не коммитить в репозиторий.
- `DJANGO_DEBUG=False`
- `DJANGO_ALLOWED_HOSTS=example.com,www.example.com,203.0.113.10`
- `DJANGO_CSRF_TRUSTED_ORIGINS=https://example.com,https://www.example.com`
- `DATABASE_URL=postgres://my_cloud:замените-на-пароль@127.0.0.1:5432/my_cloud`
- `STORAGE_ROOT=/var/www/my-cloud/storage`
- `INITIAL_ADMIN_PASSWORD` — задайте только для первой миграции, затем уберите.

Если TLS ещё не выпущен, временно установите:

```env
DJANGO_SECURE_SSL_REDIRECT=False
DJANGO_SESSION_COOKIE_SECURE=False
DJANGO_CSRF_COOKIE_SECURE=False
```

После `certbot` верните все три значения в `True` и перезапустите gunicorn.
Начните с `DJANGO_SECURE_HSTS_SECONDS=3600` — увеличивайте только после того,
как HTTPS работает стабильно на всём домене.

### 5. Зависимости Python и npm

```bash
sudo -u mycloud python3 -m venv /var/www/my-cloud/backend/.venv
sudo -u mycloud /var/www/my-cloud/backend/.venv/bin/python -m pip install --upgrade pip
sudo -u mycloud /var/www/my-cloud/backend/.venv/bin/python -m pip install -r /var/www/my-cloud/backend/requirements.txt
sudo -u mycloud npm ci --prefix /var/www/my-cloud/frontend
```

### 6. Сборка, миграции и статика

```bash
sudo -u mycloud mkdir -p /var/www/my-cloud/storage /var/www/my-cloud/backend/staticfiles
sudo -u mycloud npm run build --prefix /var/www/my-cloud/frontend
sudo -u mycloud /var/www/my-cloud/backend/.venv/bin/python /var/www/my-cloud/backend/manage.py check
sudo -u mycloud /var/www/my-cloud/backend/.venv/bin/python /var/www/my-cloud/backend/manage.py migrate
sudo -u mycloud /var/www/my-cloud/backend/.venv/bin/python /var/www/my-cloud/backend/manage.py collectstatic --noinput
```

### 7. Сервис gunicorn (systemd)

```bash
sudo cp /var/www/my-cloud/deploy/systemd/my-cloud.service /etc/systemd/system/my-cloud.service
sudo systemctl daemon-reload
sudo systemctl enable --now my-cloud
sudo systemctl status my-cloud
```

Просмотр логов:

```bash
sudo journalctl -u my-cloud -n 100 --no-pager
```

### 8. nginx

```bash
sudo cp /var/www/my-cloud/deploy/nginx/my-cloud.conf /etc/nginx/sites-available/my-cloud
sudo nano /etc/nginx/sites-available/my-cloud
sudo ln -s /etc/nginx/sites-available/my-cloud /etc/nginx/sites-enabled/my-cloud
sudo nginx -t
sudo systemctl reload nginx
```

В файле `/etc/nginx/sites-available/my-cloud` замените:

```nginx
server_name example.com www.example.com;
```

на реальные доменные имена. Если домена нет — только IP:

```nginx
server_name 203.0.113.10;
```

### 9. Получение HTTPS-сертификата

```bash
sudo certbot --nginx -d example.com -d www.example.com
```

После выпуска сертификата включите безопасные флаги в `.env` и перезапустите:

```bash
sudo -u mycloud nano /var/www/my-cloud/.env
sudo systemctl restart my-cloud
sudo nginx -t
sudo systemctl reload nginx
```

### 10. Smoke-тест продакшена

```bash
curl -i https://example.com/api/health/
curl -i -c cookies.txt https://example.com/api/csrf/
curl -i https://example.com/
```

Ожидаемые результаты:

- `/api/health/` → `{"status":"ok"}`
- `/api/csrf/` → JSON + устанавливает cookie `csrftoken`
- `/` → React SPA
- Вход, регистрация, загрузка/скачивание файлов, публичные ссылки и панель
  администратора работают через браузер.

### 11. Обновление

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

### 12. Устранение неполадок

- **502 Bad Gateway** — проверьте `sudo systemctl status my-cloud` и
  `sudo journalctl -u my-cloud -n 100 --no-pager`.
- **Статика не грузится** — пересоберите фронтенд и запустите `collectstatic`,
  проверьте `/var/www/my-cloud/backend/staticfiles/`.
- **Ошибки CSRF** — убедитесь, что `DJANGO_CSRF_TRUSTED_ORIGINS` содержит точные
  `https://`-origins и браузерные запросы идут с того же домена.
- **Публичные ссылки не работают** — проверьте, что nginx проксирует
  `/api/shared/<token>/` в Django, а `STORAGE_ROOT` доступен для чтения
  системному пользователю `mycloud`.
