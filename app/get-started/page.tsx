import { GetStartedClient } from './get-started-client'

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

function searchParamsToQueryString(sp: Search): string {
  const usp = new URLSearchParams()
  for (const [key, val] of Object.entries(sp)) {
    if (val === undefined) continue
    if (Array.isArray(val)) {
      for (const item of val) usp.append(key, String(item))
    } else {
      usp.set(key, val)
    }
  }
  return usp.toString()
}

export default async function GetStartedPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const setupClinicId = firstString(sp.clinicId)
  const redirectQueryString = searchParamsToQueryString(sp)
  return <GetStartedClient setupClinicId={setupClinicId} redirectQueryString={redirectQueryString} />
}
