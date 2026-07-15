# Walsh Digital Co. — marketing site

Static one-page site for **walshdigitalco.com**. Single self-contained
`index.html` (no build step, no dependencies) — hosted on Vercel.

## Deploy / update

Vercel is connected to this GitHub repo. Every push to `main` auto-deploys.

```
# edit index.html, then:
git add -A
git commit -m "update site"
git push
```

## First-time hosting setup

1. Push this repo to GitHub (private).
2. Vercel → **Add New → Project** → import this repo. Framework preset: **Other**
   (it's a static site — no build command, output is the repo root).
3. Vercel → project → **Settings → Domains** → add `walshdigitalco.com` and
   `www.walshdigitalco.com`, then add the DNS records Vercel shows at your registrar.

## Notes

- This is the marketing site only. The SiteGen tool lives in the separate
  `WalshDigital` Next.js project on Vercel.
- `.gitignore` isn't needed — there's nothing to ignore (single HTML file).
