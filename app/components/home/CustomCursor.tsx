"use client";

import { useEffect, useRef } from "react";

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Only activate custom cursor on fine pointer devices (desktop mouse/trackpad)
    if (typeof window === "undefined" || !window.matchMedia("(pointer: fine)").matches) {
      return;
    }

    const html = document.documentElement;
    html.classList.add("has-custom-cursor");

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let animId: number;
    let isVisible = false;
    let isMouseDown = false;

    // Direct cursor coordinates
    const mouse = { x: -100, y: -100 };
    // Smooth lagging follower coordinates
    const follower = { x: -100, y: -100 };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;

      if (!isVisible) {
        isVisible = true;
        // Snap follower initially to prevent flying in from off-screen
        if (follower.x === -100) {
          follower.x = e.clientX;
          follower.y = e.clientY;
        }
        dot.style.opacity = "1";
        ring.style.opacity = "1";
      }
    };

    const handleMouseEnter = () => {
      isVisible = true;
      html.classList.add("has-custom-cursor");
      dot.style.opacity = "1";
      ring.style.opacity = "1";
    };

    const handleMouseLeave = () => {
      isVisible = false;
      html.classList.remove("has-custom-cursor");
      dot.style.opacity = "0";
      ring.style.opacity = "0";
    };

    const handleMouseDown = () => {
      isMouseDown = true;
    };

    const handleMouseUp = () => {
      isMouseDown = false;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseenter", handleMouseEnter);
    document.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    // Animation loop (ultra-smooth 60-120fps with direct DOM transforms)
    const animate = (timestamp: number) => {
      if (isVisible) {
        // Lagging follower interpolation (slight delay)
        follower.x += (mouse.x - follower.x) * 0.16;
        follower.y += (mouse.y - follower.y) * 0.16;

        // Position tiny pointer dot directly at mouse
        dot.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0) translate(-50%, -50%)`;

        // Continuous shrinking and expanding breathing animation (max diameter <= 28px)
        // Base size is 24px, breathing scales between 0.85 and 1.15
        const breath = Math.sin(timestamp * 0.005) * 0.14;
        const clickScale = isMouseDown ? 0.72 : 1;
        const currentScale = (1 + breath) * clickScale;

        // Distance between mouse pointer and lagging follower
        const dist = Math.hypot(mouse.x - follower.x, mouse.y - follower.y);

        // Fill transition:
        // When dist <= 7px (surrounding the dot): fillProgress = 0 (hollow ring)
        // When dist > 7px (cursor escapes the ring): fillProgress ramps up to 1 (filled aurora circle)
        const fillProgress = Math.min(Math.max((dist - 7) / 16, 0), 1);

        ring.style.transform = `translate3d(${follower.x}px, ${follower.y}px, 0) translate(-50%, -50%) scale(${currentScale})`;

        if (fillProgress <= 0.02) {
          // Ring mode: hollow surrounding ring with luminous aurora border glow
          ring.style.background = "transparent";
          ring.style.borderColor = "rgba(56, 189, 248, 0.85)";
          ring.style.boxShadow =
            "0 0 10px rgba(56, 189, 248, 0.6), inset 0 0 6px rgba(129, 140, 248, 0.35)";
        } else {
          // Escaped mode: transforms into filled circle with vibrant aurora gradient and glow
          const alpha = 0.88 * fillProgress;
          ring.style.background = `linear-gradient(135deg, rgba(56, 189, 248, ${alpha}), rgba(129, 140, 248, ${alpha}), rgba(192, 132, 252, ${alpha}))`;
          ring.style.borderColor = `rgba(224, 231, 255, ${0.4 + 0.5 * fillProgress})`;
          ring.style.boxShadow = `0 0 ${12 * fillProgress + 6}px rgba(56, 189, 248, ${
            0.6 * fillProgress + 0.3
          }), 0 0 ${22 * fillProgress}px rgba(192, 132, 252, ${0.45 * fillProgress})`;
        }
      }

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      html.classList.remove("has-custom-cursor");
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseenter", handleMouseEnter);
      document.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-9999 overflow-hidden select-none"
    >
      {/* Lagging follower ring that transforms into filled aurora circle when escaping */}
      <div
        ref={ringRef}
        style={{ width: "24px", height: "24px" }}
        className="pointer-events-none fixed top-0 left-0 rounded-full border-2 border-sky-400 opacity-0 transition-opacity duration-300 will-change-transform"
      />

      {/* Instant tiny mouse pointer dot */}
      <div
        ref={dotRef}
        style={{ width: "5px", height: "5px" }}
        className="pointer-events-none fixed top-0 left-0 rounded-full bg-sky-400 dark:bg-white shadow-[0_0_8px_#38bdf8,0_0_14px_rgba(255,255,255,0.9)] opacity-0 transition-opacity duration-300 will-change-transform"
      />
    </div>
  );
}

