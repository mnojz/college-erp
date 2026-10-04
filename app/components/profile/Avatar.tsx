const AVATAR_COLORS = [
  "#1e66f5", // blue
  "#179299", // teal
  "#df8e1d", // yellow
  "#8839ef", // mauve
  "#d20f39", // red
  "#fe640b", // peach
  "#209fb5", // sapphire
  "#40a02b", // green
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