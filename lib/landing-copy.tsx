import type { ReactNode } from "react";
import type { AppLocale } from "@/lib/locale-routing";

// Copy shared by every single-task landing page. Translating "How to Use This
// Tool" fourteen times is fourteen chances to word it differently, which is
// exactly what a crawler reads as fourteen unrelated pages.
const SHARED = {
  en: {
    howTo: "How to Use This Tool",
    examples: "Examples",
    expected: "Expected output:",
    target: "Target:",
    source: "Source:",
    stepUpload: "**Upload your Excel file** — .xlsx, .xls, or .csv.",
    stepPreviewGeneric: "**Preview** a few rows to check the output.",
    stepProcess:
      "**Process full file** to download a copy with the new column added.",
    introSuffix:
      "Preview a few sample rows to check the result, or process the full file right away.",
  },
  zh: {
    howTo: "怎么用",
    examples: "示例",
    expected: "输出结果：",
    target: "目标：",
    source: "来源：",
    stepUpload: "**上传 Excel 文件** —— 支持 .xlsx、.xls、.csv。",
    stepPreviewGeneric: "**预览**几行，确认结果是否符合预期。",
    stepProcess: "**处理整个文件**，下载带有新列的副本。",
    introSuffix: "可以先预览几行确认效果，也可以直接处理整个文件。",
  },
  ja: {
    howTo: "使い方",
    examples: "例",
    expected: "出力例:",
    target: "抽出対象:",
    source: "元の列:",
    stepUpload: "**Excel ファイルをアップロード** — .xlsx、.xls、.csv に対応しています。",
    stepPreviewGeneric: "数行を**プレビュー**して、出力を確認します。",
    stepProcess: "**ファイル全体を処理**して、新しい列が追加されたファイルをダウンロードします。",
    introSuffix: "数行をプレビューして結果を確認するか、そのままファイル全体を処理できます。",
  },
} as const;

export type SharedKey = keyof (typeof SHARED)["en"];

export function shared(locale: AppLocale, key: SharedKey): string {
  return SHARED[locale][key];
}

// Landing copy carries **bold** and *italic* runs because the English original
// marked the action word in every how-to step. Storing the steps as plain
// strings keeps the translations next to each other instead of buried in JSX.
export function rich(text: string): ReactNode[] {
  return text.split(/(\*\*.+?\*\*|\*.+?\*)/g).map((part, i) => {
    if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    return <span key={i}>{part}</span>;
  });
}

export type LandingCopy = {
  title: string;
  description: string;
  h1: string;
  intro: string;
  steps: string[];
};

export type LandingEntry = Record<AppLocale, LandingCopy>;
