'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'
import { VoiceStyle } from '@/lib/types'
import { Save, Building2, Phone, Clock, Mic, Gauge, Settings2, AlertTriangle, PhoneCall, RotateCcw } from 'lucide-react'
// useToast not needed - using toast directly from sonner

export function AgentConfigurationTab() {
  const { agentConfig, setAgentConfig } = useAppStore()

  const handleSave = () => {
    toast.success('Settings Saved', {
      description: 'Agent configuration has been updated successfully.',
    })
  }

  const updateConfig = <K extends keyof typeof agentConfig>(
    key: K,
    value: typeof agentConfig[K]
  ) => {
    setAgentConfig({ ...agentConfig, [key]: value })
  }

  const updateAllowedIntents = (key: keyof typeof agentConfig.allowedIntents, value: boolean) => {
    setAgentConfig({
      ...agentConfig,
      allowedIntents: { ...agentConfig.allowedIntents, [key]: value },
    })
  }

  const updateEscalationRules = (
    key: keyof typeof agentConfig.escalationRules,
    value: boolean
  ) => {
    setAgentConfig({
      ...agentConfig,
      escalationRules: { ...agentConfig.escalationRules, [key]: value },
    })
  }

  const updateCallbackSettings = <K extends keyof typeof agentConfig.callbackSettings>(
    key: K,
    value: typeof agentConfig.callbackSettings[K]
  ) => {
    setAgentConfig({
      ...agentConfig,
      callbackSettings: { ...agentConfig.callbackSettings, [key]: value },
    })
  }

  return (
    <div className="space-y-6">
      {/* Clinic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Clinic Information
          </CardTitle>
          <CardDescription>
            Basic information about your clinic that the AI agent will use.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clinic-name">Clinic Name</Label>
              <Input
                id="clinic-name"
                value={agentConfig.clinicName}
                onChange={(e) => updateConfig('clinicName', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone-number">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone-number"
                  value={agentConfig.phoneNumber}
                  onChange={(e) => updateConfig('phoneNumber', e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="elevenlabs-agent-id">Eleven Labs Inbound Agent ID</Label>
              <Input
                id="elevenlabs-agent-id"
                value={agentConfig.elevenLabsAgentId || ''}
                onChange={(e) => updateConfig('elevenLabsAgentId', e.target.value)}
                placeholder="agent_..."
              />
              <p className="text-xs text-muted-foreground">
                Your Eleven Labs agent ID for inbound calls
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="elevenlabs-outbound-agent-id">Eleven Labs Outbound Agent ID</Label>
              <Input
                id="elevenlabs-outbound-agent-id"
                value={agentConfig.elevenLabsOutboundAgentId || ''}
                onChange={(e) => updateConfig('elevenLabsOutboundAgentId', e.target.value)}
                placeholder="agent_..."
              />
              <p className="text-xs text-muted-foreground">
                Your Eleven Labs agent ID for outbound calls (with dynamic variables support)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="elevenlabs-phone-id">Eleven Labs Phone Number ID</Label>
              <Input
                id="elevenlabs-phone-id"
                value={agentConfig.elevenLabsPhoneNumberId || ''}
                onChange={(e) => updateConfig('elevenLabsPhoneNumberId', e.target.value)}
                placeholder="phnum_..."
              />
              <p className="text-xs text-muted-foreground">
                Your Eleven Labs phone number ID for outbound calls
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hours-open">Opening Time</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="hours-open"
                  type="time"
                  value={agentConfig.hoursOpen}
                  onChange={(e) => updateConfig('hoursOpen', e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hours-close">Closing Time</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="hours-close"
                  type="time"
                  value={agentConfig.hoursClose}
                  onChange={(e) => updateConfig('hoursClose', e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Voice Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Voice Settings
          </CardTitle>
          <CardDescription>
            Configure how the AI agent sounds when speaking to patients.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="voice-style">Voice Style</Label>
            <Select
              value={agentConfig.voiceStyle}
              onValueChange={(v) => updateConfig('voiceStyle', v as VoiceStyle)}
            >
              <SelectTrigger id="voice-style">
                <SelectValue placeholder="Select voice style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="calm">Calm - Soothing and reassuring</SelectItem>
                <SelectItem value="neutral">Neutral - Professional and balanced</SelectItem>
                <SelectItem value="upbeat">Upbeat - Friendly and energetic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="speech-speed" className="flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                Speech Speed
              </Label>
              <span className="text-sm text-muted-foreground">
                {agentConfig.speechSpeed.toFixed(1)}x
              </span>
            </div>
            <Slider
              id="speech-speed"
              value={[agentConfig.speechSpeed]}
              onValueChange={([value]) => updateConfig('speechSpeed', value)}
              min={0.5}
              max={1.5}
              step={0.1}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Slower</span>
              <span>Normal</span>
              <span>Faster</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Allowed Intents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Allowed Intents
          </CardTitle>
          <CardDescription>
            Control which types of requests the AI agent can handle autonomously.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            {
              key: 'scheduling' as const,
              label: 'Scheduling',
              description: 'Book new appointments',
            },
            {
              key: 'rescheduleCancel' as const,
              label: 'Reschedule/Cancel',
              description: 'Modify or cancel existing appointments',
            },
            {
              key: 'newPatientIntake' as const,
              label: 'New Patient Intake',
              description: 'Collect information from new patients',
            },
            {
              key: 'deviceTroubleshooting' as const,
              label: 'Device Troubleshooting',
              description: 'Help with hearing aid issues',
            },
            {
              key: 'billing' as const,
              label: 'Billing Inquiries',
              description: 'Answer basic billing questions',
            },
          ].map((intent) => (
            <div key={intent.key} className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor={`intent-${intent.key}`} className="text-base">
                  {intent.label}
                </Label>
                <p className="text-sm text-muted-foreground">{intent.description}</p>
              </div>
              <Switch
                id={`intent-${intent.key}`}
                checked={agentConfig.allowedIntents[intent.key]}
                onCheckedChange={(checked) => updateAllowedIntents(intent.key, checked)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Escalation Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Escalation Rules
          </CardTitle>
          <CardDescription>
            Define when calls should be automatically escalated to a human.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            {
              key: 'medicalQuestion' as const,
              label: 'Medical Questions',
              description: 'Escalate if caller asks medical advice questions',
            },
            {
              key: 'upsetSentiment' as const,
              label: 'Upset Sentiment',
              description: 'Escalate if caller appears frustrated or angry',
            },
            {
              key: 'repeatedMisunderstanding' as const,
              label: 'Repeated Misunderstanding',
              description: 'Escalate after multiple failed understanding attempts',
            },
            {
              key: 'userRequestsHuman' as const,
              label: 'User Requests Human',
              description: 'Escalate when caller explicitly asks for a person',
            },
          ].map((rule) => (
            <div key={rule.key} className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor={`rule-${rule.key}`} className="text-base">
                  {rule.label}
                </Label>
                <p className="text-sm text-muted-foreground">{rule.description}</p>
              </div>
              <Switch
                id={`rule-${rule.key}`}
                checked={agentConfig.escalationRules[rule.key]}
                onCheckedChange={(checked) => updateEscalationRules(rule.key, checked)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Callback Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5" />
            Callback Settings
          </CardTitle>
          <CardDescription>
            Configure how callback tasks are created and managed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="max-attempts" className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Max Redial Attempts
              </Label>
              <Select
                value={agentConfig.callbackSettings.maxAttempts.toString()}
                onValueChange={(v) => updateCallbackSettings('maxAttempts', parseInt(v))}
              >
                <SelectTrigger id="max-attempts">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} attempt{n !== 1 ? 's' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Maximum number of call attempts before marking as unreachable
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="redial-interval" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Redial Interval
              </Label>
              <Select
                value={agentConfig.callbackSettings.redialIntervalMinutes.toString()}
                onValueChange={(v) => updateCallbackSettings('redialIntervalMinutes', parseInt(v))}
              >
                <SelectTrigger id="redial-interval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="240">4 hours</SelectItem>
                  <SelectItem value="480">8 hours</SelectItem>
                  <SelectItem value="1440">24 hours</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Minimum time between callback attempts
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Default Priority</Label>
            <Select
              value={agentConfig.callbackSettings.priorityByDefault}
              onValueChange={(v) => updateCallbackSettings('priorityByDefault', v as 'high' | 'medium' | 'low')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High - Within 1 hour</SelectItem>
                <SelectItem value="medium">Medium - Within 24 hours</SelectItem>
                <SelectItem value="low">Low - Within 48 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-4">
            <Label>Auto-Create Callback Tasks</Label>
            {[
              {
                key: 'autoCreateOnEscalation' as const,
                label: 'On Escalation',
                description: 'Create callback when a call is escalated',
              },
              {
                key: 'autoCreateOnVoicemail' as const,
                label: 'On Voicemail',
                description: 'Create callback when call goes to voicemail',
              },
              {
                key: 'autoCreateOnNoAnswer' as const,
                label: 'On No Answer',
                description: 'Create callback when patient doesn\'t answer',
              },
            ].map((setting) => (
              <div key={setting.key} className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor={`callback-${setting.key}`} className="text-base">
                    {setting.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">{setting.description}</p>
                </div>
                <Switch
                  id={`callback-${setting.key}`}
                  checked={agentConfig.callbackSettings[setting.key]}
                  onCheckedChange={(checked) => updateCallbackSettings(setting.key, checked)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} size="lg">
          <Save className="h-4 w-4 mr-2" />
          Save Configuration
        </Button>
      </div>
    </div>
  )
}
