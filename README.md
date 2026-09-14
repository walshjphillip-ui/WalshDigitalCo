# Walsh Digital Co. — marketing site

Static site for **walshdigitalco.com** — plain HTML/CSS/JS, no build step, hosted on
Vercel. Shared styles and behaviour live in `assets/site.css` and `assets/site.js`.

## Deploy / update

Vercel is connected to this GitHub repo. Every push to `main` auto-deploys.

```
git add -A
git commit -m "update site"
git push
```

## Leads

Every form posts to **Web3Forms**, which emails the submission to
hello@walshdigitalco.com. The access key is in `assets/site.js` (`WEB3FORMS_KEY`) and
in `audit.html` (for visitors without JavaScript).

- `audit.html` — the free business audit request, the site's primary call to action.
  Each lead email includes an **Open in Audit Desk** link that loads the request into
  the desk.
- `services.html#contact` — the general contact form.

⚠ In the Web3Forms dashboard, restrict the key to `walshdigitalco.com` and
`www.walshdigitalco.com`, otherwise anyone can post to the form.

## Audit Desk (internal)

`/desk.html` is Phillip's prospect audit generator. It is not linked anywhere, not in the
sitemap, and marked `noindex`. Prospects and saved audits stay in the browser that
created them (use **Saved → Export** to back up).

It works with no setup: fill in the prospect, mark the checks, and it writes the audit,
the plan recommendation and the outreach. The automatic checks need two Vercel
environment variables (**Settings → Environment Variables**, then redeploy):

| Variable | What it enables |
| --- | --- |
| `DESK_KEY` | Required for any automatic check. A long random string; enter the same value in the desk under **Settings**. |
| `GOOGLE_PLACES_API_KEY` | Optional. **Google lookup** — rating, review count, latest review, photos, hours. Needs *Places API (New)* enabled in Google Cloud. |

- `api/scan.js` fetches the prospect's homepage server-side and reports facts (headline,
  buttons, tap-to-call, viewport, booking tools, stock images, copyright year, platform,
  social links, search basics). Public http(s) addresses only.
- `api/places.js` does the Google Business Profile lookup.
- **Mobile speed** calls Google PageSpeed directly from the browser; add a PageSpeed API
  key in desk Settings if the free quota runs out.

The checks, their wording and the plan prices are in `assets/desk-checks.js`.

⚠ **Prices live in four places:** `services.html`, the plans band on `index.html`, the
arrays in `assets/site.js`, and `PLANS` in `assets/desk-checks.js`.

## First-time hosting setup

1. Push this repo to GitHub (private).
2. Vercel → **Add New → Project** → import this repo. Framework preset: **Other**
   (no build command, output is the repo root; files in `api/` deploy as functions).
3. Vercel → project → **Settings → Domains** → add `walshdigitalco.com` and
   `www.walshdigitalco.com`, then add the DNS records Vercel shows at your registrar.

## Notes

- The SiteGen tool lives in the separate `WalshDigital` Next.js project.
