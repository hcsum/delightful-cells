import CustomToolClient from "@/components/CustomToolClient";
import ToolLanding from "@/components/ToolLanding";
import { JAPANESE_EXTRACTION, JapaneseExtractionGuide, japaneseExample } from "@/lib/japanese-extraction";
import type { LandingEntry } from "@/lib/landing-copy";
import { localizedMetadata, serverLocale } from "@/lib/seo";

const PATH = "/extract-first-name-from-full-name-excel";

const COPY: LandingEntry = {
  en: {
    title: "Extract First Name from Full Name (Excel & CSV Tool)",
    description:
      "Upload an Excel file (.xlsx) or CSV and extract first names from a full name column.",
    h1: "Extract First Name from Full Name",
    intro:
      "Extract first names from a full name column in your Excel file. Preview a few sample rows to check the result, or process the full file right away.",
    steps: [
      "**Upload your Excel file** — .xlsx, .xls, or .csv.",
      "Pick the **Source column** that contains full names (e.g., “full name”).",
      "Set **Target** to “first name”.",
      "**Preview** a few rows; supports middle names and multi-word surnames.",
      "**Process full file** to download a copy with a new first-name column.",
    ],
  },
  zh: {
    title: "Excel 从姓名提取名字（Excel 和 CSV 工具）",
    description:
      "上传 Excel（.xlsx）或 CSV 文件，从完整姓名列里提取名（first name），预览确认后一次处理整份文件。",
    h1: "从完整姓名提取名字",
    intro:
      "从 Excel 文件的姓名列里提取名（first name）。可以先预览几行确认效果，也可以直接处理整个文件。",
    steps: [
      "**上传 Excel 文件** —— 支持 .xlsx、.xls、.csv。",
      "选择包含完整姓名的**来源列**（例如「full name」）。",
      "把**目标**设为「first name」（名）。",
      "**预览**几行；中间名和多词姓氏都能正确处理。",
      "**处理整个文件**，下载带有名字新列的副本。",
    ],
  },
  ja: {
    title: "Excel 氏名を姓・名に分割：名を抽出（スペースなしも確認）",
    description:
      "Excel・CSVの日本語の氏名から名を抽出。半角・全角スペースのある名前を分割し、スペースなしの名前はAIの判断をプレビューで確認。姓・名を別々の列にする手順も紹介します。",
    h1: "Excelの氏名を分割して名を抽出",
    intro:
      "「山田 太郎」から「太郎」のように、日本語の氏名列から名だけを取り出します。姓・名の順で扱い、半角・全角スペースに対応。スペースなしの氏名は境界が曖昧になるため、結果の確認が必要です。",
    steps: [
      "**Excelファイルをアップロード** — .xlsx、.xls、.csvに対応しています。",
      "フルネームが入っている**元の列**（例：「氏名」）を選びます。",
      "**抽出対象**を「名」に設定します。",
      "数行を**プレビュー**し、姓・名の境界を確認します。スペースなしの氏名やnullの行は特に確認してください。",
      "**ファイル全体を処理**し、名の列が追加されたファイルをダウンロードします。",
    ],
  },
};

export function generateMetadata() {
  return localizedMetadata(PATH, COPY);
}

export default function Page() {
  const locale = serverLocale();
  const isJa = locale === "ja";
  return (
    <ToolLanding
      copy={COPY}
      tool={
        <CustomToolClient
          initialTarget={isJa ? "名" : "first name"}
          initialSource={isJa ? "氏名" : "full name"}
          initialInstructions={isJa ? JAPANESE_EXTRACTION.givenName.instructions : undefined}
        />
      }
      examples={isJa ? japaneseExample("givenName") : [
        {
          heading: {
            en: "Example — Extract first name from full name",
            zh: "示例 —— 从完整姓名提取名字",
            ja: "例 — フルネームから名を抽出",
          },
          target: { en: "first name", zh: "名（first name）", ja: "名" },
          source: { en: "full name", zh: "full name（完整姓名）", ja: "氏名" },
          columns: isJa ? ["氏名", "名"] : ["full name", "first name"],
          rows: [
            ["Ada Lovelace", "Ada"],
            ["Grace Hopper", "Grace"],
            ["Alan Mathison Turing", "Alan"],
            ["John von Neumann", "John"],
          ],
        },
      ]}
    >
      {isJa && <JapaneseExtractionGuide task="givenName" />}
    </ToolLanding>
  );
}
