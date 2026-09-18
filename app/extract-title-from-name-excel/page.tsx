import CustomToolClient from "@/components/CustomToolClient";
import ToolLanding from "@/components/ToolLanding";
import type { LandingEntry } from "@/lib/landing-copy";
import { localizedMetadata, serverLocale } from "@/lib/seo";

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
  ja: {
    title: "氏名から敬称・肩書きを抽出（Excel・CSVツール）",
    description:
      "Excel（.xlsx）またはCSVファイルをアップロードし、氏名の列からMr、Ms、Dr、Profなどの敬称や肩書きを抽出できます。",
    h1: "氏名から敬称・肩書きを抽出",
    intro:
      "Excelファイルの氏名列から敬称や肩書きを抽出します。数行だけ試すことも、ファイル全体をそのまま処理することもできます。",
    steps: [
      "**Excelファイルをアップロード** — .xlsx、.xls、.csvに対応しています。",
      "フルネームが入っている**元の列**（例：「氏名」）を選びます。",
      "**抽出対象**を「敬称・肩書き」に設定します。",
      "**プレビュー**で敬称や肩書き（Mr、Ms、Mrs、Dr、Profなど）が正しく抽出されているか確認します。",
      "**ファイル全体を処理**し、敬称・肩書きの列が追加されたファイルをダウンロードします。",
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
          initialTarget={
            isJa
              ? "敬称・肩書き（例：Mr、Ms、Dr、Prof）"
              : "honorific or title (e.g., Mr, Ms, Dr, Prof)"
          }
          initialSource={isJa ? "氏名" : "name"}
        />
      }
      examples={[
        {
          heading: {
            en: "Example — Extract title from name",
            zh: "示例 —— 从姓名提取称谓",
            ja: "例 — 氏名から敬称・肩書きを抽出",
          },
          target: {
            en: "title (Mr, Ms, Mrs, Dr, Prof, etc.)",
            zh: "称谓（Mr、Ms、Mrs、Dr、Prof 等）",
            ja: "敬称・肩書き（Mr、Ms、Mrs、Dr、Profなど）",
          },
          source: { en: "name", zh: "name（姓名）", ja: "氏名" },
          columns: isJa ? ["氏名", "敬称・肩書き"] : ["name", "title"],
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
