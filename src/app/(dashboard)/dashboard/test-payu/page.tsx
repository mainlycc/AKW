'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { createTestPayment } from './actions'
import { ExternalLink, Loader2, CheckCircle2, XCircle } from 'lucide-react'

export default function TestPayUPage() {
  const [amount, setAmount] = useState<string>('')
  const [description, setDescription] = useState<string>('Testowa płatność')
  const [buyerEmail, setBuyerEmail] = useState<string>('')
  const [buyerFirstName, setBuyerFirstName] = useState<string>('')
  const [buyerLastName, setBuyerLastName] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    paymentId?: string
    redirectUrl?: string
    error?: string
  } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setResult({ success: false, error: 'Podaj poprawną kwotę większą od 0' })
      setLoading(false)
      return
    }

    if (!buyerEmail) {
      setResult({ success: false, error: 'Podaj adres email' })
      setLoading(false)
      return
    }

    try {
      const response = await createTestPayment(
        amountNum,
        description,
        buyerEmail,
        buyerFirstName || 'Test',
        buyerLastName || 'Użytkownik'
      )

      setResult(response)
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Nieznany błąd',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Test PayU - Generowanie linku płatności</h1>
        <p className="text-muted-foreground mt-2">
          Prosta strona testowa do generowania linków płatności PayU GPO Europe API v2
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dane płatności</CardTitle>
          <CardDescription>
            Wypełnij formularz, aby wygenerować link do płatności PayU
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Kwota (PLN) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="100.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Opis</Label>
              <Input
                id="description"
                type="text"
                placeholder="Testowa płatność"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="buyerEmail">Email kupującego *</Label>
              <Input
                id="buyerEmail"
                type="email"
                placeholder="test@example.com"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="buyerFirstName">Imię</Label>
                <Input
                  id="buyerFirstName"
                  type="text"
                  placeholder="Jan"
                  value={buyerFirstName}
                  onChange={(e) => setBuyerFirstName(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="buyerLastName">Nazwisko</Label>
                <Input
                  id="buyerLastName"
                  type="text"
                  placeholder="Kowalski"
                  value={buyerLastName}
                  onChange={(e) => setBuyerLastName(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Tworzenie płatności...
                </>
              ) : (
                'Generuj link płatności'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>
              {result.success ? 'Płatność utworzona pomyślnie!' : 'Błąd'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.success ? (
              <>
                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <div>
                      <strong className="text-green-900 dark:text-green-100">Payment ID:</strong>{' '}
                      <span className="font-mono text-sm">{result.paymentId}</span>
                    </div>
                  </div>
                </div>

                {result.redirectUrl && (
                  <div className="space-y-2">
                    <Label>Link do płatności:</Label>
                    <div className="flex gap-2">
                      <Input
                        value={result.redirectUrl}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        onClick={() => window.open(result.redirectUrl, '_blank')}
                        variant="outline"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Otwórz
                      </Button>
                    </div>
                    <Button
                      onClick={() => (window.location.href = result.redirectUrl!)}
                      className="w-full"
                    >
                      Przekieruj do płatności
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <div>
                    <strong className="text-red-900 dark:text-red-100">Błąd:</strong>{' '}
                    <span>{result.error}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
