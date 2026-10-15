"use client";

import Link from "next/link";
import { useState, createContext, useContext } from "react";
import { Logo } from "@/app/components/common/Logo";
import { PublicNavbar } from "./PublicNavbar";
import { LoginDialog } from "@/app/components/public/LoginDialog";
import { ForgotPasswordDialog } from "@/app/components/public/ForgotPasswordDialog";
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
  useTheme(); // ensure theme initialized

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [email, setEmail] = useState("");

  function openLogin() {
    setShowLoginModal(true);
  }

  return (
    <PublicLayoutContext.Provider value={{ openLogin }}>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <PublicNavbar onSignInClick={openLogin} />

        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="border-t bg-muted/40">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
            <div className="flex items-center gap-2.5">
              <Logo className="size-7.5 text-primary shrink-0" />
              <div className="leading-tight">
                <strong className="block text-sm font-semibold">College-ERP</strong>
                <span className="text-xs text-muted-foreground">Far Western University</span>
              </div>
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm" aria-label="Footer">
              <Link href="/public/course-structure" className="text-muted-foreground transition-colors hover:text-foreground">
                Curriculum
              </Link>
              <Link href="/public/fee-structure" className="text-muted-foreground transition-colors hover:text-foreground">
                Fees
              </Link>
              <Link href="/public/syllabus" className="text-muted-foreground transition-colors hover:text-foreground">
                Syllabus
              </Link>
              <Link href="/public/notices" className="text-muted-foreground transition-colors hover:text-foreground">
                Notices
              </Link>
            </nav>
          </div>
        </footer>

        {/* Redesigned Modern Login Dialog */}
        <LoginDialog
          open={showLoginModal}
          onOpenChange={setShowLoginModal}
          onForgotPassword={(currentEmail) => {
            setEmail(currentEmail);
            setShowLoginModal(false);
            setShowForgotPassword(true);
          }}
        />

        {/* Conditionally mounted so each open starts with fresh dialog state
            (and the login-form email prefills via initialEmail). */}
        {showForgotPassword && (
          <ForgotPasswordDialog
            open
            onOpenChange={setShowForgotPassword}
            initialEmail={email}
            onBackToSignIn={() => {
              setShowForgotPassword(false);
              openLogin();
            }}
          />
        )}
      </div>
    </PublicLayoutContext.Provider>
  );
}
