import CustomToolClient from "@/components/CustomToolClient";
import ToolLanding from "@/components/ToolLanding";
import type { LandingEntry } from "@/lib/landing-copy";
import { localizedMetadata } from "@/lib/seo";

const PATH = "/extract-numbers-from-text-excel";

const COPY: LandingEntry = {
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
};

export function generateMetadata() {
  return localizedMetadata(PATH, COPY);
}

export default function Page() {
  return (
    <ToolLanding
      copy={COPY}
      tool={<CustomToolClient initialTarget="all numbers" initialSource="text" />}
    />
  );
}
