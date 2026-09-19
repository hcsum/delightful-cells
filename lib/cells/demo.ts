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
    headers: ["Order ID", "Product", "Customer Feedback", "Status"],
    presets: {
      en: ["Highlight rows where the feedback sounds angry", "Set Status to closed for every pending order", "Classify each Customer Feedback as positive, neutral or negative into a new column"],
      zh: ["高亮 feedback 听起来很生气的行", "把所有 pending 订单的 Status 改成 closed", "把每条 Customer Feedback 分类为 positive / neutral / negative，写进新列"],
      ja: ["不満や怒りが表れているフィードバックの行をハイライトして", "Status が pending の注文をすべて closed に変更して", "Customer Feedback の内容を positive、neutral、negative のいずれかに分類し、新しい列に入れて"],
    },
    rows: [
      ["ORD-1001", "Widget Pro", "App crashes every time I open settings. Very frustrating!", "resolved"],
      ["ORD-1002", "Gadget Mini", "Love it, works perfectly. Best purchase this year.", "open"],
      ["ORD-1003", "Doohickey X", "Shipping was slow but the product is great.", "open"],
      ["ORD-1004", "Widget Pro", "Crashes on startup after the last update. Please fix.", "pending"],
      ["ORD-1005", "Thingamajig", "N/A", "N/A"],
      ["ORD-1006", "Gadget Mini", "Battery drains too fast, barely lasts half a day.", "open"],
      ["ORD-1007", "Widget Lite", "Customer support was super helpful and friendly.", "resolved"],
      ["ORD-1008", "Doohickey X", "N/A", "N/A"],
      ["ORD-1009", "Gizmo Max", "The manual is confusing, took me hours to set up.", "pending"],
      ["ORD-1010", "Thingamajig", "Great value for money, highly recommend to friends.", "resolved"],
      ["ORD-1011", "Widget Pro", "Screen flickers sometimes, might be a defect.", "resolved"],
      ["ORD-1012", "Gadget Mini", "Refund process was painless, thank you.", "open"],
      ["ORD-1013", "Doohickey X", "It crashes when I connect bluetooth. Annoying bug.", "open"],
      ["ORD-1014", "Widget Pro", "Solid build quality, feels premium.", "pending"],
      ["ORD-1015", "Thingamajig", "N/A", "N/A"],
      ["ORD-1016", "Gadget Mini", "Too expensive for what it does honestly.", "open"],
      ["ORD-1017", "Widget Lite", "Setup was easy, works out of the box.", "resolved"],
      ["ORD-1018", "Doohickey X", "The app keeps logging me out, very irritating.", "N/A"],
      ["ORD-1019", "Gizmo Max", "Perfect gift for my dad, he loves it.", "pending"],
      ["ORD-1020", "Thingamajig", "Delivery arrived two weeks late. Not happy.", "resolved"],
      ["ORD-1021", "Widget Pro", "App crashes every time I open settings. Very frustrating!", "resolved"],
      ["ORD-1022", "Gadget Mini", "Love it, works perfectly. Best purchase this year.", "open"],
      ["ORD-1023", "Doohickey X", "Shipping was slow but the product is great.", "open"],
      ["ORD-1024", "Widget Pro", "Crashes on startup after the last update. Please fix.", "pending"],
      ["ORD-1025", "Thingamajig", "N/A", "N/A"],
      ["ORD-1026", "Gadget Mini", "Battery drains too fast, barely lasts half a day.", "open"],
      ["ORD-1027", "Widget Lite", "Customer support was super helpful and friendly.", "resolved"],
      ["ORD-1028", "Doohickey X", "N/A", "N/A"],
      ["ORD-1029", "Gizmo Max", "The manual is confusing, took me hours to set up.", "pending"],
      ["ORD-1030", "Thingamajig", "Great value for money, highly recommend to friends.", "resolved"],
      ["ORD-1031", "Widget Pro", "Screen flickers sometimes, might be a defect.", "resolved"],
      ["ORD-1032", "Gadget Mini", "Refund process was painless, thank you.", "open"],
      ["ORD-1033", "Doohickey X", "It crashes when I connect bluetooth. Annoying bug.", "open"],
      ["ORD-1034", "Widget Pro", "Solid build quality, feels premium.", "pending"],
      ["ORD-1035", "Thingamajig", "N/A", "N/A"],
      ["ORD-1036", "Gadget Mini", "Too expensive for what it does honestly.", "open"],
      ["ORD-1037", "Widget Lite", "Setup was easy, works out of the box.", "resolved"],
      ["ORD-1038", "Doohickey X", "The app keeps logging me out, very irritating.", "N/A"],
      ["ORD-1039", "Gizmo Max", "Perfect gift for my dad, he loves it.", "pending"],
      ["ORD-1040", "Thingamajig", "Delivery arrived two weeks late. Not happy.", "resolved"],
      ["ORD-1041", "Widget Pro", "App crashes every time I open settings. Very frustrating!", "resolved"],
      ["ORD-1042", "Gadget Mini", "Love it, works perfectly. Best purchase this year.", "open"],
      ["ORD-1043", "Doohickey X", "Shipping was slow but the product is great.", "open"],
      ["ORD-1044", "Widget Pro", "Crashes on startup after the last update. Please fix.", "pending"],
      ["ORD-1045", "Thingamajig", "N/A", "N/A"],
      ["ORD-1046", "Gadget Mini", "Battery drains too fast, barely lasts half a day.", "open"],
      ["ORD-1047", "Widget Lite", "Customer support was super helpful and friendly.", "resolved"],
      ["ORD-1048", "Doohickey X", "N/A", "N/A"],
      ["ORD-1049", "Gizmo Max", "The manual is confusing, took me hours to set up.", "pending"],
      ["ORD-1050", "Thingamajig", "Great value for money, highly recommend to friends.", "resolved"],
      ["ORD-1051", "Widget Pro", "Screen flickers sometimes, might be a defect.", "resolved"],
      ["ORD-1052", "Gadget Mini", "Refund process was painless, thank you.", "open"],
      ["ORD-1053", "Doohickey X", "It crashes when I connect bluetooth. Annoying bug.", "open"],
      ["ORD-1054", "Widget Pro", "Solid build quality, feels premium.", "pending"],
      ["ORD-1055", "Thingamajig", "N/A", "N/A"],
      ["ORD-1056", "Gadget Mini", "Too expensive for what it does honestly.", "open"],
      ["ORD-1057", "Widget Lite", "Setup was easy, works out of the box.", "resolved"],
      ["ORD-1058", "Doohickey X", "The app keeps logging me out, very irritating.", "N/A"],
      ["ORD-1059", "Gizmo Max", "Perfect gift for my dad, he loves it.", "pending"],
      ["ORD-1060", "Thingamajig", "Delivery arrived two weeks late. Not happy.", "resolved"],
    ],
  },
  {
    name: "Sales by Region",
    headers: ["Region", "Month", "Units Sold", "Revenue"],
    presets: {
      en: ["Add a Unit Price column: Revenue divided by Units Sold", "Which region and month had the highest Revenue?", "Highlight every row that missed the Revenue target of 3000, and tell me how many there are"],
      zh: ["新增一列 Unit Price：Revenue 除以 Units Sold", "哪个 Region 和 Month 的 Revenue 最高？", "高亮所有未达到 3000 Revenue 目标的行，并告诉我有多少行"],
      ja: ["Revenue を Units Sold で割った Unit Price 列を追加して", "Revenue が最も高い Region と Month はどれ？", "Revenue 目標の 3000 に届かなかった行をすべてハイライトし、何行あるか教えて"],
    },
    rows: [
      ["East", "Jan", "212", "3816"],
      ["East", "Feb", "168", "3696"],
      ["East", "Mar", "245", "5145"],
      ["East", "Apr", "113", "1921"],
      ["East", "May", "245", "5880"],
      ["East", "Jun", "212", "4240"],
      ["West", "Jan", "212", "4452"],
      ["West", "Feb", "168", "3024"],
      ["West", "Mar", "245", "4900"],
      ["West", "Apr", "113", "2599"],
      ["West", "May", "245", "5390"],
      ["West", "Jun", "212", "4028"],
      ["North", "Jan", "249", "4980"],
      ["North", "Feb", "205", "3485"],
      ["North", "Mar", "282", "7050"],
      ["North", "Apr", "150", "2850"],
      ["North", "May", "282", "5922"],
      ["North", "Jun", "249", "5478"],
      ["South", "Jan", "249", "4482"],
      ["South", "Feb", "205", "4100"],
      ["South", "Mar", "282", "6486"],
      ["South", "Apr", "150", "2400"],
      ["South", "May", "282", "5358"],
      ["South", "Jun", "249", "5229"],
    ],
  },
  {
    name: "Messy Addresses",
    headers: ["Address"],
    presets: {
      en: ["Extract the city from each Address into a new City column"],
      zh: ["从每条 Address 中提取城市，写入新的 City 列"],
      ja: ["各 Address から都市名を抽出し、新しい City 列に入れて"],
    },
    rows: [
      ["1600 Amphitheatre Pkwy, Mountain View CA 94043"],
      ["One Apple Park Way | Cupertino, CA 95014"],
      ["350 5th Ave, New York NY 10118, USA"],
      ["1 Microsoft Way - Redmond, WA 98052"],
      ["221B Baker Street, London NW1 6XE, United Kingdom"],
      ["4-2-8 Shibakoen, Minato-ku, Tokyo 105-0011 Japan"],
      ["Level 5, 48 Pirrama Rd, Pyrmont NSW 2009 Australia"],
      ["Unter den Linden 77, 10117 Berlin, Germany"],
      ["10 Bayfront Avenue #B1-01, Singapore 018956"],
      ["No. 100 Century Avenue, Pudong, Shanghai 200120"],
      ["500 S Buena Vista St / Burbank / CA / 91521"],
      ["PO Box 123, Austin TX 78701"],
      ["11 Wall Street, New York, NY 10005"],
      ["401 N Michigan Ave Ste 1200 Chicago IL 60611"],
      ["600 Congress Ave., Austin, Texas 78701 USA"],
      ["1000 4th Ave | Seattle WA 98104"],
      ["1700 Lincoln St, Floor 17, Denver CO 80203"],
      ["200 Central Ave SE; Albuquerque; NM 87102"],
      ["24 Beacon Street Boston MA 02133"],
      ["123 S Broad St / Philadelphia PA / 19109"],
      ["700 W Convention Way, Anaheim, California 92802"],
      ["PO BOX 88, Portland OR 97208"],
      ["1 E Washington St, Phoenix AZ 85004-2551"],
      ["301 E Ocean Blvd #1900 Long Beach CA 90802"],
      ["455 N Cityfront Plaza Dr., Chicago, IL 60611 USA"],
      ["101 California Street—San Francisco CA 94111"],
      ["800 Nicollet Mall, Minneapolis MN 55402"],
      ["333 W Wacker Drive; Chicago; IL; 60606"],
      ["1201 Third Avenue, Suite 4900, Seattle, WA 98101"],
      ["1601 Market St FL 18 Philadelphia Pennsylvania 19103"],
      ["2 Kingdom Street, Paddington, London W2 6BD, UK"],
      ["1 Spinningfields Square | Manchester | M3 3AP"],
      ["50 Queen Street, Edinburgh EH2 3NS Scotland"],
      ["The Mailbox, 101 Wharfside St, Birmingham B1 1RF"],
      ["3 Temple Back East, Bristol, BS1 6DZ, United Kingdom"],
      ["25 Canada Square / Canary Wharf / London E14 5LQ"],
      ["10 Grand Canal Square, Docklands, Dublin 2, Ireland"],
      ["1 Sir John Rogerson's Quay Dublin D02 CR67"],
      ["5 Avenue Anatole France, 75007 Paris France"],
      ["12 Rue de la Paix | 75002 | Paris"],
      ["Pariser Platz 1, 10117 Berlin Deutschland"],
      ["Neue Mainzer Str. 52-58, 60311 Frankfurt am Main"],
      ["Leopoldstrasse 50, 80802 München, Germany"],
      ["Piazza del Colosseo 1 - 00184 Roma RM - Italia"],
      ["Via Dante 15, 20121 Milano MI Italy"],
      ["Calle de Alcalá 48; 28014 Madrid; España"],
      ["Passeig de Gràcia 92, 08008 Barcelona Spain"],
      ["Dam 1, 1012 JS Amsterdam, Netherlands"],
      ["Bahnhofstrasse 10 / 8001 Zürich / Switzerland"],
      ["Rue du Rhône 42, 1204 Genève, Suisse"],
      ["Gustav Adolfs torg 18, SE-111 52 Stockholm"],
      ["Karl Johans gate 22, 0159 Oslo Norway"],
      ["Mannerheimintie 12 B, 00100 Helsinki, Finland"],
      ["Rådhuspladsen 16 | 1550 København V | Denmark"],
      ["ul. Marszałkowska 100, 00-026 Warszawa, Poland"],
      ["Václavské náměstí 1, 110 00 Praha 1 Czechia"],
      ["Andrássy út 22; Budapest 1061; Hungary"],
      ["Kärntner Straße 19, 1010 Wien, Austria"],
      ["Ermou 15, Athina 105 63, Greece"],
      ["İstiklal Cd. No:45, Beyoğlu, İstanbul 34433 Türkiye"],
      ["1-1 Marunouchi 1-chome, Chiyoda-ku Tokyo 100-0005"],
      ["2-11-3 Meguro, Meguro City, Tokyo 153-0063 JAPAN"],
      ["3-5-1 Umeda / Kita-ku / Osaka 530-0001"],
      ["1-2-1 Sakae, Naka-ku, Nagoya, Aichi 460-0008"],
      ["88 Queensway, Admiralty, Hong Kong"],
      ["Unit 1203, 12/F, 728 King's Road, Quarry Bay HK"],
      ["北京市朝阳区建国路88号 SOHO现代城, Beijing 100022"],
      ["上海市静安区南京西路1266号, Shanghai, 200040 China"],
      ["深圳市南山区科技园科苑路15号 Shenzhen Guangdong 518057"],
      ["台北市信義區信義路五段7號, Taipei 110 Taiwan"],
      ["Teheran-ro 152, Gangnam-gu, Seoul 06236 South Korea"],
      ["Level 20, 201 Sussex St, Sydney NSW 2000 Australia"],
      ["120 Collins Street | Melbourne VIC 3000 | AU"],
      ["123 Queen St, Brisbane, QLD, 4000"],
      ["PO Box 999, Perth WA 6843 Australia"],
      ["2 Queen Street, Auckland CBD, Auckland 1010 NZ"],
      ["10 Customhouse Quay / Wellington 6011 / New Zealand"],
      ["Marina Bay Financial Centre Tower 1, Singapore 018981"],
      ["Level 30 Menara Maxis, Kuala Lumpur City Centre 50088 Malaysia"],
      ["Jl. M.H. Thamrin No. 1, Jakarta Pusat 10310 Indonesia"],
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
