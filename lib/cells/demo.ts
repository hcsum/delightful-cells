// The demo workbook, in one place: data AND the chat presets that show it off.
// The .xlsx is built in the browser from this file when the user clicks
// "try with demo data", so there is nothing else to keep in sync.

import type { Locale } from "./i18n";

export type DemoSheet = {
  name: string;
  headers: string[];
  rows: string[][];
  presets: Record<Locale, string[]>;
};

export const DEMO_FILE_NAME = "delightful-demo.xlsx";

export const DEMO_SHEETS: DemoSheet[] = [
  {
    name: "Customer Feedback",
    headers: ["Order ID", "Product", "Customer Feedback", "Rating", "Refund Amount", "Status"],
    presets: {
      en: ["Highlight rows where the feedback sounds angry", "Set Status to closed for every pending order", "Classify each Customer Feedback as positive, neutral or negative into a new column", "How much did we refund in total?"],
      zh: ["高亮 feedback 听起来很生气的行", "把所有 pending 订单的 Status 改成 closed", "把每条 Customer Feedback 分类为 positive / neutral / negative，写进新列", "总共退款了多少钱？"],
      ja: ["不満や怒りが表れているフィードバックの行をハイライトして", "Status が pending の注文をすべて closed に変更して", "Customer Feedback の内容を positive、neutral、negative のいずれかに分類し、新しい列に入れて", "返金額の合計はいくら？"],
    },
    rows: [
      ["ORD-1001", "Widget Pro", "App crashes every time I open settings. Very frustrating!", "1", "10", "resolved"],
      ["ORD-1002", "Gadget Mini", "Love it, works perfectly. Best purchase this year.", "3", "0", "open"],
      ["ORD-1003", "Doohickey X", "Shipping was slow but the product is great.", "5", "0", "open"],
      ["ORD-1004", "Widget Pro", "Crashes on startup after the last update. Please fix.", "2", "0", "pending"],
      ["ORD-1005", "Thingamajig", "N/A", "4", "0", "N/A"],
      ["ORD-1006", "Gadget Mini", "Battery drains too fast, barely lasts half a day.", "1", "0", "open"],
      ["ORD-1007", "Widget Lite", "Customer support was super helpful and friendly.", "3", "88", "resolved"],
      ["ORD-1008", "Doohickey X", "N/A", "5", "0", "N/A"],
      ["ORD-1009", "Gizmo Max", "The manual is confusing, took me hours to set up.", "2", "0", "pending"],
      ["ORD-1010", "Thingamajig", "Great value for money, highly recommend to friends.", "4", "0", "resolved"],
      ["ORD-1011", "Widget Pro", "Screen flickers sometimes, might be a defect.", "1", "0", "resolved"],
      ["ORD-1012", "Gadget Mini", "Refund process was painless, thank you.", "3", "0", "open"],
      ["ORD-1013", "Doohickey X", "It crashes when I connect bluetooth. Annoying bug.", "5", "76", "open"],
      ["ORD-1014", "Widget Pro", "Solid build quality, feels premium.", "2", "0", "pending"],
      ["ORD-1015", "Thingamajig", "N/A", "4", "0", "N/A"],
      ["ORD-1016", "Gadget Mini", "Too expensive for what it does honestly.", "1", "0", "open"],
      ["ORD-1017", "Widget Lite", "Setup was easy, works out of the box.", "3", "0", "resolved"],
      ["ORD-1018", "Doohickey X", "The app keeps logging me out, very irritating.", "5", "0", "N/A"],
      ["ORD-1019", "Gizmo Max", "Perfect gift for my dad, he loves it.", "2", "64", "pending"],
      ["ORD-1020", "Thingamajig", "Delivery arrived two weeks late. Not happy.", "4", "0", "resolved"],
      ["ORD-1021", "Widget Pro", "App crashes every time I open settings. Very frustrating!", "1", "0", "resolved"],
      ["ORD-1022", "Gadget Mini", "Love it, works perfectly. Best purchase this year.", "3", "0", "open"],
      ["ORD-1023", "Doohickey X", "Shipping was slow but the product is great.", "5", "0", "open"],
      ["ORD-1024", "Widget Pro", "Crashes on startup after the last update. Please fix.", "2", "0", "pending"],
      ["ORD-1025", "Thingamajig", "N/A", "4", "52", "N/A"],
      ["ORD-1026", "Gadget Mini", "Battery drains too fast, barely lasts half a day.", "1", "0", "open"],
      ["ORD-1027", "Widget Lite", "Customer support was super helpful and friendly.", "3", "0", "resolved"],
      ["ORD-1028", "Doohickey X", "N/A", "5", "0", "N/A"],
      ["ORD-1029", "Gizmo Max", "The manual is confusing, took me hours to set up.", "2", "0", "pending"],
      ["ORD-1030", "Thingamajig", "Great value for money, highly recommend to friends.", "4", "0", "resolved"],
      ["ORD-1031", "Widget Pro", "Screen flickers sometimes, might be a defect.", "1", "40", "resolved"],
      ["ORD-1032", "Gadget Mini", "Refund process was painless, thank you.", "3", "0", "open"],
      ["ORD-1033", "Doohickey X", "It crashes when I connect bluetooth. Annoying bug.", "5", "0", "open"],
      ["ORD-1034", "Widget Pro", "Solid build quality, feels premium.", "2", "0", "pending"],
      ["ORD-1035", "Thingamajig", "N/A", "4", "0", "N/A"],
      ["ORD-1036", "Gadget Mini", "Too expensive for what it does honestly.", "1", "0", "open"],
      ["ORD-1037", "Widget Lite", "Setup was easy, works out of the box.", "3", "28", "resolved"],
      ["ORD-1038", "Doohickey X", "The app keeps logging me out, very irritating.", "5", "0", "N/A"],
      ["ORD-1039", "Gizmo Max", "Perfect gift for my dad, he loves it.", "2", "0", "pending"],
      ["ORD-1040", "Thingamajig", "Delivery arrived two weeks late. Not happy.", "4", "0", "resolved"],
      ["ORD-1041", "Widget Pro", "App crashes every time I open settings. Very frustrating!", "1", "0", "resolved"],
      ["ORD-1042", "Gadget Mini", "Love it, works perfectly. Best purchase this year.", "3", "0", "open"],
      ["ORD-1043", "Doohickey X", "Shipping was slow but the product is great.", "5", "16", "open"],
      ["ORD-1044", "Widget Pro", "Crashes on startup after the last update. Please fix.", "2", "0", "pending"],
      ["ORD-1045", "Thingamajig", "N/A", "4", "0", "N/A"],
      ["ORD-1046", "Gadget Mini", "Battery drains too fast, barely lasts half a day.", "1", "0", "open"],
      ["ORD-1047", "Widget Lite", "Customer support was super helpful and friendly.", "3", "0", "resolved"],
      ["ORD-1048", "Doohickey X", "N/A", "5", "0", "N/A"],
      ["ORD-1049", "Gizmo Max", "The manual is confusing, took me hours to set up.", "2", "94", "pending"],
      ["ORD-1050", "Thingamajig", "Great value for money, highly recommend to friends.", "4", "0", "resolved"],
      ["ORD-1051", "Widget Pro", "Screen flickers sometimes, might be a defect.", "1", "0", "resolved"],
      ["ORD-1052", "Gadget Mini", "Refund process was painless, thank you.", "3", "0", "open"],
      ["ORD-1053", "Doohickey X", "It crashes when I connect bluetooth. Annoying bug.", "5", "0", "open"],
      ["ORD-1054", "Widget Pro", "Solid build quality, feels premium.", "2", "0", "pending"],
      ["ORD-1055", "Thingamajig", "N/A", "4", "82", "N/A"],
      ["ORD-1056", "Gadget Mini", "Too expensive for what it does honestly.", "1", "0", "open"],
      ["ORD-1057", "Widget Lite", "Setup was easy, works out of the box.", "3", "0", "resolved"],
      ["ORD-1058", "Doohickey X", "The app keeps logging me out, very irritating.", "5", "0", "N/A"],
      ["ORD-1059", "Gizmo Max", "Perfect gift for my dad, he loves it.", "2", "0", "pending"],
      ["ORD-1060", "Thingamajig", "Delivery arrived two weeks late. Not happy.", "4", "0", "resolved"],
    ],
  },
  {
    name: "Sales by Region",
    headers: ["Region", "Month", "Units Sold", "Revenue"],
    presets: {
      en: ["Add a Unit Price column: Revenue divided by Units Sold", "Highlight rows where Revenue is greater than 4000", "What's the total Revenue?"],
      zh: ["新增一列 Unit Price：Revenue 除以 Units Sold", "高亮 Revenue 大于 4000 的行", "Revenue 总共是多少？"],
      ja: ["Revenue を Units Sold で割った Unit Price 列を追加して", "Revenue が 4000 より大きい行をハイライトして", "Revenue の合計はいくら？"],
    },
    rows: [
      ["East", "Jan", "212", "4028"],
      ["East", "Feb", "168", "3192"],
      ["East", "Mar", "245", "4655"],
      ["East", "Apr", "113", "2147"],
      ["East", "May", "245", "4655"],
      ["East", "Jun", "212", "4028"],
      ["West", "Jan", "212", "4028"],
      ["West", "Feb", "168", "3192"],
      ["West", "Mar", "245", "4655"],
      ["West", "Apr", "113", "2147"],
      ["West", "May", "245", "4655"],
      ["West", "Jun", "212", "4028"],
      ["North", "Jan", "249", "4731"],
      ["North", "Feb", "205", "3895"],
      ["North", "Mar", "282", "5358"],
      ["North", "Apr", "150", "2850"],
      ["North", "May", "282", "5358"],
      ["North", "Jun", "249", "4731"],
      ["South", "Jan", "249", "4731"],
      ["South", "Feb", "205", "3895"],
      ["South", "Mar", "282", "5358"],
      ["South", "Apr", "150", "2850"],
      ["South", "May", "282", "5358"],
      ["South", "Jun", "249", "4731"],
    ],
  },
];

