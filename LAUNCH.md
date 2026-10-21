# Launching TruthSpin (GitHub + Netlify)

The game goes live the same way as your other sites: push to GitHub, and Netlify publishes it.
Everything is free except the domain (about ₹900–1,900 a year).

## 1. Before launch: things only you can do

- [ ] **Read and approve the questions.** Open `TruthSpin - V1 Handover and Question Review.docx`, or edit `content/questions/*.json` directly. The Hinglish lines need a native speaker's check.
- [ ] **Domain.** Buy `truthspin.app` (and `.in` / `.fun` if you like). If you choose another name, replace `truthspin.app` in `index.html`, `public/robots.txt` and `public/sitemap.xml`.
- [ ] **Trademark search** in India (IP India public search, classes 9 and 41), or ask a trademark attorney.
- [x] **Contact email:** codewithrohitsingh@gmail.com (set in `src/config.js` and `privacy.html`; change it in both places if needed).
- [ ] **Test with 3 to 5 real groups** on real phones (one cheap Android, one iPhone) before telling everyone.

## 2. Put it on GitHub and connect Netlify

1. Create a new GitHub repository (private is fine) and push this folder to it. `.gitignore` already leaves out `node_modules`, `dist` and other generated files.
2. In Netlify: **Add new site → Import an existing project → GitHub**, and pick the repository.
   Netlify reads `netlify.toml`, so the settings fill themselves in: build command `npm run build`, publish folder `dist`, functions in `netlify/functions`.
3. **Site configuration → Environment variables**, add:
   - `ADMIN_PASSWORD`: a long password for your review page (mark it as secret).
   - `ADMIN_USER` (optional): the user name for the review page. Without it, any user name works with the right password.
4. Deploy. The game appears at `https://<name>.netlify.app`. Open `/admin` there to check the password works.
5. **Domain management → Add a domain**: add `truthspin.app` and follow Netlify's DNS steps.

Nothing else is needed: suggestions, feedback and ratings are saved in Netlify Blobs, which every Netlify site has built in.

## 3. Netlify's free plan: protect your credits

The free plan has **300 credits a month**. When they run out, Netlify takes **all your sites offline** until the next month (checked October 2026):

| What uses credits | Cost |
|---|---|
| Each push to `main` that publishes the site | 15 credits |
| Visitors downloading the game | 20 credits per GB (a new player downloads about 0.1–0.2 MB) |
| Page and function requests | 2 credits per 10,000 |
| Functions (ratings, suggestions, review page) | very little; the game sends ratings in batches |
| Deploy previews and branch deploys | free |

So:
- **Don't push to `main` for every small change.** Work on another branch (Netlify builds a free preview you can test on your phone), and merge into `main` once a week or so: about 4 to 6 publishes a month.
- Check **Netlify → Usage** now and then. If the game grows (tens of thousands of players a month), move to a paid plan before credits run out.

## 4. Optional extras

- **Spam check (Cloudflare Turnstile, free):** if robots start sending suggestions, create a Turnstile widget (mode Invisible) at dash.cloudflare.com, put the *site key* in `src/config.js` (`turnstileSiteKey`) and add the *secret key* in Netlify as `TURNSTILE_SECRET`. Set both or neither.
- **Visit counts (GoatCounter, free):** sign up at goatcounter.com with the code `truthspin`, put `truthspin` in `src/config.js` (`goatcounter`).

## 5. Every week (about 15 minutes)

Open `https://truthspin.app/admin` and sign in with your `ADMIN_USER` (or any name, if you didn't set one) and `ADMIN_PASSWORD`.

- **Suggestions:** approve (edit the text if needed) or reject. Checklist: nothing dangerous, no real names, nothing sexual below 18+, no alcohol or romance in Kids & Family. Rejected ones are deleted after 30 days.
- **Approved:** copy the list into `content/questions/<level>.json`. Give each card the next free id (for example `ft069` after `ft068`) and a Hinglish line, push, then tap **Mark all as added**.
- **Card ratings:** red rows have 3 or more "Too spicy" or "Unsafe" reports. Check those first. Rewrite or remove cards many players dislike.
- **Feedback:** read and mark as read.

## Changing questions or screen text

- Questions: `content/questions/<level>.json`. Never change or reuse an existing `id`: ratings point at it. New cards go at the end with the next free number. Every card needs `en` (max 22 words) and `hi`; Couples and Spicy cards need `heat` 1, 2 or 3; timed dares need the `timer` tag and `secs`.
- Screen text: `src/strings.js`, in English (`en`) and Hinglish (`hi`).
- Then run `npm test` and push. Players get the changes the next time they open the game.

## For developers

| Command | What it does |
|---|---|
| `npm install` | Once, after cloning |
| `npm run dev` | Game at http://localhost:5173 (add `-- --host` to open it on a phone on the same Wi-Fi). The review page works there too: http://localhost:5173/admin, password `truthspin` (test data in `.local-data/`) |
| `npm run build` | Checks the questions and builds `dist/` |
| `npm test` | Logic, question and server checks |
| `npm run e2e` | Plays the built game in Chrome (Android) and WebKit (iPhone) on 15 screen sizes (run `npm run build` first; WebKit once: `npx playwright install webkit`) |
| `npm run images` | Remakes the icons and the link preview from the bottle drawing |
| `npx netlify dev` | Game plus `/api` and `/admin` locally, with Netlify Blobs (needs Netlify CLI) |
