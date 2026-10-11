# The Lost and Found Thrift Shoppe — Website

Static, single-page site for The Lost and Found Thrift Shoppe, 236 Dunn Road, Fayetteville, NC.
Built from `the_lost_and_found_thrift_shoppe_cinematic_website_wireframe.md`.

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```sh
npx serve .        # or: python -m http.server
```

Deploys as-is to any static host (Netlify, GitHub Pages, Cloudflare Pages, Vercel).

## Structure

```
index.html        All six sections from the wireframe
css/styles.css    Design tokens (top of file), layout, animation
js/main.js        Nav, scroll reveals, dust motes, "Open now" stamp, ambience toggle
assets/           Favicon (put real photos here)
```

## Brand & style

The look is taken from the shoppe sign (`assets/the-lost-and-found-sign.jpg`, shown in the hero):
ivory paper `#f7f0e8` (matches the sign's ground exactly, so keep the two in sync), double frames with
scooped corners (`assets/frame*.svg`, applied with `border-image`), sage sprigs and a taupe
fleur-de-lis (SVG sprite at the top of `index.html`), Cormorant Garamond capitals, EB Garamond text
and the Sacramento script. A sharper export of the sign (1920px wide or more) can be dropped in
at the same filename.

## Swapping in real photography

The two small Origin drawings and the six New Finds tiles are engraved-style SVG
placeholders. To use real photos, replace each `<svg …>…</svg>` inside its `<figure>` with:

```html
<img src="assets/your-photo.jpg" alt="Describe the photo" loading="lazy">
```

Then add `.photo img, .find img { width: 100%; height: 100%; object-fit: cover; }` to the CSS.
The New Finds tiles are square, so square crops work best there.

## Things to keep current

- **Hours** are on the Hours card in `index.html`, and the "Open now / Closed now" stamp logic in
  `js/main.js` (Mon–Sat, 10–4, Eastern time). Update both if hours change.
- **Instagram, email, St. Jude and Google Maps links** are in the Community section and footer.
