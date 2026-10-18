import { useLanguage } from "../../i18n/LanguageContext";

/** The round's letter in the top corner of every Esm-Famil board ("?" before it is drawn). */
export function EsmLetterChip({ letter, hidden }: { letter: string; hidden?: boolean }) {
  const { t } = useLanguage();
  return (
    <span
      className="display"
      aria-label={hidden ? undefined : t("esmLetterIs", { letter })}
      style={{
        width: 44, height: 44, borderRadius: 14, background: hidden ? "var(--surface)" : "#F6C377", color: hidden ? "var(--faint)" : "#2A1A06",
        fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {hidden ? "?" : letter}
    </span>
  );
}
