import type { Metadata } from 'next'
import Link from 'next/link'
import { MOBILE_PROVIDER_ANCHORS, WEB_VOIP_ANCHORS } from '@/lib/help-call-forwarding-nav'

export const metadata: Metadata = {
  title: 'Call forwarding to your Vocalis number | Vocalis',
  description:
    'Forward calls from your mobile carrier or business phone system to your Vocalis number. Provider-specific instructions.',
}

const EX = '(954) 555-2171'
const EX_COMPACT = '9545552171'

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-sm text-foreground">{children}</code>
  )
}

function JumpLink({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <a
      href={`#${id}`}
      className="font-medium text-emerald-700 underline decoration-emerald-700/35 underline-offset-2 hover:text-emerald-900"
    >
      {children}
    </a>
  )
}

export default function CallForwardingHelpPage() {
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
            Call forwarding to your Vocalis number
          </h1>
          <p className="mt-3 text-lg font-medium text-muted-foreground">
            Forward incoming calls from your existing line so they ring your Vocalis receptionist.
          </p>
        </header>

        <div className="space-y-12 text-base leading-relaxed text-muted-foreground">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">What you&apos;ll need</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Your Vocalis phone number</li>
              <li>Access to your physical phone or online phone system</li>
            </ul>
          </section>

          <section className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/60 p-5 text-foreground">
            <h2 className="text-xl font-bold">Important note for iPhone users: turn off Live Voicemail</h2>
            <p>If you use an iPhone, make sure Live Voicemail is turned off.</p>
            <p className="font-semibold">To turn it off:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Open the Settings app</li>
              <li>Tap Phone</li>
              <li>Tap Live Voicemail</li>
              <li>Toggle it off</li>
            </ol>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Select your phone provider</h2>
            <div className="grid gap-8 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 font-semibold text-foreground">Popular mobile providers</h3>
                <ul className="list-disc space-y-1 pl-5 marker:text-emerald-700">
                  {MOBILE_PROVIDER_ANCHORS.map(({ label, id }) => (
                    <li key={id}>
                      <JumpLink id={id}>{label}</JumpLink>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 font-semibold text-foreground">Popular web phone and VoIP systems</h3>
                <ul className="list-disc space-y-1 pl-5 marker:text-emerald-700">
                  {WEB_VOIP_ANCHORS.map(({ label, id }) => (
                    <li key={id}>
                      <JumpLink id={id}>{label}</JumpLink>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p>
              <span className="font-semibold text-foreground">Landlines:</span> see{' '}
              <a href="#landlines" className="font-semibold text-emerald-700 underline underline-offset-2">
                Instructions for landlines
              </a>
              .
            </p>
          </section>

          <section className="space-y-8" id="mobile">
            <h2 className="text-2xl font-bold text-foreground">Instructions for major mobile carriers</h2>

            <div className="space-y-3">
              <h3 id="verizon" className="scroll-mt-24 text-lg font-bold text-foreground">
                Verizon
              </h3>
              <p>
                Dial <Code>*72</Code>
                <Code>{EX_COMPACT}</Code> on your phone, then press call. To turn off call forwarding, dial{' '}
                <Code>*73</Code>.
              </p>
              <p>
                Example: if your Vocalis number is {EX}, you would dial <Code>*72{EX_COMPACT}</Code> then press call.
              </p>
            </div>

            <div className="space-y-3">
              <h3 id="att" className="scroll-mt-24 text-lg font-bold text-foreground">
                AT&amp;T
              </h3>
              <p>
                Dial <Code>**21*</Code>
                <Code>{EX_COMPACT}</Code>
                <Code>#</Code> on your phone, then press call. To turn off call forwarding, dial <Code>#21#</Code>.
              </p>
              <p>
                Example: if your Vocalis number is {EX}, you would dial <Code>**21*{EX_COMPACT}#</Code> then press call.
              </p>
            </div>

            <div className="space-y-3">
              <h3 id="t-mobile" className="scroll-mt-24 text-lg font-bold text-foreground">
                T-Mobile
              </h3>
              <p>
                Dial <Code>**21*</Code>
                <Code>{EX_COMPACT}</Code>
                <Code>#</Code> on your phone, then press call. To turn off call forwarding, dial <Code>#21#</Code>.
              </p>
              <p>
                Example: if your Vocalis number is {EX}, you would dial <Code>**21*{EX_COMPACT}#</Code> then press call.
              </p>
            </div>

            <div className="space-y-3">
              <h3 id="sprint" className="scroll-mt-24 text-lg font-bold text-foreground">
                Sprint
              </h3>
              <p>
                Dial <Code>*72</Code>
                <Code>{EX_COMPACT}</Code> on your phone, then press call. To turn off call forwarding, dial{' '}
                <Code>*73</Code>.
              </p>
              <p>
                Example: if your Vocalis number is {EX}, you would dial <Code>*72{EX_COMPACT}</Code> then press call.
              </p>
            </div>

            <div className="space-y-3">
              <h3 id="boost-mobile" className="scroll-mt-24 text-lg font-bold text-foreground">
                Boost Mobile
              </h3>
              <p>
                Dial <Code>*72</Code>
                <Code>{EX_COMPACT}</Code> on your phone, then press call. To turn off call forwarding, dial{' '}
                <Code>*73</Code> or <Code>*720</Code>.
              </p>
              <p>
                Example: if your Vocalis number is {EX}, you would dial <Code>*72{EX_COMPACT}</Code> then press call.
              </p>
            </div>

            <div className="space-y-3">
              <h3 id="mint-mobile" className="scroll-mt-24 text-lg font-bold text-foreground">
                Mint Mobile
              </h3>
              <p>
                Dial <Code>**21*1</Code>
                <Code>{EX_COMPACT}</Code>
                <Code>#</Code> on your phone, then press call. To turn off call forwarding, dial <Code>##21#</Code>.
              </p>
              <p>
                Example: if your Vocalis number is {EX}, you would dial <Code>**21*1{EX_COMPACT}#</Code> then press call.
              </p>
            </div>

            <div className="space-y-3">
              <h3 id="cricket-wireless" className="scroll-mt-24 text-lg font-bold text-foreground">
                Cricket Wireless
              </h3>
              <p>
                Dial <Code>*21</Code>
                <Code>{EX_COMPACT}</Code>
                <Code>#</Code> on your phone, then press call. To turn off call forwarding, dial <Code>##21#</Code>.
              </p>
              <p>
                Example: if your Vocalis number is {EX}, you would dial <Code>*21{EX_COMPACT}#</Code> then press call.
              </p>
            </div>

            <div className="space-y-3">
              <h3 id="consumer-cellular" className="scroll-mt-24 text-lg font-bold text-foreground">
                Consumer Cellular
              </h3>
              <p>
                Dial <Code>*21</Code>
                <Code>{EX_COMPACT}</Code>
                <Code>#</Code> on your phone, then press call. To turn off call forwarding, dial <Code>##21#</Code>.
              </p>
              <p>
                Example: if your Vocalis number is {EX}, you would dial <Code>*21{EX_COMPACT}#</Code> then press call.
              </p>
            </div>

            <div className="space-y-3">
              <h3 id="xfinity-mobile" className="scroll-mt-24 text-lg font-bold text-foreground">
                Xfinity Mobile
              </h3>
              <p>
                Dial <Code>*72</Code>
                <Code>{EX_COMPACT}</Code> on your phone, then press call. To turn off call forwarding, dial{' '}
                <Code>*73</Code>.
              </p>
              <p>
                Example: if your Vocalis number is {EX}, you would dial <Code>*72{EX_COMPACT}</Code> then press call.
              </p>
            </div>
          </section>

          <section className="space-y-8" id="voip">
            <h2 className="text-2xl font-bold text-foreground">Instructions for popular VoIP and web phone systems</h2>

            <div className="space-y-2">
              <h3 id="ringcentral" className="scroll-mt-24 text-lg font-bold text-foreground">
                RingCentral
              </h3>
              <p>Log in to your RingCentral account.</p>
              <p>Click your profile icon (top right) → Settings.</p>
              <p>Go to Phone System → Call Handling &amp; Forwarding.</p>
              <p>Under Call Forwarding, enter your Vocalis phone number. Save.</p>
            </div>

            <div className="space-y-2">
              <h3 id="weave" className="scroll-mt-24 text-lg font-bold text-foreground">
                Weave
              </h3>
              <p>Open Weave and go to your practice phone or call routing settings for the line you want to forward.</p>
              <p>Set forwarding, simultaneous ring, or after-hours routing to your Vocalis number, then save.</p>
            </div>

            <div className="space-y-2">
              <h3 id="google-voice" className="scroll-mt-24 text-lg font-bold text-foreground">
                Google Voice
              </h3>
              <p>Turn off spam blocking in Vocalis (Settings → Call Filtering), if applicable.</p>
              <p>Log in to Google Voice on your computer.</p>
              <p>Click the gear icon and add a new linked number.</p>
              <p>Enter your Vocalis number and choose &quot;Verify by phone.&quot;</p>
              <p>Answer the verification call in Vocalis and enter the code in Google Voice.</p>
              <p>Create a forwarding rule to send all calls to your Vocalis number.</p>
              <p>In Google Voice settings, turn off &quot;Show my Google Voice number as caller ID.&quot;</p>
            </div>

            <div className="space-y-2">
              <h3 id="vonage" className="scroll-mt-24 text-lg font-bold text-foreground">
                Vonage
              </h3>
              <p>Log in to your Vonage account.</p>
              <p>Click Account in the top menu → My Services.</p>
              <p>Under Call Forwarding, click Edit. Enter your Vocalis phone number. Save.</p>
            </div>

            <div className="space-y-2">
              <h3 id="dialpad" className="scroll-mt-24 text-lg font-bold text-foreground">
                Dialpad
              </h3>
              <p>Log in at dialpad.com.</p>
              <p>Profile icon (bottom left) → Settings → Calls.</p>
              <p>Under Call Forwarding, enter the number to forward to. Save.</p>
            </div>

            <div className="space-y-2">
              <h3 id="quo-openphone" className="scroll-mt-24 text-lg font-bold text-foreground">
                Quo (OpenPhone)
              </h3>
              <p>Open OpenPhone (web or desktop).</p>
              <p>Go to Phone Number Settings → Forward Calls or Call Flows.</p>
              <p>Enter your Vocalis number. Add scheduling rules if needed. Save.</p>
            </div>

            <div className="space-y-2">
              <h3 id="nextiva" className="scroll-mt-24 text-lg font-bold text-foreground">
                Nextiva
              </h3>
              <p>Log in to Nextiva.</p>
              <p>Profile (top right) → Settings → Phone Numbers (Admin).</p>
              <p>Select the number → Call Forwarding → enter your Vocalis number. Save.</p>
            </div>

            <div className="space-y-2">
              <h3 id="eight-by-eight" className="scroll-mt-24 text-lg font-bold text-foreground">
                8x8
              </h3>
              <p>Log in to 8x8 → Admin Console → Users → select user.</p>
              <p>Under Call Forwarding, enter your Vocalis number. Save.</p>
            </div>

            <div className="space-y-2">
              <h3 id="grasshopper" className="scroll-mt-24 text-lg font-bold text-foreground">
                Grasshopper
              </h3>
              <p>Settings → Call Forwarding (Business Settings).</p>
              <p>Enter your Vocalis number. Save.</p>
            </div>

            <div className="space-y-2">
              <h3 id="zoom-phone" className="scroll-mt-24 text-lg font-bold text-foreground">
                Zoom Phone
              </h3>
              <p>Phone System → Users &amp; Rooms → your profile.</p>
              <p>Call Handling → Edit (Call Forwarding) → enter your Vocalis number. Save.</p>
            </div>

            <div className="space-y-2">
              <h3 id="cisco-webex-calling" className="scroll-mt-24 text-lg font-bold text-foreground">
                Cisco Webex Calling
              </h3>
              <p>Profile → Settings → Calling → Call Forwarding.</p>
              <p>Enter your Vocalis number. Save.</p>
            </div>

            <div className="space-y-2">
              <h3 id="goto-connect" className="scroll-mt-24 text-lg font-bold text-foreground">
                GoTo Connect
              </h3>
              <p>Settings → Call Handling (Phone Settings) → Call Forwarding.</p>
              <p>Enter your Vocalis number. Save.</p>
            </div>

            <div className="space-y-2">
              <h3 id="ooma-office" className="scroll-mt-24 text-lg font-bold text-foreground">
                Ooma Office
              </h3>
              <p>Settings → Call Forwarding → enter your Vocalis number. Save.</p>
            </div>

            <div className="space-y-2">
              <h3 id="magicjack-for-business" className="scroll-mt-24 text-lg font-bold text-foreground">
                magicJack for Business
              </h3>
              <p>Settings → Call Forwarding → enter your Vocalis number. Save.</p>
            </div>

            <div className="space-y-2">
              <h3 id="avaya-cloud-office" className="scroll-mt-24 text-lg font-bold text-foreground">
                Avaya Office Cloud
              </h3>
              <p>Profile → Settings → Phone System → Call Forwarding.</p>
              <p>Enter your Vocalis number. Save.</p>
            </div>

            <div className="space-y-2">
              <h3 id="microsoft-teams-phone" className="scroll-mt-24 text-lg font-bold text-foreground">
                Microsoft Teams Phone
              </h3>
              <p>Teams → profile picture → Settings → Calls.</p>
              <p>Call Forwarding → Edit → enter your Vocalis number. Save.</p>
            </div>

            <div className="space-y-2">
              <h3 id="godaddy-conversations" className="scroll-mt-24 text-lg font-bold text-foreground">
                GoDaddy Conversations
              </h3>
              <p>Sign in to GoDaddy and open Conversations (or your telephony product) for the business number.</p>
              <p>Find call forwarding or simultaneous ring and send calls to your Vocalis number, then save.</p>
            </div>

            <div className="space-y-2">
              <h3 id="freedom-mobile" className="scroll-mt-24 text-lg font-bold text-foreground">
                Freedom Mobile
              </h3>
              <p>My Account → turn on Call Forwarding → enter your Vocalis number. Save.</p>
              <p className="pt-2">
                Or dial <Code>*21*</Code>, enter your Vocalis number, <Code>#</Code>, then call. To disable:{' '}
                <Code>#21#</Code>.
              </p>
            </div>

            <div className="space-y-2">
              <h3 id="rogers" className="scroll-mt-24 text-lg font-bold text-foreground">
                Rogers
              </h3>
              <p>MyRogers → choose the phone → Configure your Current Features → Forwarding tab.</p>
              <p>Enter your Vocalis number. Save.</p>
              <p className="pt-2">
                Or dial <Code>*72</Code>, then your Vocalis number, send, wait for confirmation. To disable: <Code>#73</Code>
                .
              </p>
            </div>

            <div className="space-y-2">
              <h3 id="bell" className="scroll-mt-24 text-lg font-bold text-foreground">
                Bell
              </h3>
              <p>
                Dial <Code>*72</Code> (or <Code>1172</Code> on rotary). After beeps, enter your Vocalis number. If the
                Vocalis line answers, keep the line open at least 5 seconds to activate.
              </p>
              <p>To turn off: <Code>#73</Code> (or <Code>1173</Code> on rotary).</p>
              <p className="pt-2">
                Home Hub 3000: <Code>*72</Code>, Vocalis number + <Code>#</Code>, confirm. Disable: <Code>#73</Code>.
              </p>
            </div>

            <div className="space-y-2">
              <h3 id="verizon-onetalk" className="scroll-mt-24 text-lg font-bold text-foreground">
                Verizon OneTalk
              </h3>
              <p>
                <span className="font-semibold text-foreground">Portal:</span> Manage Lines and Devices → line → User
                Features → Call Forwarding (Always) → Add Number → your Vocalis number → Submit.
              </p>
              <p>
                <span className="font-semibold text-foreground">Phone:</span> Dial <Code>*72</Code>, then your Vocalis
                number, wait for confirmation. To deactivate: <Code>*73</Code>.
              </p>
            </div>
          </section>

          <section className="space-y-3" id="landlines">
            <h2 className="scroll-mt-24 text-2xl font-bold text-foreground">Instructions for landlines</h2>
            <p>
              Dial <Code>*72</Code>
              <Code>{EX_COMPACT}</Code> on your phone, then press call. To turn off call forwarding, dial <Code>*73</Code>.
            </p>
            <p>
              Example: if your Vocalis number is {EX}, you would dial <Code>*72{EX_COMPACT}</Code> then press call.
            </p>
          </section>

          <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-xl font-bold text-foreground">Don&apos;t see your carrier or phone system?</h2>
            <p>
              Contact your carrier or business phone provider for call-forwarding steps. You can also email{' '}
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
