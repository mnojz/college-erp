"use client";

import { useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  IconAlertCircle,
  IconBell,
  IconCheck,
  IconChecks,
  IconClipboardCheck,
  IconClock,
  IconFileText,
  IconInbox,
  IconReport,
  IconUser,
  IconUserCheck,
  IconUserX,
  IconX,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "cn";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

type TypeConfig = {
  icon: ReactNode;
  badgeClass: string;
  label: string;
};

const TYPE_CONFIG: Record<string, TypeConfig> = {
  announcement: {
    icon: <IconAlertCircle size={15} />,
    badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent",
    label: "Notice",
  },
  material: {
    icon: <IconFileText size={15} />,
    badgeClass: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-transparent",
    label: "Material",
  },
  assessment: {
    icon: <IconClipboardCheck size={15} />,
    badgeClass: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-transparent",
    label: "Exam",
  },
  result: {
    icon: <IconReport size={15} />,
    badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent",
    label: "Result",
  },
  profile_review: {
    icon: <IconUserCheck size={15} />,
    badgeClass: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-transparent",
    label: "Review",
  },
  PROFILE_APPROVED: {
    icon: <IconCheck size={15} />,
    badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent",
    label: "Approved",
  },
  PROFILE_REJECTED: {
    icon: <IconUserX size={15} />,
    badgeClass: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-transparent",
    label: "Rejected",
  },
  teacher_assignment: {
    icon: <IconUser size={15} />,
    badgeClass: "bg-teal-500/15 text-teal-600 dark:text-teal-400 border-transparent",
    label: "Teaching",
  },
};

const DEFAULT_CONFIG: TypeConfig = {
  icon: <IconBell size={15} />,
  badgeClass: "bg-primary/10 text-primary border-transparent",
  label: "Update",
};

const formatTimeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const defaultNotificationHref = () => "/dashboard";

export type NotificationDropdownProps = {
  compact?: boolean;
  className?: string;
};

export function NotificationDropdown({
  compact = false,
  className = "",
}: NotificationDropdownProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"ALL" | "UNREAD">("ALL");

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        const list: Notification[] = data.notifications || [];
        setNotifications(list);
        setUnread(data.unread || 0);
      }
    } catch {
      // silent fail
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      await fetchNotifications();
    } finally {
      setLoading(false);
    }
  }, [fetchNotifications]);

  const markRead = async (id?: string) => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : { all: true }),
      });
    } catch {
      // silent fail
    }
  };

  const handleMarkRead = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    await markRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setUnread((p) => Math.max(0, p - 1));
  };

  const handleMarkAllRead = async () => {
    await markRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
    setUnread(0);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Keep unread counter fresh
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchNotifications();
    const interval = setInterval(() => {
      void fetchNotifications();
    }, 45000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNotifications();
    return () => undefined;
  }, [open, loadNotifications]);

  const displayedList =
    activeFilter === "UNREAD" ? notifications.filter((n) => !n.readAt) : notifications;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          title="Notifications"
          className={cn(
            "group relative flex items-center justify-center transition-all duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
            compact ? "size-8" : "size-9",
            className ||
              "rounded-lg border border-border/70 bg-card hover:bg-accent/60 text-muted-foreground hover:text-foreground shadow-2xs",
          )}
        >
          <IconBell
            size={18}
            className={cn(
              "transition-transform duration-200 group-hover:scale-110",
              unread > 0 ? "text-foreground" : "text-muted-foreground",
            )}
          />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-xs animate-in zoom-in-50">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(25rem,calc(100vw-1.5rem))] sm:w-[25.5rem] p-0 rounded-2xl border border-border/80 bg-popover/95 backdrop-blur-md shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="border-b border-border/60 bg-muted/20 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconBell size={15} />
              </span>
              <h4 className="text-sm font-bold tracking-tight text-foreground">Notifications</h4>
              {unread > 0 ? (
                <Badge
                  variant="outline"
                  className="bg-primary/10 text-primary border-transparent text-[10px] font-bold px-1.5 py-0"
                >
                  {unread} New
                </Badge>
              ) : (
                <span className="text-[11px] font-medium text-muted-foreground">All caught up</span>
              )}
            </div>

            {unread > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 gap-1.5"
                onClick={handleMarkAllRead}
              >
                <IconChecks size={14} />
                <span>Mark all read</span>
              </Button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg border border-border/50 bg-muted/40 w-fit text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setActiveFilter("ALL")}
              className={cn(
                "px-2.5 py-0.5 rounded-md transition-colors",
                activeFilter === "ALL"
                  ? "bg-card text-foreground shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("UNREAD")}
              className={cn(
                "px-2.5 py-0.5 rounded-md transition-colors",
                activeFilter === "UNREAD"
                  ? "bg-card text-foreground shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Unread ({unread})
            </button>
          </div>
        </div>

        {/* Notification Items List */}
        <div className="max-h-[25rem] overflow-y-auto divide-y divide-border/40">
          {loading && (
            <div className="p-3 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 p-2.5 rounded-xl border border-border/40 bg-muted/20">
                  <Skeleton className="size-8 rounded-lg shrink-0" />
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && displayedList.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-muted-foreground gap-2">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground mb-1">
                <IconInbox size={24} />
              </span>
              <p className="text-xs font-bold text-foreground">
                {activeFilter === "UNREAD" ? "No unread notifications" : "No notifications yet"}
              </p>
              <p className="text-[11px] text-muted-foreground max-w-xs">
                {activeFilter === "UNREAD"
                  ? "You have acknowledged all recent alerts and bulletins."
                  : "Campus notices, exam results, and academic updates will appear here."}
              </p>
            </div>
          )}

          {!loading &&
            displayedList.map((n) => {
              const isUnread = !n.readAt;
              const config = TYPE_CONFIG[n.type] ?? DEFAULT_CONFIG;

              return (
                <div
                  key={n.id}
                  className={cn(
                    "group relative flex items-start gap-3 p-3.5 transition-all",
                    isUnread
                      ? "border-l-3 border-l-primary bg-primary/[0.04] dark:bg-primary/[0.07] hover:bg-primary/[0.08]"
                      : "border-l-3 border-l-transparent hover:bg-muted/30 opacity-80 hover:opacity-100",
                  )}
                >
                  {/* Category Icon Badge */}
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg border shadow-2xs mt-0.5",
                      config.badgeClass,
                    )}
                  >
                    {config.icon}
                  </div>

                  {/* Main Clickable Content */}
                  <Link
                    href={n.link || defaultNotificationHref()}
                    onClick={() => {
                      if (isUnread) handleMarkRead(n.id);
                      setOpen(false);
                    }}
                    className="flex-1 min-w-0 pr-1 space-y-1 block"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {config.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground/80 font-medium shrink-0 flex items-center gap-1">
                        <IconClock size={10} />
                        {formatTimeAgo(n.createdAt)}
                      </span>
                    </div>

                    <h5
                      className={cn(
                        "text-xs leading-snug line-clamp-1",
                        isUnread ? "font-bold text-foreground" : "font-semibold text-foreground/90",
                      )}
                    >
                      {n.title}
                    </h5>

                    {n.body && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                        {n.body}
                      </p>
                    )}
                  </Link>

                  {/* Item Actions (Unread Dot / Mark Read / Dismiss) */}
                  <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
                    {isUnread ? (
                      <button
                        type="button"
                        onClick={(e) => handleMarkRead(n.id, e)}
                        title="Mark as read"
                        className="size-5 rounded-full bg-primary/20 hover:bg-primary/30 text-primary flex items-center justify-center transition-all"
                      >
                        <span className="size-2 rounded-full bg-primary animate-pulse" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleDelete(n.id, e)}
                        title="Dismiss"
                        className="size-5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                      >
                        <IconX size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Footer */}
        <div className="border-t border-border/50 bg-muted/10 p-2.5 px-3.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {displayedList.length} notification{displayedList.length === 1 ? "" : "s"}
          </span>
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="font-semibold text-primary hover:underline"
          >
            Terminal Dashboard
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
