import {
  Call,
  Patient,
  ProactiveSequence,
  CallbackTask,
  ActivityEvent,
  AgentConfig,
  KPIData,
} from './types'

// Helper to create dates relative to now
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000)
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000)

// Mock Calls Data
export const mockCalls: Call[] = [
  {
    id: 'call-001',
    timestamp: hoursAgo(1),
    callerName: 'Margaret Wilson',
    phone: '(555) 123-4567',
    patientId: 'patient-001',
    intent: 'device_troubleshooting',
    outcome: 'resolved',
    status: 'resolved',
    durationSec: 342,
    sentiment: 'neutral',
    escalated: false,
    summary: {
      reason: 'Bluetooth connectivity issues with hearing aids',
      resolution: 'Walked patient through re-pairing process with smartphone',
      nextSteps: 'Follow up in 3 days to ensure connection remains stable',
    },
    transcript: `Agent: Good morning, thank you for calling Harmony Hearing Clinic. This is your AI assistant. How may I help you today?

Patient: Hi, I'm having trouble with my hearing aids connecting to my phone.

Agent: I understand, Bluetooth connectivity issues can be frustrating. Let me help you with that. First, can you tell me which hearing aid model you have?

Patient: They're the Phonak Paradise P90s.

Agent: Great, those are excellent devices. Let's try re-pairing them. First, please open your phone's Bluetooth settings and forget the existing hearing aid connections.

Patient: Okay, I've done that.

Agent: Perfect. Now, open and close the battery doors on both hearing aids to restart them. Then open your Phonak app and follow the pairing prompts.

Patient: Oh, it's connecting now! Both of them are showing up.

Agent: Wonderful! That should resolve the issue. Is there anything else I can help you with today?

Patient: No, that's all. Thank you so much!

Agent: You're welcome, Mrs. Wilson. Have a great day!`,
    entities: {
      name: 'Margaret Wilson',
      phone: '(555) 123-4567',
      deviceBrand: 'Phonak',
      deviceModel: 'Paradise P90',
      issueType: 'Bluetooth connectivity',
    },
  },
  {
    id: 'call-002',
    timestamp: hoursAgo(3),
    callerName: 'Robert Chen',
    phone: '(555) 234-5678',
    patientId: 'patient-002',
    intent: 'scheduling',
    outcome: 'resolved',
    status: 'resolved',
    durationSec: 198,
    sentiment: 'positive',
    escalated: false,
    summary: {
      reason: 'Requesting appointment for annual hearing check',
      resolution: 'Scheduled appointment for next Tuesday at 2:00 PM',
      nextSteps: 'Send appointment confirmation via SMS',
    },
    transcript: `Agent: Good afternoon, Harmony Hearing Clinic. How can I assist you?

Patient: I'd like to schedule my annual hearing checkup.

Agent: Of course, Mr. Chen. I can see you're due for your annual evaluation. Let me check our availability. Would next week work for you?

Patient: Yes, preferably Tuesday or Wednesday afternoon.

Agent: I have Tuesday at 2:00 PM or Wednesday at 3:30 PM available. Which would you prefer?

Patient: Tuesday at 2 PM works perfectly.

Agent: Excellent! I've scheduled you for Tuesday, January 21st at 2:00 PM with Dr. Martinez. You'll receive a confirmation text shortly.

Patient: Great, thank you!

Agent: You're welcome. See you next Tuesday!`,
    entities: {
      name: 'Robert Chen',
      phone: '(555) 234-5678',
    },
  },
  {
    id: 'call-003',
    timestamp: hoursAgo(5),
    callerName: 'Susan Martinez',
    phone: '(555) 345-6789',
    patientId: 'patient-003',
    intent: 'device_troubleshooting',
    outcome: 'escalated',
    status: 'escalated',
    durationSec: 456,
    sentiment: 'negative',
    escalated: true,
    summary: {
      reason: 'Severe feedback and whistling from new hearing aids',
      resolution: 'Escalated to audiologist for fitting adjustment',
      nextSteps: 'Urgent callback scheduled for today',
    },
    transcript: `Agent: Hello, thank you for calling Harmony Hearing Clinic.

Patient: My new hearing aids are making a terrible whistling sound and I can barely stand it!

Agent: I'm sorry to hear you're experiencing that discomfort. Let me help troubleshoot this with you. When did this whistling start?

Patient: It started two days ago. I got these fitted last week and they were fine at first.

Agent: I understand. Have you noticed if it happens more in certain situations, like when you're near walls or wearing a hat?

Patient: It's constant! It doesn't matter what I'm doing. This is really affecting my quality of life.

Agent: I can hear how frustrated you are, and I want to make sure we resolve this properly. This sounds like it may need a physical adjustment to your ear molds. Let me connect you with our audiologist team who can schedule an urgent fitting adjustment for you.

Patient: Yes, please. I need this fixed as soon as possible.

Agent: Absolutely. I'm creating a priority callback request right now. Someone from our team will call you within the hour to schedule an emergency appointment. Is this the best number to reach you?

Patient: Yes, this is my cell.

Agent: Perfect. You should hear from us very soon, Mrs. Martinez.`,
    entities: {
      name: 'Susan Martinez',
      phone: '(555) 345-6789',
      issueType: 'Feedback/whistling',
    },
  },
  {
    id: 'call-004',
    timestamp: hoursAgo(7),
    callerName: 'James Thompson',
    phone: '(555) 456-7890',
    intent: 'new_patient',
    outcome: 'resolved',
    status: 'resolved',
    durationSec: 524,
    sentiment: 'positive',
    escalated: false,
    summary: {
      reason: 'New patient inquiry about hearing evaluation',
      resolution: 'Collected intake information and scheduled initial consultation',
      nextSteps: 'Send new patient forms via email',
    },
    transcript: `Agent: Good morning, Harmony Hearing Clinic. How may I help you?

Caller: Hi, I've been noticing some hearing loss lately and my wife keeps telling me to get it checked. I've never been to an audiologist before.

Agent: I'm glad you decided to reach out, Mr. Thompson. It's very common for people to notice gradual changes in their hearing. We'd be happy to help. Let me get some information to set up your first appointment.

Caller: Sure, what do you need?

Agent: First, can I get your full name and date of birth?

Caller: James Thompson, born March 15, 1958.

Agent: Thank you. And a phone number and email where we can reach you?

Caller: This number is fine - 555-456-7890. And my email is jthompson@email.com.

Agent: Perfect. Do you have any insurance you'd like us to verify coverage for?

Caller: Yes, I have Blue Cross Blue Shield.

Agent: Great, we accept that insurance. I have an opening for a comprehensive hearing evaluation next Monday at 10 AM. Would that work?

Caller: That works great.

Agent: Wonderful! I'll send you some new patient forms to fill out before your visit. Is there anything specific you've noticed about your hearing that you'd like me to note for the audiologist?

Caller: Mainly trouble hearing conversations in restaurants or when there's background noise.

Agent: That's very helpful information. I've noted that. You'll receive a confirmation email shortly with all the details.

Caller: Thank you so much!`,
    entities: {
      name: 'James Thompson',
      phone: '(555) 456-7890',
      issueType: 'Hearing evaluation - new patient',
    },
  },
  {
    id: 'call-005',
    timestamp: daysAgo(1),
    callerName: 'Dorothy Adams',
    phone: '(555) 567-8901',
    patientId: 'patient-004',
    intent: 'billing',
    outcome: 'transferred',
    status: 'pending_callback',
    durationSec: 187,
    sentiment: 'neutral',
    escalated: true,
    summary: {
      reason: 'Questions about insurance coverage for hearing aid accessories',
      resolution: 'Transferred to billing department',
      nextSteps: 'Billing team to follow up',
    },
    transcript: `Agent: Harmony Hearing Clinic, how can I help you?

Patient: I have some questions about my bill. I'm not sure what my insurance covered for the accessories I bought.

Agent: I'd be happy to help clarify that. Can you tell me which items you're asking about?

Patient: The dehumidifier kit and extra batteries I got last month.

Agent: I see. For detailed billing and insurance coverage questions, our billing specialists can provide the most accurate information. Would you like me to transfer you to our billing department, or would you prefer a callback?

Patient: A transfer would be fine.

Agent: Of course. Let me connect you now. Please hold for just a moment.`,
    entities: {
      name: 'Dorothy Adams',
      phone: '(555) 567-8901',
      issueType: 'Billing inquiry',
    },
  },
  {
    id: 'call-006',
    timestamp: daysAgo(1),
    callerName: 'Michael Brown',
    phone: '(555) 678-9012',
    patientId: 'patient-005',
    intent: 'reschedule',
    outcome: 'resolved',
    status: 'resolved',
    durationSec: 156,
    sentiment: 'positive',
    escalated: false,
    summary: {
      reason: 'Rescheduling follow-up appointment due to conflict',
      resolution: 'Moved appointment from Thursday to Friday same time',
      nextSteps: 'Updated confirmation sent',
    },
    transcript: `Agent: Harmony Hearing Clinic, this is your AI assistant.

Patient: Hi, I need to reschedule my appointment for Thursday.

Agent: Of course, Mr. Brown. I can see you have a follow-up scheduled for Thursday at 11 AM. What day works better for you?

Patient: Can I do Friday instead, same time if possible?

Agent: Let me check... Yes, Friday at 11 AM is available. Shall I move your appointment?

Patient: Yes, please.

Agent: Done! Your appointment is now Friday, January 17th at 11 AM. You'll receive an updated confirmation.

Patient: Perfect, thanks!`,
    entities: {
      name: 'Michael Brown',
      phone: '(555) 678-9012',
    },
  },
  {
    id: 'call-007',
    timestamp: daysAgo(2),
    callerName: 'Eleanor White',
    phone: '(555) 789-0123',
    patientId: 'patient-006',
    intent: 'device_troubleshooting',
    outcome: 'resolved',
    status: 'resolved',
    durationSec: 412,
    sentiment: 'neutral',
    escalated: false,
    summary: {
      reason: 'Hearing aids not turning on',
      resolution: 'Identified dead batteries, guided through replacement',
      nextSteps: 'Recommended ordering backup batteries',
    },
    transcript: `Agent: Good afternoon, Harmony Hearing Clinic.

Patient: My hearing aids aren't working at all. They won't turn on.

Agent: I'm sorry to hear that, Mrs. White. Let's troubleshoot together. First, when did you last change the batteries?

Patient: Oh, I'm not sure... maybe two weeks ago?

Agent: That could be the issue. Size 312 batteries typically last 7-10 days with regular use. Do you have fresh batteries available?

Patient: Let me check... yes, I have a pack here.

Agent: Great. Please open the battery doors, remove the old batteries, and insert the new ones. Make sure the positive side with the + sign faces up.

Patient: Okay, I'm doing that now... Oh! They're beeping!

Agent: Excellent! That beep indicates they're powering on. How do they sound now?

Patient: Much better! I can't believe it was just the batteries.

Agent: It's a common issue. I'd recommend keeping a backup pack nearby. Would you like me to note that you may need more batteries ordered?

Patient: Yes, please. Thank you for your help!`,
    entities: {
      name: 'Eleanor White',
      phone: '(555) 789-0123',
      issueType: 'Device not powering on',
    },
  },
  {
    id: 'call-008',
    timestamp: daysAgo(3),
    callerName: 'Frank Garcia',
    phone: '(555) 890-1234',
    patientId: 'patient-007',
    intent: 'cancel',
    outcome: 'resolved',
    status: 'resolved',
    durationSec: 98,
    sentiment: 'neutral',
    escalated: false,
    summary: {
      reason: 'Cancelling appointment due to illness',
      resolution: 'Appointment cancelled, will call to reschedule when feeling better',
      nextSteps: 'Patient to call back to reschedule',
    },
    transcript: `Agent: Harmony Hearing Clinic, how can I help you?

Patient: I need to cancel my appointment for tomorrow. I've come down with a cold.

Agent: I'm sorry to hear you're not feeling well, Mr. Garcia. I can cancel your appointment for tomorrow at 3 PM. Would you like to reschedule now or call back when you're feeling better?

Patient: I'll call back once I'm over this cold.

Agent: No problem at all. I've cancelled your appointment. Feel better soon, and give us a call when you're ready to reschedule.

Patient: Thank you, I will.`,
    entities: {
      name: 'Frank Garcia',
      phone: '(555) 890-1234',
    },
  },
]

