#!/usr/bin/env node
const path = require('path');
const fs = require('fs/promises');
const { build } = require('esbuild');
const csso = require('csso');

const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');
const distDir = path.join(projectRoot, 'dist');
const cssFiles = [
  'styles/style.css',
  'styles/base.css',
  'styles/layout.css',
  'styles/components.css',
];

async function copySource() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.cp(srcDir, distDir, { recursive: true });
}

async function minifyJavaScript() {
  const entryFile = path.join(srcDir, 'scripts', 'main.js');
  const outFile = path.join(distDir, 'scripts', 'main.js');
  await build({
    entryPoints: [entryFile],
    outfile: outFile,
    bundle: false,
    minify: true,
    sourcemap: false,
    target: 'es2017',
    logLevel: 'silent',
  });
}

async function minifyCss() {
  await Promise.all(
    cssFiles.map(async (relativePath) => {
      const sourcePath = path.join(srcDir, relativePath);
      const destPath = path.join(distDir, relativePath);
      const raw = await fs.readFile(sourcePath, 'utf8');
      const { css } = csso.minify(raw);
      await fs.writeFile(destPath, css, 'utf8');
    })
  );
}

(async () => {
  try {
    await copySource();
    await minifyJavaScript();
    await minifyCss();
    console.log('Build complete. Output ready in dist/.');
  } catch (error) {
    console.error('[says-web build] Build failed.');
    console.error(error);
    process.exit(1);
  }
})();
