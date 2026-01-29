import { Send } from 'lucide-react'

interface ProgressModalProps {
  isOpen: boolean
  sent: number
  total: number
}

export function ProgressModal({ isOpen, sent, total }: ProgressModalProps) {
  if (!isOpen) return null

  const percentage = total > 0 ? Math.round((sent / total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mb-4">
            <Send className="w-8 h-8 text-primary-600 animate-pulse" />
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Sending Emails...
          </h3>

          <p className="text-sm text-gray-500 mb-4">
            Please don't close this window
          </p>

          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div
              className="bg-primary-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>

          <p className="text-sm font-medium text-gray-700">
            {sent} of {total} sent ({percentage}%)
          </p>
        </div>
      </div>
    </div>
  )
}
