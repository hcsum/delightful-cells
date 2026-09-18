import type { Metadata } from 'next'
import { serverLocale } from '@/lib/seo'

export function generateMetadata(): Metadata {
  const locale = serverLocale()
  const isJapanese = locale === 'ja'
  return {
    title: isJapanese ? '利用規約' : 'Terms of Service',
    description: isJapanese ? '本サービスの利用に適用される規約です。' : 'Terms governing the use of this service.',
    alternates: {
      canonical: isJapanese ? '/ja/terms' : '/terms',
      languages: { en: '/terms', ja: '/ja/terms' },
    },
  }
}

export default function TermsPage() {
  const today = new Date();
  const lastUpdated = today.toISOString().slice(0, 10); // YYYY-MM-DD
  const locale = serverLocale();
  if (locale === 'ja') {
    return <JapaneseTerms lastUpdated={lastUpdated} />
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Terms of Service</h1>
      <p className="text-subtle">Last updated: {lastUpdated}</p>
      {locale === 'zh' && (
        <p className="text-subtle text-sm">
          本服务条款仅有英文版本，英文版本为准。
        </p>
      )}

      <section className="space-y-2">
        <p>
          These Terms of Service ("Terms") govern your access to and use of the Excel CSV AI Extractor website,
          tools, and related services (collectively, the "Service"). By accessing or using the Service, you agree to
          be bound by these Terms. If you do not agree, do not use the Service.
        </p>
      </section>

      <hr className="border-t border-white/10" />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">1. Description of the Service</h2>
        <p>
          The Service allows users to upload Excel (.xlsx, .xls) or CSV files, or paste sample rows, select one
          or more columns, and use artificial intelligence models to extract structured information (for example, states
          from addresses or numbers from text). The Service may return a preview and/or a downloadable Excel or CSV file with
          additional extracted columns.
        </p>
        <p>The Service is provided on an "as-is" and "as-available" basis and may change over time.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">2. Data Handling and Privacy</h2>
        <h3 className="font-medium">2.1 No Data Storage</h3>
        <p>
          We do not store the files or data you upload. Uploaded spreadsheet data and pasted text are processed in memory only
          for the purpose of performing the requested extraction. Once processing is completed or the request ends, the
          data is automatically discarded.
        </p>
        <h3 className="font-medium">2.2 Use of Third-Party AI Providers</h3>
        <p>
          To perform extractions, your data is sent directly to a third-party large language model (LLM) hosted by a
          cloud infrastructure provider selected by us.
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Your data is used only to generate the requested output.</li>
          <li>We do not use your data to train our own models.</li>
          <li>We do not retain copies of your data after processing.</li>
        </ul>
        <p>
          By using the Service, you acknowledge and consent to this temporary processing by third-party AI and cloud
          infrastructure providers.
        </p>
        <h3 className="font-medium">2.3 No Sensitive Data</h3>
        <p>You agree not to upload or process:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Highly sensitive personal data (e.g., government IDs, health records, financial account numbers)</li>
          <li>Confidential or regulated data unless you have the legal right to do so</li>
        </ul>
        <p>The Service is intended for general-purpose data transformation tasks only.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">3. User Responsibilities</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>You have the right to upload and process the data you submit.</li>
          <li>You are responsible for verifying the accuracy of all outputs.</li>
          <li>You will not use the Service for unlawful, harmful, or abusive purposes.</li>
          <li>You will not attempt to reverse engineer, overload, or interfere with the Service.</li>
        </ul>
        <p>
          AI-generated outputs may contain errors. The Service is a productivity aid, not a substitute for human review.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">4. Limits and Fair Use</h2>
        <p>To ensure reliability and fair access, the Service enforces limits such as:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Maximum file size</li>
          <li>Maximum number of rows and columns</li>
          <li>Preview-only processing for sample rows</li>
        </ul>
        <p>These limits may change at any time without notice. Abuse may result in restricted access.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">5. Credits and Payment</h2>
        <h3 className="font-medium">5.1 What credits are</h3>
        <p>
          Some AI features are metered in "credits". Credits are a prepaid unit of account for
          usage of the Service. They are not money, not a stored-value instrument, and carry no
          cash value. Credits are consumed in proportion to the actual compute your requests use,
          so a small request costs a fraction of a credit and a large one costs more.
        </p>
        <h3 className="font-medium">5.2 One-time purchases</h3>
        <p>
          Credit packs are one-time purchases. There is no subscription and nothing renews
          automatically. Payments are processed by Stripe; we do not receive or store your card
          details. Prices are shown before checkout and are charged in the currency displayed.
        </p>
        <h3 className="font-medium">5.3 Expiry and transfer</h3>
        <p>
          Credits do not expire. They are tied to your account and may not be sold, transferred,
          or shared. If your account is terminated for a breach of these Terms, any remaining
          credits are forfeited.
        </p>
        <h3 className="font-medium">5.4 Refunds</h3>
        <p>
          If credits were charged in error, or a purchase failed to deliver credits to your
          balance, contact us via the website within 30 days of the purchase and we will refund
          the affected amount. We will also refund unused credits on request within 14 days of
          purchase. Credits already spent on completed AI requests are non-refundable, because
          the underlying compute has been consumed. Refunds are issued to the original payment
          method.
        </p>
        <h3 className="font-medium">5.5 Free allowance</h3>
        <p>
          The Service also offers a daily free allowance, which is separate from purchased
          credits and is always consumed first. The size of that allowance may change at any
          time. Purchased credits are only spent once the free allowance for the day is used up.
        </p>
        <h3 className="font-medium">5.6 Service interruption</h3>
        <p>
          The AI features depend on third-party infrastructure and may be unavailable, degraded,
          or rate limited at times. Purchased credits are not consumed by requests that fail, and
          an interruption does not entitle you to compensation beyond the refund of unspent
          credits described in 5.4. If we discontinue the paid features entirely, we will refund
          unspent credits.
        </p>
        <h3 className="font-medium">5.7 Price changes</h3>
        <p>
          We may change the price of credit packs or how many credits a request consumes at any
          time. Changes apply to future purchases and future usage only; credits already in your
          balance keep the amount of usage they were sold as.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">6. Intellectual Property</h2>
        <p>
          All rights, title, and interest in the Service, including its design, software, and branding, are owned by us
          or our licensors. You retain all rights to the data you upload. We claim no ownership over your content.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">7. Disclaimer of Warranties</h2>
        <p>
          THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
          INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
          NON-INFRINGEMENT.
        </p>
        <p>We do not guarantee that:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>The Service will be uninterrupted or error-free</li>
          <li>The extracted results will be complete, accurate, or suitable for any specific purpose</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">8. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, consequential, or
          special damages, including loss of data, loss of profits, or business interruption, arising out of or related
          to your use of the Service. Your sole remedy for dissatisfaction with the Service is to stop using it.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">9. Termination</h2>
        <p>
          We may suspend or terminate your access to the Service at any time, with or without notice, if we believe you
          have violated these Terms or used the Service in a way that may cause harm or legal risk.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">10. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. Any changes will be effective when posted on this page. Your
          continued use of the Service after changes are posted constitutes acceptance of the updated Terms.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">11. Governing Law</h2>
        <p>
          These Terms are governed by and construed in accordance with the laws of the applicable jurisdiction, without
          regard to conflict of law principles.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">12. Contact</h2>
        <p>If you have questions about these Terms, please contact us via the website.</p>
      </section>
    </div>
  );
}

