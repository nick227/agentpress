import { z } from 'zod'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCreatePipeline } from '@project/sdk'
import { Form } from '@/components/ui/Form'
import { Button } from '@/components/ui/Button'
import type { FieldConfig } from '@/components/ui/Form'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().or(z.literal('')),
})

type FormData = z.infer<typeof schema>

const fields: FieldConfig[] = [
  { name: 'name', label: 'Pipeline name', type: 'text', required: true, placeholder: 'Blog Builder' },
  { name: 'description', label: 'Description', type: 'textarea', rows: 2 },
]

interface Props {
  onClose: () => void
}

export function CreatePipelineDialog({ onClose }: Props) {
  const navigate = useNavigate()
  const create = useCreatePipeline()

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-lg border w-full max-w-md shadow-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-sm font-semibold">New Pipeline</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X size={15} />
          </Button>
        </div>
        <div className="p-5">
          <Form<FormData>
            fields={fields}
            schema={schema}
            onSubmit={async (data) => {
              try {
                const result = await create.mutateAsync(data)
                toast.success('Pipeline created')
                onClose()
                navigate(`/pipelines/${result.data.slug}`)
              } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : 'Failed to create pipeline')
              }
            }}
            isLoading={create.isPending}
            submitLabel="Create Pipeline"
          />
        </div>
      </div>
    </div>
  )
}
