import Link from "next/link";
import { localizePath } from "@/lib/locale-routing";
import type { LandingExample } from "@/components/ToolLanding";

export type JapaneseTask = "city" | "prefecture" | "givenName" | "surname";

export const JAPANESE_EXTRACTION = {
  city: {
    target: "市区町村名",
    source: "住所",
    instructions: "日本の住所から市区町村名だけを原文の表記で抽出する。政令指定都市は市と区を両方残す（横浜市中区）。東京都の特別区は区名だけ（新宿区）。郡がある町村は郡名も残す（虻田郡倶知安町）。都道府県、郵便番号、町名、番地、建物名は含めない。省略された地名は推測で補わず、判別できない場合はnullを返す。",
    rows: [
      ["東京都新宿区西新宿2丁目8番1号", "新宿区"],
      ["神奈川県横浜市中区日本大通1", "横浜市中区"],
      ["大阪府大阪市北区中之島1丁目3番20号", "大阪市北区"],
      ["北海道虻田郡倶知安町北1条東3丁目3番地", "虻田郡倶知安町"],
    ],
  },
  prefecture: {
    target: "都道府県名",
    source: "住所",
    instructions: "日本の住所に明記された都道府県名だけを都・道・府・県を含む正式な表記で抽出する。市区町村、郵便番号、番地は含めない。都道府県が省略されている場合、都市名や郵便番号から推測せずnullを返す。",
    rows: [
      ["東京都新宿区西新宿2丁目8番1号", "東京都"],
      ["北海道札幌市中央区北1条西2丁目", "北海道"],
      ["大阪府大阪市北区中之島1丁目3番20号", "大阪府"],
      ["神奈川県横浜市中区日本大通1", "神奈川県"],
      ["新宿区西新宿2丁目8番1号", "null"],
    ],
  },
  givenName: {
    target: "名",
    source: "氏名",
    instructions: "日本語の氏名を姓・名の順として扱い、名だけを原文の表記で抽出する。半角・全角スペースを区切りとして扱う。スペースなしでは姓と名の境界を判断できる場合だけ抽出し、複数の解釈が可能なら推測せずnullを返す。敬称は含めない。",
    rows: [["山田 太郎", "太郎"], ["佐藤　花子", "花子"], ["鈴木 一郎", "一郎"], ["高橋 美咲", "美咲"]],
  },
  surname: {
    target: "姓",
    source: "氏名",
    instructions: "日本語の氏名を姓・名の順として扱い、姓だけを原文の表記で抽出する。半角・全角スペースを区切りとして扱う。スペースなしでは姓と名の境界を判断できる場合だけ抽出し、複数の解釈が可能なら推測せずnullを返す。敬称は含めない。",
    rows: [["山田 太郎", "山田"], ["佐藤　花子", "佐藤"], ["鈴木 一郎", "鈴木"], ["高橋 美咲", "高橋"]],
  },
};

export function japaneseExample(task: JapaneseTask): LandingExample[] {
  const c = JAPANESE_EXTRACTION[task];
  const heading = `例 — ${c.source}から${c.target}を抽出`;
  return [{
    heading: { en: heading, zh: heading, ja: heading },
    target: { en: c.target, zh: c.target, ja: c.target },
    source: { en: c.source, zh: c.source, ja: c.source },
    columns: [c.source, c.target],
    rows: c.rows,
  }];
}

export function JapaneseExtractionGuide({ task }: { task: JapaneseTask }) {
  const address = task === "city" || task === "prefecture";
  return (
    <section className="space-y-4 pt-8">
      <h2 className="text-xl font-semibold">{address ? "Excelの住所分割：都道府県・市区町村を分ける" : "Excelの氏名を姓と名に分割するには"}</h2>
      <p>{address
        ? "このツールは選択した住所列から1項目を抽出し、新しい列に追加します。都道府県と市区町村を別々の列に分けるには、まず一方を抽出してダウンロードし、そのファイルをもう一度アップロードして元の住所列からもう一方を抽出します。町名・番地・建物名の分割は別の抽出対象として指定する必要があります。"
        : "日本の氏名は姓が先、名が後の順で扱います。半角スペースの「山田 太郎」と全角スペースの「佐藤　花子」の両方を想定しています。姓と名を別々の列にするには、まず一方を抽出してダウンロードし、そのファイルの元の氏名列からもう一方を抽出します。"}</p>
      <h3 className="text-lg font-medium">{address ? "複雑な住所・省略された住所の注意点" : "スペースなしの名前は分割できますか？"}</h3>
      <p>{address
        ? "市区町村の出力は、東京都なら「新宿区」、政令指定都市なら「横浜市中区」、郡を含む町村なら「虻田郡倶知安町」の形式です。都道府県が書かれていない住所から都道府県を推測する設定にはしていません。郵便番号や建物名だけの行、地名を判別できない行はnullになります。AIの結果は住所データベースによる照合ではないため、必ずプレビューとダウンロード後の確認を行ってください。"
        : "スペースなしの「山田太郎」のような氏名はAIが境界を判断しますが、同じ文字列でも姓と名の分け方が複数ある場合があります。文字数だけで分割すると誤りになるため、曖昧な場合はnullを返すよう指示しています。AIが誤って確信する可能性もあるので、正確さが必要な名簿は既存の姓・名データや本人情報と照合してください。外国語の氏名や名・姓の順が混在する列では、抽出対象の指示を変更してください。"}</p>
      <nav aria-label="関連ツール" className="flex flex-wrap gap-4 underline">
        {address ? <>
          <Link href={localizePath("/extract-state-from-address-excel", "ja")}>住所から都道府県を抽出</Link>
          <Link href={localizePath("/extract-city-from-address-excel", "ja")}>住所から市区町村を抽出</Link>
          <Link href={localizePath("/extract-zip-from-address-excel", "ja")}>住所から郵便番号を抽出</Link>
        </> : <>
          <Link href={localizePath("/extract-last-name-from-full-name-excel", "ja")}>氏名から姓を抽出</Link>
          <Link href={localizePath("/extract-first-name-from-full-name-excel", "ja")}>氏名から名を抽出</Link>
        </>}
      </nav>
    </section>
  );
}
