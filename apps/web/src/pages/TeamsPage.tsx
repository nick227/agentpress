import { type FormEvent, useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { useAddWorkspaceMember, useCreateTeam, useRemoveWorkspaceMember, useWorkspaceMembers, useWorkspaces } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function TeamsPage() {
  const { data = [] } = useWorkspaces()
  const createTeam = useCreateTeam()
  const [name, setName] = useState('')
  const teams = data.filter((workspace) => workspace.type === 'TEAM')
  const [selectedId, setSelectedId] = useState('')
  const selectedTeam = teams.find((team) => team.id === selectedId) ?? teams[0]
  const members = useWorkspaceMembers(selectedTeam?.id)
  const addMember = useAddWorkspaceMember(selectedTeam?.id ?? '')
  const removeMember = useRemoveWorkspaceMember(selectedTeam?.id ?? '')
  const [email, setEmail] = useState('')
  async function submit(event: FormEvent) { event.preventDefault(); if (!name.trim()) return; await createTeam.mutateAsync(name.trim()); setName('') }
  return (
    <div className="page-shell page-shell--5xl">
      <h1 className="text-lg font-semibold">Teams</h1><p className="text-sm text-muted-foreground">Shared workspaces with role-based access.</p>
      <form onSubmit={submit} className="mt-5 flex max-w-md flex-wrap gap-2"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Team name" className="min-w-0 flex-1" /><Button size="sm" type="submit" loading={createTeam.isPending}><Plus size={13} /> Create</Button></form>
      <div className="mt-6 divide-y rounded border bg-surface">
        {teams.length === 0 && <p className="p-5 text-sm text-muted-foreground">No teams yet.</p>}
        {teams.map((team) => <button key={team.id} type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30" onClick={() => setSelectedId(team.id)}><Users size={15} className="text-muted-foreground" /><span className="flex-1 text-sm font-medium">{team.name}</span><span className="text-xs text-muted-foreground">{team.role.toLowerCase()}</span></button>)}
      </div>
      {selectedTeam && <section className="mt-8">
        <div className="section-header">
          <div className="min-w-0"><h2 className="text-sm font-semibold">{selectedTeam.name} members</h2><p className="text-xs text-muted-foreground">Owners and admins manage membership.</p></div>
          <Button size="sm" variant="outline" onClick={() => { localStorage.setItem('agentpress.workspaceId', selectedTeam.id); window.location.assign('/') }}>Open workspace</Button>
        </div>
        {(selectedTeam.role === 'OWNER' || selectedTeam.role === 'ADMIN') && <form className="mt-3 flex max-w-lg flex-wrap gap-2" onSubmit={async (event) => { event.preventDefault(); if (!email.trim()) return; await addMember.mutateAsync({ email: email.trim(), role: 'EDITOR' }); setEmail('') }}><Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Existing user's email" className="min-w-0 flex-1" /><Button size="sm" type="submit" loading={addMember.isPending}>Add editor</Button></form>}
        <div className="mt-3 divide-y rounded border bg-surface">{(members.data ?? []).map((member) => <div key={member.userId} className="flex min-w-0 flex-wrap items-center gap-2 gap-y-1 px-4 py-3 sm:gap-3"><span className="min-w-0 flex-1 text-sm truncate">{member.user.email}</span><span className="text-xs text-muted-foreground">{member.role.toLowerCase()}</span>{member.role !== 'OWNER' && (selectedTeam.role === 'OWNER' || selectedTeam.role === 'ADMIN') && <Button size="sm" variant="ghost" onClick={() => removeMember.mutate(member.userId)}>Remove</Button>}</div>)}</div>
      </section>}
    </div>
  )
}