// Mock Patients Data
export const mockPatients: Patient[] = [
  {
    id: 'patient-001',
    name: 'Margaret Wilson',
    phone: '(555) 123-4567',
    email: 'mwilson@email.com',
    tags: ['Existing'],
    riskScore: 25,
    riskReasons: [],
    lastContactAt: hoursAgo(1),
    adoptionSignals: {
      woreToday: true,
      estimatedHoursWorn: 12,
      comfortIssues: false,
      soundClarityIssues: false,
      bluetoothAppIssues: true,
    },
    proactiveCheckInsEnabled: true,
    deviceBrand: 'Phonak',
    deviceModel: 'Paradise P90',
    fittingDate: daysAgo(180),
  },
  {
    id: 'patient-002',
    name: 'Robert Chen',
    phone: '(555) 234-5678',
    email: 'rchen@email.com',
    tags: ['Existing'],
    riskScore: 10,
    riskReasons: [],
    lastContactAt: hoursAgo(3),
    adoptionSignals: {
      woreToday: true,
      estimatedHoursWorn: 14,
      comfortIssues: false,
      soundClarityIssues: false,
      bluetoothAppIssues: false,
    },
    proactiveCheckInsEnabled: false,
    deviceBrand: 'Oticon',
    deviceModel: 'More 1',
    fittingDate: daysAgo(365),
  },
  {
    id: 'patient-003',
    name: 'Susan Martinez',
    phone: '(555) 345-6789',
    email: 'smartinez@email.com',
    tags: ['New Fit', 'High Risk'],
    riskScore: 85,
    riskReasons: ['Recent escalation', 'Device issues within first week', 'Expressed frustration'],
    lastContactAt: hoursAgo(5),
    adoptionSignals: {
      woreToday: false,
      estimatedHoursWorn: 2,
      comfortIssues: true,
      soundClarityIssues: true,
      bluetoothAppIssues: false,
    },
    proactiveCheckInsEnabled: true,
    deviceBrand: 'ReSound',
    deviceModel: 'ONE 9',
    fittingDate: daysAgo(7),
  },
  {
    id: 'patient-004',
    name: 'Dorothy Adams',
    phone: '(555) 567-8901',
    email: 'dadams@email.com',
    tags: ['Existing'],
    riskScore: 30,
    riskReasons: ['Billing concerns'],
    lastContactAt: daysAgo(1),
    adoptionSignals: {
      woreToday: true,
      estimatedHoursWorn: 10,
      comfortIssues: false,
      soundClarityIssues: false,
      bluetoothAppIssues: false,
    },
    proactiveCheckInsEnabled: false,
    deviceBrand: 'Starkey',
    deviceModel: 'Genesis AI',
    fittingDate: daysAgo(90),
  },
  {
    id: 'patient-005',
    name: 'Michael Brown',
    phone: '(555) 678-9012',
    email: 'mbrown@email.com',
    tags: ['Existing'],
    riskScore: 15,
    riskReasons: [],
    lastContactAt: daysAgo(1),
    adoptionSignals: {
      woreToday: true,
      estimatedHoursWorn: 11,
      comfortIssues: false,
      soundClarityIssues: false,
      bluetoothAppIssues: false,
    },
    proactiveCheckInsEnabled: true,
    deviceBrand: 'Widex',
    deviceModel: 'Moment Sheer',
    fittingDate: daysAgo(120),
  },
  {
    id: 'patient-006',
    name: 'Eleanor White',
    phone: '(555) 789-0123',
    email: 'ewhite@email.com',
    tags: ['Existing', 'High Risk'],
    riskScore: 65,
    riskReasons: ['Low usage hours', 'Frequent battery issues', 'May need additional training'],
    lastContactAt: daysAgo(2),
    adoptionSignals: {
      woreToday: null,
      estimatedHoursWorn: 4,
      comfortIssues: false,
      soundClarityIssues: true,
      bluetoothAppIssues: false,
    },
    proactiveCheckInsEnabled: true,
    deviceBrand: 'Phonak',
    deviceModel: 'Audeo L90',
    fittingDate: daysAgo(45),
  },
  {
    id: 'patient-007',
    name: 'Frank Garcia',
    phone: '(555) 890-1234',
    email: 'fgarcia@email.com',
    tags: ['Existing'],
    riskScore: 20,
    riskReasons: [],
    lastContactAt: daysAgo(3),
    adoptionSignals: {
      woreToday: true,
      estimatedHoursWorn: 8,
      comfortIssues: false,
      soundClarityIssues: false,
      bluetoothAppIssues: false,
    },
    proactiveCheckInsEnabled: false,
    deviceBrand: 'Signia',
    deviceModel: 'Pure Charge&Go IX',
    fittingDate: daysAgo(200),
  },
  {
    id: 'patient-008',
    name: 'Helen Davis',
    phone: '(555) 901-2345',
    email: 'hdavis@email.com',
    tags: ['New Fit'],
    riskScore: 45,
    riskReasons: ['New fitting - monitoring period'],
    lastContactAt: daysAgo(2),
    adoptionSignals: {
      woreToday: true,
      estimatedHoursWorn: 6,
      comfortIssues: true,
      soundClarityIssues: false,
      bluetoothAppIssues: false,
    },
    proactiveCheckInsEnabled: true,
    deviceBrand: 'Oticon',
    deviceModel: 'Real 1',
    fittingDate: daysAgo(3),
  },
  {
    id: 'patient-009',
    name: 'Tom Pritsky',
    phone: '+15596729884',
    email: 'tom@captify.glass',
    tags: ['Existing'],
    riskScore: 20,
    riskReasons: [],
    lastContactAt: daysAgo(0),
    adoptionSignals: {
      woreToday: true,
      estimatedHoursWorn: 10,
      comfortIssues: false,
      soundClarityIssues: false,
      bluetoothAppIssues: false,
    },
    proactiveCheckInsEnabled: true,
    deviceBrand: 'Phonak',
    deviceModel: 'Audeo P90',
    fittingDate: daysAgo(60),
  },
]

