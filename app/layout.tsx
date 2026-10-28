import "./globals.css";
import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import MicrosoftClarity from "@/components/MicrosoftClarity";
import { serverLocale } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

// Use default runtime; OpenNext will generate the Worker wrapper

// The title template is what a page inherits when it says nothing itself, so it
// has to follow the request's locale too — a Chinese
// page suffixed "| Excel Data Tools" reads as an English page to a crawler.
const SITE = {
  en: {
    default: "Reliable Bulk AI for Excel & CSV | Delightful Cells",
    template: "%s | Excel Data Tools",
    description:
      "Run AI across thousands of Excel or CSV rows with automatic retries and partial-result recovery. Completed rows are preserved, and credits never expire.",
  },
  zh: {
    default: "可靠的 Excel 与 CSV 批量 AI 处理 | Delightful Cells",
    template: "%s | Excel 数据工具",
    description:
      "用 AI 批量处理数千行 Excel 或 CSV 数据。失败任务自动重试，已完成的行会保留，还能只重跑失败的行；点数一次购买、永不过期。",
  },
  ja: {
    default: "Excel・CSV向けの信頼できる一括AI処理 | Delightful Cells",
    template: "%s | Excel データツール",
    description:
      "ExcelやCSVの数千行をAIで一括処理。失敗した処理は自動で再試行され、完了済みの行は保持されます。失敗した行だけの再実行も可能です。",
  },
} as const;

export function generateMetadata(): Metadata {
  const site = SITE[serverLocale()];
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: site.default, template: site.template },
    description: site.description,
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
        <MicrosoftClarity />
        <AppShell initialLocale={locale}>{children}</AppShell>
      </body>
    </html>
  );
}
