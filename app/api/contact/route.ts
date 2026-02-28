import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, business_type, phone_spend, message } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return NextResponse.json({ error: 'Phone is required' }, { status: 400 })
    }
    if (!business_type || typeof business_type !== 'string' || !business_type.trim()) {
      return NextResponse.json({ error: 'Business type is required' }, { status: 400 })
    }
    if (!phone_spend || typeof phone_spend !== 'string' || !phone_spend.trim()) {
      return NextResponse.json({ error: 'Current spend is required' }, { status: 400 })
    }

    const supabase = createServerClient()
    const { error } = await supabase.from('contact_submissions').insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      business_type: business_type.trim(),
      phone_spend: phone_spend.trim(),
      message: message && typeof message === 'string' ? message.trim() || null : null,
    })

    if (error) {
      console.error('Contact submission error:', error)
      return NextResponse.json({ error: 'Failed to submit' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Contact API error:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
