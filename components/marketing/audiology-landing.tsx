'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Phone,
  Calendar,
  Shield,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Mic,
  Bell,
  Sparkles,
  Play,
  Pause,
  PhoneIncoming,
  ChevronDown,
  ChevronUp,
  Headphones,
  Bot,
  BookOpen,
  Settings2,
  Send,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SUPPORT_EMAIL, supportMailto } from '@/lib/support'

const PRICING_PLANS = [
  {
    key: 'starter',
    tierTag: 'Starter',
    name: 'Starter',
    price: '$799',
    priceDetail: '$0.38/min · $1.14/call avg · ~23 calls/day',
    features: [
      '24/7 AI answering',
      'Appointment scheduling',
      'Intake & call routing',
      'Calendar integration',
      'Unlimited languages',
      'Onboarding & setup included',
    ],
    popular: false,
    dark: true,
  },
  {
    key: 'growth',
    tierTag: 'Growth',
    name: 'Growth',
    price: '$1,499',
    priceDetail: '$0.35/min · $1.05/call avg · ~48 calls/day',
    features: ['Everything in Starter', 'High-intent lead qualification', 'Priority support'],
    popular: true,
    dark: false,
  },
  {
    key: 'scale',
    tierTag: 'Scale',
    name: 'Scale',
    price: '$1,999',
    priceDetail: '$0.30/min · $0.90/call avg · ~74 calls/day',
    features: [
      'Everything in Growth',
      'Dedicated account manager',
      'Custom routing workflows',
      'Advanced analytics',
    ],
    popular: false,
    dark: true,
  },
] as const

/** Per-call figures from our snapshot; ~100-call row is simple math at those rates. */
const COMPARE_COLUMNS = [
  {
    key: 'smith',
    name: 'Smith AI',
    badge: 'Competitor',
    heroValue: '$3.60',
    heroLabel: 'per call (3 min)',
    rows: [
      { value: '~$360', label: '100 calls × 3 min / mo' },
      { value: '~4×', label: 'vs Vocalis at $0.90/call' },
    ],
    variant: 'dark' as const,
    cta: null as { href: string; label: string } | null,
  },
  {
    key: 'vocalis',
    name: 'Vocalis',
    badge: 'Us',
    heroValue: '$0.90–$1.14',
    heroLabel: 'per call (3 min)',
    rows: [
      { value: '~$90–$114', label: '100 calls × 3 min / mo' },
      { value: 'From $799/mo', label: 'Starter · Growth · Scale' },
    ],
    variant: 'primary' as const,
    cta: { href: supportMailto('Vocalis — comparison follow-up'), label: 'Contact us' } as const,
  },
  {
    key: 'dialzara',
    name: 'Dialzara',
    badge: 'Competitor',
    heroValue: '$1.20',
    heroLabel: 'per call (3 min)',
    rows: [
      { value: '~$120', label: '100 calls × 3 min / mo' },
      { value: '~1.3×', label: 'vs Vocalis at $0.90/call' },
    ],
    variant: 'dark' as const,
    cta: null as { href: string; label: string } | null,
  },
] as const

const INDUSTRIES = [
  'Audiology',
  'Orthopedics',
  'Law firms',
  'Hospitals & clinics',
  'Rehab & therapy',
  'Service businesses',
] as const

const features = [
  {
    icon: Phone,
    title: 'Intelligent call handling',
    description:
      'Our AI receptionist answers inbound calls around the clock—scheduling, FAQs, and the questions that usually tie up the front desk.',
  },
  {
    icon: Calendar,
    title: 'Scheduling & requests',
    description:
      'Book, reschedule, or cancel with the right context. Works for clinics, firms, and multi-location operations.',
  },
  {
    icon: Sparkles,
    title: 'Consistent, on-brand answers',
    description:
      'Give every caller the same accurate story about hours, services, and policies—without reading from a sticky note.',
  },
  {
    icon: Bell,
    title: 'Proactive outreach',
    description:
      'Automated reminders and follow-ups so fewer opportunities slip through when the team is slammed.',
  },
  {
    icon: Shield,
    title: 'Smart escalation',
    description:
      'When a human needs to step in, route with full context so staff pick up mid-conversation, not from zero.',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    description:
      'See volume, themes, and outcomes in one place—tune scripts, staffing, and training with real call data.',
  },
]

