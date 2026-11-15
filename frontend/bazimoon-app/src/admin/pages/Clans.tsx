import { useEffect, useState } from "react";
import { adminApi, type AdminClan } from "../adminApi";
import { useAdminI18n } from "../i18n";
import { Header, PageState, Search, openPlayer, useAdminData } from "../ui";

/** Every clan: who owns it, how big it is and how much it plays. An admin can delete one that
 * breaks the rules; its members are left without a clan and every deletion is audited. */
export function ClansPage() {
  const { t, n, date } = useAdminI18n();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const clans = useAdminData<AdminClan[]>(`/clans?search=${encodeURIComponent(query)}`);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  async function remove(clan: AdminClan) {
    setBusy(true);
    try {
      await adminApi.del(`/clans/${clan.id}`);
      setNotice(t("clanDeleted", { name: clan.name }));
      setConfirming(null);
      clans.reload();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const rows = clans.data;
  return (
    <main className="adm-main">
      <Header kicker={t("clansKicker")} title={t("clansTitle")}>
        <Search label={t("searchClans")} placeholder={t("searchClans")} value={search} onChange={setSearch} />
      </Header>
      {notice && <div className="adm-panel" role="status">{notice}</div>}
      {!rows ? <PageState error={clans.error} onRetry={clans.reload} /> : rows.length === 0 ? (
        <div className="adm-panel adm-empty">{query ? t("clansNoMatch") : t("clansNone")}</div>
      ) : (
        <div className="adm-panel flush">
          <div className="adm-table-wrap">
            <table className="adm-table" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th scope="col">{t("colClan")}</th>
                  <th scope="col">{t("colOwner")}</th>
                  <th scope="col">{t("colMembers")}</th>
                  <th scope="col">{t("colClanTables")}</th>
                  <th scope="col">{t("colVisibility")}</th>
                  <th scope="col">{t("colCreated")}</th>
                  <th scope="col"><span className="sr">{t("clanDelete")}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span aria-hidden="true" style={{ width: 12, height: 12, flex: "none", borderRadius: 4, background: c.color }} />
                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                          <b>{c.name}</b>
                          {c.bio && <span className="tiny muted" style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.bio}</span>}
                        </div>
                      </div>
                    </td>
                    <td><button type="button" className="adm-link" onClick={() => openPlayer(c.ownerId)}>{c.owner}</button></td>
                    <td className="num">{n(c.members)}</td>
                    <td className="num">{n(c.tables)}</td>
                    <td><span className="adm-pill" style={{ background: c.isListed ? "#13302C" : "#1E2138", color: c.isListed ? "#5FD0BE" : "#B79CF2" }}>{c.isListed ? t("clanListed") : t("clanInviteOnly")}</span></td>
                    <td className="text-2" style={{ whiteSpace: "nowrap" }}>{date(c.createdAt)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {confirming === c.id ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 280, whiteSpace: "normal" }}>
                          <span className="tiny">{t("clanDeleteConfirm", { name: c.name })}</span>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" className="adm-btn danger-fill" disabled={busy} onClick={() => void remove(c)}>{t("clanDeleteYes")}</button>
                            <button type="button" className="adm-btn" onClick={() => setConfirming(null)}>{t("cancel")}</button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" className="adm-btn danger" onClick={() => { setConfirming(c.id); setNotice(null); }}>{t("clanDelete")}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
