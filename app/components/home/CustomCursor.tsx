"use client";

import { useEffect, useRef } from "react";

export function CustomCursor() {
  const ringRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Only activate custom cursor on fine pointer devices (desktop mouse/trackpad)
    if (typeof window === "undefined" || !window.matchMedia("(pointer: fine)").matches) {
      return;
    }

    const html = document.documentElement;
    html.classList.add("has-custom-cursor");

    const ring = ringRef.current;
    if (!ring) return;

    let animId: number;
    let isVisible = false;
    let isMouseDown = false;

    // Real hardware cursor coordinates
    const mouse = { x: -100, y: -100 };
    // Smooth lagging follower coordinates
    const follower = { x: -100, y: -100 };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;

      if (!isVisible) {
        isVisible = true;
        follower.x = e.clientX;
        follower.y = e.clientY;
        ring.style.opacity = "1";
      }
    };

    const handleMouseEnter = () => {
      isVisible = true;
      html.classList.add("has-custom-cursor");
      ring.style.opacity = "1";
    };

    const handleMouseLeave = () => {
      isVisible = false;
      html.classList.remove("has-custom-cursor");
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

    // Ultra-lightweight animation loop: only interpolates the lagging follower ring
    const animate = (timestamp: number) => {
      if (isVisible) {
        // Lagging follower interpolation (chasing the hardware cursor with smooth delay)
        follower.x += (mouse.x - follower.x) * 0.18;
        follower.y += (mouse.y - follower.y) * 0.18;

        // Continuous breathing animation (max diameter <= 28px)
        const breath = Math.sin(timestamp * 0.005) * 0.14;
        const clickScale = isMouseDown ? 0.75 : 1;
        const currentScale = (1 + breath) * clickScale;

        // Distance between instantaneous hardware mouse cursor and lagging follower
        const dist = Math.hypot(mouse.x - follower.x, mouse.y - follower.y);

        // Fill transition:
        // When dist <= 7px (surrounding the central hardware dot): fillProgress = 0 (hollow ring)
        // When dist > 7px (cursor escapes the ring): fillProgress ramps up to 1 (filled aurora circle)
        const fillProgress = Math.min(Math.max((dist - 7) / 16, 0), 1);

        ring.style.transform = `translate3d(${follower.x}px, ${follower.y}px, 0) translate(-50%, -50%) scale(${currentScale})`;

        if (fillProgress <= 0.02) {
          // Ring mode: hollow ring surrounding the central dot with luminous aurora border
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
        style={{
          width: "24px",
          height: "24px",
          transition: "opacity 0.2s ease",
        }}
        className="pointer-events-none fixed top-0 left-0 rounded-full border-2 border-sky-400 opacity-0 will-change-transform"
      />
    </div>
  );
}
