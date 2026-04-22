import fs from 'node:fs/promises';
import path from 'node:path';
import { pagesCompanionIntro, productScreenshots, userGuideSections } from '../lib/content/guides';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'out-pages');
const screenshotSourceDir = path.join(repoRoot, 'public', 'screenshots');
const screenshotOutputDir = path.join(outputDir, 'screenshots');
const repoUrl = 'https://github.com/JerrettDavis/ClaudeUsageDashboard';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderGuideSections() {
  return userGuideSections
    .map((guide) => {
      const screenshot = productScreenshots.find((item) => item.id === guide.screenshotId);

      return `
        <section class="guide-card" id="${escapeHtml(guide.id)}">
          <div class="guide-copy">
            <p class="route">${escapeHtml(guide.route)}</p>
            <h2>${escapeHtml(guide.title)}</h2>
            <p class="summary">${escapeHtml(guide.summary)}</p>
            <ol>
              ${guide.steps
                .map(
                  (step) => `
                    <li>
                      <strong>${escapeHtml(step.title)}</strong>
                      <span>${escapeHtml(step.description)}</span>
                    </li>
                  `
                )
                .join('')}
            </ol>
          </div>
          ${
            screenshot
              ? `
                <figure class="guide-shot">
                  <img src="screenshots/${escapeHtml(screenshot.fileName)}" alt="${escapeHtml(screenshot.alt)}" />
                  <figcaption>
                    <strong>${escapeHtml(screenshot.title)}</strong>
                    <span>${escapeHtml(screenshot.description)}</span>
                  </figcaption>
                </figure>
              `
              : ''
          }
        </section>
      `;
    })
    .join('');
}

function renderScreenshotCards() {
  return productScreenshots
    .map(
      (shot) => `
        <article class="shot-card">
          <img src="screenshots/${escapeHtml(shot.fileName)}" alt="${escapeHtml(shot.alt)}" />
          <div class="shot-copy">
            <h3>${escapeHtml(shot.title)}</h3>
            <p>${escapeHtml(shot.description)}</p>
            <code>${escapeHtml(shot.route)}</code>
          </div>
        </article>
      `
    )
    .join('');
}

async function main() {
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(screenshotOutputDir, { recursive: true });

  try {
    await fs.cp(screenshotSourceDir, screenshotOutputDir, { recursive: true });
  } catch {
    // Screenshots are expected to exist in CI and after the local capture script runs.
  }

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Claude Usage Dashboard Guides</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #09090b;
        --panel: rgba(24, 24, 27, 0.9);
        --border: rgba(63, 63, 70, 0.8);
        --text: #f4f4f5;
        --muted: #a1a1aa;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, Segoe UI, sans-serif;
        background: linear-gradient(180deg, #020617 0%, var(--bg) 40%);
        color: var(--text);
      }
      a { color: inherit; }
      main { max-width: 1180px; margin: 0 auto; padding: 48px 20px 80px; }
      .hero { display: grid; gap: 16px; margin-bottom: 32px; }
      .eyebrow {
        display: inline-flex;
        width: fit-content;
        gap: 8px;
        padding: 6px 12px;
        border-radius: 999px;
        border: 1px solid rgba(34, 211, 238, 0.3);
        background: rgba(34, 211, 238, 0.12);
        color: #a5f3fc;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1 { font-size: clamp(2rem, 3vw, 3.4rem); margin: 0; }
      .lede { max-width: 72ch; color: var(--muted); line-height: 1.7; }
      .hero-actions { display: flex; flex-wrap: wrap; gap: 12px; }
      .button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: rgba(24, 24, 27, 0.85);
        text-decoration: none;
      }
      .guide-grid, .shots-grid { display: grid; gap: 20px; }
      .guide-grid { margin: 28px 0 40px; }
      .guide-card {
        display: grid;
        gap: 20px;
        padding: 20px;
        border-radius: 20px;
        border: 1px solid var(--border);
        background: var(--panel);
      }
      .route {
        margin: 0 0 8px;
        color: #67e8f9;
        font-family: Consolas, monospace;
        font-size: 12px;
      }
      .summary { color: var(--muted); line-height: 1.7; }
      ol { margin: 0; padding-left: 20px; display: grid; gap: 12px; }
      li { color: var(--muted); line-height: 1.6; }
      li strong, .shot-copy h3 { display: block; color: var(--text); margin-bottom: 4px; }
      .guide-shot, .shot-card {
        overflow: hidden;
        border-radius: 18px;
        border: 1px solid var(--border);
        background: rgba(9, 9, 11, 0.6);
      }
      .guide-shot img, .shot-card img { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; }
      .guide-shot figcaption, .shot-copy { display: grid; gap: 6px; padding: 14px 16px; }
      .guide-shot span, .shot-copy p { color: var(--muted); line-height: 1.6; margin: 0; }
      .shots-grid { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
      .shot-copy code {
        width: fit-content;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(34, 211, 238, 0.12);
        color: #a5f3fc;
      }
      footer {
        margin-top: 48px;
        padding-top: 20px;
        border-top: 1px solid var(--border);
        color: var(--muted);
      }
      @media (min-width: 960px) {
        .guide-card { grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr); }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <span class="eyebrow">Claude Usage Dashboard</span>
        <h1>Guides, screenshots, and Pages-ready docs</h1>
        <p class="lede">${escapeHtml(pagesCompanionIntro)}</p>
        <div class="hero-actions">
          <a class="button" href="${repoUrl}">View repository</a>
          <a class="button" href="${repoUrl}/blob/master/README.md">Read README</a>
          <a class="button" href="${repoUrl}/blob/master/SCREENSHOTS.md">Screenshot reference</a>
        </div>
      </section>

      <section class="guide-grid">
        ${renderGuideSections()}
      </section>

      <section>
        <h2>Current product screenshots</h2>
        <p class="lede">These captures are generated from the seeded Playwright environment so the static docs stay aligned with the product.</p>
        <div class="shots-grid">
          ${renderScreenshotCards()}
        </div>
      </section>

      <footer>
        <p>Built from repository content with <code>npm run pages:build</code>.</p>
      </footer>
    </main>
  </body>
</html>`;

  await fs.writeFile(path.join(outputDir, 'index.html'), html, 'utf8');
  console.log(`Built GitHub Pages site at ${outputDir}`);
}

main().catch((error) => {
  console.error('Failed to build Pages site:', error);
  process.exit(1);
});
