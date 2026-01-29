import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { FileText, Upload, Check, X, AlertCircle } from 'lucide-react'
import { useEmailStore } from '../../stores/emailStore'
import { parseDocxTemplate } from '../../utils/fileParser'
import { autoMapPlaceholders } from '../../utils/placeholders'

export function TemplateUpload() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { template, templateFileName, excelData, setTemplate, setMappings } = useEmailStore()

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file) return

      setIsLoading(true)
      setError(null)

      try {
        const parsed = await parseDocxTemplate(file)
        setTemplate(parsed, file.name)

        // Auto-map placeholders if excel data is already loaded
        if (excelData) {
          const mappings = autoMapPlaceholders(parsed.placeholders, excelData.headers)
          setMappings(mappings)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse template')
        setTemplate(null)
      } finally {
        setIsLoading(false)
      }
    },
    [excelData, setTemplate, setMappings]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    disabled: isLoading,
  })

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    setTemplate(null)
    setMappings([])
    setError(null)
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
          ${isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'}
          ${template ? 'border-green-500 bg-green-50' : ''}
          ${error ? 'border-red-500 bg-red-50' : ''}
          ${isLoading ? 'opacity-50 cursor-wait' : ''}
        `}
      >
        <input {...getInputProps()} />

        {isLoading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mb-3" />
            <p className="text-gray-600">Parsing template...</p>
          </div>
        ) : template ? (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <p className="font-medium text-gray-900">{templateFileName}</p>
            <p className="text-sm text-gray-500 mt-1">
              {template.placeholders.length} placeholder{template.placeholders.length !== 1 ? 's' : ''} found
            </p>
            {template.placeholders.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
                {template.placeholders.slice(0, 5).map((p) => (
                  <span
                    key={p}
                    className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full"
                  >
                    [{p}]
                  </span>
                ))}
                {template.placeholders.length > 5 && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                    +{template.placeholders.length - 5} more
                  </span>
                )}
              </div>
            )}
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <p className="font-medium text-red-900">Upload failed</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
            <p className="text-xs text-gray-500 mt-2">Click to try again</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              {isDragActive ? (
                <Upload className="w-6 h-6 text-primary-600" />
              ) : (
                <FileText className="w-6 h-6 text-gray-400" />
              )}
            </div>
            <p className="font-medium text-gray-900">
              {isDragActive ? 'Drop your template here' : 'Email Template'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Drop a .docx file or click to browse
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
