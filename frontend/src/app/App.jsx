import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  clearAuthError,
  fetchCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from "../features/auth/authSlice";
import {
  validateLoginForm,
  validateRegisterForm,
} from "../features/auth/validation.cjs";

function HomePage() {
  const user = useSelector((state) => state.auth.user);

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Дипломный проект</p>
        <h1>My Cloud</h1>
        <p>
          Облачное хранилище для загрузки файлов, управления доступом и
          администрирования пользователей через единый Django и React сервер.
        </p>
        <div className="actions">
          {user ? (
            <Link className="button primary" to="/storage">
              Перейти в хранилище
            </Link>
          ) : (
            <>
              <Link className="button primary" to="/login">
                Вход
              </Link>
              <Link className="button secondary" to="/register">
                Регистрация
              </Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { action, error, fieldErrors, status } = useSelector((state) => state.auth);
  const [values, setValues] = useState({ username: "", password: "" });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const localErrors = validateLoginForm(values);
  const isSubmitting = status === "loading" && action === "login";
  const notice = location.state?.notice;
  const from = location.state?.from?.pathname || "/storage";

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((currentValues) => ({ ...currentValues, [name]: value }));
    if (error || Object.keys(fieldErrors).length) {
      dispatch(clearAuthError());
    }
  }

  function getFieldError(field) {
    return (submitted || touched[field] ? localErrors[field] : null) || fieldErrors[field];
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);

    if (Object.keys(localErrors).length) {
      return;
    }

    const payload = {
      username: values.username.trim(),
      password: values.password,
    };

    try {
      await dispatch(loginUser(payload)).unwrap();
      navigate(from, { replace: true });
    } catch {
      // Store state renders the API error.
    }
  }

  return (
    <AuthLayout
      title="Вход"
      subtitle="Введите логин и пароль, чтобы открыть свое хранилище."
    >
      {notice ? <p className="form-alert success">{notice}</p> : null}
      {error ? <p className="form-alert error">{error}</p> : null}
      <form className="auth-form" noValidate onSubmit={handleSubmit}>
        <TextField
          autoComplete="username"
          error={getFieldError("username")}
          hint="Логин из латинских букв и цифр, первый символ - буква."
          label="Логин"
          name="username"
          onBlur={() => setTouched((current) => ({ ...current, username: true }))}
          onChange={handleChange}
          value={values.username}
        />
        <TextField
          autoComplete="current-password"
          error={getFieldError("password")}
          hint="Пароль должен совпадать с указанным при регистрации."
          label="Пароль"
          name="password"
          onBlur={() => setTouched((current) => ({ ...current, password: true }))}
          onChange={handleChange}
          type="password"
          value={values.password}
        />
        <button className="button primary full-width" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Входим..." : "Войти"}
        </button>
      </form>
      <p className="switch-link">
        Нет аккаунта? <Link to="/register">Зарегистрируйтесь</Link>
      </p>
    </AuthLayout>
  );
}

function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { action, error, fieldErrors, status } = useSelector((state) => state.auth);
  const [values, setValues] = useState({
    username: "",
    full_name: "",
    email: "",
    password: "",
  });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const localErrors = validateRegisterForm(values);
  const isSubmitting = status === "loading" && action === "register";

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((currentValues) => ({ ...currentValues, [name]: value }));
    if (error || Object.keys(fieldErrors).length) {
      dispatch(clearAuthError());
    }
  }

  function getFieldError(field) {
    return (submitted || touched[field] ? localErrors[field] : null) || fieldErrors[field];
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);

    if (Object.keys(localErrors).length) {
      return;
    }

    const payload = {
      username: values.username.trim(),
      full_name: values.full_name.trim(),
      email: values.email.trim(),
      password: values.password,
    };

    try {
      await dispatch(registerUser(payload)).unwrap();
      navigate("/login", {
        replace: true,
        state: { notice: "Аккаунт создан. Войдите с новым логином и паролем." },
      });
    } catch {
      // Store state renders the API error.
    }
  }

  return (
    <AuthLayout
      title="Регистрация"
      subtitle="Создайте учетную запись для личного файлового хранилища."
    >
      {error ? <p className="form-alert error">{error}</p> : null}
      <form className="auth-form" noValidate onSubmit={handleSubmit}>
        <TextField
          autoComplete="username"
          error={getFieldError("username")}
          hint="4-20 символов: латинские буквы и цифры, первый символ - буква."
          label="Логин"
          name="username"
          onBlur={() => setTouched((current) => ({ ...current, username: true }))}
          onChange={handleChange}
          value={values.username}
        />
        <TextField
          autoComplete="name"
          error={getFieldError("full_name")}
          hint="Укажите имя, которое будет видно в интерфейсе."
          label="Полное имя"
          name="full_name"
          onBlur={() => setTouched((current) => ({ ...current, full_name: true }))}
          onChange={handleChange}
          value={values.full_name}
        />
        <TextField
          autoComplete="email"
          error={getFieldError("email")}
          hint="Например, user@example.com."
          label="Email"
          name="email"
          onBlur={() => setTouched((current) => ({ ...current, email: true }))}
          onChange={handleChange}
          type="email"
          value={values.email}
        />
        <TextField
          autoComplete="new-password"
          error={getFieldError("password")}
          hint="Минимум 6 символов, заглавная буква, цифра и спецсимвол."
          label="Пароль"
          name="password"
          onBlur={() => setTouched((current) => ({ ...current, password: true }))}
          onChange={handleChange}
          type="password"
          value={values.password}
        />
        <button className="button primary full-width" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Создаем аккаунт..." : "Зарегистрироваться"}
        </button>
      </form>
      <p className="switch-link">
        Уже есть аккаунт? <Link to="/login">Войдите</Link>
      </p>
    </AuthLayout>
  );
}

