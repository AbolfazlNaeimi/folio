# Abolfazl Naeimi — Personal Portfolio

Personal portfolio website for Abolfazl Naeimi (RimNova) — Full‑Stack Developer, AI Builder & Product Builder.

Fully static (HTML + CSS + vanilla JS, no build step, no backend, no frameworks). Bilingual: Persian (RTL) is the primary language at the site root, with a full English mirror under `/en/`.

## Structure

```
├── index.html              # Home (FA)
├── about.html               # About (FA)
├── projects.html            # Projects — all 16, with filters (FA)
├── contact.html              # Contact (FA)
├── en/
│   ├── index.html            # Home (EN)
│   ├── about.html
│   ├── projects.html
│   └── contact.html
├── assets/
│   ├── css/style.css         # Design tokens + all styles
│   ├── js/main.js             # Nav toggle, scroll reveal, filters, back-to-top
│   ├── img/
│   │   ├── profile/           # Portrait photos
│   │   ├── logo/               # AN monogram, favicons
│   │   ├── projects/            # RimYar / Salavat logos
│   │   └── certs/                # Certificate images
│   ├── icons/                  # PWA icons (192/512, apple-touch-icon)
│   ├── og-image.jpg             # Social share preview image (1200×630)
│   └── site.webmanifest
├── favicon.ico
├── robots.txt
└── sitemap.xml
```

## Deploying to GitHub Pages

1. Create a repository named exactly `AbolfazlNaeimi.github.io` (or `abolfazlnaeimi.github.io`) under your GitHub account — this makes it your root personal site at `https://abolfazlnaeimi.github.io/`.
2. Push the contents of this folder to the `main` branch.
3. In the repo Settings → Pages, set the source to the `main` branch, root folder.
4. Wait a minute for GitHub Pages to publish — your site will be live at `https://abolfazlnaeimi.github.io/`.

> If you deploy under a different domain or a project subpath (e.g. `username.github.io/portfolio/`), update the absolute URLs in each page's `<link rel="canonical">`, Open Graph/Twitter tags, `sitemap.xml`, `robots.txt`, and the `/favicon.ico` + manifest paths accordingly.

## Editing content

- **Text/content**: edit directly in the relevant `.html` file — there is no CMS or templating.
- **Colors/fonts/spacing**: all design tokens are CSS variables at the top of `assets/css/style.css` (`:root { ... }`).
- **Adding a project card**: copy an existing `.proj-card` block in `projects.html` (and its English counterpart in `en/projects.html`), update the link, image, title, description and `data-tags` for filtering.
- **Fonts**: loaded from Google Fonts (Vazirmatn for Persian, Space Grotesk + JetBrains Mono for Latin/mono accents) via a `<link>` in every page's `<head>`.

## Browser support

Modern evergreen browsers (Chrome, Firefox, Safari, Edge). Uses CSS logical properties for automatic RTL/LTR mirroring, `prefers-reduced-motion` handling, and progressive enhancement (`IntersectionObserver` for scroll reveals, with a graceful fallback).
