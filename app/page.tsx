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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
    icon: <IconBook2 size={24} aria-hidden="true" />,
  },
  {
    title: "Fee Structure",
    description: "Inspect official semester tuition schedules, laboratory allocations, and institutional milestone deadlines.",
    action: "Check Fee Schedules",
    href: "/public/fee-structure",
    icon: <IconCreditCard size={24} aria-hidden="true" />,
  },
  {
    title: "Course Syllabuses",
    description: "Review detailed lecture blueprints, reference textbooks, core objectives, and evaluation frameworks.",
    action: "Browse Syllabuses",
    href: "/public/syllabus",
    icon: <IconBooks size={24} aria-hidden="true" />,
  },
  {
    title: "Campus Notices",
    description: "Stay informed with real-time examination alerts, academic calendar releases, and university bulletins.",
    action: "Open Notice Bulletins",
    href: "/public/notices",
    icon: <IconBell size={24} aria-hidden="true" />,
  },
];

function HomeHeroCtas() {
  const { openLogin } = usePublicLayout();

  return (
    <div className="flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
      <Button size="lg" className="w-full sm:w-auto" onClick={openLogin}>
        Sign In to Portal
        <IconArrowRight size={16} aria-hidden="true" />
      </Button>
      <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
        <Link href="/public/course-structure">Browse Programs</Link>
      </Button>
    </div>
  );
}

export default function Home() {
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
      <section className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-24">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(9,9,11,0.06),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(250,250,250,0.08),transparent_60%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
          <Badge variant="secondary" className="gap-2 rounded-full px-4 py-1.5">
            <span
              className="size-1.5 animate-pulse rounded-full bg-primary"
              aria-hidden="true"
            />
            Far Western University • Central Academic Portal
          </Badge>

          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Unified Academic &amp; Campus{" "}
            <span className="bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent dark:from-foreground dark:via-muted-foreground dark:to-foreground">
              Management Terminal
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            A secure digital workspace for students, faculty, and administration. Access semester
            courses, attendance logs, exam grading, syllabus blueprints, and campus notices.
          </p>

          <div className="mt-8">
            <HomeHeroCtas />
          </div>
        </div>
      </section>

      {/* ─── 4 Feature Cards ────────────────────────────────────────── */}
      <section className="px-4 pb-16 sm:px-6 sm:pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {featureCards.map((card) => (
              <Link
                href={card.href}
                key={card.title}
                className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full transition-colors group-hover:border-ring group-hover:bg-accent/5">
                  <CardContent className="flex h-full flex-col p-5">
                    <span className="mb-4 flex size-11 items-center justify-center rounded-lg bg-muted text-foreground">
                      {card.icon}
                    </span>
                    <h2 className="mb-1.5 text-base font-semibold">{card.title}</h2>
                    <p className="mb-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {card.description}
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm font-medium">
                      {card.action}
                      <IconArrowRight
                        size={15}
                        className="transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Announcements ──────────────────────────────────────────── */}
      {announcements.length > 0 && (
        <section className="px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  Recent Announcements
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Stay up-to-date with the latest news and updates from the university.
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/public/notices">
                  View All Notices
                  <IconArrowRight size={15} aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
