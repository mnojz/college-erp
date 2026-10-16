"use client";

import { useState } from "react";
import Link from "next/link";
import {
  IconArrowRight,
  IconBell,
  IconBook2,
  IconBooks,
  IconCheck,
  IconCreditCard,
  IconSchool,
  IconSparkles,
  IconShieldCheck,
  IconUserCheck,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PublicLayout, usePublicLayout } from "@/app/components/layout/PublicLayout";
import { HeroCommandCenter } from "@/app/components/home/HeroCommandCenter";
import { InteractiveBackground } from "@/app/components/home/InteractiveBackground";
import { SpotlightCard } from "@/app/components/home/SpotlightCard";
import { CustomCursor } from "@/app/components/home/CustomCursor";

const publicGateways = [
  {
    title: "Course Curriculum",
    description: "Explore semester-wise subject mappings, credit allocations, and full degree roadmaps across academic faculties.",
    action: "View Degree Structure",
    href: "/public/course-structure",
    icon: <IconBook2 size={24} aria-hidden="true" />,
    tag: "Curriculum Catalog",
    gradient: "from-blue-600 to-indigo-600",
    glow: "group-hover:border-blue-500/50",
  },
  {
    title: "Fee Structure",
    description: "Clear and transparent breakdown of semester tuition, laboratory dues, and university examination fees.",
    action: "Review Fee Schedule",
    href: "/public/fee-structure",
    icon: <IconCreditCard size={24} aria-hidden="true" />,
    tag: "Finance & Accounts",
    gradient: "from-emerald-600 to-teal-600",
    glow: "group-hover:border-emerald-500/50",
  },
  {
    title: "Official Syllabuses",
    description: "Access official lecture unit blueprints, prescribed textbooks, learning outcomes, and assessment rubrics.",
    action: "Browse Syllabuses",
    href: "/public/syllabus",
    icon: <IconBooks size={24} aria-hidden="true" />,
    tag: "Academic Blueprints",
    gradient: "from-purple-600 to-pink-600",
    glow: "group-hover:border-purple-500/50",
  },
  {
    title: "Campus Bulletins",
    description: "Stay ahead with real-time examination schedules, semester calendar publications, and university circulations.",
    action: "Read University Notices",
    href: "/public/notices",
    icon: <IconBell size={24} aria-hidden="true" />,
    tag: "Live Broadcasts",
    gradient: "from-amber-600 to-orange-600",
    glow: "group-hover:border-amber-500/50",
  },
];

const stakeholderData = {
  students: {
    role: "Students",
    title: "A Unified Academic Cockpit for Every Student",
    description: "Track your semester progression, class routines, and performance metrics from day one through graduation.",
    badge: "Student Workspace",
    accentColor: "text-blue-500",
    stats: {
      primary: "98.4%",
      label: "Real-time Attendance Sync",
      secondary: "Instant",
      subLabel: "Result & Grade Publishing",
    },
    capabilities: [
      "Live attendance meter with early exam eligibility advisories",
      "Interactive weekly lecture routines and venue timetable changes",
      "Official semester grade reports and continuous GPA tracking",
      "Instant access to departmental syllabuses and teacher handouts",
    ],
    highlightSnippet: {
      tag: "Active Semester IV",
      title: "Bachelor of Information Technology",
      detail: "All semester requirements satisfied • Eligible for Examinations",
    },
  },
  faculty: {
    role: "Teachers",
    title: "Frictionless Roll Call & Academic Delivery",
    description: "Spend less time on manual bookkeeping and more time inspiring students with modern academic tools.",
    badge: "Teacher Workspace",
    accentColor: "text-emerald-500",
    stats: {
      primary: "< 30s",
      label: "Average Roll Call Time",
      secondary: "100%",
      subLabel: "Verified Session Logs",
    },
    capabilities: [
      "Rapid touch roll call with instant bulk attendance toggles",
      "Auditable session logging with timestamped lecture topics",
      "Internal assessment entry and continuous grading submissions",
      "Digital syllabus coverage tracking and study material distribution",
    ],
    highlightSnippet: {
      tag: "Department of Computer Science",
      title: "Teacher Workspace",
      detail: "Daily sessions logged and verified for Spring Term 2026",
    },
  },
  admin: {
    role: "Administration",
    title: "Institutional Governance & Curriculum Control",
    description: "Centralized oversight for campus operations, student onboarding, examination cycles, and university circulars.",
    badge: "Admin Suite",
    accentColor: "text-purple-500",
    stats: {
      primary: "Paperless",
      label: "Curriculum & Exam Records",
      secondary: "Role-Based",
      subLabel: "Enterprise Security",
    },
    capabilities: [
      "Multi-program curriculum management across departments and degrees",
      "Secure student admission workflows with profile edit review & approval",
      "Examination schedule generation, seat planning, and results release",
      "Campus-wide announcements with document attachment distribution",
    ],
    highlightSnippet: {
      tag: "University Governance",
      title: "Far Western University Central Office",
      detail: "Zero-trust role permissions and complete administrative auditing",
    },
  },
} as const;

