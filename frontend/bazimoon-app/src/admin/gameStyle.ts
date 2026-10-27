/** Tile colours and icon path for each game in the admin console: [background, foreground, icon]. */
export const GAME_STYLE: Record<string, [string, string, string]> = {
  mafia: ["#2E2340", "#B79CF2", "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"],
  couple: ["#24121C", "#F2A7C3", "M12 21s-7-4.4-9.3-9A5.2 5.2 0 0 1 12 6.3 5.2 5.2 0 0 1 21.3 12C19 16.6 12 21 12 21z"],
  zip: ["#173A36", "#5FD0BE", "M5 5h6v6h8v8H5z"],
  queens: ["#2E2340", "#B79CF2", "M4 18h16l-2-10-4 4-2-6-2 6-4-4z"],
  sudoku: ["#12304A", "#7CC4FA", "M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18"],
  word: ["#14241A", "#9ED98C", "M4 5h4v4H4zM10 5h4v4h-4zM16 5h4v4h-4zM4 11h4v4H4zM10 11h4v4h-4zM16 11h4v4h-4z"],
  ladder: ["#3A2A16", "#F0A83A", "M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10"],
  mines: ["#2A1A1A", "#F08A7A", "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 2v3M12 19v3M2 12h3M19 12h3"],
  merge: ["#2A2650", "#9C8CFF", "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"],
  blocks: ["#25141E", "#F2B8D0", "M4 4h6v6H4zM10 10h6v6h-6zM4 14h6v6H4zM14 4h6v6h-6z"],
  stack: ["#13302C", "#5FD0BE", "M6 18h12v3H6zM7 13h10v3H7zM8 8h8v3H8zM9 3h6v3H9z"],
  memory: ["#1B2A44", "#8FA8FF", "M4 5h7v14H4zM13 5h7v14h-7z"],
  snake: ["#14241A", "#9ED98C", "M4 18h9a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h8M17 6h3"],
  dooz: ["#1E2138", "#C3B9FF", "M9 3v18M15 3v18M3 9h18M3 15h18"],
  spy: ["#2A1418", "#F08A7A", "M3 11h18M6 11l1.5-6h9L18 11M8 17a2.5 2.5 0 1 0 0-.01M16 17a2.5 2.5 0 1 0 0-.01M10.5 17h3"],
  esmfamil: ["#2A2113", "#F6C377", "M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"],
};
