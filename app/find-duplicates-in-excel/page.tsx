import Link from "next/link";
import DuplicateFinderClient from "@/components/DuplicateFinderClient";
import { rich, shared } from "@/lib/landing-copy";
import { localizedMetadata, serverLocale } from "@/lib/seo";

const PATH = "/find-duplicates-in-excel";

const COPY = {
  en: {
    title: "Find Duplicates in Excel (Excel & CSV Tool)",
    description:
      "Upload an Excel (.xlsx or .xls) or CSV file and flag duplicate values in one column. Supports files up to 20 MB.",
    h1: "Find Duplicates in Excel",
    intro:
      "Choose a column and flag duplicate values within that column. By default comparisons are case-insensitive. Upload an Excel file and download the result with one extra column.",
    steps: [
      "**Upload your file:** Select an .xlsx, .xls, or .csv file — no need to convert it first. If the workbook has several sheets, pick the one you want.",
      "**Pick the column:** Choose it from the dropdown of your file’s own headers — nothing to type.",
      "**Choose case sensitivity (optional):** Leave off to compare case-insensitively; turn on to make comparisons case-sensitive.",
      "**Process and download:** Download the selected sheet with a new duplicates column. Excel files are exported as .xlsx; CSV files stay .csv. Other sheets, formulas, and cell formatting aren't preserved.",
    ],
    exampleHeading: "Example — Find duplicate emails",
    exampleTarget:
      "duplicates flag (True when the normalized value occurs more than once)",
    exampleSource: "email",
    detailsTitle: "What this duplicate finder checks",
    details: [
      {
        question:
          "Does it find duplicates in one column or compare two columns?",
        answer:
          "This page checks one selected column and marks every non-empty value that appears more than once in that column. To check whether values in one list appear in another, use the two-column comparison tool.",
      },
      {
        question: "Does it remove duplicate rows?",
        answer:
          "No. It keeps your rows and adds a duplicates_<column> result column. Rows whose value occurs more than once are marked True, so you can filter or review them in Excel before deciding what to remove.",
      },
      {
        question: "How are values compared?",
        answer:
          "Leading and trailing spaces are trimmed, blank cells are ignored, and comparisons are case-insensitive by default. Turn on Case sensitive to treat values such as Alice and ALICE as different.",
      },
      {
        question: "Can I check an email or product-ID list?",
        answer:
          "Yes. Choose the column containing email addresses, product IDs, order numbers, or another value you want to check. The tool flags repeated values without changing your original column.",
      },
    ],
    relatedTitle: "Related Excel tools",
    relatedCompare: "Compare two columns in Excel",
  },
  zh: {
    title: "Excel 查找重复值（Excel 和 CSV 工具）",
    description:
      "上传 Excel（.xlsx）或 CSV 文件，标记出某一列里重复出现的值。单个文件最大 20 MB。",
    h1: "Excel 查找重复值",
    intro:
      "选一列，把这一列里重复出现的值标记出来。默认比较时不区分大小写。上传 Excel 文件，下载时会多出一列结果。",
    steps: [
      "**上传文件：**选一个 .xlsx、.xls 或 .csv 文件，不需要先转格式。工作簿有多个工作表时，挑你要的那个。",
      "**选择要检查的列：**从下拉框里挑，选项就是你自己文件的表头，不用手打。",
      "**要不要区分大小写（可选）：**关着就不区分大小写；打开则严格区分。",
      "**处理并下载：**下载所选工作表，并在末尾添加重复标记列。Excel 文件统一导出为 .xlsx；CSV 仍为 .csv。其他工作表、公式和单元格格式不会保留。",
    ],
    exampleHeading: "示例 —— 找出重复的邮箱",
    exampleTarget: "重复标记（同一个值出现超过一次时为 True）",
    exampleSource: "email（邮箱）",
    detailsTitle: "这个重复值查找工具会检查什么",
    details: [
      {
        question: "它检查一列，还是比较两列？",
        answer:
          "本页检查你选中的单列，并标记其中出现多次的非空值。如果要检查一个清单里的值是否也出现在另一个清单中，请使用两列比较工具。",
      },
      {
        question: "它会删除重复行吗？",
        answer:
          "不会。工具会保留原有行，并添加一列 duplicates_<column> 结果。重复值对应的行会标记为 True，你可以下载后在 Excel 中筛选、检查，再决定是否删除。",
      },
      {
        question: "比较值时会怎样处理空格和大小写？",
        answer:
          "比较前会去掉首尾空格，空白单元格会忽略，默认不区分大小写。打开“区分大小写”后，Alice 和 ALICE 会被视为不同值。",
      },
      {
        question: "可以检查邮箱或产品编号吗？",
        answer:
          "可以。选择包含邮箱、产品编号、订单号或其他待检查值的列即可。工具会标出重复项，不会改写原始列。",
      },
    ],
    relatedTitle: "相关 Excel 工具",
    relatedCompare: "在 Excel 中比较两列",
  },
  ja: {
    title: "Excelの重複値をチェック（Excel・CSVツール）",
    description:
      "Excel（.xlsx、.xls）またはCSVファイルをアップロードし、1列内の重複値をマークします。最大20 MBのファイルに対応しています。",
    h1: "Excelの重複値をチェック",
    intro:
      "列を1つ選び、その列内の重複値をマークします。デフォルトでは大文字と小文字を区別しません。Excelファイルをアップロードすると、結果の列が1つ追加されたファイルをダウンロードできます。",
    steps: [
      "**ファイルをアップロード：**.xlsx、.xls、.csvファイルを選びます。事前に形式を変換する必要はありません。複数のシートがある場合は、使用するシートを選びます。",
      "**列を選択：**アップロードしたファイルの見出しがドロップダウンに表示されます。入力する必要はありません。",
      "**大文字と小文字の区別（任意）：**オフの場合は区別せず、オンの場合は区別して比較します。",
      "**処理してダウンロード：**選択したシートに重複フラグ列を追加してダウンロードします。Excelファイルは .xlsx、CSVファイルは .csv で出力されます。他のシート、数式、セルの書式は保持されません。",
    ],
    exampleHeading: "例 — 重複するメールアドレスを見つける",
    exampleTarget: "重複フラグ（正規化後の同じ値が複数回現れる場合はTrue）",
    exampleSource: "email（メールアドレス）",
    detailsTitle: "この重複チェックツールでできること",
    details: [
      {
        question: "1列内の重複と、2列間の比較のどちらに対応していますか？",
        answer:
          "このページでは選択した1列を確認し、空白以外で複数回現れる値にマークします。一方のリストの値がもう一方にもあるか調べる場合は、2列比較ツールを使ってください。",
      },
      {
        question: "重複行は削除されますか？",
        answer:
          "いいえ。元の行を残したまま duplicates_<column> 列を追加します。重複する値の行には True が付くため、Excelで確認してから削除できます。",
      },
      {
        question: "空白や大文字・小文字はどう扱われますか？",
        answer:
          "比較時に前後の空白を取り除き、空のセルは無視します。デフォルトでは大文字・小文字を区別しません。区別する設定にすると、Alice と ALICE は別の値になります。",
      },
      {
        question: "メールや商品IDの重複も確認できますか？",
        answer:
          "はい。メールアドレス、商品ID、注文番号など、確認したい値が入った列を選択してください。元の列は変更せずに重複をマークします。",
      },
    ],
    relatedTitle: "関連するExcelツール",
    relatedCompare: "Excelで2つの列を比較",
  },
} as const;

