import fs from 'node:fs/promises';
import path from 'node:path';
import { pagesCompanionIntro, productScreenshots, userGuideSections } from '../lib/content/guides';

type PageKey = 'install' | 'guides' | 'screenshots';

interface DocSection {
  id: string;
  title: string;
  kicker?: string;
  content: string;
}

interface DocPage {
  key: PageKey;
  title: string;
  description: string;
  heroTitle: string;
  heroSummary: string;
  heroEyebrow: string;
  heroMeta?: string;
  sections: DocSection[];
}

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'out-pages');
const screenshotSourceDir = path.join(repoRoot, 'public', 'screenshots');
const screenshotOutputDir = path.join(outputDir, 'screenshots');
const repoUrl = 'https://github.com/JerrettDavis/ClaudeUsageDashboard';
const releaseUrl = `${repoUrl}/releases`;
const readmeUrl = `${repoUrl}/blob/master/README.md`;
const screenshotsUrl = `${repoUrl}/blob/master/SCREENSHOTS.md`;

const pagePaths: Record<PageKey, string> = {
  install: 'install/',
  guides: 'guides/',
  screenshots: 'screenshots/',
};

const screenshotById = new Map(productScreenshots.map((shot) => [shot.id, shot]));

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

function pageHref(currentDepth: number, target: PageKey) {
  const pagePath = pagePaths[target];
  return currentDepth === 0 ? pagePath : `../${pagePath}`;
}

function assetHref(currentDepth: number, assetPath: string) {
  return currentDepth === 0 ? assetPath : `../${assetPath}`;
}

function renderCodeBlock(code: string, label?: string) {
  return `
    <div class="code-block">
      ${label ? `<div class="code-label">${escapeHtml(label)}</div>` : ''}
      <pre><code>${escapeHtml(code)}</code></pre>
    </div>
  `;
}

