'use client'

import { AppShell } from '@/components/layout/app-shell'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AgentConfigurationTab } from '@/components/settings/agent-configuration-tab'
import { ProactiveCheckInsTab } from '@/components/settings/proactive-checkins-tab'
import { Bot, CalendarClock } from 'lucide-react'

export default function SettingsPage() {
  return (
    <AppShell title="Settings">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Manage your AI agent settings and proactive outreach sequences.
          </p>
        </div>

        <Tabs defaultValue="agent" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="agent" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Agent Configuration
            </TabsTrigger>
            <TabsTrigger value="checkins" className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Proactive Check-ins
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agent">
            <AgentConfigurationTab />
          </TabsContent>

          <TabsContent value="checkins">
            <ProactiveCheckInsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
