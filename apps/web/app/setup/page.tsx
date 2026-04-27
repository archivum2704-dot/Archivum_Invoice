'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { setupDemoUsers } from '@/lib/actions/setup-demo-data'
import { useRouter } from 'next/navigation'

export default function SetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSetupDemo = async () => {
    setLoading(true)
    setMessage(null)

    try {
      const result = await setupDemoUsers()

      if (result.success) {
        setMessage({
          type: 'success',
          text: 'Demo users created successfully! You can now login with admin@test.com (Admin123!) or empresa@test.com (Empresa123!)',
        })
        setTimeout(() => {
          router.push('/auth/login')
        }, 3000)
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Failed to create demo users',
        })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An unexpected error occurred',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card rounded-lg border border-border p-8">
        <h1 className="text-2xl font-bold text-foreground mb-4">Setup Demo Data</h1>
        <p className="text-muted-foreground mb-6">
          Click the button below to create demo users and sample data for testing the application.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm">
          <p className="font-semibold text-blue-900 mb-2">Demo Accounts:</p>
          <ul className="text-blue-800 space-y-1">
            <li><strong>Admin:</strong> admin@test.com / Admin123!</li>
            <li><strong>Company User:</strong> empresa@test.com / Empresa123!</li>
          </ul>
        </div>

        {message && (
          <div className={`rounded-lg p-4 mb-6 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        <Button
          onClick={handleSetupDemo}
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Setting up...' : 'Setup Demo Data'}
        </Button>
      </div>
    </div>
  )
}
