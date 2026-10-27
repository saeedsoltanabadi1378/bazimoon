/** Curated Persian word ladders. Adjacent words differ by exactly one letter. */
export const FA_LADDER_PATHS = [
  ["بازی", "رازی", "راضی", "قاضی"],
  ["تازه", "سازه", "ساده", "باده"],
  ["ساده", "باده", "بنده", "زنده"],
  ["بارش", "کارش", "کاهش", "کاهل"],
  ["ماری", "کاری", "کافی", "صافی"],
  ["موزه", "روزه", "روزی", "رازی", "بازی"],
  ["سایه", "مایه", "پایه", "پاره", "باره"],
] as const;

export const FA_LADDER_WORDS = [...new Set(FA_LADDER_PATHS.flat())];
