"use client";

import { useId } from "react";
import { cn } from "cn";

/**
 * College-ERP brand mark — academic mortarboard crowned over an open book and bookmark ribbon.
 *
 * Designed with dynamic multi-tier gradient shading using `currentColor` so it
 * adapts automatically to light and dark themes while retaining rich optical depth.
 */
export function Logo({ className }: { className?: string }) {
  const rawId = useId();
  const id = rawId.replace(/:/g, "-");
  const capGradId = `logo-cap-${id}`;
  const pageLeftId = `logo-pl-${id}`;
  const pageRightId = `logo-pr-${id}`;
  const ribbonId = `logo-rb-${id}`;

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-8 shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={capGradId} x1="2.5" y1="3" x2="29.5" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.82" />
        </linearGradient>
        <linearGradient id={pageLeftId} x1="3" y1="17" x2="14" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor="currentColor" stopOpacity="0.95" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.72" />
        </linearGradient>
        <linearGradient id={pageRightId} x1="29" y1="17" x2="18" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor="currentColor" stopOpacity="0.85" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.62" />
        </linearGradient>
        <linearGradient id={ribbonId} x1="14.5" y1="18" x2="17.5" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.78" />
        </linearGradient>
      </defs>

      {/* Graduation Cap Diamond Top */}
      <path
        d="M16 3.5L29.5 9.8L16 16.2L2.5 9.8L16 3.5Z"
        fill={`url(#${capGradId})`}
      />

      {/* Cap 3D Bevel Underside */}
      <path
        d="M16 16.2L29.5 9.8L27.5 11.4L16 17.2L4.5 11.4L2.5 9.8L16 16.2Z"
        fill="currentColor"
        fillOpacity="0.38"
      />

      {/* Tassel Cord & Fringe */}
      <path
        d="M24.2 11.2V16.6M24.2 16.6L22.8 19.6H25.6L24.2 16.6Z"
        fill="currentColor"
        fillOpacity="0.85"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Open Book Left Leaf */}
      <path
        d="M14 18.8C9.5 16.6 4.8 17.2 3 18.2V24.8C4.8 23.8 9.5 23.2 14 25.4V18.8Z"
        fill={`url(#${pageLeftId})`}
      />

      {/* Open Book Right Leaf */}
      <path
        d="M18 18.8C22.5 16.6 27.2 17.2 29 18.2V24.8C27.2 23.8 22.5 23.2 18 25.4V18.8Z"
        fill={`url(#${pageRightId})`}
      />

      {/* Bookmark Ribbon */}
      <path
        d="M14.5 19.5H17.5V28.5L16 27L14.5 28.5V19.5Z"
        fill={`url(#${ribbonId})`}
      />
    </svg>
  );
}