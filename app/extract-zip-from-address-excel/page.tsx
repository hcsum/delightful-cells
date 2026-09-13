import CustomToolClient from "@/components/CustomToolClient";
import ToolLanding from "@/components/ToolLanding";
import type { LandingEntry } from "@/lib/landing-copy";
import { localizedMetadata } from "@/lib/seo";

const PATH = "/extract-zip-from-address-excel";

const COPY: LandingEntry = {
  en: {
    title: "Extract ZIP / Postal Code from Address (Excel & CSV Tool)",
    description:
      "Upload an Excel file (.xlsx) or CSV and extract ZIP or postal codes from address columns.",
    h1: "Extract ZIP / Postal Code from Address",
    intro:
      "Extract ZIP or postal codes from an address column in your Excel file. Preview a few sample rows to check the result, or process the full file right away.",
    steps: [
      "**Upload your Excel file** — .xlsx, .xls, or .csv.",
      "Pick the **Source column** with full addresses.",
      "Set **Target** to “ZIP or postal code”.",
      "**Preview** to confirm the extracted postal codes.",
      "**Process full file** and download with a new zip/postal code column.",
    ],
  },
  zh: {
    title: "Excel 从地址提取邮编（Excel 和 CSV 工具）",
    description:
      "上传 Excel（.xlsx）或 CSV 文件，从地址列里提取邮政编码，预览确认后一次处理整份文件。",
    h1: "从地址提取邮编",
    intro:
      "从 Excel 文件的地址列里提取邮政编码。可以先预览几行确认效果，也可以直接处理整个文件。",
    steps: [
      "**上传 Excel 文件** —— 支持 .xlsx、.xls、.csv。",
      "选择包含完整地址的**来源列**。",
      "把**目标**设为「ZIP or postal code」（邮政编码）。",
      "**预览**几行，确认提取出的邮编正确。",
      "**处理整个文件**，下载带有邮编新列的副本。",
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
      tool={<CustomToolClient initialTarget="ZIP or postal code" initialSource="address" />}
      examples={[
        {
          heading: {
            en: "Example — Extract ZIP / postal code from address",
            zh: "示例 —— 从地址提取邮政编码",
          },
          target: { en: "ZIP / postal code", zh: "邮政编码" },
          source: { en: "address", zh: "address（地址）" },
          columns: ["address", "zip/postal code"],
          rows: [
            ["1600 Amphitheatre Parkway, Mountain View, CA 94043", "94043"],
            ["350 Fifth Avenue, New York, NY 10118", "10118"],
            ["1 Microsoft Way, Redmond, WA 98052", "98052"],
            ["1 Infinite Loop, Cupertino, CA 95014", "95014"],
          ],
        },
      ]}
    />
  );
}
