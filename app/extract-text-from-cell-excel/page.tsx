import CustomToolClient from "@/components/CustomToolClient";
import { DAILY_ROWS_LIMIT } from "@/lib/limits";
import QuotaBanner from "@/components/QuotaBanner";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Extract Text from Cell (Excel CSV Extraction Tool)",
  description:
    "Describe what to extract and select the source column. Preview a few sample rows to check the result, or process the full file right away.",
};

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 id="extract-text-top" className="text-2xl font-semibold">
        Extract Text from Cell
      </h1>
      <p className="text-white/80 max-w-2xl text-muted">
        Describe what to extract and select the source column. Preview a few
        sample rows to check the result, or process the full file right away.
      </p>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <QuotaBanner />
        </div>
        <p className="text-white/60 max-w-2xl text-sm">
          Note: Daily usage is temporarily limited to {DAILY_ROWS_LIMIT} rows
          per day.
        </p>
      </div>
      <CustomToolClient />

      {/* Usage guide moved from Tutorial and updated to reflect current behavior (no paste-to-preview) */}
      <div className="space-y-8 pt-12">
        <hr />
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How to Use This Tool</h2>
          <ol className="list-decimal pl-6 space-y-2 text-white/80">
            <li>
              <strong>Upload CSV:</strong> Select the CSV file so the tool can
              read your headers and data.
            </li>
            <li>
              <strong>Define the Target:</strong> Describe what do you want to
              extract in plain English (for example, "Feedback Summery", "SKU",
              "Model").
            </li>
            <li>
              <strong>Choose the Source column:</strong> Type the column that
              contains the text you want to extract from.
            </li>
            <li>
              <strong>Preview sample rows:</strong> Run a short preview to check
              the output on a handful of rows and adjust the description if
              needed.
            </li>
            <li>
              <strong>Process full file and download results:</strong> When you
              are happy with the preview, process the full CSV and download the
              result.
            </li>
            <li>
              <strong>
                Export the CSV back to Excel or copy the extracted column into
                your original file
              </strong>
              , your choice.
            </li>
          </ol>
        </section>

        {/* Examples */}
        <h2 className="text-xl font-semibold">Examples</h2>
        <section className="space-y-12">
          {/* Example A */}
          <article className="space-y-3">
            <h3 className="text-lg font-medium">
              Example A - You have a long list of customer feedbacks and you
              want to extract the key points of each feedback into a new column
              for easy analysis.
            </h3>
            <ul className="text-white/80 text-sm space-y-1">
              <li>
                <strong>Target:</strong> key points
              </li>
              <li>
                <strong>Source:</strong> feedback
              </li>
            </ul>
            <div className="space-y-2">
              <div>Expected output:</div>
              <div className="overflow-auto">
                <table className="mt-1 w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left">
                      <th className="border-b border-white/10 py-1 pr-4">
                        feedback
                      </th>
                      <th className="border-b border-white/10 py-1">
                        key points
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="align-top pr-4 py-1">
                        I absolutely loved my visit today! The staff was
                        incredibly friendly and welcoming, the coffee was brewed
                        perfectly, and the pastries were fresh and delicious. I
                        will definitely be coming back and recommending this
                        place to all my friends.
                      </td>
                      <td className="align-top py-1">
                        positive staff, welcoming, perfect coffee, fresh
                        pastries
                      </td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">
                        The café was clean and well-maintained, which I
                        appreciated. However, the drink I ordered was a bit too
                        sweet for my taste, and the music was a little too loud
                        to concentrate. It’s an okay place for a casual visit,
                        but not my favorite.
                      </td>
                      <td className="align-top py-1">
                        clean café, drink too sweet, music too loud
                      </td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">
                        A nice location with comfortable seating and a relaxing
                        vibe. The coffee was good and the menu offered a variety
                        of interesting options. The only downside was that the
                        line was a bit long during peak hours, but otherwise, it
                        was a pleasant visit.
                      </td>
                      <td className="align-top py-1">
                        comfortable seating, relaxing vibe, good coffee, long
                        line
                      </td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">
                        The coffee itself was decent, but the overall experience
                        was not enjoyable. The café was extremely noisy, making
                        it hard to relax or work. The staff seemed overwhelmed,
                        and it took a long time to get my order. I hope they
                        improve the environment and service.
                      </td>
                      <td className="align-top py-1">
                        decent coffee, but noisy, overwhelmed staff, long wait
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </article>

          {/* Example B */}
          <article className="space-y-3">
            <h3 className="text-lg font-medium">
              Example B - You are given a list of product information. The SKU
              of each product is mixed into the product name column, and the
              format is not consistent. and you need to extract them into their
              own SKU column.
            </h3>
            <ul className="text-white/80 text-sm space-y-1">
              <li>
                <strong>Target:</strong> SKU or model number
              </li>
              <li>
                <strong>Source:</strong> product name
              </li>
            </ul>
            <div className="space-y-2">
              <div>Expected output:</div>
              <div className="overflow-auto">
                <table className="mt-1 w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left">
                      <th className="border-b border-white/10 py-1 pr-4">
                        product name
                      </th>
                      <th className="border-b border-white/10 py-1">
                        SKU or model number
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="align-top pr-4 py-1">
                        Wireless Mouse SKU:WM-4839 Black Edition
                      </td>
                      <td className="align-top py-1">WM-4839</td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">
                        Keyboard - Mechanical (KB_7721) RGB
                      </td>
                      <td className="align-top py-1">KB_7721</td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">
                        USB-C Hub 6-in-1 [SKU HUB-991-A]
                      </td>
                      <td className="align-top py-1">HUB-991-A</td>
                    </tr>
                    <tr>
                      <td className="align-top pr-4 py-1">
                        27in Monitor Dell UltraSharp U2720Q SKU#MN-2720
                      </td>
                      <td className="align-top py-1">MN-2720</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </article>
        </section>
      </div>

      {/* Bottom CTA: scroll back to the tool header */}
      <div className="pt-4 pb-2">
        <a
          href="#extract-text-top"
          title="Use the tool now"
          className="inline-flex items-center gap-2 px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-sm"
        >
          Use the tool now
        </a>
      </div>
    </div>
  );
}
