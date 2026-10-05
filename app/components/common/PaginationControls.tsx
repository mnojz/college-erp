"use client";

import { Button } from "@/components/ui/button";

export type PaginationMeta = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
};

/**
 * Shared "Showing X–Y of Z" + prev/next control, driven by the envelope that
 * `paginatedResponse` returns from app/lib/pagination.
 */
export function PaginationControls({
  pagination,
  onPageChange,
  busy = false,
  label = "students",
}: {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  busy?: boolean;
  label?: string;
}) {
  const { page, pageSize, total, totalPages } = pagination;
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
      <p className="m-0 text-xs text-muted-foreground">
        Showing{" "}
        <strong className="font-semibold text-foreground">
          {from}–{to}
        </strong>{" "}
        of {total} {label}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          Page {page} of {totalPages}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
