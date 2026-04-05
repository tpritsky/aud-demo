'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProactiveCheckInsTab } from '@/components/settings/proactive-checkins-tab'
import { useSettingsEditClinicId } from '@/components/settings/use-settings-edit-clinic'

function CheckInsBody() {
  const editClinicId = useSettingsEditClinicId()

  if (editClinicId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check-ins</CardTitle>
          <CardDescription>
            Proactive sequences are stored per signed-in user, not on the business record. To edit check-ins for this
            company, use <strong>View as</strong> from the user list and open Check-ins while impersonating a team member
            at this business.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/businesses">Open businesses</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return <ProactiveCheckInsTab />
}

export default function CheckInsPage() {
  return (
    <Suspense
      fallback={<div className="flex justify-center py-16 text-sm text-muted-foreground">Loading…</div>}
    >
      <CheckInsBody />
    </Suspense>
  )
}
