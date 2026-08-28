"use client";

import { useEffect, useState } from "react";
import { PublicLayout, usePublicLayout } from "@/app/components/layout/PublicLayout";
import Link from "next/link";
import {
  NoticeDetailData,
  NoticeDetailModal,
} from "@/app/components/common/NoticeDetailModal";
import { NoticePostCard } from "@/app/components/common/NoticePostCard";
import {
  IconArrowRight,
  IconBell,
  IconBook2,
  IconBooks,
  IconCreditCard,
} from "@tabler/icons-react";

type Announcement = {
  id: string;
  title: string;
  body: string;
  publishedAt: string | null;
  createdAt: string;
  author: { firstName: string; lastName: string } | null;
  attachmentFileName: string | null;
  attachmentMimeType: string | null;
  attachmentSize: number | null;
};

/** Raw announcement row → client-safe notice shape for cards/modal. */
function toNotice(a: Announcement): NoticeDetailData {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    publishedAt: a.publishedAt,
    createdAt: a.createdAt,
    author: a.author,
    attachment:
      a.attachmentFileName && a.attachmentSize !== null
        ? {
            fileName: a.attachmentFileName,
            mimeType: a.attachmentMimeType ?? "application/octet-stream",
            size: a.attachmentSize,
          }
        : null,
  };
}

const featureCards = [
  {
    title: "Course Curriculum",
    description: "Explore semester-wise subject mappings, credit loads, and degree roadmaps across academic departments.",
    action: "View Course Structure",
    href: "/public/course-structure",
    color: "#0284c7",
    bg: "rgba(2, 132, 199, 0.08)",
    icon: <IconBook2 size={24} aria-hidden="true" />,
  },
  {
    title: "Fee Structure",
    description: "Inspect official semester tuition schedules, laboratory allocations, and institutional milestone deadlines.",
    action: "Check Fee Schedules",
    href: "/public/fee-structure",
    color: "#d97706",
    bg: "rgba(217, 119, 6, 0.08)",
    icon: <IconCreditCard size={24} aria-hidden="true" />,
  },
  {
    title: "Course Syllabuses",
    description: "Review detailed lecture blueprints, reference textbooks, core objectives, and evaluation frameworks.",
    action: "Browse Syllabuses",
    href: "/public/syllabus",
    color: "#059669",
    bg: "rgba(5, 150, 105, 0.08)",
    icon: <IconBooks size={24} aria-hidden="true" />,
  },
  {
    title: "Campus Notices",
    description: "Stay informed with real-time examination alerts, academic calendar releases, and university bulletins.",
    action: "Open Notice Bulletins",
    href: "/public/notices",
    color: "#7c3aed",
    bg: "rgba(124, 58, 237, 0.08)",
    icon: <IconBell size={24} aria-hidden="true" />,
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
        <IconArrowRight size={16} aria-hidden="true" />
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
  const [selectedNotice, setSelectedNotice] = useState<NoticeDetailData | null>(null);

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
                  <IconArrowRight size={15} aria-hidden="true" />
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
                <IconArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <div className="home-notices-grid">
              {announcements.map((announcement) => (
                <NoticePostCard
                  key={announcement.id}
                  notice={toNotice(announcement)}
                  onOpen={() => setSelectedNotice(toNotice(announcement))}
                  compact
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {selectedNotice && (
        <NoticeDetailModal notice={selectedNotice} onClose={() => setSelectedNotice(null)} />
      )}
    </PublicLayout>
  );
}
