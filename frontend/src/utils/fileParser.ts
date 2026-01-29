import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import type { ParsedTemplate, ExcelData } from '../types'
import { extractPlaceholders } from './placeholders'

export async function parseDocxTemplate(file: File): Promise<ParsedTemplate> {
  const arrayBuffer = await file.arrayBuffer()

  // Use mammoth to extract raw text for parsing subject/cc/placeholders
  const rawText = await mammoth.extractRawText({ arrayBuffer }).then((r) => r.value)

  // Find the --- separator in raw text
  const separatorIndex = rawText.indexOf('---')
  let header = ''
  let bodyText = rawText

  if (separatorIndex !== -1) {
    header = rawText.substring(0, separatorIndex)
    bodyText = rawText.substring(separatorIndex + 3).trim()
  }

  // Extract subject line
  const subjectMatch = header.match(/Subject:\s*(.+?)(?:\n|$)/i)
  const subject = subjectMatch ? subjectMatch[1].trim() : 'No Subject'

  // Extract CC recipients
  const ccMatch = header.match(/CC:\s*(.+?)(?:\n|$)/i)
  const ccString = ccMatch ? ccMatch[1].trim() : ''
  const cc = ccString
    .split(',')
    .map((email) => email.trim())
    .filter((email) => email.length > 0 && email.includes('@'))

  // Find all placeholders in subject and body
  const allText = subject + ' ' + bodyText
  const placeholders = extractPlaceholders(allText)

  return {
    subject,
    cc,
    htmlBody: '', // Will be generated per-email using docxtemplater
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
