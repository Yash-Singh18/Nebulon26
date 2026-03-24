import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  signInWithGoogle,
  signOut,
  getSession,
  onAuthStateChange,
} from "../../services/supabase/auth";
import { getProfile } from "../../services/supabase/profiles";
import Navbar from "../../components/Navbar/Navbar";
import OnboardingModal from "../../components/OnboardingModal/OnboardingModal";
import "./Home.css";

const OFFERINGS = [
  {
    icon: "📊",
    title: "Track Expense",
    description:
      "Log and categorize every business expense automatically. Get real-time insights into where your money goes.",
    to: "/track-expense",
    color: "#3B82F6",
  },
  {
    icon: "👥",
    title: "Team Tracking",
    description:
      "Monitor team performance and operational KPIs in one unified view. Stay aligned on what matters.",
    to: "/team-tracking",
    color: "#22C55E",
  },
  {
    icon: "⚙️",
    title: "Services",
    description:
      "Connect your existing tools and automate financial workflows. Integrations built for small businesses.",
    to: "/services",
    color: "#F59E0B",
  },
  {
    icon: "⚖️",
    title: "SplitWise",
    description:
      "Split business expenses across team members or clients fairly and transparently with smart calculations.",
    to: "/splitwise",
    color: "#A855F7",
  },
];

const FAQS = [
  {
    q: "Is my data secure?",
    a: "Yes. All your data is encrypted in transit and at rest. We use Supabase's enterprise-grade infrastructure with row-level security so only you and your authorized team can access your business data.",
  },
  {
    q: "Can I track multiple businesses?",
    a: "Absolutely. Sirius is designed to support multiple business profiles under a single account. Switch between them seamlessly from your dashboard.",
  },
];

function FAQ({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq__item${open ? " faq__item--open" : ""}`}>
      <button className="faq__question" onClick={() => setOpen((v) => !v)}>
        <span>{q}</span>
        <span className="faq__chevron">{open ? "−" : "+"}</span>
      </button>
      {open && <p className="faq__answer">{a}</p>}
    </div>
  );
}

function Home() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function initSession() {
      const { session: s } = await getSession();
      if (!mounted) return;
      setSession(s);

      if (s) {
        const { profile: p } = await getProfile(s.user.id);
        if (!mounted) return;
        if (!p) setShowOnboarding(true);
        else setProfile(p);
      }

      setLoading(false);
    }

    initSession();

    const subscription = onAuthStateChange(async (s) => {
      if (!mounted) return;
      setSession(s);

      if (s) {
        const { profile: p } = await getProfile(s.user.id);
        if (!mounted) return;
        if (!p) setShowOnboarding(true);
        else setProfile(p);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogin() {
    await signInWithGoogle();
  }

  async function handleLogout() {
    await signOut();
    setSession(null);
    setProfile(null);
  }

  if (loading) {
    return (
      <div className="home__loader-wrap">
        <div className="home__loader" />
      </div>
    );
  }

  return (
    <div className="home">
      <Navbar
        session={session}
        profile={profile}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      {showOnboarding && session && (
        <OnboardingModal
          userId={session.user.id}
          onComplete={async () => {
            setShowOnboarding(false);
            const { profile: p } = await getProfile(session.user.id);
            setProfile(p);
          }}
        />
      )}

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero__glow hero__glow--1" />
        <div className="hero__glow hero__glow--2" />
        <div className="hero__content">
          <span className="hero__badge">AI-Powered · Built for SMEs</span>
          <h1 className="hero__title">
            AI Financial Copilot<br />for Small Businesses
          </h1>
          <p className="hero__subtitle">
            Track expenses, detect risks, and get smart recommendations in seconds
          </p>
          <div className="hero__actions">
            <button className="btn btn--primary" onClick={handleLogin}>
              Get Started
            </button>
            <button className="btn btn--secondary" onClick={handleLogin}>
              Start Tracking
            </button>
          </div>
        </div>
        <div className="hero__visual">
          <div className="hero__mockup">
            <div className="mockup__lights" />
            <div className="mockup__screen">
              <div className="mockup__header">
                <div className="mockup__dots">
                  <span /><span /><span />
                </div>
                <div className="mockup__user" />
              </div>
              <div className="mockup__body">
                <div className="mockup__card mockup__card--main">
                  <div className="mockup__pulse" />
                  <div className="mockup__card-text">Analyzing Financial Data...</div>
                  <div className="mockup__lines">
                    <div className="mockup__line" style={{ width: '85%' }} />
                    <div className="mockup__line" style={{ width: '65%' }} />
                    <div className="mockup__line" style={{ width: '40%' }} />
                  </div>
                </div>
                <div className="mockup__sidebar">
                  <div className="mockup__stat-box">
                    <span className="mockup__stat-label">Security</span>
                    <span className="mockup__stat-value text-green">99.9%</span>
                  </div>
                  <div className="mockup__stat-box">
                    <span className="mockup__stat-label">Insights</span>
                    <span className="mockup__stat-value text-blue">Active</span>
                  </div>
                </div>
              </div>
              <div className="mockup__floating-badge">
                ✨ AI Copilot Active
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Offerings ── */}
      <section className="offerings" id="offerings">
        <div className="section__container">
          <h2 className="section__title">Everything your business needs</h2>
          <p className="section__subtitle">
            One platform to track, analyse, and act on your financial data
          </p>
          <div className="offerings__grid">
            {OFFERINGS.map((o) => (
              <Link to={o.to} key={o.to} className="offering__card">
                <div
                  className="offering__icon-wrap"
                  style={{ "--card-color": o.color }}
                >
                  <span className="offering__icon">{o.icon}</span>
                </div>
                <h3 className="offering__title">{o.title}</h3>
                <p className="offering__desc">{o.description}</p>
                <span className="offering__cta">
                  Learn more <span className="offering__arrow">→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta">
        <div className="cta__glow" />
        <div className="section__container cta__inner">
          <h2 className="cta__title">Start managing your business smarter</h2>
          <p className="cta__subtitle">
            Join hundreds of small business owners who make data-driven decisions every day.
          </p>
          <button className="btn btn--primary btn--lg" onClick={() => navigate("/track-expense")}>
            👉 Go to Dashboard
          </button>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="faq" id="faq">
        <div className="section__container faq__container">
          <h2 className="section__title">Frequently Asked Questions</h2>
          <div className="faq__list">
            {FAQS.map((item) => (
              <FAQ key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer__top">
          <div className="footer__brand">
            <span className="footer__brand-icon">◈</span>
            <span className="footer__brand-name">SIRIUS</span>
          </div>
          <blockquote className="footer__quote">
            "We don't just track your finances. We help you grow them."
          </blockquote>
        </div>
        <div className="footer__divider" />
        <div className="footer__bottom">
          <span className="footer__copy">
            2026 SIRIUS // ALL RIGHTS RESERVED.
          </span>
          <div className="footer__socials">
            <a href="https://github.com/Yash-Singh18" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="footer__social-link">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
              </svg>
            </a>
            <a href="https://github.com/Yash-Singh18" target="_blank" rel="noopener noreferrer" aria-label="Twitter / X" className="footer__social-link">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href="https://github.com/Yash-Singh18" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="footer__social-link">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
            <a href="https://github.com/Yash-Singh18" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="footer__social-link">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;
