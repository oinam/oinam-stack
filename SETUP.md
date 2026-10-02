# Setup

How [stack.oinam.com](https://stack.oinam.com) is built, hosted, and previewed. The
[README](README.md) is the short version.

## Cloudflare

We build experiments and production sites on Cloudflare and use a small slice of what it offers.
[`/cloudflare/`](https://stack.oinam.com/cloudflare/) lists all of it: product (linked to its product page), what it does (linked to its docs),
alternatives if we have to move, and cost.

### Build

`cloudflare/index.html`, and its Markdown twin `cloudflare.md` for AI tools, are generated locally
and committed; GitHub Pages serves them as they are. `llms.txt` at the root lists the Markdown pages. Node 22, no
dependencies.

```sh
node tools/cloudflare.mjs            # use the fetch cache in .cache/
node tools/cloudflare.mjs --refresh  # fetch everything again
```

What comes from where:

| Column        | Source                                                                                  |
| ------------- | --------------------------------------------------------------------------------------- |
| Products      | [developers.cloudflare.com/llms.txt](https://developers.cloudflare.com/llms.txt), by category |
| Product page  | `/products/*` in [cloudflare.com/sitemap.xml](https://www.cloudflare.com/sitemap.xml)    |
| What it does  | The docs' one-line description; the product page's meta description for the rest      |
| Pricing link  | The `/pricing/` page in each product's own `llms.txt`                                   |
| Alternatives, Cost | Written by hand in `data/cloudflare.json`, checked against Cloudflare's pricing pages |

The build ends with a list of anything to look at: a product new to the docs or the sitemap, one
that has gone, or one missing a cost or alternatives. Add it to `data/cloudflare.json` and rebuild.

- `tools/cloudflare.mjs` — fetch, parse, merge, render.
- `tools/cloudflare.html` — the page around the table. Edit this, not `cloudflare/index.html`.
- `cloudflare.md` — the same matrix as Markdown, generated with the page. Never edit it by hand.
- `llms.txt` — by hand; add a line when a new page lands.
- `data/cloudflare.json` — which product page goes with which docs entry, products that only have a
  product page (Access, Gateway, Cache Reserve…), what is left out and why, and every Cost and
  Alternatives entry.

### Weekly refresh

[`.github/workflows/refresh.yml`](.github/workflows/refresh.yml) runs the build with `--refresh`
every Monday at 03:17 UTC, and on demand from the Actions tab (**Run workflow**). Free: the repo
is public, and a run takes well under a minute.

- It commits, as Brajeshwar Oinam, only when the matrix changed beyond its "Parsed on" date; the
  push redeploys Pages.
- Cost and Alternatives are never touched by it. What needs curating goes into one open issue,
  **Cloudflare: products to curate**, updated each run and closed when nothing is left.
- If a fetch fails (cloudflare.com can block a datacenter), the build stops without writing and
  the run fails, so a half-fetched page never replaces a good one.
- After re-checking costs by hand, set `checked` at the top of `data/cloudflare.json` to that day.
- GitHub turns off scheduled workflows in a public repo after 60 days with no activity; if it
  happens, re-enable it from the Actions tab.

## Hosting

GitHub Pages serves the files; Cloudflare holds the DNS for `oinam.com`.

### GitHub Pages

1. Push `main` to [`oinam/oinam-stack`](https://github.com/oinam/oinam-stack).
2. Settings → Pages → Build and deployment → **Deploy from a branch**, `main` / `/ (root)`.
3. Custom domain: `stack.oinam.com`. The `CNAME` file in the root keeps this setting from
   being reset on deploy.
4. Once the certificate is issued, tick **Enforce HTTPS**. (Done.)

`.nojekyll` tells Pages to serve the files as they are, without running Jekyll.

### Cloudflare DNS (`oinam.com` zone)

| Type  | Name    | Target            | Proxy               |
| ----- | ------- | ----------------- | ------------------- |
| CNAME | `stack` | `oinam.github.io` | Proxied (orange)    |

SSL/TLS for the `oinam.com` zone is **Full (strict)**. Live since 2026-10-02.

How it was turned on, and what to do if it breaks:

- The record started **DNS only** (grey), so GitHub could see its own servers behind the name,
  verify the domain, and issue the certificate. Proxying first is the usual reason that fails.
- Then **Enforce HTTPS** on GitHub, and only then the orange cloud.
- Never **Flexible**: Cloudflare would fetch over HTTP, GitHub would answer "go to HTTPS", and
  every page loops on its own 301. That happened for a few minutes on 2026-10-02.
- GitHub renews its Let's Encrypt certificate itself (the first one expires 2026-12-31). Behind
  the proxy a renewal can fail, and Full (strict) then shows a 526. If it does, set the record to
  DNS only for a day so GitHub can renew, then back to Proxied.
- If `oinam.com` is a verified domain on the `oinam` organisation, GitHub may ask for a
  `_github-pages-challenge-oinam` TXT record; add it from the value GitHub shows.

## Local preview

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.
