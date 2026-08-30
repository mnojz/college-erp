const AVATAR_COLORS = [
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
  "#f97316",
  "#6366f1",
];

export type AvatarProps = {
  name: string;
  photoUrl?: string | null;
  size?: number;
};

/** Initials avatar with a stable per-name color; shows the photo when set. */
export function Avatar({ name, photoUrl, size = 44 }: AvatarProps) {
  const base = {
    width: size,
    height: size,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: Math.max(11, Math.round(size * 0.36)),
    fontWeight: 700,
    color: "#ffffff",
    overflow: "hidden",
  } as const;

  if (photoUrl) {
    return <img src={photoUrl} alt={name} style={{ ...base, objectFit: "cover" }} />;
  }

  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => (part[0] ?? "").toUpperCase())
      .join("") || "?";
  const hash = [...name].reduce((sum, ch) => sum + (ch.codePointAt(0) ?? 0), 0);
  const background = AVATAR_COLORS[hash % AVATAR_COLORS.length];

  return (
    <span style={{ ...base, background }} role="img" aria-label={name}>
      {initials}
    </span>
  );
}