# danang-massage-guide

Static landing website for an affiliate massage and spa guide in Da Nang targeting foreign tourists.

## Stack

- Plain HTML, CSS, and JavaScript
- No backend
- Mobile-first layout
- SEO-friendly content structure
- Ready for Cloudflare Pages

## Pages

- `index.html`
- `reviews.html`
- `book.html`
- `contact.html`

## File structure

```text
danang-massage-guide/
|-- index.html
|-- reviews.html
|-- book.html
|-- contact.html
|-- assets/
|   |-- css/
|   |   `-- style.css
|   `-- js/
|       `-- main.js
`-- README.md
```

## Placeholder links

Update the link constants in `assets/js/main.js` before going live:

```js
const LINKS = {
  whatsapp: "#",
  telegram: "#",
  messenger: "#",
  googleReview: "#",
  tripadvisor: "#"
};
```

These map to the required placeholders:

- `WHATSAPP_LINK="#"`
- `TELEGRAM_LINK="#"`
- `MESSENGER_LINK="#"`
- `GOOGLE_REVIEW_LINK="#"`
- `TRIPADVISOR_LINK="#"`

## Customization notes

- Replace the featured spa names with your real affiliate partner listings.
- Replace the Google Maps placeholder on the homepage with a real embed or image.
- Update service prices if you want them to match live partner rates.
- If you have a real domain, update the sample URL in the homepage structured data.

## Local preview

You can open the HTML files directly in a browser, or serve the folder with any static server.

## Deploy to Cloudflare Pages

1. Upload this folder to a Git repository, or drag and drop the files in Cloudflare Pages.
2. If deploying from Git:
   - Framework preset: `None`
   - Build command: leave empty
   - Build output directory: `.`
3. Deploy the project.

Because this is a plain static site, no build step or environment variables are required.
