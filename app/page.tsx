"use client";

import { useEffect, useState } from "react";
import { PublicLayout, usePublicLayout } from "@/app/components/layout/PublicLayout";
import Link from "next/link";

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

function HomeHeroCtas() {
  const { openLogin } = usePublicLayout();

  return (
    <div className="home-hero-actions gap-2 flex">
      <button
        type="button"
        className="home-hero-btn-primary"
        onClick={openLogin}
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
  );
}

export default function Home() {
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

  return (
    <PublicLayout>
      {/* ─── Hero Section ───────────────────────────────────────────── */}
      <section className="home-hero-section">
        <div className="home-hero-container">
          <div className="home-hero-badge">
            <span className="badge-pulse"></span>
            <span>Far Western University • Central Academic Portal</span>
          </div>

          <h1 className="home-hero-title">
            Unified Academic &amp; Campus <br className="hidden-mobile" />
            <span className="hero-gradient-text">Management Terminal</span>
          </h1>

          <p className="home-hero-subtitle">
            A secure digital workspace for students, faculty, and administration. Access semester courses, attendance logs, exam grading, syllabus blueprints, and campus notices.
          </p>

          <HomeHeroCtas />
        </div>
      </section>

      {/* ─── 4 Feature Cards ────────────────────────────────────────── */}
      <section className="home-cards-section">
        <div className="home-cards-container">
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

      {/* ─── Announcements ──────────────────────────────────────────── */}
      {announcements.length > 0 && (
        <section className="home-notices-section">
          <div className="home-notices-container">
            <div className="home-section-header">
              <div>
                <h2>Recent Announcements</h2>
                <p>Stay up-to-date with the latest news and updates from the university.</p>
              </div>
              <Link href="/public/notices" className="home-link-all">
                View All Notices
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </Link>
            </div>
            <div className="home-notices-grid">
              {announcements.map((announcement) => (
                <div key={announcement.id} className="home-notice-card">
                  {announcement.publishedAt && (
                    <span className="home-notice-date">
                      {new Date(announcement.publishedAt).toLocaleDateString()}
                    </span>
                  )}
                  <h3>{announcement.title}</h3>
                  <p>{announcement.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </PublicLayout>
  );
}
