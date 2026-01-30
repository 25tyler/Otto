import { useState, useMemo } from 'react'
import { useEmailStore } from '../../stores/emailStore'
import { generateEmailFromGoogleDoc } from '../../utils/googleDocsEmail'
import { EmailCard } from './EmailCard'
import { NavigationControls } from './NavigationControls'
import { Mail } from 'lucide-react'

export function EmailPreview() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const { template, excelData, mappings, user } = useEmailStore()

  const currentRow = excelData?.rows[currentIndex]
  const totalRows = excelData?.rows.length || 0

  // Generate preview synchronously using useMemo (Google Docs HTML is already available)
  const preview = useMemo(() => {
    if (!template?.sourceHtmlContent || !currentRow || !mappings) {
      return null
    }

    try {
      return generateEmailFromGoogleDoc(
        template.sourceHtmlContent,
        template.subject,
        currentRow,
        mappings
      )
    } catch (error) {
      console.error('Failed to generate preview:', error)
      return null
    }
  }, [template, currentRow, mappings])

  if (!template || !excelData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Mail className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-500">
          Select a template and spreadsheet to preview emails
        </p>
      </div>
    )
  }

  if (!preview || !currentRow) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Mail className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-500">Unable to generate preview</p>
      </div>
    )
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
