import { BookOpen, ExternalLink, MonitorPlay, Route as RouteIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { DashboardLayout } from '@/components/shared/dashboard-layout';
import { pagesCompanionIntro, productScreenshots, userGuideSections } from '@/lib/content/guides';

const pagesUrl = 'https://jerrettdavis.github.io/ClaudeUsageDashboard/';

export default function GuidesPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-mono text-cyan-300">
              <BookOpen className="h-3.5 w-3.5" />
              USER GUIDES
            </div>
            <div>
              <h1 className="text-3xl font-bold text-zinc-100">Learn the dashboard fast</h1>
              <p className="max-w-3xl text-sm text-zinc-400">{pagesCompanionIntro}</p>
            </div>
          </div>

          <Link
            href={pagesUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-cyan-500/40 hover:text-cyan-300"
          >
            <MonitorPlay className="h-4 w-4" />
            Open GitHub Pages companion
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>

        <section className="grid gap-4 lg:grid-cols-2">
          {userGuideSections.map((guide) => {
            const screenshot = productScreenshots.find((item) => item.id === guide.screenshotId);

            return (
              <article
                key={guide.id}
                className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50"
              >
                <div className="border-b border-zinc-800 bg-zinc-950/80 px-5 py-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-mono text-cyan-400">
                    <RouteIcon className="h-3.5 w-3.5" />
                    {guide.route}
                  </div>
                  <h2 className="text-xl font-semibold text-zinc-100">{guide.title}</h2>
                  <p className="mt-2 text-sm text-zinc-400">{guide.summary}</p>
                </div>

                <div className="grid gap-4 p-5 xl:grid-cols-[1.1fr,0.9fr]">
                  <ol className="space-y-3">
                    {guide.steps.map((step, index) => (
                      <li
                        key={step.title}
                        className="rounded-md border border-zinc-800 bg-zinc-950/60 p-4"
                      >
                        <div className="mb-2 flex items-center gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/15 text-xs font-mono text-cyan-300">
                            {index + 1}
                          </span>
                          <h3 className="text-sm font-semibold text-zinc-200">{step.title}</h3>
                        </div>
                        <p className="text-sm leading-6 text-zinc-400">{step.description}</p>
                      </li>
                    ))}
                  </ol>

                  {screenshot ? (
                    <figure className="overflow-hidden rounded-lg border border-zinc-800 bg-black/30">
                      <Image
                        src={`/screenshots/${screenshot.fileName}`}
                        alt={screenshot.alt}
                        width={1280}
                        height={800}
                        className="aspect-[16/10] w-full object-cover"
                      />
                      <figcaption className="space-y-1 border-t border-zinc-800 px-4 py-3">
                        <div className="text-sm font-semibold text-zinc-200">
                          {screenshot.title}
                        </div>
                        <p className="text-xs leading-5 text-zinc-500">{screenshot.description}</p>
                      </figcaption>
                    </figure>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold text-zinc-100">Current product screenshots</h2>
            <p className="text-sm text-zinc-400">
              These images are generated from the seeded Playwright environment so the docs track
              the real UI.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {productScreenshots.map((screenshot) => (
              <Link
                key={screenshot.id}
                href={screenshot.route}
                className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50 transition-colors hover:border-cyan-500/40"
              >
                <Image
                  src={`/screenshots/${screenshot.fileName}`}
                  alt={screenshot.alt}
                  width={1280}
                  height={800}
                  className="aspect-[16/10] w-full object-cover"
                />
                <div className="space-y-1 border-t border-zinc-800 px-4 py-3">
                  <div className="text-sm font-semibold text-zinc-200">{screenshot.title}</div>
                  <p className="text-xs leading-5 text-zinc-500">{screenshot.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
