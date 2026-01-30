import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { renderAsync } from 'docx-preview'
import type { PlaceholderMapping } from '../types'

interface GeneratedEmail {
  subject: string
  htmlBody: string
}

/**
 * Generate an email by replacing placeholders in the DOCX and rendering to HTML.
 * This preserves the exact formatting from the original DOCX document.
 */
export async function generateEmailFromDocx(
  docxArrayBuffer: ArrayBuffer,
  subject: string,
  rowData: Record<string, string>,
  mappings: PlaceholderMapping[]
): Promise<GeneratedEmail> {
  // Build the data object for docxtemplater
  // Convert [Placeholder] style to {Placeholder} style for docxtemplater
  const templateData: Record<string, string> = {}
  mappings.forEach(({ placeholder, excelColumn }) => {
    if (excelColumn && rowData[excelColumn] !== undefined) {
      templateData[placeholder] = rowData[excelColumn]
    }
  })

  // Replace placeholders in subject
  let processedSubject = subject
  mappings.forEach(({ placeholder, excelColumn }) => {
    if (excelColumn && rowData[excelColumn] !== undefined) {
      const regex = new RegExp(`\\[${escapeRegex(placeholder)}\\]`, 'gi')
      processedSubject = processedSubject.replace(regex, rowData[excelColumn])
    }
  })

  // Create a copy of the DOCX with placeholders replaced
  const zip = new PizZip(docxArrayBuffer)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // Custom delimiter to match [Placeholder] style
    delimiters: { start: '[', end: ']' },
  })

  // Render the document with data (replace all placeholders)
  doc.render(templateData)

  // Get the modified DOCX as ArrayBuffer
  const modifiedDocx = doc.getZip().generate({
    type: 'arraybuffer',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })

  // Render the modified DOCX to HTML using docx-preview
  const container = document.createElement('div')
  await renderAsync(modifiedDocx, container, undefined, {
    inWrapper: false,
    ignoreWidth: true,
    ignoreHeight: true,
  })

  // Extract body content (after --- separator)
  const htmlBody = extractBodyFromHtml(container.innerHTML)

  return {
    subject: processedSubject,
    htmlBody,
  }
}

/**
 * Extract the body content from the rendered HTML (content after --- separator)
 */
function extractBodyFromHtml(fullHtml: string): string {
  const container = document.createElement('div')
  container.innerHTML = fullHtml

  // docx-preview creates a structure like: <div class="docx">...</div>
  // We need to find all paragraph-like elements and look for the separator
  const docxWrapper = container.querySelector('.docx') || container

  // Get all paragraph elements (docx-preview uses <p> tags)
  const paragraphs = Array.from(docxWrapper.querySelectorAll('p'))

  // Find the paragraph containing "---"
  let separatorIndex = -1
  for (let i = 0; i < paragraphs.length; i++) {
    const text = paragraphs[i].textContent || ''
    if (text.trim() === '---' || text.includes('---')) {
      separatorIndex = i
      break
    }
  }

  if (separatorIndex === -1) {
    // No separator found - return full content
    console.warn('No --- separator found in document')
    return fullHtml
  }

  // Get all paragraphs after the separator
  const bodyParagraphs = paragraphs.slice(separatorIndex + 1)

  if (bodyParagraphs.length === 0) {
    console.warn('No content after --- separator')
    return fullHtml
  }

  // Return the HTML of body paragraphs
  return bodyParagraphs.map(p => p.outerHTML).join('')
}

/**
 * Generate a preview of the email without sending
 */
export async function generateEmailPreview(
  docxArrayBuffer: ArrayBuffer,
  subject: string,
  rowData: Record<string, string>,
  mappings: PlaceholderMapping[]
): Promise<GeneratedEmail> {
  return generateEmailFromDocx(docxArrayBuffer, subject, rowData, mappings)
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
