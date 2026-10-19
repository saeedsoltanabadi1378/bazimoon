# Player acquisition attribution

Bazimoon records the first landing touch when it creates a player. The record is stored in
`user_acquisitions` and remains attached to the same user when a guest links a Google account.
Later visits and sign-ins do not overwrite it.

Use tagged links for sources you control:

```text
https://bazimoon.com/?utm_source=chatgpt&utm_medium=ai_referral&utm_campaign=game_launch
https://bazimoon.com/?utm_source=gemini&utm_medium=ai_referral&utm_campaign=game_launch
https://bazimoon.com/?utm_source=google&utm_medium=organic&utm_campaign=game_launch
```

The app captures `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid`,
the landing path, and the external referrer. If UTMs are absent, known ChatGPT, Gemini, and Google
referrers are classified automatically. A `gclid` without UTMs is classified as `google / cpc`.
Direct visits are stored as `direct / none`; players created before this feature are backfilled as
`unknown / none`.

Per-player report:

```sql
SELECT u."Id", u."DisplayName", a."Source", a."Medium", a."Campaign",
       a."LandingPath", a."FirstSeenAt"
FROM users AS u
JOIN user_acquisitions AS a ON a."UserId" = u."Id"
ORDER BY a."FirstSeenAt" DESC;
```

Source summary:

```sql
SELECT "Source", "Medium", COUNT(*) AS players
FROM user_acquisitions
GROUP BY "Source", "Medium"
ORDER BY players DESC;
```

Attribution values are untrusted analytics input and must not be used for authorization, rewards,
or billing decisions.
