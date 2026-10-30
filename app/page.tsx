import CellsApp from "@/components/cells/CellsApp";
import ClassicTools from "@/components/cells/ClassicTools";
import { localeAlternates, serverLocale } from "@/lib/seo";

const COPY = {
  en: {
    title: "Reliable Bulk AI for Excel & CSV | Delightful Cells",
    description:
      "Run AI across thousands of Excel or CSV rows with automatic retries and partial-result recovery. Completed rows are preserved, and credits never expire.",
    ogDescription:
      "Upload an Excel or CSV, describe what each row needs, and get a complete result with automatic retries and recovery.",
    imageAlt: "Delightful Cells processing spreadsheet rows with AI",
  },
  zh: {
    title: "可靠的 Excel 与 CSV 批量 AI 处理 | Delightful Cells",
    description:
      "用 AI 批量处理数千行 Excel 或 CSV 数据。失败任务自动重试，已完成的行会保留，还能只重跑失败的行；点数一次购买、永不过期。",
    ogDescription:
      "上传 Excel 或 CSV，说明每行需要做什么；失败任务自动重试，并可恢复部分结果。",
    imageAlt: "Delightful Cells 使用 AI 批量处理表格行",
  },
  ja: {
    title: "Excel・CSV向けの信頼できる一括AI処理 | Delightful Cells",
    description:
      "ExcelやCSVの数千行をAIで一括処理。失敗した処理は自動で再試行され、完了済みの行は保持されます。失敗した行だけの再実行も可能で、クレジットに有効期限はありません。",
    ogDescription:
      "ExcelやCSVをアップロードし、各行の処理内容を指示。自動再試行と部分結果の復旧で、最後まで処理できます。",
    imageAlt: "Delightful Cellsでスプレッドシートの行をAI一括処理",
  },
};

export async function generateMetadata() {
  const locale = await serverLocale();
  const c = COPY[locale];
  return {
    title: { absolute: c.title },
    description: c.description,
    openGraph: {
      title: c.title,
      description: c.ogDescription,
      type: "website",
      siteName: "Delightful Cells",
      locale: locale === "zh" ? "zh_CN" : locale === "ja" ? "ja_JP" : "en_US",
      images: [
        {
          url: "/hero-image-3.png",
          width: 1200,
          height: 900,
          alt: c.imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: c.title,
      description: c.ogDescription,
      images: ["/hero-image-3.png"],
    },
    alternates: localeAlternates("/", locale),
    robots: { index: true, follow: true },
  };
}

export default async function HomePage() {
  const locale = await serverLocale();
  return (
    <>
      <CellsApp initialLocale={locale} />
      <ClassicTools />
    </>
  );
}
