import { useState } from "react";
import { Link } from "react-router-dom";
import "./Navbar.css";

const NAV_LINKS = [
  { label: "Track Expense", to: "/track-expense" },
  { label: "Team Tracking", to: "/team-tracking" },
  { label: "Services", to: "/services" },
  { label: "SplitWise", to: "/splitwise" },
];

function Navbar({ session, profile, onLogin, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);

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
            <li key={link.to}>
              <Link
                to={link.to}
                className="navbar__link"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="navbar__actions">
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
