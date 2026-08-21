# Plate League

Photo calorie tracking with a ten-person league. Snap the plate, the AI prices it,
the table judges you.

Everything is one file. No build step, no npm install, no framework to learn.

---

## Put it online in 5 minutes

### The easiest way (no command line)

1. Go to **github.com** and make a new repository. Call it `plate-league`. Keep it private if you like.
2. Click **Add file → Upload files**.
3. Drag in **every file from this folder**. All of them, including `support.js`.
4. Click **Commit changes**.
5. Go to **vercel.com** and sign in with your GitHub account.
6. Click **Add New → Project**, pick `plate-league`, click **Deploy**.
7. Wait about thirty seconds. You get a URL like `plate-league.vercel.app`.

That URL is your app. Send it to your ten people. On a phone they should open it and
choose **Add to Home Screen** — it then behaves like a normal app and the log button
opens the camera directly.

Every time you upload a change to GitHub, Vercel republishes it automatically.

### If you prefer the command line

```
npx vercel --prod
```

Run that in this folder. That is the whole deployment.

---

## Link Apple Watch with a Shortcut (no server, works today)

A web app cannot read Apple Health directly — only native iOS apps can. But a Shortcut
on the iPhone *can* read it, and can pass the figures to the app in the web address.
No server, no database, no cost.

The app reads these parameters and saves them:

    https://shirtpapasg.github.io/Exercise_app_V1/?move=520&exercise=35&stand=9&steps=8400&resting=1680

Optional, repeatable — `workout=Name|minutes|avgHeartRate|kcal`:

    &workout=Outdoor%20run|26|148|312&workout=Strength%20training|18|112|96

The address is cleared straight after importing, so refreshing never re-applies old
figures, and the app labels the data **Shortcuts** rather than **Demo data** so you can
always tell real numbers from the built-in sample.

### Building the Shortcut (about 10 minutes, once)

On the iPhone, open **Shortcuts → + → Add Action**:

1. **Find All Health Samples Where** — Type: *Active Energy*, Date: *Today*,
   then **Calculate Statistics → Sum**. Tap the result and rename the variable `Move`.
2. Repeat for **Exercise Minutes** (`Exercise`), **Steps** (`Steps`) and
   **Resting Energy** (`Resting`).
3. Add **Text** and paste, substituting your variables where shown:

       https://shirtpapasg.github.io/Exercise_app_V1/?move=[Move]&exercise=[Exercise]&steps=[Steps]&resting=[Resting]

4. Add **Open URLs** and pass it that Text.
5. Name it *Send to Plate League* and tap Done.

Then **Automation → + → Time of Day → 21:00 → Run Immediately** (turn *Ask Before
Running* off) so it fires every evening on its own.

Numbers must be whole — add **Round** after each Sum if you get decimals.

### Sharing it with your ten people

Once your Shortcut works, tap the share button inside Shortcuts and send the link.
Each person taps it, allows Health access once, and sets their own evening automation.
Per-person setup is the trade-off for needing no server.

If that becomes tiresome at more than ten people, **Health Auto Export** (~£5 on the
App Store) does the same thing automatically to a server endpoint — but that needs the
Supabase step below first.

---

## What works right now, with no server

- Photo logging, portion editing, leftovers
- The full daily and weekly scoring maths
- Streaks, badges, freeze tokens, the recap card
- Exercise timer, workout history, music launching
- Daylight and dark themes, phone / iPad / laptop layouts

Each person's data lives in their own browser. Nothing is shared, and the other nine
players on the table are fixtures. That is enough to test the habit with real food.

## What needs a server

Two things, and they are independent — do either one first.

### 1. Real AI photo analysis

Right now the app calls an AI helper that only exists in the environment it was built
in. On your own hosting that call fails, and the app says so honestly rather than
inventing a calorie count.

To fix it, put your own AI key **on the server** and point the app at it. Never put a
key in the HTML — anyone can read it.

Create `api/vision.js` in your repository:

```js
export default async function handler(req, res) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(req.body)
  });
  res.status(r.status).json(await r.json());
}
```

Then in Vercel: **Settings → Environment Variables**, add `ANTHROPIC_API_KEY`.

In `index.html`, find `runVision()` and change the `window.claude.complete` call to
`fetch('/api/vision', ...)`. The JSON contract stays exactly the same:

```
{"dish":"...","confidence":"high|medium|low",
 "items":[{"name":"...","grams":0,"kcal100":0,"protein100":0,"carbs100":0,"fat100":0,"fiber100":0}]}
```

Cost for 10 people at ~3 photos a day is a few dollars a month.

### 2. A shared league

For the table to hold real people you need accounts and a database.
[Supabase](https://supabase.com) has a free tier that fits 10 users comfortably.

Three tables is enough:

| Table | Columns |
|---|---|
| `users` | id, handle, sex, age, height, start/current/goal weight, targets |
| `meals` | id, user_id, taken_at, dish, items (json), kcal, protein, fibre, leftover_pct, photo_url |
| `week_scores` | user_id, week, logging_pts, deficit_pts, protein_pts, pct_lost |

**Move the scoring to the server.** `dayPoints()` and `composite()` in `index.html`
currently run in the browser, which means anyone can edit their own points. Recompute
them nightly server-side and the league becomes trustworthy.

---

## Things worth knowing before you invite people

- **iPhone photos (HEIC)** decode on every browser. Safari does it natively; other
  browsers lazily download a decoder the first time one appears. There is also a batch
  converter in **Me → HEIC photo converter**.
- **The only external request** the app makes is that HEIC decoder, from a CDN. To run
  fully offline, save `heic2any.min.js` next to `index.html` and repoint `HEIC_CDN`.
- **Social sharing needs no API.** Facebook, Instagram and WhatsApp all refuse to be
  embedded, so the app generates an image and copies a caption for the user to paste.
  Every fitness app works this way.
- **Reminders** fire while the app is open. True push notifications need a service
  worker and, on iOS, the app installed to the Home Screen.
- **Wipe local data** is in Me, if you want a clean slate while testing.

## Design decisions you may want to change

All in `index.html`, and each is deliberate:

- **Rank is a composite** — logging + deficit + protein + % lost — so nobody wins by
  starving. Adjustable via the `defaultMetric` prop.
- **% of body weight lost** keeps a 120kg member and a 62kg member on equal terms.
- **Promotion and relegation** (top 3, bottom 2) give every week stakes.
- **Freeze tokens** stop one bad day ending a streak, which is when people quit.
- **An unlogged day scores zero deficit.** Not eating is not a win.
- **No micronutrient tracking.** A photo cannot tell farmed salmon from wild, or how
  long the beef was cooked, so vitamin D and iron figures would be invented. Fibre is
  tracked because it scales with food volume and type, which a photo does show.
