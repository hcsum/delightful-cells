const EXAMPLE_ROWS = [
  ["SKU-001", "SKU-003", "True", "", ""],
  ["SKU-002", "SKU-002", "True", "", "True"],
  ["SKU-003", "SKU-001", "True", "", ""],
  ["SKU-004", "SKU-005", "", "True", ""],
  ["SKU-002", "", "True", "", ""],
  ["", "", "", "True", ""],
];

const FORMULAS = [
  {
    title: "A列にあってB列にない値を見つける（COUNTIF）",
    code: '=IF(A2="","",IF(COUNTIF($B$2:$B$5,A2)=0,"B列にない",""))',
    explanation:
      "D2に入力し、D7までコピーします。B列全体の検索範囲を$で固定するので、並び順が違っても照合できます。この例ではSKU-004だけが「B列にない」になります。A列の空白はIFで除外しています。",
  },
  {
    title: "2つの列の両方にある値を見つける（COUNTIF）",
    code: '=IF(A2="","",IF(COUNTIF($B$2:$B$5,A2)>0,"両方にある",""))',
    explanation:
      "別の結果列の2行目に入力し、7行目までコピーします。SKU-001、SKU-002、SKU-003が対象です。A列にSKU-002が2回ある場合は、どちらの行にも印が付きます。重複行を削除する処理ではありません。",
  },
  {
    title: "同じ行で一致しない値を見つける（IF）",
    code: '=IF(A2=B2,"一致","不一致")',
    explanation:
      "別の結果列の2行目に入力し、7行目までコピーします。同じ行のA列とB列を比較するため、リスト全体に同じ値があっても、行が違えば「不一致」です。両方空白の行は「一致」になります。大文字・小文字も区別する場合は、条件をEXACT(A2,B2)に置き換えます。",
  },
];

export default function JapaneseComparisonGuide() {
  return (
    <>
      <section className="space-y-4" aria-labelledby="comparison-modes">
        <h2 id="comparison-modes" className="text-xl font-semibold">
          並び順が違うリストと、同じ行の比較を使い分ける
        </h2>
        <p className="max-w-3xl text-white/80">
          例えばA列が入荷した商品コード、B列が商品マスターの場合、マスター未登録の商品を探すには「比較先にない値」を選びます。
          申込者名簿と受付リストの共通IDを探すなら「両方にある値」、更新前後の価格を同じ商品順で照合するなら「同じ行で一致する値」を使います。
        </p>
        <ul className="list-disc pl-5 space-y-2 text-white/80">
          <li>
            両方にある値：A列の値をB列全体から検索。並び順・リストの長さが違っても使えます。
          </li>
          <li>
            比較先にない値：A列の値がB列全体にないときにマーク。B列にだけある値を探すには列の選択を逆にします。
          </li>
          <li>
            同じ行で一致する値：A2とB2、A3とB3を比較。順番をそろえたリスト向けです。
          </li>
        </ul>
        <h3 className="text-lg font-medium">
          商品コードの照合例と実際の結果マーク
        </h3>
        <p className="max-w-3xl text-white/80">
          1行目は見出し、A2:A7が入荷リスト、B2:B5が商品マスターです。下の3つの結果列は各モードを別々に実行した結果を並べたものです。
          1回のダウンロードで追加される結果列は1列で、該当行に文字列Trueが入り、該当しない行は空欄になります。
        </p>
        <div className="overflow-auto">
          <table className="w-full text-sm border-collapse">
            <caption className="text-left text-white/60 pb-2">
              空欄のセルは値なし。最終行は別の列にメモがあり、読み込み後も残る行を想定しています。
            </caption>
            <thead>
              <tr className="text-left">
                {[
                  "Excel行",
                  "A：入荷商品コード",
                  "B：マスター商品コード",
                  "両方にある値",
                  "比較先にない値",
                  "同じ行で一致する値",
                ].map((label) => (
                  <th
                    key={label}
                    className="border-b border-white/10 py-2 pr-4 whitespace-nowrap"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EXAMPLE_ROWS.map((row, i) => (
                <tr key={i}>
                  {[String(i + 2), ...row].map((value, j) => (
                    <td key={j} className="border-b border-white/10 py-2 pr-4">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="max-w-3xl text-white/80">
          SKU-001とSKU-003は別の行にあるため、両方のリストにあっても「同じ行で一致する値」ではマークされません。
          A列の空白は「比較先にない値」でTrueになる仕様です。結果を確認するときは、A列が空白の行を除外してください。
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="comparison-formulas">
        <h2 id="comparison-formulas" className="text-xl font-semibold">
          Excelの関数で2つの列を比較する方法
        </h2>
        <p className="max-w-3xl text-white/80">
          上の商品コード例を使います。実際の表では検索範囲の$B$2:$B$5とコピー先の最終行を自分のデータに合わせて変更してください。
          元データを上書きせず、D列以降の空いている列に式を入力します。
        </p>
        {FORMULAS.map((formula) => (
          <article key={formula.title} className="space-y-2">
            <h3 className="text-lg font-medium">{formula.title}</h3>
            <pre className="overflow-x-auto rounded border border-white/10 p-3 text-sm">
              <code>{formula.code}</code>
            </pre>
            <p className="max-w-3xl text-white/80">{formula.explanation}</p>
          </article>
        ))}
        <p className="max-w-3xl text-sm text-white/70">
          COUNTIFは大文字・小文字を区別せず、*と?をワイルドカードとして扱います。この式はそうした記号のない商品コードを想定しています。
          文字列の前後に余分な空白がある場合は、関数で照合する前にデータを整えてください。ツールは前後の空白を取り除き、*と?も通常の文字として比較するため、条件によって関数と結果が異なります。
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="comparison-no-formula">
        <h2 id="comparison-no-formula" className="text-xl font-semibold">
          関数なしで比較して、結果をダウンロードする方法
        </h2>
        <p className="max-w-3xl text-white/80">
          このページ上部のツールでExcel・CSVをアップロードし、比較元に「入荷商品コード」、比較先に「マスター商品コード」を選択します。
          未登録商品を調べる場合は「比較先にない値」を選び、「処理して Excel
          をダウンロード」（CSVの場合は「処理して CSV
          をダウンロード」）を押します。
          結果列の見出しはmissing_items_入荷商品コード_マスター商品コードです。
        </p>
        <p className="max-w-3xl text-white/80">
          ダウンロード後にExcelの［データ］→［フィルター］を使い、結果列をTrue、入荷商品コードを空白以外に絞ると、SKU-004を確認できます。
          ツール自体は該当行だけの抽出や削除を行いません。同じ行で一致しない値を確認したい場合は「同じ行で一致する値」で処理し、結果列が空欄の行を確認してください。両方空白の行も結果が空欄になります。
        </p>
        <p className="max-w-3xl text-sm text-white/70">
          この比較処理はブラウザ内で完結します。出力は選択したシートのデータと結果列のみです。元ファイルは変更されませんが、出力に他のシート・数式・元の書式は保持されません。
        </p>
      </section>
    </>
  );
}
