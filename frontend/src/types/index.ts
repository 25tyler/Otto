export interface User {
  email: string
  name: string
  picture: string
}

export interface ParsedTemplate {
  subject: string
  cc: string[]
  htmlBody: string
  placeholders: string[]
  rawText: string
  docxArrayBuffer?: ArrayBuffer
  // Google Docs source
  googleDocId?: string
  sourceHtmlContent?: string
}

export interface GoogleFileRef {
  id: string
  name: string
  mimeType: string
}

export interface ExcelData {
  headers: string[]
  rows: Record<string, string>[]
  emailColumn: string
  totalRows: number
  warnings: string[]
}

export interface PlaceholderMapping {
  placeholder: string
  excelColumn: string | null
  status: 'mapped' | 'unmapped' | 'auto-mapped'
}

export interface SendResult {
  rowIndex: number
  email: string
  status: 'success' | 'failed' | 'pending' | 'sending'
  messageId?: string
  error?: string
  timestamp?: string
}

export interface EmailPreviewData {
  from: string
  to: string
  cc: string[]
  subject: string
  htmlBody: string
}
