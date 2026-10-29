import type { ReactNode } from "react";

// Stroke icons lifted from the design canvas (24×24, round caps). Text-colored via currentColor.
const paths = {
  back: <path d="m15 5-7 7 7 7" />,
  forward: <path d="m9 6 6 6-6 6" />,
  target: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
  mute: <path d="M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6" />,
  eye: <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
  grave: <path d="M7 21V10a5 5 0 0 1 10 0v11zM10 14h4M12 12v5" />,
  arrowSend: <path d="M4 12h15M13 6l6 6-6 6" />,
  townHall: <path d="M4 21h16M6 21V10l6-5 6 5v11M10 21v-5h4v5" />,
  prev: <path d="m15 6-6 6 6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12 5 5 9-10" />,
  globe: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />,
  people: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" /></>,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  sun: <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M7 7 5.5 5.5M18.5 18.5 17 17M7 17l-1.5 1.5M18.5 5.5 17 7M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />,
  eyeOff: <path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3 3.6M6.6 6.6C3.9 8.3 2 12 2 12s4 6 10 6a9.6 9.6 0 0 0 4.1-.9M9.9 9.9a3 3 0 0 0 4.2 4.2" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5h1" /></>,
  godfather: <path d="M4 18h16l-2-10-4 4-2-6-2 6-4-4z" />,
  crown: <><path d="M4 18h16l-2-10-4 4-2-6-2 6-4-4z" /><path d="M4 21h16" /></>,
  mafia: <path d="M3 8c3-2 6-2 9 0 3-2 6-2 9 0-1 5-4 8-9 8S4 13 3 8z" />,
  detective: <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5" />,
  doctor: <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />,
  villager: <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />,
  home: <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />,
  eliminated: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 9l6 6M15 9l-6 6" />,
  coffin: <path d="M6 4h12v16l-6-4-6 4z" />,
  scales: <path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z" />,
  flame: <path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z" />,
  trophy: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />,
  trophyFull: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  micOff: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /><path d="M4 4l16 16" /></>,
  warning: <path d="M12 8v5M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />,
  alert: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16h.01" />,
  wifiOff: <path d="M2 8.8a15 15 0 0 1 20 0M5 12.6a10 10 0 0 1 14 0M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M3 3l18 18" />,
  refresh: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />,
  clock: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2" />,
  send: <path d="M21 4 3 11l6 2 2 6 3-4 5 4z" />,
  searchMinus: <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5M8 11h6" />,
  wrench: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />,
  sliders: <path d="M4 6h9M17 6h3M15 4v4M4 12h3M11 12h9M9 10v4M4 18h11M19 18h1M17 16v4" />,
  cloudUp: <path d="M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9zM12 11v5M9.5 13.5 12 11l2.5 2.5" />,
  logout: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />,
  download: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  bell: <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />,
  shield: <path d="M12 21s-7-4.5-7-11V5l7-2 7 2v5c0 6.5-7 11-7 11z" />,
  heart: <path d="M12 21s-7-4.4-9.3-9A5.2 5.2 0 0 1 12 6.3 5.2 5.2 0 0 1 21.3 12C19 16.6 12 21 12 21z" />,
  snowflake: <path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1 19.1 4.9" />,
  zip: <path d="M5 5h6v6h8v8H5z" />,
  zipFull: <><path d="M5 5h6v6h8v8H5z" /><circle cx="5" cy="5" r="1.5" /><circle cx="19" cy="19" r="1.5" /></>,
  merge: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  mine: <path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />,
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  memory: <path d="M4 5h7v14H4zM13 5h7v14h-7z" />,
  cards: <path d="M6 3h12v18H6zM12 8c-2 2-3 3-3 4.5a3 3 0 0 0 6 0C15 11 14 10 12 8z" />,
  word: <path d="M4 5h4v4H4zM10 5h4v4h-4zM16 5h4v4h-4zM4 11h4v4H4zM10 11h4v4h-4zM16 11h4v4h-4z" />,
  ladder: <path d="M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10" />,
  stack: <path d="M6 18h12v3H6zM7 13h10v3H7zM8 8h8v3H8zM9 3h6v3H9z" />,
  blocks: <path d="M4 4h6v6H4zM10 10h6v6h-6zM4 14h6v6H4zM14 4h6v6h-6z" />,
  snake: <path d="M4 18h9a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h8M17 6h3" />,
  phone: <path d="M7 2h10v20H7zM11 18h2" />,
  dooz: <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />,
  spy: <path d="M3 11h18M6 11l1.5-6h9L18 11M8 17a2.5 2.5 0 1 0 0-.01M16 17a2.5 2.5 0 1 0 0-.01M10.5 17h3" />,
  esmFamil: <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />,
  undo: <path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />,
  bulb: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" />,
  dice: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 9h.01M15 15h.01M15 9h.01M9 15h.01" /></>,
  share: <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13" />,
  link: <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  skip: <path d="m5 4 10 8-10 8zM19 5v14" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
  /** Pass a label only when the icon carries meaning on its own; decorative icons stay hidden. */
  label?: string;
}

export function Icon({ name, size = 22, strokeWidth = 2, className, color, label }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ flex: "none" }}
    >
      {paths[name]}
    </svg>
  );
}
