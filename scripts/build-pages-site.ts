import fs from 'node:fs/promises';
import path from 'node:path';
import { pagesCompanionIntro, productScreenshots, userGuideSections } from '../lib/content/guides';

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'out-pages');
const screenshotSourceDir = path.join(repoRoot, 'public', 'screenshots');
const screenshotOutputDir = path.join(outputDir, 'screenshots');
const repoUrl = 'https://github.com/JerrettDavis/ClaudeUsageDashboard';
const releaseUrl = `${repoUrl}/releases`;
const readmeUrl = `${repoUrl}/blob/master/README.md`;
const screenshotsUrl = `${repoUrl}/blob/master/SCREENSHOTS.md`;

const featureHighlights = [
  {
    title: 'Watch live work as it happens',
    description:
      'Track active Claude sessions with a terminal-style monitor, preloaded history, and controls for auto-open and auto-close.',
    points: ['Tiling session wall', 'Server-sent event stream', 'On-demand history loading'],
  },
  {
    title: 'Understand cost and activity fast',
    description:
      'See message counts, token totals, cost estimates, and recent activity without digging through raw JSONL files.',
    points: ['Session-level totals', 'Project context', 'Recent activity snapshots'],
  },
  {
    title: 'Inspect a single run in depth',
    description:
      'Jump from high-level metrics to detailed session pages with summaries, files touched, folders accessed, and message timelines.',
    points: ['Conversation summary', 'Files and folders', 'Tool usage timeline'],
  },
  {
    title: 'Stay local-first',
    description:
      'The dashboard is designed to run close to your Claude data with local SQLite storage, local file access, and no external telemetry.',
    points: ['100% local runtime', 'SQLite-backed data', 'No hosted dependency for the dashboard'],
  },
];

const installPaths = [
  {
    id: 'desktop',
    title: 'Download a desktop build',
    summary: 'The quickest path if you want a packaged app with the runtime bundled for you.',
    detail: 'Grab the portable app for Windows, macOS, or Linux from GitHub Releases.',
    ctaLabel: 'Open releases',
    href: releaseUrl,
    note: 'Best for evaluating the product quickly.',
  },
  {
    id: 'docker',
    title: 'Run with Docker',
    summary:
      'Great for a repeatable local deployment that mounts your Claude data into the dashboard.',
    detail:
      'Use Docker Compose or pull the published image from GitHub Container Registry and map ~/.claude plus the data directory.',
    ctaLabel: 'View Docker setup',
    href: `${readmeUrl}#option-2-docker`,
    note: 'Best for self-hosted local use without a Node toolchain.',
  },
  {
    id: 'source',
    title: 'Run from source',
    summary:
      'Ideal if you want to customize the dashboard, extend the UI, or work directly with the codebase.',
    detail: 'Clone the repo, install dependencies, and start the Next.js app locally.',
    ctaLabel: 'Read source setup',
    href: `${readmeUrl}#option-3-from-source`,
    note: 'Best for contributors and fast iteration.',
  },
];

const resourceLinks = [
  {
    title: 'Repository',
    description: 'Browse the source, issues, workflows, and release artifacts on GitHub.',
    href: repoUrl,
    label: 'Open repository',
  },
  {
    title: 'Setup guide',
    description:
      'Read the full installation and quick-start instructions for every supported path.',
    href: readmeUrl,
    label: 'Read README',
  },
  {
    title: 'Screenshot reference',
    description:
      'See the committed product screenshots and how they are refreshed through Playwright.',
    href: screenshotsUrl,
    label: 'Open screenshot docs',
  },
];

const faqItems = [
  {
    question: 'Why is this site static?',
    answer:
      'GitHub Pages hosts a static companion because the actual dashboard depends on Next.js server routes, tRPC, SSE, and SQLite.',
  },
  {
    question: 'Can I use the dashboard from this URL?',
    answer:
      'No. This Pages site is a product tour and setup guide. To use the dashboard, install a release, run Docker, or start it from source locally.',
  },
  {
    question: 'Are these screenshots current?',
    answer:
      'Yes. They are generated from a seeded Playwright environment so the static docs stay aligned with the product workflow.',
  },
];

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeJson(value: unknown) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

