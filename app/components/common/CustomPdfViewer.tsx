"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import {
  IconArrowsHorizontal,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconLoader2,
  IconMaximize,
  IconMinimize,
  IconRotateClockwise,
  IconZoomIn,
  IconZoomOut,
  IconAlertCircle,
  IconRefresh,
} from "@tabler/icons-react";
import { cn } from "cn";

interface CustomPdfViewerProps {
  url: string;
  title?: string;
  downloadUrl?: string;
  className?: string;
}

interface PageProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  rotation: number;
  onVisible?: (pageNumber: number) => void;
}

function PdfPageItem({ pdfDoc, pageNumber, scale, rotation, onVisible }: PageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number>(1.414); // Default A4
  const renderTaskRef = useRef<RenderTask | null>(null);

  // IntersectionObserver to detect which page is visible
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onVisible(pageNumber);
          }
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber, onVisible]);

  // Render the PDF page to canvas
  useEffect(() => {
    let isCancelled = false;

    async function renderPage() {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        // Cancel any previous render task
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // Ignore cancel errors
          }
        }

        const page = await pdfDoc.getPage(pageNumber);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale, rotation });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d", { alpha: false });
        if (!context) return;

        const outputScale = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        if (viewport.width > 0 && viewport.height > 0) {
          setAspectRatio(viewport.height / viewport.width);
        }

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

        const renderContext = {
          canvas,
          canvasContext: context,
          viewport,
          transform,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        if (!isCancelled) {
          setRendered(true);
        }
      } catch (err: unknown) {
        const isCancelError =
          typeof err === "object" && err !== null && "name" in err && err.name === "RenderingCancelledException";
        if (!isCancelError && !isCancelled) {
          console.error(`Error rendering page ${pageNumber}:`, err);
        }
      }
    }

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore
        }
      }
    };
  }, [pdfDoc, pageNumber, scale, rotation]);

  return (
    <div
      ref={containerRef}
      id={`pdf-page-${pageNumber}`}
      className="relative flex flex-col items-center justify-center my-4 group transition-shadow"
    >
      <div className="relative rounded-lg overflow-hidden shadow-md ring-1 ring-border/60 bg-white transition-all">
        {/* Placeholder / Skeleton while rendering */}
        {!rendered && (
          <div
            className="flex flex-col items-center justify-center bg-muted/40 animate-pulse text-muted-foreground"
            style={{
              width: `${Math.floor(595 * scale)}px`,
              height: `${Math.floor(595 * scale * aspectRatio)}px`,
              maxWidth: "100%",
            }}
          >
            <IconLoader2 size={24} className="animate-spin text-muted-foreground/60 mb-2" />
            <span className="text-xs font-medium">Rendering page {pageNumber}...</span>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className={cn(
            "block transition-opacity duration-200",
            rendered ? "opacity-100" : "opacity-0 absolute inset-0 pointer-events-none"
          )}
        />
      </div>

      <span className="mt-1.5 text-[11px] font-medium text-muted-foreground/80 tracking-wide select-none">
        Page {pageNumber}
      </span>
    </div>
  );
}

export function CustomPdfViewer({
  url,
  title,
  downloadUrl,
  className,
}: CustomPdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.1);
  const [rotation, setRotation] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [firstPageWidth, setFirstPageWidth] = useState<number>(600);
  const [reloadTrigger, setReloadTrigger] = useState<number>(0);

  // Load PDF document using pdfjs-dist
  useEffect(() => {
    let isCancelled = false;

    async function loadDocument() {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const loadingTask = pdfjsLib.getDocument({
          url,
          withCredentials: false,
        });

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setCurrentPage(1);

        // Calculate initial zoom
        try {
          const firstPage = await doc.getPage(1);
          const viewport = firstPage.getViewport({ scale: 1.0 });
          setFirstPageWidth(viewport.width);

          if (scrollContainerRef.current) {
            const containerWidth = scrollContainerRef.current.clientWidth - 48;
            if (containerWidth > 0 && viewport.width > 0) {
              const fitScale = Math.min(Math.max(containerWidth / viewport.width, 0.7), 1.4);
              setScale(Math.round(fitScale * 10) / 10);
            }
          }
        } catch {
          // Keep default scale
        }

        setLoading(false);
      } catch (err: unknown) {
        if (isCancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load PDF file.";
        setError(msg);
        setLoading(false);
      }
    }

    loadDocument();

    return () => {
      isCancelled = true;
    };
  }, [url, reloadTrigger]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Zoom handlers
  const zoomIn = () => setScale((prev) => Math.min(Math.round((prev + 0.15) * 100) / 100, 2.5));
  const zoomOut = () => setScale((prev) => Math.max(Math.round((prev - 0.15) * 100) / 100, 0.5));
  const zoomReset = () => setScale(1.0);

  const fitWidth = () => {
    if (!scrollContainerRef.current || firstPageWidth <= 0) return;
    const containerWidth = scrollContainerRef.current.clientWidth - 48;
    const targetScale = Math.max(Math.min(containerWidth / firstPageWidth, 2.5), 0.5);
    setScale(Math.round(targetScale * 100) / 100);
  };

  const rotate = () => setRotation((prev) => (prev + 90) % 360);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  // Scroll to page
  const scrollToPage = (pageNum: number) => {
    const clamped = Math.max(1, Math.min(pageNum, numPages));
    setCurrentPage(clamped);
    const targetEl = document.getElementById(`pdf-page-${clamped}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setReloadTrigger((prev) => prev + 1);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex flex-col size-full overflow-hidden rounded-xl bg-muted/40 border border-border/60",
        isFullscreen && "fixed inset-0 z-50 rounded-none border-0 bg-background",
        className
      )}
      aria-label={title || "PDF Document Viewer"}
    >
      {/* Sleek Custom Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border/60 bg-background/80 backdrop-blur-md z-20 shrink-0">
        {/* Left: Page navigation & Optional Title */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => scrollToPage(currentPage - 1)}
            disabled={currentPage <= 1 || loading || !!error}
            title="Previous page"
            aria-label="Previous page"
          >
            <IconChevronLeft size={16} />
          </Button>

          <div className="flex items-center gap-1 px-1.5 text-xs font-semibold text-foreground select-none">
            <span>Page</span>
            <input
              type="number"
              min={1}
              max={numPages || 1}
              value={currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) scrollToPage(val);
              }}
              disabled={loading || !!error}
              className="w-10 h-6 px-1 text-center font-bold text-xs rounded border border-border/80 bg-background focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
            <span className="text-muted-foreground font-normal">of {numPages || "–"}</span>
          </div>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => scrollToPage(currentPage + 1)}
            disabled={currentPage >= numPages || loading || !!error}
            title="Next page"
            aria-label="Next page"
          >
            <IconChevronRight size={16} />
          </Button>
        </div>

        {/* Center: Zoom & View Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={zoomOut}
            disabled={scale <= 0.5 || loading || !!error}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <IconZoomOut size={16} />
          </Button>

          <button
            type="button"
            onClick={zoomReset}
            disabled={loading || !!error}
            className="px-2 py-0.5 text-xs font-semibold rounded hover:bg-muted text-foreground transition-colors select-none"
            title="Reset to 100%"
          >
            {Math.round(scale * 100)}%
          </button>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={zoomIn}
            disabled={scale >= 2.5 || loading || !!error}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <IconZoomIn size={16} />
          </Button>

          <div className="h-4 w-px bg-border/60 mx-1" />

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={fitWidth}
            disabled={loading || !!error}
            title="Fit to width"
            aria-label="Fit to width"
          >
            <IconArrowsHorizontal size={16} />
          </Button>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={rotate}
            disabled={loading || !!error}
            title="Rotate clockwise"
            aria-label="Rotate clockwise"
          >
            <IconRotateClockwise size={16} />
          </Button>
        </div>

        {/* Right: Fullscreen & Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <IconMinimize size={16} /> : <IconMaximize size={16} />}
          </Button>

          {downloadUrl && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-7 px-2.5 gap-1.5 text-xs font-semibold"
            >
              <a href={downloadUrl} download>
                <IconDownload size={14} />
                <span className="hidden sm:inline">Download</span>
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Main Document Viewport */}
      <div
        ref={scrollContainerRef}
        className="relative flex-1 overflow-auto p-4 sm:p-6 flex flex-col items-center custom-scrollbar"
      >
        {/* Loading State */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 backdrop-blur-xs z-30">
            <div className="relative flex items-center justify-center">
              <div className="size-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-primary">
                <IconLoader2 size={20} className="animate-spin text-primary" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-foreground">Loading PDF document...</p>
              <p className="text-xs text-muted-foreground">Rendering pages into custom viewer</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="my-auto flex flex-col items-center justify-center text-center p-6 max-w-md rounded-xl border border-destructive/30 bg-destructive/5">
            <IconAlertCircle size={36} className="text-destructive mb-3" />
            <h3 className="text-sm font-bold text-foreground mb-1">Unable to Display PDF</h3>
            <p className="text-xs text-muted-foreground mb-4">{error}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRetry} className="gap-1.5 text-xs">
                <IconRefresh size={14} />
                Retry
              </Button>
              {downloadUrl && (
                <Button asChild size="sm" className="gap-1.5 text-xs">
                  <a href={downloadUrl} download>
                    <IconDownload size={14} />
                    Download File
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Rendered Document Pages */}
        {!loading && !error && pdfDoc && numPages > 0 && (
          <div className="flex flex-col items-center w-full">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <PdfPageItem
                key={`${pageNum}-${rotation}`}
                pdfDoc={pdfDoc}
                pageNumber={pageNum}
                scale={scale}
                rotation={rotation}
                onVisible={setCurrentPage}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
