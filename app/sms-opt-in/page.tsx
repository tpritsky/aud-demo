import type { Metadata } from 'next'
import Link from 'next/link'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vocalis.team'

export const metadata: Metadata = {
  title: 'SMS opt-in & consent',
  description:
    'How patients opt in to receive informational text messages from Vocalis-powered practices—mobile web and QR code flows for toll-free messaging verification.',
}

export default function SmsOptInProofPage() {
  return (
    <div className="min-h-screen bg-zinc-50/80">
      <article className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <p className="mb-6">
          <Link href="/" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
            ← Vocalis home
          </Link>
        </p>

        <header className="mb-10 border-b border-zinc-200 pb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Toll-free messaging — proof of consent
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            SMS opt-in & consent (mobile web & QR code)
          </h1>
          <p className="mt-3 text-lg font-medium text-muted-foreground">
            This page documents how recipients explicitly agree to receive informational SMS from our clinic and practice
            customers before any promotional or recurring texts are sent.
          </p>
        </header>

        <div className="space-y-10 text-base leading-relaxed text-muted-foreground">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">How consent is collected</h2>
            <p className="text-foreground">
              Opt-in uses a <span className="font-semibold">mobile-friendly web page</span> shown to the patient on
              their own device. Practices may display a <span className="font-semibold">QR code</span> in the office (or
              share a link by email) that opens this same opt-in experience. Consent is not bundled with unrelated
              agreements: the user must take a clear, affirmative action (submit the form with the consent box checked).
            </p>
            <ol className="list-decimal space-y-2 pl-5 text-foreground">
              <li>
                The patient opens the opt-in URL on their phone—by scanning a QR code, tapping a link, or typing the
                address shown on in-office signage.
              </li>
              <li>They enter the mobile number that should receive messages (or confirm a pre-filled number).</li>
              <li>
                They read the disclosure (message purpose, frequency, carrier costs, and opt-out) and check the consent
                box.
              </li>
              <li>They tap <span className="font-semibold">Subscribe</span> to submit. Without that action, no SMS consent is recorded.</li>
            </ol>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Representative opt-in screen</h2>
            <p>
              The layout below mirrors what a patient sees when opting in—the same elements appear on the live form used
              with each practice&apos;s branding and toll-free or local sender number.
            </p>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="mx-auto max-w-sm rounded-xl border border-zinc-300 bg-zinc-50 p-4 shadow-inner">
                <p className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Sample — patient phone
                </p>
                <p className="mt-3 text-center text-lg font-bold text-foreground">Text updates from your clinic</p>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  Appointment reminders and important notices by SMS.
                </p>

                <label className="mt-6 block text-sm font-medium text-foreground">
                  Mobile number
                  <input
                    type="tel"
                    readOnly
                    placeholder="(555) 555-0100"
                    className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-foreground outline-none"
                    aria-hidden
                  />
                </label>

                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-sm text-foreground">
                  <label className="flex cursor-default gap-3">
                    <input type="checkbox" checked readOnly className="mt-1 size-4 shrink-0 rounded border-zinc-400" />
                    <span>
                      I consent to receive automated informational text messages from{' '}
                      <span className="font-semibold">[Practice name]</span> at the number provided, including appointment
                      reminders and operational notices. Message frequency varies. Message and data rates may apply. I can
                      text <span className="font-mono font-semibold">STOP</span> to cancel or{' '}
                      <span className="font-mono font-semibold">HELP</span> for help. I agree to the{' '}
                      <span className="underline">Terms</span> and have read the <span className="underline">Privacy Policy</span>.
                      Consent is not a condition of purchase.
                    </span>
                  </label>
                </div>

                <button
                  type="button"
                  disabled
                  className="mt-5 w-full rounded-lg bg-emerald-600 py-3 text-center text-sm font-semibold text-white opacity-90"
                >
                  Subscribe to texts
                </button>

                <p className="mt-4 text-center text-xs text-zinc-500">
                  QR in office opens this page · Link may also be sent after a phone call or visit
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-xl font-bold text-foreground">Opt-out and help</h2>
            <p>
              Recipients may opt out at any time by replying <span className="font-mono font-semibold text-foreground">STOP</span>{' '}
              to any message. Reply <span className="font-mono font-semibold text-foreground">HELP</span> for assistance.
              Practices honor opt-outs immediately in accordance with carrier and applicable rules.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">URL for verification forms</h2>
            <p>
              Use this page as the &quot;Proof of consent (opt-in) collected&quot; link when your opt-in type is{' '}
              <span className="font-semibold text-foreground">Mobile / QR Code</span>:
            </p>
            <p>
              <code className="break-all rounded bg-zinc-100 px-2 py-1 font-mono text-sm text-foreground">
                {siteUrl.replace(/\/$/, '')}/sms-opt-in
              </code>
            </p>
          </section>

          <section className="space-y-2 text-sm text-zinc-500">
            <p>
              Vocalis provides software for healthcare and service businesses. Individual practices are responsible
              for their own messaging policies and for capturing consent in line with this documentation.
            </p>
            <p>
              Questions:{' '}
              <a href="mailto:support@vocalis.team" className="font-semibold text-emerald-700 hover:text-emerald-800">
                support@vocalis.team
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </div>
  )
}
