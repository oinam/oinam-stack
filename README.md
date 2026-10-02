# Oinam › Stack

> The stack of products, platforms, services, tools, and technologies that we use.

https://stack.oinam.com

- [Cloudflare](https://stack.oinam.com/cloudflare/) — every Cloudflare product in one table

---

## Cloudflare

We build experiments and production sites on Cloudflare and use a small slice of what it offers.
[`/cloudflare/`](https://stack.oinam.com/cloudflare/) lists all of it: product (linked to its product page), what it does (linked to its docs),
alternatives if we have to move, and cost.

### Build

`cloudflare/index.html` is generated locally and committed; GitHub Pages serves it as it is. Node 22, no
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
- `data/cloudflare.json` — which product page goes with which docs entry, products that only have a
  product page (Access, Gateway, Cache Reserve…), what is left out and why, and every Cost and
  Alternatives entry.

## Hosting

GitHub Pages serves the files; Cloudflare holds the DNS for `oinam.com`.

### GitHub Pages

1. Push `main` to [`oinam/oinam-stack`](https://github.com/oinam/oinam-stack).
2. Settings → Pages → Build and deployment → **Deploy from a branch**, `main` / `/ (root)`.
3. Custom domain: `stack.oinam.com`. The `CNAME` file in the root keeps this setting from
   being reset on deploy.
4. Once the certificate is issued, tick **Enforce HTTPS**.

`.nojekyll` tells Pages to serve the files as they are, without running Jekyll.

### Cloudflare DNS (`oinam.com` zone)

| Type  | Name    | Target            | Proxy                 |
| ----- | ------- | ----------------- | --------------------- |
| CNAME | `stack` | `oinam.github.io` | DNS only (grey cloud) |

- Start **DNS only**. GitHub has to see its own servers behind the name to verify the domain and
  issue the certificate; a proxied (orange) record first is the usual reason that fails.
- After **Enforce HTTPS** is on, the record can be flipped to **Proxied**, with SSL/TLS set to
  **Full (strict)** — never Flexible, which loops redirects against Pages.
- If `oinam.com` is a verified domain on the `oinam` organisation, GitHub may ask for a
  `_github-pages-challenge-oinam` TXT record; add it from the value GitHub shows.

## Local preview

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.
