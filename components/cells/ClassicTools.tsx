"use client";

import Link from "next/link";
import type { Route } from "next";
import { USE_CASES, useCaseTitle } from "@/lib/routes";
import { useLocale } from "@/lib/cells/locale";
import { localizePath } from "@/lib/locale-routing";

const CORE_TOOLS: { href: Route; title: string; titleZh: string; titleJa: string; desc: string; descZh: string; descJa: string }[] = [
  {
    href: "/extract-text-from-cell-excel",
    title: "Extract Text from Excel Cells",
    titleZh: "从 Excel 单元格提取文本",
    titleJa: "Excelのセルからテキストを抽出",
    desc: "AI-extract, classify, or summarize one column into a new column.",
    descZh: "用 AI 提取、分类或总结一列内容，并生成新列。",
    descJa: "列の内容をAIで抽出・分類・要約し、結果を新しい列に追加します。",
  },
  {
    href: "/compare-two-columns-in-excel",
    title: "Compare Two Columns",
    titleZh: "比较两列",
    titleJa: "2つの列を比較",
    desc: "Find duplicates, missing values, or matches between two columns.",
    descZh: "找出两列之间的重复、缺失或匹配项。",
    descJa: "2つの列を比較し、両方にある値、一方にしかない値、同じ行で一致する値を見つけます。",
  },
  {
    href: "/find-duplicates-in-excel",
    title: "Find Duplicates",
    titleZh: "查找重复值",
    titleJa: "重複値を検索",
    desc: "Flag duplicate values in any column, right in your browser.",
    descZh: "直接在浏览器中标记任意列的重复值。",
    descJa: "任意の列にある重複値をブラウザ内で検出します。",
  },
  {
    href: "/extract-numbers-from-text-excel",
    title: "Extract Numbers from Text",
    titleZh: "从文本提取数字",
    titleJa: "テキストから数値を抽出",
    desc: "Pull numbers out of messy text cells.",
    descZh: "从杂乱文本单元格中提取数字。",
    descJa: "文字と数字が混在するセルから、数値だけを抽出します。",
  },
];

// Internal-link hub for the classic single-task tools. Keeps the SEO pages
// one click from the homepage after Delightful Cells took over the root.
export default function ClassicTools() {
  const locale = useLocale();
  return (
    <section id="classic-tools" className="bg-[#fffdf8] px-4 pb-16 pt-4 text-black sm:px-6">
      <div>
        <h2 className="text-xl font-extrabold">
          {locale === "zh" ? "更想用单一任务工具？🔧" : locale === "ja" ? "目的別のシンプルなツール" : "Prefer a one-job tool? 🔧"}
        </h2>
        <p className="mt-1 text-sm text-black/55">
          {locale === "zh"
            ? "经典工具每次只做一件事：不用聊天，上传就能处理。"
            : locale === "ja"
              ? "各ツールは1つの作業に特化しています。チャットは不要で、ファイルを選ぶだけで使えます。"
              : "The classic tools each do exactly one thing — no chat, just upload and go."}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CORE_TOOLS.map((t) => (
            <Link
              key={t.href}
              href={localizePath(t.href, locale)}
              className="rounded-2xl border !border-black/10 bg-[#fffaf0] p-4 !text-black hover:bg-[#fff3d6]"
            >
              <span className="font-bold">{locale === "zh" ? t.titleZh : locale === "ja" ? t.titleJa : t.title}</span>
              <span className="mt-1 block text-sm text-black/55">{locale === "zh" ? t.descZh : locale === "ja" ? t.descJa : t.desc}</span>
            </Link>
          ))}
        </div>
        <h3 className="mt-8 text-sm font-extrabold uppercase tracking-wide text-black/50">
          {locale === "zh" ? "常用提取模板" : locale === "ja" ? "よく使われる抽出ツール" : "Popular extraction recipes"}
        </h3>
        <ul className="mt-3 flex flex-wrap gap-2">
          {USE_CASES.map((u) => (
            <li key={u.href}>
              <Link
                href={localizePath(u.href, locale)}
                className="inline-block rounded-full border !border-black/15 bg-white px-3 py-1 text-xs font-semibold !text-black/70 hover:bg-[#ffe6ef]"
              >
                {useCaseTitle(u, locale).replace(/^Excel: |^Excel：/, "")}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-xs text-black/40">
          <Link href={localizePath("/terms", locale)} className="underline !text-black/40">
            {locale === "zh" ? "服务条款" : locale === "ja" ? "利用規約" : "Terms of Service"}
          </Link>
        </p>
      </div>
    </section>
  );
}