const stats = [
  { value: '85%', label: 'Routine calls off the front desk' },
  { value: '24/7', label: 'Coverage' },
  { value: '< 2 min', label: 'Typical handle time' },
  { value: '4.8/5', label: 'Caller satisfaction (demo)' },
]

const testimonials = [
  {
    quote:
      "We've cut repeat phone work dramatically. People in the office spend time on real work instead of answering the same questions all day.",
    author: 'Dr. Sarah Chen',
    role: 'Owner, Harmony Hearing Clinic',
  },
  {
    quote:
      'New intakes and callbacks finally feel structured. Callers get clear next steps and we get clean handoffs—without hiring another full-time line.',
    author: 'Jordan Reeves',
    role: 'Managing Partner, Reeves & Holt LLP',
  },
]

type DemoLine = { role: 'agent' | 'user'; text: string }

type DemoCall = {
  id: string
  phone: string
  time: string
  intent: string
  caller: string
  summary: string
  durationSec: number
  transcript: DemoLine[]
}

const LANDING_DEMO_CALLS: DemoCall[] = [
  {
    id: '1',
    phone: '(555) 201-8841',
    time: '2m ago',
    intent: 'Reschedule',
    caller: 'Returning',
    summary:
      'Caller asked to reschedule. Agent offered two times, confirmed the choice, and sent a recap.',
    durationSec: 204,
    transcript: [
      { role: 'agent', text: 'Thanks for calling—how can I help you today?' },
      { role: 'user', text: 'I need to move my Thursday time if anything opens sooner.' },
      { role: 'agent', text: 'I have Tuesday at 2:15 or Wednesday at 9:30—would either work?' },
    ],
  },
  {
    id: '2',
    phone: '(555) 442-0192',
    time: '14m ago',
    intent: 'New patient',
    caller: 'New',
    summary:
      'Caller asked about hearing eval availability and insurance. Agent shared next openings.',
    durationSec: 189,
    transcript: [
      { role: 'agent', text: 'Harmony Hearing, this is the virtual front desk.' },
      { role: 'user', text: 'Do you take UnitedHealthcare for a hearing test?' },
      { role: 'agent', text: 'We do—our next audiology slot is Thursday at 11 AM. Want me to hold that?' },
    ],
  },
  {
    id: '3',
    phone: '(555) 883-1104',
    time: '1h ago',
    intent: 'Billing',
    caller: 'Returning',
    summary: 'Question about an invoice. Agent confirmed account and offered to email a copy.',
    durationSec: 156,
    transcript: [
      { role: 'agent', text: 'How can I help you today?' },
      { role: 'user', text: 'I need a copy of last month’s invoice.' },
      { role: 'agent', text: 'I can text a secure link to the email on file—sound good?' },
    ],
  },
]

function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const WORKSPACE_TABS = [
  { key: 'calls' as const, label: 'Calls', icon: PhoneIncoming },
  { key: 'agent' as const, label: 'Agent', icon: Bot },
  { key: 'knowledge' as const, label: 'Knowledge', icon: BookOpen },
  { key: 'settings' as const, label: 'Settings', icon: Settings2 },
]

