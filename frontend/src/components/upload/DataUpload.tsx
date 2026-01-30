import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Table, Check, X, AlertCircle, AlertTriangle, Link, Upload, Download } from 'lucide-react'
import { useEmailStore } from '../../stores/emailStore'
import { autoMapPlaceholders } from '../../utils/placeholders'
import { parseExcelFile } from '../../utils/fileParser'
import { GooglePicker } from '../picker/GooglePicker'

export function DataUpload() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { excelData, excelFileName, template, setExcelData, setMappings } = useEmailStore()

  // Handle local Excel file upload
  const handleFileUpload = useCallback(
    async (file: File) => {
      setIsLoading(true)
      setError(null)

      try {
        const data = await parseExcelFile(file)
        setExcelData(data, file.name)

        // Auto-map placeholders if template is already loaded
        if (template) {
          const mappings = autoMapPlaceholders(template.placeholders, data.headers)
          setMappings(mappings)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse spreadsheet')
        setExcelData(null)
      } finally {
        setIsLoading(false)
      }
    },
    [template, setExcelData, setMappings]
  )

  // Handle Google Sheet selection
  const handleSheetSelect = useCallback(
    async (file: { id: string; name: string; mimeType: string }) => {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch sheet data from backend
        const response = await fetch(`/api/sheets/${file.id}/data`)
        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || 'Failed to fetch spreadsheet')
        }

        const data = await response.json()
        setExcelData(data, file.name, file.id)

        // Auto-map placeholders if template is already loaded
        if (template) {
          const mappings = autoMapPlaceholders(template.placeholders, data.headers)
          setMappings(mappings)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load spreadsheet')
        setExcelData(null)
      } finally {
        setIsLoading(false)
      }
    },
    [template, setExcelData, setMappings]
  )

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        handleFileUpload(acceptedFiles[0])
      }
    },
    [handleFileUpload]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    disabled: isLoading,
  })

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExcelData(null)
    setMappings([])
    setError(null)
  }

  if (isLoading) {
    return (
      <div className="border-2 border-dashed rounded-xl p-8 text-center border-gray-300">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mb-3" />
          <p className="text-gray-600">Loading spreadsheet...</p>
        </div>
      </div>
    )
  }

  if (excelData) {
    return (
      <div className="relative border-2 border-dashed rounded-xl p-8 text-center border-green-500 bg-green-50">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <p className="font-medium text-gray-900">{excelFileName}</p>
          <p className="text-sm text-gray-500 mt-1">
            {excelData.totalRows} recipient{excelData.totalRows !== 1 ? 's' : ''} found
          </p>
          {excelData.warnings.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs">
                {excelData.warnings.length} warning{excelData.warnings.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
            {excelData.headers.slice(0, 4).map((h) => (
              <span
                key={h}
                className={`px-2 py-0.5 text-xs rounded-full ${
                  h === excelData.emailColumn
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {h}
              </span>
            ))}
            {excelData.headers.length > 4 && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                +{excelData.headers.length - 4} more
              </span>
            )}
          </div>
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="border-2 border-dashed rounded-xl p-8 text-center border-red-500 bg-red-50 cursor-pointer"
        onClick={() => setError(null)}
      >
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <p className="font-medium text-red-900">Failed to load spreadsheet</p>
          <p className="text-sm text-red-600 mt-1">{error}</p>
          <p className="text-xs text-gray-500 mt-2">Click to try again</p>
        </div>
      </div>
    )
  }

  return (
    <div className="border-2 border-dashed rounded-xl p-6 text-center border-gray-300">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <Table className="w-6 h-6 text-gray-400" />
        </div>
        <p className="font-medium text-gray-900 mb-1">Recipient Data</p>
        <p className="text-sm text-gray-500 mb-4">Google Sheet (recommended) or Excel file</p>

        <div className="flex flex-col gap-3 w-full">
          {/* Google Drive option */}
          <GooglePicker
            onSelect={handleSheetSelect}
            mimeTypes={['application/vnd.google-apps.spreadsheet']}
            buttonText="Select from Google Drive"
            buttonIcon={<Link className="w-4 h-4" />}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors text-sm font-medium"
          />

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="flex-1 border-t border-gray-200" />
            <span>or</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          {/* File upload option */}
          <div
            {...getRootProps()}
            className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 border-2 border-dashed rounded-lg cursor-pointer transition-colors text-sm ${
              isDragActive
                ? 'border-primary-400 bg-primary-50 text-primary-600'
                : 'border-gray-300 hover:border-gray-400 text-gray-600'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-4 h-4" />
            <span>{isDragActive ? 'Drop file here' : 'Upload Excel/CSV file'}</span>
          </div>

          {/* Download sample data */}
          <a
            href="/sample-data.xlsx"
            download
            className="flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-primary-600 transition-colors mt-1"
          >
            <Download className="w-3 h-3" />
            <span>Download sample spreadsheet</span>
          </a>
        </div>
      </div>
    </div>
  )
}
