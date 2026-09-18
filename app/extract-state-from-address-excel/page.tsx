import CustomToolClient from "@/components/CustomToolClient";
import ToolLanding from "@/components/ToolLanding";
import { localizedMetadata, serverLocale } from "@/lib/seo";

const PATH = "/extract-state-from-address-excel";

const COPY = {
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
  ja: {
    title: "Excel の住所から州を抽出（Excel・CSV ツール）",
    description:
      "Excel または CSV ファイルをアップロードし、AI を使って住所列から米国の州を自動抽出します。",
    h1: "住所から州を抽出",
    intro:
      "Excel ファイルの住所列から米国の州を抽出します。数行をプレビューして結果を確認するか、そのままファイル全体を処理できます。",
    steps: [
      "**Excel ファイルをアップロード** — .xlsx、.xls、.csv に対応しています。",
      "住所全体が入力された**抽出元の列**を選びます。",
      "**抽出対象**を「米国の州コード（2文字）」に設定します。",
      "**プレビュー**して、州が正しく抽出されることを確認します。",
      "**ファイル全体を処理**し、州の列が追加されたファイルをダウンロードします。",
    ],
  },
};

const DEFAULTS = {
  en: { target: "US state as a two-letter abbreviation", source: "address" },
  zh: { target: "US state as a two-letter abbreviation", source: "address" },
  ja: { target: "米国の州コード（2文字）", source: "住所" },
};

const EXAMPLES = [
  {
    heading: {
      en: "Example — Extract US state from address",
      zh: "示例 —— 从地址提取美国州名",
      ja: "例 — 住所から米国の州を抽出",
    },
    target: {
      en: "US state abbreviation (e.g., CA, NY)",
      zh: "美国州缩写（如 CA、NY）",
      ja: "米国の州コード（例：CA、NY）",
    },
    source: { en: "address", zh: "address（地址）", ja: "address（住所）" },
    columns: ["address", "state"],
    rows: [
      ["1600 Amphitheatre Parkway, Mountain View, CA 94043", "CA"],
      ["350 Fifth Avenue, New York, NY 10118", "NY"],
      ["1 Microsoft Way, Redmond, WA 98052", "WA"],
      ["1 Infinite Loop, Cupertino, CA 95014", "CA"],
    ],
  },
];

export function generateMetadata() {
  return localizedMetadata(PATH, COPY);
}

export default function Page() {
  const defaults = DEFAULTS[serverLocale()];
  return (
    <ToolLanding
      copy={COPY}
      tool={
        <CustomToolClient
          initialTarget={defaults.target}
          initialSource={defaults.source}
        />
      }
      examples={EXAMPLES}
    />
  );
}
