"use client";

import { useRef, type ReactNode } from "react";

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
}

export function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(59, 130, 246, 0.15)",
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current || !spotlightRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    spotlightRef.current.style.background = `radial-gradient(450px circle at ${x}px ${y}px, ${spotlightColor}, transparent 80%)`;
  };

  const handleMouseEnter = () => {
    if (spotlightRef.current) {
      spotlightRef.current.style.opacity = "1";
    }
  };

  const handleMouseLeave = () => {
    if (spotlightRef.current) {
      spotlightRef.current.style.opacity = "0";
    }
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden ${className}`}
    >
      {/* Interactive Cursor Spotlight with direct DOM update (zero React re-renders) */}
      <div
        ref={spotlightRef}
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300"
      />
      {children}
    </div>
  );
}
