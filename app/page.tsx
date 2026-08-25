"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/app/components/common/ThemeToggle";
import { useTheme } from "@/app/lib/useTheme";

type Announcement = {
  id: string;
  title: string;
  body: string;
  publishedAt: string | null;
  createdAt: string;
};

const featureCards = [
  {
    title: "Course Curriculum",
    description: "Explore semester-wise subject mappings, credit loads, and degree roadmaps across academic departments.",
    action: "View Course Structure",
    href: "/public/course-structure",
    color: "#0284c7",
    bg: "rgba(2, 132, 199, 0.08)",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        <line x1="8" y1="6" x2="16" y2="6"></line>
        <line x1="8" y1="10" x2="14" y2="10"></line>
      </svg>
    ),
  },
  {
    title: "Fee Structure",
    description: "Inspect official semester tuition schedules, laboratory allocations, and institutional milestone deadlines.",
    action: "Check Fee Schedules",
    href: "/public/fee-structure",
    color: "#d97706",
    bg: "rgba(217, 119, 6, 0.08)",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2"></rect>
        <line x1="2" y1="10" x2="22" y2="10"></line>
        <circle cx="7" cy="15" r="1"></circle>
      </svg>
    ),
  },
  {
    title: "Course Syllabuses",
    description: "Review detailed lecture blueprints, reference textbooks, core objectives, and evaluation frameworks.",
    action: "Browse Syllabuses",
    href: "/public/syllabus",
    color: "#059669",
    bg: "rgba(5, 150, 105, 0.08)",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
    ),
  },
  {
    title: "Campus Notices",
    description: "Stay informed with real-time examination alerts, academic calendar releases, and university bulletins.",
    action: "Open Notice Bulletins",
    href: "/public/notices",
    color: "#7c3aed",
    bg: "rgba(124, 58, 237, 0.08)",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
    ),
  },
];

