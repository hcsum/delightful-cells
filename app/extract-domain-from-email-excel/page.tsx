import CustomToolClient from "@/components/CustomToolClient";
import ToolLanding from "@/components/ToolLanding";
import type { LandingEntry } from "@/lib/landing-copy";
import { localizedMetadata } from "@/lib/seo";

const PATH = "/extract-domain-from-email-excel";

const COPY: LandingEntry = {
  en: {
    title: "Extract Domain from Email (Excel & CSV Tool)",
    description:
      "Upload an Excel file (.xlsx) or CSV and extract the domain from an email column.",
    h1: "Extract Domain from Email",
    intro:
      "Extract the domain part of email addresses from a column in your Excel file. Preview a few sample rows to check the result, or process the full file right away.",
    steps: [
      "**Upload your Excel file** — .xlsx, .xls, or .csv.",
      "Pick the **Source column** with email addresses.",
      "Set **Target** to “domain from email”.",
      "**Preview** to confirm domains look right (handles plus-addressing and subdomains).",
      "**Process full file** and download with a new domain column.",
    ],
  },
  zh: {
    title: "Excel 从邮箱提取域名（Excel 和 CSV 工具）",
    description:
      "上传 Excel（.xlsx）或 CSV 文件，从邮箱列里提取域名部分，预览确认后一次处理整份文件。",
    h1: "从邮箱地址提取域名",
    intro:
      "从 Excel 文件的邮箱列里提取域名部分。可以先预览几行确认效果，也可以直接处理整个文件。",
    steps: [
      "**上传 Excel 文件** —— 支持 .xlsx、.xls、.csv。",
      "选择包含邮箱地址的**来源列**。",
      "把**目标**设为「domain from email」（邮箱域名）。",
      "**预览**几行，确认域名正确（带 + 号的地址和子域名都能处理）。",
      "**处理整个文件**，下载带有域名新列的副本。",
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
      tool={<CustomToolClient initialTarget="domain" initialSource="email address" />}
      examples={[
        {
          heading: {
            en: "Example — Extract domain from email",
            zh: "示例 —— 从邮箱提取域名",
          },
          target: { en: "domain from email", zh: "邮箱域名" },
          source: { en: "email address", zh: "email address（邮箱地址）" },
          columns: ["email address", "domain"],
          rows: [
            ["alice@example.com", "example.com"],
            ["bob@company.co.uk", "company.co.uk"],
            ["carol+sales@my-site.io", "my-site.io"],
          ],
        },
      ]}
    />
  );
}
