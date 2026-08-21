# Plate League — self-hosting notes

## What you have
`Plate League.dc.html` — the whole app in one file. Eight screens: onboarding, today,
photo log flow, leaderboard (4 metrics + duel + streak wall), squad challenge,
progress, history, weekly recap.

Right now it runs **single-player against seeded rivals**, storing everything in the
browser's localStorage (`pl_v1`). That is enough to test the loop with real food and
real photos. It is not yet a shared league — nine of the ten players are fixtures.

## Running it
Any static host works: Netlify, Vercel, Cloudflare Pages, GitHub Pages, or `python3 -m http.server`
on a box you own. On a phone, open it and **Add to Home Screen** — the log button then
opens the native camera directly.

## The two things to build before it's a real product

**1. A backend (needed for the league to be real).**
Three tables gets you there:
- `users` — id, handle, sex, age, height, start/current/goal weight, targets
- `meals` — id, user_id, taken_at, dish, items JSON, kcal, protein, leftover %, photo URL
- `week_scores` — user_id, week, logging pts, deficit pts, protein pts, % lost (recompute nightly)

The scoring maths already lives in `dayPoints()` and `composite()` in the file — move
those to the server so nobody can edit their own points. Supabase (Postgres + auth +
photo storage, free tier fits 10 people) is the shortest path.

**2. Your own vision endpoint.**
`runVision()` is the single swap point. In this preview it calls the built-in helper;
when self-hosted, POST the photo to your server and let the server hold the API key —
never ship a key in the HTML. Same JSON contract, no other change needed:
`{dish, confidence, items:[{name, grams, kcal100, protein100, carbs100, fat100}]}`
If the call fails the app already falls back to an offline estimate and labels it as such.

Cost for 10 users at ~3 photos a day is a few dollars a month at Haiku/Sonnet vision rates.

## Apple Watch / Health — how to actually wire it
The app now consumes measured burn: resting + active energy replace the guessed activity
multiplier, workouts show individually, and a share of training calories is added back to
the day's target (0 / 50 / 75 / 100%, tappable on the card).

A web page cannot read HealthKit directly. Three routes, cheapest first:

1. **Shortcuts → webhook (zero app code).** An Automation on the phone runs daily, pulls
   Active Energy / Exercise Minutes / Steps / Workouts, and POSTs them to your endpoint.
   Good enough for ten people and ships today.
2. **Wrap it in a WKWebView shell.** A thin SwiftUI app requests HealthKit read scopes
   (`activeEnergyBurned`, `basalEnergyBurned`, `appleExerciseTime`, `stepCount`,
   `HKWorkoutType`) and injects them into the page via `window.webkit.messageHandlers`.
   Read-only scopes, no Apple review friction. This is the right answer if the ten becomes a hundred.
3. **Full native app + WatchOS companion** if you ever want to log a meal from the wrist.

Whatever the route, the page only needs one shape pushed into it:
`{resting, move, exercise, stand, steps, workouts:[{name, mins, kcal, hr}]}`
— that is exactly `state.health`, so the swap is a single assignment.

One judgement call worth keeping: default to eating back **50%**, not 100%. Watches
overestimate active burn by 20-40% on non-cardio work, and eating back all of it is the
most common reason people stall while swearing they're in deficit.

## Apple HEIC photos — verified working
The decode chain is: native codec → `<img>` → **libheif-js 1.18** → `heic2any` (both
lazy-loaded from jsDelivr). libheif-js is the primary HEIC decoder: heic2any bundles a
2020-era libheif that rejects newer iPhone variants with `ERR_LIBHEIF format not
supported`, which is exactly what real iPhone photos hit.
It is **not** gated on the filename or MIME type: HEICs routinely arrive with an empty
`type` or a misleading `.jpg` name, so the decoder always runs as a last resort.
Verified against real HEIC samples with an empty MIME type; the trail reads
`native:failed → img:failed → decoder:loaded → heic2any:ok`.

There is also a standalone **Photo converter** (Me › HEIC photo converter): batch
HEIC/HEIF → JPEG, entirely on-device, with per-file download or "Log it" straight into
the plate flow.

Failures write a breadcrumb trail to `localStorage['pl_v1_photolog']` (last 6 events,
with file type, size and the exact stage that failed) — read that first when a user
reports a photo problem.

## Apple HEIC photos
iPhones shoot HEIC by default, but the pickers deliberately use a plain `accept="image/*"`:
with that, **iOS Photos transcodes HEIC to JPEG on the way out**, so iPhone users need no
decoder at all. Naming `.heic` in the accept list defeats this — iOS then hands over the
raw HEIC — so don't "helpfully" add it back.

For files that genuinely arrive as HEIC (AirDropped, cloud drive, Android), the app
lazy-loads `heic2any` from jsDelivr, only on demand.

Two consequences for self-hosting:
- That one CDN request is the app's only external runtime dependency, and most users will
  never trigger it. To go fully offline, vendor `heic2any.min.js` and repoint `HEIC_CDN`.
- Everything is re-encoded to JPEG before storage or upload, so your vision endpoint
  only ever receives JPEG regardless of what the camera produced.
- heic2any cannot decode every HEIC variant (10-bit HDR and Live Photo stills are known
  gaps). Those users get an explicit error naming the cause, plus the advice to switch
  Settings › Camera › Formats to "Most Compatible".

## Accuracy notes that matter more than the model
- The **context field** (typed or dictated) is what makes estimates good — oils, sauces
  and cooking method are invisible in a photo and worth hundreds of calories.
- The **leftovers photo** turns a guess into a number. Keep that step.
- The app deliberately shows a confidence chip and editable grams. Never hide the
  uncertainty; users trust a number they were allowed to correct.

## Deliberate design decisions
- Rank is a composite so nobody wins on starvation alone: logging + deficit + protein + % lost.
- **% of body weight lost** keeps a 120 kg member and a 62 kg member on equal footing.
- Promotion/relegation (top 3 / bottom 2, adjustable in Tweaks) gives every week stakes.
- Freeze tokens protect streaks so one bad day doesn't make someone quit.
- Copy is blunt on purpose; it never comments on bodies, only on behaviour.
