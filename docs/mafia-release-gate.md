# Mafia launch release gate

This gate is intentionally Persian-first. A build is ready for marketing only when every automated check passes and the manual Iran-network matrix has no release-blocking issue.

## Automated checks

Run from the repository root:

```powershell
cd frontend/bazimoon-app
npx tsc -b
npm run lint
npm run test:rtl
cd ../..
dotnet test src/Bazimoon.Tests
```

`test:rtl` captures the Mafia lobby, night, day, voting, defence, results, ended state, and player-safety sheet in Persian at a 390 × 844 mobile viewport. It fails when the document is not `fa`/RTL or when a screen overflows horizontally. Screenshots are written to the temporary directory printed by the command.

## Manual field matrix

Test with real devices and two or more simultaneous players. Include at least one Android phone and one iPhone where available.

| Network | Join and voice | Reconnect test | Pass condition |
| --- | --- | --- | --- |
| Irancell 4G/5G | Run voice preflight, join, listen and speak | Toggle airplane mode for 10 seconds | Game state returns without reload; recovered notice appears; voice can rejoin |
| MCI 4G/5G | Same | Switch mobile data off/on | Same |
| Rightel 4G/5G, if available | Same | Move between weak and strong signal | Same |
| Home ADSL/VDSL/fibre | Same | Switch Wi-Fi off/on | Same |
| Wi-Fi to mobile data | Same | Change network during day and night | No duplicate action; state and timer recover |
| VPN on and off | Same | Connect or disconnect VPN mid-game | Clear Persian failure/recovery feedback; no frozen UI |

For every row, verify Persian audio permission guidance, low-quality audio, interrupted audio, background/foreground recovery, and a full 8-player round when practical.

## Safety and new-player checks

- A first-time player understands the voice check and cannot mark ready before it passes.
- Local mute takes effect immediately and remains active if the remote user republishes audio.
- Blocking hides graveyard messages, locally mutes voice, remains private, and prevents the two players from joining a future table together.
- A player can submit one report per target/game, with a selected category and optional note; duplicates return a localized error.
- An authenticated admin can list reports at `GET /api/admin/player-reports` (optionally filtered by `reviewed`) and mark one reviewed with `POST /api/admin/player-reports/{id}/reviewed` using the normal admin CSRF header.
- Raw server or English exception text is never shown to a Persian player.
- Every actionable failure offers a retry or a clear next step.

## Release decision

Block release for crashes, frozen phases, lost actions, duplicate actions, inability to reconnect, voice failure on two tested Iranian networks, untranslated Mafia text, RTL clipping, or a broken report/block flow. Cosmetic issues may ship only when recorded and they do not obscure controls, roles, timers, or safety actions.
