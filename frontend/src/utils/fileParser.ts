import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import type { ParsedTemplate, ExcelData } from '../types'

// Extract placeholders like [Name], [Company], etc.
function extractPlaceholders(text: string): string[] {
  const regex = /\[([^\]]+)\]/g
  const placeholders: string[] = []
  let match
  while ((match = regex.exec(text)) !== null) {
    if (!placeholders.includes(match[1])) {
      placeholders.push(match[1])
    }
  }
  return placeholders
}

// Parse template from text content
function parseTemplateText(text: string): { subject: string; cc: string[]; body: string } {
  const lines = text.split('\n')
  let subject = ''
  let cc: string[] = []
  let bodyStartIndex = 0

  // Find Subject line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.toLowerCase().startsWith('subject:')) {
      subject = line.substring(8).trim()
    } else if (line.toLowerCase().startsWith('cc:')) {
      cc = line
        .substring(3)
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)
    } else if (line === '---') {
      bodyStartIndex = i + 1
      break
    }
  }

  const body = lines.slice(bodyStartIndex).join('\n').trim()
  return { subject, cc, body }
}

export async function parseDocxFile(file: File): Promise<ParsedTemplate> {
  const arrayBuffer = await file.arrayBuffer()

  // Convert DOCX to HTML using mammoth
  const result = await mammoth.convertToHtml({ arrayBuffer })
  const htmlContent = result.value

  // Also get raw text for parsing subject/cc/placeholders
  const textResult = await mammoth.extractRawText({ arrayBuffer })
  const rawText = textResult.value

  // Parse the template
  const { subject, cc } = parseTemplateText(rawText)
  const placeholders = extractPlaceholders(rawText)

  // Extract body HTML after separator
  let htmlBody = htmlContent
  const separatorIndex = htmlContent.indexOf('---')
  if (separatorIndex !== -1) {
    // Find the paragraph containing ---
    const beforeSep = htmlContent.substring(0, separatorIndex)
    const lastPStart = beforeSep.lastIndexOf('<p')
    if (lastPStart !== -1) {
      const afterSep = htmlContent.substring(separatorIndex)
      const nextPEnd = afterSep.indexOf('</p>')
      if (nextPEnd !== -1) {
        htmlBody = htmlContent.substring(separatorIndex + nextPEnd + 4).trim()
      }
    }
  }

  return {
    subject,
    cc,
    htmlBody,
    placeholders,
    rawText,
    sourceHtmlContent: htmlContent,
  }
}

export async function parseExcelFile(file: File): Promise<ExcelData> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })

  // Get first sheet
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  // Convert to JSON with headers (as array of arrays)
  const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })

  if (jsonData.length < 2) {
    throw new Error('Excel file must have headers and at least one data row')
  }

  // First row is headers
  const headers = jsonData[0].map((h) => String(h || '').trim())

  // Find email column
  const emailColumn =
    headers.find((h) =>
      ['email', 'e-mail', 'emailaddress', 'email address', 'emails'].includes(
        h.toLowerCase().replace(/[\s_-]/g, '')
      )
    ) || null

  if (!emailColumn) {
    throw new Error(
      'Could not find email column. Please ensure your spreadsheet has a column named "Email"'
    )
  }

  // Convert rows to objects
  const warnings: string[] = []
  const rows = jsonData.slice(1).map((row, index) => {
    const rowData: Record<string, string> = {}
    headers.forEach((header, colIndex) => {
      rowData[header] = String(row[colIndex] || '').trim()
    })

    // Validate email
    const email = rowData[emailColumn]
    if (!isValidEmail(email)) {
      warnings.push(`Row ${index + 2}: Invalid email "${email}"`)
    }

    return rowData
  })

  return {
    headers,
    rows,
    emailColumn,
    totalRows: rows.length,
    warnings,
  }
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
