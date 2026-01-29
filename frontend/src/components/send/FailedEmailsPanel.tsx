import { useState } from 'react'
import { AlertCircle, RefreshCw, Edit, Check, X } from 'lucide-react'
import { useEmailStore } from '../../stores/emailStore'
import { Button } from '../ui/Button'

interface FailedEmailsPanelProps {
  onRetry: (rowIndex: number) => Promise<void>
  onRetryAll: () => Promise<void>
}

export function FailedEmailsPanel({ onRetry, onRetryAll }: FailedEmailsPanelProps) {
  const { sendResults, excelData } = useEmailStore()
  const [editingRow, setEditingRow] = useState<number | null>(null)
  const [editedData, setEditedData] = useState<Record<string, string>>({})
  const [retrying, setRetrying] = useState<number | null>(null)
  const [retryingAll, setRetryingAll] = useState(false)

  const failedEmails = sendResults.filter((r) => r.status === 'failed')

  if (failedEmails.length === 0) {
    return null
  }

  const handleEdit = (rowIndex: number) => {
    const rowData = excelData?.rows[rowIndex]
    if (rowData) {
      setEditedData({ ...rowData })
      setEditingRow(rowIndex)
    }
  }

  const handleSaveEdit = () => {
    // Note: In a real implementation, you would update the excelData store
    // For now, we just close the edit mode
    setEditingRow(null)
    setEditedData({})
  }

  const handleRetry = async (rowIndex: number) => {
    setRetrying(rowIndex)
    try {
      await onRetry(rowIndex)
    } finally {
      setRetrying(null)
    }
  }

  const handleRetryAll = async () => {
    setRetryingAll(true)
    try {
      await onRetryAll()
    } finally {
      setRetryingAll(false)
    }
  }

  return (
    <div className="bg-red-50 rounded-xl border border-red-200 overflow-hidden">
      <div className="px-6 py-4 bg-red-100 border-b border-red-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-900">
              {failedEmails.length} Failed Email{failedEmails.length > 1 ? 's' : ''}
            </h3>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={handleRetryAll}
            isLoading={retryingAll}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry All
          </Button>
        </div>
      </div>

      <div className="divide-y divide-red-200">
        {failedEmails.map((failed) => {
          const rowData = excelData?.rows[failed.rowIndex]
          const isEditing = editingRow === failed.rowIndex
          const isRetrying = retrying === failed.rowIndex

          return (
            <div key={failed.rowIndex} className="px-6 py-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      Row {failed.rowIndex + 2}: {failed.email}
                    </span>
                  </div>
                  <p className="text-sm text-red-600">{failed.error}</p>

                  {isEditing && rowData && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {Object.entries(editedData).map(([key, value]) => (
                        <div key={key}>
                          <label className="block text-xs text-gray-500 mb-1">
                            {key}
                          </label>
                          <input
                            type="text"
                            value={value}
                            onChange={(e) =>
                              setEditedData((d) => ({ ...d, [key]: e.target.value }))
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300
                                       rounded focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleSaveEdit}
                        className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                        title="Save changes"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingRow(null)
                          setEditedData({})
                        }}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEdit(failed.rowIndex)}
                        className="p-2 text-gray-600 hover:bg-white rounded-lg transition-colors"
                        title="Edit data"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRetry(failed.rowIndex)}
                        disabled={isRetrying}
                        className="p-2 text-primary-600 hover:bg-white rounded-lg transition-colors disabled:opacity-50"
                        title="Retry"
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`}
                        />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
