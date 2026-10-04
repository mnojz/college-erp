"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import { Avatar } from "@/app/components/profile/Avatar";
import { ProfileShell } from "@/app/components/profile/ProfileShell";
import type { DirectoryEntry, RoleName } from "@/app/lib/profile-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "cn";

const ROLE_FILTERS: { value: "" | RoleName; label: string }[] = [
  { value: "", label: "Everyone" },
  { value: "STUDENT", label: "Students" },
  { value: "TEACHER", label: "Faculty" },
];

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
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <IconSearch
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name…"
            aria-label="Search people by name"
            className="pl-9"
          />
        </div>
        {ROLE_FILTERS.map((filter) => (
          <Button
            key={filter.label}
            type="button"
            size="sm"
            variant={role === filter.value ? "default" : "outline"}
            onClick={() => setRole(filter.value)}
            aria-pressed={role === filter.value}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="rounded-md border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
          No people found.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {entries.map((entry) => (
            <Link
              key={entry.id}
              href={`/profile/${entry.id}`}
              className={cn(
                "flex items-center gap-3.5 rounded-xl border bg-card p-3.5 transition-colors hover:border-ring hover:bg-accent/5 sm:p-4"
              )}
            >
              <Avatar name={entry.name} photoUrl={entry.photoUrl} size={44} />
              <div className="min-w-40 flex-1">
                <strong className="text-sm">{entry.name}</strong>
                <p className="mt-0.5 text-xs text-muted-foreground">{entry.subtitle}</p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  entry.role === "STUDENT"
                    ? "border-[color-mix(in_oklab,var(--ctp-blue)_45%,transparent)] bg-[color-mix(in_oklab,var(--ctp-blue)_15%,transparent)] text-[var(--ctp-blue)]"
                    : "border-[color-mix(in_oklab,var(--ctp-green)_45%,transparent)] bg-[color-mix(in_oklab,var(--ctp-green)_15%,transparent)] text-[var(--ctp-green)]"
                )}
              >
                {entry.role === "STUDENT" ? "Student" : "Faculty"}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </ProfileShell>
  );
}
