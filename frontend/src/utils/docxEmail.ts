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

  // Set the data for placeholder replacement
  doc.setData(templateData)

  // Render the document (replace all placeholders)
  doc.render()

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
  // Find the element containing "---" and return everything after it
  const container = document.createElement('div')
  container.innerHTML = fullHtml

  // Walk through all elements to find the separator
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let foundSeparator = false
  let separatorNode: Node | null = null

  while (walker.nextNode()) {
    const textContent = walker.currentNode.textContent || ''
    if (textContent.includes('---')) {
      foundSeparator = true
      separatorNode = walker.currentNode
      break
    }
  }

  if (!foundSeparator || !separatorNode) {
    // No separator found, return the full content
    return fullHtml
  }

  // Find the parent element of the separator and get all content after it
  let separatorElement = separatorNode.parentElement
  while (separatorElement && separatorElement.parentElement !== container) {
    separatorElement = separatorElement.parentElement
  }

  if (!separatorElement) {
    return fullHtml
  }

  // Get all sibling elements after the separator
  const bodyElements: string[] = []
  let sibling = separatorElement.nextElementSibling
  while (sibling) {
    bodyElements.push(sibling.outerHTML)
    sibling = sibling.nextElementSibling
  }

  return bodyElements.join('')
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
