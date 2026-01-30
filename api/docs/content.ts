import type { VercelRequest, VercelResponse } from '@vercel/node'

interface DocContent {
  title: string
  htmlContent: string
  rawText: string
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

  // Extract docId from query parameter
  const { id } = req.query
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing id parameter' })
  }

  try {
    // Export as HTML using Drive API
    const exportResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text/html`,
      {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }
    )

    if (!exportResponse.ok) {
      const error = await exportResponse.json()
      throw new Error(error.error?.message || 'Failed to export document')
    }

    const htmlContent = await exportResponse.text()

    // Get document metadata for title
    const metaResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?fields=name`,
      {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }
    )

    if (!metaResponse.ok) {
      const error = await metaResponse.json()
      throw new Error(error.error?.message || 'Failed to get document metadata')
    }

    const metadata = await metaResponse.json()

    // Extract raw text by stripping HTML tags (for placeholder parsing)
    const rawText = htmlContent
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style tags
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace nbsp
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim()

    const result: DocContent = {
      title: metadata.name,
      htmlContent,
      rawText,
    }

    res.json(result)
  } catch (error) {
    console.error('Doc fetch error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch document',
    })
  }
}
