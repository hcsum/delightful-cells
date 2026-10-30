import CustomToolClient from "@/components/CustomToolClient";
import ToolLanding from "@/components/ToolLanding";
import type { LandingEntry } from "@/lib/landing-copy";
import { localizedMetadata, serverLocale } from "@/lib/seo";

const PATH = "/extract-username-from-email-excel";

const COPY: LandingEntry = {
  en: {
    title: "Extract Username from Email (Excel & CSV Tool)",
    description:
      "Upload an Excel file (.xlsx) or CSV and extract the username (local-part) from an email column.",
    h1: "Extract Username from Email",
    intro:
      "Extract the username (local-part before @) of email addresses from a column in your Excel file. Preview a few sample rows to check the result, or process the full file right away.",
    steps: [
      "**Upload your Excel file** — .xlsx, .xls, or .csv.",
      "Pick the **Source column** with email addresses.",
      "Set **Target** to “username (local-part before @)”.",
      "**Preview**; plus-addressing remains in the username.",
      "**Process full file** and download with a new username column.",
    ],
  },
  zh: {
    title: "Excel 从邮箱提取用户名（Excel 和 CSV 工具）",
    description:
      "上传 Excel（.xlsx）或 CSV 文件，从邮箱列里提取 @ 之前的用户名部分，预览确认后一次处理整份文件。",
    h1: "从邮箱地址提取用户名",
    intro:
      "从 Excel 文件的邮箱列里提取 @ 之前的用户名部分。可以先预览几行确认效果，也可以直接处理整个文件。",
    steps: [
      "**上传 Excel 文件** —— 支持 .xlsx、.xls、.csv。",
      "选择包含邮箱地址的**来源列**。",
      "把**目标**设为「username (local-part before @)」（@ 之前的用户名）。",
      "**预览**几行；带 + 号的部分会保留在用户名里。",
      "**处理整个文件**，下载带有用户名新列的副本。",
    ],
  },
  ja: {
    title: "メールアドレスからユーザー名を抽出（Excel・CSVツール）",
    description:
      "Excel（.xlsx）またはCSVファイルをアップロードし、メールアドレスの列からユーザー名（@より前の部分）を抽出できます。",
    h1: "メールアドレスからユーザー名を抽出",
    intro:
      "Excelファイルのメールアドレス列から、@より前のユーザー名部分を抽出します。数行だけ試すことも、ファイル全体をそのまま処理することもできます。",
    steps: [
      "**Excelファイルをアップロード** — .xlsx、.xls、.csvに対応しています。",
      "メールアドレスが入っている**元の列**を選びます。",
      "**抽出対象**を「ユーザー名（@より前の部分）」に設定します。",
      "数行を**プレビュー**します。プラスアドレスの「+」以降もユーザー名に含まれます。",
      "**ファイル全体を処理**し、ユーザー名の列が追加されたファイルをダウンロードします。",
    ],
  },
};

export function generateMetadata() {
  return localizedMetadata(PATH, COPY);
}

export default async function Page() {
  const locale = await serverLocale();
  const isJa = locale === "ja";
  return (
    <ToolLanding
      copy={COPY}
      tool={
        <CustomToolClient
          initialTarget={
            isJa
              ? "ユーザー名（@より前の部分）"
              : "username (local-part before @)"
          }
          initialSource={isJa ? "メールアドレス" : "email address"}
        />
      }
      examples={[
        {
          heading: {
            en: "Example — Extract username from email",
            zh: "示例 —— 从邮箱提取用户名",
            ja: "例 — メールアドレスからユーザー名を抽出",
          },
          target: {
            en: "username (local-part before @)",
            zh: "用户名（@ 之前的部分）",
            ja: "ユーザー名（@より前の部分）",
          },
          source: {
            en: "email address",
            zh: "email address（邮箱地址）",
            ja: "メールアドレス",
          },
          columns: isJa
            ? ["メールアドレス", "ユーザー名"]
            : ["email address", "username"],
          rows: [
            ["alice@example.com", "alice"],
            ["bob@company.co.uk", "bob"],
            ["carol+sales@my-site.io", "carol+sales"],
          ],
        },
      ]}
    />
  );
}
