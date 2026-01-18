import { Patient, ProactiveSequence, ScheduledCheckIn, SequenceStep, CallbackTask } from './types'

/**
 * Calculate scheduled check-ins for a patient based on their fitting date and active sequences
 */
export function calculateScheduledCheckIns(
  patient: Patient,
  sequences: ProactiveSequence[]
): ScheduledCheckIn[] {
  if (!patient.proactiveCheckInsEnabled || !patient.fittingDate) {
    return []
  }

  const scheduledCheckIns: ScheduledCheckIn[] = []
  const fittingDate = new Date(patient.fittingDate)
  const now = new Date()

  // Find active sequences that apply to this patient
  // If patient has selectedSequenceIds, use those; otherwise fall back to tag matching
  let applicableSequences: ProactiveSequence[]
  if (patient.selectedSequenceIds && patient.selectedSequenceIds.length > 0) {
    // Use explicitly selected sequences
    applicableSequences = sequences.filter(
      (seq) => seq.active && patient.selectedSequenceIds!.includes(seq.id)
    )
  } else {
    // Fall back to tag-based matching
    applicableSequences = sequences.filter(
      (seq) => seq.active && patient.tags.includes(seq.audienceTag)
    )
  }

  for (const sequence of applicableSequences) {
    for (const step of sequence.steps) {
      // Calculate scheduled date: fittingDate + step.day
      const scheduledDate = new Date(fittingDate)
      scheduledDate.setDate(scheduledDate.getDate() + step.day)
      
      // Set time to 9 AM (configurable later)
      scheduledDate.setHours(9, 0, 0, 0)

      // Only schedule future check-ins or ones that haven't been completed yet
      // (we'll check for existing ones in the store)
      if (scheduledDate >= now || scheduledDate >= fittingDate) {
        scheduledCheckIns.push({
          id: `checkin-${patient.id}-${sequence.id}-${step.day}`,
          patientId: patient.id,
          patientName: patient.name,
          phone: patient.phone,
          sequenceId: sequence.id,
          sequenceName: sequence.name,
          stepDay: step.day,
          scheduledFor: scheduledDate,
          channel: step.channel,
          goal: step.goal,
          script: step.script,
          questions: step.questions,
          status: 'scheduled',
        })
      }
    }
  }

  return scheduledCheckIns
}

/**
 * Get all due callback tasks that need to be executed
 */
export function getDueCallbackTasks(tasks: CallbackTask[]): CallbackTask[] {
  const now = new Date()
  
  return tasks.filter((task) => {
    // Task must be pending (not in_progress, completed, etc.)
    // Only trigger pending tasks to avoid duplicate calls
    if (task.status !== 'pending') {
      return false
    }

    // Check if dueAt has passed
    if (task.dueAt && new Date(task.dueAt) <= now) {
      return true
    }

    // Check if nextAttemptAt has passed (for redial attempts)
    if (task.nextAttemptAt && new Date(task.nextAttemptAt) <= now) {
      return true
    }

    return false
  })
}

/**
 * Get all due scheduled check-ins that need to be executed
 */
export function getDueScheduledCheckIns(checkIns: ScheduledCheckIn[]): ScheduledCheckIn[] {
  const now = new Date()
  
  return checkIns.filter((checkIn) => {
    // Must be scheduled (not in_progress, completed, or cancelled)
    if (checkIn.status !== 'scheduled') {
      return false
    }

    // Scheduled time has passed
    const scheduledTime = new Date(checkIn.scheduledFor)
    if (scheduledTime > now) {
      return false
    }

    // Don't trigger if it was already triggered recently (within last 5 minutes)
    // This prevents duplicate triggers if webhook hasn't come back yet
    if (checkIn.triggeredAt) {
      const timeSinceTrigger = now.getTime() - new Date(checkIn.triggeredAt).getTime()
      if (timeSinceTrigger < 5 * 60 * 1000) { // 5 minutes
        return false
      }
    }

    return true
  })
}

/**
 * Recalculate scheduled check-ins for all patients
 * This should be called when:
 * - A patient's fittingDate changes
 * - A patient's tags change
 * - A sequence is updated
 * - A patient's proactiveCheckInsEnabled changes
 */
export function recalculateAllCheckIns(
  patients: Patient[],
  sequences: ProactiveSequence[],
  existingCheckIns: ScheduledCheckIn[]
): ScheduledCheckIn[] {
  const newCheckIns: ScheduledCheckIn[] = []
  const now = new Date()
  const existingCheckInMap = new Map(
    existingCheckIns
      .filter((ci) => ci.status === 'scheduled' || ci.status === 'in_progress' || ci.status === 'completed')
      .map((ci) => [ci.id, ci])
  )

  for (const patient of patients) {
    const calculated = calculateScheduledCheckIns(patient, sequences)
    
    for (const checkIn of calculated) {
      // If it already exists, keep it (preserves status, triggeredAt, conversationId, etc.)
      const existing = existingCheckInMap.get(checkIn.id)
      if (existing) {
        newCheckIns.push(existing)
      } else {
        // Only add new check-ins that are in the future
        // Don't create check-ins for past dates (they would trigger immediately)
        if (new Date(checkIn.scheduledFor) > now) {
          newCheckIns.push(checkIn)
        }
      }
    }
  }

  // Remove check-ins that are too far in the future (more than 90 days) or for patients that no longer exist
  const patientIds = new Set(patients.map(p => p.id))
  return newCheckIns.filter((ci) => {
    // Remove if patient no longer exists
    if (!patientIds.has(ci.patientId)) {
      return false
    }
    
    // Remove if scheduled more than 90 days in the future
    const daysFromNow = (new Date(ci.scheduledFor).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    if (daysFromNow > 90) {
      return false
    }
    
    return true
  })
}

/**
 * Clear all future scheduled check-ins
 * Useful for preventing unwanted calls
 */
export function clearFutureCheckIns(
  existingCheckIns: ScheduledCheckIn[]
): ScheduledCheckIn[] {
  const now = new Date()
  
  return existingCheckIns.filter((ci) => {
    // Keep completed, cancelled, and in_progress check-ins
    if (ci.status === 'completed' || ci.status === 'cancelled' || ci.status === 'in_progress') {
      return true
    }
    
    // Remove scheduled check-ins that are in the future
    if (ci.status === 'scheduled' && new Date(ci.scheduledFor) > now) {
      return false
    }
    
    // Keep past scheduled check-ins (they may be due soon)
    return true
  })
}

