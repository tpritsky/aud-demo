import { DeleteAccountSection } from '@/components/settings/delete-account-section'

export default function AccountPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-sm text-muted-foreground">
        Delete your login and associated data. This does not remove your business — contact a super admin for that.
      </p>
      <DeleteAccountSection />
    </div>
  )
}
