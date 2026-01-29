import { Check, AlertTriangle, ArrowRight } from 'lucide-react'
import { useEmailStore } from '../../stores/emailStore'

export function PlaceholderMapper() {
  const { mappings, excelData, updateMapping } = useEmailStore()

  if (!excelData || mappings.length === 0) {
    return null
  }

  const unmappedCount = mappings.filter((m) => !m.excelColumn).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Map each placeholder to an Excel column
        </p>
        {unmappedCount > 0 && (
          <span className="flex items-center gap-1.5 text-sm text-amber-600">
            <AlertTriangle className="w-4 h-4" />
            {unmappedCount} unmapped
          </span>
        )}
      </div>

      <div className="space-y-3">
        {mappings.map(({ placeholder, excelColumn, status }) => (
          <div
            key={placeholder}
            className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
          >
            <span className="px-3 py-1.5 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-lg min-w-[120px] text-center">
              [{placeholder}]
            </span>

            <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />

            <select
              value={excelColumn || ''}
              onChange={(e) => updateMapping(placeholder, e.target.value || null)}
              className={`
                flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent
                ${excelColumn ? 'border-green-300 bg-green-50' : 'border-gray-300'}
              `}
            >
              <option value="">Select column...</option>
              {excelData.headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>

            <div className="w-6 flex-shrink-0">
              {status === 'auto-mapped' || status === 'mapped' ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              )}
            </div>
          </div>
        ))}
      </div>

      {unmappedCount > 0 && (
        <p className="text-sm text-amber-600 bg-amber-50 px-4 py-3 rounded-lg">
          Unmapped placeholders will appear as-is in your emails (e.g., [Placeholder])
        </p>
      )}
    </div>
  )
}
