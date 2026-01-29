import { useState, useCallback } from 'react'
import { useEmailStore } from './stores/emailStore'
import { GoogleSignIn } from './components/auth/GoogleSignIn'
import { TemplateUpload } from './components/upload/TemplateUpload'
import { DataUpload } from './components/upload/DataUpload'
import { PlaceholderMapper } from './components/upload/PlaceholderMapper'
import { EmailPreview } from './components/preview/EmailPreview'
import { SendControls } from './components/send/SendControls'
import { FailedEmailsPanel } from './components/send/FailedEmailsPanel'
import { Instructions } from './components/Instructions'
import { Card, CardHeader, CardTitle } from './components/ui/Card'
import { LogOut, RotateCcw } from 'lucide-react'
import { replacePlaceholders } from './utils/placeholders'

export default function App() {
  const {
    template,
    excelData,
    mappings,
    user,
    sendResults,
    setUser,
    setIsSending,
    setSendProgress,
    setSendResults,
    updateSendResult,
    reset,
  } = useEmailStore()

  const [isSigningIn, setIsSigningIn] = useState(false)

  // Check if ready for preview
  const isReadyToPreview = template && excelData && mappings.length > 0
  const hasUnmappedPlaceholders = mappings.some((m) => !m.excelColumn)
  const hasSendResults = sendResults.length > 0

  // Mock sign-in for demo (in production, this would use Google OAuth)
  const handleSignIn = async () => {
    setIsSigningIn(true)
    // Simulate OAuth flow
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setUser({
      email: 'demo@gmail.com',
      name: 'Demo User',
      picture: 'https://ui-avatars.com/api/?name=Demo+User&background=3b82f6&color=fff',
    })
    setIsSigningIn(false)
  }

  const handleSignOut = () => {
    setUser(null)
    reset()
  }

  // Mock test send
  const handleTestSend = useCallback(async () => {
    if (!template || !excelData || !user) return

    const firstRow = excelData.rows[0]
    const processedSubject = replacePlaceholders(template.subject, firstRow, mappings)
    const processedBody = replacePlaceholders(template.htmlBody, firstRow, mappings)

    // In production, this would call the API
    console.log('Test email:', {
      to: user.email,
      subject: processedSubject,
      body: processedBody,
      cc: template.cc,
    })

    // Simulate sending
    await new Promise((resolve) => setTimeout(resolve, 1500))
    alert(`Test email sent to ${user.email}!\n\nCheck your inbox.`)
  }, [template, excelData, user, mappings])

  // Mock send all
  const handleSendAll = useCallback(async () => {
    if (!template || !excelData || !user) return

    setIsSending(true)
    setSendProgress({ sent: 0, total: excelData.totalRows })

    // Initialize all as pending
    const initialResults = excelData.rows.map((row, index) => ({
      rowIndex: index,
      email: row[excelData.emailColumn],
      status: 'pending' as const,
    }))
    setSendResults(initialResults)

    // Simulate sending each email
    for (let i = 0; i < excelData.rows.length; i++) {
      // Update to sending
      updateSendResult(i, { status: 'sending' })

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Simulate random failures (10% chance)
      const shouldFail = Math.random() < 0.1

      if (shouldFail) {
        updateSendResult(i, {
          status: 'failed',
          error: 'Simulated failure for demo',
          timestamp: new Date().toISOString(),
        })
      } else {
        updateSendResult(i, {
          status: 'success',
          messageId: `msg_${Date.now()}_${i}`,
          timestamp: new Date().toISOString(),
        })
      }

      setSendProgress({ sent: i + 1, total: excelData.totalRows })
    }

    setIsSending(false)
  }, [template, excelData, user, mappings, setIsSending, setSendProgress, setSendResults, updateSendResult])

  // Mock retry single
  const handleRetry = useCallback(async (rowIndex: number) => {
    if (!excelData) return

    updateSendResult(rowIndex, { status: 'sending' })
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Simulate success on retry
    updateSendResult(rowIndex, {
      status: 'success',
      messageId: `msg_retry_${Date.now()}`,
      error: undefined,
      timestamp: new Date().toISOString(),
    })
  }, [excelData, updateSendResult])

  // Mock retry all failed
  const handleRetryAll = useCallback(async () => {
    const failedEmails = sendResults.filter((r) => r.status === 'failed')
    for (const failed of failedEmails) {
      await handleRetry(failed.rowIndex)
    }
  }, [sendResults, handleRetry])

  // Not signed in
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl font-bold text-white">O</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Otto</h1>
          <p className="text-lg text-gray-600">Send personalized bulk emails with ease</p>
        </div>
        <GoogleSignIn onSignIn={handleSignIn} isLoading={isSigningIn} />
        <p className="mt-8 text-sm text-gray-500 text-center max-w-md">
          Otto helps you send personalized emails using a template and spreadsheet data.
          No coding required.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-sm font-bold text-white">O</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Otto</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <img
                src={user.picture}
                alt={user.name}
                className="w-8 h-8 rounded-full"
              />
              <span className="text-sm text-gray-600 hidden sm:block">{user.email}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Instructions */}
        <Instructions />

        {/* Step 1: Upload Files */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Step 1: Upload Files</CardTitle>
              {(template || excelData) && (
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
                >
                  <RotateCcw className="w-4 h-4" />
                  Start Over
                </button>
              )}
            </div>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TemplateUpload />
            <DataUpload />
          </div>
        </Card>

        {/* Step 2: Map Placeholders */}
        {template && excelData && (
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Map Placeholders</CardTitle>
            </CardHeader>
            <PlaceholderMapper />
            {hasUnmappedPlaceholders && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  Some placeholders are not mapped. They will remain as-is in the emails.
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Step 3: Preview & Send */}
        {isReadyToPreview && (
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Preview & Send</CardTitle>
            </CardHeader>
            <EmailPreview />
            <SendControls onTestSend={handleTestSend} onSendAll={handleSendAll} />
          </Card>
        )}

        {/* Failed Emails */}
        {hasSendResults && (
          <FailedEmailsPanel onRetry={handleRetry} onRetryAll={handleRetryAll} />
        )}

        {/* Success Summary */}
        {hasSendResults && sendResults.every((r) => r.status === 'success') && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-green-900 mb-1">All Emails Sent!</h3>
            <p className="text-green-700">
              Successfully sent {sendResults.length} email{sendResults.length !== 1 ? 's' : ''}.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-6 mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center text-sm text-gray-500">
          Otto - Send personalized bulk emails with ease
        </div>
      </footer>
    </div>
  )
}
