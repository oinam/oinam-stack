# cloudflare.oinam.com

Plain static HTML, hosted on GitHub Pages, with the DNS on Cloudflare. No build step, no
dependencies. See `README.md` for the Pages and DNS setup.

## /odo

- Queue: `~/_/Oinam/1-Projects/devCommands/oinam.com-cloudflare.md`
- Log:   `~/_/Oinam/1-Projects/devLogs/oinam.com-cloudflare.md`

## Files

- `index.html` — the page. One file, styles inline.
- `CNAME` — `cloudflare.oinam.com`, one line. Pages reads it; do not move or rename it.
- `.nojekyll` — serve the files as they are.

## Conventions

- 2-space indentation, never 4.
- Colours in OKLCH, as tokens on `:root`. Light by default, dark from `prefers-color-scheme` —
  no theme switch.
- Serif type. Content sits in `<main>`, centred, `max-width: 42rem`, `width: 96%`.
- Smart typography in the text: curly quotes and apostrophes (’ “ ”), proper dashes.
