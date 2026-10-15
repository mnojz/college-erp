"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
  alpha: number;
}

export function InteractiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;

    // Mouse coordinates with smooth damping
    const mouse = {
      x: -1000,
      y: -1000,
      targetX: -1000,
      targetY: -1000,
      isHovering: false,
    };

    let lastClientX = -1000;
    let lastClientY = -1000;

    const updateMouseCoords = (clientX: number, clientY: number) => {
      lastClientX = clientX;
      lastClientY = clientY;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      if (x < 0 || x > width || y < 0 || y > height) {
        mouse.isHovering = false;
        mouse.targetX = -1000;
        mouse.targetY = -1000;
        return;
      }

      if (!mouse.isHovering) {
        mouse.x = x;
        mouse.y = y;
      }

      mouse.targetX = x;
      mouse.targetY = y;
      mouse.isHovering = true;
    };

    const handleMouseMove = (e: MouseEvent) => {
      updateMouseCoords(e.clientX, e.clientY);
    };

    const handleScroll = () => {
      if (lastClientX >= 0 && lastClientY >= 0) {
        updateMouseCoords(lastClientX, lastClientY);
      }
    };

    const handleMouseLeave = () => {
      mouse.isHovering = false;
      mouse.targetX = -1000;
      mouse.targetY = -1000;
      lastClientX = -1000;
      lastClientY = -1000;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);

    const isDarkMode = () => document.documentElement.classList.contains("dark");

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      width = parent ? parent.clientWidth : window.innerWidth;
      height = parent ? parent.clientHeight : window.innerHeight;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas, { passive: true });

    // Initialize particles: balanced density with high performance
    const particleCount = Math.floor(Math.min(width, 1400) / 18);
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        baseRadius: Math.random() * 1.5 + 1.4,
        alpha: Math.random() * 0.3 + 0.55,
      });
    }

    const mouseRadius = 160;
    const connectRadius = 125;

    const render = () => {
      // Smooth lerp mouse coordinates
      mouse.x += (mouse.targetX - mouse.x) * 0.1;
      mouse.y += (mouse.targetY - mouse.y) * 0.1;

      ctx.clearRect(0, 0, width, height);

      const dark = isDarkMode();
      const dotColor = dark ? "147, 197, 253" : "49, 87, 165";
      const lineColor = dark ? "147, 197, 253" : "59, 130, 246";

      // 1. Update particle positions and bounds
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Subtle mouse repulsion
        if (mouse.isHovering) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.hypot(dx, dy);

          if (dist < mouseRadius && dist > 0) {
            const force = (1 - dist / mouseRadius) * 0.6;
            p.x -= (dx / dist) * force;
            p.y -= (dy / dist) * force;
          }
        }
      }

      // 2. Batch all connecting lines into a single GPU draw call
      ctx.beginPath();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Line to cursor
        if (mouse.isHovering) {
          const distMouse = Math.hypot(mouse.x - p.x, mouse.y - p.y);
          if (distMouse < mouseRadius) {
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
          }
        }

        // Lines to neighbor particles in proximity
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist2 = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist2 < connectRadius) {
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
          }
        }
      }
      ctx.strokeStyle = `rgba(${lineColor}, 0.28)`;
      ctx.lineWidth = 0.85;
      ctx.stroke();

      // 3. Batch all particle dots into a single GPU draw call
      ctx.beginPath();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.moveTo(p.x + p.baseRadius, p.y);
        ctx.arc(p.x, p.y, p.baseRadius, 0, Math.PI * 2);
      }
      ctx.fillStyle = `rgba(${dotColor}, 0.72)`;
      ctx.fill();

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden z-0"
    >
      {/* Interactive Constellation Canvas */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 block h-full w-full opacity-90 dark:opacity-80"
      />
    </div>
  );
}

