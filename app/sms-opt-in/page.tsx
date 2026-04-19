import type { Metadata } from 'next'
import Link from 'next/link'

const SMS_NUMBER_DISPLAY = '(855) 901-6635'
const SMS_NUMBER_TEL = '+18559016635'

export const metadata: Metadata = {
  title: 'Text updates from your clinic',
  description:
    'How to opt in to informational text messages by texting START. Message frequency, rates, STOP, and HELP.',
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
            Get text updates from your clinic
          </h1>
          <p className="mt-3 text-lg font-medium text-muted-foreground">
            You can receive appointment reminders and other helpful notices by text. Read the details below, then text{' '}
            <span className="font-mono font-semibold text-foreground">START</span> from your mobile phone to opt in.
          </p>
        </header>

        <div className="space-y-10 text-base leading-relaxed text-muted-foreground">
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">How to join</h2>
            <p className="text-foreground">
              You may see the same information on a sign at your clinic, on paperwork, or on your provider&apos;s website.
              When you&apos;re ready, send the keyword from the phone where you want to receive messages.
            </p>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 text-foreground shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Text to join</p>
              <p className="mt-4 text-lg font-bold leading-snug">
                Text <span className="font-mono text-emerald-900">START</span> to{' '}
                <a
                  href={`sms:${SMS_NUMBER_TEL}?body=START`}
                  className="whitespace-nowrap font-mono text-emerald-900 underline decoration-emerald-700/40 underline-offset-2 hover:text-emerald-950"
                >
                  {SMS_NUMBER_DISPLAY}
                </a>
              </p>
              <p className="mt-4 text-sm leading-relaxed">
                By texting <span className="font-mono font-semibold">START</span>, you agree to receive automated
                informational messages from your clinic—including appointment reminders and operational notices—at this number.
                Message frequency varies. Message and data rates may apply. Reply{' '}
                <span className="font-mono font-semibold">STOP</span> anytime to unsubscribe;{' '}
                <span className="font-mono font-semibold">HELP</span> for help. Signing up for texts is not required to buy
                goods or services. Ask your clinic where to find their privacy policy and terms.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">What happens next</h2>
            <ol className="list-decimal space-y-2 pl-5 text-foreground">
              <li>You read the disclosure above (here or wherever your clinic shares it).</li>
              <li>
                You text <span className="font-mono font-semibold">START</span> to{' '}
                <span className="font-mono font-semibold">{SMS_NUMBER_DISPLAY}</span> from your mobile phone.
              </li>
              <li>
                You&apos;ll get an automated reply confirming you&apos;re enrolled. That message will remind you how to stop
                messages (<span className="font-mono font-semibold">STOP</span>) and how to get help (
                <span className="font-mono font-semibold">HELP</span>).
              </li>
            </ol>
            <p>
              If your clinic uses an extra confirmation step (for example, asking you to reply <span className="font-mono">YES</span>
              ), follow the instructions in that message.
            </p>
          </section>

          <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-xl font-bold text-foreground">Stop messages or get help</h2>
            <p>
              To stop texts, reply <span className="font-mono font-semibold text-foreground">STOP</span> to any message you
              receive from us. To get help, reply <span className="font-mono font-semibold text-foreground">HELP</span>.
            </p>
          </section>

          <section className="space-y-2 text-sm text-zinc-500">
            <p>
              Vocalis provides the technology your clinic uses to send these messages. If something looks wrong or you have a
              question about this page, email{' '}
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
