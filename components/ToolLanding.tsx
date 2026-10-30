import type { ReactNode } from "react";
import QuotaBanner from "@/components/QuotaBanner";
import RowsLimitNote from "@/components/RowsLimitNote";
import { rich, shared, type LandingEntry } from "@/lib/landing-copy";
import { serverLocale } from "@/lib/seo";
import type { AppLocale } from "@/lib/locale-routing";

export type LandingExample = {
  heading: Record<AppLocale, string>;
  target: Record<AppLocale, string>;
  source: Record<AppLocale, string>;
  columns: string[];
  rows: string[][];
};

// The single-task pages were fourteen copies of one layout, which is why the
// Chinese routes rendered English: there was no one place to translate. The
// layout lives here now and each page is just its own words.
export default async function ToolLanding({
  copy,
  tool,
  examples = [],
  children,
}: {
  copy: LandingEntry;
  tool: ReactNode;
  examples?: LandingExample[];
  children?: ReactNode;
}) {
  const locale = await serverLocale();
  const c = copy[locale];
  const hasGuide = c.steps.length > 0 || examples.length > 0;

  return (
    <div className="space-y-6">
      <h1 id="tool-top" className="text-2xl font-semibold">
        {c.h1}
      </h1>
      <p className="text-white/80 max-w-2xl text-muted">{c.intro}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <QuotaBanner />
        </div>
        <RowsLimitNote />
      </div>
      {tool}

      {hasGuide && (
        <div className="space-y-8 pt-12">
          <hr />
          {c.steps.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">{shared(locale, "howTo")}</h2>
              <ol className="list-decimal pl-6 space-y-2 text-white/80">
                {c.steps.map((step, i) => (
                  <li key={i}>{rich(step)}</li>
                ))}
              </ol>
            </section>
          )}
          {examples.length > 0 && (
            <h2 className="text-xl font-semibold">{shared(locale, "examples")}</h2>
          )}
        </div>
      )}

      {examples.length > 0 && (
        <section className="space-y-12">
          {examples.map((ex, i) => (
            <article key={i} className="space-y-3">
              <h3 className="text-lg font-medium">{ex.heading[locale]}</h3>
              <ul className="text-white/80 text-sm space-y-1">
                <li>
                  <strong>{shared(locale, "target")}</strong> {ex.target[locale]}
                </li>
                <li>
                  <strong>{shared(locale, "source")}</strong> {ex.source[locale]}
                </li>
              </ul>
              <div className="space-y-2">
                <div>{shared(locale, "expected")}</div>
                <div className="overflow-auto">
                  <table className="mt-1 w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-left">
                        {ex.columns.map((col, j) => (
                          <th
                            key={j}
                            className={`border-b border-white/10 py-1${j < ex.columns.length - 1 ? " pr-4" : ""}`}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ex.rows.map((row, r) => (
                        <tr key={r}>
                          {row.map((cell, j) => (
                            <td
                              key={j}
                              className={`align-top py-1${j < row.length - 1 ? " pr-4" : ""}`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {children}
    </div>
  );
}
