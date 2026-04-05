import { redirect } from 'next/navigation'
import { DEFAULT_AGENT_SECTION, slugFromAgentSection } from '@/lib/settings-agent-sections'

export default function SettingsIndexPage() {
  redirect(`/settings/agent/${slugFromAgentSection(DEFAULT_AGENT_SECTION)}`)
}
