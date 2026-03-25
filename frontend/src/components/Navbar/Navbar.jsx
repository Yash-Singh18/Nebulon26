import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./Navbar.css";

const NAV_LINKS = [
  { label: "Track Expense", to: "/track-expense" },
  { label: "Team Tracking", to: "/team-tracking" },
  { label: "Services", to: "/services" },
  { label: "Consultant", to: "/sme-expert" },
];

function Navbar({ session, profile, onLogin, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "dark";
    const stored = window.localStorage.getItem("sirius-theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("sirius-theme", theme);
  }, [theme]);

  const displayName = profile?.username
    ? `@${profile.username}`
    : session?.user?.user_metadata?.full_name || session?.user?.email?.split("@")[0] || null;

  return (
    <nav className="navbar">
      <div className="navbar__inner">
        <Link to="/" className="navbar__brand">
          <span className="navbar__brand-icon">◈</span>
          <span className="navbar__brand-name">Sirius</span>
        </Link>

        <ul className={`navbar__links${menuOpen ? " navbar__links--open" : ""}`}>
          {NAV_LINKS.map((link) => (
            <li key={link.label}>
              {link.href ? (
                <a
                  href={link.href}
                  className="navbar__link"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  to={link.to}
                  className="navbar__link"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              )}
            </li>
          ))}
        </ul>

        <div className="navbar__actions">
          <button
            className="navbar__theme-toggle"
            onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? "☀" : "🌙"}
          </button>
          {session ? (
            <>
              <span className="navbar__username">{displayName}</span>
              <button className="navbar__btn navbar__btn--logout" onClick={onLogout}>
                Sign Out
              </button>
            </>
          ) : (
            <button className="navbar__btn navbar__btn--login" onClick={onLogin}>
              Login
            </button>
          )}
          <button
            className="navbar__hamburger"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