function JapaneseTerms({ lastUpdated }: { lastUpdated: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">利用規約</h1>
      <p className="text-subtle">最終更新日: {lastUpdated}</p>
      <p className="text-subtle text-sm">
        本規約は英語版を正文とし、日本語版との間に相違がある場合は英語版が優先されます。
      </p>

      <section className="space-y-2">
        <p>
          本利用規約（以下「本規約」といいます）は、Excel CSV AI Extractor のウェブサイト、ツール、および関連サービス（総称して「本サービス」といいます）へのアクセスおよび利用に適用されます。本サービスにアクセスまたは利用することにより、利用者は本規約に同意したものとみなされます。本規約に同意しない場合は、本サービスを利用しないでください。
        </p>
      </section>

      <hr className="border-t border-white/10" />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">1. 本サービスの内容</h2>
        <p>
          本サービスでは、Excel（.xlsx、.xls）ファイルまたは CSV ファイルをアップロードするか、サンプル行を貼り付け、1つ以上の列を選択して、人工知能モデルにより構造化された情報（住所から州、テキストから数値など）を抽出できます。本サービスでは、結果のプレビューや、抽出した列を追加したExcelまたはCSVファイルを提供する場合があります。
        </p>
        <p>本サービスは「現状有姿」かつ「提供可能な範囲」で提供され、その内容は今後変更される場合があります。</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">2. データの取扱いとプライバシー</h2>
        <h3 className="font-medium">2.1 データの保存</h3>
        <p>
          当社は、利用者がアップロードしたファイルまたはデータを保存しません。アップロードされた表計算データおよび貼り付けられたテキストは、依頼された抽出処理を行う目的に限り、メモリ上で処理されます。処理が完了するか、リクエストが終了すると、データは自動的に破棄されます。
        </p>
        <h3 className="font-medium">2.2 外部AIサービスの利用</h3>
        <p>
          抽出処理を行うため、利用者のデータは、当社が選定したクラウドインフラストラクチャプロバイダー上で稼働する第三者の大規模言語モデル（LLM）へ直接送信されます。
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>利用者のデータは、依頼された出力を生成する目的にのみ使用されます。</li>
          <li>当社独自のモデルの学習に利用者のデータを使用することはありません。</li>
          <li>処理後に利用者のデータの複製を保持することはありません。</li>
        </ul>
        <p>
          本サービスを利用することにより、利用者は、外部のAIサービスおよびクラウド事業者によってデータが一時的に処理されることを確認し、これに同意するものとします。
        </p>
        <h3 className="font-medium">2.3 機微情報の取扱い禁止</h3>
        <p>利用者は、以下のデータをアップロードまたは処理しないことに同意するものとします。</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>特に機微性の高い個人データ（政府発行の身分証明書、医療記録、金融口座番号など）</li>
          <li>取り扱う法的権利を有しない機密データまたは規制対象データ</li>
        </ul>
        <p>本サービスは、一般的なデータ変換作業のみを目的としています。</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">3. 利用者の責任</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>利用者は、提出するデータをアップロードし、処理する権利を有していること。</li>
          <li>すべての出力の正確性を確認する責任は利用者が負うこと。</li>
          <li>違法、有害、または不正な目的で本サービスを利用しないこと。</li>
          <li>本サービスのリバースエンジニアリングを行ったり、過剰な負荷をかけたり、運用を妨害したりしないこと。</li>
        </ul>
        <p>AI が生成する出力には誤りが含まれる場合があります。本サービスは生産性向上のための補助ツールであり、人による確認に代わるものではありません。</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">4. 利用制限と適正利用</h2>
        <p>信頼性と公平なアクセスを確保するため、本サービスには以下のような制限が設けられています。</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>ファイルサイズの上限</li>
          <li>行数および列数の上限</li>
          <li>サンプル行についてはプレビューのみの処理</li>
        </ul>
        <p>これらの制限は、予告なく随時変更される場合があります。不正利用があった場合、アクセスが制限されることがあります。</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">5. クレジットと支払い</h2>
        <h3 className="font-medium">5.1 クレジットとは</h3>
        <p>
          一部の AI 機能は「クレジット」を単位として計測されます。クレジットは、本サービスの利用量を管理するための前払い単位です。通貨でも前払式支払手段でもなく、換金価値もありません。クレジットは、リクエストが実際に使用した計算資源に応じて消費されるため、小規模なリクエストでは1クレジット未満、大規模なリクエストではより多くのクレジットが消費されます。
        </p>
        <h3 className="font-medium">5.2 都度購入</h3>
        <p>
          クレジットパックは1回限りの購入で、定期購入ではありません。自動更新もありません。支払いは Stripe によって処理され、当社がカード情報を受領または保存することはありません。価格は決済前に表示され、表示された通貨で請求されます。
        </p>
        <h3 className="font-medium">5.3 有効期限と譲渡</h3>
        <p>
          クレジットに有効期限はありません。クレジットは利用者のアカウントに紐付けられ、販売、譲渡、または共有することはできません。本規約への違反を理由にアカウントが停止または削除された場合、残存するクレジットは失効します。
        </p>
        <h3 className="font-medium">5.4 返金</h3>
        <p>
          クレジット購入代金が誤って請求された場合、または購入したクレジットが残高に反映されなかった場合は、購入日から30日以内にウェブサイトを通じて当社にご連絡ください。該当額を返金します。また、購入日から14日以内に申し出があった場合は、未使用のクレジットを返金します。完了済みの AI リクエストに使用されたクレジットについては、基礎となる計算資源がすでに消費されているため、返金できません。返金は、購入時に使用された支払方法に対して行われます。
        </p>
        <h3 className="font-medium">5.5 無料利用枠</h3>
        <p>
          本サービスでは、購入済みクレジットとは別に、毎日の無料利用枠も提供しており、無料利用枠が常に先に消費されます。無料利用枠の上限は随時変更される場合があります。購入済みクレジットは、その日の無料利用枠を使い切った後にのみ消費されます。
        </p>
        <h3 className="font-medium">5.6 サービスの中断</h3>
        <p>
          AI 機能は第三者のインフラストラクチャに依存しているため、利用できなくなったり、動作が不安定になったり、利用回数が制限されたりする場合があります。失敗したリクエストについて購入済みクレジットが消費されることはありません。また、サービスの中断によって、第5.4項に定める未使用クレジットの返金を超える補償を受ける権利が生じることはありません。当社が有料機能を全面的に終了する場合は、未使用のクレジットを返金します。
        </p>
        <h3 className="font-medium">5.7 価格の変更</h3>
        <p>
          当社は、クレジットパックの価格またはリクエストごとのクレジット消費量を随時変更することがあります。変更は、将来の購入および将来の利用にのみ適用されます。残高にあるクレジットについては、販売時に設定された利用可能量が維持されます。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">6. 知的財産権</h2>
        <p>
          デザイン、ソフトウェア、およびブランドを含む本サービスに関するすべての権利、権原、および利益は、当社または当社のライセンサーに帰属します。利用者は、アップロードしたデータに関するすべての権利を保持します。当社が利用者のコンテンツについて所有権を主張することはありません。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">7. 保証の否認</h2>
        <p>
          本サービスは「現状有姿」かつ「提供可能な範囲」で提供され、明示または黙示を問わず、商品性、特定目的への適合性、および第三者の権利を侵害しないことに関する保証を含む一切の保証を行いません。
        </p>
        <p>当社は、以下の事項を保証しません。</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>本サービスが中断なく、かつエラーなしで提供されること</li>
          <li>抽出結果が完全、正確、または特定の目的に適していること</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">8. 責任の制限</h2>
        <p>
          法令で認められる最大限の範囲において、当社は、本サービスの利用に起因または関連して生じる、データの喪失、利益の喪失、または事業の中断を含む、間接的、付随的、結果的、または特別な損害について責任を負いません。本サービスに不満がある場合に利用者が取り得る唯一の救済手段は、本サービスの利用を中止することです。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">9. 利用停止および終了</h2>
        <p>
          当社は、利用者が本規約に違反した、または損害もしくは法的リスクを生じさせるおそれのある形で本サービスを利用したと判断した場合、通知の有無を問わず、いつでも本サービスへのアクセスを停止または終了することができます。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">10. 本規約の変更</h2>
        <p>
          当社は、本規約を随時更新することがあります。変更は、このページに掲載された時点で効力を生じます。変更の掲載後も本サービスの利用を継続した場合、利用者は更新後の本規約に同意したものとみなされます。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">11. 準拠法</h2>
        <p>
          本規約は、法の抵触に関する原則にかかわらず、適用される法域の法律に準拠し、これに従って解釈されます。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">12. お問い合わせ</h2>
        <p>本規約に関するご質問は、ウェブサイトを通じて当社にお問い合わせください。</p>
      </section>
    </div>
  )
}
