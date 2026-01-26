'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requestPasswordReset } from '@/lib/actions/reset-password'
import { IconArrowLeft, IconCheck } from '@tabler/icons-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    await requestPasswordReset(email)
    
    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-green-100 p-3">
                <IconCheck className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center">Email wysłany</CardTitle>
            <CardDescription className="text-center">
              Jeśli podany adres email istnieje w naszym systemie, otrzymasz link do resetowania hasła.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground bg-blue-50 p-4 rounded-lg">
              <p className="font-medium mb-2">Sprawdź swoją skrzynkę pocztową</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Link jest ważny przez 1 godzinę</li>
                <li>Sprawdź także folder spam</li>
                <li>Możesz zamknąć tę stronę</li>
              </ul>
            </div>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                <IconArrowLeft className="h-4 w-4 mr-2" />
                Wróć do logowania
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Zapomniałeś hasła?</CardTitle>
          <CardDescription className="text-center">
            Podaj swój adres email, a wyślemy Ci link do resetowania hasła
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="twoj@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Wysyłanie...' : 'Wyślij link resetujący'}
            </Button>
            <Link href="/login">
              <Button variant="ghost" className="w-full" type="button">
                <IconArrowLeft className="h-4 w-4 mr-2" />
                Wróć do logowania
              </Button>
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
