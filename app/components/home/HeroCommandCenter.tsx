"use client";

import { useState, useRef } from "react";
import {
  IconCalendar,
  IconClock,
  IconMapPin,
  IconUserCheck,
  IconBell,
  IconAward,
  IconFileDownload,
  IconTrendingUp,
  IconChevronRight,
  IconSparkles,
  IconCircleCheck,
} from "@tabler/icons-react";

type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri";

interface LectureSession {
  time: string;
  title: string;
  code: string;
  room: string;
  instructor: string;
  status: "In Progress" | "Up Next" | "Upcoming" | "Completed";
  progressPct?: number;
}

const scheduleByDay: Record<DayKey, LectureSession[]> = {
  Mon: [
    {
      time: "08:30 - 10:00 AM",
      title: "Algorithms & Complexity",
      code: "CS-401",
      room: "Hall 102",
      instructor: "Prof. K. Bhandari",
      status: "Completed",
    },
    {
      time: "10:15 - 11:45 AM",
      title: "Computer Networks & Protocols",
      code: "CS-402",
      room: "Lab 3A",
      instructor: "Er. P. Adhikari",
      status: "Completed",
    },
    {
      time: "12:45 - 02:15 PM",
      title: "Discrete Mathematics",
      code: "MATH-401",
      room: "Room 205",
      instructor: "Dr. S. Karki",
      status: "Upcoming",
    },
  ],
  Tue: [
    {
      time: "09:00 - 10:30 AM",
      title: "Operating Systems Architecture",
      code: "CS-403",
      room: "Lab 4B",
      instructor: "Dr. A. Thapa",
      status: "Completed",
    },
    {
      time: "10:45 - 12:15 PM",
      title: "Database Engineering & SQL",
      code: "CS-404",
      room: "Lab 2B",
      instructor: "Dr. R. Sharma",
      status: "Upcoming",
    },
    {
      time: "01:00 - 02:30 PM",
      title: "Technical Writing & Seminar",
      code: "ENG-401",
      room: "Seminar Room 1",
      instructor: "Prof. N. Shrestha",
      status: "Upcoming",
    },
  ],
  Wed: [
    {
      time: "08:30 - 10:00 AM",
      title: "Software Engineering Methodologies",
      code: "CS-405",
      room: "Room 304",
      instructor: "Er. M. Bhatta",
      status: "Completed",
    },
    {
      time: "10:15 - 11:45 AM",
      title: "Web Technologies & APIs",
      code: "CS-406",
      room: "Lab 1A",
      instructor: "Er. S. Joshi",
      status: "Completed",
    },
    {
      time: "12:30 - 02:00 PM",
      title: "Probability & Statistics",
      code: "STAT-401",
      room: "Room 201",
      instructor: "Dr. D. Rawal",
      status: "Upcoming",
    },
  ],
  Thu: [
    {
      time: "09:00 - 10:30 AM",
      title: "Database Management Systems",
      code: "CS-401",
      room: "Lab 3B (Science Wing)",
      instructor: "Dr. R. Sharma",
      status: "In Progress",
      progressPct: 65,
    },
    {
      time: "10:45 - 12:15 PM",
      title: "Computer Networks & Security",
      code: "CS-402",
      room: "Auditorium 204",
      instructor: "Er. P. Adhikari",
      status: "Up Next",
    },
    {
      time: "01:00 - 02:30 PM",
      title: "Web Engineering Project Lab",
      code: "CS-405",
      room: "Software Center",
      instructor: "Prof. S. Joshi",
      status: "Upcoming",
    },
  ],
  Fri: [
    {
      time: "09:00 - 10:30 AM",
      title: "Operating Systems Practical Lab",
      code: "CS-403L",
      room: "Systems Lab 2",
      instructor: "Dr. A. Thapa",
      status: "Upcoming",
    },
    {
      time: "10:45 - 12:15 PM",
      title: "Seminar & Departmental Forum",
      code: "CS-409",
      room: "Main Auditorium",
      instructor: "Department Faculty",
      status: "Upcoming",
    },
    {
      time: "01:00 - 02:30 PM",
      title: "Faculty Office & Mentorship Hours",
      code: "OFFICE",
      room: "Faculty Lounge",
      instructor: "Academic Advisors",
      status: "Upcoming",
    },
  ],
};

