"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconCamera, IconLoader2, IconUser, IconZoomIn } from "@tabler/icons-react";
import { ProfileImagePreviewModal } from "@/app/components/profile/ProfileImagePreviewModal";
import {
  BLUR_MIN_VARIANCE,
  checkPassportFace,
  laplacianVariance,
} from "@/app/lib/avatar-checks";
import { submitAvatarForReview } from "@/app/actions/profile-review";
import { AvatarCropDialog } from "@/app/components/profile/AvatarCropDialog";

type Props = {
  currentAvatarUrl: string | null;
  /** A profile PICTURE is currently awaiting admin review. */
  avatarPending: boolean;
  /** The last profile PICTURE submission was rejected (not a data edit). */
  avatarRejected: boolean;
  /** Server pending avatar URL awaiting review */
  pendingAvatarUrl?: string | null;
  /** Callback fired immediately when user confirms cropping & upload */
  onAvatarUploaded?: (dataUrl: string) => void;
};

/**
 * Two-step profile-picture verification (user-facing half):
 *
 *  1. Pick an image → crop it to a passport-style square (AvatarCropDialog).
 *  2. Run local gates on the CROPPED result BEFORE any upload — Laplacian
 *     blur check + passport face check via @mediapipe/tasks-vision (single
 *     face, head straight, eyes unobscured, framed head-to-chest).
 *  3. On pass, a Server Action stages the picture as PENDING_REVIEW; an admin
 *     later approves/rejects it at /admin/profile-reviews.
 */
export function ProfilePictureUpload({
  currentAvatarUrl,
  avatarPending,
  avatarRejected,
  pendingAvatarUrl,
  onAvatarUploaded,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);

  const effectiveAvatarUrl = localAvatarUrl || pendingAvatarUrl || currentAvatarUrl;
  const isPending = Boolean(localAvatarUrl || avatarPending || pendingAvatarUrl);

  /** Read a chosen file into a data-URL and open the crop dialog. */
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (JPEG, PNG, or WebP).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.onerror = () => toast.error("Could not read the file.");
    reader.readAsDataURL(file);
  }

  /** After cropping: run the local verification gates, then stage for review. */
  async function handleCropConfirm(croppedDataUrl: string) {
    setCropSrc(null);
    setBusy(true);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Could not decode the image."));
        img.src = croppedDataUrl;
      });

      // Gate 1: blur / noise — Laplacian variance.
      setPhase("Checking image quality…");
      const variance = laplacianVariance(img);
      if (variance < BLUR_MIN_VARIANCE) {
        toast.error(
          `Photo rejected: too blurry or low-quality (sharpness ${variance.toFixed(0)} < ${BLUR_MIN_VARIANCE}). Please use a clearer photo.`,
        );
        return;
      }

      // Gate 2: passport face check (single, straight, framed) + obstruction
      // check (eyewear incl. sunglasses / mask / closed eyes) — all inside
      // checkPassportFace.
      setPhase("Checking photo…");
      const face = await checkPassportFace(img);
      if (!face.ok) {
        toast.error(face.reason);
        return;
      }

      // All gates passed — stage for admin review.
      setPhase("Submitting for review…");
      const res = await submitAvatarForReview(croppedDataUrl);
      if (!res.ok) {
        toast.error(res.error ?? "Unable to submit the photo.");
        return;
      }

      // Optimistically update local preview right away
      setLocalAvatarUrl(croppedDataUrl);
      onAvatarUploaded?.(croppedDataUrl);

      toast.success(
        "Photo uploaded! It is displayed temporarily and will become permanent once approved by an administrator.",
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
      setPhase(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Header row with title & status badges */}
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <IconCamera className="size-3.5 text-primary" aria-hidden="true" />
          Profile Photo
        </h4>
        <div className="flex items-center gap-1.5 shrink-0">
          {isPending && (
            <Badge className="border-0 bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold text-[11px] py-0 px-2">
              Pending review
            </Badge>
          )}
          {avatarRejected && !isPending && (
            <Badge className="border-0 bg-rose-500/15 text-rose-700 dark:text-rose-400 font-semibold text-[11px] py-0 px-2">
              Last photo rejected
            </Badge>
          )}
        </div>
      </div>

      {/* Main compact row: Avatar on left, Action & short instruction on right */}
      <div className="flex items-center gap-3.5">
        {effectiveAvatarUrl ? (
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="group relative size-16 shrink-0 rounded-xl border border-border/80 overflow-hidden cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-transform duration-200 hover:scale-[1.03] shadow-xs"
            title={isPending ? "Click to view temporary photo (pending review)" : "Click to view full photo"}
            aria-label="View enlarged profile photo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={effectiveAvatarUrl}
              alt="Profile photo preview"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center text-white backdrop-blur-[1px]">
              <IconZoomIn className="size-4 drop-shadow-md" aria-hidden="true" />
            </div>
            {isPending && (
              <div className="absolute bottom-0 inset-x-0 bg-black/70 backdrop-blur-xs py-0.5 text-center">
                <span className="text-[8px] font-bold text-amber-300 tracking-wider uppercase">Pending</span>
              </div>
            )}
          </button>
        ) : (
          <div
            className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground shadow-2xs border border-border/50"
            role="img"
            aria-label="Profile photo placeholder"
          >
            <IconUser className="size-8 text-muted-foreground/60" stroke={1.5} />
          </div>
        )}

        <div className="flex flex-col gap-1 min-w-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="w-fit h-8 px-3 text-xs font-semibold gap-1.5 shadow-2xs"
          >
            {busy ? (
              <IconLoader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <IconCamera className="size-3.5 text-primary" aria-hidden="true" />
            )}
            {busy ? "Checking…" : effectiveAvatarUrl ? "Change photo" : "Upload photo"}
          </Button>
          <p className="m-0 text-xs text-muted-foreground">
            Use passport size photo.
          </p>
          {phase && (
            <p className="m-0 text-xs font-medium text-primary animate-pulse" aria-live="polite">
              {phase}
            </p>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFileChange(e)}
        />
      </div>

      <AvatarCropDialog
        src={cropSrc}
        onCancel={() => setCropSrc(null)}
        onConfirm={(url) => void handleCropConfirm(url)}
      />
      <ProfileImagePreviewModal
        open={showPreview}
        onOpenChange={setShowPreview}
        imageUrl={effectiveAvatarUrl}
        name="Profile Photo"
        subtitle={isPending ? "Temporary photo awaiting administrator review" : "Current active profile photo"}
        badge={isPending ? "Pending Review" : undefined}
      />
    </div>
  );
}