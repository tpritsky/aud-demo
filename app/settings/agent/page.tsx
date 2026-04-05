import { redirect } from 'next/navigation'
import { DEFAULT_AGENT_SECTION, slugFromAgentSection } from '@/lib/settings-agent-sections'

/** `/settings/agent` alone has no [section]; send users to the default workspace tab. */
export default function SettingsAgentIndexPage() {
  redirect(`/settings/agent/${slugFromAgentSection(DEFAULT_AGENT_SECTION)}`)
}
