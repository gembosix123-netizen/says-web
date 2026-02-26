# Deployment Guide

Use this document to ship the `says-web` static build to common hosting targets. The project ships a `dist/` directory via `npm run build`, so any static host that can serve HTML/CSS/JS will work.

## 1. Build Once
```bash
cd says-web/says-web
npm install
npm run build
```
The command copies everything from `src/` into `dist/` and minifies CSS/JS. The output is safe to deploy.

## 2. Vercel (Monorepo)
1. Create a new Vercel project and import the GitHub repo.
2. Under **Root Directory**, select `says-web` (the subfolder containing this static project).
3. Set **Build Command** to `npm run build` and **Output Directory** to `dist`.
4. Add the environment variable `FORCE_COLOR=1` if you want colored logs (optional).
5. Deploy. Vercel will install dependencies inside `says-web/`, run the build, and serve the contents of `dist/`.

### Optional `vercel.json`
If you prefer configuration-as-code, add this file at the repository root:
```json
{
  "buildCommand": "cd says-web && npm install && npm run build",
  "outputDirectory": "says-web/dist",
  "framework": null
}
```
Leave `framework` as `null` so Vercel treats it as a generic static app.

## 3. Netlify
1. In Netlify, create a new site from Git. Set **Base directory** to `says-web`.
2. **Build command**: `npm run build`
3. **Publish directory**: `dist`
4. Save & deploy.

### Redirects (Optional SPA Behavior)
If you need client-side routing later, create `netlify.toml` (either at repo root or inside `says-web` if you set the base directory there):
```toml
[build]
  base = "says-web"
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## 4. GitHub Pages
### Using GitHub Actions
Create `.github/workflows/deploy-says-web.yml` in the repo root:
```yaml
name: Deploy static says-web

on:
  push:
    branches: [ master ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: says-web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm install
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: says-web/dist
  deploy:
    needs: build
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - id: deploy
        uses: actions/deploy-pages@v4
```
Then enable GitHub Pages → Source: GitHub Actions.

### Manual Upload
1. Run `npm run build` locally.
2. Push the contents of `dist/` to a branch named `gh-pages`.
3. Configure GitHub Pages to serve from `gh-pages` → `/` folder.

## 5. Smoke Test Before Shipping
After each deployment target finishes, sanity-check:
- `<meta>` tags render in view-source.
- Navigation links scroll smoothly.
- Hero CTA focuses the highlights block.
- Static assets (favicon/social card) load at their deployment URLs.

## 6. Rollbacks
Because the app is static, rollbacks are as simple as redeploying a previous commit or uploading an older `dist/`. Keep the last known-good build artifact (`dist/` zip) for emergencies.
