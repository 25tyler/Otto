import type { PlaceholderMapping } from '../types'

export function extractPlaceholders(text: string): string[] {
  const placeholderRegex = /\[([^\]]+)\]/g
  const placeholders = new Set<string>()

  let match
  while ((match = placeholderRegex.exec(text)) !== null) {
    placeholders.add(match[1])
  }

  return Array.from(placeholders)
}

export function autoMapPlaceholders(
  templatePlaceholders: string[],
  excelHeaders: string[]
): PlaceholderMapping[] {
  return templatePlaceholders.map((placeholder) => {
    // Try exact match first (case-insensitive)
    const exactMatch = excelHeaders.find(
      (h) => h.toLowerCase() === placeholder.toLowerCase()
    )

    if (exactMatch) {
      return {
        placeholder,
        excelColumn: exactMatch,
        status: 'auto-mapped' as const,
      }
    }

    // Try fuzzy match (remove spaces, underscores, hyphens)
    const normalizedPlaceholder = placeholder.toLowerCase().replace(/[\s_-]/g, '')
    const fuzzyMatch = excelHeaders.find(
      (h) => h.toLowerCase().replace(/[\s_-]/g, '') === normalizedPlaceholder
    )

    if (fuzzyMatch) {
      return {
        placeholder,
        excelColumn: fuzzyMatch,
        status: 'auto-mapped' as const,
      }
    }

    return {
      placeholder,
      excelColumn: null,
      status: 'unmapped' as const,
    }
  })
}

export function replacePlaceholders(
  text: string,
  data: Record<string, string>,
  mappings: PlaceholderMapping[]
): string {
  let result = text

  mappings.forEach(({ placeholder, excelColumn }) => {
    if (excelColumn && data[excelColumn] !== undefined) {
      const regex = new RegExp(`\\[${escapeRegex(placeholder)}\\]`, 'gi')
      result = result.replace(regex, escapeHtml(data[excelColumn]))
    }
  })

  return result
}

export function highlightPlaceholders(html: string): string {
  return html.replace(
    /\[([^\]]+)\]/g,
    '<span class="placeholder-highlight">[$1]</span>'
  )
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
