import CustomToolClient from "@/components/CustomToolClient";
import ToolLanding from "@/components/ToolLanding";
import { localizedMetadata } from "@/lib/seo";

const PATH = "/excel-extract-number-from-string";

const COPY = {
  en: {
    title: "Excel: Extract Number from String (Excel & CSV Tool)",
    description:
      "Extract numbers from text strings in an Excel (.xlsx) or CSV column. Perfect for pulling prices, IDs, SKUs, and other digits from messy cells. Preview results, then process the full file.",
    h1: "Excel: Extract Number from String",
    intro:
      "Pull numeric values from a text column in your Excel or CSV file — great for prices, IDs, SKUs, postal codes, or any digits embedded in strings. Paste a few rows to preview, then upload and process the full file.",
    steps: [
      "**Upload your Excel file** — .xlsx, .xls, or .csv.",
      "Pick the **Source column** that holds mixed text (e.g., descriptions or notes).",
      "Keep the **Target** as “all numeric values” to pull integers and decimals.",
      "**Preview** a few rows; adjust the description if needed.",
      "**Process full file** and download a copy with a new numbers column.",
    ],
  },
  zh: {
    title: "Excel 从字符串提取数字（Excel 和 CSV 工具）",
    description:
      "从 Excel（.xlsx）或 CSV 的文本列里提取数字，适合从杂乱单元格中取出价格、编号、SKU 等。先预览结果，再处理整份文件。",
    h1: "Excel：从字符串提取数字",
    intro:
      "从 Excel 或 CSV 的文本列里取出数字 —— 价格、编号、SKU、邮编，或者任何混在文字里的数字都可以。可以先预览几行，再上传处理整个文件。",
    steps: [
      "**上传 Excel 文件** —— 支持 .xlsx、.xls、.csv。",
      "选择包含混合文本的**来源列**（例如描述或备注）。",
      "**目标**保持「all numeric values」（所有数字），整数和小数都会取出来。",
      "**预览**几行；结果不对就改一下目标描述。",
      "**处理整个文件**，下载带有数字新列的副本。",
    ],
  },
  ja: {
    title: "Excel：文字列から数値を抽出（Excel・CSV ツール）",
    description:
      "Excel（.xlsx）または CSV のテキスト列から数値を抽出します。価格、ID、SKUなど、文字と数字が混在するセルから数値を取り出せます。結果をプレビューしてからファイル全体を処理できます。",
    h1: "Excel：文字列から数値を抽出",
    intro:
      "Excel または CSV のテキスト列から数値を抽出します。価格、ID、SKU、郵便番号など、文字列に含まれる数値をまとめて取り出せます。数行で結果を確認してから、ファイル全体を処理できます。",
    steps: [
      "**Excel ファイルをアップロード** — .xlsx、.xls、.csv に対応しています。",
      "説明やメモなど、テキストと数字が混在する**元の列**を選びます。",
      "整数と小数を抽出するには、**抽出対象**を「すべての数値」のままにします。",
      "数行を**プレビュー**し、必要に応じて説明を調整します。",
      "**ファイル全体を処理**し、数値の列が追加されたファイルをダウンロードします。",
    ],
  },
};

const EXAMPLES = [
  {
    heading: {
      en: "Example — Extract numbers from mixed text",
      zh: "示例 —— 从混合文本里提取数字",
      ja: "例 — 数字が混在するテキストから数値を抽出",
    },
    target: {
      en: "all numeric values (including decimals)",
      zh: "所有数字（含小数）",
      ja: "すべての数値（小数を含む）",
    },
    source: { en: "text", zh: "text（文本）", ja: "text（テキスト）" },
    columns: ["text", "numbers"],
    rows: [
      ["Invoice #4453 total: $129.50 (2 items)", "4453, 129.50, 2"],
      ["Qty 3 - Ref 88-204, price 9.99", "3, 88, 204, 9.99"],
      ["no numbers here", ""],
      ["Order 5821 / 12 units / lot A", "5821, 12"],
    ],
  },
];

export function generateMetadata() {
  return localizedMetadata(PATH, COPY);
}

export default function Page() {
  return (
    <ToolLanding copy={COPY} tool={<CustomToolClient />} examples={EXAMPLES} />
  );
}
