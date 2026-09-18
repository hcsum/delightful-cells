import DuplicateFinderClient from "@/components/DuplicateFinderClient";
import { rich, shared } from "@/lib/landing-copy";
import { localizedMetadata, serverLocale } from "@/lib/seo";

const PATH = "/find-duplicates-in-excel";

const COPY = {
  en: {
    title: "Find Duplicates in Excel (Excel & CSV Tool)",
    description:
      "Upload an Excel file (.xlsx) or CSV and flag duplicate values within a single column. Supports files up to 20 MB.",
    h1: "Find Duplicates in Excel",
    intro:
      "Choose a column and flag duplicate values within that column. By default comparisons are case-insensitive. Upload an Excel file and download the result with one extra column.",
    steps: [
      "**Upload your file:** Select an .xlsx, .xls, or .csv file — no need to convert it first. If the workbook has several sheets, pick the one you want.",
      "**Pick the column:** Choose it from the dropdown of your file’s own headers — nothing to type.",
      "**Choose case sensitivity (optional):** Leave off to compare case-insensitively; turn on to make comparisons case-sensitive.",
      "**Process and download:** You get a copy in the same format you uploaded, with a new duplicates column appended.",
    ],
    exampleHeading: "Example — Find duplicate emails",
    exampleTarget:
      "duplicates flag (True when the normalized value occurs more than once)",
    exampleSource: "email",
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
      "**处理并下载：**得到一份格式和上传时一致的副本，末尾多一列重复标记。",
    ],
    exampleHeading: "示例 —— 找出重复的邮箱",
    exampleTarget: "重复标记（同一个值出现超过一次时为 True）",
    exampleSource: "email（邮箱）",
  },
  ja: {
    title: "Excelの重複値をチェック（Excel・CSVツール）",
    description:
      "Excel（.xlsx）またはCSVファイルをアップロードし、1列内の重複値をマークします。最大20 MBのファイルに対応しています。",
    h1: "Excelの重複値をチェック",
    intro:
      "列を1つ選び、その列内の重複値をマークします。デフォルトでは大文字と小文字を区別しません。Excelファイルをアップロードすると、結果の列が1つ追加されたファイルをダウンロードできます。",
    steps: [
      "**ファイルをアップロード：**.xlsx、.xls、.csvファイルを選びます。事前に形式を変換する必要はありません。複数のシートがある場合は、使用するシートを選びます。",
      "**列を選択：**アップロードしたファイルの見出しがドロップダウンに表示されます。入力する必要はありません。",
      "**大文字と小文字の区別（任意）：**オフの場合は区別せず、オンの場合は区別して比較します。",
      "**処理してダウンロード：**重複フラグの列が末尾に追加されたファイルを、アップロード時と同じ形式でダウンロードできます。",
    ],
    exampleHeading: "例 — 重複するメールアドレスを見つける",
    exampleTarget: "重複フラグ（正規化後の同じ値が複数回現れる場合はTrue）",
    exampleSource: "email（メールアドレス）",
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
      </div>
    </div>
  );
}
