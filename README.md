# danang-massage-guide

Production-ready static affiliate landing site for foreign tourists looking for legitimate massage and spa services in Da Nang.

Live site: `https://danang-massage-guide.pages.dev/`

## Project Overview

`danang-massage-guide` is a plain HTML/CSS/JS website designed to convert tourist traffic into direct booking conversations through WhatsApp and Telegram.

The site is intentionally lightweight:

- no backend
- no framework
- no build step
- fast deployment to Cloudflare Pages
- easy editing by non-developers

The current booking flow is messaging-first and optimized for mobile visitors who want quick contact, clear pricing guidance, and visible social proof before booking.

## Features

- Four-page static site:
  - `index.html`
  - `reviews.html`
  - `book.html`
  - `contact.html`
- Mobile-first layout
- Shared styling and shared link configuration
- Direct WhatsApp and Telegram CTAs
- Floating quick-contact area
- Tourist-focused spa discovery content
- SEO-friendly headings, metadata, and homepage JSON-LD
- Cloudflare Pages compatible with no build process
- Easy content editing for partner spa updates

## Folder Structure

```text
danang-massage-guide/
|-- .gitignore
|-- README.md
|-- DEPLOYMENT.md
|-- AFFILIATE_SETUP.md
|-- CONTENT_PLAN.md
|-- TODO.md
|-- index.html
|-- reviews.html
|-- book.html
|-- contact.html
`-- assets/
    |-- css/
    |   `-- style.css
    `-- js/
        `-- main.js
```

## Local Development

This project does not require package installation or a local build step.

### Option 1: Open the files directly

Open `index.html` in a browser and navigate through the internal links.

### Option 2: Use a simple static server

If you prefer local URLs instead of `file://`, serve the repo with any static server.

Examples:

```powershell
python -m http.server 8000
```

or

```powershell
npx serve .
```

Then open:

```text
http://localhost:8000/
```

## Cloudflare Pages Deployment

This repo is suitable for two deployment methods.

### Git-connected deployment

Recommended for normal content updates.

1. Push changes to GitHub.
2. Cloudflare Pages monitors the configured branch.
3. Pages publishes the new version automatically.

Suggested Pages settings:

- Framework preset: `None`
- Build command: leave empty
- Build output directory: `.`

### Direct deployment with Wrangler

Useful when Git-triggered Pages deployments lag or fail.

Example:

```powershell
npx wrangler pages deploy . --project-name danang-massage-guide --branch master --commit-hash <sha> --commit-message "<message>"
```

This project has already been deployed successfully with Wrangler to production.

More detail is documented in [DEPLOYMENT.md](/D:/lending%20page/DEPLOYMENT.md).

## GitHub Workflow

Recommended workflow:

1. Edit content or styling locally.
2. Review the changed files.
3. Run lightweight checks.
4. Commit with a clear message.
5. Push to `master`.
6. Confirm the Pages deployment updated.

Typical commands:

```powershell
git status
git add .
git commit -m "Short clear message"
git push
```

If Cloudflare Pages does not update after push, use the direct Wrangler deploy workflow in [DEPLOYMENT.md](/D:/lending%20page/DEPLOYMENT.md).

## How To Update WhatsApp and Telegram Links

Shared booking links are configured in [assets/js/main.js](/D:/lending%20page/assets/js/main.js).

Current top-level constants:

```js
const WHATSAPP_LINK = "https://chat.whatsapp.com/Bzeox4jUrZdBQFWaLS20l3";
const TELEGRAM_LINK = "https://t.me/danangmassagebooking";
```

To update them:

1. Open `assets/js/main.js`.
2. Replace the constant values.
3. Save the file.
4. Commit and push.
5. Confirm the live site buttons point to the updated URLs.

Because every page uses `data-link-key` hooks, changing these constants updates booking links across the site automatically.

## How To Add Partner Spas

Featured spa content currently lives in [index.html](/D:/lending%20page/index.html).

To add or replace partner spas:

1. Update the featured cards in the homepage recommendations section.
2. Replace:
   - partner spa name
   - area label
   - treatment summary
   - supporting tags
3. Keep the wording factual and wellness-focused.
4. Avoid making claims that cannot be verified.
5. Keep CTAs tied to the approved booking channels.

Recommended partner card fields:

- spa name
- neighborhood
- best-for use case
- treatment style
- typical duration
- price range
- booking channel preference

## How To Update Reviews

Review-related content is mainly in [reviews.html](/D:/lending%20page/reviews.html), with review buttons also used on the homepage.

To update review references:

1. Update `GOOGLE_REVIEW_LINK` in `assets/js/main.js`.
2. Update `TRIPADVISOR_LINK` in `assets/js/main.js`.
3. Refresh any descriptive copy in `reviews.html` if review criteria or featured categories change.
4. Keep review language neutral and evidence-based.

Recommended review maintenance routine:

- check Google reviews weekly
- check TripAdvisor monthly
- remove venues with outdated or risky reputation signals
- refresh screenshots or summaries when public review trends change

## SEO Notes

This project already includes:

- descriptive page titles
- page-level meta descriptions
- keyword-relevant headings
- crawlable HTML content
- homepage FAQ structured data
- internal links between pages

SEO maintenance checklist:

1. Keep titles aligned with target search intent.
2. Expand supporting content over time using [CONTENT_PLAN.md](/D:/lending%20page/CONTENT_PLAN.md).
3. Add a sitemap and `robots.txt` if search growth becomes a priority.
4. Add a custom domain for stronger branding and trust.
5. Update structured data if the site starts naming specific partner businesses.

Current core search intent:

- best massage in da nang
- body massage da nang
- spa in da nang
- tourist booking support

## Affiliate Disclaimer

This website is an independent guide and may receive referral commissions from partner spas.

Important operating rule:

- always make pricing and availability subject to change
- avoid misleading exclusivity claims
- avoid false review claims
- avoid hardcoding a fake business address
- keep all service copy legitimate and wellness-focused

The live site footer already includes the affiliate disclaimer text.

## Maintenance Checklist

- verify WhatsApp and Telegram links still work
- verify Google Review and TripAdvisor links still resolve correctly
- update featured spa partners when inventory changes
- refresh price ranges when partners update menus
- test mobile CTA visibility after any layout change
- verify the live Pages deployment after each push

## Related Documents

- [DEPLOYMENT.md](/D:/lending%20page/DEPLOYMENT.md)
- [AFFILIATE_SETUP.md](/D:/lending%20page/AFFILIATE_SETUP.md)
- [CONTENT_PLAN.md](/D:/lending%20page/CONTENT_PLAN.md)
- [TODO.md](/D:/lending%20page/TODO.md)
