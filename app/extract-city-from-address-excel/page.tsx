import CustomToolClient from "@/components/CustomToolClient";
import ToolLanding from "@/components/ToolLanding";
import { JAPANESE_EXTRACTION, JapaneseExtractionGuide, japaneseExample } from "@/lib/japanese-extraction";
import { localizedMetadata, serverLocale } from "@/lib/seo";

const PATH = "/extract-city-from-address-excel";

const COPY = {
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
  ja: {
    title: "Excel 住所から市区町村を抽出・住所分割（CSV対応）",
    description:
      "Excel・CSVの日本の住所から市区町村をAIで抽出。新宿区、横浜市中区、郡を含む町村の例とともに、住所分割の手順を紹介。数行をプレビューしてから一括処理できます。",
    h1: "Excelの住所から市区町村を抽出",
    intro:
      "日本の住所を都道府県・市区町村に分けたいとき、住所列から市区町村だけを新しい列に抽出します。関数を組まずにAIへ指示し、政令指定都市の区や郡を含む町村の結果をプレビューで確認できます。",
    steps: [
      "**Excel ファイルをアップロード** — .xlsx、.xls、.csv に対応しています。",
      "住所全体が入力された**抽出元の列**を選びます。",
      "**抽出対象**を「市区町村名」に設定します。",
      "数行を**プレビュー**して、市区町村名が正しく出力されることを確認します。",
      "**ファイル全体を処理**し、市区町村名の列が追加されたファイルをダウンロードします。",
    ],
  },
};

const DEFAULTS = {
  en: { target: "city name", source: "address" },
  zh: { target: "city name", source: "address" },
  ja: { target: "市区町村名", source: "住所" },
};

const EXAMPLES = [
  {
    heading: {
      en: "Example — Extract city from address",
      zh: "示例 —— 从地址提取城市",
      ja: "例 — 住所から市区町村名を抽出",
    },
    target: { en: "city name", zh: "城市名", ja: "市区町村名" },
    source: { en: "address", zh: "address（地址）", ja: "address（住所）" },
    columns: ["address", "city"],
    rows: [
      ["1600 Amphitheatre Parkway, Mountain View, CA 94043", "Mountain View"],
      ["One Apple Park Way, Cupertino, CA 95014", "Cupertino"],
      ["350 Fifth Avenue, New York, NY 10118", "New York"],
      ["1 Microsoft Way, Redmond, WA 98052", "Redmond"],
    ],
  },
];

export function generateMetadata() {
  return localizedMetadata(PATH, COPY);
}

export default async function Page() {
  const locale = await serverLocale();
  const isJa = locale === "ja";
  const defaults = DEFAULTS[locale];
  return (
    <ToolLanding
      copy={COPY}
      tool={
        <CustomToolClient
          initialTarget={defaults.target}
          initialSource={defaults.source}
          initialInstructions={isJa ? JAPANESE_EXTRACTION.city.instructions : undefined}
        />
      }
      examples={isJa ? japaneseExample("city") : EXAMPLES}
    >
      {isJa && <JapaneseExtractionGuide task="city" />}
    </ToolLanding>
  );
}
