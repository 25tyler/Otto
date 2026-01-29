import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import type { ParsedTemplate, ExcelData } from '../types'
import { extractPlaceholders } from './placeholders'

export async function parseDocxTemplate(file: File): Promise<ParsedTemplate> {
  const arrayBuffer = await file.arrayBuffer()

  // Convert DOCX to HTML with mammoth
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "b => strong",
        "i => em",
        "u => u",
        "strike => del",
      ],
    }
  )

  const fullHtml = result.value
  const rawText = await mammoth.extractRawText({ arrayBuffer }).then((r) => r.value)

  // Find the --- separator
  const separatorIndex = fullHtml.indexOf('<p>---</p>')
  const textSeparatorIndex = rawText.indexOf('---')

  let htmlBody = fullHtml
  let textHeader = ''

  if (separatorIndex !== -1) {
    htmlBody = fullHtml.substring(separatorIndex + '<p>---</p>'.length).trim()
  }

  if (textSeparatorIndex !== -1) {
    textHeader = rawText.substring(0, textSeparatorIndex)
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

  // Find all placeholders in subject and body
  const allText = subject + ' ' + htmlBody
  const placeholders = extractPlaceholders(allText)

  return {
    subject,
    cc,
    htmlBody,
    placeholders,
    rawText,
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
