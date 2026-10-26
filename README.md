# Truth n Dare (truthndare.in)

Truth or Dare with a spinning bottle. A free, mobile-first web game that needs no sign-up and works offline. It has 810 questions in English and Hinglish across Kids, Friends, Party and 18+ levels. Built with Vite and hosted on Netlify.

Developed by Rohit Singh.

- **Launching and weekly upkeep:** see [LAUNCH.md](LAUNCH.md).
- **Questions:** `content/questions/<level>.json` (English `en`, Hinglish `hi`; Couples and Spicy have `heat` 1–3).
- **Screen text:** `src/strings.js`.
- **Owner settings** (GoatCounter, Turnstile site key, contact email): `src/config.js`.

## Layout

| Path | What it is |
|---|---|
| `index.html`, `src/` | The game: bottle (`bottle.js`), fair picking (`picker.js`), no-repeat decks (`deck.js`), menus (`sheets.js`), own questions (`custom.js`), ratings and feedback (`feedback.js`), sharing (`share.js`) |
| `shared/validate.js` | Text and id checks used by both the game and the server |
| `server/` | Server logic: `/api/batch` (ratings, suggestions, feedback) and `/admin` (review page), stored in Netlify Blobs |
| `netlify/functions/`, `netlify.toml` | Netlify settings and the two functions that connect `server/` to Netlify |
| `content/` | Question source files (`work/` holds the writers' drafts and review notes) |
| `scripts/` | Question build, icons, review document |
| `tests/` | `unit/` (Vitest) and `e2e/` (Playwright: Chrome and WebKit, 15 screen sizes from a 280 px foldable to a computer) |
| `research/` | The October 2026 research data behind the plan |

```
npm install
npm run dev      # play locally
npm test         # logic and question checks
npm run build && npm run e2e
```
