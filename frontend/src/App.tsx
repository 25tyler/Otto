import { useState, useCallback, useEffect } from 'react'
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
import { generateEmailFromGoogleDoc } from './utils/googleDocsEmail'

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
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/session')
        const data = await response.json()
        if (data.user) {
          setUser(data.user)
        }
      } catch (error) {
        console.error('Session check failed:', error)
      } finally {
        setIsCheckingSession(false)
      }
    }
    checkSession()
  }, [setUser])

  // Check if ready for preview
  const isReadyToPreview = template && excelData && mappings.length > 0
  const hasUnmappedPlaceholders = mappings.some((m) => !m.excelColumn)
  const hasSendResults = sendResults.length > 0

  // Real Google OAuth sign-in
  const handleSignIn = async () => {
    setIsSigningIn(true)
    try {
      const response = await fetch('/api/auth/google-url')
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        console.error('No auth URL returned')
        setIsSigningIn(false)
      }
    } catch (error) {
      console.error('Sign-in failed:', error)
      setIsSigningIn(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout failed:', error)
    }
    setUser(null)
    reset()
  }

  // Send test email to yourself
  const handleTestSend = useCallback(async () => {
    if (!template || !excelData || !user || !template.sourceHtmlContent) return

    const firstRow = excelData.rows[0]

    try {
      // Generate email from Google Doc HTML with placeholders replaced
      const { subject, htmlBody } = generateEmailFromGoogleDoc(
        template.sourceHtmlContent,
        template.subject,
        firstRow,
        mappings
      )

      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: user.email,
          cc: template.cc,
          subject,
          htmlBody,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send test email')
      }

      alert(`Test email sent to ${user.email}!\n\nCheck your inbox.`)
    } catch (error) {
      alert(`Failed to send test email: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [template, excelData, user, mappings])

  // Send all emails using batch API
  const handleSendAll = useCallback(async () => {
    if (!template || !excelData || !user || !template.sourceHtmlContent) return

    setIsSending(true)
    setSendProgress({ sent: 0, total: excelData.totalRows })

    // Initialize all as pending
    const initialResults = excelData.rows.map((row, index) => ({
      rowIndex: index,
      email: row[excelData.emailColumn],
      status: 'pending' as const,
    }))
    setSendResults(initialResults)

    // Generate emails from Google Doc HTML for each row (synchronous now)
    const emails = excelData.rows.map((row, index) => {
      const { subject, htmlBody } = generateEmailFromGoogleDoc(
        template.sourceHtmlContent!,
        template.subject,
        row,
        mappings
      )
      return {
        rowIndex: index,
        to: row[excelData.emailColumn],
        cc: template.cc,
        subject,
        htmlBody,
      }
    })

    // Mark all as sending
    emails.forEach((_, index) => {
      updateSendResult(index, { status: 'sending' })
    })

    try {
      const response = await fetch('/api/email/send-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emails }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send emails')
      }

      // Update results from API response
      data.results.forEach((result: { rowIndex: number; status: string; messageId?: string; error?: string }) => {
        updateSendResult(result.rowIndex, {
          status: result.status as 'success' | 'failed',
          messageId: result.messageId,
          error: result.error,
          timestamp: new Date().toISOString(),
        })
      })

      setSendProgress({ sent: excelData.totalRows, total: excelData.totalRows })
    } catch (error) {
      // Mark all as failed if batch request fails
      emails.forEach((_, index) => {
        updateSendResult(index, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        })
      })
    }

    setIsSending(false)
  }, [template, excelData, user, mappings, setIsSending, setSendProgress, setSendResults, updateSendResult])

  // Retry single failed email
  const handleRetry = useCallback(async (rowIndex: number) => {
    if (!template || !excelData || !template.sourceHtmlContent) return

    const row = excelData.rows[rowIndex]
    updateSendResult(rowIndex, { status: 'sending' })

    try {
      // Generate email from Google Doc HTML with placeholders replaced
      const { subject, htmlBody } = generateEmailFromGoogleDoc(
        template.sourceHtmlContent,
        template.subject,
        row,
        mappings
      )

      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: row[excelData.emailColumn],
          cc: template.cc,
          subject,
          htmlBody,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send email')
      }

      updateSendResult(rowIndex, {
        status: 'success',
        messageId: result.messageId,
        error: undefined,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      updateSendResult(rowIndex, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      })
    }
  }, [template, excelData, mappings, updateSendResult])

  // Retry all failed emails
  const handleRetryAll = useCallback(async () => {
    const failedEmails = sendResults.filter((r) => r.status === 'failed')
    for (const failed of failedEmails) {
      await handleRetry(failed.rowIndex)
    }
  }, [sendResults, handleRetry])

  // Loading session check
  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="w-20 h-20 bg-primary-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
          <span className="text-3xl font-bold text-white">O</span>
        </div>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

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

        {/* Step 1: Select Files */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Step 1: Select Files</CardTitle>
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
          Otto - Automated bulk email sending made simple
        </div>
      </footer>
    </div>
  )
}
