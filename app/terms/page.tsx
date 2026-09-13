import type { Metadata } from 'next'
import { serverLocale } from '@/lib/seo'

// English is the governing version of these Terms, so there is no Chinese
// translation to point a hreflang at. Both URLs canonicalize here instead,
// which is also what keeps /zh/terms from reading as duplicate content.
export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms governing the use of this service.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  const today = new Date();
  const lastUpdated = today.toISOString().slice(0, 10); // YYYY-MM-DD
  const locale = serverLocale();
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

