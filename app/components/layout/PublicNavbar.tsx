import Link from "next/link";
import { IconLogin, IconSchool } from "@tabler/icons-react";
import { ThemeToggle } from "@/app/components/common/ThemeToggle";

export function PublicNavbar({
  onSignInClick,
}: { onSignInClick: () => void }) {
  return (
    <header className="home-nav">
      <div className="home-nav-container">
        <Link href="/" className="home-nav-brand">
          <span className="home-brand-icon">
            <IconSchool size={22} />
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
            <IconLogin size={16} />
            <span>Sign In</span>
          </button>
        </div>
      </div>
    </header>
  );
}
