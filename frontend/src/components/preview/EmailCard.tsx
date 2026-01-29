interface EmailCardProps {
  from: string
  to: string
  cc: string[]
  subject: string
  htmlBody: string
  rowNumber: number
}

export function EmailCard({
  from,
  to,
  cc,
  subject,
  htmlBody,
  rowNumber,
}: EmailCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Email Header */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Preview #{rowNumber}
          </span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex">
            <span className="w-16 text-gray-500 font-medium flex-shrink-0">From:</span>
            <span className="text-gray-900">{from}</span>
          </div>
          <div className="flex">
            <span className="w-16 text-gray-500 font-medium flex-shrink-0">To:</span>
            <span className="text-gray-900">{to}</span>
          </div>
          {cc.length > 0 && (
            <div className="flex">
              <span className="w-16 text-gray-500 font-medium flex-shrink-0">CC:</span>
              <span className="text-gray-900">{cc.join(', ')}</span>
            </div>
          )}
          <div className="flex">
            <span className="w-16 text-gray-500 font-medium flex-shrink-0">Subject:</span>
            <span className="text-gray-900 font-medium">{subject}</span>
          </div>
        </div>
      </div>

      {/* Email Body */}
      <div className="px-6 py-4">
        <div
          className="prose prose-sm max-w-none email-body"
          dangerouslySetInnerHTML={{ __html: htmlBody }}
        />
      </div>
    </div>
  )
}
