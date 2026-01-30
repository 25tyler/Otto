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

  // Debug: log the structure
  console.log('Full HTML length:', fullHtml.length)
  console.log('Container children:', container.children.length)

  // docx-preview creates a structure like: <article class="docx">...</article>
  // or <section class="docx">...</section> depending on version
  const docxWrapper = container.querySelector('.docx') || container.firstElementChild || container

  console.log('Docx wrapper tag:', docxWrapper?.tagName)
  console.log('Docx wrapper class:', docxWrapper?.className)

  // Get all elements that might contain text (p, div, span, etc.)
  const allElements = Array.from(docxWrapper.querySelectorAll('*'))

  // Find element containing "---"
  let separatorElement: Element | null = null
  for (const el of allElements) {
    // Only check direct text content, not nested
    const directText = Array.from(el.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent)
      .join('')

    if (directText.includes('---') || el.textContent?.trim() === '---') {
      separatorElement = el
      console.log('Found separator in element:', el.tagName, el.className)
      break
    }
  }

  if (!separatorElement) {
    console.warn('No --- separator found in document. Full HTML:', fullHtml.substring(0, 500))
    return fullHtml
  }

  // Find the top-level parent of the separator within the docx wrapper
  let topLevelSeparator = separatorElement
  while (topLevelSeparator.parentElement && topLevelSeparator.parentElement !== docxWrapper) {
    topLevelSeparator = topLevelSeparator.parentElement
  }

  // Get all siblings after the separator
  const bodyElements: Element[] = []
  let sibling = topLevelSeparator.nextElementSibling
  while (sibling) {
    bodyElements.push(sibling)
    sibling = sibling.nextElementSibling
  }

  console.log('Body elements count:', bodyElements.length)

  if (bodyElements.length === 0) {
    console.warn('No content after --- separator')
    return fullHtml
  }

  const result = bodyElements.map(el => el.outerHTML).join('')
  console.log('Extracted body length:', result.length)
  return result
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
