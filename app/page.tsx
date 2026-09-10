import CellsApp from "@/components/cells/CellsApp";
import ClassicTools from "@/components/cells/ClassicTools";
import { headers } from "next/headers";
import { DEFAULT_LOCALE, isAppLocale } from "@/lib/locale-routing";

export const metadata = {
  title: "Delightful Cells — chat with your Excel spreadsheet",
  description:
    "Upload an Excel or CSV file, see it instantly, and edit it by talking: summarize a column, highlight rows, batch find & replace, AI-fill a new column. Plus classic one-job tools for extracting, comparing, and de-duplicating columns.",
  openGraph: {
    title: "Delightful Cells — chat with your Excel spreadsheet",
    description:
      "Upload an Excel or CSV, see it instantly, and edit it in plain English. Tools run locally in your browser.",
    type: "website",
    images: [
      {
        url: "/hero-image-3.png",
        width: 1200,
        height: 900,
        alt: "AI working on an Excel spreadsheet",
      },
    ],
  },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export default function HomePage() {
  const localeHeader = headers().get("x-locale");
  const locale = isAppLocale(localeHeader) ? localeHeader : DEFAULT_LOCALE;
  return (
    <>
      <CellsApp initialLocale={locale} />
      <ClassicTools />
    </>
  );
}
