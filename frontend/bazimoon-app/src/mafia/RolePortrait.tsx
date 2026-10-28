import type { CSSProperties } from "react";
import type { Role } from "../api/types";
import { roleMeta } from "./roles";

/** Role artwork with a consistent crop at full-card and thumbnail sizes. */
export function RolePortrait({
  role,
  size,
  full = false,
  muted = false,
  className,
  style,
}: {
  role: Role;
  size: number;
  full?: boolean;
  muted?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const meta = roleMeta[role];
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        position: "relative",
        display: "inline-flex",
        width: size,
        height: size,
        flex: "none",
        overflow: "hidden",
        borderRadius: full ? 24 : 999,
        background: `radial-gradient(circle at 50% 35%, ${meta.bg}, #0E1020 72%)`,
        border: `1px solid ${meta.fg}55`,
        boxShadow: full ? `0 14px 34px ${meta.bg}AA` : "none",
        filter: muted ? "grayscale(1) opacity(.55)" : undefined,
        ...style,
      }}
    >
      <img
        src={meta.image}
        alt=""
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: full ? "center" : "50% 18%",
          transform: full ? undefined : "scale(1.55)",
          transformOrigin: "50% 24%",
          userSelect: "none",
        }}
      />
    </span>
  );
}
