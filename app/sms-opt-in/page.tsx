import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'SMS keyword opt-in',
  description:
    'Public documentation of text-to-join (keyword) consent for informational SMS from Vocalis-powered practices.',
}

export default function SmsKeywordOptInPage() {
  return (
    <div className="min-h-screen bg-zinc-50/80">
      <article className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <p className="mb-6">
          <Link href="/" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
            ← Vocalis home
          </Link>
        </p>

        <header className="mb-10 border-b border-zinc-200 pb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            SMS keyword opt-in
          </h1>
          <p className="mt-3 text-lg font-medium text-muted-foreground">
            Patients join by texting a keyword to the practice&apos;s messaging number after reading the disclosure below
            (or the same language on in-office signage, intake materials, or the practice&apos;s own website).
          </p>
        </header>

        <div className="space-y-10 text-base leading-relaxed text-muted-foreground">
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Call to action</h2>
            <p className="text-foreground">
              Consent is collected when the patient sends the keyword from their mobile phone. Before texting, they see the
              full disclosure—included on this page and mirrored wherever the practice promotes the program (front desk sign,
              visit summary, practice site, etc.).
            </p>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 text-foreground shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Text to join</p>
              <p className="mt-4 text-lg font-bold leading-snug">
                Text <span className="font-mono text-emerald-900">START</span> to{' '}
                <span className="whitespace-nowrap font-mono text-emerald-900">[your toll-free number]</span>
              </p>
              <p className="mt-4 text-sm leading-relaxed">
                to receive automated informational messages from <span className="font-semibold">[Practice name]</span>,
                including appointment reminders and operational notices. Message frequency varies. Message and data rates may
                apply. Reply <span className="font-mono font-semibold">STOP</span> to cancel;{' '}
                <span className="font-mono font-semibold">HELP</span> for help. Consent is not a condition of purchase.
                See the practice&apos;s privacy policy and terms where linked on their website or at the office.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">How consent works</h2>
            <ol className="list-decimal space-y-2 pl-5 text-foreground">
              <li>The patient reads the disclosure (this page or equivalent materials).</li>
              <li>
                From their mobile phone, they send the keyword <span className="font-mono font-semibold">START</span> (or the
                keyword the practice assigns) to the verified toll-free number used for that practice&apos;s messages.
              </li>
              <li>
                They receive an automated reply confirming enrollment; that message repeats how to opt out (
                <span className="font-mono font-semibold">STOP</span>) and get help (<span className="font-mono font-semibold">HELP</span>
                ).
              </li>
            </ol>
            <p>
              Programs that use a second confirmation step (e.g. &quot;Reply YES to confirm&quot;) document that step in the
              same way and include it in the welcome message flow.
            </p>
          </section>

          <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-xl font-bold text-foreground">Opt-out and help</h2>
            <p>
              Recipients may opt out at any time by replying{' '}
              <span className="font-mono font-semibold text-foreground">STOP</span> to any message. Reply{' '}
              <span className="font-mono font-semibold text-foreground">HELP</span> for assistance. Practices honor opt-outs in
              line with carrier and applicable rules.
            </p>
          </section>

          <section className="space-y-2 text-sm text-zinc-500">
            <p>
              Vocalis provides software for healthcare and service businesses. Each practice replaces bracketed placeholders
              with its legal name and verified messaging number and keeps its disclosures consistent across web, signage, and
              intake.
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