// Mock Callback Tasks
export const mockCallbackTasks: CallbackTask[] = [
  {
    id: 'task-001',
    patientId: 'patient-003',
    patientName: 'Susan Martinez',
    phone: '(555) 345-6789',
    callReason: 'Follow up on severe feedback issues with new hearing aids',
    callGoal: 'Resolve feedback issues and ensure device is working properly',
    priority: 'high',
    status: 'in_progress',
    createdAt: hoursAgo(5),
    dueAt: hoursAgo(4),
    callId: 'call-003',
    attempts: [
      {
        attemptNumber: 1,
        timestamp: hoursAgo(4),
        outcome: 'voicemail',
        notes: 'Left detailed voicemail asking patient to call back',
      },
      {
        attemptNumber: 2,
        timestamp: hoursAgo(2),
        outcome: 'no_answer',
      },
    ],
    maxAttempts: 5,
    nextAttemptAt: hoursAgo(-1), // 1 hour from now
  },
  {
    id: 'task-002',
    patientId: 'patient-006',
    patientName: 'Eleanor White',
    phone: '(555) 678-9012',
    callReason: 'Follow up after hearing test',
    callGoal: 'Schedule training session for battery usage',
    priority: 'medium',
    status: 'pending',
    createdAt: daysAgo(2),
    dueAt: daysAgo(0),
    attempts: [],
    maxAttempts: 3,
  },
  {
    id: 'task-003',
    patientId: 'patient-008',
    patientName: 'Helen Davis',
    phone: '(555) 890-1234',
    callReason: 'Week 1 check-in for new fitting',
    callGoal: 'Verify device is working correctly and address any concerns',
    priority: 'medium',
    status: 'pending',
    createdAt: daysAgo(1),
    dueAt: hoursAgo(2),
    attempts: [],
    maxAttempts: 3,
  },
  {
    id: 'task-004',
    patientId: 'patient-001',
    patientName: 'Margaret Wilson',
    phone: '(555) 123-4567',
    callReason: 'Follow up after Bluetooth connectivity fix',
    callGoal: 'Confirm device is working properly',
    priority: 'low',
    status: 'completed',
    createdAt: daysAgo(3),
    dueAt: daysAgo(2),
    callId: 'call-001',
    attempts: [
      {
        attemptNumber: 1,
        timestamp: daysAgo(2),
        outcome: 'answered',
        notes: 'Patient confirmed Bluetooth is working fine now',
        durationSec: 180,
      },
    ],
    maxAttempts: 3,
  },
  {
    id: 'task-005',
    patientId: 'patient-004',
    patientName: 'Dorothy Adams',
    phone: '(555) 456-7890',
    callReason: 'Follow up on billing inquiry',
    callGoal: 'Address billing questions and resolve concerns',
    priority: 'low',
    status: 'max_attempts_reached',
    createdAt: daysAgo(5),
    dueAt: daysAgo(4),
    attempts: [
      {
        attemptNumber: 1,
        timestamp: daysAgo(4),
        outcome: 'no_answer',
      },
      {
        attemptNumber: 2,
        timestamp: daysAgo(3),
        outcome: 'voicemail',
        notes: 'Left message about billing inquiry',
      },
      {
        attemptNumber: 3,
        timestamp: daysAgo(2),
        outcome: 'no_answer',
      },
    ],
    maxAttempts: 3,
  },
]

