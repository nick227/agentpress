import { useState } from 'react'
import { useChangePassword, useCurrentUser } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from 'sonner'
import { CheckCircle2, KeyRound, User, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

function initials(email: string) {
  return email.charAt(0).toUpperCase()
}

function relativeDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

export function ProfilePage() {
  const { data, isLoading } = useCurrentUser()
  const changePassword = useChangePassword()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [succeeded, setSucceeded] = useState(false)

  const user = data?.data

  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword
  const tooShort = newPassword.length > 0 && newPassword.length < 8
  const canSubmit = currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSucceeded(true)
      toast.success('Password updated')
    } catch (err: any) {
      toast.error(err.message ?? 'Could not update password')
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">Account details and security settings.</p>
      </div>

      {/* Account info */}
      <section className="rounded border bg-surface">
        <div className="flex items-center gap-4 px-5 py-4 border-b">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-sm font-semibold select-none">
            {initials(user.email)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
          </div>
        </div>

        <dl className="divide-y text-sm">
          <div className="flex items-center justify-between px-5 py-3">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium text-foreground">{user.email}</dd>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <dt className="text-muted-foreground">Role</dt>
            <dd className="capitalize font-medium text-foreground">{user.role}</dd>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <dt className="text-muted-foreground">Member since</dt>
            <dd className="text-foreground">{relativeDate(user.createdAt)}</dd>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <dt className="text-muted-foreground">Account ID</dt>
            <dd className="font-mono text-xs text-muted-foreground">{user.id}</dd>
          </div>
        </dl>
      </section>

      {/* Teams */}
      <section className="rounded border bg-surface">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-muted-foreground shrink-0" />
            <h2 className="text-sm font-semibold">Teams</h2>
          </div>
          <Link
            to="/teams"
            className="inline-flex h-7 items-center justify-center rounded border border-input-border bg-transparent px-3 text-xs font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Manage teams
          </Link>
        </div>
        <div className="px-5 py-4 text-sm text-muted-foreground">
          View and manage your shared workspaces and role-based access.
        </div>
      </section>

      {/* Change password */}
      <section className="rounded border bg-surface">
        <div className="flex items-center gap-2 px-5 py-4 border-b">
          <KeyRound size={14} className="text-muted-foreground shrink-0" />
          <h2 className="text-sm font-semibold">Change password</h2>
        </div>

        <form onSubmit={handleChangePassword} className="px-5 py-4 space-y-4">
          <Field label="Current password">
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); setSucceeded(false) }}
              autoComplete="current-password"
              placeholder="Enter current password"
            />
          </Field>

          <Field label="New password" hint={tooShort ? 'At least 8 characters required' : undefined}>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setSucceeded(false) }}
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              className={tooShort ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
          </Field>

          <Field label="Confirm new password" hint={mismatch ? 'Passwords do not match' : undefined}>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setSucceeded(false) }}
              autoComplete="new-password"
              placeholder="Repeat new password"
              className={mismatch ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
          </Field>

          <div className="flex items-center justify-between pt-1">
            {succeeded ? (
              <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                <CheckCircle2 size={13} /> Password updated
              </span>
            ) : (
              <span />
            )}
            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit}
              loading={changePassword.isPending}
            >
              Update password
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
