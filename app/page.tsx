"use client";

import { PublicLayout, usePublicLayout } from "@/app/components/layout/PublicLayout";
import Link from "next/link";
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
    description: "Understand how tuition is organised each semester, including laboratory allocations and key payment milestones.",
    action: "Learn About Fees",
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
  return (
    <PublicLayout>
      {/* ─── Hero Section ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        {/* Ambient backdrop: a slowly panning blueprint grid under three drifting
            colour blobs and the existing top vignette. Every colour is derived
            from --primary / --border / --foreground, so the whole thing retints
            itself for Latte and Mocha with no per-theme variant.

            The blobs carry negative animation-delays so they start out of phase
            with each other — same durations would otherwise make them visibly
            sync up on the loop. Those offsets are held at fixed *fractions* of
            each blob's duration (25% / 52% / 69%), so retiming an animation
            keeps the phase relationships intact. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div
            className="animate-pan-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]"
            style={{
              backgroundImage:
                "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              backgroundPosition: "0 0",
            }}
          />
          <div className="animate-drift-a absolute -top-32 left-[8%] size-[34rem] rounded-full bg-primary/10 blur-3xl [animation-delay:-2.75s]" />
          <div className="animate-drift-b absolute -bottom-40 right-[6%] size-[30rem] rounded-full bg-primary/10 blur-3xl [animation-delay:-7.33s]" />
          <div className="animate-drift-c absolute top-1/3 left-[42%] size-[26rem] rounded-full bg-primary/[0.07] blur-3xl [animation-delay:-12.46s]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--foreground)_8%,transparent),transparent_60%)]" />
        </div>
        <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
          <Badge
            variant="secondary"
            className="animate-in fade-in-0 zoom-in-95 gap-2 rounded-full px-4 py-1.5 duration-500"
          >
            <span
              className="size-1.5 animate-pulse rounded-full bg-primary"
              aria-hidden="true"
            />
            Far Western University • Central Academic Portal
          </Badge>

          {/* Flat colour in both themes. This was a from-foreground/via-primary/to-foreground
              gradient, which read as grey→blue in light mode but collapsed to three
              indistinguishable light greys in dark mode — hence "flat". */}
          <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl animate-in fade-in-0 slide-in-from-bottom-2 duration-700 delay-100">
            Unified Academic &amp; Campus Management Terminal
          </h1>

          <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg animate-in fade-in-0 slide-in-from-bottom-2 duration-700 delay-200">
            A secure digital workspace for students, faculty, and administration. Access semester
            courses, attendance logs, exam grading, syllabus blueprints, and campus notices.
          </p>

          <div className="mt-8 animate-in fade-in-0 slide-in-from-bottom-2 duration-700 delay-300">
            <HomeHeroCtas />
          </div>
        </div>
      </section>

      {/* ─── 4 Feature Cards ────────────────────────────────────────── */}
      <section className="px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {featureCards.map((card, i) => (
              <Link
                href={card.href}
                key={card.title}
                className="group animate-in fade-in-0 slide-in-from-bottom-2 duration-500 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                // Staggered entrance: each card starts 80ms after the last.
                style={{ animationDelay: `${400 + i * 80}ms` }}
              >
                <Card className="h-full transition-all duration-300 group-hover:-translate-y-1 group-hover:border-ring group-hover:bg-accent/5 group-hover:shadow-lg">
                  <CardContent className="flex h-full flex-col p-5">
                    <span className="mb-4 flex size-11 items-center justify-center rounded-lg bg-muted text-foreground transition-all duration-300 group-hover:scale-105 group-hover:bg-primary/10 group-hover:text-primary">
                      {card.icon}
                    </span>
                    <h2 className="mb-1.5 text-lg font-semibold text-foreground">{card.title}</h2>
                    <p className="mb-4 flex-1 text-pretty text-sm leading-relaxed text-muted-foreground">
                      {card.description}
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
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

    </PublicLayout>
  );
}
