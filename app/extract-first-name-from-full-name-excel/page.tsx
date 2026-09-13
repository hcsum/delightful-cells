import CustomToolClient from "@/components/CustomToolClient";
import ToolLanding from "@/components/ToolLanding";
import type { LandingEntry } from "@/lib/landing-copy";
import { localizedMetadata } from "@/lib/seo";

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
};

export function generateMetadata() {
  return localizedMetadata(PATH, COPY);
}

export default function Page() {
  return (
    <ToolLanding
      copy={COPY}
      tool={<CustomToolClient initialTarget="first name" initialSource="full name" />}
      examples={[
        {
          heading: {
            en: "Example — Extract first name from full name",
            zh: "示例 —— 从完整姓名提取名字",
          },
          target: { en: "first name", zh: "名（first name）" },
          source: { en: "full name", zh: "full name（完整姓名）" },
          columns: ["full name", "first name"],
          rows: [
            ["Ada Lovelace", "Ada"],
            ["Grace Hopper", "Grace"],
            ["Alan Mathison Turing", "Alan"],
            ["John von Neumann", "John"],
          ],
        },
      ]}
    />
  );
}