function renderFeatureHighlights() {
  return featureHighlights
    .map(
      (feature) => `
        <article class="feature-card" data-testid="feature-card">
          <h3>${escapeHtml(feature.title)}</h3>
          <p>${escapeHtml(feature.description)}</p>
          <ul class="inline-list">
            ${feature.points.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}
          </ul>
        </article>
      `
    )
    .join('');
}

function renderInstallPaths() {
  return installPaths
    .map(
      (option) => `
        <article class="install-card" id="${escapeHtml(option.id)}">
          <div class="card-topline">${escapeHtml(option.note)}</div>
          <h3>${escapeHtml(option.title)}</h3>
          <p>${escapeHtml(option.summary)}</p>
          <p class="detail">${escapeHtml(option.detail)}</p>
          <a class="button secondary" href="${option.href}">${escapeHtml(option.ctaLabel)}</a>
        </article>
      `
    )
    .join('');
}

function renderTourSelectors() {
  return productScreenshots
    .map(
      (shot, index) => `
        <button
          type="button"
          class="tour-tab${index === 0 ? ' is-active' : ''}"
          data-shot-index="${index}"
          data-testid="shot-selector"
          aria-selected="${index === 0 ? 'true' : 'false'}"
        >
          <span class="tour-tab-title">${escapeHtml(shot.title)}</span>
          <span class="tour-tab-route">${escapeHtml(shot.route)}</span>
          <span class="tour-tab-copy">${escapeHtml(shot.description)}</span>
        </button>
      `
    )
    .join('');
}

