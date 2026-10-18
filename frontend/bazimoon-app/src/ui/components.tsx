import { forwardRef, useEffect, type CSSProperties, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { setThemeColor } from "../lib/platform";
import { useLanguage } from "../i18n/LanguageContext";

export type Theme = "night" | "day" | "hub";

const themeBackground: Record<Theme, string> = { night: "#0B0D1A", day: "#14110D", hub: "#101218" };

/** Full-height screen: header, scrolling body, optional fixed footer bar or tab bar. */
export function Screen({ theme, children, label }: { theme: Theme; children: ReactNode; label?: string }) {
  useEffect(() => {
    setThemeColor(themeBackground[theme]);
  }, [theme]);
  return (
    <main className="screen" data-theme={theme} aria-label={label}>
      {children}
    </main>
  );
}

export function Body({ children, tight, style }: { children: ReactNode; tight?: boolean; style?: CSSProperties }) {
  return <div className={`screen__body${tight ? " screen__body--tight" : ""}`} style={style}>{children}</div>;
}

export function Bar({ children, row }: { children: ReactNode; row?: boolean }) {
  return <div className={`screen__bar${row ? " screen__bar--row" : ""}`}>{children}</div>;
}

export const IconButton = forwardRef<HTMLButtonElement, {
  icon: IconName;
  label: string;
  onClick?: () => void;
  round?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
}>(function IconButton({ icon, label, onClick, round, disabled, style }, ref) {
  const flip = icon === "back" || icon === "forward" || icon === "prev";
  return (
    <button ref={ref} type="button" className={`icon-btn${round ? " icon-btn--round" : ""}`} aria-label={label} onClick={onClick} disabled={disabled} style={style}>
      <span className={flip ? "flip-rtl" : undefined} style={{ display: "flex" }}>
        <Icon name={icon} size={icon === "close" ? 20 : 22} />
      </span>
    </button>
  );
});

/** Back button + title block used at the top of most sub-screens. */
export function TopBar({ onBack, backLabel, title, subtitle, right, titleSize = 26 }: {
  onBack?: () => void;
  backLabel?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  titleSize?: number;
}) {
  const { t } = useLanguage();
  return (
    <header className="topbar">
      {onBack && <IconButton icon="back" label={backLabel ?? t("back")} onClick={onBack} />}
      <div className="topbar__text">
        <h1 className="display" style={{ fontSize: titleSize }}>{title}</h1>
        {subtitle && <div className="tiny muted">{subtitle}</div>}
      </div>
      {right}
    </header>
  );
}

/** Kicker + big title header used by the Mafia phases ("NIGHT FALLS / Night 2"). */
export function PhaseHeader({ kicker, title, right }: { kicker: ReactNode; title: ReactNode; right?: ReactNode }) {
  return (
    <header className="topbar topbar--split">
      <div>
        <div className="kicker">{kicker}</div>
        <h1 className="h1" style={{ marginTop: 2 }}>{title}</h1>
      </div>
      {right}
    </header>
  );
}

export function Avatar({ name, color, size = 36, fontSize, style }: { name: string; color: string; size?: number; fontSize?: number; style?: CSSProperties }) {
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{ width: size, height: size, background: color, fontSize: fontSize ?? Math.round(size * 0.4), ...style }}
    >
      {initialOf(name)}
    </span>
  );
}

export function initialOf(name: string) {
  const trimmed = name.replace(/^@/, "").trim();
  return Array.from(trimmed)[0]?.toUpperCase() ?? "?";
}

export function ProgressBar({ value, color, height = 6, track, label }: { value: number; color?: string; height?: number; track?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className="progress"
      style={{ height, background: track }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Stat({ label, value, color, center, large }: { label: ReactNode; value: ReactNode; color?: string; center?: boolean; large?: boolean }) {
  return (
    <div className={`stat${center ? " stat--center" : ""}`}>
      {center ? (
        <>
          <div className="stat__value" style={{ color, fontSize: large ? 20 : 18 }}>{value}</div>
          <div className="stat__label">{label}</div>
        </>
      ) : (
        <>
          <div className="stat__label">{label}</div>
          <div className={`stat__value${large ? " stat__value--lg" : ""}`} style={{ color }}>{value}</div>
        </>
      )}
    </div>
  );
}

export function Banner({ icon, iconColor, children, background, tone }: {
  icon?: IconName;
  iconColor?: string;
  children: ReactNode;
  background?: string;
  tone?: "error";
}) {
  return (
    <div className={`banner${tone === "error" ? " banner--error" : ""}`} style={{ background }} role={tone === "error" ? "alert" : undefined}>
      {icon && <span className="banner__icon"><Icon name={icon} size={18} color={iconColor} /></span>}
      <span>{children}</span>
    </div>
  );
}

/** Round tinted icon disc used for heroes, role badges and empty states. */
export function IconDisc({ icon, size, iconSize, bg, fg, radius = 999, strokeWidth = 1.8 }: {
  icon: IconName;
  size: number;
  iconSize: number;
  bg: string;
  fg: string;
  radius?: number;
  strokeWidth?: number;
}) {
  return (
    <div style={{ width: size, height: size, flex: "none", borderRadius: radius, background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icon name={icon} size={iconSize} strokeWidth={strokeWidth} />
    </div>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange, label, soft, role = "radiogroup" }: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  soft?: boolean;
  role?: "radiogroup" | "tablist";
}) {
  const itemRole = role === "tablist" ? "tab" : "radio";
  return (
    <div className={`segmented${soft ? " segmented--soft" : ""}`} role={role} aria-label={label}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role={itemRole}
            aria-checked={itemRole === "radio" ? on : undefined}
            aria-selected={itemRole === "tab" ? on : undefined}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ on }: { on: boolean }) {
  return <span className={`switch${on ? " switch--on" : ""}`} aria-hidden="true" />;
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="toast" role="status">{message}</div>;
}

/** Tinted capsule with a role icon — "Godfather", "Team: Town", role chips in the lobby. */
export function RoleTag({ icon, label, bg, fg, size = "md" }: { icon: IconName; label: ReactNode; bg: string; fg: string; size?: "sm" | "md" }) {
  const sm = size === "sm";
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: sm ? "5px 10px" : "8px 14px",
        borderRadius: 999, background: bg, color: fg, fontSize: sm ? 12 : 15, fontWeight: 600, whiteSpace: "nowrap",
      }}
    >
      <Icon name={icon} size={sm ? 13 : 16} />
      {label}
    </span>
  );
}
