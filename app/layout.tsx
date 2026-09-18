import "./globals.css";
import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import { serverLocale } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

// Use default runtime; OpenNext will generate the Worker wrapper

// The title template and the keyword list are what a page inherits when it says
// nothing itself, so they have to follow the request's locale too — a Chinese
// page suffixed "| Excel Data Tools" reads as an English page to a crawler.
const SITE = {
  en: {
    default: "Extract, summarize, classify, compare columns in Excel with AI",
    template: "%s | Excel Data Tools",
    description:
      "Extract, summarize, classify data from Excel or CSV files. Find duplicates, compare columns. Built for one-off cleanup tasks — upload, preview, and download results in seconds. Get jobs done without fighting Excel settings and formulas.",
    keywords: [
      // High-volume core
      "find duplicates in excel",
      "compare columns in excel",
      "compare two columns excel",
      "excel duplicate finder",
      "excel compare columns",

      // CSV & extraction
      "extract data from excel",
      "extract text from excel",
      "excel csv tool",
      "csv data cleanup",

      // AI as capability (not primary intent)
      "ai for excel",
      "ai excel tool",
      "excel ai data extraction",
    ],
  },
  zh: {
    default: "用 AI 提取、总结、分类、比较 Excel 的列",
    template: "%s | Excel 数据工具",
    description:
      "从 Excel 或 CSV 文件里提取、总结、分类数据，查找重复值，比较两列。为一次性的数据整理而做 —— 上传、预览、下载，几秒钟拿到结果，不用再跟 Excel 的设置和公式较劲。",
    keywords: [
      "excel 查找重复值",
      "excel 比较两列",
      "excel 两列数据对比",
      "excel 去重工具",
      "excel 提取数据",
      "excel 提取文本",
      "excel csv 工具",
      "csv 数据清洗",
      "excel ai 工具",
      "ai 处理 excel",
      "excel ai 数据提取",
    ],
  },
  ja: {
    default: "AIでExcelの列を抽出・要約・分類・比較",
    template: "%s | Excel データツール",
    description:
      "ExcelやCSVのデータを抽出・要約・分類できます。重複チェックや列の比較にも対応。ファイルをアップロードして結果を確認し、そのままダウンロードできます。",
    keywords: [
      "excel 重複 検索",
      "excel 2列 比較",
      "excel 列 比較",
      "excel 重複 チェック",
      "excel データ 抽出",
      "excel テキスト 抽出",
      "excel csv ツール",
      "csv データ クレンジング",
      "excel ai ツール",
      "ai excel 処理",
      "excel ai データ抽出",
    ],
  },
} as const;

export function generateMetadata(): Metadata {
  const site = SITE[serverLocale()];
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: site.default, template: site.template },
    description: site.description,
    keywords: [...site.keywords],
    icons: { icon: "/favicon.ico" },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = serverLocale();
  return (
    <html lang={locale === "zh" ? "zh-CN" : locale}>
      <body>
        <AppShell initialLocale={locale}>{children}</AppShell>
      </body>
    </html>
  );
}