const liveNotices = [
  {
    tag: "EXAM NOTICE",
    tagColor: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
    title: "Spring 2026 Semester Final Examination Routine Published",
    date: "Today, 10:30 AM",
    hasDownload: true,
  },
  {
    tag: "SYLLABUS",
    tagColor: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    title: "Updated Curriculum Syllabuses for B.Sc. CSIT & BIT Approved",
    date: "Yesterday",
    hasDownload: false,
  },
  {
    tag: "ACADEMIC",
    tagColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    title: "Capstone Project Synopsis & Guide Allocation List Announced",
    date: "Oct 12",
    hasDownload: true,
  },
];

export function HeroCommandCenter() {
  const [selectedDay, setSelectedDay] = useState<DayKey>("Thu");
  const [activeSessionIdx, setActiveSessionIdx] = useState(0);

  const shellRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, mouseX: 0, mouseY: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!shellRef.current) return;
    const rect = shellRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -2.8;
    const rotateY = ((x - centerX) / centerX) * 2.8;
    setTilt({ rotateX, rotateY, mouseX: x, mouseY: y });
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ rotateX: 0, rotateY: 0, mouseX: 0, mouseY: 0 });
  };

  const days: DayKey[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const currentLectures = scheduleByDay[selectedDay];

  return (
    <div className="relative mx-auto w-full max-w-6xl">
      {/* Radiant Background Aura */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-4 rounded-3xl bg-linear-to-b from-primary/15 via-sky-500/10 to-transparent blur-3xl opacity-70"
      />

      {/* Main Glass Shell with Interactive 3D Perspective Tilt */}
      <div
        ref={shellRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: isHovered
            ? `perspective(1200px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) scale3d(1.008, 1.008, 1.008)`
            : "perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
          transition: isHovered ? "transform 0.12s ease-out" : "transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
        className="relative rounded-3xl border border-border/80 bg-card/90 backdrop-blur-xl shadow-2xl overflow-hidden will-change-transform"
      >
        {/* Dynamic Interactive Cursor Spotlight on the Command Shell */}
        {isHovered && (
          <div
            className="pointer-events-none absolute -inset-px transition-opacity duration-300 z-20"
            style={{
              background: `radial-gradient(650px circle at ${tilt.mouseX}px ${tilt.mouseY}px, color-mix(in oklab, var(--primary) 12%, transparent), transparent 75%)`,
            }}
          />
        )}
        {/* Top Operational Bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-border/70 px-4 py-3 sm:px-6 bg-muted/30 gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-rose-500/80" />
              <span className="size-3 rounded-full bg-amber-500/80" />
              <span className="size-3 rounded-full bg-emerald-500/80" />
            </div>
            <div className="h-3.5 w-px bg-border/80" />
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-foreground">
                Far Western University
              </span>
              <span className="text-xs text-muted-foreground hidden sm:inline">•</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Academic Command Center
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
              </span>
              Campus Term Online
            </div>
            <span className="text-[11px] font-mono text-muted-foreground hidden md:inline">
              Spring 2026
            </span>
          </div>
        </div>

        {/* Bento Grid Content Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border/70">
          {/* Left Column: Interactive Lecture Routine & Attendance (7 cols) */}
          <div className="lg:col-span-7 p-5 sm:p-7 space-y-5">
            {/* Day Selector Strip & Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                  <IconCalendar size={18} className="text-primary" />
                  Live Academic Routine
                </h3>
                <p className="text-xs text-muted-foreground">
                  Select a weekday to view scheduled department lectures and labs
                </p>
              </div>

              {/* Day Switcher Buttons */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 border border-border/70 self-start sm:self-auto">
                {days.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      setSelectedDay(day);
                      setActiveSessionIdx(0);
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      selectedDay === day
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {day}
                    {day === "Thu" && (
                      <span className="ml-1 size-1.5 rounded-full inline-block bg-emerald-400 align-middle" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Lecture Cards List */}
            <div className="space-y-3">
              {currentLectures.map((lecture, idx) => {
                const isSelected = activeSessionIdx === idx;
                return (
                  <button
                    key={lecture.code + lecture.time}
                    type="button"
                    onClick={() => setActiveSessionIdx(idx)}
                    className={`w-full text-left p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? "border-primary/60 bg-primary/5 shadow-md ring-1 ring-primary/30"
                        : "border-border/60 bg-card/60 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">
                            {lecture.code}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-foreground">
                            {lecture.title}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <IconClock size={13} />
                            {lecture.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <IconMapPin size={13} />
                            {lecture.room}
                          </span>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1">
                        {lecture.status === "In Progress" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live Session
                          </span>
                        )}
                        {lecture.status === "Up Next" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                            Up Next
                          </span>
                        )}
                        {lecture.status === "Upcoming" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted text-muted-foreground border border-border/60">
                            Scheduled
                          </span>
                        )}
                        {lecture.status === "Completed" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted text-muted-foreground border border-border/60">
                            <IconCircleCheck size={11} className="text-emerald-500" />
                            Completed
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {lecture.instructor}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar for Active Lecture */}
                    {lecture.status === "In Progress" && typeof lecture.progressPct === "number" && (
                      <div className="mt-3 pt-2.5 border-t border-border/50">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                          <span>Lecture Elapsed (45 min remaining)</span>
                          <span className="font-semibold text-foreground font-mono">
                            {lecture.progressPct}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${lecture.progressPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Live Student Performance Strip */}
            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <IconUserCheck size={18} />
                </span>
                <div>
                  <div className="text-xs font-bold text-foreground">
                    Overall Attendance Meter
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    34 of 37 logged sessions • Well above 75% exam rule
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                  91.8%
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  Eligible
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Broadcasts, Exam Notice & Campus Health (5 cols) */}
          <div className="lg:col-span-5 p-5 sm:p-7 space-y-5 bg-muted/15 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                  <IconBell size={18} className="text-primary" />
                  Campus Broadcast Feed
                </h3>
                <span className="text-[11px] font-medium text-muted-foreground">
                  Official Circulars
                </span>
              </div>

              {/* Notice Cards */}
              <div className="space-y-3">
                {liveNotices.map((notice) => (
                  <div
                    key={notice.title}
                    className="p-3.5 rounded-2xl border border-border/70 bg-card/80 hover:border-primary/40 hover:bg-card transition-all space-y-2 shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${notice.tagColor}`}
                      >
                        {notice.tag}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {notice.date}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-foreground leading-snug">
                      {notice.title}
                    </h4>

                    {notice.hasDownload && (
                      <div className="pt-1 flex items-center justify-between text-[11px] text-primary font-medium">
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <IconFileDownload size={13} />
                          Official PDF attached
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-xs hover:underline cursor-pointer">
                          View
                          <IconChevronRight size={12} />
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Insight Widget: Cumulative Semester GPA */}
            <div className="pt-3">
              <div className="p-4 rounded-2xl bg-linear-to-br from-card to-muted/40 border border-border/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Academic Standing
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <IconTrendingUp size={12} />
                    +0.16 vs Fall
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-black text-foreground tracking-tight">
                    3.84 <span className="text-xs font-semibold text-muted-foreground">/ 4.00</span>
                  </div>
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    <IconAward size={12} />
                    Dean&apos;s Honor List
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground flex items-center gap-1 pt-1">
                  <IconSparkles size={11} className="text-amber-500 shrink-0" />
                  <span>Bachelor of Information Technology • 4th Semester</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

