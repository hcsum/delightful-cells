import Link from "next/link";
import type { Route } from "next";
import { USE_CASES } from "@/lib/routes";

const CORE_TOOLS: { href: Route; title: string; desc: string }[] = [
  {
    href: "/extract-text-from-cell-excel",
    title: "Extract Text from Excel Cells",
    desc: "AI-extract, classify, or summarize one column into a new column.",
  },
  {
    href: "/compare-two-columns-in-excel",
    title: "Compare Two Columns",
    desc: "Find duplicates, missing values, or matches between two columns.",
  },
  {
    href: "/find-duplicates-in-excel",
    title: "Find Duplicates",
    desc: "Flag duplicate values in any column, right in your browser.",
  },
  {
    href: "/extract-numbers-from-text-excel",
    title: "Extract Numbers from Text",
    desc: "Pull numbers out of messy text cells.",
  },
];

// Internal-link hub for the classic single-task tools. Keeps the SEO pages
// one click from the homepage after Delightful Cells took over the root.
export default function ClassicTools() {
  return (
    <section id="classic-tools" className="bg-[#fffdf8] px-4 pb-16 pt-4 text-black sm:px-6">
      <div>
        <h2 className="text-xl font-extrabold">
          Prefer a one-job tool? 🔧
        </h2>
        <p className="mt-1 text-sm text-black/55">
          The classic tools each do exactly one thing — no chat, just upload
          and go.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CORE_TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-2xl border !border-black/10 bg-[#fffaf0] p-4 !text-black hover:bg-[#fff3d6]"
            >
              <span className="font-bold">{t.title}</span>
              <span className="mt-1 block text-sm text-black/55">{t.desc}</span>
            </Link>
          ))}
        </div>
        <h3 className="mt-8 text-sm font-extrabold uppercase tracking-wide text-black/50">
          Popular extraction recipes
        </h3>
        <ul className="mt-3 flex flex-wrap gap-2">
          {USE_CASES.map((u) => (
            <li key={u.href}>
              <Link
                href={u.href}
                className="inline-block rounded-full border !border-black/15 bg-white px-3 py-1 text-xs font-semibold !text-black/70 hover:bg-[#ffe6ef]"
              >
                {u.title.replace(/^Excel: /, "")}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-xs text-black/40">
          <a
            href="https://github.com/hcsum/delightful-cells"
            className="underline !text-black/40"
          >
            Open source on GitHub
          </a>
          {" · "}
          <Link href="/terms" className="underline !text-black/40">
            Terms of Service
          </Link>
        </p>
      </div>
    </section>
  );
}
