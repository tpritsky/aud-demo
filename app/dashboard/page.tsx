import { DashboardClient } from './dashboard-client'

type Search = Record<string, string | string[] | undefined>

function firstString(v: string | string[] | undefined): string | null {
  if (typeof v === 'string') {
    const t = v.trim()
    return t || null
  }
  if (Array.isArray(v) && v[0]) {
    const t = String(v[0]).trim()
    return t || null
  }
  return null
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const viewAsUserId = firstString(sp.viewAs)
  return <DashboardClient viewAsUserId={viewAsUserId} />
}
