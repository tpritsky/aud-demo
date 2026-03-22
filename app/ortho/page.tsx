'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Phone,
  Calendar,
  UserCheck,
  Clock,
  ArrowRight,
  Mic,
  CheckCircle2,
  XCircle,
  DollarSign,
  Stethoscope,
  CalendarCheck,
  FileText,
  Bell,
  Zap,
  LayoutGrid,
} from 'lucide-react'
import { toast } from 'sonner'

export default function OrthoLandingPage() {
  const router = useRouter()
  const [demoForm, setDemoForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [submitting, setSubmitting] = useState(false)

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!demoForm.name.trim() || !demoForm.email.trim() || !demoForm.phone.trim()) {
      toast.error('Please fill in name, email, and phone.')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(demoForm.email)) {
      toast.error('Please enter a valid email.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: demoForm.name.trim(),
          email: demoForm.email.trim(),
          phone: demoForm.phone.trim(),
          business_type: 'ortho',
          phone_spend: 'none',
          message: (demoForm.message.trim() || 'Ortho demo request from landing page.') as string,
        }),
      })
      if (!res.ok) throw new Error('Failed to submit')
      router.push('/request-access/thank-you')
    } catch {
      toast.error('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Mic className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">AudioAssist AI</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              Audiology
            </Link>
            <Button asChild size="default" className="shadow-lg">
              <Link href="/get-started">
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b bg-gradient-to-b from-muted/30 to-background">
        <div className="container mx-auto px-4 lg:px-8 py-16 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-4">Built for Orthopedic Clinics</Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-balance">
              24/7 Patient Capture for Orthopedic Clinics
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
              Answer every call, book every appointment, and capture every patient with our intelligent system.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild className="text-lg px-8 py-6 shadow-lg">
                <Link href="#demo">Request a demo</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/get-started">Get started</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="container mx-auto px-4 lg:px-8 py-16">
        <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
          Capture more patients without adding staff.
        </p>
        <div className="grid gap-6 sm:grid-cols-3 max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <Phone className="h-10 w-10 text-primary mb-2" />
              <CardTitle className="text-lg">Answer Every Call</CardTitle>
              <CardDescription>No missed calls, no voicemail dead ends</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Calendar className="h-10 w-10 text-primary mb-2" />
              <CardTitle className="text-lg">Schedule Instantly</CardTitle>
              <CardDescription>Appointments booked in real time, 24/7</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <UserCheck className="h-10 w-10 text-primary mb-2" />
              <CardTitle className="text-lg">Identify Surgical Candidates</CardTitle>
              <CardDescription>Flag high-value patients from the first call</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Problem */}
      <section className="border-y bg-muted/20 py-16">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-4">Clinics Are Losing Patients Every Day</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            When do calls get missed?
          </p>
          <div className="grid gap-6 sm:grid-cols-3 max-w-4xl mx-auto mb-12">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">After Hours</CardTitle>
                <CardDescription>No staff available to answer</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Peak Clinic Hours</CardTitle>
                <CardDescription>Staff overwhelmed with in-person patients</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">While Assisting Patients</CardTitle>
                <CardDescription>Calls go to hold or voicemail</CardDescription>
              </CardHeader>
            </Card>
          </div>
          <div className="max-w-2xl mx-auto text-center">
            <p className="font-medium">The Consequence</p>
            <p className="mt-2 text-muted-foreground">
              Patients in pain are not patient. When they can&apos;t reach your clinic immediately, they don&apos;t wait — they call a competitor, walk into urgent care, or find another specialist. The window to capture that patient closes fast.
            </p>
            <p className="mt-4 text-foreground">
              Every missed call is a lost patient. And in orthopedics, a lost patient can mean a lost surgical case worth tens of thousands of dollars.
            </p>
          </div>
        </div>
      </section>

      {/* Two paths */}
      <section className="container mx-auto px-4 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-center mb-2">Two Paths. One Choice.</h2>
        <p className="text-center text-muted-foreground mb-12">Every call puts a patient on one of two paths.</p>
        <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <XCircle className="h-5 w-5 text-destructive" />
                TODAY
              </CardTitle>
              <CardContent className="pt-2 space-y-2 text-sm">
                <p>🩹 Injury</p>
                <p>📞 Patient Calls</p>
                <p>📵 Voicemail</p>
                <p>❌ Hangs Up</p>
                <p>🏃 Calls Competitor</p>
                <p className="font-semibold text-destructive">LOST PATIENT</p>
              </CardContent>
            </CardHeader>
          </Card>
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                WITH 24/7 CAPTURE
              </CardTitle>
              <CardContent className="pt-2 space-y-2 text-sm">
                <p>🩹 Injury</p>
                <p>📞 Patient Calls</p>
                <p>✅ Answered Instantly</p>
                <p>📋 Symptoms Triaged</p>
                <p>📅 Appointment Booked</p>
                <p className="font-semibold text-primary">PATIENT CAPTURED</p>
              </CardContent>
            </CardHeader>
          </Card>
        </div>
        <p className="mt-10 text-center text-muted-foreground max-w-2xl mx-auto">
          The clinic that answers first usually gets the patient. Speed is the single biggest factor in patient acquisition for orthopedic practices. When someone is in pain, their decision window is measured in minutes — not hours.
        </p>
      </section>

      {/* Revenue */}
      <section className="border-y bg-muted/20 py-16">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-4">Missed Calls = Lost Revenue</h2>
          <p className="text-center text-muted-foreground mb-8">A typical mid-size practice</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 max-w-4xl mx-auto mb-8">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-2xl font-bold">Missed Calls / Week</p>
                <p className="text-muted-foreground text-sm mt-1">Leads to</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-2xl font-bold">Lost New Patients</p>
                <p className="text-muted-foreground text-sm mt-1">And</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-2xl font-bold">Surgical Cases Gone</p>
                <p className="text-muted-foreground text-sm mt-1">=</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <DollarSign className="h-8 w-8 mx-auto text-primary" />
                <p className="text-xl font-bold mt-2">$120K+ – $360K+</p>
                <p className="text-muted-foreground text-sm mt-1">Lost per year</p>
              </CardContent>
            </Card>
          </div>
          <p className="text-center text-muted-foreground italic">
            These patients already called. Nobody answered.
          </p>
        </div>
      </section>

      {/* Digital Front Desk */}
      <section className="container mx-auto px-4 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-center mb-2">The Digital Front Desk</h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Think of it as a highly trained, tireless staff member available every hour of every day — purpose-built for orthopedic patient communication.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
          {[
            { icon: Phone, title: 'Answer Inbound Calls', desc: 'Every call picked up immediately, day or night, weekends and holidays included' },
            { icon: FileText, title: 'Qualify Patient Needs', desc: 'Structured intake questions identify urgency, symptoms, and care requirements' },
            { icon: CalendarCheck, title: 'Schedule Appointments', desc: 'Real-time booking directly into your existing calendar system' },
            { icon: Bell, title: 'Send Reminders & Follow-Ups', desc: 'Automated confirmations, prep instructions, and post-visit check-ins' },
          ].map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <item.icon className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-base">{item.title}</CardTitle>
                <CardDescription className="text-sm">{item.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
        <p className="mt-8 text-center text-muted-foreground max-w-xl mx-auto">
          Your clinical team stays focused on delivering exceptional care — not answering phones.
        </p>
      </section>

      {/* Surgical candidates */}
      <section className="border-y bg-muted/20 py-16">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-2">Identify Surgical Candidates Faster</h2>
          <div className="grid gap-4 sm:grid-cols-2 max-w-3xl mx-auto mt-8">
            {[
              'Acute Sports & Fall Injuries — Immediate trauma, high surgical need',
              'Severe or Worsening Joint Pain — Escalating symptoms, likely surgical',
              'Limited Mobility or Instability — Functional impairment, specialist required',
              'Prior Imaging or ER Referrals — Already in the diagnostic pipeline',
            ].map((line) => (
              <div key={line} className="flex items-start gap-2">
                <Stethoscope className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm">{line}</span>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-muted-foreground">
            High-priority callers are flagged instantly for staff follow-up.
          </p>
        </div>
      </section>

      {/* Auto scheduling */}
      <section className="container mx-auto px-4 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-center mb-2">Automatic Appointment Scheduling</h2>
        <p className="text-center text-muted-foreground mb-10 max-w-2xl mx-auto">
          Patients can book an appointment the moment they call — no waiting on hold, no phone tag. The system integrates with your clinic&apos;s calendar for real-time availability.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 max-w-3xl mx-auto">
          {[
            'Check Availability — Live calendar sync ensures accurate, real-time slot availability',
            'New Patient Booking — First-time patients scheduled without any staff involvement',
            'Rescheduling — Patients can reschedule anytime without calling during office hours',
            'Confirmations & Reminders — Automated texts and emails reduce no-shows',
          ].map((line) => (
            <div key={line} className="flex items-start gap-2">
              <CalendarCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <span className="text-sm">{line}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Intake before visit */}
      <section className="border-y bg-muted/20 py-16">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-2">Intake Before the Visit</h2>
          <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
            Information is collected during the very first call, giving your clinical team everything they need before the patient walks through the door.
          </p>
          <div className="grid gap-4 sm:grid-cols-3 max-w-4xl mx-auto mb-8">
            {[
              'Symptoms & Pain Level — Precise description and severity scale',
              'Injury & Imaging History — Prior diagnoses, surgeries, X-rays, MRIs',
              'Insurance Information — Coverage verified upfront for billing and authorization',
            ].map((item) => (
              <Card key={item}>
                <CardContent className="pt-6 text-sm">{item}</CardContent>
              </Card>
            ))}
          </div>
          <p className="text-center text-muted-foreground max-w-xl mx-auto">
            Doctors and PAs receive structured patient summaries before the appointment — faster consults, better surgical candidate identification, higher patient satisfaction.
          </p>
        </div>
      </section>

      {/* Reminders */}
      <section className="container mx-auto px-4 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-center mb-2">Reminders & Follow-Ups That Reduce No-Shows</h2>
        <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pre-Visit Support</CardTitle>
              <CardContent className="pt-2 space-y-1 text-sm text-muted-foreground">
                <p>• Appointment reminders via text and email</p>
                <p>• Preparation instructions and what to bring</p>
                <p>• Insurance and intake confirmation</p>
              </CardContent>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Post-Visit Follow-Up</CardTitle>
              <CardContent className="pt-2 space-y-1 text-sm text-muted-foreground">
                <p>• Recovery check-ins and pain monitoring</p>
                <p>• Physical therapy reminders and scheduling</p>
                <p>• Escalation alerts if symptoms worsen</p>
              </CardContent>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Implementation */}
      <section className="border-y bg-muted/20 py-16">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-2">Simple Implementation — Up and Running in Days</h2>
          <p className="text-center text-muted-foreground mb-10">
            No complex IT, no lengthy onboarding. Most clinics are live within days.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
            {[
              { icon: Phone, step: 'Connect Phone', desc: 'Integrate your phone for seamless communication' },
              { icon: Calendar, step: 'Connect Calendar', desc: 'Sync your schedule for real-time availability' },
              { icon: LayoutGrid, step: 'Customize Triage', desc: 'Set up rules and filters for incoming tasks' },
              { icon: Zap, step: 'Go Live', desc: 'Launch and start capturing patients' },
            ].map((item) => (
              <Card key={item.step}>
                <CardHeader>
                  <item.icon className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-base">{item.step}</CardTitle>
                  <CardDescription>{item.desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* What clinics see */}
      <section className="container mx-auto px-4 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-center mb-10">What Clinics Typically See</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
          {[
            { title: 'Fewer Missed Calls', desc: 'Every inbound call answered, around the clock' },
            { title: 'More Patients Captured', desc: 'New patients scheduled before they call a competitor' },
            { title: 'Reduced Front Desk Workload', desc: 'Staff freed from phone management to focus on in-clinic care' },
            { title: 'Better Patient Experience', desc: 'Faster service, less waiting, more consistent communication' },
          ].map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <CheckCircle2 className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-base">{item.title}</CardTitle>
                <CardDescription>{item.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Demo form + CTA */}
      <section id="demo" className="border-t bg-primary/5 py-16">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-center mb-2">Request a Demo</h2>
            <p className="text-center text-muted-foreground mb-8">
              Get in touch and we&apos;ll show you how 24/7 capture works for your practice.
            </p>
            <form onSubmit={handleDemoSubmit} className="space-y-4">
              <div>
                <Label htmlFor="demo-name">Name *</Label>
                <Input
                  id="demo-name"
                  value={demoForm.name}
                  onChange={(e) => setDemoForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Your name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="demo-email">Email *</Label>
                <Input
                  id="demo-email"
                  type="email"
                  value={demoForm.email}
                  onChange={(e) => setDemoForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@clinic.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="demo-phone">Phone *</Label>
                <Input
                  id="demo-phone"
                  value={demoForm.phone}
                  onChange={(e) => setDemoForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="(555) 000-0000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="demo-message">Message (optional)</Label>
                <Textarea
                  id="demo-message"
                  value={demoForm.message}
                  onChange={(e) => setDemoForm((f) => ({ ...f, message: e.target.value }))}
                  placeholder="Tell us about your practice..."
                  className="mt-1 min-h-[80px]"
                />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? 'Sending...' : 'Request demo'}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Or <Link href="/get-started" className="text-primary underline">get started</Link> now.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to home</Link>
          <div className="flex items-center gap-6">
            <Link href="/ortho" className="text-sm text-muted-foreground hover:text-foreground">For Ortho</Link>
            <Link href="/get-started" className="text-sm text-muted-foreground hover:text-foreground">Get started</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
