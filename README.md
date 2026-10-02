# Oinam · Cloudflare

> Cloudflare at Oinam

https://cloudflare.oinam.com

---

Plain static HTML — no build step. Whatever is in `main` at the root is the site.

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