function renderGuideSections() {
  return userGuideSections
    .map((guide) => {
      const screenshot = productScreenshots.find((item) => item.id === guide.screenshotId);

      return `
        <article class="guide-card" id="${escapeHtml(guide.id)}">
          <div class="guide-copy">
            <p class="route">${escapeHtml(guide.route)}</p>
            <h3>${escapeHtml(guide.title)}</h3>
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
                <div class="guide-aside">
                  <img src="screenshots/${escapeHtml(screenshot.fileName)}" alt="${escapeHtml(screenshot.alt)}" />
                  <div class="guide-aside-copy">
                    <strong>${escapeHtml(screenshot.title)}</strong>
                    <span>${escapeHtml(screenshot.description)}</span>
                  </div>
                </div>
              `
              : ''
          }
        </article>
      `;
    })
    .join('');
}

function renderResourceLinks() {
  return resourceLinks
    .map(
      (resource) => `
        <article class="resource-card">
          <h3>${escapeHtml(resource.title)}</h3>
          <p>${escapeHtml(resource.description)}</p>
          <a class="button tertiary" href="${resource.href}">${escapeHtml(resource.label)}</a>
        </article>
      `
    )
    .join('');
}

function renderFaqs() {
  return faqItems
    .map(
      (item) => `
        <article class="faq-card">
          <h3>${escapeHtml(item.question)}</h3>
          <p>${escapeHtml(item.answer)}</p>
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

  const initialShot = productScreenshots[0];
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta
      name="description"
      content="A polished static tour for Claude Usage Dashboard with install paths, feature highlights, workflow guides, and current screenshots."
    />
    <title>Claude Usage Dashboard | Product tour and setup guide</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #050816;
        --bg-elevated: rgba(14, 23, 42, 0.92);
        --bg-soft: rgba(15, 23, 42, 0.62);
        --panel: rgba(15, 23, 42, 0.84);
        --panel-strong: rgba(15, 23, 42, 0.96);
        --border: rgba(148, 163, 184, 0.2);
        --border-strong: rgba(103, 232, 249, 0.32);
        --text: #e5eefb;
        --muted: #9fb0c9;
        --muted-strong: #c6d3e7;
        --accent: #67e8f9;
        --accent-strong: #22d3ee;
        --accent-soft: rgba(34, 211, 238, 0.12);
        --shadow: 0 30px 80px rgba(2, 6, 23, 0.45);
        --radius-xl: 28px;
        --radius-lg: 20px;
        --radius-md: 14px;
      }

      * {
        box-sizing: border-box;
      }

      html {
        scroll-behavior: smooth;
      }

      body {
        margin: 0;
        font-family:
          Inter, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top, rgba(34, 211, 238, 0.12), transparent 30%),
          linear-gradient(180deg, #020617 0%, var(--bg) 52%, #020617 100%);
      }

      a {
        color: inherit;
        text-decoration: none;
      }

      img {
        max-width: 100%;
      }

      .shell {
        width: min(1180px, calc(100% - 32px));
        margin: 0 auto;
      }

      .site-header {
        position: sticky;
        top: 0;
        z-index: 10;
        backdrop-filter: blur(18px);
        background: rgba(2, 6, 23, 0.72);
        border-bottom: 1px solid rgba(148, 163, 184, 0.14);
      }

      .site-header .shell {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 16px 0;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font-weight: 700;
      }

      .brand-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(34, 211, 238, 0.3), rgba(59, 130, 246, 0.3));
        border: 1px solid rgba(103, 232, 249, 0.35);
      }

      .site-nav {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .site-nav a {
        padding: 10px 12px;
        border-radius: 999px;
        color: var(--muted);
        font-size: 0.95rem;
      }

      .site-nav a:hover,
      .site-nav a:focus-visible {
        background: rgba(148, 163, 184, 0.12);
        color: var(--text);
      }

      main {
        padding: 36px 0 88px;
      }

      .hero {
        display: grid;
        gap: 24px;
        align-items: stretch;
        margin-bottom: 28px;
      }

      .hero-copy,
      .hero-panel {
        padding: 28px;
        border-radius: var(--radius-xl);
        border: 1px solid var(--border);
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(15, 23, 42, 0.76));
        box-shadow: var(--shadow);
      }

      .hero-copy {
        display: grid;
        gap: 18px;
      }

      .eyebrow {
        display: inline-flex;
        width: fit-content;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid var(--border-strong);
        background: var(--accent-soft);
        color: #a5f3fc;
        font-size: 0.76rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .eyebrow.small {
        font-size: 0.72rem;
      }

      h1,
      h2,
      h3,
      p {
        margin: 0;
      }

      h1 {
        font-size: clamp(2.3rem, 4vw, 4.25rem);
        line-height: 1.02;
        letter-spacing: -0.04em;
      }

      h2 {
        font-size: clamp(1.65rem, 2vw, 2.5rem);
        line-height: 1.1;
      }

      h3 {
        font-size: 1.15rem;
        line-height: 1.25;
      }

      .lede,
      .section-copy,
      .summary,
      .detail,
      .resource-card p,
      .faq-card p,
      .feature-card p,
      .hero-panel p {
        color: var(--muted);
        line-height: 1.7;
      }

      .hero-actions,
      .resource-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        padding: 12px 16px;
        border-radius: 14px;
        border: 1px solid transparent;
        font-weight: 600;
        transition:
          transform 150ms ease,
          background 150ms ease,
          border-color 150ms ease,
          color 150ms ease;
      }

      .button:hover,
      .button:focus-visible {
        transform: translateY(-1px);
      }

      .button.primary {
        background: linear-gradient(135deg, rgba(34, 211, 238, 0.88), rgba(59, 130, 246, 0.88));
        color: #04111f;
      }

      .button.secondary,
      .button.tertiary {
        border-color: var(--border);
        background: rgba(15, 23, 42, 0.68);
      }

      .button.tertiary {
        color: var(--muted-strong);
      }

      .hero-points,
      .inline-list {
        display: grid;
        gap: 10px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .hero-points li,
      .inline-list li {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        color: var(--muted-strong);
      }

      .hero-points li::before,
      .inline-list li::before {
        content: "";
        width: 8px;
        height: 8px;
        flex: 0 0 8px;
        border-radius: 999px;
        background: linear-gradient(135deg, var(--accent), #60a5fa);
      }

      .hero-panel {
        display: grid;
        gap: 18px;
      }

      .hero-panel h2 {
        font-size: 1.4rem;
      }

      .fact-grid {
        display: grid;
        gap: 12px;
      }

      .fact-card {
        padding: 16px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border);
        background: var(--bg-soft);
      }

      .fact-card strong {
        display: block;
        margin-bottom: 6px;
      }

      .fact-card span {
        color: var(--muted);
        line-height: 1.6;
      }

      .section {
        padding: 30px;
        margin-top: 26px;
        border-radius: var(--radius-xl);
        border: 1px solid var(--border);
        background: rgba(7, 12, 26, 0.72);
        box-shadow: var(--shadow);
      }

      .section-header {
        display: grid;
        gap: 10px;
        margin-bottom: 22px;
      }

      .feature-grid,
      .install-grid,
      .guide-grid,
      .resource-grid,
      .faq-grid {
        display: grid;
        gap: 18px;
      }

      .feature-card,
      .install-card,
      .guide-card,
      .resource-card,
      .faq-card {
        padding: 20px;
        border-radius: var(--radius-lg);
        border: 1px solid var(--border);
        background: var(--panel);
      }

      .feature-card,
      .install-card,
      .resource-card,
      .faq-card {
        display: grid;
        gap: 14px;
      }

      .card-topline {
        color: #a5f3fc;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .tour-shell {
        display: grid;
        gap: 18px;
      }

      .tour-preview {
        overflow: hidden;
        border-radius: var(--radius-lg);
        border: 1px solid var(--border);
        background: var(--panel-strong);
      }

      .tour-preview img {
        display: block;
        width: 100%;
        aspect-ratio: 16 / 10;
        object-fit: cover;
        background: #030712;
      }

      .tour-caption {
        display: grid;
        gap: 10px;
        padding: 18px;
      }

      .tour-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }

      .route-pill {
        display: inline-flex;
        width: fit-content;
        padding: 4px 10px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: #a5f3fc;
        font-family: Consolas, "SFMono-Regular", monospace;
        font-size: 0.78rem;
      }

      .tour-links {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .tour-list {
        display: grid;
        gap: 12px;
      }

      .tour-tab {
        width: 100%;
        padding: 16px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border);
        background: rgba(15, 23, 42, 0.72);
        color: inherit;
        text-align: left;
        cursor: pointer;
      }

      .tour-tab:hover,
      .tour-tab:focus-visible,
      .tour-tab.is-active {
        border-color: rgba(103, 232, 249, 0.42);
        background: rgba(20, 36, 61, 0.9);
      }

      .tour-tab-title,
      .tour-tab-route,
      .tour-tab-copy {
        display: block;
      }

      .tour-tab-title {
        font-weight: 700;
        margin-bottom: 6px;
      }

      .tour-tab-route {
        color: #a5f3fc;
        font-family: Consolas, "SFMono-Regular", monospace;
        font-size: 0.76rem;
        margin-bottom: 6px;
      }

      .tour-tab-copy {
        color: var(--muted);
        line-height: 1.6;
      }

      .guide-card {
        display: grid;
        gap: 18px;
      }

      .guide-copy {
        display: grid;
        gap: 12px;
      }

      .route {
        color: #a5f3fc;
        font-family: Consolas, "SFMono-Regular", monospace;
        font-size: 0.78rem;
      }

      ol {
        margin: 0;
        padding-left: 20px;
        display: grid;
        gap: 12px;
      }

      li {
        color: var(--muted);
        line-height: 1.65;
      }

      li strong {
        display: block;
        color: var(--text);
        margin-bottom: 4px;
      }

      .guide-aside {
        overflow: hidden;
        border-radius: 18px;
        border: 1px solid var(--border);
        background: rgba(4, 10, 22, 0.82);
      }

      .guide-aside img {
        display: block;
        width: 100%;
        aspect-ratio: 16 / 10;
        object-fit: cover;
      }

      .guide-aside-copy {
        display: grid;
        gap: 6px;
        padding: 14px 16px;
      }

      .guide-aside-copy span {
        color: var(--muted);
        line-height: 1.6;
      }

      footer {
        margin-top: 26px;
        padding: 22px 0 8px;
        color: var(--muted);
        text-align: center;
      }

      footer code {
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: #a5f3fc;
      }

      @media (min-width: 860px) {
        .hero {
          grid-template-columns: minmax(0, 1.25fr) minmax(330px, 0.75fr);
        }

        .feature-grid,
        .install-grid,
        .resource-grid,
        .faq-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .tour-shell {
          grid-template-columns: minmax(0, 1.08fr) minmax(320px, 0.92fr);
          align-items: start;
        }

        .guide-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (min-width: 1080px) {
        .feature-grid,
        .resource-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      @media (max-width: 720px) {
        .shell {
          width: min(100% - 20px, 1180px);
        }

        main {
          padding-top: 24px;
        }

        .hero-copy,
        .hero-panel,
        .section {
          padding: 22px;
        }

        .site-header .shell {
          padding: 14px 0;
        }

        .site-nav {
          width: 100%;
        }

        .site-nav a {
          padding-inline: 10px;
        }
      }
    </style>
  </head>
  <body>
    <header class="site-header">
      <div class="shell">
        <a class="brand" href="#top">
          <span class="brand-badge">AI</span>
          <span>Claude Usage Dashboard</span>
        </a>
        <nav class="site-nav" aria-label="Primary">
          <a href="#overview">Overview</a>
          <a href="#install">Install</a>
          <a href="#tour">Product tour</a>
          <a href="#guides">Workflows</a>
          <a href="#resources">Resources</a>
        </nav>
      </div>
    </header>

    <main class="shell">
      <section class="hero" id="top">
        <div class="hero-copy">
          <span class="eyebrow">Static companion for a local-first dashboard</span>
          <h1>See the product, pick your install path, and get value before you ever clone the repo.</h1>
          <p class="lede">
            Claude Usage Dashboard helps you monitor active AI coding sessions, inspect conversation history, and understand token and cost trends without shipping your data to a hosted service.
          </p>
          <div class="hero-actions">
            <a class="button primary" data-testid="download-cta" href="${releaseUrl}">Download desktop app</a>
            <a class="button secondary" data-testid="setup-cta" href="#install">Choose an install path</a>
            <a class="button tertiary" data-testid="repo-cta" href="${repoUrl}">Browse source on GitHub</a>
          </div>
          <ul class="hero-points">
            <li>Understand the product before installing anything.</li>
            <li>See current screenshots generated from the Playwright seed environment.</li>
            <li>Jump directly to the best setup option for desktop, Docker, or source.</li>
          </ul>
        </div>

        <aside class="hero-panel" data-testid="expectation-card">
          <span class="eyebrow small">What this page is</span>
          <h2>A guided tour, not the live dashboard</h2>
          <p>${escapeHtml(pagesCompanionIntro)}</p>
          <div class="fact-grid">
            <div class="fact-card">
              <strong>100% local dashboard runtime</strong>
              <span>Run the real app on your own machine with local files, SQLite, and live routes.</span>
            </div>
            <div class="fact-card">
              <strong>${productScreenshots.length} current screenshots</strong>
              <span>Preview the main dashboard surfaces without landing on a dead-end documentation page.</span>
            </div>
            <div class="fact-card">
              <strong>${userGuideSections.length} guided workflows</strong>
              <span>Follow focused walkthroughs for setup, sessions, detail views, and live monitoring.</span>
            </div>
          </div>
        </aside>
      </section>

      <section class="section" id="overview">
        <div class="section-header">
          <span class="eyebrow small">Overview</span>
          <h2>What you can actually do with the dashboard</h2>
          <p class="section-copy">
            The product is built for people who want a fast, visual read on Claude activity: what is running, what it cost, what changed, and which sessions deserve a closer look.
          </p>
        </div>
        <div class="feature-grid">
          ${renderFeatureHighlights()}
        </div>
      </section>

      <section class="section" id="install">
        <div class="section-header">
          <span class="eyebrow small">Install</span>
          <h2>Choose the fastest path to a working dashboard</h2>
          <p class="section-copy">
            Start with the path that matches how you prefer to evaluate new tools: packaged app, local container, or source checkout.
          </p>
        </div>
        <div class="install-grid">
          ${renderInstallPaths()}
        </div>
      </section>

      <section class="section" id="tour">
        <div class="section-header">
          <span class="eyebrow small">Product tour</span>
          <h2>Walk the core surfaces before you install</h2>
          <p class="section-copy">
            Use the guided screenshot tour to understand the dashboard layout, session inventory, detail pages, monitoring wall, and in-app guides.
          </p>
        </div>
        <div class="tour-shell">
          <figure class="tour-preview" data-testid="tour-preview">
            <img
              id="tour-image"
              src="screenshots/${escapeHtml(initialShot.fileName)}"
              alt="${escapeHtml(initialShot.alt)}"
            />
            <figcaption class="tour-caption">
              <div class="tour-meta">
                <span class="route-pill" id="tour-route">${escapeHtml(initialShot.route)}</span>
              </div>
              <h3 id="tour-title">${escapeHtml(initialShot.title)}</h3>
              <p class="section-copy" id="tour-description">${escapeHtml(initialShot.description)}</p>
              <div class="tour-links">
                <a class="button secondary" id="tour-image-link" href="screenshots/${escapeHtml(initialShot.fileName)}">Open full-size image</a>
                <a class="button tertiary" href="${screenshotsUrl}">Read screenshot docs</a>
              </div>
            </figcaption>
          </figure>

          <div class="tour-list" role="tablist" aria-label="Product screenshots">
            ${renderTourSelectors()}
          </div>
        </div>
      </section>

      <section class="section" id="guides">
        <div class="section-header">
          <span class="eyebrow small">Workflows</span>
          <h2>Use the dashboard with a clear mental model</h2>
          <p class="section-copy">
            Each workflow below matches a real product surface, so the static site can help users orient themselves instead of dumping them into raw docs.
          </p>
        </div>
        <div class="guide-grid">
          ${renderGuideSections()}
        </div>
      </section>

      <section class="section" id="resources">
        <div class="section-header">
          <span class="eyebrow small">Resources</span>
          <h2>Keep moving after the tour</h2>
          <p class="section-copy">
            If you came here expecting the live dashboard, these are the fastest next steps to install it, inspect the code, or review the screenshot workflow.
          </p>
        </div>
        <div class="resource-grid">
          ${renderResourceLinks()}
        </div>
        <div class="section-header" style="margin-top: 28px;">
          <span class="eyebrow small">FAQ</span>
          <h2>Common questions</h2>
        </div>
        <div class="faq-grid">
          ${renderFaqs()}
        </div>
      </section>

      <footer>
        <p>
          Built from repository content with <code>npm run pages:build</code> and ready for GitHub Pages deployment.
        </p>
      </footer>
    </main>

    <script>
      const screenshots = ${escapeJson(productScreenshots)};
      const image = document.getElementById('tour-image');
      const title = document.getElementById('tour-title');
      const description = document.getElementById('tour-description');
      const route = document.getElementById('tour-route');
      const imageLink = document.getElementById('tour-image-link');
      const buttons = Array.from(document.querySelectorAll('[data-shot-index]'));

      function setActiveShot(index) {
        const shot = screenshots[index];
        if (!shot || !image || !title || !description || !route || !imageLink) {
          return;
        }

        image.setAttribute('src', 'screenshots/' + shot.fileName);
        image.setAttribute('alt', shot.alt);
        title.textContent = shot.title;
        description.textContent = shot.description;
        route.textContent = shot.route;
        imageLink.setAttribute('href', 'screenshots/' + shot.fileName);

        buttons.forEach((button, buttonIndex) => {
          const isActive = buttonIndex === index;
          button.classList.toggle('is-active', isActive);
          button.setAttribute('aria-selected', String(isActive));
        });
      }

      buttons.forEach((button) => {
        button.addEventListener('click', () => {
          const nextIndex = Number(button.getAttribute('data-shot-index'));
          setActiveShot(nextIndex);
        });
      });
    </script>
  </body>
</html>`;

  await fs.writeFile(path.join(outputDir, 'index.html'), html, 'utf8');
  console.log(`Built GitHub Pages site at ${outputDir}`);
}

main().catch((error) => {
  console.error('Failed to build Pages site:', error);
  process.exit(1);
});
