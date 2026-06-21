import { useState } from 'react'
import { toast } from 'sonner'
import { Link, useNavigate } from 'react-router-dom'
import { useCreatePipeline } from '@project/sdk'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function PipelinesNewPage() {
  const navigate = useNavigate()
  const create = useCreatePipeline()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const result = await create.mutateAsync({ name: name.trim(), description: description.trim() || undefined })
      toast.success('Pipeline created')
      navigate(`/pipelines/${result.data.slug}`, { replace: true })
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create pipeline')
    }
  }

  return (
    <div className="w-full min-w-0 max-w-lg mx-auto pb-10 px-4 sm:px-6">
      <Link to="/pipelines" className="mt-5 inline-flex text-sm text-muted-foreground hover:text-foreground">← Pipelines</Link>

      <div className="pt-4">
        <h1 className="text-lg font-semibold mb-1">New Pipeline</h1>
        <p className="text-sm text-muted-foreground mb-6">Give your pipeline a name, then add variables, agents, and a destination in the builder.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">Pipeline name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Blog Builder"
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
              placeholder="What does this pipeline do?"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" loading={create.isPending} disabled={!name.trim()}>
              Create pipeline
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/pipelines')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
