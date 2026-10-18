/** The four-tile mark: amber, teal, lilac and pink for puzzles, games, Mafia and Couple Quiz. */
export function LogoTiles({ size = 34 }: { size?: number }) {
  const gap = Math.max(3, Math.round(size / 16));
  return (
    <span aria-hidden="true" style={{ width: size, height: size, flex: "none", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap }}>
      {["#F0A83A", "#5FD0BE", "#B79CF2", "#F2A7C3"].map((c) => <span key={c} style={{ borderRadius: Math.round(size * 0.15), background: c }} />)}
    </span>
  );
}
