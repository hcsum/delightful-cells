import CustomToolClient from "@/components/CustomToolClient";
import ToolLanding from "@/components/ToolLanding";
import type { LandingEntry } from "@/lib/landing-copy";
import { localizedMetadata } from "@/lib/seo";

const PATH = "/extract-city-from-address-excel";

const COPY: LandingEntry = {
  en: {
    title: "Extract City from Address in Excel (Excel & CSV Tool)",
    description:
      "Upload an Excel file or CSV and automatically extract city names from address columns using AI.",
    h1: "Extract City from Address",
    intro:
      "Extract city names from an address column in your Excel file. Preview a few sample rows to check the result, or process the full file right away.",
    steps: [
      "**Upload your Excel file** — .xlsx, .xls, or .csv.",
      "Pick the **Source column** that contains full mailing addresses.",
      "Set the **Target** to “city name”.",
      "**Preview** a few rows to verify the city output.",
      "**Process full file** to download your results with a new city column.",
    ],
  },
  zh: {
    title: "Excel 从地址提取城市（Excel 和 CSV 工具）",
    description:
      "上传 Excel 或 CSV 文件，用 AI 自动从地址列里提取城市名，预览确认后一次处理整份文件。",
    h1: "从地址提取城市",
    intro:
      "从 Excel 文件的地址列里提取城市名。可以先预览几行确认效果，也可以直接处理整个文件。",
    steps: [
      "**上传 Excel 文件** —— 支持 .xlsx、.xls、.csv。",
      "选择包含完整邮寄地址的**来源列**。",
      "把**目标**设为「city name」（城市名）。",
      "**预览**几行，确认城市名提取正确。",
      "**处理整个文件**，下载带有城市新列的结果。",
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
      tool={<CustomToolClient initialTarget="city name" initialSource="address" />}
      examples={[
        {
          heading: {
            en: "Example — Extract city from address",
            zh: "示例 —— 从地址提取城市",
          },
          target: { en: "city name", zh: "城市名" },
          source: { en: "address", zh: "address（地址）" },
          columns: ["address", "city"],
          rows: [
            ["1600 Amphitheatre Parkway, Mountain View, CA 94043", "Mountain View"],
            ["One Apple Park Way, Cupertino, CA 95014", "Cupertino"],
            ["350 Fifth Avenue, New York, NY 10118", "New York"],
            ["1 Microsoft Way, Redmond, WA 98052", "Redmond"],
          ],
        },
      ]}
    />
  );
}