function AuthLayout({ children, subtitle, title }) {
  return (
    <main className="page auth-page">
      <section className="auth-card">
        <p className="eyebrow">My Cloud</p>
        <h1>{title}</h1>
        <p className="auth-subtitle">{subtitle}</p>
        {children}
      </section>
    </main>
  );
}

function TextField({
  autoComplete,
  error,
  hint,
  label,
  name,
  onBlur,
  onChange,
  type = "text",
  value,
}) {
  const inputId = `${name}-input`;
  const hintId = `${name}-hint`;
  const errorId = `${name}-error`;

  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <input
        aria-describedby={`${hintId}${error ? ` ${errorId}` : ""}`}
        aria-invalid={error ? "true" : "false"}
        autoComplete={autoComplete}
        id={inputId}
        name={name}
        onBlur={onBlur}
        onChange={onChange}
        type={type}
        value={value}
      />
      <span className="field-hint" id={hintId}>
        {hint}
      </span>
      {error ? (
        <span className="field-error" id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

function PlaceholderPage({ children, title }) {
  return (
    <main className="page">
      <section className="panel">
        <h1>{title}</h1>
        <p>{children}</p>
      </section>
    </main>
  );
}

function ProtectedRoute({ children, requireAdmin = false }) {
  const location = useLocation();
  const { initialized, user } = useSelector((state) => state.auth);

  if (!initialized) {
    return <LoadingPage />;
  }

  if (!user) {
    return (
      <Navigate
        replace
        state={{ from: location, notice: "Войдите, чтобы открыть эту страницу." }}
        to="/login"
      />
    );
  }

  if (requireAdmin && !user.is_admin) {
    return <Navigate replace to="/storage" />;
  }

  return children;
}

function GuestRoute({ children }) {
  const { initialized, user } = useSelector((state) => state.auth);

  if (!initialized) {
    return <LoadingPage />;
  }

  if (user) {
    return <Navigate replace to="/storage" />;
  }

  return children;
}

function LoadingPage() {
  return (
    <main className="page">
      <section className="panel">
        <p className="eyebrow">Сессия</p>
        <h1>Проверяем вход</h1>
        <p>Подождите несколько секунд.</p>
      </section>
    </main>
  );
}

function Header() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { action, initialized, user } = useSelector((state) => state.auth);
  const isLoggingOut = action === "logout";

  async function handleLogout() {
    try {
      await dispatch(logoutUser()).unwrap();
      navigate("/", { replace: true });
    } catch {
      // Store state keeps the error available for the current page.
    }
  }

  return (
    <header className="topbar">
      <Link className="brand" to="/">
        My Cloud
      </Link>
      <nav aria-label="Главная навигация">
        {!initialized ? (
          <span className="nav-status">Проверяем сессию...</span>
        ) : user ? (
          <>
            <NavLink to="/storage">Хранилище</NavLink>
            {user.is_admin ? <NavLink to="/admin">Админка</NavLink> : null}
            <span className="nav-user">{user.full_name || user.username}</span>
            <button className="nav-button" disabled={isLoggingOut} onClick={handleLogout} type="button">
              {isLoggingOut ? "Выходим..." : "Выход"}
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login">Вход</NavLink>
            <NavLink to="/register">Регистрация</NavLink>
          </>
        )}
      </nav>
    </header>
  );
}

function AppRoutes() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchCurrentUser());
  }, [dispatch]);

  return (
    <div className="shell">
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />
        <Route
          path="/register"
          element={
            <GuestRoute>
              <RegisterPage />
            </GuestRoute>
          }
        />
        <Route
          path="/storage"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="Хранилище">
                Управление файлами будет реализовано в фазе 5.
              </PlaceholderPage>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <PlaceholderPage title="Администрирование">
                Управление пользователями будет реализовано в фазе 5.
              </PlaceholderPage>
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
