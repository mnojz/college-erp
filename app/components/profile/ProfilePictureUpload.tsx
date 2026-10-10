"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconCamera, IconLoader2 } from "@tabler/icons-react";
import {
  BLUR_MIN_VARIANCE,
  checkPassportFace,
  laplacianVariance,
} from "@/app/lib/avatar-checks";
import { submitAvatarForReview } from "@/app/actions/profile-review";
import { AvatarCropDialog } from "@/app/components/profile/AvatarCropDialog";

type Props = {
  currentAvatarUrl: string | null;
  profileReviewStatus: "APPROVED" | "PENDING_REVIEW" | "REJECTED";
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
export function ProfilePictureUpload({ currentAvatarUrl, profileReviewStatus }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

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

      // Gate 2: passport face check (single, straight, eyes open, neutral, framed).
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
      toast.success(
        "Photo submitted! An administrator will review it shortly — you'll be notified when it goes live.",
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
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          Profile Photo
          {profileReviewStatus === "PENDING_REVIEW" && (
            <Badge variant="secondary">Pending review</Badge>
          )}
          {profileReviewStatus === "REJECTED" && (
            <Badge variant="destructive">Last photo rejected</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-4">
        {currentAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentAvatarUrl}
            alt="Current profile photo"
            className="size-20 rounded-xl border object-cover"
          />
        ) : (
          <span
            className="flex size-20 items-center justify-center rounded-xl border bg-primary/10 text-sm font-semibold text-primary"
            role="img"
            aria-label="No profile photo yet"
          >
            No photo
          </span>
        )}
        <div className="grid gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="w-fit"
          >
            {busy ? (
              <IconLoader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <IconCamera className="size-4" aria-hidden="true" />
            )}
            {busy ? "Checking…" : "Upload new photo"}
          </Button>
          <p className="m-0 max-w-72 text-xs text-muted-foreground">
            You&apos;ll crop a passport-style photo (head to chest, facing forward,
            eyes open, neutral expression). It&apos;s checked automatically and then
            reviewed by an administrator before going live.
          </p>
          {phase && (
            <p className="m-0 text-xs text-muted-foreground" aria-live="polite">
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
      </CardContent>
      <AvatarCropDialog
        src={cropSrc}
        onCancel={() => setCropSrc(null)}
        onConfirm={(url) => void handleCropConfirm(url)}
      />
    </Card>
  );
}