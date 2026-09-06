"use client";

import { useEffect, useState, useCallback } from "react";
import type { ReactElement } from "react";
import Link from "next/link";
import {
  IconBell,
  IconFileText,
  IconClipboardCheck,
  IconReport,
  IconAlertCircle,
  IconUser,
} from "@tabler/icons-react";
import { Bell, Check, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const iconMap: Record<string, ReactElement> = {
  announcement: <IconAlertCircle size={18} className="shrink-0" />,
  material: <IconFileText size={18} className="shrink-0" />,
  assessment: <IconClipboardCheck size={18} className="shrink-0" />,
  result: <IconReport size={18} className="shrink-0" />,
  teacher_assignment: <IconUser size={18} className="shrink-0" />,
};

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
};

/** Fallback landing page when a notification has no link — all roles use /dashboard. */
const defaultNotificationHref = () => "/dashboard";

export type NotificationDropdownProps = {
  compact?: boolean;
};

export function NotificationDropdown({ compact = false }: NotificationDropdownProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

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

  const handleMarkRead = async (id: string) => {
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

  const handleDelete = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Always-on: fetch the unread count on mount, then refresh on an interval
  // so the badge stays accurate even before the dropdown is opened.
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

  const unreadItems = notifications.filter((n) => !n.readAt);
  const readItems = notifications.filter((n) => n.readAt);

  const renderItem = (n: Notification) => {
    const IconEl = iconMap[n.type] || <IconBell size={18} className="shrink-0" />;
    const isUnread = !n.readAt;
    return (
      <Link
        key={n.id}
        href={n.link || defaultNotificationHref()}
        onClick={() => {
          if (isUnread) handleMarkRead(n.id);
          setOpen(false);
        }}
        className={cn(
          "group relative flex items-start gap-2.5 rounded-md px-3 py-2.5 transition-colors hover:bg-accent",
          !isUnread && "opacity-70"
        )}
      >
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {IconEl}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <strong className="text-sm font-medium leading-snug">{n.title}</strong>
          {n.body && (
            <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
          )}
          <span className="mt-0.5 text-[11px] text-muted-foreground">
            {timeAgo(n.createdAt)}
          </span>
        </span>
        {isUnread && (
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
        )}
        {!isUnread && (
          <button
            type="button"
            className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
            title="Remove"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDelete(n.id);
            }}
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </Link>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={compact ? "icon-sm" : "icon"}
          aria-label="Notifications"
          title="Notifications"
          className="relative"
        >
          <Bell className="size-4" aria-hidden="true" />
          {unread > 0 && (
            <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px]">
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(24rem,calc(100vw-2rem))] p-0"
      >
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h4 className="text-sm font-semibold">Notifications</h4>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                title="Mark all as read"
                onClick={handleMarkAllRead}
              >
                <Check className="size-3.5" aria-hidden="true" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Clock className="size-4 animate-spin" aria-hidden="true" />
              Loading…
            </div>
          )}

          {!loading && unreadItems.length === 0 && readItems.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <Bell className="size-6" aria-hidden="true" />
              <span className="text-sm">No notifications yet.</span>
            </div>
          )}

          {!loading && (
            <div className="flex flex-col">
              {unreadItems.length > 0 && (
                <div>
                  <div className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                    Unread
                  </div>
                  {unreadItems.map(renderItem)}
                </div>
              )}
              {readItems.length > 0 && (
                <div>
                  <div className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                    Earlier
                  </div>
                  {readItems.map(renderItem)}
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
