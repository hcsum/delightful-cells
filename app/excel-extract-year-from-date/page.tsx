import CustomToolClient from "@/components/CustomToolClient";
import ToolLanding from "@/components/ToolLanding";
import type { LandingEntry } from "@/lib/landing-copy";
import { localizedMetadata } from "@/lib/seo";

const PATH = "/excel-extract-year-from-date";

const COPY: LandingEntry = {
  en: {
    title: "Excel: Extract Year from Date (Excel & CSV Tool)",
    description:
      "Extract the year from a date column in your Excel or CSV file. Ideal for grouping, filtering, or summarizing by year. Preview results, then process the full file.",
    h1: "Excel: Extract Year from Date",
    intro:
      "Select your date column and pull just the 4-digit year. Great for analyzing by year without changing your original data. Paste a few rows to preview, then upload and process the full file.",
    steps: [
      "**Upload your Excel file** — .xlsx, .xls, or .csv.",
      "Pick the **Source column** with dates (Excel or text-formatted).",
      "Set **Target** to “year”.",
      "**Preview** to verify the 4-digit year output.",
      "**Process full file** to download a copy with a new year column.",
    ],
  },
  zh: {
    title: "Excel 从日期提取年份（Excel 和 CSV 工具）",
    description:
      "从 Excel 或 CSV 的日期列里提取年份，适合按年份分组、筛选或汇总。先预览结果，再处理整份文件。",
    h1: "Excel：从日期提取年份",
    intro:
      "选中日期列，只取出四位数的年份。适合按年份做分析，同时不改动原始数据。可以先预览几行，再上传处理整个文件。",
    steps: [
      "**上传 Excel 文件** —— 支持 .xlsx、.xls、.csv。",
      "选择包含日期的**来源列**（Excel 日期格式或文本格式都可以）。",
      "把**目标**设为「year」（年份）。",
      "**预览**几行，确认输出的是四位年份。",
      "**处理整个文件**，下载带有年份新列的副本。",
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
      tool={<CustomToolClient initialTarget="year" initialSource="date" />}
      examples={[
        {
          heading: {
            en: "Example — Extract year from date",
            zh: "示例 —— 从日期提取年份",
          },
          target: { en: "year (4 digits)", zh: "年份（四位数）" },
          source: { en: "date", zh: "date（日期）" },
          columns: ["date", "year"],
          rows: [
            ["2024-03-15", "2024"],
            ["15/03/2023", "2023"],
            ["March 1, 2022", "2022"],
            ["2021-12-31T09:00:00Z", "2021"],
          ],
        },
      ]}
    />
  );
}
