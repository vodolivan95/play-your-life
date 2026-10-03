import { useEffect, useState } from "react";
import type { Page, Quest, SphereId } from "./types";
import { useGame } from "./state/store";
import { Home } from "./pages/Home";
import { Quests } from "./pages/Quests";
import { Goals } from "./pages/Goals";
import { Stats } from "./pages/Stats";
import { Profile } from "./pages/Profile";
import { SphereView } from "./pages/Sphere";
import { Achievements, SkillTree } from "./pages/Development";
const nav: { page: Page; icon: string; label: string }[] = [
  { page: "home", icon: "⌂", label: "Главная" },
  { page: "goals", icon: "◎", label: "Цели" },
  { page: "quests", icon: "☑", label: "Квесты" },
  { page: "stats", icon: "▥", label: "Статистика" },
  { page: "profile", icon: "♙", label: "Профиль" },
];
export default function App() {
  const { state, dispatch, storageError } = useGame();
  const [page, setPage] = useState<Page>("home");
  const [sphere, setSphere] = useState<SphereId>("english");
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(id);
  }, [toast]);
  function navigate(p: Page) {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function complete(q: Quest) {
    if (q.completedAt) return;
    dispatch({ type: "complete", id: q.id });
    setToast(`✦ +${q.xp} XP · Квест выполнен!`);
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("home");
          }}
        >
          <span className="brand-mark">
            P<span>✦</span>
          </span>
          <div>
            PLAY YOUR LIFE<small>Your Life. Your Game.</small>
          </div>
        </a>
        <p className="sidebar-caption">ТВОЁ ПРОСТРАНСТВО</p>
        <nav>
          {nav.map((n) => (
            <button
              key={n.page}
              className={page === n.page ? "active" : ""}
              onClick={() => navigate(n.page)}
            >
              <span>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            ✦<strong>Прокачивай жизнь</strong>
            <p>
              Один маленький шаг
              <br />
              каждый день.
            </p>
          </div>
          <span>PLAY YOUR LIFE · V0.1</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <strong>PLAY YOUR LIFE</strong>
            <small>Your Life. Your Game.</small>
          </div>
          <span className="desktop-motto">Your Life. Your Game.</span>
          <button className="profile-chip" onClick={() => navigate("profile")}>
            <span>🧑‍🚀</span> {state.name} <b>⌄</b>
          </button>
        </header>
        <main>
          {storageError && (
            <p className="error" role="alert">
              {storageError}
            </p>
          )}
          {page === "home" && (
            <Home
              state={state}
              navigate={navigate}
              openSphere={(id) => {
                setSphere(id);
                navigate("sphere");
              }}
              complete={complete}
            />
          )}
          {page === "quests" && <Quests state={state} complete={complete} />}
          {page === "goals" && <Goals state={state} />}
          {page === "stats" && <Stats state={state} />}
          {page === "profile" && <Profile state={state} navigate={navigate} />}
          {page === "sphere" && (
            <SphereView
              state={state}
              id={sphere}
              complete={complete}
              back={() => navigate("home")}
            />
          )}
          {page === "tree" && <SkillTree state={state} />}
          {page === "achievements" && <Achievements state={state} />}
        </main>
      </div>
      <nav className="bottom-nav">
        {nav.map((n) => (
          <button
            key={n.page}
            className={page === n.page ? "active" : ""}
            onClick={() => navigate(n.page)}
          >
            <span>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status" key={toast}>
          {toast}
        </div>
      )}
    </div>
  );
}
