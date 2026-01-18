'use client'

import { AppShell } from '@/components/layout/app-shell'
import { PatientDetail } from '@/components/patients/patient-detail'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { use } from 'react'

export default function PatientDetailPage(props: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const params = props.params instanceof Promise ? use(props.params) : props.params
  const id = params.id
  const { patients } = useAppStore()
  const patient = patients.find((p) => p.id === id)

  if (!patient) {
    return (
      <AppShell title="Patient Not Found">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <h2 className="text-xl font-semibold mb-2">Patient Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The patient you&apos;re looking for doesn&apos;t exist.
          </p>
          <Button asChild>
            <Link href="/patients">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Patients
            </Link>
          </Button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title={patient.name}>
      <PatientDetail patient={patient} />
    </AppShell>
  )
}
