import { cn } from "cn";

/**
 * College-ERP brand mark — a minimal open book.
 *
 * Stroke-based and drawn with `currentColor`, so it stays monochrome and
 * adapts automatically to light/dark themes and any surrounding context.
 * Size it with utility classes (defaults to 28px).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-7 shrink-0", className)}
      aria-hidden="true"
    >
      {/* Open-book outline: pages curve away from the spine */}
      <path d="M12 6.6c-1.9-1.85-4.8-2.4-8-1.8v12.6c3.2-.6 6.1-.05 8 1.8 1.9-1.85 4.8-2.4 8-1.8V4.8c-3.2-.6-6.1-.05-8 1.8Z" />
      {/* Spine */}
      <path d="M12 6.6v12.6" />
    </svg>
  );
}