// Mock Activity Events
export const mockActivityEvents: ActivityEvent[] = [
  {
    id: 'event-001',
    type: 'call',
    description: 'Resolved Bluetooth connectivity issue',
    timestamp: hoursAgo(1),
    patientName: 'Margaret Wilson',
    patientId: 'patient-001',
  },
  {
    id: 'event-002',
    type: 'appointment',
    description: 'Annual hearing check scheduled for Jan 21',
    timestamp: hoursAgo(3),
    patientName: 'Robert Chen',
    patientId: 'patient-002',
  },
  {
    id: 'event-003',
    type: 'escalation',
    description: 'Escalated: Severe feedback with new hearing aids',
    timestamp: hoursAgo(5),
    patientName: 'Susan Martinez',
    patientId: 'patient-003',
  },
  {
    id: 'event-004',
    type: 'callback',
    description: 'Callback task created for urgent fitting adjustment',
    timestamp: hoursAgo(5),
    patientName: 'Susan Martinez',
    patientId: 'patient-003',
  },
  {
    id: 'event-005',
    type: 'call',
    description: 'New patient consultation scheduled',
    timestamp: hoursAgo(7),
    patientName: 'James Thompson',
  },
  {
    id: 'event-006',
    type: 'checkin',
    description: 'Day 3 proactive check-in completed',
    timestamp: hoursAgo(8),
    patientName: 'Helen Davis',
    patientId: 'patient-008',
  },
  {
    id: 'event-007',
    type: 'call',
    description: 'Billing inquiry transferred to billing dept',
    timestamp: daysAgo(1),
    patientName: 'Dorothy Adams',
    patientId: 'patient-004',
  },
  {
    id: 'event-008',
    type: 'appointment',
    description: 'Appointment rescheduled to Friday',
    timestamp: daysAgo(1),
    patientName: 'Michael Brown',
    patientId: 'patient-005',
  },
  {
    id: 'event-009',
    type: 'call',
    description: 'Battery replacement guidance provided',
    timestamp: daysAgo(2),
    patientName: 'Eleanor White',
    patientId: 'patient-006',
  },
  {
    id: 'event-010',
    type: 'checkin',
    description: 'Day 1 proactive check-in completed',
    timestamp: daysAgo(2),
    patientName: 'Helen Davis',
    patientId: 'patient-008',
  },
]

