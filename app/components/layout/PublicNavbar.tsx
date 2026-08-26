import Link from "next/link";
import { ThemeToggle } from "@/app/components/common/ThemeToggle";

export function PublicNavbar({
  onSignInClick,
}: { onSignInClick: () => void }) {
  return (
    <header className="home-nav">
      <div className="home-nav-container">
        <Link href="/" className="home-nav-brand">
          <span className="home-brand-icon">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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
          <Link href="/public/course-structure" className="home-nav-link">
            Curriculum
          </Link>
          <Link href="/public/fee-structure" className="home-nav-link">
            Fees
          </Link>
          <Link href="/public/syllabus" className="home-nav-link">
            Syllabus
          </Link>
          <Link href="/public/notices" className="home-nav-link">
            Notices
          </Link>
        </nav>

        <div className="home-nav-actions">
          <ThemeToggle />
          <button
            type="button"
            className="home-btn-signin"
            onClick={onSignInClick}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
              <polyline points="10 17 15 12 10 7"></polyline>
              <line x1="15" y1="12" x2="3" y2="12"></line>
            </svg>
            <span>Sign In</span>
          </button>
        </div>
      </div>
    </header>
  );
}
