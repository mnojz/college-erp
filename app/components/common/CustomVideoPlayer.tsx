"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconCheck,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconRepeat,
  IconRewindBackward5,
  IconRewindForward5,
  IconVolume,
  IconVolume2,
  IconVolumeOff,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CustomVideoPlayerProps = {
  src: string;
  title?: string;
  poster?: string;
  openUrl?: string;
  downloadName?: string;
  autoPlay?: boolean;
  loop?: boolean;
  className?: string;
  fillParent?: boolean;
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number, forceHours = false): string {
  if (!Number.isFinite(seconds) || seconds < 0) return forceHours ? "00:00:00" : "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0 || forceHours) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function VolumeIcon({ volume, muted }: { volume: number; muted: boolean }) {
  if (muted || volume === 0) return <IconVolumeOff size={22} className="text-muted-foreground" />;
  if (volume < 0.5) return <IconVolume2 size={22} className="text-foreground" />;
  return <IconVolume size={22} className="text-foreground" />;
}

type HudState = {
  type: "play" | "pause" | "forward" | "backward" | "volume" | "mute";
  text?: string;
  key: number;
} | null;

export function CustomVideoPlayer({
  src,
  title,
  poster,
  autoPlay = false,
  loop = false,
  className,
  fillParent = false,
}: CustomVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLooping, setIsLooping] = useState(loop);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [hud, setHud] = useState<HudState>(null);

  // Scrubber hover state
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const hudTimer = useRef<NodeJS.Timeout | null>(null);
  const lastNonZeroVolume = useRef(1);

  // 60fps smooth playback tracking via requestAnimationFrame
  useEffect(() => {
    let animId: number;
    const updateSmoothTime = () => {
      const v = videoRef.current;
      if (v && !isScrubbing) {
        setCurrentTime(v.currentTime);
      }
      if (playing && !isScrubbing) {
        animId = requestAnimationFrame(updateSmoothTime);
      }
    };

    if (playing && !isScrubbing) {
      animId = requestAnimationFrame(updateSmoothTime);
    }
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [playing, isScrubbing]);

  const showHud = useCallback(
    (type: "play" | "pause" | "forward" | "backward" | "volume" | "mute", text?: string) => {
      if (hudTimer.current) clearTimeout(hudTimer.current);
      setHud({ type, text, key: Date.now() });
      hudTimer.current = setTimeout(() => {
        setHud(null);
      }, 700);
    },
    []
  );

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      video
        .play()
        .then(() => {
          showHud("play", "Play");
        })
        .catch(() => {});
    } else {
      video.pause();
      showHud("pause", "Pause");
    }
  }, [showHud]);

  const changeVolume = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video) return;
      const next = Math.max(0, Math.min(1, Math.round((video.volume + delta) * 100) / 100));
      video.volume = next;
      video.muted = next === 0;
      setVolume(next);
      setMuted(next === 0);
      if (next > 0) lastNonZeroVolume.current = next;
      showHud("volume", `${Math.round(next * 100)}%`);
    },
    [showHud]
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted || video.volume === 0) {
      const restore = lastNonZeroVolume.current > 0 ? lastNonZeroVolume.current : 0.5;
      video.muted = false;
      video.volume = restore;
      setVolume(restore);
      setMuted(false);
      showHud("volume", `${Math.round(restore * 100)}%`);
    } else {
      video.muted = true;
      setMuted(true);
      showHud("mute", "Muted");
    }
  }, [showHud]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, newVolume));
    video.volume = clamped;
    video.muted = clamped === 0;
    setVolume(clamped);
    setMuted(clamped === 0);
    if (clamped > 0) lastNonZeroVolume.current = clamped;
  }, []);

  const seekRelative = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (!video) return;
      const dur = video.duration || 0;
      const newTime = Math.max(0, Math.min(dur, video.currentTime + seconds));
      video.currentTime = newTime;
      setCurrentTime(newTime);
      if (seconds > 0) {
        showHud("forward", `+${seconds}s`);
      } else {
        showHud("backward", `${seconds}s`);
      }
    },
    [showHud]
  );

  const seekTo = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const dur = video.duration || 0;
    const clamped = Math.max(0, Math.min(dur, seconds));
    video.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      try {
        await container.requestFullscreen();
      } catch {
        // Fullscreen not permitted
      }
    } else {
      try {
        await document.exitFullscreen();
      } catch {
        // Ignored
      }
    }
  }, []);

  const selectSpeed = useCallback(
    (speed: number) => {
      if (videoRef.current) {
        videoRef.current.playbackRate = speed;
      }
      setPlaybackSpeed(speed);
      setShowSpeedMenu(false);
      showHud("forward", `${speed}x speed`);
    },
    [showHud]
  );

  const toggleLoop = useCallback(() => {
    setIsLooping((prev) => {
      const next = !prev;
      if (videoRef.current) videoRef.current.loop = next;
      return next;
    });
  }, []);

  // Scrubber mouse drag events
  const handleScrubberMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    const video = videoRef.current;
    if (!bar || !video || !duration) return;

    setIsScrubbing(true);
    const rect = bar.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = pos * duration;
    video.currentTime = targetTime;
    setCurrentTime(targetTime);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const movePos = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
      const moveTime = movePos * duration;
      video.currentTime = moveTime;
      setCurrentTime(moveTime);
    };

    const onMouseUp = () => {
      setIsScrubbing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleScrubberMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * duration);
  };

  const handleScrubberMouseLeave = () => {
    setHoverPosition(null);
    setHoverTime(null);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (e.key) {
      case " ":
      case "k":
      case "K":
        e.preventDefault();
        togglePlay();
        break;
      case "ArrowLeft":
      case "j":
      case "J":
        e.preventDefault();
        seekRelative(-5);
        break;
      case "ArrowRight":
      case "l":
      case "L":
        e.preventDefault();
        seekRelative(5);
        break;
      case "ArrowUp":
        e.preventDefault();
        changeVolume(0.05);
        break;
      case "ArrowDown":
        e.preventDefault();
        changeVolume(-0.05);
        break;
      case "m":
      case "M":
        e.preventDefault();
        toggleMute();
        break;
      case "f":
      case "F":
        e.preventDefault();
        toggleFullscreen();
        break;
      case "Home":
        e.preventDefault();
        seekTo(0);
        break;
      case "End":
        e.preventDefault();
        if (duration) seekTo(duration);
        break;
      default:
        if (e.key >= "0" && e.key <= "9" && duration > 0) {
          e.preventDefault();
          const percent = parseInt(e.key, 10) / 10;
          seekTo(percent * duration);
        }
        break;
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;
  const isOverAnHour = duration >= 3600;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="region"
      aria-label={title || "Video Player"}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-800 bg-card select-none outline-hidden focus-visible:ring-2 focus-visible:ring-primary/60",
        fillParent ? "size-full h-full w-full" : "w-full aspect-video max-h-140",
        isFullscreen && "fixed inset-0 z-50 h-screen w-screen rounded-none border-0",
        className
      )}
    >
      {/* Video Viewport Area */}
      <div
        className="relative flex-1 min-h-0 size-full flex items-center justify-center overflow-hidden cursor-pointer bg-black"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          autoPlay={autoPlay}
          loop={isLooping}
          playsInline
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={() => {
            if (!isScrubbing && videoRef.current) {
              setCurrentTime(videoRef.current.currentTime);
              if (videoRef.current.buffered.length > 0) {
                setBuffered(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
              }
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
              setVolume(videoRef.current.volume);
              setMuted(videoRef.current.muted);
            }
          }}
          onError={() => setHasError(true)}
          className="size-full object-contain pointer-events-none"
        />

        {/* Error state */}
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-6 text-center text-white z-40 pointer-events-auto">
            <p className="text-base font-semibold">Unable to play video</p>
            <p className="text-xs text-white/70 mt-1.5 max-w-sm leading-relaxed">
              This video format may not be supported by your browser or cannot be decoded directly.
            </p>
          </div>
        )}

        {/* Big Center Play Button when paused */}
        {!playing && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none transition-opacity">
            <div className="flex size-16 items-center justify-center rounded-full bg-card/90 text-foreground shadow-2xl backdrop-blur-md transition-all hover:scale-105 border border-slate-200 dark:border-zinc-800">
              <IconPlayerPlayFilled size={28} className="ml-1 text-primary fill-primary" />
            </div>
          </div>
        )}

        {/* Center Animated HUD for Keyboard Actions */}
        {hud && (
          <div
            key={hud.key}
            className="pointer-events-none absolute inset-0 flex items-center justify-center z-30 animate-in fade-in zoom-in-90 duration-150"
          >
            <div className="flex items-center gap-2.5 rounded-full bg-card/95 px-5 py-2.5 text-foreground backdrop-blur-md shadow-2xl border border-slate-200 dark:border-zinc-800">
              {hud.type === "play" && <IconPlayerPlayFilled size={20} className="text-primary fill-primary" />}
              {hud.type === "pause" && <IconPlayerPauseFilled size={20} className="text-primary fill-primary" />}
              {hud.type === "forward" && <IconRewindForward5 size={20} className="text-primary" />}
              {hud.type === "backward" && <IconRewindBackward5 size={20} className="text-primary" />}
              {hud.type === "volume" && <IconVolume size={20} className="text-primary" />}
              {hud.type === "mute" && <IconVolumeOff size={20} className="text-destructive" />}
              {hud.text && <span className="text-xs font-bold tracking-wide">{hud.text}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Solid Color Single-Row Fluent UI Bottom Bar (Sticking to bottom, app theme color) */}
      <div className="w-full shrink-0 flex items-center gap-2.5 sm:gap-3.5 px-3 sm:px-4 py-2 sm:py-2.5 border-t border-slate-200 dark:border-zinc-800 bg-card text-card-foreground shadow-xs select-none z-30">
        {/* Play/Pause Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={togglePlay}
          className="size-9 rounded-lg text-foreground hover:bg-muted cursor-pointer shrink-0"
          aria-label={playing ? "Pause (Space)" : "Play (Space)"}
          title={playing ? "Pause (Space)" : "Play (Space)"}
        >
          {playing ? (
            <IconPlayerPauseFilled size={22} className="text-foreground fill-foreground" />
          ) : (
            <IconPlayerPlayFilled size={22} className="ml-0.5 text-foreground fill-foreground" />
          )}
        </Button>

        {/* Current Elapsed Time */}
        <span className="font-mono text-xs font-semibold text-foreground/90 shrink-0 tabular-nums select-none">
          {formatTime(currentTime, isOverAnHour)}
        </span>

        {/* Thicker Single-Row Progress Bar (Fluent Media Style) */}
        <div
          ref={progressBarRef}
          onMouseDown={handleScrubberMouseDown}
          onMouseMove={handleScrubberMouseMove}
          onMouseLeave={handleScrubberMouseLeave}
          className="group/scrub relative flex-1 h-6 flex items-center cursor-pointer select-none"
        >
          {/* Hover Time Tooltip */}
          {hoverTime !== null && hoverPosition !== null && (
            <div
              className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded-md bg-popover px-2 py-0.5 text-[11px] font-mono font-medium text-popover-foreground shadow-md border border-slate-200 dark:border-zinc-800 select-none z-40"
              style={{ left: `${hoverPosition}%` }}
            >
              {formatTime(hoverTime, isOverAnHour)}
            </div>
          )}

          {/* Background Track (Thicker, Solid Theme) */}
          <div className="relative h-2 w-full rounded-full bg-muted transition-all duration-150 group-hover/scrub:h-2.5 overflow-hidden">
            {/* Buffered Track */}
            <div
              className="absolute inset-y-0 left-0 bg-muted-foreground/25 transition-all duration-150 pointer-events-none"
              style={{ width: `${bufferedPercent}%` }}
            />
            {/* Played Track (App Theme Accent Color) */}
            <div
              className="absolute inset-y-0 left-0 bg-primary pointer-events-none"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Scrubber Thumb */}
          <div
            className="absolute size-3.5 -translate-x-1/2 rounded-full bg-primary shadow-sm ring-2 ring-card scale-0 group-hover/scrub:scale-100 transition-transform duration-100"
            style={{ left: `${progressPercent}%` }}
          />
        </div>

        {/* Total Duration */}
        <span className="font-mono text-xs font-normal text-muted-foreground shrink-0 tabular-nums select-none">
          {formatTime(duration, isOverAnHour)}
        </span>

        {/* Right Section: Volume, Speed, Loop, Fullscreen */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Volume Group */}
          <div className="flex items-center gap-1 group/vol">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={toggleMute}
              className="size-9 rounded-lg text-foreground hover:bg-muted cursor-pointer shrink-0"
              aria-label={muted || volume === 0 ? "Unmute (m)" : "Mute (m)"}
              title={muted || volume === 0 ? "Unmute (m)" : "Mute (m)"}
            >
              <VolumeIcon volume={volume} muted={muted} />
            </Button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => handleVolumeChange(Number.parseFloat(e.target.value))}
              className="w-16 sm:w-20 h-1.5 accent-primary bg-muted rounded-full cursor-pointer hidden sm:block"
              aria-label="Volume"
              title={`Volume: ${muted ? 0 : Math.round(volume * 100)}%`}
            />
          </div>

          {/* Speed Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSpeedMenu((s) => !s)}
              className="px-2 py-1 rounded-md text-xs font-mono font-semibold border border-slate-200 dark:border-zinc-800 text-foreground hover:bg-muted hover:border-slate-300 dark:hover:border-zinc-700 transition-colors cursor-pointer select-none"
              title="Playback speed"
              aria-expanded={showSpeedMenu}
            >
              {playbackSpeed === 1 ? "1x" : `${playbackSpeed}x`}
            </button>

            {/* Speed Popover */}
            {showSpeedMenu && (
              <div
                className="absolute bottom-full right-0 mb-2 w-32 rounded-xl border border-slate-200 dark:border-zinc-800 bg-popover p-1.5 shadow-xl z-40 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-0.5 text-popover-foreground"
                onMouseLeave={() => setShowSpeedMenu(false)}
              >
                <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Speed
                </span>
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => selectSpeed(s)}
                    className={cn(
                      "flex items-center justify-between px-2 py-1 rounded-lg text-xs font-mono font-medium transition-colors text-left cursor-pointer",
                      playbackSpeed === s
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <span>{s === 1 ? "1.0x (Normal)" : `${s}x`}</span>
                    {playbackSpeed === s && <IconCheck size={12} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Loop Toggle */}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={toggleLoop}
            className={cn(
              "size-9 rounded-lg transition-colors cursor-pointer",
              isLooping
                ? "text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            title={isLooping ? "Looping: ON" : "Looping: OFF"}
            aria-label="Toggle loop"
          >
            <IconRepeat size={20} />
          </Button>

          {/* Fullscreen Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={toggleFullscreen}
            className="size-9 rounded-lg text-foreground hover:bg-muted cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen (f)" : "Fullscreen (f)"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <IconArrowsMinimize size={22} /> : <IconArrowsMaximize size={22} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
