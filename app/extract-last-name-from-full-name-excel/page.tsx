import CustomToolClient from "@/components/CustomToolClient";
import ToolLanding from "@/components/ToolLanding";
import { JAPANESE_EXTRACTION, JapaneseExtractionGuide, japaneseExample } from "@/lib/japanese-extraction";
import type { LandingEntry } from "@/lib/landing-copy";
import { localizedMetadata, serverLocale } from "@/lib/seo";

const PATH = "/extract-last-name-from-full-name-excel";

const COPY: LandingEntry = {
  en: {
    title: "Extract Last Name from Full Name (Excel & CSV Tool)",
    description:
      "Upload an Excel file (.xlsx) or CSV and extract last names from a full name column.",
    h1: "Extract Last Name from Full Name",
    intro:
      "Extract last names from a full name column in your Excel file. Preview a few sample rows to check the result, or process the full file right away.",
    steps: [
      "**Upload your Excel file** — .xlsx, .xls, or .csv.",
      "Pick the **Source column** that contains full names.",
      "Set **Target** to “last name”.",
      "**Preview** a few rows (supports middle names and multi-word surnames).",
      "**Process full file** to download a copy with a new last-name column.",
    ],
  },
  zh: {
    title: "Excel 从姓名提取姓氏（Excel 和 CSV 工具）",
    description:
      "上传 Excel（.xlsx）或 CSV 文件，从完整姓名列里提取姓（last name），预览确认后一次处理整份文件。",
    h1: "从完整姓名提取姓氏",
    intro:
      "从 Excel 文件的姓名列里提取姓（last name）。可以先预览几行确认效果，也可以直接处理整个文件。",
    steps: [
      "**上传 Excel 文件** —— 支持 .xlsx、.xls、.csv。",
      "选择包含完整姓名的**来源列**。",
      "把**目标**设为「last name」（姓）。",
      "**预览**几行（中间名和多词姓氏都能正确处理）。",
      "**处理整个文件**，下载带有姓氏新列的副本。",
    ],
  },
  ja: {
    title: "Excel 氏名から姓を抽出・名前を分割（Excel・CSV対応）",
    description:
      "Excel・CSVの氏名から姓をAIで抽出。「山田 太郎」「佐藤　花子」など日本語の姓名を分割。スペースなしの名前の曖昧さと、姓・名を別の列にする手順を紹介します。",
    h1: "Excelの氏名から姓を抽出",
    intro:
      "「山田 太郎」から「山田」のように、日本語の氏名列から姓だけを取り出します。半角・全角スペースを区切りとして扱い、元の漢字表記のまま新しい列に追加します。",
    steps: [
      "**Excelファイルをアップロード** — .xlsx、.xls、.csvに対応しています。",
      "フルネームが入っている**元の列**を選びます。",
      "**抽出対象**を「姓」に設定します。",
      "数行を**プレビュー**します。スペースなしの氏名は、姓・名の境界とnullになった行を確認してください。",
      "**ファイル全体を処理**し、姓の列が追加されたファイルをダウンロードします。",
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
          initialTarget={isJa ? "姓" : "last name (surname)"}
          initialSource={isJa ? "氏名" : "full name"}
          initialInstructions={isJa ? JAPANESE_EXTRACTION.surname.instructions : undefined}
        />
      }
      examples={isJa ? japaneseExample("surname") : [
        {
          heading: {
            en: "Example — Extract last name from full name",
            zh: "示例 —— 从完整姓名提取姓氏",
            ja: "例 — フルネームから姓を抽出",
          },
          target: { en: "last name", zh: "姓（last name）", ja: "姓" },
          source: { en: "full name", zh: "full name（完整姓名）", ja: "氏名" },
          columns: isJa ? ["氏名", "姓"] : ["full name", "last name"],
          rows: [
            ["Ada Lovelace", "Lovelace"],
            ["Grace Hopper", "Hopper"],
            ["Alan Mathison Turing", "Turing"],
            ["John von Neumann", "Neumann"],
          ],
        },
      ]}
    >
      {isJa && <JapaneseExtractionGuide task="surname" />}
    </ToolLanding>
  );
}
