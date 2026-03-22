'use client'

import { AppShell } from '@/components/layout/app-shell'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AgentConfigurationTab } from '@/components/settings/agent-configuration-tab'
import { ProactiveCheckInsTab } from '@/components/settings/proactive-checkins-tab'
import { DeleteAccountSection } from '@/components/settings/delete-account-section'
import { Bot, CalendarClock, UserX } from 'lucide-react'

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
          <TabsList className="grid w-full max-w-2xl grid-cols-3">
            <TabsTrigger value="agent" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Agent
            </TabsTrigger>
            <TabsTrigger value="checkins" className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Check-ins
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center gap-2">
              <UserX className="h-4 w-4" />
              Account
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agent">
            <AgentConfigurationTab />
          </TabsContent>

          <TabsContent value="checkins">
            <ProactiveCheckInsTab />
          </TabsContent>

          <TabsContent value="account">
            <DeleteAccountSection />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
