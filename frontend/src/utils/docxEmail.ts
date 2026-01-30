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
 * Uses DOM-based parsing to handle nested HTML structures from docx-preview
 */
function extractBodyFromHtml(fullHtml: string): string {
  // Parse HTML into actual DOM
  const container = document.createElement('div')
  container.innerHTML = fullHtml

  // Find the docx wrapper (docx-preview creates elements with .docx class)
  const docxWrapper = container.querySelector('.docx') || container

  // Get all top-level children
  const children = Array.from(docxWrapper.children) as HTMLElement[]

  // Find the separator element (contains only "---")
  let separatorIndex = -1
  for (let i = 0; i < children.length; i++) {
    const text = children[i].textContent?.trim()
    if (text === '---' || (text && /^-{3,}$/.test(text))) {
      separatorIndex = i
      break
    }
  }

  // If not found at top level, try deeper search - separator might be nested
  if (separatorIndex === -1) {
    const allElements = docxWrapper.querySelectorAll('*')
    for (const el of allElements) {
      const text = el.textContent?.trim()
      // Check if this element contains ONLY the separator (not parent elements with more content)
      if (text && /^-{3,}$/.test(text) && el.childNodes.length <= 1) {
        // Found separator, now find its top-level ancestor within docxWrapper
        let topLevel: HTMLElement = el as HTMLElement
        while (topLevel.parentElement && topLevel.parentElement !== docxWrapper) {
          topLevel = topLevel.parentElement
        }
        separatorIndex = children.indexOf(topLevel)
        break
      }
    }
  }

  if (separatorIndex === -1) {
    console.warn('No --- separator found, returning full HTML')
    return fullHtml
  }

  // Extract all elements AFTER the separator
  const bodyElements = children.slice(separatorIndex + 1)

  if (bodyElements.length === 0) {
    console.warn('No content after separator')
    return fullHtml
  }

  // Preserve any <style> tags from docx-preview for formatting
  const styles = container.querySelectorAll('style')
  const styleHtml = Array.from(styles).map((s) => s.outerHTML).join('')

  // Reconstruct HTML from body elements with styles
  const bodyHtml = bodyElements.map((el) => el.outerHTML).join('')

  return styleHtml + bodyHtml
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