// Presets shown in the empty chat. Demo sheets get their own; any other file
// gets generic ones built from its real column names.
export function presetsFor(fileName: string, sheetName: string, headers: string[], locale: Locale): string[] {
  if (fileName === DEMO_FILE_NAME) {
    const sheet = DEMO_SHEETS.find((s) => s.name === sheetName);
    if (sheet) return sheet.presets[locale];
  }
  const a = headers[0] ?? "A";
  const b = headers[Math.min(1, headers.length - 1)] ?? a;
  if (locale === "zh") {
    return [`总结一下 ${a} 这一列`, `高亮 ${b} 为空的行`, `把每行的 ${b} 提炼成一个关键词，写进新列`];
  }
  if (locale === "ja") {
    return [`${a} 列を要約して`, `${b} が空の行をハイライトして`, `各行の ${b} からキーワードを1つ抽出し、新しい列に入れて`];
  }
  return [`Summarize the ${a} column`, `Highlight rows where ${b} is empty`, `Extract the main keyword from each ${b} into a new column`];
}

// Build the demo as a real .xlsx File so it goes through the exact same
// import path as a user upload.
export async function makeDemoFile(): Promise<File> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const s of DEMO_SHEETS) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([s.headers, ...s.rows]), s.name);
  }
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new File([buf], DEMO_FILE_NAME, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