function LandingDashboardMockup() {
  const [workspace, setWorkspace] = useState<(typeof WORKSPACE_TABS)[number]['key']>('calls')
  const [selectedId, setSelectedId] = useState(LANDING_DEMO_CALLS[0].id)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [draft, setDraft] = useState('')
  const [extraByCall, setExtraByCall] = useState<Record<string, DemoLine[]>>({})
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selected = LANDING_DEMO_CALLS.find((c) => c.id === selectedId) ?? LANDING_DEMO_CALLS[0]
  const extras = extraByCall[selected.id] ?? []
  const lines = [...selected.transcript, ...extras]

  useEffect(() => {
    if (!playing) return
    const t = window.setInterval(() => {
      setElapsed((e) => (e >= selected.durationSec ? e : e + 1))
    }, 1000)
    return () => window.clearInterval(t)
  }, [playing, selected.durationSec])

  useEffect(() => {
    if (elapsed >= selected.durationSec && playing) setPlaying(false)
  }, [elapsed, selected.durationSec, playing])

  useEffect(() => {
    return () => {
      if (replyTimer.current) clearTimeout(replyTimer.current)
    }
  }, [])

  const togglePlay = () => {
    if (elapsed >= selected.durationSec) setElapsed(0)
    setPlaying((p) => !p)
  }

  const sendDemoNote = () => {
    const t = draft.trim()
    if (!t) return
    setDraft('')
    setExtraByCall((prev) => ({
      ...prev,
      [selected.id]: [...(prev[selected.id] ?? []), { role: 'user', text: t }],
    }))
    if (replyTimer.current) clearTimeout(replyTimer.current)
    replyTimer.current = setTimeout(() => {
      setExtraByCall((prev) => ({
        ...prev,
        [selected.id]: [
          ...(prev[selected.id] ?? []),
          {
            role: 'agent',
            text: 'Noted—I’ll pass that to your team in the real workspace. Thanks for trying the demo!',
          },
        ],
      }))
    }, 700)
  }

  return (
    <div
      className="relative mx-auto mt-14 w-full max-w-5xl rounded-2xl border border-border/80 bg-gradient-to-b from-card to-muted/30 p-1 shadow-[0_24px_80px_-20px_rgba(15,80,50,0.12)] md:rounded-3xl md:p-1.5"
      aria-label="Interactive product preview"
    >
      <p className="sr-only">
        Demo only: switch workspace tabs, pick a call, play the sample timeline, or add a note to the transcript.
      </p>
      <div className="flex max-h-[min(68vh,560px)] min-h-[360px] overflow-hidden rounded-[1.15rem] bg-white text-zinc-800 shadow-inner md:max-h-[520px] md:rounded-[1.35rem]">
        <aside className="hidden w-[38%] max-w-[200px] shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/90 sm:flex lg:max-w-[220px]">
          <div className="border-b border-zinc-200 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Workspace
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 p-2 text-[11px]">
            {WORKSPACE_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setWorkspace(key)
                  if (key !== 'calls') setPlaying(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left font-medium transition-colors',
                  workspace === key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-zinc-600 hover:bg-zinc-100',
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {label}
              </button>
            ))}
          </nav>
        </aside>
        <div className="flex w-[32%] min-w-[120px] flex-col border-r border-zinc-200 bg-white max-sm:hidden">
          <div className="border-b border-zinc-100 px-3 py-2 text-[10px] font-medium text-zinc-500">Recent</div>
          <ul className="flex-1 space-y-0.5 overflow-y-auto p-1.5">
            {LANDING_DEMO_CALLS.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(row.id)
                    setPlaying(false)
                    setElapsed(0)
                  }}
                  className={cn(
                    'w-full rounded-lg px-2 py-1.5 text-left text-[10px] transition-colors lg:text-[11px]',
                    selectedId === row.id ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-50',
                  )}
                >
                  <div className="font-medium">{row.phone}</div>
                  <div
                    className={cn(
                      'text-[9px]',
                      selectedId === row.id ? 'text-zinc-300' : 'text-zinc-400',
                    )}
                  >
                    {row.time}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex min-w-0 flex-1 flex-col bg-gradient-to-b from-white to-zinc-50/80">
          {workspace !== 'calls' ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                {workspace === 'agent' ? (
                  <Bot className="size-6" />
                ) : workspace === 'knowledge' ? (
                  <BookOpen className="size-6" />
                ) : (
                  <Settings2 className="size-6" />
                )}
              </div>
              <p className="text-xs font-semibold text-zinc-900">
                {workspace === 'agent' && 'Agent workspace'}
                {workspace === 'knowledge' && 'Knowledge base'}
                {workspace === 'settings' && 'Settings'}
              </p>
              <p className="max-w-[220px] text-[10px] leading-relaxed text-zinc-500">
                In the live app this is where you tune the receptionist, facts, and phone line. Here it’s a preview—try{' '}
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => setWorkspace('calls')}
                >
                  Calls
                </button>{' '}
                for the interactive transcript.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2">
                <div>
                  <div className="text-[11px] font-semibold text-zinc-900 lg:text-xs">Inbound call</div>
                  <div className="text-[9px] text-zinc-500">
                    Today · 10:42 AM · {fmtDur(selected.durationSec)}
                  </div>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-medium text-emerald-800">
                  Resolved
                </span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                  <div className="rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50/80 p-2.5 shadow-sm">
                    <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-amber-900/70">
                      Summary
                    </div>
                    <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                      <dt className="text-zinc-500">Intent</dt>
                      <dd className="font-medium text-zinc-800">{selected.intent}</dd>
                      <dt className="text-zinc-500">Caller</dt>
                      <dd className="font-medium text-zinc-800">{selected.caller}</dd>
                    </dl>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-700">{selected.summary}</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-2 py-2">
                    <button
                      type="button"
                      onClick={togglePlay}
                      aria-label={playing ? 'Pause demo playback' : 'Play demo playback'}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
                    >
                      {playing ? (
                        <Pause className="size-3.5 fill-current" />
                      ) : (
                        <Play className="size-3.5 fill-current" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex h-6 items-end gap-px">
                        {Array.from({ length: 32 }).map((_, i) => {
                          const base = 20 + ((i * 17) % 100) / 5
                          const bump = playing ? Math.sin((elapsed + i) * 0.45) * 6 : 0
                          return (
                            <span
                              key={i}
                              className={cn(
                                'w-0.5 rounded-full transition-[height] duration-150',
                                playing ? 'bg-primary/50' : 'bg-zinc-300',
                              )}
                              style={{ height: `${Math.min(28, Math.max(8, base + bump))}px` }}
                            />
                          )
                        })}
                      </div>
                      <div className="mt-0.5 flex justify-between text-[9px] text-zinc-400">
                        <span>{fmtDur(elapsed)}</span>
                        <span>{fmtDur(selected.durationSec)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-[10px] leading-snug">
                    {lines.map((line, idx) =>
                      line.role === 'agent' ? (
                        <div
                          key={`${idx}-${line.text.slice(0, 12)}`}
                          className="rounded-lg rounded-tl-sm bg-zinc-100 px-2 py-1.5 text-zinc-700"
                        >
                          <span className="font-semibold text-zinc-900">Agent · </span>
                          {line.text}
                        </div>
                      ) : (
                        <div
                          key={`${idx}-${line.text.slice(0, 12)}`}
                          className="ml-4 rounded-lg rounded-tr-sm border border-zinc-200 bg-white px-2 py-1.5 text-zinc-700"
                        >
                          {line.text}
                        </div>
                      ),
                    )}
                  </div>
                </div>
                <div className="shrink-0 border-t border-zinc-100 bg-white/90 p-2">
                  <form
                    className="flex gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault()
                      sendDemoNote()
                    }}
                  >
                    <Input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Add a staff note to this thread…"
                      className="h-8 flex-1 text-[11px]"
                      aria-label="Demo message"
                    />
                    <Button type="submit" size="sm" className="h-8 shrink-0 gap-1 px-2.5 text-[11px]">
                      <Send className="size-3.5" />
                      Send
                    </Button>
                  </form>
                  <p className="mt-1 text-[9px] text-zinc-400">Demo only—nothing is saved or sent.</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function AudiologyLanding() {
  const [pricingCompareMode, setPricingCompareMode] = useState(false)

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
        <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <Headphones className="h-4 w-4" />
            </div>
            <span className="truncate text-lg font-bold tracking-tight">Vocalis</span>
          </Link>
          <nav className="hidden items-center gap-7 lg:flex">
            <a href="#verticals" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Industries
            </a>
            <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#testimonials" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Testimonials
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Pricing
            </a>
            <Link href="/ortho" className="text-sm text-muted-foreground transition-colors hover:text-foreground whitespace-nowrap">
              Orthopedics
            </Link>
          </nav>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Button variant="ghost" asChild className="hidden text-muted-foreground hover:text-foreground sm:inline-flex">
              <a href={supportMailto('Vocalis inquiry')}>Contact us</a>
            </Button>
            <Button asChild size="lg" className="h-10 rounded-full px-5 font-semibold shadow-md shadow-primary/15">
              <Link href="/login">
                Sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-primary/[0.09] via-background to-background px-4 pb-6 pt-10 sm:pb-12 sm:pt-14 lg:px-8">
        <div className="pointer-events-none absolute -left-32 top-24 h-80 w-80 rounded-full bg-primary/[0.12] blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -right-24 top-40 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" aria-hidden />

        <div className="container relative mx-auto text-center">
          <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/90 px-4 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/50 opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Voice AI for clinics, firms &amp; service teams
          </div>

          <h1 className="mx-auto max-w-4xl text-balance text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-6xl lg:leading-[1.06]">
            The AI voice receptionist that <span className="text-primary">answers every call</span>
            {' '}
            <br className="hidden sm:block" />
            <span className="sm:ml-2">while </span>
            <span className="text-primary">you focus on what matters</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Automate inbound calls, lighten the front desk, and give every caller a consistent experience—without losing
            the human touch when it matters.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Button asChild size="lg" className="h-12 rounded-full px-8 text-base font-semibold shadow-md shadow-primary/20">
              <Link href="/login">
                Sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-border/80 bg-card/80 px-8 text-base font-medium backdrop-blur-sm">
              <a href="#features">Features</a>
            </Button>
          </div>
          <p className="mx-auto mt-5 max-w-lg text-pretty text-sm leading-relaxed text-muted-foreground">
            We are currently invite only. Reach out to{' '}
            <a
              href="mailto:support@vocalis.team"
              className="font-medium text-foreground underline decoration-border underline-offset-2 transition-colors hover:text-primary hover:decoration-primary"
            >
              support@vocalis.team
            </a>{' '}
            for help and inquiries.
          </p>

          <LandingDashboardMockup />
        </div>
      </section>

      <section id="verticals" className="scroll-mt-16 border-y border-border/60 bg-muted/35 py-14">
        <div className="container mx-auto px-4 lg:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-primary">Industries</p>
          <h2 className="mx-auto mt-2 max-w-2xl text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Built for teams where every call counts
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted-foreground">
            Same platform—tuned for how teams serve customers, clients, and callers.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {INDUSTRIES.map((label) => (
              <span
                key={label}
                className="rounded-full border border-border/80 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/35 hover:bg-primary/[0.06]"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border/50 bg-muted/25 py-12">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-primary lg:text-4xl">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-16 pb-10 pt-16 lg:pb-12 lg:pt-20">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">What teams need on the phone</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              From first ring to follow-up—built for real phone load, not a generic phone tree.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-border/70 bg-card p-6 shadow-sm transition-all hover:border-primary/25 hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/15">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="testimonials"
        className="scroll-mt-16 border-t border-border/40 bg-background pt-10 pb-16 max-md:hidden lg:pt-12 lg:pb-20"
      >
        <div className="container mx-auto px-4 lg:px-8">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Trusted by busy front offices</h2>
          </div>
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.author}
                className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <p className="leading-relaxed text-muted-foreground">&ldquo;{testimonial.quote}&rdquo;</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary ring-1 ring-primary/20">
                    {testimonial.author
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{testimonial.author}</div>
                    <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-16 border-t border-border/60 bg-muted/25 py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {pricingCompareMode ? 'How we stack up' : 'Simple, transparent pricing'}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              {pricingCompareMode
                ? 'Same 3-minute call basis. Confirm current rates on each vendor’s site before buying.'
                : 'Plans scale with call volume. Reach out to discuss what fits.'}
            </p>
          </div>

          <div
            className="mx-auto grid max-w-6xl gap-5 duration-500 ease-out animate-in fade-in-0 motion-reduce:animate-none md:grid-cols-3 md:items-stretch"
            key={pricingCompareMode ? 'compare' : 'plans'}
          >
            {!pricingCompareMode &&
              PRICING_PLANS.map((plan) => (
                <Card
                  key={plan.key}
                  className={cn(
                    'relative flex flex-col overflow-hidden border-0 shadow-lg transition-transform duration-300 hover:-translate-y-0.5',
                    plan.popular &&
                      'z-10 scale-[1.02] bg-primary text-primary-foreground shadow-xl shadow-primary/25 md:scale-105',
                    plan.dark &&
                      !plan.popular &&
                      'bg-[#0f2419] text-emerald-50 shadow-black/20 ring-1 ring-white/10',
                  )}
                >
                  {plan.popular && (
                    <div className="absolute -top-0 left-0 right-0 flex justify-center pt-3">
                      <Badge className="border-0 bg-[#0f2419] font-semibold text-emerald-50 hover:bg-[#0f2419]">
                        Most popular
                      </Badge>
                    </div>
                  )}
                  <CardContent className={cn('flex flex-1 flex-col p-6 pt-10', plan.popular && 'pt-12')}>
                    <p
                      className={cn(
                        'text-[10px] font-semibold uppercase tracking-[0.2em]',
                        plan.popular ? 'text-primary-foreground/70' : plan.dark ? 'text-emerald-400/80' : 'text-muted-foreground',
                      )}
                    >
                      {plan.tierTag}
                    </p>
                    <div className="mt-1 text-xl font-bold">{plan.name}</div>
                    <div className="mt-3 flex flex-wrap items-baseline gap-1">
                      <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                      <span
                        className={cn(
                          'text-sm font-medium',
                          plan.popular ? 'text-primary-foreground/85' : plan.dark ? 'text-emerald-200/90' : 'text-muted-foreground',
                        )}
                      >
                        /mo
                      </span>
                    </div>
                    <p
                      className={cn(
                        'mt-2 text-xs leading-relaxed',
                        plan.popular ? 'text-primary-foreground/80' : plan.dark ? 'text-emerald-200/75' : 'text-muted-foreground',
                      )}
                    >
                      {plan.priceDetail}
                    </p>
                    <div
                      className={cn(
                        'my-5 border-t',
                        plan.popular ? 'border-primary-foreground/20' : plan.dark ? 'border-white/10' : 'border-border',
                      )}
                    />
                    <ul className="flex flex-1 flex-col gap-2.5">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm leading-snug">
                          <CheckCircle2
                            className={cn(
                              'mt-0.5 h-4 w-4 shrink-0',
                              plan.popular ? 'text-primary-foreground' : plan.dark ? 'text-[#c4ff7a]' : 'text-primary',
                            )}
                          />
                          <span
                            className={cn(
                              plan.popular ? 'text-primary-foreground/95' : plan.dark ? 'text-emerald-100/95' : 'text-foreground/90',
                            )}
                          >
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={cn(
                        'mt-6 w-full rounded-xl font-semibold',
                        plan.popular &&
                          'border-0 bg-[#0f2419] text-emerald-50 shadow-md hover:bg-[#152f20] hover:text-white',
                        plan.dark &&
                          !plan.popular &&
                          'border-0 bg-emerald-100 text-[#0f2419] shadow-none hover:bg-white',
                      )}
                      variant="default"
                      asChild
                    >
                      <a href={supportMailto(`${plan.name} plan — Vocalis`)}>Contact us</a>
                    </Button>
                  </CardContent>
                </Card>
              ))}

            {pricingCompareMode &&
              COMPARE_COLUMNS.map((col) => (
                <Card
                  key={col.key}
                  className={cn(
                    'relative flex flex-col overflow-hidden border-0 shadow-lg transition-transform duration-300 hover:-translate-y-0.5',
                    col.variant === 'primary' &&
                      'z-10 scale-[1.02] bg-primary text-primary-foreground shadow-xl shadow-primary/25 md:scale-105',
                    col.variant === 'dark' && 'bg-[#0f2419] text-emerald-50 shadow-black/20 ring-1 ring-white/10',
                  )}
                >
                  {col.variant === 'primary' && (
                    <div className="absolute left-0 right-0 top-0 flex justify-center pt-3">
                      <Badge className="border-0 bg-[#0f2419] font-semibold text-emerald-50 hover:bg-[#0f2419]">
                        Best value
                      </Badge>
                    </div>
                  )}
                  <CardContent className={cn('flex flex-1 flex-col p-6 pt-10', col.variant === 'primary' && 'pt-12')}>
                    <p
                      className={cn(
                        'text-[10px] font-semibold uppercase tracking-[0.2em]',
                        col.variant === 'primary' ? 'text-primary-foreground/70' : 'text-emerald-400/80',
                      )}
                    >
                      {col.badge}
                    </p>
                    <div className="mt-1 text-xl font-bold">{col.name}</div>
                    <div className="mt-4">
                      <div className="text-4xl font-bold tracking-tight">{col.heroValue}</div>
                      <p
                        className={cn(
                          'mt-1 text-xs font-medium',
                          col.variant === 'primary' ? 'text-primary-foreground/80' : 'text-emerald-200/80',
                        )}
                      >
                        {col.heroLabel}
                      </p>
                    </div>
                    <div
                      className={cn(
                        'my-4 border-t',
                        col.variant === 'primary' ? 'border-primary-foreground/20' : 'border-white/10',
                      )}
                    />
                    <ul className="flex flex-1 flex-col gap-3">
                      {col.rows.map((row) => (
                        <li key={row.label} className="text-sm leading-tight">
                          <div
                            className={cn(
                              'font-semibold tabular-nums',
                              col.variant === 'primary' ? 'text-primary-foreground' : 'text-emerald-100',
                            )}
                          >
                            {row.value}
                          </div>
                          <div
                            className={cn(
                              'mt-0.5 text-xs',
                              col.variant === 'primary' ? 'text-primary-foreground/75' : 'text-emerald-200/80',
                            )}
                          >
                            {row.label}
                          </div>
                        </li>
                      ))}
                    </ul>
                    {col.cta ? (
                      <Button
                        className="mt-5 w-full rounded-xl border-0 bg-[#0f2419] font-semibold text-emerald-50 shadow-md hover:bg-[#152f20] hover:text-white"
                        variant="default"
                        asChild
                      >
                        <a href={col.cta.href}>{col.cta.label}</a>
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
          </div>

          <div className="mx-auto mt-14 flex max-w-xl flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setPricingCompareMode((v) => !v)
                window.requestAnimationFrame(() => {
                  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                })
              }}
              className={cn(
                'group flex w-full flex-col items-center justify-center gap-1 rounded-2xl border px-6 py-5 text-center shadow-sm transition-all duration-300',
                'border-primary/25 bg-gradient-to-b from-primary/[0.08] to-primary/[0.02]',
                'hover:border-primary/45 hover:shadow-md hover:shadow-primary/10',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              )}
            >
              <span className="text-sm font-semibold text-foreground">
                {pricingCompareMode ? 'Back to plans & pricing' : 'See how we compare'}
              </span>
              {pricingCompareMode ? (
                <span className="text-xs text-muted-foreground">Return to Starter, Growth, and Scale</span>
              ) : null}
              {pricingCompareMode ? (
                <ChevronUp className="mt-1 h-5 w-5 text-primary transition-transform duration-500 group-hover:-translate-y-1 motion-reduce:transition-none" />
              ) : (
                <ChevronDown className="mt-1 h-5 w-5 text-primary transition-transform duration-500 group-hover:translate-y-1 motion-reduce:transition-none" />
              )}
            </button>
            <p className="text-center text-[11px] text-muted-foreground">
              Competitor figures reflect our last snapshot; always confirm on smith.ai and dialzara.com.
            </p>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-b from-primary/[0.06] via-muted/20 to-background py-20 lg:py-28">
        <div className="container relative mx-auto px-4 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Ready to modernize the phone line?</h2>
            <p className="mt-4 text-pretty text-lg text-muted-foreground">
              Access is invitation-only. If your organization uses Vocalis, sign in with the email from your administrator.
              If not, contact us with the button below. For help and inquiries, email{' '}
              <a
                href={supportMailto()}
                className="font-medium text-foreground underline decoration-border underline-offset-2 transition-colors hover:text-primary"
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
            <div className="mt-8 flex flex-col items-center justify-center">
              <Button asChild size="lg" className="h-12 rounded-full px-10 font-semibold shadow-md shadow-primary/20">
                <a href={supportMailto('Vocalis inquiry')}>Contact us</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 bg-muted/40 py-12">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid gap-10 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <Mic className="h-4 w-4" />
                </div>
                <span className="text-lg font-bold text-foreground">Vocalis</span>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                AI voice reception for clinics, firms, and high-trust service businesses.
              </p>
            </div>
            <div>
              <h3 className="mb-4 text-sm font-semibold text-foreground">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#features" className="transition-colors hover:text-primary">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="transition-colors hover:text-primary">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#verticals" className="transition-colors hover:text-primary">
                    Industries
                  </a>
                </li>
                <li>
                  <Link href="/ortho" className="transition-colors hover:text-primary">
                    Orthopedics
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 text-sm font-semibold text-foreground">Access</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/login" className="transition-colors hover:text-primary">
                    Sign in
                  </Link>
                </li>
                <li>
                  <a href={supportMailto('Vocalis inquiry')} className="transition-colors hover:text-primary">
                    Contact us
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 text-sm font-semibold text-foreground">Legal</h3>
              <p className="text-sm text-muted-foreground">Privacy &amp; terms: contact your administrator.</p>
            </div>
          </div>
          <div className="mt-12 border-t border-border/60 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Vocalis. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
