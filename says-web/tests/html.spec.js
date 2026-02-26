import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { load } from 'cheerio';

const projectRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(projectRoot, 'src', 'index.html');
const faviconPath = path.join(projectRoot, 'src', 'assets', 'icons', 'favicon.svg');
const socialCardPath = path.join(projectRoot, 'src', 'assets', 'images', 'social-card.svg');
const html = readFileSync(htmlPath, 'utf8');
const $ = load(html);

describe('SEO metadata', () => {
  it('includes core meta tags for search engines and social cards', () => {
    expect($('meta[name="description"]').attr('content')).toBeTruthy();
    expect($('meta[name="keywords"]').attr('content')).toBeTruthy();
    expect($('link[rel="canonical"]').attr('href')).toBeTruthy();
    expect($('meta[property="og:title"]').attr('content')).toContain('SAYS');
    expect($('meta[name="twitter:card"]').attr('content')).toBe('summary_large_image');
  });
});

describe('Navigation targets', () => {
  it('anchors map to real sections', () => {
    const anchors = $('.primary-nav a');
    expect(anchors.length).toBeGreaterThan(0);
    anchors.each((_, element) => {
      const href = $(element).attr('href');
      expect(href?.startsWith('#')).toBe(true);
      const targetId = href?.slice(1);
      expect(targetId).toBeTruthy();
      expect($(`#${targetId}`).length).toBe(1);
    });
  });
});

describe('Hero interactions', () => {
  it('hero CTA scroll target exists', () => {
    const button = $('.hero-cta');
    expect(button).toHaveLength(1);
    const target = button.attr('data-scroll-target');
    expect(target).toBe('#highlights');
    expect($(target).length).toBe(1);
  });

  it('hero artwork is optimized for loading', () => {
    const image = $('.hero img');
    expect(image.attr('loading')).toBe('lazy');
    expect(image.attr('decoding')).toBe('async');
  });
});

describe('Assets', () => {
  it('includes favicon and social preview assets', () => {
    expect(existsSync(faviconPath)).toBe(true);
    expect(existsSync(socialCardPath)).toBe(true);
  });
});
