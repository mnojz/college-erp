"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import { Avatar } from "@/app/components/profile/Avatar";
import { ProfileShell } from "@/app/components/profile/ProfileShell";
import type { DirectoryEntry, RoleName } from "@/app/lib/profile-shared";

const ROLE_FILTERS: { value: "" | RoleName; label: string }[] = [
  { value: "", label: "Everyone" },
  { value: "STUDENT", label: "Students" },
  { value: "TEACHER", label: "Faculty" },
];

const chipStyle = (active: boolean) =>
  ({
    fontSize: 12,
    fontWeight: 700,
    padding: "7px 14px",
    borderRadius: 999,
    border: "1px solid var(--line-strong)",
    background: active ? "var(--accent-dark)" : "transparent",
    color: active ? "#ffffff" : "var(--ink-soft)",
  }) as const;

const rowCardStyle = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "14px 16px",
  borderRadius: 12,
  background: "var(--panel)",
  border: "1px solid var(--line)",
  color: "inherit",
  textDecoration: "none",
} as const;

function roleBadge(role: RoleName) {
  const student = role === "STUDENT";
  return {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 999,
    background: student ? "rgba(2,132,199,0.12)" : "rgba(16,185,129,0.14)",
    color: student ? "#0369a1" : "#047857",
  } as const;
}

export default function DirectoryPage() {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"" | RoleName>("");
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (role) params.set("role", role);
      setIsLoading(true);
      fetch(`/api/directory?${params.toString()}`)
        .then(async (res) => {
          if (!res.ok) throw new Error("Unable to load the directory");
          return res.json();
        })
        .then((data: { entries: DirectoryEntry[] }) => {
          if (cancelled) return;
          setEntries(data.entries);
          setError("");
        })
        .catch((err: Error) => {
          if (!cancelled) setError(err.message);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, role]);

  return (
    <ProfileShell
      activeHref="/directory"
      title="Directory"
      subtitle="Find students and faculty — open any card to view a profile"
    >
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid var(--input-border)",
            background: "var(--input-bg)",
            flex: 1,
            minWidth: 220,
          }}
        >
          <IconSearch size={16} style={{ color: "var(--ink-soft)" }} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name…"
            aria-label="Search people by name"
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              color: "var(--input-color)",
              width: "100%",
              fontSize: 14,
            }}
          />
        </label>
        {ROLE_FILTERS.map((filter) => (
          <button
            key={filter.label}
            type="button"
            onClick={() => setRole(filter.value)}
            aria-pressed={role === filter.value}
            style={chipStyle(role === filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error && (
        <p style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 600, color: "#b91c1c" }}>
          {error}
        </p>
      )}

      {isLoading ? (
        <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>Loading…</p>
      ) : entries.length === 0 ? (
        <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>No people found.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {entries.map((entry) => (
            <Link key={entry.id} href={`/profile/${entry.id}`} style={rowCardStyle}>
              <Avatar name={entry.name} photoUrl={entry.photoUrl} size={44} />
              <div style={{ flex: 1, minWidth: 160 }}>
                <strong style={{ fontSize: 14 }}>{entry.name}</strong>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>
                  {entry.subtitle}
                </p>
              </div>
              <span style={roleBadge(entry.role)}>
                {entry.role === "STUDENT" ? "Student" : "Faculty"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </ProfileShell>
  );
}