// Mock Proactive Sequences
export const mockProactiveSequences: ProactiveSequence[] = [
  {
    id: 'seq-001',
    name: 'New Patient Week 1',
    audienceTag: 'New Fit',
    active: true,
    steps: [
      {
        day: 1,
        channel: 'call',
        goal: 'Initial check-in',
        script: "Hi {patient_name}, this is a courtesy call from Harmony Hearing Clinic. We wanted to check in on your first day with your new hearing aids. How are you finding them so far? Have you been able to wear them today?",
        questions: ['Wore today?', 'Hours worn', 'Comfort issues'],
        triggers: ['Not wearing', 'Significant discomfort'],
      },
      {
        day: 3,
        channel: 'call',
        goal: 'Comfort and usage check',
        script: "Hello {patient_name}, it's Harmony Hearing Clinic checking in on day 3. How is your adjustment going? Are you finding the hearing aids comfortable to wear for longer periods?",
        questions: ['Hours worn', 'Comfort issues', 'Sound clarity issues'],
        triggers: ['Less than 4 hours daily', 'Pain or discomfort'],
      },
      {
        day: 5,
        channel: 'sms',
        goal: 'Quick check-in',
        script: "Hi {patient_name}! Harmony Hearing here. How are your new hearing aids treating you? Reply YES if all good, or CALL if you need assistance.",
        questions: ['General satisfaction'],
        triggers: ['Requests call'],
      },
      {
        day: 7,
        channel: 'call',
        goal: 'Week 1 summary',
        script: "Hi {patient_name}, congratulations on completing your first week with your new hearing aids! I'd like to do a quick review. How many hours are you wearing them daily now? Any issues with sound quality or comfort we should address?",
        questions: ['Hours worn', 'Comfort issues', 'Sound clarity issues', 'Bluetooth issues'],
        triggers: ['Any reported issues', 'Usage below 6 hours'],
      },
    ],
  },
  {
    id: 'seq-002',
    name: 'Monthly Check-in',
    audienceTag: 'Existing',
    active: true,
    steps: [
      {
        day: 1,
        channel: 'sms',
        goal: 'Monthly wellness check',
        script: "Hi {patient_name}, it's time for your monthly hearing wellness check from Harmony Hearing. How are your hearing aids performing? Reply GOOD, OKAY, or HELP.",
        questions: ['General satisfaction'],
        triggers: ['Reports issues', 'Requests help'],
      },
    ],
  },
  {
    id: 'seq-003',
    name: 'High Risk Intervention',
    audienceTag: 'High Risk',
    active: true,
    steps: [
      {
        day: 1,
        channel: 'call',
        goal: 'Immediate outreach',
        script: "Hi {patient_name}, this is a priority call from Harmony Hearing Clinic. We noticed you may be experiencing some challenges with your hearing aids. We want to make sure you're getting the best experience possible. Can you tell me what's been happening?",
        questions: ['Current issues', 'Wearing habits', 'Satisfaction level'],
        triggers: ['Not wearing regularly', 'Multiple issues reported'],
      },
      {
        day: 2,
        channel: 'call',
        goal: 'Follow-up resolution',
        script: "Hi {patient_name}, following up from yesterday's call. Have the suggestions we provided helped? Is there anything else we can do to improve your experience?",
        questions: ['Issue resolved', 'Additional concerns'],
        triggers: ['Issue not resolved', 'New concerns'],
      },
    ],
  },
]