function HomeContent() {
  const { openLogin } = usePublicLayout();
  const [activeTab, setActiveTab] = useState<"students" | "faculty" | "admin">("students");

  const currentStakeholder = stakeholderData[activeTab];

  return (
    <div className="relative overflow-hidden">
      {/* ── Custom Dynamic Cursor (Tiny Dot + Lagging Breathing Aurora Ring) ── */}
      <CustomCursor />

      {/* ── Interactive Mouse-Reactive Background & Constellation ─────────── */}
      <InteractiveBackground />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="animate-pan-grid absolute inset-0 opacity-30 dark:opacity-20 mask-[radial-gradient(ellipse_at_center,black,transparent_75%)]"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            backgroundPosition: "0 0",
          }}
        />
        <div className="animate-drift-a absolute -top-40 left-1/2 -translate-x-1/2 size-168 rounded-full bg-primary/12 dark:bg-primary/20 blur-3xl" />
        <div className="animate-drift-b absolute top-96 -left-20 size-128 rounded-full bg-sky-500/10 dark:bg-sky-400/15 blur-3xl [animation-delay:-4s]" />
        <div className="animate-drift-c absolute top-240 -right-20 size-136 rounded-full bg-purple-500/10 dark:bg-purple-400/15 blur-3xl [animation-delay:-9s]" />
      </div>

      {/* ── 1. Hero Section: Grand Centered Editorial Marquee ───────────────── */}
      <section className="relative px-4 pt-12 pb-16 sm:px-6 sm:pt-18 sm:pb-24 lg:pt-24 lg:pb-32">
        <div className="mx-auto max-w-5xl text-center space-y-6">
          {/* Master Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-foreground leading-[1.08] max-w-4xl mx-auto">
            Where Academic Ambition Meets{" "}
            <span className="bg-linear-to-r from-blue-600 via-indigo-500 to-sky-500 bg-clip-text text-transparent dark:from-blue-400 dark:via-indigo-300 dark:to-sky-300">
              Effortless Operations.
            </span>
          </h1>

          {/* Subtitle Description */}
          <p className="max-w-2xl mx-auto text-base sm:text-lg lg:text-xl text-muted-foreground leading-relaxed font-normal">
            A unified digital campus platform harmonizing student schedules, teacher roll calls,
            curriculum roadmaps, and administrative governance in one intuitive workspace.
          </p>

          {/* Action Callouts */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
            <Button
              size="lg"
              onClick={openLogin}
              className="w-full sm:w-auto rounded-2xl h-12 px-7 text-sm font-semibold shadow-xl shadow-primary/25 hover:shadow-primary/35 transition-all duration-300 gap-2 cursor-pointer"
            >
              Sign In to Portal
              <IconArrowRight size={17} aria-hidden="true" />
            </Button>

            <Button
              size="lg"
              variant="outline"
              asChild
              className="w-full sm:w-auto rounded-2xl h-12 px-7 text-sm font-medium border-border/80 bg-card/60 backdrop-blur-md hover:bg-muted/70 transition-colors shadow-xs"
            >
              <Link href="/public/course-structure" className="inline-flex items-center gap-2">
                <IconSchool size={17} className="text-primary" />
                Explore Academic Directory
              </Link>
            </Button>
          </div>

          {/* Quick Jump Shortcuts Strip */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Dedicated Portals:</span>
            <button
              type="button"
              onClick={openLogin}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-muted/50 hover:bg-muted border border-border/60 transition-colors cursor-pointer text-foreground"
            >
              <IconUserCheck size={14} className="text-blue-500" />
              Student Desk
            </button>
            <button
              type="button"
              onClick={openLogin}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-muted/50 hover:bg-muted border border-border/60 transition-colors cursor-pointer text-foreground"
            >
              <IconSchool size={14} className="text-emerald-500" />
              Teacher Workspace
            </button>
            <button
              type="button"
              onClick={openLogin}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-muted/50 hover:bg-muted border border-border/60 transition-colors cursor-pointer text-foreground"
            >
              <IconShieldCheck size={14} className="text-purple-500" />
              Administrative Suite
            </button>
          </div>
        </div>

        {/* ── Hero Showcase: The Interactive Campus Command Center ───────── */}
        <div className="mt-12 sm:mt-16">
          <HeroCommandCenter />
        </div>
      </section>

      {/* ── 2. Public Academic Gateways (Bento Grid) ────────────────────────── */}
      <section className="relative px-4 py-16 sm:px-6 sm:py-24 border-t border-border/70 bg-muted/20">
        <div className="mx-auto max-w-7xl space-y-12">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <Badge className="text-xs font-semibold px-3.5 py-1 border-0 bg-primary/15 text-primary">
              Open Campus Gateways
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
              Core Academic Portals &amp; Resources
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Transparent, public access to official university programs, syllabuses, fee frameworks,
              and live institutional notices.
            </p>
          </div>

          {/* 4 Gateway Cards with Interactive Mouse Spotlight */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {publicGateways.map((card) => (
              <SpotlightCard
                key={card.title}
                className="rounded-3xl h-full"
                spotlightColor="color-mix(in oklab, var(--primary) 20%, transparent)"
              >
                <Link
                  href={card.href}
                  className={`group relative flex flex-col justify-between rounded-3xl border border-border/70 bg-card p-6 sm:p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${card.glow} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary h-full`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <span
                        className={`flex size-12 items-center justify-center rounded-2xl bg-linear-to-br ${card.gradient} text-white shadow-md transition-transform duration-300 group-hover:scale-110`}
                      >
                        {card.icon}
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted px-2.5 py-1 rounded-md border border-border/50">
                        {card.tag}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                      {card.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {card.description}
                    </p>
                  </div>

                  <div className="pt-6 mt-6 border-t border-border/50 flex items-center justify-between text-xs font-bold text-primary">
                    <span>{card.action}</span>
                    <IconArrowRight
                      size={16}
                      className="transition-transform duration-300 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </div>
                </Link>
              </SpotlightCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Stakeholder Experience: Tailored for Every User ─────────────── */}
      <section className="relative px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-7xl space-y-12">
          {/* Section Heading */}
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <Badge className="text-xs font-semibold px-3.5 py-1 border-0 bg-primary/15 text-primary">
              Role-Specific Workspaces
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
              Engineered for Every University Stakeholder
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Tailored capabilities delivering streamlined workflows, role-based visibility, and zero
              unnecessary friction.
            </p>

            {/* Role Switcher Tabs */}
            <div className="pt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("students")}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === "students"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-card text-muted-foreground hover:text-foreground border border-border/70"
                }`}
              >
                For Students
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("faculty")}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === "faculty"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-card text-muted-foreground hover:text-foreground border border-border/70"
                }`}
              >
                For Teachers
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("admin")}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === "admin"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-card text-muted-foreground hover:text-foreground border border-border/70"
                }`}
              >
                For Administration
              </button>
            </div>
          </div>

          {/* Role Feature Showcase Card with Interactive Mouse Spotlight */}
          <SpotlightCard
            className="max-w-4xl mx-auto rounded-3xl"
            spotlightColor="color-mix(in oklab, var(--primary) 14%, transparent)"
          >
            <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-10 shadow-xl transition-all">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                {/* Left Column: Capabilities & Action */}
                <div className="md:col-span-7 space-y-5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-xs font-semibold">
                    <span className={`font-bold ${currentStakeholder.accentColor}`}>●</span>
                    <span>{currentStakeholder.badge}</span>
                  </div>

                  <h3 className="text-2xl font-black text-foreground tracking-tight">
                    {currentStakeholder.title}
                  </h3>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {currentStakeholder.description}
                  </p>

                  <ul className="space-y-3 pt-1">
                    {currentStakeholder.capabilities.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-xs sm:text-sm text-foreground">
                        <span className="size-5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                          <IconCheck size={12} />
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-2">
                    <Button
                      onClick={openLogin}
                      className="rounded-xl h-11 px-6 text-xs sm:text-sm font-semibold gap-2 cursor-pointer shadow-md shadow-primary/20"
                    >
                      Enter {currentStakeholder.role} Workspace
                      <IconArrowRight size={15} />
                    </Button>
                  </div>
                </div>

                {/* Right Column: Key Metrics & Status Card */}
                <div className="md:col-span-5 space-y-4">
                  <div className="p-5 rounded-2xl bg-muted/40 border border-border/70 space-y-4">
                    {/* Primary Metric */}
                    <div className="p-4 rounded-xl bg-card border border-border/60 shadow-xs">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        Platform Metric
                      </span>
                      <div className="text-3xl font-black text-foreground tracking-tight">
                        {currentStakeholder.stats.primary}
                      </div>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        {currentStakeholder.stats.label}
                      </p>
                    </div>

                    {/* Secondary Metric */}
                    <div className="p-4 rounded-xl bg-card border border-border/60 shadow-xs">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        Operational Guarantee
                      </span>
                      <div className="text-xl font-extrabold text-foreground tracking-tight">
                        {currentStakeholder.stats.secondary}
                      </div>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        {currentStakeholder.stats.subLabel}
                      </p>
                    </div>

                    {/* Highlight Snippet */}
                    <div className="p-4 rounded-xl bg-card border border-border/60 shadow-xs space-y-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${currentStakeholder.accentColor}`}>
                        {currentStakeholder.highlightSnippet.tag}
                      </span>
                      <div className="text-xs font-bold text-foreground">
                        {currentStakeholder.highlightSnippet.title}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {currentStakeholder.highlightSnippet.detail}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SpotlightCard>
        </div>
      </section>

      {/* ── 4. Institutional Infrastructure & Numbers Strip ────────────────── */}
      <section className="relative px-4 py-16 border-y border-border/70 bg-card/60 backdrop-blur-md">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                100%
              </div>
              <div className="text-xs sm:text-sm font-semibold text-foreground">
                Paperless Operations
              </div>
              <div className="text-[11px] text-muted-foreground">
                Digital roll call &amp; syllabuses
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                Zero
              </div>
              <div className="text-xs sm:text-sm font-semibold text-foreground">
                Attendance Discrepancies
              </div>
              <div className="text-[11px] text-muted-foreground">
                Timestamped subject logs
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                Role-Based
              </div>
              <div className="text-xs sm:text-sm font-semibold text-foreground">
                Zero-Trust Governance
              </div>
              <div className="text-[11px] text-muted-foreground">
                Strict administrative oversight
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                24/7
              </div>
              <div className="text-xs sm:text-sm font-semibold text-foreground">
                Campus Portal Uptime
              </div>
              <div className="text-[11px] text-muted-foreground">
                Always available on any device
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Bottom Conversion Banner ────────────────────────────────────── */}
      <section className="relative px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl rounded-3xl bg-linear-to-br from-primary/15 via-card to-card border border-primary/20 p-8 sm:p-14 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 size-56 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 size-56 rounded-full bg-sky-500/15 blur-3xl pointer-events-none" />

          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <IconSparkles size={14} />
            Institutional Single Sign-On
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground max-w-2xl mx-auto leading-tight">
            Ready to Connect to Your Digital Campus?
          </h2>

          <p className="max-w-xl mx-auto text-sm sm:text-base text-muted-foreground leading-relaxed">
            Sign in with your university credentials to access lecture routines, attendance records,
            examination marks, curriculum documents, and campus bulletins.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-3">
            <Button
              size="lg"
              onClick={openLogin}
              className="w-full sm:w-auto rounded-2xl h-12 px-8 font-semibold shadow-xl shadow-primary/25 cursor-pointer gap-2"
            >
              Sign In to Your Account
              <IconArrowRight size={17} />
            </Button>

            <Button
              size="lg"
              variant="outline"
              asChild
              className="w-full sm:w-auto rounded-2xl h-12 px-8 font-medium border-border/80 hover:bg-muted/60"
            >
              <Link href="/public/syllabus">Browse Public Syllabuses</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  return (
    <PublicLayout>
      <HomeContent />
    </PublicLayout>
  );
}
