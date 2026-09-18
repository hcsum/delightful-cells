import CustomToolClient from "@/components/CustomToolClient";
import ToolLanding from "@/components/ToolLanding";
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
    title: "フルネームから姓を抽出（Excel・CSVツール）",
    description:
      "Excel（.xlsx）またはCSVファイルをアップロードし、フルネームの列から姓を抽出できます。",
    h1: "フルネームから姓を抽出",
    intro:
      "Excelファイルのフルネーム列から姓を抽出します。数行だけ試すことも、ファイル全体をそのまま処理することもできます。",
    steps: [
      "**Excelファイルをアップロード** — .xlsx、.xls、.csvに対応しています。",
      "フルネームが入っている**元の列**を選びます。",
      "**抽出対象**を「姓」に設定します。",
      "数行を**プレビュー**します（ミドルネームや複数語からなる姓にも対応しています）。",
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
        />
      }
      examples={[
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
    />
  );
}
