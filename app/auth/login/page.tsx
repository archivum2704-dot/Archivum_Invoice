'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // DEMO MODE: Bypass Supabase
      const demoUsers = [
        { email: 'admin@test.com', role: 'admin' },
        { email: 'empresa@test.com', role: 'company_user' }
      ]

      const user = demoUsers.find(u => u.email === email.toLowerCase())
      
      if (!user) {
        setError('Acceso denegado. Use los usuarios de prueba definidos.')
        setLoading(false)
        return
      }

      // Hacky way to set a demo cookie so middleware/layouts think we're logged in
      document.cookie = `demo_session=true; path=/; max-age=3600`
      localStorage.setItem('demo_user_role', user.role)
      localStorage.setItem('demo_user_email', user.email)

      // Force a full reload to ensure OrganizationProvider and Middleware pick up the new state
      window.location.href = '/dashboard'
    } catch (err) {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">DocVault</h1>
          <p className="text-muted-foreground">Archivo digital de facturación</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
              Correo electrónico
            </label>
            <Input
              id="email"
              type="email"
              placeholder="tu@empresa.es"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
              Contraseña
            </label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            ¿No tienes cuenta?{' '}
            <Link href="/auth/signup" className="text-primary hover:underline font-medium">
              Regístrate
            </Link>
          </p>
        </div>

        <div className="mt-4 text-center">
          <Link href="/auth/reset-password" className="text-sm text-primary hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </div>
    </div>
  )
}
