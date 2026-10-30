import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { DEFAULT_LOCALE, isAppLocale, localizePath } from "@/lib/locale-routing";

// Delightful Cells moved to the homepage; keep old links working.
export default async function CellsPage() {
  const localeHeader = (await headers()).get("x-locale");
  const locale = isAppLocale(localeHeader) ? localeHeader : DEFAULT_LOCALE;
  redirect(localizePath("/", locale));
}
