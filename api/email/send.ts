import type { VercelRequest, VercelResponse } from '@vercel/node'

interface SendEmailRequest {
  to: string
  cc?: string[]
  subject: string
  htmlBody: string
}

// Convert HTML to plain text for multipart emails
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Get session
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

  const { to, cc, subject, htmlBody }: SendEmailRequest = req.body

  if (!to || !subject || !htmlBody) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    // Generate plain text version from HTML
    const plainText = htmlToPlainText(htmlBody)

    // Generate a boundary for multipart message
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`

    // Build RFC 2822 multipart message
    const headers = [
      `From: ${session.user.email}`,
      `To: ${to}`,
      cc?.length ? `Cc: ${cc.join(', ')}` : null,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ]
      .filter((h): h is string => h !== null)
      .join('\r\n')

    // Multipart body with plain text and HTML versions
    const body = [
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      plainText,
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      htmlBody,
      `--${boundary}--`,
    ].join('\r\n')

    const messageParts = headers + '\r\n\r\n' + body

    // Base64 URL-safe encode
    const encodedMessage = Buffer.from(messageParts)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    // Send via Gmail API
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedMessage }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Failed to send email')
    }

    const result = await response.json()

    res.json({
      success: true,
      messageId: result.id,
    })
  } catch (error) {
    console.error('Send email error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to send email',
    })
  }
}
