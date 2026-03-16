'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function SignupSuccessPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-2">¡Cuenta creada!</h2>
          <p className="text-muted-foreground mb-4">
            Hemos enviado un enlace de confirmación a tu correo electrónico. Por favor, verifica tu bandeja de entrada y haz clic en el enlace para confirmar tu cuenta.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Una vez confirmado, podrás iniciar sesión y comenzar a usar DocVault.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">¿No recibiste el correo? Revisa tu carpeta de spam o</p>
          <Link href="/auth/login">
            <Button variant="outline" className="w-full">
              Volver al inicio de sesión
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
