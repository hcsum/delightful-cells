import Link from "next/link";
import CompareColumnsClient from "@/components/CompareColumnsClient";
import JapaneseComparisonGuide from "@/components/JapaneseComparisonGuide";
import { localizePath } from "@/lib/locale-routing";
import { rich, shared } from "@/lib/landing-copy";
import { localizedMetadata, serverLocale } from "@/lib/seo";

const PATH = "/compare-two-columns-in-excel";

const COPY = {
  en: {
    title: "Compare Two Columns in Excel (Excel & CSV Tool)",
    description:
      "Compare two Excel or CSV columns to find values that match, are missing, or appear in both lists. Choose the comparison and download a copy with results.",
    h1: "Compare Two Columns in Excel",
    intro:
      "Compare two lists in an Excel or CSV file without writing a formula. Choose whether to find values from one column that also appear in the other, values that are missing, or rows where both columns match.",
    tasksTitle: "Typical Column Comparison Tasks",
    tasks: [
      "Row-by-row comparisons to see if Column A equals Column B",
      "Finding missing items between columns (A not in B)",
      "Spotting duplicates where A appears anywhere in B",
      "Handling datasets that are not sorted and may differ in length",
    ],
    useCasesTitle: "Common Use Cases",
    useCases: [
      "Matching product lists across suppliers or channels",
      "Checking attendance lists against a registration master",
      "Comparing a master file vs. an imported dataset",
      "Validating merges, migrations, or deduplication tasks",
    ],
    tryTitle: "Try the tool now:",
    detailsTitle: "How to compare two Excel columns",
    details: [
      {
        question: "What is the difference between the three comparison types?",
        answer:
          "Duplicates checks whether each non-empty value in Column A appears anywhere in Column B. Missing items marks values from A that do not appear in B. Matches compares A and B on the same row. The first two compare lists regardless of row order; Matches does not.",
      },
      {
        question:
          "Does the comparison work if the columns are different lengths or unsorted?",
        answer:
          "Yes for Duplicates and Missing items: each value in A is looked up across all of B, so the lists do not need to be sorted or have the same number of rows. Matches is a row-by-row comparison, so row order matters.",
      },
      {
        question: "Are spaces, capitalization, or blank cells considered?",
        answer:
          "Leading and trailing spaces are trimmed. Comparisons are case-insensitive by default; turn on Case sensitive to distinguish capitalization. Blank cells in Column B are ignored, and blank values in Column A are not marked as matches or duplicates.",
      },
      {
        question: "Will the original spreadsheet be changed?",
        answer:
          "No. Your original file stays unchanged. The download contains only the selected sheet and the result column; Excel uploads are exported as .xlsx. Formulas, formatting, and other sheets aren't preserved.",
      },
    ],
    relatedTitle: "Related Excel tools",
    relatedDuplicates: "Find duplicates in one Excel column",
    steps: [
      "**Upload your file:** Select an .xlsx, .xls, or .csv file (up to 20 MB). All processing happens in your browser. If the workbook has several sheets, pick the one you want.",
      "**Pick Column A and Column B:** Both dropdowns are filled from your file’s own headers — nothing to type.",
      "**Choose comparison type:** Select *duplicates*, *matches*, or *missing items*.",
      "**Choose case sensitivity (optional):** Leave off to compare case-insensitively; turn on to make comparisons case-sensitive.",
      "**Process and download:** Download the selected sheet with a new comparison column. Excel files are exported as .xlsx; CSV files stay .csv. Other sheets, formulas, and cell formatting aren't preserved.",
    ],
    source: "order_number_entered → order_number_master",
    modes: {
      duplicates: {
        heading: "Example — Duplicates (A exists in B)",
        target:
          "duplicates flag (True when the normalized value from Column A exists anywhere in Column B)",
      },
      matches: {
        heading: "Example — Matches (A equals B in the same row)",
        target:
          "matches flag (True when the normalized values of Column A and Column B are equal in the same row)",
      },
      missing: {
        heading: "Example — Missing Items (A not found anywhere in B)",
        target:
          "missing items flag (True when the normalized value from Column A does not appear anywhere in Column B)",
      },
    },
  },
  zh: {
    title: "Excel 比较两列（Excel 和 CSV 工具）",
    description:
      "在 Excel 里比较两列，找出重复值、相同值或缺失值。不用写公式 —— 上传 Excel 或 CSV 文件，直接下载结果。",
    h1: "在 Excel 里比较两列",
    intro:
      "不用写公式，就能比较 Excel 里的两列，找出相同或缺失的值。Excel 和 CSV 数据都能处理，可以用来找出两列之间的差异、重复值和缺失项。",
    tasksTitle: "常见的两列比对需求",
    tasks: [
      "逐行比较，看 A 列和 B 列是否相等",
      "找出缺失项：A 列有但 B 列里没有的值",
      "找出重复项：A 列的值在 B 列任意位置出现过",
      "处理没有排序、长度也不一样的两列数据",
    ],
    useCasesTitle: "典型使用场景",
    useCases: [
      "核对不同供应商或渠道之间的产品清单",
      "拿签到名单去对报名总表",
      "用主表核对导入进来的数据",
      "验证合并、迁移或去重的结果",
    ],
    tryTitle: "现在就试试：",
    steps: [
      "**上传文件：**选一个 .xlsx、.xls 或 .csv 文件（最大 20 MB）。全部处理都在你的浏览器里完成。工作簿有多个工作表时，挑你要的那个。",
      "**选择 A 列和 B 列：**两个下拉框的选项都来自你自己文件的表头，不用手打。",
      "**选择比对方式：**可选*重复值*、*相同值*或*缺失项*。",
      "**要不要区分大小写（可选）：**关着就不区分大小写；打开则严格区分。",
      "**处理并下载：**下载所选工作表，并在末尾添加比对结果列。Excel 文件统一导出为 .xlsx；CSV 仍为 .csv。其他工作表、公式和单元格格式不会保留。",
    ],
    source: "order_number_entered → order_number_master",
    detailsTitle: "如何比较 Excel 中的两列",
    details: [
      {
        question: "三种比对方式有什么区别？",
        answer:
          "“重复值”检查 A 列每个非空值是否在 B 列任意位置出现；“缺失项”标记 A 列中未出现在 B 列的值；“相同值”逐行比较 A、B 两列。前两种不受行顺序影响，“相同值”按行对应比较。",
      },
      {
        question: "两列长度不同或没有排序也能比较吗？",
        answer:
          "可以。“重复值”和“缺失项”会在 B 列的所有值中查找，因此两列不必排序，也不必有相同行数。“相同值”是逐行比较，所以行顺序会影响结果。",
      },
      {
        question: "空格、大小写和空白单元格怎么处理？",
        answer:
          "比较前会去掉首尾空格。默认不区分大小写；打开“区分大小写”后会区分大小写。B 列空白会忽略，A 列空白不会被标记为匹配或重复。",
      },
      {
        question: "工具会修改我的原始表格吗？",
        answer:
          "不会，原文件不会被改动。下载文件只包含所选工作表和新增结果列；Excel 文件统一导出为 .xlsx，公式、单元格格式和其他工作表不会保留。",
      },
    ],
    relatedTitle: "相关 Excel 工具",
    relatedDuplicates: "查找 Excel 单列中的重复值",
    modes: {
      duplicates: {
        heading: "示例 —— 重复值（A 的值在 B 里出现过）",
        target: "重复标记（A 列的值在 B 列任意位置出现过时为 True）",
      },
      matches: {
        heading: "示例 —— 相同值（同一行里 A 等于 B）",
        target: "相同标记（同一行里 A 列和 B 列的值相等时为 True）",
      },
      missing: {
        heading: "示例 —— 缺失项（A 的值在 B 里完全没有）",
        target: "缺失标记（A 列的值在 B 列任何地方都找不到时为 True）",
      },
    },
  },
  ja: {
    title: "Excelで2つの列を比較｜A列にあってB列にない値を探す",
    description:
      "ExcelでA列にあってB列にない値や、2つの列で一致しない値を確認。並び順が違うリストの照合と同じ行の比較を使い分け、COUNTIF関数の方法と、関数なしで結果列を追加するExcel・CSVツールを紹介します。",
    h1: "Excelで2つの列を比較 — A列にあってB列にない値を見つける",
    intro:
      "商品マスターと入荷リストを照合したいときは、ファイルをアップロードして2列を選択。「比較先にない値」でA列にあってB列にない商品コードをマークできます。並び順が違うリストの比較にも対応。関数で確認する方法はツールの下で紹介します。",
    tasksTitle: "よくある列の比較",
    tasks: [
      "行ごとにA列とB列が等しいか比較する",
      "A列にはあるがB列にはない値を見つける",
      "A列とB列の両方にある値を見つける",
      "並べ替えられておらず、長さも異なるデータを比較する",
    ],
    useCasesTitle: "主な使用例",
    useCases: [
      "仕入先や販売チャネルごとの商品リストを照合する",
      "出席者リストを登録者名簿と照合する",
      "マスターファイルとインポートしたデータを比較する",
      "データの結合、移行、重複排除の結果を検証する",
    ],
    tryTitle: "今すぐ試す：",
    steps: [
      "**ファイルをアップロード：**.xlsx、.xls、.csvファイル（最大20 MB）を選びます。処理はすべてブラウザ内で行われます。複数のシートがある場合は、使用するシートを選びます。",
      "**A列とB列を選択：**どちらのドロップダウンにも、アップロードしたファイルの見出しが表示されます。入力する必要はありません。",
      "**比較方法を選択：***両方にある値*、*同じ行で一致する値*、*比較先にない値*から選びます。A列にあってB列にない値を探す場合は「比較先にない値」です。",
      "**大文字と小文字の区別（任意）：**オフの場合は区別せず、オンの場合は区別して比較します。",
      "**処理してダウンロード：**選択したシートに比較結果の列を追加してダウンロードします。Excelファイルは .xlsx、CSVファイルは .csv で出力されます。他のシート、数式、セルの書式は保持されません。",
    ],
    source: "入力された注文番号 → マスターの注文番号",
    detailsTitle: "Excelの2列を比較する方法",
    details: [
      {
        question: "3つの比較方法はどう違いますか？",
        answer:
          "「両方にある値」はA列の各非空値がB列のどこかにあるかを確認します。「比較先にない値」はA列にありB列にはない値をマークします。「同じ行で一致する値」は同じ行のA列とB列を比較します。最初の2つは行順に関係なく、最後は行ごとの比較です。",
      },
      {
        question: "列の長さが違ったり、並べ替えられていなくても使えますか？",
        answer:
          "「両方にある値」と「比較先にない値」では、A列の値をB列全体から検索するため、並べ替えや同じ行数は必要ありません。「同じ行で一致する値」は行ごとに比較するため、行順が重要です。B列にだけある値を探す場合は、比較元と比較先を入れ替えます。",
      },
      {
        question: "空白、大文字・小文字、空のセルはどう扱われますか？",
        answer:
          "前後の空白は取り除きます。デフォルトでは大文字・小文字を区別せず、設定を有効にすると区別します。B列の空セルは検索対象外です。A列の空セルは「両方にある値」「同じ行で一致する値」ではマークされませんが、「比較先にない値」ではTrueになります。空白の行は結果を確認するときに除外してください。",
      },
      {
        question: "2つの列で一致しない値だけをダウンロードできますか？",
        answer:
          "このツールは行を絞り込まず、選択したシートの全データに結果列を追加します。条件に当てはまる行は文字列True、それ以外は空欄です。ダウンロード後、Excelのフィルターで結果列のTrueだけを表示してください。同じ行で一致しない値を探す場合は「同じ行で一致する値」の結果が空欄の行を確認します。両方空白の行も空欄になるため、必要に応じて除外してください。",
      },
      {
        question: "関数なしで使えますか？データはサーバーに送信されますか？",
        answer:
          "この2列比較ツールは関数やアドインなしで使え、ファイルの読み込み・比較・出力はブラウザ内で行います。別のAI抽出ツールは選択したセルの内容をサーバーへ送信するため、処理方式が異なります。",
      },
      {
        question: "元のスプレッドシートは変更されますか？",
        answer:
          "いいえ。元ファイルは変更されません。ダウンロードには選択したシートと追加した結果列のみが含まれます。Excelファイルは .xlsx で出力され、数式、セルの書式、他のシートは保持されません。",
      },
    ],
    relatedTitle: "関連するExcelツール",
    relatedDuplicates: "Excelの1列から重複値を見つける",
    modes: {
      duplicates: {
        heading: "例 — 両方にある値（A列の値がB列にもある）",
        target:
          "重複フラグ（正規化したA列の値がB列のどこかに存在する場合はTrue）",
      },
      matches: {
        heading: "例 — 一致（同じ行のAとBが等しい）",
        target:
          "一致フラグ（同じ行にあるA列とB列の正規化した値が等しい場合はTrue）",
      },
      missing: {
        heading: "例 — B列にない値（A列の値がB列のどこにもない）",
        target:
          "未検出フラグ（正規化したA列の値がB列のどこにも存在しない場合はTrue）",
      },
    },
  },
} as const;

