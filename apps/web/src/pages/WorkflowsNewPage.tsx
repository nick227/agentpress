import { useState } from 'react'
import { toast } from 'sonner'
import { Link, useNavigate } from 'react-router-dom'
import { useCreateWorkflow } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function WorkflowsNewPage() {
  const navigate = useNavigate()
  const create = useCreateWorkflow()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const result = await create.mutateAsync({ 
        name: name.trim(), 
        description: description.trim() || undefined,
        nodes: [] // Starts empty
      })
      toast.success('Workflow created')
      navigate(`/workflows/${result.data.id}`, { replace: true })
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create workflow')
    }
  }

  return (
    <div className="w-full min-w-0 max-w-lg mx-auto pb-10 px-4 sm:px-6">
      <Link to="/workflows" className="mt-5 inline-flex text-sm text-muted-foreground hover:text-foreground">← Workflows</Link>

      <div className="pt-4">
        <h1 className="text-lg font-semibold mb-1">New Workflow</h1>
        <p className="text-sm text-muted-foreground mb-6">Give your reusable workflow a name, then define its sequence of nodes.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">Workflow name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SEO Article Generator"
              className="h-8 text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this sequence of nodes accomplish?"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" loading={create.isPending} disabled={!name.trim()}>
              Create workflow
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/workflows')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
