# snuz.ng

This folder contains a lightweight, responsive static clone **inspired by** the public layout/sections of `haleon.com`.

## Run it locally

From the workspace root:

```bash
cd "Snuz.ng"
python3 -m http.server 5173
```

Then open `http://localhost:5173` in your browser.

## Pages included

- `index.html` (home)
- `who-we-are.html`
- `strategy.html`
- `our-brands.html`
- `our-impact.html`
- `investors.html`
- `news.html`
- `careers.html`
- `contact.html`

## What’s included

- `index.html`: homepage sections (hero, highlights, stats, investors, news, careers, footer)
- `*.html`: additional top-level pages with a shared header/footer
- `styles.css`: styling + responsive layout
- `script.js`: mobile menu + video toggles + **embedded markdown renderer** for the internal pages

## Firecrawl MCP

This clone was populated using the **Firecrawl MCP** from:

- branding (`formats: ["branding"]`)
- main content (`formats: ["markdown"]`)
- links (`formats: ["links"]`)
- (optionally) structured extraction (`formats: ["json"]` with a schema)

The internal pages include a trimmed version of scraped markdown inside `<template data-md>` blocks, rendered into HTML on load. Media URLs are referenced directly from their public locations.

If you plan to publish a clone publicly, make sure you have rights to use any brand assets and imagery, and do not use this for deception.

