import { z } from 'zod'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { useCreateAccount, useUpdateAccount } from '@project/sdk'
import type { components } from '@project/sdk'
import { Form } from '@/components/ui/Form'
import { Button } from '@/components/ui/Button'
import type { FieldConfig } from '@/components/ui/Form'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
})

type FormData = z.infer<typeof schema>

const fields: FieldConfig[] = [
  { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Client A' },
  { name: 'category', label: 'Category', type: 'text', placeholder: 'Agency, E-commerce...' },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'description', label: 'Description', type: 'textarea', rows: 3 },
]

interface Props {
  account?: components['schemas']['Account']
  onClose: () => void
}

export function AccountFormDialog({ account, onClose }: Props) {
  const create = useCreateAccount()
  const update = useUpdateAccount()

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-lg border w-full max-w-md shadow-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-sm font-semibold">{account ? 'Edit Account' : 'New Account'}</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X size={15} />
          </Button>
        </div>
        <div className="p-5">
          <Form<FormData>
            fields={fields}
            schema={schema}
            defaultValues={account ? {
              name: account.name,
              category: account.category ?? '',
              phone: account.phone ?? '',
              email: account.email ?? '',
              description: account.description ?? '',
            } : undefined}
            onSubmit={async (data) => {
              if (account) {
                await update.mutateAsync({ accountId: account.id, ...data })
                toast.success('Account updated')
              } else {
                await create.mutateAsync(data)
                toast.success('Account created')
              }
              onClose()
            }}
            isLoading={create.isPending || update.isPending}
            submitLabel={account ? 'Save Changes' : 'Create Account'}
          />
        </div>
      </div>
    </div>
  )
}
