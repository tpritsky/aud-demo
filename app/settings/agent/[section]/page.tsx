'use client'

import { Suspense, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  DEFAULT_AGENT_SECTION,
  isAgentSectionSlug,
  slugFromAgentSection,
  type AgentWorkspaceKey,
} from '@/lib/settings-agent-sections'
import { AgentWorkspaceTab } from '@/components/settings/agent-workspace-tab'
import { useSettingsEditClinicId } from '@/components/settings/use-settings-edit-clinic'

function AgentSectionBody() {
  const params = useParams()
  const router = useRouter()
  const slug = typeof params.section === 'string' ? params.section : ''
  const section: AgentWorkspaceKey | null = isAgentSectionSlug(slug) ? slug : null
  const editClinicId = useSettingsEditClinicId()

  useEffect(() => {
    if (slug && !section) {
      router.replace(`/settings/agent/${slugFromAgentSection(DEFAULT_AGENT_SECTION)}`)
    }
  }, [slug, section, router])

  if (!section) {
    return (
      <div className="flex justify-center py-16 text-sm text-muted-foreground">
        Redirecting…
      </div>
    )
  }

  return <AgentWorkspaceTab section={section} superAdminClinicId={editClinicId} />
}

export default function AgentSectionPage() {
  return (
    <Suspense
      fallback={<div className="flex justify-center py-16 text-sm text-muted-foreground">Loading…</div>}
    >
      <AgentSectionBody />
    </Suspense>
  )
}
