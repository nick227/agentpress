import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useLogin } from '@project/sdk'
import { Form } from '@/components/ui/Form'
import { Card, CardContent } from '@/components/ui/Card'
import type { FieldConfig } from '@/components/ui/Form'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

type FormData = z.infer<typeof schema>

const fields: FieldConfig[] = [
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'password', label: 'Password', type: 'password', required: true },
]

export function LoginPage() {
  const navigate = useNavigate()
  const login = useLogin()

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold">AgentPress</h1>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </div>
        <Card>
          <CardContent className="py-6">
            <Form<FormData>
              fields={fields}
              schema={schema}
              onSubmit={async (data) => {
                await login.mutateAsync(data)
                navigate('/')
              }}
              isLoading={login.isPending}
              submitLabel="Sign In"
            />
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          No account?{' '}
          <Link to="/register" className="text-foreground hover:underline font-medium">
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
