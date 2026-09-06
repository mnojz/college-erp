"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { IconExternalLink, IconRefresh, IconZoomIn, IconZoomOut } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

type Offset = { x: number; y: number };

export function ZoomableImageViewer({
  src,
  alt,
  openUrl,
}: {
  src: string;
  alt: string;
  openUrl?: string;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const viewRef = useRef<{ zoom: number; offset: Offset }>({
    zoom: MIN_ZOOM,
    offset: { x: 0, y: 0 },
  });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  const applyView = useCallback((nextZoom: number, nextOffset: Offset) => {
    const stage = stageRef.current;
    const rect = stage?.getBoundingClientRect();
    let x = nextOffset.x;
    let y = nextOffset.y;
    if (nextZoom <= MIN_ZOOM) {
      x = 0;
      y = 0;
    } else if (rect) {
      const maxX = (rect.width * (nextZoom - MIN_ZOOM)) / 2 + 32;
      const maxY = (rect.height * (nextZoom - MIN_ZOOM)) / 2 + 32;
      x = Math.min(maxX, Math.max(-maxX, x));
      y = Math.min(maxY, Math.max(-maxY, y));
    }
    viewRef.current = { zoom: nextZoom, offset: { x, y } };
    setZoom(nextZoom);
    setOffset({ x, y });
  }, []);

  const zoomAround = useCallback(
    (nextZoomRaw: number, focal?: Offset) => {
      const rect = stageRef.current?.getBoundingClientRect();
      const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoomRaw));
      const { zoom: prevZoom, offset: prevOffset } = viewRef.current;
      if (!rect || !focal || prevZoom === clamped) {
        applyView(clamped, prevZoom === clamped ? prevOffset : { x: 0, y: 0 });
        return;
      }
      const fx = focal.x - rect.width / 2;
      const fy = focal.y - rect.height / 2;
      const px = (fx - prevOffset.x) / prevZoom;
      const py = (fy - prevOffset.y) / prevZoom;
      applyView(clamped, { x: fx - px * clamped, y: fy - py * clamped });
    },
    [applyView],
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = stage.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
      zoomAround(viewRef.current.zoom * factor, {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [zoomAround]);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (viewRef.current.zoom <= MIN_ZOOM) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseX: viewRef.current.offset.x,
      baseY: viewRef.current.offset.y,
    };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.preventDefault();
    applyView(viewRef.current.zoom, {
      x: drag.baseX + (e.clientX - drag.startX),
      y: drag.baseY + (e.clientY - drag.startY),
    });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const handleDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    zoomAround(
      viewRef.current.zoom >= 2 ? MIN_ZOOM : viewRef.current.zoom * 2,
      { x: e.clientX - rect.left, y: e.clientY - rect.top },
    );
  };

  const handleImageLoad = () => {
    applyView(MIN_ZOOM, { x: 0, y: 0 });
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const z = viewRef.current.zoom;
    const o = viewRef.current.offset;
    const step = 32;
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomAround(z * 1.25);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      zoomAround(z / 1.25);
    } else if (e.key === "0") {
      e.preventDefault();
      applyView(MIN_ZOOM, { x: 0, y: 0 });
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      applyView(z, { x: o.x + step, y: o.y });
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      applyView(z, { x: o.x - step, y: o.y });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      applyView(z, { x: o.x, y: o.y + step });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      applyView(z, { x: o.x, y: o.y - step });
    }
  };

  const canPan = zoom > MIN_ZOOM;

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={stageRef}
        className={cn(
          "relative flex h-72 w-full touch-none items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40 select-none sm:h-96",
          canPan && "cursor-grab active:cursor-grabbing"
        )}
        role="application"
        aria-label={`Zoomable preview of ${alt}. Use the plus, minus and arrow keys to zoom and pan.`}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- attachment streamed by our own API */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-full max-w-full object-contain"
          onLoad={handleImageLoad}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          }}
        />
        {!canPan && (
          <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            Scroll or double-click to zoom
          </span>
        )}
      </div>

      <div className="flex items-center justify-center gap-1">
        <Button type="button" variant="outline" size="icon-sm" onClick={() => zoomAround(viewRef.current.zoom / 1.25)} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out" title="Zoom out">
          <IconZoomOut size={16} aria-hidden="true" />
        </Button>
        <span className="min-w-14 text-center text-xs font-medium tabular-nums" aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <Button type="button" variant="outline" size="icon-sm" onClick={() => zoomAround(viewRef.current.zoom * 1.25)} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in" title="Zoom in">
          <IconZoomIn size={16} aria-hidden="true" />
        </Button>
        <Button type="button" variant="outline" size="icon-sm" onClick={() => applyView(MIN_ZOOM, { x: 0, y: 0 })} disabled={!canPan} aria-label="Reset zoom and position" title="Reset view (1:1)">
          <IconRefresh size={16} aria-hidden="true" />
        </Button>
        {openUrl && (
          <Button type="button" variant="outline" size="icon-sm" asChild>
            <a href={openUrl} target="_blank" rel="noreferrer" aria-label="Open full size image in a new tab" title="Open full size">
              <IconExternalLink size={16} aria-hidden="true" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
