import { useState } from 'react'
import { Send, TestTube, AlertCircle } from 'lucide-react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { useEmailStore } from '../../stores/emailStore'
import { ProgressModal } from './ProgressModal'

interface SendControlsProps {
  onTestSend: () => Promise<void>
  onSendAll: () => Promise<void>
}

export function SendControls({ onTestSend, onSendAll }: SendControlsProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [isTestSending, setIsTestSending] = useState(false)
  const { excelData, mappings, isSending, sendProgress } = useEmailStore()

  const totalEmails = excelData?.totalRows || 0
  const unmappedCount = mappings.filter((m) => !m.excelColumn).length

  const handleTestSend = async () => {
    setIsTestSending(true)
    try {
      await onTestSend()
    } finally {
      setIsTestSending(false)
    }
  }

  const handleSendAll = async () => {
    setShowConfirm(false)
    await onSendAll()
  }

  return (
    <>
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <Button
          variant="secondary"
          onClick={handleTestSend}
          isLoading={isTestSending}
          disabled={isSending}
        >
          <TestTube className="w-4 h-4 mr-2" />
          Send Test to Myself
        </Button>

        <Button
          variant="primary"
          onClick={() => setShowConfirm(true)}
          disabled={isSending || totalEmails === 0}
        >
          <Send className="w-4 h-4 mr-2" />
          Send All {totalEmails} Email{totalEmails !== 1 ? 's' : ''}
        </Button>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Confirm Send"
        size="md"
      >
        <div className="px-6 pb-6">
          <p className="text-gray-600 mb-4">
            You are about to send <strong>{totalEmails}</strong> email{totalEmails !== 1 ? 's' : ''}.
            This action cannot be undone.
          </p>

          {unmappedCount > 0 && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800">
                  {unmappedCount} placeholder{unmappedCount !== 1 ? 's are' : ' is'} unmapped
                </p>
                <p className="text-amber-700 mt-1">
                  These will appear as [Placeholder] in your emails.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <Button
              variant="secondary"
              onClick={() => setShowConfirm(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSendAll}
              className="flex-1"
            >
              Send {totalEmails} Email{totalEmails !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Progress Modal */}
      <ProgressModal
        isOpen={isSending}
        sent={sendProgress.sent}
        total={sendProgress.total}
      />
    </>
  )
}
