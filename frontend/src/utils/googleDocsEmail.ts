import type { PlaceholderMapping } from '../types'

interface GeneratedEmail {
  subject: string
  htmlBody: string
}

/**
 * Generate an email by replacing placeholders in Google Doc HTML content.
 * Much simpler than DOCX processing since we already have HTML from Google's export.
 */
export function generateEmailFromGoogleDoc(
  sourceHtml: string,
  subject: string,
  rowData: Record<string, string>,
  mappings: PlaceholderMapping[]
): GeneratedEmail {
  // Replace placeholders in subject
  let processedSubject = subject
  mappings.forEach(({ placeholder, excelColumn }) => {
    if (excelColumn && rowData[excelColumn] !== undefined) {
      const regex = new RegExp(`\\[${escapeRegex(placeholder)}\\]`, 'gi')
      processedSubject = processedSubject.replace(regex, rowData[excelColumn])
    }
  })

  // Extract body content after --- separator
  let htmlBody = extractBodyFromHtml(sourceHtml)

  // Replace placeholders in body HTML
  // Need to be careful to preserve HTML structure while replacing placeholder text
  mappings.forEach(({ placeholder, excelColumn }) => {
    if (excelColumn && rowData[excelColumn] !== undefined) {
      const regex = new RegExp(`\\[${escapeRegex(placeholder)}\\]`, 'gi')
      // Escape HTML in the replacement value to prevent XSS
      htmlBody = htmlBody.replace(regex, escapeHtml(rowData[excelColumn]))
    }
  })

  return { subject: processedSubject, htmlBody }
}

/**
 * Extract the body content from Google Docs HTML export (content after --- separator)
 */
function extractBodyFromHtml(fullHtml: string): string {
  // Google Docs HTML export has a different structure than docx-preview
  // The content is typically in the body, with paragraphs as <p> tags

  const container = document.createElement('div')
  container.innerHTML = fullHtml

  // Look for body content if it's a full HTML document
  const body = container.querySelector('body')
  const content = body || container

  // Get all elements that might contain the separator
  const allElements = Array.from(content.querySelectorAll('*'))

  let separatorElement: Element | null = null

  // First check for <hr> elements (Google Docs sometimes uses these)
  const hrElements = content.querySelectorAll('hr')
  if (hrElements.length > 0) {
    // Use first <hr> as separator
    const hr = hrElements[0]
    const siblings: Element[] = []
    let sibling = hr.nextElementSibling
    while (sibling) {
      siblings.push(sibling)
      sibling = sibling.nextElementSibling
    }

    // Walk up if needed
    if (siblings.length === 0) {
      let parent = hr.parentElement
      while (parent && parent !== content) {
        const nextSibling = parent.nextElementSibling
        if (nextSibling) {
          let s: Element | null = nextSibling
          while (s) {
            siblings.push(s)
            s = s.nextElementSibling
          }
          break
        }
        parent = parent.parentElement
      }
    }

    if (siblings.length > 0) {
      const styles = container.querySelectorAll('style')
      const styleHtml = Array.from(styles)
        .map((s) => s.outerHTML)
        .join('')
      return styleHtml + siblings.map((el) => el.outerHTML).join('')
    }
  }

  // Separator patterns: ---, —— (em-dashes), or ─── (horizontal lines)
  // Google Docs might convert --- to different characters
  const separatorRegex = /^[-—─_]{3,}$/

  // Find the element containing just separator characters
  for (const el of allElements) {
    const text = el.textContent?.trim()
    if (text && separatorRegex.test(text)) {
      // Make sure this element only contains the separator (not a parent with more content)
      const childText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent)
        .join('')
        .trim()

      if (childText && separatorRegex.test(childText)) {
        separatorElement = el
        break
      }

      // Also check if direct text content is just the separator
      if (el.children.length === 0 && separatorRegex.test(text)) {
        separatorElement = el
        break
      }
    }
  }

  if (!separatorElement) {
    // Try a simpler approach - find separator in text and work with the HTML
    // Match various dash/line characters
    const separatorPatterns = [
      /<p[^>]*>\s*[-—─_]{3,}\s*<\/p>/i,
      /<span[^>]*>\s*[-—─_]{3,}\s*<\/span>/i,
      /<div[^>]*>\s*[-—─_]{3,}\s*<\/div>/i,
    ]

    for (const pattern of separatorPatterns) {
      const match = fullHtml.match(pattern)
      if (match && match.index !== undefined) {
        const afterSeparator = fullHtml.substring(match.index + match[0].length).trim()
        if (afterSeparator) {
          return afterSeparator
        }
      }
    }

    console.warn('No separator found in HTML, returning full HTML')
    return fullHtml
  }

  // Get siblings after the separator element
  const siblings: Element[] = []
  let sibling = separatorElement.nextElementSibling
  while (sibling) {
    siblings.push(sibling)
    sibling = sibling.nextElementSibling
  }

  // If separator is deeply nested, walk up to find a useful parent
  if (siblings.length === 0) {
    let parent = separatorElement.parentElement
    while (parent && parent !== content) {
      const nextSibling = parent.nextElementSibling
      if (nextSibling) {
        // Collect this and all following siblings
        let s: Element | null = nextSibling
        while (s) {
          siblings.push(s)
          s = s.nextElementSibling
        }
        break
      }
      parent = parent.parentElement
    }
  }

  if (siblings.length === 0) {
    console.warn('No content after separator')
    return fullHtml
  }

  // Preserve any style tags from the document
  const styles = container.querySelectorAll('style')
  const styleHtml = Array.from(styles)
    .map((s) => s.outerHTML)
    .join('')

  return styleHtml + siblings.map((el) => el.outerHTML).join('')
}

/**
 * Generate a preview of the email (same as generate, but named for clarity)
 */
export function generateEmailPreviewFromGoogleDoc(
  sourceHtml: string,
  subject: string,
  rowData: Record<string, string>,
  mappings: PlaceholderMapping[]
): GeneratedEmail {
  return generateEmailFromGoogleDoc(sourceHtml, subject, rowData, mappings)
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}
