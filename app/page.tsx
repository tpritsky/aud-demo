import type { Metadata } from 'next'
import { HomePageClient } from '@/components/home/home-page-client'

/** Explicit homepage metadata for crawlers (layout defaults apply elsewhere). */
export const metadata: Metadata = {
  title: {
    absolute: 'Vocalis — AI voice receptionist',
  },
  description:
    'AI-powered voice agent handles inbound calls 24/7—appointments, device troubleshooting, scheduling, and a consistent caller experience for clinics and service teams.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Vocalis — AI voice receptionist',
    description:
      'AI-powered voice agent handles inbound calls 24/7—appointments, troubleshooting, scheduling, and more.',
    url: '/',
    type: 'website',
  },
}

export default function HomePage() {
  return <HomePageClient />
}
