# Oinam · Cloudflare

> Every Cloudflare product in one table — what it does, what it costs, and where we would go instead

https://cloudflare.oinam.com

---

We build experiments and production sites on Cloudflare and use a small slice of what it offers.
This page lists all of it: product (linked to its product page), what it does (linked to its docs),
alternatives if we have to move, and cost.

## Build

`index.html` is generated locally and committed; GitHub Pages serves it as it is. Node 22, no
dependencies.

```sh
node tools/build.mjs            # use the fetch cache in .cache/
node tools/build.mjs --refresh  # fetch everything again
```

What comes from where:

| Column        | Source                                                                                  |
| ------------- | --------------------------------------------------------------------------------------- |
| Products      | [developers.cloudflare.com/llms.txt](https://developers.cloudflare.com/llms.txt), by category |
| Product page  | `/products/*` in [cloudflare.com/sitemap.xml](https://www.cloudflare.com/sitemap.xml)    |
| What it does  | The docs' one-line description; the product page's meta description for the rest      |
| Pricing link  | The `/pricing/` page in each product's own `llms.txt`                                   |
| Alternatives, Cost | Written by hand in `data/products.json`, checked against Cloudflare's pricing pages |

The build ends with a list of anything to look at: a product new to the docs or the sitemap, one
that has gone, or one missing a cost or alternatives. Add it to `data/products.json` and rebuild.

- `tools/build.mjs` — fetch, parse, merge, render.
- `tools/template.html` — the page around the table. Edit this, not `index.html`.
- `data/products.json` — which product page goes with which docs entry, products that only have a
  product page (Access, Gateway, Cache Reserve…), what is left out and why, and every Cost and
  Alternatives entry.

## Hosting

GitHub Pages serves the files; Cloudflare holds the DNS for `oinam.com`.

### GitHub Pages

1. Create the repository under the `oinam` organisation and push `main`.
2. Settings → Pages → Build and deployment → **Deploy from a branch**, `main` / `/ (root)`.
3. Custom domain: `cloudflare.oinam.com`. The `CNAME` file in the root keeps this setting from
   being reset on deploy.
4. Once the certificate is issued, tick **Enforce HTTPS**.

`.nojekyll` tells Pages to serve the files as they are, without running Jekyll.

### Cloudflare DNS (`oinam.com` zone)

| Type  | Name         | Target            | Proxy               |
| ----- | ------------ | ----------------- | ------------------- |
| CNAME | `cloudflare` | `oinam.github.io` | DNS only (grey cloud) |

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
