# FKF TikTok page card on Mentions

The TikTok entry under "Official FKF pages" currently shows only the name — no picture and no numbers, because the scrape returned empty values. Fill it with the confirmed FKF TikTok details and use the FKF logo as the picture.

## What the card will show

- Name: FKF, handle @footballkenya, verified badge as today
- Picture: the FKF logo already used across the app
- Followers 12.3K · Following 9 · Likes 80.2K

## Technical notes

- Migration updating the `apify_profiles` TikTok row (`handle = footballkenya`): `display_name = 'FKF'`, `followers = 12300`, `following = 9`, `likes_count = 80200`, `avatar_url = '/fkf-logo.png'`.
- In the profile refresh (`src/lib/apify-mentions.server.ts`), keep the stored TikTok values when a scrape returns null/zero, so a failed run no longer blanks the card, and fall back to the FKF logo when the scraped avatar is missing.
- No layout changes: `src/components/social-profiles.tsx` already renders Followers / Following / Likes for TikTok once the values exist.
