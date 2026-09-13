import CustomToolClient from "@/components/CustomToolClient";
import ToolLanding from "@/components/ToolLanding";
import type { LandingEntry } from "@/lib/landing-copy";
import { localizedMetadata } from "@/lib/seo";

const PATH = "/extract-title-from-name-excel";

const COPY: LandingEntry = {
  en: {
    title: "Extract Title from Name (Excel & CSV Tool)",
    description:
      "Upload an Excel file (.xlsx) or CSV and extract titles (Mr, Ms, Dr, etc.) from a name column.",
    h1: "Extract Title from Name",
    intro:
      "Extract honorifics or titles from a name column in your Excel file. Preview a few sample rows to check the result, or process the full file right away.",
    steps: [
      "**Upload your Excel file** — .xlsx, .xls, or .csv.",
      "Pick the **Source column** with full names (e.g., “name”).",
      "Set **Target** to “title”.",
      "**Preview** to validate titles (Mr, Ms, Mrs, Dr, Prof, etc.).",
      "**Process full file** to download a file with a new title column.",
    ],
  },
  zh: {
    title: "Excel 从姓名提取称谓（Excel 和 CSV 工具）",
    description:
      "上传 Excel（.xlsx）或 CSV 文件，从姓名列里提取 Mr、Ms、Dr 等称谓，预览确认后一次处理整份文件。",
    h1: "从姓名提取称谓",
    intro:
      "从 Excel 文件的姓名列里提取称谓或敬称。可以先预览几行确认效果，也可以直接处理整个文件。",
    steps: [
      "**上传 Excel 文件** —— 支持 .xlsx、.xls、.csv。",
      "选择包含完整姓名的**来源列**（例如「name」）。",
      "把**目标**设为「title」（称谓）。",
      "**预览**几行，确认称谓识别正确（Mr、Ms、Mrs、Dr、Prof 等）。",
      "**处理整个文件**，下载带有称谓新列的文件。",
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
          initialTarget="honorific or title (e.g., Mr, Ms, Dr, Prof)"
          initialSource="name"
        />
      }
      examples={[
        {
          heading: {
            en: "Example — Extract title from name",
            zh: "示例 —— 从姓名提取称谓",
          },
          target: {
            en: "title (Mr, Ms, Mrs, Dr, Prof, etc.)",
            zh: "称谓（Mr、Ms、Mrs、Dr、Prof 等）",
          },
          source: { en: "name", zh: "name（姓名）" },
          columns: ["name", "title"],
          rows: [
            ["Mr John Smith", "Mr"],
            ["Dr Ada Lovelace", "Dr"],
            ["Ms Grace Hopper", "Ms"],
            ["Prof Alan Turing", "Prof"],
          ],
        },
      ]}
    />
  );
}