function renderDocCard(
  title: string,
  description: string,
  options?: {
    eyebrow?: string;
    href?: string;
    label?: string;
    code?: string;
    list?: string[];
    tone?: 'default' | 'accent';
  }
) {
  const toneClass = options?.tone === 'accent' ? ' doc-card-accent' : '';

  return `
    <article class="doc-card${toneClass}">
      ${options?.eyebrow ? `<p class="card-eyebrow">${escapeHtml(options.eyebrow)}</p>` : ''}
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
      ${
        options?.list?.length
          ? `
            <ul class="doc-list">
              ${options.list.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          `
          : ''
      }
      ${options?.code ? renderCodeBlock(options.code) : ''}
      ${
        options?.href && options?.label
          ? `<a class="button secondary" href="${options.href}">${escapeHtml(options.label)}</a>`
          : ''
      }
    </article>
  `;
}

function renderFigure(
  currentDepth: number,
  screenshotId: string,
  options?: { captionTitle?: string; captionText?: string }
) {
  const screenshot = screenshotById.get(screenshotId);

  if (!screenshot) {
    return '';
  }

  return `
    <figure class="figure-card">
      <img
        src="${assetHref(currentDepth, `screenshots/${screenshot.fileName}`)}"
        alt="${escapeHtml(screenshot.alt)}"
        loading="lazy"
      />
      <figcaption>
        <strong>${escapeHtml(options?.captionTitle ?? screenshot.title)}</strong>
        <span>${escapeHtml(options?.captionText ?? screenshot.description)}</span>
      </figcaption>
    </figure>
  `;
}

function renderSection(section: DocSection) {
  return `
    <section id="${escapeHtml(section.id)}" class="doc-section">
      <div class="section-heading">
        ${section.kicker ? `<p class="section-kicker">${escapeHtml(section.kicker)}</p>` : ''}
        <h2>${escapeHtml(section.title)}</h2>
      </div>
      <div class="section-body">
        ${section.content}
      </div>
    </section>
  `;
}

function renderSidebar(currentDepth: number, activePage: PageKey) {
  const docsLinks = [
    { key: 'install' as const, label: 'Install', href: pageHref(currentDepth, 'install') },
    { key: 'guides' as const, label: 'Workflow guides', href: pageHref(currentDepth, 'guides') },
    {
      key: 'screenshots' as const,
      label: 'Screenshot reference',
      href: pageHref(currentDepth, 'screenshots'),
    },
  ];

  const projectLinks = [
    { label: 'Releases', href: releaseUrl },
    { label: 'README', href: readmeUrl },
    { label: 'GitHub repository', href: repoUrl },
  ];

  return `
    <aside class="docs-sidebar" aria-label="Documentation navigation">
      <div class="sidebar-panel">
        <p class="sidebar-title">Docs</p>
        <nav class="sidebar-nav">
          ${docsLinks
            .map(
              (link) => `
                <a class="sidebar-link${link.key === activePage ? ' is-active' : ''}" href="${link.href}">
                  ${escapeHtml(link.label)}
                </a>
              `
            )
            .join('')}
        </nav>
      </div>

      <div class="sidebar-panel">
        <p class="sidebar-title">Project</p>
        <nav class="sidebar-nav">
          ${projectLinks
            .map(
              (link) => `
                <a class="sidebar-link external-link" href="${link.href}">
                  ${escapeHtml(link.label)}
                </a>
              `
            )
            .join('')}
        </nav>
      </div>
    </aside>
  `;
}

function renderToc(sections: DocSection[]) {
  return `
    <aside class="docs-toc" aria-label="On this page">
      <div class="toc-panel">
        <p class="sidebar-title">On this page</p>
        <nav class="toc-nav">
          ${sections
            .map(
              (section) => `
                <a class="toc-link" href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a>
              `
            )
            .join('')}
        </nav>
      </div>
    </aside>
  `;
}

function renderPager(currentDepth: number, activePage: PageKey) {
  const pagerMap: Record<PageKey, Array<{ title: string; label: string; href: string }>> = {
    install: [
      { title: 'Next', label: 'Workflow guides', href: pageHref(currentDepth, 'guides') },
      {
        title: 'Reference',
        label: 'Screenshot reference',
        href: pageHref(currentDepth, 'screenshots'),
      },
    ],
    guides: [
      { title: 'Previous', label: 'Install', href: pageHref(currentDepth, 'install') },
      {
        title: 'Next',
        label: 'Screenshot reference',
        href: pageHref(currentDepth, 'screenshots'),
      },
    ],
    screenshots: [
      { title: 'Previous', label: 'Workflow guides', href: pageHref(currentDepth, 'guides') },
      { title: 'Back to', label: 'Install', href: pageHref(currentDepth, 'install') },
    ],
  };

  return `
    <nav class="pager-grid" aria-label="Page navigation">
      ${pagerMap[activePage]
        .map(
          (item) => `
            <a class="pager-card" href="${item.href}">
              <span>${escapeHtml(item.title)}</span>
              <strong>${escapeHtml(item.label)}</strong>
            </a>
          `
        )
        .join('')}
    </nav>
  `;
}

function renderLayout(page: DocPage, currentDepth: number) {
  const serializedSections = page.sections.map((section) => section.id);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escapeHtml(page.description)}" />
    <title>${escapeHtml(page.title)}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #020617;
        --bg-muted: rgba(9, 15, 28, 0.9);
        --surface: rgba(8, 15, 29, 0.82);
        --surface-soft: rgba(15, 23, 42, 0.42);
        --surface-strong: rgba(5, 11, 22, 0.98);
        --text: #e6edf7;
        --muted: #94a3b8;
        --accent: #22c55e;
        --accent-secondary: #38bdf8;
        --accent-soft: rgba(34, 197, 94, 0.1);
        --accent-line: rgba(34, 197, 94, 0.42);
        --border: rgba(71, 85, 105, 0.62);
        --border-soft: rgba(148, 163, 184, 0.12);
        --shadow: 0 12px 32px rgba(2, 6, 23, 0.18);
        --radius-xl: 8px;
        --radius-lg: 6px;
        --radius-md: 4px;
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
        background:
          linear-gradient(rgba(56, 189, 248, 0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px),
          radial-gradient(circle at top left, rgba(34, 197, 94, 0.08), transparent 24%),
          linear-gradient(180deg, #020617 0%, #08101d 16%, var(--bg) 100%);
        background-size:
          28px 28px,
          28px 28px,
          auto,
          auto;
        color: var(--text);
      }

      a {
        color: inherit;
        text-decoration: none;
      }

      img {
        display: block;
        max-width: 100%;
      }

      code,
      pre {
        font-family:
          "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      }

      .skip-link {
        position: absolute;
        left: 16px;
        top: -48px;
        z-index: 100;
        padding: 10px 14px;
        border-radius: 4px;
        background: #111827;
        color: #ffffff;
      }

      .skip-link:focus {
        top: 16px;
      }

      .shell {
        width: min(1400px, calc(100% - 32px));
        margin: 0 auto;
      }

      .site-header {
        position: sticky;
        top: 0;
        z-index: 20;
        backdrop-filter: blur(16px);
        background: rgba(2, 6, 23, 0.88);
        border-bottom: 1px solid var(--border-soft);
      }

      .site-header .shell {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 14px 0;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        min-height: 44px;
        font-weight: 700;
      }

      .brand-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 4px;
        background: linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(56, 189, 248, 0.14));
        border: 1px solid rgba(56, 189, 248, 0.25);
      }

      .header-links {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .header-link,
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 10px 14px;
        border-radius: 4px;
        border: 1px solid var(--border);
        background: rgba(8, 15, 29, 0.72);
        color: var(--text);
        transition:
          transform 160ms ease,
          border-color 160ms ease,
          background 160ms ease;
        cursor: pointer;
      }

      .header-link:hover,
      .header-link:focus-visible,
      .button:hover,
      .button:focus-visible,
      .sidebar-link:hover,
      .sidebar-link:focus-visible,
      .toc-link:hover,
      .toc-link:focus-visible,
      .pager-card:hover,
      .pager-card:focus-visible {
        transform: translateY(-1px);
        border-color: rgba(148, 163, 184, 0.45);
      }

      .button.secondary {
        border-color: var(--border);
      }

      .button.primary {
        border-color: rgba(34, 197, 94, 0.4);
        background: linear-gradient(135deg, rgba(34, 197, 94, 0.14), rgba(14, 165, 233, 0.16));
      }

      .docs-shell {
        display: grid;
        gap: 24px;
        padding: 26px 0 80px;
      }

      .docs-sidebar,
      .docs-toc {
        align-self: start;
      }

      .sidebar-panel,
      .toc-panel {
        position: sticky;
        top: 88px;
        display: grid;
        gap: 12px;
        padding: 14px 0 0;
        border-radius: 0;
        border-top: 1px solid var(--border-soft);
        background: transparent;
      }

      .sidebar-title {
        margin: 0;
        color: var(--muted);
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-family:
          "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      }

      .sidebar-nav,
      .toc-nav {
        display: grid;
        gap: 8px;
      }

      .sidebar-link,
      .toc-link {
        min-height: 40px;
        padding: 10px 12px 10px 14px;
        border-radius: 0;
        border: 1px solid transparent;
        border-left-width: 2px;
        color: var(--muted);
      }

      .sidebar-link.is-active,
      .toc-link.is-active {
        border-color: transparent;
        border-left-color: var(--accent);
        background: rgba(34, 197, 94, 0.06);
        color: #d1fae5;
      }

      .doc-content {
        min-width: 0;
      }

      .doc-hero,
      .doc-section,
      .pager-grid {
        border-radius: 0;
        background: transparent;
        box-shadow: none;
      }

      .doc-hero {
        display: grid;
        gap: 18px;
        padding: 22px 0 26px;
        margin-bottom: 22px;
        border-top: 2px solid rgba(56, 189, 248, 0.24);
        border-bottom: 1px solid var(--border-soft);
      }

      .doc-breadcrumbs {
        display: inline-flex;
        width: fit-content;
        gap: 8px;
        align-items: center;
        padding: 4px 8px;
        border-radius: 3px;
        border: 1px solid rgba(56, 189, 248, 0.28);
        background: rgba(56, 189, 248, 0.08);
        color: #d1fae5;
        font-size: 0.76rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-family:
          "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      }

      h1,
      h2,
      h3,
      p {
        margin: 0;
      }

      h1 {
        font-size: clamp(2rem, 3vw, 3.2rem);
        line-height: 1.05;
        letter-spacing: -0.04em;
      }

      h2 {
        font-size: clamp(1.4rem, 2.2vw, 2rem);
        line-height: 1.12;
      }

      h3 {
        font-size: 1.05rem;
        line-height: 1.25;
      }

      .doc-summary,
      .section-body p,
      .doc-card p,
      .figure-card figcaption span,
      .callout p,
      .page-meta,
      .pager-card span {
        color: var(--muted);
        line-height: 1.72;
      }

      .hero-actions,
      .inline-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .callout-row,
      .doc-card-grid,
      .figure-grid {
        display: grid;
        gap: 16px;
      }

      .callout {
        padding: 16px 18px;
        border-radius: 0;
        border: 1px solid rgba(56, 189, 248, 0.14);
        border-left: 3px solid var(--accent-secondary);
        background: rgba(8, 15, 29, 0.74);
      }

      .callout strong {
        display: block;
        margin-bottom: 8px;
      }

      .doc-section {
        padding: 24px 0;
        margin-top: 0;
        border-top: 1px solid var(--border-soft);
      }

      .section-heading {
        display: grid;
        gap: 8px;
        margin-bottom: 18px;
      }

      .section-kicker,
      .card-eyebrow {
        color: #bbf7d0;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-family:
          "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      }

      .section-body {
        display: grid;
        gap: 16px;
      }

      .doc-card-grid {
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }

      .doc-card {
        display: grid;
        gap: 12px;
        padding: 18px;
        border-radius: 4px;
        border: 1px solid var(--border);
        background: rgba(8, 15, 29, 0.72);
        box-shadow: none;
      }

      .doc-card-accent {
        border-color: rgba(56, 189, 248, 0.18);
        background: linear-gradient(180deg, rgba(8, 15, 29, 0.94), rgba(8, 15, 29, 0.76));
      }

      .doc-list,
      .step-list {
        display: grid;
        gap: 10px;
        margin: 0;
        padding-left: 20px;
        color: var(--muted);
      }

      .step-list li,
      .doc-list li {
        line-height: 1.65;
      }

      .step-list strong {
        color: var(--text);
      }

      .code-block {
        overflow: hidden;
        border-radius: 4px;
        border: 1px solid rgba(56, 189, 248, 0.18);
        background: rgba(2, 6, 23, 0.96);
      }

      .code-label {
        padding: 10px 14px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        color: var(--muted);
        font-size: 0.8rem;
      }

      pre {
        margin: 0;
        overflow-x: auto;
        padding: 16px 18px;
      }

      code {
        color: #dcfce7;
        font-size: 0.92rem;
      }

      .figure-card {
        overflow: hidden;
        border-radius: 4px;
        border: 1px solid var(--border);
        background: rgba(2, 6, 23, 0.92);
      }

      .figure-card img {
        width: 100%;
        aspect-ratio: 16 / 10;
        object-fit: cover;
      }

      .figure-card figcaption {
        display: grid;
        gap: 6px;
        padding: 14px 16px;
      }

      .pager-grid {
        display: grid;
        gap: 14px;
        margin-top: 18px;
        padding: 18px 0 0;
        border-top: 1px solid var(--border-soft);
      }

      .pager-card {
        display: grid;
        gap: 6px;
        padding: 14px 16px;
        border-radius: 4px;
        border: 1px solid var(--border);
        background: rgba(8, 15, 29, 0.7);
      }

      .pager-card strong {
        color: var(--text);
      }

      footer {
        margin-top: 18px;
        padding: 20px 0 6px;
        text-align: center;
        color: var(--muted);
      }

      @media (min-width: 1120px) {
        .docs-shell {
          grid-template-columns: 260px minmax(0, 1fr) 220px;
        }

        .callout-row {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 1119px) {
        .docs-shell {
          grid-template-columns: 1fr;
        }

        .docs-toc {
          order: -1;
        }

        .sidebar-panel,
        .toc-panel {
          position: static;
        }
      }

      @media (max-width: 720px) {
        .shell {
          width: min(100% - 20px, 1400px);
        }

        .doc-hero,
        .doc-section {
          padding: 22px;
        }

        .header-links {
          width: 100%;
        }

        .header-link,
        .button {
          flex: 1 1 160px;
        }
      }
    </style>
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to content</a>
    <header class="site-header">
      <div class="shell">
        <a class="brand" href="${currentDepth === 0 ? './' : '../'}">
          <span class="brand-badge">AI</span>
          <span>Claude Usage Dashboard Docs</span>
        </a>
        <nav class="header-links" aria-label="Project links">
          <a class="header-link" href="${releaseUrl}">Releases</a>
          <a class="header-link" href="${repoUrl}">Repository</a>
          <a class="header-link" href="${readmeUrl}">README</a>
        </nav>
      </div>
    </header>

    <main class="shell docs-shell" id="main-content">
      ${renderSidebar(currentDepth, page.key)}

      <article class="doc-content">
        <section class="doc-hero">
          <span class="doc-breadcrumbs">${escapeHtml(page.heroEyebrow)}</span>
          <h1>${escapeHtml(page.heroTitle)}</h1>
          <p class="doc-summary">${escapeHtml(page.heroSummary)}</p>
          ${page.heroMeta ? `<div class="page-meta">${page.heroMeta}</div>` : ''}
          <div class="hero-actions">
            <a class="button primary" href="${releaseUrl}">Download desktop build</a>
            <a class="button secondary" href="${pageHref(currentDepth, 'guides')}">Open workflow guides</a>
            <a class="button secondary" href="${pageHref(currentDepth, 'screenshots')}">Browse screenshots</a>
          </div>
        </section>

        ${page.sections.map((section) => renderSection(section)).join('')}
        ${renderPager(currentDepth, page.key)}

        <footer>
          <p>Built from repository content with <code>npm run pages:build</code>.</p>
        </footer>
      </article>

      ${renderToc(page.sections)}
    </main>

    <script>
      const sectionIds = ${escapeJson(serializedSections)};
      const tocLinks = Array.from(document.querySelectorAll('.toc-link'));
      const sections = sectionIds
        .map((id) => document.getElementById(id))
        .filter(Boolean);

      const setActiveToc = (id) => {
        tocLinks.forEach((link) => {
          const isActive = link.getAttribute('href') === '#' + id;
          link.classList.toggle('is-active', isActive);
        });
      };

      if (sections.length > 0) {
        const observer = new IntersectionObserver(
          (entries) => {
            const visible = entries
              .filter((entry) => entry.isIntersecting)
              .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

            if (visible?.target?.id) {
              setActiveToc(visible.target.id);
            }
          },
          {
            rootMargin: '-20% 0px -55% 0px',
            threshold: [0.2, 0.45, 0.75],
          }
        );

        sections.forEach((section) => observer.observe(section));
        setActiveToc(sections[0].id);
      }
    </script>
  </body>
</html>`;
}

function createInstallPage(currentDepth: number): DocPage {
  const installCards = [
    renderDocCard(
      'Recommended: desktop release',
      'The fastest path if you want the real dashboard without setting up Node or Docker first.',
      {
        eyebrow: 'Fastest setup',
        href: releaseUrl,
        label: 'Open releases',
        list: [
          'Download the archive for Windows, macOS, or Linux.',
          'Extract the bundle and launch the packaged app.',
          'Point it at your local Claude data and start exploring sessions.',
        ],
        tone: 'accent',
      }
    ),
    renderDocCard(
      'Run with Docker',
      'Use a local container when you want repeatable setup and a clean runtime boundary.',
      {
        eyebrow: 'Container',
        code: `docker compose up -d

docker run -d -p 3000:3000 \\
  -v ~/.claude:/home/nextjs/.claude:ro \\
  -v ./data:/app/data \\
  ghcr.io/jerrettdavis/claudeusagedashboard:latest`,
      }
    ),
    renderDocCard(
      'Run from source',
      'Best for contributors and anyone extending the dashboard, guides, or automation workflows.',
      {
        eyebrow: 'Source',
        code: `git clone ${repoUrl}.git
cd ClaudeUsageDashboard
npm install
npm run dev`,
      }
    ),
  ].join('');

  const installFigure = renderFigure(currentDepth, 'dashboard-overview', {
    captionTitle: 'The first screen you should expect',
    captionText:
      'The dashboard opens with high-signal metrics, sync actions, and recent session activity so users see value immediately.',
  });

  return {
    key: 'install',
    title: 'Claude Usage Dashboard Docs | Install',
    description:
      'Install Claude Usage Dashboard locally with desktop, Docker, or source workflows, then verify the dashboard is ready to inspect Claude sessions.',
    heroEyebrow: 'Docs / Install',
    heroTitle: 'Install Claude Usage Dashboard',
    heroSummary:
      'This Pages site is the documentation shell for a local-first dashboard. Use it to choose an install path, understand the runtime requirements, and jump into the workflow docs once the app is running.',
    heroMeta: `
      <div class="callout">
        <strong>Why this site is static</strong>
        <p>${escapeHtml(pagesCompanionIntro)}</p>
      </div>
    `,
    sections: [
      {
        id: 'recommended-install',
        title: 'Recommended install path',
        kicker: 'Start here',
        content: `
          <p>If you want the cleanest first-run experience, start with the packaged desktop release. Docker and source are still documented here when you want a containerized or fully hackable setup.</p>
          <div class="doc-card-grid">
            ${installCards}
          </div>
          <div class="callout-row">
            ${installFigure}
            <div class="callout">
              <strong>What happens next</strong>
              <p>Once the app is running, open the dashboard, confirm recent activity is visible, and use the built-in guides to learn the sessions and monitoring views.</p>
            </div>
          </div>
        `,
      },
      {
        id: 'system-requirements',
        title: 'System requirements',
        kicker: 'Before you install',
        content: `
          <div class="doc-card-grid">
            ${renderDocCard(
              'Desktop build',
              'No Node.js setup required. Download the packaged app for your platform and run it locally.',
              {
                list: [
                  'Windows, macOS, and Linux archives are published on GitHub Releases.',
                  'The bundle includes the runtime, so setup is minimal.',
                ],
              }
            )}
            ${renderDocCard(
              'Docker',
              'Use Docker when you want a reproducible local deployment that mounts your Claude data.',
              {
                list: [
                  'Docker Engine or Docker Desktop installed locally.',
                  'A writable local data directory for SQLite.',
                  'A readable Claude session directory mounted into the container.',
                ],
              }
            )}
            ${renderDocCard(
              'Source',
              'Running from source is ideal when you want to customize UI, routes, or workflows.',
              {
                list: [
                  'Node.js installed locally.',
                  'The repository cloned to your machine.',
                  'Access to your local Claude session files under ~/.claude.',
                ],
              }
            )}
          </div>
        `,
      },
      {
        id: 'alternative-methods',
        title: 'Alternative install methods',
        kicker: 'Detailed setup',
        content: `
          <p>Use Docker when you want a clean runtime boundary, or run from source when you are extending the codebase. Both routes are fully local and keep your data on your own machine.</p>
          <div class="doc-card-grid">
            ${renderDocCard(
              'Docker Compose',
              'Start the app in the background and then open the dashboard in your browser.',
              {
                code: `docker compose up -d`,
              }
            )}
            ${renderDocCard(
              'Source workflow',
              'Install dependencies and start the Next.js server in development mode.',
              {
                code: `npm install
npm run dev`,
              }
            )}
          </div>
          <div class="callout">
            <strong>Need the full command reference?</strong>
            <p>The README documents all supported paths in more detail, including the exact Docker mount configuration and source commands.</p>
            <div class="inline-actions">
              <a class="button secondary" href="${readmeUrl}#installation">Read installation docs</a>
              <a class="button secondary" href="${readmeUrl}#quick-start">Open quick start</a>
            </div>
          </div>
        `,
      },
      {
        id: 'verify-install',
        title: 'Verify the install',
        kicker: 'Sanity check',
        content: `
          <ol class="step-list">
            <li><strong>Open the dashboard.</strong> The main dashboard should show usage metrics, quick actions, and recent activity.</li>
            <li><strong>Run a sync if needed.</strong> Use the sync action so the local database picks up your latest Claude sessions.</li>
            <li><strong>Open the Sessions view.</strong> Confirm that project names, timestamps, tokens, and costs appear in the session list.</li>
            <li><strong>Open the guides hub.</strong> Use the built-in guides page to orient yourself before diving into monitoring or session detail views.</li>
          </ol>
          <div class="doc-card-grid">
            ${renderDocCard(
              'Open the guides hub next',
              'Use the workflow docs once you have the app running so the main surfaces feel obvious instead of exploratory.',
              {
                href: pageHref(currentDepth, 'guides'),
                label: 'Open workflow guides',
              }
            )}
            ${renderDocCard(
              'See what the dashboard looks like',
              'Compare your local app to the committed screenshot reference if you want a quick visual sanity check.',
              {
                href: pageHref(currentDepth, 'screenshots'),
                label: 'Browse screenshots',
              }
            )}
          </div>
        `,
      },
    ],
  };
}

function createGuidesPage(currentDepth: number): DocPage {
  return {
    key: 'guides',
    title: 'Claude Usage Dashboard Docs | Workflow guides',
    description:
      'Workflow-oriented docs for Claude Usage Dashboard covering the dashboard, sessions, session detail, and tiling monitor.',
    heroEyebrow: 'Docs / Workflow guides',
    heroTitle: 'Guides for the core product workflows',
    heroSummary:
      'Use these route-by-route walkthroughs after installation. They are written to help new users understand the dashboard surfaces quickly, with current screenshots alongside the instructions.',
    sections: userGuideSections.map((guide) => {
      const screenshot = screenshotById.get(guide.screenshotId);

      return {
        id: guide.id,
        title: guide.title,
        kicker: guide.route,
        content: `
          <p>${escapeHtml(guide.summary)}</p>
          <div class="callout-row">
            <div>
              <ol class="step-list">
                ${guide.steps
                  .map(
                    (step) => `
                      <li>
                        <strong>${escapeHtml(step.title)}</strong>
                        ${escapeHtml(step.description)}
                      </li>
                    `
                  )
                  .join('')}
              </ol>
            </div>
            ${screenshot ? renderFigure(currentDepth, screenshot.id) : ''}
          </div>
        `,
      };
    }),
  };
}

function createScreenshotsPage(currentDepth: number): DocPage {
  return {
    key: 'screenshots',
    title: 'Claude Usage Dashboard Docs | Screenshot reference',
    description:
      'Current screenshot reference for Claude Usage Dashboard, generated from the seeded Playwright environment.',
    heroEyebrow: 'Docs / Screenshot reference',
    heroTitle: 'Current screenshot reference',
    heroSummary:
      'These screenshots come from the seeded Playwright environment so the docs stay aligned with the product. Use them as visual reference for the dashboard, sessions, guides, and monitoring views.',
    heroMeta: `
      <div class="inline-actions">
        <a class="button secondary" href="${screenshotsUrl}">Open SCREENSHOTS.md</a>
        <a class="button secondary" href="${readmeUrl}#development">Read the Playwright workflow</a>
      </div>
    `,
    sections: [
      {
        id: 'current-captures',
        title: 'Current captures',
        kicker: 'Reference',
        content: `
          <div class="doc-card-grid">
            ${productScreenshots
              .map(
                (shot) => `
                  <article class="doc-card">
                    <p class="card-eyebrow">${escapeHtml(shot.route)}</p>
                    <h3>${escapeHtml(shot.title)}</h3>
                    <p>${escapeHtml(shot.description)}</p>
                    ${renderFigure(currentDepth, shot.id)}
                  </article>
                `
              )
              .join('')}
          </div>
        `,
      },
      {
        id: 'refresh-workflow',
        title: 'Refresh workflow',
        kicker: 'Automation',
        content: `
          <p>Refresh the committed product screenshots with the seeded Playwright flow so the docs and Pages site stay visually current.</p>
          ${renderCodeBlock(`npm run screenshots`, 'Generate screenshots')}
          <div class="callout">
            <strong>Why this matters</strong>
            <p>The screenshot pipeline uses deterministic seed data, which keeps the docs stable and makes CI Pages builds predictable.</p>
          </div>
        `,
      },
    ],
  };
}

async function writePage(filePath: string, html: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, html, 'utf8');
}

async function main() {
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(screenshotOutputDir, { recursive: true });

  try {
    await fs.cp(screenshotSourceDir, screenshotOutputDir, { recursive: true });
  } catch {
    // Screenshots are expected to exist in CI and after the local capture script runs.
  }

  const installRoot = createInstallPage(0);
  const installNested = createInstallPage(1);
  const guidesPage = createGuidesPage(1);
  const screenshotsPage = createScreenshotsPage(1);

  await Promise.all([
    writePage(path.join(outputDir, 'index.html'), renderLayout(installRoot, 0)),
    writePage(path.join(outputDir, 'install', 'index.html'), renderLayout(installNested, 1)),
    writePage(path.join(outputDir, 'guides', 'index.html'), renderLayout(guidesPage, 1)),
    writePage(path.join(outputDir, 'screenshots', 'index.html'), renderLayout(screenshotsPage, 1)),
  ]);

  console.log(`Built GitHub Pages site at ${outputDir}`);
}

main().catch((error) => {
  console.error('Failed to build Pages site:', error);
  process.exit(1);
});
