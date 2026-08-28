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

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

type Offset = { x: number; y: number };

/**
 * Interactive image viewer for notice attachments: zoom via buttons, mouse
 * wheel or double-click, and drag-to-pan. Includes a reset (1:1) control and
 * an "open full size" action. Used inside the notice detail modal.
 */
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

  // Zoom towards a focal point (cursor position in stage coordinates) so the
  // image point under the cursor stays put while the zoom level changes.
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

  // Wheel zoom needs a non-passive listener so preventDefault actually stops
  // the page from scrolling while zooming.
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

  // Reset the view whenever a (new) image finishes loading — event-driven so
  // we never call setState synchronously inside an effect.
  function handleImageLoad() {
    applyView(MIN_ZOOM, { x: 0, y: 0 });
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (zoom <= MIN_ZOOM || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseX: viewRef.current.offset.x,
      baseY: viewRef.current.offset.y,
    };
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    applyView(viewRef.current.zoom, {
      x: drag.baseX + (e.clientX - drag.startX),
      y: drag.baseY + (e.clientY - drag.startY),
    });
  }

  function endDrag(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  }

  function handleDoubleClick(e: ReactMouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (viewRef.current.zoom > MIN_ZOOM) {
      applyView(MIN_ZOOM, { x: 0, y: 0 });
    } else {
      zoomAround(2.5, { x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const step = 40;
    const { zoom: z, offset: o } = viewRef.current;
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
  }

  const canPan = zoom > MIN_ZOOM;

  return (
    <div className="zoom-viewer">
      <div
        ref={stageRef}
        className={`zoom-viewer-stage${canPan ? " pannable" : ""}`}
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
          className="zoom-viewer-img"
          onLoad={handleImageLoad}
          style={{
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
          }}
        />
        {!canPan && (
          <span className="zoom-viewer-hint">Scroll or double-click to zoom</span>
        )}
      </div>

      <div className="zoom-viewer-controls">
        <button
          type="button"
          className="zoom-viewer-btn"
          onClick={() => zoomAround(viewRef.current.zoom / 1.25)}
          disabled={zoom <= MIN_ZOOM}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <IconZoomOut size={16} aria-hidden="true" />
        </button>
        <span className="zoom-viewer-level" aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          className="zoom-viewer-btn"
          onClick={() => zoomAround(viewRef.current.zoom * 1.25)}
          disabled={zoom >= MAX_ZOOM}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <IconZoomIn size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="zoom-viewer-btn"
          onClick={() => applyView(MIN_ZOOM, { x: 0, y: 0 })}
          disabled={!canPan}
          aria-label="Reset zoom and position"
          title="Reset view (1:1)"
        >
          <IconRefresh size={16} aria-hidden="true" />
        </button>
        {openUrl && (
          <a
            className="zoom-viewer-btn"
            href={openUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open full size image in a new tab"
            title="Open full size"
          >
            <IconExternalLink size={16} aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}