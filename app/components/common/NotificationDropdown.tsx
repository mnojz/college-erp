"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ReactElement } from "react";
import Link from "next/link";
import {
  IconBell,
  IconFileText,
  IconClipboardCheck,
  IconReport,
  IconAlertCircle,
  IconX,
  IconClock,
  IconCheck,
  IconUser,
} from "@tabler/icons-react";

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
  announcement: <IconAlertCircle size={18} />,
  material: <IconFileText size={18} />,
  assessment: <IconClipboardCheck size={18} />,
  result: <IconReport size={18} />,
  teacher_assignment: <IconUser size={18} />,
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

/** Fallback landing page when a notification has no link — role-aware. */
const defaultNotificationHref = () => {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  if (path.startsWith("/teacher")) return "/teacher";
  if (path.startsWith("/admin")) return "/admin";
  return "/student";
};

export type NotificationDropdownProps = {
  compact?: boolean;
};

export function NotificationDropdown({ compact = false }: NotificationDropdownProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Always-on: fetch the unread count on mount, then refresh on an interval
  // so the red badge stays accurate even before the dropdown is opened.
  useEffect(() => {
    // The initial poll must call setState on mount — the badge has to appear
    // without the user opening the dropdown first.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchNotifications();
    const interval = setInterval(() => {
      void fetchNotifications();
    }, 45000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return undefined;

    // Refresh (with a loading state) whenever the dropdown opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNotifications();

    return () => undefined;
  }, [open, loadNotifications]);

  const unreadItems = notifications.filter((n) => !n.readAt);
  const readItems = notifications.filter((n) => n.readAt);

  const renderItem = (n: Notification) => {
    const IconEl = iconMap[n.type] || <IconBell size={18} />;
    const isUnread = !n.readAt;
    return (
      <Link
        key={n.id}
        href={n.link || defaultNotificationHref()}
        className={`notification-item ${isUnread ? "unread" : "read"}`}
        onClick={() => {
          if (isUnread) handleMarkRead(n.id);
          setOpen(false);
        }}
      >
        <span className="notification-item-icon">{IconEl}</span>
        <div className="notification-item-body">
          <strong>{n.title}</strong>
          {n.body && <span className="notification-item-text">{n.body}</span>}
          <span className="notification-item-time">{timeAgo(n.createdAt)}</span>
        </div>
        {isUnread && <b className="notification-dot" />}
        {!isUnread && (
          <button
            type="button"
            className="notification-delete"
            title="Remove"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDelete(n.id);
            }}
          >
            <IconX size={14} />
          </button>
        )}
      </Link>
    );
  };

  return (
    <div className="notification-dropdown-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className={`notification-trigger ${compact ? "compact" : ""}`}
        aria-label="Notifications"
        title="Notifications"
        onClick={() => setOpen(!open)}
      >
        <IconBell size={20} />
        {unread > 0 && <b className="notification-badge">{unread > 99 ? "99+" : unread}</b>}
      </button>

      {open && (
        <div className="notification-popover">
          <div className="notification-popover-head">
            <h4>Notifications</h4>
            <div className="notification-popover-actions">
              {unread > 0 && (
                <button
                  type="button"
                  className="notification-mark-all"
                  title="Mark all as read"
                  onClick={handleMarkAllRead}
                >
                  <IconCheck size={15} />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                className="notification-close-popover"
                title="Close"
                onClick={() => setOpen(false)}
              >
                <IconX size={15} />
              </button>
            </div>
          </div>

          {loading && (
            <div className="notification-loading">
              <IconClock size={18} /> Loading…
            </div>
          )}

          {!loading && unreadItems.length === 0 && readItems.length === 0 && (
            <div className="notification-empty">
              <IconBell size={24} />
              <span>No notifications yet.</span>
            </div>
          )}

          {!loading && (
            <>
              {unreadItems.length > 0 && (
                <div className="notification-group">
                  <div className="notification-group-label">Unread</div>
                  {unreadItems.map(renderItem)}
                </div>
              )}
              {readItems.length > 0 && (
                <div className="notification-group">
                  <div className="notification-group-label">Earlier</div>
                  {readItems.map(renderItem)}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