type Mode = keyof (typeof COPY)["en"]["modes"];

const EXAMPLES: {
  mode: Mode;
  column: string;
  rows: [string, string, string][];
}[] = [
  {
    mode: "duplicates",
    column: "duplicates_order_number_entered_order_number_master",
    rows: [
      ["1001", "AC105", "True"],
      ["1002", "AC106", "True"],
      ["1003", "AC107", ""],
      ["1004", "1001", ""],
      ["1005", "AC109", ""],
      ["1006", "AC110", ""],
      ["1007", "1002", ""],
    ],
  },
  {
    mode: "matches",
    column: "matches_order_number_entered_order_number_master",
    rows: [
      ["1001", "1001", "True"],
      ["1002", "1002", "True"],
      ["1003", "1004", ""],
      ["1004", "1004", "True"],
      ["1005", "", ""],
      ["1006", "1006", "True"],
      ["1007", "1008", ""],
    ],
  },
  {
    mode: "missing",
    column: "missing_items_order_number_entered_order_number_master",
    rows: [
      ["1001", "1001", ""],
      ["1002", "1002", ""],
      ["1003", "1004", "True"],
      ["1004", "1004", ""],
      ["1005", "", "True"],
      ["1006", "1006", ""],
      ["1007", "1008", "True"],
    ],
  },
];

