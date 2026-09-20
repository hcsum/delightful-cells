import "./globals.css";
import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { serverLocale } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

// Use default runtime; OpenNext will generate the Worker wrapper

// The title template and the keyword list are what a page inherits when it says
// nothing itself, so they have to follow the request's locale too — a Chinese
// page suffixed "| Excel Data Tools" reads as an English page to a crawler.
const SITE = {
  en: {
    default: "Reliable Bulk AI for Excel & CSV | Delightful Cells",
    template: "%s | Excel Data Tools",
    description:
      "Run AI across thousands of Excel or CSV rows with automatic retries and partial-result recovery. Completed rows are preserved, and credits never expire.",
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
      "bulk ai spreadsheet processing",
      "bulk ai excel",
      "ai process csv rows",
    ],
  },
  zh: {
    default: "可靠的 Excel 与 CSV 批量 AI 处理 | Delightful Cells",
    template: "%s | Excel 数据工具",
    description:
      "用 AI 批量处理数千行 Excel 或 CSV 数据。失败任务自动重试，已完成的行会保留，还能只重跑失败的行；点数一次购买、永不过期。",
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
      "ai 批量处理表格",
      "ai 批量处理 excel",
    ],
  },
  ja: {
    default: "Excel・CSV向けの信頼できる一括AI処理 | Delightful Cells",
    template: "%s | Excel データツール",
    description:
      "ExcelやCSVの数千行をAIで一括処理。失敗した処理は自動で再試行され、完了済みの行は保持されます。失敗した行だけの再実行も可能です。",
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
      "ai 表計算 一括処理",
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
        <GoogleAnalytics />
        <AppShell initialLocale={locale}>{children}</AppShell>
      </body>
    </html>
  );
}