const EXAMPLE_ROWS = [
  ["alice@example.com", "True"],
  ["bob@example.com", "True"],
  ["alice@example.com", "True"],
  ["carol@company.co", ""],
  ["BOB@example.com", "True"],
];

export function generateMetadata() {
  return localizedMetadata(PATH, COPY);
}

export default function Page() {
  const locale = serverLocale();
  const c = COPY[locale];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{c.h1}</h1>
      <p className="text-white/80 max-w-2xl text-muted">{c.intro}</p>
      <DuplicateFinderClient />

      <div className="space-y-8 pt-12">
        <hr />
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{shared(locale, "howTo")}</h2>
          <ol className="list-decimal pl-6 space-y-2 text-white/80">
            {c.steps.map((step, i) => (
              <li key={i}>{rich(step)}</li>
            ))}
          </ol>
        </section>

        <h2 className="text-xl font-semibold">{shared(locale, "examples")}</h2>
        <section className="space-y-12">
          <article className="space-y-3">
            <h3 className="text-lg font-medium">{c.exampleHeading}</h3>
            <ul className="text-white/80 text-sm space-y-1">
              <li>
                <strong>{shared(locale, "target")}</strong> {c.exampleTarget}
              </li>
              <li>
                <strong>{shared(locale, "source")}</strong> {c.exampleSource}
              </li>
            </ul>
            <div className="space-y-2">
              <div>{shared(locale, "expected")}</div>
              <div className="overflow-auto">
                <table className="mt-1 w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left">
                      <th className="border-b border-white/10 py-1 pr-4">
                        email
                      </th>
                      <th className="border-b border-white/10 py-1">
                        duplicates_email
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {EXAMPLE_ROWS.map(([email, flag], i) => (
                      <tr key={i}>
                        <td className="align-top pr-4 py-1">{email}</td>
                        <td className="align-top py-1">{flag}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </article>
        </section>

        <section className="space-y-4" aria-labelledby="duplicate-faq-heading">
          <h2 id="duplicate-faq-heading" className="text-xl font-semibold">
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
            href="/compare-two-columns-in-excel"
          >
            {c.relatedCompare}
          </Link>
        </nav>
      </div>
    </div>
  );
}