export async function generateMetadata() {
  const locale = await serverLocale();
  return localizedMetadata(PATH, COPY);
}

export default async function Page() {
  const locale = await serverLocale();
  const c = COPY[locale];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{c.h1}</h1>
      <p className="text-white/80 max-w-2xl text-muted">{c.intro}</p>

      <h2 className="text-xl font-semibold pt-2">{c.tryTitle}</h2>
      <CompareColumnsClient />

      <div className="space-y-8 pt-12">
        <hr />
        {locale === "ja" ? <JapaneseComparisonGuide /> : null}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{c.tasksTitle}</h2>
          <ul className="list-disc pl-5 space-y-1 text-white/80">
            {c.tasks.map((task, i) => (
              <li key={i}>{task}</li>
            ))}
          </ul>
          <h3 className="text-lg font-medium">{c.useCasesTitle}</h3>
          <ul className="list-disc pl-5 space-y-1 text-white/80">
            {c.useCases.map((useCase, i) => (
              <li key={i}>{useCase}</li>
            ))}
          </ul>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{shared(locale, "howTo")}</h2>
          <ol className="list-decimal pl-6 space-y-2 text-white/80">
            {c.steps.map((step, i) => (
              <li key={i}>{rich(step)}</li>
            ))}
          </ol>
        </section>

        {locale !== "ja" ? (
          <h2 className="text-xl font-semibold">
            {shared(locale, "examples")}
          </h2>
        ) : null}
        <section className="space-y-12">
          {(locale === "ja" ? [] : EXAMPLES).map((ex) => (
            <article key={ex.mode} className="space-y-3">
              <h3 className="text-lg font-medium">
                {c.modes[ex.mode].heading}
              </h3>
              <ul className="text-white/80 text-sm space-y-1">
                <li>
                  <strong>{shared(locale, "target")}</strong>{" "}
                  {c.modes[ex.mode].target}
                </li>
                <li>
                  <strong>{shared(locale, "source")}</strong> {c.source}
                </li>
              </ul>
              <div className="space-y-2">
                <div>{shared(locale, "expected")}</div>
                <div className="overflow-auto">
                  <table className="mt-1 w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-left">
                        <th className="border-b border-white/10 py-1 pr-4">
                          {locale === "ja"
                            ? "入力された注文番号"
                            : "order_number_entered"}
                        </th>
                        <th className="border-b border-white/10 py-1 pr-4">
                          {locale === "ja"
                            ? "マスターの注文番号"
                            : "order_number_master"}
                        </th>
                        <th className="border-b border-white/10 py-1">
                          {ex.column}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ex.rows.map((row, i) => (
                        <tr key={i}>
                          <td className="align-top pr-4 py-1">{row[0]}</td>
                          <td className="align-top pr-4 py-1">{row[1]}</td>
                          <td className="align-top py-1">{row[2]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="space-y-4" aria-labelledby="compare-faq-heading">
          <h2 id="compare-faq-heading" className="text-xl font-semibold">
            {c.detailsTitle}
          </h2>
          <div className="space-y-4">
            {c.details.map((item) => (
              <article key={item.question} className="space-y-1">
                <h3 className="font-medium">{item.question}</h3>
                <p className="max-w-3xl text-white/80 text-muted">
                  {item.answer}
                </p>
              </article>
            ))}
          </div>
        </section>

        <nav aria-label={c.relatedTitle} className="space-y-2">
          <h2 className="text-xl font-semibold">{c.relatedTitle}</h2>
          <Link
            className="underline underline-offset-4"
            href={localizePath("/find-duplicates-in-excel", locale)}
          >
            {c.relatedDuplicates}
          </Link>
        </nav>
      </div>
    </div>
  );
}