export default function Home() {
  const router = useRouter();
  useTheme(); // ensure theme initialized

  // Login Modal State
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Announcements State
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    fetch("/api/announcements")
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setAnnouncements((data.announcements ?? []).slice(0, 3));
        }
      })
      .catch(() => {});
  }, []);

  async function handleSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Invalid email or password");
        return;
      }
      setShowLoginModal(false);
      router.push(result.user.role === "ADMIN" ? "/admin" : result.user.role === "TEACHER" ? "/teacher" : "/student");
      router.refresh();
    } catch {
      setError("Unable to reach the server");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(demoEmail: string, demoPass: string) {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError("");
  }

  return (
    <div className="home-modern-root">
      {/* ─── Top Navbar ─────────────────────────────────────────────── */}
      <header className="home-nav">
        <div className="home-nav-container">
          <Link href="/" className="home-nav-brand">
            <span className="home-brand-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
              </svg>
            </span>
            <div className="home-brand-text">
              <strong>College-ERP</strong>
              <small>Far Western University</small>
            </div>
          </Link>

          <nav className="home-nav-links">
            <Link href="/public/course-structure">Curriculum</Link>
            <Link href="/public/fee-structure">Fees</Link>
            <Link href="/public/syllabus">Syllabus</Link>
            <Link href="/public/notices">Notices</Link>
          </nav>

          <div className="home-nav-actions">
            <ThemeToggle />
            <button
              type="button"
              className="home-btn-signin"
              onClick={() => {
                setShowLoginModal(true);
                setError("");
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                <polyline points="10 17 15 12 10 7"></polyline>
                <line x1="15" y1="12" x2="3" y2="12"></line>
              </svg>
              <span>Sign In</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── Hero Section ───────────────────────────────────────────── */}
      <section className="home-hero-section">
        <div className="home-hero-container">
          <div className="home-hero-badge">
            <span className="badge-pulse"></span>
            <span>Far Western University · Central Academic Portal</span>
          </div>

          <h1 className="home-hero-title">
            Unified Academic &amp; Campus <br className="hidden-mobile" />
            <span className="hero-gradient-text">Management Terminal</span>
          </h1>

          <p className="home-hero-subtitle">
            A secure digital workspace for students, faculty, and administration. Access semester courses, attendance logs, exam grading, syllabus blueprints, and campus notices.
          </p>

          <div className="home-hero-ctas">
            <button
              type="button"
              className="home-hero-btn-primary"
              onClick={() => {
                setShowLoginModal(true);
                setError("");
              }}
            >
              <span>Sign In to Portal</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>

            <Link href="/public/course-structure" className="home-hero-btn-secondary">
              <span>Browse Programs</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 4 Feature Cards ────────────────────────────────────────── */}
      <section className="home-cards-section">
        <div className="home-section-container">
          <div className="home-cards-grid">
            {featureCards.map((card) => (
              <Link href={card.href} key={card.title} className="home-card">
                <div
                  className="home-card-icon-wrap"
                  style={{ color: card.color, background: card.bg }}
                >
                  {card.icon}
                </div>
                <h2 className="home-card-title">{card.title}</h2>
                <p className="home-card-desc">{card.description}</p>
                <div className="home-card-action" style={{ color: card.color }}>
                  <span>{card.action}</span>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Recent Bulletins Section ───────────────────────────────── */}
      {announcements.length > 0 && (
        <section className="home-notices-section">
          <div className="home-section-container">
            <div className="home-notices-header">
              <div>
                <span className="badge badge-green">LATEST UPDATES</span>
                <h2 style={{ margin: "8px 0 0", fontSize: "22px", fontWeight: 700 }}>
                  Recent Campus Notices &amp; Announcements
                </h2>
              </div>
              <Link href="/public/notices" className="home-link-all">
                <span>View all bulletins</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </Link>
            </div>

            <div className="home-notices-grid">
              {announcements.map((item) => (
                <article key={item.id} className="home-notice-card">
                  <span className="home-notice-date">
                    {item.publishedAt
                      ? new Date(item.publishedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : new Date(item.createdAt).toLocaleDateString()}
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.body.slice(0, 140)}...</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Minimal Institutional Footer ──────────────────────────── */}
      <footer className="home-modern-footer">
        <div className="home-section-container">
          <div className="home-footer-inner">
            <div className="home-footer-brand">
              <strong>Far Western University</strong>
              <small>Central Academic College-ERP Terminal · Session 2026</small>
            </div>
            <div className="home-footer-links">
              <Link href="/public/course-structure">Courses</Link>
              <Link href="/public/fee-structure">Fees</Link>
              <Link href="/public/syllabus">Syllabus</Link>
              <Link href="/public/notices">Notices</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ─── Login Modal Dialog ─────────────────────────────────────── */}
      {showLoginModal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLoginModal(false);
          }}
        >
          <div className="modal-box home-login-modal" role="dialog" aria-modal="true">
            <button
              className="modal-close"
              type="button"
              onClick={() => setShowLoginModal(false)}
              aria-label="Close"
            >
              ×
            </button>

            <div className="home-modal-header">
              <span className="home-brand-icon" style={{ width: 44, height: 44, margin: "0 auto 12px" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                  <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
                </svg>
              </span>
              <h2>Sign In to College-ERP</h2>
              <p>Enter your institutional credentials to access your dashboard.</p>
            </div>

            {/* Quick Demo Credentials */}
            <div className="home-demo-chips">
              <small style={{ color: "var(--ink-soft)", fontWeight: 600 }}>Quick demo:</small>
              <button
                type="button"
                className="chip-btn"
                onClick={() => fillDemo("admin@fwu.edu.np", "admin1234")}
              >
                Admin
              </button>
              <button
                type="button"
                className="chip-btn"
                onClick={() => fillDemo("teacher@fwu.edu.np", "teacher1234")}
              >
                Teacher
              </button>
              <button
                type="button"
                className="chip-btn"
                onClick={() => fillDemo("student@fwu.edu.np", "student1234")}
              >
                Student
              </button>
            </div>

            <form className="modal-form" onSubmit={handleSignIn}>
              <label>
                Institutional Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@fwu.edu.np"
                  autoComplete="email"
                  required
                />
              </label>

              <label>
                Account Password
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    style={{ paddingRight: "40px" }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: 0,
                      background: "transparent",
                      color: "var(--ink-soft)",
                      cursor: "pointer",
                    }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
              </label>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", textTransform: "none", fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    style={{ width: "auto", margin: 0 }}
                  />
                  Remember login
                </label>
              </div>

              {error && (
                <p style={{ margin: 0, padding: "10px", borderRadius: "8px", background: "rgba(220, 38, 38, 0.08)", color: "#dc2626", fontSize: "13px" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="btn-primary"
                style={{ width: "100%", padding: "12px", fontSize: "14px", marginTop: "6px" }}
                disabled={loading}
              >
                {loading ? "Signing in…" : "Sign In to Dashboard"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