// Default Agent Configuration
export const defaultAgentConfig: AgentConfig = {
  clinicName: 'Harmony Hearing Clinic',
  phoneNumber: '(555) 000-1234',
  hoursOpen: '08:00',
  hoursClose: '17:00',
  voiceStyle: 'calm',
  speechSpeed: 1.0,
  elevenLabsAgentId: 'agent_6201k9fw3a3bfy2bh8enh0r20dxt',
  elevenLabsOutboundAgentId: 'agent_7501kf97m7abftsv9gj6m0tgnha8',
  elevenLabsPhoneNumberId: 'phnum_6801k9fx8bw8fw2tftsqdt4xmj58',
  allowedIntents: {
    scheduling: true,
    rescheduleCancel: true,
    newPatientIntake: true,
    deviceTroubleshooting: true,
    billing: true,
  },
  escalationRules: {
    medicalQuestion: true,
    upsetSentiment: true,
    repeatedMisunderstanding: true,
    userRequestsHuman: true,
  },
  callbackSettings: {
    maxAttempts: 3,
    redialIntervalMinutes: 60,
    autoCreateOnEscalation: true,
    autoCreateOnVoicemail: true,
    autoCreateOnNoAnswer: true,
    priorityByDefault: 'medium',
  },
}

// KPI Data
export const mockKPIData: KPIData = {
  callsToday: 12,
  missedCallsPrevented: 8,
  appointmentsBooked: 4,
  proactiveCheckInsCompleted: 6,
  escalationsCreated: 2,
}
