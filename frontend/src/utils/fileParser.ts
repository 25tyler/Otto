import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import { renderAsync } from 'docx-preview'
import type { ParsedTemplate, ExcelData } from '../types'
import { extractPlaceholders } from './placeholders'

export async function parseDocxTemplate(file: File): Promise<ParsedTemplate> {
  const arrayBuffer = await file.arrayBuffer()

  // Use docx-preview to render to HTML with full formatting preserved
  const container = document.createElement('div')
  await renderAsync(arrayBuffer, container, undefined, {
    inWrapper: false,
    ignoreWidth: true,
    ignoreHeight: true,
  })

  // Get the rendered HTML
  const fullHtml = container.innerHTML

  // Also get raw text using mammoth for subject/cc extraction
  const rawText = await mammoth.extractRawText({ arrayBuffer }).then((r) => r.value)

  // Find the --- separator in raw text for header extraction
  const textSeparatorIndex = rawText.indexOf('---')
  let textHeader = ''
  let textBody = rawText

  if (textSeparatorIndex !== -1) {
    textHeader = rawText.substring(0, textSeparatorIndex)
    textBody = rawText.substring(textSeparatorIndex + 3).trim()
  }

  // Extract subject line
  const subjectMatch = textHeader.match(/Subject:\s*(.+?)(?:\n|$)/i)
  const subject = subjectMatch ? subjectMatch[1].trim() : 'No Subject'

  // Extract CC recipients
  const ccMatch = textHeader.match(/CC:\s*(.+?)(?:\n|$)/i)
  const ccString = ccMatch ? ccMatch[1].trim() : ''
  const cc = ccString
    .split(',')
    .map((email) => email.trim())
    .filter((email) => email.length > 0 && email.includes('@'))

  // Find the --- separator in HTML and extract body
  // docx-preview may render --- in various ways, so try multiple patterns
  let htmlBody = fullHtml

  // Try to find "---" in the HTML (might be wrapped in spans, paragraphs, etc.)
  const separatorPatterns = [
    />-{3,}</,           // >---<
    />-{3,}\s*</,        // >--- < with whitespace
    /<[^>]*>-{3,}<\/[^>]*>/, // full element containing ---
  ]

  let foundSeparator = false
  for (const pattern of separatorPatterns) {
    const match = fullHtml.match(pattern)
    if (match && match.index !== undefined) {
      // Find the end of the element containing the separator
      const afterMatch = fullHtml.substring(match.index + match[0].length)
      // Skip any closing tags until we find opening content
      const nextContentMatch = afterMatch.match(/<(?!\/)[^>]+>/)
      if (nextContentMatch && nextContentMatch.index !== undefined) {
        htmlBody = afterMatch.substring(nextContentMatch.index).trim()
        foundSeparator = true
        break
      }
    }
  }

  // If no separator found in HTML, try to extract body based on text content
  if (!foundSeparator && textBody) {
    // Get the first line of the body text to search for in HTML
    const firstBodyLine = textBody.split('\n')[0].trim()
    if (firstBodyLine) {
      const bodyStartIndex = fullHtml.indexOf(firstBodyLine)
      if (bodyStartIndex !== -1) {
        // Find the start of the element containing this text
        const beforeText = fullHtml.substring(0, bodyStartIndex)
        const lastOpenTag = beforeText.lastIndexOf('<')
        if (lastOpenTag !== -1) {
          htmlBody = fullHtml.substring(lastOpenTag).trim()
          foundSeparator = true
        }
      }
    }
  }

  // Find all placeholders in subject and body
  const allText = subject + ' ' + rawText
  const placeholders = extractPlaceholders(allText)

  return {
    subject,
    cc,
    htmlBody,
    placeholders,
    rawText,
    docxArrayBuffer: arrayBuffer,
  }
}

export function parseExcelFile(file: File): Promise<ExcelData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })

        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]

        // Convert to JSON with headers
        const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: '',
          raw: false,
        })

        if (rawData.length === 0) {
          reject(new Error('Excel file is empty or has no data rows'))
          return
        }

        const headers = Object.keys(rawData[0])
        const warnings: string[] = []

        // Find email column
        const emailColumn = headers.find((h) =>
          ['email', 'e-mail', 'emailaddress', 'email address', 'emails'].includes(
            h.toLowerCase().replace(/[\s_-]/g, '')
          )
        )

        if (!emailColumn) {
          reject(
            new Error(
              'Could not find email column. Please ensure your Excel file has a column named "Email"'
            )
          )
          return
        }

        // Validate and clean data
        const rows = rawData.map((row, index) => {
          const cleanedRow: Record<string, string> = {}

          headers.forEach((header) => {
            cleanedRow[header] = String(row[header] || '').trim()
          })

          // Validate email
          const email = cleanedRow[emailColumn]
          if (!isValidEmail(email)) {
            warnings.push(`Row ${index + 2}: Invalid email "${email}"`)
          }

          return cleanedRow
        })

        resolve({
          headers,
          rows,
          emailColumn,
          totalRows: rows.length,
          warnings,
        })
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('Failed to read Excel file'))
    reader.readAsArrayBuffer(file)
  })
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
