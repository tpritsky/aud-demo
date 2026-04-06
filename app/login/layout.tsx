/** Avoid serving a cached /login shell that skips session reset after deploy. */
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function LoginRouteLayout({ children }: { children: React.ReactNode }) {
  return children
}
