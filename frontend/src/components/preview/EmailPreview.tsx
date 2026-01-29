import { useState, useEffect } from 'react'
import { useEmailStore } from '../../stores/emailStore'
import { generateEmailPreview } from '../../utils/docxEmail'
import { EmailCard } from './EmailCard'
import { NavigationControls } from './NavigationControls'
import { Mail, Loader2 } from 'lucide-react'

export function EmailPreview() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [preview, setPreview] = useState<{ subject: string; htmlBody: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { template, excelData, mappings, user } = useEmailStore()

  const currentRow = excelData?.rows[currentIndex]
  const totalRows = excelData?.rows.length || 0

  // Generate preview when row changes
  useEffect(() => {
    if (!template || !currentRow || !mappings || !template.docxArrayBuffer) {
      setPreview(null)
      return
    }

    let cancelled = false
    setIsLoading(true)

    generateEmailPreview(
      template.docxArrayBuffer,
      template.subject,
      currentRow,
      mappings
    ).then((result) => {
      if (!cancelled) {
        setPreview(result)
        setIsLoading(false)
      }
    }).catch((error) => {
      console.error('Failed to generate preview:', error)
      if (!cancelled) {
        setPreview(null)
        setIsLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [template, currentRow, mappings])

  if (!template || !excelData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Mail className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-500">
          Upload a template and Excel file to preview emails
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin mb-4" />
        <p className="text-gray-500">Generating preview...</p>
      </div>
    )
  }

  if (!preview || !currentRow) {
    return null
  }

  const recipientEmail = currentRow[excelData.emailColumn]

  return (
    <div className="space-y-4">
      <NavigationControls
        currentIndex={currentIndex}
        totalCount={totalRows}
        onPrevious={() => setCurrentIndex((i) => Math.max(0, i - 1))}
        onNext={() => setCurrentIndex((i) => Math.min(totalRows - 1, i + 1))}
        onJumpTo={setCurrentIndex}
      />

      <EmailCard
        from={user?.email || 'your-email@gmail.com'}
        to={recipientEmail}
        cc={template.cc}
        subject={preview.subject}
        htmlBody={preview.htmlBody}
        rowNumber={currentIndex + 1}
      />
    </div>
  )
}
