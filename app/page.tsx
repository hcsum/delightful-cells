import CellsApp from "@/components/cells/CellsApp";
import ClassicTools from "@/components/cells/ClassicTools";
import { localeAlternates, serverLocale } from "@/lib/seo";

const COPY = {
  en: {
    title: "Delightful Cells — chat with your Excel spreadsheet",
    description:
      "Upload an Excel or CSV file, see it instantly, and edit it by talking: summarize a column, highlight rows, batch find & replace, AI-fill a new column. Plus classic one-job tools for extracting, comparing, and de-duplicating columns.",
    ogDescription:
      "Upload an Excel or CSV, see it instantly, and edit it in plain English. Tools run locally in your browser.",
  },
  zh: {
    title: "Delightful Cells —— 跟你的 Excel 表格对话",
    description:
      "上传 Excel 或 CSV 文件，立刻看到内容，然后用说话的方式改它：总结一列、高亮行、批量查找替换、让 AI 填出新的一列。还有一批只做一件事的经典工具，用来提取、比较和去重。",
    ogDescription:
      "上传 Excel 或 CSV，立刻看到内容，用大白话就能改。工具在你的浏览器里本地运行。",
  },
};

export function generateMetadata() {
  const locale = serverLocale();
  const c = COPY[locale];
  return {
    title: c.title,
    description: c.description,
    openGraph: {
      title: c.title,
      description: c.ogDescription,
      type: "website",
      images: [
        {
          url: "/hero-image-3.png",
          width: 1200,
          height: 900,
          alt: "AI working on an Excel spreadsheet",
        },
      ],
    },
    alternates: localeAlternates("/", locale),
    robots: { index: true, follow: true },
  };
}

export default function HomePage() {
  const locale = serverLocale();
  return (
    <>
      <CellsApp initialLocale={locale} />
      <ClassicTools />
    </>
  );
}
