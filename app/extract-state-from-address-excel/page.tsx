import CustomToolClient from "@/components/CustomToolClient";
import ToolLanding from "@/components/ToolLanding";
import type { LandingEntry } from "@/lib/landing-copy";
import { localizedMetadata } from "@/lib/seo";

const PATH = "/extract-state-from-address-excel";

const COPY: LandingEntry = {
  en: {
    title: "Extract State from Address in Excel (Excel & CSV Tool)",
    description:
      "Upload an Excel file or CSV and automatically extract US states from address columns using AI.",
    h1: "Extract State from Address",
    intro:
      "Extract the US state from an address column in your Excel file. Preview a few sample rows to check the result, or process the full file right away.",
    steps: [
      "**Upload your Excel file** — .xlsx, .xls, or .csv.",
      "Pick the **Source column** with full postal addresses.",
      "Set **Target** to “US state as a two-letter abbreviation”.",
      "**Preview** to verify state extraction.",
      "**Process full file** and download with a new state column.",
    ],
  },
  zh: {
    title: "Excel 从地址提取州名（Excel 和 CSV 工具）",
    description:
      "上传 Excel 或 CSV 文件，用 AI 自动从地址列里提取美国州名，预览确认后一次处理整份文件。",
    h1: "从地址提取州名",
    intro:
      "从 Excel 文件的地址列里提取美国州名。可以先预览几行确认效果，也可以直接处理整个文件。",
    steps: [
      "**上传 Excel 文件** —— 支持 .xlsx、.xls、.csv。",
      "选择包含完整邮寄地址的**来源列**。",
      "把**目标**设为「US state as a two-letter abbreviation」（两个字母的州缩写）。",
      "**预览**几行，确认州名提取正确。",
      "**处理整个文件**，下载带有州名新列的副本。",
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
      tool={
        <CustomToolClient
          initialTarget="US state as a two-letter abbreviation"
          initialSource="address"
        />
      }
      examples={[
        {
          heading: {
            en: "Example — Extract US state from address",
            zh: "示例 —— 从地址提取美国州名",
          },
          target: {
            en: "US state abbreviation (e.g., CA, NY)",
            zh: "美国州缩写（如 CA、NY）",
          },
          source: { en: "address", zh: "address（地址）" },
          columns: ["address", "state"],
          rows: [
            ["1600 Amphitheatre Parkway, Mountain View, CA 94043", "CA"],
            ["350 Fifth Avenue, New York, NY 10118", "NY"],
            ["1 Microsoft Way, Redmond, WA 98052", "WA"],
            ["1 Infinite Loop, Cupertino, CA 95014", "CA"],
          ],
        },
      ]}
    />
  );
}
