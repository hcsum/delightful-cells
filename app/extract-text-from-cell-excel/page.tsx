import CustomToolClient from "@/components/CustomToolClient";
import ToolLanding from "@/components/ToolLanding";
import type { LandingEntry } from "@/lib/landing-copy";
import { localizedMetadata, serverLocale } from "@/lib/seo";

const PATH = "/extract-text-from-cell-excel";

const COPY: LandingEntry = {
  en: {
    title: "Extract Text from Cell (Excel & CSV Tool)",
    description:
      "Describe what to extract and select the source column. Preview a few sample rows to check the result, or process the full file right away.",
    h1: "Extract Text from Cell",
    intro:
      "Describe what to extract and select the source column. Preview a few sample rows to check the result, or process the full file right away.",
    steps: [
      "**Upload your Excel file:** Select an .xlsx, .xls, or .csv file so the tool can read your headers and data.",
      "**Define the Target:** Describe what you want to extract in plain English (for example, “feedback summary”, “SKU”, “model”).",
      "**Pick the Source column:** Choose it from the dropdown of your file’s own headers.",
      "**Preview sample rows:** Run a short preview to check the output on a handful of rows and adjust the description if needed.",
      "**Process full file and download results:** When you are happy with the preview, process the full file and download the result — in the same format you uploaded.",
    ],
  },
  zh: {
    title: "Excel 从单元格提取文本（Excel 和 CSV 工具）",
    description:
      "用大白话描述要提取什么，再选中来源列。可以先预览几行确认效果，也可以直接处理整个文件。",
    h1: "从单元格提取文本",
    intro:
      "用大白话描述要提取什么，再选中来源列。可以先预览几行确认效果，也可以直接处理整个文件。",
    steps: [
      "**上传 Excel 文件：**选一个 .xlsx、.xls 或 .csv 文件，工具会读出表头和数据。",
      "**写清楚目标：**用大白话描述要提取什么（例如「反馈摘要」「SKU」「型号」）。",
      "**选择来源列：**从下拉框里挑，选项就是你自己文件的表头。",
      "**预览几行：**先跑一小段，看看几行的结果，不满意就改描述。",
      "**处理整个文件并下载：**预览没问题之后处理整份文件，下载结果 —— 格式和你上传的一样。",
    ],
  },
};

const CTA = { en: "Use the tool now", zh: "现在就用这个工具" };

export function generateMetadata() {
  return localizedMetadata(PATH, COPY);
}

export default function Page() {
  const locale = serverLocale();
  return (
    <ToolLanding
      copy={COPY}
      tool={<CustomToolClient />}
      examples={[
        {
          heading: {
            en: "Example A — You have a long list of customer feedback and you want the key points of each one in a new column for easy analysis.",
            zh: "示例 A —— 你有一长串客户反馈，想把每条反馈的要点单独抽成一列，方便分析。",
          },
          target: { en: "key points", zh: "要点（key points）" },
          source: { en: "feedback", zh: "feedback（反馈）" },
          columns: ["feedback", "key points"],
          rows: [
            [
              "I absolutely loved my visit today! The staff was incredibly friendly and welcoming, the coffee was brewed perfectly, and the pastries were fresh and delicious. I will definitely be coming back and recommending this place to all my friends.",
              "positive staff, welcoming, perfect coffee, fresh pastries",
            ],
            [
              "The café was clean and well-maintained, which I appreciated. However, the drink I ordered was a bit too sweet for my taste, and the music was a little too loud to concentrate. It’s an okay place for a casual visit, but not my favorite.",
              "clean café, drink too sweet, music too loud",
            ],
            [
              "A nice location with comfortable seating and a relaxing vibe. The coffee was good and the menu offered a variety of interesting options. The only downside was that the line was a bit long during peak hours, but otherwise, it was a pleasant visit.",
              "comfortable seating, relaxing vibe, good coffee, long line",
            ],
            [
              "The coffee itself was decent, but the overall experience was not enjoyable. The café was extremely noisy, making it hard to relax or work. The staff seemed overwhelmed, and it took a long time to get my order. I hope they improve the environment and service.",
              "decent coffee, but noisy, overwhelmed staff, long wait",
            ],
          ],
        },
        {
          heading: {
            en: "Example B — You have a list of products where the SKU is buried in the product name column in no consistent format, and you need it in its own column.",
            zh: "示例 B —— 你有一份产品清单，SKU 混在产品名称列里，格式还不统一，需要把它单独抽成一列。",
          },
          target: { en: "SKU or model number", zh: "SKU 或型号" },
          source: { en: "product name", zh: "product name（产品名称）" },
          columns: ["product name", "SKU or model number"],
          rows: [
            ["Wireless Mouse SKU:WM-4839 Black Edition", "WM-4839"],
            ["Keyboard - Mechanical (KB_7721) RGB", "KB_7721"],
            ["USB-C Hub 6-in-1 [SKU HUB-991-A]", "HUB-991-A"],
            ["27in Monitor Dell UltraSharp U2720Q SKU#MN-2720", "MN-2720"],
          ],
        },
      ]}
    >
      {/* Bottom CTA: scroll back to the tool header */}
      <div className="pt-4 pb-2">
        <a
          href="#tool-top"
          title={CTA[locale]}
          className="inline-flex items-center gap-2 px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-sm"
        >
          {CTA[locale]}
        </a>
      </div>
    </ToolLanding>
  );
}
