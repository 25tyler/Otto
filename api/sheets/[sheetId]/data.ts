import type { VercelRequest, VercelResponse } from '@vercel/node'

interface SheetData {
  headers: string[]
  rows: Record<string, string>[]
  emailColumn: string | null
  totalRows: number
  warnings: string[]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Validate session
  const sessionCookie = req.cookies?.otto_session
  if (!sessionCookie) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  let session
  try {
    session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('utf-8'))
  } catch {
    return res.status(401).json({ error: 'Invalid session' })
  }

  if (!session.accessToken) {
    return res.status(401).json({ error: 'No access token' })
  }

  // Extract sheetId and optional range
  const { sheetId, range = 'Sheet1' } = req.query
  if (!sheetId || typeof sheetId !== 'string') {
    return res.status(400).json({ error: 'Missing sheetId' })
  }

  try {
    // First, get spreadsheet metadata to find sheet names
    const metaResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
      {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }
    )

    if (!metaResponse.ok) {
      const error = await metaResponse.json()
      throw new Error(error.error?.message || 'Failed to get spreadsheet metadata')
    }

    const metadata = await metaResponse.json()
    const sheets = metadata.sheets || []

    // Use provided range or default to first sheet
    let sheetRange = range as string
    if (sheetRange === 'Sheet1' && sheets.length > 0) {
      sheetRange = sheets[0].properties.title
    }

    // Fetch sheet data via Sheets API
    const sheetsResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetRange)}?majorDimension=ROWS`,
      {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }
    )

    if (!sheetsResponse.ok) {
      const error = await sheetsResponse.json()
      throw new Error(error.error?.message || 'Failed to read spreadsheet')
    }

    const data = await sheetsResponse.json()
    const values: string[][] = data.values || []

    if (values.length < 2) {
      return res.status(400).json({
        error: 'Spreadsheet must have headers and at least one data row',
      })
    }

    // Extract headers from first row
    const headers = values[0].map((h: string) => String(h || '').trim())

    // Convert rows to objects
    const warnings: string[] = []
    const rows = values.slice(1).map((row, index) => {
      const rowData: Record<string, string> = {}
      headers.forEach((header, colIndex) => {
        rowData[header] = String(row[colIndex] || '').trim()
      })
      return rowData
    })

    // Find email column (same logic as existing parseExcelFile)
    const emailColumn =
      headers.find((h) =>
        ['email', 'e-mail', 'emailaddress', 'email address', 'emails'].includes(
          h.toLowerCase().replace(/[\s_-]/g, '')
        )
      ) || null

    if (!emailColumn) {
      return res.status(400).json({
        error:
          'Could not find email column. Please ensure your spreadsheet has a column named "Email"',
      })
    }

    // Validate emails
    rows.forEach((row, index) => {
      const email = row[emailColumn]
      if (!isValidEmail(email)) {
        warnings.push(`Row ${index + 2}: Invalid email "${email}"`)
      }
    })

    const result: SheetData = {
      headers,
      rows,
      emailColumn,
      totalRows: rows.length,
      warnings,
    }

    res.json(result)
  } catch (error) {
    console.error('Sheets fetch error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch spreadsheet',
    })
  }
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
