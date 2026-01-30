import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { FileText, Check, X, AlertCircle, Link, Upload, Download } from 'lucide-react'
import { useEmailStore } from '../../stores/emailStore'
import { extractPlaceholders, autoMapPlaceholders } from '../../utils/placeholders'
import { parseDocxFile } from '../../utils/fileParser'
import { GooglePicker } from '../picker/GooglePicker'

export function TemplateUpload() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { template, templateFileName, excelData, setTemplate, setMappings } = useEmailStore()

  // Handle local DOCX file upload
  const handleFileUpload = useCallback(
    async (file: File) => {
      setIsLoading(true)
      setError(null)

      try {
        const parsed = await parseDocxFile(file)
        setTemplate(parsed, file.name)

        // Auto-map if data exists
        if (excelData) {
          const mappings = autoMapPlaceholders(parsed.placeholders, excelData.headers)
          setMappings(mappings)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse document')
        setTemplate(null)
      } finally {
        setIsLoading(false)
      }
    },
    [excelData, setTemplate, setMappings]
  )

  // Handle Google Doc selection
  const handleDocSelect = useCallback(
    async (file: { id: string; name: string; mimeType: string }) => {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch doc content from backend
        const response = await fetch(`/api/docs/${file.id}/content`)
        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || 'Failed to fetch document')
        }

        const { htmlContent, rawText } = await response.json()

        // Parse subject, CC, placeholders from raw text
        const separatorIndex = rawText.indexOf('---')
        let header = ''
        let bodyText = rawText

        if (separatorIndex !== -1) {
          header = rawText.substring(0, separatorIndex)
          bodyText = rawText.substring(separatorIndex + 3).trim()
        }

        const subjectMatch = header.match(/Subject:\s*(.+?)(?:\n|$)/i)
        const subject = subjectMatch ? subjectMatch[1].trim() : 'No Subject'

        const ccMatch = header.match(/CC:\s*(.+?)(?:\n|$)/i)
        const ccString = ccMatch ? ccMatch[1].trim() : ''
        const cc = ccString
          .split(',')
          .map((e) => e.trim())
          .filter((e) => e.includes('@'))

        const placeholders = extractPlaceholders(subject + ' ' + bodyText)

        const parsed = {
          subject,
          cc,
          htmlBody: '',
          placeholders,
          rawText,
          googleDocId: file.id,
          sourceHtmlContent: htmlContent,
        }

        setTemplate(parsed, file.name, file.id)

        // Auto-map if data exists
        if (excelData) {
          const mappings = autoMapPlaceholders(parsed.placeholders, excelData.headers)
          setMappings(mappings)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load document')
        setTemplate(null)
      } finally {
        setIsLoading(false)
      }
    },
    [excelData, setTemplate, setMappings]
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

  if (isLoading) {
    return (
      <div className="border-2 border-dashed rounded-xl p-8 text-center border-gray-300">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mb-3" />
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    )
  }

  if (template) {
    return (
      <div className="relative border-2 border-dashed rounded-xl p-8 text-center border-green-500 bg-green-50">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <p className="font-medium text-gray-900">{templateFileName}</p>
          <p className="text-sm text-gray-500 mt-1">
            {template.placeholders.length} placeholder
            {template.placeholders.length !== 1 ? 's' : ''} found
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
          <p className="font-medium text-red-900">Failed to load document</p>
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
          <FileText className="w-6 h-6 text-gray-400" />
        </div>
        <p className="font-medium text-gray-900 mb-1">Email Template</p>
        <p className="text-sm text-gray-500 mb-4">Google Doc (recommended) or DOCX file</p>

        <div className="flex flex-col gap-3 w-full">
          {/* Google Drive option */}
          <GooglePicker
            onSelect={handleDocSelect}
            mimeTypes={['application/vnd.google-apps.document']}
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
            <span>{isDragActive ? 'Drop file here' : 'Upload DOCX file'}</span>
          </div>

          {/* Download sample template */}
          <a
            href="/sample-template.docx"
            download
            className="flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-primary-600 transition-colors mt-1"
          >
            <Download className="w-3 h-3" />
            <span>Download sample template</span>
          </a>
        </div>
      </div>
    </div>
  )
}
