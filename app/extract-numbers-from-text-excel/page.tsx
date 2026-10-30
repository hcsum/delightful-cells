import CustomToolClient from "@/components/CustomToolClient";
import ToolLanding from "@/components/ToolLanding";
import { localizedMetadata, serverLocale } from "@/lib/seo";

const PATH = "/extract-numbers-from-text-excel";

const COPY = {
  en: {
    title: "Extract Numbers from Text in Excel (Excel & CSV Tool)",
    description:
      "Upload an Excel file or CSV and automatically extract numbers from text columns using AI.",
    h1: "Extract Numbers from Text",
    intro:
      "Extract numbers from a text column in your Excel file. Preview a few sample rows to check the result, or process the full file right away.",
    steps: [],
  },
  zh: {
    title: "Excel 从文本提取数字（Excel 和 CSV 工具）",
    description:
      "上传 Excel 或 CSV 文件，用 AI 自动从文本列里提取数字，预览确认后一次处理整份文件。",
    h1: "从文本提取数字",
    intro:
      "从 Excel 文件的文本列里提取数字。可以先预览几行确认效果，也可以直接处理整个文件。",
    steps: [],
  },
  ja: {
    title: "Excelのテキストから数値を抽出（Excel・CSV ツール）",
    description:
      "Excel または CSV ファイルをアップロードし、AIを使ってテキスト列から数値を自動で抽出します。",
    h1: "テキストから数値を抽出",
    intro:
      "Excelファイルのテキスト列から数値を抽出します。数行だけ試すことも、ファイル全体をそのまま処理することもできます。",
    steps: [],
  },
};

const DEFAULTS = {
  en: { target: "all numbers", source: "text" },
  zh: { target: "all numbers", source: "text" },
  ja: { target: "すべての数値", source: "テキスト" },
};

export function generateMetadata() {
  return localizedMetadata(PATH, COPY);
}

export default async function Page() {
  const defaults = DEFAULTS[await serverLocale()];
  return (
    <ToolLanding
      copy={COPY}
      tool={
        <CustomToolClient
          initialTarget={defaults.target}
          initialSource={defaults.source}
        />
      }
    />
  );
}
