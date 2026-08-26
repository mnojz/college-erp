"use client";

import Link from "next/link";
import { useState, FormEvent, createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import { PublicNavbar } from "./PublicNavbar";
import { useTheme } from "@/app/lib/useTheme";

type PublicLayoutContextValue = {
  openLogin: () => void;
};

const PublicLayoutContext = createContext<PublicLayoutContextValue | null>(null);

export function usePublicLayout(): PublicLayoutContextValue {
  const ctx = useContext(PublicLayoutContext);
  if (!ctx) {
    throw new Error("usePublicLayout must be used within <PublicLayout>");
  }
  return ctx;
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useTheme(); // ensure theme initialized

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function openLogin() {
    setShowLoginModal(true);
    setError("");
  }

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
    <PublicLayoutContext.Provider value={{ openLogin }}>
      <div className="home-modern-root">
        <PublicNavbar onSignInClick={openLogin} />

        <main>{children}</main>

        {/* Footer */}
        <footer className="home-modern-footer">
          <div className="home-footer-inner">
            <div className="home-footer-brand">
              <strong>College-ERP</strong>
              <span>Far Western University</span>
            </div>
            <div className="home-footer-links">
              <Link href="/public/course-structure">Curriculum</Link>
              <Link href="/public/fee-structure">Fees</Link>
              <Link href="/public/syllabus">Syllabus</Link>
              <Link href="/public/notices">Notices</Link>
            </div>
          </div>
        </footer>

        {/* Login Modal */}
        {showLoginModal && (
        <div className="login-modal-overlay">
          <div className="login-modal">
            <button
              className="login-modal-close"
              onClick={() => setShowLoginModal(false)}
            >
              &times;
            </button>
            <h2>Sign In to College-ERP</h2>
            <form onSubmit={handleSignIn}>
              <div className="login-input-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="login-input-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="login-show-password"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <div className="login-options">
                <label>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    disabled={loading}
                  />
                  Remember me
                </label>
              </div>
              {error && <p className="login-error">{error}</p>}
              <button type="submit" className="login-submit-btn" disabled={loading}>
                {loading ? "Signing In..." : "Sign In"}
              </button>
            </form>
            <div className="login-demo-accounts">
              <p>Demo accounts:</p>
              <button
                type="button"
                onClick={() => fillDemo("student@fwu.edu.np", "student1234")}
                disabled={loading}
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => fillDemo("teacher@fwu.edu.np", "teacher1234")}
                disabled={loading}
              >
                Teacher
              </button>
              <button
                type="button"
                onClick={() => fillDemo("admin@fwu.edu.np", "admin1234")}
                disabled={loading}
              >
                Admin
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </PublicLayoutContext.Provider>
  );
}
