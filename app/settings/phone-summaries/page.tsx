'use client'

import { Suspense } from 'react'
import { CallVoiceAiTab } from '@/components/settings/call-voice-ai-tab'
import { useSettingsEditClinicId } from '@/components/settings/use-settings-edit-clinic'

function PhoneSummariesBody() {
  const editClinicId = useSettingsEditClinicId()
  return <CallVoiceAiTab superAdminClinicId={editClinicId} />
}

export default function PhoneSummariesPage() {
  return (
    <Suspense
      fallback={<div className="flex justify-center py-16 text-sm text-muted-foreground">Loading…</div>}
    >
      <PhoneSummariesBody />
    </Suspense>
  )
}
