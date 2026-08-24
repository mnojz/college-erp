"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { homeAssets } from "@/app/components/home/assets";

const cards = [
  {
    title: "Course Structure",
    text: "View current course distributions, credit assignments, major lists, and structural graduation paths designed by departments.",
    action: "Check Course Map",
    href: "/public/course-structure",
    icon: homeAssets.course,
  },
  {
    title: "Fee Structure",
    text: "Access published fee schedules, semester milestones, and clear institutional payment information.",
    action: "View Statement",
    href: "/public/fee-structure",
    icon: homeAssets.fee,
  },
  {
    title: "Syllabuses",
    text: "Browse official syllabus sheets, curriculum outlines, and detailed course parameters authorized by FWU departments.",
    action: "Browse Syllabus",
    href: "/public/syllabus",
    icon: homeAssets.syllabus,
  },
  {
    title: "Notice",
    text: "Examine high-importance announcements, exam schedules, emergency notifications, and student organization messages.",
    action: "Open Bulletins",
    href: "/public/notices",
    icon: homeAssets.notice,
  },
];

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
        setError(result.error ?? "Unable to sign in");
        return;
      }
      router.push(result.user.role === "ADMIN" ? "/admin" : result.user.role === "TEACHER" ? "/teacher/attendance" : "/student");
      router.refresh();
    } catch {
      setError("Unable to reach the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="home-shell">
      <aside className="home-login-panel">
        <div className="home-brand">
          <span>
            <img src={homeAssets.graduationCap} alt="" width={24} height={24} />
          </span>
          <div>
            <strong>College-ERP</strong>
            <small>FWU-Engineering</small>
          </div>
        </div>
        <form className="home-login-form" onSubmit={signIn}>
          <div>
            <h1>Welcome back</h1>
            <p>Sign in to manage your courses, view grades, and check daily schedules.</p>
          </div>
          <label>
            Institutional Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="student@fwu.edu.np"
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <img src={homeAssets.eye} alt="" width={16} height={16} />
              </button>
            </div>
          </label>
          <div className="home-form-actions">
            <label className="remember-option">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Remember this device
            </label>
            <button className="forgot-button" type="button">
              Forgot Password?
            </button>
          </div>
          {error && (
            <p className="home-form-error" role="alert">
              {error}
            </p>
          )}
          <button className="home-signin-button" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In to Dashboard"}
          </button>
        </form>
        <div className="home-support">
          <strong>Need ERP Support?</strong>
          <p>Contact campus helpdesk for student enrollment, registration, or technical portal queries.</p>
          <a href="mailto:helpdesk@college.edu">Contact Helpdesk</a>
        </div>
      </aside>
      <section className="home-public-panel">
        <header className="home-public-header">
          <span>Academic Year 2026</span>
          <a href="mailto:helpdesk@college.edu">
            <img src={homeAssets.bookOpen} alt="" width={14} height={14} /> ERP Manual &amp; Guidelines
          </a>
        </header>
        <div className="home-hero">
          <h2>FWU Unified Student Terminal</h2>
          <p>
            Access structured course blueprints, real-time notices, syllabus outlines, and institutional logs quickly from one central environment.
          </p>
        </div>
        <div className="home-feature-grid">
          {cards.map((card) => (
            <Link className="home-feature-card" href={card.href} key={card.title}>
              <div className="home-feature-heading">
                <span>
                  <img src={card.icon} alt="" width={20} height={20} />
                </span>
                <h3>{card.title}</h3>
              </div>
              <p>{card.text}</p>
              <strong>
                {card.action} <img src={homeAssets.arrow} alt="" width={14} height={14} />
              </strong>
            </Link>
          ))}
        </div>
        <footer className="home-footer">
          <span>© 2026 Far Western University — Institute of Engineering. All rights reserved.</span>
          <span>
            <a href="#terms">Terms of Service</a>
            <a href="#privacy">Privacy Code</a>
          </span>
        </footer>
      </section>
    </main>
  );
}
