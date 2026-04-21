# SAYS Malaysia Website Clone

Static HTML, CSS, and vanilla JavaScript rebuild of the SAYS Malaysia marketing site. The goal is to mirror the public experience while keeping the codebase lightweight and easy to extend.

## Features
- Pixel-friendly layout that matches the production site structure
- Componentized CSS (hero, cards, carousel, footer) for easier tweaks
- Minimal JavaScript for navigation toggles and interactive blocks
- Live reload development flow powered by `live-server`
- SEO-ready `<head>` metadata (Open Graph + Twitter) and accessible navigation semantics
- Progressive enhancements with guarded smooth scrolling and automatic lazy-loading defaults

## Prerequisites
- Node.js 18+
- npm (ships with Node)

## Getting Started
1. **Clone & install**
   ```bash
   git clone https://github.com/gembosix123-netizen/says-web.git
   cd says-web/says-web
   npm install
   ```
2. **Start dev server**
   ```bash
   npm start
   ```
   The command serves everything in `src/` using `live-server` and hot reloads on every file save. If you prefer to open files directly, you can still open `src/index.html` in your browser.

## Available Scripts
- `npm start` – Run `live-server src` with auto-refresh.
- `npm run build` – Minify CSS/JS and copy assets into `dist/` for static hosting.
- `npm test` – Execute Vitest smoke tests for markup and assets.
- `npm run test:watch` – Run tests in watch mode during development.

Deployment instructions live in [DEPLOYMENT.md](DEPLOYMENT.md).

## Production Build
```bash
npm run build
```
The command creates a fresh `dist/` directory that mirrors `src/` but with minified assets, ready to deploy to any static host.

## Testing & QA
```bash
npm test
```
The Vitest suite inspects `src/index.html` to ensure required metadata, navigation targets, hero CTA wiring, and critical assets stay present. Use `npm run test:watch` while iterating on markup to catch regressions immediately.

## Project Structure
```
says-web/
├── package.json
├── README.md
├── scripts/
│   └── build.js
└── src/
   ├── index.html
   ├── assets/
   │   ├── fonts/
   │   ├── icons/
   │   │   └── favicon.svg
   │   └── images/
   │       └── social-card.svg
   ├── scripts/
   │   └── main.js
   └── styles/
      ├── base.css
      ├── components.css
      ├── layout.css
      └── style.css
   ├── tests/
   │   └── html.spec.js
   └── dist/ (generated)
```

## Contributing
Issues and pull requests are welcome—feel free to open one for design fixes, performance improvements, or additional pages.

## License
MIT © gembosix123-netizen