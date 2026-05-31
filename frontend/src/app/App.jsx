import { Link, Route, Routes } from "react-router-dom";
import { BrowserRouter } from "react-router-dom";

function HomePage() {
  return (
    <main className="page">
      <section className="panel">
        <p className="eyebrow">Дипломный проект</p>
        <h1>My Cloud</h1>
        <p>
          Каркас приложения готовит единый Django-сервер, React SPA и общий
          клиент для будущих REST-запросов.
        </p>
        <div className="actions">
          <Link to="/login">Вход</Link>
          <Link to="/register">Регистрация</Link>
        </div>
      </section>
    </main>
  );
}

function PlaceholderPage({ title }) {
  return (
    <main className="page">
      <section className="panel">
        <h1>{title}</h1>
        <p>Эта страница будет реализована в следующих фазах.</p>
      </section>
    </main>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <div className="shell">
        <header className="topbar">
          <Link className="brand" to="/">
            My Cloud
          </Link>
          <nav aria-label="Главная навигация">
            <Link to="/login">Вход</Link>
            <Link to="/register">Регистрация</Link>
          </nav>
        </header>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<PlaceholderPage title="Вход" />} />
          <Route path="/register" element={<PlaceholderPage title="Регистрация" />} />
          <Route path="/storage" element={<PlaceholderPage title="Хранилище" />} />
          <Route path="/admin" element={<PlaceholderPage title="Администрирование" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
