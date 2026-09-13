import CompareColumnsClient from "@/components/CompareColumnsClient";
import { rich, shared } from "@/lib/landing-copy";
import { localizedMetadata, serverLocale } from "@/lib/seo";

const PATH = "/compare-two-columns-in-excel";

const COPY = {
  en: {
    title: "Compare Two Columns in Excel (Excel & CSV Tool)",
    description:
      "Compare 2 columns in Excel to find duplicates, matches, or missing values. Excel column comparison guide — upload an Excel file or CSV and download results fast.",
    keywords: [
      "compare 2 columns in excel",
      "compare two columns in excel",
      "compare columns excel",
      "how to find duplicates or missing values between two columns",
      "find duplicates between two columns excel",
      "excel column comparison guide",
    ],
    h1: "Compare Two Columns in Excel",
    intro:
      "Here you can compare 2 columns in Excel to find matching or missing values without writing formulas. This tool acts as a column comparison helper for Excel and CSV data. Compare 2 columns in Excel to identify differences, duplicates, or missing values in your dataset.",
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
    steps: [
      "**Upload your file:** Select an .xlsx, .xls, or .csv file (up to 20 MB). All processing happens in your browser. If the workbook has several sheets, pick the one you want.",
      "**Pick Column A and Column B:** Both dropdowns are filled from your file’s own headers — nothing to type.",
      "**Choose comparison type:** Select *duplicates*, *matches*, or *missing items*.",
      "**Choose case sensitivity (optional):** Leave off to compare case-insensitively; turn on to make comparisons case-sensitive.",
      "**Process and download:** You get a copy in the same format you uploaded, with a new comparison column appended.",
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
    keywords: [
      "excel 比较两列",
      "excel 对比两列数据",
      "excel 两列找重复",
      "excel 两列找不同",
      "excel 查找缺失值",
      "excel 两列数据比对",
    ],
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
      "**处理并下载：**得到一份格式和上传时一致的副本，末尾多一列比对结果。",
    ],
    source: "order_number_entered → order_number_master",
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
} as const;

type Mode = keyof (typeof COPY)["en"]["modes"];

const EXAMPLES: { mode: Mode; column: string; rows: [string, string, string][] }[] = [
  {
    mode: "duplicates",
    column: "duplicates_order_number_entered_order_number_master",
    rows: [
      ["1001", "AC105", ""],
      ["1002", "AC106", ""],
      ["1003", "AC107", ""],
      ["1004", "1001", "True"],
      ["1005", "AC109", ""],
      ["1006", "AC110", ""],
      ["1007", "1002", "True"],
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

export function generateMetadata() {
  const locale = serverLocale();
  return localizedMetadata(PATH, COPY, { keywords: [...COPY[locale].keywords] });
}

export default function Page() {
  const locale = serverLocale();
  const c = COPY[locale];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{c.h1}</h1>
      <p className="text-white/80 max-w-2xl text-muted">{c.intro}</p>

      {/* SEO sub-content: tasks/use cases to strengthen topical relevance */}
      <section className="space-y-4">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h3 className="text-lg font-medium">{c.tasksTitle}</h3>
            <ul className="list-disc pl-5 text-white/80">
              {c.tasks.map((task, i) => (
                <li key={i}>{task}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium">{c.useCasesTitle}</h3>
            <ul className="list-disc pl-5 text-white/80">
              {c.useCases.map((useCase, i) => (
                <li key={i}>{useCase}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <h2 className="text-xl font-semibold pt-2">{c.tryTitle}</h2>
      <CompareColumnsClient />

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
          {EXAMPLES.map((ex) => (
            <article key={ex.mode} className="space-y-3">
              <h3 className="text-lg font-medium">{c.modes[ex.mode].heading}</h3>
              <ul className="text-white/80 text-sm space-y-1">
                <li>
                  <strong>{shared(locale, "target")}</strong> {c.modes[ex.mode].target}
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
                          order_number_entered
                        </th>
                        <th className="border-b border-white/10 py-1 pr-4">
                          order_number_master
                        </th>
                        <th className="border-b border-white/10 py-1">{ex.column}</th>
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
      </div>
    </div>
  );
}
